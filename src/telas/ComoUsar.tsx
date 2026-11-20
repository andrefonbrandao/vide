// "Como usar" na página do orientando: o manual (perguntas e respostas, com busca) e o passeio
// de boas-vindas, que destaca cada parte da página com um balão (no primeiro acesso e no "?").
import { Fragment, useEffect, useLayoutEffect, useState } from 'react';
import { manualDoAluno } from '../orientacao/manualAluno';

/** "**negrito**" nas respostas. */
function Rico({ t }: { t: string }) {
  return (
    <>
      {t.split(/\*\*(.+?)\*\*/g).map((x, k) => (k % 2 ? <strong key={k}>{x}</strong> : <Fragment key={k}>{x}</Fragment>))}
    </>
  );
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ManualAluno({ formulario, aoPasseio }: { formulario: 'pre' | 'final' | null; aoPasseio: () => void }) {
  const [busca, setBusca] = useState('');
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const secoes = manualDoAluno(formulario)
    .map((s) => ({ ...s, perguntas: s.perguntas.filter((q) => termos.every((t) => semAcento(`${q.p} ${q.r.join(' ')}`).includes(t))) }))
    .filter((s) => s.perguntas.length);
  return (
    <section className="manual">
      <div className="manual-topo">
        <h2>Como usar esta página</h2>
        <button type="button" className="botao pequeno" onClick={aoPasseio}>
          Ver o passeio de boas-vindas
        </button>
      </div>
      <input className="manual-busca" type="search" placeholder="Procure: tabela, código, salvar, apontamento…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Procurar no manual" />
      {!secoes.length && <p className="ajuda">Nada encontrado. Tente outra palavra, ou pergunte ao seu orientador.</p>}
      {secoes.map((s) => (
        <div key={s.id} className="proc-caixa manual-secao">
          <h3 className="proc-caixa-titulo">{s.titulo}</h3>
          {s.perguntas.map((q) => (
            <details key={q.p} className="manual-pergunta" open={termos.length > 0}>
              <summary>{q.p}</summary>
              {q.r.map((r, k) => (
                <p key={k}>
                  <Rico t={r} />
                </p>
              ))}
            </details>
          ))}
        </div>
      ))}
    </section>
  );
}

// ---------- Passeio de boas-vindas ----------
export interface Passo {
  /** Seletor do que destacar (sem: balão no meio da tela). */
  alvo?: string;
  titulo: string;
  texto: string;
}

export function passosDoPasseio(nome: string, formulario: 'pre' | 'final' | null): Passo[] {
  const aba = formulario === 'final' ? 'Meu trabalho final' : 'Meu pré-projeto';
  return [
    { titulo: `Olá${nome ? `, ${nome.split(' ')[0]}` : ''}!`, texto: 'Esta é a sua página de orientação. Em um minuto, mostro o que tem aqui. Você pode pular e rever depois no "?", lá no alto.' },
    { alvo: '[data-passeio="agora"]', titulo: 'A etapa da vez', texto: 'A próxima etapa do cronograma, com quanto tempo falta.' },
    { alvo: '[data-passeio="pendencias"]', titulo: 'Pendências', texto: '"Fazer" é o que você deve fazer; "sugestão" é para avaliar. Elas saem daqui quando o orientador dá baixa.' },
    { alvo: '[data-passeio="cronograma"]', titulo: 'Cronograma', texto: 'Todas as etapas do trabalho, com os prazos combinados.' },
    { alvo: '[data-passeio="modelos"]', titulo: 'Modelos e orientações', texto: 'O manual de normalização, o modelo do trabalho e outras orientações para baixar a qualquer momento.' },
    ...(formulario
      ? [
          {
            alvo: '[data-passeio="formulario"]',
            titulo: aba,
            texto: `Aqui você escreve o trabalho. Ele é salvo sozinho e sai em PDF ou Word já formatado pelo manual. Os apontamentos do orientador aparecem em amarelo no texto: responda e marque como resolvido. "Enviar ao orientador" manda uma versão datada.`,
          },
        ]
      : []),
    { alvo: '[data-passeio="comousar"]', titulo: 'Dúvidas?', texto: 'Em "Como usar", as respostas para as perguntas mais comuns, com busca.' },
    { alvo: '[data-passeio="ajuda"]', titulo: 'Rever o passeio', texto: 'Toque no "?" para ver este passeio de novo. Bom trabalho!' },
  ];
}

export function Passeio({ passos, aoFechar }: { passos: Passo[]; aoFechar: () => void }) {
  // Só os passos cujo alvo existe na tela.
  const [lista] = useState(() => passos.filter((p) => !p.alvo || document.querySelector(p.alvo)));
  const [k, setK] = useState(0);
  const [caixa, setCaixa] = useState<DOMRect | null>(null);
  const passo = lista[k];
  useLayoutEffect(() => {
    if (!passo?.alvo) return setCaixa(null);
    const el = document.querySelector(passo.alvo);
    if (!el) return setCaixa(null);
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const medir = () => setCaixa(el.getBoundingClientRect());
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [passo]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      if (e.key === 'ArrowRight') setK((x) => Math.min(x + 1, lista.length - 1));
      if (e.key === 'ArrowLeft') setK((x) => Math.max(x - 1, 0));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar, lista.length]);
  if (!passo) return null;
  const M = 8;
  const ultimo = k === lista.length - 1;
  // Balão abaixo do destaque (ou acima, se não couber); no meio da tela quando não há destaque.
  const abaixo = caixa ? caixa.bottom + 190 < window.innerHeight : true;
  const estiloBalao: React.CSSProperties = caixa
    ? { top: abaixo ? caixa.bottom + M + 10 : undefined, bottom: abaixo ? undefined : window.innerHeight - caixa.top + M + 10, left: Math.max(12, Math.min(caixa.left, window.innerWidth - 352)) }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  return (
    <div className="passeio" role="dialog" aria-modal="true" aria-label="Passeio de boas-vindas">
      {caixa ? (
        <div className="passeio-destaque" style={{ top: caixa.top - M, left: caixa.left - M, width: caixa.width + 2 * M, height: caixa.height + 2 * M }} />
      ) : (
        <div className="passeio-fundo" />
      )}
      <div className="passeio-balao" style={estiloBalao}>
        <strong>{passo.titulo}</strong>
        <p>{passo.texto}</p>
        <div className="passeio-pe">
          <span className="ajuda" style={{ margin: 0 }}>
            {k + 1} de {lista.length}
          </span>
          {!ultimo && (
            <button type="button" className="link-discreto" onClick={aoFechar}>
              pular
            </button>
          )}
          {k > 0 && (
            <button type="button" className="botao pequeno" onClick={() => setK(k - 1)}>
              Voltar
            </button>
          )}
          <button type="button" className="botao pequeno escuro" onClick={() => (ultimo ? aoFechar() : setK(k + 1))} autoFocus>
            {ultimo ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
