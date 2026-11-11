// Perguntas sobre o processo, no editor: pedir à IA, colar, ligar cada uma a um evento.
import { useEffect, useMemo, useState } from 'react';
import { confirmar } from '../comum/avisos';
import { irPara } from '../comum/navegacao';
import { db } from '../dados/db';
import { adicionarQuestoes, excluirQuestao } from '../jogo/banco';
import { importarQuestoes } from '../jogo/importar';
import type { Questao } from '../jogo/tipos';
import { assuntoDoProcesso, pedidoPerguntasIA, perguntasDoProcesso } from '../processo/perguntas';
import type { Processo } from '../processo/tipos';
import { copiar } from './ProcessoTexto';

const TIPO: Record<Questao['tipo'], string> = { multipla: 'múltipla escolha', vf: 'verdadeiro ou falso', conceito: 'adivinhe o conceito' };

export function EditorPerguntas({ p, aoMudou }: { p: Processo; aoMudou: () => void }) {
  const [lista, setLista] = useState<Questao[] | null>(null);
  const [ate, setAte] = useState(Math.max(1, p.eventos.length));
  const [quantas, setQuantas] = useState(5);
  const [tipos, setTipos] = useState<'todos' | 'alternativas' | 'conceito'>('todos');
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = () => void perguntasDoProcesso(p.id).then(setLista);
  useEffect(carregar, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lido = useMemo(() => (texto.trim() ? importarQuestoes(texto) : null), [texto]);
  const rotuloEvento = (id: string | null | undefined) => {
    const i = p.eventos.findIndex((e) => e.id === id);
    return i < 0 ? null : `${i + 1} · ${p.eventos[i].descricao || '(sem descrição)'}`;
  };
  const guardar = async () => {
    if (!lido?.questoes.length) return;
    const eventoId = p.eventos[ate - 1]?.id ?? null;
    const { questoes } = await adicionarQuestoes(lido.questoes, { pasta: 'Processos', etiquetas: [assuntoDoProcesso(p)] });
    await db.questoes.bulkPut(questoes.map((q) => ({ ...q, processoId: p.id, eventoId })));
    setTexto('');
    setMsg(`${questoes.length} ${questoes.length === 1 ? 'pergunta guardada' : 'perguntas guardadas'}, ligadas ao evento ${ate}.`);
    carregar();
    aoMudou();
  };
  const ligar = async (q: Questao, eventoId: string | null) => {
    await db.questoes.put({ ...q, eventoId, atualizado_em: new Date().toISOString() });
    carregar();
    aoMudou();
  };
  return (
    <div className="cartao perguntas-processo">
      <p className="ajuda" style={{ marginTop: 0 }}>
        Questões sobre <strong>este caso</strong>. Cada uma aparece na página da turma (para o aluno conferir sozinho) depois que o evento ligado a ela é liberado. Elas também ficam no banco de
        questões com o assunto <strong>“{assuntoDoProcesso(p)}”</strong>: dá para usar no <strong>jogo em sala</strong>, na <strong>forca</strong> e no <strong>treino em casa</strong>, sorteando por
        esse assunto.
      </p>

      <h3>Acrescentar perguntas</h3>
      {!p.eventos.length ? (
        <p className="aviso">Cadastre os eventos primeiro: as perguntas são sobre o que já aconteceu no processo.</p>
      ) : (
        <>
          <div className="linha-opcoes">
            <label htmlFor="perg-ate">Sobre o processo até o evento</label>
            <select id="perg-ate" className="seletor" value={ate} onChange={(e) => setAte(Number(e.target.value))}>
              {p.eventos.map((e, i) => (
                <option key={e.id} value={i + 1}>
                  {i + 1} · {e.descricao || '(sem descrição)'}
                </option>
              ))}
            </select>
            <select className="seletor" aria-label="Quantas" value={quantas} onChange={(e) => setQuantas(Number(e.target.value))}>
              {[3, 5, 8, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n} perguntas
                </option>
              ))}
            </select>
            <select className="seletor" aria-label="Tipos" value={tipos} onChange={(e) => setTipos(e.target.value as typeof tipos)}>
              <option value="todos">todos os tipos</option>
              <option value="alternativas">só múltipla escolha e V/F</option>
              <option value="conceito">só "Adivinhe o conceito"</option>
            </select>
            <button
              className="botao escuro"
              onClick={async () => setMsg((await copiar(pedidoPerguntasIA(p, { ate, quantas, tipos }))) ? 'Pedido copiado. Cole no Claude (ou outra IA), copie a resposta e cole no campo abaixo.' : 'Este navegador não deixou copiar.')}
            >
              Copiar o pedido para a IA
            </button>
          </div>
          <div className="campo">
            <label htmlFor="perg-colar">Cole as perguntas (da IA ou escritas por você, no formato das Questões)</label>
            <textarea id="perg-colar" rows={8} className="mono" value={texto} onChange={(e) => (setTexto(e.target.value), setMsg(null))} placeholder="1. No processo de Rogéria Silva, qual o prazo para a ré contestar?&#10;A) 5 dias&#10;B) 15 dias&#10;…&#10;Resposta: B" />
          </div>
          {lido && (
            <p className="ajuda">
              <strong>{lido.questoes.length}</strong> {lido.questoes.length === 1 ? 'pergunta entendida' : 'perguntas entendidas'}
              {lido.erros.length > 0 && ` · ${lido.erros.length} com problema: ${lido.erros.map((e) => `questão ${e.numero} (${e.mensagem})`).join('; ')}`}
            </p>
          )}
          <button className="botao primario" disabled={!lido?.questoes.length} onClick={() => void guardar()}>
            {lido?.questoes.length ? `Guardar ${lido.questoes.length} ${lido.questoes.length === 1 ? 'pergunta' : 'perguntas'} (aparecem a partir do evento ${ate})` : 'Guardar'}
          </button>
          {msg && <p className="ajuda">{msg}</p>}
        </>
      )}

      <h3>Perguntas deste processo ({lista?.length ?? 0})</h3>
      {lista === null ? (
        <p className="ajuda">Carregando…</p>
      ) : !lista.length ? (
        <p className="ajuda">Nenhuma ainda.</p>
      ) : (
        <ol className="perguntas-lista">
          {lista.map((q) => (
            <li key={q.id}>
              <div>
                <strong>{q.tipo === 'conceito' ? `Conceito: ${q.enunciado}` : q.enunciado}</strong>
                <span className="ajuda" style={{ margin: 0 }}>
                  {' '}
                  · {TIPO[q.tipo]}
                </span>
              </div>
              <div className="linha-opcoes">
                <select className="seletor" aria-label="Aparece a partir do evento" value={q.eventoId && rotuloEvento(q.eventoId) ? q.eventoId : ''} onChange={(e) => void ligar(q, e.target.value || null)}>
                  <option value="">desde o início</option>
                  {p.eventos.map((e, i) => (
                    <option key={e.id} value={e.id}>
                      a partir do evento {i + 1} · {e.descricao || '(sem descrição)'}
                    </option>
                  ))}
                </select>
                <button
                  className="botao pequeno"
                  onClick={async () => {
                    if (!(await confirmar({ titulo: 'Apagar esta pergunta?', texto: 'Ela sai do processo e do banco de questões.', botao: 'Apagar', perigo: true }))) return;
                    await excluirQuestao(q.id);
                    carregar();
                    aoMudou();
                  }}
                >
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="ajuda">
        Para corrigir o texto de uma pergunta, use{' '}
        <button className="link-discreto" onClick={() => irPara('questoes')}>
          Atividades › Questões
        </button>{' '}
        (filtre pelo assunto “{assuntoDoProcesso(p)}”).
      </p>
    </div>
  );
}
