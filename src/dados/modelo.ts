// Modelo de dados do Vide.
//
// Os nomes dos campos seguem o padrão do Postgres/Supabase (snake_case),
// para que a sincronização futura copie os registros sem conversão.
// Veja supabase/esquema.sql.

/** Tipos de item. O protótipo usa só "legislacao"; os outros já estão previstos. */
export type TipoItem = 'legislacao' | 'precedente' | 'conceito' | 'imagem' | 'grafico';

/** Campos comuns a tudo que é sincronizável. */
export interface Sincronizavel {
  /** UUID gerado no aparelho (crypto.randomUUID). */
  id: string;
  /** Dono do registro. Fica null até existir login. */
  usuario_id: string | null;
  criado_em: string; // ISO 8601
  atualizado_em: string; // ISO 8601
  /** Exclusão "suave": em vez de apagar, marcamos a data. Necessário para sincronizar. */
  excluido_em: string | null;
}

/** Um dispositivo de lei: caput, parágrafo, inciso, alínea ou item. */
export interface Dispositivo {
  tipo: 'caput' | 'paragrafo' | 'inciso' | 'alinea' | 'item';
  /** Número normalizado: "1", "unico", "6" (inciso VI), "a" (alínea a). */
  numero: string;
  /** Como aparece no texto: "§ 1º", "Parágrafo único", "VI", "a)". */
  rotulo: string;
  /** Texto sem o rótulo e sem as notas de alteração. */
  texto: string;
  /** Notas do Planalto, como "(Redação dada pela Lei nº 13.256, de 2016)". */
  notas: string[];
  filhos: Dispositivo[];
}

/** Conteúdo de um item do tipo legislação: um artigo inteiro. */
export interface ConteudoLegislacao {
  formato: 'legislacao/artigo@1';
  diploma: string; // "cpc"
  /** Número do artigo como inteiro (1015) e sufixo ("A" em 356-A). */
  artigo: number;
  sufixo: string;
  /** Rótulo como na lei: "Art. 1.015". */
  rotulo: string;
  caput: Dispositivo;
  /** Parágrafos (os incisos do caput ficam em caput.filhos). */
  paragrafos: Dispositivo[];
  /** Livro/título/capítulo/seção onde o artigo está. */
  localizacao: string[];
}

export interface OrigemItem {
  arquivo: string | null;
  url: string | null;
  importado_em: string;
}

/** O "item genérico": tudo o que se projeta tem esta base. */
export interface Item extends Sincronizavel {
  tipo: TipoItem;
  /** Chave única e legível: "cpc:art:1015". Usada pelo detector. */
  chave: string;
  /** Identificação curta: "art. 1.015 CPC". */
  titulo: string;
  /** Rótulo curto de assunto (precedentes, no futuro). */
  rotulo: string | null;
  /** Gatilhos que a voz reconhece. Para legislação: ["cpc:1015"]. */
  gatilhos: string[];
  /** Etiquetas de assunto (fora do escopo do protótipo; fica vazio). */
  etiquetas: string[];
  conteudo: ConteudoLegislacao; // no futuro: união com os outros formatos
  origem: OrigemItem;
}

/** Um diploma importado (CPC, CF...). */
export interface Diploma extends Sincronizavel {
  /** Identificador curto: "cpc". */
  sigla: string;
  nome: string;
  apelidos: string[];
  origem_url: string | null;
  /** Data da versão guardada (quando foi importada). */
  versao_em: string;
  total_artigos: number;
  /** Como aparece na tela ("CF", "Lei 9.099/1995"). */
  abreviacao?: string;
  /** Número da lei, só algarismos, para reconhecer "Lei 9.099" na fala. */
  numero_lei?: string | null;
  /** Maior número de artigo (para leis cadastradas pelo professor). */
  max_artigo?: number;
}

/** Material do professor (slides em PDF ou imagem) para exibir durante a aula. */
export interface Material extends Sincronizavel {
  nome: string;
  tipo: 'pdf' | 'imagem';
  mime: string;
  /** Tamanho do arquivo em bytes. */
  tamanho: number;
  paginas: number;
  /** O arquivo em si (fica no aparelho; no futuro, no armazenamento do Supabase). */
  arquivo: Blob;
  /** Pasta, com subpastas separadas por "/": "Processo Civil II/Sentença". Vazio = sem pasta. */
  pasta?: string;
  /** Etiquetas livres para achar o material: ["sentença", "recursos"]. */
  etiquetas?: string[];
}

/** Um evento do registro de teste. */
export interface EventoRegistro {
  /** Número sequencial local (o IndexedDB gera). */
  seq?: number;
  sessao_id: string;
  em: string; // ISO 8601
  tipo:
    | 'sessao'
    | 'fala'
    | 'detectado'
    | 'nao_encontrado'
    | 'outro_diploma'
    | 'candidato'
    | 'projetado'
    | 'recolhido'
    | 'comando_voz'
    | 'voz'
    | 'marcacao'
    | 'material';
  /** Texto principal (fala, identificação do item etc.). */
  texto: string;
  /** Detalhes livres (trecho, origem do clique etc.). */
  dados?: Record<string, unknown>;
}

export function agoraISO(): string {
  return new Date().toISOString();
}

export function novoId(): string {
  return crypto.randomUUID();
}
