// Regras do jogo de perguntas, sem rede nem tela (fácil de testar).
// Quem roda o motor é o computador do professor; os celulares só recebem o retrato.
import type { QuestaoJogo, ResultadoPergunta } from './tipos';

export type Fase = 'sala' | 'pergunta' | 'resultado' | 'ranking' | 'fim';

export const MAX_APELIDO = 30;
export const MAX_JOGADORES = 300;

/** Pontos de uma resposta certa: 1000 se instantânea, caindo até 500 no fim do tempo. */
export function calcularPontos(msGastos: number, tempoMs: number): number {
  const f = Math.max(0, Math.min(1, msGastos / Math.max(1, tempoMs)));
  return Math.round(1000 * (1 - f / 2));
}

interface Jogador {
  token: string;
  apelido: string;
  pontos: number;
  conectado: boolean;
  acertos: number;
  /** Resultado da última pergunta encerrada. */
  ultimo: { resposta: number | null; acertou: boolean; ganho: number } | null;
}

export interface Classificado {
  apelido: string;
  pontos: number;
  posicao: number;
}

/** O que a projeção e a tela do professor mostram. */
export interface VisaoTela {
  fase: Fase;
  indice: number;
  total: number;
  ranking: boolean;
  /** Apelidos de quem está na sala (os mais recentes por último). */
  jogadores: string[];
  nJogadores: number;
  questao: QuestaoJogo | null;
  /** Início e fim do tempo da pergunta (relógio do computador do professor). */
  inicio: number;
  prazo: number;
  respondidas: number;
  /** Quantos podem responder (participantes conectados). */
  aResponder: number;
  /** Quantos marcaram cada alternativa (só depois de encerrada a pergunta). */
  distribuicao: number[] | null;
  classificacao: Classificado[];
  /** Percentual de acerto de cada pergunta e geral (no fim). */
  acertoPorPergunta: number[];
  acertoGeral: number | null;
}

/** O que todos os celulares recebem. */
export interface VisaoAlunoComum {
  fase: Fase;
  indice: number;
  total: number;
  ranking: boolean;
  pergunta: { tipo: QuestaoJogo['tipo']; enunciado: string; alternativas: string[]; restanteMs: number } | null;
  correta: number | null;
}

/** O que cada celular recebe só para si. */
export interface VisaoPessoal {
  apelido: string;
  pontos: number;
  posicao: number | null;
  /** Alternativa marcada na pergunta atual (ou na última encerrada). */
  resposta: number | null;
  acertou: boolean | null;
  ganho: number;
  acertos: number;
}

export class MotorJogo {
  fase: Fase = 'sala';
  indice = -1;
  inicio = 0;
  prazo = 0;
  private jogadores = new Map<string, Jogador>();
  /** Respostas da pergunta atual: token -> alternativa e tempo gasto. */
  private respostas = new Map<string, { alt: number; ms: number }>();
  /** Números de cada pergunta já encerrada (sem nomes). */
  readonly historico: ResultadoPergunta[] = [];

  constructor(
    readonly questoes: QuestaoJogo[],
    public ranking = true,
  ) {}

  get total(): number {
    return this.questoes.length;
  }

  get questaoAtual(): QuestaoJogo | null {
    return this.indice >= 0 && this.indice < this.questoes.length ? this.questoes[this.indice] : null;
  }

  get ultima(): boolean {
    return this.indice >= this.questoes.length - 1;
  }

  /** Entra (ou volta) na sala. Devolve o apelido usado, ou null se a sala está cheia. */
  entrar(token: string, apelidoPedido: string): string | null {
    const existente = this.jogadores.get(token);
    if (existente) {
      existente.conectado = true;
      return existente.apelido;
    }
    if (this.jogadores.size >= MAX_JOGADORES) return null;
    const base = apelidoPedido.replace(/\s+/g, ' ').trim().slice(0, MAX_APELIDO) || 'Participante';
    let apelido = base;
    const usados = new Set([...this.jogadores.values()].map((j) => j.apelido.toLowerCase()));
    for (let n = 2; usados.has(apelido.toLowerCase()); n++) apelido = `${base} ${n}`;
    this.jogadores.set(token, { token, apelido, pontos: 0, conectado: true, acertos: 0, ultimo: null });
    return apelido;
  }

  conhece(token: string): boolean {
    return this.jogadores.has(token);
  }

  /** Depois de uma reconexão do professor: só estes continuam conectados. */
  sincronizarConectados(tokens: Set<string>): void {
    for (const j of this.jogadores.values()) j.conectado = tokens.has(j.token);
  }

  definirConectado(token: string, conectado: boolean): void {
    const j = this.jogadores.get(token);
    if (j) j.conectado = conectado;
  }

  /** Registra a resposta. Só vale a primeira, dentro do tempo, da pergunta atual. */
  responder(token: string, indice: number, alt: number, agora: number): boolean {
    const q = this.questaoAtual;
    if (this.fase !== 'pergunta' || !q || indice !== this.indice) return false;
    if (!this.jogadores.has(token) || this.respostas.has(token)) return false;
    if (!Number.isInteger(alt) || alt < 0 || alt >= q.alternativas.length) return false;
    if (agora > this.prazo + 500) return false; // folga pequena para a rede
    this.respostas.set(token, { alt, ms: Math.max(0, agora - this.inicio) });
    return true;
  }

  get respondidas(): number {
    return this.respostas.size;
  }

  get conectados(): number {
    return [...this.jogadores.values()].filter((j) => j.conectado).length;
  }

  /** Todos os participantes conectados já responderam. */
  todosResponderam(): boolean {
    const conectados = [...this.jogadores.values()].filter((j) => j.conectado);
    return conectados.length > 0 && conectados.every((j) => this.respostas.has(j.token));
  }

  private iniciarPergunta(agora: number): void {
    this.indice++;
    const q = this.questaoAtual!;
    this.fase = 'pergunta';
    this.inicio = agora;
    this.prazo = agora + q.tempo * 1000;
    this.respostas.clear();
  }

  /** Fim do tempo (ou todos responderam): calcula os pontos e guarda os números. */
  encerrarPergunta(): void {
    const q = this.questaoAtual;
    if (this.fase !== 'pergunta' || !q) return;
    this.fase = 'resultado';
    const tempoMs = q.tempo * 1000;
    const contagem = q.alternativas.map(() => 0);
    let semResposta = 0;
    for (const j of this.jogadores.values()) {
      const r = this.respostas.get(j.token);
      if (!r) {
        j.ultimo = { resposta: null, acertou: false, ganho: 0 };
        semResposta++;
        continue;
      }
      contagem[r.alt]++;
      const acertou = r.alt === q.correta;
      const ganho = acertou ? calcularPontos(r.ms, tempoMs) : 0;
      j.pontos += ganho;
      if (acertou) j.acertos++;
      j.ultimo = { resposta: r.alt, acertou, ganho };
    }
    this.historico[this.indice] = {
      enunciado: q.enunciado,
      alternativas: [...q.alternativas],
      correta: q.correta,
      respostas: contagem,
      semResposta,
    };
  }

  /** Próximo passo (o clique do professor). */
  avancar(agora: number): void {
    if (!this.questoes.length) return;
    switch (this.fase) {
      case 'sala':
        this.iniciarPergunta(agora);
        break;
      case 'pergunta':
        this.encerrarPergunta();
        break;
      case 'resultado':
        if (this.ultima) this.fase = 'fim';
        else if (this.ranking) this.fase = 'ranking';
        else this.iniciarPergunta(agora);
        break;
      case 'ranking':
        if (this.ultima) this.fase = 'fim';
        else this.iniciarPergunta(agora);
        break;
      case 'fim':
        break;
    }
  }

  classificacao(): Classificado[] {
    const lista = [...this.jogadores.values()].sort((a, b) => b.pontos - a.pontos || a.apelido.localeCompare(b.apelido));
    let posicao = 0;
    let anterior = -1;
    return lista.map((j, i) => {
      if (j.pontos !== anterior) posicao = i + 1;
      anterior = j.pontos;
      return { apelido: j.apelido, pontos: j.pontos, posicao };
    });
  }

  private acertoPorPergunta(): number[] {
    return this.historico.map((h) => {
      const total = h.respostas.reduce((s, n) => s + n, 0) + h.semResposta;
      return total ? Math.round((h.respostas[h.correta] / total) * 100) : 0;
    });
  }

  visaoTela(): VisaoTela {
    const q = this.questaoAtual;
    const encerrada = this.fase === 'resultado' || this.fase === 'ranking' || this.fase === 'fim';
    const ativos = [...this.jogadores.values()].filter((j) => j.conectado);
    const porPergunta = this.acertoPorPergunta();
    let acertoGeral: number | null = null;
    if (this.fase === 'fim' && this.historico.length) {
      let certas = 0;
      let todas = 0;
      for (const h of this.historico) {
        if (!h) continue;
        certas += h.respostas[h.correta];
        todas += h.respostas.reduce((s, n) => s + n, 0) + h.semResposta;
      }
      acertoGeral = todas ? Math.round((certas / todas) * 100) : 0;
    }
    return {
      fase: this.fase,
      indice: this.indice,
      total: this.total,
      ranking: this.ranking,
      jogadores: ativos.map((j) => j.apelido).slice(-80),
      nJogadores: ativos.length,
      questao: q,
      inicio: this.inicio,
      prazo: this.prazo,
      respondidas: this.respostas.size,
      aResponder: ativos.length,
      distribuicao: encerrada && q ? (this.historico[this.indice]?.respostas ?? null) : null,
      classificacao: this.ranking ? this.classificacao().slice(0, 10) : [],
      acertoPorPergunta: porPergunta,
      acertoGeral,
    };
  }

  visaoAlunoComum(agora: number): VisaoAlunoComum {
    const q = this.questaoAtual;
    return {
      fase: this.fase,
      indice: this.indice,
      total: this.total,
      ranking: this.ranking,
      pergunta:
        q && this.fase === 'pergunta'
          ? { tipo: q.tipo, enunciado: q.enunciado, alternativas: q.alternativas, restanteMs: Math.max(0, this.prazo - agora) }
          : null,
      correta: q && this.fase !== 'pergunta' && this.fase !== 'sala' ? q.correta : null,
    };
  }

  /** Visão de cada participante, por token. */
  visoesPessoais(): Record<string, VisaoPessoal> {
    const posicoes = new Map(this.classificacao().map((c) => [c.apelido, c.posicao]));
    const saida: Record<string, VisaoPessoal> = {};
    for (const j of this.jogadores.values()) saida[j.token] = this.visaoDe(j, posicoes);
    return saida;
  }

  visaoPessoal(token: string): VisaoPessoal | null {
    const j = this.jogadores.get(token);
    if (!j) return null;
    return this.visaoDe(j, new Map(this.classificacao().map((c) => [c.apelido, c.posicao])));
  }

  private visaoDe(j: Jogador, posicoes: Map<string, number>): VisaoPessoal {
    const atual = this.fase === 'pergunta' ? this.respostas.get(j.token) : undefined;
    return {
      apelido: j.apelido,
      pontos: j.pontos,
      posicao: this.ranking ? (posicoes.get(j.apelido) ?? null) : null,
      resposta: this.fase === 'pergunta' ? (atual?.alt ?? null) : (j.ultimo?.resposta ?? null),
      acertou: this.fase === 'pergunta' || this.fase === 'sala' ? null : (j.ultimo?.acertou ?? null),
      ganho: this.fase === 'pergunta' ? 0 : (j.ultimo?.ganho ?? 0),
      acertos: j.acertos,
    };
  }
}

/** O que o próximo clique do professor faz (texto do botão). Null = nada a avançar. */
export function rotuloAvancar(v: Pick<VisaoTela, 'fase' | 'indice' | 'total' | 'ranking'>): string | null {
  const ultima = v.indice >= v.total - 1;
  switch (v.fase) {
    case 'sala':
      return 'Começar';
    case 'pergunta':
      return 'Encerrar o tempo';
    case 'resultado':
      if (ultima) return v.ranking ? 'Ver o pódio' : 'Ver o resultado final';
      return v.ranking ? 'Ver o placar' : 'Próxima questão';
    case 'ranking':
      return ultima ? 'Ver o pódio' : 'Próxima questão';
    default:
      return null;
  }
}
