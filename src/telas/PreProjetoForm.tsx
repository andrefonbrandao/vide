// "Meu pré-projeto" na página do orientando: os campos do projeto de pesquisa (como no
// manual), guardados sozinhos no serviço; "Ver o PDF" monta o pré-projeto formatado e
// "Enviar ao orientador" manda uma cópia datada (vira uma versão no caderno do professor).
import { useEffect, useRef, useState } from 'react';
import { rotuloPrazo } from '../orientacao/prazos';
import { separarTabelas, textoDaTabela, type TabelaTexto } from '../orientacao/marcacao';
import { finalDoPreProjeto } from '../orientacao/trabalhoFinalEstrutura';
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
  nome: string;
  ajuda: string;
  linhas: number;
  subtitulos?: boolean;
  /** Também "### " (3.1.1). */
  subsub?: boolean;
  /** Botão de tabela/quadro. */
  tabelas?: boolean;
  simples?: boolean;
}

/** Onde está a tabela/quadro que contém a posição `pos` do texto (início e fim do bloco), se houver. */
function tabelaNaPosicao(texto: string, pos: number): { ini: number; fim: number; tabela: TabelaTexto } | null {
  const linhas = texto.split('\n');
  let ofs = 0;
  let aberta: { ini: number } | null = null;
  for (const l of linhas) {
    const fimLinha = ofs + l.length;
    if (!aberta && /^:::\s*(tabela|quadro)\b/i.test(l.trim())) aberta = { ini: ofs };
    else if (aberta && l.trim() === ':::') {
      if (pos >= aberta.ini && pos <= fimLinha) {
        const bloco = texto.slice(aberta.ini, fimLinha);
        const p = separarTabelas(bloco).find((x) => x.tipo === 'tabela');
        if (p && p.tipo === 'tabela') return { ini: aberta.ini, fim: fimLinha, tabela: p.tabela };
      }
      aberta = null;
    }
    ofs = fimLinha + 1;
  }
  return null;
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
  const [tabela, setTabela] = useState<{ ini: number; fim: number; tabela: TabelaTexto | null } | null>(null);
  const abrirTabela = () => {
    const el = ref.current;
    const pos = el?.selectionStart ?? valor.length;
    const achada = tabelaNaPosicao(valor, pos);
    if (achada) setTabela(achada);
    else {
      // Nova: entra depois da linha em que está o cursor.
      const fimLinha = valor.indexOf('\n', pos);
      const onde = fimLinha < 0 ? valor.length : fimLinha;
      setTabela({ ini: onde, fim: onde, tabela: null });
    }
  };
  const envolver = (antes: string, depois: string, exemplo: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = valor.slice(a, b) || exemplo;
    const novo = valor.slice(0, a) + antes + sel + depois + valor.slice(b);
    aoMudar(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + antes.length, a + antes.length + sel.length);
    });
  };
  const noComecoDaLinha = (marca: string, exemplo: string) => {
    const el = ref.current;
    if (!el) return;
    const a = el.selectionStart;
    const ini = valor.lastIndexOf('\n', a - 1) + 1;
    const linha = valor.slice(ini).split('\n')[0];
    const novo = linha.trim() ? valor.slice(0, ini) + marca + valor.slice(ini) : valor.slice(0, ini) + marca + exemplo + valor.slice(ini);
    aoMudar(novo);
    requestAnimationFrame(() => el.focus());
  };
  return (
    <div className="campo pp-campo">
      {rotulo ?? <label htmlFor={`pp-${def.campo}`}>{def.nome}</label>}
      {def.ajuda && <span className="ajuda" style={{ margin: 0 }}>{def.ajuda}</span>}
      {def.linhas === 1 ? (
        <input id={`pp-${def.campo}`} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      ) : (
        <>
          {!def.simples && (
            <div className="pp-barra" role="toolbar" aria-label={`Formatação: ${def.nome}`}>
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
                <button type="button" title="Insere uma tabela ou um quadro depois da linha do cursor. Com o cursor dentro de uma tabela, edita a tabela." onClick={abrirTabela}>
                  Tabela ou quadro
                </button>
              )}
            </div>
          )}
          <textarea id={`pp-${def.campo}`} ref={ref} rows={def.linhas} value={valor} onChange={(e) => aoMudar(e.target.value)} />
        </>
      )}
      {tabela && (
        <EditorTabela
          inicial={tabela.tabela}
          aoFechar={() => setTabela(null)}
          aoConfirmar={(t) => {
            const bloco = textoDaTabela(t);
            const antes = valor.slice(0, tabela.ini);
            const depois = valor.slice(tabela.fim);
            const novo = tabela.tabela ? antes + bloco + depois : `${antes}${antes && !antes.endsWith('\n') ? '\n' : ''}${bloco}${depois && !depois.startsWith('\n') ? '\n' : ''}${depois}`;
            aoMudar(novo);
            setTabela(null);
          }}
        />
      )}
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
  const gerarPdf = async (): Promise<Blob> => {
    const { gerarPreProjetoPdf } = await import('../orientacao/preProjetoPdf');
    const logo = await fetch('/logo-uniftec.png')
      .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined))
      .catch(() => undefined);
    return gerarPreProjetoPdf({ nome: dados.nome, config: dados.preProjeto!, texto: comFinal(), etapas: dados.etapas, logo });
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
      const blob = await gerarPreProjetoDocx({ nome: dados.nome, config: dados.preProjeto!, texto: comFinal(), etapas: dados.etapas, logo });
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
              <CampoTexto key={c.campo} def={c} valor={texto[c.campo] ?? ''} aoMudar={(v) => mudar(c.campo, v)} />
            ))}
          </div>
        </fieldset>
      ))
      )}
      <details className="pp-dicas">
        <summary>Como marcar o texto</summary>
        <ul>
          <li>
            <strong>**negrito**</strong> e <em>_itálico_</em> (o itálico, só para palavras estrangeiras, como <em>ratio decidendi</em>).
          </li>
          <li>Citação longa (mais de três linhas): comece o parágrafo com "&gt; ". Sai com recuo de 4 cm, em fonte 10.</li>
          <li>Nota de rodapé: escreva [[o texto da nota]] logo depois da palavra. O número e a nota vão para o pé da página.</li>
          {final ? (
            <>
              <li>Nos capítulos, "## " no começo da linha cria um subtítulo (3.1, 3.2…) e "### ", um sub-subtítulo (3.1.1…).</li>
              <li>"Tabela ou quadro" abre uma grade para montar a tabela; ela entra no texto entre as linhas "::: Tabela – título" e ":::". Para mudar, ponha o cursor dentro dela e clique de novo no botão.</li>
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
