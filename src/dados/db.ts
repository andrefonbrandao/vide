// Banco local no navegador (IndexedDB), usando a biblioteca Dexie.
// Tudo fica no aparelho: a aula não depende de internet para o acervo.
import Dexie, { type Table } from 'dexie';
import type { Diploma, EventoRegistro, Item, Material } from './modelo';
import { agoraISO } from './modelo';

class BancoVide extends Dexie {
  itens!: Table<Item, string>;
  diplomas!: Table<Diploma, string>;
  registro!: Table<EventoRegistro, number>;
  materiais!: Table<Material, string>;

  constructor() {
    super('vide');
    this.version(1).stores({
      // Primeiro campo = chave primária. Os demais são índices de busca.
      itens: 'id, chave, tipo, atualizado_em, excluido_em, *gatilhos',
      diplomas: 'id, sigla, atualizado_em',
      registro: '++seq, sessao_id, em, tipo',
    });
    // Versão 2: materiais do professor (PDF e imagens).
    this.version(2).stores({
      materiais: 'id, nome, atualizado_em, excluido_em',
    });
    // Versão 3: pastas e etiquetas dos materiais.
    this.version(3)
      .stores({ materiais: 'id, nome, pasta, *etiquetas, atualizado_em, excluido_em' })
      .upgrade((tx) =>
        tx
          .table('materiais')
          .toCollection()
          .modify((m: { pasta?: string; etiquetas?: string[] }) => {
            m.pasta ??= '';
            m.etiquetas ??= [];
          }),
      );
  }
}

export const db = new BancoVide();

/** Itens ativos (não excluídos) de um diploma. */
export async function itensDoDiploma(sigla: string): Promise<Item[]> {
  const todos = await db.itens.where('chave').startsWith(`${sigla}:`).toArray();
  return todos.filter((i) => !i.excluido_em);
}

export async function diplomaAtivo(sigla: string): Promise<Diploma | undefined> {
  const lista = await db.diplomas.where('sigla').equals(sigla).toArray();
  return lista.find((d) => !d.excluido_em);
}

/**
 * Substitui o acervo de um diploma por uma nova importação.
 * Os itens antigos não são apagados: recebem "excluido_em" (para a
 * sincronização futura saber que saíram).
 */
export async function salvarDiploma(diploma: Diploma, itens: Item[]): Promise<void> {
  const agora = agoraISO();
  await db.transaction('rw', db.itens, db.diplomas, async () => {
    const antigos = await db.itens.where('chave').startsWith(`${diploma.sigla}:`).toArray();
    for (const a of antigos) {
      if (!a.excluido_em) await db.itens.put({ ...a, excluido_em: agora, atualizado_em: agora });
    }
    const diplomasAntigos = await db.diplomas.where('sigla').equals(diploma.sigla).toArray();
    for (const d of diplomasAntigos) {
      if (!d.excluido_em) await db.diplomas.put({ ...d, excluido_em: agora, atualizado_em: agora });
    }
    await db.diplomas.add(diploma);
    await db.itens.bulkAdd(itens);
  });
}

/** Leis guardadas (ativas), da mais recente para a mais antiga. */
export async function listarDiplomas(): Promise<Diploma[]> {
  const todos = await db.diplomas.toArray();
  return todos.filter((d) => !d.excluido_em).sort((a, b) => a.sigla.localeCompare(b.sigla));
}

/** Remove uma lei do acervo (exclusão "suave", para a sincronização futura). */
export async function excluirDiploma(sigla: string): Promise<void> {
  const agora = agoraISO();
  await db.transaction('rw', db.itens, db.diplomas, async () => {
    const itens = await db.itens.where('chave').startsWith(`${sigla}:`).toArray();
    for (const i of itens) if (!i.excluido_em) await db.itens.put({ ...i, excluido_em: agora, atualizado_em: agora });
    const ds = await db.diplomas.where('sigla').equals(sigla).toArray();
    for (const d of ds) if (!d.excluido_em) await db.diplomas.put({ ...d, excluido_em: agora, atualizado_em: agora });
  });
}

/** Mapa chave -> item, carregado na memória para a detecção ser instantânea. */
export async function carregarIndice(): Promise<Map<string, Item>> {
  const todos = await db.itens.toArray();
  const mapa = new Map<string, Item>();
  for (const i of todos) if (!i.excluido_em) mapa.set(i.chave, i);
  return mapa;
}
