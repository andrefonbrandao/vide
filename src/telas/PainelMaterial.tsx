// Painel do material na tela do apresentador: miniatura da página atual,
// retângulo do zoom (arrastar para ampliar) e botões de página.
import { useEffect, useRef, useState } from 'react';
import { CanvasMaterial } from '../material/CanvasMaterial';
import { abrirDocumentoPorId, type Documento } from '../material/documento';
import { PAGINA_INTEIRA, ajustarProporcao, ehInteira, regiaoDeArraste, type Regiao } from '../material/regiao';
import type { ControladorAula, EstadoAula } from './controlador';

export function PainelMaterial({ e, ctl }: { e: EstadoAula; ctl: ControladorAula }) {
  const m = e.material!;
  const [documento, setDocumento] = useState<Documento | null>(null);
  const paginaEl = useRef<HTMLDivElement | null>(null);
  const [arraste, setArraste] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    setDocumento(null);
    abrirDocumentoPorId(m.id).then((d) => vivo && setDocumento(d));
    return () => {
      vivo = false;
    };
  }, [m.id]);

  const fracao = (ev: React.PointerEvent) => {
    const r = paginaEl.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
    };
  };

  const aoPressionar = (ev: React.PointerEvent) => {
    if (ev.button !== 0 || !paginaEl.current) return;
    ev.preventDefault();
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    const p = fracao(ev);
    setArraste({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };
  const aoMover = (ev: React.PointerEvent) => {
    if (!arraste) return;
    const p = fracao(ev);
    setArraste({ ...arraste, x2: p.x, y2: p.y });
  };
  const aoSoltar = async () => {
    if (!arraste) return;
    const { x1, y1, x2, y2 } = arraste;
    setArraste(null);
    // Só conta como zoom se o retângulo tiver algum tamanho (um clique simples não faz nada).
    if (Math.abs(x2 - x1) <= 0.03 || Math.abs(y2 - y1) <= 0.03) return;
    let r = regiaoDeArraste(x1, y1, x2, y2);
    // Completa a região até a proporção da tela do projetor (sem faixas pretas).
    if (documento) {
      const t = await documento.tamanho(m.pagina);
      r = ajustarProporcao(r, t.w, t.h, e.projecao.aspecto);
    }
    ctl.definirRegiao(r);
  };

  const retangulo = (r: Regiao, classe: string) => (
    <div
      className={classe}
      style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
    />
  );

  return (
    <div className="painel-material" data-ui>
      <div className="painel-material-topo">
        <strong className="painel-material-nome" title={m.nome}>{m.nome}</strong>
        <span className="espaco" />
        <button className="botao pequeno" onClick={() => ctl.passoMaterial(-1)} aria-label="Voltar">◀</button>
        <span className="painel-material-pag">
          página {m.pagina} de {m.paginas}
        </span>
        <button className="botao pequeno" onClick={() => ctl.passoMaterial(1)} aria-label="Avançar">▶</button>
      </div>

      <div className={`painel-material-pagina${e.telaPreta ? ' apagado' : ''}`}>
        <CanvasMaterial documento={documento} pagina={m.pagina} regiao={PAGINA_INTEIRA} paginaRef={(el) => (paginaEl.current = el)}>
          <div
            className="zoom-alvo"
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={() => void aoSoltar()}
            onPointerCancel={() => setArraste(null)}
            onDoubleClick={() => ctl.paginaInteira()}
          />
          {!ehInteira(m.regiao) && retangulo(m.regiao, 'zoom-atual')}
          {arraste && retangulo(regiaoDeArraste(arraste.x1, arraste.y1, arraste.x2, arraste.y2), 'zoom-novo')}
        </CanvasMaterial>
        {e.telaPreta && <div className="painel-material-aviso">Projetor em tela preta</div>}
      </div>

      <div className="painel-material-botoes">
        <button className="botao pequeno" onClick={() => ctl.paginaInteira()} disabled={ehInteira(m.regiao)}>
          Página inteira
        </button>
        <button className="botao pequeno" onClick={() => ctl.alternarTelaPreta()} title="Tecla . (ponto)">
          {e.telaPreta ? 'Mostrar material' : 'Tela preta'}
        </button>
        <button className="botao pequeno" onClick={() => ctl.alternarLayout()} title="Tecla L">
          Artigo: {e.layoutArtigo === 'lateral' ? 'ao lado do slide' : 'em tela cheia'}
        </button>
      </div>
      <p className="ajuda painel-material-dica">
        Arraste sobre a página para ampliar uma parte · duplo clique volta à página inteira · a roda passa as páginas
        {ehInteira(m.regiao) ? '' : ' (com zoom, desce dentro da página)'}.
      </p>
    </div>
  );
}
