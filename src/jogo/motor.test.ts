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

describe('adivinhe o conceito', () => {
  const c: QuestaoJogo = {
    tipo: 'conceito', enunciado: 'Sentença', alternativas: [], correta: 0, tempo: 60, explicacao: '', fundamento: '',
    dicas: ['sou uma manifestação judicial', 'devo ser congruente com o pedido', 'posso ser terminativa'], aceitas: ['sentença judicial'],
  };
  test('dicas graduais, espera de 5 s após erro, pontos pelo tempo e quem acertou', () => {
    const m = new MotorJogo([c], true);
    m.entrar('a', 'Ana');
    m.entrar('b', 'Bia');
    m.entrar('c', 'Caio');
    m.avancar(0);
    const v0 = m.visaoAlunoComum(1_000);
    expect(v0.pergunta?.enunciado).toBe(''); // a resposta não vai para o celular
    expect(v0.pergunta?.dicas).toEqual(['sou uma manifestação judicial']);
    expect(v0.pergunta?.proximaDicaMs).toBe(19_000);
    expect(m.visaoAlunoComum(25_000).pergunta?.dicas).toHaveLength(2);
    expect(m.responderTexto('a', 0, 'decisão', 2_000)).toBe('errado');
    expect(m.responderTexto('a', 0, 'sentença', 4_000)).toBe('aguarde');
    expect(m.visaoPessoal('a', 4_000)).toMatchObject({ errou: true, aguardarMs: 3_000 });
    expect(m.responderTexto('a', 0, 'A SENTENCA', 30_000)).toBe('certo');
    expect(m.responderTexto('a', 0, 'sentença', 31_000)).toBe('invalido'); // já acertou
    expect(m.responderTexto('b', 0, 'sentença judicial', 10_000)).toBe('certo');
    expect(m.visaoTela().acertaram.map((x) => [x.apelido, x.dicas])).toEqual([['Bia', 1], ['Ana', 2]]);
    expect(m.todosResponderam()).toBe(false);
    m.avancar(60_000);
    expect(m.visaoPessoal('b')).toMatchObject({ acertou: true, ganho: 883 });
    expect(m.visaoPessoal('a')).toMatchObject({ acertou: true, ganho: 650 });
    expect(m.visaoPessoal('c')).toMatchObject({ acertou: false, ganho: 0, resposta: null });
    expect(m.visaoAlunoComum(60_000).conceito).toBe('Sentença');
    expect(m.historico[0]).toMatchObject({ enunciado: 'Conceito: Sentença', respostas: [2], semResposta: 1 });
    expect(m.visaoTela().acertoPorPergunta).toEqual([67]);
  });
  test('responder texto numa múltipla escolha é ignorado', () => {
    const m = new MotorJogo([q(0)]);
    m.entrar('a', 'Ana');
    m.avancar(0);
    expect(m.responderTexto('a', 0, 'a', 10)).toBe('invalido');
  });
});

describe('respostas digitadas do conceito', () => {
  test('anota as tentativas sem nome, tolera erro de digitação e guarda o que cada um digitou', () => {
    const c = (enunciado: string, id: string): QuestaoJogo => ({
      id, tipo: 'conceito', enunciado, alternativas: [], correta: 0, tempo: 60, explicacao: '', fundamento: '', dicas: ['d1', 'd2'],
    });
    const m = new MotorJogo([c('preclusão', 'q1'), c('precluso', 'q2')]);
    m.entrar('a', 'Ana');
    m.entrar('b', 'Bia');
    m.entrar('c', 'Caio');
    m.avancar(0);
    expect(m.responderTexto('a', 0, 'preclusao', 1_000)).toBe('certo');
    expect(m.responderTexto('b', 0, 'precluzão', 2_000)).toBe('certo'); // 1 letra errada
    expect(m.responderTexto('c', 0, 'decadência', 3_000)).toBe('errado');
    expect(m.responderTexto('c', 0, 'Decadência', 9_000)).toBe('errado');
    m.avancar(10_000);
    expect(m.historico[0].questaoId).toBe('q1');
    expect(m.historico[0].tentativas).toEqual([
      { texto: 'decadência', vezes: 2, situacao: 'errada' },
      { texto: 'precluzão', vezes: 1, situacao: 'parecida' },
    ]);
    expect(m.visaoPessoal('c')?.digitou).toBe('Decadência');
    expect(m.visaoPessoal('b')?.digitou).toBeUndefined();
    // 2ª rodada: "preclusão" é a resposta do outro conceito, não vale por semelhança
    m.avancar(10_500); // placar
    m.avancar(11_000); // 2ª questão
    expect(m.responderTexto('a', 1, 'preclusão', 12_000)).toBe('errado');
    expect(m.responderTexto('b', 1, 'precluso', 12_000)).toBe('certo');
  });
});
