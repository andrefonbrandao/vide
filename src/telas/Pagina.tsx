// Modelo de página do Vide: caminho, título, uma linha de descrição e as ações à direita.
import type { ReactNode } from 'react';
import { FaixaFiltroTurma } from './FaixaTurma';

/** Modelo de página: caminho, título, uma linha de descrição e as ações à direita. */
export function Pagina({ caminho, titulo, descricao, acoes, filtravel = false, children }: { caminho?: string; titulo: string; descricao?: ReactNode; acoes?: ReactNode; filtravel?: boolean; children: ReactNode }) {
  return (
    <div className="pagina">
      <header className="pag-cab">
        <div className="pag-cab-texto">
          {caminho && <div className="pag-caminho">{caminho}</div>}
          <h1>{titulo}</h1>
          {descricao && <p className="pag-desc">{descricao}</p>}
        </div>
        {acoes && <div className="pag-acoes">{acoes}</div>}
      </header>
      {filtravel && <FaixaFiltroTurma />}
      {children}
    </div>
  );
}
