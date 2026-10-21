// Detector de referências a dispositivos de lei na fala normalizada.
//
// Reconhece, por exemplo:
//   "artigo 70 do CPC", "art 70", "artigo setenta", "artigo mil e quinze",
//   "artigo 5º da Constituição", "art. 186 do Código Civil", "artigo 3º da Lei 9.099",
//   "parágrafo primeiro do artigo 300", "artigo 300 parágrafo primeiro",
//   "inciso sexto do 485", "alínea b do inciso segundo do artigo 1.015",
//   "o 485 do CPC", "artigos 70 e 71",
//   e, depois de citar um artigo, "e o inciso sétimo" (usa o artigo e a lei citados antes).
// Quando a lei não é dita, usa a "lei principal" da aula (normalmente o CPC).
import { CATALOGO, type DefDiploma } from '../dados/diplomas';
import { lerNumero, ehPalavraNumero } from './numeros';
import { KW, PALAVRA_OUTRO_DIPLOMA, criarNormalizador, ehDiploma, siglaDe, type Normalizador } from './normalizar';

export interface Referencia {
  /** Sigla da lei: "cpc", "cf", "l9099". */
  diploma: string;
  art: number;
  /** Letra do artigo ("A" em 103-A). */
  sufixo?: string;
  par?: string; // "1", "2", "unico"
  inc?: number;
  ali?: string; // "a", "b"...
  /** A lei foi dita ("do CPC", "da Constituição"). */
  explicito: boolean;
  /** O artigo não foi dito; veio do contexto (último artigo citado). */
  contexto: boolean;
  /** O parágrafo também veio do contexto ("parágrafo 1º do 489" ... "inciso 5º"). */
  parDoContexto?: boolean;
  /** Posição (em palavras normalizadas) onde a referência começa e termina. */
  inicio: number;
  fim: number;
  /** Trecho normalizado que gerou a referência (para o registro). */
  trecho: string;
}

export interface ResultadoDeteccao {
  referencias: Referencia[];
  /** Referências descartadas porque eram de uma lei fora do catálogo ("art. 7º da CLT"). */
  outros: { trecho: string; diploma: string; fim: number; art: number | null }[];
  palavras: string[];
}

const CONECTORES = new Set(['do', 'da', 'de', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'o', 'a', 'os', 'as', 'deste', 'desse', 'em', 'ao']);
const LETRAS_FALADAS: Record<string, string> = {
  a: 'a', be: 'b', b: 'b', ce: 'c', c: 'c', de: 'd', d: 'd', e: 'e', efe: 'f', f: 'f',
  ge: 'g', g: 'g', aga: 'h', h: 'h', i: 'i', jota: 'j', j: 'j', k: 'k', l: 'l', ele: 'l',
  m: 'm', eme: 'm', n: 'n', ene: 'n', o: 'o', p: 'p', pe: 'p',
};
/** Maior número de artigo aceito antes de saber a lei (o Código Civil vai até 2.046). */
const MAX_ARTIGO_GERAL = 2100;

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
  // Artigo com letra escrito pelo reconhecedor: "103a" (de "103-A").
  if (nivel === 'art') {
    const m = /^(\d{1,4})([a-h])$/.exec(p);
    if (m && +m[1] > 0 && +m[1] <= MAX_ARTIGO_GERAL) return [`${+m[1]}-${m[2].toUpperCase()}`, 1];
  }
  const n = lerNumero(palavras, i, { ordinal: true, romano: nivel === 'inc' });
  if (!n || n.valor <= 0) return null;
  if (nivel === 'art' && n.valor > MAX_ARTIGO_GERAL) return null;
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
  if (kw === KW.caput) return { parte: { nivel: 'art', valores: [] }, fim: i + 1 };
  const niveis: Nivel[] = ['art', 'par', 'inc', 'ali'];
  const nivel = niveis.find((n) => KW[n] === kw);
  if (!nivel) return null;
  const primeiro = lerValor(nivel, palavras, i + 1);
  if (!primeiro) return null;
  const valores = [primeiro[0]];
  let j = i + 1 + primeiro[1];
  // Listas: "artigos 70 e 71", "incisos quinto e sexto"
  while (palavras[j] === 'e' && valores.length < 4) {
    const prox = lerValor(nivel, palavras, j + 1);
    if (!prox) break;
    valores.push(prox[0]);
    j = j + 1 + prox[1];
  }
  return { parte: { nivel, valores }, fim: j };
}

function separarArtigo(v: string): { art: number; sufixo?: string } {
  const [n, suf] = v.split('-');
  return { art: parseInt(n, 10), sufixo: suf || undefined };
}

export interface OpcoesDetector {
  /** Leis conhecidas (catálogo + cadastradas pelo professor). */
  diplomas?: DefDiploma[];
  /** Lei usada quando o professor não diz qual ("artigo 70"). */
  principal?: string;
}

export class Detector {
  /** Último artigo citado (para "e o inciso sétimo"). */
  private ultimoArtigo: { diploma: string; art: number; sufixo?: string; par?: string; em: number } | null = null;
  /** Por quanto tempo o artigo citado vale como contexto (ms). */
  contextoMs = 90_000;
  private normalizar: Normalizador;
  private maximos: Map<string, number>;
  readonly principal: string;

  constructor(opcoes: OpcoesDetector = {}) {
    const diplomas = opcoes.diplomas ?? CATALOGO;
    this.normalizar = criarNormalizador(diplomas);
    this.maximos = new Map(diplomas.map((d) => [d.sigla, d.maxArtigo]));
    this.principal = opcoes.principal ?? 'cpc';
  }

  /** Converte a fala em palavras normalizadas (com as leis deste detector). */
  palavrasDe(texto: string): string[] {
    return this.normalizar(texto);
  }

  /**
   * @param opcoes.parcial texto provisório (ainda pode mudar): uma referência
   *   só vale se já houver alguma palavra depois dela que não seja "do", "da"...
   *   Assim "o artigo 5º da" espera a palavra seguinte ("Constituição"?) e
   *   "o artigo 4" espera para ver se não vira "48" ou "489".
   */
  detectar(texto: string, agora = Date.now(), opcoes: { parcial?: boolean } = {}): ResultadoDeteccao {
    const palavras = this.normalizar(texto);
    const referencias: Referencia[] = [];
    const outros: ResultadoDeteccao['outros'] = [];

    let i = 0;
    while (i < palavras.length) {
      const r = this.tentar(palavras, i, agora);
      if (!r) { i++; continue; }
      const incompleto = opcoes.parcial && pularConectores(palavras, r.fim, Infinity) >= palavras.length;
      if (r.tipo === 'outro') outros.push({ trecho: r.trecho, diploma: r.diploma, fim: r.fim, art: r.art });
      else if (!incompleto) referencias.push(...r.refs);
      i = Math.max(r.fim, i + 1);
    }
    for (const r of referencias) {
      if (!r.contexto) this.ultimoArtigo = { diploma: r.diploma, art: r.art, sufixo: r.sufixo, par: r.par, em: agora };
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
    | { tipo: 'outro'; trecho: string; diploma: string; fim: number; art: number | null }
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
          if (n && n.valor > 0 && n.valor <= MAX_ARTIGO_GERAL) {
            artNu = String(n.valor);
            j = k + n.tamanho;
          }
        }
        break;
      }
    } else {
      // "o 485 do CPC": número seguido do nome da lei
      if (!ehPalavraNumero(palavras[i])) return null;
      if (i > 0 && ehPalavraNumero(palavras[i - 1])) return null;
      const n = lerNumero(palavras, i);
      if (!n || n.valor <= 0 || n.valor > MAX_ARTIGO_GERAL) return null;
      const k = pularConectores(palavras, i + n.tamanho, 1);
      if (!ehDiploma(palavras[k])) return null;
      artNu = String(n.valor);
      j = i + n.tamanho;
    }

    // Lei dita logo depois?
    const k = pularConectores(palavras, j);
    let diploma: string | null = null;
    if (ehDiploma(palavras[k])) {
      diploma = siglaDe(palavras[k]);
      j = k + 1;
    } else if (palavras[k] === PALAVRA_OUTRO_DIPLOMA) {
      // "código" no fim da fala ainda pode virar "código civil" no trecho seguinte.
      if (palavras[k + 1] === 'codigo' && k + 2 >= palavras.length) return null;
      const artDito = artNu ?? partes.find((x) => x.nivel === 'art' && x.valores.length)?.valores[0] ?? null;
      return {
        tipo: 'outro',
        trecho: palavras.slice(i, k + 2).join(' ').replace(/§(outro )?/g, ''),
        diploma: palavras[k + 1] ?? '?',
        fim: k + 2,
        art: artDito ? separarArtigo(artDito).art : null,
      };
    }

    const valoresDe = (n: Nivel) => partes.filter((p) => p.nivel === n).flatMap((p) => p.valores);
    let arts = valoresDe('art');
    if (artNu) arts = [artNu];
    let contexto = false;
    let parContexto: string | undefined;
    if (arts.length === 0) {
      // Pelo contexto, só parágrafo ou inciso (alínea sozinha é ambígua demais).
      const temSub = valoresDe('par').length || valoresDe('inc').length;
      if (!temSub) return null;
      // "inciso sexto do" no fim da fala: o número do artigo deve vir a seguir.
      if (k > j && k >= palavras.length) return null;
      const u = this.ultimoArtigo;
      if (!u || agora - u.em > this.contextoMs) return null;
      // "inciso 5º da Constituição" com o último artigo sendo de outra lei: não usa o contexto.
      if (diploma && diploma !== u.diploma) return null;
      arts = [u.sufixo ? `${u.art}-${u.sufixo}` : String(u.art)];
      diploma = u.diploma;
      contexto = true;
      // "inciso 5º" logo depois de "parágrafo 1º do artigo 489": inciso do § 1º.
      if (!valoresDe('par').length && u.par) parContexto = u.par;
    }

    const explicito = diploma !== null && !contexto;
    const lei = diploma ?? this.principal;
    const max = this.maximos.get(lei) ?? MAX_ARTIGO_GERAL;
    const pars = parContexto ? [parContexto] : valoresDe('par');
    const incs = valoresDe('inc');
    const alis = valoresDe('ali');
    const refs: Referencia[] = [];
    const trecho = palavras.slice(i, j).join(' ').replace(/§dip:/g, '').replace(/§/g, '');
    for (const a of arts) {
      const { art, sufixo } = separarArtigo(a);
      if (art > max) continue;
      for (const p of pars.length ? pars : [undefined]) {
        for (const inc of incs.length ? incs : [undefined]) {
          for (const al of alis.length && inc ? alis : [undefined]) {
            if (refs.length >= 6) break;
            refs.push({
              diploma: lei,
              art,
              sufixo,
              par: p,
              inc: inc ? parseInt(inc, 10) : undefined,
              ali: al,
              explicito,
              contexto,
              parDoContexto: parContexto ? true : undefined,
              inicio: i,
              fim: j,
              trecho,
            });
          }
        }
      }
    }
    if (!refs.length) return null;
    return { tipo: 'refs', refs, fim: j };
  }
}

/** Chave estável de uma referência: "cpc:485:i6", "cf:5:i78", "cf:103-A", "cpc:1015:pu". */
export function chaveReferencia(r: Pick<Referencia, 'diploma' | 'art' | 'sufixo' | 'par' | 'inc' | 'ali'>): string {
  let k = `${r.diploma}:${r.art}${r.sufixo ? `-${r.sufixo}` : ''}`;
  if (r.par) k += r.par === 'unico' ? ':pu' : `:p${r.par}`;
  if (r.inc) k += `:i${r.inc}`;
  if (r.ali) k += `:a${r.ali}`;
  return k;
}
