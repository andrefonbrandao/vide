// Serviço de mensagens do Vide no Cloudflare (Worker + Durable Object).
//
// O celular (controle + microfone) e o computador (acervo + projeção) entram
// na mesma "sala", identificada por um código. O que um envia, o outro recebe.
// Nada é guardado: as mensagens só passam por aqui.
//
// Tudo que não começa com /api/ é o próprio app (arquivos da pasta dist).
import { DurableObject } from 'cloudflare:workers';
import { paraAluno, type ComLibera } from '../src/processo/liberacao';

export interface Env {
  SALAS: DurableObjectNamespace<Sala>;
  JOGOS: DurableObjectNamespace<Jogo>;
  TREINOS: DurableObjectNamespace<Treino>;
  PROCESSOS: DurableObjectNamespace<Processo>;
  ASSETS: Fetcher;
}

type Papel = 'computador' | 'celular';

const RE_SALA = /^\/api\/sala\/([A-Z0-9]{6,16})$/;
const RE_JOGO = /^\/api\/jogo\/(\d{6})$/;
const RE_TREINO = /^\/api\/treino(?:\/([A-Za-z0-9]{10,24}))?$/;
const RE_PROCESSO = /^\/api\/processo(?:\/([A-Za-z0-9]{10,24}))?$/;
/** Mensagens maiores que isso são descartadas (as do Vide têm poucos KB). */
const TAMANHO_MAXIMO = 256 * 1024;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = RE_SALA.exec(url.pathname);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Esperado WebSocket', { status: 426 });
      // Só aceita conexões vindas do próprio app (não de outros sites).
      const origem = req.headers.get('Origin');
      if (origem && new URL(origem).host !== url.host) return new Response('Origem não permitida', { status: 403 });
      const sala = env.SALAS.get(env.SALAS.idFromName(m[1]));
      return sala.fetch(req);
    }
    const j = RE_JOGO.exec(url.pathname);
    if (j) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Esperado WebSocket', { status: 426 });
      const origem = req.headers.get('Origin');
      if (origem && new URL(origem).host !== url.host) return new Response('Origem não permitida', { status: 403 });
      return env.JOGOS.get(env.JOGOS.idFromName(j[1])).fetch(req);
    }
    const t = RE_TREINO.exec(url.pathname);
    if (t) return tratarTreino(req, env, url, t[1]);
    const pr = RE_PROCESSO.exec(url.pathname);
    if (pr) return tratarProcesso(req, env, url, pr[1]);
    if (url.pathname.startsWith('/api/')) return new Response('Não encontrado', { status: 404 });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

/** Uma sala de pareamento (um computador e um celular). */
export class Sala extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // "ping" -> "pong" sem acordar a sala (mantém a conexão viva barato).
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request): Promise<Response> {
    const papel: Papel = new URL(req.url).searchParams.get('papel') === 'celular' ? 'celular' : 'computador';
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    this.ctx.acceptWebSocket(servidor, [papel]);
    this.avisarPresenca();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer): void {
    if (typeof msg !== 'string' || msg.length > TAMANHO_MAXIMO) return;
    const [papel] = this.ctx.getTags(ws);
    const destino: Papel = papel === 'celular' ? 'computador' : 'celular';
    for (const outro of this.ctx.getWebSockets(destino)) {
      try {
        outro.send(msg);
      } catch {
        /* conexão já fechada */
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      /* já fechada */
    }
    this.avisarPresenca(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.avisarPresenca(ws);
  }

  /** Informa a todos quem está na sala (computador e/ou celular). */
  private avisarPresenca(saindo?: WebSocket): void {
    const abertos = (p: Papel) => this.ctx.getWebSockets(p).filter((w) => w !== saindo && w.readyState === 1).length;
    const msg = JSON.stringify({ t: 'presenca', computador: abertos('computador'), celular: abertos('celular') });
    for (const w of this.ctx.getWebSockets()) {
      if (w === saindo) continue;
      try {
        w.send(msg);
      } catch {
        /* ignore */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Jogo de perguntas: o computador do professor ("anfitrião") e os celulares dos
// alunos entram pelo código de 6 dígitos. O anfitrião decide tudo (perguntas,
// pontos); aqui só se repassam as mensagens. Nenhum apelido ou resposta é gravado:
// a única coisa guardada é a chave do anfitrião (para ninguém mais assumir a sala),
// apagada sozinha em 12 horas.

const RE_TOKEN = /^[A-Za-z0-9]{12,40}$/;
const MAX_MSG_ALUNO = 2 * 1024;
const VALIDADE_SALA_MS = 12 * 60 * 60 * 1000;

export class Jogo extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request): Promise<Response> {
    const p = new URL(req.url).searchParams;
    const papel = p.get('papel');
    const guardada = await this.ctx.storage.get<string>('chave');

    if (papel === 'anfitriao') {
      const chave = p.get('chave') ?? '';
      if (!RE_TOKEN.test(chave)) return new Response('Chave inválida', { status: 400 });
      if (guardada && guardada !== chave) return new Response('Sala ocupada', { status: 409 });
      if (!guardada) {
        await this.ctx.storage.put('chave', chave);
        await this.ctx.storage.setAlarm(Date.now() + VALIDADE_SALA_MS);
      }
      // Um anfitrião por vez: a conexão nova substitui a antiga.
      for (const velho of this.ctx.getWebSockets('anfitriao')) this.fecharSemErro(velho, 4000, 'substituído');
      const [cliente, servidor] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(servidor, ['anfitriao']);
      const tokens = this.ctx.getWebSockets('aluno').map((w) => this.tokenDe(w)).filter(Boolean);
      servidor.send(JSON.stringify({ t: 'conectados', tokens }));
      this.paraAlunos({ t: 'anfitriao', on: true });
      return new Response(null, { status: 101, webSocket: cliente });
    }

    // Aluno
    const token = p.get('token') ?? '';
    if (!RE_TOKEN.test(token)) return new Response('Token inválido', { status: 400 });
    if (!guardada) return new Response('Jogo não encontrado', { status: 404 });
    for (const velho of this.ctx.getWebSockets(`t:${token}`)) this.fecharSemErro(velho, 4000, 'substituído');
    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor, ['aluno', `t:${token}`]);
    servidor.send(JSON.stringify({ t: 'anfitriao', on: this.ctx.getWebSockets('anfitriao').length > 0 }));
    this.paraAnfitriao({ t: 'conexao', token, on: true });
    return new Response(null, { status: 101, webSocket: cliente });
  }

  webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer): void {
    if (typeof msg !== 'string') return;
    const tags = this.ctx.getTags(ws);
    if (tags.includes('anfitriao')) {
      if (msg.length > TAMANHO_MAXIMO) return;
      let m: { t?: string; comum?: unknown; pessoal?: Record<string, unknown>; token?: string; msg?: unknown };
      try {
        m = JSON.parse(msg);
      } catch {
        return;
      }
      if (m.t === 'difundir') {
        // O mesmo retrato para todos, com a parte pessoal de cada um.
        for (const w of this.ctx.getWebSockets('aluno')) {
          const token = this.tokenDe(w);
          this.enviarSemErro(w, JSON.stringify({ t: 'jogo', ...(m.comum as object), voce: m.pessoal?.[token] ?? null }));
        }
      } else if (m.t === 'para' && typeof m.token === 'string') {
        for (const w of this.ctx.getWebSockets(`t:${m.token}`)) this.enviarSemErro(w, JSON.stringify(m.msg));
      } else if (m.t === 'encerrar') {
        this.paraAlunos({ t: 'encerrado' });
        for (const w of this.ctx.getWebSockets()) if (w !== ws) this.fecharSemErro(w, 1000, 'fim do jogo');
        void this.ctx.storage.deleteAll();
      }
      return;
    }
    // Aluno -> anfitrião (com o token de quem enviou).
    if (msg.length > MAX_MSG_ALUNO) return;
    let m: unknown;
    try {
      m = JSON.parse(msg);
    } catch {
      return;
    }
    this.paraAnfitriao({ t: 'do-aluno', de: this.tokenDe(ws), msg: m });
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    this.fecharSemErro(ws, code, reason);
    this.aoSair(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.aoSair(ws);
  }

  async alarm(): Promise<void> {
    this.paraAlunos({ t: 'encerrado' });
    for (const w of this.ctx.getWebSockets()) this.fecharSemErro(w, 1000, 'sala expirada');
    await this.ctx.storage.deleteAll();
  }

  private aoSair(ws: WebSocket): void {
    const tags = this.ctx.getTags(ws);
    if (tags.includes('anfitriao')) {
      if (!this.ctx.getWebSockets('anfitriao').some((w) => w !== ws && w.readyState === 1)) this.paraAlunos({ t: 'anfitriao', on: false });
    } else {
      const token = this.tokenDe(ws);
      if (!this.ctx.getWebSockets(`t:${token}`).some((w) => w !== ws && w.readyState === 1)) {
        this.paraAnfitriao({ t: 'conexao', token, on: false });
      }
    }
  }

  private tokenDe(ws: WebSocket): string {
    return this.ctx.getTags(ws).find((t) => t.startsWith('t:'))?.slice(2) ?? '';
  }

  private paraAnfitriao(m: unknown): void {
    for (const w of this.ctx.getWebSockets('anfitriao')) this.enviarSemErro(w, JSON.stringify(m));
  }

  private paraAlunos(m: unknown): void {
    const texto = JSON.stringify(m);
    for (const w of this.ctx.getWebSockets('aluno')) this.enviarSemErro(w, texto);
  }

  private enviarSemErro(w: WebSocket, texto: string): void {
    try {
      w.send(texto);
    } catch {
      /* conexão já fechada */
    }
  }

  private fecharSemErro(w: WebSocket, code: number, reason: string): void {
    try {
      w.close(code, reason);
    } catch {
      /* já fechada */
    }
  }
}

// ---------------------------------------------------------------------------
// Treino em casa: o professor publica uma cópia de um grupo de questões e
// recebe um link. Qualquer um com o link lê as questões; só quem tem a chave
// (o navegador do professor) pode trocar ou apagar. Nada dos alunos é guardado.

const MAX_TREINO = 1_500_000;
const LETRAS_ID = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function novoIdTreino(): string {
  const n = new Uint32Array(12);
  crypto.getRandomValues(n);
  return Array.from(n, (x) => LETRAS_ID[x % LETRAS_ID.length]).join('');
}

function jsonResp(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function tratarTreino(req: Request, env: Env, url: URL, id: string | undefined): Promise<Response> {
  // Escritas só a partir do próprio Vide.
  if (req.method !== 'GET') {
    const origem = req.headers.get('Origin');
    if (!origem || new URL(origem).host !== url.host) return new Response('Origem não permitida', { status: 403 });
  }
  if (!id) {
    if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 });
    const novo = novoIdTreino();
    return env.TREINOS.get(env.TREINOS.idFromName(novo)).fetch(new Request(`https://treino/${novo}`, { method: 'PUT', headers: req.headers, body: req.body }));
  }
  return env.TREINOS.get(env.TREINOS.idFromName(id)).fetch(new Request(`https://treino/${id}`, { method: req.method, headers: req.headers, body: req.body }));
}

export class Treino extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const id = new URL(req.url).pathname.slice(1);
    const chave = req.headers.get('X-Vide-Chave') ?? '';
    const guardada = await this.ctx.storage.get<string>('chave');
    if (req.method === 'GET') {
      const dados = await this.ctx.storage.get<string>('dados');
      return dados ? new Response(dados, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }) : jsonResp({ erro: 'não encontrado' }, 404);
    }
    if (!RE_TOKEN.test(chave)) return jsonResp({ erro: 'chave inválida' }, 400);
    if (guardada && guardada !== chave) return jsonResp({ erro: 'sem permissão' }, 403);
    if (req.method === 'PUT') {
      const texto = await req.text();
      if (texto.length > MAX_TREINO) return jsonResp({ erro: 'grande demais' }, 413);
      try {
        JSON.parse(texto);
      } catch {
        return jsonResp({ erro: 'JSON inválido' }, 400);
      }
      await this.ctx.storage.put({ chave, dados: texto });
      return jsonResp({ id });
    }
    if (req.method === 'DELETE') {
      await this.ctx.storage.deleteAll();
      return jsonResp({ ok: true });
    }
    return new Response('Método não permitido', { status: 405 });
  }
}

// ---------------------------------------------------------------------------
// Processo fictício: o professor publica o processo inteiro (com os eventos
// futuros), mas a leitura pública só devolve os eventos já liberados. Com a
// chave (o navegador do professor) dá para atualizar, apagar e ler tudo.

async function tratarProcesso(req: Request, env: Env, url: URL, id: string | undefined): Promise<Response> {
  if (req.method !== 'GET') {
    const origem = req.headers.get('Origin');
    if (!origem || new URL(origem).host !== url.host) return new Response('Origem não permitida', { status: 403 });
  }
  if (!id) {
    if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 });
    const novo = novoIdTreino();
    return env.PROCESSOS.get(env.PROCESSOS.idFromName(novo)).fetch(new Request(`https://processo/${novo}`, { method: 'PUT', headers: req.headers, body: req.body }));
  }
  return env.PROCESSOS.get(env.PROCESSOS.idFromName(id)).fetch(new Request(`https://processo/${id}`, { method: req.method, headers: req.headers, body: req.body }));
}

export class Processo extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const id = new URL(req.url).pathname.slice(1);
    const chave = req.headers.get('X-Vide-Chave') ?? '';
    const guardada = await this.ctx.storage.get<string>('chave');
    if (req.method === 'GET') {
      const dados = await this.ctx.storage.get<string>('dados');
      if (!dados) return jsonResp({ erro: 'não encontrado' }, 404);
      const tudo = JSON.parse(dados) as { eventos: ComLibera[] };
      return jsonResp(paraAluno(tudo, Date.now()));
    }
    if (!RE_TOKEN.test(chave)) return jsonResp({ erro: 'chave inválida' }, 400);
    if (guardada && guardada !== chave) return jsonResp({ erro: 'sem permissão' }, 403);
    if (req.method === 'PUT') {
      const texto = await req.text();
      if (texto.length > MAX_TREINO) return jsonResp({ erro: 'grande demais' }, 413);
      try {
        const d = JSON.parse(texto) as { eventos?: unknown };
        if (!Array.isArray(d.eventos)) return jsonResp({ erro: 'formato inválido' }, 400);
      } catch {
        return jsonResp({ erro: 'JSON inválido' }, 400);
      }
      await this.ctx.storage.put({ chave, dados: texto });
      return jsonResp({ id });
    }
    if (req.method === 'DELETE') {
      await this.ctx.storage.deleteAll();
      return jsonResp({ ok: true });
    }
    return new Response('Método não permitido', { status: 405 });
  }
}
