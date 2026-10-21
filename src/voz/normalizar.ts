// Normalização da fala transcrita: unifica as variações antes da busca.
// "Artigo 1.015 do Código de Processo Civil" -> ["art", "1015", "do", "cpc"]

export const PALAVRA_OUTRO_DIPLOMA = '§outro';

/** Siglas e nomes que NÃO são o CPC (para não sugerir o artigo errado). */
const OUTROS_DIPLOMAS = new Set([
  'constituicao', 'cf', 'cc', 'clt', 'cdc', 'cp', 'cpp', 'ctn', 'eca', 'lindb', 'lei',
  'leis', 'decreto', 'regimento', 'ricpc', 'estatuto', 'sumula', 'tema', 'resolucao',
  'emenda', 'adct', 'convencao', 'codigo',
]);

/**
 * Palavras-chave viram marcadores com "§" na frente, para não se confundirem
 * com palavras comuns da fala (ex.: "diz ali o artigo 70" — "ali" não é alínea).
 */
export const KW = { art: '§art', par: '§par', inc: '§inc', ali: '§ali', caput: '§caput' } as const;

const PALAVRAS_CHAVE: Record<string, string> = {
  art: KW.art, arts: KW.art, artigo: KW.art, artigos: KW.art, artigue: KW.art,
  paragrafo: KW.par, paragrafos: KW.par,
  inciso: KW.inc, incisos: KW.inc,
  alinea: KW.ali, alineas: KW.ali, letra: KW.ali,
  caput: KW.caput, capute: KW.caput, caputi: KW.caput,
};

export function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Converte a fala em uma lista de palavras normalizadas. */
export function normalizarFala(texto: string): string[] {
  let t = texto.toLowerCase();
  t = t.replace(/§§/g, ' paragrafos ').replace(/§/g, ' paragrafo ');
  t = semAcentos(t);
  t = t.replace(/\bn[º°o.]\s*(?=\d)/g, ' '); // "nº 70"
  t = t.replace(/(\d)[º°ª]/g, '$1');
  // Separador de milhar: "1.015" -> "1015"
  t = t.replace(/(\d)\.(?=\d{3}\b)/g, '$1');
  // "c.p.c." -> "c p c"
  t = t.replace(/[^a-z0-9]+/g, ' ');
  let palavras = t.split(' ').filter(Boolean);

  // Junta expressões de várias palavras.
  const saida: string[] = [];
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];
    const a = palavras.slice(i, i + 5).join(' ');
    if (/^c p c\b/.test(a)) { saida.push('cpc'); i += 2; continue; }
    if (/^ce pe ce\b/.test(a)) { saida.push('cpc'); i += 2; continue; }
    if (/^codigo de processo civil\b/.test(a)) { saida.push('cpc'); i += 3; continue; }
    if (/^codigo processual civil\b/.test(a)) { saida.push('cpc'); i += 2; continue; }
    if (/^codigo do processo civil\b/.test(a)) { saida.push('cpc'); i += 3; continue; }
    if (/^novo cpc\b/.test(a)) { saida.push('cpc'); i += 1; continue; }
    if (p === 'ncpc' || p === 'cepece' || p === 'cpcs') { saida.push('cpc'); continue; }
    if (/^paragrafo unico\b/.test(a)) { saida.push(KW.par, 'unico'); i += 1; continue; }
    if (OUTROS_DIPLOMAS.has(p)) { saida.push(PALAVRA_OUTRO_DIPLOMA, p); continue; }
    saida.push(PALAVRAS_CHAVE[p] ?? p);
  }
  palavras = saida;
  return palavras;
}
