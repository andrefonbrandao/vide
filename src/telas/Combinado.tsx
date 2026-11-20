// "Combinado de orientação" na página do orientando: quem faz o quê e quais fontes usar.
// O orientando confirma a leitura ("Li e compreendi"); o professor vê quando foi.
import { useState } from 'react';
import { FONTES, RESPONSABILIDADES, ROTULO_QUEM } from '../orientacao/combinado';

const SIMBOLO = { sim: '✓', cautela: '!', nao: '⊘' } as const;

export function CombinadoOrientacao({ lidoEm, aoConfirmar }: { lidoEm: string | null | undefined; aoConfirmar: () => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  return (
    <section className="comb">
      <div>
        <h2>Nosso combinado de orientação</h2>
        <p className="ajuda" style={{ margin: 0 }}>
          Antes de começar, leia com atenção: o que cabe a você, o que cabe ao orientador e quais fontes usar no trabalho. Leva uns 3 minutos e fica sempre aqui para consulta.
        </p>
      </div>
      <div className="proc-caixa">
        <h3 className="proc-caixa-titulo">Responsabilidades</h3>
        <ul className="comb-resp">
          {RESPONSABILIDADES.map((r) => (
            <li key={r.tarefa}>
              <span>{r.tarefa}</span>
              <span className={`comb-quem ${r.quem}`}>{ROTULO_QUEM[r.quem]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="proc-caixa">
        <h3 className="proc-caixa-titulo">Fontes de pesquisa</h3>
        <div className="comb-fontes">
          {FONTES.map((f) => (
            <div key={f.tipo} className={`comb-fonte ${f.tipo}`}>
              <strong>
                <span className="comb-simb" aria-hidden="true">
                  {SIMBOLO[f.tipo]}
                </span>{' '}
                {f.titulo}
              </strong>
              <ul>
                {f.itens.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p>{f.porque}</p>
            </div>
          ))}
        </div>
      </div>
      {lidoEm ? (
        <p className="comb-ok">✓ Você confirmou a leitura em {new Date(lidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p>
      ) : (
        <div className="comb-confirmar">
          <button
            type="button"
            className="botao primario"
            disabled={ocupado || lidoEm === undefined}
            onClick={async () => {
              setOcupado(true);
              setErro('');
              try {
                await aoConfirmar();
              } catch {
                setErro('Não foi possível registrar. Confira a internet e tente de novo.');
              } finally {
                setOcupado(false);
              }
            }}
          >
            {ocupado ? 'Registrando…' : 'Li e compreendi o combinado'}
          </button>
          <span className="ajuda" style={{ margin: 0 }}>
            O orientador vê que você confirmou.
          </span>
          {erro && <p className="oa-erro">{erro}</p>}
        </div>
      )}
    </section>
  );
}
