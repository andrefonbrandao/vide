// Capa de um material: a primeira página, desenhada quando o cartão aparece na tela.
import { useEffect, useRef, useState } from 'react';
import type { Material } from '../dados/modelo';
import { miniaturaDe } from '../material/documento';

export function Miniatura({ m }: { m: Pick<Material, 'id' | 'tipo' | 'arquivo' | 'nome'> }) {
  const caixa = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let vivo = true;
    const carregar = () => void miniaturaDe(m).then((u) => vivo && setUrl(u));
    if (typeof IntersectionObserver === 'undefined') {
      carregar();
      return () => void (vivo = false);
    }
    const obs = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          obs.disconnect();
          carregar();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => {
      vivo = false;
      obs.disconnect();
    };
  }, [m]);
  return (
    <span ref={caixa} className={`miniatura${url ? ' pronta' : ''}`}>
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <span className="miniatura-esboco" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}
