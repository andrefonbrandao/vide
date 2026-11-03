import { expect, test } from 'vitest';
import { assuntosDasQuestoes, sortearQuestoes } from './banco';

const qs = Array.from({ length: 15 }, (_, i) => ({ id: `q${i}`, etiquetas: i < 12 ? ['sentença'] : ['recursos', 'sentença'].slice(0, i === 14 ? 1 : 2).reverse() }));

test('assuntos com contagem', () => {
  expect(assuntosDasQuestoes([{ etiquetas: ['a', 'b'] }, { etiquetas: ['a'] }, { etiquetas: [] }])).toEqual([
    { assunto: 'a', total: 2 },
    { assunto: 'b', total: 1 },
  ]);
});

test('sorteia 10 do assunto, sem repetir, em ordem aleatória', () => {
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const r = sortearQuestoes(qs, 'sentença', 10, rnd);
  expect(r).toHaveLength(10);
  expect(new Set(r.map((q) => q.id)).size).toBe(10);
  expect(r.every((q) => q.etiquetas.includes('sentença'))).toBe(true);
  expect(r.map((q) => q.id)).not.toEqual(qs.slice(0, 10).map((q) => q.id));
});

test('se há menos que o pedido, vêm todas as do assunto', () => {
  expect(sortearQuestoes(qs, 'recursos', 10)).toHaveLength(qs.filter((q) => q.etiquetas.includes('recursos')).length);
  expect(sortearQuestoes(qs, null, 100)).toHaveLength(15);
});
