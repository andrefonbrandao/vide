// Cartões dos apontamentos do orientador (no formulário do orientando e na leitura do professor):
// o trecho citado, o comentário, a conversa (respostas), responder e marcar como resolvido.
import { createContext, useContext, useState } from 'react';
import { localizar, type AcaoApontamento, type Apontamento } from '../orientacao/apontamentos';

export interface EstadoApontamentos {
  lista: Apontamento[];
  autor: 'aluno' | 'professor';
  agir: (corpo: AcaoApontamento) => Promise<void>;
  ativo: string | null;
  setAtivo: (id: string | null) => void;
}

export const ContextoApontamentos = createContext<EstadoApontamentos | null>(null);

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const quem = (autor: 'aluno' | 'professor', eu: 'aluno' | 'professor') => (autor === eu ? 'Você' : autor === 'professor' ? 'Orientador(a)' : 'Orientando(a)');

/** Os trechos destacados de um campo (para o editor). */
export function marcasDoCampo(lista: Apontamento[], chave: string | undefined, valor: string, ativo: string | null) {
  if (!chave) return [];
  return lista.flatMap((a) => {
    if (a.campo !== chave) return [];
    const p = localizar(valor, a);
    return p ? [{ id: a.id, de: p.de, ate: p.ate, resolvido: !!a.resolvido, ativo: a.id === ativo }] : [];
  });
}

export function CartaoApontamento({ a, alterado }: { a: Apontamento; alterado: boolean }) {
  const c = useContext(ContextoApontamentos)!;
  const [resposta, setResposta] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(!a.resolvido);
  const fazer = async (corpo: AcaoApontamento, depois?: () => void) => {
    setOcupado(true);
    setErro('');
    try {
      await c.agir(corpo);
      depois?.();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  const ativo = c.ativo === a.id;
  return (
    <article id={`apont-${a.id}`} className={`apont${a.resolvido ? ' resolvido' : ''}${ativo ? ' ativo' : ''}`} onClick={() => c.setAtivo(a.id)}>
      <header className="apont-cab">
        <span className="apont-selo">{a.resolvido ? '✓ Resolvido' : alterado ? 'Trecho alterado' : 'Apontamento'}</span>
        <span className="ajuda" style={{ margin: 0 }}>
          {quando(a.em)}
        </span>
        {a.resolvido && (
          <button type="button" className="ori-link" onClick={(e) => (e.stopPropagation(), setAberto(!aberto))}>
            {aberto ? 'recolher' : 'ver'}
          </button>
        )}
      </header>
      <blockquote className="apont-trecho">“{a.trecho.length > 220 ? `${a.trecho.slice(0, 220)}…` : a.trecho}”</blockquote>
      {alterado && !a.resolvido && <p className="ajuda apont-aviso">O trecho foi reescrito depois deste apontamento (por isso não aparece destacado no texto).</p>}
      {aberto && (
        <>
          {editando !== null ? (
            <div className="apont-resp">
              <textarea rows={3} value={editando} onChange={(e) => setEditando(e.target.value)} aria-label="Editar o apontamento" />
              <span className="linha-opcoes">
                <button type="button" className="botao pequeno escuro" disabled={ocupado || !editando.trim()} onClick={() => void fazer({ acao: 'editar', id: a.id, texto: editando }, () => setEditando(null))}>
                  Salvar
                </button>
                <button type="button" className="botao pequeno" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
              </span>
            </div>
          ) : (
            <p className="apont-texto">
              <strong>{quem('professor', c.autor)}:</strong> {a.texto}
            </p>
          )}
          {a.respostas.map((r, k) => (
            <p key={k} className={`apont-texto apont-${r.autor}`}>
              <strong>{quem(r.autor, c.autor)}:</strong> {r.texto} <span className="ajuda">· {quando(r.em)}</span>
            </p>
          ))}
          {a.resolvido && (
            <p className="ajuda" style={{ margin: '4px 0' }}>
              Resolvido por {quem(a.resolvido.por, c.autor).toLowerCase()} em {quando(a.resolvido.em)}.
            </p>
          )}
          {!a.resolvido && (
            <div className="apont-resp">
              <textarea rows={2} placeholder="Responder…" value={resposta} onChange={(e) => setResposta(e.target.value)} aria-label="Responder" onClick={(e) => e.stopPropagation()} />
            </div>
          )}
          <div className="linha-opcoes apont-acoes">
            {!a.resolvido && (
              <button type="button" className="botao pequeno escuro" disabled={ocupado || !resposta.trim()} onClick={(e) => (e.stopPropagation(), void fazer({ acao: 'responder', id: a.id, texto: resposta }, () => setResposta('')))}>
                Responder
              </button>
            )}
            <button type="button" className="botao pequeno" disabled={ocupado} onClick={(e) => (e.stopPropagation(), void fazer({ acao: 'resolver', id: a.id, resolvido: !a.resolvido }))}>
              {a.resolvido ? 'Reabrir' : 'Marcar como resolvido'}
            </button>
            {c.autor === 'professor' && editando === null && (
              <>
                <button type="button" className="ori-link" onClick={(e) => (e.stopPropagation(), setEditando(a.texto))}>
                  editar
                </button>
                <button
                  type="button"
                  className="ori-link perigo"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Apagar este apontamento e a conversa dele?')) void fazer({ acao: 'apagar', id: a.id });
                  }}
                >
                  apagar
                </button>
              </>
            )}
          </div>
          {erro && <p className="oa-erro">{erro}</p>}
        </>
      )}
    </article>
  );
}

/** Os apontamentos de um campo (abaixo do editor): primeiro os em aberto, na ordem do texto. */
export function ApontamentosDoCampo({ chave, valor }: { chave?: string; valor: string }) {
  const c = useContext(ContextoApontamentos);
  if (!c || !chave) return null;
  const meus = c.lista
    .filter((a) => a.campo === chave)
    .map((a) => ({ a, pos: localizar(valor, a)?.de ?? Infinity }))
    .sort((x, y) => Number(!!x.a.resolvido) - Number(!!y.a.resolvido) || x.pos - y.pos);
  if (!meus.length) return null;
  return (
    <div className="apont-lista" aria-label="Apontamentos do orientador neste campo">
      {meus.map(({ a, pos }) => (
        <CartaoApontamento key={a.id} a={a} alterado={pos === Infinity} />
      ))}
    </div>
  );
}

/** Leva até o cartão (e destaca o trecho). */
export function irPara(id: string, setAtivo: (id: string) => void) {
  setAtivo(id);
  requestAnimationFrame(() => document.getElementById(`apont-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}
