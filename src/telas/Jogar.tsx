// Página do aluno no jogo de perguntas (abre pelo QR code ou em /j).
// Sem cadastro: só um apelido. O celular guarda o apelido e uma senha aleatória
// apenas para voltar ao jogo se a página recarregar; tudo é apagado no fim.
import { useEffect, useRef, useState } from 'react';
import { Logo } from '../comum/Logo';
import { ConexaoSala } from '../remoto/conexao';
import type { DoAluno, ParaAluno } from '../jogo/protocolo';
import { gerarToken } from '../jogo/protocolo';
import { LETRAS } from '../jogo/tipos';
import { Forma } from './JogoTela';

type Retrato = Extract<ParaAluno, { t: 'jogo' }>;

interface Guardado {
  codigo: string;
  token: string;
  apelido: string;
}

const CHAVE = 'vide.jogo';

function lerGuardado(): Guardado | null {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Guardado | null;
    return g?.codigo && g.token ? g : null;
  } catch {
    return null;
  }
}

function guardar(g: Guardado | null) {
  try {
    if (g) localStorage.setItem(CHAVE, JSON.stringify(g));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* ignore */
  }
}

export function Jogar({ codigoInicial }: { codigoInicial: string }) {
  const anterior = lerGuardado();
  const [codigo, setCodigo] = useState(codigoInicial);
  const [digitado, setDigitado] = useState(codigoInicial);
  const [apelido, setApelido] = useState(anterior?.codigo === codigoInicial ? anterior.apelido : '');
  const [entrou, setEntrou] = useState(false);
  const [status, setStatus] = useState<'conectando' | 'conectada' | 'desconectada'>('desconectada');
  const [naoAchou, setNaoAchou] = useState(false);
  const [professorOn, setProfessorOn] = useState(true);
  const [retrato, setRetrato] = useState<Retrato | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  const [prazoLocal, setPrazoLocal] = useState(0);
  const [duracao, setDuracao] = useState(1);
  /** Conceito: quando chega a próxima dica e quando pode tentar de novo (relógio deste celular). */
  const [proximaDicaEm, setProximaDicaEm] = useState<number | null>(null);
  const [liberaEm, setLiberaEm] = useState(0);
  const [textoResposta, setTextoResposta] = useState('');
  const [enviandoTexto, setEnviandoTexto] = useState(false);
  /** Conceito: o último texto enviado (para mostrar "'x' não é a resposta"). */
  const [ultimoEnviado, setUltimoEnviado] = useState('');
  const indiceRef = useRef(-1);
  const [agora, setAgora] = useState(Date.now());
  const salaRef = useRef<ConexaoSala<ParaAluno, DoAluno> | null>(null);
  const jaConectouRef = useRef(false);

  useEffect(() => {
    document.title = 'Vide — jogo';
  }, []);

  // Voltando ao mesmo jogo (página recarregada): entra de novo sozinho.
  useEffect(() => {
    if (anterior && anterior.codigo === codigoInicial && anterior.apelido) conectar(anterior.codigo, anterior.apelido, anterior.token);
    return () => salaRef.current?.fechar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (retrato?.fase !== 'pergunta') return;
    const t = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [retrato?.fase, retrato?.indice]);

  function conectar(cod: string, nome: string, token = gerarToken()) {
    salaRef.current?.fechar();
    jaConectouRef.current = false;
    setNaoAchou(false);
    setEntrou(true);
    guardar({ codigo: cod, token, apelido: nome });
    const sala = new ConexaoSala<ParaAluno, DoAluno>(
      cod,
      'aluno',
      (m) => {
        if (m.t === 'jogo') {
          setRetrato(m);
          if (m.pergunta) {
            setPrazoLocal(Date.now() + m.pergunta.restanteMs);
            if (indiceRef.current !== m.indice) {
              indiceRef.current = m.indice;
              setDuracao(Math.max(1, m.pergunta.restanteMs));
              setTextoResposta('');
            }
            setProximaDicaEm(m.pergunta.proximaDicaMs == null ? null : Date.now() + m.pergunta.proximaDicaMs);
          }
          setLiberaEm(m.voce?.aguardarMs ? Date.now() + m.voce.aguardarMs : 0);
          setEnviandoTexto(false);
        } else if (m.t === 'tentativa') {
          setEnviandoTexto(false);
          if (m.resultado === 'certo' && navigator.vibrate) navigator.vibrate([30, 40, 30]);
        } else if (m.t === 'anfitriao') setProfessorOn(m.on);
        else if (m.t === 'recusado') {
          setFim(m.motivo);
          sala.fechar();
          guardar(null);
        } else if (m.t === 'encerrado') {
          setFim('O jogo terminou. Obrigado por participar!');
          sala.fechar();
          guardar(null);
        }
      },
      (s, tentativas) => {
        setStatus(s);
        if (s === 'conectada') {
          jaConectouRef.current = true;
          setNaoAchou(false);
          sala.enviar({ t: 'entrar', apelido: nome });
        } else if (s === 'desconectada' && !jaConectouRef.current && tentativas >= 2) {
          setNaoAchou(true);
        }
      },
      { rota: 'jogo', extras: { token } },
    );
    salaRef.current = sala;
  }

  const responder = (alt: number) => {
    if (!retrato?.pergunta || retrato.voce?.resposta != null) return;
    salaRef.current?.enviar({ t: 'responder', indice: retrato.indice, alt });
    // Mostra a escolha na hora; a confirmação vem do professor.
    setRetrato({ ...retrato, voce: retrato.voce ? { ...retrato.voce, resposta: alt } : retrato.voce });
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const sair = () => {
    salaRef.current?.fechar();
    guardar(null);
    setEntrou(false);
    setRetrato(null);
  };

  // ---------- telas ----------
  const topo = (
    <header className="jogar-topo">
      <Logo altura={24} />
      {retrato?.voce && (
        <span className="chip ok">
          {retrato.voce.apelido}
          {retrato.ranking ? ` · ${retrato.voce.pontos} pts` : ''}
        </span>
      )}
    </header>
  );

  if (fim) {
    return (
      <div className="jogar">
        {topo}
        <div className="jogar-centro">
          <p className="jogar-grande">{fim}</p>
          {retrato?.voce && retrato.fase === 'fim' && <Final r={retrato} />}
        </div>
      </div>
    );
  }

  if (!codigo) {
    return (
      <div className="jogar">
        {topo}
        <form
          className="jogar-centro"
          onSubmit={(ev) => {
            ev.preventDefault();
            const c = digitado.replace(/\D/g, '');
            if (c.length === 6) {
              setCodigo(c);
              history.replaceState(null, '', `/j/${c}`);
            }
          }}
        >
          <label className="jogar-rotulo" htmlFor="codigo">
            Código do jogo
          </label>
          <input
            id="codigo"
            className="jogar-campo jogar-codigo"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            placeholder="000000"
            value={digitado}
            onChange={(ev) => setDigitado(ev.target.value)}
            autoFocus
          />
          <button className="botao-grande primario" disabled={digitado.replace(/\D/g, '').length !== 6}>
            Continuar
          </button>
        </form>
      </div>
    );
  }

  if (!entrou) {
    return (
      <div className="jogar">
        {topo}
        <form
          className="jogar-centro"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (apelido.trim()) conectar(codigo, apelido.trim());
          }}
        >
          <p className="jogar-rotulo">Jogo {codigo}</p>
          <label className="jogar-rotulo" htmlFor="apelido">
            Como quer aparecer?
          </label>
          <input
            id="apelido"
            className="jogar-campo"
            maxLength={30}
            autoComplete="nickname"
            placeholder="Seu apelido ou nome"
            value={apelido}
            onChange={(ev) => setApelido(ev.target.value)}
            autoFocus
          />
          <button className="botao-grande primario" disabled={!apelido.trim()}>
            Entrar no jogo
          </button>
        </form>
      </div>
    );
  }

  if (naoAchou && !retrato) {
    return (
      <div className="jogar">
        {topo}
        <div className="jogar-centro">
          <p className="jogar-grande">Não encontramos o jogo {codigo}.</p>
          <p className="ajuda">Confira o código no projetor. Se o professor ainda não abriu a sala, aguarde: tentamos de novo sozinhos.</p>
          <button
            className="botao-grande"
            onClick={() => {
              sair();
              setCodigo('');
              setDigitado('');
              history.replaceState(null, '', '/j');
            }}
          >
            Digitar outro código
          </button>
        </div>
      </div>
    );
  }

  const aviso =
    status !== 'conectada' ? 'Reconectando…' : !professorOn ? 'Aguardando o computador do professor…' : null;

  if (!retrato || !retrato.voce) {
    return (
      <div className="jogar">
        {topo}
        <div className="jogar-centro">
          <p className="jogar-grande">Entrando…</p>
          {aviso && <p className="ajuda">{aviso}</p>}
        </div>
      </div>
    );
  }

  const v = retrato.voce;
  const p = retrato.pergunta;

  return (
    <div className="jogar">
      {topo}
      {aviso && <div className="aviso">{aviso}</div>}

      {retrato.fase === 'sala' && (
        <div className="jogar-centro">
          <p className="jogar-grande">Você está dentro, {v.apelido}!</p>
          <p className="ajuda">Olhe para o projetor: o jogo começa quando o professor quiser.</p>
        </div>
      )}

      {retrato.fase === 'pergunta' && p && (
        <div className="jogar-pergunta">
          <div className="jogar-info">
            <span>
              Questão {retrato.indice + 1} de {retrato.total}
            </span>
            <span className="jogar-tempo">{Math.ceil(Math.max(0, prazoLocal - agora) / 1000)}s</span>
          </div>
          <div className="jogar-barra-tempo">
            <span style={{ width: `${Math.max(0, Math.min(100, ((prazoLocal - agora) / duracao) * 100))}%` }} />
          </div>
          {p.tipo === 'conceito' ? (
            <>
              <p className="jogar-enunciado">Quem sou eu?</p>
              <ol className="jogar-dicas">
                {(p.dicas ?? []).map((d, i) => (
                  <li key={i} className={i === (p.dicas?.length ?? 0) - 1 ? 'nova' : ''}>
                    <span className="jogar-dica-num">Dica {i + 1}</span> {d}
                  </li>
                ))}
              </ol>
              {proximaDicaEm !== null && v.resposta == null && (
                <p className="ajuda" style={{ margin: 0 }}>
                  Próxima dica em {Math.max(0, Math.ceil((proximaDicaEm - agora) / 1000))} s
                </p>
              )}
              {v.resposta != null ? (
                <p className="jogar-resultado certo">Acertou! Aguarde o fim da rodada.</p>
              ) : (
                <form
                  className="jogar-form-conceito"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    const t = textoResposta.trim();
                    if (!t || agora < liberaEm || enviandoTexto) return;
                    setEnviandoTexto(true);
                    setUltimoEnviado(t);
                    salaRef.current?.enviar({ t: 'responder-texto', indice: retrato.indice, texto: t });
                  }}
                >
                  <input
                    className="jogar-campo"
                    value={textoResposta}
                    onChange={(e) => setTextoResposta(e.target.value)}
                    placeholder="Sua resposta"
                    maxLength={120}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="send"
                    aria-label="Sua resposta"
                  />
                  <button className="botao-grande primario" disabled={!textoResposta.trim() || agora < liberaEm || enviandoTexto}>
                    {agora < liberaEm ? `Aguarde ${Math.ceil((liberaEm - agora) / 1000)} s` : 'Responder'}
                  </button>
                  {v.errou && (
                    <p className="jogar-errou">
                      {ultimoEnviado ? <>“{ultimoEnviado}” não é a resposta. </> : 'Não é a resposta. '}
                      {agora < liberaEm ? `Tente de novo em ${Math.ceil((liberaEm - agora) / 1000)} s.` : 'Tente outra resposta.'}
                    </p>
                  )}
                </form>
              )}
            </>
          ) : (
          <>
          <p className="jogar-enunciado">{p.enunciado}</p>
          <div className="jogar-alternativas">
            {p.alternativas.map((a, i) => (
              <button
                key={i}
                className={`jogar-alt${v.resposta === i ? ' escolhida' : ''}${v.resposta != null && v.resposta !== i ? ' apagada' : ''}`}
                onClick={() => responder(i)}
                disabled={v.resposta != null}
              >
                <span className="jogar-alt-marca">
                  <Forma i={i} />
                  <b>{LETRAS[i]}</b>
                </span>
                <span>{a}</span>
              </button>
            ))}
          </div>
          {v.resposta != null && <p className="jogar-enviada">Resposta enviada. Aguarde o resultado.</p>}
          </>
          )}
        </div>
      )}

      {(retrato.fase === 'resultado' || retrato.fase === 'ranking') && (
        <div className="jogar-centro">
          <p className={`jogar-resultado ${v.acertou ? 'certo' : 'errado'}`}>
            {v.acertou ? 'Acertou!' : v.resposta == null && !retrato.conceito ? 'Sem resposta' : 'Não foi dessa vez'}
          </p>
          {retrato.ranking && v.acertou && <p className="jogar-grande">+{v.ganho} pontos</p>}
          {retrato.conceito ? (
            <>
              {!v.acertou && v.digitou && (
                <p className="jogar-digitou">
                  Você digitou: <strong>{v.digitou}</strong>
                </p>
              )}
              <p className="jogar-posicao">
                Resposta: <strong>{retrato.conceito}</strong>
              </p>
            </>
          ) : (
            retrato.correta != null && (
              <p className="ajuda">
                Resposta correta: <strong>{LETRAS[retrato.correta]}</strong>
              </p>
            )
          )}
          {retrato.ranking && v.posicao != null && (
            <p className="jogar-posicao">
              Você está em <strong>{v.posicao}º</strong> · {v.pontos} pts
            </p>
          )}
        </div>
      )}

      {retrato.fase === 'fim' && (
        <div className="jogar-centro">
          <Final r={retrato} />
          <button className="botao-grande" onClick={sair}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

function Final({ r }: { r: Retrato }) {
  const v = r.voce!;
  return (
    <>
      <p className="jogar-grande">Fim do jogo!</p>
      {r.ranking && v.posicao != null ? (
        <p className="jogar-posicao">
          Você ficou em <strong>{v.posicao}º</strong> com {v.pontos} pontos.
        </p>
      ) : null}
      <p className="ajuda">
        Você acertou {v.acertos} de {r.total} {r.total === 1 ? 'questão' : 'questões'}.
      </p>
    </>
  );
}
