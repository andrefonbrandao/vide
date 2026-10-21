// Leitura de arquivos: decodifica os bytes, abre HTML/MHTML e
// devolve o texto em linhas (um parágrafo do Planalto por linha),
// já sem o texto tachado (redação revogada).

/** Decodifica bytes: tenta UTF-8; se não for UTF-8 válido, usa Windows-1252 (padrão do Planalto). */
export function decodificar(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch {
    return new TextDecoder('windows-1252').decode(u8);
  }
}

/** Arquivo .mhtml (o Edge às vezes salva assim): extrai a parte HTML. */
export function extrairDeMhtml(bruto: string): string | null {
  if (!/^MIME-Version:|Content-Type:\s*multipart\/related/im.test(bruto.slice(0, 2000))) return null;
  const limite = /boundary="?([^";\r\n]+)"?/i.exec(bruto)?.[1];
  if (!limite) return null;
  const partes = bruto.split('--' + limite);
  for (const parte of partes) {
    const fimCab = parte.search(/\r?\n\r?\n/);
    if (fimCab < 0) continue;
    const cab = parte.slice(0, fimCab);
    if (!/Content-Type:\s*text\/html/i.test(cab)) continue;
    let corpo = parte.slice(fimCab).trim();
    const charset = /charset="?([\w-]+)"?/i.exec(cab)?.[1] ?? 'utf-8';
    let bytes: Uint8Array;
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(cab)) {
      corpo = corpo.replace(/=\r?\n/g, '');
      const arr: number[] = [];
      for (let i = 0; i < corpo.length; i++) {
        const c = corpo[i];
        if (c === '=' && /^[0-9A-F]{2}$/i.test(corpo.slice(i + 1, i + 3))) {
          arr.push(parseInt(corpo.slice(i + 1, i + 3), 16));
          i += 2;
        } else arr.push(corpo.charCodeAt(i) & 0xff);
      }
      bytes = new Uint8Array(arr);
    } else if (/Content-Transfer-Encoding:\s*base64/i.test(cab)) {
      const bin = atob(corpo.replace(/\s+/g, ''));
      bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    } else {
      bytes = Uint8Array.from(corpo, (ch) => ch.charCodeAt(0) & 0xff);
    }
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return decodificar(bytes);
    }
  }
  return null;
}

const BLOCOS = new Set([
  'P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'TD', 'TABLE',
  'BLOCKQUOTE', 'CENTER', 'UL', 'OL', 'PRE', 'SECTION', 'ARTICLE', 'HR',
]);

export interface ResultadoHtml {
  linhas: string[];
  /** Quantos trechos tachados foram descartados. */
  tachadosRemovidos: number;
}

/** Converte HTML em linhas, descartando o texto tachado. */
export function htmlParaLinhas(html: string): ResultadoHtml {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let tachadosRemovidos = 0;

  doc.querySelectorAll('strike, s, del').forEach((el) => {
    el.remove();
    tachadosRemovidos++;
  });
  doc.querySelectorAll('[style]').forEach((el) => {
    const estilo = el.getAttribute('style') ?? '';
    if (/line-through/i.test(estilo)) {
      el.remove();
      tachadosRemovidos++;
    }
  });
  doc.querySelectorAll('script, style, noscript, head').forEach((el) => el.remove());

  const QUEBRA = '\u0001';
  const pedacos: string[] = [];
  const percorrer = (no: Node) => {
    if (no.nodeType === 3) {
      // Quebras de linha dentro do código HTML são só espaços.
      pedacos.push((no.nodeValue ?? '').replace(/\s+/g, ' '));
      return;
    }
    if (no.nodeType !== 1) return;
    const el = no as Element;
    const bloco = BLOCOS.has(el.tagName.toUpperCase());
    if (bloco) pedacos.push(QUEBRA);
    for (const filho of Array.from(el.childNodes)) percorrer(filho);
    if (bloco) pedacos.push(QUEBRA);
  };
  percorrer(doc.body ?? doc.documentElement);

  return { linhas: textoParaLinhas(pedacos.join('').split(QUEBRA).join('\n')), tachadosRemovidos };
}

/** Limpa e separa um texto simples em linhas não vazias. */
const CP1252: Record<string, string> = {
  '\u0080': '€', '\u0085': '…', '\u0091': '‘', '\u0092': '’', '\u0093': '“',
  '\u0094': '”', '\u0095': '•', '\u0096': '–', '\u0097': '—', '\u009a': 'š',
};

export function textoParaLinhas(texto: string): string[] {
  // Entidades antigas como "&#150;" às vezes viram caracteres de controle.
  return texto
    .replace(/[\u0080-\u009f]/g, (c) => CP1252[c] ?? ' ')
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/[\s ​]+/g, ' ')
        .replace(/\s+([,.;:)])/g, '$1')
        .replace(/\(\s+/g, '(')
        .trim(),
    )
    .filter((l) => l.length > 0);
}

/** Ponto de entrada: recebe o arquivo e devolve as linhas. */
export function lerArquivo(nome: string, bytes: ArrayBuffer | Uint8Array): ResultadoHtml {
  const bruto = decodificar(bytes);
  const mhtml = extrairDeMhtml(bruto);
  if (mhtml) return htmlParaLinhas(mhtml);
  const pareceHtml = /\.(html?|xhtml)$/i.test(nome) || /<(html|body|p)[\s>]/i.test(bruto.slice(0, 5000));
  if (pareceHtml) return htmlParaLinhas(bruto);
  return { linhas: textoParaLinhas(bruto), tachadosRemovidos: 0 };
}
