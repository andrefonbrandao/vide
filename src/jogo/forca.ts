// Jogo de forca: a palavra é o conceito de uma questão "Adivinhe o conceito".
// Regras puras (sem tela nem rede), usadas no jogo em sala e no treino em casa.

/** Erros até a forca se completar (cabeça, corpo, dois braços, duas pernas). */
export const MAX_ERROS_FORCA = 6;

export const TECLADO_FORCA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** A letra "base" de um caractere: "á" -> "A", "ç" -> "C". Null se não for letra (espaço, hífen, número…). */
export function letraBase(ch: string): string | null {
  const b = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return b.length === 1 && b >= 'A' && b <= 'Z' ? b : null;
}

/** As letras (base) que a palavra tem. */
export function letrasDaPalavra(palavra: string): Set<string> {
  const s = new Set<string>();
  for (const ch of palavra) {
    const b = letraBase(ch);
    if (b) s.add(b);
  }
  return s;
}

/**
 * A palavra como aparece: cada caractere, com null no lugar das letras ainda escondidas.
 * Espaços, hífens e números aparecem desde o início.
 */
export function mascararPalavra(palavra: string, tentadas: Iterable<string>): (string | null)[] {
  const t = new Set(tentadas);
  return [...palavra.trim()].map((ch) => {
    const b = letraBase(ch);
    return b && !t.has(b) ? null : ch;
  });
}

/** Quantas das letras tentadas não estão na palavra. */
export function errosForca(palavra: string, tentadas: Iterable<string>): number {
  const tem = letrasDaPalavra(palavra);
  let n = 0;
  for (const l of new Set(tentadas)) if (!tem.has(l)) n++;
  return n;
}

/** Todas as letras da palavra já foram descobertas. */
export function palavraCompleta(palavra: string, tentadas: Iterable<string>): boolean {
  const t = new Set(tentadas);
  return [...letrasDaPalavra(palavra)].every((l) => t.has(l));
}

/** Quantas dicas aparecem: a primeira desde o início e mais uma a cada 2 erros. */
export function dicasForca(totalDicas: number, erros: number): number {
  if (totalDicas <= 0) return 0;
  return Math.min(totalDicas, 1 + Math.floor(Math.max(0, erros) / 2));
}

/** A letra digitada/votada, já normalizada (ou null se não for uma letra de A a Z). */
export function letraValida(s: unknown): string | null {
  if (typeof s !== 'string' || [...s].length !== 1) return null;
  return letraBase(s);
}
