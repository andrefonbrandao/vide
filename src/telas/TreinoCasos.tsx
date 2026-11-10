// Treino em casa com casos (jogo "Consulta"): o aluno lê o caso, pensa (e, se quiser,
// escreve a resposta), vê a resposta do advogado ou do juiz e avalia como foi.
// Nada sai do aparelho; no fim, o resumo pode ser salvo em PDF.
import { useMemo, useState } from 'react';
import { ELENCO, sortearConsulente } from '../consulta/personagens';
import type { CasoTreino, DadosTreino } from '../treino/tipos';
import { Figura, nomeDoPapel } from './ConsultaTela';

type Avaliacao = 'acertei' | 'parte' | 'errei';
const ROTULO: Record<Avaliacao, string> = { acertei: 'acertei', parte: 'acertei em parte', errei: 'errei' };

interface SessaoCasos {
  ordem: number[];
  i: number;
  textos: string[];
  avaliacoes: (Avaliacao | null)[];
  inicio: string;
  nome: string;
  terminada: boolean;
}

const chave = (codigo: string) => `vide.treinoCasos.${codigo}`;
function ler(codigo: string): SessaoCasos | null {
  try {
    return JSON.parse(localStorage.getItem(chave(codigo)) ?? 'null') as SessaoCasos | null;
  } catch {
    return null;
  }
}
function gravar(codigo: string, s: SessaoCasos | null) {
  try {
    if (s) localStorage.setItem(chave(codigo), JSON.stringify(s));
    else localStorage.removeItem(chave(codigo));
  } catch {
    /* ignore */
  }
}

/** Sorteio que dá sempre o mesmo resultado para o mesmo número (o personagem não muda ao recarregar). */
function semente(n: number): () => number {
  let x = (n + 1) * 2654435761;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function Artigo({ artigo }: { artigo: NonNullable<CasoTreino['artigo']> }) {
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

function Fundamento({ c, aberto = false }: { c: CasoTreino; aberto?: boolean }) {
  if (c.artigo)
    return (
      <details className="treino-fundamento" open={aberto}>
        <summary>Fundamento: {c.artigo.titulo}</summary>
        <Artigo artigo={c.artigo} />
      </details>
    );
  return c.fundamento ? <p className="ajuda">Fundamento: {c.fundamento}</p> : null;
}

function embaralhar(n: number): number[] {
  const l = Array.from({ length: n }, (_, i) => i);
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

export function TreinoCasos({ dados, codigo, topo }: { dados: DadosTreino; codigo: string; topo: React.ReactNode }) {
  const casos = dados.casos ?? [];
  const [anterior] = useState(() => ler(codigo));
  const [sessao, setSessaoEstado] = useState<SessaoCasos | null>(null);
  const [nome, setNome] = useState(anterior?.nome ?? '');
  const [revelado, setRevelado] = useState(false);
  const setSessao = (s: SessaoCasos | null) => {
    setSessaoEstado(s);
    gravar(codigo, s);
  };
  const pos = sessao && !sessao.terminada ? sessao.ordem[sessao.i] : -1;
  const c = pos >= 0 ? casos[pos] : null;
  const pessoas = useMemo(() => {
    if (!c) return null;
    const r = semente(pos);
    const consulente = sortearConsulente(c.pessoa, r);
    const opcoes = ELENCO.filter((p) => p.papel === c.quemResponde);
    return { consulente, respondente: opcoes[Math.floor(r() * opcoes.length)] };
  }, [c, pos]);

  const comecar = () => {
    const ordem = dados.modo === 'sorteio' ? embaralhar(casos.length).slice(0, dados.quantas) : casos.map((_, i) => i);
    setRevelado(false);
    setSessao({ ordem, i: 0, textos: ordem.map(() => ''), avaliacoes: ordem.map(() => null), inicio: new Date().toISOString(), nome: nome.trim(), terminada: false });
    window.scrollTo({ top: 0 });
  };

  if (!sessao) {
    const emAndamento = anterior && !anterior.terminada && anterior.ordem.every((i) => i < casos.length) ? anterior : null;
    return (
      <div className="jogar treino">
        {topo}
        <div className="jogar-centro">
          <p className="jogar-grande">{dados.titulo}</p>
          <p className="ajuda">
            Consulta · {dados.quantas} {dados.quantas === 1 ? 'caso' : 'casos'}
            {dados.modo === 'sorteio' ? ', sorteados a cada sessão' : ''}. Leia o caso, pense na resposta e depois compare com a do advogado ou do juiz.
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
                const i = emAndamento.avaliacoes.findIndex((a) => !a);
                setRevelado(false);
                setSessao(i < 0 ? { ...emAndamento, terminada: true } : { ...emAndamento, i });
              }}
            >
              Continuar a sessão em andamento ({emAndamento.avaliacoes.filter(Boolean).length} de {emAndamento.ordem.length})
            </button>
          )}
          <p className="ajuda">O que você escrever fica só neste aparelho.</p>
        </div>
      </div>
    );
  }

  if (sessao.terminada) {
    const d = new Date(sessao.inicio);
    const conta = (a: Avaliacao) => sessao.avaliacoes.filter((x) => x === a).length;
    return (
      <div className="jogar treino treino-resultado">
        {topo}
        <div className="treino-cabecalho-pdf">
          <strong>{dados.titulo}</strong>
          <span>
            {sessao.nome ? `${sessao.nome} · ` : ''}
            {d.toLocaleDateString('pt-BR')} {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="jogar-resultado certo">
          {conta('acertei')} {conta('acertei') === 1 ? 'acerto' : 'acertos'} · {conta('parte')} em parte · {conta('errei')} {conta('errei') === 1 ? 'erro' : 'erros'}
        </p>
        <p className="ajuda">Pela sua própria avaliação.</p>
        <div className="linha-opcoes nao-imprimir">
          <button className="botao-grande primario" onClick={() => window.print()}>
            Salvar em PDF
          </button>
          <button className="botao-grande" onClick={comecar}>
            {dados.modo === 'sorteio' ? 'Treinar de novo (novo sorteio)' : 'Refazer'}
          </button>
        </div>
        <ol className="treino-lista">
          {sessao.ordem.map((p, k) => {
            const cc = casos[p];
            const a = sessao.avaliacoes[k];
            return (
              <li key={k} className={a === 'acertei' ? 'certo' : 'errado'}>
                <p className="treino-q">
                  <b>{k + 1}.</b> {cc.nome}: {cc.falas.map((f) => f.texto).join(' ')}
                </p>
                <p>
                  <span className="treino-selo">{a ? ROTULO[a] : '—'}</span> Sua resposta: <strong>{sessao.textos[k] || '(não escreveu)'}</strong>
                </p>
                <p>
                  Resposta ({cc.quemResponde === 'juiz' ? 'juiz' : 'advogado'}): <strong>{cc.resposta}</strong>
                </p>
                <Fundamento c={cc} aberto />
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const n = sessao.ordem.length;
  const texto = sessao.textos[sessao.i];
  const avaliar = (a: Avaliacao) => {
    const avaliacoes = [...sessao.avaliacoes];
    avaliacoes[sessao.i] = a;
    const fim = sessao.i >= n - 1;
    setSessao({ ...sessao, avaliacoes, i: fim ? sessao.i : sessao.i + 1, terminada: fim });
    setRevelado(false);
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="jogar treino">
      {topo}
      <div className="jogar-info">
        <span>
          Caso {sessao.i + 1} de {n}
        </span>
        <span className="espaco" />
        <button className="link-discreto nao-imprimir" onClick={() => setSessaoEstado(null)}>
          sair
        </button>
      </div>
      <div className="jogar-barra-tempo">
        <span style={{ width: `${(sessao.i / n) * 100}%` }} />
      </div>
      {c && pessoas && (
        <div className="treino-caso">
          <div className="treino-caso-pessoa">
            <Figura id={pessoas.consulente.id} expressao={c.falas[c.falas.length - 1]?.expressao ?? 'neutro'} />
            <strong>{c.nome}</strong>
          </div>
          <div className="treino-caso-baloes">
            {c.falas.map((f, i) => (
              <p key={i} className={`balao${i === c.falas.length - 1 ? ' pergunta' : ''}`}>
                {f.texto}
              </p>
            ))}
          </div>
          {!revelado ? (
            <>
              <label className="jogar-rotulo" htmlFor="resposta-caso">
                O que você responderia? (opcional)
              </label>
              <textarea
                id="resposta-caso"
                className="jogar-campo"
                rows={3}
                value={texto}
                onChange={(e) => {
                  const textos = [...sessao.textos];
                  textos[sessao.i] = e.target.value;
                  setSessao({ ...sessao, textos });
                }}
              />
              <button className="botao-grande primario" onClick={() => setRevelado(true)}>
                Ver a resposta
              </button>
            </>
          ) : (
            <>
              <div className="treino-caso-resposta">
                <div className="treino-caso-baloes">
                  <p className="balao resposta">{c.resposta}</p>
                </div>
                <div className="treino-caso-pessoa">
                  <Figura id={pessoas.respondente.id} expressao="neutro" />
                  <strong>{nomeDoPapel(pessoas.respondente)}</strong>
                </div>
              </div>
              <Fundamento c={c} />
              <p className="jogar-rotulo">Como foi a sua resposta?</p>
              <div className="linha-opcoes">
                <button className="botao-grande primario" onClick={() => avaliar('acertei')}>
                  Acertei
                </button>
                <button className="botao-grande" onClick={() => avaliar('parte')}>
                  Em parte
                </button>
                <button className="botao-grande" onClick={() => avaliar('errei')}>
                  Errei
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
