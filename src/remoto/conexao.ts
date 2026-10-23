// Conexão com uma sala do serviço de mensagens (WebSocket), com reconexão automática.

export type StatusConexao = 'conectando' | 'conectada' | 'desconectada';

export class ConexaoSala<Entrada, Saida> {
  private ws: WebSocket | null = null;
  private ativa = true;
  private tentativas = 0;
  private batimento: number | null = null;
  private religar: number | null = null;

  constructor(
    readonly codigo: string,
    private papel: 'computador' | 'celular',
    private aoMensagem: (m: Entrada) => void,
    private aoStatus: (s: StatusConexao) => void,
  ) {
    this.abrir();
    // Ao voltar para a página (ex.: o iPhone desbloqueou), reconecta na hora.
    document.addEventListener('visibilitychange', this.aoVisibilidade);
    window.addEventListener('online', this.aoVisibilidade);
  }

  get aberta(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  enviar(m: Saida): boolean {
    if (!this.aberta) return false;
    this.ws!.send(JSON.stringify(m));
    return true;
  }

  fechar(): void {
    this.ativa = false;
    document.removeEventListener('visibilitychange', this.aoVisibilidade);
    window.removeEventListener('online', this.aoVisibilidade);
    if (this.batimento !== null) window.clearInterval(this.batimento);
    if (this.religar !== null) window.clearTimeout(this.religar);
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.aoStatus('desconectada');
  }

  private aoVisibilidade = () => {
    if (document.visibilityState === 'visible' && this.ativa && !this.aberta) {
      if (this.religar !== null) window.clearTimeout(this.religar);
      this.tentativas = 0;
      this.abrir();
    }
  };

  private abrir() {
    if (!this.ativa) return;
    const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocolo}://${location.host}/api/sala/${this.codigo}?papel=${this.papel}`;
    this.aoStatus('conectando');
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.agendarReconexao();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.tentativas = 0;
      this.aoStatus('conectada');
      if (this.batimento !== null) window.clearInterval(this.batimento);
      // Mantém a conexão viva (o serviço responde "pong" sozinho).
      this.batimento = window.setInterval(() => this.aberta && this.ws!.send('ping'), 25_000);
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      try {
        this.aoMensagem(JSON.parse(e.data) as Entrada);
      } catch {
        /* mensagem inválida */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.batimento !== null) window.clearInterval(this.batimento);
      this.ws = null;
      if (this.ativa) {
        this.aoStatus('desconectada');
        this.agendarReconexao();
      }
    };
    ws.onerror = () => {
      /* onclose cuida da reconexão */
    };
  }

  private agendarReconexao() {
    if (!this.ativa) return;
    const espera = Math.min(500 * 2 ** this.tentativas, 10_000);
    this.tentativas++;
    this.religar = window.setTimeout(() => this.abrir(), espera);
  }
}
