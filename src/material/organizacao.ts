// Organização dos materiais: busca, filtro por etiqueta e agrupamento por pasta.

export interface MaterialOrganizavel {
  id: string;
  nome: string;
  pasta?: string;
  etiquetas?: string[];
}

function semAcento(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Filtra por texto (procura no nome, na pasta e nas etiquetas; todas as palavras
 * digitadas precisam aparecer) e, se houver, por etiqueta.
 */
export function filtrarMateriais<T extends MaterialOrganizavel>(lista: T[], busca: string, etiqueta: string | null = null): T[] {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  return lista.filter((m) => {
    if (etiqueta && !(m.etiquetas ?? []).includes(etiqueta)) return false;
    if (!termos.length) return true;
    const texto = semAcento(`${m.nome} ${m.pasta ?? ''} ${(m.etiquetas ?? []).join(' ')}`);
    return termos.every((t) => texto.includes(t));
  });
}

export interface GrupoPasta<T> {
  /** Caminho completo ("" = sem pasta). */
  pasta: string;
  itens: T[];
}

/** Agrupa por pasta, em ordem alfabética; "Sem pasta" por último. */
export function agruparPorPasta<T extends MaterialOrganizavel>(lista: T[]): GrupoPasta<T>[] {
  const mapa = new Map<string, T[]>();
  for (const m of lista) {
    const p = m.pasta ?? '';
    mapa.set(p, [...(mapa.get(p) ?? []), m]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'pt-BR')))
    .map(([pasta, itens]) => ({ pasta, itens: itens.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR', { numeric: true })) }));
}

/** Todas as pastas usadas (inclui as pastas "mães" de subpastas). */
export function todasPastas(lista: MaterialOrganizavel[]): string[] {
  const s = new Set<string>();
  for (const m of lista) {
    const partes = (m.pasta ?? '').split('/').filter(Boolean);
    for (let i = 1; i <= partes.length; i++) s.add(partes.slice(0, i).join('/'));
  }
  return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Etiquetas com a quantidade de materiais de cada uma, das mais usadas para as menos. */
export function todasEtiquetas(lista: MaterialOrganizavel[]): { etiqueta: string; total: number }[] {
  const c = new Map<string, number>();
  for (const m of lista) for (const e of m.etiquetas ?? []) c.set(e, (c.get(e) ?? 0) + 1);
  return [...c.entries()]
    .map(([etiqueta, total]) => ({ etiqueta, total }))
    .sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta, 'pt-BR'));
}

export function nomePasta(pasta: string): string {
  return pasta ? pasta.split('/').join(' › ') : 'Sem pasta';
}
