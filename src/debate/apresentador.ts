// "Questões para debate": as questões aparecem no projetor, uma por vez, sem relógio, sem celular e
// sem pontos. A turma discute junta; o professor risca as alternativas descartadas, mostra as dicas
// (no "Adivinhe o conceito"), revela a resposta com a explicação e passa (ou volta) de questão.
import { abrirCanal } from '../comum/canal';
import { registrar } from '../comum/registro';
import type { Questao } from '../jogo/tipos';

export interface QuestaoDebate {
  tipo: Questao['tipo'];
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
  fundamento: string;
  dicas: string[];
}

/** O que a projeção e a tela do professor mostram. */
export interface TelaDebate {
  nome: string;
  indice: number;
  total: number;
  questao: QuestaoDebate;
  /** Alternativas riscadas (descartadas pela turma). */
  riscadas: number[];
  revelada: boolean;
  /** Conceito: quantas dicas já aparecem. */
  dicasVisiveis: number;
  fim: boolean;
}

export interface EstadoDebate {
  ativo: boolean;
  tela: TelaDebate | null;
}

interface Andamento {
  riscadas: number[];
  revelada: boolean;
  dicasVisiveis: number;
}

export const paraDebate = (q: Questao): QuestaoDebate => ({
  tipo: q.tipo,
  enunciado: q.enunciado,
  alternativas: q.alternativas,
  correta: q.correta,
  explicacao: q.explicacao,
  fundamento: q.fundamento,
  dicas: (q.dicas ?? []).filter((d) => d.trim()),
});

/** O que o próximo clique do professor faz. */
export function rotuloAvancarDebate(t: TelaDebate): string | null {
  if (t.fim) return null;
  if (t.questao.tipo === 'conceito' && !t.revelada && t.dicasVisiveis < t.questao.dicas.length) return 'Próxima dica';
  if (!t.revelada) return t.questao.tipo === 'conceito' ? 'Revelar o conceito' : 'Revelar a resposta';
  return t.indice < t.total - 1 ? 'Próxima questão' : 'Terminar';
}

class Debate {
  private estado: EstadoDebate = { ativo: false, tela: null };
  private ouvintes = new Set<() => void>();
  private questoes: QuestaoDebate[] = [];
  private andamento: Andamento[] = [];
  private nome = '';
  private vistas = new Set<number>();
  private canal = abrirCanal((m) => {
    if (m.t === 'ola' && this.estado.tela) this.canal.enviar({ t: 'debate', debate: this.estado.tela });
  });

  obter = (): EstadoDebate => this.estado;
  assinar = (f: () => void): (() => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };

  get ativo(): boolean {
    return this.estado.ativo;
  }

  private publicar(tela: TelaDebate | null) {
    this.estado = { ativo: !!tela, tela };
    this.canal.enviar({ t: 'debate', debate: tela });
    this.ouvintes.forEach((f) => f());
  }

  private mostrar(i: number, fim = false) {
    const a = this.andamento[i];
    this.publicar({ nome: this.nome, indice: i, total: this.questoes.length, questao: this.questoes[i], riscadas: a.riscadas, revelada: a.revelada, dicasVisiveis: a.dicasVisiveis, fim });
    if (!fim && !this.vistas.has(i)) {
      this.vistas.add(i);
      const q = this.questoes[i];
      void registrar('sessao', `Questão para debate ${i + 1}: ${q.tipo === 'conceito' ? `conceito "${q.enunciado}"` : q.enunciado}`, {
        alternativas: q.alternativas,
        correta: q.tipo === 'conceito' ? undefined : q.alternativas[q.correta],
        fundamento: q.fundamento || undefined,
      });
    }
  }

  iniciar(nome: string, questoes: Questao[]): void {
    const qs = questoes.filter((q) => q.enunciado.trim()).map(paraDebate);
    if (!qs.length) return;
    this.encerrar();
    this.nome = nome;
    this.questoes = qs;
    this.andamento = qs.map((q) => ({ riscadas: [], revelada: false, dicasVisiveis: q.tipo === 'conceito' ? Math.min(1, q.dicas.length) : 0 }));
    this.vistas = new Set();
    void registrar('sessao', `questões para debate abertas: ${nome}`, { questoes: qs.length });
    this.mostrar(0);
  }

  private atual(): { t: TelaDebate; a: Andamento } | null {
    const t = this.estado.tela;
    return t && !t.fim ? { t, a: this.andamento[t.indice] } : null;
  }

  /** O clique do professor (botão, Enter, passador, celular): próxima dica, revelar, próxima questão. */
  avancar(): void {
    const x = this.atual();
    if (!x) return;
    const { t, a } = x;
    if (t.questao.tipo === 'conceito' && !a.revelada && a.dicasVisiveis < t.questao.dicas.length) a.dicasVisiveis++;
    else if (!a.revelada) a.revelada = true;
    else if (t.indice < t.total - 1) return this.mostrar(t.indice + 1);
    else return this.mostrar(t.indice, true);
    this.mostrar(t.indice);
  }

  /** Volta à questão anterior (ou sai da tela de fim). */
  voltar(): void {
    const t = this.estado.tela;
    if (!t) return;
    if (t.fim) return this.mostrar(t.indice);
    if (t.indice > 0) this.mostrar(t.indice - 1);
  }

  irPara(i: number): void {
    if (i >= 0 && i < this.questoes.length) this.mostrar(i);
  }

  /** Risca (ou desfaz) uma alternativa descartada pela turma. */
  riscar(i: number): void {
    const x = this.atual();
    if (!x || x.t.questao.tipo === 'conceito') return;
    x.a.riscadas = x.a.riscadas.includes(i) ? x.a.riscadas.filter((k) => k !== i) : [...x.a.riscadas, i].sort();
    this.mostrar(x.t.indice);
  }

  /** Esconde de novo a resposta (para retomar a discussão). */
  ocultarResposta(): void {
    const x = this.atual();
    if (!x) return;
    x.a.revelada = false;
    this.mostrar(x.t.indice);
  }

  encerrar(): void {
    if (this.estado.ativo) void registrar('sessao', `questões para debate encerradas: ${this.nome}`, { debatidas: this.vistas.size, de: this.questoes.length });
    this.questoes = [];
    this.andamento = [];
    this.publicar(null);
  }
}

let instancia: Debate | null = null;
export function debate(): Debate {
  instancia ??= new Debate();
  return instancia;
}
