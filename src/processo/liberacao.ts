// Quais eventos os alunos já podem ver. Usado no app (prévia) e no serviço do Cloudflare,
// que só entrega os liberados (os futuros nunca chegam ao celular).
// Sem dependências do navegador: o worker importa este arquivo.

export interface ComLibera {
  libera: number | null;
}

/** Já liberado? null = segurado pelo professor. */
export function liberado(e: ComLibera, agora: number): boolean {
  return e.libera !== null && e.libera <= agora;
}

/** Os dados como o aluno recebe: só os eventos liberados, sem a data de liberação. */
export function paraAluno<T extends { eventos: (ComLibera & object)[] }>(dados: T, agora: number): T {
  return {
    ...dados,
    eventos: dados.eventos.filter((e) => liberado(e, agora)).map(({ libera: _l, ...resto }) => resto),
  } as T;
}
