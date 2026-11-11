// O "modo da turma" nas telas: o gancho com a turma ativa e a faixa do filtro nas listas.
import { useEffect, useState } from 'react';
import { definirMostrarTudo, mostrandoTudo, turmaAtiva, type TurmaAtiva } from '../turmas/filtro';

export function useTurmaAtiva(): { ativa: TurmaAtiva | null; tudo: boolean } {
  const [v, setV] = useState(() => ({ ativa: turmaAtiva(), tudo: mostrandoTudo() }));
  useEffect(() => {
    const f = () => setV({ ativa: turmaAtiva(), tudo: mostrandoTudo() });
    window.addEventListener('vide-turma-mudou', f);
    return () => window.removeEventListener('vide-turma-mudou', f);
  }, []);
  return v;
}

// ---------- Faixa do filtro (nas listas) ----------

export function FaixaFiltroTurma() {
  const { ativa, tudo } = useTurmaAtiva();
  if (!ativa) return null;
  return (
    <div className={`faixa-turma${tudo ? ' tudo' : ''}`} style={{ ['--cor' as string]: ativa.cor }}>
      <span className="selo-disciplina">{ativa.rotulo.split(' · ')[0]}</span>
      {tudo ? (
        <span>
          Mostrando <strong>tudo</strong>, de todas as turmas.
        </span>
      ) : (
        <span>
          Mostrando só o que é de <strong>{ativa.rotulo}</strong> (e o que ainda não tem disciplina).
        </span>
      )}
      <button className="link-discreto" onClick={() => definirMostrarTudo(!tudo)}>
        {tudo ? `só ${ativa.rotulo}` : 'mostrar tudo'}
      </button>
    </div>
  );
}

/** No modo da turma: marca os itens antigos que ainda não têm disciplina (ou turma). */
export function SemVinculo({ item, tipo }: { item: { disciplinas?: string[]; turmaId?: string | null }; tipo: 'conteudo' | 'turma' }) {
  const { ativa, tudo } = useTurmaAtiva();
  if (!ativa || tudo) return null;
  const sem = tipo === 'conteudo' ? !item.disciplinas?.length : !item.turmaId;
  return sem ? <span className="selo sem-vinculo">{tipo === 'conteudo' ? 'sem disciplina' : 'sem turma'}</span> : null;
}
