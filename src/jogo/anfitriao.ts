// O jogo rodando no computador do professor: abre a sala no Cloudflare, recebe
// as respostas dos celulares, atualiza a projeção e manda a cada aluno o seu retrato.
import { abrirCanal, type TelaJogo } from '../comum/canal';
import { registrar } from '../comum/registro';
import { ConexaoSala, type StatusConexao } from '../remoto/conexao';
import { guardarResultado } from './banco';
import { MotorJogo, type ModoJogo } from './motor';
import type { DoAluno, ParaAnfitriao } from './protocolo';
import { gerarCodigoJogo, gerarToken, urlDoJogo } from './protocolo';
import type { QuestaoJogo } from './tipos';

export interface EstadoAnfitriao {
  ativo: boolean;
  nome: string;
  codigo: string;
  conexao: StatusConexao;
  tela: TelaJogo | null;
  /** Fundamento da pergunta atual ("485 VI"), para projetar depois de revelar. */
  fundamento: string;
}

const PREF_RANKING = 'vide.jogoRanking';

export function rankingPreferido(): boolean {
  try {
    return localStorage.getItem(PREF_RANKING) !== 'nao';
  } catch {
    return true;
  }
}

class Anfitriao {
  private estado: EstadoAnfitriao = { ativo: false, nome: '', codigo: '', conexao: 'desconectada', tela: null, fundamento: '' };
  private ouvintes = new Set<() => void>();
  private motor: MotorJogo | null = null;
  private sala: ConexaoSala<ParaAnfitriao, unknown> | null = null;
  private relogio: number | null = null;
  /** Conceito: quantas dicas já foram mandadas aos celulares (para mandar a próxima quando aparecer). */
  private dicasEnviadas = 0;
  private qrGrande = false;
  private canal = abrirCanal((m) => {
    // Janela de projeção (re)aberta: manda o jogo de novo.
    if (m.t === 'ola' && this.estado.tela) this.canal.enviar({ t: 'jogo', jogo: this.estado.tela });
  });

  obter = (): EstadoAnfitriao => this.estado;
  assinar = (f: () => void): (() => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };

  get ativo(): boolean {
    return this.estado.ativo;
  }

  private mudar(p: Partial<EstadoAnfitriao>) {
    this.estado = { ...this.estado, ...p };
    this.ouvintes.forEach((f) => f());
  }

  iniciar(nome: string, questoes: QuestaoJogo[], ranking: boolean, opcoes: { modo?: ModoJogo; votoS?: number } = {}): void {
    if (this.estado.ativo) this.encerrar();
    const modo = opcoes.modo ?? 'perguntas';
    // A forca usa só as questões "Adivinhe o conceito" (a palavra é o conceito).
    if (modo === 'forca') questoes = questoes.filter((q) => q.tipo === 'conceito' && q.enunciado.trim());
    if (!questoes.length) return;
    if (modo !== 'forca') {
      try {
        localStorage.setItem(PREF_RANKING, ranking ? 'sim' : 'nao');
      } catch {
        /* ignore */
      }
    }
    const codigo = gerarCodigoJogo();
    const chave = gerarToken();
    this.motor = new MotorJogo(questoes, ranking, modo, Math.max(3, opcoes.votoS ?? 10) * 1000);
    this.qrGrande = false;
    this.sala = new ConexaoSala<ParaAnfitriao, unknown>(
      codigo,
      'anfitriao',
      (m) => this.aoMensagem(m),
      (s) => {
        this.mudar({ conexao: s });
        if (s === 'conectada') this.difundir();
      },
      { rota: 'jogo', extras: { chave } },
    );
    this.mudar({ ativo: true, nome, codigo, fundamento: '' });
    registrar('sessao', `${modo === 'forca' ? 'forca' : 'jogo de perguntas'} aberto: ${nome}`, { questoes: questoes.length, ranking: modo !== 'forca' && ranking });
    this.relogio = window.setInterval(() => this.verificarTempo(), 250);
    this.publicar();
  }

  /** O clique do professor: começa, encerra o tempo, mostra o placar, próxima… */
  avancar(): void {
    if (!this.motor) return;
    this.motor.avancar(Date.now());
    this.publicar();
  }

  /** QR code grande no meio do projetor (liga/desliga). */
  alternarQrGrande(): void {
    this.qrGrande = !this.qrGrande;
    this.publicar(false);
  }

  definirRanking(ligado: boolean): void {
    if (!this.motor || this.motor.forca) return;
    this.motor.ranking = ligado;
    try {
      localStorage.setItem(PREF_RANKING, ligado ? 'sim' : 'nao');
    } catch {
      /* ignore */
    }
    if (!ligado && this.motor.fase === 'ranking') this.motor.avancar(Date.now());
    this.publicar();
  }

  encerrar(): void {
    const m = this.motor;
    if (m) {
      const perguntas = m.historico.filter(Boolean);
      const participantes = m.visaoTela().nJogadores;
      if (perguntas.length) {
        void guardarResultado({ questionario: this.estado.nome, participantes, ranking: m.ranking, perguntas });
      }
      registrar('sessao', `jogo de perguntas encerrado: ${this.estado.nome}`, {
        perguntas_feitas: perguntas.length,
        participantes,
        acerto_geral: m.visaoTela().acertoPorPergunta,
      });
    }
    this.sala?.enviar({ t: 'encerrar' });
    const sala = this.sala;
    window.setTimeout(() => sala?.fechar(), 300);
    if (this.relogio !== null) window.clearInterval(this.relogio);
    this.relogio = null;
    this.motor = null;
    this.sala = null;
    this.canal.enviar({ t: 'jogo', jogo: null });
    this.mudar({ ativo: false, tela: null, codigo: '', nome: '', conexao: 'desconectada', fundamento: '' });
  }

  private verificarTempo() {
    const m = this.motor;
    if (!m || m.fase !== 'pergunta') return;
    if (m.forca) {
      if (m.passoForca(Date.now())) this.publicar();
      return;
    }
    if (Date.now() >= m.prazo || m.todosResponderam()) {
      m.encerrarPergunta();
      this.publicar();
      return;
    }
    // Adivinhe o conceito: apareceu uma dica nova -> todos recebem.
    const v = m.visaoTela().dicasVisiveis;
    if (m.questaoAtual?.tipo === 'conceito' && v !== this.dicasEnviadas) {
      this.dicasEnviadas = v;
      this.publicar();
    }
  }

  private aoMensagem(msg: ParaAnfitriao) {
    const m = this.motor;
    if (!m) return;
    if (msg.t === 'conectados') {
      m.sincronizarConectados(new Set(msg.tokens));
      this.publicar();
      return;
    }
    if (msg.t === 'conexao') {
      if (!m.conhece(msg.token)) return; // ainda não entrou (falta o apelido)
      m.definirConectado(msg.token, msg.on);
      if (msg.on) this.enviarPara(msg.token);
      this.publicar(false);
      return;
    }
    if (msg.t !== 'do-aluno' || !msg.de) return;
    const d = msg.msg as DoAluno;
    if (d?.t === 'entrar' && typeof d.apelido === 'string') {
      const apelido = m.entrar(msg.de, d.apelido);
      if (!apelido) {
        this.sala?.enviar({ t: 'para', token: msg.de, msg: { t: 'recusado', motivo: 'A sala está cheia.' } });
        return;
      }
      this.publicar();
    } else if (d?.t === 'ola') {
      if (m.conhece(msg.de)) this.enviarPara(msg.de);
    } else if (d?.t === 'responder-texto' && Number.isInteger(d.indice) && typeof d.texto === 'string') {
      const resultado = m.responderTexto(msg.de, d.indice, d.texto, Date.now());
      this.sala?.enviar({ t: 'para', token: msg.de, msg: { t: 'tentativa', resultado } });
      this.enviarPara(msg.de);
      if (resultado === 'certo') {
        if (m.todosResponderam()) m.encerrarPergunta();
        this.publicar(m.fase !== 'pergunta');
      }
    } else if (d?.t === 'votar' && Number.isInteger(d.indice)) {
      if (m.votar(msg.de, d.indice, d.letra)) {
        this.enviarPara(msg.de);
        // Todos votaram: a letra sai na hora.
        if (m.passoForca(Date.now())) this.publicar();
        else this.publicar(false);
      }
    } else if (d?.t === 'responder' && Number.isInteger(d.indice) && Number.isInteger(d.alt)) {
      if (m.responder(msg.de, d.indice, d.alt, Date.now())) {
        this.enviarPara(msg.de);
        if (m.todosResponderam()) m.encerrarPergunta();
        this.publicar(m.fase !== 'pergunta');
      }
    }
  }

  /** Retrato só para um aluno (ao entrar, voltar ou responder). */
  private enviarPara(token: string) {
    const m = this.motor;
    if (!m) return;
    this.sala?.enviar({ t: 'para', token, msg: { t: 'jogo', ...m.visaoAlunoComum(Date.now()), voce: m.visaoPessoal(token) } });
  }

  private difundir() {
    const m = this.motor;
    if (!m) return;
    this.sala?.enviar({ t: 'difundir', comum: m.visaoAlunoComum(Date.now()), pessoal: m.visoesPessoais() });
  }

  /** Atualiza a projeção e a tela do professor (e, se pedido, todos os celulares). */
  private publicar(paraAlunos = true) {
    const m = this.motor;
    if (!m) return;
    const tela: TelaJogo = {
      ...m.visaoTela(),
      codigo: this.estado.codigo,
      enderecoCurto: `${location.host}/j`,
      url: urlDoJogo(this.estado.codigo),
      qrGrande: this.qrGrande && m.fase !== 'sala' && m.fase !== 'fim',
    };
    if (m.fase === 'pergunta') this.dicasEnviadas = tela.dicasVisiveis;
    this.canal.enviar({ t: 'jogo', jogo: tela });
    this.mudar({ tela, fundamento: m.questaoAtual?.fundamento ?? '' });
    if (paraAlunos) this.difundir();
  }
}

let instancia: Anfitriao | null = null;
export function anfitriao(): Anfitriao {
  instancia ??= new Anfitriao();
  return instancia;
}
