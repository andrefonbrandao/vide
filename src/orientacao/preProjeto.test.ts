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
  // capa, rosto, aprovação, resumo, sumário, texto
  const { PDFDocument } = await import('pdf-lib');
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(6);
  expect(naturezaPadrao({ curso: 'Direito', instituicao: 'Uniftec' })).toContain('Centro Universitário Uniftec');
});
