// Treino em casa: grupo de questões publicado num link para os alunos treinarem sozinhos.
import type { Sincronizavel } from '../dados/modelo';
import type { QuestaoJogo } from '../jogo/tipos';

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
  questoes: QuestaoTreino[];
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
}

export function urlDoTreino(codigo: string): string {
  return `${location.origin}/t/${codigo}`;
}
