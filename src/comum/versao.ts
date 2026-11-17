// Comparação de versões do Vide ("0.9.0" < "0.10.0").

/** -1 se a < b, 0 se iguais, 1 se a > b. Versão desconhecida ("?") conta como a mais antiga. */
export function compararVersao(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
