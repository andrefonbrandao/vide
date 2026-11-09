import { describe, expect, test } from 'vitest';
import { dicasForca, errosForca, letraBase, letraValida, mascararPalavra, palavraCompleta } from './forca';
import { MotorJogo } from './motor';
import type { QuestaoJogo } from './tipos';

const conceito = (enunciado: string, dicas = ['d1', 'd2', 'd3', 'd4']): QuestaoJogo => ({
  tipo: 'conceito', enunciado, alternativas: [], correta: 0, tempo: 60, explicacao: '', fundamento: '', dicas, aceitas: [],
});

describe('regras da forca', () => {
  test('acentos e cedilha contam como a letra base', () => {
    expect(letraBase('ã')).toBe('A');
    expect(letraBase('Ç')).toBe('C');
    expect(letraBase('-')).toBeNull();
    expect(letraValida('é')).toBe('E');
    expect(letraValida('ab')).toBeNull();
    expect(letraValida(3)).toBeNull();
  });

  test('máscara mostra espaços e hífens; letras aparecem com acento', () => {
    expect(mascararPalavra('Coisa julgada', [])).toEqual([null, null, null, null, null, ' ', null, null, null, null, null, null, null]);
    expect(mascararPalavra('ação', ['A']).join('|')).toBe('a||ã|');
    expect(mascararPalavra('pró-labore', ['O'])).toEqual([null, null, 'ó', '-', null, null, null, 'o', null, null]);
  });

  test('erros, palavra completa e dicas', () => {
    expect(errosForca('sentença', ['S', 'X', 'E', 'Z'])).toBe(2);
    expect(palavraCompleta('sentença', ['S', 'E', 'N', 'T', 'C'])).toBe(false);
    expect(palavraCompleta('sentença', ['S', 'E', 'N', 'T', 'C', 'A'])).toBe(true);
    expect(dicasForca(4, 0)).toBe(1);
    expect(dicasForca(4, 2)).toBe(2);
    expect(dicasForca(4, 5)).toBe(3);
    expect(dicasForca(2, 6)).toBe(2);
    expect(dicasForca(0, 3)).toBe(0);
  });
});

describe('forca em sala (turma toda)', () => {
  test('letra mais votada entra; a turma descobre a palavra', () => {
    const m = new MotorJogo([conceito('Réu')], true, 'forca', 10_000);
    expect(m.ranking).toBe(false);
    m.entrar('a', 'Ana');
    m.entrar('b', 'Bia');
    m.entrar('c', 'Caio');
    m.avancar(0);
    expect(m.visaoTela().forca?.mascara).toEqual([null, null, null]);
    // Celular nunca recebe a palavra durante a rodada.
    expect(JSON.stringify(m.visaoAlunoComum(0))).not.toContain('Réu');
    expect(m.votar('a', 0, 'e')).toBe(true);
    expect(m.votar('b', 0, 'E')).toBe(true);
    expect(m.votar('c', 0, 'x')).toBe(true);
    expect(m.visaoPessoal('a')?.voto).toBe('E');
    // Todos votaram: fecha na hora.
    expect(m.passoForca(1_000)).toBe(true);
    const f = m.visaoTela().forca!;
    expect(f.mascara).toEqual([null, 'é', null]);
    expect(f.ultima).toEqual({ letra: 'E', acertou: true, votos: 2 });
    expect(m.votar('a', 0, 'E')).toBe(false); // já jogada
    // Sem todos votarem, espera o tempo.
    m.votar('a', 0, 'R');
    expect(m.passoForca(5_000)).toBe(false);
    expect(m.passoForca(11_000)).toBe(true);
    m.votar('b', 0, 'U');
    expect(m.passoForca(21_000)).toBe(true);
    expect(m.fase).toBe('resultado');
    const h = m.historico[0];
    expect(h.forca).toEqual({ venceu: true, erros: 0, letras: ['E', 'R', 'U'] });
    expect(h.respostas).toEqual([1]);
    expect(m.visaoAlunoComum(21_000).conceito).toBe('Réu');
    expect(m.visaoPessoal('c')?.acertou).toBe(true);
  });

  test('seis erros: a forca vence; ninguém votando abre nova votação', () => {
    const m = new MotorJogo([conceito('ab'), conceito('cd')], true, 'forca', 10_000);
    m.entrar('a', 'Ana');
    m.avancar(0);
    expect(m.passoForca(10_000)).toBe(true); // ninguém votou
    expect(m.visaoTela().forca?.letras).toEqual([]);
    expect(m.votoPrazo).toBe(20_000);
    let t = 10_000;
    for (const l of ['X', 'Y', 'Z', 'W', 'K']) {
      m.votar('a', 0, l);
      m.passoForca((t += 1));
    }
    expect(m.fase).toBe('pergunta');
    expect(m.visaoTela().dicasVisiveis).toBe(3);
    m.votar('a', 0, 'Q');
    m.passoForca((t += 1));
    expect(m.fase).toBe('resultado');
    expect(m.historico[0].forca?.venceu).toBe(false);
    expect(m.visaoTela().forca?.fim).toBe('perdeu');
    m.avancar(t);
    expect(m.fase).toBe('pergunta'); // sem placar: direto para a próxima palavra
    expect(m.indice).toBe(1);
  });

  test('chute da palavra inteira, com tolerância; errado não custa à turma', () => {
    const m = new MotorJogo([conceito('Coisa julgada'), conceito('Sentença')], true, 'forca');
    m.entrar('a', 'Ana');
    m.entrar('b', 'Bia');
    m.avancar(0);
    expect(m.responderTexto('a', 0, 'sentença', 1_000)).toBe('errado'); // outro conceito do jogo
    expect(m.visaoTela().forca?.erros).toBe(0);
    expect(m.responderTexto('a', 0, 'coisa julgda', 2_000)).toBe('aguarde');
    expect(m.responderTexto('b', 0, 'a coisa julgda', 2_000)).toBe('certo');
    expect(m.fase).toBe('resultado');
    expect(m.visaoTela().forca?.fim).toBe('venceu');
    expect(m.visaoPessoal('a')?.digitou).toBe('sentença');
    expect(m.historico[0].tentativas?.map((x) => x.situacao).sort()).toEqual(['errada', 'parecida']);
  });

  test('professor revela a palavra antes do fim', () => {
    const m = new MotorJogo([conceito('prova')], true, 'forca');
    m.entrar('a', 'Ana');
    m.avancar(0);
    m.avancar(1_000);
    expect(m.fase).toBe('resultado');
    expect(m.visaoTela().forca?.fim).toBe('encerrada');
    expect(m.visaoTela().forca?.mascara.every((c) => c === null)).toBe(true); // o projetor mostra a palavra com as letras que faltaram destacadas
    expect(m.historico[0].forca?.venceu).toBe(false);
  });
});
