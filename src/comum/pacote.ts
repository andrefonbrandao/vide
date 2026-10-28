// Pacote da aula: a transcrição e o texto integral dos dispositivos que o
// professor projetou, para colar no Claude e pedir o material que quiser.
// Não entram alternativas que só foram oferecidas (detectadas) e não projetadas,
// nem instruções prontas.
import type { Dispositivo, EventoRegistro, Item } from '../dados/modelo';
import { chaveItemArtigo } from './legislacao';

/** Uma pausa maior que esta na fala começa um novo parágrafo da transcrição. */
const PAUSA_PARAGRAFO_MS = 20_000;

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function data(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** "cpc:485:i6" -> chave do artigo no acervo ("cpc:art:485"). */
export function artigoDaChave(chave: string): { diploma: string; chaveItem: string } | null {
  const [diploma, art] = chave.split(':');
  const m = art?.match(/^(\d+)(?:-([A-Za-z]+))?$/);
  if (!diploma || !m) return null;
  return { diploma, chaveItem: chaveItemArtigo(diploma, parseInt(m[1], 10), m[2] ?? '') };
}

/** "Art. 485" -> "Art. 485." (como no Planalto; "Art. 1º" fica igual). */
function rotuloComPonto(rotulo: string): string {
  const r = rotulo.trim();
  return /[0-9A-Za-z]$/.test(r) ? `${r}.` : r;
}

/** Texto integral de um artigo, com incisos, alíneas e parágrafos, um por linha. */
export function textoDoArtigo(item: Item): string {
  const c = item.conteudo;
  const linhas = [`${rotuloComPonto(c.rotulo)} ${c.caput.texto}`.trim()];
  const descer = (lista: Dispositivo[], recuo: string) => {
    for (const d of lista) {
      const rotulo = d.tipo === 'inciso' ? `${d.rotulo} –` : d.rotulo;
      linhas.push(`${recuo}${rotulo} ${d.texto}`.trimEnd());
      descer(d.filhos, recuo + '  ');
    }
  };
  descer(c.caput.filhos, '  ');
  for (const p of c.paragrafos) {
    linhas.push(`${p.rotulo} ${p.texto}`.trimEnd());
    descer(p.filhos, '  ');
  }
  return linhas.join('\n');
}

/** Fala de teste (digitada em Acervo › Testes), que não é da aula. */
function ehFalaDeTeste(e: EventoRegistro): boolean {
  const trecho = e.dados?.trecho;
  return typeof trecho === 'string' && trecho.startsWith('sim:');
}

export function montarPacote(eventos: EventoRegistro[], indice: Map<string, Item>, nomeDaLei: (sigla: string) => string): string {
  const falas = eventos.filter((e) => e.tipo === 'fala' && !ehFalaDeTeste(e) && e.texto.trim());
  const projecoes = eventos.filter((e) => e.tipo === 'projetado');
  const ehFala = new Set(falas);
  const relevantes = eventos.filter((e) => ehFala.has(e) || e.tipo === 'projetado');

  const saida: string[] = [];
  if (relevantes.length) {
    const ini = relevantes[0].em;
    const fim = relevantes[relevantes.length - 1].em;
    saida.push(`AULA DE ${data(ini)}, DAS ${hora(ini)} ÀS ${hora(fim)}`);
    saida.push('');
  }

  // ---------- Transcrição ----------
  saida.push('TRANSCRIÇÃO');
  saida.push('(texto reconhecido automaticamente da fala do professor; pode conter erros de reconhecimento)');
  saida.push('');
  if (!falas.length) saida.push('(nenhuma fala registrada nesta sessão)');
  let paragrafo: string[] = [];
  let inicioParagrafo = '';
  let ultimaFala = 0;
  const fecharParagrafo = () => {
    if (paragrafo.length) {
      saida.push(`[${hora(inicioParagrafo)}] ${paragrafo.join(' ')}`);
      saida.push('');
    }
    paragrafo = [];
  };
  for (const e of relevantes) {
    const t = new Date(e.em).getTime();
    if (e.tipo === 'projetado') {
      fecharParagrafo();
      saida.push(`[${hora(e.em)} — projetado: ${e.texto}]`);
      saida.push('');
      continue;
    }
    if (paragrafo.length && t - ultimaFala > PAUSA_PARAGRAFO_MS) fecharParagrafo();
    if (!paragrafo.length) inicioParagrafo = e.em;
    paragrafo.push(e.texto.trim());
    ultimaFala = t;
  }
  fecharParagrafo();

  // ---------- Dispositivos projetados ----------
  saida.push('DISPOSITIVOS PROJETADOS NA AULA');
  saida.push('');
  if (!projecoes.length) saida.push('(nenhum dispositivo foi projetado nesta sessão)');
  // Agrupa por artigo, na ordem da primeira projeção.
  const porArtigo = new Map<string, { diploma: string; projetados: Map<string, string[]> }>();
  const semChave: string[] = [];
  for (const e of projecoes) {
    const chave = typeof e.dados?.chave === 'string' ? e.dados.chave : '';
    const art = artigoDaChave(chave);
    if (!art) {
      if (!semChave.includes(e.texto)) semChave.push(e.texto);
      continue;
    }
    let g = porArtigo.get(art.chaveItem);
    if (!g) porArtigo.set(art.chaveItem, (g = { diploma: art.diploma, projetados: new Map() }));
    const horas = g.projetados.get(e.texto) ?? [];
    horas.push(hora(e.em));
    g.projetados.set(e.texto, horas);
  }
  for (const [chaveItem, g] of porArtigo) {
    const item = indice.get(chaveItem);
    const lista = [...g.projetados].map(([titulo, horas]) => `${titulo} (às ${horas.join(', ')})`).join('; ');
    saida.push(`— ${item ? `${item.conteudo.rotulo.replace(/\.$/, '')} · ` : ''}${nomeDaLei(g.diploma)}`);
    saida.push(`Projetado: ${lista}`);
    saida.push('Texto integral do artigo:');
    saida.push(item ? textoDoArtigo(item) : '(o texto deste artigo não está mais no acervo deste navegador)');
    saida.push('');
  }
  for (const titulo of semChave) {
    saida.push(`— ${titulo}`);
    saida.push('(texto não disponível)');
    saida.push('');
  }
  return saida.join('\n').trimEnd() + '\n';
}

export function nomeArquivoPacote(inicioIso: string): string {
  const d = new Date(inicioIso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `vide-aula-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}.txt`;
}
