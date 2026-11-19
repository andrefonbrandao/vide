// Orientação de trabalhos acadêmicos (caderno do orientador).
// Tudo fica neste computador e no Google Drive do professor; nada vai para o servidor.
import type { Sincronizavel } from '../dados/modelo';

export interface Orientando extends Sincronizavel {
  nome: string;
  email: string;
  telefone: string;
  /** Curso, nível ou instituição: "Graduação em Direito — 9º semestre". */
  curso: string;
  observacoes: string;
}

export type TipoTrabalho = 'TCC' | 'Monografia' | 'Artigo' | 'Dissertação' | 'Tese' | 'Outro';
export const TIPOS_TRABALHO: TipoTrabalho[] = ['TCC', 'Monografia', 'Artigo', 'Dissertação', 'Tese', 'Outro'];

/** Uma etapa do cronograma, com o prazo ("AAAA-MM-DD"). */
export interface Etapa {
  id: string;
  nome: string;
  prazo: string;
  /** Quando foi cumprida ("AAAA-MM-DD"); null = em aberto. */
  concluida_em?: string | null;
}

export type SituacaoTrabalho = 'andamento' | 'concluido' | 'interrompido';

/** Elementos do projeto de pesquisa (como no manual de normalização: tema e problema, hipóteses, objetivos, justificativa, metodologia). */
export interface Elementos {
  tema: string;
  delimitacao: string;
  /** De preferência, uma pergunta. */
  problema: string;
  hipoteses: string;
  justificativa: string;
  objetivoGeral: string;
  /** Um por item, começando com verbo no infinitivo. */
  objetivosEspecificos: string[];
  metodologia: string;
  /** Última alteração ("AAAA-MM-DD"). */
  atualizado_em?: string;
}

export const ELEMENTOS_VAZIOS: Elementos = { tema: '', delimitacao: '', problema: '', hipoteses: '', justificativa: '', objetivoGeral: '', objetivosEspecificos: [], metodologia: '' };

export interface Trabalho extends Sincronizavel {
  orientandoId: string;
  titulo: string;
  tipo: TipoTrabalho;
  /** Começo da orientação ("AAAA-MM-DD"). */
  inicio: string;
  /** Defesa ou entrega final prevista ("AAAA-MM-DD"). */
  defesa?: string;
  etapas: Etapa[];
  situacao: SituacaoTrabalho;
  /** Tema, problema, objetivos… (o que já foi definido). */
  elementos?: Elementos;
}

export type Canal = 'sessao' | 'whatsapp' | 'email' | 'telefone' | 'outro';
export const CANAIS: { id: Canal; nome: string }[] = [
  { id: 'sessao', nome: 'Sessão de orientação' },
  { id: 'whatsapp', nome: 'WhatsApp' },
  { id: 'email', nome: 'E-mail' },
  { id: 'telefone', nome: 'Telefone' },
  { id: 'outro', nome: 'Outro' },
];

/** Sugestão (o orientando decide) ou comando (deve fazer). */
export interface Encaminhamento {
  id: string;
  tipo: 'sugestao' | 'comando';
  texto: string;
  situacao: 'pendente' | 'cumprido' | 'descartado';
  /** Prazo opcional ("AAAA-MM-DD"). */
  prazo?: string;
  /** Quando foi resolvido ("AAAA-MM-DD"). */
  resolvido_em?: string | null;
}

/** Uma sessão de orientação ou uma comunicação (WhatsApp, e-mail…). */
export interface Interacao extends Sincronizavel {
  trabalhoId: string;
  canal: Canal;
  /** Quando aconteceu ("AAAA-MM-DDTHH:MM"). */
  em: string;
  /** Sessão: presencial ou online. */
  modo?: 'presencial' | 'online';
  /** O que foi conversado, em poucas linhas. */
  resumo: string;
  /** A conversa colada (WhatsApp, e-mail), como veio; na sessão, as anotações. */
  texto: string;
  /** Sessão transcrita pelo microfone: uma linha por trecho, "[HH:MM] texto". */
  transcricao?: string;
  encaminhamentos: Encaminhamento[];
  /** Versão do trabalho discutida nesta interação. */
  versaoId?: string | null;
}

/** Uma versão provisória do trabalho (o arquivo e as anotações do orientador). */
export interface Versao extends Sincronizavel {
  trabalhoId: string;
  /** "Versão 3 — capítulo 2". */
  rotulo: string;
  /** Nome original do arquivo. */
  nomeArquivo: string;
  mime: string;
  tamanho: number;
  /** Quando foi recebida ("AAAA-MM-DD"). */
  recebida_em: string;
  etapaId?: string | null;
  notas: string;
  arquivo: Blob;
}

export type VersaoMeta = Omit<Versao, 'arquivo'>;
