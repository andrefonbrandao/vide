// Publica o processo num link (Cloudflare). O serviço guarda todos os eventos,
// mas só entrega aos alunos os já liberados.
import { carregarIndice, db } from '../dados/db';
import { agoraISO } from '../dados/modelo';
import { gerarToken } from '../jogo/protocolo';
import { artigoDoFundamento } from '../treino/publicar';
import { acharCitacoes, chaveCitacao, citacaoParaDigitado } from './citacoes';
import type { ArtigoCitado, DadosProcesso, Evento, Processo, Publicacao } from './tipos';

/** Maior PDF aceito numa peça. */
export const MAX_PDF = 10 * 1024 * 1024;

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
      documentos: e.documentos
        .filter((d) => (d.tipo === 'pdf' ? !!d.materialId : d.texto.trim() || d.titulo.trim()))
        .map(({ materialId, ...d }) => (d.tipo === 'pdf' ? { ...d, texto: '', arquivo: materialId } : d)),
    })),
    publicadoEm: agoraISO(),
    ...(p.glossario?.some((t) => t.termo.trim() && t.explicacao.trim()) ? { glossario: p.glossario.filter((t) => t.termo.trim() && t.explicacao.trim()) } : {}),
  };
}

/** Junta o caso do "cliente em cena" (lido da Consulta deste computador). */
export async function comCliente(dados: DadosProcesso, p: Pick<Processo, 'cliente'>): Promise<DadosProcesso> {
  if (!p.cliente) return dados;
  const c = await db.casos.get(p.cliente.casoId);
  if (!c || c.excluido_em) return dados;
  return { ...dados, cliente: { nome: c.nome, personagem: p.cliente.personagem, falas: c.falas } };
}

/** Junta, em cada peça escrita, o texto dos artigos que ela cita (do acervo deste computador). */
export async function comArtigos(dados: DadosProcesso): Promise<DadosProcesso> {
  const indice = await carregarIndice();
  const cache = new Map<string, ArtigoCitado | null>();
  return {
    ...dados,
    eventos: dados.eventos.map((e) => ({
      ...e,
      documentos: e.documentos.map((d) => {
        if (d.tipo !== 'texto') return d;
        const artigos: Record<string, ArtigoCitado> = {};
        for (const c of acharCitacoes(d.texto)) {
          const k = chaveCitacao(c);
          if (!cache.has(k)) cache.set(k, artigoDoFundamento(citacaoParaDigitado(c), indice) ?? null);
          const a = cache.get(k);
          if (a) artigos[k] = a;
        }
        return Object.keys(artigos).length ? { ...d, artigos } : d;
      }),
    })),
  };
}

async function enviarArquivos(p: Processo, pub: Publicacao): Promise<string[]> {
  const enviados = new Set(pub.arquivos ?? []);
  const ids = [...new Set(p.eventos.flatMap((e) => e.documentos.filter((d) => d.tipo === 'pdf' && d.materialId).map((d) => d.materialId!)))];
  for (const id of ids) {
    if (enviados.has(id)) continue;
    const m = await db.materiais.get(id);
    if (!m || m.excluido_em || !m.arquivo.size) continue;
    if (m.arquivo.size > MAX_PDF) throw new Error(`O PDF "${m.nome}" passa de 10 MB.`);
    const r = await fetch(`/api/processo/${pub.codigo}/arquivo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf', 'X-Vide-Chave': pub.chave },
      body: m.arquivo,
    });
    if (!r.ok) throw new Error(`Não foi possível enviar o PDF "${m.nome}" (${r.status}).`);
    enviados.add(id);
  }
  return [...enviados].filter((id) => ids.includes(id));
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
  const corpo = JSON.stringify(await comCliente(await comArtigos(dadosParaPublicar(p)), p));
  let pub: Publicacao;
  if (p.publicacao) {
    pub = p.publicacao;
  } else {
    // Primeira vez: cria o link; os PDFs vão logo em seguida.
    const chave = gerarToken();
    const r = await enviar('/api/processo', 'POST', chave, corpo);
    const { id } = (await r.json()) as { id: string };
    pub = { codigo: id, chave, publicadoEm: agoraISO(), arquivos: [] };
  }
  const arquivos = await enviarArquivos(p, pub);
  if (p.publicacao) await enviar(`/api/processo/${pub.codigo}`, 'PUT', pub.chave, corpo);
  return { ...pub, arquivos, publicadoEm: agoraISO() };
}

export async function desativarProcesso(pub: Publicacao): Promise<void> {
  await enviar(`/api/processo/${pub.codigo}`, 'DELETE', pub.chave);
}
