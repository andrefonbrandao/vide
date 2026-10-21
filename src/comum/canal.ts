// Comunicação entre a janela do apresentador e a de projeção (BroadcastChannel).
// Funciona só entre janelas do mesmo navegador, no mesmo aparelho.
import type { Projetavel } from './legislacao';

export type Mensagem =
  // apresentador -> projeção
  | { t: 'projetar'; item: Projetavel; escala: number }
  | { t: 'recolher' }
  | { t: 'rolar'; delta: number }
  | { t: 'escala'; escala: number }
  | { t: 'ping' }
  // projeção -> apresentador
  | { t: 'ola' }
  | { t: 'pong'; telaCheia: boolean }
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
