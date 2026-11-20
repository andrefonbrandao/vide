import { expect, test } from 'vitest';
import { camposDoTrabalho, localizar } from './apontamentos';
import { TEXTO_VAZIO } from './preProjetoPdf';
import { FINAL_VAZIO } from './trabalhoFinalEstrutura';

test('localizar: usa o que vem antes para achar o trecho certo; trecho reescrito some', () => {
  const t = 'A lei. Depois, a lei de novo.';
  expect(localizar(t, { trecho: 'a lei', prefixo: 'Depois, ' })).toEqual({ de: 15, ate: 20 });
  expect(localizar(t, { trecho: 'lei', prefixo: 'outra coisa ' })).toEqual({ de: 2, ate: 5 });
  expect(localizar(t, { trecho: 'doutrina', prefixo: '' })).toBeNull();
});

test('campos do trabalho: chaves e nomes do trabalho final, com capítulos numerados', () => {
  const final = { ...FINAL_VAZIO, introducao: 'I', capitulos: [{ id: 'a', titulo: 'Teoria', texto: 'T' }], apendices: [{ id: 'p', titulo: 'Roteiro', texto: 'R' }] };
  const c = camposDoTrabalho({ ...TEXTO_VAZIO, final }, 'final');
  const por = new Map(c.map((x) => [x.chave, x.nome]));
  expect(por.get('final.introducao')).toBe('1 Introdução');
  expect(por.get('final.cap.a')).toBe('3 Teoria');
  expect(por.get('final.consideracoes')).toBe('4 Considerações finais');
  expect(por.get('final.ap.p')).toBe('Apêndice A – Roteiro');
  expect(camposDoTrabalho({ ...TEXTO_VAZIO, problema: 'Q' }, 'pre').find((x) => x.chave === 'pre.problema')?.valor).toBe('Q');
});
