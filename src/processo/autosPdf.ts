// PDF dos autos: capa, partes, eventos e peças (as escritas no Vide e os PDFs anexados),
// com folhas numeradas e a marca de processo fictício em todas as páginas.
// Só o que a turma já vê entra (quem chama passa os dados do link). O pdf-lib é carregado na hora.
import { lerTexto, type Trecho } from './texto';
import type { DadosProcesso, Parte } from './tipos';

const MARCA = 'PROCESSO FICTÍCIO — USO DIDÁTICO';
const A4 = { w: 595.28, h: 841.89 };
const MARGEM = { x: 62, topo: 70, base: 64 };

/** As fontes padrão do PDF só têm o alfabeto latino (WinAnsi): o resto vira algo parecido. */
function seguro(s: string): string {
  return s
    .replace(/[‐‑‒–]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…€ŒœŠšŸŽžƒˆ˜†‡‰‹›™]/g, '?');
}

function dataBR(iso: string, comHora = true): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}${comHora && m[4] ? ` ${m[4]}` : ''}` : iso;
}

export type BuscarPdf = (arquivo: string) => Promise<Blob>;

export async function gerarAutosPdf(dados: DadosProcesso, buscar?: BuscarPdf): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Processo ${dados.capa.numero} (fictício)`);
  pdf.setCreator('Vide');
  const f = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
    italico: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    negritoItalico: await pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansNegrito: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const tinta = rgb(0.12, 0.16, 0.15);
  const cinza = rgb(0.4, 0.44, 0.42);
  const largura = A4.w - MARGEM.x * 2;

  let pagina = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGEM.topo;
  const novaPagina = () => {
    pagina = pdf.addPage([A4.w, A4.h]);
    y = A4.h - MARGEM.topo;
  };
  const espaco = (h: number) => {
    if (y - h < MARGEM.base) novaPagina();
  };

  type Fonte = typeof f.normal;
  const fonteDe = (t: Trecho, base: 'normal' | 'negrito' = 'normal'): Fonte => {
    const n = t.negrito || base === 'negrito';
    return n && t.italico ? f.negritoItalico : n ? f.negrito : t.italico ? f.italico : f.normal;
  };

  /** Escreve trechos com quebra de linha (negrito e itálico no meio do texto). */
  const paragrafo = (trechos: Trecho[], o: { tam?: number; recuo?: number; centro?: boolean; base?: 'normal' | 'negrito'; primeira?: number; antes?: string } = {}) => {
    const tam = o.tam ?? 12;
    const alt = tam * 1.4;
    const recuo = o.recuo ?? 0;
    const palavras: { t: string; fonte: Fonte }[] = [];
    if (o.antes) palavras.push({ t: o.antes, fonte: f.normal });
    for (const tr of trechos) for (const p of seguro(tr.t).split(/(\s+)/)) if (p) palavras.push({ t: p, fonte: fonteDe(tr, o.base) });
    const linhas: { t: string; fonte: Fonte }[][] = [];
    let atual: { t: string; fonte: Fonte }[] = [];
    let w = 0;
    let max = largura - recuo - (o.primeira ?? 0);
    for (const p of palavras) {
      const pw = p.fonte.widthOfTextAtSize(p.t, tam);
      if (/^\s+$/.test(p.t)) {
        if (atual.length) {
          atual.push({ t: ' ', fonte: p.fonte });
          w += p.fonte.widthOfTextAtSize(' ', tam);
        }
        continue;
      }
      if (w + pw > max && atual.length) {
        while (atual.length && atual[atual.length - 1].t === ' ') atual.pop();
        linhas.push(atual);
        atual = [];
        w = 0;
        max = largura - recuo;
      }
      atual.push(p);
      w += pw;
    }
    while (atual.length && atual[atual.length - 1].t === ' ') atual.pop();
    if (atual.length) linhas.push(atual);
    linhas.forEach((l, i) => {
      espaco(alt);
      const lw = l.reduce((s, p) => s + p.fonte.widthOfTextAtSize(p.t, tam), 0);
      let x = MARGEM.x + recuo + (i === 0 ? (o.primeira ?? 0) : 0);
      if (o.centro) x = MARGEM.x + (largura - lw) / 2;
      for (const p of l) {
        pagina.drawText(p.t, { x, y: y - tam, size: tam, font: p.fonte, color: tinta });
        x += p.fonte.widthOfTextAtSize(p.t, tam);
      }
      y -= alt;
    });
    y -= tam * 0.5;
  };
  const texto = (s: string, o: Parameters<typeof paragrafo>[1] = {}) => paragrafo([{ t: s }], o);
  const linhaH = (cor = rgb(0.75, 0.78, 0.76)) => {
    espaco(10);
    pagina.drawLine({ start: { x: MARGEM.x, y: y - 2 }, end: { x: A4.w - MARGEM.x, y: y - 2 }, thickness: 0.8, color: cor });
    y -= 12;
  };

  // ----- Capa -----
  texto('CONSULTA PROCESSUAL', { tam: 11, base: 'negrito' });
  texto(`Processo nº ${dados.capa.numero}`, { tam: 18, base: 'negrito' });
  linhaH();
  const campos: [string, string][] = [
    ['Classe da ação', dados.capa.classe],
    ['Assunto(s)', dados.capa.assuntos || '—'],
    ['Órgão julgador', dados.capa.juizo],
    ['Juiz(a)', dados.capa.juiz || '—'],
    ['Data de autuação', dataBR(dados.capa.autuadoEm, false)],
    ['Situação', dados.capa.situacao],
    ['Valor da causa', dados.capa.valorCausa || '—'],
  ];
  for (const [k, v] of campos) paragrafo([{ t: `${k}: `, negrito: true }, { t: v }]);
  linhaH();
  const polo = (titulo: string, ps: Parte[]) => {
    if (!ps.length) return;
    texto(titulo.toUpperCase(), { tam: 11, base: 'negrito' });
    for (const p of ps) {
      paragrafo([{ t: p.nome, negrito: true }, { t: p.qualificacao ? ` (${p.qualificacao})` : '' }]);
      for (const a of p.advogados) texto(`Advogado(a): ${a.nome}${a.oab ? ` · ${a.oab}` : ''}`, { recuo: 16, tam: 11 });
    }
  };
  polo('Autor', dados.partes.filter((p) => p.polo === 'ativo'));
  polo('Réu', dados.partes.filter((p) => p.polo === 'passivo'));
  polo('Outros', dados.partes.filter((p) => p.polo === 'outro'));
  linhaH();
  texto('EVENTOS', { tam: 11, base: 'negrito' });
  const eventos = [...dados.eventos].sort((a, b) => a.numero - b.numero);
  for (const e of eventos) {
    paragrafo([{ t: `${e.numero}  `, negrito: true }, { t: `${dataBR(e.data)}  ` }, { t: e.descricao, negrito: true }, { t: `  ${e.usuario}` }, { t: e.documentos.length ? `  [${e.documentos.map((d) => d.sigla).join(', ')}]` : '' }], { tam: 10.5 });
  }

  // ----- Peças -----
  const pendentes: { antes: number; arquivo: string }[] = [];
  for (const e of eventos) {
    for (const d of e.documentos) {
      novaPagina();
      texto(`Evento ${e.numero} · ${dataBR(e.data)} · ${e.descricao}`, { tam: 10, base: 'negrito' });
      texto(`${d.sigla} — ${d.titulo || e.descricao}`, { tam: 10 });
      linhaH();
      if (d.tipo === 'pdf' && d.arquivo) {
        texto(`O documento ${d.sigla} é um PDF anexado: segue nas próximas folhas.`, { tam: 11 });
        pendentes.push({ antes: pdf.getPageCount(), arquivo: d.arquivo });
        continue;
      }
      for (const b of lerTexto(d.texto)) {
        if (b.tipo === 'titulo') paragrafo(b.trechos, { tam: 14, centro: true, base: 'negrito' });
        else if (b.tipo === 'subtitulo') paragrafo(b.trechos, { tam: 12, base: 'negrito' });
        else if (b.tipo === 'citacao') paragrafo(b.trechos, { tam: 11, recuo: 40 });
        else if (b.tipo === 'lista') for (const it of b.itens) paragrafo(it, { recuo: 18, antes: '• ' });
        else paragrafo(b.trechos, { primeira: 36 });
      }
    }
  }

  // ----- PDFs anexados (na posição de cada peça) -----
  let deslocamento = 0;
  for (const p of pendentes) {
    let paginas: number[] = [];
    try {
      if (!buscar) throw new Error('sem acesso');
      const anexo = await PDFDocument.load(await (await buscar(p.arquivo)).arrayBuffer(), { ignoreEncryption: true });
      const copias = await pdf.copyPages(anexo, anexo.getPageIndices());
      paginas = copias.map((c, i) => {
        pdf.insertPage(p.antes + deslocamento + i, c);
        return i;
      });
    } catch {
      const aviso = pdf.insertPage(p.antes + deslocamento, [A4.w, A4.h]);
      aviso.drawText(seguro('Não foi possível juntar este PDF aqui. Abra a peça na página do processo.'), { x: MARGEM.x, y: A4.h - MARGEM.topo - 12, size: 12, font: f.normal, color: tinta });
      paginas = [0];
    }
    deslocamento += paginas.length;
  }

  // ----- Folhas numeradas e marca d'água -----
  const total = pdf.getPageCount();
  pdf.getPages().forEach((pg, i) => {
    const { width: w, height: h } = pg.getSize();
    const tam = Math.min(w, h) / 16;
    const mw = f.sansNegrito.widthOfTextAtSize(seguro(MARCA), tam);
    pg.drawText(seguro(MARCA), { x: w / 2 - (mw / 2) * Math.cos(Math.PI / 5), y: h / 2 - (mw / 2) * Math.sin(Math.PI / 5), size: tam, font: f.sansNegrito, color: rgb(0.85, 0.35, 0.28), opacity: 0.12, rotate: degrees(36) });
    pg.drawRectangle({ x: 0, y: h - 22, width: w, height: 22, color: rgb(0.98, 0.9, 0.87) });
    const faixa = seguro(`${MARCA} · Processo nº ${dados.capa.numero}`);
    pg.drawText(faixa, { x: 16, y: h - 15, size: 8.5, font: f.sansNegrito, color: rgb(0.48, 0.18, 0.12) });
    const fl = seguro(`fl. ${i + 1}`);
    pg.drawText(fl, { x: w - 16 - f.sansNegrito.widthOfTextAtSize(fl, 10), y: h - 16, size: 10, font: f.sansNegrito, color: rgb(0.48, 0.18, 0.12) });
    const rod = seguro(`Folha ${i + 1} de ${total} · gerado pelo Vide em ${new Date().toLocaleDateString('pt-BR')} · uso didático`);
    pg.drawText(rod, { x: w / 2 - f.sans.widthOfTextAtSize(rod, 8) / 2, y: 18, size: 8, font: f.sans, color: cinza });
  });
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function nomeArquivoAutos(numero: string): string {
  return `autos-${numero.replace(/[^\d.-]/g, '')}.pdf`;
}
