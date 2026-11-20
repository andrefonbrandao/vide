// Código da página do orientando (para enviar e ver as imagens das figuras), compartilhado
// entre o formulário e o editor.
import { createContext } from 'react';

export const ContextoPagina = createContext<{ codigo: string; pin: string } | null>(null);
