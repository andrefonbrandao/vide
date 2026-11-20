import { expect, test } from 'vitest';
import { lerParagrafos, lerTrechos, ordenarReferencias } from './marcacao';

test('negrito, itálico e nota', () => {
  expect(lerTrechos('O **stare decisis** e a _ratio decidendi_[[Ver MARINONI, 2016, p. 12.]] no CPC.')).toEqual([
    { t: 'O ' },
    { t: 'stare decisis', negrito: true },
    { t: ' e a ' },
    { t: 'ratio decidendi', italico: true },
    { nota: 'Ver MARINONI, 2016, p. 12.' },
    { t: ' no CPC.' },
  ]);
  expect(lerTrechos('arquivo_final_v2.docx')).toEqual([{ t: 'arquivo_final_v2.docx' }]);
});

test('parágrafos, citação longa e subtítulo', () => {
  const p = lerParagrafos('## Os precedentes\nTexto um.\n\n> Citação longa de autor.\nTexto dois.', true);
  expect(p.map((x) => x.tipo)).toEqual(['sub', 'p', 'citacao', 'p']);
  expect(lerParagrafos('## não é subtítulo aqui')[0].tipo).toBe('p');
});

test('referências em ordem alfabética', () => {
  expect(ordenarReferencias('MARINONI, Luiz. **Precedentes**.\nÁVILA, Humberto. **Teoria**.\nDIDIER JR., Fredie. **Curso**.')).toEqual([
    'ÁVILA, Humberto. **Teoria**.',
    'DIDIER JR., Fredie. **Curso**.',
    'MARINONI, Luiz. **Precedentes**.',
  ]);
});

test('referências: o título colado junto com a lista é descartado', () => {
  expect(ordenarReferencias('5. REFERÊNCIAS\nPEREIRA, Caio. **Responsabilidade civil**.\n**Referências**\nCAHALI, Yussef. **Dano moral**.')).toEqual([
    'CAHALI, Yussef. **Dano moral**.',
    'PEREIRA, Caio. **Responsabilidade civil**.',
  ]);
});
