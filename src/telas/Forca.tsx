// Peças visuais da forca: o desenho, a palavra com os tracinhos e o teclado.
// Usadas no projetor, no celular do aluno e no treino em casa.
import { TECLADO_FORCA } from '../jogo/forca';

/** O desenho: a forca e as partes do boneco, uma a cada erro (até 6). */
export function DesenhoForca({ erros, className }: { erros: number; className?: string }) {
  const partes = [
    <circle key="cabeca" cx="70" cy="34" r="10" />,
    <line key="corpo" x1="70" y1="44" x2="70" y2="76" />,
    <line key="braco-e" x1="70" y1="52" x2="56" y2="64" />,
    <line key="braco-d" x1="70" y1="52" x2="84" y2="64" />,
    <line key="perna-e" x1="70" y1="76" x2="58" y2="96" />,
    <line key="perna-d" x1="70" y1="76" x2="82" y2="96" />,
  ];
  return (
    <svg viewBox="0 0 100 112" className={`forca-desenho${className ? ` ${className}` : ''}`} role="img" aria-label={`${erros} de 6 erros`}>
      <g className="forca-estrutura">
        <line x1="8" y1="106" x2="52" y2="106" />
        <line x1="22" y1="106" x2="22" y2="6" />
        <line x1="22" y1="6" x2="70" y2="6" />
        <line x1="70" y1="6" x2="70" y2="24" />
        <line x1="22" y1="22" x2="38" y2="6" />
      </g>
      <g className="forca-boneco">{partes.slice(0, Math.max(0, Math.min(6, erros)))}</g>
    </svg>
  );
}

/**
 * A palavra: tracinhos no lugar das letras escondidas. Com "palavra" (no fim da rodada),
 * as letras que ninguém descobriu aparecem destacadas.
 */
export function PalavraForca({ mascara, revelada, className }: { mascara: (string | null)[]; revelada?: string; className?: string }) {
  const completa = revelada ? [...revelada.trim()] : null;
  // Quebra em palavras para não cortar uma palavra no meio da linha.
  const grupos: { ch: string | null; i: number }[][] = [[]];
  mascara.forEach((ch, i) => {
    if (ch === ' ') grupos.push([]);
    else grupos[grupos.length - 1].push({ ch, i });
  });
  return (
    <div className={`forca-palavra${className ? ` ${className}` : ''}`} aria-label={mascara.map((c) => c ?? '_').join('')}>
      {grupos
        .filter((g) => g.length)
        .map((g, k) => (
          <span key={k} className="forca-grupo">
            {g.map(({ ch, i }) => {
              const sinal = ch !== null && !/\p{L}/u.test(ch);
              const faltou = completa && ch === null;
              return (
                <span key={i} className={`forca-casa${sinal ? ' sinal' : ''}${faltou ? ' faltou' : ''}`}>
                  {ch ?? (completa ? completa[i] : '')}
                </span>
              );
            })}
          </span>
        ))}
    </div>
  );
}

/** Teclado de letras: as já jogadas ficam apagadas (certas em verde, erradas riscadas). */
export function TecladoForca({
  usadas,
  erradas,
  escolhida,
  desativado,
  aoEscolher,
}: {
  usadas: string[];
  erradas: string[];
  escolhida?: string | null;
  desativado?: boolean;
  aoEscolher: (letra: string) => void;
}) {
  return (
    <div className="forca-teclado" role="group" aria-label="Letras">
      {TECLADO_FORCA.map((l) => {
        const usada = usadas.includes(l);
        const errada = erradas.includes(l);
        return (
          <button
            key={l}
            type="button"
            className={`forca-tecla${usada ? (errada ? ' errada' : ' certa') : ''}${escolhida === l ? ' escolhida' : ''}`}
            disabled={desativado || usada}
            aria-pressed={escolhida === l}
            onClick={() => aoEscolher(l)}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
