// Plano de aula: as datas das aulas da turma (dias da semana do horário, de início a fim do
// semestre, sem os feriados nacionais e os dias marcados) e a leitura do plano em Word da instituição.
import { db } from '../dados/db';
import { agoraISO, novoId } from '../dados/modelo';
import { abrirZip, lerXml, type No } from '../orientacao/lerDocx';
import { avisarMudancaTurmas } from './banco';
import type { AulaPlano, CalendarioTurma, Disciplina, GrauPlano, PlanoAula, Turma } from './tipos';

const doisDig = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;
export const dataBR = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const deISO = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/** Domingo de Páscoa (algoritmo de Meeus). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/** Feriados nacionais (e os dias em que normalmente não há aula: Carnaval e Corpus Christi). */
export function feriadosNacionais(ano: number): Map<string, string> {
  const m = new Map<string, string>();
  const fixos: [string, string][] = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
    ['12-25', 'Natal'],
  ];
  for (const [d, n] of fixos) m.set(`${ano}-${d}`, n);
  const p = pascoa(ano);
  const desloc = (dias: number) => iso(new Date(p.getFullYear(), p.getMonth(), p.getDate() + dias));
  m.set(desloc(-48), 'Carnaval');
  m.set(desloc(-47), 'Carnaval');
  m.set(desloc(-2), 'Sexta-feira Santa');
  m.set(desloc(60), 'Corpus Christi');
  return m;
}

export interface DiaDoCalendario {
  data: string;
  /** Há aula neste dia? */
  aula: boolean;
  /** Por que não há (feriado, marcado) ou por que há (extra). */
  motivo?: string;
}

/** Os dias de aula da turma (e os dias pulados, com o motivo). */
export function diasDaTurma(t: Pick<Turma, 'inicio' | 'fim' | 'horarios'>, cal?: CalendarioTurma): DiaDoCalendario[] {
  if (!t.inicio || !t.fim || t.fim < t.inicio) return [];
  const dias = new Set(t.horarios.map((h) => h.dia));
  const exc = new Map((cal?.excecoes ?? []).map((e) => [e.data, e]));
  const feriados = new Map<string, string>();
  for (let a = Number(t.inicio.slice(0, 4)); a <= Number(t.fim.slice(0, 4)); a++) feriadosNacionais(a).forEach((v, k) => feriados.set(k, v));
  const out: DiaDoCalendario[] = [];
  for (let d = deISO(t.inicio); iso(d) <= t.fim; d.setDate(d.getDate() + 1)) {
    const s = iso(d);
    const e = exc.get(s);
    if (dias.has(d.getDay())) {
      if (e) out.push({ data: s, aula: e.aula, motivo: e.motivo || (e.aula ? feriados.get(s) : 'sem aula') });
      else if (feriados.has(s)) out.push({ data: s, aula: false, motivo: feriados.get(s) });
      else out.push({ data: s, aula: true });
    } else if (e?.aula) out.push({ data: s, aula: true, motivo: e.motivo || 'aula extra' });
  }
  return out;
}

/** A data de cada aula do plano: na ordem, pelos dias de aula; a data trocada à mão vale no lugar. */
export function datasDasAulas(aulas: AulaPlano[], t: Pick<Turma, 'inicio' | 'fim' | 'horarios'>, cal?: CalendarioTurma): { datas: string[]; faltam: number; sobram: string[] } {
  const livres = diasDaTurma(t, cal).filter((d) => d.aula).map((d) => d.data);
  const datas = aulas.map((a, k) => cal?.datas[a.id] || livres[k] || '');
  return { datas, faltam: Math.max(0, aulas.length - livres.length), sobram: livres.slice(aulas.length) };
}

// ---------- Plano vazio e gravação ----------
const grauVazio = (): GrauPlano => ({ aplicacao: '', postagem: '', pontos: '10 pontos', linhas: [{ instrumento: '', peso: '', criterio: '' }] });
export function planoVazio(professor = ''): PlanoAula {
  return { cargaHoraria: '', professor, aulas: [{ id: novoId(), tema: '', destaque: '' }], graus: { A: grauVazio(), B: grauVazio(), C: grauVazio() }, recuperacao: '' };
}

export async function salvarPlanoAula(d: Disciplina, plano: PlanoAula): Promise<Disciplina> {
  const atual = (await db.disciplinas.get(d.id)) ?? d;
  const novo = { ...atual, planoAula: plano, atualizado_em: agoraISO() };
  await db.disciplinas.put(novo);
  avisarMudancaTurmas();
  return novo;
}

export async function salvarCalendario(t: Turma, cal: CalendarioTurma, campos: Partial<Pick<Turma, 'inicio' | 'fim'>> = {}): Promise<Turma> {
  const atual = (await db.turmas.get(t.id)) ?? t;
  const novo = { ...atual, ...campos, calendario: cal, atualizado_em: agoraISO() };
  await db.turmas.put(novo);
  avisarMudancaTurmas();
  return novo;
}

// ---------- Ler um plano de aula em Word (o modelo da instituição) ----------
const textoDe = (n: No): string => n.c.map((x) => (typeof x === 'string' ? '' : x.n === 'w:t' ? x.c.filter((y): y is string => typeof y === 'string').join('') : x.n === 'mc:Fallback' ? '' : textoDe(x))).join('');

/** Texto de uma célula de tabela: os parágrafos separados por espaço. */
function textoDaCelula(c: No): string {
  const ps: string[] = [];
  const andar = (x: No) => x.c.forEach((y) => typeof y !== 'string' && y.n !== 'mc:Fallback' && (y.n === 'w:p' ? ps.push(textoDe(y)) : andar(y)));
  andar(c);
  return ps.join(' ').replace(/\s+/g, ' ').trim();
}

/** Os textos do documento na ordem (também os das caixas de texto) e as tabelas. */
function percorrer(n: No, out: (string | string[][])[]): void {
  for (const c of n.c) {
    if (typeof c === 'string' || c.n === 'mc:Fallback') continue;
    if (c.n === 'w:tbl') {
      out.push(
        c.c
          .filter((r): r is No => typeof r !== 'string' && r.n === 'w:tr')
          .map((r) => r.c.filter((x): x is No => typeof x !== 'string' && x.n === 'w:tc').map((x) => textoDaCelula(x))),
      );
      continue;
    }
    if (c.n === 'w:txbxContent') {
      for (const p of c.c) if (typeof p !== 'string') percorrer({ n: '#', a: {}, c: [p] }, out);
      continue;
    }
    if (c.n === 'w:p') {
      // Caixas de texto dentro do parágrafo: primeiro o texto delas, depois o do próprio parágrafo.
      const caixas: No[] = [];
      const juntar = (x: No) => x.c.forEach((y) => typeof y !== 'string' && (y.n === 'w:txbxContent' ? caixas.push(y) : y.n !== 'mc:Fallback' && juntar(y)));
      juntar(c);
      for (const cx of caixas) percorrer({ n: '#', a: {}, c: [cx] }, out);
      const proprio = c.c
        .filter((x): x is No => typeof x !== 'string' && (x.n === 'w:r' || x.n === 'w:hyperlink'))
        .map((x) => (x.c.some((y) => typeof y !== 'string' && (y.n === 'w:drawing' || y.n === 'mc:AlternateContent' || y.n === 'w:pict')) ? '' : textoDe(x)))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (proprio) out.push(proprio);
      continue;
    }
    percorrer(c, out);
  }
}

export interface PlanoLido {
  plano: PlanoAula;
  unidade: string;
  periodo: { inicio: string; fim: string } | null;
}

const daBR = (s: string) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/** Lê o plano de aula de um arquivo Word no modelo da instituição (AULA 1, AULA 2…, GRAU A…, tabelas de avaliação). */
export async function lerPlanoAulaDocx(bytes: Uint8Array): Promise<PlanoLido> {
  const zip = await abrirZip(bytes);
  const doc = zip.get('word/document.xml');
  if (!doc) throw new Error('O arquivo não parece ser um documento do Word (.docx).');
  const itens: (string | string[][])[] = [];
  percorrer(lerXml(new TextDecoder().decode(doc)), itens);
  const plano = planoVazio();
  plano.aulas = [];
  let unidade = '';
  let periodo: PlanoLido['periodo'] = null;
  let aula: AulaPlano | null = null;
  let grauBox: 'A' | 'B' | 'C' | null = null;
  let estrategias = false;
  const cab = (rotulo: string, valor: string) => {
    if (/^unidade curricular/i.test(rotulo)) unidade = valor;
    else if (/^carga hor/i.test(rotulo)) plano.cargaHoraria = valor;
    else if (/^professor/i.test(rotulo)) plano.professor = valor;
    else if (/^per[ií]odo/i.test(rotulo)) {
      const ds = valor.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
      if (ds.length >= 2) periodo = { inicio: daBR(ds[0] ?? ""), fim: daBR(ds[1] ?? "") };
    }
  };
  for (let k = 0; k < itens.length; k++) {
    const it = itens[k];
    if (Array.isArray(it)) {
      // Tabela do cabeçalho ("UNIDADE CURRICULAR: …") ou de estratégias de avaliação (GRAU A…).
      const g = /GRAU\s+([ABC])/i.exec(it[0]?.[0] ?? '');
      if (g) {
        const grau = plano.graus[g[1].toUpperCase() as 'A' | 'B' | 'C'];
        grau.pontos = /(\d+[.,]?\d*)\s*pontos?/i.exec(it[0][0])?.[0] ?? grau.pontos;
        grau.linhas = it.slice(1).map((l) => ({ instrumento: l[1] ?? '', peso: l[2] ?? '', criterio: l[3] ?? '' })).filter((l) => l.instrumento || l.criterio);
        estrategias = true;
        grauBox = null;
      } else
        for (const linha of it)
          for (const cel of linha) {
            const m = /^([A-ZÁÉÍÓÚÇÃ ]+?):\s*(.*)$/i.exec(cel);
            if (m) cab(m[1], m[2]);
          }
      continue;
    }
    const t = it.trim();
    if (!t || /^plano de aula$/i.test(t)) continue;
    const ma = /^AULA\s+(\d+)$/i.exec(t);
    if (ma) {
      aula = { id: novoId(), tema: '', destaque: '' };
      plano.aulas.push(aula);
      grauBox = null;
      continue;
    }
    if (/^estrat[ée]gias de avalia/i.test(t)) {
      estrategias = true;
      aula = null;
      grauBox = null;
      continue;
    }
    const mg = /^GRAU\s+([ABC])$/i.exec(t);
    if (mg && !estrategias) {
      grauBox = mg[1].toUpperCase() as 'A' | 'B' | 'C';
      if (plano.aulas.length) plano.aulas[plano.aulas.length - 1].grau = grauBox;
      aula = null;
      continue;
    }
    if (grauBox) {
      if (/^datas? de aplica/i.test(t)) plano.graus[grauBox].aplicacao = t.replace(/^[^:]*:\s*/, '');
      else if (/^data para a postagem/i.test(t)) plano.graus[grauBox].postagem = t.replace(/^[^:]*:\s*/, '');
      continue;
    }
    const mc = /^(UNIDADE CURRICULAR|CARGA HOR[ÁA]RIA|PROFESSOR|PER[ÍI]ODO DE REALIZA[ÇC][ÃA]O):\s*(.*)$/i.exec(t);
    if (mc && !plano.aulas.length) {
      // Rótulo e valor no mesmo parágrafo, ou o valor no parágrafo seguinte.
      const valor = mc[2] || (typeof itens[k + 1] === 'string' ? (itens[++k] as string) : '');
      cab(mc[1], valor.trim());
      continue;
    }
    if (estrategias) {
      if (!/^estrat[ée]gias de recupera/i.test(t)) plano.recuperacao = [plano.recuperacao, t.replace(/^estrat[ée]gias de recupera[çc][ãa]o[^:]*:\s*/i, '')].filter(Boolean).join(' ');
      continue;
    }
    if (aula) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) continue; // a data (o Vide calcula)
      if (/^AVALIA[ÇC][ÃA]O FORMATIVA/i.test(t) && !aula.destaque) aula.destaque = t.replace(/\s+$/, '');
      else aula.tema = [aula.tema, t].filter(Boolean).join(' ');
    }
  }
  if (!plano.aulas.length) throw new Error('Não encontrei as aulas ("AULA 1", "AULA 2"…) neste arquivo.');
  return { plano, unidade, periodo };
}
