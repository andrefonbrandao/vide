// A ordem e a numeração do trabalho final (TCC II), pelo modelo da Uniftec:
// 1 Introdução; 2 Objetivos e justificativa (2.1 Objetivo geral, 2.1.1 Objetivos específicos,
// 2.2 Justificativa); 3, 4… os capítulos do desenvolvimento, com os nomes que o orientando
// escolher (e subtítulos 3.1, 3.1.1); depois as Considerações finais; Referências, Apêndices e
// Anexos (sem número, em página nova). Seções primárias começam em página nova.
// Tabelas e quadros são numerados na ordem em que aparecem (Tabela 1, 2…; Quadro 1, 2…).
import { imagensDoTexto, lerParagrafos, ordenarReferencias, separarTabelas, textoPuro, type FiguraTexto, type TabelaTexto } from './marcacao';
import { especificosFormatados, type Bloco } from './preProjetoEstrutura';
import type { ParteNomeada, TextoFinal, TextoProjeto } from './tipos';

export const FINAL_VAZIO: TextoFinal = {
  titulo: '', subtitulo: '', tituloIngles: '', subtituloIngles: '', email: '', dedicatoria: '', agradecimentos: '', epigrafe: '', resumo: '', palavrasChave: '',
  abstract: '', keywords: '', siglas: '', introducao: '', objetivoGeral: '', objetivosEspecificos: '', justificativa: '', capitulos: [], consideracoes: '', referencias: '',
  apendices: [], anexos: [],
};

export const novaParte = (titulo = '', texto = ''): ParteNomeada => ({ id: Math.random().toString(36).slice(2, 10), titulo, texto });

/** O trabalho final começa com o texto do pré-projeto, cada parte no seu lugar. */
export function finalDoPreProjeto(t: Partial<TextoProjeto>): TextoFinal {
  const juntar = (...xs: (string | undefined)[]) => xs.filter((x) => x?.trim()).join('\n');
  const metodologia = [
    ['Método(s) de pesquisa', t.metodo],
    ['Delimitação da população (amostragem) ou objeto da investigação', t.populacao],
    ['Técnicas de coleta de dados', t.coleta],
    ['Técnicas de análise de dados', t.analise],
  ]
    .filter(([, x]) => x?.trim())
    .map(([nome, x]) => `## ${nome}\n${x!.trim()}`)
    .join('\n');
  return {
    ...FINAL_VAZIO,
    titulo: t.titulo ?? '',
    subtitulo: t.subtitulo ?? '',
    resumo: t.resumo ?? '',
    palavrasChave: t.palavrasChave ?? '',
    introducao: juntar(t.introducao, t.problema, t.hipoteses),
    objetivoGeral: t.objetivoGeral ?? '',
    objetivosEspecificos: t.objetivosEspecificos ?? '',
    justificativa: t.justificativa ?? '',
    capitulos: [novaParte('Fundamentação teórica', t.fundamentacao ?? ''), novaParte('Procedimentos metodológicos', metodologia), novaParte('Apresentação e análise dos resultados')],
    referencias: t.referencias ?? '',
  };
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function estruturaFinal(entrada: TextoFinal): Bloco[] {
  const t = { ...FINAL_VAZIO, ...entrada };
  const out: Bloco[] = [];
  const contagem = { tabela: 0, quadro: 0, figura: 0, grafico: 0 };
  let sec = 0;
  const secao = (nome: string) => {
    sec++;
    out.push({ tipo: 'titulo', nivel: 1, rotulo: String(sec), texto: nome, novaPagina: true });
    return String(sec);
  };
  const tabela = (tab: TabelaTexto) => out.push({ tipo: 'tabela', tabela: tab, numero: ++contagem[tab.tipo] });
  /** Texto corrido com subtítulos (## → n.1, ### → n.1.1) e tabelas. */
  const corrido = (texto: string, pai = '', comSub = false) => {
    let sub = 0;
    let subsub = 0;
    for (const pedaco of separarTabelas(texto)) {
      if (pedaco.tipo === 'tabela') {
        tabela(pedaco.tabela);
        continue;
      }
      if (pedaco.tipo === 'figura') {
        out.push({ tipo: 'figura', figura: pedaco.figura, numero: ++contagem[pedaco.figura.tipo] });
        continue;
      }
      for (const p of lerParagrafos(pedaco.texto, comSub)) {
        if (p.tipo !== 'sub') {
          out.push({ tipo: 'par', p });
          continue;
        }
        const nome = p.trechos.map((x) => ('t' in x ? x.t : '')).join('');
        if (p.nivel === 3 && sub) out.push({ tipo: 'titulo', nivel: 3, rotulo: `${pai}.${sub}.${++subsub}`, texto: nome });
        else {
          subsub = 0;
          out.push({ tipo: 'titulo', nivel: 2, rotulo: `${pai}.${++sub}`, texto: nome });
        }
      }
    }
  };
  if (t.introducao.trim()) {
    const s = secao('Introdução');
    corrido(t.introducao, s, true);
  }
  if (t.objetivoGeral.trim() || t.objetivosEspecificos.trim() || t.justificativa.trim()) {
    const s = secao('Objetivos e justificativa');
    let n = 0;
    if (t.objetivoGeral.trim() || t.objetivosEspecificos.trim()) {
      n++;
      out.push({ tipo: 'titulo', nivel: 2, rotulo: `${s}.${n}`, texto: 'Objetivo geral' });
      corrido(t.objetivoGeral);
      if (t.objetivosEspecificos.trim()) {
        out.push({ tipo: 'titulo', nivel: 3, rotulo: `${s}.${n}.1`, texto: 'Objetivos específicos' });
        corrido(especificosFormatados(t.objetivosEspecificos));
      }
    }
    if (t.justificativa.trim()) {
      out.push({ tipo: 'titulo', nivel: 2, rotulo: `${s}.${++n}`, texto: 'Justificativa' });
      corrido(t.justificativa);
    }
  }
  for (const c of t.capitulos) {
    if (!c.titulo.trim() && !c.texto.trim()) continue;
    const s = secao(c.titulo.trim() || 'Desenvolvimento');
    corrido(c.texto, s, true);
  }
  if (t.consideracoes.trim()) {
    const s = secao('Considerações finais');
    corrido(t.consideracoes, s, true);
  }
  const lista = ordenarReferencias(t.referencias);
  if (lista.length) out.push({ tipo: 'referencias', lista });
  const pos = (partes: ParteNomeada[], nome: string) =>
    partes
      .filter((p) => p.titulo.trim() || p.texto.trim())
      .forEach((p, k) => {
        out.push({ tipo: 'titulo', nivel: 0, rotulo: '', texto: `${nome} ${LETRAS[k] ?? k + 1} – ${p.titulo.trim() || 'sem título'}`, novaPagina: true });
        corrido(p.texto);
      });
  pos(t.apendices, 'Apêndice');
  pos(t.anexos, 'Anexo');
  return out;
}

/** As ilustrações e tabelas do trabalho (para as listas, quando há três ou mais de um tipo). */
export function tabelasDe(blocos: Bloco[]): { tipo: TipoIlustracao; numero: number; titulo: string }[] {
  return blocos.flatMap((b): { tipo: TipoIlustracao; numero: number; titulo: string }[] =>
    b.tipo === 'tabela' ? [{ tipo: b.tabela.tipo, numero: b.numero, titulo: textoPuro(b.tabela.titulo) }] : b.tipo === 'figura' ? [{ tipo: b.figura.tipo, numero: b.numero, titulo: textoPuro(b.figura.titulo) }] : [],
  );
}

export type TipoIlustracao = 'figura' | 'quadro' | 'grafico' | 'tabela';
/** A ordem das listas no começo do trabalho (como no modelo da Uniftec). */
export const LISTAS: { tipo: TipoIlustracao; titulo: string; rotulo: string }[] = [
  { tipo: 'figura', titulo: 'LISTA DE FIGURAS', rotulo: 'Figura' },
  { tipo: 'quadro', titulo: 'LISTA DE QUADROS', rotulo: 'Quadro' },
  { tipo: 'grafico', titulo: 'LISTA DE GRÁFICOS', rotulo: 'Gráfico' },
  { tipo: 'tabela', titulo: 'LISTA DE TABELAS', rotulo: 'Tabela' },
];

/** Todas as imagens usadas no trabalho final (para buscar antes de montar o PDF ou o Word). */
export function imagensDoFinal(t: Partial<TextoFinal>): string[] {
  const textos = [t.introducao, t.objetivoGeral, t.justificativa, t.consideracoes, ...(t.capitulos ?? []).map((c) => c.texto), ...(t.apendices ?? []).map((c) => c.texto), ...(t.anexos ?? []).map((c) => c.texto)];
  return [...new Set(textos.flatMap((x) => imagensDoTexto(x ?? '')))];
}

/** Siglas: "ABNT – Associação…" (uma por linha), em ordem alfabética. */
export function siglasDe(texto: string): { sigla: string; nome: string }[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(\S+)\s*[–—:-]\s*(.+)$/.exec(l);
      return m ? { sigla: m[1], nome: m[2] } : { sigla: l, nome: '' };
    })
    .sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR', { sensitivity: 'base' }));
}

export const legendaTabela = (b: { tabela: TabelaTexto; numero: number }) => `${b.tabela.tipo === 'quadro' ? 'Quadro' : 'Tabela'} ${b.numero} – ${b.tabela.titulo.trim() || 'sem título'}`;
export const legendaFigura = (b: { figura: FiguraTexto; numero: number }) => `${b.figura.tipo === 'grafico' ? 'Gráfico' : 'Figura'} ${b.numero} – ${b.figura.titulo.trim() || 'sem título'}`;
