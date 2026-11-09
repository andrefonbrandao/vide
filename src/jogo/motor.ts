// Regras do jogo de perguntas, sem rede nem tela (fácil de testar).
// Quem roda o motor é o computador do professor; os celulares só recebem o retrato.
import { conferirResposta, dicasVisiveis, normalizarResposta, pontosConceito, proximaDica } from './conceito';
import { dicasForca, errosForca, letrasDaPalavra, letraValida, MAX_ERROS_FORCA, mascararPalavra, palavraCompleta } from './forca';
import { ESPERA_NOVA_TENTATIVA_MS, type QuestaoJogo, type ResultadoPergunta } from './tipos';

export type Fase = 'sala' | 'pergunta' | 'resultado' | 'ranking' | 'fim';
/** perguntas: alternativas e "Adivinhe o conceito"; forca: a turma toda vota letras para descobrir o conceito. */
export type ModoJogo = 'perguntas' | 'forca';
export type FimForca = 'venceu' | 'perdeu' | 'encerrada';

/** Forca: a rodada como a projeção e os celulares a veem (nunca a palavra escondida). */
export interface VisaoForca {
  /** Cada caractere da palavra; null = letra ainda escondida. */
  mascara: (string | null)[];
  /** Letras já jogadas, na ordem, e as que não estão na palavra. */
  letras: string[];
  erradas: string[];
  erros: number;
  max: number;
  /** Votação atual (relógio do computador do professor) e quantos já votaram. */
  votoInicio: number;
  votoPrazo: number;
  votoMs: number;
  votaram: number;
  /** A última letra escolhida pela turma. */
  ultima: { letra: string; acertou: boolean; votos: number } | null;
  fim: FimForca | null;
  /** Quantas palavras a turma já descobriu (neste jogo). */
  placar: number;
}

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
  /** Resultado da última pergunta encerrada (no conceito, o último texto errado que digitou). */
  ultimo: { resposta: number | null; acertou: boolean; ganho: number; digitou?: string } | null;
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
  /** Adivinhe o conceito: quantas dicas estão à mostra e quem já acertou (na ordem). */
  dicasVisiveis: number;
  acertaram: { apelido: string; ms: number; dicas: number }[];
  modo: ModoJogo;
  forca: VisaoForca | null;
}

/** O que todos os celulares recebem. */
export interface VisaoAlunoComum {
  fase: Fase;
  indice: number;
  total: number;
  ranking: boolean;
  pergunta: {
    tipo: QuestaoJogo['tipo'];
    enunciado: string;
    alternativas: string[];
    restanteMs: number;
    /** Conceito: as dicas já à mostra, o total e quando vem a próxima (ms a partir de agora). */
    dicas?: string[];
    totalDicas?: number;
    proximaDicaMs?: number | null;
  } | null;
  correta: number | null;
  /** Conceito: a resposta, depois de encerrada a rodada. */
  conceito?: string | null;
  modo?: ModoJogo;
  /** Forca: a palavra mascarada e a votação (o tempo da votação vem em votoRestanteMs). */
  forca?: (Omit<VisaoForca, 'votoInicio' | 'votoPrazo'> & { votoRestanteMs: number }) | null;
  /** Forca: quantas palavras a turma já descobriu. */
  placar?: number;
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
  /** Conceito: errou a última tentativa e precisa esperar este tempo (ms) para tentar de novo. */
  aguardarMs?: number;
  errou?: boolean;
  /** Conceito, depois da rodada: o último texto errado que ele digitou ("você digitou…"). */
  digitou?: string;
  /** Forca: a letra em que votou na votação atual. */
  voto?: string | null;
}

export type ResultadoTentativa = 'certo' | 'errado' | 'aguarde' | 'invalido';

export class MotorJogo {
  fase: Fase = 'sala';
  indice = -1;
  inicio = 0;
  prazo = 0;
  private jogadores = new Map<string, Jogador>();
  /** Respostas da pergunta atual: token -> alternativa e tempo gasto. */
  private respostas = new Map<string, { alt: number; ms: number; dicas?: number }>();
  /** Conceito: última tentativa errada de cada um (para a espera de 5 s). */
  private erros = new Map<string, number>();
  /** Conceito: último texto errado de cada um e o que foi digitado na rodada (sem nomes). */
  private ultimoDigitado = new Map<string, string>();
  private tentativas = new Map<string, { texto: string; vezes: number; situacao: 'parecida' | 'errada' }>();
  /** Números de cada pergunta já encerrada (sem nomes). */
  readonly historico: ResultadoPergunta[] = [];
  /** Forca: letras jogadas, votos da votação atual (token -> letra) e como a rodada terminou. */
  private letras: string[] = [];
  private votos = new Map<string, string>();
  votoInicio = 0;
  votoPrazo = 0;
  private ultimaLetra: VisaoForca['ultima'] = null;
  private fimForca: FimForca | null = null;
  private placarForca = 0;

  constructor(
    readonly questoes: QuestaoJogo[],
    public ranking = true,
    readonly modo: ModoJogo = 'perguntas',
    readonly votoMs = 10_000,
  ) {
    // Na forca a turma joga junta: sem pontos nem ranking.
    if (modo === 'forca') this.ranking = false;
  }

  get forca(): boolean {
    return this.modo === 'forca';
  }

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

  /** Adivinhe o conceito: confere a resposta digitada. */
  responderTexto(token: string, indice: number, texto: string, agora: number): ResultadoTentativa {
    const q = this.questaoAtual;
    if (this.fase !== 'pergunta' || !q || q.tipo !== 'conceito' || indice !== this.indice) return 'invalido';
    if (!this.jogadores.has(token) || this.respostas.has(token)) return 'invalido';
    if (agora > this.prazo + 500) return 'invalido';
    const errou = this.erros.get(token);
    if (errou !== undefined && agora - errou < ESPERA_NOVA_TENTATIVA_MS) return 'aguarde';
    const t = texto.slice(0, 120).trim();
    const conf = conferirResposta(t, q.enunciado, q.aceitas ?? [], this.respostasDeOutrosConceitos());
    if (conf !== 'exata') this.anotarTentativa(t, conf);
    if (conf === 'errada') {
      this.erros.set(token, agora);
      this.ultimoDigitado.set(token, t);
      return 'errado';
    }
    this.ultimoDigitado.delete(token);
    if (this.forca) {
      // Alguém descobriu a palavra: a turma vence a rodada (sem dizer quem foi).
      this.erros.delete(token);
      this.fimForca = 'venceu';
      this.encerrarPergunta();
      return 'certo';
    }
    const ms = Math.max(0, agora - this.inicio);
    this.respostas.set(token, { alt: 0, ms, dicas: dicasVisiveis(q.dicas?.length ?? 0, q.tempo * 1000, ms) });
    this.erros.delete(token);
    return 'certo';
  }

  /** Forca: voto numa letra (pode trocar até a votação fechar). */
  votar(token: string, indice: number, letra: unknown): boolean {
    if (!this.forca || this.fase !== 'pergunta' || indice !== this.indice || !this.jogadores.has(token)) return false;
    const l = letraValida(letra);
    if (!l || this.letras.includes(l)) return false;
    this.votos.set(token, l);
    return true;
  }

  /** Todos os participantes conectados já votaram nesta votação. */
  todosVotaram(): boolean {
    const conectados = [...this.jogadores.values()].filter((j) => j.conectado);
    return conectados.length > 0 && conectados.every((j) => this.votos.has(j.token));
  }

  /** Forca: fecha a votação se acabou o tempo (ou todos votaram). Devolve true se algo mudou. */
  passoForca(agora: number): boolean {
    if (!this.forca || this.fase !== 'pergunta') return false;
    if (agora < this.votoPrazo && !this.todosVotaram()) return false;
    this.fecharVotacao(agora);
    return true;
  }

  /** A letra mais votada entra na palavra (empate: a que recebeu voto primeiro). Ninguém votou: nova votação. */
  private fecharVotacao(agora: number): void {
    const q = this.questaoAtual!;
    const contagem = new Map<string, number>();
    for (const l of this.votos.values()) contagem.set(l, (contagem.get(l) ?? 0) + 1);
    let melhor: string | null = null;
    let n = 0;
    for (const [l, c] of contagem) {
      if (c > n) {
        melhor = l;
        n = c;
      }
    }
    this.votos.clear();
    if (melhor) {
      this.letras.push(melhor);
      this.ultimaLetra = { letra: melhor, acertou: letrasDaPalavra(q.enunciado).has(melhor), votos: n };
      if (palavraCompleta(q.enunciado, this.letras)) {
        this.fimForca = 'venceu';
        this.encerrarPergunta();
        return;
      }
      if (errosForca(q.enunciado, this.letras) >= MAX_ERROS_FORCA) {
        this.fimForca = 'perdeu';
        this.encerrarPergunta();
        return;
      }
    }
    this.votoInicio = agora;
    this.votoPrazo = agora + this.votoMs;
  }

  private visaoForca(): VisaoForca | null {
    const q = this.questaoAtual;
    if (!this.forca || !q || (this.fase !== 'pergunta' && this.fase !== 'resultado')) return null;
    const tem = letrasDaPalavra(q.enunciado);
    return {
      mascara: mascararPalavra(q.enunciado, this.letras),
      letras: [...this.letras],
      erradas: this.letras.filter((l) => !tem.has(l)),
      erros: errosForca(q.enunciado, this.letras),
      max: MAX_ERROS_FORCA,
      votoInicio: this.votoInicio,
      votoPrazo: this.votoPrazo,
      votoMs: this.votoMs,
      votaram: this.votos.size,
      ultima: this.ultimaLetra,
      fim: this.fimForca,
      placar: this.placarForca,
    };
  }

  /** Respostas certas dos outros conceitos do jogo (não valem por semelhança). */
  private respostasDeOutrosConceitos(): string[] {
    return this.questoes.flatMap((q, i) => (q.tipo === 'conceito' && i !== this.indice ? [q.enunciado, ...(q.aceitas ?? [])] : []));
  }

  /** Anota, sem nome, o que foi digitado (para o professor revisar depois). */
  private anotarTentativa(texto: string, situacao: 'parecida' | 'errada') {
    const chave = normalizarResposta(texto);
    if (!chave) return;
    const t = this.tentativas.get(chave);
    if (t) {
      t.vezes++;
      if (situacao === 'parecida') t.situacao = 'parecida';
    } else this.tentativas.set(chave, { texto: texto.toLowerCase(), vezes: 1, situacao });
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
    this.erros.clear();
    this.ultimoDigitado.clear();
    this.tentativas.clear();
    this.letras = [];
    this.votos.clear();
    this.ultimaLetra = null;
    this.fimForca = null;
    if (this.forca) {
      // A rodada da forca não tem tempo total: termina quando a palavra sai ou a forca se completa.
      this.prazo = Number.MAX_SAFE_INTEGER;
      this.votoInicio = agora;
      this.votoPrazo = agora + this.votoMs;
    }
  }

  /** Fim do tempo (ou todos responderam): calcula os pontos e guarda os números. */
  encerrarPergunta(): void {
    const q = this.questaoAtual;
    if (this.fase !== 'pergunta' || !q) return;
    this.fase = 'resultado';
    if (this.forca) {
      this.fimForca ??= 'encerrada';
      const venceu = this.fimForca === 'venceu';
      if (venceu) this.placarForca++;
      for (const j of this.jogadores.values()) {
        j.ultimo = { resposta: null, acertou: venceu, ganho: 0, digitou: this.ultimoDigitado.get(j.token) };
        if (venceu) j.acertos++;
      }
      this.votos.clear();
      this.historico[this.indice] = {
        enunciado: `Forca: ${q.enunciado}`,
        alternativas: ['a turma descobriu'],
        correta: 0,
        respostas: [venceu ? 1 : 0],
        semResposta: venceu ? 0 : 1,
        questaoId: q.id,
        tentativas: [...this.tentativas.values()].sort((a, b) => b.vezes - a.vezes || a.texto.localeCompare(b.texto)),
        forca: { venceu, erros: errosForca(q.enunciado, this.letras), letras: [...this.letras] },
      };
      return;
    }
    const tempoMs = q.tempo * 1000;
    const conceito = q.tipo === 'conceito';
    const contagem = conceito ? [0] : q.alternativas.map(() => 0);
    let semResposta = 0;
    for (const j of this.jogadores.values()) {
      const r = this.respostas.get(j.token);
      if (!r) {
        j.ultimo = { resposta: null, acertou: false, ganho: 0, digitou: this.ultimoDigitado.get(j.token) };
        semResposta++;
        continue;
      }
      contagem[r.alt]++;
      const acertou = conceito || r.alt === q.correta;
      const ganho = acertou ? (conceito ? pontosConceito(r.ms, tempoMs) : calcularPontos(r.ms, tempoMs)) : 0;
      j.pontos += ganho;
      if (acertou) j.acertos++;
      j.ultimo = { resposta: r.alt, acertou, ganho };
    }
    this.historico[this.indice] = {
      enunciado: conceito ? `Conceito: ${q.enunciado}` : q.enunciado,
      alternativas: conceito ? ['acertou'] : [...q.alternativas],
      correta: conceito ? 0 : q.correta,
      respostas: contagem,
      semResposta,
      ...(conceito
        ? { questaoId: q.id, tentativas: [...this.tentativas.values()].sort((a, b) => b.vezes - a.vezes || a.texto.localeCompare(b.texto)) }
        : {}),
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
      respondidas: this.forca ? this.votos.size : this.respostas.size,
      aResponder: ativos.length,
      distribuicao: encerrada && q ? (this.historico[this.indice]?.respostas ?? null) : null,
      classificacao: this.ranking ? this.classificacao().slice(0, 10) : [],
      acertoPorPergunta: porPergunta,
      acertoGeral,
      dicasVisiveis: this.forca && q
        ? this.fase === 'resultado'
          ? (q.dicas?.length ?? 0)
          : dicasForca(q.dicas?.length ?? 0, errosForca(q.enunciado, this.letras))
        : q?.tipo === 'conceito' ? dicasVisiveis(q.dicas?.length ?? 0, q.tempo * 1000, Date.now() - this.inicio) : 0,
      modo: this.modo,
      forca: this.visaoForca(),
      acertaram:
        !this.forca && q?.tipo === 'conceito' && (this.fase === 'pergunta' || this.fase === 'resultado')
          ? [...this.respostas.entries()]
              .map(([token, r]) => ({ apelido: this.jogadores.get(token)?.apelido ?? '?', ms: r.ms, dicas: r.dicas ?? 1 }))
              .sort((a, b) => a.ms - b.ms)
          : [],
    };
  }

  visaoAlunoComum(agora: number): VisaoAlunoComum {
    const q = this.questaoAtual;
    if (this.forca) {
      const f = this.visaoForca();
      const total = q?.dicas?.length ?? 0;
      return {
        fase: this.fase,
        indice: this.indice,
        total: this.total,
        ranking: false,
        modo: 'forca',
        pergunta:
          q && this.fase === 'pergunta' && f
            ? {
                tipo: q.tipo,
                enunciado: '',
                alternativas: [],
                restanteMs: Math.max(0, this.votoPrazo - agora),
                dicas: (q.dicas ?? []).slice(0, dicasForca(total, f.erros)),
                totalDicas: total,
                proximaDicaMs: null,
              }
            : null,
        correta: null,
        conceito: q && this.fase !== 'pergunta' && this.fase !== 'sala' ? q.enunciado : null,
        forca: f ? { ...semTempos(f), votoRestanteMs: Math.max(0, f.votoPrazo - agora) } : null,
        placar: this.placarForca,
      };
    }
    return {
      fase: this.fase,
      indice: this.indice,
      total: this.total,
      ranking: this.ranking,
      pergunta:
        q && this.fase === 'pergunta'
          ? q.tipo === 'conceito'
            ? (() => {
                // O conceito (a resposta) nunca vai para o celular durante a rodada: só as dicas já à mostra.
                const total = q.dicas?.length ?? 0;
                const decorrido = agora - this.inicio;
                const prox = proximaDica(total, q.tempo * 1000, decorrido);
                return {
                  tipo: q.tipo,
                  enunciado: '',
                  alternativas: [],
                  restanteMs: Math.max(0, this.prazo - agora),
                  dicas: (q.dicas ?? []).slice(0, dicasVisiveis(total, q.tempo * 1000, decorrido)),
                  totalDicas: total,
                  proximaDicaMs: prox === null ? null : Math.max(0, prox - decorrido),
                };
              })()
            : { tipo: q.tipo, enunciado: q.enunciado, alternativas: q.alternativas, restanteMs: Math.max(0, this.prazo - agora) }
          : null,
      correta: q && this.fase !== 'pergunta' && this.fase !== 'sala' ? q.correta : null,
      conceito: q?.tipo === 'conceito' && this.fase !== 'pergunta' && this.fase !== 'sala' ? q.enunciado : null,
    };
  }

  /** Visão de cada participante, por token. */
  visoesPessoais(agora = Date.now()): Record<string, VisaoPessoal> {
    const posicoes = new Map(this.classificacao().map((c) => [c.apelido, c.posicao]));
    const saida: Record<string, VisaoPessoal> = {};
    for (const j of this.jogadores.values()) saida[j.token] = this.visaoDe(j, posicoes, agora);
    return saida;
  }

  visaoPessoal(token: string, agora = Date.now()): VisaoPessoal | null {
    const j = this.jogadores.get(token);
    if (!j) return null;
    return this.visaoDe(j, new Map(this.classificacao().map((c) => [c.apelido, c.posicao])), agora);
  }

  private visaoDe(j: Jogador, posicoes: Map<string, number>, agora: number): VisaoPessoal {
    const atual = this.fase === 'pergunta' ? this.respostas.get(j.token) : undefined;
    const errou = this.fase === 'pergunta' ? this.erros.get(j.token) : undefined;
    return {
      ...(errou !== undefined ? { errou: true, aguardarMs: Math.max(0, ESPERA_NOVA_TENTATIVA_MS - (agora - errou)) } : {}),
      apelido: j.apelido,
      pontos: j.pontos,
      posicao: this.ranking ? (posicoes.get(j.apelido) ?? null) : null,
      resposta: this.fase === 'pergunta' ? (atual?.alt ?? null) : (j.ultimo?.resposta ?? null),
      acertou: this.fase === 'pergunta' || this.fase === 'sala' ? null : (j.ultimo?.acertou ?? null),
      ganho: this.fase === 'pergunta' ? 0 : (j.ultimo?.ganho ?? 0),
      acertos: j.acertos,
      ...(this.fase !== 'pergunta' && this.fase !== 'sala' && j.ultimo?.digitou ? { digitou: j.ultimo.digitou } : {}),
      ...(this.forca && this.fase === 'pergunta' ? { voto: this.votos.get(j.token) ?? null } : {}),
    };
  }
}

function semTempos(f: VisaoForca): Omit<VisaoForca, 'votoInicio' | 'votoPrazo'> {
  const { votoInicio: _i, votoPrazo: _p, ...resto } = f;
  return resto;
}

/** O que o próximo clique do professor faz (texto do botão). Null = nada a avançar. */
export function rotuloAvancar(v: Pick<VisaoTela, 'fase' | 'indice' | 'total' | 'ranking'> & { modo?: ModoJogo }): string | null {
  const ultima = v.indice >= v.total - 1;
  const forca = v.modo === 'forca';
  switch (v.fase) {
    case 'sala':
      return 'Começar';
    case 'pergunta':
      return forca ? 'Revelar a palavra' : 'Encerrar o tempo';
    case 'resultado':
      if (ultima) return v.ranking ? 'Ver o pódio' : 'Ver o resultado final';
      if (forca) return 'Próxima palavra';
      return v.ranking ? 'Ver o placar' : 'Próxima questão';
    case 'ranking':
      return ultima ? 'Ver o pódio' : 'Próxima questão';
    default:
      return null;
  }
}
