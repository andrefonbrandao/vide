// Login com o Google (Google Identity Services) e acesso à pasta "Vide" no Drive.
// Permissão pedida: drive.file — o Vide só enxerga os arquivos que ele mesmo criou.
import type { ArmazemRemoto, ArquivoRemoto } from './remoto';

export const CLIENT_ID = '600212132333-3sqhutn8g05lpm72btc0gbp18utfg0dd.apps.googleusercontent.com';
const ESCOPO = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const CAMPOS = 'id,name,modifiedTime,appProperties';
const CHAVE_TOKEN = 'vide.drive.token';

/* Tipos mínimos do Google Identity Services. */
interface RespostaToken {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface ClienteToken {
  callback: (r: RespostaToken) => void;
  requestAccessToken(o?: { prompt?: string; login_hint?: string }): void;
}
interface GoogleGsi {
  accounts: {
    oauth2: {
      initTokenClient(c: {
        client_id: string;
        scope: string;
        callback: (r: RespostaToken) => void;
        error_callback?: (e: { type: string; message?: string }) => void;
      }): ClienteToken;
      revoke(token: string, cb?: () => void): void;
    };
  };
}

export class ErroLogin extends Error {}

let carregando: Promise<GoogleGsi> | null = null;
function carregarGsi(): Promise<GoogleGsi> {
  const w = window as unknown as { google?: GoogleGsi };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  carregando ??= new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google?.accounts?.oauth2 ? ok(w.google) : falha(new ErroLogin('O login do Google não carregou.')));
    s.onerror = () => {
      carregando = null;
      falha(new ErroLogin('Não foi possível carregar o login do Google (sem internet ou bloqueado pela rede).'));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

interface TokenGuardado {
  token: string;
  expira: number;
}

/** Token de acesso válido guardado nesta aba (dura cerca de 1 hora). */
export function tokenGuardado(): TokenGuardado | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(CHAVE_TOKEN) ?? 'null') as TokenGuardado | null;
    return t && t.expira > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

export function esquecerToken(): void {
  try {
    sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* ignore */
  }
}

/**
 * Abre o login do Google (precisa ser chamado num clique, senão o navegador bloqueia a janela).
 * Se a pessoa já autorizou antes, a janela abre e fecha sozinha.
 */
export async function pedirToken(email?: string): Promise<TokenGuardado> {
  const g = await carregarGsi();
  return new Promise((ok, falha) => {
    const cliente = g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: ESCOPO,
      callback: (r) => {
        if (!r.access_token) {
          falha(new ErroLogin(r.error === 'access_denied' ? 'O acesso ao Drive não foi autorizado.' : `Login não concluído (${r.error ?? 'erro'}).`));
          return;
        }
        const t = { token: r.access_token, expira: Date.now() + (r.expires_in ?? 3600) * 1000 };
        try {
          sessionStorage.setItem(CHAVE_TOKEN, JSON.stringify(t));
        } catch {
          /* ignore */
        }
        ok(t);
      },
      error_callback: (e) =>
        falha(new ErroLogin(e.type === 'popup_closed' ? 'A janela de login foi fechada.' : e.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela de login. Permita pop-ups para este site.' : `Login não concluído (${e.type}).`)),
    });
    cliente.requestAccessToken({ prompt: email ? '' : 'consent', login_hint: email });
  });
}

export async function revogar(token: string): Promise<void> {
  try {
    const g = await carregarGsi();
    await new Promise<void>((ok) => g.accounts.oauth2.revoke(token, ok));
  } catch {
    /* sem problema: o token expira sozinho */
  }
}

/** O token expirou ou foi revogado: é preciso entrar de novo. */
export class ErroAutorizacao extends Error {}

export class DriveGoogle implements ArmazemRemoto {
  private pastaId: string | null = null;

  constructor(private token: () => string | null) {}

  private async req(url: string, init: RequestInit = {}): Promise<Response> {
    const t = this.token();
    if (!t) throw new ErroAutorizacao('sem login');
    const r = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${t}` } });
    if (r.status === 401) throw new ErroAutorizacao('login expirado');
    if (!r.ok) {
      let msg = `${r.status}`;
      try {
        msg = ((await r.json()) as { error?: { message?: string } }).error?.message ?? msg;
      } catch {
        /* ignore */
      }
      throw new Error(`Drive: ${msg}`);
    }
    return r;
  }

  async email(): Promise<string> {
    const r = await this.req(`${API}/about?fields=user(emailAddress)`);
    return ((await r.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? '';
  }

  /** A pasta "Vide" (criada pelo próprio Vide na primeira vez). */
  async pasta(): Promise<string> {
    if (this.pastaId) return this.pastaId;
    const q = encodeURIComponent("appProperties has { key='vide' and value='pasta' } and trashed=false");
    const r = await this.req(`${API}/files?q=${q}&fields=files(id)&spaces=drive`);
    const achadas = ((await r.json()) as { files: { id: string }[] }).files;
    if (achadas.length) return (this.pastaId = achadas[0].id);
    const c = await this.req(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Vide', mimeType: 'application/vnd.google-apps.folder', appProperties: { vide: 'pasta' } }),
    });
    return (this.pastaId = ((await c.json()) as { id: string }).id);
  }

  private converter(f: { id: string; name: string; modifiedTime: string; appProperties?: Record<string, string> }): ArquivoRemoto {
    return { id: f.id, nome: f.name, modificado: f.modifiedTime, props: f.appProperties ?? {} };
  }

  async listar(): Promise<ArquivoRemoto[]> {
    const pasta = await this.pasta();
    const q = encodeURIComponent(`'${pasta}' in parents and trashed=false`);
    const saida: ArquivoRemoto[] = [];
    let pagina = '';
    do {
      const r = await this.req(`${API}/files?q=${q}&pageSize=1000&fields=nextPageToken,files(${CAMPOS})${pagina ? `&pageToken=${pagina}` : ''}`);
      const d = (await r.json()) as { nextPageToken?: string; files: Parameters<DriveGoogle['converter']>[0][] };
      saida.push(...d.files.map((f) => this.converter(f)));
      pagina = d.nextPageToken ?? '';
    } while (pagina);
    return saida;
  }

  async baixar(id: string): Promise<Blob> {
    const r = await this.req(`${API}/files/${id}?alt=media`);
    return r.blob();
  }

  /** Envio "retomável" (serve para arquivos grandes): primeiro os dados, depois o conteúdo. */
  private async enviar(url: string, metodo: 'POST' | 'PATCH', meta: Record<string, unknown>, conteudo: Blob): Promise<ArquivoRemoto> {
    const tipo = conteudo.type || 'application/octet-stream';
    const ini = await this.req(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': tipo },
      body: JSON.stringify(meta),
    });
    const destino = ini.headers.get('Location');
    if (!destino) throw new Error('Drive: o envio não foi aceito (sem endereço de upload).');
    const fim = await this.req(destino, { method: 'PUT', headers: { 'Content-Type': tipo }, body: conteudo });
    return this.converter(await fim.json());
  }

  async criar(nome: string, props: Record<string, string>, conteudo: Blob): Promise<ArquivoRemoto> {
    const pasta = await this.pasta();
    return this.enviar(`${UPLOAD}/files?uploadType=resumable&fields=${CAMPOS}`, 'POST', { name: nome, parents: [pasta], appProperties: props }, conteudo);
  }

  async atualizar(id: string, conteudo: Blob, props?: Record<string, string>): Promise<ArquivoRemoto> {
    return this.enviar(`${UPLOAD}/files/${id}?uploadType=resumable&fields=${CAMPOS}`, 'PATCH', props ? { appProperties: props } : {}, conteudo);
  }

  async lixeira(id: string): Promise<void> {
    await this.req(`${API}/files/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  }
}
