import { describe, expect, test } from 'vitest';
import { CATALOGO } from '../dados/diplomas';
import { chaveReferencia } from './detector';
import { lerDigitado, romano } from './digitado';

function chave(t: string, principal = 'cpc'): string {
  const r = lerDigitado(t, CATALOGO, principal);
  return r.ok ? chaveReferencia(r.ref) : `ERRO: ${r.erro}`;
}

describe('referência digitada', () => {
  test('algarismos romanos', () => {
    expect(romano('vi')).toBe(6);
    expect(romano('lxix')).toBe(69);
    expect(romano('iv')).toBe(4);
    expect(romano('abc')).toBeNull();
  });

  test.each([
    ['485', 'cpc:485'],
    ['485 VI', 'cpc:485:i6'],
    ['485, VI', 'cpc:485:i6'],
    ['art. 485, VI', 'cpc:485:i6'],
    ['Art 485 inc. VI', 'cpc:485:i6'],
    ['485 inciso 6', 'cpc:485:i6'],
    ['300 §1', 'cpc:300:p1'],
    ['300, § 1º', 'cpc:300:p1'],
    ['art. 300 par 2', 'cpc:300:p2'],
    ['1015 pu', 'cpc:1015:pu'],
    ['1015 p.u.', 'cpc:1015:pu'],
    ['1015 parágrafo único', 'cpc:1015:pu'],
    ['1.015, I', 'cpc:1015:i1'],
    ['1022 II b', 'cpc:1022:i2:ab'],
    ['1022, II, a', 'cpc:1022:i2:aa'],
    ['1022 II al. c', 'cpc:1022:i2:ac'],
    ['833 §2 III', 'cpc:833:p2:i3'],
    ['5 CF', 'cf:5'],
    ['CF 5, LXIX', 'cf:5:i69'],
    ['art. 5º, LV, da CF', 'cf:5:i55'],
    ['5 constituição', 'cf:5'],
    ['186 CC', 'cc:186'],
    ['3 lei 9.099', 'l9099:3'],
    ['art. 3º da Lei 9.099/1995', 'l9099:3'],
    ['103-A CF', 'cf:103-A'],
    ['10 ADCT', 'adct:10'],
    ['5', 'cf:5'],
  ])('%s', (t, esperado) => {
    expect(chave(t, t === '5' ? 'cf' : 'cpc')).toBe(esperado);
  });

  test('erros', () => {
    expect(chave('')).toMatch(/^ERRO/);
    expect(chave('7 CLT')).toMatch(/^ERRO: Não entendi "clt"/);
    expect(chave('VI')).toMatch(/^ERRO/);
    expect(chave('300 §')).toMatch(/^ERRO/);
  });
});
