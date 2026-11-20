// Círculo vermelho ao lado de "Orientandos" quando há pendência com prazo vencido.
import { useEffect, useState } from 'react';
import { contarVencidas } from '../orientacao/alertas';

/** Quantas pendências de orientação venceram sem baixa (atualiza com as mudanças e ao virar o dia). */
export function useVencidas(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    const contar = () => void contarVencidas().then((x) => vivo && setN(x)).catch(() => undefined);
    contar();
    window.addEventListener('vide-orientacao-mudou', contar);
    window.addEventListener('focus', contar);
    const t = window.setInterval(contar, 30 * 60_000);
    return () => {
      vivo = false;
      window.removeEventListener('vide-orientacao-mudou', contar);
      window.removeEventListener('focus', contar);
      window.clearInterval(t);
    };
  }, []);
  return n;
}

export function SinalVencidas({ n, ponto = false }: { n: number; ponto?: boolean }) {
  if (!n) return null;
  const titulo = `${n} ${n === 1 ? 'pendência de orientação venceu' : 'pendências de orientação venceram'} sem baixa`;
  return (
    <span className={`sinal-vencidas${ponto ? ' ponto' : ''}`} title={titulo} aria-label={titulo} role="status">
      {ponto ? '' : n > 99 ? '99+' : n}
    </span>
  );
}
