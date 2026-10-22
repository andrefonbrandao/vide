// Painel do material na tela do apresentador: miniatura da página atual,
// retângulo do zoom (arrastar para ampliar) e botões de página.
import { useEffect, useRef, useState } from 'react';
import { CanvasMaterial } from '../material/CanvasMaterial';
import { abrirDocumentoPorId, type Documento } from '../material/documento';
import { PAGINA_INTEIRA, ajustarProporcao, ehInteira, regiaoDeArraste, type Regiao } from '../material/regiao';
import type { ControladorAula, EstadoAula } from './controlador';
import { IcMostrar, IcOcultar, IcPaginaInteira, IcSetaBaixo, IcSubstituir, IcVisualizacao } from '../comum/Icones';

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
        <button className="botao pequeno com-icone" onClick={() => ctl.paginaInteira()} disabled={ehInteira(m.regiao)} title="Tecla 0 ou duplo clique na página">
          <IcPaginaInteira tamanho={18} /> Página inteira
        </button>
        <button className={`botao pequeno com-icone${e.telaPreta ? ' escuro' : ''}`} onClick={() => ctl.alternarTelaPreta()} title="Tecla . (ponto)">
          {e.telaPreta ? <IcMostrar tamanho={18} /> : <IcOcultar tamanho={18} />} {e.telaPreta ? 'Mostrar' : 'Ocultar'}
        </button>
        <MenuVisualizacao e={e} ctl={ctl} />
      </div>
      <p className="ajuda painel-material-dica">
        Arraste sobre a página para ampliar uma parte · duplo clique volta à página inteira · a roda passa as páginas
        {ehInteira(m.regiao) ? '' : ' (com zoom, desce dentro da página)'}.
      </p>
    </div>
  );
}

/** Botão "Visualização": como a norma aparece quando há material na tela. */
function MenuVisualizacao({ e, ctl }: { e: EstadoAula; ctl: ControladorAula }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setAberto(false);
    };
    window.addEventListener('mousedown', fora);
    return () => window.removeEventListener('mousedown', fora);
  }, [aberto]);
  const opcao = (valor: 'lateral' | 'cheia', rotulo: string, icone: React.ReactNode, descricao: string) => (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={e.layoutArtigo === valor}
      className={`opcao-menu${e.layoutArtigo === valor ? ' atual' : ''}`}
      onClick={() => {
        ctl.definirLayout(valor);
        setAberto(false);
      }}
    >
      {icone}
      <span>
        <strong>{rotulo}</strong>
        <span className="opcao-menu-desc">{descricao}</span>
      </span>
    </button>
  );
  return (
    <div className="menu-visualizacao" ref={ref}>
      <button className="botao pequeno com-icone" onClick={() => setAberto(!aberto)} aria-expanded={aberto} title="Tecla L alterna">
        <IcVisualizacao tamanho={18} /> Visualização: {e.layoutArtigo === 'lateral' ? 'ao lado da norma' : 'substituir pela norma'}{' '}
        <IcSetaBaixo tamanho={14} />
      </button>
      {aberto && (
        <div className="popover-menu" role="menu">
          {opcao('lateral', 'Ao lado da norma', <IcVisualizacao />, 'O slide encolhe e a norma entra ao lado.')}
          {opcao('cheia', 'Substituir pela norma', <IcSubstituir />, 'A norma ocupa a tela; o slide volta ao recolher.')}
        </div>
      )}
    </div>
  );
}
