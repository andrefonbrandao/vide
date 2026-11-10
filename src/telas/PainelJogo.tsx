// Jogo de perguntas na tela do professor: escolher o questionário e conduzir o jogo.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { anfitriao, rankingPreferido } from '../jogo/anfitriao';
import { assuntosDasQuestoes, listarQuestionarios, listarQuestoes, questoesDo, sortearQuestoes, type FiltroTipo } from '../jogo/banco';
import { rotuloAvancar } from '../jogo/motor';
import { OPCOES_VOTO_FORCA, VOTO_PADRAO_FORCA, type Questao, type QuestaoJogo, type Questionario } from '../jogo/tipos';
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

/** Janela para abrir a sala: sorteio por assunto ou um questionário pronto. */
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

  return (
    <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-label="Atividades">
        <h2>Atividades</h2>
        <div className="linha-opcoes" role="tablist" aria-label="Que jogo" style={{ marginBottom: 6 }}>
          <button role="tab" aria-selected={jogo === 'perguntas'} className={`botao${jogo === 'perguntas' ? ' escuro' : ''}`} onClick={() => setJogo('perguntas')}>
            Jogo de perguntas
          </button>
          <button role="tab" aria-selected={forca} className={`botao${forca ? ' escuro' : ''}`} onClick={() => setJogo('forca')}>
            Forca (a turma toda)
          </button>
          <button role="tab" aria-selected={jogo === 'consulta'} className={`botao${jogo === 'consulta' ? ' escuro' : ''}`} onClick={() => setJogo('consulta')}>
            Consulta (em grupo)
          </button>
          <button role="tab" aria-selected={jogo === 'processo'} className={`botao${jogo === 'processo' ? ' escuro' : ''}`} onClick={() => setJogo('processo')}>
            Processo da turma
          </button>
        </div>
        {jogo === 'processo' ? (
          <>
            <p className="ajuda">Projeta o processo fictício como a turma vê. Você abre as peças e libera eventos durante a aula.</p>
            <EscolherProcesso aoFechar={aoFechar} />
          </>
        ) : jogo === 'consulta' ? (
          <>
            <p className="ajuda">
              Um personagem conta um caso em balões no projetor. A turma discute em grupo e, no fim do tempo, o advogado ou o juiz responde. Não usa celular.
            </p>
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
              Nenhuma questão ainda. Cadastre em <strong>Acervo › Questões</strong>.
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
                  <span className="ajuda">As questões ainda não têm assunto: cadastre em Acervo › Questões (campo "Assuntos").</span>
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
            Nenhum questionário ainda. Crie um em <strong>Acervo › Questões</strong>.
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
            if (tela.fase === 'fim' || confirm('Encerrar o jogo agora? Os alunos saem da sala.')) anfitriao().encerrar();
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
