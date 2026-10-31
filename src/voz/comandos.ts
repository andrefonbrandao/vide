// Comandos de voz de controle. "Recolher" só vale com algo projetado; a fonte vale sempre.
import { semAcentos } from './normalizar';

export type Comando = 'recolher' | 'aumentar' | 'diminuir';

const PADROES: [Comando, RegExp][] = [
  ['recolher', /\b(tira|tire|tirar|tirem|retira|retire)( isso| isto| o texto)? da tela\b/],
  ['recolher', /\bpode fechar\b/],
  ['aumentar', /\b(aumenta|aumente|aumentar|aumento|amplia|amplie|ampliar) (o tamanho d[aoe] |o tamanho |a |essa |esta |o )?(fonte|letra|texto)\b/],
  ['aumentar', /\b(fonte|letra) maior\b/],
  ['diminuir', /\b(diminui|diminua|diminuir|reduz|reduza|reduzir) (o tamanho d[aoe] |o tamanho |a |essa |esta |o )?(fonte|letra|texto)\b/],
  ['diminuir', /\b(fonte|letra) menor\b/],
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
