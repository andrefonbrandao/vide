// Números: romanos (incisos), por extenso ("mil e quinze") e ordinais ("sexto").
// Todas as palavras aqui chegam já em minúsculas e sem acento.

const ROMANOS: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

/** "VI" -> 6. Devolve null se não for um romano bem formado. */
export function romanoParaNumero(s: string): number | null {
  const t = s.toLowerCase();
  if (!/^[ivxlcdm]+$/.test(t)) return null;
  let total = 0;
  for (let i = 0; i < t.length; i++) {
    const v = ROMANOS[t[i]];
    const prox = ROMANOS[t[i + 1]] ?? 0;
    total += v < prox ? -v : v;
  }
  return numeroParaRomano(total) === t.toUpperCase() ? total : null;
}

export function numeroParaRomano(n: number): string {
  const tabela: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let r = '';
  for (const [v, s] of tabela) while (n >= v) { r += s; n -= v; }
  return r;
}

const UNIDADES: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14,
  catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17,
  dezoito: 18, dezenove: 19, dezanove: 19,
};
const DEZENAS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90,
};
const CENTENAS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500,
  seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};

export const ORDINAIS: Record<string, number> = {
  primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3,
  quarto: 4, quarta: 4, quinto: 5, quinta: 5, sexto: 6, sexta: 6, setimo: 7,
  setima: 7, oitavo: 8, oitava: 8, nono: 9, nona: 9, decimo: 10, decima: 10,
  vigesimo: 20, vigesima: 20, trigesimo: 30, trigesima: 30, quadragesimo: 40,
  quinquagesimo: 50,
};

function valorPalavra(p: string): number | null {
  if (p in UNIDADES) return UNIDADES[p];
  if (p in DEZENAS) return DEZENAS[p];
  if (p in CENTENAS) return CENTENAS[p];
  return null;
}

export function ehPalavraNumero(p: string): boolean {
  return valorPalavra(p) !== null || p === 'mil' || /^\d+$/.test(p);
}

export interface NumeroLido {
  valor: number;
  /** Quantas palavras foram consumidas. */
  tamanho: number;
}

/**
 * Lê um número a partir da posição i. Aceita algarismos ("1015"), extenso
 * ("mil e quinze", "quatrocentos e oitenta e cinco", "mil 15") e, se
 * permitido, ordinais ("sexto", "decimo primeiro") e romanos ("vi").
 */
export function lerNumero(
  palavras: string[],
  i: number,
  opcoes: { ordinal?: boolean; romano?: boolean } = {},
): NumeroLido | null {
  const p = palavras[i];
  if (p === undefined) return null;

  // Algarismos, possivelmente seguidos de "mil": "1 mil"? (raro). Só algarismos.
  if (/^\d+$/.test(p)) {
    return { valor: parseInt(p, 10), tamanho: 1 };
  }

  if (opcoes.ordinal && p in ORDINAIS) {
    let valor = ORDINAIS[p];
    let tamanho = 1;
    // "decimo primeiro", "vigesimo quinto"
    if (valor >= 10 && palavras[i + 1] in ORDINAIS && ORDINAIS[palavras[i + 1]] < 10) {
      valor += ORDINAIS[palavras[i + 1]];
      tamanho = 2;
    }
    return { valor, tamanho };
  }

  if (opcoes.romano) {
    const r = romanoParaNumero(p);
    // Evita palavras comuns que parecem romanos ("di", "mil" não, mas "vi", "li" sim são aceitos)
    if (r !== null && p.length <= 6 && p !== 'mil') return { valor: r, tamanho: 1 };
  }

  // Extenso: centena, dezena e unidade, nessa ordem, ligadas por "e";
  // "mil" multiplica o que veio antes. Assim "setenta e setenta e um"
  // é lido como 70 (e o resto fica para a próxima leitura).
  let total = 0;
  let atual = 0;
  let nivel = 4; // 4 = nada lido; 3 = centena; 2 = dezena; 1 = unidade (0-19)
  let j = i;
  let fim = i; // posição logo após a última palavra numérica aceita
  const cabe = (w: string): boolean => {
    if (w === 'mil') return total === 0;
    if (w in CENTENAS) return nivel > 3;
    if (w in DEZENAS) return nivel > 2;
    if (w in UNIDADES) return nivel > 2 || (nivel === 2 && UNIDADES[w] < 10 && UNIDADES[w] > 0);
    if (/^\d+$/.test(w)) return total > 0 && atual === 0 && nivel === 4; // "mil e 15"
    return false;
  };
  while (j < palavras.length) {
    const w = palavras[j];
    if (w === 'e' && fim === j && j > i && j + 1 < palavras.length && cabe(palavras[j + 1])) {
      j++;
      continue;
    }
    if (!cabe(w)) break;
    if (w === 'mil') {
      total = (atual || 1) * 1000;
      atual = 0;
      nivel = 4;
    } else if (/^\d+$/.test(w)) {
      atual = parseInt(w, 10);
      nivel = 0;
    } else {
      atual += valorPalavra(w)!;
      nivel = w in CENTENAS ? 3 : w in DEZENAS ? 2 : 1;
    }
    j++;
    fim = j;
    if (nivel === 0) break;
  }
  if (fim === i) return null;
  return { valor: total + atual, tamanho: fim - i };
}
