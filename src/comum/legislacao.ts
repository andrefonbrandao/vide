// Liga uma referência detectada ao item do acervo e monta o que vai para a tela.
import type { ConteudoLegislacao, Dispositivo, Item } from '../dados/modelo';
import { formatarNumeroArtigo } from '../fatiador/fatiador';
import { abreviacaoDe } from '../dados/diplomas';
import { numeroParaRomano } from '../voz/numeros';
import type { Referencia } from '../voz/detector';

/** Um bloco de texto na projeção. */
export interface Bloco {
  rotulo: string;
  texto: string;
  /** 0 = caput/parágrafo, 1 = inciso, 2 = alínea, 3 = item. */
  nivel: number;
  destaque: boolean;
  /** Marcador de trecho omitido ("…"). */
  omissao?: boolean;
}

/** O que a janela de projeção recebe. Genérico para servir a outros tipos no futuro. */
export interface Projetavel {
  id: string;
  tipo: Item['tipo'];
  /** Identificação: "Art. 485, VI" */
  titulo: string;
  /** Diploma ou fonte: "CPC" */
  fonte: string;
  blocos: Bloco[];
}

export interface Resolucao {
  item: Item;
  /** "art. 485, VI CPC" */
  titulo: string;
  /** Início do texto do dispositivo citado. */
  texto: string;
  projetavel: Projetavel;
  /** Aviso quando parte da referência não existe (ex.: inciso XX). */
  aviso: string | null;
}

export function chaveItemArtigo(diploma: string, art: number, sufixo = ''): string {
  return `${diploma}:art:${sufixo ? `${art}-${sufixo}` : art}`;
}

function rotuloPar(p: Dispositivo): string {
  return p.numero === 'unico' ? 'parágrafo único' : p.rotulo;
}

function nivelDe(d: Dispositivo): number {
  return d.tipo === 'inciso' ? 1 : d.tipo === 'alinea' ? 2 : d.tipo === 'item' ? 3 : 0;
}

function bloco(d: Dispositivo, destaque: boolean): Bloco {
  const rotulo = d.tipo === 'inciso' ? `${d.rotulo} –` : d.rotulo;
  return { rotulo, texto: d.texto, nivel: nivelDe(d), destaque };
}

/** Todos os dispositivos de um artigo, em ordem, como blocos. */
function blocosDoArtigo(c: ConteudoLegislacao, destacar: Set<Dispositivo>): Bloco[] {
  const blocos: Bloco[] = [{ rotulo: c.rotulo, texto: c.caput.texto, nivel: 0, destaque: destacar.has(c.caput) }];
  const descer = (lista: Dispositivo[]) => {
    for (const d of lista) {
      blocos.push(bloco(d, destacar.has(d)));
      descer(d.filhos);
    }
  };
  descer(c.caput.filhos);
  for (const p of c.paragrafos) {
    blocos.push(bloco(p, destacar.has(p)));
    descer(p.filhos);
  }
  return blocos;
}

/**
 * Resolve uma referência contra o acervo.
 * Devolve null se o artigo não estiver no acervo.
 */
export function resolver(ref: Referencia, indice: Map<string, Item>, idCandidato: string): Resolucao | null {
  const item = indice.get(chaveItemArtigo(ref.diploma, ref.art, ref.sufixo ?? ''));
  if (!item) return null;
  const c = item.conteudo;
  const partes: string[] = [];
  const avisos: string[] = [];
  let alvo: Dispositivo = c.caput;
  let caminho: Dispositivo[] = [];

  let par: Dispositivo | undefined;
  if (ref.par) {
    par = c.paragrafos.find((p) => p.numero === ref.par);
    if (par) {
      partes.push(rotuloPar(par));
      alvo = par;
      caminho = [par];
    } else avisos.push(ref.par === 'unico' ? 'parágrafo único não encontrado' : `§ ${ref.par} não encontrado`);
  }
  if (ref.inc) {
    const base = par ?? c.caput;
    const inc = base.filhos.find((d) => d.tipo === 'inciso' && d.numero === String(ref.inc));
    if (inc) {
      partes.push(inc.rotulo);
      alvo = inc;
      caminho = [...caminho, inc];
      if (ref.ali) {
        const ali = inc.filhos.find((d) => d.tipo === 'alinea' && d.numero === ref.ali);
        if (ali) {
          partes.push(ali.numero);
          alvo = ali;
          caminho = [...caminho, ali];
        } else avisos.push(`alínea ${ref.ali} não encontrada`);
      }
    } else avisos.push(`inciso ${numeroParaRomano(ref.inc)} não encontrado`);
  }

  const numero = formatarNumeroArtigo(c.artigo, c.sufixo);
  const id = [numero, ...partes].join(', ');
  const abrev = abreviacaoDe(ref.diploma);
  const titulo = `art. ${id} ${abrev}`;

  let blocos: Bloco[];
  if (caminho.length === 0) {
    // Artigo inteiro.
    blocos = blocosDoArtigo(c, new Set());
  } else {
    // Caput + o caminho até o dispositivo citado (com seus filhos), com "…" no que foi omitido.
    blocos = [{ rotulo: c.rotulo, texto: c.caput.texto, nivel: 0, destaque: false }];
    let irmaos: Dispositivo[] = par ? c.paragrafos : c.caput.filhos;
    for (const d of caminho) {
      const idx = irmaos.indexOf(d);
      // Há texto omitido entre o bloco anterior e este?
      const omitido = d.tipo === 'paragrafo' ? idx > 0 || c.caput.filhos.length > 0 : idx > 0;
      if (omitido) blocos.push({ rotulo: '', texto: '…', nivel: nivelDe(d), destaque: false, omissao: true });
      const ehAlvo = d === alvo;
      blocos.push(bloco(d, ehAlvo));
      if (ehAlvo) {
        const descer = (lista: Dispositivo[]) => {
          for (const f of lista) {
            blocos.push(bloco(f, false));
            descer(f.filhos);
          }
        };
        descer(d.filhos);
      }
      irmaos = d.filhos;
    }
  }

  return {
    item,
    titulo,
    texto: alvo.texto,
    aviso: avisos.length ? avisos.join('; ') : null,
    projetavel: {
      id: idCandidato,
      tipo: item.tipo,
      titulo: `Art. ${id}`,
      fonte: abrev,
      blocos,
    },
  };
}

export function inicioDoTexto(texto: string, max = 110): string {
  if (texto.length <= max) return texto;
  const corte = texto.lastIndexOf(' ', max);
  return texto.slice(0, corte > 60 ? corte : max).replace(/[,;:]$/, '') + '…';
}
