// Comunicação entre a janela do apresentador e a de projeção (BroadcastChannel).
// Funciona só entre janelas do mesmo navegador, no mesmo aparelho.
import type { Projetavel } from './legislacao';
import type { Regiao } from '../material/regiao';
import type { VisaoTela } from '../jogo/motor';

import type { TelaConsulta } from '../consulta/apresentador';
import type { TelaProcesso } from '../processo/aula';

/** O jogo de perguntas como a projeção o desenha. */
export interface TelaJogo extends VisaoTela {
  codigo: string;
  /** Endereço curto para os alunos digitarem (sem https://). */
  enderecoCurto: string;
  /** Endereço completo (QR code). */
  url: string;
  /** O professor pediu o QR code grande no meio da tela (para quem chegou depois). */
  qrGrande?: boolean;
}

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
  /** Jogo de perguntas na tela (null = sem jogo). */
  | { t: 'jogo'; jogo: TelaJogo | null }
  /** Jogo "Consulta" (casos com personagens) na tela (null = sem consulta). */
  | { t: 'consulta'; consulta: TelaConsulta | null }
  /** Processo da turma projetado (null = fechado) e a rolagem dele. */
  | { t: 'processo'; processo: TelaProcesso | null }
  | { t: 'processo-rolar'; fracao: number }
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
