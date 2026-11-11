// Jogo "Consulta": casos práticos contados por um personagem, resolvidos em grupo.
import type { VinculoConteudo } from '../turmas/tipos';
import type { Sincronizavel } from '../dados/modelo';
import type { Expressao } from './personagens';

export interface Fala {
  expressao: Expressao;
  texto: string;
}

export type QuemResponde = 'advogado' | 'juiz';

/** Quem conta o caso (para sortear um personagem compatível). */
export interface PessoaCaso {
  genero?: 'mulher' | 'homem';
  idade?: 'jovem' | 'adulto' | 'idoso';
}

/** Os dados de um caso (como vêm da importação ou do formulário). */
export interface DadosCaso {
  /** Nome fictício de quem consulta. */
  nome: string;
  pessoa: PessoaCaso;
  falas: Fala[];
  resposta: string;
  quemResponde: QuemResponde;
  fundamento: string;
  /** Minutos para a turma discutir. */
  tempo: number;
}

/** Um caso do acervo. */
export interface Caso extends Sincronizavel, DadosCaso, VinculoConteudo {
  pasta: string;
  etiquetas: string[];
}

export const TEMPO_PADRAO_CASO = 5;
export const OPCOES_TEMPO_CASO = [2, 3, 4, 5, 7, 10, 15];
