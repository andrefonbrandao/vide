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
