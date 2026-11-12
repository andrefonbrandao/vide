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
