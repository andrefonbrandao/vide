import { describe, expect, test } from 'vitest';
import { MotorJogo, calcularPontos } from './motor';
import type { QuestaoJogo } from './tipos';

const q = (correta: number, tempo = 20): QuestaoJogo => ({
  tipo: 'multipla', enunciado: `Q${correta}`, alternativas: ['a', 'b', 'c', 'd'], correta, tempo, explicacao: '', fundamento: '',
});

describe('motor do jogo', () => {
  test('pontos caem com o tempo', () => {
    expect(calcularPontos(0, 20_000)).toBe(1000);
    expect(calcularPontos(10_000, 20_000)).toBe(750);
    expect(calcularPontos(20_000, 20_000)).toBe(500);
    expect(calcularPontos(99_000, 20_000)).toBe(500);
  });

  test('apelidos repetidos ganham número; reconexão mantém o apelido', () => {
    const m = new MotorJogo([q(0)]);
    expect(m.entrar('t1', 'Ana')).toBe('Ana');
    expect(m.entrar('t2', 'ana')).toBe('ana 2');
    expect(m.entrar('t3', '   ')).toBe('Participante');
    m.definirConectado('t1', false);
    expect(m.entrar('t1', 'Outro')).toBe('Ana');
  });

  test('rodada completa com ranking', () => {
    const m = new MotorJogo([q(1), q(2)], true);
    m.entrar('a', 'Ana');
    m.entrar('b', 'Bia');
    m.avancar(0); // pergunta 1
    expect(m.fase).toBe('pergunta');
    expect(m.responder('a', 0, 1, 2_000)).toBe(true); // certa e rápida
    expect(m.responder('a', 0, 2, 3_000)).toBe(false); // segunda resposta não vale
    expect(m.responder('b', 0, 3, 5_000)).toBe(true); // errada
    expect(m.todosResponderam()).toBe(true);
    m.avancar(6_000); // encerra
    expect(m.fase).toBe('resultado');
    expect(m.visaoTela().distribuicao).toEqual([0, 1, 0, 1]);
    expect(m.visaoPessoal('a')).toMatchObject({ acertou: true, ganho: 950, pontos: 950, posicao: 1 });
    expect(m.visaoPessoal('b')).toMatchObject({ acertou: false, ganho: 0, resposta: 3, posicao: 2 });
    m.avancar(7_000);
    expect(m.fase).toBe('ranking');
    m.avancar(8_000); // pergunta 2
    expect(m.indice).toBe(1);
    expect(m.responder('b', 0, 2, 8_500)).toBe(false); // índice antigo
    expect(m.responder('b', 1, 2, 9_000)).toBe(true);
    expect(m.responder('a', 1, 2, 40_000)).toBe(false); // fora do tempo
    m.avancar(29_000);
    m.avancar(30_000);
    expect(m.fase).toBe('fim');
    const v = m.visaoTela();
    expect(v.acertoPorPergunta).toEqual([50, 50]);
    expect(v.acertoGeral).toBe(50);
    expect(v.classificacao.map((c) => c.apelido)).toEqual(['Bia', 'Ana']);
    expect(m.historico[1]).toMatchObject({ respostas: [0, 0, 1, 0], semResposta: 1 });
  });

  test('sem ranking pula o placar e não expõe posição', () => {
    const m = new MotorJogo([q(0), q(0)], false);
    m.entrar('a', 'Ana');
    m.avancar(0);
    m.avancar(1);
    m.avancar(2);
    expect(m.fase).toBe('pergunta');
    expect(m.visaoPessoal('a')?.posicao).toBeNull();
    expect(m.visaoTela().classificacao).toEqual([]);
  });

  test('a visão do aluno não revela a resposta durante a pergunta', () => {
    const m = new MotorJogo([q(3)]);
    m.entrar('a', 'Ana');
    m.avancar(1_000);
    const v = m.visaoAlunoComum(6_000);
    expect(v.correta).toBeNull();
    expect(v.pergunta?.restanteMs).toBe(15_000);
    m.avancar(7_000);
    expect(m.visaoAlunoComum(7_000).correta).toBe(3);
  });
});
