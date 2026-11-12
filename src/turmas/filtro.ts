// Modo da turma: qual turma está ativa e o filtro que as listas usam.
// Fica guardado neste navegador; as telas são avisadas pelo evento "vide-turma-mudou".
import type { VinculoConteudo, VinculoTurma } from './tipos';

export interface TurmaAtiva {
  turmaId: string;
  disciplinaId: string;
  /** "PC1 · 2026.2" (para mostrar sem precisar ler o banco). */
  rotulo: string;
  cor: string;
}

const CHAVE = 'vide.turmaAtiva';
const CHAVE_TUDO = 'vide.mostrarTudo';

export function turmaAtiva(): TurmaAtiva | null {
  try {
    const t = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as TurmaAtiva | null;
    return t && t.turmaId ? t : null;
  } catch {
    return null;
  }
}

export function definirTurmaAtiva(t: TurmaAtiva | null): void {
  try {
    if (t) localStorage.setItem(CHAVE, JSON.stringify(t));
    else localStorage.removeItem(CHAVE);
    sessionStorage.removeItem(CHAVE_TUDO);
  } catch {
    /* ignore */
  }
  avisarTelas();
}

/** As listas (e a Aula) recarregam quando o filtro muda. */
function avisarTelas() {
  for (const e of ['vide-turma-mudou', 'vide-materiais-mudou', 'vide-questoes-mudou', 'vide-processos-mudou', 'vide-casos-mudou']) window.dispatchEvent(new Event(e));
}

/** "Mostrar tudo": desliga o filtro até trocar de turma (ou fechar o navegador). */
export function mostrandoTudo(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_TUDO) === 'sim';
  } catch {
    return false;
  }
}

export function definirMostrarTudo(sim: boolean): void {
  try {
    if (sim) sessionStorage.setItem(CHAVE_TUDO, 'sim');
    else sessionStorage.removeItem(CHAVE_TUDO);
  } catch {
    /* ignore */
  }
  avisarTelas();
}

/** O filtro que vale agora (null = mostrar tudo). */
export function filtroAtual(): TurmaAtiva | null {
  return mostrandoTudo() ? null : turmaAtiva();
}

/** Conteúdo: é da disciplina, ou ainda não tem disciplina ("sem disciplina" aparece em todas). */
export function pertenceConteudo(item: VinculoConteudo, f: TurmaAtiva | null = filtroAtual()): boolean {
  if (!f) return true;
  if (item.turmaId) return item.turmaId === f.turmaId;
  return !item.disciplinas?.length || item.disciplinas.includes(f.disciplinaId);
}

/** Do semestre: é da turma, ou ainda não tem turma ("sem turma" aparece em todas). */
export function pertenceTurma(item: VinculoTurma, f: TurmaAtiva | null = filtroAtual()): boolean {
  if (!f) return true;
  return !item.turmaId || item.turmaId === f.turmaId;
}

/** O vínculo que um recurso novo recebe (o que é criado no modo da turma já nasce ligado). */
export function vinculoConteudoNovo(soTurma = false): VinculoConteudo {
  const t = turmaAtiva();
  if (!t) return {};
  return soTurma ? { disciplinas: [t.disciplinaId], turmaId: t.turmaId } : { disciplinas: [t.disciplinaId] };
}

export function vinculoTurmaNovo(): VinculoTurma {
  const t = turmaAtiva();
  return t ? { turmaId: t.turmaId } : {};
}
