// Processo fictício: o professor monta, a turma acompanha pelo link ao longo do semestre.
import type { Sincronizavel } from '../dados/modelo';

export type Polo = 'ativo' | 'passivo' | 'outro';

export interface Advogado {
  nome: string;
  oab: string;
}

export interface Parte {
  id: string;
  polo: Polo;
  nome: string;
  /** "Pessoa física", "Pessoa jurídica"… */
  qualificacao: string;
  advogados: Advogado[];
}

export interface Documento {
  id: string;
  /** Nome curto, como no eproc: INIC1, PROC2, CONT1. */
  sigla: string;
  titulo: string;
  tipo: 'texto';
  /** Texto da peça, com marcações simples (# título, > citação, **negrito**, _itálico_). */
  texto: string;
}

/** Quando o evento aparece para os alunos. */
export type Liberacao = { modo: 'agora' } | { modo: 'data'; em: string } | { modo: 'segurar' };

export interface Evento {
  id: string;
  /** Data e hora do ato (fictícias), "AAAA-MM-DDTHH:MM". */
  data: string;
  descricao: string;
  /** Quem praticou o ato: ADVOGADO DO AUTOR, JUIZ… */
  usuario: string;
  documentos: Documento[];
  liberacao: Liberacao;
}

export interface Capa {
  numero: string;
  classe: string;
  assuntos: string;
  valorCausa: string;
  juizo: string;
  juiz: string;
  /** "AAAA-MM-DD". */
  autuadoEm: string;
  situacao: string;
}

export interface Publicacao {
  codigo: string;
  /** Senha que só o navegador do professor tem: permite atualizar e apagar o link. */
  chave: string;
  publicadoEm: string;
}

/** Um processo da biblioteca do professor. */
export interface Processo extends Sincronizavel {
  /** Nome interno (só o professor vê): "Turma 2027/1 — ação de cobrança". */
  titulo: string;
  capa: Capa;
  partes: Parte[];
  eventos: Evento[];
  publicacao?: Publicacao | null;
}

/** Evento como vai para o link: com a liberação já em milissegundos (null = segurado). */
export interface EventoPublicado extends Omit<Evento, 'liberacao'> {
  numero: number;
  libera: number | null;
}

/** O que fica publicado no Cloudflare. O serviço só entrega os eventos já liberados. */
export interface DadosProcesso {
  formato: 'vide-processo@1';
  capa: Capa;
  partes: Parte[];
  eventos: EventoPublicado[];
  publicadoEm: string;
}

export function urlDoProcesso(codigo: string): string {
  return `${location.origin}/p/${codigo}`;
}
