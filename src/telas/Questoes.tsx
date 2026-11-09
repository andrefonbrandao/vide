// Acervo › Questões: banco de questões, questionários (sequências para a aula),
// importação por texto e resultados dos jogos (só números, sem nomes de alunos).
import { useEffect, useMemo, useState } from 'react';
import { baixar } from '../comum/registro';
import { diplomaPrincipal, todosDiplomas } from '../dados/diplomas';
import { lerDigitado } from '../voz/digitado';
import {
  adicionarQuestoes,
  excluirQuestao,
  excluirQuestionario,
  excluirResultado,
  listarQuestionarios,
  listarQuestoes,
  listarResultados,
  aceitarRespostaDigitada,
  assuntosDasQuestoes,
  resultadoCsv,
  salvarQuestao,
  salvarQuestionario,
} from '../jogo/banco';
import { MODELO_IMPORTACAO, importarQuestoes } from '../jogo/importar';
import { LETRAS, TEMPOS, TEMPO_PADRAO, TEMPO_PADRAO_CONCEITO, type Questao, type QuestaoJogo, type Questionario, type ResultadoJogo } from '../jogo/tipos';
import { TreinosEmCasa } from './CompartilharTreino';
import { filtrarMateriais, nomePasta, todasPastas } from '../material/organizacao';

function useDados() {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [questionarios, setQuestionarios] = useState<Questionario[]>([]);
  const [resultados, setResultados] = useState<ResultadoJogo[]>([]);
  useEffect(() => {
    const carregar = async () => {
      const [a, b, c] = await Promise.all([listarQuestoes(), listarQuestionarios(), listarResultados()]);
      setQuestoes(a);
      setQuestionarios(b);
      setResultados(c);
    };
    void carregar();
    const r = () => void carregar();
    window.addEventListener('vide-questoes-mudou', r);
    return () => window.removeEventListener('vide-questoes-mudou', r);
  }, []);
  return { questoes, questionarios, resultados };
}

function lerEtiquetas(t: string): string[] {
  return [...new Set(t.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Confere se o fundamento digitado é entendido ("485 VI" -> ok). */
function avisoFundamento(f: string): string | null {
  if (!f.trim()) return null;
  const r = lerDigitado(f, todosDiplomas(), diplomaPrincipal());
  return r.ok ? null : r.erro;
}

// ---------------------------------------------------------------------------
// Formulário de uma questão

export function FormQuestao({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: Questao;
  aoSalvar: (q: QuestaoJogo & { pasta: string; etiquetas: string[] }) => Promise<void> | void;
  aoCancelar?: () => void;
}) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'multipla');
  const [enunciado, setEnunciado] = useState(inicial?.enunciado ?? '');
  const [alts, setAlts] = useState<string[]>(inicial?.tipo === 'multipla' ? inicial.alternativas : ['', '', '', '']);
  const [correta, setCorreta] = useState(inicial?.correta ?? 0);
  const [tempo, setTempo] = useState(inicial?.tempo ?? TEMPO_PADRAO);
  const [explicacao, setExplicacao] = useState(inicial?.explicacao ?? '');
  const [fundamento, setFundamento] = useState(inicial?.fundamento ?? '');
  const [pasta, setPasta] = useState(inicial?.pasta ?? '');
  const [etiquetas, setEtiquetas] = useState((inicial?.etiquetas ?? []).join(', '));
  const [erro, setErro] = useState<string | null>(null);
  const [dicas, setDicas] = useState<string[]>(() => {
    const d = inicial?.dicas ?? [];
    return [...d, '', '', '', ''].slice(0, 4);
  });
  const [aceitas, setAceitas] = useState((inicial?.aceitas ?? []).join(', '));

  const salvar = async () => {
    if (tipo === 'conceito') {
      const ds = dicas.map((d) => d.trim()).filter(Boolean);
      if (!enunciado.trim()) return setErro('Escreva o conceito (a resposta).');
      if (ds.length < 2) return setErro('Escreva pelo menos duas dicas.');
      setErro(null);
      await aoSalvar({
        tipo,
        enunciado: enunciado.trim(),
        alternativas: [],
        correta: 0,
        tempo,
        explicacao: explicacao.trim(),
        fundamento: fundamento.trim(),
        dicas: ds,
        aceitas: aceitas.split(/[,;]/).map((a) => a.trim()).filter(Boolean),
        pasta: pasta.trim().replace(/\s*\/\s*/g, '/').replace(/^\/|\/$/g, ''),
        etiquetas: lerEtiquetas(etiquetas),
      });
      return;
    }
    const alternativas = tipo === 'vf' ? ['Verdadeiro', 'Falso'] : alts.map((a) => a.trim()).filter(Boolean);
    if (!enunciado.trim()) return setErro('Escreva o enunciado.');
    if (tipo === 'multipla' && alternativas.length < 2) return setErro('Preencha pelo menos duas alternativas.');
    if (tipo === 'multipla' && !alts[correta]?.trim()) return setErro('A alternativa marcada como correta está vazia.');
    // A correta é contada só entre as alternativas preenchidas.
    const idxCorreta = tipo === 'vf' ? Math.min(correta, 1) : alts.slice(0, correta).filter((a) => a.trim()).length;
    setErro(null);
    await aoSalvar({
      tipo,
      enunciado: enunciado.trim(),
      alternativas,
      correta: idxCorreta,
      tempo,
      explicacao: explicacao.trim(),
      fundamento: fundamento.trim(),
      pasta: pasta.trim().replace(/\s*\/\s*/g, '/').replace(/^\/|\/$/g, ''),
      etiquetas: lerEtiquetas(etiquetas),
    });
  };

  const aviso = avisoFundamento(fundamento);
  const [conhecidos, setConhecidos] = useState<string[]>([]);
  useEffect(() => {
    void listarQuestoes().then((l) => setConhecidos(assuntosDasQuestoes(l).map((a) => a.assunto)));
  }, []);

  return (
    <div className="cartao form-questao">
      <div className="linha-opcoes" role="radiogroup" aria-label="Tipo de questão">
        <label className="caixa-marcar">
          <input type="radio" checked={tipo === 'multipla'} onChange={() => setTipo('multipla')} /> Múltipla escolha
        </label>
        <label className="caixa-marcar">
          <input
            type="radio"
            checked={tipo === 'vf'}
            onChange={() => {
              setTipo('vf');
              setCorreta(0);
            }}
          />{' '}
          Verdadeiro ou falso
        </label>
        <label className="caixa-marcar">
          <input
            type="radio"
            checked={tipo === 'conceito'}
            onChange={() => {
              setTipo('conceito');
              if (tempo === TEMPO_PADRAO) setTempo(TEMPO_PADRAO_CONCEITO);
            }}
          />{' '}
          Adivinhe o conceito
        </label>
      </div>
      {tipo === 'conceito' ? (
        <>
          <div className="campo">
            <label htmlFor="enunciado">Conceito (a resposta certa)</label>
            <input id="enunciado" type="text" placeholder="ex.: sentença" value={enunciado} onChange={(e) => setEnunciado(e.target.value)} />
          </div>
          <div className="campo">
            <label>Dicas, da mais difícil para a mais fácil (2 a 4)</label>
            {dicas.map((d, i) => (
              <div key={i} className="linha-alt">
                <b>Dica {i + 1}</b>
                <input
                  type="text"
                  value={d}
                  placeholder={i < 2 ? 'obrigatória' : 'opcional'}
                  onChange={(e) => setDicas(dicas.map((x, k) => (k === i ? e.target.value : x)))}
                />
              </div>
            ))}
            <span className="ajuda" style={{ margin: 0 }}>
              A 1ª dica aparece no início; as outras, em intervalos iguais do tempo (ex.: 60 s e 3 dicas: 0 s, 20 s e 40 s).
            </span>
          </div>
          <div className="campo">
            <label htmlFor="aceitas">Também aceitar (separadas por vírgula; opcional)</label>
            <input id="aceitas" type="text" placeholder="ex.: sentença judicial" value={aceitas} onChange={(e) => setAceitas(e.target.value)} />
            <span className="ajuda" style={{ margin: 0 }}>Maiúsculas, acentos e artigo no início ("a sentença") não importam.</span>
          </div>
        </>
      ) : (
      <div className="campo">
        <label htmlFor="enunciado">{tipo === 'vf' ? 'Afirmação' : 'Enunciado'}</label>
        <textarea id="enunciado" rows={3} value={enunciado} onChange={(e) => setEnunciado(e.target.value)} />
      </div>
      )}
      {tipo === 'conceito' ? null : tipo === 'multipla' ? (
        <div className="campo">
          <label>Alternativas (marque a correta)</label>
          {alts.map((a, i) => (
            <div key={i} className="linha-alt">
              <input type="radio" name="correta" checked={correta === i} onChange={() => setCorreta(i)} aria-label={`${LETRAS[i]} é a correta`} />
              <b>{LETRAS[i]})</b>
              <input
                type="text"
                value={a}
                placeholder={i < 2 ? 'obrigatória' : 'opcional'}
                onChange={(e) => setAlts(alts.map((x, k) => (k === i ? e.target.value : x)))}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="campo">
          <label>Resposta</label>
          <div className="linha-opcoes">
            <label className="caixa-marcar">
              <input type="radio" checked={correta === 0} onChange={() => setCorreta(0)} /> Verdadeiro
            </label>
            <label className="caixa-marcar">
              <input type="radio" checked={correta === 1} onChange={() => setCorreta(1)} /> Falso
            </label>
          </div>
        </div>
      )}
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="tempo">Tempo sugerido (dá para trocar ao abrir a atividade)</label>
          <select id="tempo" className="seletor" value={tempo} onChange={(e) => setTempo(Number(e.target.value))}>
            {[...new Set([...TEMPOS, tempo])].sort((a, b) => a - b).map((t) => (
              <option key={t} value={t}>
                {t} segundos
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="fundamento">Fundamento (opcional)</label>
          <input id="fundamento" type="text" placeholder="ex.: 485 VI · 300 §1 · 5 CF" value={fundamento} onChange={(e) => setFundamento(e.target.value)} />
          {aviso && <span className="digitar-msg erro" style={{ padding: 0 }}>{aviso}</span>}
        </div>
      </div>
      <div className="campo">
        <label htmlFor="explicacao">Explicação (aparece depois da resposta; opcional)</label>
        <textarea id="explicacao" rows={2} value={explicacao} onChange={(e) => setExplicacao(e.target.value)} />
      </div>
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="pasta-q">Pasta</label>
          <input id="pasta-q" type="text" placeholder="ex.: Processo Civil II/Recursos" value={pasta} onChange={(e) => setPasta(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="etiquetas-q">Assuntos (separados por vírgula)</label>
          <input id="etiquetas-q" type="text" list="assuntos-q" placeholder="ex.: sentença, recursos" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} />
        </div>
      </div>
      <datalist id="assuntos-q">
        {conhecidos.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      {erro && <p className="digitar-msg erro">{erro}</p>}
      <div className="modal-botoes">
        <button className="botao primario" onClick={() => void salvar()}>
          {inicial ? 'Salvar alterações' : 'Guardar questão'}
        </button>
        {aoCancelar && (
          <button className="botao" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adicionar questões (uma a uma ou coladas em lote)

export function AdicionarQuestoes({ aoVer }: { aoVer: () => void }) {
  const [modo, setModo] = useState<'colar' | 'uma'>('colar');
  const [texto, setTexto] = useState('');
  const [pasta, setPasta] = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const [nomeQuestionario, setNomeQuestionario] = useState('');
  const [feito, setFeito] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const previa = useMemo(() => (texto.trim() ? importarQuestoes(texto) : null), [texto]);

  const guardar = async () => {
    if (!previa?.questoes.length) return;
    const r = await adicionarQuestoes(previa.questoes, {
      pasta: pasta.trim(),
      etiquetas: lerEtiquetas(etiquetas),
      questionario: nomeQuestionario,
    });
    setFeito(
      `${r.questoes.length} ${r.questoes.length === 1 ? 'questão guardada' : 'questões guardadas'}` +
        (r.questionario ? ` e o questionário "${r.questionario.nome}" foi criado.` : '.'),
    );
    setTexto('');
  };

  return (
    <>
      <h2>Adicionar questões</h2>
      <div className="linha-opcoes">
        <button className={`botao${modo === 'colar' ? ' escuro' : ''}`} onClick={() => setModo('colar')}>
          Colar várias de uma vez
        </button>
        <button className={`botao${modo === 'uma' ? ' escuro' : ''}`} onClick={() => setModo('uma')}>
          Escrever uma questão
        </button>
      </div>
      {feito && (
        <div className="aviso">
          {feito}{' '}
          <button
            className="botao pequeno"
            onClick={() => {
              try {
                sessionStorage.setItem('vide.secaoQuestoes', 'banco');
              } catch {
                /* ignore */
              }
              aoVer();
            }}
          >
            Ver questões
          </button>
        </div>
      )}
      {modo === 'uma' ? (
        <FormQuestao
          aoSalvar={async (q) => {
            await salvarQuestao(q);
            setFeito('Questão guardada.');
          }}
        />
      ) : (
        <div className="cartao">
          <p className="ajuda">
            Cole as questões no formato abaixo: enunciado, alternativas (A a D) e <strong>Resposta</strong>. Sem alternativas, a
            questão vira verdadeiro ou falso (Resposta: V ou F). <strong>Tempo</strong>, <strong>Explicação</strong>,{' '}
            <strong>Fundamento</strong> e <strong>Assunto</strong> são opcionais. Se pedir questões a uma IA, mande este modelo junto.
          </p>
          <pre className="mono modelo-questoes">{MODELO_IMPORTACAO}</pre>
          <button
            className="botao pequeno"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(MODELO_IMPORTACAO);
                setCopiado(true);
              } catch {
                setCopiado(false);
              }
            }}
          >
            {copiado ? 'Modelo copiado' : 'Copiar o modelo'}
          </button>
          <div className="campo" style={{ marginTop: 14 }}>
            <label htmlFor="colar">Questões</label>
            <textarea id="colar" rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui…" />
          </div>
          {previa && (
            <div className="previa-importacao">
              <p>
                <strong>{previa.questoes.length}</strong> {previa.questoes.length === 1 ? 'questão entendida' : 'questões entendidas'}
                {previa.erros.length > 0 && (
                  <>
                    {' '}
                    · <strong>{previa.erros.length}</strong> com problema (não serão guardadas):
                  </>
                )}
              </p>
              {previa.erros.map((e) => (
                <p key={e.numero} className="digitar-msg erro" style={{ padding: 0 }}>
                  Questão {e.numero} ("{e.trecho}"): {e.mensagem}
                </p>
              ))}
              <ol className="lista-previa">
                {previa.questoes.map((q, i) => (
                  <li key={i}>
                    {q.enunciado}{' '}
                    <span className="ajuda">
                      · {q.tipo === 'conceito' ? `conceito · ${q.dicas?.length ?? 0} dicas` : q.tipo === 'vf' ? (q.correta === 0 ? 'Verdadeiro' : 'Falso') : `correta ${LETRAS[q.correta]}`} · {q.tempo}s
                      {q.fundamento && ` · ${q.fundamento}`}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="pasta-i">Pasta</label>
              <input id="pasta-i" type="text" placeholder="ex.: Processo Civil II" value={pasta} onChange={(e) => setPasta(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="etq-i">Assuntos de todas estas questões (separados por vírgula)</label>
              <input id="etq-i" type="text" placeholder="ex.: sentença" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="nome-qz">Criar um questionário com estas questões (opcional)</label>
            <input id="nome-qz" type="text" placeholder="ex.: Revisão — Sentença" value={nomeQuestionario} onChange={(e) => setNomeQuestionario(e.target.value)} />
          </div>
          <button className="botao primario" disabled={!previa?.questoes.length} onClick={() => void guardar()}>
            Guardar {previa?.questoes.length ? previa.questoes.length : ''} {previa?.questoes.length === 1 ? 'questão' : 'questões'}
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Lista: questionários, questões e resultados

function EditorQuestionario({ inicial, questoes, aoFechar }: { inicial?: Questionario; questoes: Questao[]; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [ids, setIds] = useState<string[]>(inicial?.questoes.filter((id) => questoes.some((q) => q.id === id)) ?? []);
  const [busca, setBusca] = useState('');
  const porId = new Map(questoes.map((q) => [q.id, q]));
  const disponiveis = filtrarMateriais(
    questoes.filter((q) => !ids.includes(q.id)).map((q) => ({ ...q, nome: q.enunciado })),
    busca,
  );
  const mover = (i: number, d: number) => {
    const n = [...ids];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setIds(n);
  };
  return (
    <div className="cartao editor-questionario">
      <div className="campo">
        <label htmlFor="nome-questionario">Nome do questionário</label>
        <input id="nome-questionario" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Revisão — Recursos" />
      </div>
      <h3>Questões, na ordem ({ids.length})</h3>
      {!ids.length && <p className="ajuda">Adicione questões da lista abaixo.</p>}
      <ol className="lista-ordem">
        {ids.map((id, i) => (
          <li key={id}>
            <span className="texto-questao">{porId.get(id)?.enunciado}</span>
            <button className="botao pequeno" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
              ↑
            </button>
            <button className="botao pequeno" onClick={() => mover(i, 1)} disabled={i === ids.length - 1} aria-label="Descer">
              ↓
            </button>
            <button className="botao pequeno" onClick={() => setIds(ids.filter((x) => x !== id))} aria-label="Tirar">
              ✕
            </button>
          </li>
        ))}
      </ol>
      <h3>Adicionar do banco</h3>
      <input className="busca-mat" type="search" placeholder="Buscar por enunciado, pasta ou etiqueta" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <ul className="lista-ordem disponiveis">
        {disponiveis.slice(0, 50).map((q) => (
          <li key={q.id}>
            <span className="texto-questao">
              {q.enunciado} <span className="ajuda">· {nomePasta(q.pasta)}</span>
            </span>
            <button className="botao pequeno" onClick={() => setIds([...ids, q.id])}>
              + Adicionar
            </button>
          </li>
        ))}
      </ul>
      <div className="modal-botoes">
        <button
          className="botao primario"
          disabled={!nome.trim()}
          onClick={async () => {
            await salvarQuestionario(nome.trim(), ids, inicial);
            aoFechar();
          }}
        >
          Salvar questionário
        </button>
        <button className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

type SecaoQuestoes = 'inicio' | 'banco' | 'questionarios' | 'treinos' | 'resultados';
const CHAVE_SECAO = 'vide.secaoQuestoes';

export function ListaQuestoes({ aoAdicionar }: { aoAdicionar: () => void }) {
  const { questoes, questionarios, resultados } = useDados();
  // Seção aberta (lembrada enquanto a aba do navegador estiver aberta). Começa no início.
  const [secao, setSecaoEstado] = useState<SecaoQuestoes>(() => {
    try {
      return (sessionStorage.getItem(CHAVE_SECAO) as SecaoQuestoes) || 'inicio';
    } catch {
      return 'inicio';
    }
  });
  const [criarTreino, setCriarTreino] = useState(false);
  const setSecao = (s: SecaoQuestoes) => {
    setSecaoEstado(s);
    setCriarTreino(false);
    try {
      sessionStorage.setItem(CHAVE_SECAO, s);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };
  const [editandoQz, setEditandoQz] = useState<Questionario | 'novo' | null>(null);
  const [editandoQ, setEditandoQ] = useState<Questao | null>(null);
  const [busca, setBusca] = useState('');
  const [assunto, setAssunto] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const filtradas = filtrarMateriais(
    questoes.map((q) => ({ ...q, nome: q.enunciado })),
    busca,
    assunto,
  );
  const assuntos = assuntosDasQuestoes(questoes);
  const pastas = todasPastas(questoes.map((q) => ({ ...q, nome: q.enunciado })));

  const vazio = !questoes.length;
  const nav = (
    <nav className="secoes-questoes" aria-label="Seções de questões">
      {(
        [
          ['inicio', 'Início'],
          ['banco', `Questões (${questoes.length})`],
          ['questionarios', `Questionários (${questionarios.length})`],
          ['treinos', 'Treinos em casa'],
          ['resultados', `Resultados (${resultados.length})`],
        ] as [SecaoQuestoes, string][]
      ).map(([s, r]) => (
        <button key={s} className={`botao pequeno${secao === s ? ' escuro' : ''}`} aria-current={secao === s ? 'page' : undefined} onClick={() => setSecao(s)}>
          {r}
        </button>
      ))}
    </nav>
  );

  if (secao === 'inicio') {
    return (
      <>
        {nav}
        <h2>O que você quer fazer?</h2>
        <div className="atalhos-questoes">
          <button
            className="atalho-questoes destaque"
            disabled={vazio}
            onClick={() => {
              setSecao('treinos');
              setCriarTreino(true);
            }}
          >
            <strong>Novo treino em casa</strong>
            <span>Gerar um link e um QR code com um grupo de questões para os alunos treinarem sozinhos.</span>
          </button>
          <button className="atalho-questoes" onClick={aoAdicionar}>
            <strong>Adicionar questões</strong>
            <span>Escrever uma questão ou colar várias de uma vez (múltipla escolha, V/F ou "Adivinhe o conceito").</span>
          </button>
          <button
            className="atalho-questoes"
            disabled={vazio}
            onClick={() => {
              setSecao('questionarios');
              setEditandoQz('novo');
            }}
          >
            <strong>Novo questionário</strong>
            <span>Montar uma sequência de questões para um jogo em sala ou um treino.</span>
          </button>
        </div>
        {vazio && <p className="ajuda">Comece adicionando questões: os outros atalhos ficam disponíveis depois.</p>}
        <p className="ajuda">
          Para um <strong>jogo em sala</strong> (os alunos respondendo pelo celular), vá na <strong>Aula</strong> e clique em <strong>Atividades</strong>.
        </p>
        <div className="resumo-questoes">
          <button onClick={() => setSecao('banco')}>
            <strong>{questoes.length}</strong> {questoes.length === 1 ? 'questão' : 'questões'} no banco
          </button>
          <button onClick={() => setSecao('questionarios')}>
            <strong>{questionarios.length}</strong> {questionarios.length === 1 ? 'questionário' : 'questionários'}
          </button>
          <button onClick={() => setSecao('treinos')}>links de treino em casa</button>
          <button onClick={() => setSecao('resultados')}>
            <strong>{resultados.length}</strong> {resultados.length === 1 ? 'resultado de jogo' : 'resultados de jogos'}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {nav}
      {secao === 'questionarios' && (
      <>
      <h2>Questionários</h2>
      <p className="ajuda">
        Um questionário é a sequência de questões de um jogo. Para jogar, vá na <strong>Aula</strong> e clique em{' '}
        <strong>Atividades</strong>.
      </p>
      {editandoQz ? (
        <EditorQuestionario inicial={editandoQz === 'novo' ? undefined : editandoQz} questoes={questoes} aoFechar={() => setEditandoQz(null)} />
      ) : (
        <>
          <div className="cartao">
            {!questionarios.length && <p className="ajuda">Nenhum questionário ainda.</p>}
            <ul className="lista-ordem">
              {questionarios.map((qz) => (
                <li key={qz.id}>
                  <span className="texto-questao">
                    <strong>{qz.nome}</strong>{' '}
                    <span className="ajuda">
                      · {qz.questoes.filter((id) => questoes.some((q) => q.id === id)).length} questões
                    </span>
                  </span>
                  <button className="botao pequeno" onClick={() => setEditandoQz(qz)}>
                    Editar
                  </button>
                  <button
                    className="botao pequeno"
                    onClick={() => confirm(`Apagar o questionário "${qz.nome}"? As questões continuam no banco.`) && void excluirQuestionario(qz.id)}
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p>
            <button className="botao" onClick={() => setEditandoQz('novo')} disabled={!questoes.length}>
              + Novo questionário
            </button>
          </p>
        </>
      )}

      </>
      )}

      {secao === 'banco' && (
      <>
      <h2>Banco de questões ({questoes.length})</h2>
      {!editandoQ && (
        <p>
          <button className="botao" onClick={aoAdicionar}>
            + Adicionar questões
          </button>
        </p>
      )}
      {editandoQ ? (
        <FormQuestao
          inicial={editandoQ}
          aoSalvar={async (q) => {
            await salvarQuestao(q, editandoQ);
            setEditandoQ(null);
          }}
          aoCancelar={() => setEditandoQ(null)}
        />
      ) : (
        <>
          <div className="filtros-mat">
            <input className="busca-mat" type="search" placeholder="Buscar por enunciado, pasta ou assunto" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {assuntos.length > 0 && (
              <div className="etiquetas" aria-label="Filtrar por assunto">
                <span className="ajuda" style={{ margin: 0 }}>Assuntos:</span>
                {assuntos.map(({ assunto: a, total }) => (
                  <button key={a} type="button" className={`etiqueta-mat${assunto === a ? ' ativa' : ''}`} onClick={() => setAssunto(assunto === a ? null : a)}>
                    {a} <span className="total">{total}</span>
                  </button>
                ))}
              </div>
            )}
            {pastas.length > 0 && (
              <div className="linha-opcoes">
                {pastas.map((p) => (
                  <button key={p} className="botao pequeno" onClick={() => setBusca(p.split('/').pop() ?? p)}>
                    {nomePasta(p)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="lista-questoes">
            {filtradas.map((q) => (
              <li key={q.id} className="cartao">
                <p className="texto-questao">
                  <strong>{q.tipo === 'conceito' ? `Conceito: ${q.enunciado}` : q.enunciado}</strong>
                </p>
                <p className="ajuda" style={{ margin: 0 }}>
                  {q.tipo === 'conceito'
                    ? `Adivinhe o conceito · ${q.dicas?.length ?? 0} dicas${q.aceitas?.length ? ` · também aceita: ${q.aceitas.join(', ')}` : ''}`
                    : q.tipo === 'vf'
                      ? `V/F · ${q.correta === 0 ? 'Verdadeiro' : 'Falso'}`
                      : `Múltipla escolha · correta ${LETRAS[q.correta]}) ${q.alternativas[q.correta]}`}{' '}
                  ·{' '}
                  {q.tempo}s{q.fundamento && ` · fundamento: ${q.fundamento}`} · {nomePasta(q.pasta)}
                  {q.etiquetas.length > 0 && ` · assuntos: ${q.etiquetas.join(', ')}`}
                </p>
                <div className="linha-opcoes" style={{ marginTop: 8 }}>
                  <button className="botao pequeno" onClick={() => setEditandoQ(q)}>
                    Editar
                  </button>
                  <button className="botao pequeno" onClick={() => confirm('Apagar esta questão?') && void excluirQuestao(q.id)}>
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      </>
      )}

      {secao === 'treinos' && <TreinosEmCasa questoes={questoes} questionarios={questionarios} criarAoAbrir={criarTreino} />}

      {secao === 'resultados' && (
      <>
      <h2>Resultados dos jogos</h2>
      <p className="ajuda">Os números de cada questão (quantos marcaram cada alternativa) e, no "Adivinhe o conceito", o que foi digitado. Nenhum apelido é guardado.</p>
      {!resultados.length && <p className="ajuda">Nenhum jogo encerrado ainda.</p>}
      {resultados.map((r) => {
        const total = r.perguntas.reduce((s, p) => s + p.respostas.reduce((a, n) => a + n, 0) + p.semResposta, 0);
        const certas = r.perguntas.reduce((s, p) => s + p.respostas[p.correta], 0);
        return (
          <div key={r.id} className="cartao" style={{ marginBottom: 10 }}>
            <div className="linha-opcoes">
              <strong>{r.questionario}</strong>
              <span className="ajuda" style={{ margin: 0 }}>
                {new Date(r.em).toLocaleString('pt-BR')} · {r.participantes} participantes · {total ? Math.round((certas / total) * 100) : 0}% de acerto
              </span>
              {(() => {
                const pendentes = r.perguntas.reduce((n, p) => n + (p.tentativas ?? []).filter((t) => t.situacao === 'errada' && !t.incluida).length, 0);
                return pendentes ? <span className="selo-tentativa">{pendentes} {pendentes === 1 ? 'resposta digitada para revisar' : 'respostas digitadas para revisar'}</span> : null;
              })()}
              <span className="espaco" />
              <button className="botao pequeno" onClick={() => setAberto(aberto === r.id ? null : r.id)}>
                {aberto === r.id ? 'Fechar' : 'Ver por questão'}
              </button>
              <button
                className="botao pequeno"
                onClick={() => {
                  const d = new Date(r.em);
                  const p = (n: number) => String(n).padStart(2, '0');
                  baixar(`vide-jogo-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}.csv`, resultadoCsv(r), 'text/csv');
                }}
              >
                Exportar .csv
              </button>
              <button className="botao pequeno" onClick={() => confirm('Apagar este resultado?') && void excluirResultado(r.id)}>
                Apagar
              </button>
            </div>
            {aberto === r.id && (
              <ol className="lista-previa">
                {r.perguntas.map((p, i) => {
                  const t = p.respostas.reduce((a, n) => a + n, 0) + p.semResposta;
                  const conceito = !!p.tentativas;
                  return (
                    <li key={i}>
                      {p.enunciado}{' '}
                      <span className="ajuda">
                        · {t ? Math.round((p.respostas[p.correta] / t) * 100) : 0}% de acerto ·{' '}
                        {conceito
                          ? `acertaram: ${p.respostas[0]} · não acertaram: ${p.semResposta}`
                          : `${p.respostas.map((n, k) => `${LETRAS[k]}: ${n}`).join(' · ')}${p.semResposta ? ` · sem resposta: ${p.semResposta}` : ''}`}
                      </span>
                      {conceito && (p.tentativas ?? []).length > 0 && (
                        <div className="tentativas-conceito">
                          <span className="ajuda" style={{ margin: 0 }}>
                            O que foi digitado (sem nomes). "Aceitar nas próximas" inclui a resposta nas aceitas deste conceito:
                          </span>
                          <ul>
                            {p.tentativas!.map((tt, k) => (
                              <li key={k}>
                                <strong>“{tt.texto}”</strong> <span className="ajuda">· {tt.vezes}×</span>{' '}
                                {tt.situacao === 'parecida' ? (
                                  <span className="selo-tentativa">aceita por semelhança</span>
                                ) : tt.incluida ? (
                                  <span className="selo-tentativa ok">aceita nas próximas ✓</span>
                                ) : (
                                  <button
                                    className="botao pequeno"
                                    onClick={async () => {
                                      const erro = await aceitarRespostaDigitada(r, i, k);
                                      if (erro) alert(erro);
                                    }}
                                  >
                                    Aceitar nas próximas
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
      </>
      )}
    </>
  );
}
