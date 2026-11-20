// Página do orientando (/o/<código>): pede o código de 6 números e mostra o cronograma,
// as pendências, os elementos do trabalho e os modelos para baixar. Só leitura.
import { useEffect, useState } from 'react';
import { Logo } from '../comum/Logo';
import { dataBR, etapaAtual, hojeISO, rotuloDias, situacaoEtapa } from '../orientacao/prazos';
import { CAMPOS_ELEMENTOS } from '../orientacao/campos';
import type { DadosOrientando } from '../orientacao/tipos';
import { MeuPreProjeto } from './PreProjetoForm';

const chavePin = (codigo: string) => `vide.orientacao.pin.${codigo}`;

function tamanho(n?: number): string {
  if (!n) return '';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Nome sem acentos (alguns navegadores trocam por "download" um nome com acentos). */
function nomeSeguro(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .()-]+/g, '-');
}

async function entrar(codigo: string, pin: string): Promise<DadosOrientando> {
  const r = await fetch(`/api/orientacao/${codigo}/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  if (r.ok) return (await r.json()) as DadosOrientando;
  const corpo = (await r.json().catch(() => ({}))) as { restam?: number; minutos?: number };
  if (r.status === 404) throw new Error('Esta página não existe ou foi desativada pelo orientador.');
  if (r.status === 429) throw new Error(`Muitas tentativas erradas. Tente de novo em ${corpo.minutos ?? 15} minutos.`);
  if (r.status === 403) throw new Error(`Código errado.${corpo.restam !== undefined ? ` Restam ${corpo.restam} ${corpo.restam === 1 ? 'tentativa' : 'tentativas'} antes de um bloqueio de 15 minutos.` : ''}`);
  throw new Error('Não foi possível abrir a página. Confira a internet e tente de novo.');
}

export function PaginaOrientando({ codigo }: { codigo: string }) {
  const [dados, setDados] = useState<DadosOrientando | null>(null);
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [aba, setAba] = useState<'acompanhamento' | 'projeto'>(() => (location.hash === '#pre-projeto' ? 'projeto' : 'acompanhamento'));

  const abrir = async (p: string, guardar: boolean) => {
    setAbrindo(true);
    setErro(null);
    try {
      const d = await entrar(codigo, p);
      setDados(d);
      setPin(p);
      document.title = `Orientação — ${d.nome || 'Vide'}`;
      try {
        if (guardar) sessionStorage.setItem(chavePin(codigo), p);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setErro((e as Error).message);
      try {
        sessionStorage.removeItem(chavePin(codigo));
      } catch {
        /* ignore */
      }
    } finally {
      setAbrindo(false);
    }
  };

  useEffect(() => {
    document.title = 'Orientação — Vide';
    let guardado: string | null = null;
    try {
      guardado = sessionStorage.getItem(chavePin(codigo));
    } catch {
      guardado = null;
    }
    if (guardado) void abrir(guardado, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const baixar = async (id: string, nome: string, mime?: string) => {
    setBaixando(id);
    try {
      const r = await fetch(`/api/orientacao/${codigo}/arquivo/${id}`, { headers: { 'X-Vide-Pin': pin } });
      if (!r.ok) throw new Error(r.status === 404 ? 'Este arquivo não está mais na página.' : 'Não foi possível baixar. Tente de novo.');
      const blob = new Blob([await r.blob()], { type: mime || 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nomeSeguro(nome);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBaixando(null);
    }
  };

  const hoje = hojeISO();
  return (
    <div className="proc-pagina">
      <header className="proc-topo">
        <Logo altura={22} />
        <span>Orientação</span>
        {dados && (
          <button
            type="button"
            className="link-discreto"
            onClick={() => {
              try {
                sessionStorage.removeItem(chavePin(codigo));
              } catch {
                /* ignore */
              }
              setDados(null);
              setPin('');
            }}
          >
            sair
          </button>
        )}
      </header>
      {!dados ? (
        <form
          className="oa-entrar"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{6}$/.test(pin)) void abrir(pin, true);
          }}
        >
          <h1>Página de orientação</h1>
          <p className="ajuda">Digite o código de acesso de 6 números que o seu orientador mandou.</p>
          <input
            className="oa-pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Código de acesso"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
          />
          <button className="botao primario" disabled={pin.length !== 6 || abrindo}>
            {abrindo ? 'Abrindo…' : 'Entrar'}
          </button>
          {erro && <p className="oa-erro">{erro}</p>}
        </form>
      ) : (
        <main className="proc oa">
          <section className="oa-cab">
            <h1>{dados.nome}</h1>
            <p>
              <strong>{dados.trabalho.tipo}</strong>
              {dados.trabalho.titulo ? ` · ${dados.trabalho.titulo}` : ''}
            </p>
            <p className="ajuda" style={{ margin: 0 }}>
              {dados.trabalho.defesa ? `Defesa prevista em ${dataBR(dados.trabalho.defesa)} (${rotuloDias(situacaoEtapa({ id: '', nome: '', prazo: dados.trabalho.defesa }, hoje).dias)})` : ''}
            </p>
          </section>
          {erro && <p className="oa-erro">{erro}</p>}
          {dados.preProjeto?.ativo && (
            <nav className="oa-abas" aria-label="Partes da página">
              <button type="button" className={`botao pequeno${aba === 'acompanhamento' ? ' escuro' : ''}`} onClick={() => (setAba('acompanhamento'), history.replaceState(null, '', '#'))}>
                Acompanhamento
              </button>
              <button type="button" className={`botao pequeno${aba === 'projeto' ? ' escuro' : ''}`} onClick={() => (setAba('projeto'), history.replaceState(null, '', '#pre-projeto'))}>
                Meu pré-projeto
              </button>
            </nav>
          )}
          {aba === 'projeto' && dados.preProjeto?.ativo ? (
            <MeuPreProjeto codigo={codigo} pin={pin} dados={dados} />
          ) : (
          <>
          {(() => {
            const e = etapaAtual({ etapas: dados.etapas });
            if (!e || dados.trabalho.situacao !== 'andamento') return null;
            const s = situacaoEtapa(e, hoje);
            return (
              <section className={`oa-agora ${s.tipo}`}>
                <span>Etapa da vez</span>
                <strong>{e.nome}</strong>
                <span>
                  {rotuloDias(s.dias)} · prazo {dataBR(e.prazo)}
                </span>
              </section>
            );
          })()}

          <section className="proc-caixa">
            <h2 className="proc-caixa-titulo">Pendências</h2>
            {!dados.pendencias.length ? (
              <p className="oa-vazio">Nenhuma pendência em aberto.</p>
            ) : (
              <ul className="oa-lista">
                {dados.pendencias.map((p, k) => (
                  <li key={k}>
                    <span className={`ori-tipo-enc ${p.tipo}`}>{p.tipo === 'comando' ? 'fazer' : 'sugestão'}</span>
                    <span>
                      {p.texto}
                      <span className="ajuda">
                        {' '}
                        · combinado em {dataBR(p.de)}
                        {p.prazo ? ` · até ${dataBR(p.prazo)} (${rotuloDias(situacaoEtapa({ id: '', nome: '', prazo: p.prazo }, hoje).dias)})` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="proc-caixa">
            <h2 className="proc-caixa-titulo">Cronograma</h2>
            {!dados.etapas.length ? (
              <p className="oa-vazio">Sem etapas ainda.</p>
            ) : (
              <ul className="oa-lista oa-cronograma">
                {dados.etapas.map((e) => {
                  const s = situacaoEtapa(e, hoje);
                  return (
                    <li key={e.id} className={s.tipo}>
                      <span className="oa-marca">{s.tipo === 'concluida' ? '✓' : ''}</span>
                      <span className="oa-etapa">{e.nome}</span>
                      <span className="oa-prazo">{dataBR(e.prazo)}</span>
                      <span className="oa-situacao">{s.tipo === 'concluida' ? 'cumprida' : rotuloDias(s.dias)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {dados.elementos && (
            <section className="proc-caixa">
              <h2 className="proc-caixa-titulo">Elementos do trabalho</h2>
              <dl className="oa-elementos">
                {CAMPOS_ELEMENTOS.map((c) => {
                  const v = dados.elementos![c.campo];
                  if (Array.isArray(v) ? !v.length : !v?.trim()) return null;
                  return (
                    <div key={c.campo}>
                      <dt>{c.nome}</dt>
                      <dd>
                        {Array.isArray(v) ? (
                          <ol type="a">
                            {v.map((x, k) => (
                              <li key={k}>{x}</li>
                            ))}
                          </ol>
                        ) : (
                          v
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {dados.elementos.atualizado_em && <p className="ajuda oa-rodape">Atualizados em {dataBR(dados.elementos.atualizado_em)}.</p>}
            </section>
          )}

          <section className="proc-caixa">
            <h2 className="proc-caixa-titulo">Modelos e orientações</h2>
            {!dados.modelos.length ? (
              <p className="oa-vazio">Nenhum modelo ainda.</p>
            ) : (
              <ul className="oa-modelos">
                {dados.modelos.map((m) => (
                  <li key={m.id}>
                    <div>
                      <strong>{m.titulo}</strong>
                      {m.descricao && <span className="ajuda"> · {m.descricao}</span>}
                      {m.tipo === 'arquivo' ? (
                        <span className="ajuda" style={{ display: 'block', margin: 0 }}>
                          {m.nomeArquivo} · {tamanho(m.tamanho)}
                        </span>
                      ) : (
                        <p className="oa-texto">{m.texto}</p>
                      )}
                    </div>
                    {m.tipo === 'arquivo' && (
                      <button type="button" className="botao pequeno" disabled={baixando === m.id} onClick={() => void baixar(m.id, m.nomeArquivo ?? 'arquivo', m.mime)}>
                        {baixando === m.id ? 'Baixando…' : 'Baixar'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          </>
          )}
          <p className="ajuda oa-rodape">Página atualizada pelo orientador em {new Date(dados.publicadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p>
        </main>
      )}
    </div>
  );
}
