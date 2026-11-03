import { describe, expect, test } from 'vitest';
import { MODELO_IMPORTACAO, importarQuestoes } from './importar';

describe('importar questões', () => {
  test('modelo', () => {
    const r = importarQuestoes(MODELO_IMPORTACAO);
    expect(r.erros).toEqual([]);
    expect(r.questoes).toHaveLength(2);
    expect(r.questoes[0]).toMatchObject({
      tipo: 'multipla', correta: 2, tempo: 30, fundamento: '335',
      enunciado: 'Qual o prazo para contestar no procedimento comum?',
      alternativas: ['5 dias', '10 dias', '15 dias', '30 dias'],
      explicacao: 'O prazo é de 15 dias úteis.',
    });
    expect(r.questoes[1]).toMatchObject({ tipo: 'vf', correta: 0, alternativas: ['Verdadeiro', 'Falso'], fundamento: '240' });
  });

  test('variações de escrita', () => {
    const r = importarQuestoes(`Questão 1: O recurso cabível contra sentença é
a apelação ou o agravo?
a. Apelação
*b. Agravo de instrumento
c) Embargos
Gabarito: letra A

Q2) Julgue: o prazo de apelação é de 15 dias.
Resposta: Certo
Comentário: art. 1.003, § 5º.
Continua aqui.
Fundamento: art. 1003 §5

3. Marque a correta
A) um
B) dois (correta)
Tempo: 999`);
    expect(r.erros).toEqual([]);
    expect(r.questoes.map((q) => [q.tipo, q.correta])).toEqual([['multipla', 0], ['vf', 0], ['multipla', 1]]);
    expect(r.questoes[0].enunciado).toBe('O recurso cabível contra sentença é a apelação ou o agravo?');
    expect(r.questoes[1].explicacao).toBe('art. 1.003, § 5º. Continua aqui.');
    expect(r.questoes[1].fundamento).toBe('1003 §5');
    expect(r.questoes[2].tempo).toBe(240);
  });

  test('blocos sem número, separados por linha em branco', () => {
    const r = importarQuestoes(`A citação válida induz litispendência.
Resposta: V

A revelia sempre gera presunção absoluta.
Resposta: F`);
    expect(r.questoes.map((q) => q.correta)).toEqual([0, 1]);
  });

  test('erros apontam a questão', () => {
    const r = importarQuestoes(`1. Sem resposta
A) x
B) y

2. Resposta inválida
A) x
B) y
Resposta: E

3. V ou F sem resposta`);
    expect(r.questoes).toHaveLength(0);
    expect(r.erros.map((e) => e.numero)).toEqual([1, 2, 3]);
    expect(r.erros[1].mensagem).toMatch(/não corresponde/);
  });
});

describe('assuntos', () => {
  test('linha "Assunto:" vira assunto da questão', () => {
    const r = importarQuestoes(`1. Pergunta
A) x
B) y
Resposta: A
Assunto: Sentença, Recursos

2. Afirmação
Resposta: F
Temas: sentença`);
    expect(r.erros).toEqual([]);
    expect(r.questoes.map((q) => q.assuntos)).toEqual([['sentença', 'recursos'], ['sentença']]);
  });
  test('o modelo traz assuntos', () => {
    expect(importarQuestoes(MODELO_IMPORTACAO).questoes[0].assuntos).toEqual(['contestação', 'prazos']);
  });
});
