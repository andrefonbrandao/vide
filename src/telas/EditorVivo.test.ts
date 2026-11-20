import { expect, test } from 'vitest';
import { htmlParaMarcacao, marcasDaLinha } from './EditorVivo';

test('marcas da linha: negrito, itálico e nota, com as posições', () => {
  const l = 'O **stare** _decisis_ e nome_de_arquivo.[[Nota.]]';
  const m = marcasDaLinha(l);
  const b = m.find((x) => x.tipo === 'b')!;
  expect(l.slice(b.de, b.ate)).toBe('stare');
  const i = m.find((x) => x.tipo === 'i')!;
  expect(l.slice(i.de, i.ate)).toBe('decisis');
  expect(m.filter((x) => x.tipo === 'i')).toHaveLength(1); // nome_de_arquivo não vira itálico
  const n = m.find((x) => x.tipo === 'nota');
  expect(n && n.tipo === 'nota' && n.texto).toBe('Nota.');
});

test('colar do Word: negrito, itálico, parágrafos e títulos viram marcações', () => {
  const html =
    '<html><head><style>p{}</style></head><body><h2>Origem</h2><p class=MsoNormal>Texto <b>forte</b> e <span style="font-style:italic">estrangeiro</span>.</p><p><span style="font-weight:700">Tudo negrito</span></p></body></html>';
  expect(htmlParaMarcacao(html)).toBe('## Origem\nTexto **forte** e _estrangeiro_.\n**Tudo negrito**');
});
