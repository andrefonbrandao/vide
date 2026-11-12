// Leitura das disciplinas e turmas para as telas, e o selo das coisas exclusivas de uma turma.
import { useEffect, useState } from 'react';
import { listarDisciplinas, listarTurmas, rotuloTurma } from '../turmas/banco';
import type { Disciplina, Turma } from '../turmas/tipos';

export function useTurmas(): { disciplinas: Disciplina[]; turmas: Turma[]; carregado: boolean } {
  const [d, setD] = useState<{ disciplinas: Disciplina[]; turmas: Turma[]; carregado: boolean }>({ disciplinas: [], turmas: [], carregado: false });
  useEffect(() => {
    const carregar = () => void Promise.all([listarDisciplinas(), listarTurmas()]).then(([disciplinas, turmas]) => setD({ disciplinas, turmas, carregado: true }));
    carregar();
    window.addEventListener('vide-turmas-mudou', carregar);
    return () => window.removeEventListener('vide-turmas-mudou', carregar);
  }, []);
  return d;
}

/** Selo "só PC1 · 2026.2" para o que é exclusivo de uma turma. */
export function SeloTurma({ turmaId }: { turmaId?: string | null }) {
  const { disciplinas, turmas } = useTurmas();
  if (!turmaId) return null;
  const t = turmas.find((x) => x.id === turmaId);
  if (!t) return null;
  const d = disciplinas.find((x) => x.id === t.disciplinaId);
  return (
    <span className="selo-disciplina selo-so-turma" style={{ ['--cor' as string]: d?.cor ?? 'var(--tinta)' }} title="Exclusivo desta turma">
      só {rotuloTurma(d, t)}
    </span>
  );
}
