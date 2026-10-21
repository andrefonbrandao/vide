// Catálogo de leis (diplomas) que o Vide conhece: sigla, nomes falados e onde
// encontrar o texto no Planalto. Leis fora do catálogo podem ser cadastradas
// pelo professor na importação ("Outra lei").

export interface DefDiploma {
  /** Identificador interno: "cpc", "cf", "l9099". Só letras minúsculas e números. */
  sigla: string;
  /** Como aparece na tela e na projeção: "CPC", "CF", "Lei 9.099/1995". */
  abreviacao: string;
  nome: string;
  /** Formas faladas (sem acento, minúsculas). A mais longa vence. */
  apelidos: string[];
  /** Número da lei, só algarismos ("9099"), para reconhecer "Lei 9.099". */
  numeroLei: string | null;
  /** Maior número de artigo (com folga), para descartar números impossíveis. */
  maxArtigo: number;
  /** Página do texto compilado no Planalto. */
  url: string | null;
  /** O ADCT vem no mesmo arquivo da CF. */
  incluidoEm?: string;
}

export const CATALOGO: DefDiploma[] = [
  {
    sigla: 'cpc',
    abreviacao: 'CPC',
    nome: 'Código de Processo Civil (Lei 13.105/2015)',
    apelidos: ['codigo de processo civil', 'codigo do processo civil', 'codigo processual civil', 'novo cpc', 'novo codigo de processo civil', 'cpc', 'c p c', 'ce pe ce', 'ncpc', 'cepece'],
    numeroLei: '13105',
    maxArtigo: 1100,
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm',
  },
  {
    sigla: 'cf',
    abreviacao: 'CF',
    nome: 'Constituição Federal de 1988',
    apelidos: ['constituicao federal', 'constituicao da republica', 'constituicao', 'carta magna', 'carta constitucional', 'carta da republica', 'cf', 'c f', 'crfb'],
    numeroLei: null,
    maxArtigo: 260,
    url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
  },
  {
    sigla: 'adct',
    abreviacao: 'ADCT',
    nome: 'Ato das Disposições Constitucionais Transitórias',
    apelidos: ['ato das disposicoes constitucionais transitorias', 'adct', 'a d c t'],
    numeroLei: null,
    maxArtigo: 160,
    url: null,
    incluidoEm: 'cf',
  },
  {
    sigla: 'cc',
    abreviacao: 'CC',
    nome: 'Código Civil (Lei 10.406/2002)',
    apelidos: ['codigo civil', 'novo codigo civil', 'cc', 'c c'],
    numeroLei: '10406',
    maxArtigo: 2100,
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
  },
  {
    sigla: 'lindb',
    abreviacao: 'LINDB',
    nome: 'Lei de Introdução às Normas do Direito Brasileiro (Decreto-Lei 4.657/1942)',
    apelidos: ['lei de introducao as normas do direito brasileiro', 'lei de introducao', 'lindb', 'licc'],
    numeroLei: '4657',
    maxArtigo: 40,
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm',
  },
  {
    sigla: 'l9099',
    abreviacao: 'Lei 9.099/1995',
    nome: 'Lei dos Juizados Especiais (Lei 9.099/1995)',
    apelidos: ['lei dos juizados especiais', 'lei dos juizados'],
    numeroLei: '9099',
    maxArtigo: 100,
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9099.htm',
  },
  {
    sigla: 'l12016',
    abreviacao: 'Lei 12.016/2009',
    nome: 'Lei do Mandado de Segurança (Lei 12.016/2009)',
    apelidos: ['lei do mandado de seguranca'],
    numeroLei: '12016',
    maxArtigo: 40,
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm',
  },
  {
    sigla: 'l7347',
    abreviacao: 'Lei 7.347/1985',
    nome: 'Lei da Ação Civil Pública (Lei 7.347/1985)',
    apelidos: ['lei da acao civil publica', 'lacp'],
    numeroLei: '7347',
    maxArtigo: 30,
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l7347compilada.htm',
  },
  {
    sigla: 'cdc',
    abreviacao: 'CDC',
    nome: 'Código de Defesa do Consumidor (Lei 8.078/1990)',
    apelidos: ['codigo de defesa do consumidor', 'codigo do consumidor', 'cdc', 'c d c'],
    numeroLei: '8078',
    maxArtigo: 130,
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  },
  {
    sigla: 'l6830',
    abreviacao: 'Lei 6.830/1980',
    nome: 'Lei de Execução Fiscal (Lei 6.830/1980)',
    apelidos: ['lei de execucao fiscal', 'lei de execucoes fiscais', 'lef'],
    numeroLei: '6830',
    maxArtigo: 50,
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l6830.htm',
  },
  {
    sigla: 'l9307',
    abreviacao: 'Lei 9.307/1996',
    nome: 'Lei de Arbitragem (Lei 9.307/1996)',
    apelidos: ['lei de arbitragem', 'lei da arbitragem'],
    numeroLei: '9307',
    maxArtigo: 50,
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9307.htm',
  },
];

export function normalizarApelido(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Leis cadastradas pelo professor ("Outra lei"), carregadas do banco local. */
let extras: DefDiploma[] = [];
export function definirExtras(lista: DefDiploma[]): void {
  extras = lista.filter((e) => !CATALOGO.some((c) => c.sigla === e.sigla));
}
/** Catálogo + leis cadastradas. */
export function todosDiplomas(): DefDiploma[] {
  return [...CATALOGO, ...extras];
}

/** Abreviação para exibir, a partir da sigla (catálogo + leis cadastradas). */
export function abreviacaoDe(sigla: string): string {
  return todosDiplomas().find((d) => d.sigla === sigla)?.abreviacao ?? sigla.toUpperCase();
}

/** Gera uma sigla interna a partir da abreviação ("Lei 8.429/1992" -> "l8429"). */
export function siglaPara(abreviacao: string, numeroLei: string | null): string {
  if (numeroLei) return `l${numeroLei}`;
  return normalizarApelido(abreviacao).replace(/ /g, '').slice(0, 12) || 'lei';
}

/** Diploma principal da aula: usado quando o professor não diz a lei ("artigo 70"). */
const CHAVE_PRINCIPAL = 'vide.diplomaPrincipal';
export function diplomaPrincipal(): string {
  try {
    return localStorage.getItem(CHAVE_PRINCIPAL) || 'cpc';
  } catch {
    return 'cpc';
  }
}
export function definirDiplomaPrincipal(sigla: string): void {
  try {
    localStorage.setItem(CHAVE_PRINCIPAL, sigla);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('vide-acervo-mudou'));
}
