// Orientação de trabalhos acadêmicos: orientandos, cronograma com prazos, sessões e
// comunicações (com sugestões e comandos), e as versões provisórias do trabalho.
// Esta tela é carregada só quando aberta (não pesa na aula).
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { avisar, confirmar } from '../comum/avisos';
import { IcLixeira, IcMais, IcX } from '../comum/Icones';
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
import { naturezaPadrao } from '../orientacao/campos';
import { emAberto, lerApontamentos, type Apontamento } from '../orientacao/apontamentos';
import { LerEComentar } from './LerEComentar';
import { lerEncaminhamentos, lerRespostaIA, pedidoRegistroIA } from '../orientacao/ia';
import type { OpcoesRelatorio } from '../orientacao/relatorioPdf';
import { assinarPublicacao, buscarEnvios, configPreProjetoPadrao, desativarOrientacao, estadoPublicacao, formatoDoTexto, guardarRascunho, lerRascunho, MAX_MODELO, pdfDoPreProjeto, publicarOrientacao, urlDoOrientando, wordDoPreProjeto } from '../orientacao/publicar';
import { QR } from './JogoTela';
import { copiar } from './ProcessoTexto';
import { agoraLocal, dataBR, dataHoraBR, diasEntre, emOrdem, etapaAtual, hojeISO, pendencias, precisao, rotuloDias, rotuloPrazo, rotuloPrazoCurto, rotuloSituacao, situacaoEtapa, type Pendencia, type Precisao } from '../orientacao/prazos';
import { CANAIS, ELEMENTOS_VAZIOS, TIPOS_TRABALHO, type Elementos, type Canal, type ConfigPreProjeto, type Encaminhamento, type Interacao, type Modelo, type Orientando, type Trabalho, type TipoTrabalho, type Versao } from '../orientacao/tipos';
import { Reconhecedor, obterConstrutor, type StatusVoz } from '../voz/reconhecedor';
import { controlador } from './controlador';
import { Figura } from './ConsultaTela';
import { Pagina } from './Pagina';

const nomeCanal = (c: Canal) => CANAIS.find((x) => x.id === c)?.nome ?? c;

function rotuloInteracao(i: Interacao): string {
  if (i.canal === 'sessao') return `Sessão de orientação${i.modo ? ` (${i.modo})` : ''}`;
  return nomeCanal(i.canal);
}

/** "não cumprido" (comando) ou "rejeitada" (sugestão). */
function rotuloNao(tipo: Encaminhamento['tipo']): string {
  return tipo === 'comando' ? 'não cumprido' : 'rejeitada';
}

/** Os dois botões de cada sugestão ou comando: ✕ (não cumprido/rejeitada, ou desfazer) e lixeira (apagar de vez). */
function AcoesEnc({ e, aoMarcar, aoApagar }: { e: Pick<Encaminhamento, 'tipo' | 'texto' | 'situacao'>; aoMarcar: () => void; aoApagar: () => void }) {
  const nao = e.situacao === 'descartado';
  const rotulo = nao ? `Desfazer "${rotuloNao(e.tipo)}" (volta a ficar pendente)` : e.tipo === 'comando' ? 'Registrar como não cumprido (fica guardado, riscado)' : 'Registrar como rejeitada (fica guardada, riscada)';
  return (
    <span className="ori-acoes-enc">
      <button type="button" className={`ori-icone nao${nao ? ' ativo' : ''}`} title={rotulo} aria-label={`${rotulo}: ${e.texto}`} onClick={aoMarcar}>
        <IcX tamanho={15} />
      </button>
      <button type="button" className="ori-icone lixo" title="Apagar de vez (não fica registrado)" aria-label={`Apagar: ${e.texto}`} onClick={aoApagar}>
        <IcLixeira tamanho={15} />
      </button>
    </span>
  );
}

const confirmarApagarEnc = (texto: string) =>
  confirmar({ titulo: 'Apagar de vez?', texto: `"${texto}" sai do registro, sem ficar como não cumprido. Para guardar o registro, use o ✕.`, botao: 'Apagar', perigo: true });

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
function Silhueta({ tamanho = 34 }: { tamanho?: number }) {
  return (
    <svg className="ori-silhueta" viewBox="0 0 32 32" width={tamanho} height={tamanho} aria-hidden="true">
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
  // Envios do pré-projeto feitos pelos orientandos: chegam como versões (ao abrir, ao voltar à aba e a cada 5 minutos).
  useEffect(() => {
    const buscar = async () => {
      const ts = (await listarTrabalhos()).filter((t) => t.publicacao && t.preProjeto?.ativo);
      const nomes = await listarOrientandos();
      for (const t of ts) {
        // Cópia de segurança do rascunho do orientando (no computador e no Drive).
        await guardarRascunho(t.id).catch(() => false);
        const n = await buscarEnvios(t.id).catch(() => 0);
        if (n) avisar(`${nomes.find((o) => o.id === t.orientandoId)?.nome ?? 'Um orientando'} enviou ${n === 1 ? 'uma versão' : `${n} versões`} do pré-projeto (está em Versões).`);
      }
    };
    void buscar();
    window.addEventListener('focus', buscar);
    const t = window.setInterval(() => void buscar(), 5 * 60_000);
    return () => {
      window.removeEventListener('focus', buscar);
      window.clearInterval(t);
    };
  }, []);
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

  return (
    <Pagina
      caminho="Orientação"
      titulo="Orientandos"
      acoes={
        <>
          <MenuMais itens={[{ rotulo: 'Modelos e orientações', desc: 'Manual, modelo do trabalho, orientações para todos', aoClicar: () => setVerModelos(true) }]} />
          {!criando && (
            <button className="botao escuro com-icone" onClick={() => setCriando(true)}>
              <IcMais tamanho={16} /> Novo orientando
            </button>
          )}
        </>
      }
    >
      {verModelos && (
        <Janela titulo="Modelos e orientações" aoFechar={() => setVerModelos(false)}>
          <p className="ajuda" style={{ marginTop: 0 }}>
            Valem para todos os orientandos e aparecem para baixar na página de cada um. Para um orientando só, use Ajustes, no orientando.
          </p>
          <ModelosOrientacao trabalhoId={null} />
        </Janela>
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
        <ListaOrientandos trabalhos={trabalhos} orientandos={orientandos} interacoes={interacoes} aoAbrir={abrir} />
      )}
    </Pagina>
  );
}

/** "hoje", "ontem", "há 5 dias", "há 2 semanas", "12/03/2026". */
function relativo(iso: string, hoje = hojeISO()): string {
  const d = -diasEntre(hoje, iso.slice(0, 10));
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 14) return `há ${d} dias`;
  if (d < 60) return `há ${Math.floor(d / 7)} semanas`;
  return dataBR(iso);
}

type Filtro = 'andamento' | 'atraso' | 'encerrados';

function ListaOrientandos({ trabalhos, orientandos, interacoes, aoAbrir }: { trabalhos: Trabalho[]; orientandos: Orientando[]; interacoes: Interacao[]; aoAbrir: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('andamento');
  const [busca, setBusca] = useState('');
  const hoje = hojeISO();
  const linhas = trabalhos.map((t) => {
    const o = orientandos.find((x) => x.id === t.orientandoId);
    const dele = interacoes.filter((i) => i.trabalhoId === t.id);
    const e = etapaAtual(t);
    const s = e && situacaoEtapa(e, hoje);
    const vencidas = pendenciasVencidas(dele, [t], hoje).length;
    return { t, o, dele, e, s, vencidas, pend: pendencias(dele).length, ultima: dele[0], feitas: t.etapas.filter((x) => x.concluida_em).length, atraso: t.situacao === 'andamento' && (vencidas > 0 || s?.tipo === 'atrasada') };
  });
  const contagem = {
    andamento: linhas.filter((l) => l.t.situacao === 'andamento').length,
    atraso: linhas.filter((l) => l.atraso).length,
    encerrados: linhas.filter((l) => l.t.situacao !== 'andamento').length,
  };
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const visiveis = linhas
    .filter((l) => (filtro === 'andamento' ? l.t.situacao === 'andamento' : filtro === 'atraso' ? l.atraso : l.t.situacao !== 'andamento'))
    .filter((l) => !termo || `${l.o?.nome ?? ''} ${l.t.titulo}`.toLocaleLowerCase('pt-BR').includes(termo))
    .sort((a, b) => (a.e?.prazo ?? '9999').localeCompare(b.e?.prazo ?? '9999'));
  return (
    <>
      <div className="ori-filtros">
        {(
          [
            ['andamento', 'Em andamento'],
            ['atraso', 'Com atraso'],
            ['encerrados', 'Concluídos'],
          ] as [Filtro, string][]
        ).map(([f, r]) => (
          <button key={f} type="button" className={`ori-chip${filtro === f ? ' ativo' : ''}`} onClick={() => setFiltro(f)}>
            {f === 'atraso' && contagem.atraso > 0 && <span className="ori-ponto" />}
            {r} <span className="ori-chip-n">{contagem[f]}</span>
          </button>
        ))}
        <input className="ori-busca" type="search" placeholder="Buscar orientando…" aria-label="Buscar orientando" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {!visiveis.length ? (
        <p className="ajuda">{termo ? 'Ninguém com esse nome.' : filtro === 'atraso' ? 'Ninguém com atraso. 🎉' : filtro === 'encerrados' ? 'Nenhum trabalho concluído ou interrompido.' : 'Nenhum orientando em andamento.'}</p>
      ) : (
        <div className="ori-lista" role="list">
          <div className="ori-lista-cab" aria-hidden="true">
            <span>Orientando</span>
            <span>Cronograma</span>
            <span>Próximo prazo</span>
            <span>Pendências</span>
            <span>Último contato</span>
            <span />
          </div>
          {visiveis.map(({ t, o, e, s, vencidas, pend, ultima, feitas }) => (
            <button key={t.id} type="button" role="listitem" className="ori-linha" onClick={() => aoAbrir(t.id)}>
              <span className="ori-pessoa">
                <Silhueta />
                <span style={{ minWidth: 0 }}>
                  <strong>{o?.nome ?? 'Orientando'}</strong>
                  <span className="ori-sub">
                    {t.tipo} · {t.titulo || 'sem título'}
                  </span>
                </span>
              </span>
              <span className="ori-progresso">
                <span className="ori-barra">
                  <i style={{ width: `${t.etapas.length ? (feitas / t.etapas.length) * 100 : 0}%` }} />
                </span>
                {feitas} de {t.etapas.length} etapas
              </span>
              <span className="ori-prazo-col">
                {t.situacao !== 'andamento' ? (
                  <span className="ori-sub">{t.situacao === 'concluido' ? 'concluído' : 'interrompido'}</span>
                ) : e && s ? (
                  <>
                    <strong>{e.nome}</strong>
                    <span className={`ori-quando ${s.tipo}`}>{s.tipo === 'futura' ? `${rotuloPrazoCurto(e.prazo)} · ${rotuloDias(s.dias)}` : rotuloSituacao(e, hoje)}</span>
                  </>
                ) : (
                  <span className="ori-sub">cronograma cumprido ✓</span>
                )}
              </span>
              <span className="ori-pend-col">
                {vencidas > 0 && <span className="ori-ponto" />}
                <strong>{pend}</strong>
                <span className="ori-so-celular">{pend === 1 ? 'pendência' : 'pendências'}</span>
                {vencidas > 0 && <span className="ori-sub"> · {vencidas} {vencidas === 1 ? 'vencida' : 'vencidas'}</span>}
              </span>
              <span className="ori-contato">
                {ultima ? (
                  <>
                    {relativo(ultima.em, hoje)}
                    <span className="ori-sub">{nomeCanal(ultima.canal).replace('Sessão de orientação', 'sessão')}</span>
                  </>
                ) : (
                  <span className="ori-sub">nenhum</span>
                )}
              </span>
              <span className="ori-seta" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </div>
      )}
    </>
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
      <p className="ajuda">
        O Vide monta um cronograma sugerido para o tipo de trabalho, com os prazos espalhados até a defesa (ou de 30 em 30 dias). No TCC e na monografia: definição do tema, pré-projeto
        (Grau A), Capítulo 1 (Grau B) e revisão, Capítulo 2 (Grau A) e revisão, trabalho completo, revisão final, depósito da versão impressa e defesa. Você ajusta depois.
      </p>
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

type Aba = 'visao' | 'tempo' | 'trabalho' | 'ajustes';

function TrabalhoDetalhe({ trabalho, orientando, aoVoltar, aoAbrir }: { trabalho: Trabalho; orientando?: Orientando; aoVoltar: () => void; aoAbrir: (id: string) => void }) {
  const [aba, setAba] = useState<Aba>('visao');
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [registrando, setRegistrando] = useState<Interacao | null>(null);
  const [janela, setJanela] = useState<'' | 'relatorio' | 'compartilhar'>('');
  const [menuRegistrar, setMenuRegistrar] = useState(false);
  const carregar = useCallback(() => {
    void listarInteracoes(trabalho.id).then(setInteracoes);
    void listarVersoes(trabalho.id).then(setVersoes);
  }, [trabalho.id]);
  useRecarga(carregar);
  const registrar = (canal: Canal) => {
    setRegistrando(interacaoEmBranco(trabalho.id, canal, agoraLocal()));
    setMenuRegistrar(false);
  };
  const situacao = trabalho.situacao === 'andamento' ? 'em andamento' : trabalho.situacao === 'concluido' ? 'concluído' : 'interrompido';
  return (
    <div className="pagina ori-detalhe">
      <button type="button" className="ori-voltar" onClick={aoVoltar}>
        ‹ Orientandos
      </button>
      <header className="ori-cab">
        <Silhueta tamanho={52} />
        <div className="ori-cab-texto">
          <h1>{orientando?.nome ?? 'Orientando'}</h1>
          <div className="ori-cab-linha">
            <span className="ori-selo">{trabalho.tipo}</span>
            <span className={`ori-selo ${trabalho.situacao}`}>{situacao}</span>
            <span className="ori-cab-titulo">
              {trabalho.titulo || 'sem título'}
              {trabalho.defesa ? ` · defesa em ${dataBR(trabalho.defesa).slice(0, 5)}` : ''}
            </span>
          </div>
        </div>
        <div className="ori-cab-acoes">
          <button type="button" className="botao" onClick={() => setJanela('compartilhar')}>
            Compartilhar
          </button>
          <span className="ori-split">
            <button type="button" className="botao escuro" onClick={() => registrar('sessao')}>
              + Registrar sessão
            </button>
            <button type="button" className="botao escuro" aria-label="Outras formas de registrar" aria-expanded={menuRegistrar} onClick={() => setMenuRegistrar(!menuRegistrar)}>
              ▾
            </button>
            {menuRegistrar && (
              <Menu aoFechar={() => setMenuRegistrar(false)} itens={[{ rotulo: 'Registrar comunicação', desc: 'WhatsApp, e-mail, telefone', aoClicar: () => registrar('whatsapp') }]} />
            )}
          </span>
          <MenuMais
            itens={[
              { rotulo: 'Relatório em PDF', aoClicar: () => setJanela('relatorio') },
              { rotulo: 'Modelos deste orientando', aoClicar: () => setAba('ajustes') },
              { rotulo: 'Voltar à lista', aoClicar: aoVoltar },
            ]}
          />
        </div>
      </header>
      <nav className="ori-abas" aria-label="Partes da orientação">
        {(
          [
            ['visao', 'Visão geral', 0],
            ['tempo', 'Linha do tempo', interacoes.length + versoes.length],
            ['trabalho', 'Trabalho', 0],
            ['ajustes', 'Ajustes', 0],
          ] as [Aba, string, number][]
        ).map(([a, r, n]) => (
          <button key={a} type="button" className={`ori-aba${aba === a ? ' atual' : ''}`} aria-current={aba === a ? 'page' : undefined} onClick={() => setAba(a)}>
            {r}
            {n > 0 && <span className="ori-aba-n">{n}</span>}
          </button>
        ))}
      </nav>
      {aba === 'visao' && (
        <VisaoGeral
          trabalho={trabalho}
          interacoes={interacoes}
          versoes={versoes}
          aoRegistrar={() => registrar('sessao')}
          aoLinhaDoTempo={() => setAba('tempo')}
          aoCompartilhar={() => setJanela('compartilhar')}
          orientando={orientando}
        />
      )}
      {aba === 'tempo' && <LinhaDoTempo trabalho={trabalho} orientando={orientando} interacoes={interacoes} versoes={versoes} aoEditar={setRegistrando} aoRegistrar={registrar} />}
      {aba === 'trabalho' && (
        <>
          <ElementosTrabalho trabalho={trabalho} />
          <PreProjetoCartao trabalho={trabalho} orientando={orientando} aoCompartilhar={() => setJanela('compartilhar')} />
        </>
      )}
      {aba === 'ajustes' && (
        <>
          <Dados trabalho={trabalho} orientando={orientando} aoAbrir={aoAbrir} aoApagar={aoVoltar} />
          <ModelosDoOrientando trabalho={trabalho} />
        </>
      )}
      {janela === 'relatorio' && (
        <Janela titulo="Relatório em PDF" aoFechar={() => setJanela('')}>
          <PainelRelatorio trabalho={trabalho} orientando={orientando} interacoes={interacoes} versoes={versoes} aoFechar={() => setJanela('')} />
        </Janela>
      )}
      {janela === 'compartilhar' && <JanelaCompartilhar trabalho={trabalho} orientando={orientando} aoFechar={() => setJanela('')} />}
      {registrando && (
        <FormInteracao key={registrando.id} inicial={registrando} trabalho={trabalho} interacoes={interacoes} versoes={versoes} nome={orientando?.nome} aoFechar={() => setRegistrando(null)} />
      )}
    </div>
  );
}

// ---------- Visão geral ----------

function VisaoGeral({
  trabalho,
  interacoes,
  versoes,
  aoRegistrar,
  aoLinhaDoTempo,
  aoCompartilhar,
  orientando,
}: {
  trabalho: Trabalho;
  interacoes: Interacao[];
  versoes: Versao[];
  aoRegistrar: () => void;
  aoLinhaDoTempo: () => void;
  aoCompartilhar: () => void;
  orientando?: Orientando;
}) {
  const [editarCrono, setEditarCrono] = useState(false);
  const [todas, setTodas] = useState(false);
  const hoje = hojeISO();
  const pend = pendencias(interacoes);
  const e = etapaAtual(trabalho);
  const s = e && situacaoEtapa(e, hoje);
  const etapas = emOrdem(trabalho.etapas);
  const feitas = etapas.filter((x) => x.concluida_em).length;
  const atividades = [
    ...interacoes.map((i) => ({ em: i.em, tipo: i.canal === 'sessao' ? 'S' : i.canal === 'whatsapp' ? 'W' : i.canal === 'email' ? 'E' : 'C', titulo: rotuloInteracao(i), detalhe: [i.encaminhamentos.length ? `${i.encaminhamentos.length} ${i.encaminhamentos.length === 1 ? 'tarefa' : 'tarefas'}` : '', i.transcricao?.trim() ? 'transcrita' : '', i.canal !== 'sessao' ? i.resumo.slice(0, 50) : ''].filter(Boolean).join(' · ') })),
    ...versoes.map((v) => ({ em: `${v.recebida_em}T${v.criado_em.slice(11, 16) || '00:00'}`, tipo: 'V', titulo: v.rotulo, detalhe: v.nomeArquivo })),
  ]
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, 4);
  const pub = trabalho.publicacao;
  return (
    <div className="ori-painel">
      <div className="ori-painel-col">
        <section className="ori-card">
          <h3 className="ori-card-titulo">Próximo prazo</h3>
          {trabalho.situacao !== 'andamento' ? (
            <p className="ori-calmo">Trabalho {trabalho.situacao === 'concluido' ? 'concluído' : 'interrompido'}.</p>
          ) : e && s ? (
            <div className="ori-proximo">
              <div>
                <div className="ori-proximo-nome">{e.nome}</div>
                <div className="ori-calmo">prazo {rotuloPrazo(e.prazo)} · a etapa da vez no cronograma</div>
              </div>
              <span className={`ori-tag ${s.tipo}`}>{rotuloSituacao(e, hoje)}</span>
            </div>
          ) : (
            <p className="ori-calmo">Cronograma cumprido ✓</p>
          )}
        </section>

        <section className="ori-card">
          <div className="ori-card-cab">
            <h3 className="ori-card-titulo">Pendências{pend.length ? ` · ${pend.length}` : ''}</h3>
            {pend.length > 5 && (
              <button type="button" className="ori-card-acao" onClick={() => setTodas(!todas)}>
                {todas ? 'Ver menos' : 'Ver todas'}
              </button>
            )}
          </div>
          {!pend.length ? (
            <p className="ori-calmo">
              Nenhuma pendência em aberto.{' '}
              <button type="button" className="ori-link" onClick={aoRegistrar}>
                Registrar uma sessão
              </button>{' '}
              para anotar as tarefas do orientando.
            </p>
          ) : (
            <ul className="ori-pend-lista">
              {(todas ? pend : pend.slice(0, 5)).map((p) => {
                const sp = p.enc.prazo ? situacaoEtapa({ id: '', nome: '', prazo: p.enc.prazo }, hoje) : null;
                return (
                  <li key={p.enc.id}>
                    <input type="checkbox" aria-label={`Cumprido: ${p.enc.texto}`} onChange={() => void resolverPendencia(p, 'cumprido')} />
                    <span className={`ori-tipo-enc ${p.enc.tipo}`}>{p.enc.tipo === 'comando' ? 'comando' : 'sugestão'}</span>
                    <span className="ori-pend-texto" title={`${rotuloInteracao(p.interacao)} de ${dataBR(p.interacao.em)}`}>
                      {p.enc.texto}
                    </span>
                    <span className={`ori-quando ${sp ? sp.tipo : 'futura'}`}>{sp ? rotuloDias(sp.dias) : 'sem prazo'}</span>
                    <AcoesEnc
                      e={p.enc}
                      aoMarcar={() => void resolverPendencia(p, 'descartado')}
                      aoApagar={async () => {
                        if (await confirmarApagarEnc(p.enc.texto)) await salvarInteracao({ ...p.interacao, encaminhamentos: p.interacao.encaminhamentos.filter((x) => x.id !== p.enc.id) });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="ori-card">
          <div className="ori-card-cab">
            <h3 className="ori-card-titulo">
              Cronograma · {feitas} de {etapas.length}
            </h3>
            <button type="button" className="ori-card-acao" onClick={() => setEditarCrono(!editarCrono)}>
              Editar
            </button>
          </div>
          {editarCrono && (
            <Janela titulo="Editar o cronograma" aoFechar={() => setEditarCrono(false)} largo>
              <Cronograma trabalho={trabalho} embutido />
              <div className="modal-botoes ori-janela-pe">
                <button type="button" className="botao escuro" onClick={() => setEditarCrono(false)}>
                  Pronto
                </button>
              </div>
            </Janela>
          )}
          {!etapas.length ? (
            <p className="ori-calmo">Sem etapas. Clique em Editar para montar o cronograma.</p>
          ) : (
            <div className="ori-marcos" style={{ ['--feito' as string]: `${etapas.length > 1 ? (Math.max(0, feitas - 1) / (etapas.length - 1)) * 100 : 0}%` }}>
              {etapas.map((x) => {
                const sx = situacaoEtapa(x, hoje);
                return (
                  <div key={x.id} className={`ori-marco ${sx.tipo}`} title={`${x.nome} · ${rotuloPrazo(x.prazo)} · ${rotuloSituacao(x, hoje)}`}>
                    <i />
                    <span>{x.nome}</span>
                    <small>{rotuloPrazoCurto(x.prazo)}</small>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="ori-painel-col">
        <section className="ori-card">
          <div className="ori-card-cab">
            <h3 className="ori-card-titulo">Últimas atividades</h3>
            {atividades.length > 0 && (
              <button type="button" className="ori-card-acao" onClick={aoLinhaDoTempo}>
                Linha do tempo
              </button>
            )}
          </div>
          {!atividades.length ? (
            <p className="ori-calmo">Nada registrado ainda.</p>
          ) : (
            <ul className="ori-ativ">
              {atividades.map((x, k) => (
                <li key={k}>
                  <span className={`ori-ativ-ic t-${x.tipo}`}>{x.tipo}</span>
                  <span style={{ minWidth: 0 }}>
                    <strong>{x.titulo}</strong>
                    <span className="ori-sub">
                      {relativo(x.em, hoje)}
                      {x.detalhe ? ` · ${x.detalhe}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="ori-card">
          <div className="ori-card-cab">
            <h3 className="ori-card-titulo">Página do orientando</h3>
            <button type="button" className="ori-card-acao" onClick={aoCompartilhar}>
              Compartilhar
            </button>
          </div>
          {!pub ? (
            <p className="ori-calmo">Ainda não compartilhada. Uma página só dele, com cronograma, pendências e modelos.</p>
          ) : (
            <>
              <p className="ori-estado">
                <span className="ori-ponto verde" /> Ativa · código <strong className="mono">{pub.pin}</strong>
              </p>
              <button
                type="button"
                className="botao escuro pequeno ori-largo"
                style={{ margin: '4px 0 8px', whiteSpace: 'normal' }}
                title="Copia a saudação, o link e o código de acesso, para colar no WhatsApp ou no e-mail"
                onClick={() => void copiarMensagem(orientando?.nome ?? '', trabalho)}
              >
                Copiar mensagem ao orientando
              </button>
              <CombinadoLido trabalho={trabalho} />
              <div className="ori-info">
                <span>Formulário</span>
                <strong>{trabalho.preProjeto?.ativo ? (trabalho.preProjeto.formato === 'final' ? 'trabalho final' : 'pré-projeto') : 'desligado'}</strong>
              </div>
              {trabalho.preProjeto?.ativo && (
                <div className="ori-info">
                  <span>Último envio</span>
                  <strong>{pub.ultimoEnvio ? new Date(pub.ultimoEnvio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nenhum'}</strong>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Se o orientando já confirmou a leitura do combinado de orientação. */
function CombinadoLido({ trabalho }: { trabalho: Trabalho }) {
  const pub = trabalho.publicacao;
  const [lido, setLido] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!pub) return;
    let vivo = true;
    void fetch(`/api/orientacao/${pub.codigo}/combinado`, { headers: { 'X-Vide-Chave': pub.chave } })
      .then(async (r) => (r.ok ? ((await r.json()) as { lidoEm: string | null }).lidoEm : undefined))
      .then((x) => vivo && setLido(x), () => undefined);
    return () => {
      vivo = false;
    };
  }, [pub]);
  if (lido === undefined) return null;
  return (
    <div className="ori-info">
      <span>Combinado de orientação</span>
      {lido ? (
        <strong>lido em {new Date(lido).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong>
      ) : (
        <strong className="ori-combinado-pendente">
          <span className="ori-ponto amarelo" /> ainda não lido
        </strong>
      )}
    </div>
  );
}

// ---------- Menus e janelas ----------

interface ItemMenu {
  rotulo: string;
  desc?: string;
  aoClicar: () => void;
}

function Menu({ itens, aoFechar }: { itens: ItemMenu[]; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && aoFechar();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.setTimeout(() => window.addEventListener('mousedown', fora), 0);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [aoFechar]);
  return (
    <div ref={ref} className="ori-menu" role="menu">
      {itens.map((it) => (
        <button
          key={it.rotulo}
          type="button"
          role="menuitem"
          onClick={() => {
            aoFechar();
            it.aoClicar();
          }}
        >
          {it.rotulo}
          {it.desc && <small>{it.desc}</small>}
        </button>
      ))}
    </div>
  );
}

function MenuMais({ itens }: { itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="ori-menu-caixa">
      <button type="button" className="botao ori-mais" aria-label="Mais opções" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        ···
      </button>
      {aberto && <Menu itens={itens} aoFechar={() => setAberto(false)} />}
    </span>
  );
}

function Janela({ titulo, aoFechar, children, largo = false }: { titulo: string; aoFechar: () => void; children: React.ReactNode; largo?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal ori-janela${largo ? ' largo' : ''}`} role="dialog" aria-label={titulo}>
        <div className="ori-janela-cab">
          <h2>{titulo}</h2>
          <button type="button" className="ori-icone" aria-label="Fechar" onClick={aoFechar}>
            <IcX tamanho={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
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

/** Prazo de uma etapa: data completa, só mês e ano, só o ano, ou a definir. */
function CampoPrazo({ nome, valor, aoMudar }: { nome: string; valor: string; aoMudar: (v: string) => void }) {
  const p = precisao(valor);
  const [ano, setAno] = useState(valor.slice(0, 4));
  useEffect(() => setAno(valor.slice(0, 4)), [valor]);
  const trocar = (nova: Precisao) => {
    const a = /^\d{4}/.test(valor) ? valor.slice(0, 4) : String(new Date().getFullYear());
    const m = /^\d{4}-\d{2}/.test(valor) ? valor.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, '0');
    const d = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.slice(8, 10) : '01';
    aoMudar(nova === 'dia' ? `${a}-${m}-${d}` : nova === 'mes' ? `${a}-${m}` : nova === 'ano' ? a : '');
  };
  return (
    <span className="ori-prazo-campo">
      {p === 'dia' && <input type="date" aria-label={`Prazo: ${nome}`} value={valor} onChange={(ev) => ev.target.value && aoMudar(ev.target.value)} />}
      {p === 'mes' && <input type="month" aria-label={`Mês e ano: ${nome}`} value={valor} onChange={(ev) => /^\d{4}-\d{2}$/.test(ev.target.value) && aoMudar(ev.target.value)} />}
      {p === 'ano' && (
        <input
          inputMode="numeric"
          maxLength={4}
          aria-label={`Ano: ${nome}`}
          className="ori-prazo-ano"
          value={ano}
          onChange={(ev) => {
            const v = ev.target.value.replace(/\D/g, '').slice(0, 4);
            setAno(v);
            if (v.length === 4) aoMudar(v);
          }}
        />
      )}
      {p === 'indefinida' && <span className="ori-calmo">a definir</span>}
      <select aria-label={`Tipo de prazo: ${nome}`} value={p} onChange={(ev) => trocar(ev.target.value as Precisao)} title="Data completa, só mês e ano, só o ano, ou a definir">
        <option value="dia">data</option>
        <option value="mes">mês/ano</option>
        <option value="ano">só o ano</option>
        <option value="indefinida">a definir</option>
      </select>
    </span>
  );
}

function Cronograma({ trabalho, embutido = false }: { trabalho: Trabalho; embutido?: boolean }) {
  const [t, mudar] = useRascunho(trabalho, (v) => atualizarTrabalho(v.id, { etapas: v.etapas }));
  const hoje = hojeISO();
  const etapas = t.etapas;
  const mudarEtapa = (id: string, p: Partial<Trabalho['etapas'][number]>) => mudar({ ...t, etapas: etapas.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const ordenadas = emOrdem(etapas);
  const Caixa = embutido ? 'div' : 'section';
  return (
    <Caixa className={embutido ? undefined : 'cartao'}>
      {!embutido && <h3 style={{ marginTop: 0 }}>Cronograma</h3>}
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
                  <CampoPrazo nome={e.nome} valor={e.prazo} aoMudar={(prazo) => mudarEtapa(e.id, { prazo })} />
                </td>
                <td className="ori-etapa-situacao">{rotuloSituacao(e, hoje)}</td>
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
      <p className="ajuda">Prazos em dias corridos. Marque a etapa quando o orientando a cumprir.</p>
    </Caixa>
  );
}

async function resolverPendencia(p: Pendencia, situacao: Encaminhamento['situacao']) {
  const i = p.interacao;
  await salvarInteracao({ ...i, encaminhamentos: i.encaminhamentos.map((e) => (e.id === p.enc.id ? { ...e, situacao, resolvido_em: situacao === 'pendente' ? null : hojeISO() } : e)) });
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

type FiltroTempo = 'tudo' | 'sessoes' | 'comunicacoes' | 'versoes';

/** Sessões, comunicações e versões numa linha do tempo só, da mais nova para a mais antiga, por mês. */
function LinhaDoTempo({ trabalho, orientando, interacoes, versoes, aoEditar, aoRegistrar }: { trabalho: Trabalho; orientando?: Orientando; interacoes: Interacao[]; versoes: Versao[]; aoEditar: (i: Interacao) => void; aoRegistrar: (c: Canal) => void }) {
  const [filtro, setFiltro] = useState<FiltroTempo>('tudo');
  const [novaVersao, setNovaVersao] = useState(false);
  const [lendo, setLendo] = useState<Versao | null>(null);
  const sessoes = interacoes.filter((i) => i.canal === 'sessao');
  const comunicacoes = interacoes.filter((i) => i.canal !== 'sessao');
  type Item = { em: string; i?: Interacao; v?: Versao };
  const itens: Item[] = [
    ...(filtro === 'tudo' || filtro === 'sessoes' ? sessoes.map((i) => ({ em: i.em, i })) : []),
    ...(filtro === 'tudo' || filtro === 'comunicacoes' ? comunicacoes.map((i) => ({ em: i.em, i })) : []),
    ...(filtro === 'tudo' || filtro === 'versoes' ? versoes.map((v) => ({ em: `${v.recebida_em}T${v.criado_em.slice(11, 16) || '00:00'}`, v })) : []),
  ].sort((a, b) => b.em.localeCompare(a.em));
  const mes = (iso: string) => new Date(`${iso.slice(0, 7)}-15T12:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  let mesAnterior = '';
  return (
    <>
      <div className="ori-filtros">
        {(
          [
            ['tudo', 'Tudo', interacoes.length + versoes.length],
            ['sessoes', 'Sessões', sessoes.length],
            ['comunicacoes', 'Comunicações', comunicacoes.length],
            ['versoes', 'Versões', versoes.length],
          ] as [FiltroTempo, string, number][]
        ).map(([f, r, n]) => (
          <button key={f} type="button" className={`ori-chip${filtro === f ? ' ativo' : ''}`} onClick={() => setFiltro(f)}>
            {r} <span className="ori-chip-n">{n}</span>
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="botao pequeno" onClick={() => aoRegistrar('whatsapp')}>
          + Comunicação
        </button>
        <button type="button" className="botao pequeno" onClick={() => setNovaVersao(true)}>
          + Versão
        </button>
      </div>
      {!itens.length ? (
        <p className="ori-calmo">
          {filtro === 'versoes' ? 'Nenhuma versão guardada ainda.' : 'Nada registrado ainda.'}{' '}
          {filtro !== 'versoes' && (
            <button type="button" className="ori-link" onClick={() => aoRegistrar('sessao')}>
              Registrar uma sessão
            </button>
          )}
        </p>
      ) : (
        <ol className="ori-linha-tempo">
          {itens.map((x) => {
            const m = mes(x.em);
            const cab = m !== mesAnterior ? m : '';
            mesAnterior = m;
            return (
              <Fragment key={x.i?.id ?? x.v!.id}>
                {cab && <li className="ori-mes">{cab}</li>}
                {x.i ? (
                  <ItemInteracao i={x.i} versoes={versoes} aoEditar={() => aoEditar(x.i!)} />
                ) : (
                  <ItemVersao
                    v={x.v!}
                    etapa={trabalho.etapas.find((e) => e.id === x.v!.etapaId)?.nome}
                    discutida={interacoes.filter((i) => i.versaoId === x.v!.id)}
                    aoWord={x.v!.projeto ? async () => baixarArquivo(await wordDoPreProjeto(trabalho, orientando, x.v!.projeto!), x.v!.nomeArquivo.replace(/\.pdf$/i, '.docx')) : undefined}
                    aoComentar={x.v!.projeto && trabalho.publicacao ? () => setLendo(x.v!) : undefined}
                  />
                )}
              </Fragment>
            );
          })}
        </ol>
      )}
      {lendo && trabalho.publicacao && <LerEComentar trabalho={trabalho} orientando={orientando} envio={lendo} aoFechar={() => setLendo(null)} />}
      {novaVersao && (
        <Janela titulo="Guardar uma versão" aoFechar={() => setNovaVersao(false)}>
          <FormNovaVersao trabalho={trabalho} total={versoes.length} aoFechar={() => setNovaVersao(false)} />
        </Janela>
      )}
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
              <span className="ori-enc-corpo">
                <span className="ori-enc-texto">{e.texto}</span>
                {e.prazo ? (
                  <span className={e.situacao === 'pendente' && situacaoEtapa({ id: '', nome: '', prazo: e.prazo }).tipo === 'atrasada' ? 'ori-pend-vencida' : 'ajuda'}> · até {dataBR(e.prazo)}</span>
                ) : null}
                {e.situacao === 'cumprido' ? <span className="ajuda"> · cumprido{e.resolvido_em ? ` em ${dataBR(e.resolvido_em)}` : ''}</span> : null}
                {e.situacao === 'descartado' ? <span className="ori-nao-rotulo"> · {rotuloNao(e.tipo)}{e.resolvido_em ? ` em ${dataBR(e.resolvido_em)}` : ''}</span> : null}
              </span>
              <AcoesEnc
                e={e}
                aoMarcar={() => mudarEnc(e.id, e.situacao === 'descartado' ? 'pendente' : 'descartado')}
                aoApagar={async () => {
                  if (await confirmarApagarEnc(e.texto)) await salvarInteracao({ ...i, encaminhamentos: i.encaminhamentos.filter((x) => x.id !== e.id) });
                }}
              />
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
  const [resposta, setResposta] = useState('');
  const [msg, setMsg] = useState('');
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="ori-ia-passos">
      <p className="ori-calmo" style={{ marginTop: 0 }}>
        O pedido leva a transcrição, as anotações, o cronograma e as pendências anteriores (sem o nome do orientando).
      </p>
      <div className="ori-passo">
        <span className="ori-passo-n">1</span>
        <div>
          <strong>Copie o pedido e cole no Claude (ou outra IA)</strong>
          <button
            type="button"
            className="botao escuro pequeno"
            disabled={!temMaterial}
            onClick={async () => {
              const ok = await copiar(pedido());
              setCopiado(ok);
              setMsg(ok ? '' : 'Este navegador não deixou copiar.');
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar o pedido'}
          </button>
          {!temMaterial && <span className="ori-calmo">Transcreva, cole a conversa ou escreva anotações primeiro.</span>}
        </div>
      </div>
      <div className="ori-passo">
        <span className="ori-passo-n">2</span>
        <div>
          <strong>Cole aqui a resposta inteira da IA</strong>
          <textarea rows={7} aria-label="Resposta da IA" value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="RESUMO: …&#10;SUGESTÕES E COMANDOS: …" />
          <button type="button" className="botao escuro pequeno" disabled={!resposta.trim()} onClick={() => setMsg(aoUsar(resposta))}>
            Usar a resposta
          </button>
        </div>
      </div>
      {msg && <p className="ori-msg-bloco">{msg}</p>}
    </div>
  );
}

function descreverColagem(c: Colagem): string {
  const partes = [c.canal === 'whatsapp' ? `WhatsApp, ${c.mensagens.length} ${c.mensagens.length === 1 ? 'mensagem' : 'mensagens'}` : 'e-mail'];
  if (c.em) partes.push(`de ${dataHoraBR(c.em)}`);
  if (c.participantes.length) partes.push(`com ${c.participantes.join(', ')}`);
  return partes.join(' ');
}

function FormInteracao({ inicial, trabalho, interacoes, versoes, nome, aoFechar }: { inicial: Interacao; trabalho: Trabalho; interacoes: Interacao[]; versoes: Versao[]; nome?: string; aoFechar: () => void }) {
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
  const [aba, setAba] = useState<'anotacoes' | 'transcricao'>(() => (inicial.transcricao?.trim() ? 'transcricao' : 'anotacoes'));
  const [ia, setIa] = useState(false);
  const [guardadoEm, setGuardadoEm] = useState('');
  // A tela cobre a página: trava a rolagem do fundo enquanto está aberta.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);
  useEffect(() => {
    if (i.transcricao?.trim()) setGuardadoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  }, [i.transcricao]);
  const editarEnc = (id: string, p: Partial<Encaminhamento>) => setI({ ...i, encaminhamentos: i.encaminhamentos.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const temMaterial = !!(i.transcricao?.trim() || i.texto.trim() || i.resumo.trim());
  return (
    <form
      className="ori-foco"
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
      <header className="ori-foco-topo">
        <button type="button" className="ori-icone" aria-label="Fechar sem registrar" title="Fechar sem registrar" onClick={aoFechar}>
          <IcX tamanho={20} />
        </button>
        <div className="ori-foco-titulo">
          {novo ? (ehSessao ? 'Nova sessão' : 'Nova comunicação') : 'Editar registro'}
          {nome && <span> · {nome}</span>}
        </div>
        <span style={{ flex: 1 }} />
        {ehSessao ? (
          <span className="ori-seg" role="radiogroup" aria-label="Como foi">
            {(['presencial', 'online'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={(i.modo ?? 'presencial') === m} className={(i.modo ?? 'presencial') === m ? 'atual' : ''} onClick={() => setI({ ...i, modo: m })}>
                {m === 'presencial' ? 'Presencial' : 'Online'}
              </button>
            ))}
          </span>
        ) : (
          <select id="int-canal" className="seletor ori-foco-campo" aria-label="Tipo" value={i.canal} onChange={(e) => setI({ ...i, canal: e.target.value as Canal })}>
            {CANAIS.filter((c) => c.id !== 'sessao').map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        <input id="int-em" className="ori-foco-campo" type="datetime-local" aria-label="Data e hora" value={i.em} onChange={(e) => e.target.value && setI({ ...i, em: e.target.value })} />
      </header>

      <div className="ori-foco-corpo">
        <div className="ori-foco-esq">
          <div className="ori-editor">
            <div className="ori-editor-abas">
              {ehSessao ? (
                <>
                  <button type="button" className={`ori-aba${aba === 'anotacoes' ? ' atual' : ''}`} onClick={() => setAba('anotacoes')}>
                    Anotações
                  </button>
                  <button type="button" className={`ori-aba${aba === 'transcricao' ? ' atual' : ''}`} onClick={() => setAba('transcricao')}>
                    Transcrição
                  </button>
                </>
              ) : (
                <span className="ori-aba atual">Conversa</span>
              )}
            </div>
            {ehSessao && aba === 'transcricao' ? (
              <PainelTranscricao transcricao={i.transcricao ?? ''} aoMudar={(t) => setI({ ...i, transcricao: t })} aoTrecho={aoTrecho} />
            ) : (
              <div className="ori-editor-corpo">
                <textarea
                  id="int-colar"
                  aria-label={ehSessao ? 'Anotações' : 'Conversa colada'}
                  value={i.texto}
                  placeholder={
                    ehSessao
                      ? 'Suas anotações da sessão (opcional). Para transcrever pelo microfone, use a aba Transcrição.'
                      : 'Cole aqui a conversa. No WhatsApp: selecione as mensagens, copie e cole. No e-mail: copie a mensagem com o "De:" e a data.'
                  }
                  onChange={(e) => setI({ ...i, texto: e.target.value })}
                  onPaste={(e) => {
                    const colado = e.clipboardData.getData('text');
                    if (!colado) return;
                    const el = e.currentTarget;
                    // Deixa o navegador colar e então lê o texto inteiro.
                    window.setTimeout(() => aoColar(el.value), 0);
                  }}
                />
                {reconhecido && <span className="ori-msg-bloco">Reconhecido: {reconhecido}. Tipo, data e resumo preenchidos; confira.</span>}
              </div>
            )}
          </div>
          <div className="ori-resumo-caixa">
            <label htmlFor="int-resumo">{ehSessao ? 'O que foi conversado' : 'Resumo'}</label>
            <textarea
              id="int-resumo"
              rows={3}
              value={i.resumo}
              onChange={(e) => setI({ ...i, resumo: e.target.value })}
              placeholder={ehSessao ? 'Escreva um resumo, ou use "Organizar com IA" para preencher a partir da transcrição.' : 'Em poucas linhas, o que foi tratado.'}
            />
          </div>
          <div className="ori-ia-linha">
            <strong>Organizar com IA</strong>
            <span className="ori-calmo">monta o resumo e as tarefas a partir {ehSessao ? 'da transcrição e das anotações' : 'da conversa'}</span>
            <button type="button" className="botao pequeno" onClick={() => setIa(true)}>
              Abrir
            </button>
          </div>
        </div>

        <aside className="ori-foco-dir">
          <h3 className="ori-card-titulo">Tarefas para o orientando</h3>
          {i.encaminhamentos.length > 0 && (
            <ul className="ori-encaminhamentos ori-tarefas">
              {i.encaminhamentos.map((e) => (
                <li key={e.id} className={e.situacao}>
                  <button type="button" className={`ori-tipo-enc ${e.tipo}`} title="Trocar entre sugestão e comando" onClick={() => editarEnc(e.id, { tipo: e.tipo === 'comando' ? 'sugestao' : 'comando' })}>
                    {e.tipo === 'comando' ? 'comando' : 'sugestão'}
                  </button>
                  <span className="ori-tarefa-corpo">
                    <input aria-label="Texto" title={e.texto} value={e.texto} onChange={(ev) => editarEnc(e.id, { texto: ev.target.value })} />
                    <span className="ori-tarefa-linha">
                      <input type="date" aria-label="Prazo" value={e.prazo ?? ''} onChange={(ev) => editarEnc(e.id, { prazo: ev.target.value || undefined })} />
                      {e.situacao !== 'pendente' && <span className={e.situacao === 'cumprido' ? 'ori-calmo' : 'ori-nao-rotulo'}>{e.situacao === 'cumprido' ? 'cumprido' : rotuloNao(e.tipo)}</span>}
                    </span>
                  </span>
                  <AcoesEnc
                    e={e}
                    aoMarcar={() => editarEnc(e.id, { situacao: e.situacao === 'descartado' ? 'pendente' : 'descartado', resolvido_em: e.situacao === 'descartado' ? null : hojeISO() })}
                    aoApagar={() => setI({ ...i, encaminhamentos: i.encaminhamentos.filter((x) => x.id !== e.id) })}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="ori-nova-tarefa">
            <input
              id="int-enc"
              value={novoTexto}
              placeholder="+ Adicionar tarefa (ou colar várias)"
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
            {(novoTexto.trim() || novoPrazo) && (
              <span className="ori-tarefa-linha">
                <select className="seletor" aria-label="Sugestão ou comando" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as Encaminhamento['tipo'])}>
                  <option value="comando">comando (deve fazer)</option>
                  <option value="sugestao">sugestão (pode fazer)</option>
                </select>
                <input type="date" aria-label="Prazo (opcional)" title="Prazo (opcional)" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
                <button type="button" className="botao pequeno" onClick={acrescentar} disabled={!novoTexto.trim()}>
                  Acrescentar
                </button>
              </span>
            )}
          </div>
          {!novoTexto.trim() && (
            <span className="ori-calmo ori-dica">
              Enter acrescenta. Ao colar várias (como a IA formata), o Vide separa comandos e sugestões. Sem marcação, vale{' '}
              <button type="button" className="ori-link" onClick={() => setNovoTipo(novoTipo === 'comando' ? 'sugestao' : 'comando')}>
                {novoTipo === 'comando' ? 'comando' : 'sugestão'}
              </button>
              .
            </span>
          )}
          {msgBloco && <span className="ori-msg-bloco">{msgBloco}</span>}

          {anteriores.length > 0 && (
            <>
              <h3 className="ori-card-titulo" style={{ marginTop: 22 }}>
                Pendências anteriores
              </h3>
              <ul className="ori-anteriores">
                {anteriores.map((p) => (
                  <li key={p.enc.id}>
                    <input
                      type="checkbox"
                      id={`cump-${p.enc.id}`}
                      checked={cumpridas.includes(p.enc.id)}
                      onChange={(e) => setCumpridas(e.target.checked ? [...cumpridas, p.enc.id] : cumpridas.filter((x) => x !== p.enc.id))}
                    />
                    <label htmlFor={`cump-${p.enc.id}`}>{p.enc.texto}</label>
                    <span className="ori-calmo">{dataBR(p.interacao.em).slice(0, 5)}</span>
                  </li>
                ))}
              </ul>
              <span className="ori-calmo ori-dica">Marque o que ele já cumpriu.</span>
            </>
          )}

          {versoes.length > 0 && (
            <>
              <h3 className="ori-card-titulo" style={{ marginTop: 22 }}>
                Versão discutida
              </h3>
              <select id="int-versao" className="seletor" aria-label="Versão do trabalho discutida" value={i.versaoId ?? ''} onChange={(e) => setI({ ...i, versaoId: e.target.value || null })}>
                <option value="">nenhuma</option>
                {versoes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.rotulo} ({dataBR(v.recebida_em)})
                  </option>
                ))}
              </select>
            </>
          )}
        </aside>
      </div>

      <footer className="ori-foco-pe">
        <span className="ori-calmo">{guardadoEm && ehSessao ? `Transcrição guardada às ${guardadoEm}` : ''}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="botao" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="botao escuro">{novo ? (ehSessao ? 'Registrar sessão' : 'Registrar comunicação') : 'Salvar'}</button>
      </footer>

      {ia && (
        <Janela titulo="Organizar com IA" aoFechar={() => setIa(false)}>
          <OrganizarComIA
            temMaterial={temMaterial}
            pedido={() => pedidoRegistroIA({ trabalho, interacao: i, anteriores, versao: versoes.find((v) => v.id === i.versaoId), hoje: hojeISO() })}
            aoUsar={(t) => {
              const msg = usarResposta(t);
              if (msg.startsWith('Preenchido')) {
                setIa(false);
                avisar(msg.replace(/ Confira e clique.*$/, ' Confira antes de registrar.'));
              }
              return msg;
            }}
          />
        </Janela>
      )}
    </form>
  );
}

// ---------- Versões ----------

function FormNovaVersao({ trabalho, total, aoFechar }: { trabalho: Trabalho; total: number; aoFechar: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [rotulo, setRotulo] = useState('');
  const [recebida, setRecebida] = useState(hojeISO());
  const [etapaId, setEtapaId] = useState(etapaAtual(trabalho)?.id ?? '');
  const [notas, setNotas] = useState('');
  const etapas = emOrdem(trabalho.etapas);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!arquivo) return;
        await adicionarVersao(trabalho.id, arquivo, { rotulo: rotulo.trim() || `Versão ${total + 1}`, recebida_em: recebida || hojeISO(), etapaId: etapaId || null, notas: notas.trim() });
        avisar('Versão guardada');
        aoFechar();
      }}
    >
      <div className="grade-2 ori-grade-janela">
        <div className="campo">
          <label htmlFor="ver-arquivo">Arquivo (PDF, Word…)</label>
          <input id="ver-arquivo" type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.txt" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </div>
        <div className="campo">
          <label htmlFor="ver-rotulo">Nome da versão</label>
          <input id="ver-rotulo" value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder={`Versão ${total + 1}`} />
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
      <div className="modal-botoes ori-janela-pe">
        <button type="button" className="botao" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="botao escuro" disabled={!arquivo}>
          Guardar versão
        </button>
      </div>
    </form>
  );
}

function ItemVersao({ v, etapa, discutida, aoWord, aoComentar }: { v: Versao; etapa?: string; discutida: Interacao[]; aoWord?: () => void; aoComentar?: () => void }) {
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
        {aoWord && (
          <button className="botao pequeno" onClick={aoWord} title="Esta versão em Word">
            Word
          </button>
        )}
        {aoComentar && (
          <button className="botao pequeno escuro" onClick={aoComentar} title="Abre o texto do formulário para você fazer apontamentos nos trechos; o orientando vê e responde">
            Comentar no texto
          </button>
        )}
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

function mensagemConvite(nome: string, url: string, pin: string, formulario?: 'pre' | 'final' | null): string {
  const form =
    formulario === 'final'
      ? '\n\nNa aba "Meu trabalho final" você escreve o trabalho, vê os meus apontamentos no texto, baixa em PDF ou Word já formatado e me envia as versões.'
      : formulario === 'pre'
        ? '\n\nNa aba "Meu pré-projeto" você escreve o pré-projeto, vê os meus apontamentos no texto, baixa em PDF ou Word já formatado e me envia as versões.'
        : '';
  return `Olá${nome ? `, ${nome.split(' ')[0]}` : ''}! Esta é a sua página de orientação:
${url}
Código de acesso: ${pin}

Ao entrar, comece pelo nosso combinado de orientação (quem faz o quê e quais fontes usar): leva uns 3 minutos.

Lá você acompanha o cronograma (com quanto falta para cada etapa), as pendências combinadas nas nossas conversas e os elementos do trabalho, e baixa os modelos e orientações (manual de normalização, modelo do trabalho). A página se atualiza sozinha.${form}`;
}

/** Copia a mensagem ao orientando (saudação, link e código). */
async function copiarMensagem(nome: string, t: Trabalho) {
  if (!t.publicacao) return;
  const ok = await copiar(mensagemConvite(nome, urlDoOrientando(t.publicacao.codigo), t.publicacao.pin, t.preProjeto?.ativo ? (t.preProjeto.formato ?? 'pre') : null));
  avisar(ok ? 'Mensagem copiada (com o link e o código): cole no WhatsApp ou no e-mail' : 'Este navegador não deixou copiar');
}

/** Configuração do pré-projeto do trabalho (guardada com uma pausa curta). */
function useConfigPreProjeto(trabalho: Trabalho, orientando?: Orientando): [ConfigPreProjeto, (p: Partial<ConfigPreProjeto>, ja?: boolean) => void] {
  const [cfg, setCfg] = useState<ConfigPreProjeto>(() => ({ ...configPreProjetoPadrao(orientando, orientadorGuardado()), ...trabalho.preProjeto }));
  const timer = useRef<number | null>(null);
  const mudar = (p: Partial<ConfigPreProjeto>, ja = false) => {
    const novo = { ...cfg, ...p };
    setCfg(novo);
    if (timer.current) window.clearTimeout(timer.current);
    const gravar = () => void atualizarTrabalho(trabalho.id, { preProjeto: novo });
    if (ja) gravar();
    else timer.current = window.setTimeout(gravar, 800);
  };
  return [cfg, mudar];
}

/** Capa e folha de rosto do pré-projeto. */
function CamposCapa({ cfg, mudar }: { cfg: ConfigPreProjeto; mudar: (p: Partial<ConfigPreProjeto>, ja?: boolean) => void }) {
  return (
    <div className="ori-capa">
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="pp-inst">Instituição (capa)</label>
          <select id="pp-inst" className="seletor" value={cfg.instituicao} onChange={(e) => mudar({ instituicao: e.target.value as ConfigPreProjeto['instituicao'] }, true)}>
            <option value="Uniftec">Uniftec (com o logotipo)</option>
            <option value="Ftec">Ftec Faculdades</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="pp-curso">Curso</label>
          <input id="pp-curso" value={cfg.curso} onChange={(e) => mudar({ curso: e.target.value })} placeholder="ex.: Direito" />
        </div>
        <div className="campo">
          <label htmlFor="pp-cidade">Cidade e ano</label>
          <span className="linha-opcoes" style={{ flexWrap: 'nowrap' }}>
            <input id="pp-cidade" value={cfg.cidade} onChange={(e) => mudar({ cidade: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
            <input aria-label="Ano" value={cfg.ano} onChange={(e) => mudar({ ano: e.target.value })} style={{ width: 70 }} />
          </span>
        </div>
        <div className="campo">
          <label htmlFor="pp-orient">Orientador(a), como sai na folha de rosto</label>
          <input id="pp-orient" value={cfg.orientador} onChange={(e) => mudar({ orientador: e.target.value })} placeholder="ex.: Prof. Me. Fulano de Tal" />
        </div>
        <div className="campo">
          <label htmlFor="pp-coorient">Coorientador(a) (se houver)</label>
          <input id="pp-coorient" value={cfg.coorientador} onChange={(e) => mudar({ coorientador: e.target.value })} />
        </div>
      </div>
      {cfg.formato === 'final' && (
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="pp-email-or">Seu e-mail (página do resumo)</label>
            <input id="pp-email-or" type="email" value={cfg.emailOrientador ?? ''} onChange={(e) => mudar({ emailOrientador: e.target.value })} />
          </div>
          {[0, 1].map((k) => (
            <div className="campo" key={k}>
              <label htmlFor={`pp-aval-${k}`}>Avaliador(a) {k + 1} da banca (folha de aprovação)</label>
              <input
                id={`pp-aval-${k}`}
                value={cfg.avaliadores?.[k] ?? ''}
                placeholder="ex.: Me. Fulana de Tal (em branco: uma linha para preencher)"
                onChange={(e) => {
                  const av = [cfg.avaliadores?.[0] ?? '', cfg.avaliadores?.[1] ?? ''];
                  av[k] = e.target.value;
                  mudar({ avaliadores: av });
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="campo">
        <label htmlFor="pp-natureza">Natureza do trabalho (folha de rosto)</label>
        <textarea
          id="pp-natureza"
          rows={2}
          value={(cfg.formato === 'final' ? cfg.naturezaFinal : cfg.natureza) ?? ''}
          onChange={(e) => mudar(cfg.formato === 'final' ? { naturezaFinal: e.target.value } : { natureza: e.target.value })}
          placeholder={naturezaPadrao(cfg)}
        />
        <span className="ajuda" style={{ margin: 0 }}>
          Em branco, vale o texto em cinza.
        </span>
      </div>
      {cfg.formato === 'final' ? (
        <p className="ajuda" style={{ margin: 0 }}>
          No trabalho final, a folha de aprovação, o resumo e o abstract sempre entram. Dedicatória, agradecimentos e epígrafe entram se o orientando escrever.
        </p>
      ) : (
      <div className="linha-opcoes">
        <label className="ori-opcao">
          <input type="checkbox" checked={cfg.resumo} onChange={(e) => mudar({ resumo: e.target.checked }, true)} /> Pedir resumo e palavras-chave
        </label>
        <label className="ori-opcao">
          <input type="checkbox" checked={cfg.aprovacao} onChange={(e) => mudar({ aprovacao: e.target.checked }, true)} /> Incluir folha de aprovação
        </label>
      </div>
      )}
    </div>
  );
}

/** "Compartilhar": tudo sobre a página do orientando num lugar só. */
function JanelaCompartilhar({ trabalho, orientando, aoFechar }: { trabalho: Trabalho; orientando?: Orientando; aoFechar: () => void }) {
  const [, recarregar] = useState(0);
  useEffect(() => assinarPublicacao(() => recarregar((n) => n + 1)), []);
  const [criando, setCriando] = useState(false);
  const [cfg, mudar] = useConfigPreProjeto(trabalho, orientando);
  const [verCapa, setVerCapa] = useState(false);
  const pub = trabalho.publicacao;
  const estado = estadoPublicacao(trabalho.id);
  const nome = orientando?.nome ?? '';
  const primeiro = nome.split(' ')[0] || 'o orientando';
  const tentar = async (op: () => Promise<unknown>, ok?: string) => {
    try {
      await op();
      if (ok) avisar(ok);
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  };
  return (
    <Janela titulo={`Compartilhar com ${primeiro}`} aoFechar={aoFechar}>
      <p className="ori-calmo" style={{ marginTop: 0 }}>
        Uma página só {nome ? `de ${primeiro}` : 'do orientando'}: cronograma, pendências, elementos do trabalho e modelos para baixar. Atualiza sozinha. Não mostra e-mail, telefone,
        conversas nem versões.
      </p>
      {!pub ? (
        <button type="button" className="botao escuro" disabled={criando} onClick={() => (setCriando(true), void tentar(() => publicarOrientacao(trabalho.id), 'Página criada').finally(() => setCriando(false)))}>
          {criando ? 'Criando…' : 'Criar a página'}
        </button>
      ) : (
        <>
          <div className="ori-link-caixa">
            <input readOnly value={urlDoOrientando(pub.codigo)} aria-label="Link da página" onFocus={(e) => e.target.select()} />
            <button type="button" className="botao" title="Só o endereço, sem a saudação e sem o código" onClick={async () => avisar((await copiar(urlDoOrientando(pub.codigo))) ? 'Link copiado (sem o código)' : 'Este navegador não deixou copiar')}>
              Copiar só o link
            </button>
            <a className="botao" href={urlDoOrientando(pub.codigo)} target="_blank" rel="noopener">
              Abrir
            </a>
          </div>
          <div className="ori-codigo">
            <span className="ori-qr">
              <QR url={urlDoOrientando(pub.codigo)} />
            </span>
            <span>
              <span className="ori-calmo">Código de acesso</span>
              <strong className="mono">{pub.pin}</strong>
            </span>
            <button
              type="button"
              className="botao pequeno"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                if (await confirmar({ titulo: 'Trocar o código de acesso?', texto: 'O código antigo deixa de funcionar. O link continua o mesmo.', botao: 'Trocar' }))
                  await tentar(() => publicarOrientacao(trabalho.id, { trocarPin: true }), 'Código trocado');
              }}
            >
              Trocar
            </button>
          </div>
          <button
            type="button"
            className="botao escuro ori-largo"
            onClick={() => void copiarMensagem(nome, trabalho)}
          >
            Copiar mensagem para {primeiro} (link + código)
          </button>
          <p className={`ori-calmo${estado?.tipo === 'erro' ? ' ori-erro' : ''}`} style={{ fontSize: 13 }}>
            {estado?.tipo === 'enviando'
              ? 'Atualizando a página…'
              : estado?.tipo === 'erro'
                ? `A página não foi atualizada: ${estado.msg}`
                : `Atualizada em ${new Date(pub.publicadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`}
            {estado?.tipo === 'erro' && (
              <button type="button" className="ori-link" onClick={() => void tentar(() => publicarOrientacao(trabalho.id), 'Página atualizada')}>
                {' '}
                Tentar de novo
              </button>
            )}
          </p>
        </>
      )}
      <div className="ori-alternar">
        <div>
          <strong>Formulário do trabalho</strong>
          <span className="ori-calmo">Ele escreve e gera o PDF e o Word pelo manual; os envios chegam como versões</span>
        </div>
        <button type="button" role="switch" aria-checked={cfg.ativo} aria-label="Formulário do trabalho" className={`ori-toggle${cfg.ativo ? ' ligado' : ''}`} onClick={() => mudar({ ativo: !cfg.ativo }, true)} />
      </div>
      {cfg.ativo && (
        <>
          <div className="ori-formato" role="radiogroup" aria-label="Qual formulário">
            {(
              [
                ['pre', 'Pré-projeto (TCC I)'],
                ['final', 'Trabalho final (TCC II)'],
              ] as const
            ).map(([v, nomeF]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={(cfg.formato ?? 'pre') === v}
                className={`botao pequeno${(cfg.formato ?? 'pre') === v ? ' escuro' : ''}`}
                onClick={async () => {
                  if ((cfg.formato ?? 'pre') === v) return;
                  if (
                    v === 'pre' ||
                    (await confirmar({
                      titulo: 'Trocar para o trabalho final?',
                      texto: `Na página ${nome ? `de ${primeiro}` : 'do orientando'}, a aba "Meu pré-projeto" vira "Meu trabalho final", já com o texto do pré-projeto em cada lugar (introdução, objetivos, capítulos, referências). O pré-projeto continua guardado: as versões enviadas ficam aqui e, se você voltar para o pré-projeto, o texto dele está lá.`,
                      botao: 'Trocar',
                    }))
                  )
                    mudar({ formato: v }, true);
                }}
              >
                {nomeF}
              </button>
            ))}
          </div>
          <button type="button" className="ori-link ori-capa-link" onClick={() => setVerCapa(!verCapa)} aria-expanded={verCapa}>
            Capa e folha de rosto: {cfg.instituicao} · {cfg.curso || 'curso?'} · {cfg.cidade} · {cfg.ano} {verCapa ? '▴' : '›'}
          </button>
          {verCapa && <CamposCapa cfg={cfg} mudar={mudar} />}
        </>
      )}
      <div className="modal-botoes ori-janela-pe">
        {pub && (
          <button
            type="button"
            className="ori-link perigo"
            onClick={async () => {
              if (
                await confirmar({
                  titulo: 'Desativar a página do orientando?',
                  texto: `O link deixa de funcionar e o serviço apaga o que está na página${trabalho.preProjeto?.ativo ? ', inclusive o rascunho que ele está escrevendo. Antes, o Vide guarda uma cópia do texto aqui e no seu Drive; se você criar uma página nova depois, o texto volta para ela (as imagens das figuras, não: elas teriam de ser enviadas de novo; as versões já recebidas em PDF continuam com elas)' : ''}. As versões enviadas, as sessões e o resto continuam guardados aqui.`,
                  botao: 'Desativar',
                  perigo: true,
                })
              )
                await tentar(() => desativarOrientacao(trabalho.id), 'Página desativada');
            }}
          >
            Desativar a página
          </button>
        )}
        <button type="button" className="botao escuro" onClick={aoFechar}>
          Pronto
        </button>
      </div>
    </Janela>
  );
}

function nomePreProjeto(nome: string | undefined, sufixo: string, ext: 'pdf' | 'docx', formato?: 'pre' | 'final'): string {
  return `${formato === 'final' ? 'Trabalho final' : 'Pre-projeto'} (${sufixo}) - ${(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${ext}`;
}

/** Na aba Trabalho: o pré-projeto que o orientando escreve na página dele. */
function PreProjetoCartao({ trabalho, orientando, aoCompartilhar }: { trabalho: Trabalho; orientando?: Orientando; aoCompartilhar: () => void }) {
  const [ocupado, setOcupado] = useState('');
  const pub = trabalho.publicacao;
  const ativo = !!trabalho.preProjeto?.ativo;
  const [lendo, setLendo] = useState(false);
  const [aponts, setAponts] = useState<Apontamento[] | null>(null);
  useEffect(() => {
    if (!pub || !ativo || lendo) return;
    let vivo = true;
    void lerApontamentos(pub.codigo, { 'X-Vide-Chave': pub.chave }).then(
      (l) => vivo && setAponts(l),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [pub, ativo, lendo]);
  const abertos = aponts ? emAberto(aponts) : [];
  const comResposta = abertos.filter((a) => a.respostas.at(-1)?.autor === 'aluno').length;
  return (
    <section className="ori-card" style={{ marginTop: 18 }}>
      <div className="ori-card-cab">
        <h3 className="ori-card-titulo">{trabalho.preProjeto?.formato === 'final' ? 'Trabalho final (TCC II)' : 'Pré-projeto (TCC I)'}</h3>
        <button type="button" className="ori-card-acao" onClick={aoCompartilhar}>
          {ativo ? 'Configurar' : 'Ligar o formulário'}
        </button>
      </div>
      {trabalho.rascunhoProjeto && (
        <div className="ori-info">
          <span>Cópia do rascunho (aqui e no Drive)</span>
          <span className="ori-info-acoes">
            <strong>{new Date(trabalho.rascunhoProjeto.guardadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong>
            <button type="button" className="ori-link" onClick={async () => baixarArquivo(await pdfDoPreProjeto(trabalho, orientando, trabalho.rascunhoProjeto!.texto), nomePreProjeto(orientando?.nome, 'copia', 'pdf', formatoDoTexto(trabalho, trabalho.rascunhoProjeto!.texto)))}>
              PDF
            </button>
            <button type="button" className="ori-link" onClick={async () => baixarArquivo(await wordDoPreProjeto(trabalho, orientando, trabalho.rascunhoProjeto!.texto), nomePreProjeto(orientando?.nome, 'copia', 'docx', formatoDoTexto(trabalho, trabalho.rascunhoProjeto!.texto)))}>
              Word
            </button>
          </span>
        </div>
      )}
      {!ativo || !pub ? (
        <p className="ori-calmo">
          {!pub ? 'Compartilhe a página do orientando e ligue o formulário (pré-projeto ou trabalho final): ele escreve lá e o Vide monta o PDF e o Word pelo manual.' : 'O formulário está desligado. Ligue em Compartilhar.'}
        </p>
      ) : (
        <>
          <div className="ori-info">
            <span>Apontamentos no texto</span>
            <span className="ori-info-acoes">
              <strong>
                {aponts === null ? '…' : `${abertos.length} em aberto${comResposta ? ` · ${comResposta} com resposta` : ''}`}
              </strong>
              <button type="button" className="botao pequeno escuro" onClick={() => setLendo(true)}>
                Ler e comentar
              </button>
            </span>
          </div>
          {lendo && <LerEComentar trabalho={trabalho} orientando={orientando} aoFechar={() => setLendo(false)} />}
          <div className="ori-info">
            <span>Último envio</span>
            <strong>{pub.ultimoEnvio ? new Date(pub.ultimoEnvio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nenhum ainda'}</strong>
          </div>
          <div className="linha-opcoes" style={{ marginTop: 10 }}>
            <span className="ori-calmo">Rascunho atual:</span>
            {(['pdf', 'docx'] as const).map((ext) => (
              <button
                key={ext}
                type="button"
                className="botao"
                disabled={!!ocupado}
                onClick={async () => {
                  setOcupado(ext);
                  try {
                    const { projeto } = await lerRascunho(trabalho.id);
                    if (!projeto) avisar('O orientando ainda não escreveu nada no formulário.', 'erro');
                    else baixarArquivo(await (ext === 'pdf' ? pdfDoPreProjeto : wordDoPreProjeto)(trabalho, orientando, projeto), nomePreProjeto(orientando?.nome, 'rascunho', ext, formatoDoTexto(trabalho, projeto)));
                  } catch (e) {
                    avisar((e as Error).message, 'erro');
                  } finally {
                    setOcupado('');
                  }
                }}
              >
                {ocupado === ext ? 'Montando…' : ext === 'pdf' ? 'PDF' : 'Word'}
              </button>
            ))}
            <button
              type="button"
              className="botao"
              disabled={!!ocupado}
              onClick={async () => {
                setOcupado('envios');
                try {
                  const n = await buscarEnvios(trabalho.id);
                  avisar(n ? `${n === 1 ? 'Chegou 1 versão' : `Chegaram ${n} versões`} (Linha do tempo › Versões)` : 'Nenhum envio novo');
                } finally {
                  setOcupado('');
                }
              }}
            >
              {ocupado === 'envios' ? 'Buscando…' : 'Buscar envios agora'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** Em Ajustes: os modelos que valem só para este orientando. */
function ModelosDoOrientando({ trabalho }: { trabalho: Trabalho }) {
  const [gerais, setGerais] = useState(0);
  const carregar = useCallback(() => void listarModelos().then((l) => setGerais(l.filter((m) => m.trabalhoId === null).length)), []);
  useRecarga(carregar);
  return (
    <section className="ori-card" style={{ marginTop: 18 }}>
      <h3 className="ori-card-titulo">Modelos só deste orientando</h3>
      <p className="ori-calmo">
        Aparecem na página dele junto com os {gerais} {gerais === 1 ? 'modelo geral' : 'modelos gerais'} (em Orientandos › ··· › Modelos e orientações).
      </p>
      <ModelosOrientacao trabalhoId={trabalho.id} />
    </section>
  );
}

// ---------- Pré-projeto (formulário na página do orientando) ----------

function orientadorGuardado(): string {
  try {
    return (JSON.parse(localStorage.getItem('vide.orientacao.relatorio') ?? '{}') as { orientador?: string }).orientador ?? '';
  } catch {
    return '';
  }
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
