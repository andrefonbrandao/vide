// @vitest-environment node
import { expect, test } from 'vitest';
import { separarTabelas, textoDaTabela } from './marcacao';
import { TEXTO_VAZIO } from './preProjetoPdf';
import { estruturaFinal, finalDoPreProjeto, FINAL_VAZIO, novaParte, siglasDe, tabelasDe } from './trabalhoFinalEstrutura';
import type { ConfigPreProjeto, TextoFinal } from './tipos';

const tabela = (n: number) => `::: Tabela – Dados ${n}\nAno | Casos\n2024 | ${n}\nFonte: CNJ.\n:::`;

const FINAL: TextoFinal = {
  ...FINAL_VAZIO,
  titulo: 'Precedentes',
  tituloIngles: 'Precedents',
  email: 'aluno@exemplo.com',
  dedicatoria: 'À minha família.',
  agradecimentos: 'Agradeço.',
  resumo: 'Resumo do trabalho.',
  palavrasChave: 'Precedentes. CPC.',
  abstract: 'Abstract.',
  siglas: 'STF – Supremo Tribunal Federal\nCPC – Código de Processo Civil',
  introducao: 'Introdução.',
  objetivoGeral: 'Analisar.',
  objetivosEspecificos: 'Identificar\nVerificar',
  justificativa: 'Porque sim.',
  capitulos: [
    novaParte('O sistema de precedentes', `Texto.\n## Origem\nMais.[[Uma nota.]]\n### No Brasil\nAinda.\n${tabela(1)}\n${tabela(2)}`),
    novaParte('Análise das decisões', `${tabela(3)}\n::: Quadro – Teses\nTese | Tribunal\nA | STF\n:::\nFim.`),
  ],
  consideracoes: 'Conclusão.',
  referencias: 'B, b.\nA, a.',
  apendices: [novaParte('Roteiro', 'Perguntas.')],
  anexos: [novaParte('Súmula', 'Texto.')],
};

const CFG: ConfigPreProjeto = {
  ativo: true, instituicao: 'Ftec', curso: 'Direito', cidade: 'Caxias do Sul', ano: '2026', orientador: 'Prof. Me. X', coorientador: '', natureza: '', resumo: false, aprovacao: false,
  formato: 'final', emailOrientador: 'prof@exemplo.com', avaliadores: ['Me. A', ''],
};

test('tabela: lida do texto e escrita de volta igual', () => {
  const p = separarTabelas(`Antes.\n${tabela(7)}\nDepois.`);
  expect(p.map((x) => x.tipo)).toEqual(['texto', 'tabela', 'texto']);
  const t = p[1].tipo === 'tabela' ? p[1].tabela : null;
  expect(t).toEqual({ tipo: 'tabela', titulo: 'Dados 7', fonte: 'CNJ.', linhas: [['Ano', 'Casos'], ['2024', '7']] });
  expect(separarTabelas(textoDaTabela(t!))[0]).toEqual({ tipo: 'tabela', tabela: t });
});

test('estrutura do trabalho final: capítulos com nome, subtítulos, tabelas numeradas, apêndices e anexos', () => {
  const b = estruturaFinal(FINAL);
  const titulos = b.filter((x) => x.tipo === 'titulo').map((x) => (x.tipo === 'titulo' ? `${x.rotulo} ${x.texto}`.trim() : ''));
  expect(titulos).toEqual([
    '1 Introdução',
    '2 Objetivos e justificativa',
    '2.1 Objetivo geral',
    '2.1.1 Objetivos específicos',
    '2.2 Justificativa',
    '3 O sistema de precedentes',
    '3.1 Origem',
    '3.1.1 No Brasil',
    '4 Análise das decisões',
    '5 Considerações finais',
    'Apêndice A – Roteiro',
    'Anexo A – Súmula',
  ]);
  expect(tabelasDe(b).map((x) => `${x.tipo} ${x.numero}`)).toEqual(['tabela 1', 'tabela 2', 'tabela 3', 'quadro 1']);
  expect(siglasDe(FINAL.siglas).map((x) => x.sigla)).toEqual(['CPC', 'STF']);
});

test('o trabalho final começa com o texto do pré-projeto', () => {
  const f = finalDoPreProjeto({ ...TEXTO_VAZIO, titulo: 'T', introducao: 'Intro.', problema: 'Qual?', fundamentacao: 'Teoria.', metodo: 'Dedutivo.', coleta: 'Documental.', referencias: 'A, a.' });
  expect(f.introducao).toBe('Intro.\nQual?');
  expect(f.capitulos.map((c) => c.titulo)).toEqual(['Fundamentação teórica', 'Procedimentos metodológicos', 'Apresentação e análise dos resultados']);
  expect(f.capitulos[0].texto).toBe('Teoria.');
  expect(f.capitulos[1].texto).toBe('## Método(s) de pesquisa\nDedutivo.\n## Técnicas de coleta de dados\nDocumental.');
  expect(f.referencias).toBe('A, a.');
});

test('PDF e Word do trabalho final', async () => {
  const { gerarPreProjetoPdf } = await import('./preProjetoPdf');
  const { PDFDocument } = await import('pdf-lib');
  let listas: string[] = [];
  let inicio = 0;
  const blob = await gerarPreProjetoPdf({ nome: 'João Ávila', config: CFG, texto: { ...TEXTO_VAZIO, final: FINAL }, etapas: [] }, (_, ex) => ((listas = ex.listas.map((l) => `${l.titulo}:${l.itens.length}`)), (inicio = ex.inicio)));
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  // capa, rosto, aprovação, dedicatória, agradecimentos, resumo, abstract, lista de tabelas, siglas, sumário = 10 antes do texto
  expect(inicio).toBe(10);
  expect(listas).toEqual(['LISTA DE TABELAS:3']);
  // 1, 2, 3, 4, 5 em páginas novas + referências + apêndice + anexo
  expect(doc.getPageCount()).toBe(10 + 8);

  const { gerarPreProjetoDocx } = await import('./preProjetoDocx');
  const docx = await gerarPreProjetoDocx({ nome: 'João Ávila', config: CFG, texto: { ...TEXTO_VAZIO, final: FINAL }, etapas: [] });
  const xml = new TextDecoder().decode(new Uint8Array(await docx.arrayBuffer()));
  expect(xml).toContain('SEQ Tabela \\* ARABIC');
  expect(xml).toContain('TOC \\h \\z \\c "Tabela"');
  expect(xml).toContain('LISTA DE ABREVIATURAS E SIGLAS');
  expect(xml).toContain('3.1.1 No Brasil');
  expect(xml).toContain('APÊNDICE A – ROTEIRO');
  expect(xml).toContain('Professor(a) Avaliador(a): Me. A');
  expect(xml).toContain('w:start="10"');
});

/** Um PNG de verdade (w×h, cinza), montado aqui. */
async function pngFalso(w: number, h: number): Promise<Uint8Array> {
  const { deflateSync, crc32 } = await import('node:zlib');
  const pedaco = (tipo: string, dados: Uint8Array) => {
    const b = Buffer.alloc(12 + dados.length);
    b.writeUInt32BE(dados.length, 0);
    b.write(tipo, 4, 'latin1');
    Buffer.from(dados).copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, 8 + dados.length)) >>> 0, 8 + dados.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const cru = Buffer.alloc((w + 1) * h, 128);
  for (let y = 0; y < h; y++) cru[y * (w + 1)] = 0;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pedaco('IHDR', ihdr), pedaco('IDAT', deflateSync(cru)), pedaco('IEND', new Uint8Array())]));
}

test('figuras e gráficos: lidos do texto, numerados, no PDF e no Word (com a imagem dentro)', async () => {
  const { lerImagem } = await import('./imagens');
  const { textoDaFigura } = await import('./marcacao');
  const fig = (n: number, tipo: 'figura' | 'grafico' = 'figura') => textoDaFigura({ tipo, titulo: `Imagem ${n}`, fonte: 'o autor.', imagem: `img${n}abcdef`, largura: n === 1 ? 50 : 100 });
  const p = separarTabelas(`Texto.\n${fig(1)}\nMais.`);
  expect(p[1]).toEqual({ tipo: 'figura', figura: { tipo: 'figura', titulo: 'Imagem 1', fonte: 'o autor.', imagem: 'img1abcdef', largura: 50 } });
  const png = await pngFalso(40, 20);
  expect(lerImagem(png)).toMatchObject({ tipo: 'png', largura: 40, altura: 20 });
  const final: TextoFinal = { ...FINAL, capitulos: [novaParte('Cap', `Texto.\n${fig(1)}\n${fig(2)}\n${fig(3)}\n${fig(4, 'grafico')}`)], apendices: [], anexos: [] };
  const b = estruturaFinal(final);
  expect(tabelasDe(b).map((x) => `${x.tipo} ${x.numero}`)).toEqual(['figura 1', 'figura 2', 'figura 3', 'grafico 1']);
  const { imagensDoFinal } = await import('./trabalhoFinalEstrutura');
  expect(imagensDoFinal(final)).toEqual(['img1abcdef', 'img2abcdef', 'img3abcdef', 'img4abcdef']);
  // A imagem 3 falta: no lugar, um aviso (o PDF sai do mesmo jeito).
  const imagens = new Map([1, 2, 4].map((n) => [`img${n}abcdef`, lerImagem(png)!]));
  const { gerarPreProjetoPdf } = await import('./preProjetoPdf');
  let listas: string[] = [];
  const pdf = await gerarPreProjetoPdf({ nome: 'A', config: CFG, texto: { ...TEXTO_VAZIO, final }, etapas: [], imagens }, (_, ex) => (listas = ex.listas.map((l) => `${l.titulo}:${l.itens.length}`)));
  expect(pdf.size).toBeGreaterThan(1000);
  expect(listas).toEqual(['LISTA DE FIGURAS:3']);
  const { gerarPreProjetoDocx } = await import('./preProjetoDocx');
  const docx = new TextDecoder().decode(new Uint8Array(await (await gerarPreProjetoDocx({ nome: 'A', config: CFG, texto: { ...TEXTO_VAZIO, final }, etapas: [], imagens })).arrayBuffer()));
  expect(docx).toContain('word/media/img1.png');
  expect(docx).toContain('word/media/img3.png'); // a 3ª imagem que existe (a do gráfico)
  expect(docx).toContain('SEQ Grafico \\* ARABIC');
  expect(docx).toContain('TOC \\h \\z \\c "Figura"');
  expect(docx).toContain('[imagem não encontrada]');
});
