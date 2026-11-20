// Contas de prazo do cronograma (dias corridos) e os modelos de cronograma.
import { novoId } from '../dados/modelo';
import type { Encaminhamento, Etapa, Interacao, TipoTrabalho, Trabalho } from './tipos';

const p2 = (n: number) => String(n).padStart(2, '0');

/** Hoje, "AAAA-MM-DD", no horário deste computador. */
export function hojeISO(d = new Date()): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Agora, "AAAA-MM-DDTHH:MM". */
export function agoraLocal(d = new Date()): string {
  return `${hojeISO(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function diaUTC(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

/** Dias corridos de `de` até `ate` (negativo se já passou). */
export function diasEntre(de: string, ate: string): number {
  return Math.round(diaUTC(ate) - diaUTC(de));
}

export function somarDias(iso: string, dias: number): string {
  const ms = (diaUTC(iso) + dias) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** "12/11/2026". */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** "12/11/2026 14:03". */
export function dataHoraBR(iso: string): string {
  return iso.length > 10 ? `${dataBR(iso)} ${iso.slice(11, 16)}` : dataBR(iso);
}

// ---------- Precisão do prazo de uma etapa ----------
// "2027-11-15" = data completa · "2027-11" = só mês e ano · "2027" = só o ano · "" = a definir.

export type Precisao = 'dia' | 'mes' | 'ano' | 'indefinida';

export function precisao(prazo: string | undefined): Precisao {
  const p = (prazo ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return 'dia';
  if (/^\d{4}-\d{2}$/.test(p)) return 'mes';
  if (/^\d{4}$/.test(p)) return 'ano';
  return 'indefinida';
}

/** "15/11/2027", "11/2027", "2027" ou "a definir". */
export function rotuloPrazo(prazo: string | undefined): string {
  const p = (prazo ?? '').trim();
  switch (precisao(p)) {
    case 'dia':
      return dataBR(p);
    case 'mes':
      return `${p.slice(5, 7)}/${p.slice(0, 4)}`;
    case 'ano':
      return p;
    default:
      return 'a definir';
  }
}

/** Versão curta (para a linha do tempo): "15/11", "11/2027", "2027" ou "a definir". */
export function rotuloPrazoCurto(prazo: string | undefined): string {
  return precisao(prazo) === 'dia' ? dataBR(prazo!).slice(0, 5) : rotuloPrazo(prazo);
}

/** Chave para ordenar: dentro do mês (ou do ano), o que tem data completa vem antes; "a definir" vai para o fim. */
function chaveOrdem(prazo: string): string {
  switch (precisao(prazo)) {
    case 'dia':
      return prazo;
    case 'mes':
      return `${prazo}-99`;
    case 'ano':
      return `${prazo}-99-99`;
    default:
      return '9999-99-99';
  }
}

export type SituacaoEtapa = 'concluida' | 'atrasada' | 'hoje' | 'proxima' | 'futura' | 'indefinida';

/** Situação de uma etapa hoje. "Próxima" = vence em até 7 dias. Sem data completa: "indefinida" (sem contagem nem alerta). */
export function situacaoEtapa(e: Etapa, hoje = hojeISO()): { tipo: SituacaoEtapa; dias: number } {
  const temDia = precisao(e.prazo) === 'dia';
  const dias = temDia ? diasEntre(hoje, e.prazo) : 0;
  if (e.concluida_em) return { tipo: 'concluida', dias };
  if (!temDia) return { tipo: 'indefinida', dias: 0 };
  if (dias < 0) return { tipo: 'atrasada', dias };
  if (dias === 0) return { tipo: 'hoje', dias };
  return { tipo: dias <= 7 ? 'proxima' : 'futura', dias };
}

/** "faltam 7 dias", "vence hoje", "venceu há 2 dias". */
export function rotuloDias(dias: number): string {
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'falta 1 dia';
  if (dias > 1) return `faltam ${dias} dias`;
  return dias === -1 ? 'venceu há 1 dia' : `venceu há ${-dias} dias`;
}

/** Etapas em ordem de prazo (as sem data completa pelo que se sabe; "a definir" no fim). */
export function emOrdem(etapas: Etapa[]): Etapa[] {
  return [...etapas].sort((a, b) => chaveOrdem(a.prazo).localeCompare(chaveOrdem(b.prazo)));
}

/** O que mostrar sobre o prazo de uma etapa em aberto: "faltam 7 dias", "previsto para 11/2027", "a definir". */
export function rotuloSituacao(e: Etapa, hoje = hojeISO()): string {
  const s = situacaoEtapa(e, hoje);
  if (s.tipo === 'concluida') return `cumprida${e.concluida_em ? ` em ${dataBR(e.concluida_em)}` : ''}`;
  if (s.tipo === 'indefinida') return precisao(e.prazo) === 'indefinida' ? 'a definir' : `previsto para ${rotuloPrazo(e.prazo)}`;
  return rotuloDias(s.dias);
}

/** A primeira etapa ainda em aberto (a que o orientando deve cumprir agora). */
export function etapaAtual(t: Pick<Trabalho, 'etapas'>): Etapa | undefined {
  return emOrdem(t.etapas).find((e) => !e.concluida_em);
}

export interface Pendencia {
  enc: Encaminhamento;
  interacao: Interacao;
}

/** Sugestões e comandos ainda pendentes, das interações mais antigas para as mais novas. */
export function pendencias(interacoes: Interacao[]): Pendencia[] {
  return [...interacoes]
    .filter((i) => !i.excluido_em)
    .sort((a, b) => a.em.localeCompare(b.em))
    .flatMap((i) => i.encaminhamentos.filter((e) => e.situacao === 'pendente').map((enc) => ({ enc, interacao: i })));
}

const ETAPAS_TCC = [
  'Definição do tema',
  'Entrega do pré-projeto (Grau A)',
  'Entrega do Capítulo 1 (Grau B)',
  'Revisão do Capítulo 1',
  'Entrega do Capítulo 2 (Grau A)',
  'Revisão do Capítulo 2',
  'Trabalho completo',
  'Revisão final',
  'Depósito da versão impressa',
  'Defesa',
];

const MODELOS: Record<TipoTrabalho, string[]> = {
  // Os prazos usuais do TCC I e do TCC II.
  TCC: ETAPAS_TCC,
  Monografia: ETAPAS_TCC,
  Artigo: ['Tema e problema', 'Estrutura e bibliografia', 'Primeira versão', 'Versão revisada', 'Versão final', 'Submissão'],
  Dissertação: ['Projeto', 'Capítulo 1', 'Qualificação', 'Capítulo 2', 'Capítulo 3', 'Versão completa', 'Depósito', 'Defesa'],
  Tese: ['Projeto', 'Capítulo 1', 'Capítulo 2', 'Qualificação', 'Capítulo 3', 'Capítulo 4', 'Versão completa', 'Depósito', 'Defesa'],
  Outro: ['Primeira entrega', 'Segunda entrega', 'Versão final'],
};

/** Cronograma sugerido: as etapas do tipo, com os prazos espalhados até a defesa (ou de 30 em 30 dias). */
export function cronogramaModelo(tipo: TipoTrabalho, inicio: string, defesa?: string): Etapa[] {
  const nomes = MODELOS[tipo];
  const total = defesa && diasEntre(inicio, defesa) > nomes.length ? diasEntre(inicio, defesa) : nomes.length * 30;
  return nomes.map((nome, i) => ({
    id: novoId(),
    nome,
    prazo: i === nomes.length - 1 && defesa ? defesa : somarDias(inicio, Math.round((total * (i + 1)) / nomes.length)),
    concluida_em: null,
  }));
}
