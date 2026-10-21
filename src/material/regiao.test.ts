import { describe, expect, it } from 'vitest';
import { PAGINA_INTEIRA, ajustarProporcao, ajustarRegiao, encaixar, passo, regiaoDeArraste } from './regiao';

describe('região do material', () => {
  it('página inteira: a roda troca de página e para nas pontas', () => {
    expect(passo({ pagina: 1, regiao: PAGINA_INTEIRA }, 1, 3).pagina).toBe(2);
    expect(passo({ pagina: 3, regiao: PAGINA_INTEIRA }, 1, 3).pagina).toBe(3);
    expect(passo({ pagina: 1, regiao: PAGINA_INTEIRA }, -1, 3).pagina).toBe(1);
  });

  it('com zoom: desce dentro da página e depois passa para o início da seguinte', () => {
    let pos = { pagina: 1, regiao: { x: 0, y: 0, w: 1, h: 0.4 } };
    const vistos: string[] = [];
    for (let i = 0; i < 6; i++) {
      pos = passo(pos, 1, 2);
      vistos.push(`${pos.pagina}:${pos.regiao.y.toFixed(2)}`);
    }
    expect(vistos).toEqual(['1:0.14', '1:0.28', '1:0.42', '1:0.56', '1:0.60', '2:0.00']);
    // e volta
    pos = passo(pos, -1, 2);
    expect(`${pos.pagina}:${pos.regiao.y.toFixed(2)}`).toBe('1:0.60');
  });

  it('arraste vira região dentro da página (em qualquer direção)', () => {
    expect(regiaoDeArraste(0.8, 0.9, 0.2, 0.5)).toEqual({ x: 0.2, y: 0.5, w: 0.6000000000000001, h: 0.4 });
    expect(ajustarRegiao({ x: 0.99, y: -1, w: 0.001, h: 2 })).toEqual({ x: 0.97, y: 0, w: 0.03, h: 1 });
  });

  it('amplia a região para a proporção da tela (sem faixas pretas)', () => {
    // faixa larga no alto de uma página A4: cresce para baixo até a proporção 16:9
    const r = ajustarProporcao({ x: 0.05, y: 0.08, w: 0.9, h: 0.22 }, 595, 842, 16 / 9);
    expect((r.w * 595) / (r.h * 842)).toBeCloseTo(16 / 9, 2);
    expect(r.x).toBeCloseTo(0.05);
    expect(r.y).toBeGreaterThanOrEqual(0);
    // região alta e estreita: cresce para os lados
    const s = ajustarProporcao({ x: 0.4, y: 0.1, w: 0.1, h: 0.5 }, 595, 842, 16 / 9);
    expect(s.h).toBeCloseTo(0.5);
    expect(s.w).toBeGreaterThan(0.1);
    expect(ajustarProporcao(PAGINA_INTEIRA, 595, 842, 16 / 9)).toEqual(PAGINA_INTEIRA);
  });

  it('encaixa a região sem distorcer', () => {
    // página A4 em pé (595 x 842), região = metade de cima, tela 1280 x 720
    const r = encaixar(1280, 720, 595, 842, { x: 0, y: 0, w: 1, h: 0.5 });
    expect(Math.round(r.altura)).toBe(720);
    expect(Math.round(r.largura)).toBe(1018);
  });
});
