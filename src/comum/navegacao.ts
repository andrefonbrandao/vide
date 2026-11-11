// Navegação entre as páginas do app (pelo endereço: #inicio, #materiais…),
// para o botão "Voltar" do navegador funcionar e cada página ter um endereço.
import { useEffect, useState } from 'react';

export type Rota = 'inicio' | 'aula' | 'leis' | 'materiais' | 'questoes' | 'casos' | 'processos' | 'links' | 'resultados' | 'registro' | 'ajustes' | 'turmas';

const ROTAS: Rota[] = ['inicio', 'aula', 'leis', 'materiais', 'questoes', 'casos', 'processos', 'links', 'resultados', 'registro', 'ajustes', 'turmas'];

/** Ações que uma página faz ao abrir (vindas do "+ Criar", da busca ou do Início). */
export type Acao = 'nova-lei' | 'novo-material' | 'novas-questoes' | 'novo-treino' | 'novo-caso' | 'novo-processo' | 'colar-processo';

let versao = 0;
/** A ação pedida na última navegação feita pelo app (e em qual navegação). */
let ultima: { versao: number; acao: Acao | null } = { versao: 0, acao: null };

export function rotaAtual(): Rota {
  const h = location.hash.replace(/^#/, '') as Rota;
  return ROTAS.includes(h) ? h : 'inicio';
}

/** Vai para uma página (opcionalmente pedindo que ela já abra numa ação). */
export function irPara(rota: Rota, acao?: Acao): void {
  versao++;
  ultima = { versao, acao: acao ?? null };
  if (location.hash !== `#${rota}`) location.hash = rota;
  else window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** A ação pedida na navegação de número `v` (null se ela não pediu nenhuma). */
export function acaoDaNavegacao(v: number): Acao | null {
  return ultima.versao === v ? ultima.acao : null;
}

/** Rota atual e um número que muda a cada navegação (para a página recomeçar quando pedido). */
export function useRota(): { rota: Rota; versao: number } {
  const [estado, setEstado] = useState({ rota: rotaAtual(), versao });
  useEffect(() => {
    const mudou = () => {
      setEstado({ rota: rotaAtual(), versao });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);
  return estado;
}
