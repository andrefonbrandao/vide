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
  /** Página do orientando (link com código de 6 números). */
  publicacao?: PublicacaoOrientacao | null;
  /** Formulário do pré-projeto na página do orientando. */
  preProjeto?: ConfigPreProjeto;
  /** Cópia de segurança do rascunho do pré-projeto (o que o orientando escreveu na página), no computador e no Drive. */
  rascunhoProjeto?: { texto: TextoProjeto; guardadoEm: string } | null;
}

/** O que o professor define para o PDF do pré-projeto (capa, folha de rosto…). */
export interface ConfigPreProjeto {
  ativo: boolean;
  instituicao: 'Uniftec' | 'Ftec';
  curso: string;
  cidade: string;
  ano: string;
  /** "Prof. Me. Fulano de Tal". */
  orientador: string;
  coorientador: string;
  /** Texto da natureza do trabalho na folha de rosto (vazio = o padrão). */
  natureza: string;
  /** Elementos opcionais. */
  resumo: boolean;
  aprovacao: boolean;
}

/** O texto do pré-projeto que o orientando escreve (marcações: **negrito**, _itálico_, "> " citação longa, "## " subtítulo, [[nota de rodapé]]). */
export interface TextoProjeto {
  titulo: string;
  subtitulo: string;
  resumo: string;
  palavrasChave: string;
  introducao: string;
  problema: string;
  hipoteses: string;
  objetivoGeral: string;
  /** Um por linha. */
  objetivosEspecificos: string;
  justificativa: string;
  fundamentacao: string;
  metodo: string;
  populacao: string;
  coleta: string;
  analise: string;
  recursos: string;
  /** Uma referência por linha (o Vide põe em ordem alfabética). */
  referencias: string;
  atualizado_em?: string;
}

export interface PublicacaoOrientacao {
  codigo: string;
  /** Só o navegador do professor tem: permite atualizar e desativar. */
  chave: string;
  /** Código de acesso do orientando (6 números). */
  pin: string;
  publicadoEm: string;
  /** Arquivos já enviados: id do modelo -> versão (atualizado_em) enviada. */
  arquivos: Record<string, string>;
  /** Último envio do pré-projeto já trazido para as versões. */
  ultimoEnvio?: string;
}

/** Modelo ou orientação geral (manual, modelo de TCC, um texto de orientação). */
export interface Modelo extends Sincronizavel {
  titulo: string;
  descricao: string;
  tipo: 'arquivo' | 'texto';
  /** Orientação escrita (tipo "texto"). */
  texto: string;
  nomeArquivo: string;
  mime: string;
  tamanho: number;
  arquivo: Blob;
  /** null = para todos os orientandos; senão, só para este trabalho. */
  trabalhoId: string | null;
}

export type ModeloMeta = Omit<Modelo, 'arquivo'>;

/** O que a página do orientando mostra (sem e-mail, telefone, sessões ou versões). */
export interface DadosOrientando {
  formato: 'vide-orientacao@1';
  nome: string;
  trabalho: Pick<Trabalho, 'titulo' | 'tipo' | 'inicio' | 'defesa' | 'situacao'>;
  etapas: Etapa[];
  pendencias: { tipo: Encaminhamento['tipo']; texto: string; prazo?: string; de: string }[];
  elementos?: Elementos;
  /** Formulário do pré-projeto (se o professor ligou). */
  preProjeto?: ConfigPreProjeto;
  modelos: { id: string; titulo: string; descricao: string; tipo: Modelo['tipo']; texto?: string; nomeArquivo?: string; mime?: string; tamanho?: number }[];
  publicadoEm: string;
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
  /** Envio do pré-projeto pela página: o texto (para gerar o Word daquela versão). */
  projeto?: TextoProjeto;
}

export type VersaoMeta = Omit<Versao, 'arquivo'>;
