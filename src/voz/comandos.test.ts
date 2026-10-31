import { expect, test } from 'vitest';
import { detectarComandos } from './comandos';

test.each([
  ['pode fechar', ['recolher']],
  ['Pode fechar.', ['recolher']],
  ['ok, pode fechar agora', ['recolher']],
  ['tira da tela', ['recolher']],
  ['aumenta a fonte', ['aumentar']],
  ['aumentar o tamanho da letra', ['aumentar']],
  ['aumenta a letra', ['aumentar']],
  ['coloca a letra maior', ['aumentar']],
  ['diminui a fonte', ['diminuir']],
  ['reduz o tamanho do texto', ['diminuir']],
  ['letra menor por favor', ['diminuir']],
  ['vamos fechar o capítulo', []],
  ['o juiz pode decidir', []],
])('%s', (t, esperado) => {
  expect(detectarComandos(t)).toEqual(esperado);
});
