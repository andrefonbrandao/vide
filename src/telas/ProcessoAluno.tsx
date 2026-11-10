// Processo fictício como a turma vê (inspirado num processo eletrônico, sem copiar nenhum):
// capa, partes e representantes, tabela de eventos e a leitura das peças.
// Também serve de prévia na tela do professor (com os eventos ainda não liberados marcados).
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Logo } from '../comum/Logo';
import { liberado } from '../processo/liberacao';
import { lerTexto, type Trecho } from '../processo/texto';
import type { DadosProcesso, Documento, EventoPublicado, Parte } from '../processo/tipos';

const MARCA = 'PROCESSO FICTÍCIO — USO DIDÁTICO';

function dataBR(iso: string, comHora = true): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString('pt-BR');
  return comHora ? `${dia} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : dia;
}

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.negrito ? <strong key={i}>{t.t}</strong> : t.italico ? <em key={i}>{t.t}</em> : <Fragment key={i}>{t.t}</Fragment>,
      )}
    </>
  );
}

/** O texto da peça, com títulos, citações e listas. */
export function TextoPeca({ texto }: { texto: string }) {
  const blocos = useMemo(() => lerTexto(texto), [texto]);
  if (!blocos.length) return <p className="ajuda">(documento sem texto)</p>;
  return (
    <div className="peca-texto">
      {blocos.map((b, i) => {
        if (b.tipo === 'lista')
          return (
            <ul key={i}>
              {b.itens.map((it, k) => (
                <li key={k}>
                  <Trechos trechos={it} />
                </li>
              ))}
            </ul>
          );
        const Tag = b.tipo === 'titulo' ? 'h2' : b.tipo === 'subtitulo' ? 'h3' : b.tipo === 'citacao' ? 'blockquote' : 'p';
        return (
          <Tag key={i}>
            <Trechos trechos={b.trechos} />
          </Tag>
        );
      })}
    </div>
  );
}

function PartesDoPolo({ titulo, partes }: { titulo: string; partes: Parte[] }) {
  return (
    <div className="proc-polo">
      <h3>{titulo}</h3>
      {partes.length ? (
        partes.map((p) => (
          <div key={p.id} className="proc-parte">
            <strong>{p.nome}</strong>
            {p.qualificacao && <span className="proc-qualif"> ({p.qualificacao})</span>}
            {p.advogados.map((a, i) => (
              <div key={i} className="proc-adv">
                Advogado(a): {a.nome || '—'}
                {a.oab && <span className="mono"> · {a.oab}</span>}
              </div>
            ))}
          </div>
        ))
      ) : (
        <p className="ajuda">—</p>
      )}
    </div>
  );
}

function Peca({ dados, evento, doc, aoFechar }: { dados: DadosProcesso; evento: EventoPublicado; doc: Documento; aoFechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    window.scrollTo({ top: 0 });
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar]);
  return (
    <div className="proc-leitura">
      <div className="proc-leitura-topo">
        <button className="botao pequeno" onClick={aoFechar}>
          ← Voltar ao processo
        </button>
        <span className="mono proc-leitura-ref">
          {dados.capa.numero} · Evento {evento.numero} · {doc.sigla}
        </span>
      </div>
      <article className="proc-folha marca-dagua">
        <p className="proc-folha-cab">
          {doc.titulo || evento.descricao} <span className="mono">({doc.sigla})</span>
        </p>
        <TextoPeca texto={doc.texto} />
        <p className="proc-folha-rodape">
          {MARCA} · Evento {evento.numero} · {dataBR(evento.data)}
        </p>
      </article>
    </div>
  );
}

/**
 * A tela do processo. `previa` = vista do professor: mostra também os eventos ainda não
 * liberados, marcados. `novos` = ids dos eventos que o aluno ainda não tinha visto.
 */
export function VisaoProcesso({ dados, previa = false, novos }: { dados: DadosProcesso; previa?: boolean; novos?: Set<string> }) {
  const [lendo, setLendo] = useState<{ e: EventoPublicado; d: Documento } | null>(null);
  const [agora] = useState(Date.now());
  const { capa } = dados;
  const eventos = [...dados.eventos].sort((a, b) => b.numero - a.numero);
  if (lendo) return <Peca dados={dados} evento={lendo.e} doc={lendo.d} aoFechar={() => setLendo(null)} />;
  const qtdNovos = novos ? dados.eventos.filter((e) => novos.has(e.id)).length : 0;
  const campos: [string, string][] = [
    ['Nº do processo', capa.numero],
    ['Classe da ação', capa.classe],
    ['Assunto(s)', capa.assuntos || '—'],
    ['Órgão julgador', capa.juizo],
    ['Juiz(a)', capa.juiz || '—'],
    ['Data de autuação', dataBR(capa.autuadoEm, false)],
    ['Situação', capa.situacao],
    ['Valor da causa', capa.valorCausa || '—'],
  ];
  return (
    <div className="proc">
      <div className="proc-faixa" role="note">
        {MARCA}
      </div>
      {qtdNovos > 0 && (
        <p className="proc-novidades">
          <strong>{qtdNovos}</strong> {qtdNovos === 1 ? 'novidade' : 'novidades'} desde a sua última visita
        </p>
      )}
      <section className="proc-caixa">
        <h2 className="proc-caixa-titulo">Capa do processo</h2>
        <dl className="proc-capa">
          {campos.map(([k, v]) => (
            <div key={k} className={k === 'Nº do processo' ? 'proc-numero' : ''}>
              <dt>{k}</dt>
              <dd className={k === 'Nº do processo' ? 'mono' : ''}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="proc-caixa">
        <h2 className="proc-caixa-titulo">Partes e representantes</h2>
        <div className="proc-partes">
          <PartesDoPolo titulo="Autor" partes={dados.partes.filter((p) => p.polo === 'ativo')} />
          <PartesDoPolo titulo="Réu" partes={dados.partes.filter((p) => p.polo === 'passivo')} />
          {dados.partes.some((p) => p.polo === 'outro') && <PartesDoPolo titulo="Outros" partes={dados.partes.filter((p) => p.polo === 'outro')} />}
        </div>
      </section>
      <section className="proc-caixa">
        <h2 className="proc-caixa-titulo">Eventos</h2>
        {!eventos.length ? (
          <p className="ajuda" style={{ padding: '10px 14px' }}>
            Nenhum evento ainda.
          </p>
        ) : (
          <table className="proc-eventos">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Data/Hora</th>
                <th>Descrição</th>
                <th>Usuário</th>
                <th>Documentos</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const naoLiberado = previa && 'libera' in e && !liberado(e as EventoPublicado, agora);
                const novo = novos?.has(e.id);
                return (
                  <tr key={e.id} className={`${novo ? 'novo' : ''}${naoLiberado ? ' futuro' : ''}`}>
                    <td className="mono" data-rotulo="Evento">
                      {e.numero}
                    </td>
                    <td className="mono" data-rotulo="Data/Hora">
                      {dataBR(e.data)}
                    </td>
                    <td data-rotulo="Descrição">
                      {e.descricao || '—'}
                      {novo && <span className="proc-selo">novo</span>}
                      {naoLiberado && (
                        <span className="proc-selo futuro">
                          {e.libera === null ? 'segurado: só você vê' : `aparece em ${dataBR(new Date(e.libera).toISOString())}`}
                        </span>
                      )}
                    </td>
                    <td data-rotulo="Usuário">{e.usuario || '—'}</td>
                    <td data-rotulo="Documentos">
                      {e.documentos.length ? (
                        <span className="proc-docs">
                          {e.documentos.map((d) => (
                            <button key={d.id} className="proc-doc" onClick={() => setLendo({ e, d })} title={d.titulo || d.sigla}>
                              {d.sigla}
                            </button>
                          ))}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const chaveVistos = (codigo: string) => `vide.processo.${codigo}.vistos`;

/** Página pública do processo: /p/<código>. Sem cadastro; as "novidades" ficam só neste aparelho. */
export function PaginaProcesso({ codigo }: { codigo: string }) {
  const [dados, setDados] = useState<DadosProcesso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  useEffect(() => {
    document.title = 'Processo — Vide';
    fetch(`/api/processo/${codigo}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error('Este processo não existe ou o link foi desativado pelo professor.');
        if (!r.ok) throw new Error('Não foi possível abrir o processo. Confira a internet e tente de novo.');
        const d = (await r.json()) as DadosProcesso;
        let vistos: string[] | null = null;
        try {
          vistos = JSON.parse(localStorage.getItem(chaveVistos(codigo)) ?? 'null') as string[] | null;
        } catch {
          vistos = null;
        }
        // Na primeira visita, nada é "novidade".
        if (vistos) setNovos(new Set(d.eventos.map((e) => e.id).filter((id) => !vistos!.includes(id))));
        try {
          localStorage.setItem(chaveVistos(codigo), JSON.stringify(d.eventos.map((e) => e.id)));
        } catch {
          /* ignore */
        }
        setDados(d);
        document.title = `Processo ${d.capa.numero} — Vide`;
      })
      .catch((e: Error) => setErro(e.message));
  }, [codigo]);
  return (
    <div className="proc-pagina">
      <header className="proc-topo">
        <Logo altura={22} />
        <span>Consulta processual</span>
      </header>
      {erro ? <p className="jogar-grande" style={{ padding: 20 }}>{erro}</p> : !dados ? <p className="ajuda" style={{ padding: 20 }}>Abrindo o processo…</p> : <VisaoProcesso dados={dados} novos={novos} />}
    </div>
  );
}
