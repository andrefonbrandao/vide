// Imagem PNG do QR code de um link (para o Moodle, slides ou impressão):
// fundo branco, o QR, o título do treino e o endereço escrito embaixo.
import qrcode from 'qrcode-generator';

const TINTA = '#1E3A34';

function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 3);
}

export async function gerarImagemQr(url: string, titulo: string): Promise<Blob> {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const modulo = Math.max(8, Math.floor(640 / n));
  const lado = n * modulo;
  const margem = modulo * 4;
  const largura = lado + margem * 2;
  // Espera a fonte do Vide (para o texto sair com ela).
  try {
    await document.fonts?.load('800 34px Manrope');
    await document.fonts?.load('600 22px Manrope');
  } catch {
    /* sem a fonte, usa a padrão */
  }
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = '800 34px Manrope, sans-serif';
  const linhasTitulo = quebrarLinhas(ctx, titulo, largura - margem * 2);
  const altura = margem + lado + 40 + linhasTitulo.length * 42 + 40 + margem;
  c.width = largura;
  c.height = altura;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, largura, altura);
  ctx.fillStyle = TINTA;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) ctx.fillRect(margem + k * modulo, margem + r * modulo, modulo, modulo);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = margem + lado + 32;
  ctx.font = '800 34px Manrope, sans-serif';
  for (const l of linhasTitulo) {
    ctx.fillText(l, largura / 2, y);
    y += 42;
  }
  ctx.font = '600 22px Manrope, sans-serif';
  ctx.fillText(url.replace(/^https?:\/\//, ''), largura / 2, y + 6);
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}

export function nomeArquivoQr(titulo: string): string {
  // Só letras sem acento, números e pontuação simples: alguns navegadores recusam outros caracteres no nome.
  const limpo = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ._()-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `QR - ${limpo || 'treino'}.png`;
}
