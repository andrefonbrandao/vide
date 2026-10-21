// Janela de projeção: tela preta (neutra), o material do professor (slides/PDF)
// e, por cima, o artigo projetado — ao lado do material ou em tela cheia.
// Texto sempre em #1E3A34 sobre #EEF0EA (ou o inverso no destaque); nunca em laranja.
import { useEffect, useRef, useState } from 'react';
import { abrirCanal, type LayoutArtigo, type Mensagem } from '../comum/canal';
import type { Projetavel } from '../comum/legislacao';
import { CanvasMaterial } from '../material/CanvasMaterial';
import { abrirDocumentoPorId, type Documento } from '../material/documento';
import { PAGINA_INTEIRA, type Regiao } from '../material/regiao';

interface EstadoMaterial {
  id: string | null;
  pagina: number;
  regiao: Regiao;
  preta: boolean;
}

/** Tamanho da letra conforme a quantidade de texto (em vw, relativo à largura da tela). */
export function tamanhoBase(item: Projetavel): number {
  const chars = item.blocos.reduce((s, b) => s + b.texto.length + b.rotulo.length, 0);
  if (chars < 250) return 4.2;
  if (chars < 550) return 3.5;
  if (chars < 1000) return 3.0;
  if (chars < 1800) return 2.6;
  return 2.3;
}

export function Folha({ item, fontSize }: { item: Projetavel; fontSize: string }) {
  return (
    <div className="projecao-miolo" style={{ fontSize }}>
      <h1 className="projecao-titulo" style={{ fontSize: '1.25em' }}>
        <span>{item.titulo}</span>
        <span className="fonte">· {item.fonte}</span>
      </h1>
      {item.blocos.map((b, i) => (
        <p
          key={i}
          className={`projecao-bloco${b.destaque ? ' destaque' : ''}${b.omissao ? ' omissao' : ''}`}
          style={{ ['--recuo' as string]: `${b.nivel * 1.4}em` }}
        >
          {b.rotulo && <span className="rot">{b.rotulo}</span>}
          {b.texto}
        </p>
      ))}
    </div>
  );
}

export function Projecao() {
  const [item, setItem] = useState<Projetavel | null>(null);
  const [escala, setEscala] = useState(1);
  const [layout, setLayout] = useState<LayoutArtigo>('lateral');
  const [material, setMaterial] = useState<EstadoMaterial>({ id: null, pagina: 1, regiao: PAGINA_INTEIRA, preta: false });
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [telaCheia, setTelaCheia] = useState(!!document.fullscreenElement);
  const [mostrarCursor, setMostrarCursor] = useState(false);
  const folhaRef = useRef<HTMLDivElement>(null);
  const enviarRef = useRef<(m: Mensagem) => void>(() => {});

  useEffect(() => {
    document.title = 'Vide — projeção';
    const canal = abrirCanal((m) => {
      if (m.t === 'projetar') {
        setItem(m.item);
        setEscala(m.escala);
        setLayout(m.layout);
        requestAnimationFrame(() => folhaRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
      } else if (m.t === 'recolher') {
        setItem(null);
      } else if (m.t === 'escala') {
        setEscala(m.escala);
      } else if (m.t === 'layout') {
        setLayout(m.layout);
      } else if (m.t === 'material') {
        setMaterial({ id: m.id, pagina: m.pagina, regiao: m.regiao, preta: m.preta });
      } else if (m.t === 'rolar') {
        const f = folhaRef.current;
        if (f) f.scrollBy({ top: m.delta * f.clientHeight * 0.18, behavior: 'smooth' });
      } else if (m.t === 'ping') {
        canal.enviar({ t: 'pong', telaCheia: !!document.fullscreenElement, aspecto: window.innerWidth / Math.max(1, window.innerHeight) });
      }
    });
    enviarRef.current = canal.enviar;
    canal.enviar({ t: 'ola' });
    const aoMudarTela = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', aoMudarTela);
    return () => {
      canal.fechar();
      document.removeEventListener('fullscreenchange', aoMudarTela);
    };
  }, []);

  // Abre o arquivo do material (lido do banco local deste navegador).
  useEffect(() => {
    let vivo = true;
    if (!material.id) {
      setDocumento(null);
      return;
    }
    abrirDocumentoPorId(material.id).then((d) => vivo && setDocumento(d));
    return () => {
      vivo = false;
    };
  }, [material.id]);

  // Informa ao apresentador a posição da rolagem.
  useEffect(() => {
    const f = folhaRef.current;
    if (!f) return;
    const informar = () => {
      const max = f.scrollHeight - f.clientHeight;
      enviarRef.current({ t: 'rolagem', fracao: max > 0 ? f.scrollTop / max : 0, rolavel: max > 4 });
    };
    informar();
    f.addEventListener('scroll', informar, { passive: true });
    const t = window.setTimeout(informar, 400);
    return () => {
      f.removeEventListener('scroll', informar);
      window.clearTimeout(t);
    };
  }, [item, escala, layout]);

  // Cursor aparece só quando o mouse se mexe nesta janela.
  useEffect(() => {
    let t = 0;
    const mexeu = () => {
      setMostrarCursor(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMostrarCursor(false), 1500);
    };
    window.addEventListener('mousemove', mexeu);
    return () => window.removeEventListener('mousemove', mexeu);
  }, []);

  const entrarTelaCheia = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const comMaterial = !!material.id && !material.preta && !!documento;
  const lateral = !!item && comMaterial && layout === 'lateral';
  // Na lateral (42% da tela) a letra diminui, mas não abaixo de um mínimo legível.
  const fonte = item ? (lateral ? Math.max(1.6, tamanhoBase(item) * 0.55) : tamanhoBase(item)) * escala : 0;

  return (
    <div className={`projecao${mostrarCursor ? ' com-cursor' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      {comMaterial && (
        <div className={`proj-material${lateral ? ' encolhido' : ''}${item && !lateral ? ' oculto' : ''}`}>
          <CanvasMaterial documento={documento} pagina={material.pagina} regiao={material.regiao} />
        </div>
      )}
      {item && (
        <div className={`projecao-folha${lateral ? ' lateral' : ''}`} ref={folhaRef} key={item.id}>
          <div className="projecao-faixa" />
          <Folha item={item} fontSize={`${fonte}vw`} />
        </div>
      )}
      {!item && <div ref={folhaRef} />}
      {!telaCheia && !item && !comMaterial && (
        <div className="projecao-convite">
          <button className="caixa" onClick={entrarTelaCheia}>
            Esta é a janela de projeção.
            <strong>Clique aqui para tela cheia</strong>
            (ou aperte F11). Depois, volte o mouse para a tela do notebook.
          </button>
        </div>
      )}
    </div>
  );
}
