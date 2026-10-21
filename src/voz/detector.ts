// Detector de referências ao CPC na fala normalizada.
//
// Reconhece, por exemplo:
//   "artigo 70 do CPC", "art 70", "artigo setenta", "artigo mil e quinze",
//   "parágrafo primeiro do artigo 300", "artigo 300 parágrafo primeiro",
//   "inciso sexto do 485", "alínea b do inciso segundo do artigo 1.015",
//   "o 485 do CPC", "artigos 70 e 71",
//   e, depois de citar um artigo, "e o inciso sétimo" (usa o artigo citado antes).
import { lerNumero, ehPalavraNumero } from './numeros';
import { normalizarFala, PALAVRA_OUTRO_DIPLOMA } from './normalizar';

export interface Referencia {
  diploma: 'cpc';
  art: number;
  par?: string; // "1", "2", "unico"
  inc?: number;
  ali?: string; // "a", "b"...
  /** Falou "do CPC" (ou equivalente) logo depois. */
  explicito: boolean;
  /** O artigo não foi dito; veio do contexto (último artigo citado). */
  contexto: boolean;
  /** Posição (em palavras normalizadas) onde a referência começa e termina. */
  inicio: number;
  fim: number;
  /** Trecho normalizado que gerou a referência (para o registro). */
  trecho: string;
}

export interface ResultadoDeteccao {
  referencias: Referencia[];
  /** Referências descartadas porque eram de outro diploma ("art. 5º da Constituição"). */
  outros: { trecho: string; diploma: string; fim: number }[];
  palavras: string[];
}

const CONECTORES = new Set(['do', 'da', 'de', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'o', 'a', 'os', 'as', 'deste', 'desse', 'em', 'ao']);
const LETRAS_FALADAS: Record<string, string> = {
  a: 'a', be: 'b', b: 'b', ce: 'c', c: 'c', de: 'd', d: 'd', e: 'e', efe: 'f', f: 'f',
  ge: 'g', g: 'g', aga: 'h', h: 'h', i: 'i', jota: 'j', j: 'j', k: 'k', l: 'l', ele: 'l',
  m: 'm', eme: 'm', n: 'n', ene: 'n', o: 'o', p: 'p', pe: 'p',
};

type Nivel = 'art' | 'par' | 'inc' | 'ali';

interface Parte {
  nivel: Nivel;
  valores: string[];
}

/** Lê o valor depois de uma palavra-chave. Devolve [valor, palavras consumidas]. */
function lerValor(nivel: Nivel, palavras: string[], i: number): [string, number] | null {
  const p = palavras[i];
  if (p === undefined) return null;
  if (nivel === 'ali') {
    const letra = LETRAS_FALADAS[p];
    return letra ? [letra, 1] : null;
  }
  if (nivel === 'par' && p === 'unico') return ['unico', 1];
  const n = lerNumero(palavras, i, { ordinal: true, romano: nivel === 'inc' });
  if (!n || n.valor <= 0) return null;
  if (nivel === 'art' && n.valor > 1100) return null; // o CPC vai até o art. 1.072
  return [String(n.valor), n.tamanho];
}

/** Pula conectores ("do", "da"...). Devolve a nova posição. */
function pularConectores(palavras: string[], i: number, max = 2): number {
  let j = i;
  while (j < palavras.length && j - i < max && CONECTORES.has(palavras[j])) j++;
  return j;
}

function lerParte(palavras: string[], i: number): { parte: Parte; fim: number } | null {
  const kw = palavras[i];
  if (kw === 'caput') return { parte: { nivel: 'art', valores: [] }, fim: i + 1 };
  if (kw !== 'art' && kw !== 'par' && kw !== 'inc' && kw !== 'ali') return null;
  const nivel = kw as Nivel;
  const primeiro = lerValor(nivel, palavras, i + 1);
  if (!primeiro) return null;
  const valores = [primeiro[0]];
  let j = i + 1 + primeiro[1];
  // Listas: "artigos 70 e 71", "incisos quinto e sexto"
  while (palavras[j] === 'e' && valores.length < 4) {
    const prox = lerValor(nivel, palavras, j + 1);
    if (!prox) break;
    // "e" seguido de palavra-chave é outra coisa ("art 70 e inciso..." não chega aqui)
    valores.push(prox[0]);
    j = j + 1 + prox[1];
  }
  return { parte: { nivel, valores }, fim: j };
}

export class Detector {
  /** Último artigo citado (para "e o inciso sétimo"). */
  private ultimoArtigo: { art: number; em: number } | null = null;
  /** Por quanto tempo o artigo citado vale como contexto (ms). */
  contextoMs = 90_000;

  detectar(texto: string, agora = Date.now()): ResultadoDeteccao {
    const palavras = normalizarFala(texto);
    const referencias: Referencia[] = [];
    const outros: ResultadoDeteccao['outros'] = [];

    let i = 0;
    while (i < palavras.length) {
      const r = this.tentar(palavras, i, agora);
      if (!r) { i++; continue; }
      if (r.tipo === 'outro') outros.push({ trecho: r.trecho, diploma: r.diploma, fim: r.fim });
      else referencias.push(...r.refs);
      i = Math.max(r.fim, i + 1);
    }
    for (const r of referencias) {
      if (!r.contexto) this.ultimoArtigo = { art: r.art, em: agora };
    }
    return { referencias, outros, palavras };
  }

  /** Esquece o contexto (ex.: ao pausar a escuta). */
  limparContexto() {
    this.ultimoArtigo = null;
  }

  private tentar(
    palavras: string[],
    i: number,
    agora: number,
  ):
    | { tipo: 'refs'; refs: Referencia[]; fim: number }
    | { tipo: 'outro'; trecho: string; diploma: string; fim: number }
    | null {
    const partes: Parte[] = [];
    let j = i;
    let artNu: string | null = null; // número "solto" do artigo: "inciso sexto do 485"

    const primeira = lerParte(palavras, j);
    if (primeira) {
      partes.push(primeira.parte);
      j = primeira.fim;
      // Continua a cadeia: "parágrafo primeiro do artigo 300", "art 300 inciso II"
      for (;;) {
        const k = pularConectores(palavras, j);
        const p = lerParte(palavras, k);
        if (p && !partes.some((x) => x.nivel === p.parte.nivel && x.valores.length)) {
          partes.push(p.parte);
          j = p.fim;
          continue;
        }
        // Número solto após conector, quando ainda falta o artigo
        if (k > j && !partes.some((x) => x.nivel === 'art' && x.valores.length) && ehPalavraNumero(palavras[k] ?? '')) {
          const n = lerNumero(palavras, k);
          if (n && n.valor > 0 && n.valor <= 1100) {
            artNu = String(n.valor);
            j = k + n.tamanho;
          }
        }
        break;
      }
    } else {
      // "o 485 do CPC": número seguido de "do cpc"
      if (!ehPalavraNumero(palavras[i])) return null;
      if (i > 0 && ehPalavraNumero(palavras[i - 1])) return null;
      const n = lerNumero(palavras, i);
      if (!n || n.valor <= 0 || n.valor > 1100) return null;
      const k = pularConectores(palavras, i + n.tamanho, 1);
      if (palavras[k] !== 'cpc') return null;
      artNu = String(n.valor);
      j = i + n.tamanho;
    }

    // Diploma dito logo depois?
    const k = pularConectores(palavras, j);
    let explicito = false;
    if (palavras[k] === 'cpc') {
      explicito = true;
      j = k + 1;
    } else if (palavras[k] === PALAVRA_OUTRO_DIPLOMA) {
      return { tipo: 'outro', trecho: palavras.slice(i, k + 2).join(' '), diploma: palavras[k + 1] ?? '?', fim: k + 2 };
    }

    const valoresDe = (n: Nivel) => partes.filter((p) => p.nivel === n).flatMap((p) => p.valores);
    let arts = valoresDe('art');
    if (artNu) arts = [artNu];
    let contexto = false;
    if (arts.length === 0) {
      const temSub = valoresDe('par').length || valoresDe('inc').length || valoresDe('ali').length;
      if (!temSub) return null;
      // "inciso sexto do" no fim da fala: o número do artigo deve vir a seguir.
      if (k > j && k >= palavras.length) return null;
      if (!this.ultimoArtigo || agora - this.ultimoArtigo.em > this.contextoMs) return null;
      arts = [String(this.ultimoArtigo.art)];
      contexto = true;
    }

    const pars = valoresDe('par');
    const incs = valoresDe('inc');
    const alis = valoresDe('ali');
    const refs: Referencia[] = [];
    const trecho = palavras.slice(i, j).join(' ');
    for (const a of arts) {
      for (const p of pars.length ? pars : [undefined]) {
        for (const inc of incs.length ? incs : [undefined]) {
          for (const al of alis.length && inc ? alis : [undefined]) {
            if (refs.length >= 6) break;
            refs.push({
              diploma: 'cpc',
              art: parseInt(a, 10),
              par: p,
              inc: inc ? parseInt(inc, 10) : undefined,
              ali: al,
              explicito,
              contexto,
              inicio: i,
              fim: j,
              trecho,
            });
          }
        }
      }
    }
    return { tipo: 'refs', refs, fim: j };
  }
}

/** Chave estável de uma referência: "cpc:485:i6", "cpc:300:p1", "cpc:1015:pu". */
export function chaveReferencia(r: Pick<Referencia, 'diploma' | 'art' | 'par' | 'inc' | 'ali'>): string {
  let k = `${r.diploma}:${r.art}`;
  if (r.par) k += r.par === 'unico' ? ':pu' : `:p${r.par}`;
  if (r.inc) k += `:i${r.inc}`;
  if (r.ali) k += `:a${r.ali}`;
  return k;
}
