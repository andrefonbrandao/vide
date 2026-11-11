// O processo da turma em aula: projetado (só o que a turma já vê), com a peça que o
// professor abrir e a rolagem acompanhando a tela do professor. Liberar um evento aqui
// também atualiza o link dos alunos.
import { abrirCanal } from '../comum/canal';
import { registrar } from '../comum/registro';
import { lerProcesso, salvarProcesso } from './banco';
import { liberado, paraAluno } from './liberacao';
import { comArtigos, comCliente, dadosParaPublicar, liberaEm, publicarProcesso } from './publicar';
import type { DadosProcesso, Evento, Processo } from './tipos';

export interface LeituraProcesso {
  eventoId: string;
  docId: string;
}

/** O que a projeção mostra. */
export interface TelaProcesso {
  dados: DadosProcesso;
  lendo: LeituraProcesso | null;
  /** Rolagem (0 a 1), acompanhando a tela do professor. */
  fracao: number;
  /** Caça aos vícios: o professor mostra os vícios plantados na projeção. */
  vicios?: boolean;
}

export interface EstadoAulaProcesso {
  ativo: boolean;
  processo: Processo | null;
  tela: TelaProcesso | null;
  aviso: string | null;
}

class AulaProcesso {
  private estado: EstadoAulaProcesso = { ativo: false, processo: null, tela: null, aviso: null };
  private ouvintes = new Set<() => void>();
  private canal = abrirCanal((m) => {
    if (m.t === 'ola' && this.estado.tela) this.canal.enviar({ t: 'processo', processo: this.estado.tela });
  });

  obter = (): EstadoAulaProcesso => this.estado;
  assinar = (f: () => void): (() => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };

  get ativo(): boolean {
    return this.estado.ativo;
  }

  private mudar(p: Partial<EstadoAulaProcesso>, projetar = true) {
    this.estado = { ...this.estado, ...p };
    if (projetar) this.canal.enviar({ t: 'processo', processo: this.estado.tela });
    this.ouvintes.forEach((f) => f());
  }

  private async montar(p: Processo, lendo: LeituraProcesso | null, fracao: number, vicios = false): Promise<TelaProcesso> {
    const dados = paraAluno(await comCliente(await comArtigos(dadosParaPublicar(p, { comVicios: vicios })), p), Date.now());
    return { dados, lendo, fracao, vicios };
  }

  /** Mostra (ou esconde) os vícios plantados na projeção. */
  async mostrarVicios(sim: boolean): Promise<void> {
    const p = this.estado.processo;
    const t = this.estado.tela;
    if (!p || !t) return;
    this.mudar({ tela: await this.montar(p, t.lendo, t.fracao, sim) });
    void registrar('sessao', `processo: vícios ${sim ? 'mostrados' : 'escondidos'} na projeção`);
  }

  async abrir(id: string): Promise<void> {
    const p = await lerProcesso(id);
    if (!p) return;
    this.mudar({ ativo: true, processo: p, tela: await this.montar(p, null, 0), aviso: null });
    void registrar('sessao', `processo aberto na aula: ${p.titulo}`, { numero: p.capa.numero });
  }

  ler(l: LeituraProcesso | null): void {
    const t = this.estado.tela;
    if (!t) return;
    this.mudar({ tela: { ...t, lendo: l, fracao: 0 } });
    if (l) {
      const e = t.dados.eventos.find((x) => x.id === l.eventoId);
      const d = e?.documentos.find((x) => x.id === l.docId);
      if (e && d) void registrar('projetado', `Processo · evento ${(e as { numero?: number }).numero ?? ''} · ${d.sigla} (${d.titulo || e.descricao})`, { processo: this.estado.processo?.capa.numero });
    }
  }

  rolar(fracao: number): void {
    const t = this.estado.tela;
    if (!t) return;
    this.estado = { ...this.estado, tela: { ...t, fracao } };
    this.canal.enviar({ t: 'processo-rolar', fracao });
  }

  /** Eventos que a turma ainda não vê, na ordem. */
  pendentes(): { e: Evento; numero: number }[] {
    const p = this.estado.processo;
    if (!p) return [];
    const agora = Date.now();
    return p.eventos.map((e, i) => ({ e, numero: i + 1 })).filter(({ e }) => !liberado({ libera: liberaEm(e) }, agora));
  }

  /** Libera um evento agora: na projeção e, se publicado, no link da turma. */
  async liberar(eventoId: string): Promise<void> {
    const p = this.estado.processo;
    if (!p) return;
    let novo: Processo = { ...p, eventos: p.eventos.map((e) => (e.id === eventoId ? { ...e, liberacao: { modo: 'agora' as const } } : e)) };
    novo = await salvarProcesso(novo);
    const t = this.estado.tela;
    this.mudar({ processo: novo, tela: await this.montar(novo, t?.lendo ?? null, t?.fracao ?? 0, t?.vicios), aviso: novo.publicacao ? 'Liberado. Atualizando o link da turma…' : 'Liberado na projeção (o processo ainda não tem link para a turma).' });
    const ev = novo.eventos.findIndex((e) => e.id === eventoId);
    void registrar('sessao', `processo: evento ${ev + 1} liberado na aula`, { descricao: novo.eventos[ev]?.descricao });
    if (!novo.publicacao) return;
    try {
      const pub = await publicarProcesso(novo);
      const salvo = await salvarProcesso({ ...novo, publicacao: pub });
      this.mudar({ processo: salvo, aviso: 'Liberado. A turma já vê no link.' }, false);
    } catch (e) {
      this.mudar({ aviso: `Liberado na projeção, mas o link não foi atualizado: ${(e as Error).message}` }, false);
    }
  }

  fechar(): void {
    if (this.estado.processo) void registrar('sessao', `processo fechado na aula: ${this.estado.processo.titulo}`);
    this.mudar({ ativo: false, processo: null, tela: null, aviso: null });
  }
}

let instancia: AulaProcesso | null = null;
export function aulaProcesso(): AulaProcesso {
  instancia ??= new AulaProcesso();
  return instancia;
}
