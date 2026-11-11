// Processo da turma na tela de aula: escolher o processo, projetar, abrir peças e liberar eventos.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { aulaProcesso } from '../processo/aula';
import { listarProcessos } from '../processo/banco';
import type { Processo } from '../processo/tipos';
import { buscarNoAcervo, VisaoProcesso } from './ProcessoAluno';

export function useAulaProcesso() {
  const a = aulaProcesso();
  return useSyncExternalStore(a.assinar, a.obter);
}

/** Parte da janela de Atividades: escolher o processo para projetar. */
export function EscolherProcesso({ aoFechar }: { aoFechar: () => void }) {
  const [lista, setLista] = useState<Processo[] | null>(null);
  useEffect(() => void listarProcessos().then(setLista), []);
  if (!lista) return <p className="ajuda">Carregando…</p>;
  return (
    <>
      {!lista.length ? (
        <p className="aviso">
          Nenhum processo ainda. Monte um em <strong>Atividades › Processos</strong>.
        </p>
      ) : (
        <div className="lista-questionarios">
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              className="opcao-questionario"
              onClick={async () => {
                await aulaProcesso().abrir(p.id);
                aoFechar();
              }}
            >
              <span style={{ textAlign: 'left' }}>
                <strong>{p.titulo}</strong>
                <span className="ajuda" style={{ margin: 0 }}>
                  {' '}
                  · <span className="mono">{p.capa.numero}</span> · {p.eventos.length} {p.eventos.length === 1 ? 'evento' : 'eventos'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="modal-botoes">
        <button className="botao" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </>
  );
}

/** Painel central durante a aula com o processo aberto. */
export function PainelProcesso() {
  const { tela, processo, aviso } = useAulaProcesso();
  const caixa = useRef<HTMLDivElement>(null);
  const [escolhido, setEscolhido] = useState('');
  const [liberando, setLiberando] = useState(false);
  const a = aulaProcesso();
  // Rolagem da tela do professor -> projeção.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let quadro = 0;
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        a.rolar(max > 0 ? el.scrollTop / max : 0);
      });
    };
    el.addEventListener('scroll', aoRolar, { passive: true });
    return () => el.removeEventListener('scroll', aoRolar);
  }, [a, tela?.lendo]);
  useEffect(() => {
    caixa.current?.scrollTo({ top: 0 });
  }, [tela?.lendo]);
  if (!tela || !processo) return null;
  const pendentes = a.pendentes();
  const proximo = pendentes[0];
  const liberar = async (id: string) => {
    setLiberando(true);
    try {
      await a.liberar(id);
    } finally {
      setLiberando(false);
      setEscolhido('');
    }
  };
  return (
    <section className="painel-material painel-jogo" data-ui>
      <div className="painel-material-topo">
        <strong className="painel-material-nome">{processo.titulo}</strong>
        <span className="espaco" />
        <span className="ajuda mono" style={{ margin: 0 }}>
          {processo.capa.numero}
        </span>
      </div>
      <div ref={caixa} className="previa-processo" data-rolavel>
        <VisaoProcesso dados={tela.dados} buscar={buscarNoAcervo} lendoControlado={tela.lendo} aoLer={(l) => a.ler(l)} />
      </div>
      <div className="painel-jogo-acoes">
        {proximo ? (
          <button className="botao primario" disabled={liberando} onClick={() => void liberar(proximo.e.id)} title="A turma passa a ver este evento (na projeção e no link)">
            Liberar o evento {proximo.numero}: {proximo.e.descricao || '(sem descrição)'}
          </button>
        ) : (
          <span className="ajuda" style={{ margin: 0 }}>
            Todos os eventos já estão liberados.
          </span>
        )}
        {pendentes.length > 1 && (
          <select className="seletor" aria-label="Liberar outro evento" value={escolhido} disabled={liberando} onChange={(e) => (setEscolhido(e.target.value), e.target.value && void liberar(e.target.value))}>
            <option value="">Liberar outro…</option>
            {pendentes.slice(1).map(({ e, numero }) => (
              <option key={e.id} value={e.id}>
                Evento {numero}: {e.descricao || '(sem descrição)'}
              </option>
            ))}
          </select>
        )}
        {tela.lendo && (
          <button className="botao" onClick={() => a.ler(null)}>
            Voltar ao processo
          </button>
        )}
        <span className="espaco" />
        <button className="botao" onClick={() => a.fechar()}>
          Fechar processo
        </button>
      </div>
      {aviso && (
        <p className="digitar-msg" style={{ flexBasis: 'auto', margin: 0 }}>
          {aviso}
        </p>
      )}
      <p className="ajuda" style={{ margin: 0 }}>
        A projeção mostra só o que a turma já vê e acompanha a rolagem desta tela. Clique numa sigla (INIC1, CONT1…) para projetar a peça.
      </p>
    </section>
  );
}
