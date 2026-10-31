// Controlador do modo aula: liga voz -> detector -> candidatos -> projeção,
// e anota tudo no registro de teste. Fica fora do React para continuar
// funcionando quando o professor troca de aba (Acervo, Registro).
import { carregarIndice, listarDiplomas } from '../dados/db';
import { abreviacaoDe, definirExtras, diplomaPrincipal, todosDiplomas, type DefDiploma } from '../dados/diplomas';
import type { Item } from '../dados/modelo';
import { abrirCanal, type LayoutArtigo, type Mensagem } from '../comum/canal';
import { listarMateriais } from '../material/documento';
import { PAGINA_INTEIRA, ajustarRegiao, ehInteira, passo, type Regiao } from '../material/regiao';
import { inicioDoTexto, resolver, type Projetavel } from '../comum/legislacao';
import { inicioSessaoAtual, novaSessao, registrar } from '../comum/registro';
import { detectarComandos, type Comando } from '../voz/comandos';
import { Detector, chaveReferencia, type Referencia } from '../voz/detector';
import { lerDigitado } from '../voz/digitado';
import { Reconhecedor, nomeNavegador, type StatusVoz } from '../voz/reconhecedor';
import { ConexaoSala, type StatusConexao } from '../remoto/conexao';
import { gerarCodigo, type EnvioDoComputador, type MsgDoCelular, type MsgDoComputador } from '../remoto/protocolo';

const CHAVE_ESCALA = 'vide.escalaFonte';
const ESCALA_MIN = 0.6;
const ESCALA_MAX = 2.5;
/** Tamanho da fonte escolhido pelo professor (1 = 100%). Fica guardado neste navegador. */
function escalaGuardada(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE_ESCALA));
    return v >= ESCALA_MIN && v <= ESCALA_MAX ? v : 1;
  } catch {
    return 1;
  }
}

export interface Candidato {
  id: string;
  chave: string;
  titulo: string;
  texto: string;
  aviso: string | null;
  projetavel: Projetavel;
  criadoEm: number;
  origem: 'parcial' | 'final' | 'digitado';
  contexto: boolean;
  /** Trecho de fala (resultado do reconhecedor) que gerou o candidato. */
  trechoId: string;
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
  situacao: 'novo' | 'refinado' | 'repetido' | 'fora do acervo' | 'outro diploma' | 'retirado' | 'digitado';
}

/** O que a roda do mouse faz: escolher candidato, rolar o artigo projetado ou passar o material. */
export type ModoRoda = 'candidatos' | 'rolar' | 'material';

export interface MaterialNaTela {
  id: string;
  nome: string;
  paginas: number;
  pagina: number;
  regiao: Regiao;
}

export interface MaterialResumo {
  id: string;
  nome: string;
  tipo: 'pdf' | 'imagem';
  paginas: number;
}

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
  projecao: {
    conectada: boolean;
    telaCheia: boolean;
    fracao: number;
    rolavel: boolean;
    aspecto: number;
    /** Versão do app na janela de projeção ('?' = antiga, de antes deste aviso existir). */
    versao: string;
    /** Material que a janela de projeção conseguiu abrir. */
    materialCarregado: string | null;
  };
  detectados: Detectado[];
  totalAcervo: number;
  /** Leis guardadas no acervo (abreviações), e a lei principal da aula. */
  leis: { sigla: string; abreviacao: string }[];
  principal: string;
  aviso: string | null;
  /** Quando a sessão atual do registro começou (ms). */
  sessaoInicio: number;
  /** Material (slides/PDF) exibido no projetor, se houver. */
  material: MaterialNaTela | null;
  /** Material escondido temporariamente (projetor preto). */
  telaPreta: boolean;
  /** Com material na tela, o artigo aparece ao lado (lateral) ou por cima de tudo (cheia). */
  layoutArtigo: LayoutArtigo;
  materiais: MaterialResumo[];
  /** Celular pareado (controle remoto + microfone). */
  remoto: {
    codigo: string | null;
    conexao: StatusConexao;
    celularPresente: boolean;
    /** Situação do microfone do celular (null = celular não está escutando). */
    vozCelular: StatusVoz | null;
    vozCelularDetalhe: string;
  };
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
    escala: escalaGuardada(),
    projecao: { conectada: false, telaCheia: false, fracao: 0, rolavel: false, aspecto: 16 / 9, versao: __VERSAO__, materialCarregado: null },
    detectados: [],
    totalAcervo: 0,
    leis: [],
    principal: diplomaPrincipal(),
    aviso: null,
    sessaoInicio: inicioSessaoAtual(),
    material: null,
    telaPreta: false,
    layoutArtigo: 'lateral',
    materiais: [],
    remoto: { codigo: null, conexao: 'desconectada', celularPresente: false, vozCelular: null, vozCelularDetalhe: '' },
  };
  private ouvintes = new Set<() => void>();
  private indice = new Map<string, Item>();
  private detector = new Detector();
  private voz: Reconhecedor;
  private canal: { enviar: (m: Mensagem) => void; fechar: () => void };
  private cauda = '';
  private ultimaInteracao = 0;
  private ultimoPong = 0;
  private ultimoPedidoRecarga = 0;
  private sala: ConexaoSala<MsgDoComputador | MsgDoCelular, EnvioDoComputador> | null = null;
  private envioRemoto: number | null = null;
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
    window.addEventListener('vide-materiais-mudou', () => void this.recarregarMateriais());
    void this.recarregarAcervo();
    void this.recarregarMateriais(true);
    // Celular pareado antes (ex.: a página foi recarregada): reconecta.
    try {
      const codigo = localStorage.getItem('vide.sala');
      if (codigo) this.conectarCelular(codigo);
    } catch {
      /* ignore */
    }
    // A cada mudança, manda o retrato da aula para o celular (no máximo ~6 vezes por segundo).
    this.ouvintes.add(() => this.agendarEnvioRemoto());
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
    const [indice, diplomas] = await Promise.all([carregarIndice(), listarDiplomas()]);
    this.indice = indice;
    // Leis cadastradas pelo professor (fora do catálogo) entram no reconhecimento.
    const extras: DefDiploma[] = diplomas
      .filter((d) => d.abreviacao)
      .map((d) => ({
        sigla: d.sigla,
        abreviacao: d.abreviacao!,
        nome: d.nome,
        apelidos: d.apelidos,
        numeroLei: d.numero_lei ?? null,
        maxArtigo: d.max_artigo ?? 3000,
        url: d.origem_url,
      }));
    definirExtras(extras);
    const principal = diplomaPrincipal();
    this.detector = new Detector({ diplomas: todosDiplomas(), principal });
    this.mudar({
      totalAcervo: this.indice.size,
      leis: diplomas.map((d) => ({ sigla: d.sigla, abreviacao: abreviacaoDe(d.sigla) })),
      principal,
    });
  }

  // ---------- celular (controle remoto + microfone) ----------
  /** Abre (ou reabre) a sala de pareamento com o celular. */
  conectarCelular(codigoExistente?: string) {
    if (this.sala) return;
    const codigo = codigoExistente ?? gerarCodigo();
    try {
      localStorage.setItem('vide.sala', codigo);
    } catch {
      /* ignore */
    }
    this.sala = new ConexaoSala<MsgDoComputador | MsgDoCelular, EnvioDoComputador>(
      codigo,
      'computador',
      (m) => this.aoMsgCelular(m),
      (conexao) => this.mudar({ remoto: { ...this.estado.remoto, conexao } }),
    );
    this.mudar({ remoto: { ...this.estado.remoto, codigo } });
    if (!codigoExistente) registrar('sessao', 'pareamento com celular iniciado');
  }

  desconectarCelular() {
    this.sala?.fechar();
    this.sala = null;
    try {
      localStorage.removeItem('vide.sala');
    } catch {
      /* ignore */
    }
    this.mudar({ remoto: { codigo: null, conexao: 'desconectada', celularPresente: false, vozCelular: null, vozCelularDetalhe: '' } });
    registrar('sessao', 'celular desconectado pelo professor');
  }

  private aoMsgCelular(m: MsgDoComputador | MsgDoCelular) {
    const r = this.estado.remoto;
    switch (m.t) {
      case 'presenca': {
        const presente = m.celular > 0;
        if (r.celularPresente && !presente) {
          registrar('sessao', 'celular saiu da sala');
          if (r.vozCelular && r.vozCelular !== 'parado') {
            this.mudar({ aviso: 'O celular desconectou. Para continuar, reabra o controle no celular ou clique em "Iniciar escuta" para usar o microfone do computador.' });
          }
          this.mudar({ remoto: { ...this.estado.remoto, celularPresente: false, vozCelular: null } });
        } else if (!r.celularPresente && presente) {
          registrar('sessao', 'celular conectado');
          this.mudar({ remoto: { ...this.estado.remoto, celularPresente: true } });
          this.enviarEstadoRemoto();
        }
        return;
      }
      case 'ola-celular':
        if (!r.celularPresente) this.mudar({ remoto: { ...this.estado.remoto, celularPresente: true } });
        this.enviarEstadoRemoto();
        return;
      case 'voz':
        if (m.tipo === 'final') this.aoFinal(m.texto, `cel:${m.chave}`, m.confianca ?? -1);
        else this.aoParcial(m.texto, `cel:${m.chave}`);
        return;
      case 'voz-status': {
        // O celular começou a escutar: o microfone do computador para (para não ouvir em dobro).
        if ((m.status === 'ouvindo' || m.status === 'iniciando') && this.voz.ativo) {
          this.voz.parar();
          this.cauda = '';
          registrar('sessao', 'escuta passou para o celular');
          this.mudar({ escutando: false, parcial: '' });
        }
        if (m.status !== (r.vozCelular ?? 'parado')) registrar('voz', `celular: ${m.status}`, m.detalhe ? { detalhe: m.detalhe } : undefined);
        this.mudar({
          remoto: { ...this.estado.remoto, vozCelular: m.status === 'parado' ? null : m.status, vozCelularDetalhe: m.detalhe ?? '' },
          saiu: false,
        });
        return;
      }
      case 'diag':
        registrar('voz', `celular: ${m.texto}`, m.dados);
        return;
      case 'cmd':
        this.aoComandoRemoto(m);
        return;
      default:
        return;
    }
  }

  private aoComandoRemoto(m: Extract<MsgDoCelular, { t: 'cmd' }>) {
    switch (m.acao) {
      case 'projetar':
        if (m.id) this.projetarCandidato(m.id, 'celular');
        else this.cliqueProjetar();
        break;
      case 'recolher':
        this.recolher('celular');
        break;
      case 'pagina':
        this.passoMaterial(m.delta);
        break;
      case 'paginaInteira':
        this.paginaInteira();
        break;
      case 'ocultar':
        this.alternarTelaPreta();
        break;
      case 'layout':
        this.definirLayout(m.valor);
        break;
      case 'rolar':
        this.rolar(m.delta);
        break;
      case 'digitar': {
        const r = this.adicionarDigitado(m.texto, 'celular');
        this.sala?.enviar({ t: 'resposta-digitado', ...r });
        break;
      }
      case 'fonte':
        if (m.delta === 0) this.fonteNormal('celular');
        else if (m.delta > 0) this.aumentarFonte('celular');
        else this.diminuirFonte('celular');
        break;
      case 'marcar':
        this.marcar();
        break;
    }
  }

  private agendarEnvioRemoto() {
    if (!this.sala || !this.estado.remoto.celularPresente || this.envioRemoto !== null) return;
    this.envioRemoto = window.setTimeout(() => {
      this.envioRemoto = null;
      this.enviarEstadoRemoto();
    }, 150);
  }

  private enviarEstadoRemoto() {
    if (!this.sala) return;
    const e = this.estado;
    const ultimas = e.finais.slice(-2).map((f) => f.texto).join(' ');
    this.sala.enviar({
      t: 'estado',
      versao: __VERSAO__,
      alternativas: e.candidatos.map((c) => ({ id: c.id, titulo: c.titulo, texto: c.texto, aviso: c.aviso })),
      projetadoId: e.projetado?.id ?? null,
      projetadoTitulo: e.projetado?.titulo ?? null,
      material: e.material
        ? { nome: e.material.nome, pagina: e.material.pagina, paginas: e.material.paginas, zoom: !ehInteira(e.material.regiao) }
        : null,
      telaPreta: e.telaPreta,
      escala: e.escala,
      layout: e.layoutArtigo,
      escutaComputador: e.escutando,
      projecaoConectada: e.projecao.conectada,
      ultimaFala: (e.parcial ? `${ultimas} ${e.parcial}` : ultimas).slice(-240),
    });
  }

  // ---------- material (slides/PDF) ----------
  async recarregarMateriais(restaurar = false) {
    const lista = await listarMateriais();
    const materiais: MaterialResumo[] = lista.map((m) => ({ id: m.id, nome: m.nome, tipo: m.tipo, paginas: m.paginas }));
    this.mudar({ materiais });
    const atual = this.estado.material;
    if (atual && !materiais.some((m) => m.id === atual.id)) this.escolherMaterial(null);
    // Ao abrir o app, retoma o último material usado.
    if (restaurar && !atual) {
      let ultimo: string | null = null;
      try {
        ultimo = localStorage.getItem('vide.material');
      } catch {
        /* ignore */
      }
      if (ultimo && materiais.some((m) => m.id === ultimo)) this.escolherMaterial(ultimo, false);
    }
  }

  /** Escolhe o material exibido no projetor (null = sem material). */
  escolherMaterial(id: string | null, registrarUso = true) {
    const m = id ? this.estado.materiais.find((x) => x.id === id) : undefined;
    try {
      if (m) localStorage.setItem('vide.material', m.id);
      else localStorage.removeItem('vide.material');
    } catch {
      /* ignore */
    }
    const material: MaterialNaTela | null = m ? { id: m.id, nome: m.nome, paginas: m.paginas, pagina: 1, regiao: PAGINA_INTEIRA } : null;
    const modoRoda: ModoRoda = material ? 'material' : 'candidatos';
    this.mudar({ material, modoRoda, telaPreta: false });
    this.enviarMaterial();
    if (registrarUso) registrar('material', m ? `abriu: ${m.nome}` : 'sem material', m ? { paginas: m.paginas } : undefined);
  }

  private irPara(pagina: number, regiao: Regiao) {
    const atual = this.estado.material;
    if (!atual) return;
    const mudouPagina = pagina !== atual.pagina;
    this.mudar({ material: { ...atual, pagina, regiao } });
    this.enviarMaterial();
    if (mudouPagina) this.registrarUmaVez(`pag:${atual.id}:${pagina}`, 'material', `${atual.nome} — página ${pagina}`);
  }

  passoMaterial(delta: number) {
    const m = this.estado.material;
    if (!m) return;
    const p = passo({ pagina: m.pagina, regiao: m.regiao }, delta, m.paginas);
    this.irPara(p.pagina, p.regiao);
  }

  irPagina(pagina: number) {
    const m = this.estado.material;
    if (!m) return;
    this.irPara(Math.min(m.paginas, Math.max(1, pagina)), PAGINA_INTEIRA);
  }

  /** Zoom: mostra só esta região da página (frações de 0 a 1). */
  definirRegiao(regiao: Regiao) {
    const m = this.estado.material;
    if (!m) return;
    const r = ajustarRegiao(regiao);
    this.irPara(m.pagina, r);
    registrar('material', `${m.nome} — zoom na página ${m.pagina}`, {
      regiao: `${Math.round(r.x * 100)},${Math.round(r.y * 100)} ${Math.round(r.w * 100)}x${Math.round(r.h * 100)}%`,
    });
  }

  paginaInteira() {
    const m = this.estado.material;
    if (m && !ehInteira(m.regiao)) this.irPara(m.pagina, PAGINA_INTEIRA);
  }

  alternarTelaPreta() {
    this.mudar({ telaPreta: !this.estado.telaPreta });
    this.enviarMaterial();
    registrar('material', this.estado.telaPreta ? 'tela preta' : 'material de volta');
  }

  alternarLayout() {
    this.definirLayout(this.estado.layoutArtigo === 'lateral' ? 'cheia' : 'lateral');
  }

  /** Como a norma aparece com material na tela: ao lado do slide ou substituindo-o. */
  definirLayout(layoutArtigo: LayoutArtigo) {
    if (layoutArtigo === this.estado.layoutArtigo) return;
    this.mudar({ layoutArtigo });
    this.canal.enviar({ t: 'layout', layout: layoutArtigo });
    registrar('material', layoutArtigo === 'lateral' ? 'visualização: ao lado da norma' : 'visualização: substituir pela norma');
  }

  private enviarMaterial() {
    const m = this.estado.material;
    this.canal.enviar({
      t: 'material',
      id: m?.id ?? null,
      pagina: m?.pagina ?? 1,
      regiao: m?.regiao ?? PAGINA_INTEIRA,
      preta: this.estado.telaPreta,
    });
  }

  // ---------- escuta ----------
  iniciar() {
    registrar('sessao', this.estado.saiu ? 'retomou a aula' : 'escuta iniciada', {
      navegador: nomeNavegador(),
      agente: navigator.userAgent,
      itens_no_acervo: this.indice.size,
    });
    // Se o celular estava escutando, ele para (o microfone do computador assume).
    if (this.estado.remoto.vozCelular) {
      this.sala?.enviar({ t: 'parar-escuta' });
      this.mudar({ remoto: { ...this.estado.remoto, vozCelular: null } });
    }
    this.voz.iniciar();
    const voltando = this.estado.saiu;
    this.mudar({ escutando: this.voz.ativo, saiu: false, telaPreta: voltando ? false : this.estado.telaPreta });
    if (voltando) this.enviarMaterial();
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
    // "Sair" libera o projetor: tela preta, inclusive sem o material do Vide.
    this.mudar({ escutando: false, saiu: true, parcial: '', telaPreta: true });
    this.enviarMaterial();
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

    // Referências: inclui o fim da fala anterior ("inciso sexto do" | "485").
    const comCauda = this.cauda ? `${this.cauda} ${texto}` : texto;
    const r = this.detector.detectar(comCauda, Date.now(), { parcial: origem === 'parcial' });
    // Onde começa o texto novo (em palavras normalizadas). Calculado pelo fim, porque
    // uma expressão pode atravessar a emenda ("artigo segundo do código" | "de processo civil").
    const inicioNovo = this.cauda ? r.palavras.length - this.detector.palavrasDe(texto).length : 0;
    for (const o of r.outros) {
      if (o.fim <= inicioNovo) continue;
      // Se um candidato acabou de surgir do texto provisório ("artigo 5º…") e agora
      // apareceu "…da Constituição", ele sai da lista.
      if (o.art !== null) this.retirarPorOutroDiploma(o.art, o.trecho, chave);
      if (origem !== 'final') continue;
      registrar('outro_diploma', o.trecho, { diploma: o.diploma });
      this.anotar(o.trecho, 'outro diploma');
    }
    for (const ref of r.referencias) {
      if (ref.fim <= inicioNovo) continue; // já tratado na fala anterior
      this.aoDetectar(ref, origem, chave);
    }
  }

  /** Só retira o candidato que nasceu do mesmo trecho de fala, ainda provisório. */
  private retirarPorOutroDiploma(art: number, trecho: string, trechoId: string) {
    const sai = this.estado.candidatos.filter(
      (c) =>
        (c.chave === `${this.detector.principal}:${art}` || c.chave.startsWith(`${this.detector.principal}:${art}:`)) &&
        c.origem === 'parcial' &&
        c.trechoId === trechoId &&
        c.id !== this.estado.projetado?.id,
    );
    if (!sai.length) return;
    const candidatos = this.estado.candidatos.filter((c) => !sai.includes(c));
    const selecionadoId = candidatos.some((c) => c.id === this.estado.selecionadoId) ? this.estado.selecionadoId : (candidatos[0]?.id ?? null);
    for (const c of sai) {
      registrar('detectado', c.titulo, { chave: c.chave, acao: 'retirado (era de outro diploma)', trecho });
      this.anotar(c.titulo, 'retirado');
    }
    this.mudar({ candidatos, selecionadoId });
  }

  /** Evita repetir no registro o mesmo aviso a cada atualização do texto provisório. */
  private ultimosAvisos = new Map<string, number>();
  private registrarUmaVez(chave: string, ...args: Parameters<typeof registrar>) {
    const agora = Date.now();
    if (agora - (this.ultimosAvisos.get(chave) ?? 0) < 60_000) return;
    this.ultimosAvisos.set(chave, agora);
    void registrar(...args);
  }

  private anotar(titulo: string, situacao: Detectado['situacao']) {
    const detectados = [...this.estado.detectados, { id: seq++, em: Date.now(), titulo, situacao }].slice(-40);
    this.mudar({ detectados });
  }

  private aoDetectar(refDita: Referencia, origem: 'parcial' | 'final', trechoId: string) {
    const id = `c${seq++}`;
    let ref = refDita;
    let res = resolver(ref, this.indice, id);
    // Parágrafo vindo do contexto que não tem esse inciso: tenta o inciso do caput.
    if (res?.aviso && ref.parDoContexto) {
      const semPar = { ...ref, par: undefined, parDoContexto: undefined };
      const res2 = resolver(semPar, this.indice, id);
      if (res2 && !res2.aviso) {
        ref = semPar;
        res = res2;
      }
    }
    const chave = chaveReferencia(ref);
    const agora = Date.now();
    const lista = this.estado.candidatos;
    const dadosLog = { chave, trecho: ref.trecho, origem, contexto: ref.contexto, lei_dita: ref.explicito };

    // Repetido há pouco: ignora.
    const igual = lista.find((c) => c.chave === chave);
    if (igual && agora - igual.criadoEm < REPETIDO_MS) return;
    // Menos específico que um recente ("485" depois de "485, VI"): ignora.
    if (lista.some((c) => c.chave.startsWith(chave + ':') && agora - c.criadoEm < REFINO_MS)) return;

    if (!res) {
      const titulo = `art. ${ref.art}${ref.sufixo ? `-${ref.sufixo}` : ''} ${abreviacaoDe(ref.diploma)}`;
      if (!this.estado.detectados.some((d) => d.titulo === titulo && agora - d.em < REPETIDO_MS)) {
        registrar('nao_encontrado', titulo, dadosLog);
        this.anotar(titulo, 'fora do acervo');
      }
      return;
    }
    // Pelo contexto e inexistente (ex.: "inciso sexto" logo depois do art. 70): descarta.
    if (ref.contexto && res.aviso) {
      this.registrarUmaVez(`descartado:${chave}`, 'detectado', res.titulo, { ...dadosLog, acao: 'descartado', aviso: res.aviso });
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
      trechoId,
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

  /**
   * Clique esquerdo. Com material na tela, a roda passa as páginas; então o clique
   * projeta o candidato mais recente. Sem material, projeta o selecionado (escolhido pela roda).
   */
  cliqueProjetar() {
    if (this.estado.material && this.estado.candidatos.length) {
      this.mudar({ selecionadoId: this.estado.candidatos[0].id });
    }
    this.projetar('mouse');
  }

  /** Clique direto num candidato da lista: projeta aquele. */
  projetarCandidato(id: string, via: 'mouse' | 'celular' = 'mouse') {
    if (!this.estado.candidatos.some((c) => c.id === id)) return;
    this.mudar({ selecionadoId: id });
    this.projetar(via);
  }

  private layoutAtual(): LayoutArtigo {
    return this.estado.material && !this.estado.telaPreta ? this.estado.layoutArtigo : 'cheia';
  }

  /**
   * Artigo digitado pelo professor ("485 VI", "300 §1", "5 CF"): entra no topo
   * das alternativas como prévia. Só vai ao projetor quando ele clicar (ou tocar) nela,
   * para que um número digitado errado não apareça para a turma.
   */
  adicionarDigitado(texto: string, via: 'computador' | 'celular' = 'computador'): { ok: boolean; mensagem: string } {
    const lido = lerDigitado(texto, todosDiplomas(), this.detector.principal);
    if (!lido.ok) return { ok: false, mensagem: lido.erro };
    const ref: Referencia = { ...lido.ref, explicito: true, contexto: false, inicio: 0, fim: 0, trecho: texto };
    const chave = chaveReferencia(ref);
    const id = `c${seq++}`;
    const res = resolver(ref, this.indice, id);
    if (!res) {
      const titulo = `art. ${ref.art}${ref.sufixo ? `-${ref.sufixo}` : ''} ${abreviacaoDe(ref.diploma)}`;
      registrar('nao_encontrado', titulo, { chave, trecho: texto, origem: 'digitado' });
      return { ok: false, mensagem: `${titulo} não está no acervo.` };
    }
    const novo: Candidato = {
      id,
      chave,
      titulo: res.titulo,
      texto: inicioDoTexto(res.texto),
      aviso: res.aviso,
      projetavel: res.projetavel,
      criadoEm: Date.now(),
      origem: 'digitado',
      contexto: false,
      trechoId: `dig:${id}`,
    };
    const candidatos = [novo, ...this.estado.candidatos.filter((c) => c.chave !== chave)].slice(0, MAX_CANDIDATOS);
    registrar('detectado', res.titulo, { chave, trecho: texto, origem: 'digitado', acao: 'digitado', aviso: res.aviso ?? undefined });
    this.anotar(res.titulo, 'digitado');
    this.ultimaInteracao = Date.now();
    this.mudar({ candidatos, selecionadoId: id });
    const verbo = via === 'celular' ? 'toque' : 'clique (ou aperte Enter de novo)';
    const aviso = res.aviso ? ` Atenção: ${res.aviso}.` : '';
    return { ok: true, mensagem: `${res.titulo} está nas alternativas.${aviso} Confira o texto e ${verbo} nele para projetar.` };
  }

  projetar(origem: 'mouse' | 'teclado' | 'celular' = 'mouse') {
    const lista = this.estado.candidatos;
    const idx = lista.findIndex((c) => c.id === this.estado.selecionadoId);
    const c = lista[idx];
    if (!c) return;
    this.ultimaInteracao = Date.now();
    this.canal.enviar({ t: 'projetar', item: c.projetavel, escala: this.estado.escala, layout: this.layoutAtual() });
    registrar('projetado', c.titulo, {
      chave: c.chave,
      posicao: `${idx + 1} de ${lista.length}`,
      idade_s: Math.round((Date.now() - c.criadoEm) / 1000),
      detectado_em: c.origem,
      substituiu: this.estado.projetado?.titulo,
      via: origem,
      projecao_conectada: this.estado.projecao.conectada,
      sobre_material: this.estado.material && !this.estado.telaPreta ? `${this.estado.material.nome} p. ${this.estado.material.pagina} (${this.estado.layoutArtigo})` : undefined,
    });
    this.mudar({ projetado: c });
  }

  recolher(origem: 'mouse' | 'voz' | 'teclado' | 'sair' | 'nova sessão' | 'celular') {
    if (!this.estado.projetado) {
      this.canal.enviar({ t: 'recolher' });
      return;
    }
    this.canal.enviar({ t: 'recolher' });
    registrar('recolhido', this.estado.projetado.titulo, { via: origem });
    this.mudar({ projetado: null, modoRoda: this.estado.material ? 'material' : 'candidatos' });
  }

  /** Clique na roda: alterna entre rolar o artigo projetado e o uso normal da roda. */
  alternarModo() {
    const normal: ModoRoda = this.estado.material ? 'material' : 'candidatos';
    this.mudar({ modoRoda: this.estado.modoRoda === 'rolar' ? normal : 'rolar' });
  }

  /** Um "dente" da roda, conforme o modo. */
  roda(delta: number) {
    const modo = this.estado.modoRoda;
    if (modo === 'rolar') this.rolar(delta);
    else if (modo === 'material' && this.estado.material) this.passoMaterial(delta);
    else this.mover(delta);
  }

  rolar(delta: number) {
    if (this.estado.projetado) this.canal.enviar({ t: 'rolar', delta });
  }

  /**
   * Tamanho da fonte da norma projetada, em passos de 10%. Vale para tudo o que
   * for projetado depois e fica guardado para as próximas aulas.
   */
  definirEscala(valor: number, via: 'mouse' | 'teclado' | 'voz' | 'celular' = 'mouse') {
    const escala = Math.round(Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, valor)) * 10) / 10;
    if (escala === this.estado.escala) return;
    try {
      localStorage.setItem(CHAVE_ESCALA, String(escala));
    } catch {
      /* ignore */
    }
    this.canal.enviar({ t: 'escala', escala });
    registrar('sessao', `fonte da projeção: ${Math.round(escala * 100)}%`, { via });
    this.mudar({ escala });
  }

  aumentarFonte(via: 'mouse' | 'teclado' | 'voz' | 'celular' = 'teclado') {
    this.definirEscala(this.estado.escala + 0.1, via);
  }
  diminuirFonte(via: 'mouse' | 'teclado' | 'voz' | 'celular' = 'teclado') {
    this.definirEscala(this.estado.escala - 0.1, via);
  }
  fonteNormal(via: 'mouse' | 'teclado' | 'voz' | 'celular' = 'mouse') {
    this.definirEscala(1, via);
  }

  private comandoVoz(c: Comando, chave: string, trecho: string) {
    const k = `${chave}:${c}`;
    if (this.comandosFeitos.has(k)) return;
    this.comandosFeitos.add(k);
    if (this.comandosFeitos.size > 500) this.comandosFeitos = new Set([...this.comandosFeitos].slice(-200));
    const nomes: Record<Comando, string> = { recolher: 'recolher (tira da tela / pode fechar)', aumentar: 'aumenta a fonte', diminuir: 'diminui a fonte' };
    // Recolher só faz sentido com algo na tela; a fonte vale também para a próxima projeção.
    if (c === 'recolher' && !this.estado.projetado) {
      registrar('comando_voz', nomes[c], { trecho, executado: false, motivo: 'nada projetado' });
      return;
    }
    registrar('comando_voz', nomes[c], { trecho, executado: true });
    if (c === 'recolher') this.recolher('voz');
    else if (c === 'aumentar') this.aumentarFonte('voz');
    else this.diminuirFonte('voz');
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
      this.enviarMaterial();
      if (this.estado.projetado)
        this.canal.enviar({ t: 'projetar', item: this.estado.projetado.projetavel, escala: this.estado.escala, layout: this.layoutAtual() });
    } else if (m.t === 'pong') {
      this.ultimoPong = Date.now();
      const p = this.estado.projecao;
      const versao = m.versao ?? '?';
      const materialCarregado = m.materialCarregado ?? null;
      // Janela de projeção com versão antiga do app: pede para ela se recarregar.
      if (versao !== __VERSAO__ && Date.now() - this.ultimoPedidoRecarga > 15_000) {
        this.ultimoPedidoRecarga = Date.now();
        this.canal.enviar({ t: 'recarregar' });
        registrar('sessao', 'janela de projeção desatualizada', { versao_projecao: versao, versao_app: __VERSAO__ });
      }
      if (
        !p.conectada ||
        p.telaCheia !== m.telaCheia ||
        Math.abs(p.aspecto - (m.aspecto ?? p.aspecto)) > 0.01 ||
        p.versao !== versao ||
        p.materialCarregado !== materialCarregado
      )
        this.mudar({
          projecao: { ...p, conectada: true, telaCheia: m.telaCheia, aspecto: m.aspecto ?? p.aspecto, versao, materialCarregado },
        });
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

  /**
   * Começa uma nova sessão do registro e limpa a tela de trabalho
   * (transcrição, candidatos e referências). A escuta continua como estava.
   */
  async novaSessao(): Promise<void> {
    this.recolher('nova sessão');
    novaSessao();
    // A fala que estava em andamento no clique pertence à sessão anterior: descarta.
    this.voz.descartarEReiniciar();
    this.cauda = '';
    this.detector.limparContexto();
    this.comandosFeitos.clear();
    this.ultimaInteracao = 0;
    this.mudar({
      finais: [],
      parcial: '',
      candidatos: [],
      selecionadoId: null,
      detectados: [],
      modoRoda: this.estado.material ? 'material' : 'candidatos',
      saiu: false,
      aviso: 'Nova sessão iniciada: a tela foi limpa.',
      sessaoInicio: inicioSessaoAtual(),
    });
    window.setTimeout(() => this.estado.aviso === 'Nova sessão iniciada: a tela foi limpa.' && this.mudar({ aviso: null }), 3_000);
    await registrar('sessao', 'nova sessão iniciada', { escuta_ativa: this.estado.escutando, itens_no_acervo: this.indice.size });
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
