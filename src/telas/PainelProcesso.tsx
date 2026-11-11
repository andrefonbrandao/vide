// Processo da turma na tela de aula: escolher o processo, projetar, abrir peças e liberar eventos.
import { irPara } from '../comum/navegacao';
import { anfitriao } from '../jogo/anfitriao';
import type { EAgora } from '../processo/tipos';
import { comPonto, deliberacaoAberta, modoDe, pontoDaVotacao } from '../processo/deliberacao';
import { PainelDeliberacao } from './Deliberacao';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { aulaProcesso } from '../processo/aula';
import { listarProcessos } from '../processo/banco';
import type { Processo } from '../processo/tipos';
import { buscarNoAcervo, VisaoProcesso } from './ProcessoAluno';

export function useAulaProcesso() {
  const a = aulaProcesso();
  return useSyncExternalStore(a.assinar, a.obter);
}

/** Parte da janela de Atividades: escolher o processo para projetar. */
export function EscolherProcesso({ aoFechar }: { aoFechar: () => void }) {
  const [lista, setLista] = useState<Processo[] | null>(null);
  useEffect(() => void listarProcessos().then(setLista), []);
  if (!lista) return <p className="ajuda">Carregando…</p>;
  return (
    <>
      {!lista.length ? (
        <div className="aviso">
          Nenhum processo ainda. Monte um em <strong>Atividades › Processos</strong>.{' '}
          <button className="botao pequeno" onClick={() => (aoFechar(), irPara('processos', 'novo-processo'))}>
            Novo processo
          </button>
        </div>
      ) : (
        <div className="lista-questionarios">
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              className="opcao-questionario"
              onClick={async () => {
                await aulaProcesso().abrir(p.id);
                aoFechar();
              }}
            >
              <span style={{ textAlign: 'left' }}>
                <strong>{p.titulo}</strong>
                <span className="ajuda" style={{ margin: 0 }}>
                  {' '}
                  · <span className="mono">{p.capa.numero}</span> · {p.eventos.length} {p.eventos.length === 1 ? 'evento' : 'eventos'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="modal-botoes">
        <button className="botao" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </>
  );
}

/** Painel central durante a aula com o processo aberto. */
export function PainelProcesso() {
  const { tela, processo, aviso } = useAulaProcesso();
  const caixa = useRef<HTMLDivElement>(null);
  const [escolhido, setEscolhido] = useState('');
  const [liberando, setLiberando] = useState(false);
  const [deliberando, setDeliberando] = useState(false);
  const a = aulaProcesso();
  // Rolagem da tela do professor -> projeção.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let quadro = 0;
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        a.rolar(max > 0 ? el.scrollTop / max : 0);
      });
    };
    el.addEventListener('scroll', aoRolar, { passive: true });
    return () => el.removeEventListener('scroll', aoRolar);
  }, [a, tela?.lendo]);
  useEffect(() => {
    caixa.current?.scrollTo({ top: 0 });
  }, [tela?.lendo]);
  if (!tela || !processo) return null;
  const pendentes = a.pendentes();
  const temVicios = processo.eventos.some((e) => e.documentos.some((d) => d.vicios?.length));
  const proximo = pendentes[0];
  const abrirVotacao = (ag: EAgora) => {
    const opcoes = ag.opcoes.map((o) => o.trim()).filter(Boolean).slice(0, 6);
    anfitriao().iniciar(`E agora? ${ag.pergunta}`, [{ tipo: 'multipla', enunciado: ag.pergunta.trim() || 'E agora?', alternativas: opcoes, correta: -1, tempo: 90, explicacao: '', fundamento: '' }], false, {
      modo: 'enquete',
      // Processo colaborativo: o resultado da votação entra na deliberação da turma.
      aoEncerrar: (r) => {
        const atual = aulaProcesso().obter().processo;
        if (!atual || modoDe(atual) !== 'colaborativo' || !r[0]) return;
        void aulaProcesso().atualizar(comPonto(atual, pontoDaVotacao(ag.pergunta, opcoes, r[0].respostas), 'votacao'));
      },
    });
  };
  const liberar = async (id: string) => {
    setLiberando(true);
    try {
      await a.liberar(id);
    } finally {
      setLiberando(false);
      setEscolhido('');
    }
  };
  return (
    <section className="painel-material painel-jogo" data-ui>
      <div className="painel-material-topo">
        <strong className="painel-material-nome">{processo.titulo}</strong>
        <span className="espaco" />
        <span className="ajuda mono" style={{ margin: 0 }}>
          {processo.capa.numero}
        </span>
      </div>
      <div ref={caixa} className="previa-processo" data-rolavel>
        <VisaoProcesso dados={tela.dados} buscar={buscarNoAcervo} lendoControlado={tela.lendo} aoLer={(l) => a.ler(l)} mostrarVicios={tela.vicios ? true : 'esconder'} />
      </div>
      <div className="painel-jogo-acoes">
        {proximo?.e.agora && proximo.e.agora.opcoes.filter((o) => o.trim()).length >= 2 && (
          <button className="botao escuro" onClick={() => abrirVotacao(proximo.e.agora!)} title="A turma vota pelo celular antes de você liberar o evento">
            E agora? Abrir votação
          </button>
        )}
        {proximo ? (
          <button className="botao primario" disabled={liberando} onClick={() => void liberar(proximo.e.id)} title="A turma passa a ver este evento (na projeção e no link)">
            Liberar o evento {proximo.numero}: {proximo.e.descricao || '(sem descrição)'}
          </button>
        ) : (
          <span className="ajuda" style={{ margin: 0 }}>
            Todos os eventos já estão liberados.
          </span>
        )}
        {pendentes.length > 1 && (
          <select className="seletor" aria-label="Liberar outro evento" value={escolhido} disabled={liberando} onChange={(e) => (setEscolhido(e.target.value), e.target.value && void liberar(e.target.value))}>
            <option value="">Liberar outro…</option>
            {pendentes.slice(1).map(({ e, numero }) => (
              <option key={e.id} value={e.id}>
                Evento {numero}: {e.descricao || '(sem descrição)'}
              </option>
            ))}
          </select>
        )}
        {temVicios && (
          <button className={`botao${tela.vicios ? ' escuro' : ''}`} onClick={() => void a.mostrarVicios(!tela.vicios)} title="Destaca na projeção os vícios plantados nas peças, com a explicação">
            {tela.vicios ? 'Esconder os vícios' : 'Mostrar os vícios'}
          </button>
        )}
        {modoDe(processo) === 'colaborativo' && (
          <button className="botao" onClick={() => setDeliberando(true)} title="Anotar o que a turma decidiu e pedir à IA o próximo ato">
            Deliberação da turma{deliberacaoAberta(processo)?.pontos.length ? ` (${deliberacaoAberta(processo)!.pontos.length})` : ''}
          </button>
        )}
        {tela.lendo && (
          <button className="botao" onClick={() => a.ler(null)}>
            Voltar ao processo
          </button>
        )}
        <span className="espaco" />
        <button className="botao" onClick={() => a.fechar()}>
          Fechar processo
        </button>
      </div>
      {deliberando && (
        <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && setDeliberando(false)}>
          <div className="modal" role="dialog" aria-label="Deliberação da turma">
            <div className="atividades-cab">
              <h2>Deliberação da turma</h2>
              <button className="botao pequeno" style={{ marginLeft: 'auto' }} onClick={() => setDeliberando(false)}>
                Fechar
              </button>
            </div>
            <PainelDeliberacao p={processo} aoMudar={(novo) => void a.atualizar(novo)} noAula />
          </div>
        </div>
      )}
      {aviso && (
        <p className="digitar-msg" style={{ flexBasis: 'auto', margin: 0 }}>
          {aviso}
        </p>
      )}
      <p className="ajuda" style={{ margin: 0 }}>
        A projeção mostra só o que a turma já vê e acompanha a rolagem desta tela. Clique numa sigla (INIC1, CONT1…) para projetar a peça.
      </p>
    </section>
  );
}
