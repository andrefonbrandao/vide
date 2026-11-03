// Acervo › Questões: criar links de treino em casa e ver/desativar os já criados.
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { assuntosDasQuestoes, sortearQuestoes, type FiltroTipo } from '../jogo/banco';
import type { Questao, Questionario } from '../jogo/tipos';
import { criarLinkTreino, desativarLinkTreino, listarLinksTreino } from '../treino/publicar';
import { urlDoTreino, type LinkTreino } from '../treino/tipos';

type Fonte = 'questionario' | 'escolher' | 'assunto';

function QRPequeno({ url }: { url: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }, [url]);
  return <div className="qr-treino" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function LinkPronto({ link }: { link: LinkTreino }) {
  const url = urlDoTreino(link.codigo);
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="link-treino-pronto">
      <QRPequeno url={url} />
      <div>
        <p className="mono link-treino-url">{url}</p>
        <button
          className="botao pequeno escuro"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
        >
          {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
        <p className="ajuda">Mande o link (ou o QR code) para a turma. Quem abrir treina sozinho, sem cadastro.</p>
      </div>
    </div>
  );
}

function FormTreino({ questoes, questionarios, aoFechar }: { questoes: Questao[]; questionarios: Questionario[]; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [fonte, setFonte] = useState<Fonte>('assunto');
  const [qzId, setQzId] = useState(questionarios[0]?.id ?? '');
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [assunto, setAssunto] = useState('');
  const [tipos, setTipos] = useState<FiltroTipo>('todos');
  const [modo, setModo] = useState<'sorteio' | 'fixo'>('sorteio');
  const [quantas, setQuantas] = useState(10);
  const [mostrar, setMostrar] = useState<'cada' | 'fim'>('cada');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<LinkTreino | null>(null);

  const porId = useMemo(() => new Map(questoes.map((q) => [q.id, q])), [questoes]);
  const assuntos = assuntosDasQuestoes(questoes);
  const doAssunto = questoes.filter(
    (q) => (!assunto.trim() || q.etiquetas.some((e) => semAcento(e) === semAcento(assunto.trim()))) && (tipos === 'todos' || (tipos === 'conceito') === (q.tipo === 'conceito')),
  );
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const paraEscolher = questoes.filter((q) => termos.every((t) => semAcento(`${q.enunciado} ${q.etiquetas.join(' ')} ${q.pasta}`).includes(t)));

  // Quantas questões vão para o link e quantas cada sessão terá.
  const conjunto: Questao[] =
    fonte === 'questionario'
      ? (questionarios.find((x) => x.id === qzId)?.questoes ?? []).map((id) => porId.get(id)).filter((q): q is Questao => !!q)
      : fonte === 'escolher'
        ? escolhidas.map((id) => porId.get(id)).filter((q): q is Questao => !!q)
        : doAssunto;
  // O nome do assunto como cadastrado (com acentos), mesmo que digitado sem.
  const assuntoOficial = assuntos.find((a) => semAcento(a.assunto) === semAcento(assunto.trim()))?.assunto ?? assunto.trim();
  const porSessao = fonte === 'assunto' ? Math.min(quantas, conjunto.length) : conjunto.length;

  const criar = async () => {
    if (!conjunto.length) return setErro('Nenhuma questão escolhida.');
    setCriando(true);
    setErro(null);
    try {
      const sortearAgora = fonte === 'assunto' && modo === 'fixo';
      const lista = sortearAgora ? sortearQuestoes(conjunto, null, quantas) : conjunto;
      const origem =
        fonte === 'questionario'
          ? `Questionário: ${questionarios.find((x) => x.id === qzId)?.nome ?? ''}`
          : fonte === 'escolher'
            ? 'Questões escolhidas'
            : `Assunto: ${assuntoOficial || 'todos'}`;
      const nomePadrao = fonte === 'assunto' ? `Treino — ${assuntoOficial || 'todos os assuntos'}` : origem.replace(/^Questionário: /, 'Treino — ');
      const link = await criarLinkTreino({
        titulo: titulo.trim() || nomePadrao,
        questoes: lista,
        modo: fonte === 'assunto' && modo === 'sorteio' ? 'sorteio' : 'fixo',
        quantas,
        mostrar,
        origem,
      });
      setPronto(link);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCriando(false);
    }
  };

  if (pronto) {
    return (
      <div className="cartao">
        <h3 style={{ marginTop: 0 }}>Link criado: {pronto.titulo}</h3>
        <LinkPronto link={pronto} />
        <button className="botao" onClick={aoFechar}>
          Concluir
        </button>
      </div>
    );
  }

  return (
    <div className="cartao form-treino">
      <div className="campo">
        <label htmlFor="titulo-treino">Título do treino (os alunos veem)</label>
        <input id="titulo-treino" type="text" placeholder="ex.: Treino — Sentença" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div className="campo">
        <label>Quais questões</label>
        <div className="linha-opcoes">
          {(
            [
              ['assunto', 'Por assunto'],
              ['questionario', 'Questionário pronto'],
              ['escolher', 'Escolher as questões'],
            ] as [Fonte, string][]
          ).map(([f, r]) => (
            <button key={f} type="button" className={`botao pequeno${fonte === f ? ' escuro' : ''}`} onClick={() => setFonte(f)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {fonte === 'assunto' && (
        <>
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="assunto-treino">Assunto (vazio = todos)</label>
              <input id="assunto-treino" type="search" list="assuntos-treino" placeholder="Procurar assunto…" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
              <datalist id="assuntos-treino">
                {assuntos.map((a) => (
                  <option key={a.assunto} value={a.assunto}>{`${a.total} questões`}</option>
                ))}
              </datalist>
            </div>
            <div className="campo">
              <label htmlFor="tipos-treino">Tipo de questão</label>
              <select id="tipos-treino" className="seletor" value={tipos} onChange={(e) => setTipos(e.target.value as FiltroTipo)}>
                <option value="todos">Todos os tipos</option>
                <option value="alternativas">Só múltipla escolha e V/F</option>
                <option value="conceito">Só "Adivinhe o conceito"</option>
              </select>
            </div>
          </div>
          <div className="campo">
            <label>Como montar</label>
            <label className="caixa-marcar" style={{ marginTop: 0 }}>
              <input type="radio" checked={modo === 'sorteio'} onChange={() => setModo('sorteio')} /> Sortear novas questões a cada sessão do aluno
            </label>
            <label className="caixa-marcar" style={{ marginTop: 4 }}>
              <input type="radio" checked={modo === 'fixo'} onChange={() => setModo('fixo')} /> Lista fixa (sorteada agora, igual para todos)
            </label>
          </div>
          <div className="campo">
            <label htmlFor="quantas-treino">Questões por sessão</label>
            <input id="quantas-treino" type="number" min={1} max={200} value={quantas} onChange={(e) => setQuantas(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} style={{ width: 90 }} />
          </div>
        </>
      )}

      {fonte === 'questionario' && (
        <div className="campo">
          <label htmlFor="qz-treino">Questionário</label>
          {questionarios.length ? (
            <select id="qz-treino" className="seletor" value={qzId} onChange={(e) => setQzId(e.target.value)}>
              {questionarios.map((qz) => (
                <option key={qz.id} value={qz.id}>
                  {qz.nome} ({qz.questoes.filter((id) => porId.has(id)).length} questões)
                </option>
              ))}
            </select>
          ) : (
            <p className="ajuda">Nenhum questionário ainda.</p>
          )}
        </div>
      )}

      {fonte === 'escolher' && (
        <div className="campo">
          <label htmlFor="busca-treino">Marque as questões ({escolhidas.length} escolhidas)</label>
          <input id="busca-treino" className="busca-mat" type="search" placeholder="Buscar por enunciado, assunto ou pasta" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <ul className="lista-ordem disponiveis">
            {paraEscolher.slice(0, 200).map((q) => (
              <li key={q.id}>
                <label className="caixa-marcar" style={{ marginTop: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={escolhidas.includes(q.id)}
                    onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, q.id] : escolhidas.filter((x) => x !== q.id))}
                  />
                  <span className="texto-questao">
                    {q.tipo === 'conceito' ? `Conceito: ${q.enunciado}` : q.enunciado}
                    {q.etiquetas.length > 0 && <span className="ajuda"> · {q.etiquetas.join(', ')}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="campo">
        <label>Quando o aluno vê a resposta certa</label>
        <label className="caixa-marcar" style={{ marginTop: 0 }}>
          <input type="radio" checked={mostrar === 'cada'} onChange={() => setMostrar('cada')} /> Logo depois de cada questão (com a explicação e o artigo)
        </label>
        <label className="caixa-marcar" style={{ marginTop: 4 }}>
          <input type="radio" checked={mostrar === 'fim'} onChange={() => setMostrar('fim')} /> Só no fim, no resultado
        </label>
      </div>

      <p className="ajuda">
        {conjunto.length === 0
          ? 'Nenhuma questão encontrada com essa escolha.'
          : fonte === 'assunto' && modo === 'sorteio'
            ? `${conjunto.length} questões no conjunto; cada sessão sorteia ${porSessao}.`
            : `O treino terá ${fonte === 'assunto' ? porSessao : conjunto.length} questões.`}{' '}
        Uma cópia destas questões fica publicada no serviço do Vide enquanto o link estiver ativo (as respostas certas vão junto, para o treino funcionar).
      </p>
      {erro && <p className="digitar-msg erro">{erro}</p>}
      <div className="modal-botoes">
        <button className="botao primario" onClick={() => void criar()} disabled={!conjunto.length || criando}>
          {criando ? 'Criando…' : 'Gerar link'}
        </button>
        <button className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Seção da aba Questões: links de treino em casa. */
export function TreinosEmCasa({ questoes, questionarios }: { questoes: Questao[]; questionarios: Questionario[] }) {
  const [links, setLinks] = useState<LinkTreino[]>([]);
  const [criando, setCriando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const carregar = () => void listarLinksTreino().then(setLinks);
    carregar();
    window.addEventListener('vide-questoes-mudou', carregar);
    return () => window.removeEventListener('vide-questoes-mudou', carregar);
  }, []);

  return (
    <>
      <h2>Treino em casa (links para os alunos)</h2>
      <p className="ajuda">
        Gere um link com um grupo de questões: o aluno abre, resolve sozinho, sem tempo e sem competição, e pode salvar o resultado em PDF.
        Nada do aluno é guardado.
      </p>
      {criando ? (
        <FormTreino questoes={questoes} questionarios={questionarios} aoFechar={() => setCriando(false)} />
      ) : (
        <p>
          <button className="botao primario" onClick={() => setCriando(true)} disabled={!questoes.length}>
            Compartilhar para treino
          </button>
        </p>
      )}
      {erro && <p className="digitar-msg erro">{erro}</p>}
      {links.length > 0 && (
        <div className="cartao">
          <ul className="lista-ordem">
            {links.map((l) => (
              <li key={l.id} style={{ flexWrap: 'wrap' }}>
                <span className="texto-questao">
                  <strong>{l.titulo}</strong>{' '}
                  <span className="ajuda">
                    · {l.modo === 'sorteio' ? `sorteia ${l.quantas} de ${l.total}` : `${l.total} questões fixas`} ·{' '}
                    {l.mostrar === 'cada' ? 'resposta a cada questão' : 'respostas no fim'} · {l.origem} · criado em{' '}
                    {new Date(l.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                </span>
                <button className="botao pequeno" onClick={() => setAberto(aberto === l.id ? null : l.id)}>
                  {aberto === l.id ? 'Fechar' : 'Link e QR'}
                </button>
                <button
                  className="botao pequeno"
                  onClick={async () => {
                    if (!confirm(`Desativar o link "${l.titulo}"? Quem abrir o link verá que ele foi desativado.`)) return;
                    try {
                      setErro(null);
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
