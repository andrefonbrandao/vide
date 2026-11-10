import { describe, expect, test } from 'vitest';
import { liberado, paraAluno } from './liberacao';
import { digitoVerificador, gerarNumero, numeroValido } from './numero';
import { lerTexto, lerTrechos } from './texto';

describe('número do processo', () => {
  test('dígito verificador do CNJ e tribunal fictício', () => {
    const n = gerarNumero(2027, () => 0.5);
    expect(n).toMatch(/^\d{7}-\d{2}\.2027\.8\.99\.0001$/);
    expect(numeroValido(n)).toBe(true);
    expect(numeroValido(n.replace(/-(\d)(\d)/, (_, a, b) => `-${a}${(Number(b) + 1) % 10}`))).toBe(false);
    expect(digitoVerificador('5001234', '2027', '0001')).toHaveLength(2);
  });
});

describe('liberação dos eventos', () => {
  const ev = (libera: number | null) => ({ id: String(libera), libera });
  test('só os liberados chegam ao aluno, sem a data de liberação', () => {
    expect(liberado(ev(0), 10)).toBe(true);
    expect(liberado(ev(20), 10)).toBe(false);
    expect(liberado(ev(null), 10)).toBe(false);
    const d = paraAluno({ x: 1, eventos: [ev(0), ev(5), ev(50), ev(null)] }, 10);
    expect(d.eventos).toEqual([{ id: '0' }, { id: '5' }]);
    expect(d.x).toBe(1);
  });
});

describe('texto das peças', () => {
  test('títulos, parágrafos, citação, lista e destaques', () => {
    const b = lerTexto(`# PETIÇÃO INICIAL

João, **brasileiro**, vem propor
a presente _ação de cobrança_.

> Art. 319. A petição inicial indicará:
> I - o juízo a que é dirigida;

- item um
- item dois
## Dos pedidos
Texto com snake_case_nome intacto.`);
    expect(b.map((x) => x.tipo)).toEqual(['titulo', 'paragrafo', 'citacao', 'lista', 'subtitulo', 'paragrafo']);
    const p = b[1] as { trechos: { t: string; negrito?: boolean; italico?: boolean }[] };
    expect(p.trechos).toEqual([
      { t: 'João, ' },
      { t: 'brasileiro', negrito: true },
      { t: ', vem propor a presente ' },
      { t: 'ação de cobrança', italico: true },
      { t: '.' },
    ]);
    expect(lerTrechos('snake_case_nome')).toEqual([{ t: 'snake_case_nome' }]);
  });
});
