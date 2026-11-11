// Atividades › Casos: os casos do jogo "Consulta" (personagens com um problema concreto).
import { SemVinculo } from './FaixaTurma';
import { confirmar } from '../comum/avisos';
import { useEffect, useMemo, useState } from 'react';
import { adicionarCasos, assuntosDosCasos, excluirCaso, listarCasos, salvarCaso } from '../consulta/banco';
import { casoParaTexto, lerCasos, MODELO_CASO, pedidoParaIA } from '../consulta/importar';
import { sortearConsulente } from '../consulta/personagens';
import type { Caso } from '../consulta/tipos';
import { criarLinkTreino, desativarLinkTreino, listarLinksTreino } from '../treino/publicar';
import type { LinkTreino } from '../treino/tipos';
import { LinkPronto } from './CompartilharTreino';
import { Figura } from './ConsultaTela';

type Secao = 'lista' | 'adicionar' | 'treino';

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function lerAssuntos(s: string): string[] {
  return [...new Set(s.split(/[,;]/).map((x) => x.trim()).filter(Boolean))];
}

/** Personagem fixo para mostrar o caso no acervo (o jogo sorteia de novo). */
function figuraDoCaso(c: Pick<Caso, 'pessoa' | 'nome'>): string {
  let h = 0;
  for (const ch of c.nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return sortearConsulente(c.pessoa, () => (h % 1000) / 1000).id;
}

function useCasos(): Caso[] | null {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  useEffect(() => {
    const carregar = () => void listarCasos().then(setCasos);
    carregar();
    window.addEventListener('vide-casos-mudou', carregar);
    window.addEventListener('vide-questoes-mudou', carregar);
    return () => {
      window.removeEventListener('vide-casos-mudou', carregar);
      window.removeEventListener('vide-questoes-mudou', carregar);
    };
  }, []);
  return casos;
}

/** O caso como aparece no projetor, em miniatura. */
function PreviaCaso({ c }: { c: Pick<Caso, 'nome' | 'pessoa' | 'falas' | 'resposta' | 'quemResponde' | 'fundamento'> }) {
  return (
    <div className="previa-caso">
      <div className="treino-caso-pessoa">
        <Figura id={figuraDoCaso(c)} expressao={c.falas[c.falas.length - 1]?.expressao ?? 'neutro'} />
        <strong>{c.nome}</strong>
      </div>
      <div className="treino-caso-baloes">
        {c.falas.map((f, i) => (
          <p key={i} className={`balao${i === c.falas.length - 1 ? ' pergunta' : ''}`}>
            {f.texto}
          </p>
        ))}
        <p className="balao resposta">
          <small>{c.quemResponde === 'juiz' ? 'Juiz' : 'Advogado'}:</small> {c.resposta}
        </p>
        {c.fundamento && <span className="consulta-fundamento">Fundamento: {c.fundamento}</span>}
      </div>
    </div>
  );
}

function EditarCaso({ caso, aoFechar }: { caso: Caso; aoFechar: () => void }) {
  const [texto, setTexto] = useState(() => casoParaTexto(caso));
  const lido = useMemo(() => lerCasos(texto), [texto]);
  const novo = lido.casos[0];
  const problema = lido.casos.length !== 1 ? (lido.avisos[0] ?? 'O texto deve ter exatamente um caso.') : null;
  return (
    <div className="cartao">
      <p className="ajuda">Edite no mesmo formato da importação. A prévia mostra como fica.</p>
      <textarea rows={11} value={texto} onChange={(e) => setTexto(e.target.value)} className="mono" style={{ width: '100%' }} />
      {problema ? <p className="digitar-msg erro">{problema}</p> : novo && <PreviaCaso c={novo} />}
      <div className="modal-botoes">
        <button
          className="botao primario"
          disabled={!!problema}
          onClick={async () => {
            const { assuntos, ...dados } = novo!;
            await salvarCaso({ ...dados, etiquetas: assuntos }, caso);
            aoFechar();
          }}
        >
          Salvar
        </button>
        <button className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ListaCasos({ casos, aoAdicionar }: { casos: Caso[]; aoAdicionar: () => void }) {
  const [busca, setBusca] = useState('');
  const [assunto, setAssunto] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const assuntos = assuntosDosCasos(casos);
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const lista = casos.filter(
    (c) =>
      (!assunto || c.etiquetas.includes(assunto)) &&
      termos.every((t) => semAcento(`${c.nome} ${c.falas.map((f) => f.texto).join(' ')} ${c.resposta} ${c.etiquetas.join(' ')}`).includes(t)),
  );
  if (!casos.length)
    return (
      <div className="vazio-guia">
        <Figura id="m3" expressao="duvida" className="vazio-guia-figura" />
        <div>
          <h2>Nenhum caso ainda</h2>
          <p className="ajuda">Cole casos prontos (por exemplo, pedidos a uma IA com o pedido pronto) ou escreva o seu. Eles viram consultas com personagens na aula.</p>
          <button className="botao escuro" onClick={aoAdicionar}>
            Adicionar casos
          </button>
        </div>
      </div>
    );
  return (
    <>
      <div className="linha-opcoes" style={{ marginBottom: 8 }}>
        <input className="busca-mat" type="search" placeholder="Buscar por nome, texto ou assunto" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <select className="seletor" value={assunto} onChange={(e) => setAssunto(e.target.value)} aria-label="Assunto">
          <option value="">Todos os assuntos ({casos.length})</option>
          {assuntos.map((a) => (
            <option key={a.assunto} value={a.assunto}>
              {a.assunto} ({a.total})
            </option>
          ))}
        </select>
      </div>
      <ul className="lista-ordem lista-casos">
        {lista.map((c) => (
          <li key={c.id} style={{ flexWrap: 'wrap' }}>
            <Figura id={figuraDoCaso(c)} expressao="neutro" className="mini" />
            <span className="texto-questao">
              <strong>{c.nome}</strong>: {c.falas[c.falas.length - 1]?.texto} <SemVinculo item={c} tipo="conteudo" />
              <span className="ajuda">
                {' '}
                · responde: {c.quemResponde} · {String(c.tempo).replace(".", ",")} min{c.fundamento ? ` · ${c.fundamento}` : ''}
                {c.etiquetas.length ? ` · ${c.etiquetas.join(', ')}` : ''}
              </span>
            </span>
            <button className="botao pequeno" onClick={() => setAberto(aberto === c.id ? null : c.id)}>
              {aberto === c.id ? 'Fechar' : 'Ver'}
            </button>
            <button className="botao pequeno" onClick={() => setEditando(editando === c.id ? null : c.id)}>
              Editar
            </button>
            <button className="botao pequeno" onClick={() => void confirmar({ titulo: `Apagar o caso "${c.nome}"?`, botao: 'Apagar', perigo: true }).then((ok) => ok && void excluirCaso(c.id))}>
              Apagar
            </button>
            {aberto === c.id && editando !== c.id && (
              <div style={{ flexBasis: '100%' }}>
                <PreviaCaso c={c} />
              </div>
            )}
            {editando === c.id && (
              <div style={{ flexBasis: '100%' }}>
                <EditarCaso caso={c} aoFechar={() => setEditando(null)} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {!lista.length && <p className="ajuda">Nenhum caso encontrado.</p>}
    </>
  );
}

function AdicionarCasos({ aoVer }: { aoVer: () => void }) {
  const [texto, setTexto] = useState('');
  const [assuntos, setAssuntos] = useState('');
  const [tema, setTema] = useState('');
  const [quantos, setQuantos] = useState(5);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const previa = useMemo(() => (texto.trim() ? lerCasos(texto) : null), [texto]);
  const copiar = async (t: string, qual: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopiado(qual);
    } catch {
      setCopiado(null);
    }
  };
  return (
    <>
      {feito && (
        <div className="aviso">
          {feito}{' '}
          <button className="botao pequeno" onClick={aoVer}>
            Ver casos
          </button>
        </div>
      )}
      <div className="cartao">
        <h3 style={{ marginTop: 0 }}>Pedir casos a uma IA</h3>
        <p className="ajuda">
          Escreva o tema e copie o pedido pronto. Cole no Claude (ou outra IA), copie a resposta e cole no campo abaixo. Revise sempre a
          resposta e o fundamento: a IA pode errar.
        </p>
        <div className="linha-opcoes">
          <input type="text" placeholder="Tema (ex.: citação)" value={tema} onChange={(e) => setTema(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <label className="caixa-marcar" style={{ marginTop: 0 }}>
            Quantos
            <input type="number" min={1} max={20} value={quantos} onChange={(e) => setQuantos(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} style={{ width: 64 }} />
          </label>
          <button className="botao escuro" onClick={() => void copiar(pedidoParaIA(tema, quantos), 'pedido')}>
            {copiado === 'pedido' ? 'Pedido copiado ✓' : 'Copiar pedido para a IA'}
          </button>
        </div>
      </div>
      <div className="cartao">
        <h3 style={{ marginTop: 0 }}>Colar casos</h3>
        <p className="ajuda">
          Cada caso começa em <strong>Caso:</strong> (o nome fictício). <strong>Pessoa</strong> escolhe o personagem (mulher ou homem; jovem,
          adulto ou idoso; o Vide sorteia um desenho compatível). Cada <strong>Fala</strong> vira um balão, com a expressão entre parênteses (neutro, dúvida, medo, feliz). A{' '}
          <strong>Resposta</strong> diz quem responde (advogado ou juiz; o Vide sorteia se aparece homem ou mulher). <strong>Tempo</strong> é em minutos.
        </p>
        <pre className="mono modelo-questoes">{MODELO_CASO}</pre>
        <button className="botao pequeno" onClick={() => void copiar(MODELO_CASO, 'modelo')}>
          {copiado === 'modelo' ? 'Modelo copiado' : 'Copiar o modelo'}
        </button>
        <div className="campo" style={{ marginTop: 14 }}>
          <label htmlFor="colar-casos">Casos</label>
          <textarea id="colar-casos" rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui…" />
        </div>
        <div className="campo">
          <label htmlFor="assuntos-casos">Assuntos para todos (opcional, separados por vírgula)</label>
          <input id="assuntos-casos" type="text" value={assuntos} onChange={(e) => setAssuntos(e.target.value)} placeholder="ex.: citação, comunicação dos atos" />
        </div>
        {previa && (
          <div className="previa-importacao">
            <p>
              <strong>{previa.casos.length}</strong> {previa.casos.length === 1 ? 'caso entendido' : 'casos entendidos'}
              {previa.avisos.length > 0 && <> · {previa.avisos.length} {previa.avisos.length === 1 ? 'aviso' : 'avisos'}:</>}
            </p>
            {previa.avisos.map((a, i) => (
              <p key={i} className="digitar-msg erro" style={{ padding: 0 }}>
                {a}
              </p>
            ))}
            {previa.casos.map((c, i) => (
              <PreviaCaso key={i} c={c} />
            ))}
          </div>
        )}
        <div className="modal-botoes">
          <button
            className="botao primario"
            disabled={!previa?.casos.length}
            onClick={async () => {
              const r = await adicionarCasos(previa!.casos, { pasta: '', etiquetas: lerAssuntos(assuntos) });
              setFeito(`${r.length} ${r.length === 1 ? 'caso guardado' : 'casos guardados'}.`);
              setTexto('');
            }}
          >
            {previa?.casos.length ? `Guardar ${previa.casos.length} ${previa.casos.length === 1 ? 'caso' : 'casos'}` : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  );
}

function TreinoComCasos({ casos }: { casos: Caso[] }) {
  const [links, setLinks] = useState<LinkTreino[]>([]);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [assunto, setAssunto] = useState('');
  const [modo, setModo] = useState<'sorteio' | 'fixo'>('sorteio');
  const [quantas, setQuantas] = useState(3);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<LinkTreino | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    const carregar = () => void listarLinksTreino().then((l) => setLinks(l.filter((x) => x.jogo === 'consulta')));
    carregar();
    window.addEventListener('vide-questoes-mudou', carregar);
    return () => window.removeEventListener('vide-questoes-mudou', carregar);
  }, [pronto]);
  const assuntos = assuntosDosCasos(casos);
  const conjunto = assunto ? casos.filter((c) => c.etiquetas.includes(assunto)) : casos;
  const criar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const nome = `Consulta — ${assunto || 'todos os assuntos'}`;
      const lista = modo === 'fixo' ? [...conjunto].sort(() => Math.random() - 0.5).slice(0, quantas) : conjunto;
      const link = await criarLinkTreino({
        titulo: titulo.trim() || nome,
        questoes: [],
        casos: lista,
        modo,
        quantas,
        mostrar: 'cada',
        origem: `Casos: ${assunto || 'todos'}`,
        jogo: 'consulta',
      });
      setPronto(link);
      setCriando(false);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      <p className="ajuda">
        Gere um link com casos: o aluno lê cada caso, pensa (e, se quiser, escreve a resposta), vê a resposta do advogado ou do juiz e
        avalia como foi. Pode salvar o resumo em PDF. Nada do aluno é guardado.
      </p>
      {pronto && (
        <div className="cartao">
          <h3 style={{ marginTop: 0 }}>Link criado: {pronto.titulo}</h3>
          <LinkPronto link={pronto} />
          <button className="botao" onClick={() => setPronto(null)}>
            Concluir
          </button>
        </div>
      )}
      {criando ? (
        <div className="cartao form-treino">
          <div className="campo">
            <label htmlFor="titulo-treino-casos">Título do treino (os alunos veem)</label>
            <input id="titulo-treino-casos" type="text" placeholder="ex.: Consulta — citação" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="assunto-treino-casos">Assunto</label>
              <select id="assunto-treino-casos" className="seletor" value={assunto} onChange={(e) => setAssunto(e.target.value)}>
                <option value="">Todos os assuntos ({casos.length})</option>
                {assuntos.map((a) => (
                  <option key={a.assunto} value={a.assunto}>
                    {a.assunto} ({a.total})
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="quantos-treino-casos">Casos por sessão</label>
              <input id="quantos-treino-casos" type="number" min={1} max={50} value={quantas} onChange={(e) => setQuantas(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} style={{ width: 90 }} />
            </div>
          </div>
          <div className="campo">
            <label>Como montar</label>
            <label className="caixa-marcar" style={{ marginTop: 0 }}>
              <input type="radio" checked={modo === 'sorteio'} onChange={() => setModo('sorteio')} /> Sortear novos casos a cada sessão do aluno
            </label>
            <label className="caixa-marcar" style={{ marginTop: 4 }}>
              <input type="radio" checked={modo === 'fixo'} onChange={() => setModo('fixo')} /> Lista fixa (sorteada agora, igual para todos)
            </label>
          </div>
          <p className="ajuda">
            {conjunto.length} {conjunto.length === 1 ? 'caso' : 'casos'} no conjunto; cada sessão terá {Math.min(quantas, conjunto.length)}. Uma cópia
            destes casos (com as respostas) fica publicada no serviço do Vide enquanto o link estiver ativo.
          </p>
          {erro && <p className="digitar-msg erro">{erro}</p>}
          <div className="modal-botoes">
            <button className="botao primario" onClick={() => void criar()} disabled={!conjunto.length || ocupado}>
              {ocupado ? 'Criando…' : 'Gerar link'}
            </button>
            <button className="botao" onClick={() => setCriando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        !pronto && (
          <p>
            <button className="botao primario" onClick={() => setCriando(true)} disabled={!casos.length}>
              Compartilhar casos para treino
            </button>
          </p>
        )
      )}
      {links.length > 0 && (
        <div className="cartao">
          <ul className="lista-ordem">
            {links.map((l) => (
              <li key={l.id} style={{ flexWrap: 'wrap' }}>
                <span className="texto-questao">
                  <strong>{l.titulo}</strong>{' '}
                  <span className="ajuda">
                    · {l.modo === 'sorteio' ? `sorteia ${l.quantas} de ${l.total}` : `${l.total} casos fixos`} · criado em {new Date(l.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                </span>
                <button className="botao pequeno" onClick={() => setAberto(aberto === l.id ? null : l.id)}>
                  {aberto === l.id ? 'Fechar' : 'Link e QR'}
                </button>
                <button
                  className="botao pequeno"
                  onClick={async () => {
                    if (!(await confirmar({ titulo: `Desativar o link "${l.titulo}"?`, botao: 'Desativar', perigo: true }))) return;
                    try {
                      await desativarLinkTreino(l);
                    } catch (e) {
                      setErro((e as Error).message);
                    }
                  }}
                >
                  Desativar
                </button>
                {aberto === l.id && (
                  <div style={{ flexBasis: '100%' }}>
                    <LinkPronto link={l} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function Casos() {
  const casos = useCasos();
  const [secao, setSecaoEstado] = useState<Secao>(() => {
    try {
      return (sessionStorage.getItem('vide.secaoCasos') as Secao) || 'lista';
    } catch {
      return 'lista';
    }
  });
  const setSecao = (s: Secao) => {
    setSecaoEstado(s);
    try {
      sessionStorage.setItem('vide.secaoCasos', s);
    } catch {
      /* ignore */
    }
  };
  if (!casos) return <p className="ajuda">Carregando…</p>;
  return (
    <>
      <nav className="secoes-questoes" aria-label="Seções de casos">
        <button className={`botao pequeno${secao === 'lista' ? ' escuro' : ''}`} onClick={() => setSecao('lista')}>
          Casos ({casos.length})
        </button>
        <button className={`botao pequeno${secao === 'adicionar' ? ' escuro' : ''}`} onClick={() => setSecao('adicionar')}>
          Adicionar casos
        </button>
        <button className={`botao pequeno${secao === 'treino' ? ' escuro' : ''}`} onClick={() => setSecao('treino')}>
          Treino em casa
        </button>
      </nav>
      {secao === 'lista' && <ListaCasos casos={casos} aoAdicionar={() => setSecao('adicionar')} />}
      {secao === 'adicionar' && <AdicionarCasos aoVer={() => setSecao('lista')} />}
      {secao === 'treino' && <TreinoComCasos casos={casos} />}
    </>
  );
}
