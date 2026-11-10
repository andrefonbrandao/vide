// Acervo › Processos: a biblioteca de processos fictícios e o editor de cada um
// (capa, partes, eventos com as peças e a liberação para a turma).
import { useEffect, useMemo, useRef, useState } from 'react';
import { criarProcesso, excluirProcesso, lerProcesso, listarProcessos, novaParte, novoDocumento, novoEvento, salvarProcesso } from '../processo/banco';
import { gerarNumero } from '../processo/numero';
import { dadosParaPublicar, desativarProcesso, publicarProcesso } from '../processo/publicar';
import { urlDoProcesso, type Documento, type Evento, type Parte, type Processo } from '../processo/tipos';
import { LinkEQr } from './CompartilharTreino';
import { TextoPeca, VisaoProcesso } from './ProcessoAluno';

const DESCRICOES = [
  'PETIÇÃO INICIAL',
  'DESPACHO',
  'DECISÃO INTERLOCUTÓRIA',
  'EXPEDIÇÃO DE MANDADO',
  'CITAÇÃO',
  'JUNTADA DE MANDADO CUMPRIDO',
  'AUDIÊNCIA DE CONCILIAÇÃO',
  'CONTESTAÇÃO',
  'RÉPLICA',
  'CONCLUSOS PARA DECISÃO',
  'DECISÃO DE SANEAMENTO E ORGANIZAÇÃO',
  'AUDIÊNCIA DE INSTRUÇÃO E JULGAMENTO',
  'CONCLUSOS PARA SENTENÇA',
  'SENTENÇA',
  'APELAÇÃO',
  'CONTRARRAZÕES',
  'REMESSA AO TRIBUNAL',
  'TRÂNSITO EM JULGADO',
];
const USUARIOS = ['ADVOGADO DO AUTOR', 'ADVOGADO DO RÉU', 'JUIZ', 'SECRETARIA', 'OFICIAL DE JUSTIÇA', 'SISTEMA'];

/** Sigla do documento, como no eproc (INIC1, CONT1…), pela descrição do evento. */
function prefixoSigla(descricao: string): string {
  const d = descricao.toUpperCase();
  const tabela: [RegExp, string][] = [
    [/INICIAL/, 'INIC'],
    [/CONTESTA/, 'CONT'],
    [/R[ÉE]PLICA/, 'REPLICA'],
    [/SENTEN/, 'SENT'],
    [/DESPACHO|DECIS/, 'DESPADEC'],
    [/MANDADO/, 'MAND'],
    [/CERTID|CITA/, 'CERT'],
    [/AUDI[ÊE]NCIA/, 'TERMOAUD'],
    [/APELA/, 'APELACAO'],
    [/CONTRARRAZ/, 'CONTRAZ'],
    [/PROCURA/, 'PROC'],
  ];
  return tabela.find(([re]) => re.test(d))?.[1] ?? 'OUT';
}

function proximaSigla(p: Processo, descricao: string): string {
  const pre = prefixoSigla(descricao);
  const usadas = p.eventos.flatMap((e) => e.documentos.map((d) => d.sigla)).filter((s) => s.replace(/\d+$/, '') === pre).length;
  return `${pre}${usadas + 1}`;
}

function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function rotuloLiberacao(e: Evento): string {
  if (e.liberacao.modo === 'agora') return 'liberado';
  if (e.liberacao.modo === 'segurar') return 'segurado';
  const t = Date.parse(e.liberacao.em);
  return t <= Date.now() ? 'liberado (data passou)' : `aparece em ${dataHoraBR(e.liberacao.em)}`;
}

// ---------------------------------------------------------------------------
// Editor de texto da peça (marcações simples, com botões).

function EditorPeca({ doc, aoMudar }: { doc: Documento; aoMudar: (d: Documento) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [ver, setVer] = useState(false);
  const inserir = (antes: string, depois = '', inicioDeLinha = false) => {
    const t = ref.current;
    if (!t) return;
    const { selectionStart: a, selectionEnd: b, value: v } = t;
    let ini = a;
    if (inicioDeLinha) ini = v.lastIndexOf('\n', a - 1) + 1;
    const sel = v.slice(inicioDeLinha ? ini : a, b);
    const novo = v.slice(0, inicioDeLinha ? ini : a) + antes + sel + depois + v.slice(b);
    aoMudar({ ...doc, texto: novo });
    requestAnimationFrame(() => {
      t.focus();
      const fim = (inicioDeLinha ? ini : a) + antes.length + sel.length;
      t.setSelectionRange(fim, fim);
    });
  };
  return (
    <div className="proc-editor-doc">
      <div className="grade-2">
        <div className="campo">
          <label htmlFor={`sigla-${doc.id}`}>Sigla</label>
          <input id={`sigla-${doc.id}`} type="text" value={doc.sigla} onChange={(e) => aoMudar({ ...doc, sigla: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
        </div>
        <div className="campo">
          <label htmlFor={`tit-${doc.id}`}>Título do documento</label>
          <input id={`tit-${doc.id}`} type="text" placeholder="ex.: Petição inicial" value={doc.titulo} onChange={(e) => aoMudar({ ...doc, titulo: e.target.value })} />
        </div>
      </div>
      <div className="linha-opcoes proc-barra-texto">
        <button type="button" className="botao pequeno" onClick={() => inserir('# ', '', true)} title="Título centralizado (ex.: PETIÇÃO INICIAL)">
          Título
        </button>
        <button type="button" className="botao pequeno" onClick={() => inserir('## ', '', true)} title="Subtítulo (ex.: DOS FATOS)">
          Subtítulo
        </button>
        <button type="button" className="botao pequeno" onClick={() => inserir('> ', '', true)} title="Citação recuada (lei, jurisprudência)">
          Citação
        </button>
        <button type="button" className="botao pequeno" onClick={() => inserir('- ', '', true)} title="Item de lista">
          Lista
        </button>
        <button type="button" className="botao pequeno" onClick={() => inserir('**', '**')} title="Negrito">
          <strong>N</strong>
        </button>
        <button type="button" className="botao pequeno" onClick={() => inserir('_', '_')} title="Itálico">
          <em>I</em>
        </button>
        <span className="espaco" />
        <button type="button" className={`botao pequeno${ver ? ' escuro' : ''}`} onClick={() => setVer(!ver)}>
          {ver ? 'Voltar a editar' : 'Ver como fica'}
        </button>
      </div>
      {ver ? (
        <div className="proc-folha marca-dagua" style={{ fontSize: 15 }}>
          <TextoPeca texto={doc.texto} />
        </div>
      ) : (
        <textarea
          ref={ref}
          id={`texto-${doc.id}`}
          className="proc-texto-peca"
          rows={14}
          value={doc.texto}
          onChange={(e) => aoMudar({ ...doc, texto: e.target.value })}
          placeholder={'# PETIÇÃO INICIAL\n\nEXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 1ª VARA CÍVEL DA COMARCA DE VIDE\n\nFULANA DE TAL, **brasileira**, …\n\n## DOS FATOS\n\n…\n\n> Art. 319. A petição inicial indicará: …'}
        />
      )}
      <p className="ajuda" style={{ margin: 0 }}>
        Marcações: <span className="mono"># título</span>, <span className="mono">## subtítulo</span>, <span className="mono">&gt; citação</span>,{' '}
        <span className="mono">- lista</span>, <span className="mono">**negrito**</span>, <span className="mono">_itálico_</span>. Linha em branco separa parágrafos.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EditorEvento({
  p,
  e,
  numero,
  total,
  aoMudar,
  aoMover,
  aoApagar,
}: {
  p: Processo;
  e: Evento;
  numero: number;
  total: number;
  aoMudar: (e: Evento) => void;
  aoMover: (passo: number) => void;
  aoApagar: () => void;
}) {
  const mudarDoc = (d: Documento) => aoMudar({ ...e, documentos: e.documentos.map((x) => (x.id === d.id ? d : x)) });
  return (
    <div className="proc-editor-evento">
      <div className="grade-3">
        <div className="campo">
          <label htmlFor={`data-${e.id}`}>Data e hora do ato</label>
          <input id={`data-${e.id}`} type="datetime-local" value={e.data} onChange={(ev) => aoMudar({ ...e, data: ev.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor={`desc-${e.id}`}>Descrição</label>
          <input id={`desc-${e.id}`} type="text" list="proc-descricoes" placeholder="ex.: CONTESTAÇÃO" value={e.descricao} onChange={(ev) => aoMudar({ ...e, descricao: ev.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor={`usu-${e.id}`}>Usuário</label>
          <input id={`usu-${e.id}`} type="text" list="proc-usuarios" placeholder="ex.: ADVOGADO DO RÉU" value={e.usuario} onChange={(ev) => aoMudar({ ...e, usuario: ev.target.value })} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`lib-${e.id}`}>Para a turma</label>
        <div className="linha-opcoes">
          <select
            id={`lib-${e.id}`}
            className="seletor"
            value={e.liberacao.modo}
            onChange={(ev) => {
              const modo = ev.target.value as Evento['liberacao']['modo'];
              aoMudar({ ...e, liberacao: modo === 'data' ? { modo, em: e.data } : { modo } });
            }}
          >
            <option value="segurar">Segurado (só você vê)</option>
            <option value="data">Aparece numa data</option>
            <option value="agora">Liberado (a turma já vê)</option>
          </select>
          {e.liberacao.modo === 'data' && (
            <input
              type="datetime-local"
              aria-label="Data em que aparece para a turma"
              value={e.liberacao.em}
              onChange={(ev) => aoMudar({ ...e, liberacao: { modo: 'data', em: ev.target.value } })}
            />
          )}
          {e.liberacao.modo !== 'agora' && (
            <button type="button" className="botao pequeno escuro" onClick={() => aoMudar({ ...e, liberacao: { modo: 'agora' } })}>
              Liberar agora
            </button>
          )}
        </div>
      </div>
      <div className="campo">
        <label>Documentos</label>
        {e.documentos.map((d) => (
          <div key={d.id} className="proc-doc-bloco">
            <EditorPeca doc={d} aoMudar={mudarDoc} />
            <button type="button" className="link-discreto" style={{ marginLeft: 0 }} onClick={() => confirm(`Apagar o documento ${d.sigla}?`) && aoMudar({ ...e, documentos: e.documentos.filter((x) => x.id !== d.id) })}>
              apagar este documento
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="botao pequeno"
            onClick={() => aoMudar({ ...e, documentos: [...e.documentos, novoDocumento(proximaSigla(p, e.descricao), e.descricao ? e.descricao.charAt(0) + e.descricao.slice(1).toLowerCase() : '')] })}
          >
            + Documento
          </button>
        </div>
      </div>
      <div className="linha-opcoes">
        <button type="button" className="botao pequeno" disabled={numero === 1} onClick={() => aoMover(-1)}>
          ↑ Subir
        </button>
        <button type="button" className="botao pequeno" disabled={numero === total} onClick={() => aoMover(1)}>
          ↓ Descer
        </button>
        <span className="espaco" />
        <button type="button" className="botao pequeno" onClick={() => confirm(`Apagar o evento ${numero}?`) && aoApagar()}>
          Apagar evento
        </button>
      </div>
    </div>
  );
}

function EditorPartes({ partes, aoMudar }: { partes: Parte[]; aoMudar: (p: Parte[]) => void }) {
  const mudar = (x: Parte) => aoMudar(partes.map((y) => (y.id === x.id ? x : y)));
  const polos: [Parte['polo'], string][] = [
    ['ativo', 'Autor (polo ativo)'],
    ['passivo', 'Réu (polo passivo)'],
    ['outro', 'Outros (terceiros, Ministério Público…)'],
  ];
  return (
    <div className="proc-editor-partes">
      {polos.map(([polo, rot]) => (
        <div key={polo} className="cartao">
          <h3 style={{ marginTop: 0 }}>{rot}</h3>
          {partes
            .filter((x) => x.polo === polo)
            .map((x) => (
              <div key={x.id} className="proc-editor-parte">
                <div className="grade-2">
                  <div className="campo">
                    <label htmlFor={`nome-${x.id}`}>Nome</label>
                    <input id={`nome-${x.id}`} type="text" placeholder="nome fictício" value={x.nome} onChange={(e) => mudar({ ...x, nome: e.target.value })} />
                  </div>
                  <div className="campo">
                    <label htmlFor={`qual-${x.id}`}>Qualificação</label>
                    <input id={`qual-${x.id}`} type="text" list="proc-qualificacoes" value={x.qualificacao} onChange={(e) => mudar({ ...x, qualificacao: e.target.value })} />
                  </div>
                </div>
                {x.advogados.map((a, i) => (
                  <div key={i} className="grade-2">
                    <div className="campo">
                      <label htmlFor={`adv-${x.id}-${i}`}>Advogado(a)</label>
                      <input
                        id={`adv-${x.id}-${i}`}
                        type="text"
                        value={a.nome}
                        onChange={(e) => mudar({ ...x, advogados: x.advogados.map((b, k) => (k === i ? { ...b, nome: e.target.value } : b)) })}
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor={`oab-${x.id}-${i}`}>OAB (fictícia)</label>
                      <input
                        id={`oab-${x.id}-${i}`}
                        type="text"
                        placeholder="ex.: OAB/VD 12.345"
                        value={a.oab}
                        onChange={(e) => mudar({ ...x, advogados: x.advogados.map((b, k) => (k === i ? { ...b, oab: e.target.value } : b)) })}
                      />
                    </div>
                  </div>
                ))}
                <div className="linha-opcoes">
                  <button type="button" className="botao pequeno" onClick={() => mudar({ ...x, advogados: [...x.advogados, { nome: '', oab: '' }] })}>
                    + Advogado
                  </button>
                  <span className="espaco" />
                  <button type="button" className="link-discreto" onClick={() => aoMudar(partes.filter((y) => y.id !== x.id))}>
                    remover parte
                  </button>
                </div>
              </div>
            ))}
          <button type="button" className="botao pequeno" onClick={() => aoMudar([...partes, novaParte(polo)])}>
            + Parte
          </button>
        </div>
      ))}
    </div>
  );
}

type Aba = 'capa' | 'partes' | 'eventos' | 'previa';

function EditorProcesso({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [p, setP] = useState<Processo | null>(null);
  const [aba, setAba] = useState<Aba>('eventos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [estado, setEstado] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [verLink, setVerLink] = useState(false);
  const salvar = useRef<number>(0);
  const publicar = useRef<number>(0);
  const ultimo = useRef<Processo | null>(null);
  /** Mudanças ainda não gravadas aqui / ainda não enviadas ao link. */
  const naoSalvo = useRef(false);
  const naoPublicado = useRef(false);

  useEffect(() => void lerProcesso(id).then((x) => setP(x ?? null)), [id]);

  const republicar = async (x: Processo) => {
    if (!x.publicacao) return;
    try {
      setEstado('Atualizando o link…');
      const pub = await publicarProcesso(x);
      naoPublicado.current = false;
      const atual = { ...(ultimo.current ?? x), publicacao: pub };
      ultimo.current = atual;
      await salvarProcesso(atual);
      setEstado(`Salvo e publicado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
      setErro(null);
    } catch (e) {
      setErro(`${(e as Error).message} As mudanças estão salvas neste computador; a turma ainda vê a versão anterior.`);
    }
  };

  /** Toda mudança: salva aqui na hora (com pausa) e, se já publicado, atualiza o link. */
  const mudar = (x: Processo) => {
    setP(x);
    ultimo.current = x;
    naoSalvo.current = true;
    setEstado('Salvando…');
    window.clearTimeout(salvar.current);
    salvar.current = window.setTimeout(async () => {
      naoSalvo.current = false;
      const salvo = await salvarProcesso(ultimo.current!);
      ultimo.current = salvo;
      setEstado(salvo.publicacao ? 'Salvo · atualizando o link em instantes…' : 'Salvo neste computador');
      if (salvo.publicacao) {
        naoPublicado.current = true;
        window.clearTimeout(publicar.current);
        publicar.current = window.setTimeout(() => void republicar(ultimo.current!), 2500);
      }
    }, 600);
  };

  useEffect(
    () => () => {
      window.clearTimeout(salvar.current);
      window.clearTimeout(publicar.current);
      // Saindo do editor: grava o que faltava e publica de imediato.
      const x = ultimo.current;
      if (!x) return;
      if (naoSalvo.current) void salvarProcesso(x).then((s) => s.publicacao && void republicar(s));
      else if (naoPublicado.current && x.publicacao) void republicar(x);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const dados = useMemo(() => (p ? dadosParaPublicar(p) : null), [p]);
  if (!p || !dados) return <p className="ajuda">Carregando…</p>;
  const c = p.capa;
  const campoCapa = (k: keyof typeof c, rotulo: string, extra: Record<string, unknown> = {}) => (
    <div className="campo">
      <label htmlFor={`capa-${k}`}>{rotulo}</label>
      <input id={`capa-${k}`} type="text" value={c[k]} onChange={(e) => mudar({ ...p, capa: { ...c, [k]: e.target.value } })} {...extra} />
    </div>
  );
  const liberados = dados.eventos.filter((e) => e.libera !== null && e.libera <= Date.now()).length;

  return (
    <>
      <div className="linha-opcoes" style={{ marginBottom: 8 }}>
        <button className="botao pequeno" onClick={aoVoltar}>
          ← Processos
        </button>
        <input className="proc-titulo-interno" type="text" aria-label="Nome do processo (só você vê)" value={p.titulo} onChange={(e) => mudar({ ...p, titulo: e.target.value })} />
        <span className="ajuda" style={{ margin: 0 }}>
          {estado}
        </span>
      </div>

      <div className="cartao proc-publicacao">
        {p.publicacao ? (
          <>
            <div className="linha-opcoes">
              <strong>Publicado para a turma</strong>
              <span className="ajuda" style={{ margin: 0 }}>
                · a turma vê {liberados} de {p.eventos.length} {p.eventos.length === 1 ? 'evento' : 'eventos'} · as mudanças vão para o link sozinhas
              </span>
              <span className="espaco" />
              <button className={`botao pequeno${verLink ? ' escuro' : ''}`} onClick={() => setVerLink(!verLink)}>
                Link e QR
              </button>
              <button className="botao pequeno" onClick={() => void republicar(p)}>
                Atualizar agora
              </button>
              <button
                className="botao pequeno"
                onClick={async () => {
                  if (!confirm('Desativar o link? Quem abrir verá que o processo não existe mais. O processo continua guardado aqui.')) return;
                  try {
                    await desativarProcesso(p.publicacao!);
                    mudar({ ...p, publicacao: null });
                    setVerLink(false);
                  } catch (e) {
                    setErro((e as Error).message);
                  }
                }}
              >
                Desativar link
              </button>
            </div>
            {verLink && <LinkEQr url={urlDoProcesso(p.publicacao.codigo)} titulo={`Processo ${c.numero}`} ajuda="Mande o link (ou o QR) para a turma. Quem abrir vê o processo, sem cadastro; os eventos segurados ou agendados só aparecem quando liberados." />}
          </>
        ) : (
          <div className="linha-opcoes">
            <span>
              <strong>Ainda não publicado.</strong> <span className="ajuda" style={{ margin: 0 }}>Quando publicar, a turma recebe um link; só os eventos liberados aparecem.</span>
            </span>
            <span className="espaco" />
            <button
              className="botao primario"
              onClick={async () => {
                try {
                  setEstado('Publicando…');
                  const pub = await publicarProcesso(p);
                  mudar({ ...p, publicacao: pub });
                  setVerLink(true);
                  setErro(null);
                } catch (e) {
                  setErro((e as Error).message);
                  setEstado('');
                }
              }}
            >
              Publicar para a turma
            </button>
          </div>
        )}
        {erro && <p className="digitar-msg erro">{erro}</p>}
      </div>

      <nav className="secoes-questoes" aria-label="Partes do processo">
        {(
          [
            ['capa', 'Capa'],
            ['partes', 'Partes'],
            ['eventos', `Eventos (${p.eventos.length})`],
            ['previa', 'Ver como a turma vê'],
          ] as [Aba, string][]
        ).map(([a, r]) => (
          <button key={a} className={`botao pequeno${aba === a ? ' escuro' : ''}`} onClick={() => setAba(a)}>
            {r}
          </button>
        ))}
      </nav>

      <datalist id="proc-descricoes">
        {DESCRICOES.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <datalist id="proc-usuarios">
        {USUARIOS.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <datalist id="proc-qualificacoes">
        <option value="Pessoa física" />
        <option value="Pessoa jurídica" />
        <option value="Espólio" />
        <option value="Menor representado(a)" />
      </datalist>

      {aba === 'capa' && (
        <div className="cartao">
          <div className="campo">
            <label htmlFor="capa-numero">Nº do processo (fictício)</label>
            <div className="linha-opcoes">
              <input id="capa-numero" type="text" className="mono" value={c.numero} onChange={(e) => mudar({ ...p, capa: { ...c, numero: e.target.value } })} style={{ flex: 1, minWidth: 240 }} />
              <button type="button" className="botao pequeno" onClick={() => mudar({ ...p, capa: { ...c, numero: gerarNumero(Number(c.autuadoEm.slice(0, 4)) || undefined) } })}>
                Gerar outro
              </button>
            </div>
            <span className="ajuda" style={{ margin: 0 }}>
              Formato do CNJ com "tribunal 99", que não existe: nunca coincide com um processo real.
            </span>
          </div>
          <div className="grade-2">
            {campoCapa('classe', 'Classe da ação', { list: 'proc-classes' })}
            {campoCapa('assuntos', 'Assunto(s)', { placeholder: 'ex.: Cobrança; Indenização por dano moral' })}
            {campoCapa('juizo', 'Órgão julgador')}
            {campoCapa('juiz', 'Juiz(a)', { placeholder: 'nome fictício' })}
            <div className="campo">
              <label htmlFor="capa-autuado">Data de autuação</label>
              <input id="capa-autuado" type="date" value={c.autuadoEm} onChange={(e) => mudar({ ...p, capa: { ...c, autuadoEm: e.target.value } })} />
            </div>
            {campoCapa('situacao', 'Situação', { list: 'proc-situacoes' })}
            {campoCapa('valorCausa', 'Valor da causa', { placeholder: 'ex.: R$ 25.000,00' })}
          </div>
          <datalist id="proc-classes">
            <option value="Procedimento Comum Cível" />
            <option value="Procedimento do Juizado Especial Cível" />
            <option value="Execução de Título Extrajudicial" />
            <option value="Cumprimento de Sentença" />
            <option value="Monitória" />
            <option value="Mandado de Segurança Cível" />
          </datalist>
          <datalist id="proc-situacoes">
            <option value="Em andamento" />
            <option value="Suspenso" />
            <option value="Sentenciado" />
            <option value="Em grau de recurso" />
            <option value="Baixado" />
          </datalist>
        </div>
      )}

      {aba === 'partes' && <EditorPartes partes={p.partes} aoMudar={(partes) => mudar({ ...p, partes })} />}

      {aba === 'eventos' && (
        <>
          <p className="ajuda">
            Evento novo começa <strong>segurado</strong> (só você vê). Escolha quando a turma passa a vê-lo: numa data, ou libere na hora.
          </p>
          <ol className="proc-lista-eventos">
            {p.eventos.map((e, i) => (
              <li key={e.id} className={aberto === e.id ? 'aberto' : ''}>
                <button type="button" className="proc-resumo-evento" onClick={() => setAberto(aberto === e.id ? null : e.id)} aria-expanded={aberto === e.id}>
                  <span className="mono proc-num">{i + 1}</span>
                  <span className="mono">{dataHoraBR(e.data)}</span>
                  <strong>{e.descricao || '(sem descrição)'}</strong>
                  <span className="ajuda" style={{ margin: 0 }}>
                    {e.documentos.map((d) => d.sigla).join(' ')}
                  </span>
                  <span className="espaco" />
                  <span className={`proc-lib ${e.liberacao.modo}`}>{rotuloLiberacao(e)}</span>
                </button>
                {aberto === e.id && (
                  <EditorEvento
                    p={p}
                    e={e}
                    numero={i + 1}
                    total={p.eventos.length}
                    aoMudar={(ne) => mudar({ ...p, eventos: p.eventos.map((x) => (x.id === ne.id ? ne : x)) })}
                    aoMover={(passo) => {
                      const l = [...p.eventos];
                      const j = i + passo;
                      [l[i], l[j]] = [l[j], l[i]];
                      mudar({ ...p, eventos: l });
                    }}
                    aoApagar={() => mudar({ ...p, eventos: p.eventos.filter((x) => x.id !== e.id) })}
                  />
                )}
              </li>
            ))}
          </ol>
          <button
            className="botao primario"
            onClick={() => {
              const e = novoEvento(p.eventos[p.eventos.length - 1]);
              mudar({ ...p, eventos: [...p.eventos, e] });
              setAberto(e.id);
            }}
          >
            + Evento
          </button>
        </>
      )}

      {aba === 'previa' && (
        <div className="proc-previa">
          <p className="ajuda">É assim que a turma vê. Os eventos em itálico ainda não aparecem para os alunos (segurados ou agendados).</p>
          <VisaoProcesso dados={dados} previa />
        </div>
      )}
    </>
  );
}

export function Processos() {
  const [lista, setLista] = useState<Processo[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('vide.processoAberto');
    } catch {
      return null;
    }
  });
  const [novoTitulo, setNovoTitulo] = useState('');
  const abrir = (id: string | null) => {
    setAberto(id);
    try {
      if (id) sessionStorage.setItem('vide.processoAberto', id);
      else sessionStorage.removeItem('vide.processoAberto');
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    const carregar = () => void listarProcessos().then(setLista);
    carregar();
    window.addEventListener('vide-processos-mudou', carregar);
    return () => window.removeEventListener('vide-processos-mudou', carregar);
  }, []);
  if (aberto) return <EditorProcesso key={aberto} id={aberto} aoVoltar={() => abrir(null)} />;
  return (
    <>
      <p className="ajuda">
        Processos fictícios que a turma acompanha ao longo do semestre: você monta a capa, as partes e os eventos com as peças; os alunos
        abrem pelo link, sem cadastro, e veem só o que você liberou.
      </p>
      <form
        className="cartao linha-opcoes"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = await criarProcesso(novoTitulo || `Processo da turma ${new Date().getFullYear()}`);
          setNovoTitulo('');
          abrir(p.id);
        }}
      >
        <input type="text" placeholder="Nome do novo processo (só você vê), ex.: Turma 2027/1 — ação de cobrança" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} style={{ flex: 1, minWidth: 240 }} aria-label="Nome do novo processo" />
        <button className="botao primario">Novo processo em branco</button>
      </form>
      {lista === null ? (
        <p className="ajuda">Carregando…</p>
      ) : !lista.length ? (
        <p className="ajuda">Nenhum processo ainda.</p>
      ) : (
        <ul className="lista-ordem">
          {lista.map((p) => (
            <li key={p.id} style={{ flexWrap: 'wrap' }}>
              <span className="texto-questao">
                <strong>{p.titulo}</strong>{' '}
                <span className="ajuda">
                  · <span className="mono">{p.capa.numero}</span> · {p.eventos.length} {p.eventos.length === 1 ? 'evento' : 'eventos'} ·{' '}
                  {p.publicacao ? 'publicado' : 'não publicado'}
                </span>
              </span>
              <button className="botao pequeno escuro" onClick={() => abrir(p.id)}>
                Abrir
              </button>
              <button
                className="botao pequeno"
                onClick={async () => {
                  if (!confirm(`Apagar o processo "${p.titulo}"?${p.publicacao ? ' O link da turma também será desativado.' : ''}`)) return;
                  if (p.publicacao) await desativarProcesso(p.publicacao).catch(() => undefined);
                  await excluirProcesso(p.id);
                }}
              >
                Apagar
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
