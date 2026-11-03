// Jogo de perguntas na tela do professor: escolher o questionário e conduzir o jogo.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { anfitriao, rankingPreferido } from '../jogo/anfitriao';
import { assuntosDasQuestoes, listarQuestionarios, listarQuestoes, questoesDo, sortearQuestoes } from '../jogo/banco';
import { rotuloAvancar } from '../jogo/motor';
import type { Questao, QuestaoJogo, Questionario } from '../jogo/tipos';
import { JogoTela } from './JogoTela';
import type { ControladorAula } from './controlador';

export function useJogo() {
  const a = anfitriao();
  return useSyncExternalStore(a.assinar, a.obter);
}

type Modo = 'assunto' | 'questionario';
const CHAVE_MODO = 'vide.jogoModo';

function paraJogo(q: Questao): QuestaoJogo {
  const { tipo, enunciado, alternativas, correta, tempo, explicacao, fundamento } = q;
  return { tipo, enunciado, alternativas, correta, tempo, explicacao, fundamento };
}

/** Janela para abrir a sala: sorteio por assunto ou um questionário pronto. */
export function IniciarJogo({ aoFechar }: { aoFechar: () => void }) {
  const [lista, setLista] = useState<(Questionario & { total: number })[] | null>(null);
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
      const comTotal = await Promise.all(qs.map(async (q) => ({ ...q, total: (await questoesDo(q)).length })));
      setLista(comTotal);
      setBanco(todas);
      setEscolhido(comTotal.find((q) => q.total > 0)?.id ?? '');
      setAssunto(assuntosDasQuestoes(todas)[0]?.assunto ?? '*');
    })();
  }, []);

  const assuntos = assuntosDasQuestoes(banco);
  const disponiveis = assunto === '*' ? banco.length : (assuntos.find((a) => a.assunto === assunto)?.total ?? 0);
  const vaiTer = Math.min(quantas, disponiveis);

  const abrir = async () => {
    if (modo === 'assunto') {
      const sorteadas = sortearQuestoes(banco, assunto === '*' ? null : assunto, quantas);
      if (!sorteadas.length) return;
      const nome = `${sorteadas.length} ${sorteadas.length === 1 ? 'questão' : 'questões'} · ${assunto === '*' ? 'todos os assuntos' : assunto}`;
      anfitriao().iniciar(nome, sorteadas.map(paraJogo), ranking);
    } else {
      const q = lista?.find((x) => x.id === escolhido);
      if (!q) return;
      anfitriao().iniciar(q.nome, (await questoesDo(q)).map(paraJogo), ranking);
    }
    aoFechar();
  };

  const podeAbrir = modo === 'assunto' ? vaiTer > 0 : !!escolhido;

  return (
    <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-label="Atividades">
        <h2>Atividades</h2>
        <p className="jogar-rotulo" style={{ margin: '-6px 0 6px', fontSize: 15 }}>Jogo de perguntas</p>
        <p className="ajuda">
          Os alunos entram pelo celular (QR code ou código no projetor), só com um apelido, e respondem às questões.
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
                <label htmlFor="assunto-jogo">Assunto</label>
                <select id="assunto-jogo" className="seletor" value={assunto} onChange={(e) => setAssunto(e.target.value)}>
                  {assuntos.map((a) => (
                    <option key={a.assunto} value={a.assunto}>
                      {a.assunto} ({a.total} {a.total === 1 ? 'questão' : 'questões'})
                    </option>
                  ))}
                  <option value="*">Todos os assuntos ({banco.length})</option>
                </select>
                {assuntos.length === 0 && (
                  <span className="ajuda">As questões ainda não têm assunto: cadastre em Acervo › Questões (campo "Assuntos").</span>
                )}
              </div>
              <div className="campo">
                <label htmlFor="quantas-jogo">Quantas questões</label>
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
                  {disponiveis < quantas
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
                <input type="radio" name="questionario" checked={q.id === escolhido} disabled={!q.total} onChange={() => setEscolhido(q.id)} />
                <span>
                  <strong>{q.nome}</strong>
                  <span className="ajuda" style={{ margin: 0 }}>
                    {' '}
                    · {q.total} {q.total === 1 ? 'questão' : 'questões'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        <label className="caixa-marcar">
          <input type="checkbox" checked={ranking} onChange={(ev) => setRanking(ev.target.checked)} />
          Ranking com pontos e pódio
        </label>
        <div className="modal-botoes">
          <button className="botao" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao primario" onClick={() => void abrir()} disabled={!podeAbrir}>
            Abrir a sala
          </button>
        </div>
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
        <label className="caixa-marcar">
          <input type="checkbox" checked={tela.ranking} onChange={(ev) => anfitriao().definirRanking(ev.target.checked)} />
          Ranking e pódio
        </label>
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
