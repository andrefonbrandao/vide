import { expect, test } from 'vitest';
import { manualDoAluno } from './manualAluno';

test('manual do aluno: só fala do formulário quando ele está ligado; capítulos e figuras só no trabalho final', () => {
  const titulos = (f: 'pre' | 'final' | null) => manualDoAluno(f).flatMap((s) => s.perguntas.map((q) => q.p));
  expect(titulos(null).some((p) => /escrevo|tabela|apontamentos/i.test(p))).toBe(false);
  expect(titulos('pre')).toContain('Como insiro uma tabela ou um quadro?');
  expect(titulos('pre').some((p) => /capítulos|figura/i.test(p))).toBe(false);
  expect(titulos('final')).toContain('Como insiro uma figura ou um gráfico?');
  expect(manualDoAluno('final').find((s) => s.id === 'apontamentos')!.perguntas[0].r[0]).toContain('"Meu trabalho final"');
});
