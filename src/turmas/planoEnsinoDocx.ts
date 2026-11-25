// Word (.docx) do plano de ensino no visual da instituição: o cabeçalho com o logotipo e "PLANO DE
// ENSINO" na primeira página, as faixas azuis de cada parte, o quadro dos Graus, as regras de aprovação,
// o quadro da recuperação, a bibliografia, o local e a data e as assinaturas. Montado aqui (sem bibliotecas).
import { zip } from '../orientacao/preProjetoDocx';
import { localEData, pedacosNegrito, REGRAS_APROVACAO } from './planoEnsino';
import type { PlanoEnsino } from './tipos';

export interface EntradaPlanoEnsino {
  unidade: string;
  plano: PlanoEnsino;
  horario: string;
  periodo: string;
  /** "AAAA-MM-DD". */
  data: string;
  /** O cabeçalho da instituição (PNG, 21 cm de largura). */
  cabecalho?: Uint8Array;
}

const ESC = '24387A';
const CINZA = 'ACB8C9';
const LARG = 11906 - 567 - 567;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

function run(t: string, o: { b?: boolean; sz?: number; cor?: string; fundo?: string } = {}): string {
  const rpr = `${o.b ? '<w:b/><w:bCs/>' : ''}${o.cor ? `<w:color w:val="${o.cor}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${o.fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fundo}"/>` : ''}`;
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
}
const comNegrito = (t: string, o: { sz?: number } = {}) => pedacosNegrito(t).map((p) => run(p.t, { ...o, b: p.b })).join('');
const par = (conteudo: string, ppr = '') => `<w:p><w:pPr>${ppr}</w:pPr>${conteudo}</w:p>`;
const esp = (antes = 0, depois = 0, linha = 264) => `<w:spacing w:before="${antes}" w:after="${depois}" w:line="${linha}" w:lineRule="auto"/>`;
const just = '<w:jc w:val="both"/>';
const centro = '<w:jc w:val="center"/>';
const linhas = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);

/** Faixa azul com o nome da parte ("Competências"). */
const faixa = (t: string, antes = 200) => par(run(t, { b: true, cor: 'FFFFFF' }), `${esp(antes, 60, 240)}<w:shd w:val="clear" w:color="auto" w:fill="${ESC}"/><w:ind w:left="57" w:right="0"/>`);
/** Faixa clara, centralizada ("Ações concretas…"). */
const faixaClara = (t: string) => par(run(t, { b: true }), `${esp(280, 120, 240)}<w:shd w:val="clear" w:color="auto" w:fill="${CINZA}"/>${centro}`);
/** Item com marcador (•) e recuo. */
const marcador = (t: string) => par(`${run('•')}<w:r><w:tab/></w:r>${run(t)}`, `${esp(0, 60)}<w:tabs><w:tab w:val="left" w:pos="567"/></w:tabs><w:ind w:left="567" w:hanging="283"/>`);
/** Linha numerada ("1.1" + texto) com recuo pendente. */
const numerado = (num: string, t: string, b = false) =>
  par(`${run(num, { b })}<w:r><w:tab/></w:r>${run(t, { b })}`, `${esp(0, 20)}<w:tabs><w:tab w:val="left" w:pos="${b ? 851 : 851}"/></w:tabs><w:ind w:left="851" w:hanging="567"/>`);

const borda = (cor = '000000', sz = 4) => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((l) => `<w:${l} w:val="single" w:sz="${sz}" w:space="0" w:color="${cor}"/>`).join('');
const semBorda = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((l) => `<w:${l} w:val="nil"/>`).join('');
const cel = (w: number, x: string, extra = '') => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${extra}</w:tcPr>${x || par('')}</w:tc>`;
const tabela = (cols: number[], bordas: string, linhasXml: string[], ind = 0) =>
  `<w:tbl><w:tblPr><w:tblW w:w="${cols.reduce((s, c) => s + c, 0)}" w:type="dxa"/><w:tblInd w:w="${ind}" w:type="dxa"/><w:tblBorders>${bordas}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map((c) => `<w:gridCol w:w="${c}"/>`).join('')}</w:tblGrid>${linhasXml.join('')}</w:tbl>`;
const fundo = (cor: string) => `<w:shd w:val="clear" w:color="auto" w:fill="${cor}"/>`;

export async function gerarPlanoEnsinoDocx(e: EntradaPlanoEnsino): Promise<Blob> {
  const p = e.plano;
  const corpo: string[] = [];

  // Cabeçalho da instituição: imagem atrás do texto, no alto da primeira página; o texto começa abaixo dela.
  const cxCab = Math.round(21 * 360000);
  const cyCab = Math.round(5.7 * 360000);
  const imagemCab = e.cabecalho
    ? `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cxCab}" cy="${cyCab}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="Cabeçalho"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="cabecalho.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdCabImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxCab}" cy="${cyCab}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
    : '';
  corpo.push(
    e.cabecalho
      ? par(imagemCab, `<w:spacing w:before="${Math.round(4.3 * 567)}" w:after="0" w:line="240" w:lineRule="auto"/>`)
      : par(run('PLANO DE ENSINO', { b: true, sz: 28 }), `${esp(0, 240)}<w:jc w:val="right"/>`),
  );

  // ----- Unidade curricular -----
  corpo.push(faixa('Unidade Curricular', 0));
  const c1 = 2100;
  const c2 = 3900;
  const c3 = LARG - c1 - c2;
  const linhaInfo = (a: string, b: string, c: string, bNegrito = false) =>
    `<w:tr>${cel(c1, par(run(a), esp(60, 60)))}${cel(c2, par(run(b, { b: bNegrito }), esp(60, 60)))}${cel(c3, par(c, esp(60, 60)))}</w:tr>`;
  corpo.push(
    tabela(
      [c1, c2, c3],
      semBorda,
      [
        linhaInfo('Unidade Curricular:', e.unidade, run(`Horário: ${e.horario}`), true),
        linhaInfo('Professor(a):', p.professor, `${run('Ano/Semestre: ')}${run(e.periodo, { b: true })}`),
        linhaInfo('Carga Horária (h):', p.cargaHoraria, ''),
      ],
      57,
    ),
  );

  // ----- Ementa, competências, habilidades -----
  corpo.push(faixa('Ementa', 120));
  for (const l of linhas(p.ementa)) corpo.push(par(run(l), `${esp(0, 80)}${just}`));
  corpo.push(faixa('Competências'));
  for (const l of p.competencias.filter((x) => x.trim())) corpo.push(marcador(l.trim()));
  corpo.push(faixa('Habilidades'));
  for (const l of p.habilidades.filter((x) => x.trim())) corpo.push(marcador(l.trim()));

  // ----- Conteúdo programático -----
  corpo.push(faixa('Conteúdo Programático'));
  p.conteudo
    .filter((u) => u.titulo.trim() || u.itens.some((i) => i.trim()))
    .forEach((u, k) => {
      corpo.push(numerado(`${k + 1}.`, u.titulo.trim(), true));
      u.itens.filter((i) => i.trim()).forEach((i, j) => corpo.push(numerado(`${k + 1}.${j + 1}`, i.trim())));
    });

  // ----- Estratégias de avaliação -----
  corpo.push(faixa('Estratégias de Avaliação do Processo Ensino-Aprendizagem', 360));
  for (const l of linhas(p.estrategias)) corpo.push(par(run(l), `${esp(0, 80)}${just}`));
  const g1 = 1100;
  const g2 = 5300;
  const g3 = LARG - 120 - g1 - g2;
  const pequeno = (t: string, jc = just) => par(run(t, { sz: 20 }), `${esp(40, 40)}${jc}`);
  corpo.push(
    par('', esp(120, 0)),
    tabela(
      [g1, g2, g3],
      borda('000000', 4),
      [
        `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${cel(g1 + g2, par(run('Instrumento Avaliativo', { b: true }), `${esp(40, 40)}${centro}`), `<w:gridSpan w:val="2"/>${fundo(CINZA)}`)}${cel(g3, par(run('Peso', { b: true }), `${esp(40, 40)}${centro}`), fundo(CINZA))}</w:tr>`,
        ...(['A', 'B', 'C'] as const).map(
          (gl) =>
            `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cel(g1, par(run(`Grau ${gl}`, { b: true }), `${esp(40, 40)}${centro}`), '<w:vAlign w:val="bottom"/>')}${cel(g2, linhas(p.graus[gl].descricao).map((l) => pequeno(l)).join(''))}${cel(g3, par(run(p.graus[gl].peso), `${esp(40, 40)}${centro}`), '<w:vAlign w:val="bottom"/>')}</w:tr>`,
        ),
      ],
      60,
    ),
    par('', esp(120, 0)),
  );
  for (const r of REGRAS_APROVACAO) {
    if (r.tipo === 'formula') corpo.push(par(run(r.t, { b: true }), `${esp(120, 200)}${centro}`));
    else if (r.tipo === 'lista') corpo.push(par(run(r.t), `${esp(0, 100)}<w:ind w:left="567"/>`));
    else if (r.tipo === 'nota') corpo.push(par(run(r.t, { sz: 14 }), esp(160, 0)));
    else corpo.push(par(run(r.t), `${esp(0, 120)}${just}`));
  }

  // ----- Ações para a melhoria da aprendizagem -----
  corpo.push(faixaClara('Ações concretas para a melhoria da aprendizagem em função das avaliações realizadas'));
  const r1 = Math.round((LARG - 120) / 2);
  corpo.push(
    tabela(
      [r1, LARG - 120 - r1],
      borda('000000', 4),
      [
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cel(r1, par(run('Descrição', { b: true }), `${esp(40, 40)}${centro}`), fundo(CINZA))}${cel(LARG - 120 - r1, par(run('Estratégias/ Atividades Propostas', { b: true }), `${esp(40, 40)}${centro}`), fundo(CINZA))}</w:tr>`,
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cel(r1, linhas(p.recuperacao.descricao).map((l) => pequeno(l, centro)).join(''))}${cel(LARG - 120 - r1, linhas(p.recuperacao.estrategias).map((l) => pequeno(l)).join(''))}</w:tr>`,
      ],
      60,
    ),
  );

  // ----- Bibliografia -----
  corpo.push(faixa('Bibliografia', 360));
  const subtitulo = (t: string) => par(run(t, { b: true, cor: 'FFFFFF', fundo: '808080' }), esp(160, 120));
  const obra = (t: string) => par(comNegrito(t.trim()), esp(0, 160));
  corpo.push(subtitulo('Bibliografia Básica'));
  for (const o of p.bibliografiaBasica.filter((x) => x.trim())) corpo.push(obra(o));
  corpo.push(subtitulo('Bibliografia Complementar'));
  for (const o of p.bibliografiaComplementar.filter((x) => x.trim())) corpo.push(obra(o));

  // ----- Local, data e assinaturas -----
  corpo.push(par(run(localEData(p.cidade, e.data)), `${esp(480, 720)}<w:jc w:val="right"/>`));
  const a1 = Math.round(LARG / 2) - 400;
  const assinatura = (nome: string, papel: string) =>
    `${par(run(nome), `${esp(60, 0)}${centro}<w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="000000"/></w:pBdr>`)}${par(run(papel), `${esp(0, 0)}${centro}`)}`;
  corpo.push(
    `<w:tbl><w:tblPr><w:tblW w:w="${LARG}" w:type="dxa"/><w:tblBorders>${semBorda}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${a1}"/><w:gridCol w:w="${LARG - 2 * a1}"/><w:gridCol w:w="${a1}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cel(a1, assinatura(p.professor, 'Professor(a)'))}${cel(LARG - 2 * a1, par(''))}${cel(a1, assinatura(p.coordenador, 'Coordenador(a)'))}</w:tr></w:tbl>`,
    par(''),
  );

  const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdRodape"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="567" w:bottom="980" w:left="567" w:header="0" w:footer="400" w:gutter="0"/></w:sectPr>`;
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${corpo.join('')}${sect}</w:body></w:document>`;
  const rodape = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${W}>${par(run('Revisão 00', { sz: 14, cor: '7F7F7F' }), '<w:jc w:val="right"/>')}</w:ftr>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdRodape" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${e.cabecalho ? '<Relationship Id="rIdCabImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cabecalho.png"/>' : ''}</Relationships>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const enc = new TextEncoder();
  const arquivos = [
    { nome: '[Content_Types].xml', dados: enc.encode(tipos) },
    { nome: '_rels/.rels', dados: enc.encode(rels) },
    { nome: 'word/document.xml', dados: enc.encode(documento) },
    { nome: 'word/styles.xml', dados: enc.encode(estilos) },
    { nome: 'word/footer1.xml', dados: enc.encode(rodape) },
    { nome: 'word/_rels/document.xml.rels', dados: enc.encode(relsDoc) },
    ...(e.cabecalho ? [{ nome: 'word/media/cabecalho.png', dados: e.cabecalho }] : []),
  ];
  return new Blob([zip(arquivos) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function nomeArquivoPlanoEnsino(unidade: string, periodo: string, ext: 'docx' | 'pdf'): string {
  const limpo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return `Plano de Ensino ${limpo(unidade)}${periodo ? ` - ${limpo(periodo)}` : ''}.${ext}`;
}
