// Acha citações de artigos no texto das peças ("art. 319 do CPC", "artigo 5º, LXXIV, da CF")
// para virarem links com o texto da lei. Sem dependências do navegador.

export interface Citacao {
  inicio: number;
  fim: number;
  /** Número do artigo ("319", "1015"), com letra, se houver ("1-A"). */
  artigo: string;
  /** A lei como escrita ("CPC", "Constituição Federal", "Lei 9.099/95"), ou "" (a lei principal). */
  lei: string;
}

const LEIS =
  'CPC|CF(?:\\/88)?|CC|CDC|LINDB|ADCT|Constitui[cç][aã]o(?:\\s+Federal)?|C[oó]digo\\s+Civil|C[oó]digo\\s+de\\s+Processo\\s+Civil|C[oó]digo\\s+de\\s+Defesa\\s+do\\s+Consumidor|Lei\\s+(?:n[º°o.]?\\s*)?[\\d.]+(?:\\/\\d{2,4})?';
const COMPLEMENTO = '(?:\\s*,\\s*(?:caput|§+\\s*\\d+[º°]?|par[aá]grafo\\s+[uú]nico|incisos?\\s+[IVXLC]+|[IVXLC]+(?![\\p{L}])|al[ií]nea\\s+["“]?[a-z]["”]?))*';
const RE = new RegExp(
  `\\b(?:arts?\\.|artigos?)\\s*(\\d{1,4}(?:\\.\\d{3})?)[º°]?(?:\\s*-\\s*([A-Z])(?![\\p{L}]))?(${COMPLEMENTO})(?:\\s*,?\\s*(?:d[oa]s?|da)\\s+(${LEIS}))?`,
  'giu',
);

export function acharCitacoes(texto: string): Citacao[] {
  const saida: Citacao[] = [];
  for (const m of texto.matchAll(RE)) {
    const artigo = m[1].replace('.', '') + (m[2] ? `-${m[2].toUpperCase()}` : '');
    saida.push({ inicio: m.index!, fim: m.index! + m[0].length, artigo, lei: (m[4] ?? '').replace(/\s+/g, ' ').trim() });
  }
  return saida;
}

/** Chave para guardar o texto do artigo junto da peça. */
export function chaveCitacao(c: Pick<Citacao, 'artigo' | 'lei'>): string {
  return `${c.artigo}|${c.lei.toLowerCase()}`;
}

/** Como o Vide lê um artigo digitado: "319", "5 Constituição Federal", "3 lei 9.099/95". */
export function citacaoParaDigitado(c: Pick<Citacao, 'artigo' | 'lei'>): string {
  return `${c.artigo} ${c.lei}`.trim();
}
