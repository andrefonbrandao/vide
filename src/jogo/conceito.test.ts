import { expect, test } from 'vitest';
import { dicasVisiveis, normalizarResposta, pontosConceito, proximaDica, respostaCerta } from './conceito';

test('normaliza a resposta', () => {
  expect(normalizarResposta('  A Sentença! ')).toBe('sentenca');
  expect(normalizarResposta('Coisa   JULGADA')).toBe('coisa julgada');
  expect(normalizarResposta('a')).toBe('a');
  expect(normalizarResposta('Os embargos de declaração')).toBe('embargos de declaracao');
});

test('compara com o conceito e as aceitas', () => {
  expect(respostaCerta('sentenca', 'Sentença')).toBe(true);
  expect(respostaCerta('A SENTENÇA', 'sentença')).toBe(true);
  expect(respostaCerta('sentença judicial', 'Sentença', ['sentença judicial'])).toBe(true);
  expect(respostaCerta('setença', 'Sentença')).toBe(false);
  expect(respostaCerta('decisão', 'Sentença')).toBe(false);
  expect(respostaCerta('   ', 'Sentença')).toBe(false);
});

test('dicas aparecem em intervalos iguais', () => {
  expect([0, 19_999, 20_000, 39_999, 40_000, 59_000, 99_000].map((t) => dicasVisiveis(3, 60_000, t))).toEqual([1, 1, 2, 2, 3, 3, 3]);
  expect(proximaDica(3, 60_000, 5_000)).toBe(20_000);
  expect(proximaDica(3, 60_000, 45_000)).toBeNull();
  expect(dicasVisiveis(2, 30_000, 15_000)).toBe(2);
});

test('pontos caem de 1000 a 300', () => {
  expect(pontosConceito(0, 60_000)).toBe(1000);
  expect(pontosConceito(30_000, 60_000)).toBe(650);
  expect(pontosConceito(60_000, 60_000)).toBe(300);
});
