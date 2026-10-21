// Leitura e desenho do material (PDF ou imagem) num <canvas>.
// O PDF é desenhado pelo pdf.js, carregado só quando é usado (o app abre mais rápido).
import { db } from '../dados/db';
import type { Material } from '../dados/modelo';
import { agoraISO, novoId } from '../dados/modelo';
import { encaixar, type Regiao } from './regiao';

export interface Documento {
  paginas: number;
  /** Tamanho da página (em pontos, para PDF; em pixels, para imagem). */
  tamanho(pagina: number): Promise<{ w: number; h: number }>;
  /**
   * Desenha a região da página no canvas, do maior tamanho que caiba em
   * `maxW × maxH` (pixels de tela). Devolve o tamanho usado.
   */
  desenhar(canvas: HTMLCanvasElement, pagina: number, regiao: Regiao, maxW: number, maxH: number): Promise<{ largura: number; altura: number }>;
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromessa: Promise<PdfJs> | null = null;

async function carregarPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromessa) {
    pdfjsPromessa = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromessa;
}

async function abrirPdf(arquivo: Blob): Promise<Documento> {
  const pdfjs = await carregarPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const tarefas = new WeakMap<HTMLCanvasElement, { cancel(): void }>();
  return {
    paginas: doc.numPages,
    async tamanho(p) {
      const vp = (await doc.getPage(p)).getViewport({ scale: 1 });
      return { w: vp.width, h: vp.height };
    },
    async desenhar(canvas, p, r, maxW, maxH) {
      const page = await doc.getPage(Math.min(doc.numPages, Math.max(1, p)));
      const base = page.getViewport({ scale: 1 });
      const { escala, largura, altura } = encaixar(maxW, maxH, base.width, base.height, r);
      const dpr = window.devicePixelRatio || 1;
      tarefas.get(canvas)?.cancel();
      canvas.width = Math.max(1, Math.round(largura * dpr));
      canvas.height = Math.max(1, Math.round(altura * dpr));
      canvas.style.width = `${largura}px`;
      canvas.style.height = `${altura}px`;
      const viewport = page.getViewport({ scale: escala * dpr });
      // Desloca para que o canto da região fique na origem do canvas.
      const transform = [1, 0, 0, 1, -r.x * base.width * escala * dpr, -r.y * base.height * escala * dpr];
      const tarefa = page.render({ canvas, viewport, transform });
      tarefas.set(canvas, tarefa);
      try {
        await tarefa.promise;
      } catch (e) {
        if ((e as Error)?.name !== 'RenderingCancelledException') throw e;
      }
      return { largura, altura };
    },
  };
}

async function abrirImagem(arquivo: Blob): Promise<Documento> {
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.src = url;
  await img.decode();
  return {
    paginas: 1,
    async tamanho() {
      return { w: img.naturalWidth, h: img.naturalHeight };
    },
    async desenhar(canvas, _p, r, maxW, maxH) {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const { largura, altura } = encaixar(maxW, maxH, W, H, r);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(largura * dpr));
      canvas.height = Math.max(1, Math.round(altura * dpr));
      canvas.style.width = `${largura}px`;
      canvas.style.height = `${altura}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, r.x * W, r.y * H, r.w * W, r.h * H, 0, 0, canvas.width, canvas.height);
      return { largura, altura };
    },
  };
}

const abertos = new Map<string, Promise<Documento>>();

/** Abre (e guarda em memória) o documento de um material. */
export function abrirDocumento(m: Pick<Material, 'id' | 'tipo' | 'arquivo'>): Promise<Documento> {
  let p = abertos.get(m.id);
  if (!p) {
    p = m.tipo === 'pdf' ? abrirPdf(m.arquivo) : abrirImagem(m.arquivo);
    p.catch(() => abertos.delete(m.id));
    abertos.set(m.id, p);
  }
  return p;
}

/** Abre pelo id, lendo do banco local (usado pela janela de projeção). */
export async function abrirDocumentoPorId(id: string): Promise<Documento | null> {
  const m = await db.materiais.get(id);
  if (!m || m.excluido_em) return null;
  return abrirDocumento(m);
}

export function tipoDoArquivo(arquivo: File): Material['tipo'] | null {
  if (arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)) return 'pdf';
  if (/^image\/(png|jpeg|webp|gif)$/.test(arquivo.type) || /\.(png|jpe?g|webp|gif)$/i.test(arquivo.name)) return 'imagem';
  return null;
}

/** Guarda um PDF ou imagem no acervo de materiais. */
export async function importarMaterial(arquivo: File): Promise<Material> {
  const tipo = tipoDoArquivo(arquivo);
  if (!tipo) throw new Error('Formato não aceito. Use PDF, PNG, JPG ou WebP.');
  const id = novoId();
  const doc = await abrirDocumento({ id, tipo, arquivo });
  const agora = agoraISO();
  const material: Material = {
    id,
    usuario_id: null,
    criado_em: agora,
    atualizado_em: agora,
    excluido_em: null,
    nome: arquivo.name.replace(/\.[^.]+$/, ''),
    tipo,
    mime: arquivo.type || (tipo === 'pdf' ? 'application/pdf' : 'image/*'),
    tamanho: arquivo.size,
    paginas: doc.paginas,
    arquivo,
  };
  await db.materiais.add(material);
  window.dispatchEvent(new Event('vide-materiais-mudou'));
  return material;
}

export async function listarMateriais(): Promise<Material[]> {
  const todos = await db.materiais.toArray();
  return todos.filter((m) => !m.excluido_em).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

/** Exclusão "suave" (para a sincronização futura) e libera o espaço do arquivo. */
export async function excluirMaterial(id: string): Promise<void> {
  const m = await db.materiais.get(id);
  if (!m) return;
  const agora = agoraISO();
  await db.materiais.put({ ...m, arquivo: new Blob([]), excluido_em: agora, atualizado_em: agora });
  abertos.delete(id);
  window.dispatchEvent(new Event('vide-materiais-mudou'));
}
