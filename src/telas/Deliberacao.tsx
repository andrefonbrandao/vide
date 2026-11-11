// Processo colaborativo: o painel da deliberação da turma (no editor e na Aula).
// O professor anota os pontos, copia o pedido para a IA e cola a resposta (os novos eventos).
import { useEffect, useRef, useState } from 'react';
import { comEventosDaDeliberacao, comPonto, deliberacaoAberta, mudarAberta, pedidoProximoAtoIA } from '../processo/deliberacao';
import { semSiglasRepetidas } from '../processo/siglas';
import type { Processo } from '../processo/tipos';
import { ColarEventos, copiar } from './ProcessoTexto';

const ATOS = ['CONTESTAÇÃO', 'RÉPLICA', 'DECISÃO DE SANEAMENTO E ORGANIZAÇÃO', 'DECISÃO INTERLOCUTÓRIA', 'SENTENÇA', 'APELAÇÃO', 'CONTRARRAZÕES DE APELAÇÃO', 'EMENDA À INICIAL', 'ALEGAÇÕES FINAIS'];

const ROTULO_ORIGEM = { professor: '', votacao: 'votação', vicio: 'vício' } as const;

export function PainelDeliberacao({ p: externo, aoMudar: gravar, noAula = false }: { p: Processo; aoMudar: (p: Processo) => void; noAula?: boolean }) {
  // Na aula, gravar demora um pouco: o painel guarda a cópia local e grava com uma pausa
  // (assim nenhuma letra digitada se perde).
  const [p, setP] = useState(externo);
  useEffect(() => {
    if (!noAula) setP(externo);
  }, [externo, noAula]);
  const pausa = useRef(0);
  const pendente = useRef<Processo | null>(null);
  useEffect(
    () => () => {
      window.clearTimeout(pausa.current);
      if (pendente.current) gravar(pendente.current);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const aoMudar = (n: Processo, jah = false) => {
    setP(n);
    if (!noAula) return gravar(n);
    window.clearTimeout(pausa.current);
    pendente.current = n;
    const enviar = () => {
      pendente.current = null;
      gravar(n);
    };
    if (jah) enviar();
    else pausa.current = window.setTimeout(enviar, 500);
  };
  const [novo, setNovo] = useState('');
  const [colando, setColando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const aberta = deliberacaoAberta(p);
  const anteriores = (p.deliberacoes ?? []).filter((d) => d.eventos?.length);
  const anotar = () => {
    if (!novo.trim()) return;
    aoMudar(comPonto(p, novo));
    setNovo('');
  };
  return (
    <div className="deliberacao">
      <p className="ajuda" style={{ marginTop: 0 }}>
        Anote o que a turma decidiu sobre o último ato. Os resultados das votações "E agora?" e os vícios que você mostrar na aula entram sozinhos. Depois, peça à IA o próximo ato e cole a
        resposta aqui: os eventos entram segurados, para você revisar antes de liberar.
      </p>
      <div className="campo">
        <label htmlFor="proximo-ato">Próximo ato (quem escreve é a IA, a partir da turma)</label>
        <input
          id="proximo-ato"
          type="text"
          list="atos-deliberacao"
          placeholder="ex.: CONTESTAÇÃO"
          value={aberta?.proximoAto ?? ''}
          onChange={(e) => aoMudar(mudarAberta(p, (d) => ({ ...d, proximoAto: e.target.value })))}
        />
        <datalist id="atos-deliberacao">
          {ATOS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>
      <div className="campo">
        <label htmlFor="novo-ponto">O que a turma decidiu</label>
        {aberta?.pontos.length ? (
          <ol className="deliberacao-pontos">
            {aberta.pontos.map((x) => (
              <li key={x.id}>
                <span>{x.texto}</span>
                {ROTULO_ORIGEM[x.origem] && <span className="selo">{ROTULO_ORIGEM[x.origem]}</span>}
                <button type="button" className="link-discreto" onClick={() => aoMudar(mudarAberta(p, (d) => ({ ...d, pontos: d.pontos.filter((y) => y.id !== x.id) })))}>
                  tirar
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ajuda" style={{ margin: 0 }}>
            Nenhum ponto ainda.
          </p>
        )}
        <form
          className="linha-opcoes"
          onSubmit={(e) => {
            e.preventDefault();
            anotar();
          }}
        >
          <input id="novo-ponto" type="text" placeholder="ex.: a inicial não indica o valor da causa (art. 319, V)" value={novo} onChange={(e) => setNovo(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <button className="botao pequeno escuro" disabled={!novo.trim()}>
            Anotar
          </button>
        </form>
      </div>
      <div className="linha-opcoes">
        <button
          className="botao primario"
          disabled={!aberta?.pontos.length}
          onClick={async () => {
            const ok = await copiar(pedidoProximoAtoIA(p, aberta!));
            setMsg(ok ? 'Pedido copiado. Cole no Claude (ou outra IA), copie a resposta e clique em "Colar a resposta da IA".' : 'Este navegador não deixou copiar.');
          }}
        >
          Copiar o pedido para a IA
        </button>
        <button className={`botao${colando ? ' escuro' : ''}`} onClick={() => setColando(!colando)}>
          Colar a resposta da IA
        </button>
      </div>
      {msg && <p className="ajuda">{msg}</p>}
      {colando && (
        <ColarEventos
          aoAcrescentar={(evs) => {
            const existentes = p.eventos.flatMap((x) => x.documentos.map((d) => d.sigla));
            aoMudar(comEventosDaDeliberacao(p, semSiglasRepetidas(existentes, evs)), true);
            setColando(false);
            setMsg(`${evs.length} ${evs.length === 1 ? 'evento entrou' : 'eventos entraram'} no fim do processo, ${evs.length === 1 ? 'segurado' : 'segurados'}. ${noAula ? 'Use "Liberar o evento" quando quiser mostrar à turma.' : 'Revise em Eventos e libere quando quiser.'}`);
          }}
          aoCancelar={() => setColando(false)}
        />
      )}
      {anteriores.length > 0 && (
        <details className="ajuda-dobravel">
          <summary>Deliberações anteriores ({anteriores.length})</summary>
          {anteriores.map((d) => (
            <div key={d.id} className="deliberacao-anterior">
              <strong>{d.proximoAto || 'Ato'}</strong> <span className="ajuda">· {new Date(d.criadaEm).toLocaleDateString('pt-BR')}</span>
              <ul>
                {d.pontos.map((x) => (
                  <li key={x.id}>{x.texto}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
