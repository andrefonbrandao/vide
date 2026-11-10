// O jogo "Consulta" rodando no computador do professor (sem celulares):
// mostra as falas uma a uma, conta o tempo da discussão e, no fim, a resposta.
import { abrirCanal } from '../comum/canal';
import { registrar } from '../comum/registro';
import { ELENCO, sortearConsulente } from './personagens';
import type { Caso, Fala, QuemResponde } from './tipos';

/** Intervalo entre uma fala e a próxima, ao abrir o caso. */
export const INTERVALO_FALAS_MS = 2_500;

export interface CasoNaTela {
  nome: string;
  falas: Fala[];
  resposta: string;
  quemResponde: QuemResponde;
  fundamento: string;
}

/** O que a projeção e a tela do professor mostram. */
export interface TelaConsulta {
  nome: string;
  indice: number;
  total: number;
  fase: 'caso' | 'resposta' | 'fim';
  caso: CasoNaTela;
  /** Personagens (ids do elenco). */
  consulente: string;
  respondente: string;
  falasVisiveis: number;
  /** Fim da discussão (relógio do computador do professor) e quanto faltava ao pausar. */
  prazo: number;
  duracaoMs: number;
  pausadoResta: number | null;
}

export interface EstadoConsulta {
  ativo: boolean;
  tela: TelaConsulta | null;
}

interface CasoJogo extends CasoNaTela {
  pessoa: Caso['pessoa'];
  tempoMs: number;
}

class Apresentador {
  private estado: EstadoConsulta = { ativo: false, tela: null };
  private ouvintes = new Set<() => void>();
  private casos: CasoJogo[] = [];
  private nome = '';
  private relogio: number | null = null;
  private proximaFalaEm = 0;
  private canal = abrirCanal((m) => {
    if (m.t === 'ola' && this.estado.tela) this.canal.enviar({ t: 'consulta', consulta: this.estado.tela });
  });

  obter = (): EstadoConsulta => this.estado;
  assinar = (f: () => void): (() => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };

  get ativo(): boolean {
    return this.estado.ativo;
  }

  private publicar(tela: TelaConsulta | null) {
    this.estado = { ativo: !!tela, tela };
    this.canal.enviar({ t: 'consulta', consulta: tela });
    this.ouvintes.forEach((f) => f());
  }

  private mudar(p: Partial<TelaConsulta>) {
    if (this.estado.tela) this.publicar({ ...this.estado.tela, ...p });
  }

  /** Abre a atividade. tempoMin = 0: o tempo de cada caso. */
  iniciar(nome: string, casos: Caso[], tempoMin = 0): void {
    if (!casos.length) return;
    this.encerrar();
    this.nome = nome;
    this.casos = casos.map((c) => ({
      nome: c.nome,
      falas: c.falas,
      resposta: c.resposta,
      quemResponde: c.quemResponde,
      fundamento: c.fundamento,
      pessoa: c.pessoa,
      tempoMs: Math.max(0.5, tempoMin || c.tempo || 5) * 60_000,
    }));
    void registrar('sessao', `consulta aberta: ${nome}`, { casos: casos.length });
    this.relogio = window.setInterval(() => this.tique(), 250);
    this.abrirCaso(0);
  }

  private abrirCaso(i: number) {
    const c = this.casos[i];
    const agora = Date.now();
    const consulente = sortearConsulente(c.pessoa);
    const opcoes = ELENCO.filter((p) => p.papel === c.quemResponde);
    const respondente = opcoes[Math.floor(Math.random() * opcoes.length)];
    // O tempo da discussão começa depois que a última fala aparece.
    const leitura = (c.falas.length - 1) * INTERVALO_FALAS_MS;
    this.proximaFalaEm = agora + INTERVALO_FALAS_MS;
    this.publicar({
      nome: this.nome,
      indice: i,
      total: this.casos.length,
      fase: 'caso',
      caso: { nome: c.nome, falas: c.falas, resposta: c.resposta, quemResponde: c.quemResponde, fundamento: c.fundamento },
      consulente: consulente.id,
      respondente: respondente.id,
      falasVisiveis: 1,
      prazo: agora + leitura + c.tempoMs,
      duracaoMs: c.tempoMs,
      pausadoResta: null,
    });
    void registrar('caso', `Caso: ${c.nome}`, {
      falas: c.falas.map((f) => f.texto),
      resposta: c.resposta,
      quem_responde: c.quemResponde,
      fundamento: c.fundamento,
    });
  }

  private tique() {
    const t = this.estado.tela;
    if (!t || t.fase !== 'caso') return;
    const agora = Date.now();
    if (t.falasVisiveis < t.caso.falas.length && agora >= this.proximaFalaEm) {
      this.proximaFalaEm = agora + INTERVALO_FALAS_MS;
      this.mudar({ falasVisiveis: t.falasVisiveis + 1 });
      return;
    }
    if (t.pausadoResta === null && agora >= t.prazo) this.mostrarResposta();
  }

  private mostrarResposta() {
    this.mudar({ fase: 'resposta', falasVisiveis: this.estado.tela!.caso.falas.length, pausadoResta: null });
  }

  /** O clique do professor: todas as falas, a resposta, o próximo caso… */
  avancar(): void {
    const t = this.estado.tela;
    if (!t) return;
    if (t.fase === 'caso') {
      if (t.falasVisiveis < t.caso.falas.length) {
        // Mostra as falas que faltam; o tempo da discussão começa agora.
        const resta = t.pausadoResta ?? t.duracaoMs;
        this.mudar({ falasVisiveis: t.caso.falas.length, prazo: Date.now() + Math.min(resta, t.duracaoMs) });
      } else this.mostrarResposta();
    } else if (t.fase === 'resposta') {
      if (t.indice < t.total - 1) this.abrirCaso(t.indice + 1);
      else this.mudar({ fase: 'fim' });
    }
  }

  alternarPausa(): void {
    const t = this.estado.tela;
    if (!t || t.fase !== 'caso') return;
    if (t.pausadoResta === null) this.mudar({ pausadoResta: Math.max(0, t.prazo - Date.now()) });
    else this.mudar({ prazo: Date.now() + t.pausadoResta, pausadoResta: null });
  }

  maisUmMinuto(): void {
    const t = this.estado.tela;
    if (!t || t.fase !== 'caso') return;
    if (t.pausadoResta !== null) this.mudar({ pausadoResta: t.pausadoResta + 60_000, duracaoMs: t.duracaoMs + 60_000 });
    else this.mudar({ prazo: Math.max(Date.now(), t.prazo) + 60_000, duracaoMs: t.duracaoMs + 60_000 });
  }

  encerrar(): void {
    if (this.relogio !== null) window.clearInterval(this.relogio);
    this.relogio = null;
    if (this.estado.ativo) void registrar('sessao', `consulta encerrada: ${this.nome}`);
    this.casos = [];
    this.publicar(null);
  }
}

let instancia: Apresentador | null = null;
export function apresentador(): Apresentador {
  instancia ??= new Apresentador();
  return instancia;
}
