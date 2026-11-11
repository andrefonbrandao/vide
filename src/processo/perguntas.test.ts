import { describe, expect, it } from 'vitest';
import type { Questao } from '../jogo/tipos';
import { processoEmBranco } from './banco';
import { assuntoDoProcesso, juntarPerguntas, pedidoPerguntasIA } from './perguntas';
import { dadosParaPublicar } from './publicar';
import { paraAluno } from './liberacao';

const q = (id: string, eventoId: string | null): Questao => ({ id, tipo: 'vf', enunciado: `Q ${id}`, alternativas: ['Verdadeiro', 'Falso'], correta: 0, tempo: 30, explicacao: '', fundamento: '', pasta: '', etiquetas: [], processoId: 'p', eventoId, criado_em: id, atualizado_em: id, excluido_em: null }) as unknown as Questao;

describe('perguntas sobre o processo', () => {
  it('vão junto do evento e só chegam ao aluno com o evento liberado', () => {
    const p = processoEmBranco('Turma A');
    p.eventos = [
      { id: 'e1', data: '2027-03-01T10:00', descricao: 'PETIÇÃO INICIAL', usuario: '', documentos: [], liberacao: { modo: 'agora' } },
      { id: 'e2', data: '2027-03-05T10:00', descricao: 'CONTESTAÇÃO', usuario: '', documentos: [], liberacao: { modo: 'segurar' } },
    ];
    const d = juntarPerguntas(dadosParaPublicar(p), [q('a', null), q('b', 'e2'), q('c', 'apagado')]);
    expect(d.eventos[0].perguntas?.map((x) => x.id)).toEqual(['a', 'c']);
    expect(d.eventos[1].perguntas?.map((x) => x.id)).toEqual(['b']);
    const aluno = paraAluno(d, Date.now());
    expect(aluno.eventos.flatMap((e) => e.perguntas ?? []).map((x) => x.id)).toEqual(['a', 'c']);
    expect(assuntoDoProcesso(p)).toBe('processo: Turma A');
    const pedido = pedidoPerguntasIA(p, { ate: 1, quantas: 5, tipos: 'todos' });
    expect(pedido).toContain('Faça 5 questões');
    expect(pedido).toContain('PETIÇÃO INICIAL');
    expect(pedido).not.toContain('CONTESTAÇÃO |');
  });
});
