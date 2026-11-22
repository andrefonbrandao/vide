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

test('colar do Word: tabela, citação recuada, nota de rodapé e números dos títulos', () => {
  const html = `<h1>2.1 Origem histórica</h1><p class=MsoNormal>Texto com nota<a style='mso-footnote-id:ftn1' href="#_ftn1" name="_ftnref1">[1]</a>.</p>
<p class=MsoNormal style='margin-left:4.0cm'>Citação longa recuada.</p>
<table><tr><td>Ano</td><td>Casos</td></tr><tr><td>2024</td><td>10</td></tr></table>
<div style='mso-element:footnote-list'><div style='mso-element:footnote' id=ftn1><p class=MsoFootnoteText><a href="#_ftnref1">[1]</a> Ver MARINONI, 2019.</p></div></div>`;
  expect(htmlParaMarcacao(html)).toBe('## Origem histórica\nTexto com nota[[Ver MARINONI, 2019.]].\n> Citação longa recuada.\n::: Tabela –\nAno | Casos\n2024 | 10\nFonte: o autor.\n:::');
});

test('colar do Google Docs: nota de rodapé', () => {
  const html = `<p>Frase<sup><a href="#ftnt1" id="ftnt_ref1">[1]</a></sup> final.</p><hr><div><p><a href="#ftnt_ref1" id="ftnt1">[1]</a> Texto da nota.</p></div>`;
  expect(htmlParaMarcacao(html)).toBe('Frase[[Texto da nota.]] final.');
});
