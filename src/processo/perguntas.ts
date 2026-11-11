// Perguntas sobre o processo: questões do banco ligadas a um processo e a um evento.
// Valem no jogo em sala, na forca e no treino em casa (pelo assunto "processo: <nome>")
// e aparecem na página da turma só depois que o evento é liberado.
import { db } from '../dados/db';
import { MODELO_IMPORTACAO } from '../jogo/importar';
import type { Questao } from '../jogo/tipos';
import { processoParaTexto } from './importar';
import type { DadosProcesso, PerguntaPublicada, Processo } from './tipos';

export function assuntoDoProcesso(p: Pick<Processo, 'titulo'>): string {
  return `processo: ${p.titulo.trim() || 'sem nome'}`;
}

export async function perguntasDoProcesso(id: string): Promise<Questao[]> {
  const todas = await db.questoes.toArray();
  return todas.filter((q) => q.processoId === id && !q.excluido_em).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

/** Cada pergunta vai junto do evento a partir do qual aparece (sem evento: o primeiro). */
export function juntarPerguntas(dados: DadosProcesso, perguntas: Questao[]): DadosProcesso {
  if (!perguntas.length || !dados.eventos.length) return dados;
  const ids = new Set(dados.eventos.map((e) => e.id));
  const primeiro = dados.eventos[0].id;
  const por = new Map<string, PerguntaPublicada[]>();
  for (const q of perguntas) {
    const alvo = q.eventoId && ids.has(q.eventoId) ? q.eventoId : primeiro;
    const pub: PerguntaPublicada = {
      id: q.id,
      tipo: q.tipo,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      correta: q.correta,
      explicacao: q.explicacao,
      fundamento: q.fundamento,
      ...(q.dicas?.length ? { dicas: q.dicas } : {}),
      ...(q.aceitas?.length ? { aceitas: q.aceitas } : {}),
    };
    por.set(alvo, [...(por.get(alvo) ?? []), pub]);
  }
  return { ...dados, eventos: dados.eventos.map((e) => (por.has(e.id) ? { ...e, perguntas: por.get(e.id) } : e)) };
}

export async function comPerguntas(dados: DadosProcesso, p: Pick<Processo, 'id'>): Promise<DadosProcesso> {
  return juntarPerguntas(dados, await perguntasDoProcesso(p.id));
}

/** Pedido pronto para a IA fazer perguntas sobre o processo até um evento. */
export function pedidoPerguntasIA(p: Processo, o: { ate: number; quantas: number; tipos: 'todos' | 'alternativas' | 'conceito' }): string {
  const ate = Math.max(1, Math.min(p.eventos.length, o.ate));
  const parcial = { ...p, eventos: p.eventos.slice(0, ate) };
  const tipos =
    o.tipos === 'conceito'
      ? 'Todas do tipo "Adivinhe o conceito" (Conceito: + 2 a 4 dicas, da mais difícil para a mais fácil).'
      : o.tipos === 'alternativas'
        ? 'Só múltipla escolha (4 alternativas) e verdadeiro ou falso.'
        : 'Misture múltipla escolha (4 alternativas), verdadeiro ou falso e "Adivinhe o conceito".';
  return `Você vai me ajudar a fazer questões para uma turma de graduação em Direito Processual Civil (CPC/2015). As questões são sobre um processo judicial FICTÍCIO que a turma acompanha. Abaixo está o processo até o evento ${ate}, no formato do Vide.

Faça ${o.quantas} questões sobre ESTE processo (os atos, as peças, os prazos, as decisões e o que deveria acontecer a seguir), e não sobre a lei em abstrato. Use os nomes e os fatos do caso no enunciado (ex.: "No processo de Rogéria Silva, qual o prazo para a ré contestar?"). Não pergunte nada sobre fatos que ainda não aconteceram no processo.
${tipos}
Em cada questão, escreva a explicação (1 ou 2 frases, com o raciocínio) e o fundamento (o artigo do CPC, como "335" ou "238 CPC").

Responda SOMENTE com as questões, sem comentários antes ou depois, exatamente neste formato (uma linha em branco entre as questões):

${MODELO_IMPORTACAO}

O PROCESSO ATÉ O EVENTO ${ate}:
${processoParaTexto(parcial).trim()}`;
}
