// Relatório de orientação em PDF: elementos do trabalho e/ou orientações (cronograma,
// pendências, sessões e comunicações, versões). O pdf-lib é carregado só na hora.
import { dataBR, dataHoraBR, emOrdem, pendencias, rotuloDias, situacaoEtapa } from './prazos';
import type { Elementos, Interacao, Orientando, Trabalho, Versao } from './tipos';
import { CANAIS } from './tipos';

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

/** Os campos dos elementos, na ordem do projeto de pesquisa. */
export const CAMPOS_ELEMENTOS: { campo: Exclude<keyof Elementos, 'atualizado_em'>; nome: string }[] = [
  { campo: 'tema', nome: 'Tema' },
  { campo: 'delimitacao', nome: 'Delimitação do tema' },
  { campo: 'problema', nome: 'Problema de pesquisa' },
  { campo: 'hipoteses', nome: 'Hipótese(s)' },
  { campo: 'objetivoGeral', nome: 'Objetivo geral' },
  { campo: 'objetivosEspecificos', nome: 'Objetivos específicos' },
  { campo: 'justificativa', nome: 'Justificativa' },
  { campo: 'metodologia', nome: 'Metodologia' },
];

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
const M = { x: 64, topo: 66, base: 60 };

export async function gerarRelatorioPdf(d: DadosRelatorio, o: OpcoesRelatorio): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const nome = d.orientando?.nome ?? 'Orientando';
  pdf.setTitle(`Relatório de orientação — ${nome}`);
  pdf.setCreator('Vide');
  const f = {
    texto: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
    italico: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansNegrito: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  type Fonte = typeof f.texto;
  const tinta = rgb(0.12, 0.16, 0.15);
  const cinza = rgb(0.4, 0.44, 0.42);
  const destaque = rgb(0.56, 0.18, 0.09);
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
  const escrever = (texto: string, op: { fonte?: Fonte; tam?: number; recuo?: number; cor?: ReturnType<typeof rgb>; depois?: number } = {}) => {
    const fonte = op.fonte ?? f.texto;
    const tam = op.tam ?? 11.5;
    const alt = tam * 1.38;
    const recuo = op.recuo ?? 0;
    for (const l of quebrar(texto, fonte, tam, largura - recuo)) {
      caber(alt);
      y -= alt;
      if (l) pagina.drawText(l, { x: M.x + recuo, y, size: tam, font: fonte, color: op.cor ?? tinta });
    }
    y -= op.depois ?? 4;
  };
  /** Item com marcador (o texto alinha depois do marcador). */
  const item = (marcador: string, texto: string, op: { recuo?: number; fonte?: Fonte; cor?: ReturnType<typeof rgb> } = {}) => {
    const tam = 11.5;
    const alt = tam * 1.38;
    const recuo = op.recuo ?? 12;
    const mw = f.texto.widthOfTextAtSize(seguro(marcador), tam) + 5;
    quebrar(texto, op.fonte ?? f.texto, tam, largura - recuo - mw).forEach((l, k) => {
      caber(alt);
      y -= alt;
      if (k === 0) pagina.drawText(seguro(marcador), { x: M.x + recuo, y, size: tam, font: f.texto, color: op.cor ?? tinta });
      if (l) pagina.drawText(l, { x: M.x + recuo + mw, y, size: tam, font: op.fonte ?? f.texto, color: op.cor ?? tinta });
    });
    y -= 3;
  };
  const titulo = (t: string) => {
    caber(48);
    y -= 14;
    pagina.drawText(seguro(t.toUpperCase()), { x: M.x, y: y - 12, size: 12, font: f.sansNegrito, color: tinta });
    y -= 18;
    pagina.drawLine({ start: { x: M.x, y: y - 2 }, end: { x: A4.w - M.x, y: y - 2 }, thickness: 0.6, color: cinza });
    y -= 10;
  };
  const subtitulo = (t: string, extra?: string) => {
    caber(34);
    y -= 6;
    escrever(t, { fonte: f.sansNegrito, tam: 10.5, depois: extra ? 0 : 2 });
    if (extra) escrever(extra, { fonte: f.sans, tam: 9, cor: cinza, depois: 2 });
  };

  // ---------- Cabeçalho ----------
  escrever('Relatório de orientação', { fonte: f.sansNegrito, tam: 18, depois: 6 });
  escrever(nome, { fonte: f.negrito, tam: 14, depois: 2 });
  const linhaCab = [d.orientando?.curso, d.orientando?.email].filter(Boolean).join(' · ');
  if (linhaCab) escrever(linhaCab, { fonte: f.sans, tam: 9.5, cor: cinza, depois: 6 });
  const t = d.trabalho;
  escrever(`${t.tipo}${t.titulo ? `: ${t.titulo}` : ''}`, { fonte: f.italico, tam: 12, depois: 2 });
  const datas = [`orientação desde ${dataBR(t.inicio)}`, t.defesa ? `defesa prevista em ${dataBR(t.defesa)}` : '', t.situacao === 'concluido' ? 'concluído' : t.situacao === 'interrompido' ? 'interrompido' : ''].filter(Boolean).join(' · ');
  escrever(datas, { fonte: f.sans, tam: 9.5, cor: cinza, depois: 2 });
  if (o.orientador?.trim()) escrever(`Orientador(a): ${o.orientador.trim()}`, { fonte: f.sans, tam: 9.5, cor: cinza, depois: 2 });
  const periodo = o.sessoes && (o.de || o.ate) ? ` · sessões ${o.de ? `de ${dataBR(o.de)}` : ''}${o.ate ? ` até ${dataBR(o.ate)}` : ''}` : '';
  escrever(`Relatório gerado em ${dataBR(d.hoje)}${periodo}`, { fonte: f.sans, tam: 9.5, cor: cinza, depois: 4 });

  // ---------- Elementos ----------
  if (o.elementos) {
    titulo('Elementos do trabalho');
    const e = t.elementos;
    let algum = false;
    for (const c of CAMPOS_ELEMENTOS) {
      const bruto = e?.[c.campo];
      const v = Array.isArray(bruto) ? bruto.map((x) => x.trim()).filter(Boolean) : bruto;
      if (Array.isArray(v) ? !v.length : !v?.trim()) continue;
      algum = true;
      subtitulo(c.nome);
      if (Array.isArray(v)) v.forEach((x, k) => item(`${String.fromCharCode(97 + (k % 26))})`, x));
      else escrever(v!.trim(), { depois: 6 });
    }
    if (!algum) escrever('Nenhum elemento registrado ainda.', { fonte: f.italico, cor: cinza });
    else if (e?.atualizado_em) escrever(`Elementos atualizados em ${dataBR(e.atualizado_em)}.`, { fonte: f.sans, tam: 8.5, cor: cinza });
  }

  // ---------- Cronograma ----------
  if (o.cronograma) {
    titulo('Cronograma');
    const etapas = emOrdem(t.etapas);
    if (!etapas.length) escrever('Sem etapas.', { fonte: f.italico, cor: cinza });
    for (const e of etapas) {
      const s = situacaoEtapa(e, d.hoje);
      const sit = s.tipo === 'concluida' ? `cumprida${e.concluida_em ? ` em ${dataBR(e.concluida_em)}` : ''}` : rotuloDias(s.dias);
      item(s.tipo === 'concluida' ? '[x]' : '[ ]', `${dataBR(e.prazo)} — ${e.nome} (${sit})`, { cor: s.tipo === 'atrasada' ? destaque : tinta });
    }
  }

  // ---------- Pendências ----------
  if (o.pendencias) {
    titulo('Pendências do orientando');
    const pend = pendencias(d.interacoes);
    if (!pend.length) escrever('Nenhuma sugestão ou comando em aberto.', { fonte: f.italico, cor: cinza });
    for (const p of pend) {
      const prazo = p.enc.prazo ? ` — até ${dataBR(p.enc.prazo)} (${rotuloDias(situacaoEtapa({ id: '', nome: '', prazo: p.enc.prazo }, d.hoje).dias)})` : '';
      item('•', `${p.enc.tipo === 'comando' ? 'Comando' : 'Sugestão'}: ${p.enc.texto}${prazo} [de ${dataBR(p.interacao.em)}]`);
    }
  }

  // ---------- Sessões e comunicações ----------
  if (o.sessoes) {
    const lista = interacoesDoPeriodo(d.interacoes, o.de, o.ate);
    titulo(`Sessões e comunicações (${lista.length})`);
    if (!lista.length) escrever('Nenhum registro no período.', { fonte: f.italico, cor: cinza });
    for (const i of lista) {
      const canal = i.canal === 'sessao' ? `Sessão de orientação${i.modo ? ` (${i.modo})` : ''}` : (CANAIS.find((c) => c.id === i.canal)?.nome ?? i.canal);
      const versao = i.versaoId ? d.versoes.find((v) => v.id === i.versaoId) : undefined;
      subtitulo(`${dataHoraBR(i.em)} — ${canal}`, versao ? `Versão discutida: ${versao.rotulo}` : undefined);
      if (i.resumo.trim()) escrever(i.resumo.trim(), { depois: 4 });
      for (const e of i.encaminhamentos) {
        const sit = e.situacao === 'cumprido' ? ' (cumprido)' : e.situacao === 'descartado' ? ' (descartado)' : '';
        item(e.situacao === 'cumprido' ? '[x]' : '[ ]', `${e.tipo === 'comando' ? 'Comando' : 'Sugestão'}: ${e.texto}${e.prazo ? ` — até ${dataBR(e.prazo)}` : ''}${sit}`);
      }
      if (o.conversas && i.texto.trim()) {
        escrever(i.canal === 'sessao' ? 'Anotações:' : 'Conversa:', { fonte: f.sansNegrito, tam: 9, cor: cinza, depois: 0 });
        escrever(i.texto.trim(), { fonte: f.sans, tam: 9, recuo: 10, depois: 4 });
      }
      if (o.transcricoes && i.transcricao?.trim()) {
        escrever('Transcrição:', { fonte: f.sansNegrito, tam: 9, cor: cinza, depois: 0 });
        escrever(i.transcricao.trim(), { fonte: f.sans, tam: 9, recuo: 10, depois: 4 });
      }
      y -= 4;
    }
  }

  // ---------- Versões ----------
  if (o.versoes) {
    titulo(`Versões recebidas (${d.versoes.length})`);
    if (!d.versoes.length) escrever('Nenhuma versão guardada.', { fonte: f.italico, cor: cinza });
    for (const v of [...d.versoes].sort((a, b) => a.recebida_em.localeCompare(b.recebida_em))) {
      const etapa = v.etapaId ? t.etapas.find((e) => e.id === v.etapaId)?.nome : undefined;
      item('•', `${dataBR(v.recebida_em)} — ${v.rotulo}${etapa ? ` (${etapa})` : ''} · ${v.nomeArquivo}`);
      if (v.notas.trim()) escrever(v.notas.trim(), { fonte: f.italico, tam: 10.5, recuo: 26, depois: 4 });
    }
  }

  // ---------- Rodapé: página X de Y ----------
  const paginas = pdf.getPages();
  paginas.forEach((pg, k) => {
    const txt = seguro(`${nome} · Relatório de orientação · página ${k + 1} de ${paginas.length}`);
    pg.drawText(txt, { x: M.x, y: 32, size: 8, font: f.sans, color: cinza });
  });
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function nomeArquivoRelatorio(nome: string, hoje: string): string {
  // Sem acentos: alguns navegadores trocam por "download" um nome com acentos.
  const limpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w .-]+/g, '-').slice(0, 60);
  return `Orientacao - ${limpo} - ${hoje}.pdf`;
}
