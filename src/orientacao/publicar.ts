// Página do orientando: publica (e mantém atualizado) o cronograma, as pendências, os
// elementos do trabalho e os modelos num link com código de 6 números.
import { db } from '../dados/db';
import { agoraISO } from '../dados/modelo';
import { gerarToken } from '../jogo/protocolo';
import { adicionarVersao, EVENTO_PUBLICAVEL, listarModelos, modelosDoTrabalho } from './banco';
import { emOrdem, etapaAtual, pendencias } from './prazos';
import type { ConfigPreProjeto, DadosOrientando, Interacao, Modelo, Orientando, PublicacaoOrientacao, TextoProjeto, Trabalho } from './tipos';

/** Maior arquivo aceito como modelo. */
export const MAX_MODELO = 10 * 1024 * 1024;

export function urlDoOrientando(codigo: string): string {
  return `${location.origin}/o/${codigo}`;
}

export function novoPin(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(100000 + (n[0] % 900000));
}

export function dadosParaOrientando(t: Trabalho, o: Orientando | undefined, interacoes: Interacao[], modelos: Modelo[]): DadosOrientando {
  const el = t.elementos;
  const temElementos = !!el && (Object.entries(el).some(([k, v]) => k !== 'atualizado_em' && (Array.isArray(v) ? v.some((x) => x.trim()) : String(v ?? '').trim())));
  return {
    formato: 'vide-orientacao@1',
    nome: o?.nome ?? '',
    trabalho: { titulo: t.titulo, tipo: t.tipo, inicio: t.inicio, defesa: t.defesa, situacao: t.situacao },
    etapas: emOrdem(t.etapas),
    pendencias: pendencias(interacoes.filter((i) => i.trabalhoId === t.id)).map((p) => ({ tipo: p.enc.tipo, texto: p.enc.texto, prazo: p.enc.prazo, de: p.interacao.em.slice(0, 10) })),
    ...(t.preProjeto?.ativo ? { preProjeto: t.preProjeto } : {}),
    ...(temElementos ? { elementos: { ...el!, objetivosEspecificos: el!.objetivosEspecificos.map((x) => x.trim()).filter(Boolean) } } : {}),
    modelos: modelosDoTrabalho(modelos, t.id).map((m) =>
      m.tipo === 'texto'
        ? { id: m.id, titulo: m.titulo, descricao: m.descricao, tipo: 'texto' as const, texto: m.texto }
        : { id: m.id, titulo: m.titulo, descricao: m.descricao, tipo: 'arquivo' as const, nomeArquivo: m.nomeArquivo, mime: m.mime, tamanho: m.tamanho },
    ),
    publicadoEm: agoraISO(),
  };
}

async function pedir(url: string, metodo: string, chave: string, corpo?: BodyInit, tipo = 'application/json'): Promise<Response> {
  const r = await fetch(url, { method: metodo, headers: { 'Content-Type': tipo, 'X-Vide-Chave': chave }, body: corpo });
  if (r.status === 413) throw new Error('Arquivo ou página grande demais.');
  if (!r.ok && !(metodo === 'DELETE' && r.status === 404)) throw new Error(`Não foi possível falar com o serviço (${r.status}). Confira a internet.`);
  return r;
}

// ---------- Estado (para a tela mostrar "atualizando…" / erro) ----------

export type EstadoPublicacao = { tipo: 'ok' | 'enviando' | 'erro'; msg?: string; em?: number };
const estados = new Map<string, EstadoPublicacao>();
const ouvintes = new Set<() => void>();
function mudarEstado(id: string, e: EstadoPublicacao) {
  estados.set(id, e);
  ouvintes.forEach((f) => f());
}
export function estadoPublicacao(id: string): EstadoPublicacao | undefined {
  return estados.get(id);
}
export function assinarPublicacao(f: () => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Grava a publicação no trabalho sem mexer no resto (e sem pedir nova publicação). */
async function gravarPublicacao(id: string, pub: PublicacaoOrientacao | null): Promise<void> {
  const t = await db.trabalhos.get(id);
  if (!t) return;
  await db.trabalhos.put({ ...t, publicacao: pub, atualizado_em: agoraISO() });
  window.dispatchEvent(new Event('vide-orientacao-mudou'));
}

/** Cria a página (primeira vez) ou a atualiza. Devolve a publicação. */
export async function publicarOrientacao(trabalhoId: string, opcoes: { trocarPin?: boolean } = {}): Promise<PublicacaoOrientacao> {
  const t = await db.trabalhos.get(trabalhoId);
  if (!t || t.excluido_em) throw new Error('Trabalho não encontrado.');
  mudarEstado(trabalhoId, { tipo: 'enviando' });
  try {
    const o = await db.orientandos.get(t.orientandoId);
    const interacoes = (await db.interacoes.where('trabalhoId').equals(t.id).toArray()).filter((i) => !i.excluido_em);
    const modelos = await listarModelos();
    const dados = dadosParaOrientando(t, o, interacoes, modelos);
    let pub: PublicacaoOrientacao;
    const pin = opcoes.trocarPin || !t.publicacao ? novoPin() : t.publicacao.pin;
    if (!t.publicacao) {
      const chave = gerarToken();
      const r = await pedir('/api/orientacao', 'POST', chave, JSON.stringify({ pin, dados }));
      const { id } = (await r.json()) as { id: string };
      pub = { codigo: id, chave, pin, publicadoEm: agoraISO(), arquivos: {} };
      await gravarPublicacao(t.id, pub);
      // Página nova de quem já tinha rascunho guardado: o rascunho volta para ela.
      if (t.rascunhoProjeto?.texto) {
        await fetch(`/api/orientacao/${id}/projeto`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Vide-Pin': pin }, body: JSON.stringify(t.rascunhoProjeto.texto) }).catch(() => undefined);
      }
    } else pub = { ...t.publicacao, pin };
    // Arquivos novos ou trocados.
    const arquivos: Record<string, string> = {};
    for (const m of modelosDoTrabalho(modelos, t.id)) {
      if (m.tipo !== 'arquivo') continue;
      if (pub.arquivos[m.id] === m.atualizado_em) {
        arquivos[m.id] = m.atualizado_em;
        continue;
      }
      if (!m.arquivo.size) continue; // ainda chegando do Drive
      if (m.arquivo.size > MAX_MODELO) throw new Error(`"${m.titulo}" passa de 10 MB.`);
      await pedir(`/api/orientacao/${pub.codigo}/arquivo/${m.id}`, 'PUT', pub.chave, m.arquivo, m.mime || 'application/octet-stream');
      arquivos[m.id] = m.atualizado_em;
    }
    // Só lista na página os arquivos que já estão no serviço.
    const final = { ...dados, modelos: dados.modelos.filter((m) => m.tipo === 'texto' || arquivos[m.id]) };
    await pedir(`/api/orientacao/${pub.codigo}`, 'PUT', pub.chave, JSON.stringify({ pin, dados: final }));
    pub = { ...pub, arquivos, publicadoEm: agoraISO() };
    await gravarPublicacao(t.id, pub);
    mudarEstado(trabalhoId, { tipo: 'ok', em: Date.now() });
    return pub;
  } catch (e) {
    mudarEstado(trabalhoId, { tipo: 'erro', msg: (e as Error).message });
    throw e;
  }
}

export async function desativarOrientacao(trabalhoId: string): Promise<void> {
  // Antes de apagar a página, guarda o rascunho do orientando (se houver).
  await guardarRascunho(trabalhoId).catch(() => false);
  const t = await db.trabalhos.get(trabalhoId);
  if (!t?.publicacao) return;
  await pedir(`/api/orientacao/${t.publicacao.codigo}`, 'DELETE', t.publicacao.chave);
  await gravarPublicacao(t.id, null);
  estados.delete(trabalhoId);
  ouvintes.forEach((f) => f());
}

// ---------- Atualização automática (alguns segundos depois de cada mudança) ----------

const pendentes = new Set<string>();
let timer: number | null = null;

async function republicarPendentes() {
  timer = null;
  const ids = [...pendentes];
  pendentes.clear();
  for (const id of ids) {
    try {
      await publicarOrientacao(id);
    } catch {
      /* o estado de erro aparece na tela; tenta de novo na próxima mudança */
    }
  }
}

window.addEventListener(EVENTO_PUBLICAVEL, (e) => {
  const id = (e as CustomEvent<string | null>).detail;
  void (async () => {
    const alvos = id ? [await db.trabalhos.get(id)] : await db.trabalhos.toArray();
    for (const t of alvos) if (t && t.publicacao && !t.excluido_em) pendentes.add(t.id);
    if (!pendentes.size) return;
    for (const p of pendentes) mudarEstado(p, { tipo: 'enviando' });
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => void republicarPendentes(), 3000);
  })();
});

// ---------- Pré-projeto: rascunho e envios do orientando ----------

export function configPreProjetoPadrao(o?: Pick<Orientando, 'curso'>, orientador = ''): ConfigPreProjeto {
  return { ativo: false, instituicao: 'Uniftec', curso: (o?.curso ?? '').replace(/^(gradua[çc][ãa]o em|curso de)\s+/i, '').replace(/,.*$/, '').trim(), cidade: 'Caxias do Sul', ano: String(new Date().getFullYear()), orientador, coorientador: '', natureza: '', resumo: false, aprovacao: false };
}

let logo: Promise<Uint8Array | undefined> | null = null;
export function logoUniftec(): Promise<Uint8Array | undefined> {
  logo ??= fetch('/logo-uniftec.png')
    .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined))
    .catch(() => undefined);
  return logo;
}

/** Formato do texto: o de quando foi enviado (nos envios) ou o que está valendo agora. */
export const formatoDoTexto = (t: Trabalho, texto: TextoProjeto): 'pre' | 'final' => texto.formatoEnvio ?? t.preProjeto?.formato ?? 'pre';
function configDoTexto(t: Trabalho, o: Orientando | undefined, texto: TextoProjeto) {
  return { ...(t.preProjeto ?? configPreProjetoPadrao(o)), formato: formatoDoTexto(t, texto) };
}

/** As imagens das figuras do trabalho final (lidas da página do orientando com a chave do professor). */
async function imagensDoTexto(t: Trabalho, texto: TextoProjeto) {
  if (formatoDoTexto(t, texto) !== 'final' || !t.publicacao) return undefined;
  const { imagensDoFinal, finalDoPreProjeto } = await import('./trabalhoFinalEstrutura');
  const { buscarImagens, imagemDaPagina } = await import('./imagens');
  const pub = t.publicacao;
  return buscarImagens(imagensDoFinal(texto.final ?? finalDoPreProjeto(texto)), (id) => imagemDaPagina(pub.codigo, id, { 'X-Vide-Chave': pub.chave }));
}

/** PDF do pré-projeto (ou do trabalho final) a partir de um texto (do rascunho ou de um envio). */
export async function pdfDoPreProjeto(t: Trabalho, o: Orientando | undefined, texto: TextoProjeto): Promise<Blob> {
  const { gerarPreProjetoPdf } = await import('./preProjetoPdf');
  return gerarPreProjetoPdf({ nome: o?.nome ?? '', config: configDoTexto(t, o, texto), texto, etapas: t.etapas, logo: await logoUniftec(), imagens: await imagensDoTexto(t, texto) });
}

/** Word (.docx) do pré-projeto a partir de um texto. */
export async function wordDoPreProjeto(t: Trabalho, o: Orientando | undefined, texto: TextoProjeto): Promise<Blob> {
  const { gerarPreProjetoDocx } = await import('./preProjetoDocx');
  return gerarPreProjetoDocx({ nome: o?.nome ?? '', config: configDoTexto(t, o, texto), texto, etapas: t.etapas, logo: await logoUniftec(), imagens: await imagensDoTexto(t, texto) });
}

/** O rascunho atual do orientando (o que está escrito agora na página dele). */
export async function lerRascunho(trabalhoId: string): Promise<{ projeto: TextoProjeto | null; ultimoEnvio: string | null }> {
  const t = await db.trabalhos.get(trabalhoId);
  if (!t?.publicacao) throw new Error('A página do orientando não está criada.');
  const r = await fetch(`/api/orientacao/${t.publicacao.codigo}/projeto`, { headers: { 'X-Vide-Chave': t.publicacao.chave } });
  if (!r.ok) throw new Error(`Não foi possível ler o rascunho (${r.status}).`);
  return (await r.json()) as { projeto: TextoProjeto | null; ultimoEnvio: string | null };
}

const buscando = new Set<string>();
/** Traz os envios novos do orientando como versões (PDF) do trabalho. Devolve quantos chegaram. */
export async function buscarEnvios(trabalhoId: string): Promise<number> {
  if (buscando.has(trabalhoId)) return 0;
  buscando.add(trabalhoId);
  try {
    const t = await db.trabalhos.get(trabalhoId);
    if (!t?.publicacao || t.excluido_em) return 0;
    const pub = t.publicacao;
    const r = await fetch(`/api/orientacao/${pub.codigo}/envios?depois=${encodeURIComponent(pub.ultimoEnvio ?? '')}`, { headers: { 'X-Vide-Chave': pub.chave } });
    if (!r.ok) return 0;
    const { envios } = (await r.json()) as { envios: { em: string; projeto: TextoProjeto }[] };
    if (!envios.length) return 0;
    const o = await db.orientandos.get(t.orientandoId);
    const ja = new Set((await db.versoes.where('trabalhoId').equals(t.id).toArray()).map((v) => v.rotulo));
    let n = 0;
    for (const e of envios) {
      const d = new Date(e.em);
      const quando = d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      const fin = formatoDoTexto(t, e.projeto) === 'final';
      const rotulo = `${fin ? 'Trabalho final' : 'Pré-projeto'} — enviado em ${quando}`;
      if (ja.has(rotulo)) continue;
      const blob = await pdfDoPreProjeto(t, o, e.projeto);
      const p2 = (x: number) => String(x).padStart(2, '0');
      const dia = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      const nome = `${fin ? 'Trabalho final' : 'Pre-projeto'} - ${(o?.nome ?? 'orientando').normalize('NFD').replace(/[\u0300-\u036f]/g, '')} - ${dia} ${p2(d.getHours())}h${p2(d.getMinutes())}.pdf`;
      await adicionarVersao(t.id, new File([blob], nome, { type: 'application/pdf' }), { rotulo, recebida_em: dia, etapaId: etapaAtual(t)?.id ?? null, notas: 'Enviado pelo orientando pela página de orientação.', projeto: e.projeto });
      n++;
    }
    const atual = await db.trabalhos.get(trabalhoId);
    if (atual?.publicacao) await gravarPublicacao(trabalhoId, { ...atual.publicacao, ultimoEnvio: envios[envios.length - 1].em });
    return n;
  } finally {
    buscando.delete(trabalhoId);
  }
}

/** Guarda (no computador e no Drive) uma cópia do rascunho do orientando, se ele mudou. Devolve se guardou. */
export async function guardarRascunho(trabalhoId: string): Promise<boolean> {
  const t = await db.trabalhos.get(trabalhoId);
  if (!t?.publicacao || !t.preProjeto?.ativo) return false;
  const { projeto } = await lerRascunho(trabalhoId);
  if (!projeto) return false;
  const atual = await db.trabalhos.get(trabalhoId);
  if (!atual || (atual.rascunhoProjeto?.texto.atualizado_em ?? '') === (projeto.atualizado_em ?? '') && atual.rascunhoProjeto) return false;
  // Gravado direto (sem pedir nova publicação da página).
  await db.trabalhos.put({ ...atual, rascunhoProjeto: { texto: projeto, guardadoEm: agoraISO() }, atualizado_em: agoraISO() });
  window.dispatchEvent(new Event('vide-orientacao-mudou'));
  return true;
}
