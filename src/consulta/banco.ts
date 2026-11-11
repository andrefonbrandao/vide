// Guarda e lê os casos do jogo "Consulta" no banco local do navegador.
import { pertenceConteudo, vinculoConteudoNovo } from '../turmas/filtro';
import { db } from '../dados/db';
import { agoraISO, novoId } from '../dados/modelo';
import type { CasoLido } from './importar';
import type { Caso, DadosCaso } from './tipos';

export function avisarMudancaCasos(): void {
  window.dispatchEvent(new Event('vide-casos-mudou'));
}

function base() {
  const agora = agoraISO();
  return { id: novoId(), usuario_id: null, criado_em: agora, atualizado_em: agora, excluido_em: null };
}

export async function listarCasos(): Promise<Caso[]> {
  const todos = await db.casos.toArray();
  return todos.filter((c) => !c.excluido_em && pertenceConteudo(c)).sort((a, b) => b.criado_em.localeCompare(a.criado_em) || a.nome.localeCompare(b.nome));
}

export async function adicionarCasos(lista: CasoLido[], extra: { pasta: string; etiquetas: string[] }): Promise<Caso[]> {
  const casos: Caso[] = lista.map(({ assuntos, ...c }) => ({
    ...base(),
    ...vinculoConteudoNovo(),
    ...c,
    pasta: extra.pasta,
    etiquetas: [...new Set([...extra.etiquetas, ...assuntos])],
  }));
  await db.casos.bulkAdd(casos);
  avisarMudancaCasos();
  return casos;
}

export async function salvarCaso(dados: DadosCaso & { etiquetas: string[] }, existente: Caso): Promise<Caso> {
  const c: Caso = { ...existente, ...dados, atualizado_em: agoraISO() };
  await db.casos.put(c);
  avisarMudancaCasos();
  return c;
}

export async function excluirCaso(id: string): Promise<void> {
  const c = await db.casos.get(id);
  if (!c) return;
  const agora = agoraISO();
  await db.casos.put({ ...c, excluido_em: agora, atualizado_em: agora });
  avisarMudancaCasos();
}

/** Assuntos dos casos, com quantos casos há em cada um. */
export function assuntosDosCasos(casos: Pick<Caso, 'etiquetas'>[]): { assunto: string; total: number }[] {
  const c = new Map<string, number>();
  for (const x of casos) for (const a of x.etiquetas ?? []) c.set(a, (c.get(a) ?? 0) + 1);
  return [...c.entries()].map(([assunto, total]) => ({ assunto, total })).sort((a, b) => b.total - a.total || a.assunto.localeCompare(b.assunto, 'pt-BR'));
}
