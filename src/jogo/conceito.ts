// "Adivinhe o conceito": comparação da resposta digitada e tempo das dicas.

const ARTIGOS = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas']);

/** "  A Sentença! " -> "sentenca": sem maiúsculas, acentos, pontuação, espaços extras e artigo inicial. */
export function normalizarResposta(s: string): string {
  const palavras = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (palavras.length > 1 && ARTIGOS.has(palavras[0])) palavras.shift();
  return palavras.join(' ');
}

/** Palavras de abertura que não contam ("é a sentença", "seria a sentença", "trata-se da sentença"). */
const ABERTURAS = [
  ['trata', 'se', 'de'],
  ['trata', 'se', 'da'],
  ['trata', 'se', 'do'],
  ['trata', 'se'],
  ['acho', 'que', 'e'],
  ['acho', 'que'],
  ['resposta'],
  ['e'],
  ['eh'],
  ['seria'],
  ['sera'],
];

/** Tira palavras de abertura e artigos do começo. */
function semAbertura(palavras: string[]): string[] {
  const p = [...palavras];
  let mudou = true;
  while (mudou && p.length > 1) {
    mudou = false;
    for (const a of ABERTURAS) {
      if (p.length > a.length && a.every((w, i) => p[i] === w)) {
        p.splice(0, a.length);
        mudou = true;
      }
    }
    while (p.length > 1 && ARTIGOS.has(p[0])) {
      p.shift();
      mudou = true;
    }
  }
  return p;
}

/** Singular aproximado: "sentencas" -> "sentenca", "decisoes" -> "decisao", "recursos" -> "recurso". */
function singular(palavra: string): string {
  if (palavra.length <= 3) return palavra;
  if (palavra.endsWith('oes') || palavra.endsWith('aes')) return `${palavra.slice(0, -3)}ao`;
  if (palavra.endsWith('ais')) return `${palavra.slice(0, -3)}al`;
  if (palavra.endsWith('eis')) return `${palavra.slice(0, -3)}el`;
  if (palavra.endsWith('res') || palavra.endsWith('zes')) return palavra.slice(0, -2);
  if (palavra.endsWith('s')) return palavra.slice(0, -1);
  return palavra;
}

/** Forma comparável: sem abertura, no singular e sem espaços ("A coisa-julgada" -> "coisajulgada"). */
export function formaComparavel(s: string): string {
  const palavras = semAbertura(normalizarResposta(s).split(' ').filter(Boolean));
  return palavras.map(singular).join('');
}

/** Distância entre dois textos (letras a mais, a menos, trocadas ou invertidas). */
export function distancia(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** Quantos erros de digitação se admitem: nenhum até 4 letras, 1 até 8, 2 a partir de 9. */
export function toleranciaPara(tamanho: number): number {
  return tamanho <= 4 ? 0 : tamanho <= 8 ? 1 : 2;
}

export type Conferencia = 'exata' | 'parecida' | 'errada';

/**
 * Confere a resposta com o conceito e as respostas aceitas, admitindo pequenos erros.
 * `outras`: respostas de outros conceitos do mesmo jogo; se o aluno digitou exatamente
 * uma delas, não vale como acerto, mesmo que seja parecida.
 */
export function conferirResposta(resposta: string, conceito: string, aceitas: string[] = [], outras: string[] = []): Conferencia {
  const r = formaComparavel(resposta);
  if (!r) return 'errada';
  const alvos = [conceito, ...aceitas].map(formaComparavel).filter(Boolean);
  if (alvos.includes(r)) return 'exata';
  if (outras.map(formaComparavel).includes(r)) return 'errada';
  return alvos.some((a) => distancia(r, a) <= toleranciaPara(a.length)) ? 'parecida' : 'errada';
}

/** A resposta vale como certa (exata ou parecida)? */
export function respostaCerta(resposta: string, conceito: string, aceitas: string[] = [], outras: string[] = []): boolean {
  return conferirResposta(resposta, conceito, aceitas, outras) !== 'errada';
}

/** Quantas dicas já estão à mostra: a 1ª no início, as outras em intervalos iguais. */
export function dicasVisiveis(totalDicas: number, tempoMs: number, decorridoMs: number): number {
  if (totalDicas <= 0) return 0;
  const passo = tempoMs / totalDicas;
  return Math.min(totalDicas, 1 + Math.floor(Math.max(0, decorridoMs) / passo));
}

/** Quando (ms desde o início) aparece a próxima dica; null se já estão todas. */
export function proximaDica(totalDicas: number, tempoMs: number, decorridoMs: number): number | null {
  const v = dicasVisiveis(totalDicas, tempoMs, decorridoMs);
  return v >= totalDicas ? null : (tempoMs / totalDicas) * v;
}

/** Pontos de um acerto: 1000 logo no início, caindo até 300 no fim do tempo. */
export function pontosConceito(msGastos: number, tempoMs: number): number {
  const f = Math.max(0, Math.min(1, msGastos / Math.max(1, tempoMs)));
  return Math.round(1000 - 700 * f);
}
