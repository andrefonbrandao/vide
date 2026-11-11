// Processo fictício como a turma vê (inspirado num processo eletrônico, sem copiar nenhum):
// capa, partes e representantes, tabela de eventos e a leitura das peças.
// Também serve de prévia na tela do professor (com os eventos ainda não liberados marcados).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Logo } from '../comum/Logo';
import { db } from '../dados/db';
import { abrirDocumento } from '../material/documento';
import { PAGINA_INTEIRA } from '../material/regiao';
import { acharCitacoes, chaveCitacao } from '../processo/citacoes';
import { liberado } from '../processo/liberacao';
import { lerTexto, type Trecho } from '../processo/texto';
import type { ArtigoCitado, DadosProcesso, Documento, EventoPublicado, Parte } from '../processo/tipos';
import { glossarioCompleto } from '../processo/glossario';
import { ClienteEmCena, ComTermos, Glossario, MapaProcedimento, Prazos } from './ProcessoExtras';

/** Como buscar o PDF de uma peça (no link: pelo serviço; na prévia do professor: no acervo local). */
export type BuscarArquivo = (arquivo: string) => Promise<Blob>;

/** PDFs anexados ficam nos materiais do acervo deste computador (e vão para o Google Drive com eles). */
export const buscarNoAcervo: BuscarArquivo = async (id) => {
  const m = await db.materiais.get(id);
  if (!m || !m.arquivo.size) throw new Error('PDF não encontrado neste computador.');
  return m.arquivo;
};

const MARCA = 'PROCESSO FICTÍCIO — USO DIDÁTICO';

function dataBR(iso: string, comHora = true): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString('pt-BR');
  return comHora ? `${dia} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : dia;
}

/** Texto com as citações de artigos viradas em links (quando o texto do artigo veio junto). */
function ComLinks({ texto, artigos, aoAbrir }: { texto: string; artigos?: Record<string, ArtigoCitado>; aoAbrir: (a: ArtigoCitado) => void }) {
  if (!artigos) return <>{texto}</>;
  const partes: React.ReactNode[] = [];
  let pos = 0;
  for (const c of acharCitacoes(texto)) {
    const a = artigos[chaveCitacao(c)];
    if (!a) continue;
    if (c.inicio > pos) partes.push(texto.slice(pos, c.inicio));
    partes.push(
      <button key={c.inicio} type="button" className="peca-artigo" onClick={() => aoAbrir(a)} title={`Ver o texto: ${a.titulo}`}>
        {texto.slice(c.inicio, c.fim)}
      </button>,
    );
    pos = c.fim;
  }
  if (pos < texto.length) partes.push(texto.slice(pos));
  return <>{partes}</>;
}

function Trechos({ trechos, artigos, aoAbrir }: { trechos: Trecho[]; artigos?: Record<string, ArtigoCitado>; aoAbrir: (a: ArtigoCitado) => void }) {
  return (
    <>
      {trechos.map((t, i) => {
        const conteudo = <ComLinks texto={t.t} artigos={artigos} aoAbrir={aoAbrir} />;
        return t.negrito ? <strong key={i}>{conteudo}</strong> : t.italico ? <em key={i}>{conteudo}</em> : <Fragment key={i}>{conteudo}</Fragment>;
      })}
    </>
  );
}

/** O texto de um artigo citado, por cima da peça. */
function JanelaArtigo({ artigo, aoFechar }: { artigo: ArtigoCitado; aoFechar: () => void }) {
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal peca-janela-artigo" role="dialog" aria-label={artigo.titulo}>
        <h2 style={{ marginTop: 0 }}>{artigo.titulo}</h2>
        <div className="treino-artigo">
          {artigo.blocos.map((b, i) => (
            <p key={i} className={b.destaque ? 'destaque' : ''} style={{ marginLeft: `${b.nivel * 1.2}em` }}>
              {b.rotulo && <b>{b.rotulo} </b>}
              {b.texto}
            </p>
          ))}
        </div>
        <div className="modal-botoes">
          <button className="botao primario" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/** As páginas de um PDF anexado, desenhadas na largura da tela. */
export function PdfDaPeca({ arquivo, buscar }: { arquivo: string; buscar: BuscarArquivo }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [paginas, setPaginas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const docRef = useRef<Awaited<ReturnType<typeof abrirDocumento>> | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const blob = await buscar(arquivo);
        const doc = await abrirDocumento({
          id: `processo:${arquivo}`,
          tipo: 'pdf',
          arquivo: blob,
        });
        if (!vivo) return;
        docRef.current = doc;
        setPaginas(doc.paginas);
      } catch {
        if (vivo) setErro('Não foi possível abrir o PDF. Confira a internet e tente de novo.');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [arquivo, buscar]);
  useEffect(() => {
    const doc = docRef.current;
    const el = caixa.current;
    if (!doc || !el || !paginas) return;
    const largura = Math.min(900, el.clientWidth);
    el.querySelectorAll('canvas').forEach((c, i) => void doc.desenhar(c, i + 1, PAGINA_INTEIRA, largura, 100000));
  }, [paginas]);
  if (erro) return <p className="digitar-msg erro">{erro}</p>;
  if (!paginas) return <p className="ajuda">Abrindo o PDF…</p>;
  return (
    <div ref={caixa} className="peca-pdf">
      {Array.from({ length: paginas }, (_, i) => (
        <div key={i} className="peca-pdf-pagina marca-dagua-sobre">
          <canvas aria-label={`Página ${i + 1} de ${paginas}`} />
        </div>
      ))}
    </div>
  );
}

/** O texto da peça, com títulos, citações e listas (e os artigos citados clicáveis). */
export function TextoPeca({ texto, artigos }: { texto: string; artigos?: Record<string, ArtigoCitado> }) {
  const blocos = useMemo(() => lerTexto(texto), [texto]);
  const [aberto, setAberto] = useState<ArtigoCitado | null>(null);
  if (!blocos.length) return <p className="ajuda">(documento sem texto)</p>;
  return (
    <>
      {aberto && <JanelaArtigo artigo={aberto} aoFechar={() => setAberto(null)} />}
      <div className="peca-texto">
        {blocos.map((b, i) => {
          if (b.tipo === 'lista')
            return (
              <ul key={i}>
                {b.itens.map((it, k) => (
                  <li key={k}>
                    <Trechos trechos={it} artigos={artigos} aoAbrir={setAberto} />
                  </li>
                ))}
              </ul>
            );
          const Tag = b.tipo === 'titulo' ? 'h2' : b.tipo === 'subtitulo' ? 'h3' : b.tipo === 'citacao' ? 'blockquote' : 'p';
          return (
            <Tag key={i}>
              <Trechos trechos={b.trechos} artigos={artigos} aoAbrir={setAberto} />
            </Tag>
          );
        })}
      </div>
    </>
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

function Peca({
  dados,
  evento,
  doc,
  aoFechar,
  buscar,
}: {
  dados: DadosProcesso;
  evento: EventoPublicado;
  doc: Documento;
  aoFechar: () => void;
  buscar?: BuscarArquivo;
}) {
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
        {doc.tipo === 'pdf' && doc.arquivo && buscar ? (
          <PdfDaPeca arquivo={doc.arquivo} buscar={buscar} />
        ) : (
          <TextoPeca texto={doc.texto} artigos={doc.artigos} />
        )}
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
export function VisaoProcesso({
  dados,
  previa = false,
  novos,
  buscar,
  lendoControlado,
  aoLer,
}: {
  dados: DadosProcesso;
  previa?: boolean;
  novos?: Set<string>;
  buscar?: BuscarArquivo;
  /** Projeção: a peça aberta vem de fora (o professor escolhe). */
  lendoControlado?: { eventoId: string; docId: string } | null;
  aoLer?: (l: { eventoId: string; docId: string } | null) => void;
}) {
  const [lendoLocal, setLendoLocal] = useState<{
    e: EventoPublicado;
    d: Documento;
  } | null>(null);
  const controlado = lendoControlado !== undefined;
  const lendo = controlado
    ? (() => {
        const e = dados.eventos.find((x) => x.id === lendoControlado?.eventoId);
        const d = e?.documentos.find((x) => x.id === lendoControlado?.docId);
        return e && d ? { e, d } : null;
      })()
    : lendoLocal;
  const setLendo = (l: { e: EventoPublicado; d: Documento } | null) => {
    if (!controlado) setLendoLocal(l);
    aoLer?.(l ? { eventoId: l.e.id, docId: l.d.id } : null);
  };
  const [agora] = useState(Date.now());
  const { capa } = dados;
  const eventos = [...dados.eventos].sort((a, b) => b.numero - a.numero);
  const termos = glossarioCompleto(dados.glossario);
  // O mapa e os prazos seguem o que a turma já vê (na prévia, só os liberados contam para o mapa).
  const emOrdem = [...dados.eventos].sort((a, b) => a.numero - b.numero);
  const vistos = previa ? emOrdem.filter((e) => !('libera' in e) || liberado(e as EventoPublicado, agora)) : emOrdem;
  if (lendo) return <Peca dados={dados} evento={lendo.e} doc={lendo.d} aoFechar={() => setLendo(null)} buscar={buscar} />;
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
      {dados.cliente && dados.cliente.falas.length > 0 && <ClienteEmCena cliente={dados.cliente} />}
      {vistos.length > 0 && <MapaProcedimento eventos={vistos} />}
      <Prazos eventos={previa ? emOrdem : vistos} previa={previa} />
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
                      {e.descricao ? <ComTermos texto={e.descricao} termos={termos} /> : '—'}
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
      <Glossario textos={vistos.map((e) => e.descricao)} proprios={dados.glossario} />
    </div>
  );
}

const chaveVistos = (codigo: string) => `vide.processo.${codigo}.vistos`;

/** Página pública do processo: /p/<código>. Sem cadastro; as "novidades" ficam só neste aparelho. */
export function PaginaProcesso({ codigo }: { codigo: string }) {
  const buscar = useMemo<BuscarArquivo>(
    () => async (arquivo) => {
      const r = await fetch(`/api/processo/${codigo}/arquivo/${arquivo}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    },
    [codigo],
  );
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
      {erro ? (
        <p className="jogar-grande" style={{ padding: 20 }}>
          {erro}
        </p>
      ) : !dados ? (
        <p className="ajuda" style={{ padding: 20 }}>
          Abrindo o processo…
        </p>
      ) : (
        <VisaoProcesso dados={dados} novos={novos} buscar={buscar} />
      )}
    </div>
  );
}
