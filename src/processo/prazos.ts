// Prazos do processo fictício. Contagem como no CPC, sem feriados (o curso usa só dias de aula):
// exclui o dia do começo e inclui o do vencimento (art. 224); em dias úteis, só de segunda a
// sexta (art. 219); começa no primeiro dia útil seguinte (art. 224, § 3º); prazo em dias
// corridos que termina no sábado ou no domingo passa para segunda (art. 224, § 1º).
// Sem dependências do navegador.

export interface Prazo {
  dias: number;
  tipo: 'uteis' | 'corridos';
  /** Para quê: "o réu contestar". */
  para: string;
  /** "Quando vence?": a data fica escondida e o aluno faz a conta. */
  desafio?: boolean;
}

function paraData(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
function paraISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function maisUm(d: Date): Date {
  return new Date(d.getTime() + 86_400_000);
}
export function ehDiaUtil(d: Date): boolean {
  const s = d.getUTCDay();
  return s !== 0 && s !== 6;
}

/** Data do vencimento ("AAAA-MM-DD") de um prazo que começa na data do evento. */
export function vencimento(inicio: string, dias: number, tipo: Prazo['tipo']): string {
  let d = paraData(inicio);
  const n = Math.max(1, Math.floor(dias));
  if (tipo === 'uteis') {
    let contados = 0;
    while (contados < n) {
      d = maisUm(d);
      if (ehDiaUtil(d)) contados++;
    }
    return paraISO(d);
  }
  // Corridos: começa no primeiro dia útil seguinte e não termina em fim de semana.
  let primeiro = maisUm(d);
  while (!ehDiaUtil(primeiro)) primeiro = maisUm(primeiro);
  d = new Date(primeiro.getTime() + (n - 1) * 86_400_000);
  while (!ehDiaUtil(d)) d = maisUm(d);
  return paraISO(d);
}

/** Dias úteis de hoje (exclusive) até o vencimento (inclusive); 0 = vence hoje; negativo = vencido. */
export function diasUteisAte(hoje: string, venc: string): number {
  const a = paraData(hoje);
  const b = paraData(venc);
  if (paraISO(a) === paraISO(b)) return 0;
  const passo = a < b ? 1 : -1;
  let n = 0;
  let d = a;
  while (paraISO(d) !== paraISO(b)) {
    d = new Date(d.getTime() + passo * 86_400_000);
    if (ehDiaUtil(d)) n += passo;
  }
  if (passo < 0) return Math.min(-1, n);
  return n;
}

export function rotuloPrazo(p: Prazo): string {
  return `${p.dias} ${p.dias === 1 ? 'dia' : 'dias'} ${p.tipo === 'uteis' ? (p.dias === 1 ? 'útil' : 'úteis') : p.dias === 1 ? 'corrido' : 'corridos'}`;
}

/** "15 dias úteis para o réu contestar" (no texto do processo). */
export function lerPrazo(s: string): Prazo | null {
  const t = s.trim();
  const m = /^(\d{1,3})\s*dias?\s*(uteis|úteis|util|útil|corridos?)?\s*(?:para\s+)?(.*?)\s*(\(\s*quando vence\??\s*\))?$/i.exec(t);
  if (!m) return null;
  const tipo = m[2] && /corrid/i.test(m[2]) ? 'corridos' : 'uteis';
  return { dias: Number(m[1]), tipo, para: m[3].replace(/^para\s+/i, '').trim(), ...(m[4] ? { desafio: true } : {}) };
}

export function prazoParaTexto(p: Prazo): string {
  return `${rotuloPrazo(p)}${p.para ? ` para ${p.para}` : ''}${p.desafio ? ' (quando vence?)' : ''}`;
}
