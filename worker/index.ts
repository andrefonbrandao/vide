// Serviço de mensagens do Vide no Cloudflare (Worker + Durable Object).
//
// O celular (controle + microfone) e o computador (acervo + projeção) entram
// na mesma "sala", identificada por um código. O que um envia, o outro recebe.
// Nada é guardado: as mensagens só passam por aqui.
//
// Tudo que não começa com /api/ é o próprio app (arquivos da pasta dist).
import { DurableObject } from 'cloudflare:workers';

export interface Env {
  SALAS: DurableObjectNamespace<Sala>;
  ASSETS: Fetcher;
}

type Papel = 'computador' | 'celular';

const RE_SALA = /^\/api\/sala\/([A-Z0-9]{6,16})$/;
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
