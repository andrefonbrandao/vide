// Janela de projeção: tela preta (neutra), o material do professor (slides/PDF)
// e, por cima, o artigo projetado — ao lado do material ou em tela cheia.
// Texto sempre em #1E3A34 sobre #EEF0EA (ou o inverso no destaque); nunca em laranja.
import { useEffect, useRef, useState } from 'react';
import { abrirCanal, type LayoutArtigo, type Mensagem } from '../comum/canal';
import type { Projetavel } from '../comum/legislacao';
import { CanvasMaterial } from '../material/CanvasMaterial';
import { IcTelaCheia } from '../comum/Icones';
import { abrirDocumentoPorId, type Documento } from '../material/documento';
import { PAGINA_INTEIRA, type Regiao } from '../material/regiao';

/** Duração do deslize do artigo (ms) — igual à do CSS. */
const DURACAO_MS = 650;
/** Parte da largura da tela ocupada pelo artigo ao lado do slide. */
const FRACAO_PAINEL = 0.42;

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
  /** O painel do artigo está saindo (animação de recolher). */
  const [saindo, setSaindo] = useState(false);
  /** O painel acabou de ser montado e ainda está fora da tela (para deslizar para dentro). */
  const [entrando, setEntrando] = useState(false);
  const [escala, setEscala] = useState(1);
  const [layout, setLayout] = useState<LayoutArtigo>('lateral');
  const [material, setMaterial] = useState<EstadoMaterial>({ id: null, pagina: 1, regiao: PAGINA_INTEIRA, preta: false });
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [tamPagina, setTamPagina] = useState<{ largura: number; altura: number } | null>(null);
  const [telaCheia, setTelaCheia] = useState(!!document.fullscreenElement);
  const [mostrarCursor, setMostrarCursor] = useState(false);
  /** Barra do rodapé com o botão de tela cheia (aparece com o mouse perto da borda de baixo). */
  const [barra, setBarra] = useState(true);
  const [tela, setTela] = useState({ w: window.innerWidth, h: window.innerHeight });
  const folhaRef = useRef<HTMLDivElement>(null);
  const enviarRef = useRef<(m: Mensagem) => void>(() => {});
  const itemRef = useRef<Projetavel | null>(null);
  const saidaRef = useRef(0);
  const docIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.title = 'Vide — projeção';
    const canal = abrirCanal((m) => {
      if (m.t === 'projetar') {
        window.clearTimeout(saidaRef.current);
        setSaindo(false);
        // Só desliza para dentro se o painel não estava aberto; se já estava, troca o texto no lugar.
        if (!itemRef.current) setEntrando(true);
        itemRef.current = m.item;
        setItem(m.item);
        setEscala(m.escala);
        setLayout(m.layout);
        requestAnimationFrame(() => folhaRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
      } else if (m.t === 'recolher') {
        if (!itemRef.current) return;
        // Desliza para fora e só então some.
        setSaindo(true);
        window.clearTimeout(saidaRef.current);
        saidaRef.current = window.setTimeout(() => {
          itemRef.current = null;
          setItem(null);
          setSaindo(false);
        }, DURACAO_MS);
      } else if (m.t === 'escala') {
        setEscala(m.escala);
      } else if (m.t === 'layout') {
        setLayout(m.layout);
      } else if (m.t === 'material') {
        setMaterial({ id: m.id, pagina: m.pagina, regiao: m.regiao, preta: m.preta });
      } else if (m.t === 'rolar') {
        const f = folhaRef.current;
        if (f) f.scrollBy({ top: m.delta * f.clientHeight * 0.18, behavior: 'smooth' });
      } else if (m.t === 'recarregar') {
        location.reload();
      } else if (m.t === 'ping') {
        canal.enviar({
          t: 'pong',
          telaCheia: !!document.fullscreenElement,
          aspecto: window.innerWidth / Math.max(1, window.innerHeight),
          versao: __VERSAO__,
          materialCarregado: docIdRef.current,
        });
      }
    });
    enviarRef.current = canal.enviar;
    canal.enviar({ t: 'ola' });
    const aoMudarTela = () => setTelaCheia(!!document.fullscreenElement);
    const aoRedimensionar = () => setTela({ w: window.innerWidth, h: window.innerHeight });
    document.addEventListener('fullscreenchange', aoMudarTela);
    window.addEventListener('resize', aoRedimensionar);
    return () => {
      canal.fechar();
      document.removeEventListener('fullscreenchange', aoMudarTela);
      window.removeEventListener('resize', aoRedimensionar);
    };
  }, []);

  // Painel recém-montado: no quadro seguinte, tira a classe "fora" para ele deslizar.
  useEffect(() => {
    if (!entrando) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setEntrando(false)));
    return () => cancelAnimationFrame(r);
  }, [entrando]);

  // Abre o arquivo do material (lido do banco local deste navegador).
  useEffect(() => {
    let vivo = true;
    docIdRef.current = null;
    if (!material.id) {
      setDocumento(null);
      return;
    }
    const id = material.id;
    abrirDocumentoPorId(id)
      .then((d) => {
        if (!vivo) return;
        setDocumento(d);
        docIdRef.current = d ? id : null;
      })
      .catch(() => vivo && setDocumento(null));
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
    const t = window.setTimeout(informar, DURACAO_MS + 100);
    return () => {
      f.removeEventListener('scroll', informar);
      window.clearTimeout(t);
    };
  }, [item, escala, layout]);

  // Cursor aparece só quando o mouse se mexe nesta janela. A barra de tela cheia
  // aparece com o mouse perto da borda de baixo (ou em qualquer ponto, fora da tela cheia).
  useEffect(() => {
    let t = 0;
    let tb = 0;
    const mexeu = (ev: MouseEvent) => {
      setMostrarCursor(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMostrarCursor(false), 1500);
      const perto = ev.clientY > window.innerHeight - 160 || !document.fullscreenElement;
      if (perto) {
        setBarra(true);
        window.clearTimeout(tb);
        tb = window.setTimeout(() => setBarra(false), 2500);
      }
    };
    // Ao abrir, a barra fica visível alguns segundos.
    tb = window.setTimeout(() => setBarra(false), 5000);
    window.addEventListener('mousemove', mexeu);
    return () => {
      window.removeEventListener('mousemove', mexeu);
      window.clearTimeout(t);
      window.clearTimeout(tb);
    };
  }, []);

  const entrarTelaCheia = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else entrarTelaCheia();
  };

  // Tecla F (com o mouse sobre esta janela) liga e desliga a tela cheia.
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'f' || ev.key === 'F') alternarTelaCheia();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const comMaterial = !!material.id && !material.preta && !!documento;
  const lateral = !!item && comMaterial && layout === 'lateral';
  const painelDentro = !!item && !saindo && !entrando;

  // Slide ao lado do artigo: o slide inteiro encolhe e desliza para a esquerda
  // (sem redesenhar), cabendo nos 58% da esquerda.
  let transformSlide = 'none';
  if (lateral && painelDentro && tamPagina) {
    const larguraLivre = tela.w * (1 - FRACAO_PAINEL);
    const s = Math.min(1, (larguraLivre * 0.94) / tamPagina.largura, (tela.h * 0.94) / tamPagina.altura);
    const dx = larguraLivre / 2 - tela.w / 2;
    transformSlide = `translateX(${dx}px) scale(${s})`;
  }

  // Na lateral a letra diminui, mas não abaixo de um mínimo legível.
  const fonte = item ? (lateral ? Math.max(1.6, tamanhoBase(item) * 0.55) : tamanhoBase(item)) * escala : 0;

  return (
    <div
      className={`projecao${mostrarCursor ? ' com-cursor' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={alternarTelaCheia}
    >
      {comMaterial && (
        <div className={`proj-material${item && !lateral && painelDentro ? ' oculto' : ''}`}>
          <div className="proj-material-slide" style={{ transform: transformSlide }}>
            <CanvasMaterial documento={documento} pagina={material.pagina} regiao={material.regiao} onTamanho={setTamPagina} />
          </div>
        </div>
      )}
      {item && (
        <div
          className={`projecao-folha${lateral ? ' lateral' : ' cheia'}${painelDentro ? '' : ' fora'}`}
          ref={folhaRef}
        >
          <div className="projecao-faixa" />
          <Folha item={item} fontSize={`${fonte}vw`} />
        </div>
      )}
      {!item && <div ref={folhaRef} />}
      <div className={`proj-barra${barra ? ' visivel' : ''}`} onDoubleClick={(e) => e.stopPropagation()}>
        <button className="proj-barra-botao" onClick={alternarTelaCheia}>
          <IcTelaCheia tamanho={22} /> {telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
        <span className="proj-barra-dica">ou duplo clique na tela · tecla F</span>
      </div>
      {!telaCheia && !item && !comMaterial && (
        <div className="projecao-convite">
          <button className="caixa" onClick={entrarTelaCheia}>
            Esta é a janela de projeção.
            <strong>Clique aqui para tela cheia</strong>
            (ou duplo clique, tecla F ou F11). Depois, volte o mouse para a tela do notebook.
          </button>
        </div>
      )}
    </div>
  );
}
