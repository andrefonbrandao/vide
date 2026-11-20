// "Ler e comentar" (professor): o texto atual do orientando, já formatado, campo por campo.
// Selecione um trecho e clique em "Comentar": o orientando vê o trecho em amarelo, com o
// comentário, e pode responder e marcar como resolvido. À direita, todos os apontamentos.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { camposDoTrabalho, emAberto, lerApontamentos, mudarApontamento, type AcaoApontamento, type Apontamento } from '../orientacao/apontamentos';
import { formatoDoTexto, lerRascunho } from '../orientacao/publicar';
import type { Orientando, TextoProjeto, Trabalho, Versao } from '../orientacao/tipos';
import { CartaoApontamento, ContextoApontamentos, irPara, marcasDoCampo } from './Apontamentos';
import { ContextoPagina } from './contextoPagina';
import type { Controle } from './EditorVivo';

const EditorVivo = lazy(() => import('./EditorVivo'));

/** `envio`: aberto a partir de uma versão enviada (linha do tempo): avisa se o texto mudou depois dela. */
export function LerEComentar({ trabalho, orientando, envio, aoFechar }: { trabalho: Trabalho; orientando?: Orientando; envio?: Versao; aoFechar: () => void }) {
  const pub = trabalho.publicacao!;
  const cab = useMemo(() => ({ 'X-Vide-Chave': pub.chave }), [pub.chave]);
  const pagina = useMemo(() => ({ codigo: pub.codigo, cabecalho: cab }), [pub.codigo, cab]);
  const [texto, setTexto] = useState<TextoProjeto | null>(null);
  const [lista, setLista] = useState<Apontamento[]>([]);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState<{ campo: string; nome: string; trecho: string; prefixo: string } | null>(null);
  const [comentario, setComentario] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<'abertos' | 'todos'>('abertos');
  const controles = useRef(new Map<string, Controle>());
  const ultimo = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [{ projeto }, aps] = await Promise.all([lerRascunho(trabalho.id), lerApontamentos(pub.codigo, cab)]);
      setTexto(projeto);
      setLista(aps);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [trabalho.id, pub.codigo, cab]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !novo && aoFechar();
    window.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [aoFechar, novo]);
  // Ao escolher um apontamento, leva o texto até o trecho.
  useEffect(() => {
    if (!ativo) return;
    requestAnimationFrame(() => document.querySelector(`.lc-texto [data-apont="${ativo}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [ativo]);

  const estado = useMemo(
    () => ({ lista, autor: 'professor' as const, agir: async (c: AcaoApontamento) => setLista(await mudarApontamento(pub.codigo, cab, c)), ativo, setAtivo }),
    [lista, ativo, pub.codigo, cab],
  );
  const formato = texto ? formatoDoTexto(trabalho, texto) : 'pre';
  const campos = texto ? camposDoTrabalho(texto, formato).filter((c) => c.valor.trim()) : [];
  const nomes = new Map(campos.map((c) => [c.chave, c.nome]));

  const comentar = () => {
    const chave = ultimo.current;
    const c = chave ? controles.current.get(chave) : undefined;
    const campo = campos.find((x) => x.chave === chave);
    if (!c || !campo) return setErro('Selecione um trecho do texto (arraste com o mouse) e clique em "Comentar".');
    const [a, b] = c.sel();
    if (a === b) return setErro('Selecione um trecho do texto (arraste com o mouse) e clique em "Comentar".');
    setErro('');
    setComentario('');
    setNovo({ campo: campo.chave, nome: campo.nome, trecho: campo.valor.slice(a, b), prefixo: campo.valor.slice(Math.max(0, a - 40), a) });
  };
  const salvar = async () => {
    if (!novo || !comentario.trim()) return;
    setSalvando(true);
    try {
      const l = await mudarApontamento(pub.codigo, cab, { acao: 'criar', ...novo, texto: comentario.trim() });
      setLista(l);
      setAtivo(l[l.length - 1]?.id ?? null);
      setNovo(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const mostrados = (filtro === 'abertos' ? emAberto(lista) : lista).slice().sort((x, y) => campos.findIndex((c) => c.chave === x.campo) - campos.findIndex((c) => c.chave === y.campo));
  const primeiro = (orientando?.nome ?? '').split(' ')[0] || 'o orientando';
  return (
    <ContextoPagina.Provider value={pagina}>
      <ContextoApontamentos.Provider value={estado}>
        <div className="ori-foco lc" role="dialog" aria-label="Ler e comentar">
          <header className="ori-foco-topo">
            <div className="ori-foco-titulo">
              Ler e comentar <span>· {orientando?.nome ?? ''} · {formato === 'final' ? 'trabalho final' : 'pré-projeto'}</span>
            </div>
            <span className="ajuda" style={{ margin: 0 }}>
              {emAberto(lista).length} em aberto · {lista.length - emAberto(lista).length} resolvido(s)
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" className="botao pequeno" onClick={() => void carregar()}>
                Atualizar
              </button>
              <button type="button" className="botao pequeno escuro" onClick={aoFechar}>
                Fechar
              </button>
            </span>
          </header>
          <div className="ori-foco-corpo">
            <div className="ori-foco-esq lc-texto">
              {envio && texto && (
                <p className={`lc-envio${(texto.atualizado_em ?? '') !== (envio.projeto?.atualizado_em ?? '') ? ' mudou' : ''}`}>
                  {(texto.atualizado_em ?? '') === (envio.projeto?.atualizado_em ?? '')
                    ? `Este é o texto de "${envio.rotulo}" (sem mudanças desde o envio). Os apontamentos aparecem para ${primeiro} na página de orientação.`
                    : `${primeiro} mudou o texto depois de "${envio.rotulo}". Você está vendo o texto atual, que é onde os apontamentos ficam; a versão enviada continua guardada no PDF da linha do tempo.`}
                </p>
              )}
              {!texto ? (
                <p className="ajuda">{erro || (texto === null ? `Abrindo o texto de ${primeiro}…` : '')}</p>
              ) : !campos.length ? (
                <p className="ajuda">{primeiro} ainda não escreveu nada.</p>
              ) : (
                campos.map((c) => (
                  <section key={c.chave} className="lc-campo" onMouseUp={() => (ultimo.current = c.chave)} onFocus={() => (ultimo.current = c.chave)} onTouchEnd={() => (ultimo.current = c.chave)}>
                    <h3 className="lc-nome">{c.nome}</h3>
                    <Suspense fallback={<p className="lc-cru">{c.valor}</p>}>
                      <EditorVivo
                        id={`lc-${c.chave}`}
                        rotulo={c.nome}
                        valor={c.valor}
                        aoMudar={() => undefined}
                        linhas={1}
                        subtitulos={c.subtitulos}
                        somenteLeitura
                        aoEditarBloco={() => undefined}
                        controle={(k) => (k ? controles.current.set(c.chave, k) : controles.current.delete(c.chave))}
                        marcas={marcasDoCampo(lista, c.chave, c.valor, ativo)}
                        aoClicarMarca={(id) => irPara(id, setAtivo)}
                      />
                    </Suspense>
                  </section>
                ))
              )}
            </div>
            <aside className="ori-foco-dir lc-lado">
              <div className="ori-seg" role="tablist">
                <button type="button" className={filtro === 'abertos' ? 'atual' : ''} onClick={() => setFiltro('abertos')}>
                  Em aberto ({emAberto(lista).length})
                </button>
                <button type="button" className={filtro === 'todos' ? 'atual' : ''} onClick={() => setFiltro('todos')}>
                  Todos ({lista.length})
                </button>
              </div>
              {!mostrados.length && <p className="ajuda">{lista.length ? 'Nenhum em aberto.' : 'Nenhum apontamento ainda. Selecione um trecho do texto e clique em "Comentar".'}</p>}
              {mostrados.map((a) => {
                const campo = campos.find((c) => c.chave === a.campo);
                const alterado = !campo || !marcasDoCampo([a], a.campo, campo.valor, null).length;
                return (
                  <div key={a.id}>
                    <span className="lc-onde">{nomes.get(a.campo) ?? 'Parte removida ou vazia'}</span>
                    <CartaoApontamento a={a} alterado={alterado} />
                  </div>
                );
              })}
            </aside>
          </div>
          <footer className="ori-foco-pe">
            <span className="ajuda" style={{ margin: 0, flex: 1 }}>
              {erro || 'Selecione um trecho do texto (arraste com o mouse) e clique em "Comentar". Clique num trecho amarelo para ver o apontamento.'}
            </span>
            <button type="button" className="botao primario" onClick={comentar}>
              Comentar o trecho selecionado
            </button>
          </footer>
          {novo && (
            <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && !salvando && setNovo(null)}>
              <div className="modal" role="dialog" aria-label="Novo apontamento">
                <h2>Apontamento</h2>
                <p className="ajuda" style={{ marginTop: 0 }}>
                  Em {novo.nome}:
                </p>
                <blockquote className="apont-trecho">“{novo.trecho.length > 300 ? `${novo.trecho.slice(0, 300)}…` : novo.trecho}”</blockquote>
                <div className="campo">
                  <label htmlFor="lc-com">O que {primeiro} deve considerar, acrescentar ou corrigir</label>
                  <textarea id="lc-com" rows={5} value={comentario} onChange={(e) => setComentario(e.target.value)} autoFocus />
                </div>
                <div className="modal-botoes">
                  <button type="button" className="botao primario" disabled={salvando || !comentario.trim()} onClick={() => void salvar()}>
                    {salvando ? 'Salvando…' : 'Salvar o apontamento'}
                  </button>
                  <button type="button" className="botao" disabled={salvando} onClick={() => setNovo(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ContextoApontamentos.Provider>
    </ContextoPagina.Provider>
  );
}
