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

/** A resposta bate com o conceito ou com uma das respostas aceitas? */
export function respostaCerta(resposta: string, conceito: string, aceitas: string[] = []): boolean {
  const r = normalizarResposta(resposta);
  if (!r) return false;
  return [conceito, ...aceitas].some((c) => normalizarResposta(c) === r);
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
