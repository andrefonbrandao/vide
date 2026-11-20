// Código da página do orientando (para enviar e ver as imagens das figuras), compartilhado
// entre o formulário e o editor.
import { createContext } from 'react';

/** `cabecalho`: o código do orientando (X-Vide-Pin) ou a chave do professor (X-Vide-Chave). */
export const ContextoPagina = createContext<{ codigo: string; cabecalho: Record<string, string> } | null>(null);
