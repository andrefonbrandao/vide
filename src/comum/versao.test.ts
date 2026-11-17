import { expect, test } from 'vitest';
import { compararVersao } from './versao';

test('compara versões', () => {
  expect(compararVersao('0.9.0', '0.10.0')).toBe(-1);
  expect(compararVersao('0.35.0', '0.34.0')).toBe(1);
  expect(compararVersao('0.35.0', '0.35.0')).toBe(0);
  expect(compararVersao('?', '0.35.0')).toBe(-1);
});
