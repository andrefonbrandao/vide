// Região visível de uma página do material (frações de 0 a 1 da página).
// Página inteira = { x: 0, y: 0, w: 1, h: 1 }. Zoom = região menor.

export interface Regiao {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Posicao {
  pagina: number; // começa em 1
  regiao: Regiao;
}

export const PAGINA_INTEIRA: Regiao = { x: 0, y: 0, w: 1, h: 1 };

/** Menor região permitida (3% da página): zoom de até ~33x. */
const MINIMO = 0.03;
/** Quanto a roda desce dentro da página com zoom (fração da altura visível). */
const PASSO_ZOOM = 0.35;

export function ehInteira(r: Regiao): boolean {
  return r.w >= 0.999 && r.h >= 0.999;
}

/** Garante que a região fica dentro da página e não é pequena demais. */
export function ajustarRegiao(r: Regiao): Regiao {
  const w = Math.min(1, Math.max(MINIMO, r.w));
  const h = Math.min(1, Math.max(MINIMO, r.h));
  const x = Math.min(1 - w, Math.max(0, r.x));
  const y = Math.min(1 - h, Math.max(0, r.y));
  return { x, y, w, h };
}

/** Região a partir de dois pontos arrastados (em frações da página). */
export function regiaoDeArraste(x1: number, y1: number, x2: number, y2: number): Regiao {
  return ajustarRegiao({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
}

/**
 * Um passo da roda.
 * - Página inteira: vai para a página seguinte (delta > 0) ou anterior.
 * - Com zoom: desce (ou sobe) dentro da página; ao chegar ao fim, passa para o
 *   início da página seguinte mantendo o mesmo zoom (bom para PDF vertical).
 */
export function passo(pos: Posicao, delta: number, totalPaginas: number): Posicao {
  const r = pos.regiao;
  if (ehInteira(r)) {
    const pagina = Math.min(totalPaginas, Math.max(1, pos.pagina + delta));
    return { pagina, regiao: PAGINA_INTEIRA };
  }
  const passoY = r.h * PASSO_ZOOM;
  if (delta > 0) {
    if (r.y + r.h >= 0.999) {
      if (pos.pagina >= totalPaginas) return pos;
      return { pagina: pos.pagina + 1, regiao: { ...r, y: 0 } };
    }
    return { pagina: pos.pagina, regiao: { ...r, y: Math.min(1 - r.h, r.y + passoY) } };
  }
  if (r.y <= 0.001) {
    if (pos.pagina <= 1) return pos;
    return { pagina: pos.pagina - 1, regiao: { ...r, y: 1 - r.h } };
  }
  return { pagina: pos.pagina, regiao: { ...r, y: Math.max(0, r.y - passoY) } };
}

/**
 * Tamanho em que a região cabe numa caixa (largura × altura), sem distorcer.
 * `paginaW/paginaH` é o tamanho da página em qualquer unidade.
 */
export function encaixar(caixaW: number, caixaH: number, paginaW: number, paginaH: number, r: Regiao) {
  const rw = r.w * paginaW;
  const rh = r.h * paginaH;
  const escala = Math.min(caixaW / rw, caixaH / rh);
  return { escala, largura: rw * escala, altura: rh * escala };
}

/**
 * Amplia a região (em volta do centro) até ficar com a proporção da tela do
 * projetor, para aproveitar a tela inteira sem faixas pretas. `aspecto` = largura/altura da tela.
 */
export function ajustarProporcao(r: Regiao, paginaW: number, paginaH: number, aspecto: number): Regiao {
  if (ehInteira(r)) return r;
  let w = r.w;
  let h = r.h;
  const atual = (w * paginaW) / (h * paginaH);
  if (atual < aspecto) w = Math.min(1, (h * paginaH * aspecto) / paginaW);
  else h = Math.min(1, (w * paginaW) / aspecto / paginaH);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return ajustarRegiao({ x: cx - w / 2, y: cy - h / 2, w, h });
}
