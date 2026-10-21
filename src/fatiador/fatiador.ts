// Fatiador: transforma as linhas de uma lei em artigos estruturados
// (caput, parágrafos, incisos e alíneas) e aponta duplicidades.
import type { ConteudoLegislacao, Dispositivo } from '../dados/modelo';
import { romanoParaNumero } from '../voz/numeros';

export interface ArtigoFatiado extends ConteudoLegislacao {
  /** Posição da linha onde o artigo começa (para mostrar na revisão). */
  linha: number;
}

export interface Duplicidade {
  /** "Art. 12" ou "Art. 63, § 1º". */
  onde: string;
  tipo: 'artigo' | 'dispositivo';
  /** Número do artigo (para a escolha de versão). */
  artigoChave: string;
  /** Início do texto de cada versão, na ordem em que aparecem. */
  versoes: string[];
}

export interface ResultadoFatiador {
  artigos: ArtigoFatiado[];
  duplicidades: Duplicidade[];
  /** Linhas que não puderam ser encaixadas em nenhum artigo (para conferência). */
  ignoradas: number;
  /** Números de artigo que faltam na sequência (ex.: artigo revogado por inteiro). */
  lacunas: number[];
  avisos: string[];
}

const RE_ARTIGO = /^Art\.?\s*(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:[º°o])?\s*(?:-\s*([A-Z]))?\s*(?:[.\-–—])?\s*(.*)$/;
const RE_PARAGRAFO = /^§\s*(\d+)\s*(?:[º°o])?\s*(?:-\s*([A-Z]))?\s*[.\-–—]?\s*(.*)$/;
const RE_PAR_UNICO = /^Par[áa]grafo\s+[úu]nico\s*[.\-–—:]?\s*(.*)$/i;
const RE_INCISO = /^([IVXLCDM]+)(?:\s*-\s*([A-Z]))?\s*[-–—]\s*(.*)$/;
const RE_ALINEA = /^([a-z])\)\s*(.*)$/;
const RE_ITEM = /^(\d{1,2})\.\s+(.*)$/;
const RE_TITULO = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|Se[çc][ãa]o|SUBSE[ÇC][ÃA]O|Subse[çc][ãa]o)\b/;
const RE_FIM = /^(Bras[íi]lia,\s*\d|Este texto n[ãa]o substitui)/i;

/** Notas de alteração do Planalto, que não devem ir para a projeção. */
const RE_NOTA =
  /\s*\((?:Reda[çc][ãa]o dada|Inclu[íi]d[oa]s?|Revogad[oa]s? pel|Vig[êe]ncia|Vide|Promulga[çc][ãa]o|Produ[çc][ãa]o de efeitos?|Regulamento|Renumerad[oa]|Acrescid[oa]|Revigorad[oa]|Mensagem de veto|Declarad[oa]|Execu[çc][ãa]o suspensa|Suspens[oa]|Convers[ãa]o da Medida|Ver ADI|Vide ADI)[^()]*(?:\([^()]*\)[^()]*)*\)/gi;

export function separarNotas(texto: string): { texto: string; notas: string[] } {
  const notas: string[] = [];
  const limpo = texto
    .replace(RE_NOTA, (m) => {
      notas.push(m.trim());
      return ' ';
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
  return { texto: limpo, notas };
}

export function formatarNumeroArtigo(n: number, sufixo = ''): string {
  const base = n >= 1000 ? n.toLocaleString('pt-BR') : String(n);
  return (n < 10 ? `${base}º` : base) + (sufixo ? `-${sufixo}` : '');
}

function novo(tipo: Dispositivo['tipo'], numero: string, rotulo: string, textoBruto: string): Dispositivo {
  const { texto, notas } = separarNotas(textoBruto);
  return { tipo, numero, rotulo, texto, notas, filhos: [] };
}

function anexarTexto(d: Dispositivo, linha: string) {
  const { texto, notas } = separarNotas(linha);
  if (texto) d.texto = d.texto ? `${d.texto} ${texto}` : texto;
  d.notas.push(...notas);
}

const NIVEL_TITULO: Record<string, number> = {
  PARTE: 0, LIVRO: 1, TITULO: 2, CAPITULO: 3, SECAO: 4, SUBSECAO: 5,
};

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function fatiar(linhas: string[], diploma = 'cpc'): ResultadoFatiador {
  const artigos: ArtigoFatiado[] = [];
  const avisos: string[] = [];
  let ignoradas = 0;

  let art: ArtigoFatiado | null = null;
  let paragrafo: Dispositivo | null = null; // parágrafo atual (ou null = caput)
  let inciso: Dispositivo | null = null;
  let alinea: Dispositivo | null = null;
  let ultimo: Dispositivo | null = null; // recebe linhas de continuação
  let emCitacao = false; // dentro de “...” (texto de outra lei alterada pelo CPC)
  const titulos: string[] = [];
  let aguardandoNomeTitulo = -1;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (RE_FIM.test(linha)) break;

    // Texto entre aspas: é redação de OUTRA lei (ex.: art. 1.071 inclui o art. 216-A
    // na Lei de Registros Públicos). Fica no artigo atual como citação.
    if (emCitacao || /^[“"]/.test(linha)) {
      if (art) {
        const destino = paragrafo ?? art.caput;
        destino.filhos.push({ tipo: 'item', numero: '', rotulo: '', texto: linha, notas: [], filhos: [] });
      } else ignoradas++;
      emCitacao = !/[”"]\s*(\(NR\))?\s*[.;]?\s*$/.test(linha.replace(/^[“"]/, ''));
      continue;
    }

    const mTitulo = RE_TITULO.exec(linha);
    if (mTitulo) {
      const nivel = NIVEL_TITULO[semAcento(mTitulo[1]).toUpperCase()] ?? 5;
      titulos.length = nivel;
      titulos[nivel] = linha;
      aguardandoNomeTitulo = nivel;
      continue;
    }

    const mArt = RE_ARTIGO.exec(linha);
    if (mArt) {
      const numero = parseInt(mArt[1].replace(/\./g, ''), 10);
      const sufixo = mArt[2] ?? '';
      const rotulo = `Art. ${formatarNumeroArtigo(numero, sufixo)}`;
      art = {
        formato: 'legislacao/artigo@1',
        diploma,
        artigo: numero,
        sufixo,
        rotulo,
        caput: novo('caput', '', 'caput', mArt[3]),
        paragrafos: [],
        localizacao: titulos.filter(Boolean),
        linha: i,
      };
      artigos.push(art);
      paragrafo = inciso = alinea = null;
      ultimo = art.caput;
      aguardandoNomeTitulo = -1;
      continue;
    }

    if (aguardandoNomeTitulo >= 0) {
      // Linha logo abaixo de "CAPÍTULO I": é o nome do capítulo.
      titulos[aguardandoNomeTitulo] = `${titulos[aguardandoNomeTitulo]} – ${linha}`;
      aguardandoNomeTitulo = -1;
      continue;
    }

    if (!art) {
      ignoradas++; // preâmbulo, cabeçalho etc.
      continue;
    }

    const mParU = RE_PAR_UNICO.exec(linha);
    const mPar = mParU ? null : RE_PARAGRAFO.exec(linha);
    if (mParU || mPar) {
      const numero = mParU ? 'unico' : String(parseInt(mPar![1], 10)) + (mPar![2] ? `-${mPar![2]}` : '');
      const n = parseInt(numero, 10);
      const rotulo = mParU ? 'Parágrafo único' : `§ ${n < 10 ? `${n}º` : n}${mPar![2] ? `-${mPar![2]}` : ''}`;
      paragrafo = novo('paragrafo', numero, rotulo, mParU ? mParU[1] : mPar![3]);
      art.paragrafos.push(paragrafo);
      inciso = alinea = null;
      ultimo = paragrafo;
      continue;
    }

    const mInc = RE_INCISO.exec(linha);
    if (mInc) {
      const valor = romanoParaNumero(mInc[1]);
      if (valor !== null) {
        const numero = String(valor) + (mInc[2] ? `-${mInc[2]}` : '');
        inciso = novo('inciso', numero, mInc[1] + (mInc[2] ? `-${mInc[2]}` : ''), mInc[3]);
        (paragrafo ?? art.caput).filhos.push(inciso);
        alinea = null;
        ultimo = inciso;
        continue;
      }
    }

    const mAli = RE_ALINEA.exec(linha);
    if (mAli && inciso) {
      alinea = novo('alinea', mAli[1], `${mAli[1]})`, mAli[2]);
      inciso.filhos.push(alinea);
      ultimo = alinea;
      continue;
    }

    const mItem = RE_ITEM.exec(linha);
    if (mItem && alinea) {
      const item = novo('item', mItem[1], `${mItem[1]}.`, mItem[2]);
      alinea.filhos.push(item);
      ultimo = item;
      continue;
    }

    // Só uma nota solta, ou continuação do dispositivo anterior.
    if (ultimo) anexarTexto(ultimo, linha);
    else ignoradas++;
  }

  const duplicidades = acharDuplicidades(artigos);
  if (artigos.length === 0) avisos.push('Nenhum artigo encontrado. Confira se o arquivo é o texto da lei.');
  const presentes = new Set(artigos.map((a) => a.artigo));
  const maior = Math.max(0, ...presentes);
  const lacunas: number[] = [];
  for (let n = 1; n <= maior; n++) if (!presentes.has(n)) lacunas.push(n);
  return { artigos, duplicidades, ignoradas, lacunas, avisos };
}

/**
 * A página da Constituição no Planalto traz também o ADCT, cujos artigos
 * recomeçam do 1º. Separa os dois textos.
 */
export function dividirConstituicao(linhas: string[]): { cf: string[]; adct: string[] | null } {
  const inicio = linhas.findIndex((l) => /^Art\.?\s*1/.test(l));
  const k = linhas.findIndex((l, i) => i > inicio && /^ATO DAS DISPOSI[ÇC][ÕO]ES CONSTITUCIONAIS TRANSIT[ÓO]RIAS\s*$/.test(l));
  if (inicio < 0 || k < 0) return { cf: linhas, adct: null };
  return { cf: linhas.slice(0, k), adct: linhas.slice(k + 1) };
}

export function chaveArtigo(a: { artigo: number; sufixo: string }): string {
  return a.sufixo ? `${a.artigo}-${a.sufixo}` : String(a.artigo);
}

function inicio(texto: string, max = 140): string {
  return texto.length > max ? texto.slice(0, max).trimEnd() + '…' : texto;
}

function acharDuplicidades(artigos: ArtigoFatiado[]): Duplicidade[] {
  const dups: Duplicidade[] = [];
  const porNumero = new Map<string, ArtigoFatiado[]>();
  for (const a of artigos) {
    const k = chaveArtigo(a);
    porNumero.set(k, [...(porNumero.get(k) ?? []), a]);
  }
  for (const [k, lista] of porNumero) {
    if (lista.length > 1) {
      dups.push({ onde: lista[0].rotulo, tipo: 'artigo', artigoChave: k, versoes: lista.map((a) => inicio(a.caput.texto)) });
    }
  }
  // Dispositivos repetidos dentro de um mesmo artigo (ex.: dois "§ 1º").
  for (const a of artigos) {
    const verificar = (pai: Dispositivo[], prefixo: string) => {
      const vistos = new Map<string, Dispositivo[]>();
      for (const d of pai) {
        if (d.tipo === 'item' && !d.numero) continue;
        const k = `${d.tipo}:${d.numero}`;
        vistos.set(k, [...(vistos.get(k) ?? []), d]);
      }
      for (const lista of vistos.values()) {
        if (lista.length > 1) {
          dups.push({
            onde: `${prefixo}, ${lista[0].rotulo}`,
            tipo: 'dispositivo',
            artigoChave: chaveArtigo(a),
            versoes: lista.map((d) => inicio(d.texto)),
          });
        }
      }
      for (const d of pai) verificar(d.filhos, `${prefixo}, ${d.rotulo}`);
    };
    verificar(a.caput.filhos, a.rotulo);
    verificar(a.paragrafos, a.rotulo);
  }
  return dups;
}

/**
 * Resolve duplicidades de artigos: para cada número repetido, mantém a
 * versão escolhida (índice) — por padrão, a última (no Planalto a redação
 * nova vem depois da antiga). Dispositivos repetidos dentro de um artigo:
 * mantém o último.
 */
export function resolverDuplicidades(artigos: ArtigoFatiado[], escolhas: Record<string, number> = {}): ArtigoFatiado[] {
  const grupos = new Map<string, ArtigoFatiado[]>();
  for (const a of artigos) {
    const k = chaveArtigo(a);
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  const resultado: ArtigoFatiado[] = [];
  for (const [k, lista] of grupos) {
    const idx = escolhas[k] ?? lista.length - 1;
    resultado.push(dedupDispositivos(lista[Math.min(idx, lista.length - 1)]));
  }
  return resultado.sort((x, y) => x.artigo - y.artigo || x.sufixo.localeCompare(y.sufixo));
}

function dedupLista(lista: Dispositivo[]): Dispositivo[] {
  const ultimoIdx = new Map<string, number>();
  lista.forEach((d, i) => {
    if (!(d.tipo === 'item' && !d.numero)) ultimoIdx.set(`${d.tipo}:${d.numero}`, i);
  });
  return lista
    .filter((d, i) => (d.tipo === 'item' && !d.numero) || ultimoIdx.get(`${d.tipo}:${d.numero}`) === i)
    .map((d) => ({ ...d, filhos: dedupLista(d.filhos) }));
}

function dedupDispositivos(a: ArtigoFatiado): ArtigoFatiado {
  return { ...a, caput: { ...a.caput, filhos: dedupLista(a.caput.filhos) }, paragrafos: dedupLista(a.paragrafos) };
}
