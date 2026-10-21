// Controlador do modo aula: liga voz -> detector -> candidatos -> projeção,
// e anota tudo no registro de teste. Fica fora do React para continuar
// funcionando quando o professor troca de aba (Acervo, Registro).
import { carregarIndice } from '../dados/db';
import type { Item } from '../dados/modelo';
import { abrirCanal, type Mensagem } from '../comum/canal';
import { inicioDoTexto, resolver, type Projetavel } from '../comum/legislacao';
import { registrar } from '../comum/registro';
import { detectarComandos, type Comando } from '../voz/comandos';
import { Detector, chaveReferencia, type Referencia } from '../voz/detector';
import { normalizarFala } from '../voz/normalizar';
import { Reconhecedor, nomeNavegador, type StatusVoz } from '../voz/reconhecedor';

export interface Candidato {
  id: string;
  chave: string;
  titulo: string;
  texto: string;
  aviso: string | null;
  projetavel: Projetavel;
  criadoEm: number;
  origem: 'parcial' | 'final';
  contexto: boolean;
}

export interface FalaFinal {
  id: number;
  em: number;
  texto: string;
}

export interface Detectado {
  id: number;
  em: number;
  titulo: string;
  situacao: 'novo' | 'refinado' | 'repetido' | 'fora do acervo' | 'outro diploma';
}

export type ModoRoda = 'candidatos' | 'rolar';

export interface EstadoAula {
  status: StatusVoz;
  statusDetalhe: string;
  escutando: boolean;
  saiu: boolean;
  finais: FalaFinal[];
  parcial: string;
  candidatos: Candidato[];
  selecionadoId: string | null;
  modoRoda: ModoRoda;
  projetado: Candidato | null;
  escala: number;
  projecao: { conectada: boolean; telaCheia: boolean; fracao: number; rolavel: boolean };
  detectados: Detectado[];
  totalAcervo: number;
  aviso: string | null;
}

const MAX_CANDIDATOS = 5;
const EXPIRA_MS = 5 * 60_000;
const REPETIDO_MS = 30_000;
const REFINO_MS = 20_000;
const INTERACAO_MS = 4_000;
const PALAVRAS_CAUDA = 8;

let seq = 1;

export class ControladorAula {
  private estado: EstadoAula = {
    status: 'parado',
    statusDetalhe: '',
    escutando: false,
    saiu: false,
    finais: [],
    parcial: '',
    candidatos: [],
    selecionadoId: null,
    modoRoda: 'candidatos',
    projetado: null,
    escala: 1,
    projecao: { conectada: false, telaCheia: false, fracao: 0, rolavel: false },
    detectados: [],
    totalAcervo: 0,
    aviso: null,
  };
  private ouvintes = new Set<() => void>();
  private indice = new Map<string, Item>();
  private detector = new Detector();
  private voz: Reconhecedor;
  private canal: { enviar: (m: Mensagem) => void; fechar: () => void };
  private cauda = '';
  private ultimaInteracao = 0;
  private ultimoPong = 0;
  private comandosFeitos = new Set<string>();

  constructor() {
    this.voz = new Reconhecedor({
      onParcial: (t, k) => this.aoParcial(t, k),
      onFinal: (t, k, c) => this.aoFinal(t, k, c),
      onStatus: (s, d) => this.mudar({ status: s, statusDetalhe: d ?? '' }),
      onDiagnostico: (t, d) => registrar('voz', t, d),
    });
    this.canal = abrirCanal((m) => this.aoMensagem(m));
    window.setInterval(() => this.canal.enviar({ t: 'ping' }), 2_000);
    window.setInterval(() => this.manutencao(), 2_000);
    window.addEventListener('vide-acervo-mudou', () => void this.recarregarAcervo());
    void this.recarregarAcervo();
  }

  // ---------- estado / React ----------
  obter = (): EstadoAula => this.estado;
  assinar = (f: () => void): (() => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };
  private mudar(parcial: Partial<EstadoAula>) {
    this.estado = { ...this.estado, ...parcial };
    this.ouvintes.forEach((f) => f());
  }

  async recarregarAcervo() {
    this.indice = await carregarIndice();
    this.mudar({ totalAcervo: this.indice.size });
  }

  // ---------- escuta ----------
  iniciar() {
    registrar('sessao', this.estado.saiu ? 'retomou a aula' : 'escuta iniciada', {
      navegador: nomeNavegador(),
      agente: navigator.userAgent,
      itens_no_acervo: this.indice.size,
    });
    this.voz.iniciar();
    this.mudar({ escutando: this.voz.ativo, saiu: false });
  }

  pausar() {
    this.voz.parar();
    this.cauda = '';
    registrar('sessao', 'escuta pausada');
    this.mudar({ escutando: false, parcial: '' });
  }

  sair() {
    this.voz.parar();
    this.cauda = '';
    this.recolher('sair');
    registrar('sessao', 'saiu para outro material');
    this.mudar({ escutando: false, saiu: true, parcial: '' });
  }

  marcar() {
    const ultima = this.estado.finais[this.estado.finais.length - 1]?.texto ?? '';
    registrar('marcacao', 'marcado pelo professor', { ultima_fala: ultima, parcial: this.estado.parcial });
    this.mudar({ aviso: 'Momento marcado no registro.' });
    window.setTimeout(() => this.estado.aviso === 'Momento marcado no registro.' && this.mudar({ aviso: null }), 2_500);
  }

  private aoParcial(texto: string, chave: string) {
    this.mudar({ parcial: texto });
    if (!texto) return;
    this.processar(texto, chave, 'parcial');
  }

  private aoFinal(texto: string, chave: string, confianca: number) {
    registrar('fala', texto, { confianca: confianca >= 0 ? Number(confianca.toFixed(2)) : 'provisório', trecho: chave });
    const finais = [...this.estado.finais, { id: seq++, em: Date.now(), texto }].slice(-120);
    this.mudar({ finais, parcial: '' });
    this.processar(texto, chave, 'final');
    const palavras = texto.split(/\s+/);
    this.cauda = palavras.slice(-PALAVRAS_CAUDA).join(' ');
  }

  /** Teste sem microfone: trata um texto digitado como se fosse fala. */
  simularFala(texto: string) {
    this.aoFinal(texto, `sim:${seq}`, 1);
  }

  private processar(texto: string, chave: string, origem: 'parcial' | 'final') {
    // Comandos de voz
    for (const c of detectarComandos(texto)) this.comandoVoz(c, chave, texto);

    // Referências: inclui o fim da fala anterior ("inciso sexto do" | "485")
    const comCauda = this.cauda ? `${this.cauda} ${texto}` : texto;
    const nCauda = this.cauda ? normalizarFala(this.cauda).length : 0;
    const r = this.detector.detectar(comCauda);
    for (const o of r.outros) {
      if (origem !== 'final' || o.fim <= nCauda) continue;
      registrar('outro_diploma', o.trecho.replace('§outro ', ''), { diploma: o.diploma });
      this.anotar(o.trecho.replace('§outro ', ''), 'outro diploma');
    }
    for (const ref of r.referencias) {
      if (ref.fim <= nCauda) continue; // já tratado na fala anterior
      // Parcial: se a referência termina na última palavra, o número pode estar incompleto ("artigo 4…85")
      if (origem === 'parcial' && ref.fim >= r.palavras.length) continue;
      this.aoDetectar(ref, origem);
    }
  }

  private anotar(titulo: string, situacao: Detectado['situacao']) {
    const detectados = [...this.estado.detectados, { id: seq++, em: Date.now(), titulo, situacao }].slice(-40);
    this.mudar({ detectados });
  }

  private aoDetectar(ref: Referencia, origem: 'parcial' | 'final') {
    const chave = chaveReferencia(ref);
    const agora = Date.now();
    const lista = this.estado.candidatos;
    const dadosLog = { chave, trecho: ref.trecho, origem, contexto: ref.contexto, cpc_dito: ref.explicito };

    // Repetido há pouco: ignora.
    const igual = lista.find((c) => c.chave === chave);
    if (igual && agora - igual.criadoEm < REPETIDO_MS) return;
    // Menos específico que um recente ("485" depois de "485, VI"): ignora.
    if (lista.some((c) => c.chave.startsWith(chave + ':') && agora - c.criadoEm < REFINO_MS)) return;

    const id = `c${seq++}`;
    const res = resolver(ref, this.indice, id);
    if (!res) {
      const titulo = `art. ${ref.art} CPC`;
      if (!this.estado.detectados.some((d) => d.titulo === titulo && agora - d.em < REPETIDO_MS)) {
        registrar('nao_encontrado', titulo, dadosLog);
        this.anotar(titulo, 'fora do acervo');
      }
      return;
    }
    // Pelo contexto e inexistente (ex.: "inciso sexto" logo depois do art. 70): descarta.
    if (ref.contexto && res.aviso) {
      registrar('detectado', res.titulo, { ...dadosLog, acao: 'descartado', aviso: res.aviso });
      return;
    }
    const novo: Candidato = {
      id,
      chave,
      titulo: res.titulo,
      texto: inicioDoTexto(res.texto),
      aviso: res.aviso,
      projetavel: res.projetavel,
      criadoEm: agora,
      origem,
      contexto: ref.contexto,
    };

    // Mais específico que um recente ("485" -> "485, VI"): substitui.
    const menos = lista.find((c) => chave.startsWith(c.chave + ':') && agora - c.criadoEm < REFINO_MS);
    let situacao: Detectado['situacao'] = 'novo';
    let nova = lista.filter((c) => c !== igual && c !== menos);
    if (menos) situacao = 'refinado';
    else if (igual) situacao = 'repetido';
    nova = [novo, ...nova].slice(0, MAX_CANDIDATOS);

    let selecionadoId = this.estado.selecionadoId;
    const interagiu = agora - this.ultimaInteracao < INTERACAO_MS;
    if (!interagiu || !selecionadoId || selecionadoId === menos?.id || selecionadoId === igual?.id) selecionadoId = novo.id;
    if (!nova.some((c) => c.id === selecionadoId)) selecionadoId = nova[0]?.id ?? null;

    registrar('detectado', res.titulo, { ...dadosLog, acao: situacao, aviso: res.aviso ?? undefined });
    this.anotar(res.titulo, situacao);
    this.mudar({ candidatos: nova, selecionadoId });
  }

  // ---------- controles ----------
  mover(delta: number) {
    this.ultimaInteracao = Date.now();
    const lista = this.estado.candidatos;
    if (!lista.length) return;
    const atual = lista.findIndex((c) => c.id === this.estado.selecionadoId);
    const idx = Math.max(0, Math.min(lista.length - 1, (atual < 0 ? 0 : atual) + delta));
    this.mudar({ selecionadoId: lista[idx].id });
  }

  selecionar(id: string) {
    this.ultimaInteracao = Date.now();
    this.mudar({ selecionadoId: id });
  }

  projetar(origem: 'mouse' | 'teclado' = 'mouse') {
    const lista = this.estado.candidatos;
    const idx = lista.findIndex((c) => c.id === this.estado.selecionadoId);
    const c = lista[idx];
    if (!c) return;
    this.ultimaInteracao = Date.now();
    this.canal.enviar({ t: 'projetar', item: c.projetavel, escala: 1 });
    registrar('projetado', c.titulo, {
      chave: c.chave,
      posicao: `${idx + 1} de ${lista.length}`,
      idade_s: Math.round((Date.now() - c.criadoEm) / 1000),
      detectado_em: c.origem,
      substituiu: this.estado.projetado?.titulo,
      via: origem,
      projecao_conectada: this.estado.projecao.conectada,
    });
    this.mudar({ projetado: c, escala: 1 });
  }

  recolher(origem: 'mouse' | 'voz' | 'teclado' | 'sair') {
    if (!this.estado.projetado) {
      this.canal.enviar({ t: 'recolher' });
      return;
    }
    this.canal.enviar({ t: 'recolher' });
    registrar('recolhido', this.estado.projetado.titulo, { via: origem });
    this.mudar({ projetado: null, modoRoda: 'candidatos' });
  }

  alternarModo() {
    this.mudar({ modoRoda: this.estado.modoRoda === 'candidatos' ? 'rolar' : 'candidatos' });
  }

  rolar(delta: number) {
    if (this.estado.projetado) this.canal.enviar({ t: 'rolar', delta });
  }

  private mudarEscala(fator: number) {
    const escala = Math.max(0.6, Math.min(2.5, this.estado.escala * fator));
    this.canal.enviar({ t: 'escala', escala });
    this.mudar({ escala });
  }

  aumentarFonte() {
    this.mudarEscala(1.15);
  }
  diminuirFonte() {
    this.mudarEscala(1 / 1.15);
  }

  private comandoVoz(c: Comando, chave: string, trecho: string) {
    const k = `${chave}:${c}`;
    if (this.comandosFeitos.has(k)) return;
    this.comandosFeitos.add(k);
    if (this.comandosFeitos.size > 500) this.comandosFeitos = new Set([...this.comandosFeitos].slice(-200));
    const nomes: Record<Comando, string> = { recolher: 'tira da tela', aumentar: 'aumenta a fonte', diminuir: 'diminui a fonte' };
    if (!this.estado.projetado) {
      registrar('comando_voz', nomes[c], { trecho, executado: false, motivo: 'nada projetado' });
      return;
    }
    registrar('comando_voz', nomes[c], { trecho, executado: true });
    if (c === 'recolher') this.recolher('voz');
    else if (c === 'aumentar') this.aumentarFonte();
    else this.diminuirFonte();
  }

  // ---------- projeção ----------
  async abrirProjecao() {
    const url = `${location.origin}${location.pathname}?tela=projecao`;
    let recursos = 'popup,width=1280,height=720';
    try {
      const w = window as unknown as {
        getScreenDetails?: () => Promise<{
          screens: { availLeft: number; availTop: number; availWidth: number; availHeight: number; isPrimary: boolean }[];
          currentScreen: unknown;
        }>;
      };
      if (w.getScreenDetails) {
        const det = await w.getScreenDetails();
        const outra = det.screens.find((s) => s !== det.currentScreen);
        if (outra) recursos = `popup,left=${outra.availLeft},top=${outra.availTop},width=${outra.availWidth},height=${outra.availHeight}`;
      }
    } catch {
      /* sem permissão para ver as telas: abre normal */
    }
    const janela = window.open(url, 'vide-projecao', recursos);
    if (!janela) {
      this.mudar({ aviso: 'O navegador bloqueou a janela de projeção. Clique de novo em "Abrir projeção" ou permita pop-ups para este site.' });
    } else {
      registrar('sessao', 'janela de projeção aberta', { recursos });
    }
  }

  private aoMensagem(m: Mensagem) {
    if (m.t === 'ola') {
      if (this.estado.projetado) this.canal.enviar({ t: 'projetar', item: this.estado.projetado.projetavel, escala: this.estado.escala });
    } else if (m.t === 'pong') {
      this.ultimoPong = Date.now();
      const p = this.estado.projecao;
      if (!p.conectada || p.telaCheia !== m.telaCheia) this.mudar({ projecao: { ...p, conectada: true, telaCheia: m.telaCheia } });
    } else if (m.t === 'rolagem') {
      this.mudar({ projecao: { ...this.estado.projecao, fracao: m.fracao, rolavel: m.rolavel } });
    }
  }

  private manutencao() {
    const agora = Date.now();
    const p = this.estado.projecao;
    if (p.conectada && agora - this.ultimoPong > 5_000) this.mudar({ projecao: { ...p, conectada: false } });
    const vivos = this.estado.candidatos.filter((c) => agora - c.criadoEm < EXPIRA_MS || c.id === this.estado.projetado?.id);
    if (vivos.length !== this.estado.candidatos.length) {
      const sel = vivos.some((c) => c.id === this.estado.selecionadoId) ? this.estado.selecionadoId : (vivos[0]?.id ?? null);
      this.mudar({ candidatos: vivos, selecionadoId: sel });
    }
  }

  fecharAviso() {
    this.mudar({ aviso: null });
  }
}

let instancia: ControladorAula | null = null;
export function controlador(): ControladorAula {
  if (!instancia) instancia = new ControladorAula();
  return instancia;
}
