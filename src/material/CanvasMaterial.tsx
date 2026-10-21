// Mostra uma região de uma página do material, ocupando o maior espaço possível
// dentro da caixa onde está. Redesenha quando a caixa muda de tamanho.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Documento } from './documento';
import type { Regiao } from './regiao';

interface Props {
  documento: Documento | null;
  pagina: number;
  regiao: Regiao;
  /** Conteúdo sobreposto à página (ex.: o retângulo do zoom na miniatura). */
  children?: ReactNode;
  /** Recebe o elemento da página desenhada (para converter cliques em frações). */
  paginaRef?: (el: HTMLDivElement | null) => void;
  /** Avisa o tamanho (em pixels de tela) em que a página foi desenhada. */
  onTamanho?: (t: { largura: number; altura: number }) => void;
}

export function CanvasMaterial({ documento, pagina, regiao, children, paginaRef, onTamanho }: Props) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caixa, setCaixa] = useState({ w: 0, h: 0 });
  const [tam, setTam] = useState<{ largura: number; altura: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setCaixa({ w: el.clientWidth, h: el.clientHeight }), 60);
    });
    ro.observe(el);
    setCaixa({ w: el.clientWidth, h: el.clientHeight });
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!documento || !c || caixa.w < 10 || caixa.h < 10) return;
    let vivo = true;
    documento
      .desenhar(c, pagina, regiao, caixa.w, caixa.h)
      .then((t) => {
        if (!vivo) return;
        setTam(t);
        setErro(null);
        onTamanho?.(t);
      })
      .catch((e) => vivo && setErro(String(e?.message ?? e)));
    return () => {
      vivo = false;
    };
  }, [documento, pagina, regiao.x, regiao.y, regiao.w, regiao.h, caixa.w, caixa.h]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mat-caixa" ref={caixaRef}>
      <div
        className="mat-pagina"
        ref={paginaRef}
        style={tam ? { width: tam.largura, height: tam.altura } : { visibility: 'hidden' }}
      >
        <canvas ref={canvasRef} />
        {children}
      </div>
      {erro && <p className="mat-erro">Não foi possível desenhar esta página: {erro}</p>}
    </div>
  );
}
