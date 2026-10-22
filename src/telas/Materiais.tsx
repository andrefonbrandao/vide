// Materiais do professor (PDFs, imagens) organizados em pastas e etiquetas.
// - <ListaMateriais/> e <AdicionarMaterial/>: aba Acervo (organizar, apagar, carregar).
// - <SeletorMaterial/>: botão da tela da aula, com busca, para escolher o material.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Material } from '../dados/modelo';
import { atualizarMaterial, excluirMaterial, importarMaterial, limparEtiquetas, listarMateriais } from '../material/documento';
import { IcDocumento, IcMais, IcPasta, IcSetaBaixo } from '../comum/Icones';
import { agruparPorPasta, filtrarMateriais, nomePasta, todasEtiquetas, todasPastas, type MaterialOrganizavel } from '../material/organizacao';

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
export function ListaMateriais({ aoAdicionar }: { aoAdicionar: () => void }) {
  const lista = useMateriais();
  const [busca, setBusca] = useState('');
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);

  const pastas = useMemo(() => todasPastas(lista), [lista]);
  const filtrados = useMemo(() => filtrarMateriais(lista, busca, etiqueta), [lista, busca, etiqueta]);
  const grupos = useMemo(() => agruparPorPasta(filtrados), [filtrados]);
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

  return (
    <>
      <h2>Materiais</h2>
      <datalist id="pastas-mat">
        {pastas.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="cartao">
        <Filtros lista={lista} busca={busca} setBusca={setBusca} etiqueta={etiqueta} setEtiqueta={setEtiqueta} />
        {filtrados.length === 0 && <p className="ajuda">Nada encontrado.</p>}
        {grupos.map((g) => (
          <details key={g.pasta} open className="pasta-mat">
            <summary>
              <span className="pasta-icone" aria-hidden="true">▸</span> <IcPasta tamanho={18} /> {nomePasta(g.pasta)}{' '}
              <span className="total">{g.itens.length}</span>
            </summary>
            <ul className="lista-mat">
              {g.itens.map((m) =>
                editando === m.id ? (
                  <EditarMaterial key={m.id} m={m} aoFechar={() => setEditando(null)} />
                ) : (
                  <li key={m.id} className="item-mat">
                    <div className="item-mat-info">
                      <strong>{m.nome}</strong>{' '}
                      <span className="ajuda">
                        {m.tipo === 'pdf' ? 'PDF' : 'imagem'} · {m.paginas} {m.paginas === 1 ? 'página' : 'páginas'} · {mb(m.tamanho)}
                      </span>
                      <Etiquetas lista={m.etiquetas ?? []} ativa={etiqueta} aoEscolher={(e) => setEtiqueta(etiqueta === e ? null : e)} />
                    </div>
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
                ),
              )}
            </ul>
          </details>
        ))}
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
  const recentes = busca || etiqueta
    ? []
    : lerLocal(CHAVE_RECENTES, '')
        .split(',')
        .map((id) => lista.find((m) => m.id === id))
        .filter((m): m is Material => !!m)
        .slice(0, 4);

  const atualCompleto = atual ? lista.find((m) => m.id === atual.id) : undefined;
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
      <button type="button" className="botao-seletor" onClick={() => setAberto(!aberto)} disabled={carregando} aria-expanded={aberto}>
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
            {grupos.map((g) => (
              <div key={g.pasta}>
                <h4>{nomePasta(g.pasta)}</h4>
                <ul className="lista-opcoes">{g.itens.map(linha)}</ul>
              </div>
            ))}
            {lista.length > 0 && filtrados.length === 0 && <p className="ajuda">Nada encontrado.</p>}
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
