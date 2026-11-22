// Distribui o conteúdo de um arquivo do Word pelos campos do formulário (pré-projeto ou trabalho
// final), pelos títulos: Introdução, Objetivos, cada título do desenvolvimento vira um capítulo,
// Considerações finais, Referências, Apêndices e Anexos. Tabelas e figuras viram os blocos do Vide
// (as imagens ficam marcadas com "@rId", para serem enviadas antes de gravar).
import { tirarNumero, type Elemento } from './lerDocx';
import { textoDaFigura, textoDaTabela } from './marcacao';
import { FINAL_VAZIO, novaParte } from './trabalhoFinalEstrutura';
import type { ParteNomeada, TextoFinal, TextoProjeto } from './tipos';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface Secao {
  titulo: string;
  chave: string;
  elementos: Elemento[];
}

const puro = (md: string) => md.replace(/\*\*|_|\[\[[^\]]*\]\]/g, '').trim();

/** "Resumo:" e "Abstract:" dentro do parágrafo (modelo da Uniftec: página com título, autor e o resumo,
 * sem um título "RESUMO"): tira do meio do texto e devolve à parte, com as palavras-chave. */
export function extrairResumos(elementos: Elemento[]): { resto: Elemento[]; resumo?: { texto: string; palavras: string }; abstract?: { texto: string; palavras: string } } {
  const resto: Elemento[] = [];
  const out: { resumo?: { texto: string; palavras: string }; abstract?: { texto: string; palavras: string } } = {};
  let atual: { texto: string; palavras: string } | null = null;
  for (const e of elementos) {
    if (e.k === 'p') {
      const pu = puro(e.md);
      const r = /^(resumo|abstract)\s*:\s*/i.exec(pu);
      if (r) {
        // Abstract em itálico por inteiro: tira o itálico (é a língua do texto, não destaque).
        let md = e.md;
        if (/^abstract/i.test(r[1])) md = md.replace(/^\*\*_(.*)_\*\*$/s, '**$1**').replace(/^_(.*)_$/s, '$1');
        md = md.replace(/^\*\*_?(resumo|abstract)\s*:?\s*_?\*\*\s*:?\s*/i, '').replace(/^\*\*(resumo|abstract)\s*:\s*/i, '**').replace(/^_?(resumo|abstract)\s*:?_?\s*/i, '');
        // Rótulo e texto no mesmo negrito: o texto do resumo não é negrito.
        md = md.replace(/^\*\*\*\*/, '').trim().replace(/^\*\*([^*]*)\*\*$/, '$1');
        // Abstract todo em itálico (em vários pedaços): tira as marcas de itálico.
        if (/^abstract/i.test(r[1]) && /^(\*\*)?_/.test(md)) md = md.replace(/(^|\s|\*\*)_/g, '$1').replace(/_(?=$|\s|\*\*|[.,;:)])/g, '').replace(/\*\*\s*\*\*/g, ' ').replace(/^\*\*([^*]*)\*\*$/, '$1').trim();
        atual = { texto: md, palavras: '' };
        if (/^resumo/i.test(r[1])) out.resumo = atual;
        else out.abstract = atual;
        continue;
      }
      const pc = /^(palavras?[- ]chave|key[- ]?words?)\s*:\s*/i.exec(pu);
      if (pc && atual) {
        atual.palavras = pu.replace(pc[0], '').trim();
        atual = null;
        continue;
      }
    }
    if (e.k === 'h') atual = null;
    resto.push(e);
  }
  return { resto, ...out };
}

/** Linhas do sumário ("INTRODUÇÃO 7", "2.1 Objetivos ........ 9") reconhecidas como título: saem. */
const ehLinhaDeSumario = (e: Elemento) => e.k === 'h' && !e.deEstilo && /(\.{3,}|\s)\d{1,3}$/.test(e.texto);

/** Separa por títulos de nível 1 (o que vem antes do primeiro fica em "preambulo"). */
function secoes(elementos: Elemento[]): { preambulo: Elemento[]; lista: Secao[] } {
  const lista: Secao[] = [];
  const preambulo: Elemento[] = [];
  for (const e of elementos) {
    if (e.k === 'h' && e.nivel === 1) lista.push({ titulo: e.texto, chave: norm(e.texto), elementos: [] });
    else (lista.length ? lista[lista.length - 1].elementos : preambulo).push(e);
  }
  return { preambulo, lista };
}

/** Subseções (títulos de nível 2) de uma seção. */
function subsecoes(els: Elemento[]): { antes: Elemento[]; subs: Secao[] } {
  const subs: Secao[] = [];
  const antes: Elemento[] = [];
  for (const e of els) {
    if (e.k === 'h' && e.nivel === 2) subs.push({ titulo: e.texto, chave: norm(e.texto), elementos: [] });
    else (subs.length ? subs[subs.length - 1].elementos : antes).push(e);
  }
  return { antes, subs };
}

export interface Contagem {
  paragrafos: number;
  tabelas: number;
  figuras: number;
  notas: number;
  subtitulos: number;
}
const zero = (): Contagem => ({ paragrafos: 0, tabelas: 0, figuras: 0, notas: 0, subtitulos: 0 });

/** Converte as partes no texto do campo (com as marcações do Vide). `nivelBase`: o título que vira "##". */
function paraTexto(els: Elemento[], c: Contagem, nivelBase = 2): string {
  const out: string[] = [];
  for (let k = 0; k < els.length; k++) {
    const e = els[k];
    const ant = els[k - 1];
    const prox = els[k + 1];
    if (e.k === 'h') {
      out.push(`${e.nivel <= nivelBase ? '##' : '###'} ${e.texto}`);
      c.subtitulos++;
    } else if (e.k === 'p') {
      out.push(e.cit ? `> ${e.md}` : e.md);
      c.paragrafos++;
      c.notas += e.notas;
    } else if (e.k === 'tab') {
      const leg = ant?.k === 'leg' ? ant : undefined;
      const fonte = prox?.k === 'fonte' ? prox.texto : '';
      out.push(textoDaTabela({ tipo: leg?.tipo === 'quadro' ? 'quadro' : 'tabela', titulo: leg?.titulo ?? '', fonte, linhas: e.linhas }));
      c.tabelas++;
    } else if (e.k === 'img') {
      // Legenda em cima (ABNT) ou logo embaixo.
      const leg = ant?.k === 'leg' ? ant : prox?.k === 'leg' && els[k + 2]?.k !== 'tab' && els[k + 2]?.k !== 'img' ? prox : undefined;
      const depois = leg === prox ? els[k + 2] : prox;
      const fonte = depois?.k === 'fonte' ? depois.texto : '';
      out.push(textoDaFigura({ tipo: leg?.tipo === 'grafico' ? 'grafico' : 'figura', titulo: leg?.titulo ?? '', fonte, imagem: `@${e.rid}`, largura: 100 }));
      c.figuras++;
    } else if (e.k === 'leg') {
      // Legenda sem tabela/figura ao lado: fica como parágrafo.
      const usada = prox?.k === 'tab' || prox?.k === 'img' || ant?.k === 'img';
      if (!usada) out.push(e.titulo);
    } else if (e.k === 'fonte') {
      const usada = ant?.k === 'tab' || ant?.k === 'img' || (ant?.k === 'leg' && els[k - 2]?.k === 'img');
      if (!usada) out.push(`Fonte: ${e.texto}`);
    }
  }
  return out.join('\n');
}

const linhasSimples = (els: Elemento[]) => els.flatMap((e) => (e.k === 'p' ? [e.md] : e.k === 'tab' ? e.linhas.map((l) => l.filter(Boolean).join(' – ')) : []));

export interface Destino {
  nome: string;
  contagem: Contagem;
}
export interface ResultadoImportacao<T> {
  texto: T;
  destinos: Destino[];
  ignorados: string[];
  avisos: string[];
  /** rIds das imagens usadas no texto (para enviar antes de gravar). */
  imagens: string[];
}

const ehApendice = (k: string) => /^apendice/.test(k);
const ehAnexo = (k: string) => /^anexo/.test(k);
const tituloDeParte = (t: string) => t.replace(/^(ap[êe]ndice|anexo)\s*[a-z0-9]?\s*[–—:-]?\s*/i, '').trim() || t;
const casa = (k: string, ...xs: string[]) => xs.some((x) => k === x || k.startsWith(`${x} `));

/** Resumo: "Palavras-chave: …" vai para o campo próprio. */
function resumoEPalavras(els: Elemento[], rotulo: RegExp): { texto: string; palavras: string } {
  let palavras = '';
  const ps: string[] = [];
  for (const e of els)
    if (e.k === 'p') {
      const puro = e.md.replace(/\*\*|_/g, '');
      if (rotulo.test(puro)) palavras = puro.replace(rotulo, '').trim();
      else ps.push(e.md.replace(/^\*\*(resumo|abstract)\s*:?\*\*\s*:?\s*/i, ''));
    }
  return { texto: ps.join('\n'), palavras };
}

export function importarFinal(todosEls: Elemento[], atual: TextoFinal, temEstilos: boolean): ResultadoImportacao<TextoFinal> {
  const ext = extrairResumos(todosEls.filter((e) => !ehLinhaDeSumario(e)));
  const { preambulo, lista } = secoes(ext.resto);
  // Textos que já apareceram (capa, folha de rosto…): quando se repetem num elemento pré-textual
  // (agradecimentos, dedicatória), é o começo da página do resumo, e não mais o agradecimento.
  const vistos = new Set(preambulo.flatMap((e) => (e.k === 'p' ? [puro(e.md)] : [])));
  const preTextualCom = (els: Elemento[], antes: Set<string>) => {
    const k = els.findIndex((e) => e.k === 'p' && antes.has(puro(e.md)));
    return (k >= 0 ? els.slice(0, k) : els).filter((e) => !(e.k === 'p' && /^(autor|author|orientador\s*\(?a?\)?|advisor|teacher)$|@/i.test(puro(e.md))));
  };
  const t: TextoFinal = { ...FINAL_VAZIO, titulo: atual.titulo, subtitulo: atual.subtitulo, tituloIngles: atual.tituloIngles, subtituloIngles: atual.subtituloIngles, email: atual.email };
  const destinos: Destino[] = [];
  const ignorados: string[] = [];
  const avisos: string[] = [];
  const capitulos: ParteNomeada[] = [];
  const apendices: ParteNomeada[] = [];
  const anexos: ParteNomeada[] = [];
  let fase: 'pre' | 'texto' | 'pos' = 'pre';
  const temIntroducao = lista.some((x) => casa(x.chave, 'introducao'));
  const reg = (nome: string, c: Contagem) => destinos.push({ nome, contagem: c });
  if (ext.resumo) {
    t.resumo = ext.resumo.texto;
    t.palavrasChave = ext.resumo.palavras;
    reg('Resumo', { ...zero(), paragrafos: 1 });
  }
  if (ext.abstract) {
    t.abstract = ext.abstract.texto;
    t.keywords = ext.abstract.palavras;
    reg('Abstract', { ...zero(), paragrafos: 1 });
  }
  for (const s of lista) {
    const k = s.chave;
    const c = zero();
    const soTitulo = !s.elementos.some((e) => e.k === 'p' || e.k === 'tab' || e.k === 'img');
    const anteriores = new Set(vistos);
    for (const e of s.elementos) if (e.k === 'p') vistos.add(puro(e.md));
    if (soTitulo) {
      if (!ignorados.includes(s.titulo)) ignorados.push(s.titulo);
      continue;
    }
    if (casa(k, 'resumo')) {
      const r = resumoEPalavras(s.elementos, /^palavras?[- ]chave\s*:?\s*/i);
      t.resumo = r.texto;
      t.palavrasChave = r.palavras;
      c.paragrafos = r.texto.split('\n').filter(Boolean).length;
      reg('Resumo', c);
    } else if (casa(k, 'abstract')) {
      const r = resumoEPalavras(s.elementos, /^key[- ]?words?\s*:?\s*/i);
      t.abstract = r.texto;
      t.keywords = r.palavras;
      c.paragrafos = r.texto.split('\n').filter(Boolean).length;
      reg('Abstract', c);
    } else if (casa(k, 'agradecimento', 'agradecimentos', 'dedicatoria', 'epigrafe')) {
      const els = preTextualCom(s.elementos, anteriores);
      const nome = casa(k, 'dedicatoria') ? 'Dedicatória' : casa(k, 'epigrafe') ? 'Epígrafe' : 'Agradecimentos';
      if (!els.some((e) => e.k === 'p')) {
        ignorados.push(`${s.titulo} (sem texto)`);
        continue;
      }
      const v = paraTexto(els, c);
      if (nome === 'Dedicatória') t.dedicatoria = v;
      else if (nome === 'Epígrafe') t.epigrafe = v;
      else t.agradecimentos = v;
      reg(nome, c);
    } else if (/^lista de (abreviaturas|siglas)/.test(k) || casa(k, 'siglas', 'abreviaturas')) {
      // "CC Código Civil" (separados por tabulação no Word) vira "CC – Código Civil"; o cabeçalho sai.
      t.siglas = linhasSimples(s.elementos)
        .map((l) => l.replace(/\*\*|_/g, '').trim())
        .filter((l) => l && !/^siglas?\s*(e\s+abreviaturas?)?\s*[–—-]?\s*(significados?|descri[çc][ãa]o|nome)?$/i.test(l))
        .map((l) => (/\s[–—:-]\s|:/.test(l) ? l : l.replace(/^(\S+)\s+/, '$1 – ')))
        .join('\n');
      c.paragrafos = t.siglas.split('\n').filter(Boolean).length;
      reg('Siglas', c);
    } else if (/^(sumario|lista de|indice)/.test(k)) {
      ignorados.push(s.titulo);
    } else if (casa(k, 'introducao')) {
      fase = 'texto';
      t.introducao = paraTexto(s.elementos, c);
      reg('1 Introdução', c);
    } else if (/^objetivos?\b/.test(k) || casa(k, 'justificativa')) {
      fase = 'texto';
      const { antes, subs } = subsecoes(s.elementos);
      const depois: Destino[] = []; // específicos e justificativa entram na lista depois do objetivo geral
      const regDepois = (nome: string, cs: Contagem) => depois.push({ nome, contagem: cs });
      const geral: Elemento[] = [...(casa(k, 'justificativa') ? [] : antes)];
      for (const sub of subs) {
        const cs = zero();
        if (/^objetivos? especific/.test(sub.chave)) {
          t.objetivosEspecificos = linhasSimples(sub.elementos).join('\n');
          cs.paragrafos = t.objetivosEspecificos.split('\n').filter(Boolean).length;
          regDepois('2.1.1 Objetivos específicos', cs);
        } else if (casa(sub.chave, 'justificativa')) {
          t.justificativa = paraTexto(sub.elementos, cs);
          regDepois('2.2 Justificativa', cs);
        } else if (/^objetivo/.test(sub.chave)) {
          // "Objetivo geral" (com os específicos às vezes dentro dele, como sub-subtítulo).
          const esp = sub.elementos.findIndex((e) => e.k === 'h' && /^objetivos? especific/.test(norm(e.texto)));
          if (esp >= 0) {
            t.objetivosEspecificos = linhasSimples(sub.elementos.slice(esp + 1)).join('\n');
            regDepois('2.1.1 Objetivos específicos', { ...zero(), paragrafos: t.objetivosEspecificos.split('\n').filter(Boolean).length });
            geral.push(...sub.elementos.slice(0, esp));
          } else geral.push(...sub.elementos);
        } else geral.push({ k: 'h', nivel: 2, texto: sub.titulo, deEstilo: true }, ...sub.elementos);
      }
      if (casa(k, 'justificativa')) {
        t.justificativa = paraTexto(antes, c);
        reg('2.2 Justificativa', c);
      } else if (geral.length) {
        t.objetivoGeral = paraTexto(geral, c);
        reg('2.1 Objetivo geral', c);
      }
      destinos.push(...depois.sort((a, b) => a.nome.localeCompare(b.nome)));
    } else if (casa(k, 'consideracoes finais', 'conclusao', 'conclusoes', 'consideracoes')) {
      fase = 'pos';
      t.consideracoes = paraTexto(s.elementos, c);
      reg('Considerações finais', c);
    } else if (casa(k, 'referencias', 'referencias bibliograficas', 'bibliografia')) {
      fase = 'pos';
      t.referencias = linhasSimples(s.elementos).join('\n');
      c.paragrafos = t.referencias.split('\n').filter(Boolean).length;
      reg('Referências', c);
    } else if (ehApendice(k) || ehAnexo(k)) {
      fase = 'pos';
      const parte = novaParte(tituloDeParte(s.titulo), paraTexto(s.elementos, c));
      (ehApendice(k) ? apendices : anexos).push(parte);
      reg(`${ehApendice(k) ? 'Apêndice' : 'Anexo'}: ${parte.titulo}`, c);
    } else if (!s.elementos.some((e) => e.k === 'p' || e.k === 'tab' || e.k === 'img')) {
      ignorados.push(s.titulo); // título sem texto (capa, folha de rosto…)
    } else if (fase === 'texto' || (fase === 'pre' && !temIntroducao)) {
      // Título do desenvolvimento: vira um capítulo com o mesmo nome.
      const parte = novaParte(s.titulo, paraTexto(s.elementos, c));
      capitulos.push(parte);
      reg(`Capítulo: ${parte.titulo}`, c);
    } else ignorados.push(s.titulo);
  }
  t.capitulos = capitulos.length ? capitulos : atual.capitulos.length ? atual.capitulos.map((x) => ({ ...x, texto: '' })) : [novaParte()];
  t.apendices = apendices;
  t.anexos = anexos;
  if (!lista.length) avisos.push('Nenhum título foi encontrado no arquivo. Formate os títulos com os estilos do Word (Título 1, Título 2) e importe de novo.');
  else if (!temEstilos) avisos.push('Os títulos foram reconhecidos pelo negrito (o arquivo não usa os estilos de título do Word). Confira se cada parte foi para o lugar certo.');
  if (!capitulos.length && lista.length) avisos.push('Nenhum capítulo do desenvolvimento foi encontrado entre a introdução e as considerações finais.');
  const imagens = [...new Set([...paraTodos(t)].flatMap((x) => [...x.matchAll(/^imagem: @(\S+)$/gm)].map((m) => m[1])))];
  return { texto: t, destinos, ignorados, avisos, imagens };
}

function* paraTodos(t: TextoFinal): Generator<string> {
  yield t.introducao;
  yield t.objetivoGeral;
  yield t.justificativa;
  yield t.consideracoes;
  for (const p of [...t.capitulos, ...t.apendices, ...t.anexos]) yield p.texto;
}

/** Pré-projeto: os campos do projeto de pesquisa, pelos títulos e subtítulos. */
export function importarPre(todosEls: Elemento[], atual: TextoProjeto, temEstilos: boolean): ResultadoImportacao<TextoProjeto> {
  const ext = extrairResumos(todosEls.filter((e) => !ehLinhaDeSumario(e)));
  const { lista: todas } = secoes(ext.resto);
  const lista = todas.filter((x) => x.elementos.some((e) => e.k === 'p' || e.k === 'tab' || e.k === 'img'));
  const t: TextoProjeto = { ...atual, resumo: '', palavrasChave: '', introducao: '', problema: '', hipoteses: '', objetivoGeral: '', objetivosEspecificos: '', justificativa: '', fundamentacao: '', metodo: '', populacao: '', coleta: '', analise: '', recursos: '', referencias: '' };
  const destinos: Destino[] = [];
  const ignorados: string[] = [];
  const avisos: string[] = [];
  const reg = (nome: string, c: Contagem) => destinos.push({ nome, contagem: c });
  const campo = (nome: keyof TextoProjeto, rotulo: string, els: Elemento[], simples = false) => {
    const c = zero();
    const v = simples ? linhasSimples(els).join('\n') : paraTexto(els, c);
    if (simples) c.paragrafos = v.split('\n').filter(Boolean).length;
    (t as unknown as Record<string, string>)[nome] = [(t as unknown as Record<string, string>)[nome], v].filter(Boolean).join('\n');
    reg(rotulo, c);
  };
  let fundamentacaoExtra = 0;
  if (ext.resumo) {
    t.resumo = ext.resumo.texto;
    t.palavrasChave = ext.resumo.palavras;
    reg('Resumo', { ...zero(), paragrafos: 1 });
  }
  for (const s of lista) {
    const k = s.chave;
    const { antes, subs } = subsecoes(s.elementos);
    if (casa(k, 'resumo')) {
      const r = resumoEPalavras(s.elementos, /^palavras?[- ]chave\s*:?\s*/i);
      t.resumo = r.texto;
      t.palavrasChave = r.palavras;
      reg('Resumo', { ...zero(), paragrafos: r.texto.split('\n').filter(Boolean).length });
    } else if (/^(sumario|lista de|indice|abstract|agradecimento|dedicatoria|epigrafe)/.test(k)) ignorados.push(s.titulo);
    else if (casa(k, 'introducao')) {
      const resto: Elemento[] = [...antes];
      for (const sub of subs) {
        if (/^problema/.test(sub.chave)) campo('problema', '1.1 Problema de pesquisa', sub.elementos);
        else if (/^hipotese/.test(sub.chave)) campo('hipoteses', '1.2 Hipótese(s)', sub.elementos);
        else resto.push(...sub.elementos);
      }
      campo('introducao', '1 Introdução', resto);
    } else if (/^problema/.test(k)) campo('problema', '1.1 Problema de pesquisa', s.elementos);
    else if (/^hipotese/.test(k)) campo('hipoteses', '1.2 Hipótese(s)', s.elementos);
    else if (/^objetivos?\b/.test(k) || casa(k, 'justificativa')) {
      if (casa(k, 'justificativa')) campo('justificativa', '2.3 Justificativa', s.elementos);
      else {
        if (antes.some((e) => e.k === 'p')) campo('objetivoGeral', '2.1 Objetivo geral', antes);
        for (const sub of subs) {
          if (/^objetivos? especific/.test(sub.chave)) campo('objetivosEspecificos', '2.2 Objetivos específicos', sub.elementos, true);
          else if (/^objetivo/.test(sub.chave)) {
            // Os específicos às vezes vêm dentro do geral, como sub-subtítulo.
            const esp = sub.elementos.findIndex((e) => e.k === 'h' && /^objetivos? especific/.test(norm(e.texto)));
            campo('objetivoGeral', '2.1 Objetivo geral', esp >= 0 ? sub.elementos.slice(0, esp) : sub.elementos);
            if (esp >= 0) campo('objetivosEspecificos', '2.2 Objetivos específicos', sub.elementos.slice(esp + 1), true);
          }
          else if (casa(sub.chave, 'justificativa')) campo('justificativa', '2.3 Justificativa', sub.elementos);
        }
      }
    } else if (/^(fundamentacao|referencial|revisao (de|da) literatura|marco teorico)/.test(k)) campo('fundamentacao', '3 Fundamentação teórica', s.elementos);
    else if (/^(procedimentos metodologicos|metodologia|materiais e metodos|metodo)/.test(k)) {
      if (!subs.length) campo('metodo', '4.1 Método(s) de pesquisa', s.elementos);
      else {
        if (antes.some((e) => e.k === 'p')) campo('metodo', '4.1 Método(s) de pesquisa', antes);
        for (const sub of subs) {
          if (/(popula|amostra|objeto|delimita)/.test(sub.chave)) campo('populacao', '4.2 Delimitação da população ou objeto', sub.elementos);
          else if (/coleta/.test(sub.chave)) campo('coleta', '4.3 Técnicas de coleta de dados', sub.elementos);
          else if (/analise/.test(sub.chave)) campo('analise', '4.4 Técnicas de análise de dados', sub.elementos);
          else campo('metodo', '4.1 Método(s) de pesquisa', sub.elementos);
        }
      }
    } else if (/^cronograma/.test(k)) {
      const rec = subs.find((x) => /^recursos/.test(x.chave));
      if (rec) campo('recursos', '5.1 Recursos', rec.elementos);
      ignorados.push(`${s.titulo} (o quadro vem do cronograma combinado com o orientador)`);
    } else if (/^(recursos|orcamento)/.test(k)) campo('recursos', '5.1 Recursos', s.elementos);
    else if (casa(k, 'referencias', 'referencias bibliograficas', 'bibliografia')) campo('referencias', 'Referências', s.elementos, true);
    else if (lista.findIndex((x) => casa(x.chave, 'introducao')) >= 0 && lista.findIndex((x) => casa(x.chave, 'introducao')) < lista.indexOf(s)) {
      // Outro título depois da introdução: entra na fundamentação, como subtítulo.
      campo('fundamentacao', '3 Fundamentação teórica', [{ k: 'h', nivel: 2, texto: s.titulo, deEstilo: true }, ...s.elementos]);
      fundamentacaoExtra++;
    } else ignorados.push(s.titulo);
  }
  // Destinos repetidos (vários pedaços no mesmo campo) aparecem uma vez só, somados.
  const unidos = new Map<string, Contagem>();
  for (const d of destinos) {
    const u = unidos.get(d.nome) ?? zero();
    for (const kk of Object.keys(u) as (keyof Contagem)[]) u[kk] += d.contagem[kk];
    unidos.set(d.nome, u);
  }
  if (!lista.length) avisos.push('Nenhum título foi encontrado no arquivo. Formate os títulos com os estilos do Word (Título 1, Título 2) e importe de novo.');
  else if (!temEstilos) avisos.push('Os títulos foram reconhecidos pelo negrito (o arquivo não usa os estilos de título do Word). Confira se cada parte foi para o lugar certo.');
  if (fundamentacaoExtra) avisos.push(`${fundamentacaoExtra} título(s) que não são partes do pré-projeto entraram na fundamentação teórica, como subtítulos.`);
  const imagens = [...new Set(Object.values(t).flatMap((x) => (typeof x === 'string' ? [...x.matchAll(/^imagem: @(\S+)$/gm)].map((m) => m[1]) : [])))];
  return { texto: t, destinos: [...unidos].map(([nome, contagem]) => ({ nome, contagem })), ignorados, avisos, imagens };
}

export { tirarNumero };
