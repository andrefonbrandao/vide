// Texto do botão de avançar do jogo "Consulta" (tela do professor e celular-controle).

/** O que o próximo clique do professor faz. */
export function rotuloAvancarConsulta(t: { fase: string; falasVisiveis: number; caso: { falas: unknown[] }; indice: number; total: number }): string | null {
  if (t.fase === 'caso') return t.falasVisiveis < t.caso.falas.length ? 'Mostrar todas as falas' : 'Mostrar a resposta';
  if (t.fase === 'resposta') return t.indice < t.total - 1 ? 'Próximo caso' : 'Terminar';
  return null;
}
