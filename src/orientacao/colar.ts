// Reconhece uma conversa colada (WhatsApp ou e-mail) para preencher o registro sozinho:
// o canal, a data e hora, quem falou e um resumo.
import type { Canal } from './tipos';

export interface Mensagem {
  /** "AAAA-MM-DDTHH:MM" (vazio se não deu para ler). */
  em: string;
  autor: string;
  texto: string;
}

export interface Colagem {
  canal: Canal | null;
  /** Data da primeira mensagem. */
  em: string | null;
  mensagens: Mensagem[];
  participantes: string[];
  assunto: string | null;
  resumo: string;
}

const p2 = (n: string | number) => String(n).padStart(2, '0');

function montar(dia: string, mes: string, ano: string, h?: string, min?: string): string | null {
  const a = ano.length === 2 ? `20${ano}` : ano;
  const m = Number(mes);
  const d = Number(dia);
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const data = `${a}-${p2(m)}-${p2(d)}`;
  return h !== undefined && min !== undefined ? `${data}T${p2(h)}:${p2(min)}` : `${data}T00:00`;
}

// [14:03, 12/11/2026] Nome: texto   (WhatsApp Web e computador, ao copiar mensagens)
const WA_WEB = /^\[(\d{1,2}):(\d{2})(?::\d{2})?,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]\s*([^:]{1,60}):\s?(.*)$/;
// [12/11/2026, 14:03:22] Nome: texto   (iPhone)
const WA_IOS = /^‎?\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\]\s*([^:]{1,60}):\s?(.*)$/;
// 12/11/2026 14:03 - Nome: texto   (Android, "Exportar conversa")
const WA_ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s+-\s+([^:]{1,60}):\s?(.*)$/;

function linhaWhatsApp(l: string): Mensagem | null {
  let m = WA_WEB.exec(l);
  if (m) return { em: montar(m[3], m[4], m[5], m[1], m[2]) ?? '', autor: m[6].trim(), texto: m[7] };
  m = WA_IOS.exec(l) ?? WA_ANDROID.exec(l);
  if (m) return { em: montar(m[1], m[2], m[3], m[4], m[5]) ?? '', autor: m[6].trim(), texto: m[7] };
  return null;
}

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  feb: 2, apr: 4, may: 5, aug: 8, sep: 9, oct: 10, dec: 12,
};

/** Datas de e-mail: "12 de nov. de 2026 14:03", "12 de novembro de 2026 às 14:03", "12/11/2026 14:03", "Nov 12, 2026, 2:03 PM". */
export function dataDeEmail(s: string): string | null {
  let m = /(\d{1,2})\s+de\s+([a-zç]{3})[a-zç]*\.?\s+de\s+(\d{4})(?:[^\d]{1,8}(\d{1,2}):(\d{2}))?/i.exec(s);
  if (m && MESES[m[2].toLowerCase()]) return montar(m[1], String(MESES[m[2].toLowerCase()]), m[3], m[4], m[5]);
  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d]{1,8}(\d{1,2}):(\d{2}))?/.exec(s);
  if (m) return montar(m[1], m[2], m[3], m[4], m[5]);
  m = /\b([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),\s+(\d{4})(?:[^\d]{1,8}(\d{1,2}):(\d{2})\s*(AM|PM)?)?/.exec(s);
  if (m && MESES[m[1].toLowerCase()]) {
    let h = m[4] !== undefined ? Number(m[4]) : undefined;
    if (h !== undefined && m[6] === 'PM' && h < 12) h += 12;
    if (h !== undefined && m[6] === 'AM' && h === 12) h = 0;
    return montar(m[2], String(MESES[m[1].toLowerCase()]), m[3], h === undefined ? undefined : String(h), m[5]);
  }
  return null;
}

function curto(s: string, n = 90): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function analisarColagem(texto: string): Colagem {
  const linhas = texto.replace(/\r/g, '').split('\n');
  // ---------- WhatsApp ----------
  const mensagens: Mensagem[] = [];
  for (const l of linhas) {
    const m = linhaWhatsApp(l.trim());
    if (m) mensagens.push(m);
    else if (mensagens.length && l.trim()) mensagens[mensagens.length - 1].texto += `\n${l}`;
  }
  if (mensagens.length) {
    const participantes = [...new Set(mensagens.map((m) => m.autor))];
    const datas = mensagens.map((m) => m.em).filter(Boolean).sort();
    return { canal: 'whatsapp', em: datas[0] ?? null, mensagens, participantes, assunto: null, resumo: curto(mensagens[0].texto) };
  }
  // ---------- E-mail ----------
  const campo = (nomes: string) => {
    const re = new RegExp(`^\\s*\\*?(?:${nomes})\\*?:\\s*(.+)$`, 'im');
    return re.exec(texto)?.[1]?.trim() ?? null;
  };
  const de = campo('De|From');
  const assunto = campo('Assunto|Subject');
  const dataCampo = campo('Data|Date|Enviado|Enviada|Sent|Enviado em');
  const temEnderecos = /<[^<>\s@]+@[^<>\s@]+\.[^<>\s]+>/.test(texto);
  if (de || assunto || temEnderecos) {
    // Data: o campo "Data:" ou a primeira data que aparecer no texto (cabeçalho do Gmail).
    let em = dataCampo ? dataDeEmail(dataCampo) : null;
    if (!em) {
      for (const l of linhas) {
        em = dataDeEmail(l);
        if (em) break;
      }
    }
    const nomes = [...texto.matchAll(/^\s*([^<>\n:]{2,60}?)\s*<[^<>\s@]+@[^<>\s]+>/gm)].map((m) => m[1].replace(/^(De|From):\s*/i, '').trim());
    const participantes = [...new Set([...(de ? [de.replace(/\s*<.*$/, '')] : []), ...nomes])].filter(Boolean);
    const corpo = linhas.find((l) => l.trim() && !/^\s*\*?(De|From|Para|To|Cc|Data|Date|Assunto|Subject|Enviado|Sent)\*?:/i.test(l) && !/<[^>]+@[^>]+>/.test(l) && !dataDeEmail(l));
    return { canal: 'email', em, mensagens: [], participantes, assunto, resumo: assunto ? curto(assunto) : curto(corpo ?? '') };
  }
  return { canal: null, em: null, mensagens: [], participantes: [], assunto: null, resumo: curto(linhas.find((l) => l.trim()) ?? '') };
}
