// Porteiro do app do professor: o endereço principal do Vide só abre com a senha do professor.
// As páginas dos alunos (/j, /t, /p, /o) e o controle pelo celular (QR da sala) continuam abertos,
// protegidos pelos próprios códigos.
//
// A senha é o segredo SENHA_PROFESSOR do Worker (painel do Cloudflare). Sem ele, o porteiro fica
// desligado (o app abre como antes). Depois de acertar a senha, o aparelho recebe um cookie
// assinado que vale um ano; trocar a senha invalida todos os aparelhos.
import { DurableObject } from 'cloudflare:workers';

const COOKIE = 'vide_prof';
const UM_ANO = 365 * 24 * 3600;
const MAX_ERROS = 8;
const BLOQUEIO_MS = 15 * 60_000;

export interface EnvPorteiro {
  SENHA_PROFESSOR?: string;
  PORTEIROS: DurableObjectNamespace<Porteiro>;
}

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function chave(senha: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(`vide-sessao:${senha}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function assinar(senha: string, exp: number): Promise<string> {
  return `${exp}.${b64url(await crypto.subtle.sign('HMAC', await chave(senha), enc.encode(String(exp))))}`;
}

/** Comparação em tempo constante (não revela quantas letras acertou). */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sessaoValida(req: Request, senha: string): Promise<boolean> {
  const c = (req.headers.get('Cookie') ?? '').split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`));
  const v = c?.slice(COOKIE.length + 1) ?? '';
  const exp = Number(v.split('.')[0]);
  if (!exp || exp * 1000 < Date.now()) return false;
  return iguais(v, await assinar(senha, exp));
}

/** Porteiro ligado (há senha) e a requisição não traz uma sessão válida. */
export async function precisaEntrar(req: Request, env: EnvPorteiro): Promise<boolean> {
  if (!env.SENHA_PROFESSOR) return false;
  return !(await sessaoValida(req, env.SENHA_PROFESSOR));
}

/** Endereços que continuam abertos (páginas dos alunos e arquivos do app). */
export function enderecoAberto(url: URL): boolean {
  const p = url.pathname;
  if (/^\/(j|t|p|o)(\/|$)/.test(p)) return true;
  if (p.startsWith('/assets/')) return true;
  if (/^\/[^/]+\.(png|svg|ico|webmanifest|txt|json)$/.test(p)) return true;
  // Controle pelo celular (QR da sala): o próprio código da sala protege.
  if (url.searchParams.get('tela') === 'controle' && url.searchParams.get('sala')) return true;
  return false;
}

function paginaEntrar(url: URL, aviso = ''): Response {
  const volta = url.searchParams.get('volta') ?? `${url.pathname}${url.search}`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vide — entrar</title>
<meta name="robots" content="noindex"><link rel="icon" href="/vide-simbolo.svg">
<style>:root{--fundo:#eef0ea;--tinta:#1e3a34}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--fundo);color:var(--tinta);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
form{background:#fff;border-radius:18px;padding:28px 26px;width:min(380px,100%);box-shadow:0 10px 40px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:12px}
h1{margin:0;font-size:24px}p{margin:0;color:#4a5550;line-height:1.5}input{font:inherit;font-size:17px;padding:12px;border:1.5px solid #c9d0c8;border-radius:10px}
button{font:inherit;font-weight:800;font-size:16px;padding:12px;border:none;border-radius:999px;background:#e8735a;color:#fff;cursor:pointer}.aviso{color:#b5492b;font-weight:600}</style></head>
<body><form method="post" action="/api/entrar"><h1>Vide</h1><p>Este é o app do professor. Digite a senha para entrar neste aparelho.</p>
${aviso ? `<p class="aviso">${aviso}</p>` : ''}<input type="password" name="senha" autocomplete="current-password" aria-label="Senha" autofocus required>
<input type="hidden" name="volta" value="${volta.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}"><button>Entrar</button>
<p style="font-size:13px">Aluno? Use o link que o professor mandou (jogo, treino, processo ou página de orientação).</p></form></body></html>`;
  return new Response(html, { status: aviso ? 401 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

/** A tela de senha, no lugar do app (para quem ainda não entrou neste aparelho). */
export function telaDeEntrada(url: URL): Response {
  return paginaEntrar(url);
}

/** POST /api/entrar (senha) e /api/sair. */
export async function tratarEntrada(req: Request, env: EnvPorteiro, url: URL): Promise<Response> {
  if (url.pathname === '/api/sair') {
    return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }
  if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 });
  const senha = env.SENHA_PROFESSOR;
  if (!senha) return new Response(null, { status: 303, headers: { Location: '/' } });
  const form = await req.formData().catch(() => null);
  const tentativa = String(form?.get('senha') ?? '');
  let volta = String(form?.get('volta') ?? '/');
  if (!volta.startsWith('/') || volta.startsWith('//')) volta = '/';
  const ip = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';
  const porteiro = env.PORTEIROS.get(env.PORTEIROS.idFromName(`ip:${ip}`));
  const bloqueio = await porteiro.situacao();
  if (bloqueio) return paginaEntrar(new URL(`${url.origin}/?volta=${encodeURIComponent(volta)}`), `Muitas tentativas erradas. Tente de novo em ${bloqueio} minutos.`);
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(tentativa)), crypto.subtle.digest('SHA-256', enc.encode(senha))]);
  if (!iguais(b64url(a), b64url(b))) {
    const restam = await porteiro.errou();
    return paginaEntrar(
      new URL(`${url.origin}/?volta=${encodeURIComponent(volta)}`),
      restam > 0 ? `Senha errada. Restam ${restam} ${restam === 1 ? 'tentativa' : 'tentativas'} antes de um bloqueio de 15 minutos.` : 'Senha errada. Bloqueado por 15 minutos.',
    );
  }
  await porteiro.acertou();
  const exp = Math.floor(Date.now() / 1000) + UM_ANO;
  return new Response(null, {
    status: 303,
    headers: { Location: volta, 'Set-Cookie': `${COOKIE}=${await assinar(senha, exp)}; Path=/; Max-Age=${UM_ANO}; HttpOnly; Secure; SameSite=Lax` },
  });
}

/** Conta os erros de senha de um endereço de internet (IP) e bloqueia por 15 minutos depois de 8. */
export class Porteiro extends DurableObject {
  async situacao(): Promise<number> {
    const f = (await this.ctx.storage.get<{ n: number; ate: number }>('f')) ?? { n: 0, ate: 0 };
    return f.ate > Date.now() ? Math.ceil((f.ate - Date.now()) / 60_000) : 0;
  }
  async errou(): Promise<number> {
    const f = (await this.ctx.storage.get<{ n: number; ate: number }>('f')) ?? { n: 0, ate: 0 };
    const n = f.n + 1;
    if (n >= MAX_ERROS) {
      await this.ctx.storage.put('f', { n: 0, ate: Date.now() + BLOQUEIO_MS });
      return 0;
    }
    await this.ctx.storage.put('f', { n, ate: 0 });
    return MAX_ERROS - n;
  }
  async acertou(): Promise<void> {
    await this.ctx.storage.delete('f');
  }
}
