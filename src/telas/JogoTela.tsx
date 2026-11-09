// O jogo de perguntas como aparece no projetor (e na prévia da tela do professor).
// Medidas em "cqw" (porcentagem da largura do quadro), para servir nos dois tamanhos.
// Texto sempre verde-escuro sobre claro (ou o inverso); o laranja só em detalhes.
import qrcode from 'qrcode-generator';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TelaJogo } from '../comum/canal';
import { LETRAS } from '../jogo/tipos';
import { dicasVisiveis, proximaDica } from '../jogo/conceito';
import { DesenhoForca, PalavraForca } from './Forca';

/**
 * Texto que se ajusta ao espaço: se não couber no quadro (o elemento "pai"),
 * a letra diminui aos poucos até caber inteiro (sem cortar), até um mínimo de 35%.
 * modo "pai": cabe na altura útil do elemento pai; "max": cabe na altura máxima (max-height) do pai.
 */
function Cabe({ children, className, modo = 'pai', chave }: { children: ReactNode; className?: string; modo?: 'pai' | 'max'; chave: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const pai = el?.parentElement;
    if (!el || !pai) return;
    const ajustar = () => {
      const est = getComputedStyle(pai);
      const util =
        modo === 'max' && est.maxHeight !== 'none'
          ? parseFloat(est.maxHeight)
          : pai.clientHeight - parseFloat(est.paddingTop) - parseFloat(est.paddingBottom);
      const estoura = (e: number) => {
        el.style.fontSize = `${e}em`;
        return el.scrollHeight > util + 1 || el.scrollWidth > el.clientWidth + 1;
      };
      if (!estoura(1)) return;
      // Busca o maior tamanho que cabe (entre 35% e 100%).
      let baixo = 0.35;
      let alto = 1;
      for (let i = 0; i < 9; i++) {
        const meio = (baixo + alto) / 2;
        if (estoura(meio)) alto = meio;
        else baixo = meio;
      }
      el.style.fontSize = `${baixo}em`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(pai);
    void document.fonts?.ready.then(ajustar);
    return () => ro.disconnect();
  }, [chave, modo]);
  return (
    <span ref={ref} className={`cabe${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}

/** Formas que distinguem as alternativas (além da letra). */
export function Forma({ i, tamanho = '1em' }: { i: number; tamanho?: string }) {
  const caminhos = [
    <path key="t" d="M12 3 22 20H2z" />,
    <path key="l" d="M12 2 22 12 12 22 2 12z" />,
    <circle key="c" cx="12" cy="12" r="9.5" />,
    <rect key="q" x="3" y="3" width="18" height="18" rx="2" />,
  ];
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="currentColor" aria-hidden="true" className="forma">
      {caminhos[i % 4]}
    </svg>
  );
}

function Cronometro({ inicio, prazo }: { inicio: number; prazo: number }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 200);
    return () => window.clearInterval(t);
  }, []);
  const total = Math.max(1, prazo - inicio);
  const resta = Math.max(0, prazo - agora);
  const f = resta / total;
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="jogo-cronometro" aria-label={`${Math.ceil(resta / 1000)} segundos`}>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} className="jogo-cron-fundo" />
        <circle cx="50" cy="50" r={r} className="jogo-cron-arco" strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
      </svg>
      <span>{Math.ceil(resta / 1000)}</span>
    </div>
  );
}

function QR({ url }: { url: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [url]);
  return <div className="jogo-qr" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** QR code pequeno e código, no canto, para quem chegar com o jogo já começado. */
function EntradaCanto({ jogo }: { jogo: TelaJogo }) {
  return (
    <div className="jogo-entrada-canto">
      <div className="jogo-entrada-texto">
        <span>Entre: {jogo.enderecoCurto}</span>
        <strong>
          {jogo.codigo.slice(0, 3)} {jogo.codigo.slice(3)}
        </strong>
      </div>
      <QR url={jogo.url} />
    </div>
  );
}

/** Adivinhe o conceito no projetor: dicas aparecendo, quem já acertou e, no fim, a resposta. */
function TelaConceito({ jogo }: { jogo: TelaJogo }) {
  const q = jogo.questao!;
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (jogo.fase !== 'pergunta') return;
    const t = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [jogo.fase, jogo.indice]);
  const dicas = q.dicas ?? [];
  const tempoMs = q.tempo * 1000;
  const revelada = jogo.fase === 'resultado';
  const decorrido = agora - jogo.inicio;
  const visiveis = revelada ? dicas.length : dicasVisiveis(dicas.length, tempoMs, decorrido);
  const prox = revelada ? null : proximaDica(dicas.length, tempoMs, decorrido);
  // Sem nomes: só quantos acertaram com 1, 2, 3… dicas.
  const porDicas = dicas.map((_, i) => jogo.acertaram.filter((a) => a.dicas === i + 1).length);
  return (
    <div className="jogo-tela jogo-conceito">
      <div className="jogo-topo">
        <span className="jogo-rotulo">
          Adivinhe o conceito · questão {jogo.indice + 1} de {jogo.total}
        </span>
        <span className="espaco" />
        <EntradaCanto jogo={jogo} />
        {jogo.fase === 'pergunta' ? <Cronometro inicio={jogo.inicio} prazo={jogo.prazo} /> : <span className="jogo-rotulo">Resultado</span>}
      </div>
      {revelada ? (
        <div className="conceito-resposta">
          <span className="jogo-rotulo">Resposta</span>
          <strong>{q.enunciado}</strong>
        </div>
      ) : (
        <h1 className="jogo-enunciado">Quem sou eu?</h1>
      )}
      <div className="conceito-dicas-caixa">
      <Cabe chave={`${jogo.indice}:${visiveis}:${revelada}`} className="cabe-bloco">
      <ol className="conceito-dicas">
        {dicas.map((d, i) => (
          <li key={i} className={i < visiveis ? 'visivel' : 'oculta'}>
            <span className="conceito-num">Dica {i + 1}</span>
            {i < visiveis ? (
              <span className="conceito-texto">{d}</span>
            ) : (
              <span className="conceito-texto">{i === visiveis && prox !== null ? `em ${Math.ceil((prox - decorrido) / 1000)} s` : '…'}</span>
            )}
          </li>
        ))}
      </ol>
      </Cabe>
      </div>
      <div className="conceito-acertos">
        <span className="jogo-contagem" style={{ margin: 0 }}>
          <strong>{jogo.acertaram.length}</strong> de {jogo.aResponder} acertaram
        </span>
        {jogo.acertaram.length > 0 && (
          <div className="jogo-nomes">
            {porDicas.map((n, i) =>
              n ? (
                <span key={i}>
                  {n} com {i + 1} {i === 0 ? 'dica' : 'dicas'}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
      {revelada && (q.explicacao || jogo.acertoPorPergunta[jogo.indice] !== undefined) && (
        <div className="jogo-rodape">
          {q.explicacao && <span className="jogo-explicacao">{q.explicacao}</span>}
          {jogo.acertoPorPergunta[jogo.indice] !== undefined && <span className="jogo-acerto">{jogo.acertoPorPergunta[jogo.indice]}% de acerto</span>}
        </div>
      )}
    </div>
  );
}

/** Forca no projetor: o desenho, a palavra com tracinhos, as letras já jogadas e a votação. */
function TelaForca({ jogo }: { jogo: TelaJogo }) {
  const q = jogo.questao!;
  const f = jogo.forca!;
  const revelada = jogo.fase === 'resultado';
  const dicas = q.dicas ?? [];
  const visiveis = revelada ? dicas.length : jogo.dicasVisiveis;
  return (
    <div className="jogo-tela jogo-forca">
      <div className="jogo-topo">
        <span className="jogo-rotulo">
          Forca · palavra {jogo.indice + 1} de {jogo.total}
        </span>
        <span className="espaco" />
        <EntradaCanto jogo={jogo} />
        {jogo.fase === 'pergunta' ? (
          <Cronometro key={f.votoInicio} inicio={f.votoInicio} prazo={f.votoPrazo} />
        ) : (
          <span className="jogo-rotulo">Resultado</span>
        )}
      </div>
      <div className="forca-centro">
        <div className="forca-lado">
          <DesenhoForca erros={f.erros} className={f.fim === 'perdeu' ? 'perdeu' : ''} />
          <span className="forca-erros">
            {f.erros} de {f.max} erros
          </span>
        </div>
        <div className="forca-principal">
          <Cabe chave={`${jogo.indice}:${f.letras.length}:${visiveis}:${jogo.fase}`} className="cabe-bloco forca-conteudo">
          {revelada && (
            <p className={`forca-veredito ${f.fim === 'venceu' ? 'venceu' : 'perdeu'}`}>
              {f.fim === 'venceu' ? 'A turma descobriu!' : f.fim === 'perdeu' ? 'A forca venceu' : 'A palavra era'}
            </p>
          )}
          <PalavraForca mascara={f.mascara} revelada={revelada ? q.enunciado : undefined} className="forca-grande" />
          <div className="forca-letras">
            <span className="jogo-rotulo">Letras erradas:</span>{' '}
            {f.erradas.length ? f.erradas.map((l) => <b key={l}>{l}</b>) : <span className="jogo-rotulo">nenhuma</span>}
          </div>
          {dicas.length > 0 && (
            <ol className="forca-dicas">
              {dicas.slice(0, visiveis).map((d, i) => (
                <li key={i}>
                  <span className="conceito-num">Dica {i + 1}</span> {d}
                </li>
              ))}
              {!revelada && visiveis < dicas.length && <li className="oculta">Mais uma dica a cada 2 erros…</li>}
            </ol>
          )}
          </Cabe>
        </div>
      </div>
      <div className="jogo-rodape">
        {jogo.fase === 'pergunta' ? (
          <>
            <span>
              Vote numa letra no celular · <strong>{f.votaram}</strong> de {jogo.aResponder} votaram
            </span>
            {f.ultima && (
              <span className={`forca-ultima ${f.ultima.acertou ? 'certa' : 'errada'}`}>
                Última: <b>{f.ultima.letra}</b> {f.ultima.acertou ? '✓ está na palavra' : '✗ não está'}
              </span>
            )}
          </>
        ) : (
          q.explicacao && <span className="jogo-explicacao">{q.explicacao}</span>
        )}
      </div>
    </div>
  );
}

export function JogoTela({ jogo }: { jogo: TelaJogo }) {
  return (
    <>
      <TelaDoJogo jogo={jogo} />
      {jogo.qrGrande && (
        <div className="jogo-qr-grande">
          <div className="jogo-qr-grande-cartao">
            <QR url={jogo.url} />
            <div>
              <p className="jogo-rotulo">Entre pelo celular</p>
              <p className="jogo-endereco">{jogo.enderecoCurto}</p>
              <p className="jogo-rotulo">e digite o código</p>
              <p className="jogo-codigo">
                {jogo.codigo.slice(0, 3)} {jogo.codigo.slice(3)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TelaDoJogo({ jogo }: { jogo: TelaJogo }) {
  const q = jogo.questao;
  const revelada = jogo.fase === 'resultado';
  if ((jogo.fase === 'pergunta' || jogo.fase === 'resultado') && q && jogo.forca) return <TelaForca jogo={jogo} />;
  if ((jogo.fase === 'pergunta' || jogo.fase === 'resultado') && q?.tipo === 'conceito') return <TelaConceito jogo={jogo} />;

  if (jogo.fase === 'sala') {
    return (
      <div className="jogo-tela jogo-sala">
        <div className="jogo-sala-qr">
          <QR url={jogo.url} />
        </div>
        <div className="jogo-sala-info">
          <p className="jogo-rotulo">Entre pelo celular</p>
          <p className="jogo-endereco">{jogo.enderecoCurto}</p>
          <p className="jogo-rotulo">e digite o código</p>
          <p className="jogo-codigo">
            {jogo.codigo.slice(0, 3)} {jogo.codigo.slice(3)}
          </p>
          <p className="jogo-contagem">
            <strong>{jogo.nJogadores}</strong> {jogo.nJogadores === 1 ? 'participante' : 'participantes'}
          </p>
          <div className="jogo-nomes">
            {jogo.jogadores.slice(-40).map((n, i) => (
              <span key={`${n}-${i}`}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if ((jogo.fase === 'pergunta' || jogo.fase === 'resultado') && q) {
    const dist = jogo.distribuicao;
    const maior = dist ? Math.max(1, ...dist) : 1;
    return (
      <div className="jogo-tela jogo-pergunta">
        <div className="jogo-topo">
          <span className="jogo-rotulo">
            Questão {jogo.indice + 1} de {jogo.total}
          </span>
          <span className="espaco" />
          <EntradaCanto jogo={jogo} />
          {jogo.fase === 'pergunta' ? (
            <Cronometro inicio={jogo.inicio} prazo={jogo.prazo} />
          ) : (
            <span className="jogo-rotulo">Resultado</span>
          )}
        </div>
        <div className="jogo-enunciado-caixa">
          <Cabe chave={q.enunciado} modo="max" className="cabe-bloco">
            <h1 className="jogo-enunciado">{q.enunciado}</h1>
          </Cabe>
        </div>
        <div className={`jogo-alternativas${q.alternativas.length <= 2 ? ' duas' : ''}`}>
          {q.alternativas.map((a, i) => {
            const certa = i === q.correta;
            return (
              <div key={i} className={`jogo-alt${revelada ? (certa ? ' certa' : ' apagada') : ''}`}>
                <span className="jogo-alt-marca">
                  <Forma i={i} />
                  <b>{LETRAS[i]}</b>
                </span>
                <Cabe chave={`${a}:${revelada}`} className="jogo-alt-texto">
                  {a}
                </Cabe>
                {revelada && dist && (
                  <span className="jogo-alt-contagem">
                    <span className="jogo-barra" style={{ width: `${(dist[i] / maior) * 100}%` }} />
                    <b>{dist[i]}</b>
                    {certa && <span className="jogo-certa-selo">✓ correta</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="jogo-rodape">
          {jogo.fase === 'pergunta' ? (
            <span>
              <strong>{jogo.respondidas}</strong> de {jogo.aResponder} responderam
            </span>
          ) : (
            <>
              {q.explicacao && <span className="jogo-explicacao">{q.explicacao}</span>}
              {jogo.acertoPorPergunta[jogo.indice] !== undefined && (
                <span className="jogo-acerto">{jogo.acertoPorPergunta[jogo.indice]}% de acerto</span>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (jogo.fase === 'ranking') {
    return (
      <div className="jogo-tela jogo-placar">
        <div className="jogo-topo">
          <p className="jogo-rotulo">
            Placar · depois da questão {jogo.indice + 1} de {jogo.total}
          </p>
          <span className="espaco" />
          <EntradaCanto jogo={jogo} />
        </div>
        <ol className="jogo-lista-placar">
          {jogo.classificacao.slice(0, 5).map((c) => (
            <li key={c.apelido}>
              <span className="jogo-pos">{c.posicao}º</span>
              <span className="jogo-nome">{c.apelido}</span>
              <span className="jogo-pts">{c.pontos}</span>
            </li>
          ))}
        </ol>
        {!jogo.classificacao.length && <p className="jogo-rotulo">Ninguém entrou ainda.</p>}
      </div>
    );
  }

  // Fim
  if (jogo.ranking && jogo.classificacao.length) {
    const [p1, p2, p3] = jogo.classificacao;
    const degrau = (c: typeof p1 | undefined, lugar: number) =>
      c && (
        <div className={`jogo-degrau lugar-${lugar}`}>
          <span className="jogo-nome">{c.apelido}</span>
          <span className="jogo-pts">{c.pontos} pts</span>
          <div className="jogo-bloco">{c.posicao}º</div>
        </div>
      );
    return (
      <div className="jogo-tela jogo-fim">
        <p className="jogo-rotulo">Fim! Acerto geral da turma: {jogo.acertoGeral ?? 0}%</p>
        <div className="jogo-podio">
          {degrau(p2, 2)}
          {degrau(p1, 1)}
          {degrau(p3, 3)}
        </div>
      </div>
    );
  }
  if (jogo.modo === 'forca') {
    const descobertas = jogo.acertoPorPergunta.filter((p) => p === 100).length;
    return (
      <div className="jogo-tela jogo-fim">
        <p className="jogo-rotulo">Fim da forca</p>
        <p className="jogo-codigo">
          {descobertas} de {jogo.total}
        </p>
        <p className="jogo-rotulo">{jogo.total === 1 ? 'palavra descoberta' : 'palavras descobertas'} pela turma</p>
      </div>
    );
  }
  return (
    <div className="jogo-tela jogo-fim">
      <p className="jogo-rotulo">Fim do questionário</p>
      <p className="jogo-codigo">{jogo.acertoGeral ?? 0}%</p>
      <p className="jogo-rotulo">de acerto da turma</p>
      <div className="jogo-acertos">
        {jogo.acertoPorPergunta.map((p, i) => (
          <div key={i} className="jogo-acerto-q">
            <span className="jogo-barra-v" style={{ height: `${Math.max(3, p)}%` }} />
            <span>Q{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
