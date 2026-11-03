// Sincronização automática com o Google Drive: quando sincronizar, estado para a
// tela (conectado, sincronizando, erro) e login/saída.
import { db } from '../dados/db';
import { DriveGoogle, ErroAutorizacao, esquecerToken, pedirToken, revogar, tokenGuardado } from './google';
import { sincronizar } from './sincronia';

export type StatusDrive = 'desligado' | 'precisa-entrar' | 'entrando' | 'sincronizando' | 'ok' | 'erro';

export interface EstadoDrive {
  status: StatusDrive;
  email: string;
  /** Última sincronização concluída (ms). */
  ultima: number | null;
  erro: string | null;
  /** Há mudanças deste computador ainda não enviadas. */
  pendente: boolean;
  /** O que está sendo feito agora ("enviando 'Slides'…"). */
  etapa: string;
  /** Resumo da última sincronização que trouxe ou levou algo. */
  resumo: string;
}

const CHAVE_CONTA = 'vide.drive.conta';
/** Espera depois de uma mudança antes de enviar (junta várias mudanças seguidas). */
const ESPERA_MUDANCA_MS = 5_000;
/** O registro da aula muda o tempo todo: envia no máximo a cada 5 minutos. */
const ESPERA_REGISTRO_MS = 5 * 60_000;
/** Busca novidades de outros computadores. */
const INTERVALO_MS = 2 * 60_000;

function contaGuardada(): string | null {
  try {
    return localStorage.getItem(CHAVE_CONTA);
  } catch {
    return null;
  }
}

class ServicoDrive {
  private estado: EstadoDrive = {
    status: contaGuardada() !== null ? 'precisa-entrar' : 'desligado',
    email: contaGuardada() ?? '',
    ultima: null,
    erro: null,
    pendente: false,
    etapa: '',
    resumo: '',
  };
  private ouvintes = new Set<() => void>();
  private drive = new DriveGoogle(() => tokenGuardado()?.token ?? null);
  private rodando = false;
  private deNovo = false;
  /** Escritas feitas pela própria sincronização não contam como mudança local. */
  private aplicando = false;
  private agendado: number | null = null;
  private agendadoPara = Infinity;

  constructor() {
    this.ligarGanchos();
    // Voltando a uma aba que já tinha login (token ainda válido): sincroniza já.
    if (this.estado.status === 'precisa-entrar' && tokenGuardado()) {
      this.estado.status = 'ok';
      window.setTimeout(() => void this.sincronizar(), 1500);
    }
    window.setInterval(() => this.conectado() && void this.sincronizar(), INTERVALO_MS);
    window.addEventListener('focus', () => {
      if (this.conectado() && (!this.estado.ultima || Date.now() - this.estado.ultima > 30_000)) void this.sincronizar();
    });
    // Ao fechar ou trocar de aba, tenta enviar o que falta.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.estado.pendente && this.conectado()) void this.sincronizar();
    });
  }

  obter = (): EstadoDrive => this.estado;
  assinar = (f: () => void): (() => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };
  private mudar(p: Partial<EstadoDrive>) {
    this.estado = { ...this.estado, ...p };
    this.ouvintes.forEach((f) => f());
  }

  private conectado(): boolean {
    return (this.estado.status === 'ok' || this.estado.status === 'erro' || this.estado.status === 'sincronizando') && !!tokenGuardado();
  }

  /** Qualquer mudança no banco local agenda um envio. */
  private ligarGanchos() {
    const marcar = (registro: boolean) => () => {
      if (this.aplicando) return;
      this.agendar(registro ? ESPERA_REGISTRO_MS : ESPERA_MUDANCA_MS);
    };
    const tabelas = [db.questoes, db.questionarios, db.jogos, db.materiais, db.diplomas, db.itens, db.apagados] as const;
    for (const t of tabelas) {
      const f = marcar(false);
      (t as typeof db.questoes).hook('creating', f);
      (t as typeof db.questoes).hook('updating', f);
      (t as typeof db.questoes).hook('deleting', f);
    }
    const r = marcar(true);
    db.registro.hook('creating', r);
    db.registro.hook('deleting', r);
  }

  private agendar(espera: number) {
    if (this.estado.status === 'desligado') return;
    if (!this.estado.pendente) window.setTimeout(() => this.mudar({ pendente: true }), 0);
    const quando = Date.now() + espera;
    if (quando >= this.agendadoPara) return; // já há um envio marcado antes
    if (this.agendado !== null) window.clearTimeout(this.agendado);
    this.agendadoPara = quando;
    this.agendado = window.setTimeout(() => {
      this.agendado = null;
      this.agendadoPara = Infinity;
      if (this.conectado()) void this.sincronizar();
      else if (this.estado.status !== 'desligado') this.mudar({ status: 'precisa-entrar' });
    }, espera);
  }

  /** Botão "Entrar com o Google" (ou "Reconectar"). Precisa vir de um clique. */
  async entrar(): Promise<void> {
    this.mudar({ status: 'entrando', erro: null });
    try {
      await pedirToken(this.estado.email || undefined);
      const email = await this.drive.email().catch(() => this.estado.email);
      try {
        localStorage.setItem(CHAVE_CONTA, email);
      } catch {
        /* ignore */
      }
      this.mudar({ status: 'ok', email });
      await this.sincronizar();
    } catch (e) {
      this.mudar({ status: contaGuardada() !== null ? 'precisa-entrar' : 'desligado', erro: (e as Error).message });
    }
  }

  async sincronizar(): Promise<void> {
    if (!tokenGuardado()) {
      if (this.estado.status !== 'desligado') this.mudar({ status: 'precisa-entrar' });
      return;
    }
    if (this.rodando) {
      this.deNovo = true;
      return;
    }
    this.rodando = true;
    this.mudar({ status: 'sincronizando', erro: null });
    try {
      do {
        this.deNovo = false;
        this.aplicando = true;
        let r;
        try {
          r = await sincronizar(db, this.drive, (etapa) => this.mudar({ etapa }));
        } finally {
          this.aplicando = false;
        }
        if (r.mudou.has('acervo')) window.dispatchEvent(new Event('vide-acervo-mudou'));
        if (r.mudou.has('materiais')) window.dispatchEvent(new Event('vide-materiais-mudou'));
        if (r.mudou.has('questoes')) window.dispatchEvent(new Event('vide-questoes-mudou'));
        if (r.mudou.has('registro')) window.dispatchEvent(new Event('vide-registro-mudou'));
        const partes = [r.baixados.length ? `recebido: ${r.baixados.join(', ')}` : '', r.enviados.length ? `enviado: ${r.enviados.join(', ')}` : '']
          .filter(Boolean)
          .join(' · ');
        this.mudar({ status: 'ok', ultima: Date.now(), pendente: false, etapa: '', ...(partes ? { resumo: partes } : {}) });
      } while (this.deNovo);
    } catch (e) {
      if (e instanceof ErroAutorizacao) {
        esquecerToken();
        this.mudar({ status: 'precisa-entrar', etapa: '' });
      } else {
        this.mudar({ status: 'erro', etapa: '', erro: (e as Error).message || 'falha ao sincronizar' });
      }
    } finally {
      this.rodando = false;
    }
  }

  /** Desconecta o Drive (o acervo continua neste computador). */
  async sair(): Promise<void> {
    const t = tokenGuardado();
    esquecerToken();
    if (t) await revogar(t.token);
    try {
      localStorage.removeItem(CHAVE_CONTA);
    } catch {
      /* ignore */
    }
    this.mudar({ status: 'desligado', email: '', ultima: null, erro: null, pendente: false, etapa: '' });
  }

  /** Desconecta e apaga todo o Vide deste computador (o Drive continua com tudo). */
  async sairEApagar(): Promise<void> {
    if (this.estado.pendente && this.conectado()) await this.sincronizar();
    await this.sair();
    db.close();
    await db.delete();
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('vide.')) localStorage.removeItem(k);
      for (const k of Object.keys(sessionStorage)) if (k.startsWith('vide.')) sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
    location.reload();
  }
}

let instancia: ServicoDrive | null = null;
export function servicoDrive(): ServicoDrive {
  instancia ??= new ServicoDrive();
  return instancia;
}
