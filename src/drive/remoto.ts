// O "lugar remoto" onde o acervo é guardado (a pasta Vide no Google Drive).
// A sincronização só conhece esta interface; nos testes, usa-se a versão em memória.

export interface ArquivoRemoto {
  id: string;
  nome: string;
  /** Etiquetas do Vide no arquivo: { vide: 'material', id: '…' }. */
  props: Record<string, string>;
  modificado: string;
}

export interface ArmazemRemoto {
  listar(): Promise<ArquivoRemoto[]>;
  baixar(id: string): Promise<Blob>;
  criar(nome: string, props: Record<string, string>, conteudo: Blob): Promise<ArquivoRemoto>;
  atualizar(id: string, conteudo: Blob, props?: Record<string, string>): Promise<ArquivoRemoto>;
  /** Manda para a lixeira (dá para recuperar no Drive por 30 dias). */
  lixeira(id: string): Promise<void>;
}

/** Armazém em memória (para testes). */
export class ArmazemMemoria implements ArmazemRemoto {
  private arquivos = new Map<string, { a: ArquivoRemoto; conteudo: Blob }>();
  private seq = 0;
  /** Quantas operações de cada tipo foram feitas (para os testes conferirem). */
  contagem = { criar: 0, atualizar: 0, baixar: 0, lixeira: 0 };

  async listar(): Promise<ArquivoRemoto[]> {
    return [...this.arquivos.values()].map((x) => ({ ...x.a, props: { ...x.a.props } }));
  }

  async baixar(id: string): Promise<Blob> {
    this.contagem.baixar++;
    const x = this.arquivos.get(id);
    if (!x) throw new Error(`arquivo ${id} não existe`);
    return x.conteudo;
  }

  async criar(nome: string, props: Record<string, string>, conteudo: Blob): Promise<ArquivoRemoto> {
    this.contagem.criar++;
    const a: ArquivoRemoto = { id: `f${++this.seq}`, nome, props: { ...props }, modificado: new Date(Date.now() + this.seq).toISOString() };
    this.arquivos.set(a.id, { a, conteudo });
    return a;
  }

  async atualizar(id: string, conteudo: Blob, props?: Record<string, string>): Promise<ArquivoRemoto> {
    this.contagem.atualizar++;
    const x = this.arquivos.get(id);
    if (!x) throw new Error(`arquivo ${id} não existe`);
    x.conteudo = conteudo;
    if (props) x.a.props = { ...x.a.props, ...props };
    x.a.modificado = new Date(Date.now() + ++this.seq).toISOString();
    return { ...x.a };
  }

  async lixeira(id: string): Promise<void> {
    this.contagem.lixeira++;
    this.arquivos.delete(id);
  }
}
