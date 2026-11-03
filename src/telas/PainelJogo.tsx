// Jogo de perguntas na tela do professor: escolher o questionário e conduzir o jogo.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { anfitriao, rankingPreferido } from '../jogo/anfitriao';
import { listarQuestionarios, questoesDo } from '../jogo/banco';
import { rotuloAvancar } from '../jogo/motor';
import type { Questionario } from '../jogo/tipos';
import { JogoTela } from './JogoTela';
import type { ControladorAula } from './controlador';

export function useJogo() {
  const a = anfitriao();
  return useSyncExternalStore(a.assinar, a.obter);
}

/** Janela para escolher o questionário e abrir a sala. */
export function IniciarJogo({ aoFechar }: { aoFechar: () => void }) {
  const [lista, setLista] = useState<(Questionario & { total: number })[] | null>(null);
  const [escolhido, setEscolhido] = useState<string>('');
  const [ranking, setRanking] = useState(rankingPreferido());

  useEffect(() => {
    void (async () => {
      const qs = await listarQuestionarios();
      const comTotal = await Promise.all(qs.map(async (q) => ({ ...q, total: (await questoesDo(q)).length })));
      setLista(comTotal);
      setEscolhido(comTotal.find((q) => q.total > 0)?.id ?? '');
    })();
  }, []);

  const abrir = async () => {
    const q = lista?.find((x) => x.id === escolhido);
    if (!q) return;
    const questoes = await questoesDo(q);
    anfitriao().iniciar(
      q.nome,
      questoes.map(({ tipo, enunciado, alternativas, correta, tempo, explicacao, fundamento }) => ({
        tipo,
        enunciado,
        alternativas,
        correta,
        tempo,
        explicacao,
        fundamento,
      })),
      ranking,
    );
    aoFechar();
  };

  return (
    <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-label="Jogo de perguntas">
        <h2>Jogo de perguntas</h2>
        <p className="ajuda">
          Os alunos entram pelo celular (QR code ou código no projetor), só com um apelido, e respondem às questões.
        </p>
        {lista === null ? (
          <p className="ajuda">Carregando…</p>
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
          <button className="botao primario" onClick={() => void abrir()} disabled={!escolhido}>
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
