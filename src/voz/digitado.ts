// Lê uma referência digitada pelo professor, na forma curta de escrever:
//   "485 VI", "art. 485, VI", "300 §1º", "300 pu", "1.015, I", "1022 II b",
//   "5 CF", "CF 5, LXIX", "186 CC", "3 lei 9.099", "103-A CF".
// Sem lei, usa a lei principal da aula.
import type { DefDiploma } from '../dados/diplomas';

export interface ReferenciaDigitada {
  diploma: string;
  art: number;
  sufixo?: string;
  par?: string; // "1", "2", "unico"
  inc?: number;
  ali?: string;
}

export type ResultadoDigitado = { ok: true; ref: ReferenciaDigitada } | { ok: false; erro: string };

const IGNORAR = new Set(['art', 'arts', 'artigo', 'do', 'da', 'de', 'dos', 'das', 'no', 'na', 'caput', 'o', 'e']);
const PALAVRAS_PAR = new Set(['§', 'par', 'p', 'paragrafo']);
const PALAVRAS_INC = new Set(['inc', 'inciso']);
const PALAVRAS_ALI = new Set(['al', 'alinea']);
const ORDINAIS: Record<string, string> = { primeiro: '1', segundo: '2', terceiro: '3', quarto: '4', quinto: '5', sexto: '6', setimo: '7', oitavo: '8', nono: '9', decimo: '10' };

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "vi" -> 6. Devolve null se não for algarismo romano válido. */
export function romano(s: string): number | null {
  if (!/^[ivxlc]+$/.test(s)) return null;
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]];
    const b = v[s[i + 1]] ?? 0;
    total += a < b ? -a : a;
  }
  return total > 0 && total < 200 ? total : null;
}

/** Tira o nome da lei do texto. Devolve a sigla achada (ou null) e o resto do texto. */
function extrairLei(texto: string, diplomas: DefDiploma[]): { sigla: string | null; resto: string } {
  // "lei 9.099/1995", "lei nº 9099"
  const mLei = texto.match(/\blei\s*(?:n\s*|no\s*|numero\s*)?(\d+)(?:\s+\d{2,4})?\b/);
  if (mLei) {
    const d = diplomas.find((x) => x.numeroLei === mLei[1]);
    if (d) return { sigla: d.sigla, resto: texto.replace(mLei[0], ' ') };
  }
  let melhor: { sigla: string; nome: string } | null = null;
  for (const d of diplomas) {
    const nomes = [...d.apelidos, semAcento(d.abreviacao).replace(/[^a-z0-9 ]/g, ' ').trim(), d.sigla];
    for (const nome of nomes) {
      if (!nome || (melhor && nome.length <= melhor.nome.length)) continue;
      if (new RegExp(`(^| )${nome.replace(/\s+/g, '\\s+')}( |$)`).test(texto)) melhor = { sigla: d.sigla, nome };
    }
  }
  if (!melhor) return { sigla: null, resto: texto };
  return { sigla: melhor.sigla, resto: texto.replace(new RegExp(`(^| )${melhor.nome.replace(/\s+/g, '\\s+')}( |$)`), ' ') };
}

export function lerDigitado(entrada: string, diplomas: DefDiploma[], principal: string): ResultadoDigitado {
  let t = semAcento(entrada)
    .replace(/(\d)\.(\d{3})/g, '$1$2') // 1.015 -> 1015
    .replace(/(\d)\s*[º°ª]/g, '$1')
    .replace(/\bp\.\s*u\.?/g, ' pu ')
    .replace(/§+/g, ' § ')
    .replace(/[,;:()/]|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return { ok: false, erro: 'Digite um artigo, por exemplo: 485 VI' };

  const { sigla, resto } = extrairLei(t, diplomas);
  t = resto.replace(/(\d)([a-z]{2,})/g, '$1 $2').trim(); // "485inc" -> "485 inc"
  const tokens = t.split(' ').filter(Boolean);

  let art: number | null = null;
  let sufixo: string | undefined;
  let par: string | undefined;
  let inc: number | undefined;
  let ali: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (art === null) {
      const m = tk.match(/^(\d{1,4})(?:o)?(?:-?([a-z]{1,2}))?$/);
      if (m && !(m[2] && !tk.includes('-') && m[2] !== 'o')) {
        art = parseInt(m[1], 10);
        if (m[2] && m[2] !== 'o') sufixo = m[2].toUpperCase();
        continue;
      }
      if (IGNORAR.has(tk)) continue;
      return { ok: false, erro: `Não entendi "${tk}". Comece pelo número do artigo, por exemplo: 485 VI` };
    }
    if (tk === 'pu' || (tk === 'paragrafo' && tokens[i + 1] === 'unico') || (tk === 'unico' && !par)) {
      par = 'unico';
      if (tokens[i + 1] === 'unico') i++;
      continue;
    }
    if (PALAVRAS_PAR.has(tk)) {
      const v = tokens[i + 1];
      if (v === 'unico') par = 'unico';
      else if (v && /^\d+$/.test(v)) par = String(parseInt(v, 10));
      else if (v && ORDINAIS[v]) par = ORDINAIS[v];
      else return { ok: false, erro: 'Faltou o número do parágrafo (ex.: 300 §1)' };
      i++;
      continue;
    }
    if (PALAVRAS_INC.has(tk)) {
      const v = tokens[i + 1];
      const n = v ? (/^\d+$/.test(v) ? parseInt(v, 10) : romano(v)) : null;
      if (!n) return { ok: false, erro: 'Faltou o número do inciso (ex.: 485 inc VI)' };
      inc = n;
      i++;
      continue;
    }
    if (PALAVRAS_ALI.has(tk)) {
      const v = tokens[i + 1];
      if (!v || !/^[a-z]$/.test(v)) return { ok: false, erro: 'Faltou a letra da alínea (ex.: 1022 II al b)' };
      ali = v;
      i++;
      continue;
    }
    // Depois do inciso, uma letra sozinha é alínea ("1022 II b").
    if (inc !== undefined && !ali && /^[a-z]$/.test(tk)) {
      ali = tk;
      continue;
    }
    const r = romano(tk);
    if (r !== null && inc === undefined) {
      inc = r;
      continue;
    }
    if (IGNORAR.has(tk)) continue;
    return { ok: false, erro: `Não entendi "${tk}". Use, por exemplo: 485 VI, 300 §1, 5 CF` };
  }
  if (art === null || art <= 0) return { ok: false, erro: 'Faltou o número do artigo.' };
  return { ok: true, ref: { diploma: sigla ?? principal, art, sufixo, par, inc, ali } };
}
