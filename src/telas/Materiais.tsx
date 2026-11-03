// Materiais do professor (PDFs, imagens) organizados em pastas e etiquetas.
// - <ListaMateriais/> e <AdicionarMaterial/>: aba Acervo (organizar, apagar, carregar).
// - <SeletorMaterial/>: botão da tela da aula, com busca, para escolher o material.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Material } from '../dados/modelo';
import { abrirDocumentoPorId, atualizarMaterial, excluirMaterial, importarMaterial, limparEtiquetas, listarMateriais, type Documento } from '../material/documento';
import { CanvasMaterial } from '../material/CanvasMaterial';
import { PAGINA_INTEIRA } from '../material/regiao';
import { IcDocumento, IcMais, IcPasta, IcSetaBaixo } from '../comum/Icones';
import {
  agruparPorPasta,
  conteudoDaPasta,
  degrausDaPasta,
  filtrarMateriais,
  nomePasta,
  todasEtiquetas,
  todasPastas,
  type MaterialOrganizavel,
} from '../material/organizacao';

const CHAVE_ULTIMA_PASTA = 'vide.ultimaPasta';
const CHAVE_RECENTES = 'vide.materiaisRecentes';

function lerLocal(chave: string, padrao: string): string {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
}
function gravarLocal(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* ignore */
  }
}

/** Registra o uso de um material (para a lista "usados recentemente"). */
export function marcarUsado(id: string) {
  const atuais = lerLocal(CHAVE_RECENTES, '').split(',').filter(Boolean);
  gravarLocal(CHAVE_RECENTES, [id, ...atuais.filter((x) => x !== id)].slice(0, 6).join(','));
}

function useMateriais(): Material[] {
  const [lista, setLista] = useState<Material[]>([]);
  useEffect(() => {
    const recarregar = () => void listarMateriais().then(setLista);
    recarregar();
    window.addEventListener('vide-materiais-mudou', recarregar);
    return () => window.removeEventListener('vide-materiais-mudou', recarregar);
  }, []);
  return lista;
}

function Etiquetas({ lista, ativa, aoEscolher }: { lista: string[]; ativa?: string | null; aoEscolher?: (e: string) => void }) {
  if (!lista.length) return null;
  return (
    <span className="etiquetas">
      {lista.map((e) =>
        aoEscolher ? (
          <button key={e} type="button" className={`etiqueta-mat${ativa === e ? ' ativa' : ''}`} onClick={() => aoEscolher(e)}>
            {e}
          </button>
        ) : (
          <span key={e} className="etiqueta-mat">{e}</span>
        ),
      )}
    </span>
  );
}

/** Busca + filtro por etiqueta (compartilhado pela aba Acervo e pelo seletor da aula). */
function Filtros({
  lista,
  busca,
  setBusca,
  etiqueta,
  setEtiqueta,
  autoFoco,
}: {
  lista: MaterialOrganizavel[];
  busca: string;
  setBusca: (s: string) => void;
  etiqueta: string | null;
  setEtiqueta: (e: string | null) => void;
  autoFoco?: boolean;
}) {
  const etiquetas = todasEtiquetas(lista);
  return (
    <div className="filtros-mat">
      <input
        className="busca-mat"
        type="search"
        placeholder="Buscar por nome, pasta ou etiqueta…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoFocus={autoFoco}
        aria-label="Buscar material"
      />
      {etiquetas.length > 0 && (
        <div className="etiquetas">
          {etiquetas.slice(0, 20).map(({ etiqueta: e, total }) => (
            <button
              key={e}
              type="button"
              className={`etiqueta-mat${etiqueta === e ? ' ativa' : ''}`}
              onClick={() => setEtiqueta(etiqueta === e ? null : e)}
            >
              {e} <span className="total">{total}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Acervo
// ---------------------------------------------------------------------------

/** Lista de materiais, agrupada por pasta, com busca e etiquetas. */
const CHAVE_PASTA_ABERTA = 'vide.pastaAberta';

export function ListaMateriais({ aoAdicionar }: { aoAdicionar: () => void }) {
  const lista = useMateriais();
  const [busca, setBusca] = useState('');
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  // Pasta aberta (lembrada enquanto a aba do navegador estiver aberta). "" = início.
  const [aberta, setAbertaEstado] = useState(() => {
    try {
      return sessionStorage.getItem(CHAVE_PASTA_ABERTA) ?? '';
    } catch {
      return '';
    }
  });
  const abrir = (p: string) => {
    setAbertaEstado(p);
    setBusca('');
    setEtiqueta(null);
    try {
      sessionStorage.setItem(CHAVE_PASTA_ABERTA, p);
    } catch {
      /* ignore */
    }
  };

  const pastas = useMemo(() => todasPastas(lista), [lista]);
  const procurando = !!busca.trim() || !!etiqueta;
  const filtrados = useMemo(() => filtrarMateriais(lista, busca, etiqueta), [lista, busca, etiqueta]);
  const grupos = useMemo(() => agruparPorPasta(filtrados), [filtrados]);
  // A pasta aberta pode ter deixado de existir (materiais movidos ou apagados): volta ao início.
  const pastaValida = !aberta || pastas.includes(aberta);
  const atual = pastaValida ? aberta : '';
  const conteudo = useMemo(() => conteudoDaPasta(lista, atual), [lista, atual]);
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

  if (lista.length === 0) {
    return (
      <div className="vazio-acervo">
        <p>Nenhum material guardado ainda. Seus slides (PDF) e imagens aparecem aqui, organizados em pastas.</p>
        <button className="botao primario com-icone" onClick={aoAdicionar}>
          <IcMais /> Adicionar material
        </button>
      </div>
    );
  }

  const item = (m: Material, mostrarPasta = false) =>
    editando === m.id ? (
      <EditarMaterial key={m.id} m={m} aoFechar={() => setEditando(null)} />
    ) : (
      <li key={m.id} className="item-mat">
        <IcDocumento tamanho={20} />
        <div className="item-mat-info">
          <button className="nome-mat" onClick={() => setPrevia(m.id)} title="Ver o conteúdo">
            {m.nome}
          </button>{' '}
          <span className="ajuda">
            {m.tipo === 'pdf' ? 'PDF' : 'imagem'} · {m.paginas} {m.paginas === 1 ? 'página' : 'páginas'} · {mb(m.tamanho)}
          </span>
          {mostrarPasta && (
            <button className="link-pasta" onClick={() => abrir(m.pasta ?? '')}>
              <IcPasta tamanho={14} /> {nomePasta(m.pasta ?? '')}
            </button>
          )}
          <Etiquetas lista={m.etiquetas ?? []} ativa={etiqueta} aoEscolher={(e) => setEtiqueta(etiqueta === e ? null : e)} />
        </div>
        <button className="botao pequeno" onClick={() => setPrevia(m.id)}>Ver</button>
        <button className="botao pequeno" onClick={() => setEditando(m.id)}>Organizar</button>
        <button
          className="botao pequeno"
          onClick={async () => {
            if (!confirm(`Apagar "${m.nome}" dos materiais?`)) return;
            await excluirMaterial(m.id);
          }}
        >
          Apagar
        </button>
      </li>
    );

  return (
    <>
      {previa && lista.some((m) => m.id === previa) && (
        <PreviaMaterial
          m={lista.find((m) => m.id === previa)!}
          sequencia={(procurando ? grupos.flatMap((g) => g.itens) : conteudo.itens).map((m) => m.id)}
          aoTrocar={setPrevia}
          aoFechar={() => setPrevia(null)}
        />
      )}
      <h2>Materiais</h2>
      <datalist id="pastas-mat">
        {pastas.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="cartao">
        <Filtros lista={lista} busca={busca} setBusca={setBusca} etiqueta={etiqueta} setEtiqueta={setEtiqueta} />

        {procurando ? (
          <>
            <p className="ajuda">
              {filtrados.length === 0 ? 'Nada encontrado.' : `${filtrados.length} encontrado(s) em todas as pastas.`}{' '}
              <button className="link-pasta" onClick={() => abrir(atual)}>
                Limpar a busca
              </button>
            </p>
            <ul className="lista-mat">{grupos.flatMap((g) => g.itens.map((m) => item(m, true)))}</ul>
          </>
        ) : (
          <>
            <nav className="trilha-pastas" aria-label="Pasta aberta">
              <button className={`trilha-degrau${atual === '' ? ' atual' : ''}`} onClick={() => abrir('')}>
                <IcPasta tamanho={16} /> Todos os materiais
              </button>
              {degrausDaPasta(atual).map((d) => (
                <span key={d.pasta} className="trilha-item">
                  <span className="trilha-sep" aria-hidden="true">›</span>
                  <button className={`trilha-degrau${d.pasta === atual ? ' atual' : ''}`} onClick={() => abrir(d.pasta)}>
                    {d.nome}
                  </button>
                </span>
              ))}
              <span className="espaco" />
              {atual && (
                <button className="botao pequeno" onClick={() => abrir(atual.split('/').slice(0, -1).join('/'))}>
                  ↑ Voltar
                </button>
              )}
              <button
                className="botao pequeno com-icone"
                onClick={() => {
                  gravarLocal(CHAVE_ULTIMA_PASTA, atual);
                  aoAdicionar();
                }}
                title={atual ? `Adicionar material na pasta "${nomePasta(atual)}"` : 'Adicionar material'}
              >
                <IcMais tamanho={16} /> {atual ? 'Adicionar aqui' : 'Adicionar'}
              </button>
            </nav>

            {conteudo.subpastas.length > 0 && (
              <div className="grade-pastas">
                {conteudo.subpastas.map((sp) => (
                  <button key={sp.pasta} className="cartao-pasta" onClick={() => abrir(sp.pasta)}>
                    <IcPasta tamanho={26} />
                    <span className="cartao-pasta-nome">{sp.nome}</span>
                    <span className="cartao-pasta-total">
                      {sp.total} {sp.total === 1 ? 'material' : 'materiais'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {conteudo.itens.length > 0 && <ul className="lista-mat">{conteudo.itens.map((m) => item(m))}</ul>}
            {!conteudo.subpastas.length && !conteudo.itens.length && <p className="ajuda">Esta pasta está vazia.</p>}
          </>
        )}
      </div>
    </>
  );
}

/** Tela de adicionar material: pasta, etiquetas e arquivos. */
export function AdicionarMaterial({ aoVer }: { aoVer: () => void }) {
  const lista = useMateriais();
  const [pasta, setPasta] = useState(lerLocal(CHAVE_ULTIMA_PASTA, ''));
  const [etiquetasNovas, setEtiquetasNovas] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [arquivoKey, setArquivoKey] = useState(0);
  const pastas = useMemo(() => todasPastas(lista), [lista]);

  const carregar = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    gravarLocal(CHAVE_ULTIMA_PASTA, pasta);
    const etiquetas = limparEtiquetas([etiquetasNovas]);
    const ok: string[] = [];
    const falhas: string[] = [];
    setConcluido(false);
    for (const f of Array.from(arquivos)) {
      setMsg(`Carregando "${f.name}"…`);
      try {
        const m = await importarMaterial(f, { pasta, etiquetas });
        ok.push(m.nome);
      } catch (err) {
        falhas.push(`${f.name} (${(err as Error).message})`);
      }
    }
    setArquivoKey((k) => k + 1);
    setConcluido(ok.length > 0);
    setMsg(
      [ok.length ? `${ok.length} guardado(s)${pasta ? ` na pasta "${nomePasta(pasta)}"` : ''}.` : '', falhas.length ? `Não carregados: ${falhas.join('; ')}.` : '']
        .filter(Boolean)
        .join(' '),
    );
  };

  return (
    <>
      <h2>Adicionar material</h2>
      <p className="ajuda">
        Slides ou documentos para exibir no projetor durante a aula. No PowerPoint: <strong>Arquivo › Exportar › PDF</strong>.
        Também aceita imagens (PNG, JPG). Use "/" para subpastas, ex.: <em>Processo Civil II/Sentença</em>.
      </p>
      <div className="cartao">
        <datalist id="pastas-mat">
          {pastas.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="mat-pasta">1. Pasta</label>
            <input id="mat-pasta" list="pastas-mat" placeholder="Processo Civil II/Sentença" value={pasta} onChange={(e) => setPasta(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="mat-etq">2. Etiquetas (separe por vírgula)</label>
            <input id="mat-etq" placeholder="sentença, fundamentação" value={etiquetasNovas} onChange={(e) => setEtiquetasNovas(e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="material">3. Escolha os arquivos (pode escolher vários de uma vez)</label>
          <input
            key={arquivoKey}
            id="material"
            type="file"
            multiple
            accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            onChange={(ev) => void carregar(ev.target.files)}
          />
        </div>
        {msg && <p className="ajuda">{msg}</p>}
        {concluido && (
          <button className="botao pequeno com-icone" onClick={aoVer}>
            <IcPasta tamanho={18} /> Ver materiais
          </button>
        )}
      </div>
    </>
  );
}

/** Janela para ver o conteúdo do material e, ao lado, renomear ou mudar de pasta. */
function PreviaMaterial({
  m,
  sequencia,
  aoTrocar,
  aoFechar,
}: {
  m: Material;
  /** Materiais da pasta (ou da busca) na ordem da lista, para passar ao próximo. */
  sequencia: string[];
  aoTrocar: (id: string) => void;
  aoFechar: () => void;
}) {
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [pagina, setPagina] = useState(1);
  const [nome, setNome] = useState(m.nome);
  const [pasta, setPasta] = useState(m.pasta ?? '');
  const [etiquetas, setEtiquetas] = useState((m.etiquetas ?? []).join(', '));
  const [aviso, setAviso] = useState<string | null>(null);

  // Trocou de material: abre o arquivo e recarrega os campos.
  useEffect(() => {
    let vivo = true;
    setDocumento(null);
    setPagina(1);
    setNome(m.nome);
    setPasta(m.pasta ?? '');
    setEtiquetas((m.etiquetas ?? []).join(', '));
    setAviso(null);
    abrirDocumentoPorId(m.id).then((d) => vivo && setDocumento(d));
    return () => {
      vivo = false;
    };
  }, [m.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = sequencia.indexOf(m.id);
  const mudou = nome.trim() !== m.nome || pasta.trim() !== (m.pasta ?? '') || etiquetas.trim() !== (m.etiquetas ?? []).join(', ');
  const salvar = async () => {
    if (!nome.trim()) return setAviso('O nome não pode ficar vazio.');
    await atualizarMaterial(m.id, { nome, pasta, etiquetas: [etiquetas] });
    setAviso('Guardado.');
  };
  const ir = async (delta: number) => {
    if (mudou) await salvar();
    const prox = sequencia[pos + delta];
    if (prox) aoTrocar(prox);
  };

  // Setas do teclado passam as páginas (fora dos campos de texto); Esc fecha.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return aoFechar();
      if (e.target instanceof Element && e.target.matches('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setPagina((p) => Math.min(m.paginas, p + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPagina((p) => Math.max(1, p - 1));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [m.paginas, aoFechar]);

  return (
    <div className="modal-fundo" onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="modal previa-mat" role="dialog" aria-label={`Ver ${m.nome}`}>
        <div className="previa-mat-visor">
          <div className="previa-mat-pagina">
            {documento ? (
              <CanvasMaterial documento={documento} pagina={pagina} regiao={PAGINA_INTEIRA} />
            ) : (
              <p className="ajuda" style={{ margin: 'auto' }}>Abrindo…</p>
            )}
          </div>
          <div className="previa-mat-paginas">
            <button className="botao pequeno" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} aria-label="Página anterior">
              ◀
            </button>
            <span>
              página {pagina} de {m.paginas}
            </span>
            <button className="botao pequeno" onClick={() => setPagina((p) => Math.min(m.paginas, p + 1))} disabled={pagina >= m.paginas} aria-label="Próxima página">
              ▶
            </button>
          </div>
        </div>
        <form
          className="previa-mat-dados"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <div className="campo">
            <label htmlFor="previa-nome">Nome</label>
            <input id="previa-nome" value={nome} onChange={(e) => (setNome(e.target.value), setAviso(null))} />
          </div>
          <div className="campo">
            <label htmlFor="previa-pasta">Pasta (use "/" para subpastas)</label>
            <input id="previa-pasta" list="pastas-mat" value={pasta} onChange={(e) => (setPasta(e.target.value), setAviso(null))} placeholder="sem pasta" />
          </div>
          <div className="campo">
            <label htmlFor="previa-etq">Etiquetas (vírgula)</label>
            <input id="previa-etq" value={etiquetas} onChange={(e) => (setEtiquetas(e.target.value), setAviso(null))} />
          </div>
          <div className="linha-opcoes">
            <button className="botao primario" type="submit" disabled={!mudou}>
              Salvar
            </button>
            <button className="botao" type="button" onClick={aoFechar}>
              Fechar
            </button>
          </div>
          {aviso && <p className={`digitar-msg${aviso === 'Guardado.' ? '' : ' erro'}`} style={{ padding: 0 }}>{aviso}</p>}
          {sequencia.length > 1 && pos >= 0 && (
            <div className="previa-mat-seq">
              <span className="ajuda" style={{ margin: 0 }}>
                Material {pos + 1} de {sequencia.length} desta lista
              </span>
              <div className="linha-opcoes">
                <button className="botao pequeno" type="button" onClick={() => void ir(-1)} disabled={pos <= 0}>
                  ◀ Anterior
                </button>
                <button className="botao pequeno" type="button" onClick={() => void ir(1)} disabled={pos >= sequencia.length - 1}>
                  Próximo ▶
                </button>
              </div>
              {mudou && <span className="ajuda" style={{ margin: 0 }}>Ao passar para outro, as mudanças deste são guardadas.</span>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function EditarMaterial({ m, aoFechar }: { m: Material; aoFechar: () => void }) {
  const [nome, setNome] = useState(m.nome);
  const [pasta, setPasta] = useState(m.pasta ?? '');
  const [etiquetas, setEtiquetas] = useState((m.etiquetas ?? []).join(', '));
  return (
    <li className="item-mat editando">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await atualizarMaterial(m.id, { nome, pasta, etiquetas: [etiquetas] });
          aoFechar();
        }}
        className="form-mat"
      >
        <div className="campo">
          <label>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo">
          <label>Pasta</label>
          <input list="pastas-mat" value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="sem pasta" />
        </div>
        <div className="campo">
          <label>Etiquetas (vírgula)</label>
          <input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button className="botao pequeno primario" type="submit">Salvar</button>
          <button className="botao pequeno" type="button" onClick={aoFechar}>Cancelar</button>
        </div>
      </form>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Seletor da tela da aula
// ---------------------------------------------------------------------------

export function SeletorMaterial({
  atual,
  aoEscolher,
  aoCarregar,
  carregando,
}: {
  atual: { id: string; nome: string } | null;
  aoEscolher: (id: string | null) => void;
  aoCarregar: () => void;
  carregando: boolean;
}) {
  const lista = useMateriais();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [pastaAberta, setPastaAberta] = useState('');
  const caixaRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const filtrados = filtrarMateriais(lista, busca, etiqueta);
  const grupos = agruparPorPasta(filtrados);
  const procurando = !!busca.trim() || !!etiqueta;
  const pastas = todasPastas(lista);
  const atualPasta = pastaAberta && pastas.includes(pastaAberta) ? pastaAberta : '';
  const conteudo = conteudoDaPasta(lista, atualPasta);
  const recentes = busca || etiqueta
    ? []
    : lerLocal(CHAVE_RECENTES, '')
        .split(',')
        .map((id) => lista.find((m) => m.id === id))
        .filter((m): m is Material => !!m)
        .slice(0, 4);

  const atualCompleto = atual ? lista.find((m) => m.id === atual.id) : undefined;
  const abrirSeletor = () => {
    // Abre na pasta do material em uso (ou na última aberta).
    if (!aberto) {
      let p = atualCompleto?.pasta ?? '';
      if (!atualCompleto) {
        try {
          p = sessionStorage.getItem(CHAVE_PASTA_ABERTA) ?? '';
        } catch {
          /* ignore */
        }
      }
      setPastaAberta(p);
    }
    setAberto(!aberto);
  };
  const abrirPasta = (p: string) => {
    setPastaAberta(p);
    try {
      sessionStorage.setItem(CHAVE_PASTA_ABERTA, p);
    } catch {
      /* ignore */
    }
  };
  const escolher = (id: string | null) => {
    if (id) marcarUsado(id);
    aoEscolher(id);
    setAberto(false);
    setBusca('');
  };

  const linha = (m: Material) => (
    <li key={m.id}>
      <button type="button" className={`opcao-mat${atual?.id === m.id ? ' atual' : ''}`} onClick={() => escolher(m.id)}>
        <span className="opcao-mat-nome">{m.nome}</span>
        <span className="ajuda">{m.paginas} p.</span>
        <Etiquetas lista={m.etiquetas ?? []} />
      </button>
    </li>
  );

  return (
    <div className="seletor-material" ref={caixaRef}>
      <span className="seletor-material-rotulo">
        <IcDocumento /> Material
      </span>
      <button type="button" className="botao-seletor" onClick={abrirSeletor} disabled={carregando} aria-expanded={aberto}>
        <span className="botao-seletor-nome">
          {carregando ? 'carregando…' : (atual?.nome ?? 'Nenhum material — só os artigos')}
        </span>
        {atualCompleto && (
          <span className="botao-seletor-detalhe">
            {atualCompleto.pasta ? nomePasta(atualCompleto.pasta) + ' · ' : ''}
            {atualCompleto.paginas} {atualCompleto.paginas === 1 ? 'página' : 'páginas'}
          </span>
        )}
        <span className="botao-seletor-acao">
          {atual ? 'trocar' : 'escolher'} <IcSetaBaixo tamanho={16} />
        </span>
      </button>
      {aberto && (
        <div className="popover-mat" role="dialog" aria-label="Escolher material">
          <Filtros lista={lista} busca={busca} setBusca={setBusca} etiqueta={etiqueta} setEtiqueta={setEtiqueta} autoFoco />
          <div className="popover-mat-lista" data-rolavel>
            <ul className="lista-opcoes">
              <li>
                <button type="button" className={`opcao-mat${!atual ? ' atual' : ''}`} onClick={() => escolher(null)}>
                  <span className="opcao-mat-nome">Nenhum (só os artigos)</span>
                </button>
              </li>
            </ul>
            {recentes.length > 0 && (
              <>
                <h4>Usados recentemente</h4>
                <ul className="lista-opcoes">{recentes.map(linha)}</ul>
              </>
            )}
            {procurando ? (
              <>
                {grupos.map((g) => (
                  <div key={g.pasta}>
                    <h4>{nomePasta(g.pasta)}</h4>
                    <ul className="lista-opcoes">{g.itens.map(linha)}</ul>
                  </div>
                ))}
                {lista.length > 0 && filtrados.length === 0 && <p className="ajuda">Nada encontrado.</p>}
              </>
            ) : (
              lista.length > 0 && (
                <>
                  <h4>Pastas</h4>
                  <nav className="trilha-pastas compacta" aria-label="Pasta aberta">
                    <button type="button" className={`trilha-degrau${atualPasta === '' ? ' atual' : ''}`} onClick={() => abrirPasta('')}>
                      <IcPasta tamanho={16} /> Todos
                    </button>
                    {degrausDaPasta(atualPasta).map((d) => (
                      <span key={d.pasta} className="trilha-item">
                        <span className="trilha-sep" aria-hidden="true">›</span>
                        <button type="button" className={`trilha-degrau${d.pasta === atualPasta ? ' atual' : ''}`} onClick={() => abrirPasta(d.pasta)}>
                          {d.nome}
                        </button>
                      </span>
                    ))}
                  </nav>
                  <ul className="lista-opcoes">
                    {atualPasta && (
                      <li>
                        <button type="button" className="opcao-mat opcao-pasta" onClick={() => abrirPasta(atualPasta.split('/').slice(0, -1).join('/'))}>
                          <span className="opcao-mat-nome">↑ Voltar</span>
                        </button>
                      </li>
                    )}
                    {conteudo.subpastas.map((sp) => (
                      <li key={sp.pasta}>
                        <button type="button" className="opcao-mat opcao-pasta" onClick={() => abrirPasta(sp.pasta)}>
                          <IcPasta tamanho={18} />
                          <span className="opcao-mat-nome">{sp.nome}</span>
                          <span className="ajuda">{sp.total} ›</span>
                        </button>
                      </li>
                    ))}
                    {conteudo.itens.map(linha)}
                  </ul>
                  {!conteudo.subpastas.length && !conteudo.itens.length && <p className="ajuda">Pasta vazia.</p>}
                </>
              )
            )}
          </div>
          <button
            type="button"
            className="botao pequeno"
            onClick={() => {
              setAberto(false);
              aoCarregar();
            }}
          >
            + carregar PDF ou imagem…
          </button>
        </div>
      )}
    </div>
  );
}
