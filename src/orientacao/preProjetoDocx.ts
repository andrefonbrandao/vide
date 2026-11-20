// Word (.docx) do pré-projeto, com a mesma estrutura do PDF e as regras do manual:
// A4; margens 3/2 cm; Arial 12; entrelinha 1,5; recuo de 1,25 cm; citação longa com recuo
// de 4 cm em fonte 10 e espaço simples; notas de rodapé de verdade (do Word); títulos como
// "Título 1/2" (o sumário é um campo do Word, atualizado ao abrir); capa com o logotipo,
// folha de rosto; números de página no canto superior direito a partir da introdução
// (contando desde a folha de rosto); referências em página nova.
// Sem bibliotecas: o .docx (um ZIP de XMLs) é montado aqui.
import { lerTrechos, type Trecho } from './marcacao';
import { estruturaPreProjeto } from './preProjetoEstrutura';
import { naturezaPadrao } from './campos';
import { rotuloPrazo } from './prazos';
import type { ConfigPreProjeto, Etapa, TextoProjeto } from './tipos';
import type { ItemSumario } from './preProjetoPdf';

export interface EntradaDocx {
  nome: string;
  config: ConfigPreProjeto;
  texto: TextoProjeto;
  etapas: Etapa[];
  logo?: Uint8Array;
}

const TW = 567; // twips por centímetro
const LARGURA = 16 * TW; // 21 − 3 − 2 cm

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- ZIP (sem compressão) ----------
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABELA_CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(arquivos: { nome: string; dados: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const crc = crc32(a.dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true); // sem compressão
    local.setUint32(14, crc, true);
    local.setUint32(18, a.dados.length, true);
    local.setUint32(22, a.dados.length, true);
    local.setUint16(26, nome.length, true);
    partes.push(new Uint8Array(local.buffer), nome, a.dados);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, a.dados.length, true);
    cd.setUint32(24, a.dados.length, true);
    cd.setUint16(28, nome.length, true);
    cd.setUint32(42, pos, true);
    central.push(new Uint8Array(cd.buffer), nome);
    pos += 30 + nome.length + a.dados.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, pos, true);
  const todos = [...partes, ...central, new Uint8Array(fim.buffer)];
  const out = new Uint8Array(todos.reduce((s, x) => s + x.length, 0));
  let o = 0;
  for (const x of todos) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

// ---------- Documento ----------
export async function gerarPreProjetoDocx(e: EntradaDocx): Promise<Blob> {
  const t = e.texto;
  const c = e.config;
  const notas: string[] = []; // XML de cada nota (ids a partir de 2)

  const run = (texto: string, o: { b?: boolean; i?: boolean; sz?: number; caps?: boolean } = {}) => {
    const rpr = [o.b ? '<w:b/>' : '', o.i ? '<w:i/>' : '', o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''].join('');
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(o.caps ? texto.toUpperCase() : texto)}</w:t></w:r>`;
  };
  const runsDe = (trechos: Trecho[], base: { b?: boolean; sz?: number } = {}): string =>
    trechos
      .map((tr) => {
        if ('nota' in tr) {
          const id = notas.length + 2;
          notas.push(
            `<w:footnote w:id="${id}"><w:p><w:pPr><w:pStyle w:val="TextodeNotadeRodap"/></w:pPr><w:r><w:rPr><w:rStyle w:val="RefernciadeNotadeRodap"/></w:rPr><w:footnoteRef/></w:r>${run(' ')}${runsDe(lerTrechos(tr.nota))}</w:p></w:footnote>`,
          );
          return `<w:r><w:rPr><w:rStyle w:val="RefernciadeNotadeRodap"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
        }
        return run(tr.t, { b: tr.negrito || base.b, i: tr.italico, sz: base.sz });
      })
      .join('');
  // Página nova: o primeiro parágrafo da página seguinte leva "quebra de página antes". (Um
  // parágrafo só com a quebra, no fim de uma página cheia como a capa, escorregava para a
  // página seguinte e o Word mostrava uma página em branco.)
  let paginaNova = false;
  const par = (estilo: string, conteudo: string, ppr = '') => {
    const q = paginaNova ? '<w:pageBreakBefore/>' : '';
    paginaNova = false;
    return `<w:p><w:pPr><w:pStyle w:val="${estilo}"/>${q}${ppr}</w:pPr>${conteudo}</w:p>`;
  };
  const quebra = () => {
    paginaNova = true;
  };
  const antes = (tw: number) => `<w:spacing w:before="${Math.round(tw)}"/>`;
  // Altura útil da página (29,7 − 3 − 2 cm), com folga, e linhas estimadas de um texto centrado.
  const UTIL = Math.round(24.7 * TW) - 350;
  const L14 = 322; // uma linha em Arial 14, espaço simples (twips)
  const L12 = 276;
  const L11 = 253;
  const linhas = (s: string, porLinha: number) => Math.max(1, Math.ceil(s.trim().length / porLinha));
  const nTit = linhas(t.titulo || 'Título do trabalho', 44);
  const nSub = t.subtitulo.trim() ? linhas(t.subtitulo, 56) : 0;
  /** Espaço até "cidade/ano" para que caibam no pé da página, sem passar dela. */
  const folga = (ocupado: number, maximo: number) => Math.max(300, Math.min(maximo, UTIL - ocupado));
  const corpo: string[] = [];

  // ----- Capa -----
  const logo = c.instituicao === 'Uniftec' && e.logo ? e.logo : undefined;
  const cx = Math.round(8.77 * 360000);
  const cy = Math.round(cx * 314 / 800);
  if (logo) {
    corpo.push(
      par(
        'Centro',
        `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logotipo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,
      ),
    );
  } else corpo.push(par('Centro', run(c.instituicao === 'Ftec' ? 'FTEC FACULDADES' : 'CENTRO UNIVERSITÁRIO UNIFTEC', { b: true, sz: 28 })));
  corpo.push(par('Centro', run(`CURSO SUPERIOR DE ${c.curso || 'XXXX'}`, { b: true, sz: 28, caps: true }), antes(240)));
  corpo.push(par('Centro', run(e.nome, { b: true, sz: 28, caps: true }), antes(2600)));
  corpo.push(par('Centro', run(t.titulo || 'Título do trabalho', { b: true, sz: 28, caps: true }), antes(2300)));
  if (t.subtitulo.trim()) corpo.push(par('Centro', run(t.subtitulo.trim(), { b: true, sz: 28 })));
  const capaOcupada = (logo ? Math.ceil(cy / 635) : L14) + 240 + L14 + 2600 + L14 + 2300 + L14 * (nTit + nSub) + L14 * 2;
  corpo.push(par('Centro', run(c.cidade || 'Caxias do Sul', { b: true, sz: 28 }), antes(folga(capaOcupada, t.subtitulo.trim() ? 4500 : 4900))));
  corpo.push(par('Centro', run(c.ano, { b: true, sz: 28 })));
  quebra();

  // ----- Folha de rosto (e de aprovação) -----
  const natureza = c.natureza.trim() || naturezaPadrao(c);
  /** Altura do cabeçalho da folha de rosto (nome, título, natureza), sem o espaço do alto. */
  const alturaCab = L12 + L14 * (nTit + nSub) + 1300 + L12 * linhas(natureza, 32);
  const cabRosto = (topo: number) => {
    corpo.push(par('Centro', run(e.nome, { b: true, caps: true })));
    corpo.push(par('Centro', run(t.titulo || 'Título do trabalho', { b: true, sz: 28, caps: true }), antes(topo)));
    if (t.subtitulo.trim()) corpo.push(par('Centro', run(t.subtitulo.trim(), { b: true, sz: 28 })));
    corpo.push(par('Natureza', run(natureza, { b: true }), antes(1300)));
  };
  const orientadores = (c.orientador.trim() ? 1500 + L12 : 0) + (c.coorientador.trim() ? L12 : 0);
  // Se o texto for longo, o espaço do alto encolhe antes do espaço até a cidade.
  const topoRosto = Math.max(1200, Math.min(3200, UTIL - alturaCab - orientadores - L12 * 2 - 2500));
  cabRosto(topoRosto);
  if (c.orientador.trim()) corpo.push(par('Centro', run(`Orientador(a): ${c.orientador.trim()}`, { b: true }), antes(1500)));
  if (c.coorientador.trim()) corpo.push(par('Centro', run(`Coorientador(a): ${c.coorientador.trim()}`, { b: true })));
  corpo.push(par('Centro', run(c.cidade || 'Caxias do Sul', { b: true }), antes(folga(topoRosto + alturaCab + orientadores + L12 * 2, c.coorientador.trim() ? 4100 : 4500))));
  corpo.push(par('Centro', run(c.ano, { b: true })));
  quebra();
  if (c.aprovacao) {
    const banca = 700 + L12 + 500 + L12 + 3 * (600 + L12 + L11 * 2) + L12 * 2;
    const topoAprov = Math.max(800, Math.min(3200, UTIL - alturaCab - banca - 600));
    cabRosto(topoAprov);
    corpo.push(par('Centro', run('Aprovado em ____/____/______'), antes(700)));
    corpo.push(par('Centro', run('BANCA EXAMINADORA', { b: true }), antes(500)));
    for (const quem of [`Professor(a) Orientador(a): ${c.orientador.trim() || '_______________'}`, 'Professor(a) Avaliador(a): _______________', 'Professor(a) Avaliador(a): _______________']) {
      corpo.push(par('Centro', run('_________________________________________'), antes(600)));
      corpo.push(par('Centro', run(quem, { sz: 22 })));
    }
    corpo.push(par('Centro', run(c.cidade || 'Caxias do Sul', { b: true }), antes(folga(topoAprov + alturaCab + banca, 1500))));
    corpo.push(par('Centro', run(c.ano, { b: true })));
    quebra();
  }
  if (c.resumo) {
    corpo.push(par('Centro', run('RESUMO', { b: true })));
    for (const l of t.resumo.split('\n').filter((x) => x.trim())) corpo.push(par('Simples', runsDe(lerTrechos(l.trim())), antes(240)));
    if (t.palavrasChave.trim()) corpo.push(par('Simples', run('Palavras-chave: ', { b: true }) + runsDe(lerTrechos(t.palavrasChave.trim())), antes(240)));
    quebra();
  }

  // ----- Sumário (campo do Word; atualiza ao abrir) -----
  const blocos = estruturaPreProjeto(t, e.etapas);
  corpo.push(par('Centro', run('SUMÁRIO', { b: true })));
  corpo.push(
    `<w:p><w:pPr><w:pStyle w:val="Sumrio1"/>${antes(360)}</w:pPr><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r></w:p>`,
  );
  // As páginas vêm da mesma montagem do PDF, com as alturas de linha do Word (o Word confirma ao
  // atualizar o sumário).
  let paginas: ItemSumario[] = [];
  try {
    const { gerarPreProjetoPdf } = await import('./preProjetoPdf');
    await gerarPreProjetoPdf({ nome: e.nome, config: c, texto: t, etapas: e.etapas, logo: e.logo }, (x) => (paginas = x), true);
  } catch {
    paginas = [];
  }
  let k = 0;
  const pagina = () => {
    const x = paginas[k++];
    return x ? `<w:r><w:tab/></w:r>${run(String(x.pagina))}` : '';
  };
  for (const b of blocos) {
    if (b.tipo === 'titulo') corpo.push(par(b.nivel === 1 ? 'Sumrio1' : 'Sumrio2', run(`${b.rotulo} ${b.nivel === 1 ? b.texto.toUpperCase() : b.texto}`, { b: b.nivel === 1 }) + pagina()));
    else if (b.tipo === 'referencias') corpo.push(par('Sumrio1', run('REFERÊNCIAS', { b: true }) + pagina()));
  }
  corpo.push('<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>');
  // Fim da parte sem números de página.
  const margens = `<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${3 * TW}" w:right="${2 * TW}" w:bottom="${2 * TW}" w:left="${3 * TW}" w:header="${2 * TW}" w:footer="${TW}" w:gutter="0"/>`;
  corpo.push(`<w:p><w:pPr><w:sectPr>${margens}</w:sectPr></w:pPr></w:p>`);

  // ----- Parte textual -----
  for (const b of blocos) {
    if (b.tipo === 'titulo') corpo.push(par(b.nivel === 1 ? 'Ttulo1' : 'Ttulo2', run(`${b.rotulo} ${b.nivel === 1 ? b.texto.toUpperCase() : b.texto}`)));
    else if (b.tipo === 'par') corpo.push(par(b.p.tipo === 'citacao' ? 'Citao' : 'Normal', runsDe(b.p.trechos)));
    else if (b.tipo === 'cronograma') {
      corpo.push(par('Legenda', run('Quadro 1 – Cronograma das atividades', { b: true })));
      const borda = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
      const w1 = Math.round(LARGURA * 0.72);
      const w2 = LARGURA - w1;
      const celula = (w: number, conteudo: string, centro = false) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${par('Quadro', conteudo, centro ? '<w:jc w:val="center"/>' : '')}</w:tc>`;
      const linhas = [
        `<w:tr>${celula(w1, run('Etapa', { b: true }))}${celula(w2, run('Prazo', { b: true }), true)}</w:tr>`,
        ...b.etapas.map((x) => `<w:tr>${celula(w1, run(x.nome))}${celula(w2, run(rotuloPrazo(x.prazo)), true)}</w:tr>`),
      ];
      corpo.push(`<w:tbl><w:tblPr><w:tblW w:w="${LARGURA}" w:type="dxa"/><w:tblBorders>${borda}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${w1}"/><w:gridCol w:w="${w2}"/></w:tblGrid>${linhas.join('')}</w:tbl>`);
      corpo.push(par('Legenda', run('Fonte: o autor.'), '<w:spacing w:before="60" w:after="240"/>'));
    } else {
      // Referências: página nova, título sem número e centralizado.
      corpo.push(par('Ttulo1', run('REFERÊNCIAS'), '<w:pageBreakBefore/><w:jc w:val="center"/>'));
      for (const r of b.lista) corpo.push(par('Referncia', runsDe(lerTrechos(r))));
    }
  }
  // Seção numerada: contando desde a folha de rosto (a capa não conta).
  const inicio = 2 + (c.aprovacao ? 1 : 0) + (c.resumo ? 1 : 0) + 1;
  corpo.push(`<w:sectPr><w:headerReference w:type="default" r:id="rIdCab"/>${margens}<w:pgNumType w:start="${inicio}"/></w:sectPr>`);

  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${corpo.join('')}</w:body></w:document>`;

  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const estilo = (id: string, nome: string, ppr: string, rpr = '', extra = '') =>
    `<w:style w:type="paragraph"${id === 'Normal' ? ' w:default="1"' : ''} w:customStyle="${/^(Normal|Ttulo[12]|Sumrio[12]|TextodeNotadeRodap|Legenda|Cabealho)$/.test(id) ? 0 : 1}" w:styleId="${id}"><w:name w:val="${nome}"/>${id === 'Normal' ? '' : '<w:basedOn w:val="Normal"/>'}${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
  const semRecuo = '<w:ind w:firstLine="0"/>';
  const simples = '<w:spacing w:line="240" w:lineRule="auto"/>';
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR" w:eastAsia="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
${estilo('Normal', 'Normal', `<w:spacing w:line="360" w:lineRule="auto"/><w:ind w:firstLine="${Math.round(1.25 * TW)}"/><w:jc w:val="both"/>`)}
${estilo('Ttulo1', 'heading 1', `<w:keepNext/><w:spacing w:before="360" w:after="240" w:line="240" w:lineRule="auto"/>${semRecuo}<w:jc w:val="left"/><w:outlineLvl w:val="0"/>`, '<w:b/><w:bCs/>', '<w:next w:val="Normal"/>')}
${estilo('Ttulo2', 'heading 2', `<w:keepNext/><w:spacing w:before="360" w:after="240" w:line="240" w:lineRule="auto"/>${semRecuo}<w:jc w:val="left"/><w:outlineLvl w:val="1"/>`, '<w:b/><w:bCs/>', '<w:next w:val="Normal"/>')}
${estilo('Citao', 'Citação longa', `<w:spacing w:before="120" w:after="240" w:line="240" w:lineRule="auto"/><w:ind w:left="${4 * TW}" w:firstLine="0"/><w:jc w:val="both"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>')}
${estilo('Referncia', 'Referência', `<w:spacing w:after="240" w:line="240" w:lineRule="auto"/>${semRecuo}<w:jc w:val="left"/>`)}
${estilo('Centro', 'Centralizado', `${simples}${semRecuo}<w:jc w:val="center"/>`)}
${estilo('Simples', 'Texto simples', `${simples}${semRecuo}<w:jc w:val="both"/>`)}
${estilo('Natureza', 'Natureza do trabalho', `${simples}<w:ind w:left="${Math.round(7.5 * TW)}" w:firstLine="0"/><w:jc w:val="both"/>`)}
${estilo('Legenda', 'caption', `<w:spacing w:before="240" w:after="60" w:line="240" w:lineRule="auto"/>${semRecuo}<w:jc w:val="center"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>')}
${estilo('Quadro', 'Texto do quadro', `${simples}${semRecuo}<w:jc w:val="left"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>')}
${estilo('Sumrio1', 'toc 1', `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${LARGURA}"/></w:tabs><w:spacing w:line="360" w:lineRule="auto"/>${semRecuo}<w:jc w:val="left"/>`)}
${estilo('Sumrio2', 'toc 2', `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${LARGURA}"/></w:tabs><w:spacing w:line="360" w:lineRule="auto"/>${semRecuo}<w:jc w:val="left"/>`)}
${estilo('TextodeNotadeRodap', 'footnote text', `${simples}${semRecuo}<w:jc w:val="both"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>')}
${estilo('Cabealho', 'header', `${simples}${semRecuo}<w:jc w:val="right"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>')}
<w:style w:type="character" w:styleId="RefernciadeNotadeRodap"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
</w:styles>`;

  const notasXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes ${W}><w:footnote w:type="separator" w:id="0"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="1"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${notas.join('')}</w:footnotes>`;
  const cabecalho = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${W}><w:p><w:pPr><w:pStyle w:val="Cabealho"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${inicio}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>`;
  const ajustes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${W}><w:updateFields w:val="true"/><w:defaultTabStop w:val="709"/><w:footnotePr><w:footnote w:id="0"/><w:footnote w:id="1"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdAjustes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdNotas" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/><Relationship Id="rIdCab" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>${logo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : ''}</Relationships>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(t.titulo || 'Pré-projeto')}</dc:title><dc:creator>${esc(e.nome)}</dc:creator></cp:coreProperties>`;
  const enc = new TextEncoder();
  const arquivos = [
    { nome: '[Content_Types].xml', dados: enc.encode(tipos) },
    { nome: '_rels/.rels', dados: enc.encode(rels) },
    { nome: 'docProps/core.xml', dados: enc.encode(core) },
    { nome: 'word/document.xml', dados: enc.encode(documento) },
    { nome: 'word/styles.xml', dados: enc.encode(estilos) },
    { nome: 'word/settings.xml', dados: enc.encode(ajustes) },
    { nome: 'word/footnotes.xml', dados: enc.encode(notasXml) },
    { nome: 'word/header1.xml', dados: enc.encode(cabecalho) },
    { nome: 'word/_rels/document.xml.rels', dados: enc.encode(relsDoc) },
    ...(logo ? [{ nome: 'word/media/logo.png', dados: logo }] : []),
  ];
  return new Blob([zip(arquivos) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function nomeArquivoPreProjetoDocx(nome: string): string {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, '-').slice(0, 60);
  return `Pre-projeto - ${limpo}.docx`;
}
