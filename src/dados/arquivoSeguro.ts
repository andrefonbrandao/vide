// Arquivos (PDF, imagem, Word) no banco do navegador mesmo quando ele recusa guardar "Blob".
// O Safari em aba privada dá o erro "Error preparing Blob/File data to be stored in object store".
// Nesse caso o Vide guarda os bytes do arquivo (ArrayBuffer), que todo navegador aceita, e,
// ao ler, monta de novo o arquivo. Fora desse caso nada muda.
import type Dexie from 'dexie';

/** Como o arquivo fica guardado quando o navegador não aceita Blob. */
export interface ArquivoEmBytes {
  __videArquivo: 1;
  dados: ArrayBuffer;
  tipo: string;
}

const ehBytes = (x: unknown): x is ArquivoEmBytes => !!x && typeof x === 'object' && (x as ArquivoEmBytes).__videArquivo === 1;

/** Arquivos já convertidos em bytes (lidos do banco ou preparados), para gravar sem esperar. */
const emBytes = new WeakMap<Blob, ArquivoEmBytes>();
let semBlob = false;

/** Descobre (uma vez) se o banco do navegador aceita guardar Blob. */
function testar(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(true);
  return new Promise<boolean>((fim) => {
    const nome = 'vide-teste-arquivo';
    const apagar = () => {
      try {
        indexedDB.deleteDatabase(nome);
      } catch {
        /* ignore */
      }
    };
    try {
      const pedido = indexedDB.open(nome, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore('t');
      pedido.onerror = () => fim(true); // sem banco algum: o erro aparece em outro lugar
      pedido.onsuccess = () => {
        const banco = pedido.result;
        try {
          const tx = banco.transaction('t', 'readwrite');
          tx.objectStore('t').put(new Blob(['x'], { type: 'text/plain' }), 1);
          tx.oncomplete = () => (banco.close(), apagar(), fim(true));
          tx.onerror = tx.onabort = () => (banco.close(), apagar(), fim(false));
        } catch {
          banco.close();
          apagar();
          fim(false);
        }
      };
    } catch {
      fim(true);
    }
  }).then((aceita) => {
    if (teste === emCurso) semBlob = !aceita;
    return aceita;
  });
}

let teste: Promise<boolean> | null = null;
let emCurso: Promise<boolean> | null = null;
const aceitaBlob = () => (teste ??= emCurso = testar());

/** Só para os testes: força o modo "navegador que não aceita Blob". */
export function forcarSemBlob(sim: boolean): void {
  semBlob = sim;
  teste = Promise.resolve(!sim);
}

/**
 * Prepara um arquivo novo para ser gravado. Chame antes de gravar (fora de transação).
 * Devolve um Blob igual ao recebido; quando o navegador não aceita Blob, ele já sai convertido.
 */
export async function prepararArquivo<B extends Blob>(arquivo: B): Promise<B> {
  if ((await aceitaBlob()) || emBytes.has(arquivo)) return arquivo;
  const bytes: ArquivoEmBytes = { __videArquivo: 1, dados: await arquivo.arrayBuffer(), tipo: arquivo.type };
  emBytes.set(arquivo, bytes);
  return arquivo;
}

function paraGravar<T>(v: T): T {
  const a = (v as { arquivo?: unknown } | null)?.arquivo;
  if (!(a instanceof Blob)) return v;
  const bytes = emBytes.get(a) ?? (semBlob && a.size === 0 ? { __videArquivo: 1 as const, dados: new ArrayBuffer(0), tipo: a.type } : undefined);
  return bytes ? { ...v, arquivo: bytes } : v;
}

function aoLer<T>(v: T): T {
  const o = v as { arquivo?: unknown } | null;
  if (o && ehBytes(o.arquivo)) {
    const blob = new Blob([o.arquivo.dados], { type: o.arquivo.tipo });
    emBytes.set(blob, o.arquivo);
    o.arquivo = blob;
  }
  return v;
}

/** Liga a conversão nas tabelas que guardam arquivo. */
export function ligarArquivoSeguro(banco: Dexie, tabelas: string[]): void {
  void aceitaBlob();
  banco.use({
    stack: 'dbcore',
    name: 'arquivo-seguro',
    create: (baixo) => ({
      ...baixo,
      table: (nome) => {
        const t = baixo.table(nome);
        if (!tabelas.includes(nome)) return t;
        return {
          ...t,
          mutate: (req) => (req.type === 'add' || req.type === 'put' ? t.mutate({ ...req, values: req.values.map(paraGravar) }) : t.mutate(req)),
        };
      },
    }),
  });
  for (const nome of tabelas) banco.table(nome).hook('reading', aoLer);
}
