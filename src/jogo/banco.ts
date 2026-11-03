// Guarda e lê questões, questionários e resultados no banco local do navegador.
import { db } from '../dados/db';
import { agoraISO, novoId } from '../dados/modelo';
import type { QuestaoJogo, Questao, Questionario, ResultadoJogo, ResultadoPergunta } from './tipos';

function base() {
  const agora = agoraISO();
  return { id: novoId(), usuario_id: null, criado_em: agora, atualizado_em: agora, excluido_em: null };
}

export function avisarMudanca(): void {
  window.dispatchEvent(new Event('vide-questoes-mudou'));
}

export async function listarQuestoes(): Promise<Questao[]> {
  const todas = await db.questoes.toArray();
  return todas.filter((q) => !q.excluido_em).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

export async function listarQuestionarios(): Promise<Questionario[]> {
  const todos = await db.questionarios.toArray();
  return todos.filter((q) => !q.excluido_em).sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
}

export async function listarResultados(): Promise<ResultadoJogo[]> {
  const todos = await db.jogos.toArray();
  return todos.filter((r) => !r.excluido_em).sort((a, b) => b.em.localeCompare(a.em));
}

export async function salvarQuestao(
  dados: QuestaoJogo & { pasta: string; etiquetas: string[] },
  existente?: Questao,
): Promise<Questao> {
  const q: Questao = existente ? { ...existente, ...dados, atualizado_em: agoraISO() } : { ...base(), ...dados };
  await db.questoes.put(q);
  avisarMudanca();
  return q;
}

/** Adiciona várias questões (importação) e, se pedido, cria um questionário com elas. */
export async function adicionarQuestoes(
  lista: (QuestaoJogo & { assuntos?: string[] })[],
  extra: { pasta: string; etiquetas: string[]; questionario?: string },
): Promise<{ questoes: Questao[]; questionario: Questionario | null }> {
  // Assuntos de cada questão (do texto colado) + os assuntos escolhidos para todas.
  const questoes = lista.map(({ assuntos = [], ...q }) => ({
    ...base(),
    ...q,
    pasta: extra.pasta,
    etiquetas: [...new Set([...extra.etiquetas, ...assuntos])],
  }));
  let questionario: Questionario | null = null;
  await db.transaction('rw', db.questoes, db.questionarios, async () => {
    await db.questoes.bulkAdd(questoes);
    if (extra.questionario?.trim()) {
      questionario = { ...base(), nome: extra.questionario.trim(), questoes: questoes.map((q) => q.id) };
      await db.questionarios.add(questionario);
    }
  });
  avisarMudanca();
  return { questoes, questionario };
}

export async function excluirQuestao(id: string): Promise<void> {
  const q = await db.questoes.get(id);
  if (!q) return;
  const agora = agoraISO();
  await db.questoes.put({ ...q, excluido_em: agora, atualizado_em: agora });
  avisarMudanca();
}

export async function salvarQuestionario(nome: string, questoes: string[], existente?: Questionario): Promise<Questionario> {
  const q: Questionario = existente
    ? { ...existente, nome, questoes, atualizado_em: agoraISO() }
    : { ...base(), nome, questoes };
  await db.questionarios.put(q);
  avisarMudanca();
  return q;
}

export async function excluirQuestionario(id: string): Promise<void> {
  const q = await db.questionarios.get(id);
  if (!q) return;
  const agora = agoraISO();
  await db.questionarios.put({ ...q, excluido_em: agora, atualizado_em: agora });
  avisarMudanca();
}

/** Questões de um questionário, na ordem (ignora as excluídas). */
export async function questoesDo(questionario: Questionario): Promise<Questao[]> {
  const lista = await db.questoes.bulkGet(questionario.questoes);
  return lista.filter((q): q is Questao => !!q && !q.excluido_em);
}

export async function guardarResultado(dados: {
  questionario: string;
  participantes: number;
  ranking: boolean;
  perguntas: ResultadoPergunta[];
}): Promise<void> {
  await db.jogos.add({ ...base(), em: agoraISO(), ...dados });
  avisarMudanca();
}

export async function excluirResultado(id: string): Promise<void> {
  const r = await db.jogos.get(id);
  if (!r) return;
  const agora = agoraISO();
  await db.jogos.put({ ...r, excluido_em: agora, atualizado_em: agora });
  avisarMudanca();
}

/** Planilha dos resultados (sem nomes): uma linha por pergunta. */
export function resultadoCsv(r: ResultadoJogo): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const linhas = ['questão;enunciado;correta;acertos (%);respostas A;respostas B;respostas C;respostas D;sem resposta'];
  r.perguntas.forEach((p, i) => {
    if (!p) return;
    const total = p.respostas.reduce((s, n) => s + n, 0) + p.semResposta;
    const pct = total ? Math.round((p.respostas[p.correta] / total) * 100) : 0;
    const resp = [0, 1, 2, 3].map((k) => (k < p.respostas.length ? String(p.respostas[k]) : ''));
    linhas.push([i + 1, esc(p.enunciado), 'ABCD'[p.correta], pct, ...resp, p.semResposta].join(';'));
  });
  return '﻿' + linhas.join('\r\n');
}

/** Assuntos usados nas questões, com quantas questões há em cada um (mais usados primeiro). */
export function assuntosDasQuestoes(questoes: Pick<Questao, 'etiquetas'>[]): { assunto: string; total: number }[] {
  const c = new Map<string, number>();
  for (const q of questoes) for (const a of q.etiquetas ?? []) c.set(a, (c.get(a) ?? 0) + 1);
  return [...c.entries()]
    .map(([assunto, total]) => ({ assunto, total }))
    .sort((a, b) => b.total - a.total || a.assunto.localeCompare(b.assunto, 'pt-BR'));
}

/** Sorteia até `quantas` questões do assunto (null = de todos), em ordem aleatória. */
export function sortearQuestoes<T extends Pick<Questao, 'etiquetas'>>(questoes: T[], assunto: string | null, quantas: number, aleatorio = Math.random): T[] {
  const lista = questoes.filter((q) => !assunto || (q.etiquetas ?? []).includes(assunto));
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista.slice(0, Math.max(0, quantas));
}
