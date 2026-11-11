// Caixinhas para escolher as disciplinas de um item (e a turma de um processo).
import { useEffect, useState } from 'react';
import { listarDisciplinas, listarTurmas, rotuloTurma } from '../turmas/banco';
import type { Disciplina, Turma } from '../turmas/tipos';

export function EscolherDisciplinas({ valor, aoMudar }: { valor: string[]; aoMudar: (ids: string[]) => void }) {
  const [lista, setLista] = useState<Disciplina[] | null>(null);
  useEffect(() => void listarDisciplinas().then(setLista), []);
  if (!lista?.length) return null;
  return (
    <div className="campo">
      <label>Disciplinas</label>
      <div className="linha-opcoes">
        {lista.map((d) => (
          <label key={d.id} className="caixa-marcar" style={{ marginTop: 0 }}>
            <input type="checkbox" checked={valor.includes(d.id)} onChange={(e) => aoMudar(e.target.checked ? [...valor, d.id] : valor.filter((x) => x !== d.id))} />
            <span className="selo-disciplina" style={{ ['--cor' as string]: d.cor }}>
              {d.sigla}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function EscolherTurma({ valor, aoMudar }: { valor: string | null | undefined; aoMudar: (id: string | null) => void }) {
  const [dados, setDados] = useState<{ d: Disciplina[]; t: Turma[] } | null>(null);
  useEffect(() => void Promise.all([listarDisciplinas(), listarTurmas()]).then(([d, t]) => setDados({ d, t })), []);
  if (!dados?.t.length) return null;
  return (
    <div className="campo">
      <label htmlFor="escolher-turma">Turma</label>
      <select id="escolher-turma" className="seletor" value={valor ?? ''} onChange={(e) => aoMudar(e.target.value || null)}>
        <option value="">sem turma</option>
        {dados.t.map((t) => (
          <option key={t.id} value={t.id}>
            {rotuloTurma(dados.d.find((x) => x.id === t.disciplinaId), t)}
            {t.arquivada ? ' (arquivada)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
