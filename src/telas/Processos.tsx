// Atividades › Processos: a biblioteca de processos fictícios e o editor de cada um
// (capa, partes, eventos com as peças e a liberação para a turma).
import { avisar, confirmar } from '../comum/avisos';
import { useEffect, useMemo, useRef, useState } from 'react';
import { criarProcesso, excluirProcesso, lerProcesso, listarProcessos, novaParte, novoDocumento, novoEvento, salvarProcesso } from '../processo/banco';

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Copiar um processo para um novo semestre (datas reprogramadas). */
function CopiarProcesso({ p, aoCriar, aoCancelar }: { p: Processo; aoCriar: (id: string) => void; aoCancelar: () => void }) {
  const [titulo, setTitulo] = useState(`${p.titulo} (cópia)`);
  const [inicio, setInicio] = useState(hojeISO());
  return (
    <form
      className="cartao"
      style={{ flexBasis: '100%' }}
      onSubmit={async (ev) => {
        ev.preventDefault();
        const novo = await salvarProcesso(copiarProcesso(p, titulo, inicio));
        aoCriar(novo.id);
      }}
    >
      <div className="grade-2">
        <div className="campo">
          <label htmlFor={`copia-titulo-${p.id}`}>Nome da cópia</label>
          <input id={`copia-titulo-${p.id}`} type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`copia-inicio-${p.id}`}>Nova data de autuação (início)</label>
          <input id={`copia-inicio-${p.id}`} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </div>
      </div>
      <p className="ajuda">
        Todas as datas andam juntas: a autuação era em {new Date(`${p.capa.autuadoEm}T12:00`).toLocaleDateString('pt-BR')}; eventos e liberações são deslocados pelo
        mesmo número de dias. Os eventos que estavam liberados passam a aparecer na data do evento; os segurados continuam segurados. A cópia
        recebe um novo número e ainda não é publicada.
      </p>
      <div className="modal-botoes">
        <button className="botao primario">Criar a cópia</button>
        <button type="button" className="botao" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
import { liberado } from '../processo/liberacao';
import { copiarProcesso } from '../processo/copiar';
import { prefixoSigla, semSiglasRepetidas } from '../processo/siglas';
import { gerarNumero } from '../processo/numero';
import { db } from '../dados/db';
import { novoId } from '../dados/modelo';
import type { Material } from '../dados/modelo';
import { importarMaterial, listarMateriais } from '../material/documento';
import { comArtigos, comCliente, dadosParaPublicar, desativarProcesso, liberaEm, MAX_PDF, publicarProcesso } from '../processo/publicar';
import { urlDoProcesso, type DadosProcesso, type Documento, type Evento, type Parte, type Processo } from '../processo/tipos';
import { LinkEQr } from './CompartilharTreino';
import { buscarNoAcervo, PdfDaPeca, TextoPeca, VisaoProcesso, type MarcarVicios } from './ProcessoAluno';
import { mapaVicios, viciosPerdidos } from '../processo/vicios';
import { ColarEventos, ColarProcesso, CopiarComoTexto } from './ProcessoTexto';
import { Figura } from './ConsultaTela';
import { ClienteEmCena } from './ProcessoExtras';
import { irPara } from '../comum/navegacao';
import { listarCasos } from '../consulta/banco';
import { sortearConsulente } from '../consulta/personagens';
import type { Caso } from '../consulta/tipos';
import { FASES, faseSugerida, type FaseId } from '../processo/fases';
import { GLOSSARIO_PADRAO, type Termo } from '../processo/glossario';
import { vencimento } from '../processo/prazos';



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

function EditorPdf({ doc, aoMudar, pasta }: { doc: Documento; aoMudar: (d: Documento) => void; pasta: string }) {
  const [ver, setVer] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (doc.materialId) void db.materiais.get(doc.materialId).then((m) => setNome(m ? m.nome : '(PDF não encontrado neste computador)'));
  }, [doc.materialId]);
  return (
    <div className="proc-editor-doc">
      <div className="grade-2">
        <div className="campo">
          <label htmlFor={`sigla-${doc.id}`}>Sigla</label>
          <input id={`sigla-${doc.id}`} type="text" value={doc.sigla} onChange={(e) => aoMudar({ ...doc, sigla: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
        </div>
        <div className="campo">
          <label htmlFor={`tit-${doc.id}`}>Título do documento</label>
          <input id={`tit-${doc.id}`} type="text" value={doc.titulo} onChange={(e) => aoMudar({ ...doc, titulo: e.target.value })} />
        </div>
      </div>
      <div className="linha-opcoes">
        <span>
          PDF: <strong>{doc.materialId ? nome : <span className="proc-falta">falta anexar o PDF</span>}</strong>
          {doc.paginas ? <span className="ajuda" style={{ margin: 0 }}> · {doc.paginas} {doc.paginas === 1 ? 'página' : 'páginas'}</span> : null}
        </span>
        <span className="espaco" />
        <button type="button" className="botao pequeno" onClick={() => entrada.current?.click()}>
          {doc.materialId ? 'Trocar o PDF' : 'Anexar o PDF'}
        </button>
        {doc.materialId && (
          <button type="button" className={`botao pequeno${ver ? ' escuro' : ''}`} onClick={() => setVer(!ver)}>
            {ver ? 'Esconder' : 'Ver o PDF'}
          </button>
        )}
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (!f) return;
            setErro(null);
            if (f.size > MAX_PDF) return setErro('O PDF passa de 10 MB. Reduza o arquivo e tente de novo.');
            try {
              const m = await importarMaterial(f, { pasta });
              aoMudar({ ...doc, materialId: m.id, paginas: m.paginas });
            } catch (err) {
              setErro((err as Error).message);
            }
          }}
        />
      </div>
      {erro && <p className="digitar-msg erro">{erro}</p>}
      {ver && doc.materialId && (
        <div className="proc-folha" style={{ padding: 12 }}>
          <PdfDaPeca arquivo={doc.materialId} buscar={buscarNoAcervo} />
        </div>
      )}
    </div>
  );
}

function EditorPeca({ doc, aoMudar, pasta }: { doc: Documento; aoMudar: (d: Documento) => void; pasta: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [ver, setVer] = useState(false);
  if (doc.tipo === 'pdf') return <EditorPdf doc={doc} aoMudar={aoMudar} pasta={pasta} />;
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
          <TextoPeca texto={doc.texto} marcar={marcarNoEditor(doc)} />
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
      <EditorVicios doc={doc} aoMudar={aoMudar} campo={ref} />
    </div>
  );
}

/** Na prévia da peça no editor: os vícios destacados. */
function marcarNoEditor(doc: Documento): MarcarVicios | undefined {
  if (!doc.vicios?.length) return undefined;
  const mapa = mapaVicios(doc.texto, doc.vicios);
  return { estado: (k) => (mapa.has(k) ? 'revelado' : null), explicacoes: (k) => (mapa.get(k) ?? []).map((v) => v.explicacao) };
}

/** Caça aos vícios: o professor seleciona o trecho com defeito e escreve a explicação. */
function EditorVicios({ doc, aoMudar, campo }: { doc: Documento; aoMudar: (d: Documento) => void; campo: React.RefObject<HTMLTextAreaElement | null> }) {
  const [msg, setMsg] = useState<string | null>(null);
  const vicios = doc.vicios ?? [];
  const perdidos = new Set(viciosPerdidos(doc.texto, vicios).map((v) => v.id));
  const marcar = () => {
    const t = campo.current;
    const sel = t ? t.value.slice(t.selectionStart, t.selectionEnd).trim() : '';
    if (!sel) return setMsg('Primeiro selecione, no texto da peça, o trecho com o defeito (clique em "Voltar a editar" se estiver vendo a prévia).');
    if (sel.length > 600) return setMsg('Trecho grande demais: selecione só a frase com o defeito.');
    setMsg(null);
    aoMudar({ ...doc, vicios: [...vicios, { id: novoId(), trecho: sel, explicacao: '' }] });
  };
  return (
    <details className="proc-vicios-editor" open={vicios.length > 0}>
      <summary>
        Caça aos vícios {vicios.length ? `(${vicios.length})` : ''} <span className="ajuda">· só você vê</span>
      </summary>
      <p className="ajuda" style={{ margin: '6px 0' }}>
        Selecione no texto o trecho com o defeito e clique em <strong>Marcar como vício</strong>. A turma toca nos parágrafos suspeitos; a conferência abre quando você liberar (no alto da aba Eventos).
      </p>
      <button type="button" className="botao pequeno escuro" onMouseDown={(e) => e.preventDefault()} onClick={marcar}>
        Marcar o trecho selecionado como vício
      </button>
      {msg && <p className="digitar-msg erro">{msg}</p>}
      {vicios.length > 0 && (
        <ol className="proc-vicios-lista">
          {vicios.map((v) => (
            <li key={v.id}>
              <span className="proc-vicio-trecho">“{v.trecho.length > 120 ? `${v.trecho.slice(0, 120)}…` : v.trecho}”</span>
              {perdidos.has(v.id) && <span className="proc-selo">o trecho não está mais no texto</span>}
              <div className="linha-opcoes">
                <input
                  type="text"
                  aria-label="O que está errado"
                  placeholder="O que está errado, com o artigo (ex.: citação por edital sem tentar a pessoal — art. 256)"
                  value={v.explicacao}
                  onChange={(e) => aoMudar({ ...doc, vicios: vicios.map((x) => (x.id === v.id ? { ...x, explicacao: e.target.value } : x)) })}
                  style={{ flex: 1, minWidth: 240 }}
                />
                <button type="button" className="botao pequeno" onClick={() => aoMudar({ ...doc, vicios: vicios.filter((x) => x.id !== v.id) })}>
                  Tirar
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------

/** Botões para juntar um documento ao evento: escrever, anexar PDF ou usar um material do acervo. */
function NovoDocumento({ p, e, aoMudar }: { p: Processo; e: Evento; aoMudar: (e: Evento) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [escolher, setEscolher] = useState(false);
  const [pdfs, setPdfs] = useState<Material[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const titulo = e.descricao ? e.descricao.charAt(0) + e.descricao.slice(1).toLowerCase() : '';
  const juntarPdf = (m: Pick<Material, 'id' | 'nome' | 'paginas'>) => {
    const d = novoDocumento(proximaSigla(p, e.descricao), titulo || m.nome);
    aoMudar({ ...e, documentos: [...e.documentos, { ...d, tipo: 'pdf', materialId: m.id, paginas: m.paginas }] });
    setEscolher(false);
  };
  return (
    <div className="linha-opcoes">
      <button type="button" className="botao pequeno" onClick={() => aoMudar({ ...e, documentos: [...e.documentos, novoDocumento(proximaSigla(p, e.descricao), titulo)] })}>
        + Peça escrita
      </button>
      <button type="button" className="botao pequeno" onClick={() => entrada.current?.click()}>
        + Anexar PDF
      </button>
      <button
        type="button"
        className={`botao pequeno${escolher ? ' escuro' : ''}`}
        onClick={async () => {
          setPdfs((await listarMateriais()).filter((m) => m.tipo === 'pdf'));
          setEscolher(!escolher);
        }}
      >
        + PDF dos materiais
      </button>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={async (ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = '';
          if (!f) return;
          setErro(null);
          if (f.size > MAX_PDF) return setErro('O PDF passa de 10 MB. Reduza o arquivo (por exemplo, "Salvar como PDF reduzido") e tente de novo.');
          try {
            const m = await importarMaterial(f, { pasta: `Processos/${p.titulo.replace(/\//g, '-')}` });
            juntarPdf(m);
          } catch (err) {
            setErro((err as Error).message);
          }
        }}
      />
      {escolher && (
        <select className="seletor" aria-label="PDF dos materiais" defaultValue="" onChange={(ev) => { const m = pdfs.find((x) => x.id === ev.target.value); if (m) juntarPdf(m); }}>
          <option value="" disabled>
            {pdfs.length ? 'Escolha um PDF…' : 'Nenhum PDF nos materiais'}
          </option>
          {pdfs.map((m) => (
            <option key={m.id} value={m.id} disabled={m.tamanho > MAX_PDF}>
              {m.pasta ? `${m.pasta} / ` : ''}
              {m.nome}
              {m.tamanho > MAX_PDF ? ' (mais de 10 MB)' : ''}
            </option>
          ))}
        </select>
      )}
      {erro && <p className="digitar-msg erro" style={{ flexBasis: '100%' }}>{erro}</p>}
    </div>
  );
}

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
      <div className="grade-2">
        <div className="campo">
          <label htmlFor={`fase-${e.id}`}>Fase no mapa do procedimento</label>
          <select id={`fase-${e.id}`} className="seletor" value={e.fase ?? ''} onChange={(ev) => aoMudar({ ...e, fase: (ev.target.value || null) as FaseId | null })}>
            <option value="">Automática ({FASES.find((f) => f.id === faseSugerida(e.descricao))?.nome ?? 'continua a anterior'})</option>
            {FASES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label className="caixa-marcar" style={{ marginTop: 0 }}>
            <input
              type="checkbox"
              checked={!!e.prazo}
              onChange={(ev) => aoMudar({ ...e, prazo: ev.target.checked ? { dias: 15, tipo: 'uteis', para: sugestaoPrazo(e.descricao) } : null })}
            />
            Este evento abre um prazo
          </label>
          {e.prazo && (
            <div className="proc-prazo-editor">
              <div className="linha-opcoes">
                <input type="number" min={1} max={365} aria-label="Quantos dias" value={e.prazo.dias} onChange={(ev) => aoMudar({ ...e, prazo: { ...e.prazo!, dias: Math.max(1, Math.min(365, Number(ev.target.value) || 1)) } })} style={{ width: 80 }} />
                <select className="seletor" aria-label="Tipo de contagem" value={e.prazo.tipo} onChange={(ev) => aoMudar({ ...e, prazo: { ...e.prazo!, tipo: ev.target.value as 'uteis' | 'corridos' } })}>
                  <option value="uteis">dias úteis</option>
                  <option value="corridos">dias corridos</option>
                </select>
                <span>para</span>
                <input type="text" aria-label="Para quê" placeholder="o réu contestar" value={e.prazo.para} onChange={(ev) => aoMudar({ ...e, prazo: { ...e.prazo!, para: ev.target.value } })} style={{ flex: 1, minWidth: 160 }} />
              </div>
              <label className="caixa-marcar">
                <input type="checkbox" checked={!!e.prazo.desafio} onChange={(ev) => aoMudar({ ...e, prazo: { ...e.prazo!, desafio: ev.target.checked || undefined } })} />
                "Quando vence?": esconder a data para a turma fazer a conta
              </label>
              <span className="ajuda" style={{ margin: 0 }}>
                Contado da data deste evento, sem feriados: vence em <strong>{dataBR(vencimento(e.data, e.prazo.dias, e.prazo.tipo))}</strong>.
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="campo proc-eagora-editor">
        <label className="caixa-marcar" style={{ marginTop: 0 }}>
          <input
            type="checkbox"
            checked={!!e.agora}
            onChange={(ev) => aoMudar({ ...e, agora: ev.target.checked ? { pergunta: 'E agora? O que o juiz vai decidir?', opcoes: ['', ''] } : null })}
          />
          "E agora?": a turma vota pelo celular, em aula, antes de você liberar este evento
        </label>
        {e.agora && (
          <>
            <input type="text" aria-label="Pergunta da votação" value={e.agora.pergunta} onChange={(ev) => aoMudar({ ...e, agora: { ...e.agora!, pergunta: ev.target.value } })} />
            {e.agora.opcoes.map((o, k) => (
              <div key={k} className="linha-opcoes">
                <span className="mono">{'ABCDEF'[k]}</span>
                <input
                  type="text"
                  aria-label={`Opção ${'ABCDEF'[k]}`}
                  placeholder={k === 0 ? 'ex.: Concede a tutela' : k === 1 ? 'ex.: Nega a tutela' : 'outra opção'}
                  value={o}
                  onChange={(ev) => aoMudar({ ...e, agora: { ...e.agora!, opcoes: e.agora!.opcoes.map((x, j) => (j === k ? ev.target.value : x)) } })}
                  style={{ flex: 1 }}
                />
                {e.agora!.opcoes.length > 2 && (
                  <button type="button" className="botao pequeno" onClick={() => aoMudar({ ...e, agora: { ...e.agora!, opcoes: e.agora!.opcoes.filter((_, j) => j !== k) } })}>
                    Tirar
                  </button>
                )}
              </div>
            ))}
            {e.agora.opcoes.length < 6 && (
              <button type="button" className="botao pequeno" onClick={() => aoMudar({ ...e, agora: { ...e.agora!, opcoes: [...e.agora!.opcoes, ''] } })}>
                + Opção
              </button>
            )}
            <span className="ajuda" style={{ margin: 0 }}>
              Na Aula, com o processo aberto, aparece o botão <strong>E agora? Abrir votação</strong> antes de liberar este evento.
            </span>
          </>
        )}
      </div>
      <div className="campo">
        <label>Documentos</label>
        {e.documentos.map((d) => (
          <div key={d.id} className="proc-doc-bloco">
            <EditorPeca doc={d} aoMudar={mudarDoc} pasta={`Processos/${p.titulo.replace(/\//g, '-')}`} />
            <button type="button" className="link-discreto" style={{ marginLeft: 0 }} onClick={() => void confirmar({ titulo: `Apagar o documento ${d.sigla}?`, botao: 'Apagar', perigo: true }).then((ok) => ok && aoMudar({ ...e, documentos: e.documentos.filter((x) => x.id !== d.id) }))}>
              apagar este documento
            </button>
          </div>
        ))}
        <NovoDocumento p={p} e={e} aoMudar={aoMudar} />
      </div>
      <div className="linha-opcoes">
        <button type="button" className="botao pequeno" disabled={numero === 1} onClick={() => aoMover(-1)}>
          ↑ Subir
        </button>
        <button type="button" className="botao pequeno" disabled={numero === total} onClick={() => aoMover(1)}>
          ↓ Descer
        </button>
        <span className="espaco" />
        <button type="button" className="botao pequeno" onClick={() => void confirmar({ titulo: `Apagar o evento ${numero}?`, botao: 'Apagar', perigo: true }).then((ok) => ok && aoApagar())}>
          Apagar evento
        </button>
      </div>
    </div>
  );
}

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "CITAÇÃO" -> "o réu contestar" (só uma sugestão para o campo). */
function sugestaoPrazo(descricao: string): string {
  const t = descricao.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/cita|aviso de recebimento/.test(t)) return 'o réu contestar';
  if (/contesta/.test(t)) return 'o autor apresentar réplica';
  if (/sentenc/.test(t)) return 'apelar';
  if (/apelac/.test(t)) return 'apresentar contrarrazões';
  if (/saneamento/.test(t)) return 'pedir esclarecimentos ou ajustes';
  return '';
}

/** Cliente em cena: um caso da Consulta abre o processo. */
function EditorCliente({ p, aoMudar }: { p: Processo; aoMudar: (c: Processo['cliente']) => void }) {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  useEffect(() => void listarCasos().then(setCasos), []);
  if (!casos) return <p className="ajuda">Carregando…</p>;
  const atual = p.cliente ? casos.find((c) => c.id === p.cliente!.casoId) : undefined;
  if (!casos.length)
    return (
      <div className="vazio-guia">
        <Figura id="m3" expressao="duvida" className="vazio-guia-figura" />
        <div>
          <h2>Nenhum caso na Consulta ainda</h2>
          <p className="ajuda">O processo pode começar com o cliente contando o problema, como no jogo Consulta. Cadastre o caso primeiro.</p>
          <button className="botao escuro" onClick={() => irPara('casos', 'novo-caso')}>
            Novo caso
          </button>
        </div>
      </div>
    );
  return (
    <div className="cartao">
      <p className="ajuda" style={{ marginTop: 0 }}>
        Escolha um caso da <strong>Consulta</strong>: na página da turma, antes dos autos, aparece o cliente contando o problema (só as falas dele; a resposta fica de fora).
      </p>
      <div className="campo">
        <label htmlFor="cliente-caso">Caso</label>
        <select
          id="cliente-caso"
          className="seletor"
          value={p.cliente?.casoId ?? ''}
          onChange={(ev) => {
            const c = casos.find((x) => x.id === ev.target.value);
            aoMudar(c ? { casoId: c.id, personagem: sortearConsulente(c.pessoa).id } : null);
          }}
        >
          <option value="">Nenhum (o processo começa direto nos autos)</option>
          {casos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}: “{(c.falas[c.falas.length - 1]?.texto ?? '').slice(0, 70)}”
            </option>
          ))}
        </select>
      </div>
      {p.cliente && !atual && <p className="aviso">O caso escolhido foi apagado da Consulta. Escolha outro.</p>}
      {p.cliente && atual && (
        <>
          <ClienteEmCena cliente={{ nome: atual.nome, personagem: p.cliente.personagem, falas: atual.falas }} />
          <button className="botao pequeno" onClick={() => aoMudar({ ...p.cliente!, personagem: sortearConsulente(atual.pessoa).id })}>
            Sortear outro rosto
          </button>
        </>
      )}
    </div>
  );
}

/** Termos próprios do glossário (somam-se aos que já vêm no Vide). */
function EditorGlossario({ termos, aoMudar }: { termos: Termo[]; aoMudar: (t: Termo[]) => void }) {
  return (
    <div className="cartao">
      <p className="ajuda" style={{ marginTop: 0 }}>
        Na página da turma, os termos das descrições dos eventos ficam sublinhados: tocando, aparece a explicação. O Vide já traz {GLOSSARIO_PADRAO.length} termos; acrescente os seus (ou
        reescreva um que já existe, usando o mesmo termo).
      </p>
      {termos.map((t, i) => (
        <div key={i} className="linha-opcoes proc-termo-editor">
          <input type="text" aria-label="Termo" placeholder="termo, ex.: carga dos autos" value={t.termo} onChange={(ev) => aoMudar(termos.map((x, j) => (j === i ? { ...x, termo: ev.target.value } : x)))} style={{ width: 220 }} />
          <input type="text" aria-label="Explicação" placeholder="explicação curta" value={t.explicacao} onChange={(ev) => aoMudar(termos.map((x, j) => (j === i ? { ...x, explicacao: ev.target.value } : x)))} style={{ flex: 1, minWidth: 220 }} />
          <button type="button" className="botao pequeno" onClick={() => aoMudar(termos.filter((_, j) => j !== i))}>
            Tirar
          </button>
        </div>
      ))}
      <button type="button" className="botao pequeno com-icone" onClick={() => aoMudar([...termos, { termo: '', explicacao: '' }])}>
        + Termo
      </button>
      <details className="ajuda-dobravel" style={{ marginTop: 12 }}>
        <summary>Termos que já vêm no Vide ({GLOSSARIO_PADRAO.length})</summary>
        <dl className="proc-glossario">
          {GLOSSARIO_PADRAO.map((t) => (
            <div key={t.termo}>
              <dt>{t.termo}</dt>
              <dd>{t.explicacao}</dd>
            </div>
          ))}
        </dl>
      </details>
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

type Aba = 'capa' | 'partes' | 'cliente' | 'eventos' | 'glossario' | 'previa';

function EditorProcesso({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const [p, setP] = useState<Processo | null>(null);
  const [aba, setAba] = useState<Aba>('eventos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [estado, setEstado] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [verLink, setVerLink] = useState(false);
  const [colandoEventos, setColandoEventos] = useState(false);
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

  const dados = useMemo(() => (p ? dadosParaPublicar(p, { comVicios: true }) : null), [p]);
  // Prévia com os artigos citados clicáveis (lê o acervo deste computador).
  const [previa, setPrevia] = useState<DadosProcesso | null>(null);
  useEffect(() => {
    if (aba !== 'previa' || !dados) return;
    let vivo = true;
    void comArtigos(dados)
      .then((d) => comCliente(d, p ?? {}))
      .then((d) => vivo && setPrevia(d));
    return () => {
      vivo = false;
    };
  }, [aba, dados]);
  if (!p || !dados) return <p className="ajuda">Carregando…</p>;
  const c = p.capa;
  const campoCapa = (k: keyof typeof c, rotulo: string, extra: Record<string, unknown> = {}) => (
    <div className="campo">
      <label htmlFor={`capa-${k}`}>{rotulo}</label>
      <input id={`capa-${k}`} type="text" value={c[k]} onChange={(e) => mudar({ ...p, capa: { ...c, [k]: e.target.value } })} {...extra} />
    </div>
  );
  const liberados = dados.eventos.filter((e) => e.libera !== null && e.libera <= Date.now()).length;
  const docsComVicio = p.eventos.flatMap((e) => e.documentos).filter((d) => d.tipo === 'texto' && d.vicios?.length);
  const totalVicios = docsComVicio.reduce((n, d) => n + (d.vicios?.length ?? 0), 0);
  const pecasComVicio = docsComVicio.length;

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
      <div className="linha-opcoes" style={{ marginBottom: 8 }}>
        <CopiarComoTexto p={p} />
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
                  if (!(await confirmar({ titulo: 'Desativar o link da turma?', texto: 'Quem abrir verá que o processo não existe mais. O processo continua guardado aqui.', botao: 'Desativar', perigo: true }))) return;
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
            ['cliente', p.cliente ? 'Cliente em cena ✓' : 'Cliente em cena'],
            ['eventos', `Eventos (${p.eventos.length})`],
            ['glossario', p.glossario?.length ? `Glossário (${p.glossario.length})` : 'Glossário'],
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
      {aba === 'cliente' && <EditorCliente p={p} aoMudar={(cliente) => mudar({ ...p, cliente })} />}
      {aba === 'glossario' && <EditorGlossario termos={p.glossario ?? []} aoMudar={(glossario) => mudar({ ...p, glossario })} />}

      {aba === 'eventos' && (
        <>
          {totalVicios > 0 && (
            <div className={`cartao proc-conferencia${p.conferenciaVicios ? ' aberta' : ''}`}>
              <span>
                <strong>Caça aos vícios:</strong> {totalVicios} {totalVicios === 1 ? 'vício plantado' : 'vícios plantados'} em {pecasComVicio}{' '}
                {pecasComVicio === 1 ? 'peça' : 'peças'}.{' '}
                {p.conferenciaVicios ? 'Conferência liberada: a turma já sabe na hora se acertou.' : 'Conferência fechada: a turma marca os trechos, mas ainda não sabe se acertou.'}
              </span>
              <button className={`botao pequeno${p.conferenciaVicios ? '' : ' escuro'}`} onClick={() => mudar({ ...p, conferenciaVicios: !p.conferenciaVicios })}>
                {p.conferenciaVicios ? 'Fechar a conferência' : 'Liberar a conferência'}
              </button>
            </div>
          )}
          <p className="ajuda">
            Evento novo começa <strong>segurado</strong> (só você vê). Escolha quando a turma passa a vê-lo: numa data, ou libere na hora.
          </p>
          {colandoEventos && (
            <ColarEventos
              aoAcrescentar={(evs) => {
                const existentes = p.eventos.flatMap((x) => x.documentos.map((d) => d.sigla));
                mudar({ ...p, eventos: [...p.eventos, ...semSiglasRepetidas(existentes, evs)] });
                setColandoEventos(false);
              }}
              aoCancelar={() => setColandoEventos(false)}
            />
          )}
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
          </button>{' '}
          {!colandoEventos && (
            <button className="botao" onClick={() => setColandoEventos(true)}>
              Colar eventos
            </button>
          )}
        </>
      )}

      {aba === 'previa' && (
        <div className="proc-previa">
          <p className="ajuda">É assim que a turma vê. Os eventos em itálico ainda não aparecem para os alunos (segurados ou agendados).</p>
          <VisaoProcesso dados={previa ?? dados} previa buscar={buscarNoAcervo} />
        </div>
      )}
    </>
  );
}

export function Processos({ acao = null }: { acao?: 'novo-processo' | 'colar-processo' | string | null }) {
  const [lista, setLista] = useState<Processo[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(() => {
    if (acao) return null;
    try {
      return sessionStorage.getItem('vide.processoAberto');
    } catch {
      return null;
    }
  });
  const [novoTitulo, setNovoTitulo] = useState('');
  const [copiando, setCopiando] = useState<string | null>(null);
  const [colando, setColando] = useState(acao === 'colar-processo');
  const [criando, setCriando] = useState(acao === 'novo-processo');
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
  if (colando) return <ColarProcesso aoCriar={(id) => (setColando(false), abrir(id))} aoCancelar={() => setColando(false)} />;
  return (
    <>
      {criando && (
        <form
          className="cartao linha-opcoes"
          onSubmit={async (e) => {
            e.preventDefault();
            const p = await criarProcesso(novoTitulo || `Processo da turma ${new Date().getFullYear()}`);
            setNovoTitulo('');
            setCriando(false);
            abrir(p.id);
          }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Nome do novo processo (só você vê), ex.: Turma 2027/1 — ação de cobrança"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
            aria-label="Nome do novo processo"
          />
          <button className="botao primario">Criar em branco</button>
          <button type="button" className="botao" onClick={() => setCriando(false)}>
            Cancelar
          </button>
        </form>
      )}
      {lista === null ? (
        <p className="ajuda">Carregando…</p>
      ) : !lista.length ? (
        <div className="vazio-guia">
          <Figura id="adv-h" expressao="feliz" className="vazio-guia-figura" />
          <div>
            <h2>Nenhum processo ainda</h2>
            <p className="ajuda">Monte um processo em branco ou cole um processo em texto (por exemplo, pedido pronto a uma IA).</p>
            <div className="linha-opcoes">
              <button className="botao escuro" onClick={() => setCriando(true)}>
                Novo processo
              </button>
              <button className="botao" onClick={() => setColando(true)}>
                Colar processo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ul className="grade-processos">
            {lista.map((p) => {
              const feitos = liberadosDe(p);
              const autor = p.partes.find((x) => x.polo === 'ativo')?.nome;
              const reu = p.partes.find((x) => x.polo === 'passivo')?.nome;
              return (
                <li key={p.id} className={`cartao-processo${copiando === p.id ? ' copiando' : ''}`}>
                  <button type="button" className="cartao-processo-capa" onClick={() => abrir(p.id)} title="Abrir o processo">
                    <span className="cartao-processo-figura">
                      <Figura id={figuraDoProcesso(p.id)} expressao="neutro" />
                    </span>
                    <span className="cartao-processo-cab">
                      <span className="mono">{p.capa.numero}</span>
                      <strong>{autor || reu ? `${autor ?? '—'} × ${reu ?? '—'}` : 'Partes ainda não cadastradas'}</strong>
                    </span>
                  </button>
                  <div className="cartao-processo-corpo">
                    <button type="button" className="cartao-processo-titulo" onClick={() => abrir(p.id)}>
                      {p.titulo}
                    </button>
                    <span className="ajuda">
                      {p.eventos.length ? `${feitos} de ${p.eventos.length} ${p.eventos.length === 1 ? 'evento liberado' : 'eventos liberados'}` : 'nenhum evento ainda'}
                    </span>
                    <span className="barra-progresso">
                      <i style={{ width: `${p.eventos.length ? (feitos / p.eventos.length) * 100 : 0}%` }} />
                    </span>
                    <div className="cartao-processo-rodape">
                      <span className={`selo ${p.publicacao ? 'verde' : ''}`}>{p.publicacao ? 'Publicado' : 'Não publicado'}</span>
                      <span className="espaco" />
                      <button className="link-discreto" onClick={() => setCopiando(copiando === p.id ? null : p.id)} title="Copiar para um novo semestre, com as datas reprogramadas">
                        Copiar
                      </button>
                      <button
                        className="link-discreto"
                        onClick={async () => {
                          if (!(await confirmar({ titulo: `Apagar o processo "${p.titulo}"?`, texto: p.publicacao ? 'O link da turma também será desativado.' : undefined, botao: 'Apagar', perigo: true }))) return;
                          if (p.publicacao) await desativarProcesso(p.publicacao).catch(() => undefined);
                          await excluirProcesso(p.id);
                          avisar('Processo apagado');
                        }}
                      >
                        Apagar
                      </button>
                    </div>
                    {copiando === p.id && <CopiarProcesso p={p} aoCriar={(id) => (setCopiando(null), abrir(id))} aoCancelar={() => setCopiando(null)} />}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="vazio-guia">
            <Figura id="adv-m" expressao="feliz" className="vazio-guia-figura" />
            <div>
              <h2>Peça um processo pronto à IA</h2>
              <p className="ajuda">Escreva o tema, copie o pedido, cole no Claude e traga a resposta. O Vide monta capa, partes, eventos e peças.</p>
              <button className="botao escuro" onClick={() => setColando(true)}>
                Colar processo (com o pedido para a IA)
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Quantos eventos a turma já vê (liberados até agora). */
export function liberadosDe(p: Processo, agora = Date.now()): number {
  return p.eventos.filter((e) => liberado({ libera: liberaEm(e) }, agora)).length;
}

/** Um juiz ou advogado fixo para cada processo (só para enfeitar o cartão). */
function figuraDoProcesso(id: string): string {
  const op = ['juiz-m', 'adv-h', 'juiz-h', 'adv-m'];
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return op[n % op.length];
}
