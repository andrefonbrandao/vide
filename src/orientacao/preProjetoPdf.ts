// PDF do pré-projeto (TCC I) pelas regras do manual de normalização (Uniftec/FTEC):
// A4; margens 3 cm (superior e esquerda) e 2 cm (inferior e direita); Arial (Helvetica,
// de mesmas medidas) 12; entrelinha 1,5; recuo de 1,25 cm no parágrafo; citação longa com
// recuo de 4 cm, fonte 10, espaço simples; notas de rodapé em fonte 10; títulos em negrito
// (primários em maiúsculas); capa, folha de rosto, sumário; páginas contadas desde a folha
// de rosto e numeradas a partir da introdução, no canto superior direito.
// O pdf-lib é carregado só na hora.
import type { PDFFont, PDFPage } from 'pdf-lib';
import { lerParagrafos, lerTrechos, ordenarReferencias, type Paragrafo, type Trecho } from './marcacao';
import { dataBR, emOrdem } from './prazos';
import type { ConfigPreProjeto, Etapa, TextoProjeto } from './tipos';
import { naturezaPadrao } from './campos';
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
const CORPO = { tam: 12, linha: 18 }; // 1,5
const SIMPLES12 = 14;
const PEQ = { tam: 10, linha: 11.6 }; // citação longa, notas, quadros
const RECUO_PAR = 1.25 * CM;
const RECUO_CIT = 4 * CM;

function seguro(s: string): string {
  return s
    .replace(/[‐‑‒]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…€ŒœŠšŸŽžƒˆ˜†‡‰‹›™]/g, '?');
}

export async function gerarPreProjetoPdf(e: EntradaPreProjeto): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const t = { ...TEXTO_VAZIO, ...e.texto };
  const c = e.config;
  pdf.setTitle(seguro(t.titulo || 'Pré-projeto'));
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
  const sumario: { rotulo: string; titulo: string; nivel: 1 | 2 | 0; pagina: number }[] = [];
  const topoDaPagina = () => y >= A4.h - M.topo - 0.5;
  const titulo = (rotulo: string, texto: string, nivel: 1 | 2 | 0, noSumario = true) => {
    // Título não fica sozinho no pé da página.
    if (y - (topoDaPagina() ? 0 : CORPO.linha) - CORPO.linha * 3 < M.base + alturaNotas) novaPagina();
    if (!topoDaPagina()) y -= CORPO.linha;
    const t1 = nivel === 2 ? texto : texto.toUpperCase();
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
  const textoCorrido = (texto: string, comSubtitulos = false, rotuloPai = '') => {
    let sub = 0;
    for (const p of lerParagrafos(texto, comSubtitulos)) desenharParagrafo(p, rotuloPai, () => ++sub);
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
  let yt = blocoCentro(seguro(t.titulo || 'TÍTULO DO TRABALHO').toUpperCase(), f.b, 14, alto - util * 0.55);
  if (t.subtitulo.trim()) blocoCentro(seguro(t.subtitulo.trim()), f.b, 14, yt);
  blocoCentro(seguro(c.cidade || 'Caxias do Sul'), f.b, 14, M.base + 44);
  blocoCentro(seguro(c.ano), f.b, 14, M.base + 22);

  // ---------- Folha de rosto (e a de aprovação, que repete o começo) ----------
  const naturezaTexto = seguro(c.natureza.trim() || naturezaPadrao(c));
  const cabecalhoRosto = () => {
    blocoCentro(seguro(e.nome).toUpperCase(), f.b, 12, alto);
    yt = blocoCentro(seguro(t.titulo || 'TÍTULO DO TRABALHO').toUpperCase(), f.b, 14, alto - util * 0.3);
    if (t.subtitulo.trim()) yt = blocoCentro(seguro(t.subtitulo.trim()), f.b, 14, yt);
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

  if (c.aprovacao) {
    novaPagina();
    let ya = cabecalhoRosto() - 40;
    ya = blocoCentro('Aprovado em ____/____/______', f.n, 12, ya) - 24;
    ya = blocoCentro('BANCA EXAMINADORA', f.b, 12, ya) - 30;
    for (const quem of [`Professor(a) Orientador(a): ${c.orientador.trim() || '_______________'}`, 'Professor(a) Avaliador(a): _______________', 'Professor(a) Avaliador(a): _______________']) {
      pagina.drawLine({ start: { x: M.esq + LARG * 0.15, y: ya }, end: { x: M.esq + LARG * 0.85, y: ya }, thickness: 0.6, color: preto });
      ya = blocoCentro(seguro(quem), f.n, 11, ya - 2) - 34;
    }
    rodapeRosto();
  }

  if (c.resumo) {
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
  let sec = 0;
  const secao = (nome: string) => {
    sec++;
    titulo(String(sec), nome, 1);
    return String(sec);
  };
  const subsecao = (pai: string, n: number, nome: string, texto: string, comSub = false) => {
    if (!texto.trim()) return n;
    titulo(`${pai}.${n}`, nome, 2);
    textoCorrido(texto, comSub, `${pai}.${n}`);
    return n + 1;
  };

  // 1 Introdução (tema e delimitação; problema; hipóteses)
  if (t.introducao.trim() || t.problema.trim() || t.hipoteses.trim()) {
    const s1 = secao('Introdução');
    textoCorrido(t.introducao);
    let n = 1;
    n = subsecao(s1, n, 'Problema de pesquisa', t.problema);
    subsecao(s1, n, 'Hipótese(s)', t.hipoteses);
  }
  // 2 Objetivos e justificativa
  if (t.objetivoGeral.trim() || t.objetivosEspecificos.trim() || t.justificativa.trim()) {
    const s2 = secao('Objetivos e justificativa');
    let n = 1;
    n = subsecao(s2, n, 'Objetivo geral', t.objetivoGeral);
    // Específicos: frases completas, sem marcador, com ponto final.
    const especificos = t.objetivosEspecificos
      .split('\n')
      .map((x) => x.trim().replace(/^[-•*]\s*/, '').replace(/[;,]$/, ''))
      .filter(Boolean)
      .map((x) => (/[.!?]$/.test(x) ? x : `${x}.`))
      .join('\n');
    n = subsecao(s2, n, 'Objetivos específicos', especificos);
    subsecao(s2, n, 'Justificativa', t.justificativa);
  }
  // 3 Fundamentação teórica (com subtítulos "## ")
  if (t.fundamentacao.trim()) {
    const s3 = secao('Fundamentação teórica');
    textoCorrido(t.fundamentacao, true, s3);
  }
  // 4 Procedimentos metodológicos
  if ([t.metodo, t.populacao, t.coleta, t.analise].some((x) => x.trim())) {
    const s4 = secao('Procedimentos metodológicos');
    let n = 1;
    n = subsecao(s4, n, 'Método(s) de pesquisa', t.metodo);
    n = subsecao(s4, n, 'Delimitação da população (amostragem) ou objeto da investigação', t.populacao);
    n = subsecao(s4, n, 'Técnicas de coleta de dados', t.coleta);
    subsecao(s4, n, 'Técnicas de análise de dados', t.analise);
  }
  // 5 Cronograma das atividades (quadro) e recursos
  const etapas = emOrdem(e.etapas);
  if (etapas.length || t.recursos.trim()) {
    const s5 = secao('Cronograma das atividades');
    if (etapas.length) {
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
      for (const et of etapas) linhaQuadro(seguro(et.nome), dataBR(et.prazo), f.n);
      y -= 4;
      reservar(PEQ.linha, []);
      centro('Fonte: o autor.', f.n, PEQ.tam, y + 2);
      y -= 6;
    }
    subsecao(s5, 1, 'Recursos', t.recursos);
  }
  // Referências (sem número, centralizado; espaço simples; uma linha em branco entre elas)
  const refs = ordenarReferencias(t.referencias);
  if (refs.length) {
    titulo('', 'Referências', 0);
    y -= 6;
    refs.forEach((r, k) => {
      if (k) y -= SIMPLES12;
      paragrafo(lerTrechos(r), { linha: SIMPLES12, justificar: false });
    });
  }
  desenharNotas();

  // ---------- Sumário (inserido antes da introdução) ----------
  const LINHA_SUM = CORPO.linha;
  const porPagina = Math.floor((A4.h - M.topo - M.base - CORPO.linha * 3) / LINHA_SUM);
  const qtdSum = Math.max(1, Math.ceil(sumario.length / porPagina));
  for (let k = 0; k < qtdSum; k++) pdf.insertPage(posicaoSumario + k, [A4.w, A4.h]);
  const recuoTit = Math.max(0, ...sumario.map((s) => f.b.widthOfTextAtSize(s.rotulo, 12))) + 8;
  sumario.forEach((s, k) => {
    const pg = pdf.getPage(posicaoSumario + Math.floor(k / porPagina));
    if (k % porPagina === 0) {
      const w = f.b.widthOfTextAtSize('SUMÁRIO', 12);
      pg.drawText('SUMÁRIO', { x: M.esq + (LARG - w) / 2, y: A4.h - M.topo - 12, size: 12, font: f.b, color: preto });
    }
    const yb = A4.h - M.topo - CORPO.linha * 3 - (k % porPagina) * LINHA_SUM;
    const fnt = s.nivel === 2 ? f.n : f.b;
    const num = String(s.pagina + qtdSum);
    const wNum = fnt.widthOfTextAtSize(num, 12);
    const xTit = M.esq + (s.rotulo ? recuoTit : 0);
    let tit = seguro(s.titulo);
    const maxTit = A4.w - M.dir - wNum - 24 - xTit;
    while (fnt.widthOfTextAtSize(tit, 12) > maxTit && tit.length > 4) tit = `${tit.slice(0, -2)}…`;
    if (s.rotulo) pg.drawText(s.rotulo, { x: M.esq, y: yb, size: 12, font: fnt, color: preto });
    pg.drawText(tit, { x: xTit, y: yb, size: 12, font: fnt, color: preto });
    // Pontilhado até o número da página.
    const xi = xTit + fnt.widthOfTextAtSize(tit, 12) + 4;
    const xf = A4.w - M.dir - wNum - 4;
    const ponto = f.n.widthOfTextAtSize('.', 12) + 1.2;
    for (let x = xi; x + ponto <= xf; x += ponto) pg.drawText('.', { x, y: yb, size: 12, font: f.n, color: preto });
    pg.drawText(num, { x: A4.w - M.dir - wNum, y: yb, size: 12, font: fnt, color: preto });
  });

  // ---------- Números de página: contadas desde a folha de rosto; mostradas a partir da introdução ----------
  const inicioNumeros = primeiraTextual + qtdSum;
  pdf.getPages().forEach((pg, k) => {
    if (k < inicioNumeros) return;
    const s = String(k);
    pg.drawText(s, { x: A4.w - M.dir - f.n.widthOfTextAtSize(s, 10), y: A4.h - 2 * CM, size: 10, font: f.n, color: preto });
  });
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function nomeArquivoPreProjeto(nome: string): string {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, '-').slice(0, 60);
  return `Pre-projeto - ${limpo}.pdf`;
}
