// Pendências de orientação com prazo vencido (para o alerta vermelho na barra lateral).
// Fica no programa principal, então só usa o banco e contas simples.
import { db } from '../dados/db';
import { diasEntre, hojeISO } from './prazos';
import type { Interacao, Trabalho } from './tipos';

/** Sugestões e comandos ainda pendentes cujo prazo já passou (de trabalhos em andamento). */
export function pendenciasVencidas(interacoes: Interacao[], trabalhos: Pick<Trabalho, 'id' | 'situacao' | 'excluido_em'>[], hoje = hojeISO()): { trabalhoId: string; texto: string; prazo: string }[] {
  const ativos = new Set(trabalhos.filter((t) => !t.excluido_em && t.situacao === 'andamento').map((t) => t.id));
  return interacoes
    .filter((i) => !i.excluido_em && ativos.has(i.trabalhoId))
    .flatMap((i) => i.encaminhamentos.filter((e) => e.situacao === 'pendente' && e.prazo && diasEntre(hoje, e.prazo) < 0).map((e) => ({ trabalhoId: i.trabalhoId, texto: e.texto, prazo: e.prazo! })));
}

export async function contarVencidas(): Promise<number> {
  const [interacoes, trabalhos] = await Promise.all([db.interacoes.toArray(), db.trabalhos.toArray()]);
  return pendenciasVencidas(interacoes, trabalhos).length;
}
