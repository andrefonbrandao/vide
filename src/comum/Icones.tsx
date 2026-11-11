// Ícones de traço (desenhados aqui, sem depender de internet).
// Usam a cor do texto (currentColor), então seguem a cor do botão.
import type { ReactNode } from 'react';

function Svg({ children, tamanho = 20 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icone"
    >
      {children}
    </svg>
  );
}

type P = { tamanho?: number };

/** Microfone (iniciar escuta). */
export const IcMicrofone = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Svg>
);

/** Pausa. */
export const IcPausa = (p: P) => (
  <Svg {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Svg>
);

/** Sair (porta com seta). */
export const IcSair = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 16l-4-4 4-4" />
    <path d="M6 12h10" />
  </Svg>
);

/** Projetor / feixe (abrir projeção). */
export const IcProjecao = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8" />
    <path d="M12 16v4" />
  </Svg>
);

/** Tela cheia (cantos). */
export const IcTelaCheia = (p: P) => (
  <Svg {...p}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4" />
    <path d="M15 4h4a1 1 0 0 1 1 1v4" />
    <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
  </Svg>
);

/** Pin / tachinha (registrar momento). */
export const IcPin = (p: P) => (
  <Svg {...p}>
    <path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" />
    <path d="M12 13v8" />
  </Svg>
);

/** Nova sessão (folha nova com +). */
export const IcNovaSessao = (p: P) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 11v6" />
    <path d="M9 14h6" />
  </Svg>
);

/** Documento / material. */
export const IcDocumento = (p: P) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </Svg>
);

/** Página inteira (moldura). */
export const IcPaginaInteira = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8l-2-2M15 8l2-2M9 16l-2 2M15 16l2 2" />
  </Svg>
);

/** Ocultar (olho cortado). */
export const IcOcultar = (p: P) => (
  <Svg {...p}>
    <path d="M3 12s3.5-6 9-6c2 0 3.7.8 5 1.8M21 12s-3.5 6-9 6c-2 0-3.7-.8-5-1.8" />
    <path d="M4 4l16 16" />
  </Svg>
);

/** Mostrar (olho). */
export const IcMostrar = (p: P) => (
  <Svg {...p}>
    <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
    <circle cx="12" cy="12" r="2.5" />
  </Svg>
);

/** Visualização (duas colunas). */
export const IcVisualizacao = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M14 5v14" />
  </Svg>
);

/** Substituir (tela inteira com texto). */
export const IcSubstituir = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 9h10M7 12h10M7 15h6" />
  </Svg>
);

/** Mais (+). */
export const IcMais = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

/** Balança (legislação). */
export const IcLei = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v16M8 20h8" />
    <path d="M5 8h14" />
    <path d="M5 8l-2 6a3 3 0 0 0 4 0zM19 8l-2 6a3 3 0 0 0 4 0z" />
  </Svg>
);

/** Pasta (materiais). */
export const IcPasta = (p: P) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);

/** Frasco / teste. */
export const IcTeste = (p: P) => (
  <Svg {...p}>
    <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
    <path d="M7.5 15h9" />
  </Svg>
);

/** Seta para baixo (menus). */
export const IcSetaBaixo = (p: P) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

/** Celular. */
export const IcCelular = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18h2" />
  </Svg>
);

/** Recolher (seta para a direita saindo da tela). */
export const IcRecolher = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="14" height="14" rx="2" />
    <path d="M13 12h8M18 9l3 3-3 3" />
  </Svg>
);

/** Setas de página. */
export const IcAnterior = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const IcProxima = (p: P) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);

/** Perguntas (balão com interrogação). */
/** Pasta de autos com balança (processos fictícios). */
export const IcProcesso = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h10l4 4v12H4z" />
    <path d="M14 4v4h4" />
    <path d="M11 11v6M8 12h6M8 12l-1.5 3h3zM14 12l-1.5 3h3z" />
  </Svg>
);

/** Pessoa com balão de fala (casos do jogo "Consulta"). */
export const IcCasos = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="9" r="3" />
    <path d="M2 20c0-3 2.2-5 5-5s5 2 5 5" />
    <path d="M13 4h8v6h-4l-3 2.5V10h-1z" />
  </Svg>
);

export const IcPerguntas = (p: P) => (
  <Svg {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M10 9a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.5" />
    <path d="M12 14.5v.01" />
  </Svg>
);

export const IcInicio = (p: P) => (
  <Svg {...p}>
    <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
  </Svg>
);

export const IcLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);

export const IcResultados = (p: P) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </Svg>
);

export const IcRegistro = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h12v18H6z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Svg>
);

export const IcAjustes = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </Svg>
);

export const IcBusca = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
);

export const IcSeta = (p: P) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IcQr = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
  </Svg>
);

export const IcPlay = (p: P) => (
  <Svg {...p}>
    <path d="M7 4v16l13-8z" />
  </Svg>
);
