// Disciplinas e turmas do professor.
// A disciplina guarda o que se repete todo semestre (conteúdo e lei principal);
// a turma é a disciplina num semestre (horários, processo, links, resultados, registro).
import type { Sincronizavel } from '../dados/modelo';

export interface Disciplina extends Sincronizavel {
  /** "Direito Processual Civil I". */
  nome: string;
  /** Curta, para os selos: "PC1". */
  sigla: string;
  /** Cor de reconhecimento (hex). */
  cor: string;
  /** Lei principal da disciplina (sigla do acervo: "cpc", "cf"…). Vale na aula no modo da turma. */
  leiPrincipal: string;
  /** O que se repete no plano de aula (temas, avaliações); as datas ficam na turma. */
  planoAula?: PlanoAula;
  /** O que se repete no plano de ensino (ementa, competências, conteúdo, avaliação, bibliografia). */
  planoEnsino?: PlanoEnsino;
}

/** Uma unidade do conteúdo programático ("Etapa postulatória") e os seus itens. */
export interface UnidadeConteudo {
  titulo: string;
  itens: string[];
}

export interface PlanoEnsino {
  cargaHoraria: string;
  professor: string;
  coordenador: string;
  ementa: string;
  competencias: string[];
  habilidades: string[];
  conteudo: UnidadeConteudo[];
  /** O parágrafo que abre as estratégias de avaliação. */
  estrategias: string;
  /** Quadro "Instrumento avaliativo / Peso" de cada Grau. */
  graus: Record<'A' | 'B' | 'C', { descricao: string; peso: string }>;
  /** Quadro das ações para a melhoria da aprendizagem. */
  recuperacao: { descricao: string; estrategias: string };
  /** Obras da bibliografia; o que estiver entre ** sai em negrito (o título). */
  bibliografiaBasica: string[];
  bibliografiaComplementar: string[];
  /** "Caxias do Sul", antes da data no fim do documento. */
  cidade: string;
}

/** Uma aula do plano: o tema e, se houver, o destaque ("AVALIAÇÃO FORMATIVA A.1"). */
export interface AulaPlano {
  id: string;
  tema: string;
  destaque: string;
  /** Depois desta aula entra o quadro do Grau (datas de aplicação e de postagem das notas). */
  grau?: 'A' | 'B' | 'C';
}

export interface LinhaAvaliacao {
  instrumento: string;
  peso: string;
  criterio: string;
}

export interface GrauPlano {
  aplicacao: string;
  postagem: string;
  pontos: string;
  linhas: LinhaAvaliacao[];
}

export interface PlanoAula {
  cargaHoraria: string;
  professor: string;
  aulas: AulaPlano[];
  graus: Record<'A' | 'B' | 'C', GrauPlano>;
  recuperacao: string;
}

/** Calendário da turma para o plano de aula: dias sem aula (ou com aula extra) e datas trocadas à mão. */
export interface CalendarioTurma {
  /** Exceções ao calendário: aula = false (não há aula: semana acadêmica…) ou true (há aula num feriado ou num dia extra). */
  excecoes: { data: string; aula: boolean; motivo?: string }[];
  /** Data escolhida à mão para uma aula (id da aula → "AAAA-MM-DD"). */
  datas: Record<string, string>;
}

/** Um horário semanal: dia (0 = domingo … 6 = sábado), início e fim "HH:MM". */
export interface Horario {
  dia: number;
  inicio: string;
  fim: string;
}

export interface Turma extends Sincronizavel {
  disciplinaId: string;
  /** "2026.2". */
  periodo: string;
  horarios: Horario[];
  /** Começo e fim do semestre ("AAAA-MM-DD"), para o aviso de aula não aparecer fora dele. */
  inicio?: string;
  fim?: string;
  /** Turmas de semestres passados ficam guardadas, mas saem do seletor. */
  arquivada?: boolean;
  /** Plano de aula: o calendário desta turma (as aulas e os temas vêm da disciplina). */
  calendario?: CalendarioTurma;
  /** Data que vai no fim do plano de ensino ("AAAA-MM-DD"); sem ela, a data de hoje. */
  dataPlanoEnsino?: string;
}

/** O que liga um recurso de conteúdo (material, questão, questionário, caso) às disciplinas. */
export interface VinculoConteudo {
  disciplinas?: string[];
  /** "Só esta turma" (materiais e questionários): aparece só nela, não nas outras turmas da disciplina. */
  turmaId?: string | null;
}

/** O que liga um recurso do semestre (processo, link de treino, resultado) à turma. */
export interface VinculoTurma {
  turmaId?: string | null;
}

export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const CORES = ['#2f6b4f', '#e8735a', '#3d6fb4', '#8a5bb0', '#c99a1e', '#b0466b', '#3f8f8a', '#6b6f2f'];
