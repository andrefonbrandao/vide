// Word (.docx) do plano de aula no visual da instituição: o cabeçalho original (círculos, logotipos e
// "PLANO DE AULA") no alto de cada página, a etiqueta azul "AULA n" com a data e o quadro do tema, os
// quadros dos Graus, as estratégias de avaliação e a recuperação. Montado aqui (sem bibliotecas).
import { zip } from '../orientacao/preProjetoDocx';
import { dataBR } from './planoAula';
import type { PlanoAula } from './tipos';

export interface EntradaPlanoAula {
  unidade: string;
  plano: PlanoAula;
  /** Data de cada aula ("AAAA-MM-DD"), na ordem. */
  datas: string[];
  periodo: { inicio: string; fim: string };
  /** O cabeçalho da instituição (PNG, 21 cm de largura). */
  cabecalho?: Uint8Array;
  /** As etiquetas azuis já com o texto ("AULA 1", "GRAU A"…), em PNG. Sem elas, a etiqueta é um quadro azul. */
  etiquetas?: Map<string, Uint8Array>;
}

const TW = 567;
const LARG = 11906 - 2 * 708;
const AZUL = '2E5395';
const ESCURO = '1F3863';
const CLARO = '6FA3DA';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

function run(t: string, o: { b?: boolean; i?: boolean; sz?: number; cor?: string; caps?: boolean } = {}): string {
  const rpr = `${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.cor ? `<w:color w:val="${o.cor}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}`;
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(o.caps ? t.toUpperCase() : t)}</w:t></w:r>`;
}
const par = (conteudo: string, ppr = '') => `<w:p><w:pPr>${ppr}</w:pPr>${conteudo}</w:p>`;
const esp = (antes = 0, depois = 0) => `<w:spacing w:before="${antes}" w:after="${depois}" w:line="252" w:lineRule="auto"/>`;
const borda = (cor = AZUL, sz = 8) => ['top', 'left', 'bottom', 'right'].map((l) => `<w:${l} w:val="single" w:sz="${sz}" w:space="0" w:color="${cor}"/>`).join('');
const semBorda = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((l) => `<w:${l} w:val="nil"/>`).join('');

export async function gerarPlanoAulaDocx(e: EntradaPlanoAula): Promise<Blob> {
  const midias: { nome: string; rid: string; dados: Uint8Array; tipo: string }[] = [];
  let docPr = 1;
  const imagem = (dados: Uint8Array, cxCm: number, cyCm: number, nome: string) => {
    const rid = `rIdImg${midias.length + 1}`;
    const ext = dados[0] === 0xff && dados[1] === 0xd8 ? 'jpeg' : 'png';
    midias.push({ nome: `${nome.replace(/\s+/g, '-')}.${ext}`, rid, dados, tipo: ext });
    const cx = Math.round(cxCm * 360000);
    const cy = Math.round(cyCm * 360000);
    const id = ++docPr;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${nome}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${nome}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  /** A etiqueta azul ("AULA 3"): a imagem com o texto, ou um quadro azul com o texto branco. */
  const etiqueta = (texto: string) => {
    const png = e.etiquetas?.get(texto);
    if (png) return par(imagem(png, 2.75, 1.18, texto), esp(0, 40));
    return par(run(texto, { b: true, sz: 30, cor: 'FFFFFF' }), `${esp(0, 40)}<w:shd w:val="clear" w:color="auto" w:fill="5B9BD5"/><w:ind w:right="${Math.round(0.5 * TW)}"/>`);
  };
  const corpo: string[] = [];

  // ----- Cabeçalho com os dados da unidade curricular -----
  const rotulo = (t: string) => par(run(t, { sz: 20, cor: AZUL }), esp(0, 0));
  const valor = (t: string) => par(run(t, { sz: 20, caps: true }), esp(0, 60));
  const celInfo = (w: number, xs: string) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${xs}</w:tc>`;
  corpo.push(
    `<w:tbl><w:tblPr><w:tblW w:w="${LARG}" w:type="dxa"/><w:tblInd w:w="${Math.round(0.9 * TW)}" w:type="dxa"/><w:tblBorders>${semBorda}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${Math.round(LARG * 0.5)}"/><w:gridCol w:w="${Math.round(LARG * 0.5) - Math.round(0.9 * TW)}"/></w:tblGrid><w:tr>${celInfo(Math.round(LARG * 0.5), rotulo('UNIDADE CURRICULAR:') + valor(e.unidade) + rotulo('PROFESSOR:') + valor(e.plano.professor))}${celInfo(Math.round(LARG * 0.5) - Math.round(0.9 * TW), rotulo('CARGA HORÁRIA:') + valor(e.plano.cargaHoraria) + rotulo('PERÍODO DE REALIZAÇÃO:') + valor(`${dataBR(e.periodo.inicio)} A ${dataBR(e.periodo.fim)}`))}</w:tr></w:tbl>`,
    par('', esp(0, 200)),
  );

  // ----- As aulas -----
  const COL1 = Math.round(3.4 * TW);
  const COL2 = LARG - COL1 - Math.round(0.4 * TW);
  e.plano.aulas.forEach((a, k) => {
    const n = `AULA ${k + 1}`;
    const quadro = [
      a.destaque.trim() ? par(run(a.destaque.trim(), { b: true, sz: 20 }), esp(60, 60)) : '',
      par(run(a.tema.trim(), { sz: 20 }), esp(a.destaque.trim() ? 0 : 80, 60)),
    ].join('');
    corpo.push(
      `<w:tbl><w:tblPr><w:tblW w:w="${COL1 + COL2}" w:type="dxa"/><w:tblInd w:w="${Math.round(0.4 * TW)}" w:type="dxa"/><w:tblBorders>${semBorda}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${COL1}"/><w:gridCol w:w="${COL2}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${Math.round(1.95 * TW)}" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${COL1}" w:type="dxa"/></w:tcPr>${etiqueta(n)}${par(run(dataBR(e.datas[k] ?? '') || '__/__/____', { b: true, sz: 24, cor: ESCURO }), `${esp(0, 0)}<w:ind w:left="200"/>`)}</w:tc><w:tc><w:tcPr><w:tcW w:w="${COL2}" w:type="dxa"/><w:tcBorders>${borda()}</w:tcBorders></w:tcPr>${quadro}</w:tc></w:tr></w:tbl>`,
      par('', esp(0, 120)),
    );
    // Depois da última aula de um Grau, o quadro do Grau.
    if (a.grau) {
      const g = e.plano.graus[a.grau];
      const linha = (rot: string, v: string, it = false) => par(run(`${rot}: `, { sz: 18, cor: ESCURO }) + run(v, { sz: 18, cor: ESCURO, i: it }), `${esp(0, 80)}<w:ind w:left="300"/>`);
      corpo.push(
        `<w:tbl><w:tblPr><w:tblW w:w="${COL1 + COL2}" w:type="dxa"/><w:tblInd w:w="${Math.round(0.4 * TW)}" w:type="dxa"/><w:tblBorders>${semBorda}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${COL1 + COL2}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${COL1 + COL2}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${CLARO}"/><w:tcMar><w:top w:w="140" w:type="dxa"/><w:bottom w:w="140" w:type="dxa"/></w:tcMar></w:tcPr>${par(run(`GRAU ${a.grau}`, { b: true, sz: 22, cor: ESCURO }), `${esp(0, 120)}<w:ind w:left="300"/>`)}${linha(a.grau === 'C' ? 'Data de aplicação da avaliação' : 'Datas de aplicação da avaliação', g.aplicacao, true)}${linha('Data para a postagem das notas no portal acadêmico', g.postagem)}</w:tc></w:tr></w:tbl>`,
        par('', esp(0, 200)),
      );
    }
  });

  // ----- Estratégias de avaliação -----
  corpo.push(par(run('Estratégias de Avaliação', { b: true, sz: 22, cor: 'FFFFFF' }), `<w:keepNext/>${esp(200, 160)}<w:shd w:val="clear" w:color="auto" w:fill="${AZUL}"/>`));
  const fino = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((l) => `<w:${l} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  const C1 = Math.round(4.2 * TW);
  const C2 = Math.round(3.6 * TW);
  const C3 = Math.round(2 * TW);
  const C4 = LARG - C1 - C2 - C3 - Math.round(0.4 * TW);
  for (const gl of ['A', 'B', 'C'] as const) {
    const g = e.plano.graus[gl];
    const linhas = g.linhas.length ? g.linhas : [{ instrumento: '', peso: '', criterio: '' }];
    const cel = (w: number, x: string, extra = '') => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${extra}</w:tcPr>${x}</w:tc>`;
    const txt = (t: string, b = false) => par(run(t, { b: true, sz: 17 }), `${esp(20, 20)}<w:jc w:val="center"/>${b ? '' : ''}`);
    const rows = [
      `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cel(C1, etiqueta(`GRAU ${gl}`) + par(run(g.pontos, { b: true, sz: 22 }), `${esp(60, 0)}<w:jc w:val="center"/>`), '<w:vMerge w:val="restart"/><w:vAlign w:val="center"/>')}${cel(C2, txt('Instrumento avaliativo'))}${cel(C3, txt('Peso'))}${cel(C4, txt('Critérios'))}</w:tr>`,
      ...linhas.map((l) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cel(C1, par(''), '<w:vMerge/>')}${cel(C2, txt(l.instrumento))}${cel(C3, txt(l.peso))}${cel(C4, txt(l.criterio))}</w:tr>`),
    ];
    corpo.push(
      `<w:tbl><w:tblPr><w:tblW w:w="${C1 + C2 + C3 + C4}" w:type="dxa"/><w:tblInd w:w="${Math.round(0.4 * TW)}" w:type="dxa"/><w:tblBorders>${fino}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${C1}"/><w:gridCol w:w="${C2}"/><w:gridCol w:w="${C3}"/><w:gridCol w:w="${C4}"/></w:tblGrid>${rows.join('')}</w:tbl>`,
      par('', esp(0, 220)),
    );
  }
  if (e.plano.recuperacao.trim())
    corpo.push(
      `<w:tbl><w:tblPr><w:tblW w:w="${C1 + C2 + C3 + C4}" w:type="dxa"/><w:tblInd w:w="${Math.round(0.4 * TW)}" w:type="dxa"/><w:tblBorders>${borda(ESCURO, 6)}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${C1 + C2 + C3 + C4}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${C1 + C2 + C3 + C4}" w:type="dxa"/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="160" w:type="dxa"/><w:left w:w="240" w:type="dxa"/></w:tcMar></w:tcPr>${par(run('Estratégias de recuperação de aprendizagem:', { b: true, sz: 19 }), esp(0, 120))}${par(run(e.plano.recuperacao.trim(), { sz: 19 }), esp(0, 0))}</w:tc></w:tr></w:tbl>`,
    );

  // Cabeçalho: a imagem da instituição atrás do texto, no alto de cada página.
  const cab = e.cabecalho
    ? (() => {
        const cx = Math.round(21 * 360000);
        const cy = Math.round(5.65 * 360000);
        return `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="Cabeçalho"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="cabecalho.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdCabImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
      })()
    : `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run('PLANO DE AULA', { b: true, sz: 28, cor: ESCURO })}</w:p>`;
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdCab"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${Math.round(6.0 * TW)}" w:right="708" w:bottom="560" w:left="708" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${corpo.join('')}${sect}</w:body></w:document>`;
  const cabecalhoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${W}>${cab}</w:hdr>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdCab" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>${midias.map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.nome}"/>`).join('')}</Relationships>`;
  const relsCab = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${e.cabecalho ? '<Relationship Id="rIdCabImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cabecalho.png"/>' : ''}</Relationships>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const enc = new TextEncoder();
  const arquivos = [
    { nome: '[Content_Types].xml', dados: enc.encode(tipos) },
    { nome: '_rels/.rels', dados: enc.encode(rels) },
    { nome: 'word/document.xml', dados: enc.encode(documento) },
    { nome: 'word/styles.xml', dados: enc.encode(estilos) },
    { nome: 'word/header1.xml', dados: enc.encode(cabecalhoXml) },
    { nome: 'word/_rels/document.xml.rels', dados: enc.encode(relsDoc) },
    { nome: 'word/_rels/header1.xml.rels', dados: enc.encode(relsCab) },
    ...(e.cabecalho ? [{ nome: 'word/media/cabecalho.png', dados: e.cabecalho }] : []),
    ...midias.map((m) => ({ nome: `word/media/${m.nome}`, dados: m.dados })),
  ];
  return new Blob([zip(arquivos) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function nomeArquivoPlanoAula(unidade: string, periodo: string, ext: 'docx' | 'pdf'): string {
  const limpo = `${unidade} - ${periodo}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, '-').slice(0, 80);
  return `Plano de Aula ${limpo}.${ext}`;
}
