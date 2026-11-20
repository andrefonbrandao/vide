// "Meu pré-projeto" na página do orientando: os campos do projeto de pesquisa (como no
// manual), guardados sozinhos no serviço; "Ver o PDF" monta o pré-projeto formatado e
// "Enviar ao orientador" manda uma cópia datada (vira uma versão no caderno do professor).
import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Controle } from './EditorVivo';
import { ApontamentosDoCampo, CartaoApontamento, ContextoApontamentos, irPara, marcasDoCampo } from './Apontamentos';
import { camposDoTrabalho, emAberto, lerApontamentos, mudarApontamento, type AcaoApontamento, type Apontamento } from '../orientacao/apontamentos';

const EditorVivo = lazy(() => import('./EditorVivo'));
import { ContextoPagina } from './contextoPagina';
import { rotuloPrazo } from '../orientacao/prazos';
import { separarTabelas, textoDaFigura, textoDaTabela, type FiguraTexto, type Pedaco, type TabelaTexto } from '../orientacao/marcacao';
import { buscarImagens, imagemDaPagina, lembrarImagem, reduzirImagem } from '../orientacao/imagens';
import { finalDoPreProjeto, imagensDoFinal } from '../orientacao/trabalhoFinalEstrutura';
import type { DadosOrientando, TextoFinal, TextoProjeto } from '../orientacao/tipos';
import { CamposFinal } from './TrabalhoFinalForm';

type Campo = Exclude<keyof TextoProjeto, 'atualizado_em' | 'final' | 'formatoEnvio'>;

const VAZIO: TextoProjeto = {
  titulo: '', subtitulo: '', resumo: '', palavrasChave: '', introducao: '', problema: '', hipoteses: '', objetivoGeral: '', objetivosEspecificos: '',
  justificativa: '', fundamentacao: '', metodo: '', populacao: '', coleta: '', analise: '', recursos: '', referencias: '',
};

/** Primeiro rascunho: o que o orientador já registrou nos elementos do trabalho. */
function inicial(d: DadosOrientando): TextoProjeto {
  const e = d.elementos;
  return {
    ...VAZIO,
    titulo: d.trabalho.titulo,
    introducao: [e?.tema, e?.delimitacao].filter((x) => x?.trim()).join('\n'),
    problema: e?.problema ?? '',
    hipoteses: e?.hipoteses ?? '',
    objetivoGeral: e?.objetivoGeral ?? '',
    objetivosEspecificos: (e?.objetivosEspecificos ?? []).join('\n'),
    justificativa: e?.justificativa ?? '',
    metodo: e?.metodologia ?? '',
  };
}

export interface DefCampo {
  campo: string;
  /** Chave do campo para os apontamentos do orientador ("final.introducao", "pre.problema"…). */
  chave?: string;
  nome: string;
  ajuda: string;
  linhas: number;
  subtitulos?: boolean;
  /** Também "### " (3.1.1). */
  subsub?: boolean;
  /** Botões de tabela/quadro e de figura/gráfico. */
  tabelas?: boolean;
  simples?: boolean;
}

/** As tabelas, quadros, figuras e gráficos de um texto, com onde começam e terminam. */
function blocosDoTexto(texto: string): { ini: number; fim: number; pedaco: Pedaco }[] {
  const out: { ini: number; fim: number; pedaco: Pedaco }[] = [];
  let ofs = 0;
  let aberta: number | null = null;
  for (const l of texto.split('\n')) {
    const fimLinha = ofs + l.length;
    if (aberta === null && /^:::\s*(tabela|quadro|figura|gr[áa]fico)/i.test(l.trim())) aberta = ofs;
    else if (aberta !== null && l.trim() === ':::') {
      const p = separarTabelas(texto.slice(aberta, fimLinha)).find((x) => x.tipo !== 'texto');
      if (p) out.push({ ini: aberta, fim: fimLinha, pedaco: p });
      aberta = null;
    }
    ofs = fimLinha + 1;
  }
  return out;
}

export { ContextoPagina };

const novoIdImagem = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

/** Miniatura de uma imagem da página. */
function Miniatura({ id, className }: { id: string; className?: string }) {
  const pg = useContext(ContextoPagina);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!pg || !id) return;
    let u = '';
    let vivo = true;
    void imagemDaPagina(pg.codigo, id, pg.cabecalho).then((b) => {
      if (!b || !vivo) return;
      u = URL.createObjectURL(new Blob([b as BlobPart]));
      setUrl(u);
    });
    return () => {
      vivo = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [pg, id]);
  return url ? <img src={url} alt="" className={className} /> : <span className={`${className ?? ''} pp-mini-vazia`}>…</span>;
}

/** Janela para escolher a imagem de uma figura ou gráfico (reduzida e enviada à página). */
function EditorFigura({ inicial, aoFechar, aoConfirmar }: { inicial: FiguraTexto | null; aoFechar: () => void; aoConfirmar: (f: FiguraTexto) => void }) {
  const pg = useContext(ContextoPagina);
  const [f, setF] = useState<FiguraTexto>(() => inicial ?? { tipo: 'figura', titulo: '', fonte: 'o autor.', imagem: '', largura: 100 });
  const [nova, setNova] = useState<{ blob: Blob; url: string } | null>(null);
  const [estado, setEstado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(
    () => () => {
      if (nova) URL.revokeObjectURL(nova.url);
    },
    [nova],
  );
  const escolher = async (arq: File | undefined) => {
    if (!arq) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(arq.type)) return setEstado('Escolha uma imagem PNG ou JPEG.');
    setEstado('Preparando a imagem…');
    try {
      const blob = await reduzirImagem(arq);
      setNova({ blob, url: URL.createObjectURL(blob) });
      setEstado(`Pronta (${Math.max(1, Math.round(blob.size / 1024))} KB).`);
    } catch (e) {
      setEstado(`Não foi possível ler a imagem: ${(e as Error).message}`);
    }
  };
  const confirmar = async () => {
    if (!nova && !f.imagem) return setEstado('Escolha a imagem.');
    if (!nova) return aoConfirmar(f);
    if (!pg) return;
    setOcupado(true);
    setEstado('Enviando a imagem…');
    try {
      const id = novoIdImagem();
      const bytes = new Uint8Array(await nova.blob.arrayBuffer());
      const r = await fetch(`/api/orientacao/${pg.codigo}/imagem/${id}`, { method: 'PUT', headers: { 'Content-Type': nova.blob.type, ...pg.cabecalho }, body: bytes });
      if (!r.ok) throw new Error(r.status === 413 ? 'a imagem é grande demais, ou o trabalho já tem imagens demais' : `erro ${r.status}`);
      lembrarImagem(pg.codigo, id, bytes);
      aoConfirmar({ ...f, imagem: id });
    } catch (e) {
      setEstado(`Não foi possível enviar: ${(e as Error).message}. Confira a internet e tente de novo.`);
      setOcupado(false);
    }
  };
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && !ocupado && aoFechar()}>
      <div className="modal pp-tabela-janela" role="dialog" aria-label={inicial ? 'Editar figura ou gráfico' : 'Nova figura ou gráfico'}>
        <h2>
          {inicial ? 'Editar' : 'Inserir'} {f.tipo === 'grafico' ? 'gráfico' : 'figura'}
        </h2>
        <div className="linha-opcoes">
          <label className="ori-opcao">
            <input type="radio" checked={f.tipo === 'figura'} onChange={() => setF({ ...f, tipo: 'figura' })} /> Figura (foto, esquema, imagem)
          </label>
          <label className="ori-opcao">
            <input type="radio" checked={f.tipo === 'grafico'} onChange={() => setF({ ...f, tipo: 'grafico' })} /> Gráfico
          </label>
        </div>
        <p className="ajuda" style={{ margin: '4px 0 10px' }}>
          O Vide numera sozinho ({f.tipo === 'grafico' ? 'Gráfico' : 'Figura'} 1, 2…) e, com três ou mais, faz a lista no começo do trabalho. Gráfico: faça no Excel ou no Google Planilhas e salve
          como imagem (ou tire um print).
        </p>
        <div className="campo">
          <label htmlFor="pp-fig-titulo">Título</label>
          <input id="pp-fig-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="ex.: Número de decisões por ano" autoFocus />
        </div>
        <div className="pp-fig-imagem">
          {nova ? <img src={nova.url} alt="" className="pp-fig-previa" /> : f.imagem ? <Miniatura id={f.imagem} className="pp-fig-previa" /> : <span className="pp-fig-previa pp-mini-vazia">sem imagem</span>}
          <span className="pp-fig-escolher">
            <label className="botao">
              {f.imagem || nova ? 'Trocar a imagem' : 'Escolher a imagem'}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void escolher(e.target.files?.[0])} />
            </label>
            <span className="ajuda" style={{ margin: 0 }}>
              PNG ou JPEG. O Vide reduz a imagem antes de enviar.
            </span>
          </span>
        </div>
        <div className="grade-2" style={{ marginTop: 10 }}>
          <div className="campo">
            <label htmlFor="pp-fig-larg">Largura na página</label>
            <select id="pp-fig-larg" className="seletor" value={f.largura} onChange={(e) => setF({ ...f, largura: Number(e.target.value) })}>
              <option value={100}>Inteira</option>
              <option value={75}>Três quartos</option>
              <option value={50}>Metade</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="pp-fig-fonte">Fonte</label>
            <input id="pp-fig-fonte" value={f.fonte} onChange={(e) => setF({ ...f, fonte: e.target.value })} placeholder="ex.: o autor (2026), com dados do CNJ." />
          </div>
        </div>
        {estado && <p className="ajuda">{estado}</p>}
        <div className="modal-botoes">
          <button type="button" className="botao primario" disabled={ocupado} onClick={() => void confirmar()}>
            {ocupado ? 'Enviando…' : inicial ? 'Salvar' : 'Inserir no texto'}
          </button>
          <button type="button" className="botao" disabled={ocupado} onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tira as linhas (menos o cabeçalho) e as colunas que ficaram em branco. */
function semVazias(linhas: string[][]): string[][] {
  const cheia = (x: string) => !!x.trim();
  const cols = (linhas[0] ?? []).map((_, k) => k).filter((k) => linhas.some((l) => cheia(l[k] ?? '')));
  const usar = cols.length ? cols : [0];
  return linhas.map((l) => usar.map((k) => l[k] ?? '')).filter((l, i) => i === 0 || l.some(cheia));
}

/** Janela para montar uma tabela ou um quadro numa grade. */
function EditorTabela({ inicial, aoFechar, aoConfirmar }: { inicial: TabelaTexto | null; aoFechar: () => void; aoConfirmar: (t: TabelaTexto) => void }) {
  const [t, setT] = useState<TabelaTexto>(
    () =>
      inicial ?? {
        tipo: 'tabela',
        titulo: '',
        fonte: 'o autor.',
        linhas: [
          ['', '', ''],
          ['', '', ''],
          ['', '', ''],
        ],
      },
  );
  const ncol = Math.max(1, ...t.linhas.map((l) => l.length));
  const linhas = t.linhas.map((l) => Array.from({ length: ncol }, (_, k) => l[k] ?? ''));
  const mudarCelula = (r: number, k: number, v: string) => setT({ ...t, linhas: linhas.map((l, i) => (i === r ? l.map((x, j) => (j === k ? v.replace(/\|/g, '/') : x)) : l)) });
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal pp-tabela-janela" role="dialog" aria-label={inicial ? 'Editar tabela ou quadro' : 'Nova tabela ou quadro'}>
        <h2>{inicial ? 'Editar' : 'Inserir'} {t.tipo === 'quadro' ? 'quadro' : 'tabela'}</h2>
        <div className="linha-opcoes">
          <label className="ori-opcao">
            <input type="radio" checked={t.tipo === 'tabela'} onChange={() => setT({ ...t, tipo: 'tabela' })} /> Tabela (números, dados)
          </label>
          <label className="ori-opcao">
            <input type="radio" checked={t.tipo === 'quadro'} onChange={() => setT({ ...t, tipo: 'quadro' })} /> Quadro (texto)
          </label>
        </div>
        <p className="ajuda" style={{ margin: '4px 0 10px' }}>
          Tabela: dados numéricos, sem linhas nas laterais. Quadro: informações em texto, todo fechado com linhas. O Vide numera sozinho ({t.tipo === 'quadro' ? 'Quadro' : 'Tabela'} 1, 2…) e, com
          três ou mais, faz a lista no começo do trabalho.
        </p>
        <div className="campo">
          <label htmlFor="pp-tab-titulo">Título</label>
          <input id="pp-tab-titulo" value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} placeholder="ex.: Decisões analisadas por ano" autoFocus />
        </div>
        <div className="pp-grade" style={{ gridTemplateColumns: `repeat(${ncol}, minmax(90px, 1fr))` }}>
          {linhas.map((l, r) =>
            l.map((v, k) => (
              <input
                key={`${r}-${k}`}
                className={r === 0 ? 'pp-grade-cab' : ''}
                aria-label={r === 0 ? `Cabeçalho da coluna ${k + 1}` : `Linha ${r}, coluna ${k + 1}`}
                placeholder={r === 0 ? `Coluna ${k + 1}` : ''}
                value={v}
                onChange={(e) => mudarCelula(r, k, e.target.value)}
              />
            )),
          )}
        </div>
        <div className="linha-opcoes" style={{ marginTop: 8 }}>
          <button type="button" className="botao pequeno" onClick={() => setT({ ...t, linhas: [...linhas, Array.from({ length: ncol }, () => '')] })}>
            + linha
          </button>
          <button type="button" className="botao pequeno" disabled={linhas.length <= 2} onClick={() => setT({ ...t, linhas: linhas.slice(0, -1) })}>
            − linha
          </button>
          <button type="button" className="botao pequeno" disabled={ncol >= 8} onClick={() => setT({ ...t, linhas: linhas.map((l) => [...l, '']) })}>
            + coluna
          </button>
          <button type="button" className="botao pequeno" disabled={ncol <= 1} onClick={() => setT({ ...t, linhas: linhas.map((l) => l.slice(0, -1)) })}>
            − coluna
          </button>
          <span className="ajuda" style={{ margin: 0 }}>
            A primeira linha é o cabeçalho.
          </span>
        </div>
        <div className="campo" style={{ marginTop: 10 }}>
          <label htmlFor="pp-tab-fonte">Fonte</label>
          <input id="pp-tab-fonte" value={t.fonte} onChange={(e) => setT({ ...t, fonte: e.target.value })} placeholder="ex.: o autor (2026), com base em STF (2025)." />
        </div>
        <div className="modal-botoes">
          <button type="button" className="botao primario" onClick={() => aoConfirmar({ ...t, linhas: semVazias(linhas) })}>
            {inicial ? 'Salvar' : 'Inserir no texto'}
          </button>
          <button type="button" className="botao" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const GRUPOS: { titulo: string; campos: (DefCampo & { campo: Campo })[]; so?: 'resumo' }[] = [
  {
    titulo: 'Identificação',
    campos: [
      { campo: 'titulo', nome: 'Título', ajuda: 'Vai em maiúsculas na capa e na folha de rosto.', linhas: 1, simples: true },
      { campo: 'subtitulo', nome: 'Subtítulo (se houver)', ajuda: '', linhas: 1, simples: true },
    ],
  },
  {
    titulo: 'Resumo',
    so: 'resumo',
    campos: [
      { campo: 'resumo', nome: 'Resumo', ajuda: 'Um parágrafo, na terceira pessoa: objetivos, método e o que se espera encontrar. A ideia central logo na primeira frase.', linhas: 5 },
      { campo: 'palavrasChave', nome: 'Palavras-chave', ajuda: 'De três a cinco, separadas por ponto: "Precedentes. Processo civil. Fundamentação."', linhas: 1, simples: true },
    ],
  },
  {
    titulo: '1 Introdução',
    campos: [
      { campo: 'introducao', nome: 'Introdução: tema e delimitação', ajuda: 'Apresente o tema numa sequência lógica: os antecedentes da problemática, do geral para o específico, até o recorte (o que, onde, quando).', linhas: 7 },
      { campo: 'problema', nome: '1.1 Problema de pesquisa', ajuda: 'De preferência em forma de pergunta.', linhas: 3 },
      { campo: 'hipoteses', nome: '1.2 Hipótese(s)', ajuda: 'Quando necessário: respostas provisórias ao problema, que a pesquisa vai confirmar ou refutar.', linhas: 3 },
    ],
  },
  {
    titulo: '2 Objetivos e justificativa',
    campos: [
      { campo: 'objetivoGeral', nome: '2.1 Objetivo geral', ajuda: 'Uma frase curta, começando com um único verbo no infinitivo (analisar, verificar…).', linhas: 2 },
      { campo: 'objetivosEspecificos', nome: '2.2 Objetivos específicos', ajuda: 'Um por linha, com verbo no infinitivo. Sem marcador; o ponto final o Vide põe.', linhas: 4, simples: true },
      { campo: 'justificativa', nome: '2.3 Justificativa', ajuda: 'A relevância do estudo, a oportunidade e a viabilidade.', linhas: 6 },
    ],
  },
  {
    titulo: '3 Fundamentação teórica',
    campos: [
      {
        campo: 'fundamentacao',
        nome: 'Fundamentação teórica',
        ajuda: 'Uma visão geral dos autores que você vai usar, com suas palavras e com citações. Use "Subtítulo" para dividir em 3.1, 3.2…',
        linhas: 12,
        subtitulos: true,
      },
    ],
  },
  {
    titulo: '4 Procedimentos metodológicos',
    campos: [
      { campo: 'metodo', nome: '4.1 Método(s) de pesquisa', ajuda: 'Os métodos e suas características, com os autores de metodologia.', linhas: 4 },
      { campo: 'populacao', nome: '4.2 Delimitação da população (amostragem) ou objeto da investigação', ajuda: 'O que você vai investigar, onde, com quem; a amostra, se houver.', linhas: 3 },
      { campo: 'coleta', nome: '4.3 Técnicas de coleta de dados', ajuda: 'Pesquisa documental, entrevistas, questionários, observação…', linhas: 3 },
      { campo: 'analise', nome: '4.4 Técnicas de análise de dados', ajuda: 'Como os dados serão analisados (qualitativa, quantitativa ou as duas).', linhas: 3 },
    ],
  },
  {
    titulo: '5 Cronograma das atividades',
    campos: [{ campo: 'recursos', nome: '5.1 Recursos', ajuda: 'Os recursos necessários: materiais, humanos e financeiros.', linhas: 3 }],
  },
  {
    titulo: 'Referências',
    campos: [
      {
        campo: 'referencias',
        nome: 'Referências',
        ajuda: 'Uma por linha, no padrão da ABNT, com o título da obra em negrito: SOBRENOME, Nome. **Título**. Edição. Local: Editora, ano. O Vide põe em ordem alfabética.',
        linhas: 6,
      },
    ],
  },
];

/** Campo de texto com a barra de marcações (negrito, itálico, citação longa, nota de rodapé, subtítulo). */
export function CampoTexto({ def, valor, aoMudar, rotulo }: { def: DefCampo; valor: string; aoMudar: (v: string) => void; rotulo?: React.ReactNode }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  /** O editor com visualização ao vivo (quando carregado); senão, a caixa de texto simples. */
  const editor = useRef<Controle | null>(null);
  const ctrl = (): Controle | null => {
    if (editor.current) return editor.current;
    const el = ref.current;
    if (!el) return null;
    return {
      sel: () => [el.selectionStart, el.selectionEnd],
      trocar: (de, ate, texto, selDe, selAte) => {
        aoMudar(valor.slice(0, de) + texto + valor.slice(ate));
        requestAnimationFrame(() => {
          el.focus();
          if (selDe !== undefined) el.setSelectionRange(selDe, selAte ?? selDe);
        });
      },
      foco: () => el.focus(),
    };
  };
  const vivo = def.linhas > 1 && !def.simples;
  const pg = useContext(ContextoPagina);
  const ap = useContext(ContextoApontamentos);
  const marcas = ap ? marcasDoCampo(ap.lista, def.chave, valor, ap.ativo) : [];
  const [editando, setEditando] = useState<{ ini: number; fim: number; tipo: 'tabela' | 'figura'; tabela?: TabelaTexto; figura?: FiguraTexto } | null>(null);
  /** Campo ampliado: ocupa a tela toda, para escrever textos longos com conforto. */
  const [cheio, setCheio] = useState(false);
  const ampliavel = def.linhas >= 5 && !def.simples;
  useEffect(() => {
    if (!cheio) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.modal-fundo') && setCheio(false);
    window.addEventListener('keydown', tecla);
    requestAnimationFrame(() => ctrl()?.foco());
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', tecla);
    };
  }, [cheio]);
  const blocos = def.tabelas ? blocosDoTexto(valor) : [];
  const abrir = (tipo: 'tabela' | 'figura') => {
    const pos = ctrl()?.sel()[0] ?? valor.length;
    const achado = blocos.find((b) => pos >= b.ini && pos < b.fim && (b.pedaco.tipo === 'figura') === (tipo === 'figura'));
    if (achado) return editarBloco(achado);
    // Novo: entra depois da linha em que está o cursor.
    const fimLinha = valor.indexOf('\n', pos);
    const onde = fimLinha < 0 ? valor.length : fimLinha;
    setEditando({ ini: onde, fim: onde, tipo });
  };
  const editarBloco = (b: { ini: number; fim: number; pedaco: Pedaco }) => {
    if (b.pedaco.tipo === 'tabela') setEditando({ ini: b.ini, fim: b.fim, tipo: 'tabela', tabela: b.pedaco.tabela });
    else if (b.pedaco.tipo === 'figura') setEditando({ ini: b.ini, fim: b.fim, tipo: 'figura', figura: b.pedaco.figura });
  };
  const colocar = (bloco: string) => {
    if (!editando) return;
    const antes = valor.slice(0, editando.ini);
    const depois = valor.slice(editando.fim);
    const existente = editando.ini !== editando.fim;
    aoMudar(existente ? antes + bloco + depois : `${antes}${antes && !antes.endsWith('\n') ? '\n' : ''}${bloco}${depois && !depois.startsWith('\n') ? '\n' : ''}${depois}`);
    setEditando(null);
  };
  const envolver = (antes: string, depois: string, exemplo: string) => {
    const c = ctrl();
    if (!c) return;
    const [a, b] = c.sel();
    const sel = valor.slice(a, b) || exemplo;
    c.trocar(a, b, antes + sel + depois, a + antes.length, a + antes.length + sel.length);
  };
  const noComecoDaLinha = (marca: string, exemplo: string) => {
    const c = ctrl();
    if (!c) return;
    const a = c.sel()[0];
    const ini = valor.lastIndexOf('\n', a - 1) + 1;
    const linha = valor.slice(ini).split('\n')[0];
    // Tira uma marca de começo de linha que já houver (trocar subtítulo por citação, por exemplo).
    const velha = /^(#{2,}\s+|>\s*)/.exec(linha)?.[0] ?? '';
    const resto = linha.slice(velha.length);
    if (!resto.trim()) {
      // Linha vazia: entra o exemplo, selecionado, para ser trocado pelo texto.
      c.trocar(ini, ini + linha.length, marca + exemplo, ini + marca.length, ini + marca.length + exemplo.length);
      return;
    }
    // Linha com texto: o cursor fica no mesmo lugar do texto.
    const pos = Math.max(ini + marca.length, a - velha.length + marca.length);
    c.trocar(ini, ini + velha.length, marca, pos, pos);
  };
  return (
    <div className={`campo pp-campo${cheio ? ' pp-campo-cheio' : ''}`}>
      {cheio && (
        <div className="pp-cheio-topo">
          <strong>{def.nome || 'Texto'}</strong>
          <span className="ajuda" style={{ margin: 0 }}>
            O texto é salvo sozinho.
          </span>
          <button type="button" className="botao escuro pequeno" onClick={() => setCheio(false)}>
            Fechar (Esc)
          </button>
        </div>
      )}
      {rotulo ?? <label htmlFor={`pp-${def.campo}`}>{def.nome}</label>}
      {def.ajuda && <span className="ajuda" style={{ margin: 0 }}>{def.ajuda}</span>}
      {def.linhas === 1 ? (
        <input id={`pp-${def.campo}`} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      ) : (
        <>
          {!def.simples && (
            <div
              className="pp-barra"
              role="toolbar"
              aria-label={`Formatação: ${def.nome}`}
              // Os botões não tiram o foco do texto: o cursor fica onde estava (no Safari, sem isso, ele pulava para o fim).
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => e.pointerType !== 'mouse' && e.preventDefault()}
            >
              {ampliavel && !cheio && (
                <button type="button" className="pp-ampliar" title="Ampliar: escrever com a tela toda" onClick={() => setCheio(true)}>
                  ⤢ Ampliar
                </button>
              )}
              <button type="button" title="Negrito (**texto**)" onClick={() => envolver('**', '**', 'texto')}>
                <strong>N</strong>
              </button>
              <button type="button" title="Itálico (_texto_), para palavras estrangeiras" onClick={() => envolver('_', '_', 'texto')}>
                <em>I</em>
              </button>
              <button type="button" title="Citação longa (mais de três linhas): recuo de 4 cm, fonte 10" onClick={() => noComecoDaLinha('> ', 'texto da citação (AUTOR, ano, p. x).')}>
                Citação longa
              </button>
              <button type="button" title="Nota de rodapé: o número aparece aqui e o texto vai para o pé da página" onClick={() => envolver('[[', ']]', 'texto da nota')}>
                Nota de rodapé
              </button>
              {def.subtitulos && (
                <button type="button" title="Subtítulo (3.1, 3.2…)" onClick={() => noComecoDaLinha('## ', 'Subtítulo')}>
                  Subtítulo
                </button>
              )}
              {def.subsub && (
                <button type="button" title="Subtítulo dentro do subtítulo (3.1.1, 3.1.2…)" onClick={() => noComecoDaLinha('### ', 'Subtítulo')}>
                  Sub-subtítulo
                </button>
              )}
              {def.tabelas && (
                <button type="button" title="Insere uma tabela ou um quadro depois da linha do cursor. Com o cursor dentro de uma tabela, edita a tabela." onClick={() => abrir('tabela')}>
                  Tabela ou quadro
                </button>
              )}
              {def.tabelas && pg && (
                <button type="button" title="Insere uma figura ou um gráfico (imagem) depois da linha do cursor." onClick={() => abrir('figura')}>
                  Figura ou gráfico
                </button>
              )}
            </div>
          )}
          {vivo ? (
            <Suspense fallback={<textarea id={`pp-${def.campo}`} ref={ref} rows={def.linhas} value={valor} onChange={(e) => aoMudar(e.target.value)} />}>
              <EditorVivo
                id={`pp-${def.campo}`}
                rotulo={def.nome}
                valor={valor}
                aoMudar={aoMudar}
                linhas={cheio ? 20 : def.linhas}
                subtitulos={!!def.subtitulos}
                controle={(c) => (editor.current = c)}
                marcas={marcas}
                aoClicarMarca={(id) => ap && irPara(id, ap.setAtivo)}
                aoEditarBloco={(pos) => {
                  const b = blocosDoTexto(valor).find((x) => pos >= x.ini && pos <= x.fim);
                  if (b) editarBloco(b);
                }}
              />
            </Suspense>
          ) : (
            <textarea id={`pp-${def.campo}`} ref={ref} rows={def.linhas} value={valor} onChange={(e) => aoMudar(e.target.value)} />
          )}
        </>
      )}
      <ApontamentosDoCampo chave={def.chave} valor={valor} />
      {editando?.tipo === 'tabela' && <EditorTabela inicial={editando.tabela ?? null} aoFechar={() => setEditando(null)} aoConfirmar={(t) => colocar(textoDaTabela(t))} />}
      {editando?.tipo === 'figura' && <EditorFigura inicial={editando.figura ?? null} aoFechar={() => setEditando(null)} aoConfirmar={(f) => colocar(textoDaFigura(f))} />}
    </div>
  );
}

export function MeuPreProjeto({ codigo, pin, dados }: { codigo: string; pin: string; dados: DadosOrientando }) {
  const [texto, setTexto] = useState<TextoProjeto | null>(null);
  const [estado, setEstado] = useState('');
  const [ultimoEnvio, setUltimoEnvio] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'' | 'ver' | 'pdf' | 'word' | 'envio'>('');
  const [erro, setErro] = useState('');
  const timer = useRef<number | null>(null);
  const pendente = useRef<TextoProjeto | null>(null);
  /** Versão do servidor sobre a qual este aparelho está escrevendo (para não gravar por cima de outro aparelho). */
  const base = useRef('');
  const [conflito, setConflito] = useState<TextoProjeto | null>(null);

  useEffect(() => {
    void fetch(`/api/orientacao/${codigo}/projeto`, { headers: { 'X-Vide-Pin': pin } })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const j = (await r.json()) as { projeto: TextoProjeto | null; ultimoEnvio: string | null };
        setTexto(j.projeto ? { ...VAZIO, ...j.projeto } : inicial(dados));
        base.current = j.projeto?.atualizado_em ?? '';
        setUltimoEnvio(j.ultimoEnvio);
        if (!j.projeto) setEstado('Começamos com o que você e o orientador já definiram (tema, problema, objetivos…). Confira e complete.');
      })
      .catch(() => {
        setTexto(inicial(dados));
        setErro('Não foi possível abrir o seu rascunho agora. Confira a internet e recarregue a página antes de escrever.');
      });
  }, [codigo, pin, dados]);

  const salvar = async (t: TextoProjeto, forcar = false) => {
    setEstado('Salvando…');
    try {
      const cab: Record<string, string> = { 'Content-Type': 'application/json', 'X-Vide-Pin': pin };
      if (!forcar) cab['X-Vide-Base'] = base.current;
      const r = await fetch(`/api/orientacao/${codigo}/projeto`, { method: 'PUT', headers: cab, body: JSON.stringify(t) });
      if (r.status === 409) {
        // Outro aparelho gravou um texto mais novo: não grava por cima; pergunta qual manter.
        const j = (await r.json()) as { projeto: TextoProjeto };
        setConflito({ ...VAZIO, ...j.projeto });
        setEstado('Não salvo: o texto mudou em outro aparelho.');
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      base.current = t.atualizado_em ?? base.current;
      setEstado(`Salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch {
      setEstado('Não foi salvo (sem internet?). Continue escrevendo: tento de novo na próxima mudança.');
    }
  };
  // Ao voltar para esta aba (ou aparelho): se o texto mudou em outro lugar, traz o mais novo (ou pergunta, se houver mudança aqui).
  useEffect(() => {
    const conferir = () => {
      if (document.visibilityState !== 'visible') return;
      void fetch(`/api/orientacao/${codigo}/projeto`, { headers: { 'X-Vide-Pin': pin } })
        .then(async (r) => {
          if (!r.ok) return;
          const j = (await r.json()) as { projeto: TextoProjeto | null };
          const remoto = j.projeto;
          if (!remoto || !(remoto.atualizado_em ?? '') || (remoto.atualizado_em ?? '') <= base.current) return;
          if (pendente.current) setConflito({ ...VAZIO, ...remoto });
          else {
            setTexto({ ...VAZIO, ...remoto });
            base.current = remoto.atualizado_em ?? '';
            setEstado('Atualizado com o texto escrito em outro aparelho.');
          }
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('focus', conferir);
    return () => {
      document.removeEventListener('visibilitychange', conferir);
      window.removeEventListener('focus', conferir);
    };
  }, [codigo, pin]);
  // Guarda alguns segundos depois de parar de digitar (e ao sair da página).
  useEffect(() => {
    const sair = () => {
      if (pendente.current) void salvar(pendente.current);
    };
    window.addEventListener('pagehide', sair);
    return () => {
      window.removeEventListener('pagehide', sair);
      if (timer.current) window.clearTimeout(timer.current);
      sair();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const final = dados.preProjeto?.formato === 'final';
  /** O trabalho final começa com o texto do pré-projeto (que continua guardado ao lado). */
  const fin: TextoFinal | null = texto && final ? (texto.final ?? finalDoPreProjeto(texto)) : null;
  const pagina = useMemo(() => ({ codigo, cabecalho: { 'X-Vide-Pin': pin } }), [codigo, pin]);
  // Apontamentos do orientador: lidos ao abrir e ao voltar para a aba.
  const [aponts, setAponts] = useState<Apontamento[]>([]);
  const [ativo, setAtivo] = useState<string | null>(null);
  useEffect(() => {
    const ler = () => document.visibilityState === 'visible' && void lerApontamentos(codigo, { 'X-Vide-Pin': pin }).then(setAponts, () => undefined);
    ler();
    document.addEventListener('visibilitychange', ler);
    return () => document.removeEventListener('visibilitychange', ler);
  }, [codigo, pin]);
  const estadoAp = useMemo(
    () => ({
      lista: aponts,
      autor: 'aluno' as const,
      agir: async (c: AcaoApontamento) => setAponts(await mudarApontamento(codigo, { 'X-Vide-Pin': pin }, c)),
      ativo,
      setAtivo,
    }),
    [aponts, ativo, codigo, pin],
  );
  // Fixa o texto inicial do trabalho final (senão os capítulos ganhariam ids novos a cada desenho).
  useEffect(() => {
    if (final && texto && !texto.final) setTexto({ ...texto, final: finalDoPreProjeto(texto) });
  }, [final, texto]);
  const mudarFinal = (p: Partial<TextoFinal>) => fin && aplicar({ ...texto!, final: { ...fin, ...p } });
  const mudar = (campo: Campo, v: string) => texto && aplicar({ ...texto, [campo]: v });
  const aplicar = (t: TextoProjeto) => {
    const novo = { ...t, atualizado_em: new Date().toISOString() };
    setTexto(novo);
    pendente.current = novo;
    setEstado('Alterações ainda não salvas…');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const p = pendente.current;
      pendente.current = null;
      if (p) void salvar(p);
    }, 1500);
  };

  const comFinal = (): TextoProjeto => (fin ? { ...texto!, final: fin } : texto!);
  const imagens = () => (fin ? buscarImagens(imagensDoFinal(fin), (id) => imagemDaPagina(codigo, id, { 'X-Vide-Pin': pin })) : Promise.resolve(undefined));
  const gerarPdf = async (): Promise<Blob> => {
    const { gerarPreProjetoPdf } = await import('../orientacao/preProjetoPdf');
    const logo = await fetch('/logo-uniftec.png')
      .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined))
      .catch(() => undefined);
    return gerarPreProjetoPdf({ nome: dados.nome, config: dados.preProjeto!, texto: comFinal(), etapas: dados.etapas, logo, imagens: await imagens() });
  };
  /** Pré-visualizar (abre numa aba nova) ou baixar: só para o orientando, nada vai ao orientador. */
  const baixarWord = async () => {
    setOcupado('word');
    setErro('');
    try {
      const { gerarPreProjetoDocx, nomeArquivoPreProjetoDocx } = await import('../orientacao/preProjetoDocx');
      const logo = await fetch('/logo-uniftec.png')
        .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined))
        .catch(() => undefined);
      const blob = await gerarPreProjetoDocx({ nome: dados.nome, config: dados.preProjeto!, texto: comFinal(), etapas: dados.etapas, logo, imagens: await imagens() });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nomeArquivoPreProjetoDocx(dados.nome, final ? 'final' : 'pre');
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch (e) {
      setErro(`Não foi possível montar o Word: ${(e as Error).message}`);
    } finally {
      setOcupado('');
    }
  };
  const verPdf = async (modo: 'abrir' | 'baixar') => {
    // A aba precisa ser aberta já no clique (senão o navegador bloqueia); o PDF entra nela depois.
    const aba = modo === 'abrir' ? window.open('', '_blank') : null;
    if (aba) aba.document.write('<p style="font-family:sans-serif;padding:20px">Montando o PDF…</p>');
    setOcupado(modo === 'abrir' ? 'ver' : 'pdf');
    setErro('');
    try {
      const blob = await gerarPdf();
      const url = URL.createObjectURL(blob);
      if (aba) aba.location.href = url;
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${final ? 'Trabalho final' : 'Pre-projeto'} - ${dados.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (e) {
      aba?.close();
      setErro(`Não foi possível montar o PDF: ${(e as Error).message}`);
    } finally {
      setOcupado('');
    }
  };
  const enviar = async () => {
    if (!texto || !window.confirm(`Enviar esta versão ${final ? 'do trabalho final' : 'do pré-projeto'} ao orientador? Você pode continuar escrevendo e enviar outras depois.`)) return;
    setOcupado('envio');
    setErro('');
    try {
      const r = await fetch(`/api/orientacao/${codigo}/envio`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vide-Pin': pin }, body: JSON.stringify({ ...comFinal(), formatoEnvio: final ? 'final' : 'pre' }) });
      if (!r.ok) throw new Error(String(r.status));
      const { em } = (await r.json()) as { em: string };
      pendente.current = null;
      base.current = texto.atualizado_em ?? base.current;
      setUltimoEnvio(em);
      setEstado('Enviado ao orientador.');
    } catch {
      setErro('Não foi possível enviar. Confira a internet e tente de novo.');
    } finally {
      setOcupado('');
    }
  };

  if (!texto) return <p className="ajuda" style={{ padding: 14 }}>Abrindo o seu rascunho…</p>;
  const nomesCampos = new Map(camposDoTrabalho(comFinal(), final ? 'final' : 'pre').map((c) => [c.chave, c.nome]));
  const perdidos = aponts.filter((a) => !nomesCampos.has(a.campo));
  const cfg = dados.preProjeto!;
  return (
    <section className="pp">
      <div className="pp-topo">
        <div>
          <h2>{final ? 'Meu trabalho final' : 'Meu pré-projeto'}</h2>
          <p className="ajuda" style={{ margin: 0 }}>
            {final ? 'Escreva aqui as partes do trabalho final (TCC II). Ele começou com o texto do seu pré-projeto, já em cada lugar: confira e continue.' : 'Escreva aqui as partes do projeto de pesquisa.'} Quando quiser, pré-visualize ou baixe o PDF (só para você): ele sai com a capa, a folha de rosto, o sumário e a formatação do manual (margens, fonte, espaçamento,
            citações e notas de rodapé). Cada Enter começa um parágrafo novo.
          </p>
        </div>
      </div>
      <div className="pp-acoes">
        <button type="button" className="botao" disabled={!!ocupado} onClick={() => void verPdf('abrir')} title="Abre o PDF numa aba nova. Só para você: nada vai ao orientador.">
          {ocupado === 'ver' ? 'Montando…' : 'Pré-visualizar'}
        </button>
        <button type="button" className="botao" disabled={!!ocupado} onClick={() => void verPdf('baixar')} title="Salva o PDF no seu aparelho. Só para você: nada vai ao orientador.">
          {ocupado === 'pdf' ? 'Montando…' : 'Baixar o PDF'}
        </button>
        <button type="button" className="botao" disabled={!!ocupado} onClick={() => void baixarWord()} title="Salva em Word (.docx), com a mesma formatação. Só para você: nada vai ao orientador.">
          {ocupado === 'word' ? 'Montando…' : 'Baixar em Word'}
        </button>
        <button type="button" className="botao primario" disabled={!!ocupado} onClick={() => void enviar()}>
          {ocupado === 'envio' ? 'Enviando…' : 'Enviar ao orientador'}
        </button>
        <span className="ajuda pp-so-voce" style={{ margin: 0, flexBasis: '100%' }}>
          Pré-visualizar e baixar (PDF ou Word) são só para você. O orientador só recebe quando você clicar em "Enviar ao orientador".
        </span>
        <span className="ajuda" style={{ margin: 0 }}>
          {estado}
          {ultimoEnvio ? ` · Último envio: ${new Date(ultimoEnvio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
        </span>
      </div>
      {erro && <p className="oa-erro">{erro}</p>}
      {conflito && (
        <div className="pp-conflito" role="alert">
          <strong>O texto foi alterado em outro aparelho</strong>
          <span>
            Lá, a última mudança foi às{' '}
            {conflito.atualizado_em ? new Date(conflito.atualizado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '?'}. Qual texto você quer manter?
          </span>
          <span className="pp-conflito-acoes">
            <button
              type="button"
              className="botao escuro"
              onClick={() => {
                pendente.current = null;
                if (timer.current) window.clearTimeout(timer.current);
                setTexto(conflito);
                base.current = conflito.atualizado_em ?? '';
                setConflito(null);
                setEstado('Usando o texto do outro aparelho.');
              }}
            >
              Usar o do outro aparelho
            </button>
            <button
              type="button"
              className="botao"
              onClick={() => {
                if (texto) void salvar({ ...texto, atualizado_em: new Date().toISOString() }, true);
                pendente.current = null;
                setConflito(null);
              }}
            >
              Manter o deste aparelho
            </button>
          </span>
        </div>
      )}
      <ContextoPagina.Provider value={pagina}>
      <ContextoApontamentos.Provider value={estadoAp}>
      {aponts.length > 0 && (
        <section className="apont-painel" aria-label="Apontamentos do orientador">
          <div className="apont-painel-cab">
            <strong>Apontamentos do orientador</strong>
            <span className="ajuda" style={{ margin: 0 }}>
              {emAberto(aponts).length} em aberto · {aponts.length - emAberto(aponts).length} resolvido(s). Os trechos comentados aparecem em amarelo no texto; responda ou marque como resolvido.
            </span>
          </div>
          {emAberto(aponts).length > 0 && (
            <ul className="apont-painel-lista">
              {emAberto(aponts).map((a) => (
                <li key={a.id}>
                  <button type="button" className="ori-link" onClick={() => irPara(a.id, setAtivo)}>
                    {nomesCampos.get(a.campo) ?? 'Campo removido'}
                  </button>{' '}
                  <span className="ajuda">“{a.trecho.length > 70 ? `${a.trecho.slice(0, 70)}…` : a.trecho}” — {a.texto.length > 90 ? `${a.texto.slice(0, 90)}…` : a.texto}</span>
                </li>
              ))}
            </ul>
          )}
          {perdidos.length > 0 && (
            <div className="apont-lista">
              <span className="ajuda">Em partes que não existem mais:</span>
              {perdidos.map((a) => (
                <CartaoApontamento key={a.id} a={a} alterado />
              ))}
            </div>
          )}
        </section>
      )}
      {fin ? (
          <CamposFinal fin={fin} mudar={mudarFinal} />
      ) : (
      GRUPOS.filter((g) => g.so !== 'resumo' || cfg.resumo).map((g) => (
        <fieldset key={g.titulo} className="proc-caixa pp-grupo">
          <legend className="proc-caixa-titulo">{g.titulo}</legend>
          <div className="pp-campos">
            {g.titulo.startsWith('5 ') && (
              <div className="pp-cronograma">
                <strong>Quadro 1 – Cronograma das atividades</strong>
                <span className="ajuda" style={{ margin: 0 }}>
                  Vem do cronograma combinado com o orientador:
                </span>
                <ul>
                  {dados.etapas.map((e) => (
                    <li key={e.id}>
                      {e.nome} — {rotuloPrazo(e.prazo)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {g.campos.map((c) => (
              <CampoTexto key={c.campo} def={{ ...c, chave: `pre.${c.campo}` }} valor={texto[c.campo] ?? ''} aoMudar={(v) => mudar(c.campo, v)} />
            ))}
          </div>
        </fieldset>
      ))
      )}
      </ContextoApontamentos.Provider>
      </ContextoPagina.Provider>
      <details className="pp-dicas">
        <summary>Como marcar o texto</summary>
        <ul>
          <li>O texto aparece já formatado (subtítulos, negrito, citações, tabelas e figuras). As marcações abaixo só aparecem, em cinza, na linha em que o cursor está. Use os botões da barra ou escreva as marcações.</li>
          <li>Colar do Word: o negrito e o itálico vêm junto. Atalhos: Ctrl+B (negrito) e Ctrl+I (itálico).</li>
          <li>
            <strong>**negrito**</strong> e <em>_itálico_</em> (o itálico, só para palavras estrangeiras, como <em>ratio decidendi</em>).
          </li>
          <li>Citação longa (mais de três linhas): comece o parágrafo com "&gt; ". Sai com recuo de 4 cm, em fonte 10.</li>
          <li>Nota de rodapé: escreva [[o texto da nota]] logo depois da palavra. O número e a nota vão para o pé da página.</li>
          {final ? (
            <>
              <li>Nos capítulos, "## " no começo da linha cria um subtítulo (3.1, 3.2…) e "### ", um sub-subtítulo (3.1.1…).</li>
              <li>"Tabela ou quadro" abre uma grade para montar a tabela; ela entra no texto entre as linhas "::: Tabela – título" e ":::". Para mudar, clique nela na lista abaixo do campo (ou ponha o cursor dentro dela e clique de novo no botão).</li>
              <li>"Figura ou gráfico" envia uma imagem (PNG ou JPEG; o Vide reduz antes) e põe no texto as linhas "::: Figura – título" … ":::" com o código da imagem. Não apague essas linhas; para trocar a imagem, o título ou a largura, clique na miniatura abaixo do campo.</li>
            </>
          ) : (
            <li>Na fundamentação, "## " no começo da linha cria um subtítulo (3.1, 3.2…).</li>
          )}
        </ul>
      </details>
      <div className="pp-acoes">
        <button type="button" className="botao" disabled={!!ocupado} onClick={() => void verPdf('abrir')} title="Abre o PDF numa aba nova. Só para você: nada vai ao orientador.">
          {ocupado === 'ver' ? 'Montando…' : 'Pré-visualizar'}
        </button>
        <button type="button" className="botao" disabled={!!ocupado} onClick={() => void verPdf('baixar')} title="Salva o PDF no seu aparelho. Só para você: nada vai ao orientador.">
          {ocupado === 'pdf' ? 'Montando…' : 'Baixar o PDF'}
        </button>
        <button type="button" className="botao" disabled={!!ocupado} onClick={() => void baixarWord()} title="Salva em Word (.docx), com a mesma formatação. Só para você: nada vai ao orientador.">
          {ocupado === 'word' ? 'Montando…' : 'Baixar em Word'}
        </button>
        <button type="button" className="botao primario" disabled={!!ocupado} onClick={() => void enviar()}>
          {ocupado === 'envio' ? 'Enviando…' : 'Enviar ao orientador'}
        </button>
      </div>
    </section>
  );
}
