// Orientação de trabalhos acadêmicos: orientandos, cronograma com prazos, sessões e
// comunicações (com sugestões e comandos), e as versões provisórias do trabalho.
// Esta tela é carregada só quando aberta (não pesa na aula).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { avisar, confirmar } from '../comum/avisos';
import { IcMais } from '../comum/Icones';
import { novoId } from '../dados/modelo';
import {
  adicionarModelo,
  adicionarVersao,
  criarOrientacao,
  criarTrabalho,
  EVENTO_ORIENTACAO,
  excluirInteracao,
  excluirModelo,
  excluirTrabalho,
  excluirVersao,
  interacaoEmBranco,
  listarInteracoes,
  listarModelos,
  listarOrientandos,
  listarTrabalhos,
  listarVersoes,
  salvarInteracao,
  salvarModelo,
  salvarOrientando,
  atualizarTrabalho,
  salvarVersao,
} from '../orientacao/banco';
import { analisarColagem, type Colagem } from '../orientacao/colar';
import { pendenciasVencidas } from '../orientacao/alertas';
import { lerEncaminhamentos, lerRespostaIA, pedidoRegistroIA } from '../orientacao/ia';
import type { OpcoesRelatorio } from '../orientacao/relatorioPdf';
import { assinarPublicacao, desativarOrientacao, estadoPublicacao, MAX_MODELO, publicarOrientacao, urlDoOrientando } from '../orientacao/publicar';
import { LinkEQr } from './CompartilharTreino';
import { copiar } from './ProcessoTexto';
import { agoraLocal, dataBR, dataHoraBR, emOrdem, etapaAtual, hojeISO, pendencias, rotuloDias, situacaoEtapa, type Pendencia } from '../orientacao/prazos';
import { CANAIS, ELEMENTOS_VAZIOS, TIPOS_TRABALHO, type Elementos, type Canal, type Encaminhamento, type Interacao, type Modelo, type Orientando, type Trabalho, type TipoTrabalho, type Versao } from '../orientacao/tipos';
import { Reconhecedor, obterConstrutor, type StatusVoz } from '../voz/reconhecedor';
import { controlador } from './controlador';
import { Figura } from './ConsultaTela';
import { Pagina } from './Pagina';

const nomeCanal = (c: Canal) => CANAIS.find((x) => x.id === c)?.nome ?? c;

function rotuloInteracao(i: Interacao): string {
  if (i.canal === 'sessao') return `Sessão de orientação${i.modo ? ` (${i.modo})` : ''}`;
  return nomeCanal(i.canal);
}

function tamanhoLegivel(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Baixa um arquivo com o nome certo (ou abre o PDF numa aba nova). */
function baixarArquivo(blob: Blob, nome: string, abrir = false): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  if (abrir) {
    a.target = '_blank';
    a.rel = 'noopener';
  } else a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

/** Recarrega quando a orientação muda (aqui ou pelo Drive). */
function useRecarga(carregar: () => void) {
  useEffect(() => {
    carregar();
    window.addEventListener(EVENTO_ORIENTACAO, carregar);
    return () => window.removeEventListener(EVENTO_ORIENTACAO, carregar);
  }, [carregar]);
}

/** Silhueta humana neutra (cabeça e ombros), ao lado do nome do orientando. */
function Silhueta() {
  return (
    <svg className="ori-silhueta" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <circle cx="16" cy="16" r="16" className="ori-silhueta-fundo" />
      <circle cx="16" cy="12.5" r="5.5" className="ori-silhueta-figura" />
      <path d="M6.5 27.5c1.2-5.4 5-8.3 9.5-8.3s8.3 2.9 9.5 8.3A15.9 15.9 0 0 1 16 32a15.9 15.9 0 0 1-9.5-4.5z" className="ori-silhueta-figura" />
    </svg>
  );
}

// ---------- Página ----------

export function Orientacoes() {
  const [orientandos, setOrientandos] = useState<Orientando[]>([]);
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('vide.orientacao.aberto');
    } catch {
      return null;
    }
  });
  const [criando, setCriando] = useState(false);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [verModelos, setVerModelos] = useState(false);
  const carregar = useCallback(() => {
    void Promise.all([listarOrientandos(), listarTrabalhos(), listarInteracoes()]).then(([o, t, i]) => {
      setOrientandos(o);
      setTrabalhos(t);
      setInteracoes(i);
      setCarregado(true);
    });
  }, []);
  useRecarga(carregar);
  const abrir = (id: string | null) => {
    setAberto(id);
    try {
      if (id) sessionStorage.setItem('vide.orientacao.aberto', id);
      else sessionStorage.removeItem('vide.orientacao.aberto');
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };

  const trabalhoAberto = aberto ? trabalhos.find((t) => t.id === aberto) : undefined;
  if (aberto && carregado && trabalhoAberto) {
    return <TrabalhoDetalhe key={aberto} trabalho={trabalhoAberto} orientando={orientandos.find((o) => o.id === trabalhoAberto.orientandoId)} aoVoltar={() => abrir(null)} aoAbrir={abrir} />;
  }

  const hoje = hojeISO();
  const ordem = (t: Trabalho) => etapaAtual(t)?.prazo ?? '9999';
  const emAndamento = trabalhos.filter((t) => t.situacao === 'andamento').sort((a, b) => ordem(a).localeCompare(ordem(b)));
  const encerrados = trabalhos.filter((t) => t.situacao !== 'andamento');
  const cartao = (t: Trabalho) => {
    const o = orientandos.find((x) => x.id === t.orientandoId);
    const dele = interacoes.filter((i) => i.trabalhoId === t.id);
    const ultima = dele[0];
    const pend = pendencias(dele).length;
    const vencidas = pendenciasVencidas(dele, [t], hoje).length;
    const e = etapaAtual(t);
    const s = e && situacaoEtapa(e, hoje);
    return (
      <button key={t.id} type="button" className="cartao ori-cartao" onClick={() => abrir(t.id)}>
        <span className="ori-cartao-cab">
          <Silhueta />
          <strong>{o?.nome ?? 'Orientando'}</strong>
          <span className="ori-selo">{t.tipo}</span>
          {t.situacao !== 'andamento' && <span className="ori-selo">{t.situacao === 'concluido' ? 'concluído' : 'interrompido'}</span>}
          {vencidas > 0 && (
            <span className="ori-vencidas" title="Pendências com o prazo vencido, sem baixa">
              {vencidas} {vencidas === 1 ? 'vencida' : 'vencidas'}
            </span>
          )}
        </span>
        <span className="ori-cartao-titulo">{t.titulo || 'Trabalho sem título'}</span>
        {t.situacao === 'andamento' && (
          <span className={`ori-prazo ${s?.tipo ?? 'concluida'}`}>
            {e && s ? (
              <>
                {e.nome} · <strong>{rotuloDias(s.dias)}</strong> ({dataBR(e.prazo)})
              </>
            ) : (
              'Cronograma cumprido ✓'
            )}
          </span>
        )}
        <span className="ajuda" style={{ margin: 0 }}>
          {pend ? `${pend} ${pend === 1 ? 'pendência' : 'pendências'} · ` : ''}
          {ultima ? `último contato: ${dataBR(ultima.em)} (${nomeCanal(ultima.canal)})` : 'nenhum contato registrado'}
        </span>
      </button>
    );
  };

  return (
    <Pagina
      caminho="Orientação"
      titulo="Orientandos"
      descricao="Cronograma com prazos, sessões e comunicações, sugestões e comandos, e as versões do trabalho. Fica neste computador e no seu Google Drive."
      acoes={
        <>
          <button className={`botao${verModelos ? ' escuro' : ''}`} onClick={() => setVerModelos(!verModelos)}>
            Modelos e orientações
          </button>
          {!criando && (
            <button className="botao escuro com-icone" onClick={() => setCriando(true)}>
              <IcMais tamanho={16} /> Novo orientando
            </button>
          )}
        </>
      }
    >
      {verModelos && (
        <section className="cartao" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Modelos e orientações gerais</h3>
          <p className="ajuda">
            Valem para todos os orientandos e aparecem para baixar na página de cada um (manual de normalização, modelo de TCC, orientações escritas). Para um orientando só, use a aba
            "Página do orientando" dele.
          </p>
          <ModelosOrientacao trabalhoId={null} />
        </section>
      )}
      {criando && <FormNovaOrientacao aoFechar={() => setCriando(false)} aoCriar={(t) => (setCriando(false), abrir(t.id))} />}
      {carregado && !trabalhos.length && !criando ? (
        <div className="vazio-guia">
          <Figura id="m1" expressao="feliz" className="vazio-guia-figura" />
          <div>
            <h2>Nenhum orientando ainda</h2>
            <p className="ajuda">
              Cadastre o orientando e o trabalho (TCC, artigo, dissertação…). O Vide sugere um cronograma com as etapas e os prazos até a defesa; você ajusta. Depois, registre
              cada sessão e cada conversa por WhatsApp ou e-mail (pode colar a conversa) e guarde as versões que ele entregar.
            </p>
            <button className="botao escuro" onClick={() => setCriando(true)}>
              Novo orientando
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ori-grade">{emAndamento.map(cartao)}</div>
          {encerrados.length > 0 && (
            <>
              <button className="link-discreto" style={{ marginLeft: 0 }} onClick={() => setVerEncerrados(!verEncerrados)}>
                {verEncerrados ? 'esconder os concluídos e interrompidos' : `mostrar os concluídos e interrompidos (${encerrados.length})`}
              </button>
              {verEncerrados && <div className="ori-grade">{encerrados.map(cartao)}</div>}
            </>
          )}
        </>
      )}
    </Pagina>
  );
}

// ---------- Novo orientando ----------

function CamposTrabalho({ v, mudar }: { v: { titulo: string; tipo: TipoTrabalho; inicio: string; defesa: string }; mudar: (p: Partial<{ titulo: string; tipo: TipoTrabalho; inicio: string; defesa: string }>) => void }) {
  return (
    <>
      <div className="campo">
        <label htmlFor="ori-titulo">Título (provisório)</label>
        <input id="ori-titulo" value={v.titulo} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="ex.: Os precedentes vinculantes no CPC de 2015" />
      </div>
      <div className="grade-3">
        <div className="campo">
          <label htmlFor="ori-tipo">Tipo</label>
          <select id="ori-tipo" className="seletor" value={v.tipo} onChange={(e) => mudar({ tipo: e.target.value as TipoTrabalho })}>
            {TIPOS_TRABALHO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ori-inicio">Começo da orientação</label>
          <input id="ori-inicio" type="date" value={v.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="ori-defesa">Defesa ou entrega final (prevista)</label>
          <input id="ori-defesa" type="date" value={v.defesa} onChange={(e) => mudar({ defesa: e.target.value })} />
        </div>
      </div>
    </>
  );
}

function FormNovaOrientacao({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (t: Trabalho) => void }) {
  const [o, setO] = useState({ nome: '', email: '', telefone: '', curso: '' });
  const [t, setT] = useState({ titulo: '', tipo: 'TCC' as TipoTrabalho, inicio: hojeISO(), defesa: '' });
  return (
    <form
      className="cartao form-turma"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!o.nome.trim()) return;
        const novo = await criarOrientacao({ nome: o.nome.trim(), email: o.email.trim(), telefone: o.telefone.trim(), curso: o.curso.trim() }, { ...t, titulo: t.titulo.trim() });
        avisar('Orientando cadastrado. Confira o cronograma sugerido.');
        aoCriar(novo);
      }}
    >
      <h3>Novo orientando</h3>
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="ori-nome">Nome</label>
          <input id="ori-nome" autoFocus value={o.nome} onChange={(e) => setO({ ...o, nome: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="ori-curso">Curso ou nível (opcional)</label>
          <input id="ori-curso" value={o.curso} onChange={(e) => setO({ ...o, curso: e.target.value })} placeholder="ex.: Graduação em Direito, 9º semestre" />
        </div>
        <div className="campo">
          <label htmlFor="ori-email">E-mail (para os lembretes, mais adiante)</label>
          <input id="ori-email" type="email" value={o.email} onChange={(e) => setO({ ...o, email: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="ori-tel">Telefone / WhatsApp (opcional)</label>
          <input id="ori-tel" value={o.telefone} onChange={(e) => setO({ ...o, telefone: e.target.value })} />
        </div>
      </div>
      <CamposTrabalho v={t} mudar={(p) => setT({ ...t, ...p })} />
      <p className="ajuda">O Vide monta um cronograma sugerido para o tipo de trabalho, com os prazos espalhados até a defesa (ou de 30 em 30 dias). Você ajusta depois.</p>
      <div className="modal-botoes">
        <button className="botao primario" disabled={!o.nome.trim()}>
          Cadastrar
        </button>
        <button type="button" className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ---------- Trabalho ----------

type Aba = 'geral' | 'elementos' | 'conversas' | 'versoes' | 'pagina' | 'dados';

function TrabalhoDetalhe({ trabalho, orientando, aoVoltar, aoAbrir }: { trabalho: Trabalho; orientando?: Orientando; aoVoltar: () => void; aoAbrir: (id: string) => void }) {
  const [aba, setAba] = useState<Aba>('geral');
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [registrando, setRegistrando] = useState<Interacao | null>(null);
  const [relatorio, setRelatorio] = useState(false);
  const carregar = useCallback(() => {
    void listarInteracoes(trabalho.id).then(setInteracoes);
    void listarVersoes(trabalho.id).then(setVersoes);
  }, [trabalho.id]);
  useRecarga(carregar);
  const pend = pendencias(interacoes);
  const registrar = (canal: Canal) => {
    setRegistrando(interacaoEmBranco(trabalho.id, canal, agoraLocal()));
    setAba('conversas');
  };
  return (
    <Pagina
      caminho="Orientação"
      titulo={orientando?.nome ?? 'Orientando'}
      descricao={
        <>
          {trabalho.tipo} · {trabalho.titulo || 'sem título'}
          {trabalho.defesa ? ` · defesa prevista em ${dataBR(trabalho.defesa)}` : ''}
        </>
      }
      acoes={
        <>
          <button className="botao" onClick={aoVoltar}>
            ← Orientandos
          </button>
          <button className="botao escuro" onClick={() => registrar('sessao')}>
            Registrar sessão
          </button>
          <button className="botao" onClick={() => registrar('whatsapp')}>
            Registrar comunicação
          </button>
          <button className={`botao${relatorio ? ' escuro' : ''}`} onClick={() => setRelatorio(!relatorio)}>
            Relatório em PDF
          </button>
        </>
      }
    >
      {relatorio && <PainelRelatorio trabalho={trabalho} orientando={orientando} interacoes={interacoes} versoes={versoes} aoFechar={() => setRelatorio(false)} />}
      <nav className="secoes-questoes" aria-label="Partes da orientação">
        {(
          [
            ['geral', pend.length ? `Cronograma e pendências (${pend.length})` : 'Cronograma e pendências'],
            ['elementos', 'Elementos do trabalho'],
            ['conversas', `Sessões e comunicações (${interacoes.length})`],
            ['versoes', `Versões (${versoes.length})`],
            ['pagina', trabalho.publicacao ? 'Página do orientando ✓' : 'Página do orientando'],
            ['dados', 'Dados'],
          ] as [Aba, string][]
        ).map(([a, r]) => (
          <button key={a} className={`botao pequeno${aba === a ? ' escuro' : ''}`} onClick={() => setAba(a)}>
            {r}
          </button>
        ))}
      </nav>
      {aba === 'geral' && (
        <>
          <Cronograma trabalho={trabalho} />
          <ListaPendencias pend={pend} aoRegistrar={() => registrar('sessao')} />
        </>
      )}
      {aba === 'elementos' && <ElementosTrabalho trabalho={trabalho} />}
      {aba === 'conversas' && (
        <Conversas trabalho={trabalho} interacoes={interacoes} versoes={versoes} registrando={registrando} setRegistrando={setRegistrando} aoRegistrar={registrar} />
      )}
      {aba === 'versoes' && <Versoes trabalho={trabalho} versoes={versoes} interacoes={interacoes} />}
      {aba === 'pagina' && <PaginaDoOrientando trabalho={trabalho} orientando={orientando} />}
      {aba === 'dados' && <Dados trabalho={trabalho} orientando={orientando} aoAbrir={aoAbrir} aoApagar={aoVoltar} />}
    </Pagina>
  );
}

/** Guarda as mudanças com uma pausa curta (para não gravar a cada letra). */
function useRascunho<T extends { id: string }>(valor: T, salvar: (v: T) => Promise<unknown>): [T, (v: T) => void] {
  const [atual, setAtual] = useState(valor);
  const timer = useRef<number | null>(null);
  const pendente = useRef<T | null>(null);
  useEffect(() => {
    if (!pendente.current) setAtual(valor);
  }, [valor]);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (pendente.current) void salvar(pendente.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const mudar = (v: T) => {
    setAtual(v);
    pendente.current = v;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const p = pendente.current;
      pendente.current = null;
      if (p) void salvar(p);
    }, 600);
  };
  return [atual, mudar];
}

function Cronograma({ trabalho }: { trabalho: Trabalho }) {
  const [t, mudar] = useRascunho(trabalho, (v) => atualizarTrabalho(v.id, { etapas: v.etapas }));
  const hoje = hojeISO();
  const etapas = t.etapas;
  const mudarEtapa = (id: string, p: Partial<Trabalho['etapas'][number]>) => mudar({ ...t, etapas: etapas.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const ordenadas = emOrdem(etapas);
  return (
    <section className="cartao">
      <h3 style={{ marginTop: 0 }}>Cronograma</h3>
      {!etapas.length && <p className="ajuda">Nenhuma etapa. Acrescente as etapas com os prazos.</p>}
      <table className="ori-cronograma">
        <tbody>
          {ordenadas.map((e) => {
            const s = situacaoEtapa(e, hoje);
            return (
              <tr key={e.id} className={s.tipo}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Etapa cumprida: ${e.nome}`}
                    checked={!!e.concluida_em}
                    onChange={(ev) => mudarEtapa(e.id, { concluida_em: ev.target.checked ? hoje : null })}
                  />
                </td>
                <td className="ori-etapa-nome">
                  <input aria-label="Nome da etapa" value={e.nome} onChange={(ev) => mudarEtapa(e.id, { nome: ev.target.value })} />
                </td>
                <td>
                  <input type="date" aria-label={`Prazo: ${e.nome}`} value={e.prazo} onChange={(ev) => ev.target.value && mudarEtapa(e.id, { prazo: ev.target.value })} />
                </td>
                <td className="ori-etapa-situacao">{s.tipo === 'concluida' ? `cumprida${e.concluida_em ? ` em ${dataBR(e.concluida_em)}` : ''}` : rotuloDias(s.dias)}</td>
                <td>
                  <button type="button" className="link-discreto" onClick={() => mudar({ ...t, etapas: etapas.filter((x) => x.id !== e.id) })}>
                    tirar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        className="botao pequeno com-icone"
        onClick={() => {
          const ultima = ordenadas[ordenadas.length - 1];
          mudar({ ...t, etapas: [...etapas, { id: novoId(), nome: 'Nova etapa', prazo: ultima?.prazo ?? hoje, concluida_em: null }] });
        }}
      >
        <IcMais tamanho={14} /> Etapa
      </button>
      <p className="ajuda">Prazos em dias corridos. Marque a etapa quando o orientando a cumprir; a primeira em aberto aparece na lista de orientandos.</p>
    </section>
  );
}

async function resolverPendencia(p: Pendencia, situacao: Encaminhamento['situacao']) {
  const i = p.interacao;
  await salvarInteracao({ ...i, encaminhamentos: i.encaminhamentos.map((e) => (e.id === p.enc.id ? { ...e, situacao, resolvido_em: situacao === 'pendente' ? null : hojeISO() } : e)) });
}

function ListaPendencias({ pend, aoRegistrar }: { pend: Pendencia[]; aoRegistrar: () => void }) {
  return (
    <section className="cartao" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Pendências do orientando</h3>
      {!pend.length ? (
        <p className="ajuda">
          Nenhuma sugestão ou comando em aberto. Ao{' '}
          <button className="link-discreto" style={{ margin: 0 }} onClick={aoRegistrar}>
            registrar uma sessão
          </button>
          , anote o que o orientando deve fazer: as pendências aparecem aqui até serem cumpridas.
        </p>
      ) : (
        <ul className="ori-pendencias">
          {pend.map((p) => (
            <li key={p.enc.id}>
              <input type="checkbox" aria-label={`Cumprido: ${p.enc.texto}`} onChange={() => void resolverPendencia(p, 'cumprido')} />
              <span className={`ori-tipo-enc ${p.enc.tipo}`}>{p.enc.tipo === 'comando' ? 'comando' : 'sugestão'}</span>
              <span className="ori-pend-texto">
                {p.enc.texto}
                <span className="ajuda" style={{ margin: 0 }}>
                  {' '}
                  · {rotuloInteracao(p.interacao).toLowerCase()} de {dataBR(p.interacao.em)}
                </span>
                {p.enc.prazo && (
                  <span className={situacaoEtapa({ id: '', nome: '', prazo: p.enc.prazo }).tipo === 'atrasada' ? 'ori-pend-vencida' : 'ajuda'} style={{ margin: 0 }}>
                    {' '}
                    · até {dataBR(p.enc.prazo)} ({rotuloDias(situacaoEtapa({ id: '', nome: '', prazo: p.enc.prazo }).dias)})
                  </span>
                )}
              </span>
              <button className="link-discreto" onClick={() => void resolverPendencia(p, 'descartado')}>
                descartar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Elementos do trabalho ----------

const AJUDA_ELEMENTOS: Record<Exclude<keyof Elementos, 'atualizado_em'>, { nome: string; ajuda: string; linhas: number }> = {
  tema: { nome: 'Tema', ajuda: 'O assunto, em linhas gerais.', linhas: 2 },
  delimitacao: { nome: 'Delimitação do tema', ajuda: 'O recorte: que aspecto do tema, em que âmbito, em que período.', linhas: 3 },
  problema: { nome: 'Problema de pesquisa', ajuda: 'A pergunta que o trabalho vai responder.', linhas: 3 },
  hipoteses: { nome: 'Hipótese(s)', ajuda: 'Respostas provisórias ao problema, a confirmar ou não (se houver).', linhas: 3 },
  objetivoGeral: { nome: 'Objetivo geral', ajuda: 'Dá conta da totalidade do problema, com um verbo de precisão (analisar, verificar, identificar…).', linhas: 2 },
  objetivosEspecificos: { nome: 'Objetivos específicos', ajuda: 'Detalham o objetivo geral. Um por linha, começando com verbo no infinitivo.', linhas: 4 },
  justificativa: { nome: 'Justificativa', ajuda: 'Por que o tema importa: relevância teórica, prática e social.', linhas: 4 },
  metodologia: { nome: 'Metodologia', ajuda: 'Método, tipo de pesquisa e fontes (se já definidos).', linhas: 3 },
};

function ElementosTrabalho({ trabalho }: { trabalho: Trabalho }) {
  const [t, mudar] = useRascunho(trabalho, (v) => atualizarTrabalho(v.id, { elementos: v.elementos }));
  const e: Elementos = { ...ELEMENTOS_VAZIOS, ...t.elementos };
  const mudarCampo = (p: Partial<Elementos>) => mudar({ ...t, elementos: { ...e, ...p, atualizado_em: hojeISO() } });
  return (
    <section className="cartao ori-elementos">
      <h3 style={{ marginTop: 0 }}>Elementos do trabalho</h3>
      <p className="ajuda">
        O que já foi definido com o orientando. Fica guardado sozinho; atualize a cada sessão, conforme o trabalho amadurece.
        {e.atualizado_em ? ` Última alteração: ${dataBR(e.atualizado_em)}.` : ''}
      </p>
      {(Object.keys(AJUDA_ELEMENTOS) as (keyof typeof AJUDA_ELEMENTOS)[]).map((campo) => {
        const a = AJUDA_ELEMENTOS[campo];
        const valor = campo === 'objetivosEspecificos' ? e.objetivosEspecificos.join('\n') : e[campo];
        return (
          <div className="campo" key={campo}>
            <label htmlFor={`el-${campo}`}>{a.nome}</label>
            <textarea
              id={`el-${campo}`}
              rows={a.linhas}
              value={valor}
              placeholder={a.ajuda}
              onChange={(ev) => mudarCampo(campo === 'objetivosEspecificos' ? { objetivosEspecificos: ev.target.value.split('\n') } : { [campo]: ev.target.value })}
            />
          </div>
        );
      })}
    </section>
  );
}

// ---------- Relatório em PDF ----------

const OPCOES_PADRAO: OpcoesRelatorio = { elementos: true, cronograma: true, pendencias: true, sessoes: true, transcricoes: false, conversas: false, versoes: true, orientador: '' };

function lerOpcoes(): OpcoesRelatorio {
  try {
    return { ...OPCOES_PADRAO, ...(JSON.parse(localStorage.getItem('vide.orientacao.relatorio') ?? '{}') as Partial<OpcoesRelatorio>), de: '', ate: '' };
  } catch {
    return OPCOES_PADRAO;
  }
}

function PainelRelatorio({ trabalho, orientando, interacoes, versoes, aoFechar }: { trabalho: Trabalho; orientando?: Orientando; interacoes: Interacao[]; versoes: Versao[]; aoFechar: () => void }) {
  const [o, setO] = useState<OpcoesRelatorio>(lerOpcoes);
  const [gerando, setGerando] = useState(false);
  const mudar = (p: Partial<OpcoesRelatorio>) => {
    const novo = { ...o, ...p };
    setO(novo);
    try {
      const { de: _de, ate: _ate, ...guardar } = novo;
      localStorage.setItem('vide.orientacao.relatorio', JSON.stringify(guardar));
    } catch {
      /* ignore */
    }
  };
  const algum = o.elementos || o.cronograma || o.pendencias || o.sessoes || o.versoes;
  const caixa = (campo: 'elementos' | 'cronograma' | 'pendencias' | 'sessoes' | 'versoes' | 'transcricoes' | 'conversas', rotulo: string) => (
    <label className="ori-opcao">
      <input type="checkbox" checked={o[campo]} onChange={(e) => mudar({ [campo]: e.target.checked })} /> {rotulo}
    </label>
  );
  return (
    <section className="cartao form-turma ori-relatorio">
      <h3>Relatório em PDF</h3>
      <div className="linha-opcoes">
        <button type="button" className="botao pequeno" onClick={() => mudar({ elementos: true, cronograma: false, pendencias: false, sessoes: false, versoes: false })}>
          Só os elementos
        </button>
        <button type="button" className="botao pequeno" onClick={() => mudar({ elementos: false, cronograma: true, pendencias: true, sessoes: true, versoes: true })}>
          Só as orientações
        </button>
        <button type="button" className="botao pequeno" onClick={() => mudar({ elementos: true, cronograma: true, pendencias: true, sessoes: true, versoes: true })}>
          Tudo
        </button>
      </div>
      <div className="ori-opcoes">
        {caixa('elementos', 'Elementos do trabalho (tema, problema, objetivos…)')}
        {caixa('cronograma', 'Cronograma')}
        {caixa('pendencias', 'Pendências do orientando')}
        {caixa('sessoes', 'Sessões e comunicações (resumos, sugestões e comandos)')}
        {o.sessoes && (
          <div className="ori-subopcoes">
            <span className="ajuda" style={{ margin: 0 }}>
              Período:
            </span>
            <input type="date" aria-label="De" value={o.de ?? ''} onChange={(e) => mudar({ de: e.target.value })} />
            <span className="ajuda" style={{ margin: 0 }}>
              até
            </span>
            <input type="date" aria-label="Até" value={o.ate ?? ''} onChange={(e) => mudar({ ate: e.target.value })} />
            {caixa('conversas', 'com as anotações e as conversas coladas')}
            {caixa('transcricoes', 'com as transcrições (longas)')}
          </div>
        )}
        {caixa('versoes', 'Versões recebidas (com as suas anotações)')}
      </div>
      <div className="campo" style={{ maxWidth: 420 }}>
        <label htmlFor="rel-orientador">Orientador(a), no cabeçalho (opcional)</label>
        <input id="rel-orientador" value={o.orientador ?? ''} onChange={(e) => mudar({ orientador: e.target.value })} placeholder="ex.: Prof. Me. Fulano de Tal" />
      </div>
      <div className="modal-botoes">
        <button
          type="button"
          className="botao primario"
          disabled={!algum || gerando}
          onClick={async () => {
            setGerando(true);
            try {
              const { gerarRelatorioPdf, nomeArquivoRelatorio } = await import('../orientacao/relatorioPdf');
              const hoje = hojeISO();
              const blob = await gerarRelatorioPdf({ orientando, trabalho, interacoes, versoes, hoje }, o);
              baixarArquivo(blob, nomeArquivoRelatorio(orientando?.nome ?? 'orientando', hoje));
              avisar('Relatório gerado');
            } catch (e) {
              avisar(`Não foi possível gerar o PDF: ${(e as Error).message}`, 'erro');
            } finally {
              setGerando(false);
            }
          }}
        >
          {gerando ? 'Gerando…' : 'Baixar o PDF'}
        </button>
        <button type="button" className="botao" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </section>
  );
}

// ---------- Sessões e comunicações ----------

function Conversas({
  trabalho,
  interacoes,
  versoes,
  registrando,
  setRegistrando,
  aoRegistrar,
}: {
  trabalho: Trabalho;
  interacoes: Interacao[];
  versoes: Versao[];
  registrando: Interacao | null;
  setRegistrando: (i: Interacao | null) => void;
  aoRegistrar: (c: Canal) => void;
}) {
  return (
    <>
      {registrando ? (
        <FormInteracao key={registrando.id} inicial={registrando} trabalho={trabalho} interacoes={interacoes} versoes={versoes} aoFechar={() => setRegistrando(null)} />
      ) : (
        <div className="linha-opcoes" style={{ marginBottom: 10 }}>
          <button className="botao escuro com-icone" onClick={() => aoRegistrar('sessao')}>
            <IcMais tamanho={14} /> Sessão de orientação
          </button>
          <button className="botao com-icone" onClick={() => aoRegistrar('whatsapp')}>
            <IcMais tamanho={14} /> Comunicação (WhatsApp, e-mail…)
          </button>
        </div>
      )}
      {!interacoes.length && !registrando && <p className="ajuda">Nenhuma sessão ou comunicação registrada ainda.</p>}
      <ol className="ori-linha-tempo">
        {interacoes
          .filter((i) => i.id !== registrando?.id)
          .map((i) => (
            <ItemInteracao key={i.id} i={i} versoes={versoes} aoEditar={() => setRegistrando(i)} />
          ))}
      </ol>
    </>
  );
}

function ConversaColada({ texto }: { texto: string }) {
  const c = useMemo(() => analisarColagem(texto), [texto]);
  if (!c.mensagens.length) return <pre className="ori-colado">{texto}</pre>;
  return (
    <div className="ori-colado ori-chat">
      {c.mensagens.map((m, k) => (
        <p key={k}>
          <strong>{m.autor}</strong> <span className="ajuda">{m.em ? dataHoraBR(m.em) : ''}</span>
          <br />
          {m.texto}
        </p>
      ))}
    </div>
  );
}

function ItemInteracao({ i, versoes, aoEditar }: { i: Interacao; versoes: Versao[]; aoEditar: () => void }) {
  const [verTexto, setVerTexto] = useState(false);
  const [verTranscricao, setVerTranscricao] = useState(false);
  const versao = i.versaoId ? versoes.find((v) => v.id === i.versaoId) : undefined;
  const mudarEnc = (id: string, situacao: Encaminhamento['situacao']) =>
    void salvarInteracao({ ...i, encaminhamentos: i.encaminhamentos.map((e) => (e.id === id ? { ...e, situacao, resolvido_em: situacao === 'pendente' ? null : hojeISO() } : e)) });
  return (
    <li className={`cartao ori-interacao ${i.canal}`}>
      <div className="ori-interacao-cab">
        <strong>{rotuloInteracao(i)}</strong>
        <span className="ajuda" style={{ margin: 0 }}>
          {dataHoraBR(i.em)}
        </span>
        <button className="link-discreto" onClick={aoEditar}>
          editar
        </button>
        <button
          className="link-discreto"
          style={{ marginLeft: 8 }}
          onClick={async () => {
            if (await confirmar({ titulo: 'Apagar este registro?', texto: 'As sugestões e comandos anotados nele também saem.', botao: 'Apagar', perigo: true })) await excluirInteracao(i);
          }}
        >
          apagar
        </button>
      </div>
      {i.resumo && <p className="ori-resumo">{i.resumo}</p>}
      {versao && <p className="ajuda">Versão discutida: {versao.rotulo}</p>}
      {i.encaminhamentos.length > 0 && (
        <ul className="ori-encaminhamentos">
          {i.encaminhamentos.map((e) => (
            <li key={e.id} className={e.situacao}>
              <input type="checkbox" aria-label={`Cumprido: ${e.texto}`} checked={e.situacao === 'cumprido'} onChange={(ev) => mudarEnc(e.id, ev.target.checked ? 'cumprido' : 'pendente')} />
              <span className={`ori-tipo-enc ${e.tipo}`}>{e.tipo === 'comando' ? 'comando' : 'sugestão'}</span>
              <span>
                {e.texto}
                {e.prazo ? (
                  <span className={e.situacao === 'pendente' && situacaoEtapa({ id: '', nome: '', prazo: e.prazo }).tipo === 'atrasada' ? 'ori-pend-vencida' : 'ajuda'}> · até {dataBR(e.prazo)}</span>
                ) : null}
                {e.situacao === 'cumprido' ? <span className="ajuda"> · cumprido{e.resolvido_em ? ` em ${dataBR(e.resolvido_em)}` : ''}</span> : null}
                {e.situacao === 'descartado' ? <span className="ajuda"> · descartado{e.resolvido_em ? ` em ${dataBR(e.resolvido_em)}` : ''}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {i.transcricao?.trim() && (
        <>
          <button className="link-discreto" style={{ marginLeft: 0, marginRight: 14 }} onClick={() => setVerTranscricao(!verTranscricao)}>
            {verTranscricao ? 'esconder a transcrição' : `ver a transcrição (${i.transcricao.trim().split('\n').length} trechos)`}
          </button>
          {verTranscricao && <pre className="ori-colado">{i.transcricao}</pre>}
        </>
      )}
      {i.texto.trim() && (
        <>
          <button className="link-discreto" style={{ marginLeft: 0 }} onClick={() => setVerTexto(!verTexto)}>
            {verTexto ? 'esconder a conversa' : i.canal === 'sessao' ? 'ver as anotações' : 'ver a conversa'}
          </button>
          {verTexto && <ConversaColada texto={i.texto} />}
        </>
      )}
    </li>
  );
}

// ---------- Transcrição da sessão (o mesmo reconhecimento de voz da aula) ----------

const p2 = (n: number) => String(n).padStart(2, '0');

/** Microfone ligado: cada trecho definitivo vira uma linha "[HH:MM] texto". */
function useTranscricao(aoTrecho: (linha: string) => void) {
  const [status, setStatus] = useState<StatusVoz>('parado');
  const [detalhe, setDetalhe] = useState('');
  const [parcial, setParcial] = useState('');
  const aoTrechoRef = useRef(aoTrecho);
  aoTrechoRef.current = aoTrecho;
  const voz = useRef<Reconhecedor | null>(null);
  useEffect(() => {
    const r = new Reconhecedor({
      onParcial: (t) => setParcial(t),
      onFinal: (t) => {
        setParcial('');
        const texto = t.trim();
        if (!texto) return;
        const d = new Date();
        aoTrechoRef.current(`[${p2(d.getHours())}:${p2(d.getMinutes())}] ${texto}`);
      },
      onStatus: (st, det) => {
        setStatus(st);
        setDetalhe(det ?? '');
      },
      onDiagnostico: () => {},
    });
    voz.current = r;
    return () => r.parar();
  }, []);
  const iniciar = () => {
    // A escuta da aula usa o mesmo microfone: pausa antes.
    const aula = controlador();
    if (aula.obter().escutando) aula.pausar();
    voz.current?.iniciar();
  };
  const parar = () => voz.current?.parar();
  const ligado = status === 'ouvindo' || status === 'iniciando' || status === 'reiniciando';
  return { status, detalhe, parcial, ligado, iniciar, parar };
}

function PainelTranscricao({ transcricao, aoMudar, aoTrecho }: { transcricao: string; aoMudar: (t: string) => void; aoTrecho: (linha: string) => void }) {
  const { status, detalhe, parcial, ligado, iniciar, parar } = useTranscricao(aoTrecho);
  const [desde, setDesde] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const caixa = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!ligado) return;
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [ligado]);
  // Acompanha o fim do texto enquanto transcreve.
  useEffect(() => {
    if (ligado && caixa.current) caixa.current.scrollTop = caixa.current.scrollHeight;
  }, [transcricao, ligado]);
  const suporte = !!obterConstrutor();
  const min = desde ? Math.max(0, Math.floor((agora - desde) / 60_000)) : 0;
  const palavras = transcricao.trim() ? transcricao.trim().split(/\s+/).length : 0;
  return (
    <div className="campo ori-transcricao">
      <label htmlFor="int-transcricao">Transcrição da sessão</label>
      {!suporte ? (
        <p className="aviso">Este navegador não transcreve a voz. Use o Chrome ou o Edge, como na aula.</p>
      ) : (
        <div className="ori-transcricao-barra">
          {ligado ? (
            <button type="button" className="botao escuro" onClick={parar}>
              ■ Pausar a transcrição
            </button>
          ) : (
            <button
              type="button"
              className="botao primario"
              onClick={() => {
                if (!desde) setDesde(Date.now());
                setAgora(Date.now());
                iniciar();
              }}
            >
              ● {transcricao.trim() ? 'Continuar a transcrever' : 'Transcrever a sessão'}
            </button>
          )}
          <span className={`ori-transcricao-status ${ligado ? 'ligado' : ''}`}>
            {status === 'ouvindo' ? `ouvindo${desde ? ` · ${min} min` : ''}` : status === 'iniciando' || status === 'reiniciando' ? 'ligando o microfone…' : status === 'erro' ? detalhe || 'a escuta parou' : 'microfone desligado'}
          </span>
          {palavras > 0 && <span className="ajuda" style={{ margin: 0 }}>{palavras} palavras</span>}
        </div>
      )}
      <textarea id="int-transcricao" ref={caixa} rows={ligado || transcricao ? 8 : 3} value={transcricao} onChange={(e) => aoMudar(e.target.value)} placeholder="O que for dito aparece aqui, com o horário. Dá para corrigir à mão depois." />
      {ligado && parcial && <p className="ori-parcial">{parcial}…</p>}
      <span className="ajuda" style={{ margin: 0 }}>
        A transcrição vai sendo guardada enquanto você fala. Como na aula, só o microfone deste computador é ouvido: numa sessão online, a voz do orientando entra se sair pela caixa de
        som (com fone de ouvido, só a sua).
      </span>
    </div>
  );
}

/** "Organizar com a IA": copia o pedido (com a transcrição) e lê a resposta colada de volta. */
function OrganizarComIA({ pedido, temMaterial, aoUsar }: { pedido: () => string; temMaterial: boolean; aoUsar: (resposta: string) => string }) {
  const [colando, setColando] = useState(false);
  const [resposta, setResposta] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div className="campo ori-ia">
      <label>Organizar com a IA</label>
      <div className="linha-opcoes">
        <button
          type="button"
          className="botao primario"
          disabled={!temMaterial}
          onClick={async () => {
            const ok = await copiar(pedido());
            setMsg(ok ? 'Pedido copiado. Cole no Claude (ou outra IA), copie a resposta inteira e clique em "Colar a resposta da IA".' : 'Este navegador não deixou copiar.');
          }}
        >
          Copiar o pedido para a IA
        </button>
        <button type="button" className={`botao${colando ? ' escuro' : ''}`} onClick={() => setColando(!colando)}>
          Colar a resposta da IA
        </button>
      </div>
      {!temMaterial && <span className="ajuda" style={{ margin: 0 }}>Transcreva a sessão, cole a conversa ou escreva anotações primeiro.</span>}
      {msg && <span className="ajuda" style={{ margin: 0 }}>{msg}</span>}
      {colando && (
        <>
          <textarea rows={7} aria-label="Resposta da IA" value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Cole aqui a resposta da IA (RESUMO, SUGESTÕES E COMANDOS…)" />
          <div className="linha-opcoes">
            <button
              type="button"
              className="botao escuro"
              disabled={!resposta.trim()}
              onClick={() => {
                setMsg(aoUsar(resposta));
                setResposta('');
                setColando(false);
              }}
            >
              Usar a resposta
            </button>
          </div>
        </>
      )}
      <span className="ajuda" style={{ margin: 0 }}>
        O pedido leva a transcrição, as anotações, o cronograma e as pendências anteriores (sem o nome do orientando). A resposta preenche o resumo, as sugestões e os comandos, e marca as
        pendências já cumpridas; confira antes de registrar.
      </span>
    </div>
  );
}

function descreverColagem(c: Colagem): string {
  const partes = [c.canal === 'whatsapp' ? `WhatsApp, ${c.mensagens.length} ${c.mensagens.length === 1 ? 'mensagem' : 'mensagens'}` : 'e-mail'];
  if (c.em) partes.push(`de ${dataHoraBR(c.em)}`);
  if (c.participantes.length) partes.push(`com ${c.participantes.join(', ')}`);
  return partes.join(' ');
}

function FormInteracao({ inicial, trabalho, interacoes, versoes, aoFechar }: { inicial: Interacao; trabalho: Trabalho; interacoes: Interacao[]; versoes: Versao[]; aoFechar: () => void }) {
  const [i, setI] = useState(inicial);
  const [reconhecido, setReconhecido] = useState<string | null>(null);
  const [novoTexto, setNovoTexto] = useState('');
  const [novoTipo, setNovoTipo] = useState<Encaminhamento['tipo']>('comando');
  const [novoPrazo, setNovoPrazo] = useState('');
  /** Pendências de outras interações marcadas como cumpridas nesta. */
  const [cumpridas, setCumpridas] = useState<string[]>([]);
  const anteriores = pendencias(interacoes.filter((x) => x.id !== i.id));
  const ehSessao = i.canal === 'sessao';
  // Registro novo (mesmo depois de a transcrição guardá-lo pela primeira vez).
  const [novo] = useState(() => !interacoes.some((x) => x.id === inicial.id));
  // Transcrição: cada trecho entra no texto e o registro é guardado na hora (não se perde se a página mudar).
  const atual = useRef(i);
  atual.current = i;
  const aoTrecho = (linha: string) => {
    const t = atual.current.transcricao?.trim();
    const proximo = { ...atual.current, transcricao: t ? `${t}\n${linha}` : linha };
    atual.current = proximo;
    setI(proximo);
    void salvarInteracao(proximo);
  };

  const aoColar = (texto: string) => {
    const c = analisarColagem(texto);
    if (!c.canal) {
      setReconhecido(null);
      return;
    }
    setReconhecido(descreverColagem(c));
    setI((x) => ({
      ...x,
      texto,
      canal: x.canal === 'sessao' ? x.canal : c.canal!,
      em: c.em ?? x.em,
      resumo: x.resumo.trim() ? x.resumo : c.resumo,
    }));
  };
  /** Acrescenta sugestões e comandos sem repetir os que já estão. Devolve quantos entraram. */
  const juntar = (base: Interacao, lista: Pick<Encaminhamento, 'tipo' | 'texto' | 'prazo'>[]): [Interacao, number] => {
    const ja = new Set(base.encaminhamentos.map((e) => e.texto.trim().toLowerCase()));
    const novos = lista.filter((e) => !ja.has(e.texto.trim().toLowerCase())).map((e) => ({ id: novoId(), ...e, situacao: 'pendente' as const, resolvido_em: null }));
    return [{ ...base, encaminhamentos: [...base.encaminhamentos, ...novos] }, novos.length];
  };
  const contar = (l: Pick<Encaminhamento, 'tipo'>[]) => {
    const c = l.filter((e) => e.tipo === 'comando').length;
    const sg = l.length - c;
    return [c ? `${c} ${c === 1 ? 'comando' : 'comandos'}` : '', sg ? `${sg} ${sg === 1 ? 'sugestão' : 'sugestões'}` : ''].filter(Boolean).join(' e ');
  };
  /** Resposta inteira da IA (resumo, sugestões e comandos, pendências cumpridas). */
  const usarResposta = (texto: string): string => {
    const r = lerRespostaIA(texto);
    if (!r.resumo && !r.encaminhamentos.length && !r.cumpridas.length) return 'Não reconheci a resposta. Ela precisa ter as partes "RESUMO:" e "SUGESTÕES E COMANDOS:".';
    const [comTarefas, n] = juntar({ ...i, resumo: r.resumo || i.resumo }, r.encaminhamentos);
    setI(comTarefas);
    const marcadas = r.cumpridas.map((k) => anteriores[k - 1]?.enc.id).filter((x): x is string => !!x);
    setCumpridas([...new Set([...cumpridas, ...marcadas])]);
    const entraram = comTarefas.encaminhamentos.slice(-n);
    const partes = [r.resumo ? 'o resumo' : '', n ? contar(entraram) : '', marcadas.length ? `${marcadas.length} ${marcadas.length === 1 ? 'pendência marcada' : 'pendências marcadas'} como cumprida${marcadas.length === 1 ? '' : 's'}` : ''].filter(Boolean);
    return `Preenchido: ${partes.join(', ')}. Confira e clique em ${novo ? '"Registrar"' : '"Salvar"'}.`;
  };
  const [msgBloco, setMsgBloco] = useState('');
  /** Várias linhas coladas no campo: separa e classifica cada sugestão ou comando. */
  const colarBloco = (texto: string): boolean => {
    if (!/\n/.test(texto.trim())) return false;
    const r = lerEncaminhamentos(texto, novoTipo);
    if (r.comResumo) {
      setMsgBloco(usarResposta(texto));
      return true;
    }
    if (!r.itens.length) return false;
    const [com, n] = juntar(i, r.itens);
    setI(com);
    const repetidas = r.itens.length - n;
    setMsgBloco(n ? `Entraram ${contar(com.encaminhamentos.slice(-n))}${repetidas ? ` (${repetidas} já ${repetidas === 1 ? 'estava' : 'estavam'} na lista)` : ''}. Confira o tipo de cada um: clique na etiqueta para trocar.` : 'Essas já estavam na lista.');
    return true;
  };
  const acrescentar = () => {
    if (!novoTexto.trim()) return;
    setI({ ...i, encaminhamentos: [...i.encaminhamentos, { id: novoId(), tipo: novoTipo, texto: novoTexto.trim(), situacao: 'pendente', prazo: novoPrazo || undefined, resolvido_em: null }] });
    setNovoTexto('');
    setNovoPrazo('');
  };
  return (
    <form
      className="cartao form-turma"
      onSubmit={async (e) => {
        e.preventDefault();
        const final = novoTexto.trim()
          ? { ...i, encaminhamentos: [...i.encaminhamentos, { id: novoId(), tipo: novoTipo, texto: novoTexto.trim(), situacao: 'pendente' as const, prazo: novoPrazo || undefined, resolvido_em: null }] }
          : i;
        await salvarInteracao(final);
        for (const p of anteriores.filter((p) => cumpridas.includes(p.enc.id))) await resolverPendencia(p, 'cumprido');
        avisar(novo ? (ehSessao ? 'Sessão registrada' : 'Comunicação registrada') : 'Registro salvo');
        aoFechar();
      }}
    >
      <h3>{novo ? (ehSessao ? 'Registrar sessão de orientação' : 'Registrar comunicação') : 'Editar registro'}</h3>
      <div className="grade-3">
        <div className="campo">
          <label htmlFor="int-canal">Tipo</label>
          <select id="int-canal" className="seletor" value={i.canal} onChange={(e) => setI({ ...i, canal: e.target.value as Canal, modo: e.target.value === 'sessao' ? (i.modo ?? 'presencial') : undefined })}>
            {CANAIS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        {ehSessao && (
          <div className="campo">
            <label htmlFor="int-modo">Como foi</label>
            <select id="int-modo" className="seletor" value={i.modo ?? 'presencial'} onChange={(e) => setI({ ...i, modo: e.target.value as 'presencial' | 'online' })}>
              <option value="presencial">presencial</option>
              <option value="online">online</option>
            </select>
          </div>
        )}
        <div className="campo">
          <label htmlFor="int-em">Data e hora</label>
          <input id="int-em" type="datetime-local" value={i.em} onChange={(e) => e.target.value && setI({ ...i, em: e.target.value })} />
        </div>
      </div>
      {ehSessao && <PainelTranscricao transcricao={i.transcricao ?? ''} aoMudar={(t) => setI({ ...i, transcricao: t })} aoTrecho={aoTrecho} />}
      <div className="campo">
        <label htmlFor="int-colar">{ehSessao ? 'Anotações (opcional)' : 'Conversa (cole aqui o WhatsApp ou o e-mail)'}</label>
        <textarea
          id="int-colar"
          rows={ehSessao ? 3 : 6}
          value={i.texto}
          placeholder={ehSessao ? '' : 'No WhatsApp: selecione as mensagens, copie e cole aqui. No e-mail: copie a mensagem (com o "De:" e a data) e cole.'}
          onChange={(e) => setI({ ...i, texto: e.target.value })}
          onPaste={(e) => {
            const colado = e.clipboardData.getData('text');
            if (!colado) return;
            const el = e.currentTarget;
            // Deixa o navegador colar e então lê o texto inteiro.
            window.setTimeout(() => aoColar(el.value), 0);
          }}
        />
        {reconhecido && (
          <span className="ajuda" style={{ margin: 0 }}>
            Reconhecido: {reconhecido}. Tipo, data e resumo preenchidos; confira.
          </span>
        )}
      </div>
      <OrganizarComIA
        temMaterial={!!(i.transcricao?.trim() || i.texto.trim() || i.resumo.trim())}
        pedido={() => pedidoRegistroIA({ trabalho, interacao: i, anteriores, versao: versoes.find((v) => v.id === i.versaoId), hoje: hojeISO() })}
        aoUsar={usarResposta}
      />
      <div className="campo">
        <label htmlFor="int-resumo">{ehSessao ? 'O que foi conversado' : 'Resumo'}</label>
        <textarea id="int-resumo" rows={3} value={i.resumo} onChange={(e) => setI({ ...i, resumo: e.target.value })} placeholder={ehSessao ? 'ex.: Discutimos o recorte do tema; o capítulo 1 está descritivo demais.' : ''} />
      </div>

      <div className="campo">
        <label htmlFor="int-enc">Sugestões e comandos ao orientando</label>
        {i.encaminhamentos.length > 0 && (
          <ul className="ori-encaminhamentos">
            {i.encaminhamentos.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={`ori-tipo-enc ${e.tipo}`}
                  title="Trocar entre sugestão e comando"
                  onClick={() => setI({ ...i, encaminhamentos: i.encaminhamentos.map((x) => (x.id === e.id ? { ...x, tipo: x.tipo === 'comando' ? 'sugestao' : 'comando' } : x)) })}
                >
                  {e.tipo === 'comando' ? 'comando' : 'sugestão'}
                </button>
                <input aria-label="Texto" value={e.texto} onChange={(ev) => setI({ ...i, encaminhamentos: i.encaminhamentos.map((x) => (x.id === e.id ? { ...x, texto: ev.target.value } : x)) })} />
                <input type="date" aria-label="Prazo" value={e.prazo ?? ''} onChange={(ev) => setI({ ...i, encaminhamentos: i.encaminhamentos.map((x) => (x.id === e.id ? { ...x, prazo: ev.target.value || undefined } : x)) })} />
                <button type="button" className="link-discreto" onClick={() => setI({ ...i, encaminhamentos: i.encaminhamentos.filter((x) => x.id !== e.id) })}>
                  tirar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="ori-novo-enc">
          <select className="seletor" aria-label="Sugestão ou comando" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as Encaminhamento['tipo'])}>
            <option value="comando">comando (deve fazer)</option>
            <option value="sugestao">sugestão (pode fazer)</option>
          </select>
          <input
            id="int-enc"
            value={novoTexto}
            placeholder="ex.: Reescrever a introdução com o problema de pesquisa"
            onChange={(e) => setNovoTexto(e.target.value)}
            onPaste={(e) => {
              if (colarBloco(e.clipboardData.getData('text'))) e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                acrescentar();
              }
            }}
          />
          <input type="date" aria-label="Prazo (opcional)" title="Prazo (opcional)" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
          <button type="button" className="botao pequeno" onClick={acrescentar} disabled={!novoTexto.trim()}>
            Acrescentar
          </button>
        </div>
        <span className="ajuda" style={{ margin: 0 }}>
          Enter acrescenta. Dá para colar várias de uma vez (uma por linha, como a IA formata: "[comando]", "[sugestão]", "| até 30/11/2026", ou listas sob "Comandos:" e
          "Sugestões:"); sem marcação, vale o tipo escolhido ao lado. Ficam como pendências do orientando até você marcá-las como cumpridas.
        </span>
        {msgBloco && <span className="ori-msg-bloco">{msgBloco}</span>}
      </div>

      {anteriores.length > 0 && (
        <div className="campo">
          <label>Pendências anteriores: marque o que ele já cumpriu</label>
          <ul className="ori-pendencias">
            {anteriores.map((p) => (
              <li key={p.enc.id}>
                <input
                  type="checkbox"
                  id={`cump-${p.enc.id}`}
                  checked={cumpridas.includes(p.enc.id)}
                  onChange={(e) => setCumpridas(e.target.checked ? [...cumpridas, p.enc.id] : cumpridas.filter((x) => x !== p.enc.id))}
                />
                <span className={`ori-tipo-enc ${p.enc.tipo}`}>{p.enc.tipo === 'comando' ? 'comando' : 'sugestão'}</span>
                <label htmlFor={`cump-${p.enc.id}`} className="ori-pend-texto">
                  {p.enc.texto} <span className="ajuda">· {dataBR(p.interacao.em)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {versoes.length > 0 && (
        <div className="campo">
          <label htmlFor="int-versao">Versão do trabalho discutida (opcional)</label>
          <select id="int-versao" className="seletor" value={i.versaoId ?? ''} onChange={(e) => setI({ ...i, versaoId: e.target.value || null })}>
            <option value="">nenhuma</option>
            {versoes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.rotulo} ({dataBR(v.recebida_em)})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="modal-botoes">
        <button className="botao primario">{novo ? 'Registrar' : 'Salvar'}</button>
        <button type="button" className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <span className="ajuda" style={{ margin: 0 }}>
        Trabalho: {trabalho.titulo || trabalho.tipo}
      </span>
    </form>
  );
}

// ---------- Versões ----------

function Versoes({ trabalho, versoes, interacoes }: { trabalho: Trabalho; versoes: Versao[]; interacoes: Interacao[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [rotulo, setRotulo] = useState('');
  const [recebida, setRecebida] = useState(hojeISO());
  const [etapaId, setEtapaId] = useState(etapaAtual(trabalho)?.id ?? '');
  const [notas, setNotas] = useState('');
  const campoArquivo = useRef<HTMLInputElement>(null);
  const etapas = emOrdem(trabalho.etapas);
  return (
    <>
      <form
        className="cartao form-turma"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!arquivo) return;
          await adicionarVersao(trabalho.id, arquivo, { rotulo: rotulo.trim() || `Versão ${versoes.length + 1}`, recebida_em: recebida || hojeISO(), etapaId: etapaId || null, notas: notas.trim() });
          avisar('Versão guardada');
          setArquivo(null);
          setRotulo('');
          setNotas('');
          if (campoArquivo.current) campoArquivo.current.value = '';
        }}
      >
        <h3>Guardar uma versão</h3>
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="ver-arquivo">Arquivo (PDF, Word…)</label>
            <input id="ver-arquivo" ref={campoArquivo} type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.txt" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          <div className="campo">
            <label htmlFor="ver-rotulo">Nome da versão</label>
            <input id="ver-rotulo" value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder={`Versão ${versoes.length + 1}`} />
          </div>
          <div className="campo">
            <label htmlFor="ver-data">Recebida em</label>
            <input id="ver-data" type="date" value={recebida} onChange={(e) => setRecebida(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="ver-etapa">Etapa do cronograma</label>
            <select id="ver-etapa" className="seletor" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
              <option value="">nenhuma</option>
              {etapas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="ver-notas">Suas anotações sobre esta versão (opcional)</label>
          <textarea id="ver-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <div className="modal-botoes">
          <button className="botao primario" disabled={!arquivo}>
            Guardar versão
          </button>
        </div>
      </form>
      {!versoes.length ? (
        <p className="ajuda">Nenhuma versão guardada ainda. Mais adiante, o orientando poderá enviar as versões pela página dele.</p>
      ) : (
        <ol className="ori-linha-tempo">
          {versoes.map((v) => (
            <ItemVersao key={v.id} v={v} etapa={trabalho.etapas.find((x) => x.id === v.etapaId)?.nome} discutida={interacoes.filter((i) => i.versaoId === v.id)} />
          ))}
        </ol>
      )}
    </>
  );
}

function ItemVersao({ v, etapa, discutida }: { v: Versao; etapa?: string; discutida: Interacao[] }) {
  const [notas, setNotas] = useState(v.notas);
  const abrir = () => {
    const blob = new Blob([v.arquivo], { type: v.mime });
    if (v.mime === 'application/pdf') baixarArquivo(blob, v.nomeArquivo, true);
    else baixarArquivo(blob, v.nomeArquivo);
  };
  return (
    <li className="cartao ori-versao">
      <div className="ori-interacao-cab">
        <strong>{v.rotulo}</strong>
        <span className="ajuda" style={{ margin: 0 }}>
          recebida em {dataBR(v.recebida_em)}
          {etapa ? ` · ${etapa}` : ''} · {v.nomeArquivo} · {tamanhoLegivel(v.tamanho)}
        </span>
        <button className="botao pequeno" style={{ marginLeft: 'auto' }} onClick={abrir} disabled={!v.arquivo.size}>
          {v.mime === 'application/pdf' ? 'Abrir' : 'Baixar'}
        </button>
        <button
          className="link-discreto"
          style={{ marginLeft: 8 }}
          onClick={async () => {
            if (await confirmar({ titulo: `Apagar "${v.rotulo}"?`, texto: 'O arquivo sai deste computador e do Drive.', botao: 'Apagar', perigo: true })) await excluirVersao(v);
          }}
        >
          apagar
        </button>
      </div>
      {!v.arquivo.size && <p className="ajuda">O arquivo ainda está chegando do Drive.</p>}
      <textarea
        className="ori-notas"
        aria-label={`Anotações sobre ${v.rotulo}`}
        rows={2}
        placeholder="Anotações sobre esta versão"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        onBlur={() => notas !== v.notas && void salvarVersao({ ...v, notas })}
      />
      {discutida.length > 0 && <p className="ajuda">Discutida em: {discutida.map((i) => `${rotuloInteracao(i).toLowerCase()} de ${dataBR(i.em)}`).join('; ')}</p>}
    </li>
  );
}

// ---------- Modelos e orientações ----------

function ModelosOrientacao({ trabalhoId }: { trabalhoId: string | null }) {
  const [lista, setLista] = useState<Modelo[]>([]);
  const carregar = useCallback(() => void listarModelos().then((l) => setLista(l.filter((m) => m.trabalhoId === trabalhoId))), [trabalhoId]);
  useRecarga(carregar);
  const [tipo, setTipo] = useState<Modelo['tipo']>('arquivo');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [texto, setTexto] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const pode = titulo.trim() && (tipo === 'texto' ? texto.trim() : arquivo);
  return (
    <>
      {lista.length > 0 && (
        <ul className="ori-modelos">
          {lista.map((m) => (
            <ItemModelo key={m.id} m={m} />
          ))}
        </ul>
      )}
      <form
        className="ori-novo-modelo"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!pode) return;
          if (arquivo && arquivo.size > MAX_MODELO) {
            avisar('O arquivo passa de 10 MB.', 'erro');
            return;
          }
          await adicionarModelo({ titulo: titulo.trim(), descricao: descricao.trim(), tipo, texto: tipo === 'texto' ? texto.trim() : '', trabalhoId }, tipo === 'arquivo' ? arquivo! : undefined);
          avisar('Guardado');
          setTitulo('');
          setDescricao('');
          setTexto('');
          setArquivo(null);
          if (campo.current) campo.current.value = '';
        }}
      >
        <div className="linha-opcoes">
          <label className="ori-opcao">
            <input type="radio" name={`tipo-${trabalhoId ?? 'todos'}`} checked={tipo === 'arquivo'} onChange={() => setTipo('arquivo')} /> Arquivo (PDF, Word…)
          </label>
          <label className="ori-opcao">
            <input type="radio" name={`tipo-${trabalhoId ?? 'todos'}`} checked={tipo === 'texto'} onChange={() => setTipo('texto')} /> Orientação escrita
          </label>
        </div>
        <div className="grade-2">
          <div className="campo">
            <label htmlFor={`mod-titulo-${trabalhoId ?? 'todos'}`}>Título</label>
            <input id={`mod-titulo-${trabalhoId ?? 'todos'}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === 'arquivo' ? 'ex.: Manual de normalização (Uniftec)' : 'ex.: Como marcar as sessões'} />
          </div>
          <div className="campo">
            <label htmlFor={`mod-desc-${trabalhoId ?? 'todos'}`}>Descrição (opcional)</label>
            <input id={`mod-desc-${trabalhoId ?? 'todos'}`} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: Regras de formatação, citações e referências" />
          </div>
        </div>
        {tipo === 'arquivo' ? (
          <div className="campo">
            <label htmlFor={`mod-arq-${trabalhoId ?? 'todos'}`}>Arquivo (até 10 MB)</label>
            <input id={`mod-arq-${trabalhoId ?? 'todos'}`} ref={campo} type="file" onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArquivo(f);
              if (f && !titulo.trim()) setTitulo(f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '));
            }} />
          </div>
        ) : (
          <div className="campo">
            <label htmlFor={`mod-texto-${trabalhoId ?? 'todos'}`}>Texto</label>
            <textarea id={`mod-texto-${trabalhoId ?? 'todos'}`} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
        )}
        <div className="modal-botoes">
          <button className="botao primario" disabled={!pode}>
            Guardar
          </button>
        </div>
      </form>
    </>
  );
}

function ItemModelo({ m }: { m: Modelo }) {
  const [titulo, setTitulo] = useState(m.titulo);
  const [descricao, setDescricao] = useState(m.descricao);
  const [verTexto, setVerTexto] = useState(false);
  const trocar = useRef<HTMLInputElement>(null);
  const salvarCampos = () => (titulo.trim() !== m.titulo || descricao.trim() !== m.descricao) && titulo.trim() && void salvarModelo({ ...m, titulo: titulo.trim(), descricao: descricao.trim() });
  return (
    <li className="ori-modelo">
      <div className="ori-modelo-texto">
        <input className="ori-modelo-titulo" aria-label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={salvarCampos} />
        <input className="ori-modelo-desc" aria-label="Descrição" value={descricao} placeholder="descrição (opcional)" onChange={(e) => setDescricao(e.target.value)} onBlur={salvarCampos} />
        <span className="ajuda" style={{ margin: 0 }}>
          {m.tipo === 'arquivo' ? `${m.nomeArquivo} · ${tamanhoLegivel(m.tamanho)}${m.arquivo.size ? '' : ' · chegando do Drive…'}` : 'orientação escrita'}
        </span>
        {verTexto && <pre className="ori-colado">{m.texto}</pre>}
      </div>
      {m.tipo === 'arquivo' ? (
        <>
          <button type="button" className="botao pequeno" disabled={!m.arquivo.size} onClick={() => baixarArquivo(new Blob([m.arquivo], { type: m.mime }), m.nomeArquivo)}>
            Baixar
          </button>
          <button type="button" className="link-discreto" onClick={() => trocar.current?.click()}>
            trocar arquivo
          </button>
          <input
            ref={trocar}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > MAX_MODELO) return avisar('O arquivo passa de 10 MB.', 'erro');
              void salvarModelo({ ...m, arquivo: f, nomeArquivo: f.name, mime: f.type || 'application/octet-stream', tamanho: f.size }).then(() => avisar('Arquivo trocado'));
            }}
          />
        </>
      ) : (
        <button type="button" className="link-discreto" onClick={() => setVerTexto(!verTexto)}>
          {verTexto ? 'esconder' : 'ver o texto'}
        </button>
      )}
      <button
        type="button"
        className="link-discreto"
        onClick={async () => {
          if (await confirmar({ titulo: `Apagar "${m.titulo}"?`, texto: 'Sai deste computador, do Drive e das páginas dos orientandos.', botao: 'Apagar', perigo: true })) await excluirModelo(m);
        }}
      >
        apagar
      </button>
    </li>
  );
}

// ---------- Página do orientando ----------

function mensagemConvite(nome: string, url: string, pin: string): string {
  return `Olá${nome ? `, ${nome.split(' ')[0]}` : ''}! Esta é a sua página de orientação:
${url}
Código de acesso: ${pin}

Lá você acompanha o cronograma (com quanto falta para cada etapa), as pendências combinadas nas nossas conversas e os elementos do trabalho, e baixa os modelos e orientações (manual de normalização, modelo do trabalho). A página se atualiza sozinha.`;
}

function PaginaDoOrientando({ trabalho, orientando }: { trabalho: Trabalho; orientando?: Orientando }) {
  const [, recarregar] = useState(0);
  useEffect(() => assinarPublicacao(() => recarregar((n) => n + 1)), []);
  const [gerais, setGerais] = useState(0);
  const carregar = useCallback(() => void listarModelos().then((l) => setGerais(l.filter((m) => m.trabalhoId === null).length)), []);
  useRecarga(carregar);
  const [criando, setCriando] = useState(false);
  const pub = trabalho.publicacao;
  const estado = estadoPublicacao(trabalho.id);
  const nome = orientando?.nome ?? '';
  const tentar = async (op: () => Promise<unknown>, ok?: string) => {
    try {
      await op();
      if (ok) avisar(ok);
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  };
  return (
    <>
      <section className="cartao">
        <h3 style={{ marginTop: 0 }}>Página do orientando</h3>
        {!pub ? (
          <>
            <p className="ajuda">
              Um link só de {nome || 'orientando'}, protegido por um código de 6 números. Lá ele vê o cronograma (com quanto falta para cada etapa), as pendências (sugestões e comandos
              em aberto) e os elementos do trabalho, só para ler, e baixa os modelos e orientações. Não aparecem o e-mail, o telefone, as sessões, as conversas nem as versões. A página se
              atualiza sozinha quando você muda algo aqui.
            </p>
            <button className="botao escuro" disabled={criando} onClick={() => (setCriando(true), void tentar(() => publicarOrientacao(trabalho.id), 'Página criada').finally(() => setCriando(false)))}>
              {criando ? 'Criando…' : 'Criar a página do orientando'}
            </button>
          </>
        ) : (
          <>
            <div className="ori-pin">
              <span>Código de acesso</span>
              <strong className="mono">{pub.pin}</strong>
            </div>
            <LinkEQr url={urlDoOrientando(pub.codigo)} titulo={`Orientação · ${nome || trabalho.titulo}`} ajuda="Mande o link e o código ao orientando (de preferência por canais diferentes, ou pelo botão abaixo)." />
            <div className="linha-opcoes" style={{ marginTop: 10 }}>
              <button className="botao primario" onClick={async () => avisar((await copiar(mensagemConvite(nome, urlDoOrientando(pub.codigo), pub.pin))) ? 'Mensagem copiada: cole no WhatsApp ou no e-mail' : 'Este navegador não deixou copiar', 'ok')}>
                Copiar mensagem para o orientando
              </button>
              <a className="botao" href={urlDoOrientando(pub.codigo)} target="_blank" rel="noopener">
                Abrir a página
              </a>
              <button className="botao" disabled={estado?.tipo === 'enviando'} onClick={() => void tentar(() => publicarOrientacao(trabalho.id), 'Página atualizada')}>
                Atualizar agora
              </button>
            </div>
            <p className={`ajuda${estado?.tipo === 'erro' ? ' ori-erro' : ''}`}>
              {estado?.tipo === 'enviando'
                ? 'Atualizando a página…'
                : estado?.tipo === 'erro'
                  ? `A página não foi atualizada: ${estado.msg}`
                  : `Atualizada em ${new Date(pub.publicadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. As mudanças aqui vão para a página sozinhas.`}
            </p>
            <div className="linha-opcoes">
              <button
                className="link-discreto"
                style={{ marginLeft: 0 }}
                onClick={async () => {
                  if (await confirmar({ titulo: 'Trocar o código de acesso?', texto: 'O código antigo deixa de funcionar. O link continua o mesmo.', botao: 'Trocar' }))
                    await tentar(() => publicarOrientacao(trabalho.id, { trocarPin: true }), 'Código trocado');
                }}
              >
                trocar o código
              </button>
              <button
                className="link-discreto"
                onClick={async () => {
                  if (await confirmar({ titulo: 'Desativar a página do orientando?', texto: 'O link deixa de funcionar. Tudo continua guardado aqui; dá para criar uma página nova depois (com outro link).', botao: 'Desativar', perigo: true }))
                    await tentar(() => desativarOrientacao(trabalho.id), 'Página desativada');
                }}
              >
                desativar a página
              </button>
            </div>
          </>
        )}
      </section>
      <section className="cartao" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Modelos só deste orientando</h3>
        <p className="ajuda">
          Além dos {gerais} {gerais === 1 ? 'modelo geral' : 'modelos gerais'} (em Orientandos › Modelos e orientações), que aparecem para todos.
        </p>
        <ModelosOrientacao trabalhoId={trabalho.id} />
      </section>
    </>
  );
}

// ---------- Dados ----------

function Dados({ trabalho, orientando, aoAbrir, aoApagar }: { trabalho: Trabalho; orientando?: Orientando; aoAbrir: (id: string) => void; aoApagar: () => void }) {
  const [o, setO] = useState(orientando);
  const [t, setT] = useState({ titulo: trabalho.titulo, tipo: trabalho.tipo, inicio: trabalho.inicio, defesa: trabalho.defesa ?? '' });
  const [situacao, setSituacao] = useState(trabalho.situacao);
  const [outro, setOutro] = useState<{ titulo: string; tipo: TipoTrabalho; inicio: string; defesa: string } | null>(null);
  return (
    <>
      {o && (
        <form
          className="cartao form-turma"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!o.nome.trim()) return;
            await salvarOrientando({ ...o, nome: o.nome.trim() });
            avisar('Dados do orientando salvos');
          }}
        >
          <h3>Orientando</h3>
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="dad-nome">Nome</label>
              <input id="dad-nome" value={o.nome} onChange={(e) => setO({ ...o, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="dad-curso">Curso ou nível</label>
              <input id="dad-curso" value={o.curso} onChange={(e) => setO({ ...o, curso: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="dad-email">E-mail</label>
              <input id="dad-email" type="email" value={o.email} onChange={(e) => setO({ ...o, email: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="dad-tel">Telefone / WhatsApp</label>
              <input id="dad-tel" value={o.telefone} onChange={(e) => setO({ ...o, telefone: e.target.value })} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="dad-obs">Observações</label>
            <textarea id="dad-obs" rows={2} value={o.observacoes} onChange={(e) => setO({ ...o, observacoes: e.target.value })} />
          </div>
          <div className="modal-botoes">
            <button className="botao primario">Salvar</button>
          </div>
        </form>
      )}
      <form
        className="cartao form-turma"
        onSubmit={async (e) => {
          e.preventDefault();
          await atualizarTrabalho(trabalho.id, { titulo: t.titulo.trim(), tipo: t.tipo, inicio: t.inicio || trabalho.inicio, defesa: t.defesa || undefined, situacao });
          avisar('Dados do trabalho salvos');
        }}
      >
        <h3>Trabalho</h3>
        <CamposTrabalho v={t} mudar={(p) => setT({ ...t, ...p })} />
        <div className="campo">
          <label htmlFor="dad-sit">Situação</label>
          <select id="dad-sit" className="seletor" value={situacao} onChange={(e) => setSituacao(e.target.value as Trabalho['situacao'])}>
            <option value="andamento">em andamento</option>
            <option value="concluido">concluído</option>
            <option value="interrompido">interrompido</option>
          </select>
        </div>
        <p className="ajuda">Mudar o tipo ou as datas aqui não refaz o cronograma (ajuste as etapas em "Cronograma e pendências").</p>
        <div className="modal-botoes">
          <button className="botao primario">Salvar</button>
          <button
            type="button"
            className="botao perigo"
            onClick={async () => {
              if (!(await confirmar({ titulo: 'Apagar este trabalho?', texto: 'Saem também as sessões, as comunicações e as versões guardadas, deste computador e do Drive. A página do orientando é desativada.', botao: 'Apagar', perigo: true }))) return;
              if (trabalho.publicacao) await desativarOrientacao(trabalho.id).catch(() => undefined);
              await excluirTrabalho(trabalho);
              avisar('Trabalho apagado');
              aoApagar();
            }}
          >
            Apagar o trabalho
          </button>
        </div>
      </form>
      {o &&
        (outro ? (
          <form
            className="cartao form-turma"
            onSubmit={async (e) => {
              e.preventDefault();
              const novo = await criarTrabalho(o.id, { ...outro, titulo: outro.titulo.trim() });
              avisar('Novo trabalho criado');
              aoAbrir(novo.id);
            }}
          >
            <h3>Novo trabalho de {o.nome}</h3>
            <CamposTrabalho v={outro} mudar={(p) => setOutro({ ...outro, ...p })} />
            <div className="modal-botoes">
              <button className="botao primario">Criar</button>
              <button type="button" className="botao" onClick={() => setOutro(null)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button className="botao pequeno com-icone" onClick={() => setOutro({ titulo: '', tipo: 'Dissertação', inicio: hojeISO(), defesa: '' })}>
            <IcMais tamanho={14} /> Outro trabalho de {o.nome} (ex.: do TCC para o mestrado)
          </button>
        ))}
    </>
  );
}
