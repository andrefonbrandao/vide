// Treino em casa: grupo de questões publicado num link para os alunos treinarem sozinhos.
import type { Sincronizavel } from '../dados/modelo';
import type { QuestaoJogo } from '../jogo/tipos';
import type { DadosCaso } from '../consulta/tipos';

export interface BlocoArtigo {
  rotulo: string;
  texto: string;
  nivel: number;
  destaque: boolean;
}

/** Questão como vai para o link: com o texto do artigo do fundamento, se houver. */
export interface QuestaoTreino extends QuestaoJogo {
  artigo?: { titulo: string; blocos: BlocoArtigo[] } | null;
}

/** Caso (jogo "Consulta") como vai para o link, com o texto do artigo do fundamento. */
export interface CasoTreino extends DadosCaso {
  artigo?: QuestaoTreino['artigo'];
}

/** O que fica publicado no Cloudflare (o aluno lê isto). */
export interface DadosTreino {
  formato: 'vide-treino@1';
  titulo: string;
  criado_em: string;
  /** fixo: sempre as mesmas questões, nesta ordem; sorteio: a cada sessão, sorteia "quantas" do conjunto. */
  modo: 'fixo' | 'sorteio';
  quantas: number;
  /** Quando o aluno vê a resposta certa: logo após cada questão ou só no fim. */
  mostrar: 'cada' | 'fim';
  /** forca: cada conceito vira uma forca individual; consulta: casos com personagens (sem o campo: questões normais). */
  jogo?: 'forca' | 'consulta';
  questoes: QuestaoTreino[];
  /** Consulta: os casos (no lugar das questões). */
  casos?: CasoTreino[];
}

/** Um link criado pelo professor (guardado no navegador e no Drive). */
export interface LinkTreino extends Sincronizavel {
  /** O código do link (/t/<codigo>). */
  codigo: string;
  /** Senha que só o navegador do professor tem: permite apagar o link. */
  chave: string;
  titulo: string;
  modo: DadosTreino['modo'];
  quantas: number;
  mostrar: DadosTreino['mostrar'];
  /** Quantas questões há no conjunto publicado. */
  total: number;
  /** De onde vieram as questões ("Questionário: Revisão", "Assunto: sentença"…). */
  origem: string;
  jogo?: DadosTreino['jogo'];
}

export function urlDoTreino(codigo: string): string {
  return `${location.origin}/t/${codigo}`;
}
