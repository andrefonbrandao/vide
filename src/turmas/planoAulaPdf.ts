// PDF do plano de aula, com o mesmo desenho do Word (cabeçalho da instituição em cada página,
// etiquetas "AULA n" com a data, quadros dos temas, quadros dos Graus, estratégias e recuperação).
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { dataBR } from './planoAula';
import type { EntradaPlanoAula } from './planoAulaDocx';

const CM = 28.3465;
const A4 = { w: 595.28, h: 841.89 };
const ESQ = 1.25 * CM;
const DIR = A4.w - 1.25 * CM;
const TOPO = A4.h - 6.0 * CM;
const BASE = 1.0 * CM;

export async function gerarPlanoAulaPdf(e: EntradaPlanoAula & { aba?: Uint8Array }): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const cor = (h: string) => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
  const AZUL = cor('2E5395');
  const ESCURO = cor('1F3863');
  const CLARO = cor('6FA3DA');
  const PRETO = rgb(0, 0, 0);
  const BRANCO = rgb(1, 1, 1);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Plano de Aula - ${e.unidade}`);
  pdf.setCreator('Vide');
  const f = { n: await pdf.embedFont(StandardFonts.Helvetica), b: await pdf.embedFont(StandardFonts.HelveticaBold), i: await pdf.embedFont(StandardFonts.HelveticaOblique) };
  const cabecalho: PDFImage | null = e.cabecalho ? await pdf.embedPng(e.cabecalho) : null;
  const aba: PDFImage | null = e.aba ? await pdf.embedJpg(e.aba) : null;
  const seguro = (s: string) => s.replace(/[‐‑‒]/g, '-').replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…]/g, '?');
  let pg!: PDFPage;
  let y = 0;
  const novaPagina = () => {
    pg = pdf.addPage([A4.w, A4.h]);
    if (cabecalho) pg.drawImage(cabecalho, { x: 0, y: A4.h - 5.65 * CM, width: A4.w, height: 5.65 * CM });
    else pg.drawText('PLANO DE AULA', { x: DIR - f.b.widthOfTextAtSize('PLANO DE AULA', 14), y: A4.h - 3 * CM, size: 14, font: f.b, color: ESCURO });
    y = TOPO;
  };
  const quebrar = (t: string, fnt: PDFFont, tam: number, max: number): string[] => {
    const out: string[] = [];
    for (const par of seguro(t).split('\n')) {
      let atual = '';
      for (const p of par.split(/\s+/).filter(Boolean)) {
        const teste = atual ? `${atual} ${p}` : p;
        if (fnt.widthOfTextAtSize(teste, tam) > max && atual) {
          out.push(atual);
          atual = p;
        } else atual = teste;
      }
      if (atual) out.push(atual);
    }
    return out;
  };
  const cabe = (h: number) => {
    if (y - h < BASE) novaPagina();
  };
  /** Etiqueta azul ("AULA 3"): a imagem da instituição com o texto branco por cima. */
  const etiqueta = (texto: string, x: number, topo: number, w = 2.75 * CM, h = 1.18 * CM) => {
    if (aba) pg.drawImage(aba, { x, y: topo - h, width: w, height: h });
    else pg.drawRectangle({ x, y: topo - h, width: w, height: h, color: cor('5B9BD5') });
    // A letra diminui para caber na parte azul da etiqueta (de 9% a 74% da largura).
    const tam = Math.min(13.5, (w * 0.6) / Math.max(1, f.b.widthOfTextAtSize(texto, 1)));
    pg.drawText(texto, { x: x + w * 0.13, y: topo - h * 0.46 - tam * 0.35, size: tam, font: f.b, color: BRANCO });
  };

  novaPagina();
  // ----- Dados da unidade curricular -----
  const col2 = ESQ + 0.9 * CM + (DIR - ESQ) / 2;
  const info = (x: number, rot: string, val: string, yy: number) => {
    pg.drawText(rot, { x, y: yy, size: 8.5, font: f.n, color: AZUL });
    pg.drawText(seguro(val.toUpperCase()), { x, y: yy - 12, size: 8.5, font: f.n, color: PRETO });
  };
  info(ESQ + 0.9 * CM, 'UNIDADE CURRICULAR:', e.unidade, y);
  info(col2, 'CARGA HORÁRIA:', e.plano.cargaHoraria, y);
  info(ESQ + 0.9 * CM, 'PROFESSOR:', e.plano.professor, y - 28);
  info(col2, 'PERÍODO DE REALIZAÇÃO:', `${dataBR(e.periodo.inicio)} A ${dataBR(e.periodo.fim)}`, y - 28);
  y -= 64;

  // ----- Aulas -----
  const X1 = ESQ + 0.4 * CM;
  const XQ = X1 + 3.4 * CM;
  const LQ = DIR - XQ - 0.2 * CM;
  e.plano.aulas.forEach((a, k) => {
    const destaque = a.destaque.trim() ? quebrar(a.destaque.trim(), f.b, 9, LQ - 16) : [];
    const tema = quebrar(a.tema.trim(), f.n, 9, LQ - 16);
    const hTexto = (destaque.length + tema.length) * 11.5 + (destaque.length ? 6 : 0) + 14;
    const h = Math.max(1.95 * CM, hTexto);
    cabe(h + 8);
    const topo = y;
    etiqueta(`AULA ${k + 1}`, X1, topo - 2);
    pg.drawText(dataBR(e.datas[k] ?? '') || '__/__/____', { x: X1 + 6, y: topo - 1.18 * CM - 15, size: 11, font: f.b, color: ESCURO });
    pg.drawRectangle({ x: XQ, y: topo - h, width: LQ, height: h, borderColor: AZUL, borderWidth: 0.9 });
    let yy = topo - 14;
    for (const l of destaque) {
      pg.drawText(l, { x: XQ + 8, y: yy, size: 9, font: f.b, color: PRETO });
      yy -= 11.5;
    }
    if (destaque.length) yy -= 6;
    for (const l of tema) {
      pg.drawText(l, { x: XQ + 8, y: yy, size: 9, font: f.n, color: PRETO });
      yy -= 11.5;
    }
    y -= h + 9;
    if (a.grau) {
      const g = e.plano.graus[a.grau];
      const l1 = quebrar(`${a.grau === 'C' ? 'Data de aplicação da avaliação' : 'Datas de aplicação da avaliação'}: ${g.aplicacao}`, f.n, 8.5, DIR - X1 - 40);
      const l2 = quebrar(`Data para a postagem das notas no portal acadêmico: ${g.postagem}`, f.n, 8.5, DIR - X1 - 40);
      const hg = 26 + (l1.length + l2.length) * 11 + 14;
      cabe(hg + 10);
      pg.drawRectangle({ x: X1, y: y - hg, width: DIR - X1 - 0.2 * CM, height: hg, color: CLARO });
      pg.drawText(`GRAU ${a.grau}`, { x: X1 + 16, y: y - 18, size: 10.5, font: f.b, color: ESCURO });
      let yg = y - 34;
      for (const l of [...l1, ...l2]) {
        pg.drawText(l, { x: X1 + 16, y: yg, size: 8.5, font: f.n, color: ESCURO });
        yg -= 11;
      }
      y -= hg + 12;
    }
  });

  // ----- Estratégias de avaliação -----
  cabe(30 + 4 * 22);
  pg.drawRectangle({ x: ESQ, y: y - 16, width: DIR - ESQ, height: 16, color: AZUL });
  pg.drawText('Estratégias de Avaliação', { x: ESQ + 4, y: y - 12, size: 10.5, font: f.b, color: BRANCO });
  y -= 28;
  const C1 = 4.2 * CM;
  const C2 = 3.6 * CM;
  const C3 = 2 * CM;
  const C4 = DIR - X1 - C1 - C2 - C3 - 0.2 * CM;
  const celula = (t: string, x: number, w: number, topo: number, h: number) => {
    pg.drawRectangle({ x, y: topo - h, width: w, height: h, borderColor: PRETO, borderWidth: 0.5 });
    quebrar(t, f.b, 8, w - 8).forEach((l, j) => pg.drawText(l, { x: x + (w - f.b.widthOfTextAtSize(l, 8)) / 2, y: topo - 10 - j * 9.5, size: 8, font: f.b, color: PRETO }));
  };
  for (const gl of ['A', 'B', 'C'] as const) {
    const g = e.plano.graus[gl];
    const linhas = [{ instrumento: 'Instrumento avaliativo', peso: 'Peso', criterio: 'Critérios' }, ...(g.linhas.length ? g.linhas : [{ instrumento: '', peso: '', criterio: '' }])];
    const alturas = linhas.map((l) => Math.max(22, Math.max(...[l.instrumento, l.peso, l.criterio].map((t, j) => quebrar(t, f.b, 8, [C2, C3, C4][j] - 8).length)) * 9.5 + 8));
    const total = Math.max(2.3 * CM, alturas.reduce((s, h) => s + h, 0));
    cabe(total + 16);
    const topo = y;
    pg.drawRectangle({ x: X1, y: topo - total, width: C1, height: total, borderColor: PRETO, borderWidth: 0.5 });
    etiqueta(`GRAU ${gl}`, X1 + 0.6 * CM, topo - 6);
    pg.drawText(seguro(g.pontos), { x: X1 + (C1 - f.b.widthOfTextAtSize(seguro(g.pontos), 10.5)) / 2, y: topo - 1.18 * CM - 22, size: 10.5, font: f.b, color: PRETO });
    let yy = topo;
    linhas.forEach((l, j) => {
      celula(l.instrumento, X1 + C1, C2, yy, alturas[j]);
      celula(l.peso, X1 + C1 + C2, C3, yy, alturas[j]);
      celula(l.criterio, X1 + C1 + C2 + C3, C4, yy, alturas[j]);
      yy -= alturas[j];
    });
    y -= total + 16;
  }
  if (e.plano.recuperacao.trim()) {
    const ls = quebrar(e.plano.recuperacao.trim(), f.n, 9, DIR - X1 - 30);
    const h = 30 + ls.length * 11.5 + 8;
    cabe(h);
    pg.drawRectangle({ x: X1, y: y - h, width: DIR - X1 - 0.2 * CM, height: h, borderColor: ESCURO, borderWidth: 0.8 });
    pg.drawText('Estratégias de recuperação de aprendizagem:', { x: X1 + 12, y: y - 16, size: 9, font: f.b, color: PRETO });
    ls.forEach((l, j) => pg.drawText(l, { x: X1 + 12, y: y - 32 - j * 11.5, size: 9, font: f.n, color: PRETO }));
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
