// Lê questões coladas como texto simples (feitas à mão ou por uma IA).
//
//   1. Qual o prazo para contestar no procedimento comum?
//   A) 5 dias
//   B) 10 dias
//   C) 15 dias
//   D) 30 dias
//   Resposta: C
//   Tempo: 30
//   Explicação: art. 335 do CPC.
//   Fundamento: 335
//   Assunto: contestação, prazos
//
//   2. A citação válida induz litispendência.
//   Resposta: V
//
// Sem alternativas, a questão é de verdadeiro/falso. A correta também pode ser
// marcada com * antes da letra ("*C) 15 dias") ou com "(correta)" no fim.
import { TEMPO_PADRAO, type QuestaoJogo } from './tipos';

export interface ErroImportacao {
  /** Número da questão no texto (1, 2, 3…). */
  numero: number;
  trecho: string;
  mensagem: string;
}

/** Questão lida do texto, com os assuntos indicados nela ("Assunto: sentença"). */
export type QuestaoImportada = QuestaoJogo & { assuntos: string[] };

export interface ResultadoImportacao {
  questoes: QuestaoImportada[];
  erros: ErroImportacao[];
}

export const MODELO_IMPORTACAO = `1. Qual o prazo para contestar no procedimento comum?
A) 5 dias
B) 10 dias
C) 15 dias
D) 30 dias
Resposta: C
Tempo: 30
Explicação: O prazo é de 15 dias úteis.
Fundamento: 335
Assunto: contestação, prazos

2. A citação válida induz litispendência.
Resposta: V
Fundamento: 240
Assunto: citação`;

const RE_ALT = /^\s*(\*)?\s*([A-Da-d])\s*[).\-–]\s+(.+?)\s*$/;
const RE_NUMERO = /^\s*(?:quest[aã]o\s*)?(?:q\s*)?\d{1,3}\s*[.):\-–]\s*/i;
const RE_CHAVE = /^\s*(resposta|gabarito|correta|alternativa correta|tempo|explica[cç][aã]o|coment[aá]rio|fundamento|dispositivo|base legal|assuntos?|temas?)\s*[:\-–]\s*(.*)$/i;

interface Rascunho {
  numero: number;
  enunciado: string[];
  alternativas: string[];
  marcada: number | null;
  resposta: string | null;
  tempo: number | null;
  explicacao: string[];
  fundamento: string;
  assuntos: string[];
  /** O que a próxima linha comum continua. */
  continuar: 'enunciado' | 'explicacao' | null;
}

function novo(numero: number, primeira: string): Rascunho {
  return {
    numero,
    enunciado: [primeira],
    alternativas: [],
    marcada: null,
    resposta: null,
    tempo: null,
    explicacao: [],
    fundamento: '',
    assuntos: [],
    continuar: 'enunciado',
  };
}

function lerResposta(r: string, alternativas: string[]): number | null {
  const t = r.trim().replace(/[.)]$/, '').toLowerCase();
  if (alternativas.length) {
    const m = t.match(/^(?:letra\s*)?([a-d])\b/);
    if (!m) return null;
    const i = m[1].charCodeAt(0) - 97;
    return i < alternativas.length ? i : null;
  }
  if (/^(v|verdadeir[oa]|certo|c|correto|correta)$/.test(t)) return 0;
  if (/^(f|fals[oa]|errado|e|incorreto|incorreta)$/.test(t)) return 1;
  return null;
}

export function importarQuestoes(texto: string): ResultadoImportacao {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const rascunhos: Rascunho[] = [];
  let atual: Rascunho | null = null;
  let emBranco = false;

  const fechou = (r: Rascunho | null) => !r || r.alternativas.length > 0 || r.resposta !== null || r.marcada !== null;

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) {
      emBranco = true;
      if (atual?.continuar === 'explicacao') atual.continuar = null;
      continue;
    }
    const chave = RE_CHAVE.exec(linha);
    if (chave && atual) {
      const nome = chave[1].toLowerCase();
      const valor = chave[2].trim();
      atual.continuar = null;
      if (/^(resposta|gabarito|correta|alternativa correta)$/.test(nome)) atual.resposta = valor;
      else if (nome === 'tempo') atual.tempo = parseInt(valor, 10) || null;
      else if (/^(explica|coment)/.test(nome)) {
        atual.explicacao = valor ? [valor] : [];
        atual.continuar = 'explicacao';
      } else if (/^(assunto|tema)/.test(nome)) {
        atual.assuntos.push(...valor.split(/[,;]/).map((a) => a.trim().toLowerCase()).filter(Boolean));
      } else atual.fundamento = valor.replace(/^art(igo)?\.?\s*/i, '');
      emBranco = false;
      continue;
    }
    const alt = RE_ALT.exec(linha);
    if (alt && atual && atual.resposta === null && atual.explicacao.length === 0) {
      const esperado = String.fromCharCode(97 + atual.alternativas.length);
      if (alt[2].toLowerCase() === esperado) {
        let txt = alt[3];
        const marcadaNoFim = /\s*\((correta|certa|gabarito)\)\s*$/i.test(txt);
        txt = txt.replace(/\s*\((correta|certa|gabarito)\)\s*$/i, '');
        if (alt[1] || marcadaNoFim) atual.marcada = atual.alternativas.length;
        atual.alternativas.push(txt);
        atual.continuar = null;
        emBranco = false;
        continue;
      }
    }
    // Linha comum: continua o enunciado/explicação ou começa outra questão.
    const numerada = RE_NUMERO.test(linha);
    if (atual && !numerada && atual.continuar === 'enunciado' && atual.alternativas.length === 0 && !(emBranco && fechou(atual))) {
      atual.enunciado.push(linha);
    } else if (atual && !numerada && atual.continuar === 'explicacao' && !emBranco) {
      atual.explicacao.push(linha);
    } else {
      atual = novo(rascunhos.length + 1, linha.replace(RE_NUMERO, ''));
      rascunhos.push(atual);
    }
    emBranco = false;
  }

  const questoes: QuestaoImportada[] = [];
  const erros: ErroImportacao[] = [];
  for (const r of rascunhos) {
    const enunciado = r.enunciado.join(' ').trim();
    const trecho = enunciado.length > 70 ? `${enunciado.slice(0, 70)}…` : enunciado;
    const erro = (mensagem: string) => erros.push({ numero: r.numero, trecho, mensagem });
    if (!enunciado) {
      erro('Falta o enunciado.');
      continue;
    }
    if (r.alternativas.length === 1) {
      erro('Tem só uma alternativa (são necessárias de 2 a 4).');
      continue;
    }
    const vf = r.alternativas.length === 0;
    const alternativas = vf ? ['Verdadeiro', 'Falso'] : r.alternativas;
    let correta = r.marcada;
    if (r.resposta !== null) {
      const lida = lerResposta(r.resposta, r.alternativas);
      if (lida === null) {
        erro(vf ? `Resposta "${r.resposta}" não entendida (use V ou F).` : `Resposta "${r.resposta}" não corresponde a uma alternativa.`);
        continue;
      }
      correta = lida;
    }
    if (correta === null) {
      erro(vf ? 'Falta a resposta (Resposta: V ou F).' : 'Falta indicar a alternativa correta (Resposta: B).');
      continue;
    }
    const tempo = Math.max(5, Math.min(240, r.tempo ?? TEMPO_PADRAO));
    questoes.push({
      tipo: vf ? 'vf' : 'multipla',
      enunciado,
      alternativas,
      correta,
      tempo,
      explicacao: r.explicacao.join(' ').trim(),
      fundamento: r.fundamento,
      assuntos: [...new Set(r.assuntos)],
    });
  }
  return { questoes, erros };
}
