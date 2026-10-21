import { describe, expect, it } from 'vitest';
import { Detector, chaveReferencia } from './detector';
import { lerNumero, romanoParaNumero } from './numeros';
import { normalizarFala } from './normalizar';

function chaves(frase: string, d = new Detector()): string[] {
  return d.detectar(frase).referencias.map(chaveReferencia);
}

describe('números', () => {
  const casos: [string, number][] = [
    ['setenta', 70],
    ['mil e quinze', 1015],
    ['quatrocentos e oitenta e cinco', 485],
    ['trezentos', 300],
    ['cento e um', 101],
    ['vinte e dois', 22],
    ['mil e setenta e dois', 1072],
    ['mil', 1000],
    ['dezesseis', 16],
  ];
  for (const [texto, valor] of casos) {
    it(`"${texto}" = ${valor}`, () => {
      expect(lerNumero(texto.split(' '), 0)?.valor).toBe(valor);
    });
  }
  it('não junta dois números seguidos', () => {
    expect(lerNumero('setenta e setenta e um'.split(' '), 0)).toEqual({ valor: 70, tamanho: 1 });
  });
  it('romanos', () => {
    expect(romanoParaNumero('VI')).toBe(6);
    expect(romanoParaNumero('xiv')).toBe(14);
    expect(romanoParaNumero('IIII')).toBeNull();
  });
});

describe('normalização', () => {
  it('unifica CPC', () => {
    expect(normalizarFala('código de processo civil')).toEqual(['cpc']);
    expect(normalizarFala('C P C')).toEqual(['cpc']);
    expect(normalizarFala('c.p.c.')).toEqual(['cpc']);
  });
  it('milhar e ordinal', () => {
    expect(normalizarFala('Art. 1.015')).toEqual(['art', '1015']);
    expect(normalizarFala('artigo 1º')).toEqual(['art', '1']);
  });
});

describe('detector', () => {
  const casos: [string, string[]][] = [
    ['artigo 70 do CPC', ['cpc:70']],
    ['art 70', ['cpc:70']],
    ['art. 70', ['cpc:70']],
    ['o artigo setenta do código de processo civil', ['cpc:70']],
    ['veja o artigo mil e quinze', ['cpc:1015']],
    ['artigo 1.015', ['cpc:1015']],
    ['artigo 1015 do c p c', ['cpc:1015']],
    ['inciso sexto do 485', ['cpc:485:i6']],
    ['inciso VI do artigo 485', ['cpc:485:i6']],
    ['inciso 6 do art 485', ['cpc:485:i6']],
    ['artigo 485 inciso sexto', ['cpc:485:i6']],
    ['artigo 485, inciso VI, do CPC', ['cpc:485:i6']],
    ['parágrafo primeiro do artigo 300', ['cpc:300:p1']],
    ['§ 1º do art. 300', ['cpc:300:p1']],
    ['artigo 300 parágrafo 2º', ['cpc:300:p2']],
    ['parágrafo único do artigo 1.015', ['cpc:1015:pu']],
    ['alínea b do inciso segundo do artigo 1.015', ['cpc:1015:i2:ab']],
    ['artigo primeiro', ['cpc:1']],
    ['isso está no 485 do CPC', ['cpc:485']],
    ['artigos 70 e 71', ['cpc:70', 'cpc:71']],
    ['caput do artigo 70', ['cpc:70']],
    ['o artigo quatrocentos e oitenta e cinco e o artigo setenta', ['cpc:485', 'cpc:70']],
    ['incisos quinto e sexto do 485', ['cpc:485:i5', 'cpc:485:i6']],
  ];
  for (const [frase, esperado] of casos) {
    it(`"${frase}"`, () => expect(chaves(frase)).toEqual(esperado));
  }

  const negativos = [
    'o artigo quinto da constituição',
    'artigo 5 da Constituição Federal',
    'art 186 do código civil',
    'artigo 7 da lei 11.419',
    'súmula 410 do STJ',
    'houve preclusão',
    'um par de exemplos',
    'segundo o professor',
    'são 70 alunos',
  ];
  for (const frase of negativos) {
    it(`não detecta: "${frase}"`, () => expect(chaves(frase)).toEqual([]));
  }

  it('reconhece outro diploma e registra', () => {
    const r = new Detector().detectar('artigo 5º da Constituição');
    expect(r.outros).toHaveLength(1);
  });

  it('usa o artigo citado antes como contexto', () => {
    const d = new Detector();
    const t0 = 1_000_000;
    expect(d.detectar('vamos ver o artigo 485', t0).referencias.map(chaveReferencia)).toEqual(['cpc:485']);
    const r = d.detectar('e o inciso sétimo', t0 + 5_000).referencias;
    expect(r.map(chaveReferencia)).toEqual(['cpc:485:i7']);
    expect(r[0].contexto).toBe(true);
    // depois de muito tempo, o contexto expira
    expect(d.detectar('e o inciso oitavo', t0 + 10 * 60_000).referencias).toEqual([]);
  });

  it('não usa o contexto quando a frase termina em "do" (o número vem depois)', () => {
    const d = new Detector();
    d.detectar('artigo 70', 1000);
    expect(d.detectar('e agora o inciso sexto do', 2000).referencias).toEqual([]);
    expect(d.detectar('e agora o inciso sexto do 485', 3000).referencias.map(chaveReferencia)).toEqual(['cpc:485:i6']);
  });
});
