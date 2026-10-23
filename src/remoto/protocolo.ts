// Mensagens trocadas entre o celular (controle + microfone) e o computador
// (acervo + projeção), pelo serviço de mensagens do Vide no Cloudflare.
import type { LayoutArtigo } from '../comum/canal';
import type { StatusVoz } from '../voz/reconhecedor';

export interface AlternativaRemota {
  id: string;
  titulo: string;
  texto: string;
  aviso: string | null;
}

/** Retrato da aula, enviado do computador para o celular a cada mudança. */
export interface EstadoRemoto {
  t: 'estado';
  versao: string;
  alternativas: AlternativaRemota[];
  projetadoId: string | null;
  projetadoTitulo: string | null;
  material: { nome: string; pagina: number; paginas: number; zoom: boolean } | null;
  telaPreta: boolean;
  layout: LayoutArtigo;
  /** O microfone do computador está ligado. */
  escutaComputador: boolean;
  projecaoConectada: boolean;
  /** Últimas falas reconhecidas (para conferir no celular). */
  ultimaFala: string;
}

export type ComandoRemoto =
  | { t: 'cmd'; acao: 'projetar'; id?: string }
  | { t: 'cmd'; acao: 'recolher' }
  | { t: 'cmd'; acao: 'pagina'; delta: number }
  | { t: 'cmd'; acao: 'paginaInteira' }
  | { t: 'cmd'; acao: 'ocultar' }
  | { t: 'cmd'; acao: 'layout'; valor: LayoutArtigo }
  | { t: 'cmd'; acao: 'rolar'; delta: number }
  | { t: 'cmd'; acao: 'marcar' };

/** Celular -> computador. */
export type MsgDoCelular =
  | { t: 'ola-celular' }
  | { t: 'voz'; tipo: 'parcial' | 'final'; texto: string; chave: string; confianca?: number }
  | { t: 'voz-status'; status: StatusVoz; detalhe?: string }
  | { t: 'diag'; texto: string; dados?: Record<string, unknown> }
  | ComandoRemoto;

/** Avisos do próprio serviço: quem está na sala. */
export interface MsgPresenca {
  t: 'presenca';
  computador: number;
  celular: number;
}

/** Pedido do computador para o celular parar de escutar (o microfone do computador assumiu). */
export interface MsgPararEscuta {
  t: 'parar-escuta';
}

/** Computador -> celular. */
export type MsgDoComputador = EstadoRemoto | MsgPararEscuta | MsgPresenca;
/** O que o computador envia (a presença vem do próprio serviço). */
export type EnvioDoComputador = EstadoRemoto | MsgPararEscuta;

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código de pareamento (8 caracteres, sem letras que se confundem). */
export function gerarCodigo(): string {
  const n = new Uint32Array(8);
  crypto.getRandomValues(n);
  return Array.from(n, (x) => LETRAS[x % LETRAS.length]).join('');
}

export function urlDoControle(codigo: string): string {
  return `${location.origin}${location.pathname}?tela=controle&sala=${codigo}`;
}
