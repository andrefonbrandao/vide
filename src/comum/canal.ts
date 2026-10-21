// Comunicação entre a janela do apresentador e a de projeção (BroadcastChannel).
// Funciona só entre janelas do mesmo navegador, no mesmo aparelho.
import type { Projetavel } from './legislacao';
import type { Regiao } from '../material/regiao';

/** Como o artigo aparece quando há material na tela: ao lado ou por cima de tudo. */
export type LayoutArtigo = 'lateral' | 'cheia';

export type Mensagem =
  // apresentador -> projeção
  | { t: 'projetar'; item: Projetavel; escala: number; layout: LayoutArtigo }
  | { t: 'recolher' }
  | { t: 'rolar'; delta: number }
  | { t: 'escala'; escala: number }
  | { t: 'layout'; layout: LayoutArtigo }
  /** Material de fundo (slides/PDF). `id: null` = sem material (tela preta). */
  | { t: 'material'; id: string | null; pagina: number; regiao: Regiao; preta: boolean }
  /** Pede à janela de projeção para se recarregar (quando está com versão antiga). */
  | { t: 'recarregar' }
  | { t: 'ping' }
  // projeção -> apresentador
  | { t: 'ola' }
  /** `aspecto` = largura/altura da janela de projeção. */
  | { t: 'pong'; telaCheia: boolean; aspecto: number; versao?: string; materialCarregado?: string | null }
  | { t: 'rolagem'; fracao: number; rolavel: boolean };

const NOME = 'vide-projecao';

export function abrirCanal(aoReceber: (m: Mensagem) => void): { enviar: (m: Mensagem) => void; fechar: () => void } {
  const canal = new BroadcastChannel(NOME);
  canal.onmessage = (e: MessageEvent<Mensagem>) => aoReceber(e.data);
  return {
    enviar: (m) => canal.postMessage(m),
    fechar: () => canal.close(),
  };
}
