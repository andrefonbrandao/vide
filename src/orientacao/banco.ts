// Orientandos, trabalhos, interações e versões no banco local (e no Drive, pela sincronização).
import { db } from '../dados/db';
import { agoraISO, novoId } from '../dados/modelo';
import { cronogramaModelo, hojeISO } from './prazos';
import type { Interacao, Orientando, Trabalho, TipoTrabalho, Versao } from './tipos';

export const EVENTO_ORIENTACAO = 'vide-orientacao-mudou';
export function avisarMudancaOrientacao(): void {
  window.dispatchEvent(new Event(EVENTO_ORIENTACAO));
}

function base() {
  const agora = agoraISO();
  return { id: novoId(), usuario_id: null, criado_em: agora, atualizado_em: agora, excluido_em: null };
}

const vivos = <T extends { excluido_em: string | null }>(l: T[]) => l.filter((x) => !x.excluido_em);

export async function listarOrientandos(): Promise<Orientando[]> {
  return vivos(await db.orientandos.toArray()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function listarTrabalhos(): Promise<Trabalho[]> {
  return vivos(await db.trabalhos.toArray());
}

export async function lerTrabalho(id: string): Promise<Trabalho | undefined> {
  const t = await db.trabalhos.get(id);
  return t && !t.excluido_em ? t : undefined;
}

export async function listarInteracoes(trabalhoId?: string): Promise<Interacao[]> {
  const l = trabalhoId ? await db.interacoes.where('trabalhoId').equals(trabalhoId).toArray() : await db.interacoes.toArray();
  return vivos(l).sort((a, b) => b.em.localeCompare(a.em));
}

export async function listarVersoes(trabalhoId: string): Promise<Versao[]> {
  return vivos(await db.versoes.where('trabalhoId').equals(trabalhoId).toArray()).sort((a, b) => b.recebida_em.localeCompare(a.recebida_em) || b.criado_em.localeCompare(a.criado_em));
}

/** Novo orientando com o primeiro trabalho e o cronograma sugerido. */
export async function criarOrientacao(
  o: Pick<Orientando, 'nome' | 'email' | 'telefone' | 'curso'>,
  t: { titulo: string; tipo: TipoTrabalho; inicio: string; defesa?: string },
): Promise<Trabalho> {
  const orientando: Orientando = { ...base(), ...o, observacoes: '' };
  const trabalho = novoTrabalho(orientando.id, t);
  await db.transaction('rw', db.orientandos, db.trabalhos, async () => {
    await db.orientandos.put(orientando);
    await db.trabalhos.put(trabalho);
  });
  avisarMudancaOrientacao();
  return trabalho;
}

function novoTrabalho(orientandoId: string, t: { titulo: string; tipo: TipoTrabalho; inicio: string; defesa?: string }): Trabalho {
  return { ...base(), orientandoId, titulo: t.titulo, tipo: t.tipo, inicio: t.inicio || hojeISO(), defesa: t.defesa || undefined, etapas: cronogramaModelo(t.tipo, t.inicio || hojeISO(), t.defesa || undefined), situacao: 'andamento' };
}

/** Outro trabalho do mesmo orientando (ex.: do TCC para o mestrado). */
export async function criarTrabalho(orientandoId: string, t: { titulo: string; tipo: TipoTrabalho; inicio: string; defesa?: string }): Promise<Trabalho> {
  const trabalho = novoTrabalho(orientandoId, t);
  await db.trabalhos.put(trabalho);
  avisarMudancaOrientacao();
  return trabalho;
}

export async function salvarOrientando(o: Orientando): Promise<Orientando> {
  const novo = { ...o, atualizado_em: agoraISO() };
  await db.orientandos.put(novo);
  avisarMudancaOrientacao();
  return novo;
}

export async function salvarTrabalho(t: Trabalho): Promise<Trabalho> {
  const novo = { ...t, atualizado_em: agoraISO() };
  await db.trabalhos.put(novo);
  avisarMudancaOrientacao();
  return novo;
}

/** Apaga o trabalho (e o orientando, se ficar sem trabalhos). */
export async function excluirTrabalho(t: Trabalho): Promise<void> {
  const agora = agoraISO();
  const marca = { excluido_em: agora, atualizado_em: agora };
  await db.transaction('rw', [db.trabalhos, db.orientandos, db.interacoes, db.versoes], async () => {
    await db.trabalhos.put({ ...t, ...marca });
    for (const i of await db.interacoes.where('trabalhoId').equals(t.id).toArray()) if (!i.excluido_em) await db.interacoes.put({ ...i, ...marca });
    for (const v of await db.versoes.where('trabalhoId').equals(t.id).toArray()) if (!v.excluido_em) await db.versoes.put({ ...v, ...marca });
    const outros = (await db.trabalhos.where('orientandoId').equals(t.orientandoId).toArray()).filter((x) => x.id !== t.id && !x.excluido_em);
    const o = await db.orientandos.get(t.orientandoId);
    if (!outros.length && o && !o.excluido_em) await db.orientandos.put({ ...o, ...marca });
  });
  avisarMudancaOrientacao();
}

export function interacaoEmBranco(trabalhoId: string, canal: Interacao['canal'], em: string): Interacao {
  return { ...base(), trabalhoId, canal, em, modo: canal === 'sessao' ? 'presencial' : undefined, resumo: '', texto: '', encaminhamentos: [], versaoId: null };
}

export async function salvarInteracao(i: Interacao): Promise<Interacao> {
  const novo = { ...i, atualizado_em: agoraISO() };
  await db.interacoes.put(novo);
  avisarMudancaOrientacao();
  return novo;
}

export async function excluirInteracao(i: Interacao): Promise<void> {
  const agora = agoraISO();
  await db.interacoes.put({ ...i, excluido_em: agora, atualizado_em: agora });
  avisarMudancaOrientacao();
}

export async function adicionarVersao(trabalhoId: string, arquivo: File, dados: Pick<Versao, 'rotulo' | 'recebida_em' | 'etapaId' | 'notas'>): Promise<Versao> {
  const v: Versao = { ...base(), trabalhoId, ...dados, nomeArquivo: arquivo.name, mime: arquivo.type || 'application/octet-stream', tamanho: arquivo.size, arquivo };
  await db.versoes.put(v);
  avisarMudancaOrientacao();
  return v;
}

export async function salvarVersao(v: Versao): Promise<Versao> {
  const novo = { ...v, atualizado_em: agoraISO() };
  await db.versoes.put(novo);
  avisarMudancaOrientacao();
  return novo;
}

export async function excluirVersao(v: Versao): Promise<void> {
  const agora = agoraISO();
  await db.versoes.put({ ...v, arquivo: new Blob([]), excluido_em: agora, atualizado_em: agora });
  avisarMudancaOrientacao();
}
