import { expect, test } from 'vitest';
import { detectarComandos } from './comandos';

test.each([
  ['pode fechar', ['recolher']],
  ['Pode fechar.', ['recolher']],
  ['ok, pode fechar agora', ['recolher']],
  ['tira da tela', ['recolher']],
  ['aumenta a fonte', ['aumentar']],
  ['vamos fechar o capítulo', []],
  ['o juiz pode decidir', []],
])('%s', (t, esperado) => {
  expect(detectarComandos(t)).toEqual(esperado);
});
