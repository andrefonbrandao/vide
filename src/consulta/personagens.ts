// Elenco do jogo "Consulta": personagens desenhados em partes (SVG), no estilo do Vide.
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
}

const PELE = ['#f3d2b3', '#e3b08a', '#c98c64', '#9a6443', '#6b412b'];
const CABELO = { preto: '#2b2420', castanho: '#5b3a25', ruivo: '#a5552c', loiro: '#d9b46a', grisalho: '#b8b3a9' };
const ROUPA = { coral: '#e8735a', verde: '#1e3a34', salvia: '#6f8f75', mostarda: '#c99a45', azul: '#4f6d8a', ameixa: '#8a5a78' };

export const ELENCO: Personagem[] = [
  { id: 'm1', pessoa: 'mulher', idade: 'jovem', papel: 'consulente', pele: PELE[1], cabelo: 'longo', corCabelo: CABELO.castanho, roupa: 'camiseta', corRoupa: ROUPA.coral },
  { id: 'm2', pessoa: 'mulher', idade: 'adulto', papel: 'consulente', pele: PELE[4], cabelo: 'cacheado', corCabelo: CABELO.preto, roupa: 'camisa', corRoupa: ROUPA.mostarda },
  { id: 'm3', pessoa: 'mulher', idade: 'idoso', papel: 'consulente', pele: PELE[0], cabelo: 'coque', corCabelo: CABELO.grisalho, roupa: 'cardiga', corRoupa: ROUPA.ameixa, oculos: true },
  { id: 'm4', pessoa: 'mulher', idade: 'adulto', papel: 'consulente', pele: PELE[2], cabelo: 'chanel', corCabelo: CABELO.preto, roupa: 'camiseta', corRoupa: ROUPA.salvia },
  { id: 'm5', pessoa: 'mulher', idade: 'idoso', papel: 'consulente', pele: PELE[3], cabelo: 'curtinho', corCabelo: CABELO.grisalho, roupa: 'camisa', corRoupa: ROUPA.azul },
  { id: 'm6', pessoa: 'mulher', idade: 'jovem', papel: 'consulente', pele: PELE[0], cabelo: 'rabo', corCabelo: CABELO.ruivo, roupa: 'moletom', corRoupa: ROUPA.verde },
  { id: 'h1', pessoa: 'homem', idade: 'jovem', papel: 'consulente', pele: PELE[3], cabelo: 'curto', corCabelo: CABELO.preto, roupa: 'camiseta', corRoupa: ROUPA.azul },
  { id: 'h2', pessoa: 'homem', idade: 'adulto', papel: 'consulente', pele: PELE[0], cabelo: 'curto', corCabelo: CABELO.castanho, roupa: 'camisa', corRoupa: ROUPA.salvia, barba: 'barba' },
  { id: 'h3', pessoa: 'homem', idade: 'idoso', papel: 'consulente', pele: PELE[2], cabelo: 'calvo', corCabelo: CABELO.grisalho, roupa: 'camisa', corRoupa: ROUPA.mostarda, oculos: true, barba: 'bigode' },
  { id: 'h4', pessoa: 'homem', idade: 'adulto', papel: 'consulente', pele: PELE[4], cabelo: 'raspado', corCabelo: CABELO.preto, roupa: 'camiseta', corRoupa: ROUPA.coral },
  { id: 'h5', pessoa: 'homem', idade: 'jovem', papel: 'consulente', pele: PELE[1], cabelo: 'arrepiado', corCabelo: CABELO.loiro, roupa: 'moletom', corRoupa: ROUPA.verde },
  { id: 'h6', pessoa: 'homem', idade: 'idoso', papel: 'consulente', pele: PELE[4], cabelo: 'curto', corCabelo: CABELO.grisalho, roupa: 'cardiga', corRoupa: ROUPA.azul, barba: 'barba' },
  // Quem responde.
  { id: 'adv-m', pessoa: 'mulher', idade: 'adulto', papel: 'advogado', pele: PELE[2], cabelo: 'rabo', corCabelo: CABELO.preto, roupa: 'tailleur', corRoupa: ROUPA.verde },
  { id: 'adv-h', pessoa: 'homem', idade: 'adulto', papel: 'advogado', pele: PELE[3], cabelo: 'curto', corCabelo: CABELO.preto, roupa: 'terno', corRoupa: ROUPA.verde },
  { id: 'juiz-m', pessoa: 'mulher', idade: 'adulto', papel: 'juiz', pele: PELE[0], cabelo: 'chanel', corCabelo: CABELO.castanho, roupa: 'toga', corRoupa: '#1d211f', oculos: true },
  { id: 'juiz-h', pessoa: 'homem', idade: 'idoso', papel: 'juiz', pele: PELE[1], cabelo: 'curto', corCabelo: CABELO.grisalho, roupa: 'toga', corRoupa: '#1d211f' },
];

const TRACO = '#2a2320';
const BRANCO = '#f8f9f5';

/** Um tom mais escuro (para nariz, sombras e dobras). */
function escurecer(cor: string, f = 0.78): string {
  const n = parseInt(cor.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) * f);
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

function cabeloAtras(p: Personagem): string {
  const c = p.corCabelo;
  switch (p.cabelo) {
    case 'longo':
      return `<path d="M54 96 C 46 22, 154 22, 146 96 L 150 176 Q 100 188 50 176 Z" fill="${c}"/>`;
    case 'cacheado': {
      let s = `<circle cx="100" cy="82" r="52" fill="${c}"/>`;
      for (let a = 0; a < 360; a += 30) {
        if (a > 50 && a < 130) continue; // sem cachos embaixo do queixo
        const r = (a * Math.PI) / 180;
        s += `<circle cx="${(100 + 50 * Math.cos(r)).toFixed(1)}" cy="${(84 + 50 * Math.sin(r)).toFixed(1)}" r="20" fill="${c}"/>`;
      }
      return s;
    }
    case 'coque':
      return `<circle cx="100" cy="32" r="17" fill="${c}"/>`;
    case 'chanel':
      return `<path d="M52 130 C 42 22, 158 22, 148 130 Q 100 140 52 130 Z" fill="${c}"/>`;
    case 'rabo':
      return `<path d="M124 52 C 166 58, 168 118, 150 150 C 146 120, 140 92, 118 70 Z" fill="${c}"/>`;
    default:
      return '';
  }
}

function cabeloFrente(p: Personagem): string {
  const c = p.corCabelo;
  switch (p.cabelo) {
    case 'longo':
      return `<path d="M58 96 C 52 26, 148 24, 142 96 C 132 72, 112 62, 96 62 C 80 64, 66 76, 58 96 Z" fill="${c}"/>`;
    case 'cacheado':
      return [ [70, 64], [84, 54], [100, 51], [116, 54], [130, 64] ].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${c}"/>`).join('');
    case 'coque':
      return `<path d="M60 92 C 54 28, 146 28, 140 92 C 132 70, 114 62, 100 66 C 86 62, 68 70, 60 92 Z" fill="${c}"/><path d="M100 46 L 100 64" stroke="${escurecer(c)}" stroke-width="2"/>`;
    case 'chanel':
      return `<path d="M60 86 C 56 28, 144 28, 140 86 Q 120 74 100 76 Q 80 74 60 86 Z" fill="${c}"/>`;
    case 'curtinho':
      return `<path d="M58 98 C 50 26, 150 26, 142 98 C 140 82, 134 72, 126 66 C 110 74, 84 72, 70 66 C 64 74, 60 86, 58 98 Z" fill="${c}"/>`;
    case 'rabo':
      return `<path d="M60 90 C 54 28, 146 28, 140 90 C 130 70, 112 60, 92 64 C 78 66, 66 74, 60 90 Z" fill="${c}"/>`;
    case 'curto':
      return `<path d="M60 88 C 56 26, 144 26, 140 88 C 134 72, 120 62, 100 62 C 80 62, 66 72, 60 88 Z" fill="${c}"/>`;
    case 'raspado':
      return `<path d="M62 82 C 62 32, 138 32, 138 82 C 124 66, 76 66, 62 82 Z" fill="${c}" opacity="0.9"/>`;
    case 'calvo':
      return `<path d="M58 104 C 56 86, 60 76, 66 72 L 68 104 Z" fill="${c}"/><path d="M142 104 C 144 86, 140 76, 134 72 L 132 104 Z" fill="${c}"/>`;
    case 'arrepiado':
      return `<path d="M60 88 C 54 44, 76 32, 100 36 C 124 32, 146 44, 140 88 L 132 70 L 122 76 L 114 64 L 102 74 L 90 64 L 80 76 L 70 68 Z" fill="${c}"/>`;
  }
}

function roupa(p: Personagem): string {
  const c = p.corRoupa;
  const corpo = `<path d="M22 220 C 24 176, 52 158, 100 156 C 148 158, 176 176, 178 220 Z" fill="${c}"/>`;
  const decote = `<path d="M84 155 Q 100 174 116 155 Z" fill="${p.pele}"/>`;
  switch (p.roupa) {
    case 'camiseta':
      return corpo + decote;
    case 'camisa':
      return (
        corpo +
        `<path d="M86 155 L 100 178 L 114 155 Z" fill="${p.pele}"/>` +
        `<path d="M84 152 L 100 176 L 90 182 L 78 160 Z" fill="${BRANCO}"/><path d="M116 152 L 100 176 L 110 182 L 122 160 Z" fill="${BRANCO}"/>`
      );
    case 'cardiga':
      return corpo + `<path d="M86 156 L 100 220 L 114 156 Z" fill="${BRANCO}"/>` + decote + `<circle cx="95" cy="196" r="2.2" fill="${escurecer(c, 0.6)}"/><circle cx="95" cy="210" r="2.2" fill="${escurecer(c, 0.6)}"/>`;
    case 'moletom':
      return (
        corpo +
        `<path d="M64 170 Q 100 146 136 170 Q 100 182 64 170 Z" fill="${escurecer(c, 0.75)}"/>` +
        decote +
        `<path d="M92 172 L 90 196 M108 172 L 110 196" stroke="${BRANCO}" stroke-width="2.4" stroke-linecap="round"/>`
      );
    case 'terno':
      return (
        corpo +
        `<path d="M84 156 L 100 206 L 116 156 Z" fill="${BRANCO}"/>` +
        `<path d="M96.5 168 L 103.5 168 L 106 198 L 100 208 L 94 198 Z" fill="#e8735a"/>` +
        `<path d="M82 156 L 100 210 M118 156 L 100 210" stroke="${escurecer(c, 0.6)}" stroke-width="3"/>`
      );
    case 'tailleur':
      return corpo + `<path d="M84 156 L 100 200 L 116 156 Z" fill="${BRANCO}"/>` + decote + `<path d="M82 156 L 100 206 M118 156 L 100 206" stroke="${escurecer(c, 0.6)}" stroke-width="3"/>`;
    case 'toga':
      return (
        corpo +
        `<path d="M70 178 Q 74 200 72 220 M130 178 Q 126 200 128 220" stroke="#3a403d" stroke-width="2.4" fill="none"/>` +
        `<path d="M84 154 L 100 178 L 116 154 L 112 152 L 100 168 L 88 152 Z" fill="${BRANCO}"/>`
      );
  }
}

function rosto(p: Personagem, e: Expressao): string {
  const sombra = escurecer(p.pele);
  let s = '';
  // Rugas (idoso).
  if (p.idade === 'idoso') {
    s += `<path d="M86 66 q14 -4 28 0 M90 72 q10 -3 20 0" stroke="${sombra}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M76 108 q6 3 10 0 M114 108 q6 3 10 0" stroke="${sombra}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
  // Barba antes da boca (a boca fica por cima).
  if (p.barba === 'barba') {
    s += `<path fill-rule="evenodd" d="M62 102 C 64 142, 86 148, 100 148 C 114 148, 136 142, 138 102 C 130 124, 116 128, 100 128 C 84 128, 70 124, 62 102 Z" fill="${p.corCabelo}"/>`;
    s += `<path d="M84 116 Q 100 106 116 116 Q 100 113 84 116 Z" fill="${p.corCabelo}"/>`;
  } else if (p.barba === 'bigode') {
    s += `<path d="M84 117 Q 92 108 100 113 Q 108 108 116 117 Q 100 114 84 117 Z" fill="${p.corCabelo}"/>`;
  }
  // Bochechas.
  s += `<circle cx="74" cy="110" r="7" fill="#e8735a" opacity="${e === 'feliz' ? 0.35 : 0.14}"/><circle cx="126" cy="110" r="7" fill="#e8735a" opacity="${e === 'feliz' ? 0.35 : 0.14}"/>`;
  // Nariz.
  s += `<path d="M101 98 q -5 9 1 12" stroke="${sombra}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

  const linha = (d: string, w = 3.2) => `<path d="${d}" stroke="${TRACO}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  switch (e) {
    case 'neutro':
      s += linha('M73 80 q10 -5 20 -1') + linha('M107 79 q10 -4 20 1');
      s += `<circle cx="84" cy="93" r="4.6" fill="${TRACO}"/><circle cx="116" cy="93" r="4.6" fill="${TRACO}"/>`;
      s += linha('M90 121 q10 3 20 0', 3);
      break;
    case 'feliz':
      s += linha('M73 76 q10 -7 20 -2') + linha('M107 74 q10 -5 20 2');
      s += linha('M78 95 q6 -8 12 0') + linha('M110 95 q6 -8 12 0');
      s += `<path d="M86 116 Q 100 136 114 116 Z" fill="#5b2620"/><path d="M90 118 Q 100 121 110 118 L 109 116 L 91 116 Z" fill="${BRANCO}"/>`;
      break;
    case 'duvida':
      s += linha('M73 74 q10 -9 20 -3') + linha('M107 82 l20 -3');
      s += `<circle cx="86" cy="93" r="4.6" fill="${TRACO}"/><circle cx="118" cy="94" r="4.2" fill="${TRACO}"/>`;
      s += linha('M92 122 q8 -5 17 -1', 3);
      break;
    case 'medo':
      s += linha('M74 82 L 93 75') + linha('M107 75 L 126 82');
      s += `<circle cx="84" cy="94" r="7" fill="${BRANCO}" stroke="${TRACO}" stroke-width="1.6"/><circle cx="116" cy="94" r="7" fill="${BRANCO}" stroke="${TRACO}" stroke-width="1.6"/>`;
      s += `<circle cx="84" cy="95" r="3.2" fill="${TRACO}"/><circle cx="116" cy="95" r="3.2" fill="${TRACO}"/>`;
      s += `<ellipse cx="100" cy="122" rx="6" ry="5" fill="#5b2620"/>`;
      s += `<path d="M140 70 q 5 8 0 11 q -5 -3 0 -11 Z" fill="#9cc3d5"/>`;
      break;
  }
  if (p.oculos) {
    s += `<g stroke="${TRACO}" stroke-width="2.4" fill="${BRANCO}" fill-opacity="0.18"><circle cx="84" cy="94" r="11"/><circle cx="116" cy="94" r="11"/></g>`;
    s += linha('M95 93 q5 -3 10 0', 2.4) + linha('M73 92 L 62 89', 2.4) + linha('M127 92 L 138 89', 2.4);
  }
  return s;
}

/** O personagem em SVG (texto), com a expressão pedida. */
export function desenharPersonagem(p: Personagem, e: Expressao = 'neutro'): string {
  const orelha = `<ellipse cx="60" cy="98" rx="7" ry="10" fill="${p.pele}"/><ellipse cx="140" cy="98" rx="7" ry="10" fill="${p.pele}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" class="personagem">` +
    cabeloAtras(p) +
    roupa(p) +
    `<rect x="87" y="124" width="26" height="36" rx="8" fill="${escurecer(p.pele, 0.9)}"/>` +
    orelha +
    `<ellipse cx="100" cy="94" rx="40" ry="46" fill="${p.pele}"/>` +
    cabeloFrente(p) +
    rosto(p, e) +
    `</svg>`
  );
}

/** Sorteia um consulente compatível com a "Pessoa" do caso (mulher/homem, jovem/adulto/idoso). */
export function sortearConsulente(pessoa: { genero?: 'mulher' | 'homem'; idade?: Personagem['idade'] }, aleatorio = Math.random): Personagem {
  const todos = ELENCO.filter((p) => p.papel === 'consulente');
  let lista = todos.filter((p) => (!pessoa.genero || p.pessoa === pessoa.genero) && (!pessoa.idade || p.idade === pessoa.idade));
  if (!lista.length) lista = todos.filter((p) => !pessoa.genero || p.pessoa === pessoa.genero);
  if (!lista.length) lista = todos;
  return lista[Math.floor(aleatorio() * lista.length)];
}
