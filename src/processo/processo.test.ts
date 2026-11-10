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

import { acharCitacoes } from './citacoes';
describe('citações nas peças', () => {
  test('artigos com e sem lei, incisos e parágrafos', () => {
    const t = 'Nos termos do art. 319 do CPC e do artigo 5º, LXXIV, da Constituição Federal; ver arts. 1.015, § 1º, e o art. 1-A da Lei 9.099/95. Também art. 300.';
    expect(acharCitacoes(t).map((c) => [c.artigo, c.lei, t.slice(c.inicio, c.fim)])).toEqual([
      ['319', 'CPC', 'art. 319 do CPC'],
      ['5', 'Constituição Federal', 'artigo 5º, LXXIV, da Constituição Federal'],
      ['1015', '', 'arts. 1.015, § 1º'],
      ['1-A', 'Lei 9.099/95', 'art. 1-A da Lei 9.099/95'],
      ['300', '', 'art. 300'],
    ]);
  });
});

import { copiarProcesso, deslocar, diasEntre } from './copiar';
import type { Processo } from './tipos';
describe('copiar para outro semestre', () => {
  test('datas andam juntas; liberado vira agendado na data do evento', () => {
    expect(diasEntre('2026-03-02', '2026-08-03')).toBe(154);
    expect(deslocar('2026-03-10T14:30', 154)).toBe('2026-08-11T14:30');
    const p = {
      id: 'x', usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null, titulo: 'T',
      capa: { numero: '1', classe: '', assuntos: '', valorCausa: '', juizo: '', juiz: '', autuadoEm: '2026-03-02', situacao: '' },
      partes: [],
      eventos: [
        { id: 'a', data: '2026-03-02T10:00', descricao: '', usuario: '', documentos: [], liberacao: { modo: 'agora' } },
        { id: 'b', data: '2026-03-20T10:00', descricao: '', usuario: '', documentos: [], liberacao: { modo: 'data', em: '2026-03-21T08:00' } },
        { id: 'c', data: '2026-04-01T10:00', descricao: '', usuario: '', documentos: [], liberacao: { modo: 'segurar' } },
      ],
      publicacao: { codigo: 'abc', chave: 'k', publicadoEm: '' },
    } as Processo;
    const c = copiarProcesso(p, 'Novo', '2026-08-03');
    expect(c.capa.autuadoEm).toBe('2026-08-03');
    expect(c.capa.numero).toMatch(/\.2026\.8\.99\.0001$/);
    expect(c.publicacao).toBeNull();
    expect(c.eventos.map((e) => e.liberacao)).toEqual([
      { modo: 'data', em: '2026-08-03T10:00' },
      { modo: 'data', em: '2026-08-22T08:00' },
      { modo: 'segurar' },
    ]);
    expect(c.eventos[1].data).toBe('2026-08-21T10:00');
    expect(c.eventos[0].id).not.toBe('a');
  });
});
