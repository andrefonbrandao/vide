// Horários das aulas: aula acontecendo agora (ou prestes a começar) e a próxima aula.
// Sem dependências do navegador.
import type { Horario, Turma } from './tipos';

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function noSemestre(t: Turma, d: Date): boolean {
  const hoje = dataISO(d);
  return (!t.inicio || hoje >= t.inicio) && (!t.fim || hoje <= t.fim);
}

export interface AulaMarcada {
  turma: Turma;
  horario: Horario;
  /** Quando começa (data e hora local). */
  comeca: Date;
}

/** Aula de agora: de `antes` minutos antes do início até o fim. */
export function aulaAgora(turmas: Turma[], agora: Date, antes = 15): AulaMarcada | null {
  const m = agora.getHours() * 60 + agora.getMinutes();
  for (const t of turmas) {
    if (t.arquivada || t.excluido_em || !noSemestre(t, agora)) continue;
    for (const h of t.horarios) {
      if (h.dia !== agora.getDay()) continue;
      if (m >= minutos(h.inicio) - antes && m <= minutos(h.fim)) {
        const comeca = new Date(agora);
        comeca.setHours(Math.floor(minutos(h.inicio) / 60), minutos(h.inicio) % 60, 0, 0);
        return { turma: t, horario: h, comeca };
      }
    }
  }
  return null;
}

/** A próxima aula (de hoje em diante, até 14 dias). */
export function proximaAula(turmas: Turma[], agora: Date): AulaMarcada | null {
  let melhor: AulaMarcada | null = null;
  for (let d = 0; d < 14; d++) {
    const dia = new Date(agora);
    dia.setDate(agora.getDate() + d);
    for (const t of turmas) {
      if (t.arquivada || t.excluido_em || !noSemestre(t, dia)) continue;
      for (const h of t.horarios) {
        if (h.dia !== dia.getDay()) continue;
        const comeca = new Date(dia);
        comeca.setHours(Math.floor(minutos(h.inicio) / 60), minutos(h.inicio) % 60, 0, 0);
        const fim = new Date(dia);
        fim.setHours(Math.floor(minutos(h.fim) / 60), minutos(h.fim) % 60, 0, 0);
        if (fim <= agora) continue;
        if (!melhor || comeca < melhor.comeca) melhor = { turma: t, horario: h, comeca };
      }
    }
    if (melhor) return melhor;
  }
  return melhor;
}

export function rotuloHorario(h: Horario): string {
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return `${DIAS[h.dia]} ${h.inicio}–${h.fim}`;
}
