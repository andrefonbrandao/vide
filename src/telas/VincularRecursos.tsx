// Recursos de uma disciplina (e das turmas dela): ver o que está ligado e vincular em lote,
// com atalhos pelas pastas e assuntos que o professor já usa.
import { useEffect, useMemo, useState } from 'react';
import { avisar } from '../comum/avisos';
import { db } from '../dados/db';
import { agoraISO } from '../dados/modelo';
import { rotuloTurma } from '../turmas/banco';
import type { Disciplina, Turma } from '../turmas/tipos';

type TipoConteudo = 'materiais' | 'questoes' | 'questionarios' | 'casos';
type TipoTurma = 'processos' | 'treinos' | 'jogos';

interface ItemLista {
  id: string;
  titulo: string;
  detalhe: string;
  pasta: string;
  etiquetas: string[];
  disciplinas: string[];
  turmaId: string | null;
}

const NOMES: Record<TipoConteudo | TipoTurma, string> = {
  materiais: 'Materiais',
  questoes: 'Questões',
  questionarios: 'Questionários',
  casos: 'Casos',
  processos: 'Processos',
  treinos: 'Links de treino',
  jogos: 'Resultados dos jogos',
};

const EVENTO: Record<TipoConteudo | TipoTurma, string> = {
  materiais: 'vide-materiais-mudou',
  questoes: 'vide-questoes-mudou',
  questionarios: 'vide-questoes-mudou',
  casos: 'vide-casos-mudou',
  processos: 'vide-processos-mudou',
  treinos: 'vide-questoes-mudou',
  jogos: 'vide-questoes-mudou',
};

/** Lê tudo do banco (sem o filtro da turma): aqui o professor vê e liga qualquer item. */
async function ler(tipo: TipoConteudo | TipoTurma): Promise<ItemLista[]> {
  const vivos = <T extends { excluido_em: string | null }>(l: T[]) => l.filter((x) => !x.excluido_em);
  const comum = (x: { id: string; disciplinas?: string[]; turmaId?: string | null }) => ({ id: x.id, disciplinas: x.disciplinas ?? [], turmaId: x.turmaId ?? null });
  switch (tipo) {
    case 'materiais':
      return vivos(await db.materiais.toArray()).map((m) => ({ ...comum(m), titulo: m.nome, detalhe: `${m.tipo === 'pdf' ? 'PDF' : 'imagem'}${m.pasta ? ` · ${m.pasta}` : ''}`, pasta: m.pasta ?? '', etiquetas: m.etiquetas ?? [] }));
    case 'questoes':
      return vivos(await db.questoes.toArray()).map((q) => ({ ...comum(q), titulo: q.tipo === 'conceito' ? `Conceito: ${q.enunciado}` : q.enunciado, detalhe: q.etiquetas.join(', '), pasta: q.pasta ?? '', etiquetas: q.etiquetas }));
    case 'questionarios':
      return vivos(await db.questionarios.toArray()).map((q) => ({ ...comum(q), titulo: q.nome, detalhe: `${q.questoes.length} questões`, pasta: '', etiquetas: [] }));
    case 'casos':
      return vivos(await db.casos.toArray()).map((c) => ({ ...comum(c), titulo: `${c.nome}: “${c.falas[c.falas.length - 1]?.texto ?? ''}”`, detalhe: c.etiquetas.join(', '), pasta: c.pasta ?? '', etiquetas: c.etiquetas }));
    case 'processos':
      return vivos(await db.processos.toArray()).map((p) => ({ ...comum(p), titulo: p.titulo, detalhe: p.capa.numero, pasta: '', etiquetas: [] }));
    case 'treinos':
      return vivos(await db.treinos.toArray()).map((l) => ({ ...comum(l), titulo: l.titulo, detalhe: `criado em ${new Date(l.criado_em).toLocaleDateString('pt-BR')}`, pasta: '', etiquetas: [] }));
    case 'jogos':
      return vivos(await db.jogos.toArray()).map((j) => ({ ...comum(j), titulo: j.questionario, detalhe: `${new Date(j.em).toLocaleDateString('pt-BR')} · ${j.participantes} participantes`, pasta: '', etiquetas: [] }));
  }
}

/** Grava o novo vínculo de vários itens de uma vez. */
async function gravar(tipo: TipoConteudo | TipoTurma, ids: string[], mudar: (x: { disciplinas?: string[]; turmaId?: string | null }) => object): Promise<void> {
  const tabela = db[tipo] as unknown as { bulkGet(ids: string[]): Promise<({ disciplinas?: string[]; turmaId?: string | null } | undefined)[]>; bulkPut(l: object[]): Promise<unknown> };
  const atuais = (await tabela.bulkGet(ids)).filter((x): x is { disciplinas?: string[]; turmaId?: string | null } => !!x);
  const agora = agoraISO();
  await tabela.bulkPut(atuais.map((x) => ({ ...x, ...mudar(x), atualizado_em: agora })));
  window.dispatchEvent(new Event(EVENTO[tipo]));
}

function ListaConteudo({ tipo, d }: { tipo: TipoConteudo; d: Disciplina }) {
  const [itens, setItens] = useState<ItemLista[] | null>(null);
  const [busca, setBusca] = useState('');
  const [so, setSo] = useState<'todos' | 'ligados' | 'sem'>('todos');
  const carregar = () => void ler(tipo).then(setItens);
  useEffect(carregar, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const pastas = useMemo(() => [...new Set((itens ?? []).map((x) => x.pasta).filter(Boolean))].sort(), [itens]);
  const assuntos = useMemo(() => [...new Set((itens ?? []).flatMap((x) => x.etiquetas).filter(Boolean))].sort(), [itens]);
  if (!itens) return <p className="ajuda">Carregando…</p>;
  const ligado = (x: ItemLista) => x.disciplinas.includes(d.id);
  const termos = busca.toLowerCase().split(/\s+/).filter(Boolean);
  const vis = itens.filter((x) => termos.every((t) => `${x.titulo} ${x.detalhe}`.toLowerCase().includes(t)) && (so === 'todos' || (so === 'ligados' ? ligado(x) : !x.disciplinas.length)));
  const ligar = async (ids: string[], sim: boolean) => {
    if (!ids.length) return;
    await gravar(tipo, ids, (x) => ({ disciplinas: sim ? [...new Set([...(x.disciplinas ?? []), d.id])] : (x.disciplinas ?? []).filter((y) => y !== d.id) }));
    carregar();
  };
  const total = itens.filter(ligado).length;
  return (
    <div className="vincular-lista">
      <div className="linha-opcoes vincular-atalhos">
        <input type="search" placeholder="Procurar…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, minWidth: 180 }} aria-label="Procurar" />
        <select className="seletor" aria-label="Mostrar" value={so} onChange={(e) => setSo(e.target.value as typeof so)}>
          <option value="todos">todos ({itens.length})</option>
          <option value="ligados">só os de {d.sigla} ({total})</option>
          <option value="sem">só os sem disciplina ({itens.filter((x) => !x.disciplinas.length).length})</option>
        </select>
        {pastas.length > 0 && (
          <select
            className="seletor"
            aria-label="Ligar uma pasta inteira"
            value=""
            onChange={async (e) => {
              const ids = itens.filter((x) => x.pasta === e.target.value || x.pasta.startsWith(`${e.target.value}/`)).map((x) => x.id);
              await ligar(ids, true);
              avisar(`${ids.length} ligados a ${d.sigla}`);
            }}
          >
            <option value="">Ligar uma pasta inteira…</option>
            {pastas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        {assuntos.length > 0 && (
          <select
            className="seletor"
            aria-label="Ligar um assunto inteiro"
            value=""
            onChange={async (e) => {
              const ids = itens.filter((x) => x.etiquetas.includes(e.target.value)).map((x) => x.id);
              await ligar(ids, true);
              avisar(`${ids.length} ligados a ${d.sigla}`);
            }}
          >
            <option value="">Ligar um assunto inteiro…</option>
            {assuntos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>
      {vis.length > 0 && (
        <div className="linha-opcoes">
          <button className="link-discreto" onClick={() => void ligar(vis.filter((x) => !ligado(x)).map((x) => x.id), true)}>
            ligar os {vis.length} mostrados
          </button>
          <button className="link-discreto" onClick={() => void ligar(vis.filter(ligado).map((x) => x.id), false)}>
            desligar os mostrados
          </button>
        </div>
      )}
      {!vis.length ? (
        <p className="ajuda">Nada aqui.</p>
      ) : (
        <ul className="vincular-itens" data-rolavel>
          {vis.map((x) => (
            <li key={x.id}>
              <label className="caixa-marcar" style={{ marginTop: 0 }}>
                <input type="checkbox" checked={ligado(x)} onChange={(e) => void ligar([x.id], e.target.checked)} />
                <span>
                  <strong>{x.titulo}</strong>
                  {x.detalhe && <span className="ajuda" style={{ margin: 0 }}> · {x.detalhe}</span>}
                  {!x.disciplinas.length && <span className="selo sem-vinculo">sem disciplina</span>}
                  {x.disciplinas.some((y) => y !== d.id) && <span className="selo">também em outra disciplina</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListaTurma({ tipo, d, turmas }: { tipo: TipoTurma; d: Disciplina; turmas: Turma[] }) {
  const [itens, setItens] = useState<ItemLista[] | null>(null);
  const carregar = () => void ler(tipo).then(setItens);
  useEffect(carregar, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!itens) return <p className="ajuda">Carregando…</p>;
  const daDisciplina = new Set(turmas.map((t) => t.id));
  // Mostra os desta disciplina e os sem turma (os de outras disciplinas ficam lá).
  const vis = itens.filter((x) => !x.turmaId || daDisciplina.has(x.turmaId));
  return !vis.length ? (
    <p className="ajuda">Nada aqui.</p>
  ) : (
    <ul className="vincular-itens" data-rolavel>
      {vis.map((x) => (
        <li key={x.id} className="linha-opcoes">
          <span style={{ flex: 1, minWidth: 200 }}>
            <strong>{x.titulo}</strong>
            {x.detalhe && <span className="ajuda" style={{ margin: 0 }}> · {x.detalhe}</span>}
          </span>
          <select
            className="seletor"
            aria-label={`Turma de ${x.titulo}`}
            value={x.turmaId ?? ''}
            onChange={async (e) => {
              const turmaId = e.target.value || null; // lido já: depois a tela volta o campo ao valor antigo
              await gravar(tipo, [x.id], () => ({ turmaId }));
              carregar();
            }}
          >
            <option value="">sem turma</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {rotuloTurma(d, t)}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}

export function RecursosDaDisciplina({ d, turmas, aoFechar }: { d: Disciplina; turmas: Turma[]; aoFechar: () => void }) {
  const [aba, setAba] = useState<TipoConteudo | TipoTurma>('materiais');
  const conteudo: TipoConteudo[] = ['materiais', 'questoes', 'questionarios', 'casos'];
  const daTurma: TipoTurma[] = ['processos', 'treinos', 'jogos'];
  return (
    <div className="cartao recursos-disciplina" style={{ ['--cor' as string]: d.cor }}>
      <div className="disciplina-cab">
        <span className="selo-disciplina">{d.sigla}</span>
        <h3 style={{ margin: 0, flex: 1 }}>Recursos de {d.nome}</h3>
        <button className="botao pequeno" onClick={aoFechar}>
          Fechar
        </button>
      </div>
      <p className="ajuda">
        Marque o que é desta disciplina (vale para todas as turmas dela). Um item pode estar em mais de uma disciplina. Processos, links e resultados são de uma turma só.
      </p>
      <nav className="secoes-questoes" aria-label="Tipos de recurso">
        <span className="ajuda" style={{ margin: 0 }}>
          Da disciplina:
        </span>
        {conteudo.map((t) => (
          <button key={t} className={`botao pequeno${aba === t ? ' escuro' : ''}`} onClick={() => setAba(t)}>
            {NOMES[t]}
          </button>
        ))}
        <span className="ajuda" style={{ margin: '0 0 0 8px' }}>
          Das turmas:
        </span>
        {daTurma.map((t) => (
          <button key={t} className={`botao pequeno${aba === t ? ' escuro' : ''}`} onClick={() => setAba(t)} disabled={!turmas.length}>
            {NOMES[t]}
          </button>
        ))}
      </nav>
      {(conteudo as string[]).includes(aba) ? <ListaConteudo key={aba} tipo={aba as TipoConteudo} d={d} /> : <ListaTurma key={aba} tipo={aba as TipoTurma} d={d} turmas={turmas} />}
    </div>
  );
}
