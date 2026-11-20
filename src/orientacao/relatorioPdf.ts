// Relatório de orientação em PDF: elementos do trabalho e/ou orientações (cronograma,
// pendências, sessões e comunicações, versões). O pdf-lib é carregado só na hora.
import { dataBR, dataHoraBR, emOrdem, pendencias, rotuloDias, situacaoEtapa } from './prazos';
import type { Interacao, Orientando, Trabalho, Versao } from './tipos';
import { CANAIS } from './tipos';
import { CAMPOS_ELEMENTOS } from './campos';
export { CAMPOS_ELEMENTOS };

export interface OpcoesRelatorio {
  elementos: boolean;
  cronograma: boolean;
  pendencias: boolean;
  sessoes: boolean;
  /** Período das sessões e comunicações ("AAAA-MM-DD"; vazio = sem limite). */
  de?: string;
  ate?: string;
  transcricoes: boolean;
  conversas: boolean;
  versoes: boolean;
  orientador?: string;
}

export interface DadosRelatorio {
  orientando?: Orientando;
  trabalho: Trabalho;
  interacoes: Interacao[];
  versoes: Pick<Versao, 'id' | 'rotulo' | 'nomeArquivo' | 'recebida_em' | 'etapaId' | 'notas'>[];
  hoje: string;
}


/** Interações do período, da mais antiga para a mais nova. */
export function interacoesDoPeriodo(l: Interacao[], de?: string, ate?: string): Interacao[] {
  return l.filter((i) => !i.excluido_em && (!de || i.em.slice(0, 10) >= de) && (!ate || i.em.slice(0, 10) <= ate)).sort((a, b) => a.em.localeCompare(b.em));
}

function seguro(s: string): string {
  return s
    .replace(/[‐‑‒–]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\t/g, '    ')
    .replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…€ŒœŠšŸŽžƒˆ˜†‡‰‹›™\n]/g, '?');
}

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 56, topo: 60, base: 58 };

/** Tamanhos padronizados (uma família só: Helvetica). */
const T = { titulo: 18, secao: 11, sub: 10, corpo: 10, meta: 8.5, tabela: 9.5 };
const ENTRELINHA = 1.45;

export async function gerarRelatorioPdf(d: DadosRelatorio, o: OpcoesRelatorio): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  type Cor = ReturnType<typeof rgb>;
  const pdf = await PDFDocument.create();
  const nome = d.orientando?.nome ?? 'Orientando';
  pdf.setTitle(`Relatório de orientação — ${nome}`);
  pdf.setCreator('Vide');
  const f = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
    italico: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  type Fonte = typeof f.normal;
  const cor = {
    tinta: rgb(0.12, 0.2, 0.18),
    cinza: rgb(0.42, 0.46, 0.44),
    claro: rgb(0.78, 0.81, 0.78),
    fundo: rgb(0.93, 0.95, 0.93),
    destaque: rgb(0.18, 0.42, 0.31),
    vermelho: rgb(0.64, 0.21, 0.12),
    ambar: rgb(0.54, 0.39, 0.06),
  };
  const largura = A4.w - M.x * 2;
  let pagina = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M.topo;
  const nova = () => {
    pagina = pdf.addPage([A4.w, A4.h]);
    y = A4.h - M.topo;
  };
  const caber = (h: number) => {
    if (y - h < M.base) nova();
  };

  /** Quebra o texto em linhas que cabem na largura. */
  const quebrar = (texto: string, fonte: Fonte, tam: number, max: number): string[] => {
    const linhas: string[] = [];
    for (const par of seguro(texto).split('\n')) {
      let atual = '';
      for (const palavra of par.split(/\s+/).filter(Boolean)) {
        const teste = atual ? `${atual} ${palavra}` : palavra;
        if (fonte.widthOfTextAtSize(teste, tam) > max && atual) {
          linhas.push(atual);
          atual = palavra;
        } else atual = teste;
      }
      linhas.push(atual);
    }
    return linhas;
  };
  const escrever = (texto: string, op: { fonte?: Fonte; tam?: number; recuo?: number; cor?: Cor; depois?: number } = {}) => {
    const fonte = op.fonte ?? f.normal;
    const tam = op.tam ?? T.corpo;
    const alt = tam * ENTRELINHA;
    const recuo = op.recuo ?? 0;
    for (const l of quebrar(texto, fonte, tam, largura - recuo)) {
      caber(alt);
      y -= alt;
      if (l) pagina.drawText(l, { x: M.x + recuo, y, size: tam, font: fonte, color: op.cor ?? cor.tinta });
    }
    y -= op.depois ?? 4;
  };
  /** Caixinha de marcar (vazia ou com ✓), com a base em (x, yb). */
  const caixa = (x: number, yb: number, marcada: boolean | 'x', lado = 8.5) => {
    pagina.drawRectangle({ x, y: yb, width: lado, height: lado, borderColor: cor.tinta, borderWidth: 0.8 });
    if (marcada === 'x') {
      pagina.drawLine({ start: { x: x + 1.8, y: yb + 1.8 }, end: { x: x + lado - 1.8, y: yb + lado - 1.8 }, thickness: 1.2, color: cor.vermelho });
      pagina.drawLine({ start: { x: x + 1.8, y: yb + lado - 1.8 }, end: { x: x + lado - 1.8, y: yb + 1.8 }, thickness: 1.2, color: cor.vermelho });
    } else if (marcada) {
      pagina.drawLine({ start: { x: x + 1.8, y: yb + lado * 0.5 }, end: { x: x + lado * 0.42, y: yb + 1.8 }, thickness: 1.2, color: cor.destaque });
      pagina.drawLine({ start: { x: x + lado * 0.42, y: yb + 1.8 }, end: { x: x + lado - 1.4, y: yb + lado - 1.2 }, thickness: 1.2, color: cor.destaque });
    }
  };
  const secao = (t: string) => {
    caber(52);
    y -= 16;
    pagina.drawText(seguro(t.toUpperCase()), { x: M.x, y: y - T.secao, size: T.secao, font: f.negrito, color: cor.destaque });
    y -= T.secao + 7;
    pagina.drawLine({ start: { x: M.x, y }, end: { x: A4.w - M.x, y }, thickness: 1, color: cor.destaque });
    y -= 10;
  };
  const subtitulo = (t: string, extra?: string) => {
    caber(32);
    y -= 4;
    escrever(t, { fonte: f.negrito, tam: T.sub, depois: extra ? 0 : 2 });
    if (extra) escrever(extra, { tam: T.meta, cor: cor.cinza, depois: 2 });
  };

  // ---------- Tabela ----------
  type Trecho = { t: string; fonte?: Fonte; cor?: Cor; tam?: number };
  type Celula = string | Trecho[] | { caixa: boolean | 'x' };
  interface Coluna {
    titulo: string;
    /** Fração da largura. */
    largura: number;
    centro?: boolean;
  }
  const PAD = { x: 6, y: 5 };
  const tabela = (colunas: Coluna[], linhas: Celula[][]) => {
    const xs: number[] = [];
    let acc = M.x;
    const ws = colunas.map((c) => c.largura * largura);
    for (const w of ws) {
      xs.push(acc);
      acc += w;
    }
    const cabecalho = () => {
      const h = T.meta * ENTRELINHA + PAD.y * 2;
      caber(h + 24);
      pagina.drawRectangle({ x: M.x, y: y - h, width: largura, height: h, color: cor.fundo });
      colunas.forEach((c, k) => {
        const t = seguro(c.titulo.toUpperCase());
        const w = f.negrito.widthOfTextAtSize(t, T.meta);
        pagina.drawText(t, { x: c.centro ? xs[k] + (ws[k] - w) / 2 : xs[k] + PAD.x, y: y - PAD.y - T.meta, size: T.meta, font: f.negrito, color: cor.tinta });
      });
      y -= h;
      pagina.drawLine({ start: { x: M.x, y }, end: { x: A4.w - M.x, y }, thickness: 0.8, color: cor.tinta });
    };
    cabecalho();
    for (const linha of linhas) {
      // Mede a linha.
      const conteudo = linha.map((cel, k) => {
        if (typeof cel === 'object' && !Array.isArray(cel)) return { caixa: cel.caixa as boolean | 'x' | undefined, partes: [] as { l: string; fonte: Fonte; cor: Cor; tam: number }[] };
        const trechos: Trecho[] = typeof cel === 'string' ? [{ t: cel }] : cel;
        const partes = trechos.flatMap((tr) => {
          const fonte = tr.fonte ?? f.normal;
          const tam = tr.tam ?? T.tabela;
          return quebrar(tr.t, fonte, tam, ws[k] - PAD.x * 2).map((l) => ({ l, fonte, cor: tr.cor ?? cor.tinta, tam }));
        });
        return { caixa: undefined as boolean | 'x' | undefined, partes };
      });
      const h = Math.max(T.tabela * ENTRELINHA, ...conteudo.map((c) => c.partes.reduce((s, p) => s + p.tam * ENTRELINHA, 0))) + PAD.y * 2;
      if (y - h < M.base) {
        nova();
        cabecalho();
      }
      conteudo.forEach((c, k) => {
        if (c.caixa !== undefined) {
          caixa(xs[k] + (ws[k] - 8.5) / 2, y - PAD.y - T.tabela + 0.5, c.caixa);
          return;
        }
        let yy = y - PAD.y;
        for (const p of c.partes) {
          yy -= p.tam * ENTRELINHA;
          const w = p.fonte.widthOfTextAtSize(p.l, p.tam);
          if (p.l) pagina.drawText(p.l, { x: colunas[k].centro ? xs[k] + (ws[k] - w) / 2 : xs[k] + PAD.x, y: yy + p.tam * (ENTRELINHA - 1) * 0.5, size: p.tam, font: p.fonte, color: p.cor });
        }
      });
      y -= h;
      pagina.drawLine({ start: { x: M.x, y }, end: { x: A4.w - M.x, y }, thickness: 0.5, color: cor.claro });
    }
    y -= 6;
  };
  const prazoTrechos = (prazo: string | undefined, aberto: boolean): Trecho[] => {
    if (!prazo) return [{ t: '—', cor: cor.cinza }];
    const s = situacaoEtapa({ id: '', nome: '', prazo }, d.hoje);
    const c = !aberto ? cor.cinza : s.tipo === 'atrasada' ? cor.vermelho : s.tipo === 'proxima' || s.tipo === 'hoje' ? cor.ambar : cor.cinza;
    return [{ t: dataBR(prazo) }, ...(aberto ? [{ t: rotuloDias(s.dias), tam: T.meta, cor: c, fonte: s.tipo === 'atrasada' ? f.negrito : f.normal }] : [])];
  };

  // ---------- Cabeçalho ----------
  const t = d.trabalho;
  escrever('RELATÓRIO DE ORIENTAÇÃO', { fonte: f.negrito, tam: T.meta, cor: cor.destaque, depois: 2 });
  escrever(nome, { fonte: f.negrito, tam: T.titulo, depois: 2 });
  escrever(`${t.tipo}${t.titulo ? ` · ${t.titulo}` : ''}`, { fonte: f.italico, tam: 11, cor: cor.tinta, depois: 8 });
  const ficha: [string, string][] = [
    ['Curso', d.orientando?.curso ?? ''],
    ['E-mail', d.orientando?.email ?? ''],
    ['Orientador(a)', o.orientador?.trim() ?? ''],
    ['Início da orientação', dataBR(t.inicio)],
    ['Defesa prevista', t.defesa ? dataBR(t.defesa) : ''],
    ['Situação', t.situacao === 'concluido' ? 'concluído' : t.situacao === 'interrompido' ? 'interrompido' : 'em andamento'],
    ['Gerado em', `${dataBR(d.hoje)}${o.sessoes && (o.de || o.ate) ? ` (sessões ${o.de ? `de ${dataBR(o.de)} ` : ''}${o.ate ? `até ${dataBR(o.ate)}` : ''})` : ''}`],
  ].filter(([, v]) => v) as [string, string][];
  // Ficha em duas colunas.
  pagina.drawLine({ start: { x: M.x, y }, end: { x: A4.w - M.x, y }, thickness: 0.5, color: cor.claro });
  y -= 8;
  for (let k = 0; k < ficha.length; k += 2) {
    caber(26);
    for (let c = 0; c < 2; c++) {
      const item = ficha[k + c];
      if (!item) continue;
      const x = M.x + c * (largura / 2);
      pagina.drawText(seguro(item[0].toUpperCase()), { x, y: y - T.meta, size: T.meta - 1, font: f.negrito, color: cor.cinza });
      pagina.drawText(seguro(quebrar(item[1], f.normal, T.corpo, largura / 2 - 10)[0] ?? ''), { x, y: y - T.meta - 13, size: T.corpo, font: f.normal, color: cor.tinta });
    }
    y -= 30;
  }
  pagina.drawLine({ start: { x: M.x, y: y + 4 }, end: { x: A4.w - M.x, y: y + 4 }, thickness: 0.5, color: cor.claro });

  // ---------- Elementos ----------
  if (o.elementos) {
    secao('Elementos do trabalho');
    const e = t.elementos;
    let algum = false;
    for (const c of CAMPOS_ELEMENTOS) {
      const bruto = e?.[c.campo];
      const v = Array.isArray(bruto) ? bruto.map((x) => x.trim()).filter(Boolean) : bruto;
      if (Array.isArray(v) ? !v.length : !v?.trim()) continue;
      algum = true;
      subtitulo(c.nome);
      if (Array.isArray(v)) v.forEach((x, k) => escrever(`${String.fromCharCode(97 + (k % 26))}) ${x}`, { recuo: 10, depois: 2 }));
      else escrever(v!.trim(), { depois: 6 });
    }
    if (!algum) escrever('Nenhum elemento registrado ainda.', { fonte: f.italico, cor: cor.cinza });
    else if (e?.atualizado_em) escrever(`Elementos atualizados em ${dataBR(e.atualizado_em)}.`, { tam: T.meta, cor: cor.cinza });
  }

  // ---------- Cronograma ----------
  if (o.cronograma) {
    secao('Cronograma');
    const etapas = emOrdem(t.etapas);
    if (!etapas.length) escrever('Sem etapas.', { fonte: f.italico, cor: cor.cinza });
    else
      tabela(
        [{ titulo: 'Etapa', largura: 0.5 }, { titulo: 'Prazo', largura: 0.2 }, { titulo: 'Situação', largura: 0.2 }, { titulo: 'Check', largura: 0.1, centro: true }],
        etapas.map((e) => {
          const s = situacaoEtapa(e, d.hoje);
          const feita = s.tipo === 'concluida';
          const sit: Trecho[] = feita
            ? [{ t: `cumprida${e.concluida_em ? ` em ${dataBR(e.concluida_em)}` : ''}`, cor: cor.destaque }]
            : [{ t: rotuloDias(s.dias), cor: s.tipo === 'atrasada' ? cor.vermelho : s.tipo === 'futura' ? cor.cinza : cor.ambar, fonte: s.tipo === 'atrasada' ? f.negrito : f.normal }];
          return [[{ t: e.nome, cor: feita ? cor.cinza : cor.tinta }], dataBR(e.prazo), sit, { caixa: feita }];
        }),
      );
  }

  // ---------- Pendências ----------
  if (o.pendencias) {
    secao('Pendências do orientando');
    const pend = pendencias(d.interacoes);
    if (!pend.length) escrever('Nenhuma sugestão ou comando em aberto.', { fonte: f.italico, cor: cor.cinza });
    else
      tabela(
        [{ titulo: 'Tipo', largura: 0.16 }, { titulo: 'Descrição', largura: 0.52 }, { titulo: 'Prazo', largura: 0.22 }, { titulo: 'Check', largura: 0.1, centro: true }],
        pend.map((p) => [
          [{ t: p.enc.tipo === 'comando' ? 'COMANDO' : 'SUGESTÃO', fonte: f.negrito, tam: T.meta, cor: p.enc.tipo === 'comando' ? cor.vermelho : cor.destaque }],
          [{ t: p.enc.texto }, { t: `combinado em ${dataBR(p.interacao.em)}`, tam: T.meta, cor: cor.cinza }],
          prazoTrechos(p.enc.prazo, true),
          { caixa: false },
        ]),
      );
  }

  // ---------- Sessões e comunicações ----------
  if (o.sessoes) {
    const lista = interacoesDoPeriodo(d.interacoes, o.de, o.ate);
    secao(`Sessões e comunicações (${lista.length})`);
    if (!lista.length) escrever('Nenhum registro no período.', { fonte: f.italico, cor: cor.cinza });
    for (const i of lista) {
      const canal = i.canal === 'sessao' ? `Sessão de orientação${i.modo ? ` (${i.modo})` : ''}` : (CANAIS.find((c) => c.id === i.canal)?.nome ?? i.canal);
      const versao = i.versaoId ? d.versoes.find((v) => v.id === i.versaoId) : undefined;
      subtitulo(`${dataHoraBR(i.em)} · ${canal}`, versao ? `Versão discutida: ${versao.rotulo}` : undefined);
      if (i.resumo.trim()) escrever(i.resumo.trim(), { depois: 4 });
      const encs = i.encaminhamentos.filter((e) => e.texto.trim());
      if (encs.length)
        tabela(
          [{ titulo: 'Tipo', largura: 0.16 }, { titulo: 'Descrição', largura: 0.52 }, { titulo: 'Prazo', largura: 0.22 }, { titulo: 'Check', largura: 0.1, centro: true }],
          encs.map((e) => [
            [{ t: e.tipo === 'comando' ? 'COMANDO' : 'SUGESTÃO', fonte: f.negrito, tam: T.meta, cor: e.tipo === 'comando' ? cor.vermelho : cor.destaque }],
            [
              { t: e.texto, cor: e.situacao === 'pendente' ? cor.tinta : cor.cinza },
              ...(e.situacao === 'cumprido' ? [{ t: `cumprido${e.resolvido_em ? ` em ${dataBR(e.resolvido_em)}` : ''}`, tam: T.meta, cor: cor.destaque }] : []),
              ...(e.situacao === 'descartado' ? [{ t: `${e.tipo === 'comando' ? 'não cumprido' : 'rejeitada'}${e.resolvido_em ? ` em ${dataBR(e.resolvido_em)}` : ''}`, tam: T.meta, cor: cor.vermelho, fonte: f.negrito }] : []),
            ],
            prazoTrechos(e.prazo, e.situacao === 'pendente'),
            { caixa: e.situacao === 'cumprido' ? true : e.situacao === 'descartado' ? 'x' : false },
          ]),
        );
      if (o.conversas && i.texto.trim()) {
        escrever(i.canal === 'sessao' ? 'Anotações' : 'Conversa', { fonte: f.negrito, tam: T.meta, cor: cor.cinza, depois: 0 });
        escrever(i.texto.trim(), { tam: T.meta + 0.5, recuo: 10, depois: 4 });
      }
      if (o.transcricoes && i.transcricao?.trim()) {
        escrever('Transcrição', { fonte: f.negrito, tam: T.meta, cor: cor.cinza, depois: 0 });
        escrever(i.transcricao.trim(), { tam: T.meta + 0.5, recuo: 10, depois: 4 });
      }
      y -= 6;
    }
  }

  // ---------- Versões ----------
  if (o.versoes) {
    secao(`Versões recebidas (${d.versoes.length})`);
    if (!d.versoes.length) escrever('Nenhuma versão guardada.', { fonte: f.italico, cor: cor.cinza });
    else
      tabela(
        [{ titulo: 'Recebida', largura: 0.16 }, { titulo: 'Versão e anotações', largura: 0.5 }, { titulo: 'Etapa', largura: 0.34 }],
        [...d.versoes]
          .sort((a, b) => a.recebida_em.localeCompare(b.recebida_em))
          .map((v) => [
            dataBR(v.recebida_em),
            [{ t: v.rotulo, fonte: f.negrito }, { t: v.nomeArquivo, tam: T.meta, cor: cor.cinza }, ...(v.notas.trim() ? [{ t: v.notas.trim(), fonte: f.italico }] : [])],
            (v.etapaId ? t.etapas.find((e) => e.id === v.etapaId)?.nome : '') || '—',
          ]),
      );
  }

  // ---------- Rodapé: página X de Y ----------
  const paginas = pdf.getPages();
  paginas.forEach((pg, k) => {
    pg.drawLine({ start: { x: M.x, y: 42 }, end: { x: A4.w - M.x, y: 42 }, thickness: 0.5, color: cor.claro });
    pg.drawText(seguro(`${nome} · Relatório de orientação`), { x: M.x, y: 30, size: 7.5, font: f.normal, color: cor.cinza });
    const num = seguro(`página ${k + 1} de ${paginas.length}`);
    pg.drawText(num, { x: A4.w - M.x - f.normal.widthOfTextAtSize(num, 7.5), y: 30, size: 7.5, font: f.normal, color: cor.cinza });
  });
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function nomeArquivoRelatorio(nome: string, hoje: string): string {
  // Sem acentos: alguns navegadores trocam por "download" um nome com acentos.
  const limpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w .-]+/g, '-').slice(0, 60);
  return `Orientacao - ${limpo} - ${hoje}.pdf`;
}
