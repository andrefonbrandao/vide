// "Questões para debate" como aparece no projetor (e na prévia da tela do professor):
// sem relógio, sem QR e sem pontos. Medidas em "cqw" (porcentagem da largura do quadro).
import type { TelaDebate } from '../debate/apresentador';
import { LETRAS } from '../jogo/tipos';
import { Cabe } from './JogoTela';

export function DebateTela({ tela, aoRiscar }: { tela: TelaDebate; aoRiscar?: (i: number) => void }) {
  if (tela.fim)
    return (
      <div className="jogo-tela deb deb-fim">
        <p className="jogo-rotulo">{tela.nome}</p>
        <strong>Fim do debate</strong>
        <span>
          {tela.total} {tela.total === 1 ? 'questão' : 'questões'}
        </span>
      </div>
    );
  const q = tela.questao;
  const chave = `${tela.indice}-${tela.revelada}-${tela.dicasVisiveis}-${tela.riscadas.join(',')}`;
  return (
    <div className="jogo-tela deb">
      <p className="jogo-rotulo">
        Questão {tela.indice + 1} de {tela.total}
        {q.tipo === 'conceito' ? ' · Adivinhe o conceito' : ''}
      </p>
      {q.tipo === 'conceito' ? (
        <>
          <div className="deb-corpo deb-conceito">
            <Cabe chave={chave}>
              <ol className="deb-dicas">
                {q.dicas.slice(0, Math.max(tela.dicasVisiveis, tela.revelada ? q.dicas.length : 0)).map((d, k) => (
                  <li key={k}>{d}</li>
                ))}
              </ol>
              {tela.revelada && (
                <div className="deb-resposta">
                  <span className="deb-rotulo-resp">O conceito</span>
                  <strong className="deb-conceito-nome">{q.enunciado}</strong>
                  {q.explicacao && <p>{q.explicacao}</p>}
                </div>
              )}
            </Cabe>
          </div>
        </>
      ) : (
        <div className="deb-corpo">
          <Cabe chave={chave}>
            <p className="deb-enunciado">{q.enunciado}</p>
            <ul className="deb-alts">
              {q.alternativas.map((a, k) => {
                const certa = tela.revelada && k === q.correta;
                const riscada = tela.riscadas.includes(k);
                const classe = `deb-alt${riscada ? ' riscada' : ''}${certa ? ' certa' : ''}${tela.revelada && !certa ? ' apagada' : ''}${aoRiscar ? ' clicavel' : ''}`;
                return (
                  <li key={k} className={classe} onClick={aoRiscar ? () => aoRiscar(k) : undefined} title={aoRiscar ? (riscada ? 'Desfazer o risco' : 'Riscar (a turma descartou)') : undefined}>
                    <span className="deb-letra">{q.tipo === 'vf' ? (k === 0 ? 'V' : 'F') : (LETRAS[k] ?? String.fromCharCode(65 + k))}</span>
                    <span className="deb-alt-texto">{a}</span>
                    {certa && <span className="deb-check">✓</span>}
                  </li>
                );
              })}
            </ul>
            {tela.revelada && (q.explicacao || q.fundamento) && (
              <div className="deb-resposta">
                {q.explicacao && <p>{q.explicacao}</p>}
                {q.fundamento && <span className="deb-fundamento">Fundamento: {q.fundamento}</span>}
              </div>
            )}
          </Cabe>
        </div>
      )}
    </div>
  );
}
