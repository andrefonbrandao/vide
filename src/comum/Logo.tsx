// Logo "Feixe": o "v" como cone de projeção, com um ponto no vértice, seguido de "ide".
export function MarcaV({ tamanho = 28, invertido = false }: { tamanho?: number; invertido?: boolean }) {
  const traco = invertido ? '#EEF0EA' : '#1E3A34';
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,90 12,12 88,12" fill="#E8735A" fillOpacity={invertido ? 0.3 : 0.22} />
      <path d="M12 12 L50 90 L88 12" fill="none" stroke={traco} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="88" r="9" fill="#E8735A" />
    </svg>
  );
}

export function Logo({ altura = 32, invertido = false }: { altura?: number; invertido?: boolean }) {
  return (
    <span className="logo" role="img" aria-label="Vide" style={{ fontSize: altura, color: invertido ? '#EEF0EA' : '#1E3A34' }}>
      <MarcaV tamanho={altura * 0.6} invertido={invertido} />
      <span className="logo-ide">ide</span>
    </span>
  );
}
