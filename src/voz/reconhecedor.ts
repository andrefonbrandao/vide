// Reconhecimento de voz contínuo (Web Speech API), com reinício automático.
//
// No Chrome o áudio é processado pelo Google; no Edge, pela Microsoft.
// Os dois exigem internet. A sessão do navegador cai sozinha de tempos em
// tempos (silêncio, rede, limite de duração); aqui ela é reaberta na hora.

/* Tipos mínimos da Web Speech API (o TypeScript não traz todos). */
interface ResultadoAlternativa { transcript: string; confidence: number }
interface ResultadoFala { isFinal: boolean; length: number; [i: number]: ResultadoAlternativa }
interface EventoResultado { resultIndex: number; results: { length: number; [i: number]: ResultadoFala } }
interface EventoErro { error: string; message?: string }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: EventoErro) => void) | null;
  onresult: ((e: EventoResultado) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Construtor = new () => SpeechRecognitionLike;

export type StatusVoz = 'parado' | 'iniciando' | 'ouvindo' | 'reiniciando' | 'erro' | 'sem-suporte';

export interface EventosVoz {
  /** Texto provisório (ainda pode mudar). `chave` identifica o trecho. */
  onParcial(texto: string, chave: string): void;
  /** Texto definitivo de um trecho. */
  onFinal(texto: string, chave: string, confianca: number): void;
  onStatus(status: StatusVoz, detalhe?: string): void;
  /** Eventos para o registro de teste (quedas, reinícios, erros). */
  onDiagnostico(texto: string, dados?: Record<string, unknown>): void;
}

export function obterConstrutor(): Construtor | null {
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function nomeNavegador(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'outro';
}

const MENSAGENS_ERRO: Record<string, string> = {
  network: 'sem conexão com o serviço de voz',
  'not-allowed': 'microfone bloqueado — permita o acesso no cadeado da barra de endereço',
  'service-not-allowed': 'serviço de voz bloqueado pelo navegador',
  'audio-capture': 'microfone não encontrado',
  'language-not-supported': 'português não suportado neste navegador',
};

export class Reconhecedor {
  private rec: SpeechRecognitionLike | null = null;
  private desejado = false;
  private sessao = 0;
  private inicioSessao = 0;
  private falhasSeguidas = 0;
  private ultimoResultado = 0;
  private vigia: number | null = null;
  private parcialPendente: { texto: string; chave: string } | null = null;
  private ultimoErro: string | null = null;

  /** Reinicia a sessão se nada for reconhecido por este tempo (ms). */
  vigiaMs = 60_000;

  constructor(private eventos: EventosVoz, private idioma = 'pt-BR') {}

  get ativo(): boolean {
    return this.desejado;
  }

  iniciar(): void {
    const C = obterConstrutor();
    if (!C) {
      this.eventos.onStatus('sem-suporte', 'Este navegador não tem reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }
    if (this.desejado) return;
    this.desejado = true;
    this.falhasSeguidas = 0;
    this.eventos.onStatus('iniciando');
    this.abrir(C);
    this.vigia = window.setInterval(() => this.verificarVigia(), 5_000);
  }

  parar(): void {
    this.desejado = false;
    if (this.vigia !== null) window.clearInterval(this.vigia);
    this.vigia = null;
    this.descarregarParcial('parada');
    try {
      this.rec?.stop();
    } catch {
      /* já parado */
    }
    this.rec = null;
    this.eventos.onStatus('parado');
  }

  private abrir(C: Construtor): void {
    const rec = new C();
    rec.lang = this.idioma;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    const sessao = ++this.sessao;
    this.rec = rec;
    this.ultimoErro = null;

    rec.onstart = () => {
      if (sessao !== this.sessao) return;
      this.inicioSessao = Date.now();
      this.ultimoResultado = Date.now();
      this.eventos.onStatus('ouvindo');
      this.eventos.onDiagnostico('voz iniciada', { sessao });
    };

    rec.onresult = (e) => {
      if (sessao !== this.sessao) return;
      this.ultimoResultado = Date.now();
      this.falhasSeguidas = 0;
      let parcial = '';
      let chaveParcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const chave = `${sessao}:${i}`;
        if (r.isFinal) {
          const texto = r[0].transcript.trim();
          if (this.parcialPendente?.chave === chave) this.parcialPendente = null;
          if (texto) this.eventos.onFinal(texto, chave, r[0].confidence);
        } else {
          parcial += r[0].transcript;
          if (!chaveParcial) chaveParcial = chave;
        }
      }
      parcial = parcial.trim();
      this.parcialPendente = parcial ? { texto: parcial, chave: chaveParcial } : null;
      this.eventos.onParcial(parcial, chaveParcial);
    };

    rec.onerror = (e) => {
      if (sessao !== this.sessao) return;
      this.ultimoErro = e.error;
      if (e.error === 'no-speech' || e.error === 'aborted') return; // silêncio: normal
      const msg = MENSAGENS_ERRO[e.error] ?? `erro: ${e.error}`;
      this.eventos.onDiagnostico('erro de voz', { erro: e.error, mensagem: e.message ?? '' });
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
        this.desejado = false;
        if (this.vigia !== null) window.clearInterval(this.vigia);
        this.vigia = null;
      }
      this.eventos.onStatus('erro', msg);
    };

    rec.onend = () => {
      if (sessao !== this.sessao) return;
      this.descarregarParcial('queda');
      const duracao = this.inicioSessao ? Date.now() - this.inicioSessao : 0;
      if (!this.desejado) {
        this.eventos.onStatus('parado');
        return;
      }
      // Quedas muito rápidas seguidas: espera mais antes de tentar de novo.
      this.falhasSeguidas = duracao < 2_000 ? this.falhasSeguidas + 1 : 0;
      const espera = Math.min(250 * 2 ** this.falhasSeguidas, 8_000);
      this.eventos.onDiagnostico('voz caiu; reiniciando', {
        sessao,
        duracao_s: Math.round(duracao / 1000),
        ultimo_erro: this.ultimoErro,
        espera_ms: espera,
      });
      if (this.ultimoErro !== 'network') this.eventos.onStatus('reiniciando');
      window.setTimeout(() => {
        const C2 = obterConstrutor();
        if (this.desejado && C2) this.abrir(C2);
      }, espera);
    };

    try {
      rec.start();
    } catch (err) {
      this.eventos.onDiagnostico('falha ao iniciar', { erro: String(err) });
      window.setTimeout(() => {
        if (this.desejado && this.sessao === sessao) this.abrir(C);
      }, 1_500);
    }
  }

  /** Se a sessão cair com texto provisório, entrega-o como final (para não perder). */
  private descarregarParcial(motivo: string) {
    if (this.parcialPendente) {
      const { texto, chave } = this.parcialPendente;
      this.parcialPendente = null;
      this.eventos.onFinal(texto, chave, -1);
      this.eventos.onDiagnostico('trecho provisório salvo', { motivo });
    }
  }

  private verificarVigia() {
    if (!this.desejado || !this.rec) return;
    if (Date.now() - this.ultimoResultado > this.vigiaMs) {
      this.eventos.onDiagnostico('sem resultado há muito tempo; reabrindo sessão', { segundos: Math.round(this.vigiaMs / 1000) });
      this.ultimoResultado = Date.now();
      try {
        this.rec.abort(); // dispara onend, que reabre
      } catch {
        /* ignore */
      }
    }
  }
}
