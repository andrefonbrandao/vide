// Logotipo do Vide (ver marca/LEIA-ME.md): o símbolo "v" em forma de feixe
// (public/vide-simbolo.svg) seguido do texto "ide" em Manrope ExtraBold,
// montado em HTML/CSS — o texto não é imagem.
export function Logo({ altura = 32, soSimbolo = false }: { altura?: number; soSimbolo?: boolean }) {
  return (
    <span className="logo" role="img" aria-label="Vide" style={{ fontSize: altura }}>
      <img className="logo-simbolo" src="/vide-simbolo.svg" alt="" aria-hidden="true" />
      {!soSimbolo && (
        <span className="logo-ide" aria-hidden="true">
          ide
        </span>
      )}
    </span>
  );
}
