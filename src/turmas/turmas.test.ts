import { describe, expect, it } from 'vitest';
import { pertenceConteudo, pertenceTurma } from './filtro';
import { aulaAgora, proximaAula } from './horarios';
import type { Turma } from './tipos';

const turma = (id: string, horarios: Turma['horarios'], extra: Partial<Turma> = {}): Turma =>
  ({ id, disciplinaId: 'd1', periodo: '2026.2', horarios, usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null, ...extra }) as Turma;

describe('horários das aulas', () => {
  // 10/11/2026 é terça-feira.
  const ter = turma('t1', [{ dia: 2, inicio: '19:00', fim: '20:40' }, { dia: 4, inicio: '19:00', fim: '20:40' }]);
  it('acha a aula de agora, de 15 minutos antes até o fim', () => {
    expect(aulaAgora([ter], new Date(2026, 10, 10, 18, 44))).toBeNull();
    expect(aulaAgora([ter], new Date(2026, 10, 10, 18, 45))?.turma.id).toBe('t1');
    expect(aulaAgora([ter], new Date(2026, 10, 10, 20, 40))?.turma.id).toBe('t1');
    expect(aulaAgora([ter], new Date(2026, 10, 10, 20, 41))).toBeNull();
    expect(aulaAgora([ter], new Date(2026, 10, 11, 19, 0))).toBeNull(); // quarta
  });
  it('respeita o semestre e as turmas arquivadas', () => {
    expect(aulaAgora([{ ...ter, fim: '2026-11-01' }], new Date(2026, 10, 10, 19, 0))).toBeNull();
    expect(aulaAgora([{ ...ter, arquivada: true }], new Date(2026, 10, 10, 19, 0))).toBeNull();
  });
  it('acha a próxima aula', () => {
    const p = proximaAula([ter], new Date(2026, 10, 10, 21, 0));
    expect(p?.comeca.getDate()).toBe(12); // quinta
    expect(p?.comeca.getHours()).toBe(19);
    expect(proximaAula([ter], new Date(2026, 10, 10, 19, 30))?.comeca.getDate()).toBe(10); // a de agora ainda não acabou
  });
});

describe('filtro da turma', () => {
  const f = { turmaId: 't1', disciplinaId: 'd1', rotulo: 'PC1 · 2026.2', cor: '#000' };
  it('conteúdo: da disciplina ou sem disciplina', () => {
    expect(pertenceConteudo({ disciplinas: ['d1', 'd2'] }, f)).toBe(true);
    expect(pertenceConteudo({ disciplinas: ['d2'] }, f)).toBe(false);
    expect(pertenceConteudo({}, f)).toBe(true);
    expect(pertenceConteudo({ disciplinas: ['d2'] }, null)).toBe(true);
  });
  it('do semestre: da turma ou sem turma', () => {
    expect(pertenceTurma({ turmaId: 't1' }, f)).toBe(true);
    expect(pertenceTurma({ turmaId: 't2' }, f)).toBe(false);
    expect(pertenceTurma({ turmaId: null }, f)).toBe(true);
  });
});
