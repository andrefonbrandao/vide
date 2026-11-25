// "Questões para debate" na tela do professor (no lugar do material): a prévia da projeção,
// riscar alternativas, dicas, revelar a resposta, anterior/próxima e projetar o fundamento.
import { useState, useSyncExternalStore } from 'react';
import { confirmar } from '../comum/avisos';
import { debate, rotuloAvancarDebate } from '../debate/apresentador';
import { DebateTela } from './DebateTela';
import type { ControladorAula } from './controlador';

export function useDebate() {
  const d = debate();
  return useSyncExternalStore(d.assinar, d.obter);
}

export function PainelDebate({ ctl }: { ctl: ControladorAula }) {
  const { tela } = useDebate();
  const [msg, setMsg] = useState<string | null>(null);
  if (!tela) return null;
  const d = debate();
  const rotulo = rotuloAvancarDebate(tela);
  const q = tela.questao;
  const projetarFundamento = () => {
    const r = ctl.adicionarDigitado(q.fundamento);
    if (r.ok) ctl.projetar('mouse');
    setMsg(r.ok ? null : r.mensagem);
  };
  return (
    <section className="painel-material painel-jogo" data-ui>
      <div className="painel-material-topo">
        <strong className="painel-material-nome">{tela.nome}</strong>
        <span className="espaco" />
        <span className="ajuda" style={{ margin: 0 }}>
          sem celular · sem relógio
        </span>
      </div>
      <div className="previa-jogo">
        <div className="jogo-quadro">
          <DebateTela tela={tela} aoRiscar={!tela.fim && q.tipo !== 'conceito' ? (i) => d.riscar(i) : undefined} />
        </div>
      </div>
      <div className="painel-jogo-acoes">
        <button className="botao" onClick={() => d.voltar()} disabled={tela.indice === 0 && !tela.fim} title="Volta à questão anterior (seta para a esquerda)">
          ‹ Anterior
        </button>
        {rotulo && (
          <button className="botao primario" onClick={() => d.avancar()}>
            {rotulo}
          </button>
        )}
        {tela.revelada && !tela.fim && (
          <button className="botao" onClick={() => d.ocultarResposta()} title="Esconde a resposta para retomar a discussão">
            Esconder a resposta
          </button>
        )}
        {tela.revelada && !tela.fim && q.fundamento && (
          <button className="botao" onClick={projetarFundamento} title="Projeta o dispositivo ao lado da questão">
            Projetar o fundamento ({q.fundamento})
          </button>
        )}
        <span className="espaco" />
        <button className="botao" onClick={() => (tela.fim ? d.encerrar() : void confirmar({ titulo: 'Encerrar as questões para debate?', botao: 'Encerrar' }).then((ok) => ok && d.encerrar()))}>
          Encerrar
        </button>
      </div>
      {msg && <p className="digitar-msg erro">{msg}</p>}
      {!tela.revelada && !tela.fim && (
        <details className="consulta-cola">
          <summary>Ver a resposta (só na sua tela)</summary>
          <p>
            {q.tipo === 'conceito' ? (
              <>
                <strong>Conceito:</strong> {q.enunciado}
              </>
            ) : (
              <>
                <strong>Correta:</strong> {q.tipo === 'vf' ? (q.correta === 0 ? 'Verdadeiro' : 'Falso') : `${String.fromCharCode(65 + q.correta)}) ${q.alternativas[q.correta]}`}
              </>
            )}
            {q.fundamento && <span className="ajuda"> · Fundamento: {q.fundamento}</span>}
          </p>
        </details>
      )}
      <p className="ajuda" style={{ margin: 0 }}>
        {q.tipo === 'conceito' ? 'Enter, clique ou o passador mostram a próxima dica e depois o conceito' : 'Clique numa alternativa para riscá-la (a turma descartou); clique de novo para desfazer'} · seta para a
        esquerda volta.
      </p>
    </section>
  );
}
