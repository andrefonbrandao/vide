// Registro de teste: tudo o que acontece durante a aula, com horário.
// Serve para medir os acertos depois (exportação em .txt e .csv).
import { db } from '../dados/db';
import type { EventoRegistro } from '../dados/modelo';
import { agoraISO, novoId } from '../dados/modelo';

const CHAVE_SESSAO = 'vide.sessao';
/** Depois de 3 horas sem eventos, começa uma nova sessão automaticamente. */
const INTERVALO_NOVA_SESSAO = 3 * 60 * 60 * 1000;

interface SessaoGuardada {
  id: string;
  ultimo: number;
}

function lerSessao(): SessaoGuardada | null {
  try {
    const s = localStorage.getItem(CHAVE_SESSAO);
    return s ? (JSON.parse(s) as SessaoGuardada) : null;
  } catch {
    return null;
  }
}

let sessaoMemoria: SessaoGuardada | null = null;

export function sessaoAtual(): string {
  const agora = Date.now();
  let s = sessaoMemoria ?? lerSessao();
  if (!s || agora - s.ultimo > INTERVALO_NOVA_SESSAO) {
    s = { id: novoId(), ultimo: agora };
  }
  s.ultimo = agora;
  sessaoMemoria = s;
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
  } catch {
    /* sem localStorage: fica só na memória */
  }
  return s.id;
}

export function novaSessao(): string {
  sessaoMemoria = { id: novoId(), ultimo: Date.now() };
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessaoMemoria));
  } catch {
    /* ignore */
  }
  return sessaoMemoria.id;
}

export function registrar(tipo: EventoRegistro['tipo'], texto: string, dados?: Record<string, unknown>): Promise<void> {
  const ev: EventoRegistro = { sessao_id: sessaoAtual(), em: agoraISO(), tipo, texto, dados };
  return db.registro
    .add(ev)
    .then(() => undefined)
    .catch((e) => console.error('Falha ao registrar', e));
}

export interface ResumoSessao {
  id: string;
  inicio: string;
  fim: string;
  total: number;
  contagem: Partial<Record<EventoRegistro['tipo'], number>>;
}

export async function listarSessoes(): Promise<ResumoSessao[]> {
  const todos = await db.registro.orderBy('seq').toArray();
  const mapa = new Map<string, ResumoSessao>();
  for (const e of todos) {
    let s = mapa.get(e.sessao_id);
    if (!s) {
      s = { id: e.sessao_id, inicio: e.em, fim: e.em, total: 0, contagem: {} };
      mapa.set(e.sessao_id, s);
    }
    s.fim = e.em;
    s.total++;
    s.contagem[e.tipo] = (s.contagem[e.tipo] ?? 0) + 1;
  }
  return [...mapa.values()].sort((a, b) => b.inicio.localeCompare(a.inicio));
}

export async function eventosDaSessao(id: string): Promise<EventoRegistro[]> {
  const lista = await db.registro.where('sessao_id').equals(id).toArray();
  return lista.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

export async function apagarSessao(id: string): Promise<void> {
  await db.registro.where('sessao_id').equals(id).delete();
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour12: false });
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { hour12: false });
}

const ROTULOS: Record<EventoRegistro['tipo'], string> = {
  sessao: 'SESSÃO',
  fala: 'fala',
  detectado: 'DETECTADO',
  nao_encontrado: 'fora do acervo',
  outro_diploma: 'outro diploma',
  candidato: 'candidato',
  projetado: '>>> PROJETADO',
  recolhido: '<<< recolhido',
  comando_voz: 'COMANDO DE VOZ',
  voz: 'voz',
  marcacao: '*** MARCAÇÃO',
};

/** Texto legível: a transcrição com as projeções marcadas no ponto em que ocorreram. */
export function exportarTxt(eventos: EventoRegistro[]): string {
  const linhas: string[] = [];
  if (eventos.length) {
    linhas.push(`Vide — registro de teste`);
    linhas.push(`Início: ${dataHora(eventos[0].em)}   Fim: ${dataHora(eventos[eventos.length - 1].em)}`);
    linhas.push('');
  }
  for (const e of eventos) {
    const extra = e.dados && Object.keys(e.dados).length ? `  ${resumoDados(e)}` : '';
    if (e.tipo === 'fala') linhas.push(`${hora(e.em)}  ${e.texto}`);
    else if (e.tipo === 'projetado') linhas.push(`${hora(e.em)}  [projetado: ${e.texto}]${extra}`);
    else linhas.push(`${hora(e.em)}    · ${ROTULOS[e.tipo]}: ${e.texto}${extra}`);
  }
  return linhas.join('\r\n');
}

function resumoDados(e: EventoRegistro): string {
  const d = e.dados ?? {};
  return Object.entries(d)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' ');
}

/** Planilha (abre no Excel em português: separador ";" e acentos preservados). */
export function exportarCsv(eventos: EventoRegistro[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const linhas = ['data;hora;tipo;texto;detalhes'];
  for (const e of eventos) {
    const d = new Date(e.em);
    linhas.push(
      [
        d.toLocaleDateString('pt-BR'),
        d.toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0'),
        e.tipo,
        esc(e.texto),
        esc(resumoDados(e)),
      ].join(';'),
    );
  }
  return '﻿' + linhas.join('\r\n');
}

export function baixar(nome: string, conteudo: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function nomeArquivo(inicioIso: string, ext: string): string {
  const d = new Date(inicioIso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `vide-registro-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}.${ext}`;
}
