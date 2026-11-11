// Fase 2 do processo fictício, na página da turma: a consulta do cliente, o mapa do
// procedimento, os prazos correndo e o glossário dos termos dos autos.
import { useEffect, useRef, useState } from 'react';
import { FASES, faseAtual, faseDoEvento, indiceFase } from '../processo/fases';
import { glossarioCompleto, marcarTermos, type Termo } from '../processo/glossario';
import { diasUteisAte, rotuloPrazo, vencimento } from '../processo/prazos';
import type { ClientePublicado, DadosProcesso, EventoPublicado } from '../processo/tipos';
import { Figura } from './ConsultaTela';

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Glossário ----------

/** Texto com os termos do glossário sublinhados; tocar mostra a explicação. */
export function ComTermos({ texto, termos }: { texto: string; termos: Termo[] }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const caixa = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (aberto === null) return;
    const fora = (e: MouseEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setAberto(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(null);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  const pedacos = marcarTermos(texto, termos);
  return (
    <span ref={caixa}>
      {pedacos.map((p, i) =>
        p.termo ? (
          <span key={i} className="proc-termo-caixa">
            <button type="button" className="proc-termo" aria-expanded={aberto === i} onClick={() => setAberto(aberto === i ? null : i)}>
              {p.texto}
            </button>
            {aberto === i && (
              <span className="proc-termo-dica" role="tooltip">
                <strong>{p.termo.termo}</strong> {p.termo.explicacao}
              </span>
            )}
          </span>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </span>
  );
}

/** Lista dos termos que aparecem nos eventos (e os próprios do professor). */
export function Glossario({ textos, proprios }: { textos: string[]; proprios?: Termo[] }) {
  const todos = glossarioCompleto(proprios);
  const usados = new Map<string, Termo>();
  for (const t of textos) for (const p of marcarTermos(t, todos)) if (p.termo) usados.set(p.termo.termo, p.termo);
  for (const t of proprios ?? []) if (t.termo.trim() && t.explicacao.trim()) usados.set(t.termo.trim(), { termo: t.termo.trim(), explicacao: t.explicacao.trim() });
  if (!usados.size) return null;
  const lista = [...usados.values()].sort((a, b) => a.termo.localeCompare(b.termo, 'pt-BR'));
  return (
    <section className="proc-caixa">
      <h2 className="proc-caixa-titulo">Glossário</h2>
      <dl className="proc-glossario">
        {lista.map((t) => (
          <div key={t.termo}>
            <dt>{t.termo}</dt>
            <dd>{t.explicacao}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------- Cliente em cena ----------

export function ClienteEmCena({ cliente }: { cliente: ClientePublicado }) {
  const ultima = cliente.falas[cliente.falas.length - 1];
  return (
    <details className="proc-caixa proc-cliente" open>
      <summary className="proc-caixa-titulo">Antes do processo: a consulta de {cliente.nome}</summary>
      <div className="proc-cliente-corpo">
        <div className="treino-caso-pessoa">
          <Figura id={cliente.personagem} expressao={ultima?.expressao ?? 'neutro'} />
          <strong>{cliente.nome}</strong>
        </div>
        <div className="treino-caso-baloes">
          {cliente.falas.map((f, i) => (
            <p key={i} className={`balao${i === cliente.falas.length - 1 ? ' pergunta' : ''}`}>
              {f.texto}
            </p>
          ))}
        </div>
      </div>
    </details>
  );
}

// ---------- Mapa do procedimento ----------

export function MapaProcedimento({ eventos }: { eventos: EventoPublicado[] }) {
  const atual = faseAtual(eventos);
  const iAtual = indiceFase(atual);
  const contagem = new Map<string, number>();
  let corrente: string | null = null;
  for (const e of eventos) {
    corrente = faseDoEvento(e) ?? corrente;
    if (corrente) contagem.set(corrente, (contagem.get(corrente) ?? 0) + 1);
  }
  return (
    <section className="proc-caixa">
      <h2 className="proc-caixa-titulo">Onde o processo está</h2>
      <ol className="proc-mapa" aria-label="Fases do procedimento comum">
        {FASES.map((f, i) => {
          const estado = i < iAtual ? 'feita' : i === iAtual ? 'atual' : 'futura';
          const n = contagem.get(f.id) ?? 0;
          return (
            <li key={f.id} className={`proc-mapa-fase ${estado}`} aria-current={estado === 'atual' ? 'step' : undefined} title={`${f.explicacao} (${f.artigos})`}>
              <span className="proc-mapa-ponto">{estado === 'feita' ? '✓' : i + 1}</span>
              <span className="proc-mapa-nome">{f.nome}</span>
              {estado === 'atual' ? <span className="proc-mapa-aqui">o processo está aqui</span> : n > 0 ? <span className="proc-mapa-n">{n} {n === 1 ? 'evento' : 'eventos'}</span> : null}
            </li>
          );
        })}
      </ol>
      {iAtual >= 0 && (
        <p className="proc-mapa-legenda">
          <strong>{FASES[iAtual].nome}:</strong> {FASES[iAtual].explicacao} <span className="mono">({FASES[iAtual].artigos})</span>
        </p>
      )}
    </section>
  );
}

// ---------- Prazos ----------

function Prazo({ e, previa }: { e: EventoPublicado; previa: boolean }) {
  const p = e.prazo!;
  const venc = vencimento(e.data, p.dias, p.tipo);
  const faltam = diasUteisAte(hojeISO(), venc);
  const [resposta, setResposta] = useState('');
  const [conferido, setConferido] = useState<'certo' | 'errado' | null>(null);
  const [revelado, setRevelado] = useState(false);
  const escondido = p.desafio && !previa && !revelado && conferido !== 'certo';
  const situacao = faltam < 0 ? <span className="proc-prazo-sit vencido">vencido</span> : faltam === 0 ? <span className="proc-prazo-sit hoje">vence hoje</span> : <span className="proc-prazo-sit">faltam {faltam} {faltam === 1 ? 'dia útil' : 'dias úteis'}</span>;
  return (
    <li className="proc-prazo">
      <div className="proc-prazo-cab">
        <strong>{p.para ? p.para.charAt(0).toUpperCase() + p.para.slice(1) : 'Prazo'}</strong>
        <span className="ajuda" style={{ margin: 0 }}>
          {rotuloPrazo(p)}, contados do evento {e.numero} ({dataBR(e.data)})
        </span>
      </div>
      {escondido ? (
        <div className="proc-prazo-desafio">
          <label htmlFor={`venc-${e.id}`}>Quando vence?</label>
          <input id={`venc-${e.id}`} type="date" value={resposta} onChange={(ev) => (setResposta(ev.target.value), setConferido(null))} />
          <button type="button" className="botao pequeno escuro" disabled={!resposta} onClick={() => setConferido(resposta === venc ? 'certo' : 'errado')}>
            Conferir
          </button>
          {conferido === 'errado' && (
            <>
              <span className="proc-prazo-dica">
                Ainda não.{' '}
                {p.tipo === 'uteis'
                  ? 'Conte só os dias úteis (segunda a sexta) e deixe de fora o dia do começo (arts. 219 e 224 do CPC).'
                  : 'Comece a contar no primeiro dia útil seguinte e, se terminar no sábado ou no domingo, o prazo passa para segunda (art. 224 do CPC).'}
              </span>
              <button type="button" className="link-discreto" onClick={() => setRevelado(true)}>
                mostrar a resposta
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="proc-prazo-venc">
          {conferido === 'certo' && <span className="proc-prazo-certo">Isso! </span>}
          Vence em <strong>{dataBR(venc)}</strong> {situacao}
          {p.desafio && previa && <span className="proc-selo futuro">a turma faz a conta</span>}
        </div>
      )}
    </li>
  );
}

export function Prazos({ eventos, previa = false }: { eventos: EventoPublicado[]; previa?: boolean }) {
  const com = eventos.filter((e) => e.prazo && e.prazo.dias > 0);
  if (!com.length) return null;
  return (
    <section className="proc-caixa">
      <h2 className="proc-caixa-titulo">Prazos</h2>
      <ul className="proc-prazos">
        {[...com].reverse().map((e) => (
          <Prazo key={e.id} e={e} previa={previa} />
        ))}
      </ul>
    </section>
  );
}

// ---------- PDF dos autos ----------

export function BaixarAutos({ dados, buscar }: { dados: DadosProcesso; buscar?: (arquivo: string) => Promise<Blob> }) {
  const [estado, setEstado] = useState<'pronto' | 'gerando' | 'erro'>('pronto');
  const baixar = async () => {
    setEstado('gerando');
    try {
      const { gerarAutosPdf, nomeArquivoAutos } = await import('../processo/autosPdf');
      const blob = await gerarAutosPdf(dados, buscar);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nomeArquivoAutos(dados.capa.numero);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setEstado('pronto');
    } catch {
      setEstado('erro');
    }
  };
  return (
    <div className="proc-baixar">
      <button type="button" className="botao pequeno" onClick={() => void baixar()} disabled={estado === 'gerando'}>
        {estado === 'gerando' ? 'Montando o PDF…' : 'Baixar os autos (PDF)'}
      </button>
      {estado === 'erro' && <span className="digitar-msg erro">Não foi possível montar o PDF. Tente de novo.</span>}
    </div>
  );
}
