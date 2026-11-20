// Imagens das figuras e gráficos do trabalho final: medidas (lidas do próprio arquivo),
// redução no navegador antes de enviar, e busca das imagens antes de montar o PDF/Word.

export interface Imagem {
  bytes: Uint8Array;
  tipo: 'png' | 'jpeg';
  largura: number;
  altura: number;
}

/** Lê o tipo e as medidas de um PNG ou JPEG (sem decodificar a imagem). */
export function lerImagem(bytes: Uint8Array): Imagem | null {
  const b = bytes;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { bytes, tipo: 'png', largura: v.getUint32(16), altura: v.getUint32(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      const tam = (b[i + 2] << 8) | b[i + 3];
      // SOF0..SOF15 (menos DHT, JPG e DAC) trazem altura e largura.
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { bytes, tipo: 'jpeg', altura: (b[i + 5] << 8) | b[i + 6], largura: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + tam;
    }
  }
  return null;
}

export const MAX_IMAGEM = 900 * 1024;

/** Reduz a imagem (no máximo 1600 px no lado maior). Gráficos em PNG ficam em PNG (mais nítidos) se couberem. */
export async function reduzirImagem(arquivo: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * escala));
  const h = Math.max(1, Math.round(bmp.height * escala));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const comoBlob = (tipo: string, q?: number) => new Promise<Blob>((ok, falha) => c.toBlob((x) => (x ? ok(x) : falha(new Error('Não foi possível ler a imagem.'))), tipo, q));
  if (arquivo.type === 'image/png') {
    ctx.drawImage(bmp, 0, 0, w, h);
    const png = await comoBlob('image/png');
    if (png.size <= 500 * 1024) return png;
  }
  // JPEG não tem transparência: fundo branco.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  for (const q of [0.85, 0.75, 0.6]) {
    const jpg = await comoBlob('image/jpeg', q);
    if (jpg.size <= MAX_IMAGEM || q === 0.6) return jpg;
  }
  throw new Error('Imagem grande demais.');
}

/** Busca as imagens (as que falharem ficam de fora: no PDF aparece um aviso no lugar). */
export async function buscarImagens(ids: string[], buscar: (id: string) => Promise<Uint8Array | undefined>): Promise<Map<string, Imagem>> {
  const out = new Map<string, Imagem>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const b = await buscar(id);
        const img = b && lerImagem(b);
        if (img) out.set(id, img);
      } catch {
        /* fica sem */
      }
    }),
  );
  return out;
}

const cache = new Map<string, Promise<Uint8Array | undefined>>();
/** Busca uma imagem da página do orientando (com o código do orientando ou a chave do professor). Fica guardada na memória. */
export function imagemDaPagina(codigo: string, id: string, cabecalho: Record<string, string>): Promise<Uint8Array | undefined> {
  const k = `${codigo}/${id}`;
  let p = cache.get(k);
  if (!p) {
    p = fetch(`/api/orientacao/${codigo}/imagem/${id}`, { headers: cabecalho }).then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined));
    p.then((x) => !x && cache.delete(k)).catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}

/** Guarda na memória uma imagem que acabou de ser enviada (para não baixar de novo). */
export function lembrarImagem(codigo: string, id: string, bytes: Uint8Array): void {
  cache.set(`${codigo}/${id}`, Promise.resolve(bytes));
}
