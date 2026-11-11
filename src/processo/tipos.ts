// Processo fictício: o professor monta, a turma acompanha pelo link ao longo do semestre.
import type { Sincronizavel } from '../dados/modelo';
import type { BlocoArtigo } from '../treino/tipos';
import type { Fala } from '../consulta/tipos';
import type { FaseId } from './fases';
import type { Termo } from './glossario';
import type { Prazo } from './prazos';
import type { Vicio } from './vicios';

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

/** Texto de um artigo citado numa peça (levado junto no link). */
export interface ArtigoCitado {
  titulo: string;
  blocos: BlocoArtigo[];
}

export interface Documento {
  id: string;
  /** Nome curto, como no eproc: INIC1, PROC2, CONT1. */
  sigla: string;
  titulo: string;
  /** texto: escrito no Vide; pdf: um PDF anexado (guardado nos materiais do acervo). */
  tipo: 'texto' | 'pdf';
  /** Texto da peça, com marcações simples (# título, > citação, **negrito**, _itálico_). */
  texto: string;
  /** PDF: o material do acervo (na tela do professor) e o arquivo publicado (no link). */
  materialId?: string;
  arquivo?: string;
  paginas?: number;
  /** No link: o texto dos artigos citados na peça, pela chave da citação. */
  artigos?: Record<string, ArtigoCitado>;
  /** Caça aos vícios: defeitos plantados (no link, só depois que a conferência é liberada). */
  vicios?: Vicio[];
  /** No link, com a conferência fechada: só quantos vícios a peça tem. */
  qtdVicios?: number;
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
  /** Fase no mapa do procedimento (vazio = a sugerida pela descrição). */
  fase?: FaseId | null;
  /** Prazo que este evento abre (contado da data do evento). */
  prazo?: Prazo | null;
  /** "E agora?": votação da turma em aula, antes de liberar este evento. */
  agora?: EAgora | null;
}

export interface EAgora {
  pergunta: string;
  opcoes: string[];
}

/** "Cliente em cena": o caso da Consulta que abre o processo (o cliente conta o problema). */
export interface ClienteProcesso {
  casoId: string;
  /** O personagem sorteado uma vez e guardado (sempre o mesmo rosto). */
  personagem: string;
}

/** O cliente como vai para o link. */
export interface ClientePublicado {
  nome: string;
  personagem: string;
  falas: Fala[];
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
  /** PDFs já enviados ao link (ids dos materiais). */
  arquivos?: string[];
}

/** Um processo da biblioteca do professor. */
export interface Processo extends Sincronizavel {
  /** Nome interno (só o professor vê): "Turma 2027/1 — ação de cobrança". */
  titulo: string;
  capa: Capa;
  partes: Parte[];
  eventos: Evento[];
  publicacao?: Publicacao | null;
  /** Termos próprios do glossário (somam-se aos do Vide). */
  glossario?: Termo[];
  cliente?: ClienteProcesso | null;
  /** Caça aos vícios: a turma já pode conferir as marcações? */
  conferenciaVicios?: boolean;
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
  glossario?: Termo[];
  cliente?: ClientePublicado | null;
}

export function urlDoProcesso(codigo: string): string {
  return `${location.origin}/p/${codigo}`;
}
