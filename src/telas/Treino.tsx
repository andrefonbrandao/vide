// Página do aluno para treinar em casa (abre pelo link /t/<código>).
// Sem cadastro e sem competição: as respostas ficam só neste aparelho.
// No fim, o resumo pode ser salvo em PDF pelo próprio navegador (Imprimir › Salvar como PDF).
import { useEffect, useMemo, useState } from 'react';
import { Logo } from '../comum/Logo';
import { respostaCerta } from '../jogo/conceito';
import { dicasForca, errosForca, MAX_ERROS_FORCA, mascararPalavra, palavraCompleta } from '../jogo/forca';
import { LETRAS } from '../jogo/tipos';
import type { DadosTreino, QuestaoTreino } from '../treino/tipos';
import { Forma } from './JogoTela';
import { DesenhoForca, PalavraForca, TecladoForca } from './Forca';
import { TreinoCasos } from './TreinoCasos';

interface Resposta {
  /** Múltipla escolha / V-F: alternativa marcada. */
  alt?: number;
  /** Conceito: o que o aluno digitou por último. */
  texto?: string;
  /** Conceito: com quantas dicas respondeu e quantas tentativas fez. */
  dicas?: number;
  tentativas?: number;
  desistiu?: boolean;
  /** Forca: quantos erros teve. */
  erros?: number;
  acertou: boolean;
}

interface Sessao {
  /** Posições (em dados.questoes) das questões desta sessão, na ordem. */
  ordem: number[];
  i: number;
  respostas: (Resposta | null)[];
  inicio: string;
  nome: string;
  terminada: boolean;
}

function embaralhar(n: number): number[] {
  const l = Array.from({ length: n }, (_, i) => i);
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

function chaveSessao(codigo: string) {
  return `vide.treino.${codigo}`;
}

function lerSessao(codigo: string): Sessao | null {
  try {
    return JSON.parse(localStorage.getItem(chaveSessao(codigo)) ?? 'null') as Sessao | null;
  } catch {
    return null;
  }
}

function gravarSessao(codigo: string, s: Sessao | null) {
  try {
    if (s) localStorage.setItem(chaveSessao(codigo), JSON.stringify(s));
    else localStorage.removeItem(chaveSessao(codigo));
  } catch {
    /* ignore */
  }
}

/** Texto do artigo do fundamento. */
function Artigo({ artigo }: { artigo: NonNullable<QuestaoTreino['artigo']> }) {
  return (
    <div className="treino-artigo">
      {artigo.blocos.map((b, i) => (
        <p key={i} className={b.destaque ? 'destaque' : ''} style={{ marginLeft: `${b.nivel * 1.2}em` }}>
          {b.rotulo && <b>{b.rotulo} </b>}
          {b.texto}
        </p>
      ))}
    </div>
  );
}

function RespostaCerta({ q }: { q: QuestaoTreino }) {
  if (q.tipo === 'conceito') return <>{q.enunciado}</>;
  return (
    <>
      {q.tipo === 'vf' ? '' : `${LETRAS[q.correta]}) `}
      {q.alternativas[q.correta]}
    </>
  );
}

/** Explicação e fundamento, depois de responder. */
function Comentario({ q, abrirArtigo = false }: { q: QuestaoTreino; abrirArtigo?: boolean }) {
  return (
    <>
      {q.explicacao && <p className="treino-explicacao">{q.explicacao}</p>}
      {q.artigo ? (
        <details className="treino-fundamento" open={abrirArtigo}>
          <summary>Fundamento: {q.artigo.titulo}</summary>
          <Artigo artigo={q.artigo} />
        </details>
      ) : (
        q.fundamento && <p className="ajuda">Fundamento: {q.fundamento}</p>
      )}
    </>
  );
}

export function Treino({ codigo }: { codigo: string }) {
  const [dados, setDados] = useState<DadosTreino | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sessao, setSessaoEstado] = useState<Sessao | null>(null);
  const [anterior] = useState(() => lerSessao(codigo));
  const [nome, setNome] = useState(anterior?.nome ?? '');
  // Estado da questão em andamento.
  const [mostrarComentario, setMostrarComentario] = useState(false);
  const [dicasVistas, setDicasVistas] = useState(1);
  const [texto, setTexto] = useState('');
  const [errou, setErrou] = useState(false);
  const [textoErrado, setTextoErrado] = useState('');
  /** Resultado parcial (para salvar o PDF antes de terminar). */
  const [parcial, setParcial] = useState(false);
  /** Forca: letras escolhidas e palavras erradas digitadas (cada uma conta um erro). */
  const [letras, setLetras] = useState<string[]>([]);
  const [chutesErrados, setChutesErrados] = useState(0);

  const setSessao = (s: Sessao | null) => {
    setSessaoEstado(s);
    gravarSessao(codigo, s);
  };

  useEffect(() => {
    document.title = 'Vide — treino';
    fetch(`/api/treino/${codigo}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error('Este link de treino não existe ou foi desativado pelo professor.');
        if (!r.ok) throw new Error('Não foi possível abrir o treino. Confira a internet e tente de novo.');
        const d = (await r.json()) as DadosTreino;
        setDados(d);
        document.title = `${d.titulo} — Vide`;
      })
      .catch((e: Error) => setErro(e.message));
  }, [codigo]);

  const comecar = () => {
    if (!dados) return;
    const ordem = dados.modo === 'sorteio' ? embaralhar(dados.questoes.length).slice(0, dados.quantas) : dados.questoes.map((_, i) => i);
    setParcial(false);
    setSessao({ ordem, i: 0, respostas: ordem.map(() => null), inicio: new Date().toISOString(), nome: nome.trim(), terminada: false });
    novaQuestao();
  };

  const novaQuestao = () => {
    setMostrarComentario(false);
    setDicasVistas(1);
    setTexto('');
    setErrou(false);
    setLetras([]);
    setChutesErrados(0);
    window.scrollTo({ top: 0 });
  };

  const q: QuestaoTreino | null = dados && sessao && !sessao.terminada ? dados.questoes[sessao.ordem[sessao.i]] : null;
  const respostaAtual = sessao?.respostas[sessao.i] ?? null;

  const registrar = (r: Resposta) => {
    if (!sessao) return;
    const respostas = [...sessao.respostas];
    respostas[sessao.i] = r;
    setSessao({ ...sessao, respostas });
    if (dados?.mostrar === 'cada') setMostrarComentario(true);
    else avancar({ ...sessao, respostas });
  };

  const avancar = (s = sessao) => {
    if (!s) return;
    if (s.i >= s.ordem.length - 1) setSessao({ ...s, terminada: true });
    else setSessao({ ...s, i: s.i + 1 });
    novaQuestao();
  };

  const responderConceito = () => {
    if (!q || !texto.trim()) return;
    // Mesma tolerância do jogo em sala; a resposta exata de outro conceito do treino não vale.
    const outras = dados!.questoes.filter((x) => x !== q && x.tipo === 'conceito').flatMap((x) => [x.enunciado, ...(x.aceitas ?? [])]);
    const certo = respostaCerta(texto, q.enunciado, q.aceitas ?? [], outras);
    const tentativas = (respostaAtual?.tentativas ?? 0) + 1;
    if (certo || dados?.mostrar === 'fim') {
      registrar({ texto: texto.trim(), dicas: dicasVistas, tentativas, acertou: certo });
    } else {
      // Treino com resposta a cada questão: pode tentar de novo.
      const respostas = [...sessao!.respostas];
      respostas[sessao!.i] = null;
      setSessao({ ...sessao!, respostas });
      setErrou(true);
      setTextoErrado(texto.trim());
    }
  };

  const ehForca = dados?.jogo === 'forca' && q?.tipo === 'conceito';
  const errosAgora = q && ehForca ? errosForca(q.enunciado, letras) + chutesErrados : 0;
  const erradasForca = q && ehForca ? letras.filter((l) => errosForca(q.enunciado, [l]) === 1) : [];
  const dicasForcaVistas = q && ehForca ? Math.max(dicasVistas, dicasForca(q.dicas?.length ?? 0, errosAgora)) : 0;

  const escolherLetra = (l: string) => {
    if (!q || respostaAtual || letras.includes(l)) return;
    const novas = [...letras, l];
    setLetras(novas);
    const erros = errosForca(q.enunciado, novas) + chutesErrados;
    if (palavraCompleta(q.enunciado, novas)) registrar({ texto: q.enunciado, erros, acertou: true });
    else if (erros >= MAX_ERROS_FORCA) registrar({ texto: '', erros, acertou: false });
  };

  const chutarPalavra = () => {
    if (!q || !texto.trim() || respostaAtual) return;
    const outras = dados!.questoes.filter((x) => x !== q && x.tipo === 'conceito').flatMap((x) => [x.enunciado, ...(x.aceitas ?? [])]);
    if (respostaCerta(texto, q.enunciado, q.aceitas ?? [], outras)) {
      registrar({ texto: texto.trim(), erros: errosAgora, acertou: true });
      return;
    }
    // Na forca, palavra errada conta um erro.
    const erros = errosAgora + 1;
    setChutesErrados(chutesErrados + 1);
    setErrou(true);
    setTextoErrado(texto.trim());
    setTexto('');
    if (erros >= MAX_ERROS_FORCA) registrar({ texto: texto.trim(), erros, acertou: false });
  };

  const acertos = useMemo(() => (sessao ? sessao.respostas.filter((r) => r?.acertou).length : 0), [sessao]);

  // ---------- telas ----------
  const topo = (
    <header className="jogar-topo nao-imprimir">
      <Logo altura={24} />
      {dados && <span className="chip">{dados.titulo}</span>}
    </header>
  );

  if (erro) {
    return (
      <div className="jogar treino">
        {topo}
        <div className="jogar-centro">
          <p className="jogar-grande">{erro}</p>
        </div>
      </div>
    );
  }
  if (!dados) {
    return (
      <div className="jogar treino">
        {topo}
        <div className="jogar-centro">
          <p className="jogar-grande">Abrindo o treino…</p>
        </div>
      </div>
    );
  }

  if (dados.jogo === 'consulta') return <TreinoCasos dados={dados} codigo={codigo} topo={topo} />;

  // Início
  if (!sessao) {
    const emAndamento = anterior && !anterior.terminada && anterior.ordem.every((i) => i < dados.questoes.length) ? anterior : null;
    return (
      <div className="jogar treino">
        {topo}
        <div className="jogar-centro">
          <p className="jogar-grande">{dados.titulo}</p>
          <p className="ajuda">
            {dados.jogo === 'forca' ? `Forca · ${dados.quantas} ${dados.quantas === 1 ? 'palavra' : 'palavras'}` : `${dados.quantas} ${dados.quantas === 1 ? 'questão' : 'questões'}`}
            {dados.modo === 'sorteio' ? ', sorteadas a cada sessão' : ''} · sem tempo e sem competição ·{' '}
            {dados.mostrar === 'cada' ? 'a resposta certa aparece depois de cada questão' : 'as respostas certas aparecem no fim'}
          </p>
          <label className="jogar-rotulo" htmlFor="nome-treino">
            Seu nome (opcional, só para o PDF)
          </label>
          <input id="nome-treino" className="jogar-campo" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
          <button className="botao-grande primario" onClick={comecar}>
            Começar sessão
          </button>
          {emAndamento && (
            <button
              className="botao-grande"
              onClick={() => {
                // Volta na primeira questão ainda sem resposta.
                const i = emAndamento.respostas.findIndex((r) => !r);
                setSessao(i < 0 ? { ...emAndamento, terminada: true } : { ...emAndamento, i });
                novaQuestao();
              }}
            >
              Continuar a sessão em andamento ({emAndamento.respostas.filter(Boolean).length} de {emAndamento.ordem.length})
            </button>
          )}
          <p className="ajuda">Suas respostas ficam só neste aparelho.</p>
        </div>
      </div>
    );
  }

  // Resultado (final, ou parcial com as questões já respondidas)
  if (sessao.terminada || parcial) {
    const data = new Date(sessao.inicio);
    const ehParcial = !sessao.terminada;
    const respondidas = sessao.respostas.filter(Boolean).length;
    const faltam = sessao.ordem.length - respondidas;
    // No parcial, as questões sem resposta não entram (para não mostrar a resposta certa delas).
    const itens = sessao.ordem.map((pos, k) => ({ pos, k })).filter(({ k }) => !ehParcial || sessao.respostas[k]);
    return (
      <div className="jogar treino treino-resultado">
        {topo}
        <div className="treino-cabecalho-pdf">
          <strong>{dados.titulo}</strong>
          <span>
            {sessao.nome ? `${sessao.nome} · ` : ''}
            {data.toLocaleDateString('pt-BR')} {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {ehParcial ? (
          <p className="jogar-resultado certo">
            Parcial: {acertos} {acertos === 1 ? 'acerto' : 'acertos'} em {respondidas} {respondidas === 1 ? 'respondida' : 'respondidas'} (de {sessao.ordem.length})
          </p>
        ) : (
          <p className="jogar-resultado certo">
            {acertos} de {sessao.ordem.length} {sessao.ordem.length === 1 ? 'acerto' : 'acertos'}
          </p>
        )}
        {ehParcial && faltam > 0 && (
          <p className="ajuda">
            {faltam} {faltam === 1 ? 'questão ainda sem resposta (não aparece' : 'questões ainda sem resposta (não aparecem'} neste resultado).
          </p>
        )}
        <div className="linha-opcoes nao-imprimir">
          <button className="botao-grande primario" onClick={() => window.print()}>
            Salvar em PDF
          </button>
          {ehParcial ? (
            <button className="botao-grande" onClick={() => (setParcial(false), window.scrollTo({ top: 0 }))}>
              Voltar às questões
            </button>
          ) : (
            <button className="botao-grande" onClick={comecar}>
              {dados.modo === 'sorteio' ? 'Treinar de novo (novo sorteio)' : 'Refazer'}
            </button>
          )}
        </div>
        <p className="ajuda nao-imprimir">
          Em "Salvar em PDF", escolha <strong>Salvar como PDF</strong> como destino (no iPhone: Compartilhar › Salvar em Arquivos).
        </p>
        <ol className="treino-lista">
          {itens.map(({ pos, k }) => {
            const qq = dados.questoes[pos];
            const r = sessao.respostas[k];
            return (
              <li key={k} className={r?.acertou ? 'certo' : 'errado'}>
                <p className="treino-q">
                  <b>{k + 1}.</b>{' '}
                  {qq.tipo === 'conceito' ? `${dados.jogo === 'forca' ? 'Forca' : 'Adivinhe o conceito'} — dicas: ${(qq.dicas ?? []).join(' · ')}` : qq.enunciado}
                </p>
                <p>
                  <span className="treino-selo">{r?.acertou ? '✓ acertou' : '✗ errou'}</span> Sua resposta:{' '}
                  <strong>
                    {!r
                      ? '—'
                      : qq.tipo === 'conceito' && dados.jogo === 'forca'
                        ? r.desistiu
                          ? '(não respondeu)'
                          : r.acertou
                            ? `descobriu com ${r.erros ?? 0} ${r.erros === 1 ? 'erro' : 'erros'}`
                            : `não descobriu${r.texto ? ` (digitou “${r.texto}”)` : ''}`
                      : qq.tipo === 'conceito'
                        ? r.desistiu
                          ? '(não respondeu)'
                          : `${r.texto ?? ''}${r.acertou ? ` (com ${r.dicas} ${r.dicas === 1 ? 'dica' : 'dicas'})` : ''}`
                        : `${qq.tipo === 'vf' ? '' : `${LETRAS[r.alt ?? 0]}) `}${qq.alternativas[r.alt ?? 0]}`}
                  </strong>
                </p>
                {!r?.acertou && (
                  <p>
                    Resposta certa: <strong><RespostaCerta q={qq} /></strong>
                  </p>
                )}
                <Comentario q={qq} abrirArtigo />
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // Questão
  const n = sessao.ordem.length;
  const dicas = q?.dicas ?? [];
  return (
    <div className="jogar treino">
      {topo}
      <div className="jogar-info">
        <span>
          {dados.jogo === 'forca' ? 'Palavra' : 'Questão'} {sessao.i + 1} de {n}
        </span>
        <span className="espaco" />
        <button
          className="link-discreto nao-imprimir"
          onClick={() => (setParcial(true), window.scrollTo({ top: 0 }))}
          title="Ver e salvar em PDF o resultado das questões já respondidas"
        >
          salvar PDF até aqui
        </button>
        <button className="link-discreto nao-imprimir" onClick={() => setSessaoEstado(null)}>
          sair
        </button>
      </div>
      <div className="jogar-barra-tempo">
        <span style={{ width: `${((sessao.i + (respostaAtual ? 1 : 0)) / n) * 100}%` }} />
      </div>
      {q && ehForca ? (
        <div className="jogar-pergunta">
          <div className="jogar-forca-topo">
            <DesenhoForca erros={respostaAtual ? (respostaAtual.erros ?? errosAgora) : errosAgora} className={respostaAtual && !respostaAtual.acertou ? 'perdeu' : ''} />
            <div className="forca-info">
              <span>
                {errosAgora} de {MAX_ERROS_FORCA} erros
              </span>
              {erradasForca.length > 0 && <span className="forca-erradas">{erradasForca.join(' ')}</span>}
            </div>
          </div>
          <PalavraForca mascara={mascararPalavra(q.enunciado, letras)} revelada={mostrarComentario ? q.enunciado : undefined} />
          <ol className="jogar-dicas">
            {dicas.slice(0, mostrarComentario ? dicas.length : dicasForcaVistas).map((d, i) => (
              <li key={i}>
                <span className="jogar-dica-num">Dica {i + 1}</span> {d}
              </li>
            ))}
          </ol>
          {!mostrarComentario ? (
            <>
              <TecladoForca
                usadas={letras}
                erradas={erradasForca}
                desativado={!!respostaAtual}
                aoEscolher={escolherLetra}
              />
              {dicasForcaVistas < dicas.length && (
                <button className="botao" onClick={() => setDicasVistas(dicasForcaVistas + 1)}>
                  Mais uma dica
                </button>
              )}
              <form
                className="jogar-form-conceito"
                onSubmit={(e) => {
                  e.preventDefault();
                  chutarPalavra();
                }}
              >
                <input
                  className="jogar-campo"
                  value={texto}
                  onChange={(e) => (setTexto(e.target.value), setErrou(false))}
                  placeholder="Já sei a palavra"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-label="A palavra inteira"
                />
                <button className="botao-grande" disabled={!texto.trim()}>
                  Enviar a palavra
                </button>
                {errou && <p className="jogar-errou">“{textoErrado}” não é a palavra (conta um erro).</p>}
              </form>
              <button
                className="link-discreto"
                style={{ marginLeft: 0 }}
                onClick={() => registrar({ texto: '', erros: errosAgora, desistiu: true, acertou: false })}
              >
                não sei — ver a resposta
              </button>
            </>
          ) : (
            <Feedback r={respostaAtual} q={q} />
          )}
        </div>
      ) : q && q.tipo === 'conceito' ? (
        <div className="jogar-pergunta">
          <p className="jogar-enunciado">Quem sou eu?</p>
          <ol className="jogar-dicas">
            {dicas.slice(0, mostrarComentario ? dicas.length : dicasVistas).map((d, i) => (
              <li key={i}>
                <span className="jogar-dica-num">Dica {i + 1}</span> {d}
              </li>
            ))}
          </ol>
          {!mostrarComentario ? (
            <>
              {dicasVistas < dicas.length && (
                <button className="botao" onClick={() => setDicasVistas(dicasVistas + 1)}>
                  Mais uma dica
                </button>
              )}
              <form
                className="jogar-form-conceito"
                onSubmit={(e) => {
                  e.preventDefault();
                  responderConceito();
                }}
              >
                <input
                  className="jogar-campo"
                  value={texto}
                  onChange={(e) => (setTexto(e.target.value), setErrou(false))}
                  placeholder="Sua resposta"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-label="Sua resposta"
                />
                <button className="botao-grande primario" disabled={!texto.trim()}>
                  Responder
                </button>
                {errou && <p className="jogar-errou">“{textoErrado}” não é a resposta. Tente de novo ou peça mais uma dica.</p>}
              </form>
              <button
                className="link-discreto"
                style={{ marginLeft: 0 }}
                onClick={() => registrar({ texto: '', dicas: dicasVistas, desistiu: true, acertou: false, tentativas: respostaAtual?.tentativas ?? 0 })}
              >
                não sei — ver a resposta
              </button>
            </>
          ) : (
            <Feedback r={respostaAtual} q={q} />
          )}
        </div>
      ) : (
        q && (
          <div className="jogar-pergunta">
            <p className="jogar-enunciado">{q.enunciado}</p>
            <div className="jogar-alternativas">
              {q.alternativas.map((a, i) => {
                const escolhida = respostaAtual?.alt === i;
                const revelar = mostrarComentario;
                return (
                  <button
                    key={i}
                    className={`jogar-alt${revelar && i === q.correta ? ' escolhida' : ''}${revelar && i !== q.correta ? ' apagada' : ''}${escolhida && !revelar ? ' escolhida' : ''}`}
                    onClick={() => registrar({ alt: i, acertou: i === q.correta })}
                    disabled={!!respostaAtual}
                  >
                    <span className="jogar-alt-marca">
                      <Forma i={i} />
                      <b>{LETRAS[i]}</b>
                    </span>
                    <span>
                      {a}
                      {revelar && escolhida && i !== q.correta ? ' — sua resposta' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            {mostrarComentario && <Feedback r={respostaAtual} q={q} />}
          </div>
        )
      )}
      {mostrarComentario && (
        <button className="botao-grande primario" onClick={() => avancar()}>
          {sessao.i >= n - 1 ? 'Ver o resultado' : dados.jogo === 'forca' ? 'Próxima palavra' : 'Próxima questão'}
        </button>
      )}
    </div>
  );
}

function Feedback({ r, q }: { r: Resposta | null; q: QuestaoTreino }) {
  return (
    <div className="treino-feedback">
      <p className={`jogar-resultado ${r?.acertou ? 'certo' : 'errado'}`}>{r?.acertou ? 'Acertou!' : r?.desistiu ? 'Resposta:' : 'Não foi dessa vez'}</p>
      {(!r?.acertou || q.tipo === 'conceito') && (
        <p className="jogar-posicao">
          {r?.acertou ? 'Resposta: ' : 'Resposta certa: '}
          <strong>
            <RespostaCerta q={q} />
          </strong>
        </p>
      )}
      <Comentario q={q} />
    </div>
  );
}
