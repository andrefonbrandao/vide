// Disciplinas e turmas no banco local (e no Google Drive, pela sincronização).
import { db } from '../dados/db';
import { agoraISO, novoId } from '../dados/modelo';
import { definirDiplomaPrincipal } from '../dados/diplomas';
import { definirTurmaAtiva, turmaAtiva } from './filtro';
import type { Disciplina, Turma } from './tipos';

export function avisarMudancaTurmas(): void {
  window.dispatchEvent(new Event('vide-turmas-mudou'));
}

function base() {
  const agora = agoraISO();
  return { id: novoId(), usuario_id: null, criado_em: agora, atualizado_em: agora, excluido_em: null };
}

export async function listarDisciplinas(): Promise<Disciplina[]> {
  return (await db.disciplinas.toArray()).filter((d) => !d.excluido_em).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function listarTurmas(): Promise<Turma[]> {
  return (await db.turmas.toArray()).filter((t) => !t.excluido_em).sort((a, b) => b.periodo.localeCompare(a.periodo) || a.criado_em.localeCompare(b.criado_em));
}

export async function salvarDisciplina(dados: Pick<Disciplina, 'nome' | 'sigla' | 'cor' | 'leiPrincipal'>, existente?: Disciplina): Promise<Disciplina> {
  const d: Disciplina = existente ? { ...existente, ...dados, atualizado_em: agoraISO() } : { ...base(), ...dados };
  await db.disciplinas.put(d);
  avisarMudancaTurmas();
  return d;
}

export async function salvarTurma(dados: Pick<Turma, 'disciplinaId' | 'periodo' | 'horarios' | 'inicio' | 'fim' | 'arquivada'>, existente?: Turma): Promise<Turma> {
  const t: Turma = existente ? { ...existente, ...dados, atualizado_em: agoraISO() } : { ...base(), ...dados };
  await db.turmas.put(t);
  avisarMudancaTurmas();
  return t;
}

export async function excluirDisciplina(d: Disciplina): Promise<void> {
  const agora = agoraISO();
  const turmas = (await db.turmas.where('disciplinaId').equals(d.id).toArray()).filter((t) => !t.excluido_em);
  await db.disciplinas.put({ ...d, excluido_em: agora, atualizado_em: agora });
  for (const t of turmas) await db.turmas.put({ ...t, excluido_em: agora, atualizado_em: agora });
  if (turmaAtiva()?.disciplinaId === d.id) definirTurmaAtiva(null);
  avisarMudancaTurmas();
}

export async function excluirTurma(t: Turma): Promise<void> {
  const agora = agoraISO();
  await db.turmas.put({ ...t, excluido_em: agora, atualizado_em: agora });
  if (turmaAtiva()?.turmaId === t.id) definirTurmaAtiva(null);
  avisarMudancaTurmas();
}

export function rotuloTurma(d: Pick<Disciplina, 'sigla' | 'nome'> | undefined, t: Pick<Turma, 'periodo'>): string {
  return `${d?.sigla || d?.nome || 'Turma'} · ${t.periodo}`;
}

/** Entra no modo da turma: filtra os recursos e põe a lei principal da disciplina na aula. */
export function entrarNaTurma(d: Disciplina, t: Turma): void {
  if (d.leiPrincipal) definirDiplomaPrincipal(d.leiPrincipal);
  definirTurmaAtiva({ turmaId: t.id, disciplinaId: d.id, rotulo: rotuloTurma(d, t), cor: d.cor });
}
