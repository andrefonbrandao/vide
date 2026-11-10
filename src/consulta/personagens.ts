// Elenco do jogo "Consulta": quem é cada personagem (o desenho fica em desenho.ts).
// As expressões trocam só sobrancelhas, olhos e boca, e valem para todos os personagens.

export type Expressao = 'neutro' | 'duvida' | 'medo' | 'feliz';
export const EXPRESSOES: Expressao[] = ['neutro', 'duvida', 'medo', 'feliz'];

type EstiloCabelo = 'longo' | 'cacheado' | 'coque' | 'chanel' | 'curtinho' | 'rabo' | 'curto' | 'raspado' | 'calvo' | 'arrepiado';
type Roupa = 'camiseta' | 'camisa' | 'cardiga' | 'moletom' | 'terno' | 'tailleur' | 'toga';

export interface Personagem {
  id: string;
  pessoa: 'mulher' | 'homem';
  idade: 'jovem' | 'adulto' | 'idoso';
  papel: 'consulente' | 'advogado' | 'juiz';
  pele: string;
  cabelo: EstiloCabelo;
  corCabelo: string;
  roupa: Roupa;
  corRoupa: string;
  oculos?: boolean;
  barba?: 'barba' | 'bigode';
  brincos?: boolean;
}

const PELE = ['#f3d2b3', '#e3b08a', '#c98c64', '#9a6443', '#6b412b'];
const CABELO = { preto: '#2b2420', castanho: '#5b3a25', ruivo: '#a5552c', loiro: '#d9b46a', grisalho: '#b8b3a9' };
const ROUPA = { coral: '#e8735a', verde: '#1e3a34', salvia: '#6f8f75', mostarda: '#c99a45', azul: '#4f6d8a', ameixa: '#8a5a78' };

export const ELENCO: Personagem[] = [
  { id: 'm1', pessoa: 'mulher', idade: 'jovem', papel: 'consulente', pele: PELE[1], cabelo: 'longo', corCabelo: CABELO.castanho, roupa: 'camiseta', corRoupa: ROUPA.coral },
  { id: 'm2', pessoa: 'mulher', idade: 'adulto', papel: 'consulente', pele: PELE[4], cabelo: 'cacheado', corCabelo: CABELO.preto, roupa: 'camisa', corRoupa: ROUPA.mostarda },
  { id: 'm3', pessoa: 'mulher', idade: 'idoso', papel: 'consulente', pele: PELE[0], cabelo: 'coque', corCabelo: CABELO.grisalho, roupa: 'cardiga', corRoupa: ROUPA.ameixa, oculos: true },
  { id: 'm4', pessoa: 'mulher', idade: 'adulto', papel: 'consulente', pele: PELE[2], cabelo: 'chanel', corCabelo: CABELO.preto, roupa: 'camiseta', corRoupa: ROUPA.salvia, brincos: true },
  { id: 'm5', pessoa: 'mulher', idade: 'idoso', papel: 'consulente', pele: PELE[3], cabelo: 'curtinho', corCabelo: CABELO.grisalho, roupa: 'camisa', corRoupa: ROUPA.azul, brincos: true },
  { id: 'm6', pessoa: 'mulher', idade: 'jovem', papel: 'consulente', pele: PELE[0], cabelo: 'rabo', corCabelo: CABELO.ruivo, roupa: 'moletom', corRoupa: ROUPA.verde },
  { id: 'h1', pessoa: 'homem', idade: 'jovem', papel: 'consulente', pele: PELE[3], cabelo: 'curto', corCabelo: CABELO.preto, roupa: 'camiseta', corRoupa: ROUPA.azul },
  { id: 'h2', pessoa: 'homem', idade: 'adulto', papel: 'consulente', pele: PELE[0], cabelo: 'curto', corCabelo: CABELO.castanho, roupa: 'camisa', corRoupa: ROUPA.salvia, barba: 'barba' },
  { id: 'h3', pessoa: 'homem', idade: 'idoso', papel: 'consulente', pele: PELE[2], cabelo: 'calvo', corCabelo: CABELO.grisalho, roupa: 'camisa', corRoupa: ROUPA.mostarda, oculos: true, barba: 'bigode' },
  { id: 'h4', pessoa: 'homem', idade: 'adulto', papel: 'consulente', pele: PELE[4], cabelo: 'raspado', corCabelo: CABELO.preto, roupa: 'camiseta', corRoupa: ROUPA.coral },
  { id: 'h5', pessoa: 'homem', idade: 'jovem', papel: 'consulente', pele: PELE[1], cabelo: 'arrepiado', corCabelo: CABELO.loiro, roupa: 'moletom', corRoupa: ROUPA.verde },
  { id: 'h6', pessoa: 'homem', idade: 'idoso', papel: 'consulente', pele: PELE[4], cabelo: 'curto', corCabelo: CABELO.grisalho, roupa: 'cardiga', corRoupa: ROUPA.azul, barba: 'barba' },
  // Quem responde.
  { id: 'adv-m', pessoa: 'mulher', idade: 'adulto', papel: 'advogado', pele: PELE[2], cabelo: 'rabo', corCabelo: CABELO.preto, roupa: 'tailleur', corRoupa: ROUPA.verde, brincos: true },
  { id: 'adv-h', pessoa: 'homem', idade: 'adulto', papel: 'advogado', pele: PELE[3], cabelo: 'curto', corCabelo: CABELO.preto, roupa: 'terno', corRoupa: ROUPA.verde },
  { id: 'juiz-m', pessoa: 'mulher', idade: 'adulto', papel: 'juiz', pele: PELE[0], cabelo: 'chanel', corCabelo: CABELO.castanho, roupa: 'toga', corRoupa: '#1d211f', oculos: true },
  { id: 'juiz-h', pessoa: 'homem', idade: 'idoso', papel: 'juiz', pele: PELE[1], cabelo: 'curto', corCabelo: CABELO.grisalho, roupa: 'toga', corRoupa: '#1d211f' },
];

/** Sorteia um consulente compatível com a "Pessoa" do caso (mulher/homem, jovem/adulto/idoso). */
export function sortearConsulente(pessoa: { genero?: 'mulher' | 'homem'; idade?: Personagem['idade'] }, aleatorio = Math.random): Personagem {
  const todos = ELENCO.filter((p) => p.papel === 'consulente');
  let lista = todos.filter((p) => (!pessoa.genero || p.pessoa === pessoa.genero) && (!pessoa.idade || p.idade === pessoa.idade));
  if (!lista.length) lista = todos.filter((p) => !pessoa.genero || p.pessoa === pessoa.genero);
  if (!lista.length) lista = todos;
  return lista[Math.floor(aleatorio() * lista.length)];
}
