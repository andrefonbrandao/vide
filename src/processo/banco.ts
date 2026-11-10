// Guarda e lê os processos fictícios no banco local do navegador.
import { db } from '../dados/db';
import { agoraISO, novoId } from '../dados/modelo';
import { gerarNumero } from './numero';
import type { Documento, Evento, Parte, Processo } from './tipos';

export function avisarMudancaProcessos(): void {
  window.dispatchEvent(new Event('vide-processos-mudou'));
}

export async function listarProcessos(): Promise<Processo[]> {
  const todos = await db.processos.toArray();
  return todos.filter((p) => !p.excluido_em).sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
}

export async function lerProcesso(id: string): Promise<Processo | undefined> {
  const p = await db.processos.get(id);
  return p && !p.excluido_em ? p : undefined;
}

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function novaParte(polo: Parte['polo']): Parte {
  return { id: novoId(), polo, nome: '', qualificacao: 'Pessoa física', advogados: [{ nome: '', oab: '' }] };
}

export function novoDocumento(sigla = 'DOC1', titulo = ''): Documento {
  return { id: novoId(), sigla, titulo, tipo: 'texto', texto: '' };
}

/** Evento novo começa "segurado": só aparece para os alunos quando o professor liberar. */
export function novoEvento(anterior?: Evento): Evento {
  const base = anterior?.data ? new Date(anterior.data) : new Date();
  if (anterior?.data) base.setDate(base.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  const data = `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}T${p(base.getHours())}:${p(base.getMinutes())}`;
  return { id: novoId(), data, descricao: '', usuario: '', documentos: [], liberacao: { modo: 'segurar' } };
}

export async function criarProcesso(titulo: string): Promise<Processo> {
  const agora = agoraISO();
  const p: Processo = {
    id: novoId(),
    usuario_id: null,
    criado_em: agora,
    atualizado_em: agora,
    excluido_em: null,
    titulo: titulo.trim() || 'Processo da turma',
    capa: {
      numero: gerarNumero(),
      classe: 'Procedimento Comum Cível',
      assuntos: '',
      valorCausa: '',
      juizo: '1ª Vara Cível da Comarca de Vide',
      juiz: '',
      autuadoEm: hoje(),
      situacao: 'Em andamento',
    },
    partes: [novaParte('ativo'), novaParte('passivo')],
    eventos: [],
    publicacao: null,
  };
  await db.processos.put(p);
  avisarMudancaProcessos();
  return p;
}

export async function salvarProcesso(p: Processo): Promise<Processo> {
  const novo = { ...p, atualizado_em: agoraISO() };
  await db.processos.put(novo);
  avisarMudancaProcessos();
  return novo;
}

export async function excluirProcesso(id: string): Promise<void> {
  const p = await db.processos.get(id);
  if (!p) return;
  const agora = agoraISO();
  await db.processos.put({ ...p, excluido_em: agora, atualizado_em: agora });
  avisarMudancaProcessos();
}
