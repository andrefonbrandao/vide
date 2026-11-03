// O jogo de perguntas como aparece no projetor (e na prévia da tela do professor).
// Medidas em "cqw" (porcentagem da largura do quadro), para servir nos dois tamanhos.
// Texto sempre verde-escuro sobre claro (ou o inverso); o laranja só em detalhes.
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import type { TelaJogo } from '../comum/canal';
import { LETRAS } from '../jogo/tipos';

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

export function JogoTela({ jogo }: { jogo: TelaJogo }) {
  const q = jogo.questao;
  const revelada = jogo.fase === 'resultado';

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
          {jogo.fase === 'pergunta' ? (
            <Cronometro inicio={jogo.inicio} prazo={jogo.prazo} />
          ) : (
            <span className="jogo-rotulo">Resultado</span>
          )}
        </div>
        <h1 className="jogo-enunciado">{q.enunciado}</h1>
        <div className={`jogo-alternativas${q.alternativas.length <= 2 ? ' duas' : ''}`}>
          {q.alternativas.map((a, i) => {
            const certa = i === q.correta;
            return (
              <div key={i} className={`jogo-alt${revelada ? (certa ? ' certa' : ' apagada') : ''}`}>
                <span className="jogo-alt-marca">
                  <Forma i={i} />
                  <b>{LETRAS[i]}</b>
                </span>
                <span className="jogo-alt-texto">{a}</span>
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
        <p className="jogo-rotulo">
          Placar · depois da questão {jogo.indice + 1} de {jogo.total}
        </p>
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
