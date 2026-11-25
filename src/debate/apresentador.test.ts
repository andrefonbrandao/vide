import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { debate, rotuloAvancarDebate } from './apresentador';
import type { Questao } from '../jogo/tipos';

const base = { id: 'x', usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null, tempo: 20, pasta: '', etiquetas: [] } as unknown as Questao;
const multipla = { ...base, tipo: 'multipla', enunciado: 'Qual o prazo?', alternativas: ['5 dias', '15 dias', '30 dias'], correta: 1, explicacao: 'Art. 335.', fundamento: '335 CPC' } as Questao;
const conceito = { ...base, tipo: 'conceito', enunciado: 'Litispendência', alternativas: [], correta: 0, explicacao: 'Repetição de ação em curso.', fundamento: '', dicas: ['Dica 1', 'Dica 2', 'Dica 3'] } as Questao;

test('questões para debate: riscar, revelar, dicas, anterior/próxima e fim', () => {
  const d = debate();
  d.iniciar('Teste', [multipla, conceito]);
  let t = d.obter().tela!;
  expect(t.indice).toBe(0);
  expect(rotuloAvancarDebate(t)).toBe('Revelar a resposta');
  d.riscar(0);
  d.riscar(2);
  expect(d.obter().tela!.riscadas).toEqual([0, 2]);
  d.riscar(2);
  expect(d.obter().tela!.riscadas).toEqual([0]);
  d.avancar();
  expect(d.obter().tela!.revelada).toBe(true);
  expect(rotuloAvancarDebate(d.obter().tela!)).toBe('Próxima questão');
  d.avancar();
  t = d.obter().tela!;
  expect(t.indice).toBe(1);
  expect(t.dicasVisiveis).toBe(1);
  expect(rotuloAvancarDebate(t)).toBe('Próxima dica');
  d.avancar();
  d.avancar();
  expect(d.obter().tela!.dicasVisiveis).toBe(3);
  expect(rotuloAvancarDebate(d.obter().tela!)).toBe('Revelar o conceito');
  d.avancar();
  expect(rotuloAvancarDebate(d.obter().tela!)).toBe('Terminar');
  // Voltar: a questão anterior continua como estava (riscos e resposta revelada).
  d.voltar();
  t = d.obter().tela!;
  expect(t.indice).toBe(0);
  expect(t.riscadas).toEqual([0]);
  expect(t.revelada).toBe(true);
  d.avancar();
  d.avancar();
  expect(d.obter().tela!.fim).toBe(true);
  d.voltar();
  expect(d.obter().tela!.fim).toBe(false);
  d.encerrar();
  expect(d.obter().ativo).toBe(false);
});
