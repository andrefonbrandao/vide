// @vitest-environment node
import { expect, test } from 'vitest';
import { gerarPreProjetoPdf, naturezaPadrao, TEXTO_VAZIO } from './preProjetoPdf';

test('gera o pré-projeto (com nota, citação e referências) e conta as páginas', async () => {
  const blob = await gerarPreProjetoPdf({
    nome: 'João Ávila',
    config: { ativo: true, instituicao: 'Ftec', curso: 'Direito', cidade: 'Caxias do Sul', ano: '2026', orientador: 'Prof. Me. X', coorientador: '', natureza: '', resumo: true, aprovacao: true },
    etapas: [{ id: 'a', nome: 'Capítulo 1', prazo: '2026-09-01', concluida_em: null }],
    texto: { ...TEXTO_VAZIO, titulo: 'Precedentes', introducao: 'Texto com nota.[[Nota com **negrito**.]]\n> Citação longa.', referencias: 'B, b.\nA, a.', problema: 'Qual?' },
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const { PDFDocument } = await import('pdf-lib');
  // capa, rosto, aprovação, resumo, sumário, texto e as referências em página própria
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(7);
  expect(naturezaPadrao({ curso: 'Direito', instituicao: 'Uniftec' })).toContain('Centro Universitário Uniftec');
});

test('estrutura: numeração, específicos com ponto e referências no fim', async () => {
  const { estruturaPreProjeto } = await import('./preProjetoEstrutura');
  const b = estruturaPreProjeto(
    { ...TEXTO_VAZIO, introducao: 'Intro.', problema: 'Qual?', objetivosEspecificos: '- Identificar as teses\nVerificar a fundamentação;', fundamentacao: '## A\nTexto.\n## B\nMais.', referencias: 'B, b.\nA, a.' },
    [{ id: 'e', nome: 'Cap. 1', prazo: '2026-09-01', concluida_em: null }],
  );
  const titulos = b.filter((x) => x.tipo === 'titulo').map((x) => (x.tipo === 'titulo' ? `${x.rotulo} ${x.texto}` : ''));
  expect(titulos).toEqual(['1 Introdução', '1.1 Problema de pesquisa', '2 Objetivos e justificativa', '2.1 Objetivos específicos', '3 Fundamentação teórica', '3.1 A', '3.2 B', '4 Cronograma das atividades']);
  const pars = b.filter((x) => x.tipo === 'par').map((x) => (x.tipo === 'par' ? x.p.trechos.map((t) => ('t' in t ? t.t : '')).join('') : ''));
  expect(pars).toContain('Identificar as teses.');
  expect(pars).toContain('Verificar a fundamentação.');
  expect(b[b.length - 1]).toEqual({ tipo: 'referencias', lista: ['A, a.', 'B, b.'] });
});

test('Word: arquivo .docx com notas de rodapé, sumário e referências em página nova', async () => {
  const { gerarPreProjetoDocx } = await import('./preProjetoDocx');
  const blob = await gerarPreProjetoDocx({
    nome: 'João Ávila',
    config: { ativo: true, instituicao: 'Ftec', curso: 'Direito', cidade: 'Caxias do Sul', ano: '2026', orientador: 'Prof. X', coorientador: '', natureza: '', resumo: false, aprovacao: false },
    etapas: [],
    texto: { ...TEXTO_VAZIO, titulo: 'Precedentes & <teses>', introducao: 'Texto com nota.[[Nota **negrito**.]]', referencias: 'A, a.' },
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const txt = new TextDecoder('latin1').decode(bytes);
  expect(txt.slice(0, 2)).toBe('PK');
  for (const parte of ['word/document.xml', 'word/footnotes.xml', 'word/styles.xml', 'word/header1.xml', '[Content_Types].xml']) expect(txt).toContain(parte);
  const doc = new TextDecoder().decode(bytes);
  expect(doc).toContain('<w:footnoteReference w:id="2"/>');
  expect(doc).toContain('PRECEDENTES &amp; &lt;TESES&gt;');
  expect(doc).toContain('<w:pageBreakBefore/>');
  expect(doc).toContain('TOC \\o "1-2"');
});
