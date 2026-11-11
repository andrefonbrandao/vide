// Jogo de perguntas na tela do professor: escolher o questionário e conduzir o jogo.
import { confirmar } from '../comum/avisos';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { anfitriao, rankingPreferido } from '../jogo/anfitriao';
import { assuntosDasQuestoes, listarQuestionarios, listarQuestoes, questoesDo, sortearQuestoes, type FiltroTipo } from '../jogo/banco';
import { rotuloAvancar } from '../jogo/motor';
import { OPCOES_VOTO_FORCA, VOTO_PADRAO_FORCA, type Questao, type QuestaoJogo, type Questionario } from '../jogo/tipos';
import { IcCasos, IcForca, IcPerguntas, IcProcesso, IcSeta } from '../comum/Icones';
import type { Expressao } from '../consulta/personagens';
import { Figura } from './ConsultaTela';
import { JogoTela } from './JogoTela';
import { EscolherConsulta } from './PainelConsulta';
import { EscolherProcesso } from './PainelProcesso';
import type { ControladorAula } from './controlador';

export function useJogo() {
  const a = anfitriao();
  return useSyncExternalStore(a.assinar, a.obter);
}

type Modo = 'assunto' | 'questionario';
const CHAVE_MODO = 'vide.jogoModo';
/** Que jogo: perguntas (alternativas e conceito) ou forca (a turma toda). */
type Jogo = 'perguntas' | 'forca' | 'consulta' | 'processo';
const CHAVE_JOGO = 'vide.jogoTipo';
const CHAVE_VOTO = 'vide.jogoVotoForca';

function lerPref<T extends string | number>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    if (v === null) return padrao;
    return (typeof padrao === 'number' ? Number(v) || padrao : v) as T;
  } catch {
    return padrao;
  }
}
function gravarPref(chave: string, v: string | number) {
  try {
    localStorage.setItem(chave, String(v));
  } catch {
    /* ignore */
  }
}

/** Tempo escolhido ao abrir a atividade: 0 = o tempo sugerido de cada questão. */
interface Tempos {
  alternativas: number;
  conceito: number;
}
const CHAVE_TEMPOS = 'vide.jogoTempos';
const OPCOES_TEMPO = [10, 15, 20, 30, 45, 60, 90, 120, 180];

function temposGuardados(): Tempos {
  try {
    const t = JSON.parse(localStorage.getItem(CHAVE_TEMPOS) ?? 'null') as Tempos | null;
    if (t && Number.isFinite(t.alternativas) && Number.isFinite(t.conceito)) return t;
  } catch {
    /* ignore */
  }
  return { alternativas: 0, conceito: 0 };
}

function paraJogo(q: Questao, tempos: Tempos = { alternativas: 0, conceito: 0 }): QuestaoJogo {
  const { id, tipo, enunciado, alternativas, correta, explicacao, fundamento, dicas, aceitas } = q;
  const escolhido = tipo === 'conceito' ? tempos.conceito : tempos.alternativas;
  return { id, tipo, enunciado, alternativas, correta, tempo: escolhido || q.tempo, explicacao, fundamento, dicas, aceitas };
}

function SeletorTempo({ id, valor, aoMudar }: { id: string; valor: number; aoMudar: (v: number) => void }) {
  return (
    <select id={id} className="seletor" value={valor} onChange={(e) => aoMudar(Number(e.target.value))}>
      <option value={0}>O tempo sugerido de cada questão</option>
      {OPCOES_TEMPO.map((t) => (
        <option key={t} value={t}>
          {t} segundos para todas
        </option>
      ))}
    </select>
  );
}

/** As atividades da galeria: personagem, cor de fundo e o selo com o ícone. */
const ATIVIDADES: { id: Jogo; titulo: string; curto: string; longo: string; figura: string; expressao: Expressao; cor: string; icone: ReactNode }[] = [
  {
    id: 'perguntas',
    titulo: 'Jogo de perguntas',
    curto: 'Pelo celular, com ranking e pódio.',
    longo: 'Os alunos entram pelo QR, só com um apelido, e respondem no celular. Próximo passo: escolher as questões (por assunto ou questionário pronto).',
    figura: 'h5',
    expressao: 'feliz',
    cor: '#dfe9e3',
    icone: <IcPerguntas tamanho={22} />,
  },
  {
    id: 'forca',
    titulo: 'Forca',
    curto: 'A turma vota letras pelo celular.',
    longo: 'A palavra é o conceito das questões "Adivinhe o conceito". A turma joga junta: cada um vota numa letra e a mais votada entra. Próximo passo: escolher as palavras.',
    figura: 'm1',
    expressao: 'duvida',
    cor: '#fbe3dc',
    icone: <IcForca tamanho={22} />,
  },
  {
    id: 'consulta',
    titulo: 'Consulta',
    curto: 'Caso em balões, discussão em grupo.',
    longo: 'Um personagem conta um caso em balões no projetor; a turma discute em grupo e, no fim do tempo, o advogado ou o juiz responde. Não usa celular. Próximo passo: escolher os casos.',
    figura: 'm3',
    expressao: 'duvida',
    cor: '#e8e2ee',
    icone: <IcCasos tamanho={22} />,
  },
  {
    id: 'processo',
    titulo: 'Processo da turma',
    curto: 'Projetar e liberar eventos.',
    longo: 'Projeta o processo fictício como a turma vê. Você abre as peças e libera eventos durante a aula. Próximo passo: escolher o processo.',
    figura: 'juiz-h',
    expressao: 'neutro',
    cor: '#e3e8ee',
    icone: <IcProcesso tamanho={22} />,
  },
];

function Passos({ passo }: { passo: 1 | 2 }) {
  return (
    <div className="passos" aria-label={`Passo ${passo} de 2`}>
      <span className={`passo${passo === 1 ? ' atual' : ' feito'}`}>
        <i>1</i>Atividade
      </span>
      <span className="passo-traco" />
      <span className={`passo${passo === 2 ? ' atual' : ''}`}>
        <i>2</i>Conteúdo e opções
      </span>
    </div>
  );
}

/** Janela das atividades: 1) escolher na galeria; 2) conteúdo e opções. */
export function IniciarJogo({ aoFechar }: { aoFechar: () => void }) {
  const [lista, setLista] = useState<(Questionario & { total: number; conceitos: number })[] | null>(null);
  const [banco, setBanco] = useState<Questao[]>([]);
  const [escolhido, setEscolhido] = useState<string>('');
  const [ranking, setRanking] = useState(rankingPreferido());
  const [modo, setModoEstado] = useState<Modo>(() => {
    try {
      return (localStorage.getItem(CHAVE_MODO) as Modo) || 'assunto';
    } catch {
      return 'assunto';
    }
  });
  const [assunto, setAssunto] = useState<string>('');
  const [quantas, setQuantas] = useState(10);
  const [tiposEscolhidos, setTipos] = useState<FiltroTipo>('todos');
  const [jogo, setJogoEstado] = useState<Jogo>(() => {
    const j = lerPref<string>(CHAVE_JOGO, 'perguntas');
    return j === 'forca' || j === 'consulta' || j === 'processo' ? j : 'perguntas';
  });
  const setJogo = (j: Jogo) => (setJogoEstado(j), gravarPref(CHAVE_JOGO, j));
  const [passo, setPasso] = useState<1 | 2>(1);
  const atual = ATIVIDADES.find((a) => a.id === jogo) ?? ATIVIDADES[0];
  const [votoS, setVotoEstado] = useState<number>(() => lerPref(CHAVE_VOTO, VOTO_PADRAO_FORCA));
  const setVoto = (v: number) => (setVotoEstado(v), gravarPref(CHAVE_VOTO, v));
  const forca = jogo === 'forca';
  // A forca usa só "Adivinhe o conceito" (a palavra é o conceito).
  const tipos: FiltroTipo = forca ? 'conceito' : tiposEscolhidos;
  const [buscaAssunto, setBuscaAssunto] = useState('');
  const [tempos, setTemposEstado] = useState<Tempos>(temposGuardados);
  const setTempos = (t: Tempos) => {
    setTemposEstado(t);
    try {
      localStorage.setItem(CHAVE_TEMPOS, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  };
  const setModo = (m: Modo) => {
    setModoEstado(m);
    try {
      localStorage.setItem(CHAVE_MODO, m);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void (async () => {
      const [qs, todas] = await Promise.all([listarQuestionarios(), listarQuestoes()]);
      const comTotal = await Promise.all(
        qs.map(async (q) => {
          const lista = await questoesDo(q);
          return { ...q, total: lista.length, conceitos: lista.filter((x) => x.tipo === 'conceito').length };
        }),
      );
      setLista(comTotal);
      setBanco(todas);
      setEscolhido(comTotal.find((q) => q.total > 0)?.id ?? '');
      setAssunto(assuntosDasQuestoes(todas)[0]?.assunto ?? '*');
    })();
  }, []);

  const doTipo = banco.filter((q) => tipos === 'todos' || (tipos === 'conceito') === (q.tipo === 'conceito'));
  const assuntos = assuntosDasQuestoes(doTipo);
  // Procura ignorando maiúsculas e acentos; todas as palavras digitadas precisam aparecer.
  const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termos = semAcento(buscaAssunto).split(/\s+/).filter(Boolean);
  const encontrados = assuntos.filter((a) => termos.every((t) => semAcento(a.assunto).includes(t)));
  const disponiveis = assunto === '*' ? doTipo.length : (assuntos.find((a) => a.assunto === assunto)?.total ?? 0);
  const vaiTer = Math.min(quantas, disponiveis);

  const abrir = async () => {
    if (modo === 'assunto') {
      const sorteadas = sortearQuestoes(banco, assunto === '*' ? null : assunto, quantas, Math.random, tipos);
      if (!sorteadas.length) return;
      const n = sorteadas.length;
      const nome = `${forca ? `Forca · ${n} ${n === 1 ? 'palavra' : 'palavras'}` : `${n} ${n === 1 ? 'questão' : 'questões'}`} · ${assunto === '*' ? 'todos os assuntos' : assunto}`;
      anfitriao().iniciar(nome, sorteadas.map((q) => paraJogo(q, tempos)), ranking, { modo: forca ? 'forca' : 'perguntas', votoS });
    } else {
      const q = lista?.find((x) => x.id === escolhido);
      if (!q) return;
      anfitriao().iniciar(forca ? `Forca · ${q.nome}` : q.nome, (await questoesDo(q)).map((x) => paraJogo(x, tempos)), ranking, { modo: forca ? 'forca' : 'perguntas', votoS });
    }
    aoFechar();
  };

  const qzEscolhido = lista?.find((x) => x.id === escolhido);
  const podeAbrir = modo === 'assunto' ? vaiTer > 0 : !!qzEscolhido && (forca ? qzEscolhido.conceitos > 0 : qzEscolhido.total > 0);

  if (passo === 1)
    return (
      <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
        <div
          className="modal atividades"
          role="dialog"
          aria-label="Atividades"
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') aoFechar();
          }}
        >
          <div className="atividades-cab">
            <h2>Atividades</h2>
            <Passos passo={1} />
          </div>
          <div className="galeria-atividades" role="radiogroup" aria-label="Que atividade">
            {ATIVIDADES.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={jogo === a.id}
                className={`cartao-atividade${jogo === a.id ? ' sel' : ''}`}
                onClick={() => setJogo(a.id)}
                onDoubleClick={() => (setJogo(a.id), setPasso(2))}
              >
                <span className="cartao-atividade-arte" style={{ background: a.cor }}>
                  <Figura id={a.figura} expressao={a.expressao} />
                  <span className="selo-icone">{a.icone}</span>
                </span>
                <span className="cartao-atividade-texto">
                  <strong>{a.titulo}</strong>
                  <span>{a.curto}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="atividades-rodape">
            <div>
              <strong>{atual.titulo}</strong>
              <p className="ajuda">{atual.longo}</p>
            </div>
            <button className="botao" onClick={aoFechar}>
              Cancelar
            </button>
            <button className="botao primario com-icone" autoFocus onClick={() => setPasso(2)}>
              Continuar <IcSeta tamanho={16} />
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="modal atividades passo-2" role="dialog" aria-label={atual.titulo}>
        <div className="atividades-cab">
          <button type="button" className="atividades-voltar" onClick={() => setPasso(1)} title="Escolher outra atividade">
            <span className="atividades-voltar-figura" style={{ background: atual.cor }}>
              <Figura id={atual.figura} expressao={atual.expressao} />
            </span>
            <span>
              <span className="link-discreto">‹ trocar atividade</span>
              <h2>{atual.titulo}</h2>
            </span>
          </button>
          <Passos passo={2} />
        </div>
        {jogo === 'processo' ? (
          <>
            <EscolherProcesso aoFechar={aoFechar} />
          </>
        ) : jogo === 'consulta' ? (
          <>
            <EscolherConsulta aoFechar={aoFechar} />
          </>
        ) : (
        <>
        <p className="ajuda">
          {forca
            ? 'A palavra é o conceito das questões "Adivinhe o conceito". Os alunos entram pelo celular, só com um apelido, e votam numa letra; a mais votada entra. Quem souber a palavra pode digitá-la. Sem ranking: a turma joga junta, até 6 erros.'
            : 'Os alunos entram pelo celular (QR code ou código no projetor), só com um apelido, e respondem às questões.'}
        </p>
        <div className="linha-opcoes" role="tablist" style={{ marginBottom: 10 }}>
          <button role="tab" aria-selected={modo === 'assunto'} className={`botao pequeno${modo === 'assunto' ? ' escuro' : ''}`} onClick={() => setModo('assunto')}>
            Sortear por assunto
          </button>
          <button role="tab" aria-selected={modo === 'questionario'} className={`botao pequeno${modo === 'questionario' ? ' escuro' : ''}`} onClick={() => setModo('questionario')}>
            Questionário pronto
          </button>
        </div>
        {lista === null ? (
          <p className="ajuda">Carregando…</p>
        ) : modo === 'assunto' ? (
          banco.length === 0 ? (
            <p className="aviso">
              Nenhuma questão ainda. Cadastre em <strong>Atividades › Questões</strong>.
            </p>
          ) : (
            <div className="sorteio-assunto">
              <div className="campo">
                <label htmlFor="assunto-busca">Assunto</label>
                <input
                  id="assunto-busca"
                  className="busca-mat"
                  type="search"
                  placeholder="Procurar assunto…"
                  autoComplete="off"
                  value={buscaAssunto}
                  onChange={(e) => setBuscaAssunto(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter escolhe o primeiro assunto encontrado.
                    if (e.key === 'Enter' && encontrados[0]) {
                      e.preventDefault();
                      setAssunto(encontrados[0].assunto);
                    }
                  }}
                />
                <div className="lista-assuntos" role="listbox" aria-label="Assuntos" data-rolavel>
                  {encontrados.map((a) => (
                    <button
                      key={a.assunto}
                      type="button"
                      role="option"
                      aria-selected={assunto === a.assunto}
                      className={`opcao-assunto${assunto === a.assunto ? ' atual' : ''}`}
                      onClick={() => setAssunto(a.assunto)}
                    >
                      <span>{a.assunto}</span>
                      <span className="total">
                        {a.total} {a.total === 1 ? 'questão' : 'questões'}
                      </span>
                    </button>
                  ))}
                  {!buscaAssunto.trim() && (
                    <button type="button" role="option" aria-selected={assunto === '*'} className={`opcao-assunto${assunto === '*' ? ' atual' : ''}`} onClick={() => setAssunto('*')}>
                      <span>Todos os assuntos</span>
                      <span className="total">{doTipo.length} questões</span>
                    </button>
                  )}
                  {buscaAssunto.trim() && !encontrados.length && <p className="ajuda" style={{ margin: 6 }}>Nenhum assunto com "{buscaAssunto.trim()}".</p>}
                </div>
                {assuntos.length === 0 && (
                  <span className="ajuda">As questões ainda não têm assunto: cadastre em Atividades › Questões (campo "Assuntos").</span>
                )}
              </div>
              {!forca && (
              <div className="campo">
                <label htmlFor="tipos-jogo">Tipo de questão</label>
                <select id="tipos-jogo" className="seletor" value={tipos} onChange={(e) => setTipos(e.target.value as FiltroTipo)}>
                  <option value="todos">Todos os tipos</option>
                  <option value="alternativas">Só múltipla escolha e V/F</option>
                  <option value="conceito">Só "Adivinhe o conceito"</option>
                </select>
              </div>
              )}
              <div className="campo">
                <label htmlFor="quantas-jogo">{forca ? 'Quantas palavras' : 'Quantas questões'}</label>
                <div className="linha-opcoes">
                  {[5, 10, 15, 20].map((n) => (
                    <button key={n} type="button" className={`botao pequeno${quantas === n ? ' escuro' : ''}`} onClick={() => setQuantas(n)}>
                      {n}
                    </button>
                  ))}
                  <input
                    id="quantas-jogo"
                    type="number"
                    min={1}
                    max={200}
                    value={quantas}
                    onChange={(e) => setQuantas(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    style={{ width: 80 }}
                  />
                </div>
                <span className="ajuda" style={{ margin: 0 }}>
                  {forca
                    ? disponiveis < quantas
                      ? `Só há ${disponiveis} ${disponiveis === 1 ? 'conceito' : 'conceitos'} deste assunto: a forca terá ${vaiTer} ${vaiTer === 1 ? 'palavra' : 'palavras'}.`
                      : `Serão sorteadas ${vaiTer} palavras (conceitos), em ordem aleatória.`
                    : disponiveis < quantas
                      ? `Só há ${disponiveis} ${disponiveis === 1 ? 'questão' : 'questões'} deste assunto: o jogo terá ${vaiTer}.`
                      : `Serão sorteadas ${vaiTer} questões, em ordem aleatória.`}
                </span>
              </div>
            </div>
          )
        ) : lista.length === 0 ? (
          <p className="aviso">
            Nenhum questionário ainda. Crie um em <strong>Atividades › Questões</strong>.
          </p>
        ) : (
          <div className="lista-questionarios" role="radiogroup">
            {lista.map((q) => (
              <label key={q.id} className={`opcao-questionario${q.id === escolhido ? ' atual' : ''}`}>
                <input type="radio" name="questionario" checked={q.id === escolhido} disabled={forca ? !q.conceitos : !q.total} onChange={() => setEscolhido(q.id)} />
                <span>
                  <strong>{q.nome}</strong>
                  <span className="ajuda" style={{ margin: 0 }}>
                    {' '}
                    · {forca ? `${q.conceitos} ${q.conceitos === 1 ? 'conceito' : 'conceitos'} (as outras questões ficam de fora)` : `${q.total} ${q.total === 1 ? 'questão' : 'questões'}`}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        {lista !== null && forca && (
          <div className="campo tempos-jogo">
            <label htmlFor="tempo-voto">Tempo de cada votação de letra</label>
            <select id="tempo-voto" className="seletor" value={votoS} onChange={(e) => setVoto(Number(e.target.value))}>
              {OPCOES_VOTO_FORCA.map((t) => (
                <option key={t} value={t}>
                  {t} segundos{t === VOTO_PADRAO_FORCA ? ' (sugerido)' : ''}
                </option>
              ))}
            </select>
            <span className="ajuda" style={{ margin: 0 }}>Se todos votarem antes, a letra sai na hora.</span>
          </div>
        )}
        {lista !== null && !forca && (
          <div className="grade-2 tempos-jogo">
            {(modo !== 'assunto' || tipos !== 'conceito') && (
              <div className="campo">
                <label htmlFor="tempo-alt">Tempo — múltipla escolha e V/F</label>
                <SeletorTempo id="tempo-alt" valor={tempos.alternativas} aoMudar={(v) => setTempos({ ...tempos, alternativas: v })} />
              </div>
            )}
            {(modo !== 'assunto' || tipos !== 'alternativas') && (
              <div className="campo">
                <label htmlFor="tempo-conceito">Tempo — "Adivinhe o conceito"</label>
                <SeletorTempo id="tempo-conceito" valor={tempos.conceito} aoMudar={(v) => setTempos({ ...tempos, conceito: v })} />
              </div>
            )}
          </div>
        )}
        {!forca && (
          <label className="caixa-marcar">
            <input type="checkbox" checked={ranking} onChange={(ev) => setRanking(ev.target.checked)} />
            Ranking com pontos e pódio
          </label>
        )}
        <div className="modal-botoes">
          <button className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao primario" onClick={() => void abrir()} disabled={!podeAbrir}>
            Abrir a sala
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

/** Painel central durante o jogo (no lugar do material). */
export function PainelJogo({ ctl }: { ctl: ControladorAula }) {
  const j = useJogo();
  const [msgFundamento, setMsgFundamento] = useState<string | null>(null);
  useEffect(() => setMsgFundamento(null), [j.tela?.indice, j.tela?.fase]);
  const tela = j.tela;
  if (!tela) return null;
  const rotulo = rotuloAvancar(tela);

  const projetarFundamento = () => {
    const r = ctl.adicionarDigitado(j.fundamento);
    if (r.ok) ctl.projetar('mouse');
    setMsgFundamento(r.ok ? null : r.mensagem);
  };

  return (
    <section className="painel-material painel-jogo" data-ui>
      <div className="painel-material-topo">
        <strong className="painel-material-nome">{j.nome}</strong>
        <span className="espaco" />
        <span className={`status ${j.conexao === 'conectada' ? 'ok' : 'alerta pulsa'}`}>
          <span className="luz" /> {j.conexao === 'conectada' ? `sala ${tela.codigo}` : 'conectando…'}
        </span>
      </div>
      <div className="previa-jogo">
        <div className="jogo-quadro">
          <JogoTela jogo={tela} />
        </div>
      </div>
      <div className="painel-jogo-acoes">
        {rotulo && (
          <button className="botao primario" onClick={() => anfitriao().avancar()}>
            {rotulo}
          </button>
        )}
        {tela.fase === 'resultado' && j.fundamento && (
          <button className="botao" onClick={projetarFundamento} title="Projeta o dispositivo ao lado da questão">
            Projetar fundamento ({j.fundamento})
          </button>
        )}
        {tela.fase !== 'sala' && tela.fase !== 'fim' && (
          <button className={`botao${tela.qrGrande ? ' escuro' : ''}`} onClick={() => anfitriao().alternarQrGrande()} title="Mostra o QR code grande no meio do projetor, para quem chegou depois">
            {tela.qrGrande ? 'Esconder QR grande' : 'Mostrar QR grande'}
          </button>
        )}
        {tela.modo !== 'forca' && (
          <label className="caixa-marcar">
            <input type="checkbox" checked={tela.ranking} onChange={(ev) => anfitriao().definirRanking(ev.target.checked)} />
            Ranking e pódio
          </label>
        )}
        <span className="espaco" />
        <button
          className="botao"
          onClick={() => {
            if (tela.fase === 'fim') anfitriao().encerrar();
            else void confirmar({ titulo: 'Encerrar o jogo agora?', texto: 'Os alunos saem da sala.', botao: 'Encerrar' }).then((ok) => ok && anfitriao().encerrar());
          }}
        >
          Encerrar jogo
        </button>
      </div>
      {msgFundamento && <p className="digitar-msg erro">{msgFundamento}</p>}
      <p className="ajuda" style={{ margin: 0 }}>
        Clique esquerdo, Enter ou o passador avançam · clique direito recolhe o artigo projetado.
      </p>
    </section>
  );
}
