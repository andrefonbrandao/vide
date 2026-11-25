// Plano de ensino: a parte fixa fica na disciplina (ementa, competências, conteúdo, avaliação,
// bibliografia); da turma vêm o horário, o semestre e a data do documento.
import { db } from '../dados/db';
import { agoraISO } from '../dados/modelo';
import { abrirZip, lerXml, type No } from '../orientacao/lerDocx';
import { avisarMudancaTurmas } from './banco';
import type { Disciplina, PlanoEnsino, Turma, UnidadeConteudo } from './tipos';

export function planoEnsinoVazio(professor = ''): PlanoEnsino {
  const grau = () => ({ descricao: '', peso: '10 pontos' });
  return {
    cargaHoraria: '',
    professor,
    coordenador: '',
    ementa: '',
    competencias: [''],
    habilidades: [''],
    conteudo: [{ titulo: '', itens: [''] }],
    estrategias:
      'O processo de avaliação tem caráter diagnóstico, formativo e somativo. Por essa razão, serão utilizados diferentes instrumentos avaliativos, a favor do desenvolvimento do acadêmico protagonista e da construção da aprendizagem significativa. Abaixo são apresentadas as estratégias de avaliação do processo ensino-aprendizagem.',
    graus: { A: grau(), B: grau(), C: grau() },
    recuperacao: { descricao: '', estrategias: '' },
    bibliografiaBasica: [''],
    bibliografiaComplementar: [''],
    cidade: 'Caxias do Sul',
  };
}

export async function salvarPlanoEnsino(d: Disciplina, plano: PlanoEnsino): Promise<Disciplina> {
  const atual = (await db.disciplinas.get(d.id)) ?? d;
  const novo = { ...atual, planoEnsino: plano, atualizado_em: agoraISO() };
  await db.disciplinas.put(novo);
  avisarMudancaTurmas();
  return novo;
}

export async function salvarDataPlanoEnsino(t: Turma, data: string): Promise<Turma> {
  const atual = (await db.turmas.get(t.id)) ?? t;
  const novo = { ...atual, dataPlanoEnsino: data || undefined, atualizado_em: agoraISO() };
  await db.turmas.put(novo);
  avisarMudancaTurmas();
  return novo;
}

/** "19:00 às 22:00" (os horários diferentes da turma, separados por ponto e vírgula). */
export function horarioTexto(t: Pick<Turma, 'horarios'>): string {
  return [...new Set(t.horarios.map((h) => `${h.inicio} às ${h.fim}`))].join('; ');
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
/** "Caxias do Sul, 30 de Julho de 2026." */
export function localEData(cidade: string, data: string): string {
  const d = `${Number(data.slice(8, 10))} de ${MESES[Number(data.slice(5, 7)) - 1] ?? ''} de ${data.slice(0, 4)}`;
  return `${cidade.trim() ? `${cidade.trim()}, ` : ''}${d}.`;
}

/** Divide "texto **negrito** texto" em pedaços para desenhar. */
export function pedacosNegrito(t: string): { t: string; b: boolean }[] {
  return t
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((p) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? { t: p.slice(2, -2), b: true } : { t: p, b: false }));
}

/** As regras de aprovação da instituição (iguais em todas as disciplinas). */
export const REGRAS_APROVACAO: { t: string; tipo?: 'formula' | 'lista' | 'nota' }[] = [
  { t: 'Para aprovação na unidade curricular, segundo o regimento estabelecido pela instituição de ensino, será aprovado o discente com frequência igual ou superior a 75% que obter média mínima 7,0 (sete) entre Grau A e Grau B, conforme equação abaixo:' },
  { t: 'MÉDIA = (GRAU A + GRAU B) / 2', tipo: 'formula' },
  { t: 'O/a acadêmico(a) que atingir média maior ou igual a 7,0 (sete) estará aprovado.' },
  { t: 'Caso contrário, deverá realizar a avaliação que corresponde ao GRAU C e satisfazer os dois critérios seguintes:' },
  { t: '1. Atingir média igual ou superior a 5,0 (cinco) a partir da equação abaixo:', tipo: 'lista' },
  { t: 'MÉDIA FINAL = (GRAU A + GRAU B + GRAU C) / 3', tipo: 'formula' },
  { t: '2. Alcançar, no mínimo, nota 5,0 (cinco) na avaliação de Grau C.*', tipo: 'lista' },
  { t: 'Caso, quaisquer dos dois critérios acima não forem atingidos, o aluno não será aprovado.' },
  { t: 'Reitera-se que será reprovado (a) discente(a) que:' },
  { t: '1. Obtiver frequência inferior a 75%; ou,', tipo: 'lista' },
  { t: '2. Obtiver média inferior a 5,0 entre Grau A, Grau B e Grau C (uma casa decimal).', tipo: 'lista' },
  { t: '*Conforme decisão do Conselho Superior de Administração, Ensino, Pesquisa e Extensão (CAEPE)', tipo: 'nota' },
];

// ---------- Ler um plano de ensino em Word (o modelo da instituição) ----------
interface Bloco {
  /** Parágrafo: o texto (com ** no que está em negrito), o nível da numeração e o estilo. */
  p?: { texto: string; marcado: string; nivel: number | null; titulo: boolean };
  /** Tabela: o texto de cada célula. */
  tabela?: string[][];
}

const filhos = (n: No, nome: string) => n.c.filter((x): x is No => typeof x !== 'string' && x.n === nome);
const ehDesenho = (n: No) => n.n === 'w:drawing' || n.n === 'mc:AlternateContent' || n.n === 'w:pict';
/** Texto de um nó, sem o que estiver dentro de desenhos e caixas de texto. */
const textoDe = (n: No): string =>
  n.c.map((x) => (typeof x === 'string' ? '' : ehDesenho(x) ? '' : x.n === 'w:t' ? x.c.filter((y): y is string => typeof y === 'string').join('') : x.n === 'w:tab' ? ' ' : textoDe(x))).join('');

function negrito(r: No): boolean {
  const rpr = filhos(r, 'w:rPr')[0];
  const b = rpr && filhos(rpr, 'w:b')[0];
  return !!b && !['0', 'false'].includes(b.a['w:val'] ?? '');
}

function paragrafo(p: No): Bloco['p'] {
  const ppr = filhos(p, 'w:pPr')[0];
  const num = ppr && filhos(ppr, 'w:numPr')[0];
  const ilvl = num && filhos(num, 'w:ilvl')[0];
  const estilo = (ppr && filhos(ppr, 'w:pStyle')[0]?.a['w:val']) ?? '';
  const runs: No[] = [];
  const juntar = (x: No) => x.c.forEach((y) => typeof y !== 'string' && !ehDesenho(y) && (y.n === 'w:r' ? runs.push(y) : y.n !== 'w:pPr' && juntar(y)));
  juntar(p);
  let marcado = '';
  for (const r of runs) {
    const t = textoDe(r);
    if (!t) continue;
    marcado += negrito(r) && t.trim() ? t.replace(/^(\s*)(.*?)(\s*)$/, '$1**$2**$3') : t;
  }
  marcado = marcado.replace(/\*\*(\s*)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
  return { texto: marcado.replace(/\*\*/g, ''), marcado, nivel: num ? Number(ilvl?.a['w:val'] ?? 0) : null, titulo: /^(heading|t[ií]tulo)/i.test(estilo) };
}

function blocos(corpo: No): Bloco[] {
  const out: Bloco[] = [];
  for (const c of corpo.c) {
    if (typeof c === 'string') continue;
    if (c.n === 'w:p') out.push({ p: paragrafo(c) });
    else if (c.n === 'w:tbl')
      out.push({
        tabela: filhos(c, 'w:tr').map((r) =>
          filhos(r, 'w:tc').map((tc) =>
            filhos(tc, 'w:p')
              .map((p) => textoDe(p).replace(/\s+/g, ' ').trim())
              .filter(Boolean)
              .join('\n'),
          ),
        ),
      });
    else if (c.n === 'w:sdt') out.push(...blocos(filhos(c, 'w:sdtContent')[0] ?? { n: '#', a: {}, c: [] }));
  }
  return out;
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
type Secao = 'ementa' | 'competencias' | 'habilidades' | 'conteudo' | 'estrategias' | 'regras' | 'acoes' | 'basica' | 'complementar' | 'fim' | null;
function secaoDe(t: string): Secao | undefined {
  const n = normal(t);
  if (n === 'ementa') return 'ementa';
  if (n === 'competencias') return 'competencias';
  if (n === 'habilidades') return 'habilidades';
  if (n === 'conteudo programatico') return 'conteudo';
  if (n.startsWith('estrategias de avaliacao')) return 'estrategias';
  if (n.startsWith('acoes concretas')) return 'acoes';
  if (n === 'bibliografia' || n === 'bibliografia basica') return 'basica';
  if (n === 'bibliografia complementar') return 'complementar';
  return undefined;
}

/** Tira "1.", "2.3", "– " do começo de um item do conteúdo. */
const limparItem = (t: string) => t.replace(/^\s*(\d+(\.\d+)*\.?)?\s*[–—-]?\s*/, '').trim();

export interface PlanoEnsinoLido {
  plano: PlanoEnsino;
  unidade: string;
  periodo: string;
}

/** Lê o plano de ensino de um arquivo Word no modelo da instituição. */
export async function lerPlanoEnsinoDocx(bytes: Uint8Array): Promise<PlanoEnsinoLido> {
  const zip = await abrirZip(bytes);
  const doc = zip.get('word/document.xml');
  if (!doc) throw new Error('O arquivo não parece ser um documento do Word (.docx).');
  const raiz = lerXml(new TextDecoder().decode(doc));
  const achar = (n: No): No | null => (n.n === 'w:body' ? n : n.c.reduce<No | null>((a, x) => a ?? (typeof x === 'string' ? null : achar(x)), null));
  const corpo = achar(raiz);
  if (!corpo) throw new Error('Não encontrei o texto do documento.');
  const plano = planoEnsinoVazio();
  plano.competencias = [];
  plano.habilidades = [];
  plano.conteudo = [];
  plano.estrategias = '';
  plano.bibliografiaBasica = [];
  plano.bibliografiaComplementar = [];
  plano.cidade = '';
  let unidade = '';
  let periodo = '';
  let secao: Secao = null;
  const ementa: string[] = [];
  const estrategias: string[] = [];
  let unidadeAtual: UnidadeConteudo | null = null;
  const novaUnidade = (titulo: string) => {
    unidadeAtual = { titulo: limparItem(titulo), itens: [] };
    plano.conteudo.push(unidadeAtual);
  };
  const novoItem = (t: string) => {
    if (!unidadeAtual) novaUnidade('');
    unidadeAtual!.itens.push(limparItem(t));
  };
  const lista = (s: Secao) => (s === 'basica' ? plano.bibliografiaBasica : plano.bibliografiaComplementar);

  for (const b of blocos(corpo)) {
    if (b.tabela) {
      const t = b.tabela;
      const tudo = normal(t.flat().join(' '));
      if (/instrumento avaliativo/.test(tudo)) {
        for (const linha of t) {
          const g = /grau\s+([abc])/i.exec(linha[0] ?? '');
          if (!g) continue;
          const resto = linha.slice(1).filter(Boolean);
          plano.graus[g[1].toUpperCase() as 'A' | 'B' | 'C'] = { descricao: (resto[0] ?? '').replace(/\n/g, ' '), peso: (resto[1] ?? '').replace(/\n/g, ' ') };
        }
        secao = 'regras';
      } else if (/descricao/.test(tudo) && /estrategias/.test(tudo)) {
        const l = t[1] ?? [];
        plano.recuperacao = { descricao: (l[0] ?? '').replace(/\n/g, ' '), estrategias: (l[1] ?? '').replace(/\n/g, ' ') };
      } else if (/coordenador/.test(tudo)) {
        for (const cel of t.flat()) {
          const m = /^([\s\S]*?)\s*coordenador\(?a?\)?\s*$/i.exec(cel.replace(/\n/g, ' '));
          if (m && m[1].trim()) plano.coordenador = m[1].trim();
          const p = /^([\s\S]*?)\s*professor\(?a?\)?\s*$/i.exec(cel.replace(/\n/g, ' '));
          if (p && p[1].trim() && !plano.professor) plano.professor = p[1].trim();
        }
        secao = 'fim';
      } else {
        // Tabela do cabeçalho: "Unidade Curricular:", "Professor(a):", "Carga Horária (h):", "Ano/Semestre: 2026.2", "Ementa".
        for (const linha of t) {
          const cs = linha.map((c) => c.replace(/\n/g, ' ').trim());
          cs.forEach((c, k) => {
            const prox = (cs.slice(k + 1).find(Boolean) ?? '').trim();
            const n = normal(c);
            if (/^unidade curricular:/.test(n) && prox) unidade = prox;
            else if (/^professor\(?a?\)?:/.test(n) && prox) plano.professor = prox;
            else if (/^carga horaria/.test(n)) plano.cargaHoraria = prox;
            else if (/^ano\/semestre:/.test(n)) periodo = c.split(':').slice(1).join(':').trim();
          });
          if (cs.some((c) => normal(c) === 'ementa')) secao = 'ementa';
        }
      }
      continue;
    }
    const p = b.p!;
    if (!p.texto) continue;
    const s = secaoDe(p.texto);
    if (s && !(secao === 'conteudo' && s !== 'estrategias')) {
      secao = s;
      continue;
    }
    if (s === undefined && secao === 'conteudo' && /^bibliografia/i.test(normal(p.texto))) {
      secao = 'basica';
      continue;
    }
    const local = /^(.+?),\s*\d{1,2}\s+de\s+\S+\s+de\s+\d{4}\.?$/i.exec(p.texto);
    if (local) {
      plano.cidade = local[1].trim();
      secao = 'fim';
      continue;
    }
    switch (secao) {
      case 'ementa':
        ementa.push(p.texto);
        break;
      case 'competencias':
        plano.competencias.push(p.texto);
        break;
      case 'habilidades':
        plano.habilidades.push(p.texto);
        break;
      case 'conteudo': {
        if (p.titulo || p.nivel === 0) novaUnidade(p.texto);
        else if (p.nivel !== null) novoItem(p.texto);
        else {
          // Itens que ficaram juntos num parágrafo sem numeração ("3.4 – …;3.5 – …").
          const partes = p.texto.split(/(?=\b\d+\.\d+\s*[–—-])/).filter((x) => x.trim());
          partes.forEach(novoItem);
        }
        break;
      }
      case 'estrategias':
        estrategias.push(p.texto);
        break;
      case 'basica':
      case 'complementar': {
        const l = lista(secao);
        // Endereços quebrados em vários parágrafos: o pedaço que não começa com um autor continua a obra anterior.
        const novaObra = /^[A-ZÀ-Ý][A-ZÀ-Ý.'\s-]{1,}[\s,]/.test(p.texto) || /^Lei\b|^Decreto|^Constitui/i.test(p.texto) || !l.length;
        if (novaObra) l.push(p.marcado);
        else l[l.length - 1] = `${l[l.length - 1]}${/\s$/.test(l[l.length - 1]) || /^https?:/.test(p.texto) ? ' ' : ''}${p.marcado}`;
        break;
      }
      default:
        break;
    }
  }
  plano.ementa = ementa.join('\n');
  plano.estrategias = estrategias.join('\n');
  // Endereços da internet partidos por espaços no original ("…coer%C3%AAnci a_da…"): junta os pedaços.
  const juntarLinks = (t: string) => t.replace(/https?:\/\/\S+(?:\s+(?=\S*[%/_]\S*)\S+)*/g, (u) => u.replace(/\s+/g, ''));
  plano.bibliografiaBasica = plano.bibliografiaBasica.map(juntarLinks);
  plano.bibliografiaComplementar = plano.bibliografiaComplementar.map(juntarLinks);
  for (const k of ['competencias', 'habilidades', 'bibliografiaBasica', 'bibliografiaComplementar'] as const) if (!plano[k].length) plano[k] = [''];
  if (!plano.conteudo.length) plano.conteudo = [{ titulo: '', itens: [''] }];
  if (!plano.cidade) plano.cidade = 'Caxias do Sul';
  return { plano, unidade, periodo };
}
