// Marcações simples do texto do pré-projeto (o orientando escreve num campo comum):
//   **negrito**   _itálico_   > citação longa (no começo do parágrafo)
//   ## Subtítulo (no começo da linha)   [[texto da nota de rodapé]]
// Cada linha (Enter) é um parágrafo.

export type Trecho = { t: string; negrito?: boolean; italico?: boolean } | { nota: string };

export interface Paragrafo {
  tipo: 'p' | 'citacao' | 'sub';
  trechos: Trecho[];
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
    if (comSubtitulos && /^#{2,}\s+/.test(l)) out.push({ tipo: 'sub', trechos: lerTrechos(l.replace(/^#+\s+/, '')) });
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
