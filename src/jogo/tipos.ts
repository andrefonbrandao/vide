// Questões, questionários e o jogo de perguntas (estilo quiz) do Vide.
import type { Sincronizavel } from '../dados/modelo';

export type TipoQuestao = 'multipla' | 'vf';

/** Uma questão do acervo. */
export interface Questao extends Sincronizavel {
  tipo: TipoQuestao;
  enunciado: string;
  /** Na de verdadeiro/falso: ["Verdadeiro", "Falso"]. */
  alternativas: string[];
  /** Posição da alternativa correta (0 = A). */
  correta: number;
  /** Tempo para responder, em segundos. */
  tempo: number;
  explicacao: string;
  /** Dispositivo que fundamenta a resposta, como se digita na aula: "485 VI", "5 CF". */
  fundamento: string;
  pasta: string;
  etiquetas: string[];
}

/** Uma sequência de questões para usar numa aula. */
export interface Questionario extends Sincronizavel {
  nome: string;
  /** Ids das questões, na ordem. */
  questoes: string[];
}

/** Números de um jogo, sem nenhum nome ou apelido de aluno. */
export interface ResultadoJogo extends Sincronizavel {
  questionario: string;
  em: string;
  participantes: number;
  ranking: boolean;
  perguntas: ResultadoPergunta[];
}

export interface ResultadoPergunta {
  enunciado: string;
  alternativas: string[];
  correta: number;
  /** Quantos marcaram cada alternativa. */
  respostas: number[];
  /** Quantos participantes não responderam a tempo. */
  semResposta: number;
}

/** A questão como entra no jogo (só o necessário). */
export interface QuestaoJogo {
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: string[];
  correta: number;
  tempo: number;
  explicacao: string;
  fundamento: string;
}

export const TEMPO_PADRAO = 30;
export const TEMPOS = [10, 20, 30, 45, 60, 90, 120];
export const LETRAS = ['A', 'B', 'C', 'D'];
