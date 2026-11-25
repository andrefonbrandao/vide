// PDF do plano de ensino, com o mesmo desenho do Word (cabeçalho da instituição na primeira página,
// faixas azuis, quadro dos Graus, regras de aprovação, recuperação, bibliografia e assinaturas).
import type { PDFImage, PDFPage } from 'pdf-lib';
import { localEData, pedacosNegrito, REGRAS_APROVACAO } from './planoEnsino';
import type { EntradaPlanoEnsino } from './planoEnsinoDocx';

const CM = 28.3465;
const A4 = { w: 595.28, h: 841.89 };
const ESQ = 1.0 * CM;
const DIR = A4.w - 1.0 * CM;
const LARG = DIR - ESQ;
const TOPO = A4.h - 1.5 * CM;
const BASE = 1.8 * CM;

type Palavra = { t: string; b: boolean };

export async function gerarPlanoEnsinoPdf(e: EntradaPlanoEnsino): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const cor = (h: string) => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
  const ESC = cor('24387A');
  const CINZA = cor('ACB8C9');
  const PRETO = rgb(0, 0, 0);
  const BRANCO = rgb(1, 1, 1);
  const p = e.plano;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Plano de Ensino - ${e.unidade}`);
  pdf.setCreator('Vide');
  const fn = await pdf.embedFont(StandardFonts.Helvetica);
  const fb = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonte = (b: boolean) => (b ? fb : fn);
  const cabecalho: PDFImage | null = e.cabecalho ? await pdf.embedPng(e.cabecalho) : null;
  const seguro = (s: string) => s.replace(/[‐‑‒]/g, '-').replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…ªº]/g, '?');
  let pg!: PDFPage;
  let y = 0;
  const rodape = () => pg.drawText('Revisão 00', { x: DIR - fn.widthOfTextAtSize('Revisão 00', 7), y: 0.8 * CM, size: 7, font: fn, color: cor('7F7F7F') });
  const novaPagina = () => {
    pg = pdf.addPage([A4.w, A4.h]);
    rodape();
    y = TOPO;
  };
  const cabe = (h: number) => {
    if (y - h < BASE) novaPagina();
  };

  /** Quebra o texto em linhas (as palavras longas demais, como endereços da internet, são partidas). */
  const quebrar = (pedacos: Palavra[], tam: number, max: number): Palavra[][] => {
    const palavras: Palavra[] = [];
    for (const pd of pedacos)
      for (const w of seguro(pd.t).split(/\s+/).filter(Boolean)) {
        const f = fonte(pd.b);
        if (f.widthOfTextAtSize(w, tam) <= max) palavras.push({ t: w, b: pd.b });
        else {
          let atual = '';
          for (const ch of w) {
            if (f.widthOfTextAtSize(atual + ch, tam) > max) {
              palavras.push({ t: atual, b: pd.b });
              atual = ch;
            } else atual += ch;
          }
          if (atual) palavras.push({ t: atual, b: pd.b });
        }
      }
    const linhas: Palavra[][] = [];
    let linha: Palavra[] = [];
    let larg = 0;
    for (const w of palavras) {
      const lw = fonte(w.b).widthOfTextAtSize(w.t, tam);
      const sp = linha.length ? fn.widthOfTextAtSize(' ', tam) : 0;
      if (linha.length && larg + sp + lw > max) {
        linhas.push(linha);
        linha = [w];
        larg = lw;
      } else {
        linha.push(w);
        larg += sp + lw;
      }
    }
    if (linha.length) linhas.push(linha);
    return linhas;
  };
  const largura = (l: Palavra[], tam: number) => l.reduce((s, w, k) => s + fonte(w.b).widthOfTextAtSize(w.t, tam) + (k ? fn.widthOfTextAtSize(' ', tam) : 0), 0);
  /** Desenha uma linha: à esquerda, ao centro ou justificada. */
  const desenharLinha = (pag: PDFPage, l: Palavra[], x: number, yy: number, tam: number, max: number, alinh: 'esq' | 'centro' | 'just', cor0 = PRETO) => {
    const natural = largura(l, tam);
    let xx = alinh === 'centro' ? x + (max - natural) / 2 : x;
    const extra = alinh === 'just' && l.length > 1 ? (max - natural) / (l.length - 1) : 0;
    for (const w of l) {
      pag.drawText(w.t, { x: xx, y: yy, size: tam, font: fonte(w.b), color: cor0 });
      xx += fonte(w.b).widthOfTextAtSize(w.t, tam) + fn.widthOfTextAtSize(' ', tam) + extra;
    }
  };
  /** Parágrafo que pode passar de página. */
  const paragrafo = (t: string | Palavra[], o: { x?: number; w?: number; tam?: number; alinh?: 'esq' | 'centro' | 'just'; depois?: number; b?: boolean } = {}) => {
    const tam = o.tam ?? 10;
    const x = o.x ?? ESQ;
    const w = o.w ?? DIR - x;
    const ped = typeof t === 'string' ? (o.b ? [{ t, b: true }] : pedacosNegrito(t)) : t;
    const ls = quebrar(ped, tam, w);
    const alt = tam * 1.3;
    ls.forEach((l, k) => {
      cabe(alt);
      const alinh = o.alinh === 'just' && k === ls.length - 1 ? 'esq' : (o.alinh ?? 'esq');
      desenharLinha(pg, l, x, y - tam, tam, w, alinh);
      y -= alt;
    });
    y -= o.depois ?? 4;
  };
  const faixa = (t: string, antes = 10) => {
    y -= antes;
    cabe(16 + 30);
    pg.drawRectangle({ x: ESQ, y: y - 14, width: LARG, height: 14, color: ESC });
    pg.drawText(seguro(t), { x: ESQ + 4, y: y - 10.5, size: 9.5, font: fb, color: BRANCO });
    y -= 19;
  };
  const linhas = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);

  /** Tabela com bordas: cada linha com células (texto, alinhamento, fundo). Não se parte entre páginas. */
  type Celula = { t: string; b?: boolean; alinh?: 'esq' | 'centro' | 'just'; fundo?: ReturnType<typeof cor>; baixo?: boolean; tam?: number };
  const tabela = (cols: number[], linhasT: Celula[][]) => {
    const x0 = ESQ;
    for (const lt of linhasT) {
      const prep = lt.map((c, k) => {
        const tam = c.tam ?? 9;
        const ls = linhas(c.t).flatMap((par) => quebrar(c.b ? [{ t: par, b: true }] : pedacosNegrito(par), tam, cols[k] - 8));
        return { c, tam, ls, h: ls.length * tam * 1.3 + 8 };
      });
      const h = Math.max(18, ...prep.map((x) => x.h));
      cabe(h);
      let x = x0;
      prep.forEach(({ c, tam, ls }, k) => {
        if (c.fundo) pg.drawRectangle({ x, y: y - h, width: cols[k], height: h, color: c.fundo });
        pg.drawRectangle({ x, y: y - h, width: cols[k], height: h, borderColor: PRETO, borderWidth: 0.5 });
        let yy = c.baixo ? y - h + 4 + ls.length * tam * 1.3 - tam : y - 4 - tam;
        for (const [j, l] of ls.entries()) {
          desenharLinha(pg, l, x + 4, yy, tam, cols[k] - 8, c.alinh === 'just' && j === ls.length - 1 ? 'esq' : (c.alinh ?? 'esq'));
          yy -= tam * 1.3;
        }
        x += cols[k];
      });
      y -= h;
    }
  };

  // ----- Primeira página: cabeçalho -----
  novaPagina();
  if (cabecalho) {
    const hc = 5.7 * CM;
    pg.drawImage(cabecalho, { x: 0, y: A4.h - hc, width: A4.w, height: hc });
    y = A4.h - hc - 4;
  } else {
    pg.drawText('PLANO DE ENSINO', { x: DIR - fb.widthOfTextAtSize('PLANO DE ENSINO', 14), y: A4.h - 3 * CM, size: 14, font: fb, color: ESC });
    y = A4.h - 4 * CM;
  }

  // ----- Unidade curricular -----
  faixa('Unidade Curricular', 0);
  const c1 = ESQ + 4;
  const c2 = ESQ + 3.7 * CM;
  const c3 = ESQ + 10.6 * CM;
  const info = (a: string, b: Palavra[], c: Palavra[]) => {
    pg.drawText(a, { x: c1, y: y - 10, size: 10, font: fn });
    desenharLinha(pg, b, c2, y - 10, 10, c3 - c2 - 8, 'esq');
    desenharLinha(pg, c, c3, y - 10, 10, DIR - c3, 'esq');
    y -= 17;
  };
  info('Unidade Curricular:', [{ t: seguro(e.unidade), b: true }], [{ t: `Horário: ${e.horario}`, b: false }]);
  info('Professor(a):', [{ t: seguro(p.professor), b: false }], [{ t: 'Ano/Semestre:', b: false }, { t: e.periodo, b: true }]);
  info('Carga Horária (h):', [{ t: seguro(p.cargaHoraria), b: false }], []);

  // ----- Ementa, competências, habilidades -----
  faixa('Ementa', 4);
  for (const l of linhas(p.ementa)) paragrafo(l, { alinh: 'just' });
  const marcadores = (itens: string[]) => {
    for (const it of itens.filter((x) => x.trim())) {
      cabe(13);
      pg.drawText('•', { x: ESQ + 10, y: y - 10, size: 10, font: fn });
      paragrafo(it.trim(), { x: ESQ + 22, depois: 3 });
    }
  };
  faixa('Competências');
  marcadores(p.competencias);
  faixa('Habilidades');
  marcadores(p.habilidades);

  // ----- Conteúdo programático -----
  faixa('Conteúdo Programático');
  p.conteudo
    .filter((u) => u.titulo.trim() || u.itens.some((i) => i.trim()))
    .forEach((u, k) => {
      cabe(26);
      pg.drawText(`${k + 1}.`, { x: ESQ + 8, y: y - 10, size: 10, font: fb });
      paragrafo(u.titulo.trim(), { x: ESQ + 36, b: true, depois: 1 });
      u.itens
        .filter((i) => i.trim())
        .forEach((i, j) => {
          cabe(13);
          pg.drawText(`${k + 1}.${j + 1}`, { x: ESQ + 8, y: y - 10, size: 10, font: fn });
          paragrafo(i.trim(), { x: ESQ + 36, depois: 1 });
        });
    });

  // ----- Estratégias de avaliação -----
  faixa('Estratégias de Avaliação do Processo Ensino-Aprendizagem', 16);
  for (const l of linhas(p.estrategias)) paragrafo(l, { alinh: 'just' });
  y -= 6;
  const g1 = 2 * CM;
  const g3 = 4.6 * CM;
  const g2 = LARG - g1 - g3;
  // O cabeçalho "Instrumento Avaliativo" ocupa as duas primeiras colunas.
  tabela([g1 + g2, g3], [[{ t: 'Instrumento Avaliativo', b: true, alinh: 'centro', fundo: CINZA }, { t: 'Peso', b: true, alinh: 'centro', fundo: CINZA }]]);
  tabela(
    [g1, g2, g3],
    (['A', 'B', 'C'] as const).map((gl) => [
      { t: `Grau ${gl}`, b: true, alinh: 'centro', baixo: true },
      { t: p.graus[gl].descricao, alinh: 'just', tam: 8.5 },
      { t: p.graus[gl].peso, alinh: 'centro', baixo: true },
    ]),
  );
  y -= 10;
  for (const r of REGRAS_APROVACAO) {
    if (r.tipo === 'formula') {
      y -= 4;
      paragrafo(r.t, { alinh: 'centro', b: true, depois: 8 });
    } else if (r.tipo === 'lista') paragrafo(r.t, { x: ESQ + 1 * CM, depois: 4 });
    else if (r.tipo === 'nota') paragrafo(r.t, { tam: 6.5, depois: 4 });
    else paragrafo(r.t, { alinh: 'just', depois: 6 });
  }

  // ----- Ações para a melhoria da aprendizagem -----
  y -= 10;
  cabe(80);
  pg.drawRectangle({ x: ESQ, y: y - 15, width: LARG, height: 15, color: CINZA });
  const tAcoes = 'Ações concretas para a melhoria da aprendizagem em função das avaliações realizadas';
  pg.drawText(tAcoes, { x: ESQ + (LARG - fb.widthOfTextAtSize(tAcoes, 9.5)) / 2, y: y - 11, size: 9.5, font: fb });
  y -= 22;
  tabela(
    [LARG / 2, LARG / 2],
    [
      [
        { t: 'Descrição', b: true, alinh: 'centro', fundo: CINZA },
        { t: 'Estratégias/ Atividades Propostas', b: true, alinh: 'centro', fundo: CINZA },
      ],
      [
        { t: p.recuperacao.descricao, alinh: 'centro' },
        { t: p.recuperacao.estrategias, alinh: 'just' },
      ],
    ],
  );

  // ----- Bibliografia -----
  faixa('Bibliografia', 18);
  const subtitulo = (t: string) => {
    cabe(40);
    const w = fb.widthOfTextAtSize(t, 9.5);
    pg.drawRectangle({ x: ESQ, y: y - 13, width: w + 6, height: 13, color: cor('808080') });
    pg.drawText(t, { x: ESQ + 3, y: y - 10, size: 9.5, font: fb, color: BRANCO });
    y -= 20;
  };
  subtitulo('Bibliografia Básica');
  for (const o of p.bibliografiaBasica.filter((x) => x.trim())) paragrafo(o.trim(), { depois: 8 });
  y -= 4;
  subtitulo('Bibliografia Complementar');
  for (const o of p.bibliografiaComplementar.filter((x) => x.trim())) paragrafo(o.trim(), { depois: 8 });

  // ----- Local, data e assinaturas -----
  y -= 20;
  cabe(110);
  const data = seguro(localEData(p.cidade, e.data));
  pg.drawText(data, { x: DIR - fn.widthOfTextAtSize(data, 10), y: y - 10, size: 10, font: fn });
  y -= 70;
  const la = LARG / 2 - 1.2 * CM;
  const assinatura = (x: number, nome: string, papel: string) => {
    pg.drawLine({ start: { x, y }, end: { x: x + la, y }, thickness: 0.6, color: PRETO });
    for (const [k, t] of [seguro(nome), papel].entries()) pg.drawText(t, { x: x + (la - fn.widthOfTextAtSize(t, 10)) / 2, y: y - 13 - k * 13, size: 10, font: fn });
  };
  assinatura(ESQ, p.professor, 'Professor(a)');
  assinatura(DIR - la, p.coordenador, 'Coordenador(a)');

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

