// Publica o processo num link (Cloudflare). O serviço guarda todos os eventos,
// mas só entrega aos alunos os já liberados.
import { gerarToken } from '../jogo/protocolo';
import type { DadosProcesso, Evento, Processo, Publicacao } from './tipos';
import { agoraISO } from '../dados/modelo';

/** Liberação em milissegundos (0 = já; null = segurado). */
export function liberaEm(e: Evento): number | null {
  if (e.liberacao.modo === 'agora') return 0;
  if (e.liberacao.modo === 'segurar') return null;
  const t = Date.parse(e.liberacao.em);
  return Number.isFinite(t) ? t : null;
}

export function dadosParaPublicar(p: Processo): DadosProcesso {
  return {
    formato: 'vide-processo@1',
    capa: p.capa,
    partes: p.partes
      .filter((x) => x.nome.trim())
      .map((x) => ({ ...x, advogados: x.advogados.filter((a) => a.nome.trim() || a.oab.trim()) })),
    eventos: p.eventos.map(({ liberacao: _l, ...e }, i) => ({
      ...e,
      numero: i + 1,
      libera: liberaEm(p.eventos[i]),
      documentos: e.documentos.filter((d) => d.texto.trim() || d.titulo.trim()),
    })),
    publicadoEm: agoraISO(),
  };
}

async function enviar(url: string, metodo: string, chave: string, corpo?: string): Promise<Response> {
  const r = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'X-Vide-Chave': chave },
    body: corpo,
  });
  if (r.status === 413) throw new Error('O processo ficou grande demais para um link.');
  if (!r.ok && !(metodo === 'DELETE' && r.status === 404)) throw new Error(`Não foi possível falar com o serviço (${r.status}). Confira a internet.`);
  return r;
}

/** Cria o link (primeira vez) ou atualiza o que os alunos veem. */
export async function publicarProcesso(p: Processo): Promise<Publicacao> {
  const corpo = JSON.stringify(dadosParaPublicar(p));
  if (p.publicacao) {
    await enviar(`/api/processo/${p.publicacao.codigo}`, 'PUT', p.publicacao.chave, corpo);
    return { ...p.publicacao, publicadoEm: agoraISO() };
  }
  const chave = gerarToken();
  const r = await enviar('/api/processo', 'POST', chave, corpo);
  const { id } = (await r.json()) as { id: string };
  return { codigo: id, chave, publicadoEm: agoraISO() };
}

export async function desativarProcesso(pub: Publicacao): Promise<void> {
  await enviar(`/api/processo/${pub.codigo}`, 'DELETE', pub.chave);
}
