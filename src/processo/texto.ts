// Texto das peças: marcações simples, fáceis de digitar e de colar.
//   # TÍTULO          ## Subtítulo
//   > citação recuada (lei, jurisprudência)
//   - item de lista
//   **negrito** e _itálico_ dentro do texto
// Linha em branco separa parágrafos.

export type Trecho = { t: string; negrito?: boolean; italico?: boolean };
export type Bloco =
  | { tipo: 'titulo' | 'subtitulo' | 'paragrafo' | 'citacao'; trechos: Trecho[] }
  | { tipo: 'lista'; itens: Trecho[][] };

/** "**a** e _b_" -> trechos com negrito e itálico. */
export function lerTrechos(s: string): Trecho[] {
  const saida: Trecho[] = [];
  const re = /\*\*([^*]+)\*\*|(?<![\p{L}\d])_([^_]+)_(?![\p{L}\d])/gu;
  let ultimo = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > ultimo) saida.push({ t: s.slice(ultimo, m.index) });
    if (m[1] !== undefined) saida.push({ t: m[1], negrito: true });
    else saida.push({ t: m[2], italico: true });
    ultimo = m.index! + m[0].length;
  }
  if (ultimo < s.length) saida.push({ t: s.slice(ultimo) });
  return saida;
}

export function lerTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  let citacao: string[] = [];
  let lista: string[] = [];
  const fechar = () => {
    if (paragrafo.length) blocos.push({ tipo: 'paragrafo', trechos: lerTrechos(paragrafo.join(' ')) });
    if (citacao.length) blocos.push({ tipo: 'citacao', trechos: lerTrechos(citacao.join(' ')) });
    if (lista.length) blocos.push({ tipo: 'lista', itens: lista.map(lerTrechos) });
    paragrafo = [];
    citacao = [];
    lista = [];
  };
  for (const bruta of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const l = bruta.trim();
    if (!l) {
      fechar();
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^##\s+(.*)$/.exec(l))) {
      fechar();
      blocos.push({ tipo: 'subtitulo', trechos: lerTrechos(m[1]) });
    } else if ((m = /^#\s+(.*)$/.exec(l))) {
      fechar();
      blocos.push({ tipo: 'titulo', trechos: lerTrechos(m[1]) });
    } else if ((m = /^>\s?(.*)$/.exec(l))) {
      if (paragrafo.length || lista.length) fechar();
      citacao.push(m[1]);
    } else if ((m = /^[-•]\s+(.*)$/.exec(l))) {
      if (paragrafo.length || citacao.length) fechar();
      lista.push(m[1]);
    } else {
      if (citacao.length || lista.length) fechar();
      paragrafo.push(l);
    }
  }
  fechar();
  return blocos;
}
