// Comandos de voz de controle. Só valem quando há algo projetado.
import { semAcentos } from './normalizar';

export type Comando = 'recolher' | 'aumentar' | 'diminuir';

const PADROES: [Comando, RegExp][] = [
  ['recolher', /\b(tira|tire|tirar|tirem|retira|retire)( isso| isto| o texto)? da tela\b/],
  ['recolher', /\bpode fechar\b/],
  ['aumentar', /\b(aumenta|aumente|aumentar|amplia|amplie) (a |essa |esta )?(fonte|letra)\b/],
  ['diminuir', /\b(diminui|diminua|diminuir|reduz|reduza) (a |essa |esta )?(fonte|letra)\b/],
];

/** Devolve os comandos presentes no texto, na ordem em que aparecem. */
export function detectarComandos(texto: string): Comando[] {
  const t = semAcentos(texto.toLowerCase()).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
  const achados: { c: Comando; pos: number }[] = [];
  for (const [c, re] of PADROES) {
    const m = re.exec(t);
    if (m) achados.push({ c, pos: m.index });
  }
  return achados.sort((a, b) => a.pos - b.pos).map((a) => a.c);
}
