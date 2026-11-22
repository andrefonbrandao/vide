// Lê um arquivo do Word (.docx) e o transforma numa sequência de partes: títulos (pelos estilos
// do Word, ou linhas curtas em negrito), parágrafos com negrito/itálico e notas de rodapé,
// citações longas (pelo recuo), tabelas, imagens, legendas ("Tabela 1 – …") e fontes ("Fonte: …").
// Sem bibliotecas: o .docx é um ZIP de arquivos XML.

// ---------- ZIP ----------
export async function abrirZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('O arquivo não parece ser um documento do Word (.docx).');
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let k = 0; k < total; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const tamC = v.getUint32(p + 20, true);
    const nLen = v.getUint16(p + 28, true);
    const xLen = v.getUint16(p + 30, true);
    const cLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = dec.decode(bytes.subarray(p + 46, p + 46 + nLen));
    p += 46 + nLen + xLen + cLen;
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const dados = bytes.subarray(ini, ini + tamC);
    if (metodo === 0) out.set(nome, dados);
    else if (metodo === 8) out.set(nome, await inflar(dados));
  }
  return out;
}

async function inflar(d: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([d as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// ---------- XML (o bastante para o Word) ----------
export interface No {
  n: string;
  a: Record<string, string>;
  c: (No | string)[];
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desfazer = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] ?? m)));

export function lerXml(xml: string): No {
  const raiz: No = { n: '#', a: {}, c: [] };
  const pilha = [raiz];
  const re = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const topo = pilha[pilha.length - 1];
    if (m[1] !== undefined) topo.c.push(m[1]);
    else if (m[3]) {
      if (m[2] === '/') {
        if (pilha.length > 1) pilha.pop();
        continue;
      }
      const a: Record<string, string> = {};
      for (const at of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[at[1]] = desfazer(at[2] ?? at[3] ?? '');
      const no: No = { n: m[3], a, c: [] };
      topo.c.push(no);
      if (!m[5]) pilha.push(no);
    } else if (m[6] !== undefined) topo.c.push(desfazer(m[6]));
  }
  return raiz;
}

const nos = (x: No) => x.c.filter((c): c is No => typeof c !== 'string');
const filho = (x: No | undefined, n: string) => (x ? nos(x).find((c) => c.n === n) : undefined);
function todos(x: No, n: string, out: No[] = []): No[] {
  for (const c of nos(x)) {
    if (c.n === n) out.push(c);
    todos(c, n, out);
  }
  return out;
}
const ligado = (x: No | undefined) => !!x && !['0', 'false', 'off'].includes(x.a['w:val'] ?? '');

// ---------- Estilos ----------
interface Estilo {
  nome: string;
  base?: string;
  nivel?: number;
  negrito?: boolean;
  recuo?: number;
}

function lerEstilos(xml: string | undefined): Map<string, Estilo> {
  const out = new Map<string, Estilo>();
  if (!xml) return out;
  for (const s of todos(lerXml(xml), 'w:style')) {
    const id = s.a['w:styleId'];
    if (!id) continue;
    const ppr = filho(s, 'w:pPr');
    const ol = filho(ppr, 'w:outlineLvl')?.a['w:val'];
    const ind = filho(ppr, 'w:ind');
    out.set(id, {
      nome: (filho(s, 'w:name')?.a['w:val'] ?? id).toLowerCase(),
      base: filho(s, 'w:basedOn')?.a['w:val'],
      nivel: ol !== undefined && Number(ol) < 9 ? Number(ol) + 1 : undefined,
      negrito: ligado(filho(filho(s, 'w:rPr'), 'w:b')) || undefined,
      recuo: ind ? Number(ind.a['w:left'] ?? ind.a['w:start'] ?? 0) || undefined : undefined,
    });
  }
  return out;
}

/** Nível de título de um estilo (1 a 3), pelo nome ("Título 1", "heading 2"…) ou pelo nível de tópico. */
function nivelDoEstilo(estilos: Map<string, Estilo>, id: string | undefined): number | undefined {
  for (let k = 0, x = id; x && k < 6; k++) {
    const e = estilos.get(x);
    if (!e) break;
    if (/^(toc|sum[áa]rio|[íi]ndice)/.test(e.nome)) return undefined;
    const m = /^(heading|t[íi]tulo|ttulo)\s*(\d)$/.exec(e.nome);
    if (m) return Number(m[2]);
    if (e.nivel) return e.nivel;
    x = e.base;
  }
  return undefined;
}
function propDoEstilo<K extends keyof Estilo>(estilos: Map<string, Estilo>, id: string | undefined, k: K): Estilo[K] | undefined {
  for (let n = 0, x = id; x && n < 6; n++) {
    const e = estilos.get(x);
    if (!e) break;
    if (e[k] !== undefined) return e[k];
    x = e.base;
  }
  return undefined;
}
const nomeDoEstilo = (estilos: Map<string, Estilo>, id: string | undefined) => (id ? (estilos.get(id)?.nome ?? '') : '');

// ---------- Partes do documento ----------
export type Elemento =
  | { k: 'h'; nivel: number; texto: string; deEstilo: boolean }
  | { k: 'p'; md: string; cit: boolean; notas: number }
  | { k: 'tab'; linhas: string[][] }
  | { k: 'img'; rid: string }
  | { k: 'leg'; tipo: 'tabela' | 'quadro' | 'figura' | 'grafico'; titulo: string }
  | { k: 'fonte'; texto: string };

export interface Docx {
  elementos: Elemento[];
  /** rId da imagem → arquivo (bytes e extensão). */
  imagens: Map<string, { bytes: Uint8Array; ext: string }>;
  /** Se algum título veio de um estilo do Word (Título 1, 2…). */
  temEstilos: boolean;
}

type Seg = { t: string; b: boolean; i: boolean };

/** Junta pedaços com formatação em texto com marcações (**negrito**, _itálico_). */
export function segParaMd(segs: Seg[]): string {
  const juntos: Seg[] = [];
  for (const s of segs) {
    const u = juntos[juntos.length - 1];
    if (u && u.b === s.b && u.i === s.i) u.t += s.t;
    else juntos.push({ ...s });
  }
  return juntos
    .map((s) => {
      if (!s.t.trim() || (!s.b && !s.i)) return s.t;
      const lead = /^\s*/.exec(s.t)![0];
      const trail = /\s*$/.exec(s.t)![0];
      let x = s.t.trim();
      if (s.i) x = `_${x}_`;
      if (s.b) x = `**${x}**`;
      return lead + x + trail;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export const tirarNumero = (t: string) => t.replace(/^\s*(cap[íi]tulo\s+)?\d+(\.\d+)*\.?\s*[–—-]?\s*/i, '').trim();

const RE_LEGENDA = /^(tabela|quadro|figura|gr[áa]fico|ilustra[çc][ãa]o)\s*\d*\s*[–—:.-]?\s*/i;

export async function lerDocx(arquivo: Uint8Array): Promise<Docx> {
  const zip = await abrirZip(arquivo);
  const texto = (n: string) => (zip.has(n) ? new TextDecoder().decode(zip.get(n)) : undefined);
  const doc = texto('word/document.xml');
  if (!doc) throw new Error('O arquivo não parece ser um documento do Word (.docx).');
  const estilos = lerEstilos(texto('word/styles.xml'));
  // Imagens: rId → arquivo em word/media.
  const imagens = new Map<string, { bytes: Uint8Array; ext: string }>();
  const rels = texto('word/_rels/document.xml.rels');
  if (rels)
    for (const r of todos(lerXml(rels), 'Relationship')) {
      if (!/image$/.test(r.a.Type ?? '')) continue;
      const alvo = (r.a.Target ?? '').replace(/^\.?\//, '');
      const caminho = alvo.startsWith('word/') ? alvo : `word/${alvo}`;
      const b = zip.get(caminho);
      if (b) imagens.set(r.a.Id, { bytes: b, ext: (alvo.split('.').pop() ?? '').toLowerCase() });
    }
  // Notas de rodapé: id → texto com marcações.
  const notas = new Map<string, string>();
  const fn = texto('word/footnotes.xml');
  if (fn)
    for (const f of todos(lerXml(fn), 'w:footnote')) {
      if (f.a['w:type'] && f.a['w:type'] !== 'normal') continue;
      const t = todos(f, 'w:p')
        .map((p) => segParaMd(segmentos(p, estilos, new Map(), []).segs))
        .filter(Boolean)
        .join(' ')
        .trim();
      notas.set(f.a['w:id'], t);
    }

  const elementos: Elemento[] = [];
  let temEstilos = false;
  const corpo = filho(filho(lerXml(doc), 'w:document'), 'w:body');
  const percorrer = (x: No) => {
    for (const c of nos(x)) {
      if (c.n === 'w:p') paragrafo(c);
      else if (c.n === 'w:tbl') tabela(c);
      else if (c.n === 'w:sdt') percorrer(filho(c, 'w:sdtContent') ?? c);
      else if (c.n === 'w:customXml') percorrer(c);
    }
  };
  const tabela = (t: No) => {
    const linhas = nos(t)
      .filter((r) => r.n === 'w:tr')
      .map((r) =>
        nos(r)
          .filter((c) => c.n === 'w:tc')
          .flatMap((c) => {
            const texto = todos(c, 'w:p')
              .map((p) => segParaMd(segmentos(p, estilos, notas, []).segs.map((s) => ({ ...s, b: false, i: false }))))
              .filter(Boolean)
              .join(' ');
            // Célula mesclada (ocupa várias colunas): o texto fica na primeira, as outras vazias.
            const span = Math.max(1, Number(filho(filho(c, 'w:tcPr'), 'w:gridSpan')?.a['w:val'] ?? 1) || 1);
            return [texto, ...Array.from({ length: span - 1 }, () => '')];
          }),
      )
      .filter((l) => l.some((x) => x.trim()));
    if (linhas.length) elementos.push({ k: 'tab', linhas });
  };
  const paragrafo = (p: No) => {
    const ppr = filho(p, 'w:pPr');
    const estilo = filho(ppr, 'w:pStyle')?.a['w:val'];
    const nomeEst = nomeDoEstilo(estilos, estilo);
    if (/^(toc|sum[áa]rio|[íi]ndice)/.test(nomeEst)) return; // linhas do sumário
    const rids: string[] = [];
    const { segs, notas: nNotas } = segmentos(p, estilos, notas, rids, propDoEstilo(estilos, estilo, 'negrito'));
    for (const rid of rids) elementos.push({ k: 'img', rid });
    const md = segParaMd(segs);
    const puro = md.replace(/\*\*|_|\[\[[^\]]*\]\]/g, '').trim();
    if (!puro) return;
    // Título: pelo estilo do Word (ou nível de tópico do parágrafo)…
    const olp = filho(ppr, 'w:outlineLvl')?.a['w:val'];
    let nivel = nivelDoEstilo(estilos, estilo) ?? (olp !== undefined && Number(olp) < 9 ? Number(olp) + 1 : undefined);
    if (nivel) temEstilos = true;
    // …ou uma linha curta, toda em negrito, numerada ("2.1 Objetivos") ou em maiúsculas ("INTRODUÇÃO").
    const todoNegrito = segs.filter((s) => s.t.trim()).every((s) => s.b);
    if (!nivel && todoNegrito && puro.length <= 120 && !/[.;:,]$/.test(puro) && nNotas === 0) {
      const num = /^(\d+(?:\.\d+)*)\.?\s+\S/.exec(puro);
      const letras = puro.replace(/[^\p{L}]/gu, '');
      if (num) nivel = Math.min(3, num[1].split('.').length);
      else if (letras.length >= 3 && letras === letras.toUpperCase()) nivel = 1;
    }
    if (nivel) {
      elementos.push({ k: 'h', nivel: Math.min(nivel, 3), texto: tirarNumero(puro), deEstilo: !!nivelDoEstilo(estilos, estilo) || olp !== undefined });
      return;
    }
    if (/caption|legenda/.test(nomeEst) || (RE_LEGENDA.test(puro) && puro.length <= 200 && /^(tabela|quadro|figura|gr[áa]fico|ilustra)\S*\s*\d/i.test(puro))) {
      const tipoTxt = puro.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const tipo = tipoTxt.startsWith('quadro') ? 'quadro' : tipoTxt.startsWith('grafico') ? 'grafico' : tipoTxt.startsWith('figura') || tipoTxt.startsWith('ilustra') ? 'figura' : 'tabela';
      elementos.push({ k: 'leg', tipo, titulo: puro.replace(RE_LEGENDA, '').trim() });
      return;
    }
    if (/^fonte\s*:/i.test(puro)) {
      elementos.push({ k: 'fonte', texto: puro.replace(/^fonte\s*:\s*/i, '') });
      return;
    }
    const ind = filho(ppr, 'w:ind');
    const recuo = ind ? Number(ind.a['w:left'] ?? ind.a['w:start'] ?? 0) : (propDoEstilo(estilos, estilo, 'recuo') ?? 0);
    const cit = /quote|cita/.test(nomeEst) || recuo >= 1700;
    elementos.push({ k: 'p', md, cit, notas: nNotas });
  };
  if (corpo) percorrer(corpo);
  return { elementos, imagens, temEstilos };
}

/** Os pedaços de texto de um parágrafo (com negrito/itálico), as notas e as imagens. */
function segmentos(p: No, estilos: Map<string, Estilo>, notas: Map<string, string>, rids: string[], negritoEstilo = false): { segs: Seg[]; notas: number } {
  const segs: Seg[] = [];
  let n = 0;
  const run = (r: No) => {
    const rpr = filho(r, 'w:rPr');
    const est = filho(rpr, 'w:rStyle')?.a['w:val'];
    const bTag = filho(rpr, 'w:b');
    const b = bTag ? ligado(bTag) : negritoEstilo || !!propDoEstilo(estilos, est, 'negrito');
    const i = ligado(filho(rpr, 'w:i'));
    if (nos(r).some((c) => c.n === 'w:instrText')) return; // código de campo do Word
    for (const c of nos(r)) {
      if (c.n === 'w:t') segs.push({ t: c.c.filter((x): x is string => typeof x === 'string').join(''), b, i });
      else if (c.n === 'w:tab') segs.push({ t: ' ', b, i });
      else if (c.n === 'w:br' && c.a['w:type'] !== 'page') segs.push({ t: ' ', b, i });
      else if (c.n === 'w:footnoteReference') {
        const t = notas.get(c.a['w:id']);
        if (t) {
          segs.push({ t: `[[${t}]]`, b: false, i: false });
          n++;
        }
      } else if (c.n === 'w:drawing' || c.n === 'w:pict' || c.n === 'mc:AlternateContent') {
        const blip = todos(c, 'a:blip')[0]?.a['r:embed'] ?? todos(c, 'v:imagedata')[0]?.a['r:id'];
        if (blip && !rids.includes(blip)) rids.push(blip);
      }
    }
  };
  const andar = (x: No) => {
    for (const c of nos(x)) {
      if (c.n === 'w:r') run(c);
      else if (c.n === 'w:del' || c.n === 'w:pPr') continue;
      else if (['w:hyperlink', 'w:ins', 'w:smartTag', 'w:sdt', 'w:sdtContent', 'w:fldSimple', 'w:customXml', 'w:moveTo'].includes(c.n)) andar(c);
    }
  };
  andar(p);
  return { segs, notas: n };
}
