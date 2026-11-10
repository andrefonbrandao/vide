// Lê casos colados como texto (o formato que a IA generativa produz a partir do modelo).
import type { Expressao } from './personagens';
import { TEMPO_PADRAO_CASO, type DadosCaso, type Fala, type PessoaCaso, type QuemResponde } from './tipos';

export interface CasoLido extends DadosCaso {
  assuntos: string[];
}

export interface ResultadoLeituraCasos {
  casos: CasoLido[];
  avisos: string[];
}

export const MODELO_CASO = `Caso: Rogéria
Pessoa: mulher, idosa
Fala (neutro): Olá, me chamo Rogéria e sou ré em um processo.
Fala (medo): Um oficial de justiça esteve no meu endereço e deixou um aviso de que voltará, porque eu tentei me esconder dele.
Fala (dúvida): Posso me esconder novamente?
Resposta (juiz): Não adianta, Rogéria. Se o oficial suspeitar que a senhora está se ocultando, ele marca um horário e, se não a encontrar, faz a citação com hora certa: a citação vale mesmo assim, e o processo segue.
Fundamento: 252
Tempo: 5
Assunto: citação`;

/** Pedido pronto para a IA generativa criar casos neste formato. */
export function pedidoParaIA(tema: string, quantos: number): string {
  return `Você vai me ajudar a criar casos práticos de Direito Processual Civil (CPC/2015) para uma turma de graduação, sobre ${tema.trim() || '[TEMA]'}.

Cada caso simula uma consulta rápida: uma pessoa comum conta, em linguagem simples, um problema concreto e faz uma pergunta. A turma discute em grupo por alguns minutos e, no fim, um advogado ou um juiz responde.

Crie ${quantos} casos. Responda SOMENTE com os casos, sem comentários antes ou depois, exatamente neste formato (uma linha em branco entre os casos):

${MODELO_CASO}

Regras:
- "Caso": só o primeiro nome fictício da pessoa. Varie os nomes e evite nomes de pessoas famosas.
- "Pessoa": mulher ou homem; se fizer diferença para a história, acrescente jovem, adulto ou idoso.
- Use 2 a 4 falas. Cada fala é curta (no máximo 2 frases), em primeira pessoa e sem termos técnicos, como falaria alguém leigo. A última fala é sempre a pergunta.
- A expressão entre parênteses deve ser uma destas: neutro, dúvida, medo, feliz. Escolha a que combina com o que a pessoa está dizendo.
- "Resposta": diga se quem responde é advogado ou juiz. Responda a pergunta de forma direta e correta, em até 4 frases, em linguagem clara, explicando o que acontece e por quê.
- "Fundamento": só o número do artigo do CPC, com inciso ou parágrafo se houver (ex.: 252, 485 VI, 1009 §1). Para outra lei, acrescente a sigla (ex.: 5 CF). Se não tiver certeza do artigo, deixe em branco.
- "Tempo": minutos para a turma discutir (normalmente 5).
- O problema deve ter uma resposta clara no CPC, sem depender de jurisprudência divergente.
- Não repita situações entre os casos e não invente artigos.`;
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function lerExpressao(s: string | undefined): Expressao {
  const t = semAcento(s ?? '');
  if (/duvid|confus|pensativ/.test(t)) return 'duvida';
  if (/medo|preocup|assust|nervos|trist|aflit/.test(t)) return 'medo';
  if (/feliz|alegr|content|alivi|sorri/.test(t)) return 'feliz';
  return 'neutro';
}

function lerPessoa(s: string): PessoaCaso {
  const t = semAcento(s);
  const p: PessoaCaso = {};
  if (/mulher|feminin|senhora|moca|menina/.test(t)) p.genero = 'mulher';
  else if (/homem|masculin|senhor|rapaz/.test(t)) p.genero = 'homem';
  if (/idos|velh|senhor/.test(t)) p.idade = 'idoso';
  else if (/jovem|mo[cç]|rapaz|estudante/.test(t)) p.idade = 'jovem';
  else if (/adult/.test(t)) p.idade = 'adulto';
  return p;
}

const RE_LINHA = /^\s*([A-Za-zÀ-ÿ ]+?)\s*(?:\(([^)]*)\))?\s*[:\-–]\s*(.*)$/;

/** Lê um ou vários casos. Cada caso começa em "Caso:". */
export function lerCasos(texto: string): ResultadoLeituraCasos {
  const casos: CasoLido[] = [];
  const avisos: string[] = [];
  let atual: (CasoLido & { linha: number }) | null = null;
  let ultimo: { tipo: 'fala' | 'resposta'; i: number } | null = null;
  const fechar = () => {
    if (!atual) return;
    if (!atual.falas.length) avisos.push(`Caso "${atual.nome}" (linha ${atual.linha}): sem nenhuma "Fala".`);
    else if (!atual.resposta.trim()) avisos.push(`Caso "${atual.nome}" (linha ${atual.linha}): sem "Resposta".`);
    else {
      const { linha: _l, ...c } = atual;
      casos.push(c);
    }
    atual = null;
    ultimo = null;
  };
  texto.split(/\r?\n/).forEach((bruta, k) => {
    const linha = bruta.trim();
    if (!linha) return;
    const m = linha.match(RE_LINHA);
    const chave = m ? semAcento(m[1]).trim() : '';
    if (m && chave === 'caso') {
      fechar();
      atual = { nome: m[3].trim() || 'Sem nome', pessoa: {}, falas: [], resposta: '', quemResponde: 'advogado', fundamento: '', tempo: TEMPO_PADRAO_CASO, assuntos: [], linha: k + 1 };
      return;
    }
    if (!atual) {
      avisos.push(`Linha ${k + 1} ignorada (fora de um caso; cada caso começa com "Caso: nome").`);
      return;
    }
    const a: CasoLido = atual;
    if (m && (chave === 'pessoa' || chave === 'personagem')) a.pessoa = lerPessoa(m[3]);
    else if (m && chave === 'fala') {
      a.falas.push({ expressao: lerExpressao(m[2]), texto: m[3].trim() } satisfies Fala);
      ultimo = { tipo: 'fala', i: a.falas.length - 1 };
    } else if (m && chave === 'resposta') {
      const quem = semAcento(m[2] ?? '');
      a.quemResponde = (/juiz|juiza|magistrad/.test(quem) ? 'juiz' : 'advogado') as QuemResponde;
      a.resposta = m[3].trim();
      ultimo = { tipo: 'resposta', i: 0 };
    } else if (m && (chave === 'fundamento' || chave === 'dispositivo' || chave === 'base legal')) a.fundamento = m[3].trim();
    else if (m && chave === 'tempo') {
      const n = parseFloat(m[3].replace(',', '.'));
      if (Number.isFinite(n) && n > 0) a.tempo = Math.min(60, Math.round(n * 2) / 2);
    } else if (m && (chave === 'assunto' || chave === 'assuntos' || chave === 'tema' || chave === 'temas'))
      a.assuntos = m[3].split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    else if (ultimo) {
      // Continuação da linha anterior (fala ou resposta longa quebrada em duas linhas).
      const u = ultimo as { tipo: 'fala' | 'resposta'; i: number };
      if (u.tipo === 'fala') a.falas[u.i].texto += ` ${linha}`;
      else a.resposta += ` ${linha}`;
    } else avisos.push(`Linha ${k + 1} não reconhecida: "${linha.slice(0, 60)}".`);
  });
  fechar();
  return { casos, avisos };
}

/** O caso de volta no formato de texto (para editar ou copiar). */
export function casoParaTexto(c: DadosCaso & { etiquetas?: string[] }): string {
  const nomesExp: Record<Expressao, string> = { neutro: 'neutro', duvida: 'dúvida', medo: 'medo', feliz: 'feliz' };
  const pessoa = [c.pessoa.genero, c.pessoa.idade && (c.pessoa.genero === 'mulher' ? { jovem: 'jovem', adulto: 'adulta', idoso: 'idosa' }[c.pessoa.idade] : c.pessoa.idade)].filter(Boolean).join(', ');
  return [
    `Caso: ${c.nome}`,
    pessoa && `Pessoa: ${pessoa}`,
    ...c.falas.map((f) => `Fala (${nomesExp[f.expressao]}): ${f.texto}`),
    `Resposta (${c.quemResponde}): ${c.resposta}`,
    c.fundamento && `Fundamento: ${c.fundamento}`,
    `Tempo: ${c.tempo}`,
    c.etiquetas?.length ? `Assunto: ${c.etiquetas.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
