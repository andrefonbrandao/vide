// PDF do pré-projeto (TCC I) pelas regras do manual de normalização (Uniftec/FTEC):
// A4; margens 3 cm (superior e esquerda) e 2 cm (inferior e direita); Arial (Helvetica,
// de mesmas medidas) 12; entrelinha 1,5; recuo de 1,25 cm no parágrafo; citação longa com
// recuo de 4 cm, fonte 10, espaço simples; notas de rodapé em fonte 10; títulos em negrito
// (primários em maiúsculas); capa, folha de rosto, sumário; páginas contadas desde a folha
// de rosto e numeradas a partir da introdução, no canto superior direito.
// O pdf-lib é carregado só na hora.
import type { PDFFont, PDFPage } from 'pdf-lib';
import { lerParagrafos, lerTrechos, type Paragrafo, type Trecho } from './marcacao';
import { estruturaPreProjeto, type Bloco } from './preProjetoEstrutura';
import { estruturaFinal, FINAL_VAZIO, finalDoPreProjeto, legendaTabela, siglasDe } from './trabalhoFinalEstrutura';
import { textoPuro, type TabelaTexto } from './marcacao';
import { rotuloPrazo } from './prazos';
import type { ConfigPreProjeto, Etapa, TextoProjeto } from './tipos';
import { naturezaDe, naturezaPadrao } from './campos';
export { naturezaPadrao };

export interface EntradaPreProjeto {
  nome: string;
  config: ConfigPreProjeto;
  texto: TextoProjeto;
  etapas: Etapa[];
  /** PNG do logotipo da instituição (capa). */
  logo?: Uint8Array;
}

export const TEXTO_VAZIO: TextoProjeto = {
  titulo: '', subtitulo: '', resumo: '', palavrasChave: '', introducao: '', problema: '', hipoteses: '', objetivoGeral: '', objetivosEspecificos: '',
  justificativa: '', fundamentacao: '', metodo: '', populacao: '', coleta: '', analise: '', recursos: '', referencias: '',
};


const CM = 28.3465;
const A4 = { w: 595.28, h: 841.89 };
const M = { esq: 3 * CM, dir: 2 * CM, topo: 3 * CM, base: 2 * CM };
const LARG = A4.w - M.esq - M.dir;
const CORPO_PDF = { tam: 12, linha: 18 }; // 1,5
const SIMPLES12_PDF = 14;
const PEQ_PDF = { tam: 10, linha: 11.6 }; // citação longa, notas, quadros
// As linhas do Word são mais altas: "1,5" no Word é 1,5 × a altura natural da Arial (≈ 1,15 × o
// tamanho da letra). Usadas só para calcular as páginas do sumário do Word.
const CORPO_WORD = { tam: 12, linha: 20.7 };
const SIMPLES12_WORD = 13.8;
const PEQ_WORD = { tam: 10, linha: 11.5 };
const RECUO_PAR = 1.25 * CM;
const RECUO_CIT = 4 * CM;

function seguro(s: string): string {
  return s
    .replace(/[‐‑‒]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…€ŒœŠšŸŽžƒˆ˜†‡‰‹›™]/g, '?');
}

export interface ItemSumario {
  rotulo: string;
  titulo: string;
  nivel: 0 | 1 | 2 | 3;
  /** Número da página, como aparece no trabalho. */
  pagina: number;
}

/** O que o Word aproveita da montagem do PDF: os títulos e as tabelas com as páginas, e a página da introdução. */
export interface PaginasDoPdf {
  listas: { titulo: string; itens: ItemSumario[] }[];
  /** Número (contado desde a folha de rosto) da primeira página numerada. */
  inicio: number;
}

/** `aoSumario` recebe os títulos com as páginas (o Word usa para já trazer o sumário numerado);
 * `medidasDoWord` monta com as alturas de linha do Word, para essas páginas baterem com as do Word. */
export async function gerarPreProjetoPdf(e: EntradaPreProjeto, aoSumario?: (itens: ItemSumario[], extra: PaginasDoPdf) => void, medidasDoWord = false): Promise<Blob> {
  const CORPO = medidasDoWord ? CORPO_WORD : CORPO_PDF;
  const SIMPLES12 = medidasDoWord ? SIMPLES12_WORD : SIMPLES12_PDF;
  const PEQ = medidasDoWord ? PEQ_WORD : PEQ_PDF;
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const t = { ...TEXTO_VAZIO, ...e.texto };
  const c = e.config;
  /** Trabalho final (TCC II): outra parte pré-textual e outras seções. */
  const tf = c.formato === 'final' ? { ...FINAL_VAZIO, ...(t.final ?? finalDoPreProjeto(t)) } : null;
  const tit = tf ? tf.titulo : t.titulo;
  const subt = (tf ? tf.subtitulo : t.subtitulo).trim();
  pdf.setTitle(seguro(tit || (tf ? 'Trabalho final' : 'Pré-projeto')));
  pdf.setAuthor(seguro(e.nome));
  pdf.setCreator('Vide');
  const f = {
    n: await pdf.embedFont(StandardFonts.Helvetica),
    b: await pdf.embedFont(StandardFonts.HelveticaBold),
    i: await pdf.embedFont(StandardFonts.HelveticaOblique),
    bi: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const preto = rgb(0, 0, 0);
  const fonte = (negrito?: boolean, italico?: boolean) => (negrito && italico ? f.bi : negrito ? f.b : italico ? f.i : f.n);

  let pagina!: PDFPage;
  let y = 0;
  /** Notas de rodapé da página atual. */
  let notasPagina: { n: number; linhas: { t: string; fnt: PDFFont; w: number; espaco: boolean }[][] }[] = [];
  let alturaNotas = 0;
  const SEP_NOTAS = 12;

  const quebrarSimples = (texto: string, fnt: PDFFont, tam: number, max: number): string[] => {
    const linhas: string[] = [];
    for (const par of seguro(texto).split('\n')) {
      let atual = '';
      for (const p of par.split(/\s+/).filter(Boolean)) {
        const teste = atual ? `${atual} ${p}` : p;
        if (fnt.widthOfTextAtSize(teste, tam) > max && atual) {
          linhas.push(atual);
          atual = p;
        } else atual = teste;
      }
      if (atual) linhas.push(atual);
    }
    return linhas;
  };
  const centro = (s: string, fnt: PDFFont, tam: number, yb: number) => {
    const w = fnt.widthOfTextAtSize(s, tam);
    pagina.drawText(s, { x: M.esq + (LARG - w) / 2, y: yb, size: tam, font: fnt, color: preto });
  };
  /** Escreve linhas centralizadas a partir de yTopo; devolve o y depois delas. */
  const blocoCentro = (texto: string, fnt: PDFFont, tam: number, yTopo: number, linha = tam * 1.2): number => {
    let yy = yTopo;
    for (const l of quebrarSimples(texto, fnt, tam, LARG)) {
      yy -= linha;
      centro(l, fnt, tam, yy + (linha - tam) / 2);
    }
    return yy;
  };

  // ---------- Notas de rodapé ----------
  const notas = new Map<number, string>();
  let proximaNota = 1;
  type Pedaco = { t: string; fnt: PDFFont; w: number; espaco: boolean };
  /** Quebra um texto com marcações (negrito, itálico) em linhas de pedaços. */
  const linhasRicas = (texto: string, tam: number, max: number): Pedaco[][] => {
    const ps: Pedaco[] = [];
    let esp = false;
    for (const tr of lerTrechos(texto)) {
      if (!('t' in tr)) continue;
      const fnt = fonte(tr.negrito, tr.italico);
      for (const p of seguro(tr.t).split(/(\s+)/)) {
        if (!p) continue;
        if (/^\s+$/.test(p)) {
          esp = true;
          continue;
        }
        ps.push({ t: p, fnt, w: fnt.widthOfTextAtSize(p, tam), espaco: ps.length > 0 && esp });
        esp = false;
      }
    }
    const espaco = f.n.widthOfTextAtSize(' ', tam);
    const linhas: Pedaco[][] = [];
    let atual: Pedaco[] = [];
    let w = 0;
    for (const p of ps) {
      const pw = p.w + (atual.length && p.espaco ? espaco : 0);
      if (w + pw > max && atual.length) {
        linhas.push(atual);
        atual = [];
        w = 0;
      }
      atual.push(p);
      w += atual.length === 1 ? p.w : pw;
    }
    if (atual.length) linhas.push(atual);
    return linhas;
  };
  const desenharRica = (ln: Pedaco[], x: number, yb: number, tam: number) => {
    const espaco = f.n.widthOfTextAtSize(' ', tam);
    ln.forEach((p, j) => {
      if (j > 0 && p.espaco) x += espaco;
      pagina.drawText(p.t, { x, y: yb, size: tam, font: p.fnt, color: preto });
      x += p.w;
    });
  };
  const linhasNota = (n: number) => linhasRicas(notas.get(n) ?? '', PEQ.tam, LARG - 10);
  const desenharNotas = () => {
    if (!notasPagina.length) return;
    let topo = M.base + alturaNotas;
    pagina.drawLine({ start: { x: M.esq, y: topo - 4 }, end: { x: M.esq + 5 * CM, y: topo - 4 }, thickness: 0.6, color: preto });
    topo -= SEP_NOTAS;
    for (const nt of notasPagina) {
      nt.linhas.forEach((l, k) => {
        topo -= PEQ.linha;
        if (k === 0) pagina.drawText(String(nt.n), { x: M.esq, y: topo + 4, size: 6.5, font: f.n, color: preto });
        desenharRica(l, M.esq + 10, topo + 2, PEQ.tam);
      });
    }
  };
  const novaPagina = () => {
    if (pagina) desenharNotas();
    pagina = pdf.addPage([A4.w, A4.h]);
    y = A4.h - M.topo;
    notasPagina = [];
    alturaNotas = 0;
  };
  /** Reserva a altura de uma linha (com as notas que ela chama); vira a página se não couber. */
  const reservar = (h: number, ns: number[]) => {
    const extra = () => ns.reduce((s, n) => s + linhasNota(n).length * PEQ.linha + 2, 0) + (ns.length && !notasPagina.length ? SEP_NOTAS : 0);
    if (y - h < M.base + alturaNotas + extra()) novaPagina();
    const ex = extra();
    y -= h;
    if (ns.length) {
      alturaNotas += ex;
      for (const n of ns) notasPagina.push({ n, linhas: linhasNota(n) });
    }
  };

  // ---------- Parágrafos com negrito, itálico e notas ----------
  interface Palavra {
    t: string;
    fnt: PDFFont;
    w: number;
    notas: number[];
    espaco: boolean;
  }
  const palavras = (trechos: Trecho[], tam: number, base: { negrito?: boolean } = {}): Palavra[] => {
    const out: Palavra[] = [];
    let espacoPendente = false;
    for (const tr of trechos) {
      if ('nota' in tr) {
        const n = proximaNota++;
        notas.set(n, tr.nota);
        if (out.length) out[out.length - 1].notas.push(n);
        continue;
      }
      const fnt = fonte(tr.negrito || base.negrito, tr.italico);
      for (const p of seguro(tr.t).split(/(\s+)/)) {
        if (!p) continue;
        if (/^\s+$/.test(p)) {
          espacoPendente = true;
          continue;
        }
        // Palavra colada à anterior (ex.: "**stare**," ou "texto_itálico_.") continua a mesma palavra visual.
        out.push({ t: p, fnt, w: fnt.widthOfTextAtSize(p, tam), notas: [], espaco: out.length > 0 && espacoPendente });
        espacoPendente = false;
      }
    }
    return out;
  };
  const larguraRef = (ns: number[]) => ns.reduce((s, n) => s + f.n.widthOfTextAtSize(String(n), 7) + 0.5, 0);

  /** Um parágrafo: justificado (menos a última linha), com recuo de primeira linha e/ou à esquerda. */
  const paragrafo = (trechos: Trecho[], o: { tam?: number; linha?: number; recuoPrimeira?: number; recuoEsq?: number; justificar?: boolean; negrito?: boolean; centrar?: boolean } = {}) => {
    const tam = o.tam ?? CORPO.tam;
    const lh = o.linha ?? CORPO.linha;
    const recuoEsq = o.recuoEsq ?? 0;
    const ps = palavras(trechos, tam, { negrito: o.negrito });
    const espaco = f.n.widthOfTextAtSize(' ', tam);
    const linhas: Palavra[][] = [];
    let atual: Palavra[] = [];
    let w = 0;
    const max = () => LARG - recuoEsq - (linhas.length === 0 ? (o.recuoPrimeira ?? 0) : 0);
    for (const p of ps) {
      const pw = p.w + larguraRef(p.notas) + (atual.length && p.espaco ? espaco : 0);
      if (w + pw > max() && atual.length) {
        linhas.push(atual);
        atual = [];
        w = 0;
      }
      atual.push(p);
      w += atual.length === 1 ? p.w + larguraRef(p.notas) : pw;
    }
    if (atual.length) linhas.push(atual);
    linhas.forEach((ln, k) => {
      const ns = ln.flatMap((p) => p.notas);
      reservar(lh, ns);
      const base = y + (lh - tam) / 2 + tam * 0.18;
      const x0 = M.esq + recuoEsq + (k === 0 ? (o.recuoPrimeira ?? 0) : 0);
      const disponivel = LARG - recuoEsq - (k === 0 ? (o.recuoPrimeira ?? 0) : 0);
      const natural = ln.reduce((s, p, j) => s + p.w + larguraRef(p.notas) + (j > 0 && p.espaco ? espaco : 0), 0);
      const lacunas = ln.filter((p, j) => j > 0 && p.espaco).length;
      const ultima = k === linhas.length - 1;
      const extra = o.justificar !== false && !ultima && lacunas ? (disponivel - natural) / lacunas : 0;
      let x = o.centrar ? M.esq + (LARG - natural) / 2 : x0;
      ln.forEach((p, j) => {
        if (j > 0 && p.espaco) x += espaco + extra;
        pagina.drawText(p.t, { x, y: base, size: tam, font: p.fnt, color: preto });
        x += p.w;
        for (const n of p.notas) {
          pagina.drawText(String(n), { x: x + 0.5, y: base + tam * 0.38, size: 7, font: f.n, color: preto });
          x += f.n.widthOfTextAtSize(String(n), 7) + 0.5;
        }
      });
    });
  };

  // ---------- Títulos (e o que vai para o sumário) ----------
  const sumario: ItemSumario[] = [];
  const topoDaPagina = () => y >= A4.h - M.topo - 0.5;
  const titulo = (rotulo: string, texto: string, nivel: 0 | 1 | 2 | 3, noSumario = true) => {
    // Título não fica sozinho no pé da página.
    if (y - (topoDaPagina() ? 0 : CORPO.linha) - CORPO.linha * 3 < M.base + alturaNotas) novaPagina();
    if (!topoDaPagina()) y -= CORPO.linha;
    const t1 = nivel >= 2 ? texto : texto.toUpperCase();
    if (noSumario) sumario.push({ rotulo, titulo: t1, nivel, pagina: pdf.getPageCount() - 1 });
    const cheio = rotulo ? `${rotulo} ${t1}` : t1;
    const linhas = quebrarSimples(cheio, f.b, CORPO.tam, LARG);
    linhas.forEach((l, k) => {
      const lh = k === 0 ? CORPO.linha : SIMPLES12;
      reservar(lh, []);
      const yb = y + (lh - CORPO.tam) / 2 + 2;
      if (nivel === 0) centro(l, f.b, CORPO.tam, yb);
      else pagina.drawText(l, { x: M.esq, y: yb, size: CORPO.tam, font: f.b, color: preto });
    });
    y -= 6;
  };
  const desenharParagrafo = (p: Paragrafo, rotuloPai: string, proximoSub: () => number) => {
    if (p.tipo === 'sub') {
      titulo(`${rotuloPai}.${proximoSub()}`, p.trechos.map((x) => ('t' in x ? x.t : '')).join(''), 2);
      return;
    }
    if (p.tipo === 'citacao') {
      y -= 6;
      paragrafo(p.trechos, { tam: PEQ.tam, linha: PEQ.linha + 0.4, recuoEsq: RECUO_CIT });
      y -= 12;
      return;
    }
    paragrafo(p.trechos, { recuoPrimeira: RECUO_PAR });
  };

  // ---------- Tabelas e quadros (fonte 10; título em cima, fonte embaixo) ----------
  const desenharTabela = (tab: TabelaTexto, legenda: string, aoComecar: (pagina: number) => void) => {
    const ncol = Math.max(1, ...tab.linhas.map((l) => l.length));
    const linhas = tab.linhas.map((l) => Array.from({ length: ncol }, (_, k) => seguro(textoPuro(l[k] ?? ''))));
    if (!linhas.length) linhas.push(Array.from({ length: ncol }, () => ''));
    // Larguras pelo tamanho do conteúdo (com um mínimo), somando a largura útil.
    const peso = Array.from({ length: ncol }, (_, k) => Math.min(40, Math.max(6, ...linhas.map((l) => l[k].length))));
    const total = peso.reduce((a, b) => a + b, 0);
    const larg = peso.map((p) => (LARG * p) / total);
    const PAD = 4;
    const celulas = linhas.map((l, r) => l.map((txt, k) => quebrarSimples(txt, r === 0 ? f.b : f.n, PEQ.tam, larg[k] - 2 * PAD)));
    const altura = (r: number) => Math.max(1, ...celulas[r].map((x) => x.length)) * PEQ.linha + 2 * PAD - 2;
    const legendaLinhas = quebrarSimples(legenda, f.b, PEQ.tam, LARG);
    const precisa = legendaLinhas.length * PEQ.linha + 10 + altura(0) + (linhas.length > 1 ? altura(1) : 0);
    if (y - precisa < M.base + alturaNotas) novaPagina();
    if (!topoDaPagina()) y -= 10;
    aoComecar(pdf.getPageCount() - 1);
    for (const l of legendaLinhas) {
      reservar(PEQ.linha, []);
      centro(l, f.b, PEQ.tam, y + 3);
    }
    y -= 4;
    const quadro = tab.tipo === 'quadro';
    const fio = (yy: number) => pagina.drawLine({ start: { x: M.esq, y: yy }, end: { x: M.esq + LARG, y: yy }, thickness: 0.7, color: preto });
    const linha = (r: number) => {
      const h = altura(r);
      const topo = y;
      y -= h;
      let x = M.esq;
      celulas[r].forEach((ls, k) => {
        if (quadro) pagina.drawRectangle({ x, y, width: larg[k], height: h, borderColor: preto, borderWidth: 0.6 });
        ls.forEach((t2, j) => {
          const fnt = r === 0 ? f.b : f.n;
          const w = fnt.widthOfTextAtSize(t2, PEQ.tam);
          const xx = r === 0 || !quadro ? x + (larg[k] - w) / 2 : x + PAD;
          pagina.drawText(t2, { x: xx, y: topo - PAD - (j + 1) * PEQ.linha + 3, size: PEQ.tam, font: fnt, color: preto });
        });
        x += larg[k];
      });
      return topo;
    };
    const cabecalho = () => {
      const topo = linha(0);
      if (!quadro) {
        fio(topo);
        fio(y);
      }
    };
    cabecalho();
    for (let r = 1; r < linhas.length; r++) {
      if (y - altura(r) < M.base + alturaNotas) {
        if (!quadro) fio(y);
        novaPagina();
        cabecalho();
      }
      linha(r);
    }
    if (!quadro && linhas.length > 1) fio(y);
    y -= 2;
    for (const l of quebrarSimples(`Fonte: ${tab.fonte.trim() || 'o autor.'}`, f.n, PEQ.tam, LARG)) {
      reservar(PEQ.linha, []);
      pagina.drawText(l, { x: M.esq, y: y + 3, size: PEQ.tam, font: f.n, color: preto });
    }
    y -= 10;
  };

  // ---------- Capa ----------
  novaPagina();
  const alto = A4.h - M.topo;
  const util = A4.h - M.topo - M.base;
  let yy = alto;
  if (c.instituicao === 'Uniftec' && e.logo) {
    const img = await pdf.embedPng(e.logo);
    const lw = 8.77 * CM;
    const lhImg = (lw * img.height) / img.width;
    pagina.drawImage(img, { x: M.esq + (LARG - lw) / 2, y: yy - lhImg, width: lw, height: lhImg });
    yy -= lhImg + 18;
  } else {
    yy = blocoCentro(c.instituicao === 'Ftec' ? 'FTEC FACULDADES' : 'CENTRO UNIVERSITÁRIO UNIFTEC', f.b, 14, yy) - 18;
  }
  blocoCentro(seguro(`CURSO SUPERIOR DE ${c.curso || 'XXXX'}`).toUpperCase(), f.b, 14, yy);
  blocoCentro(seguro(e.nome).toUpperCase(), f.b, 14, alto - util * 0.36);
  let yt = blocoCentro(seguro(tit || 'TÍTULO DO TRABALHO').toUpperCase(), f.b, 14, alto - util * 0.55);
  if (subt) blocoCentro(seguro(subt), f.b, 14, yt);
  blocoCentro(seguro(c.cidade || 'Caxias do Sul'), f.b, 14, M.base + 44);
  blocoCentro(seguro(c.ano), f.b, 14, M.base + 22);

  // ---------- Folha de rosto (e a de aprovação, que repete o começo) ----------
  const naturezaTexto = seguro(naturezaDe(c));
  const cabecalhoRosto = () => {
    blocoCentro(seguro(e.nome).toUpperCase(), f.b, 12, alto);
    yt = blocoCentro(seguro(tit || 'TÍTULO DO TRABALHO').toUpperCase(), f.b, 14, alto - util * 0.3);
    if (subt) yt = blocoCentro(seguro(subt), f.b, 14, yt);
    // Natureza: recuo de 7,5 cm, justificado, espaço simples, negrito 12.
    const x = M.esq + 7.5 * CM;
    const larg = A4.w - M.dir - x;
    let yn = alto - util * 0.47;
    const linhas = quebrarSimples(naturezaTexto, f.b, 12, larg);
    linhas.forEach((l, k) => {
      yn -= SIMPLES12;
      const ps = l.split(' ');
      const natural = f.b.widthOfTextAtSize(l, 12);
      const extra = k < linhas.length - 1 && ps.length > 1 ? (larg - natural) / (ps.length - 1) : 0;
      let xx = x;
      for (const p of ps) {
        pagina.drawText(p, { x: xx, y: yn, size: 12, font: f.b, color: preto });
        xx += f.b.widthOfTextAtSize(`${p} `, 12) + extra;
      }
    });
    return yn;
  };
  const rodapeRosto = () => {
    blocoCentro(seguro(c.cidade || 'Caxias do Sul'), f.b, 12, M.base + 40);
    blocoCentro(seguro(c.ano), f.b, 12, M.base + 20);
  };
  novaPagina();
  const yNat = cabecalhoRosto();
  let yo = Math.min(yNat - 48, alto - util * 0.72);
  if (c.orientador.trim()) yo = blocoCentro(seguro(`Orientador(a): ${c.orientador.trim()}`), f.b, 12, yo);
  if (c.coorientador.trim()) blocoCentro(seguro(`Coorientador(a): ${c.coorientador.trim()}`), f.b, 12, yo);
  rodapeRosto();

  if (c.aprovacao || tf) {
    novaPagina();
    let ya = cabecalhoRosto() - 40;
    ya = blocoCentro('Aprovado em ____/____/______', f.n, 12, ya) - 24;
    ya = blocoCentro('BANCA EXAMINADORA', f.b, 12, ya) - 30;
    for (const quem of bancaExaminadora(c)) {
      pagina.drawLine({ start: { x: M.esq + LARG * 0.15, y: ya }, end: { x: M.esq + LARG * 0.85, y: ya }, thickness: 0.6, color: preto });
      ya = blocoCentro(seguro(quem), f.n, 11, ya - 2) - 34;
    }
    rodapeRosto();
  }

  if (tf) {
    // Dedicatória e epígrafe: no pé da página, à direita; agradecimentos com título.
    const noPe = (texto: string) => {
      const ps = texto.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!ps.length) return;
      novaPagina();
      const x = M.esq + 7.5 * CM;
      const larg = A4.w - M.dir - x;
      const linhas = ps.flatMap((l) => linhasRicas(l, 12, larg));
      let yp = M.base + linhas.length * CORPO.linha;
      for (const l of linhas) {
        desenharRica(l, x, yp - CORPO.tam, 12);
        yp -= CORPO.linha;
      }
    };
    noPe(tf.dedicatoria);
    if (tf.agradecimentos.trim()) {
      novaPagina();
      titulo('', 'Agradecimentos', 0, false);
      y -= 6;
      for (const p of lerParagrafos(tf.agradecimentos)) paragrafo(p.trechos, { recuoPrimeira: RECUO_PAR });
    }
    noPe(tf.epigrafe);
    // Título, autor e orientador com e-mail, e o resumo (e a mesma página em inglês).
    const paginaResumo = (o: { titulo: string; sub: string; autor: string; advisor: string; rotulo: string; texto: string; rotuloPalavras: string; palavras: string }) => {
      novaPagina();
      y = blocoCentro(seguro(o.titulo || 'TÍTULO DO TRABALHO').toUpperCase(), f.b, 12, y, SIMPLES12);
      if (o.sub.trim()) y = blocoCentro(seguro(o.sub.trim()), f.b, 12, y, SIMPLES12);
      y -= 20;
      const direita = (s2: string, fnt: PDFFont) => {
        if (!s2.trim()) return;
        y -= 13;
        const w = fnt.widthOfTextAtSize(seguro(s2), 10);
        pagina.drawText(seguro(s2), { x: A4.w - M.dir - w, y: y + 2, size: 10, font: fnt, color: preto });
      };
      direita(e.nome, f.b);
      direita(o.autor, f.n);
      direita(tf.email, f.n);
      y -= 8;
      direita(c.orientador.trim(), f.b);
      direita(o.advisor, f.n);
      direita(c.emailOrientador?.trim() ?? '', f.n);
      y -= 20;
      const ps = lerParagrafos(o.texto);
      if (ps.length)
        ps.forEach((p, k) => paragrafo(k === 0 ? [{ t: `${o.rotulo}: `, negrito: true }, ...p.trechos] : p.trechos, { tam: PEQ.tam, linha: PEQ.linha + 0.4 }));
      else paragrafo([{ t: `${o.rotulo}: `, negrito: true }], { tam: PEQ.tam, linha: PEQ.linha + 0.4, justificar: false });
      if (o.palavras.trim()) {
        y -= PEQ.linha;
        paragrafo([{ t: `${o.rotuloPalavras}: `, negrito: true }, ...lerTrechos(o.palavras.trim())], { tam: PEQ.tam, linha: PEQ.linha + 0.4, justificar: false });
      }
    };
    paginaResumo({ titulo: tf.titulo, sub: tf.subtitulo, autor: 'Autor(a)', advisor: 'Orientador(a)', rotulo: 'Resumo', texto: tf.resumo, rotuloPalavras: 'Palavras-chave', palavras: tf.palavrasChave });
    paginaResumo({ titulo: tf.tituloIngles || 'Title of work', sub: tf.subtituloIngles, autor: 'Author', advisor: 'Advisor', rotulo: 'Abstract', texto: tf.abstract, rotuloPalavras: 'Keywords', palavras: tf.keywords });
  }
  // As listas de quadros e de tabelas entram aqui depois (quando se souber as páginas).
  const posicaoListas = pdf.getPageCount();
  const siglas = tf ? siglasDe(tf.siglas) : [];
  if (siglas.length) {
    novaPagina();
    titulo('', 'Lista de abreviaturas e siglas', 0, false);
    y -= 6;
    const col = Math.max(...siglas.map((x) => f.n.widthOfTextAtSize(seguro(x.sigla), 12))) + 16;
    for (const x of siglas) {
      const linhas = quebrarSimples(x.nome, f.n, 12, LARG - col);
      linhas.forEach((l, k) => {
        reservar(CORPO.linha, []);
        if (k === 0) pagina.drawText(seguro(x.sigla), { x: M.esq, y: y + 5, size: 12, font: f.n, color: preto });
        pagina.drawText(l, { x: M.esq + col, y: y + 5, size: 12, font: f.n, color: preto });
      });
    }
  }
  if (c.resumo && !tf) {
    novaPagina();
    titulo('', 'Resumo', 0, false);
    y -= 6;
    for (const p of lerParagrafos(t.resumo)) paragrafo(p.trechos, { linha: SIMPLES12 });
    if (t.palavrasChave.trim()) {
      y -= SIMPLES12;
      paragrafo([{ t: 'Palavras-chave: ', negrito: true }, ...lerTrechos(t.palavrasChave.trim())], { linha: SIMPLES12, justificar: false });
    }
  }
  // O sumário entra aqui depois (quando se souber as páginas).
  const posicaoSumario = pdf.getPageCount();

  // ---------- Parte textual ----------
  novaPagina();
  const primeiraTextual = pdf.getPageCount() - 1;
  const tabelasNoTexto: { tipo: 'tabela' | 'quadro'; item: ItemSumario }[] = [];
  const blocos: Bloco[] = tf ? estruturaFinal(tf) : estruturaPreProjeto(t, e.etapas);
  for (const bl of blocos) {
    if (bl.tipo === 'titulo') {
      if (bl.novaPagina && !topoDaPagina()) novaPagina();
      titulo(bl.rotulo, bl.texto, bl.nivel);
    } else if (bl.tipo === 'tabela') desenharTabela(bl.tabela, legendaTabela(bl), (pg) => tabelasNoTexto.push({ tipo: bl.tabela.tipo, item: { rotulo: '', titulo: legendaTabela(bl), nivel: 2, pagina: pg } }));
    else if (bl.tipo === 'par') desenharParagrafo(bl.p, '', () => 0);
    else if (bl.tipo === 'cronograma') {
      const etapas = bl.etapas;
      const linhaQ = 16;
      const altura = linhaQ * (etapas.length + 1) + 48;
      if (y - altura < M.base + alturaNotas) novaPagina();
      y -= 10;
      reservar(PEQ.linha + 2, []);
      centro('Quadro 1 – Cronograma das atividades', f.b, PEQ.tam, y + 3);
      y -= 4;
      const col = [LARG * 0.72, LARG * 0.28];
      const linhaQuadro = (a: string, b: string, fnt: PDFFont) => {
        const topo = y;
        y -= linhaQ;
        pagina.drawRectangle({ x: M.esq, y, width: col[0], height: linhaQ, borderColor: preto, borderWidth: 0.6 });
        pagina.drawRectangle({ x: M.esq + col[0], y, width: col[1], height: linhaQ, borderColor: preto, borderWidth: 0.6 });
        const txt = quebrarSimples(a, fnt, PEQ.tam, col[0] - 8)[0] ?? '';
        pagina.drawText(txt, { x: M.esq + 4, y: topo - linhaQ + 4.5, size: PEQ.tam, font: fnt, color: preto });
        const wb = fnt.widthOfTextAtSize(b, PEQ.tam);
        pagina.drawText(b, { x: M.esq + col[0] + (col[1] - wb) / 2, y: topo - linhaQ + 4.5, size: PEQ.tam, font: fnt, color: preto });
      };
      linhaQuadro('Etapa', 'Prazo', f.b);
      for (const et of etapas) linhaQuadro(seguro(et.nome), rotuloPrazo(et.prazo), f.n);
      y -= 4;
      reservar(PEQ.linha, []);
      centro('Fonte: o autor.', f.n, PEQ.tam, y + 2);
      y -= 6;
    } else if (bl.tipo === 'referencias') {
      // Referências: elemento pós-textual, começa em página nova (sem número, centralizado;
      // espaço simples; uma linha em branco entre elas).
      if (!topoDaPagina()) novaPagina();
      titulo('', 'Referências', 0);
      y -= 6;
      bl.lista.forEach((r, k) => {
        if (k) y -= SIMPLES12;
        paragrafo(lerTrechos(r), { linha: SIMPLES12, justificar: false });
      });
    }
  }
  desenharNotas();

  // ---------- Listas de quadros e de tabelas (com três ou mais) e sumário, inseridos antes da introdução ----------
  const LINHA_SUM = CORPO.linha;
  const porPagina = Math.floor((A4.h - M.topo - M.base - CORPO.linha * 3) / LINHA_SUM);
  const paginasDe = (n: number) => Math.max(1, Math.ceil(n / porPagina));
  const listas = (['quadro', 'tabela'] as const)
    .map((tipo) => ({ titulo: tipo === 'quadro' ? 'LISTA DE QUADROS' : 'LISTA DE TABELAS', itens: tabelasNoTexto.filter((x) => x.tipo === tipo).map((x) => x.item) }))
    .filter((l) => tf && l.itens.length >= 3);
  const desloc = listas.reduce((s2, l) => s2 + paginasDe(l.itens.length), 0) + paginasDe(sumario.length);
  /** Insere as páginas de uma lista (títulos com pontilhado e página) a partir de `pos`; devolve quantas. */
  const inserirLista = (pos: number, cabeca: string, itens: ItemSumario[]) => {
    const qtd = paginasDe(itens.length);
    for (let k = 0; k < qtd; k++) pdf.insertPage(pos + k, [A4.w, A4.h]);
    const recuoTit = Math.max(0, ...itens.map((s2) => f.b.widthOfTextAtSize(s2.rotulo, 12))) + 8;
    itens.forEach((s2, k) => {
      const pg = pdf.getPage(pos + Math.floor(k / porPagina));
      if (k % porPagina === 0) {
        const w = f.b.widthOfTextAtSize(cabeca, 12);
        pg.drawText(cabeca, { x: M.esq + (LARG - w) / 2, y: A4.h - M.topo - 12, size: 12, font: f.b, color: preto });
      }
      const yb = A4.h - M.topo - CORPO.linha * 3 - (k % porPagina) * LINHA_SUM;
      const fnt = s2.nivel >= 2 ? f.n : f.b;
      const num = String(s2.pagina + desloc);
      const wNum = fnt.widthOfTextAtSize(num, 12);
      const xTit = M.esq + (s2.rotulo ? recuoTit : 0);
      let tt = seguro(s2.titulo);
      const maxTit = A4.w - M.dir - wNum - 24 - xTit;
      while (fnt.widthOfTextAtSize(tt, 12) > maxTit && tt.length > 4) tt = `${tt.slice(0, -2)}…`;
      if (s2.rotulo) pg.drawText(s2.rotulo, { x: M.esq, y: yb, size: 12, font: fnt, color: preto });
      pg.drawText(tt, { x: xTit, y: yb, size: 12, font: fnt, color: preto });
      // Pontilhado até o número da página.
      const xi = xTit + fnt.widthOfTextAtSize(tt, 12) + 4;
      const xf = A4.w - M.dir - wNum - 4;
      const ponto = f.n.widthOfTextAtSize('.', 12) + 1.2;
      for (let x = xi; x + ponto <= xf; x += ponto) pg.drawText('.', { x, y: yb, size: 12, font: f.n, color: preto });
      pg.drawText(num, { x: A4.w - M.dir - wNum, y: yb, size: 12, font: fnt, color: preto });
    });
    return qtd;
  };
  let pos = posicaoListas;
  for (const l of listas) pos += inserirLista(pos, l.titulo, l.itens);
  inserirLista(posicaoSumario + (pos - posicaoListas), 'SUMÁRIO', sumario);

  const comPagina = (xs: ItemSumario[]) => xs.map((x) => ({ ...x, pagina: x.pagina + desloc }));
  // ---------- Números de página: contadas desde a folha de rosto; mostradas a partir da introdução ----------
  const inicioNumeros = primeiraTextual + desloc;
  aoSumario?.(comPagina(sumario), { listas: listas.map((l) => ({ titulo: l.titulo, itens: comPagina(l.itens) })), inicio: inicioNumeros });
  pdf.getPages().forEach((pg, k) => {
    if (k < inicioNumeros) return;
    const s2 = String(k);
    pg.drawText(s2, { x: A4.w - M.dir - f.n.widthOfTextAtSize(s2, 10), y: A4.h - 2 * CM, size: 10, font: f.n, color: preto });
  });
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Os nomes da banca (folha de aprovação). */
export function bancaExaminadora(c: ConfigPreProjeto): string[] {
  const av = c.avaliadores ?? [];
  return [`Professor(a) Orientador(a): ${c.orientador.trim() || '_______________'}`, ...[0, 1].map((k) => `Professor(a) Avaliador(a): ${av[k]?.trim() || '_______________'}`)];
}

export function nomeArquivoPreProjeto(nome: string, formato?: 'pre' | 'final'): string {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, '-').slice(0, 60);
  return `${formato === 'final' ? 'Trabalho final' : 'Pre-projeto'} - ${limpo}.pdf`;
}
