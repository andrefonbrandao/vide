// Marcações simples do texto do pré-projeto (o orientando escreve num campo comum):
//   **negrito**   _itálico_   > citação longa (no começo do parágrafo)
//   ## Subtítulo  ### Sub-subtítulo (no começo da linha)   [[texto da nota de rodapé]]
// Cada linha (Enter) é um parágrafo.
// Tabela ou quadro (trabalho final), em linhas próprias:
//   ::: Tabela – Título da tabela
//   Coluna 1 | Coluna 2
//   valor | valor
//   Fonte: o autor.
//   :::

export type Trecho = { t: string; negrito?: boolean; italico?: boolean } | { nota: string };

export interface Paragrafo {
  tipo: 'p' | 'citacao' | 'sub';
  trechos: Trecho[];
  /** Subtítulo: 2 ("## ") ou 3 ("### "). */
  nivel?: 2 | 3;
}

export interface TabelaTexto {
  tipo: 'tabela' | 'quadro';
  titulo: string;
  fonte: string;
  /** A primeira linha é o cabeçalho. */
  linhas: string[][];
}

export type Pedaco = { tipo: 'texto'; texto: string } | { tipo: 'tabela'; tabela: TabelaTexto };

const RE_INICIO_TABELA = /^:::\s*(tabela|quadro)\b\s*[–—-]?\s*(.*)$/i;

/** Separa o texto em trechos corridos e tabelas/quadros. */
export function separarTabelas(texto: string): Pedaco[] {
  const out: Pedaco[] = [];
  let buf: string[] = [];
  let tab: TabelaTexto | null = null;
  const soltarTexto = () => {
    if (buf.length) out.push({ tipo: 'texto', texto: buf.join('\n') });
    buf = [];
  };
  for (const bruta of texto.replace(/\r/g, '').split('\n')) {
    const l = bruta.trim();
    if (!tab) {
      const m = RE_INICIO_TABELA.exec(l);
      if (m) {
        soltarTexto();
        tab = { tipo: m[1].toLowerCase() === 'quadro' ? 'quadro' : 'tabela', titulo: m[2].trim(), fonte: '', linhas: [] };
      } else buf.push(bruta);
      continue;
    }
    if (l === ':::') {
      out.push({ tipo: 'tabela', tabela: tab });
      tab = null;
    } else if (/^fonte\s*:/i.test(l)) tab.fonte = l.replace(/^fonte\s*:\s*/i, '');
    else if (l) tab.linhas.push(l.split('|').map((c) => c.trim()));
  }
  if (tab) out.push({ tipo: 'tabela', tabela: tab });
  soltarTexto();
  return out;
}

/** O texto de uma tabela/quadro, como fica no campo. */
export function textoDaTabela(t: TabelaTexto): string {
  const limpa = (c: string) => c.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();
  const larg = Math.max(1, ...t.linhas.map((l) => l.length));
  return [
    `::: ${t.tipo === 'quadro' ? 'Quadro' : 'Tabela'} – ${t.titulo.trim()}`,
    ...t.linhas.map((l) => Array.from({ length: larg }, (_, k) => limpa(l[k] ?? '')).join(' | ')),
    `Fonte: ${t.fonte.trim() || 'o autor.'}`,
    ':::',
  ].join('\n');
}

/** Lê negrito, itálico e notas dentro de uma linha. */
export function lerTrechos(linha: string): Trecho[] {
  const out: Trecho[] = [];
  let negrito = false;
  let italico = false;
  let buf = '';
  const soltar = () => {
    if (buf) out.push({ t: buf, ...(negrito ? { negrito } : {}), ...(italico ? { italico } : {}) });
    buf = '';
  };
  for (let i = 0; i < linha.length; i++) {
    if (linha.startsWith('[[', i)) {
      const fim = linha.indexOf(']]', i + 2);
      if (fim > i) {
        soltar();
        out.push({ nota: linha.slice(i + 2, fim).trim() });
        i = fim + 1;
        continue;
      }
    }
    if (linha.startsWith('**', i)) {
      soltar();
      negrito = !negrito;
      i++;
      continue;
    }
    const c = linha[i];
    // "_" de itálico só quando abre antes de letra ou fecha depois de letra (não em nomes_de_arquivo).
    if (c === '_' && (italico ? /\S/.test(linha[i - 1] ?? '') : /\S/.test(linha[i + 1] ?? '') && !/\w/.test(linha[i - 1] ?? ''))) {
      soltar();
      italico = !italico;
      continue;
    }
    buf += c;
  }
  soltar();
  return out;
}

export function lerParagrafos(texto: string, comSubtitulos = false): Paragrafo[] {
  const out: Paragrafo[] = [];
  for (const bruta of texto.replace(/\r/g, '').split('\n')) {
    const l = bruta.trim();
    if (!l) continue;
    if (comSubtitulos && /^#{2,}\s+/.test(l)) out.push({ tipo: 'sub', nivel: /^#{3,}/.test(l) ? 3 : 2, trechos: lerTrechos(l.replace(/^#+\s+/, '')) });
    else if (/^>\s*/.test(l)) out.push({ tipo: 'citacao', trechos: lerTrechos(l.replace(/^>\s*/, '')) });
    else out.push({ tipo: 'p', trechos: lerTrechos(l) });
  }
  return out;
}

/** Texto sem as marcações (para ordenar referências, sumário…). */
export function textoPuro(s: string): string {
  return lerTrechos(s)
    .map((t) => ('t' in t ? t.t : ''))
    .join('')
    .trim();
}

/** Referências em ordem alfabética (ignorando marcações e acentos). */
export function ordenarReferencias(texto: string): string[] {
  return texto
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .sort((a, b) => textoPuro(a).localeCompare(textoPuro(b), 'pt-BR', { sensitivity: 'base' }));
}
