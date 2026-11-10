// Cópia de um processo para um novo semestre: tudo anda junto no calendário.
// A data de autuação passa a ser a nova data de início; eventos e liberações são
// deslocados pelo mesmo número de dias. O que estava liberado vira "aparece na data do evento".
import { agoraISO, novoId } from '../dados/modelo';
import { gerarNumero } from './numero';
import type { Evento, Processo } from './tipos';

const p2 = (n: number) => String(n).padStart(2, '0');

function paraLocal(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Desloca "AAAA-MM-DDTHH:MM" (hora local) por um número inteiro de dias. */
export function deslocar(dataHora: string, dias: number): string {
  const d = new Date(dataHora.length === 10 ? `${dataHora}T12:00` : dataHora);
  if (Number.isNaN(d.getTime())) return dataHora;
  d.setDate(d.getDate() + dias);
  return dataHora.length === 10 ? paraLocal(d).slice(0, 10) : paraLocal(d);
}

/** Dias inteiros entre duas datas "AAAA-MM-DD". */
export function diasEntre(de: string, ate: string): number {
  const a = new Date(`${de}T12:00`);
  const b = new Date(`${ate}T12:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function copiarProcesso(p: Processo, titulo: string, inicio: string): Processo {
  const dias = diasEntre(p.capa.autuadoEm, inicio);
  const agora = agoraISO();
  const eventos: Evento[] = p.eventos.map((e) => {
    const data = deslocar(e.data, dias);
    const liberacao: Evento['liberacao'] =
      e.liberacao.modo === 'segurar' ? { modo: 'segurar' } : { modo: 'data', em: e.liberacao.modo === 'data' ? deslocar(e.liberacao.em, dias) : data };
    return { ...e, id: novoId(), data, liberacao, documentos: e.documentos.map((d) => ({ ...d, id: novoId() })) };
  });
  return {
    ...p,
    id: novoId(),
    criado_em: agora,
    atualizado_em: agora,
    excluido_em: null,
    titulo: titulo.trim() || `${p.titulo} (cópia)`,
    capa: { ...p.capa, autuadoEm: inicio, numero: gerarNumero(Number(inicio.slice(0, 4)) || undefined) },
    partes: p.partes.map((x) => ({ ...x, id: novoId() })),
    eventos,
    publicacao: null,
  };
}
