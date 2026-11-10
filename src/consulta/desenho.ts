// Desenho "refinado" dos personagens do jogo Consulta: ilustração plana com luz e sombra,
// contornos no tom da própria cor, rosto mais cuidado, fundo de retrato e partes animáveis
// (piscar e respirar, por CSS). As expressões trocam só sobrancelhas, olhos e boca.
import type { Expressao, Personagem } from './personagens';

const TRACO = '#2a2320';
const BRANCO = '#fbfcf8';
const LABIO = '#9a4a40';
const BOCA = '#5e2520';

function mistura(a: string, b: string, f: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}
const escuro = (c: string, f = 0.25) => mistura(c, '#1a1512', f);
const claro = (c: string, f = 0.35) => mistura(c, '#ffffff', f);

// Formas fixas (as mesmas para todos): podem ter ids repetidos na página sem problema.
const ROSTO = 'M60 90 C 60 60, 78 46, 100 46 C 122 46, 140 60, 140 90 C 140 119, 123 141, 100 141 C 77 141, 60 119, 60 90 Z';
const CORPO = 'M22 220 C 24 178, 52 160, 100 157 C 148 160, 176 178, 178 220 Z';

const DEFS =
  `<defs>` +
  `<clipPath id="vd-rosto"><path d="${ROSTO}"/></clipPath>` +
  `<clipPath id="vd-corpo"><path d="${CORPO}"/></clipPath>` +
  `</defs>`;

function cabeloAtras(p: Personagem): string {
  const c = escuro(p.corCabelo, 0.12);
  const borda = `stroke="${escuro(p.corCabelo, 0.45)}" stroke-width="1.4"`;
  switch (p.cabelo) {
    case 'longo':
      return `<path d="M54 96 C 46 22, 154 22, 146 96 L 152 178 Q 100 192 48 178 Z" fill="${c}" ${borda}/>`;
    case 'cacheado': {
      let s = '';
      const pts: [number, number][] = [];
      for (let a = 0; a < 360; a += 30) {
        if (a > 50 && a < 130) continue;
        const r = (a * Math.PI) / 180;
        pts.push([100 + 50 * Math.cos(r), 84 + 50 * Math.sin(r)]);
      }
      s += pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="21" fill="${c}" ${borda}/>`).join('');
      s += `<circle cx="100" cy="82" r="52" fill="${c}"/>`;
      // Reflexos dos cachos.
      s += pts
        .slice(0, 6)
        .map(([x, y]) => `<path d="M${(x - 8).toFixed(1)} ${(y - 6).toFixed(1)} q6 -6 13 -2" stroke="${claro(p.corCabelo, 0.3)}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.7"/>`)
        .join('');
      return s;
    }
    case 'coque':
      return `<circle cx="100" cy="32" r="17" fill="${c}" ${borda}/><path d="M90 26 q8 -8 18 -2" stroke="${claro(p.corCabelo, 0.35)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 'chanel':
      return `<path d="M52 132 C 42 22, 158 22, 148 132 Q 100 142 52 132 Z" fill="${c}" ${borda}/>`;
    case 'rabo':
      return `<path d="M124 52 C 168 58, 170 120, 150 152 C 146 122, 140 92, 118 70 Z" fill="${c}" ${borda}/><path d="M140 70 q12 24 8 56" stroke="${claro(p.corCabelo, 0.3)}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.7"/>`;
    default:
      return '';
  }
}

/** Cabelo da frente: forma, sombra embaixo e reflexos. */
function cabeloFrente(p: Personagem): string {
  const c = p.corCabelo;
  const borda = `stroke="${escuro(c, 0.45)}" stroke-width="1.4" stroke-linejoin="round"`;
  const reflexo = (d: string) => `<path d="${d}" stroke="${claro(c, 0.38)}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.75"/>`;
  switch (p.cabelo) {
    case 'longo':
      return `<path d="M58 96 C 52 26, 148 24, 142 96 C 132 72, 112 62, 96 62 C 80 64, 66 76, 58 96 Z" fill="${c}" ${borda}/>` + reflexo('M72 62 q16 -16 40 -14') + reflexo('M118 52 q14 8 18 26');
    case 'cacheado':
      return [[70, 64], [84, 54], [100, 51], [116, 54], [130, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${c}" ${borda}/>`).join('') + reflexo('M80 50 q6 -4 11 0') + reflexo('M108 48 q6 -4 11 0');
    case 'coque':
      return `<path d="M60 92 C 54 28, 146 28, 140 92 C 132 70, 114 62, 100 66 C 86 62, 68 70, 60 92 Z" fill="${c}" ${borda}/><path d="M100 46 L 100 64" stroke="${escuro(c, 0.35)}" stroke-width="2"/>` + reflexo('M72 66 q8 -12 22 -16') + reflexo('M108 50 q14 4 22 18');
    case 'chanel':
      return `<path d="M60 86 C 56 28, 144 28, 140 86 Q 120 74 100 76 Q 80 74 60 86 Z" fill="${c}" ${borda}/>` + reflexo('M74 58 q20 -14 46 -6');
    case 'curtinho':
      return `<path d="M58 98 C 50 26, 150 26, 142 98 C 140 82, 134 72, 126 66 C 110 74, 84 72, 70 66 C 64 74, 60 86, 58 98 Z" fill="${c}" ${borda}/>` + reflexo('M76 56 q22 -12 48 -2');
    case 'rabo':
      return `<path d="M60 90 C 54 28, 146 28, 140 90 C 130 70, 112 60, 92 64 C 78 66, 66 74, 60 90 Z" fill="${c}" ${borda}/>` + reflexo('M74 58 q18 -14 44 -8');
    case 'curto':
      return `<path d="M60 88 C 56 26, 144 26, 140 88 C 134 72, 120 62, 100 62 C 80 62, 66 72, 60 88 Z" fill="${c}" ${borda}/>` + reflexo('M76 52 q18 -10 42 -4');
    case 'raspado':
      return `<path d="M62 82 C 62 32, 138 32, 138 82 C 124 66, 76 66, 62 82 Z" fill="${c}" opacity="0.92"/>` + `<path d="M62 82 C 62 32, 138 32, 138 82" stroke="${escuro(c, 0.3)}" stroke-width="1.2" fill="none" opacity="0.6"/>`;
    case 'calvo':
      return `<path d="M58 104 C 56 86, 60 76, 66 72 L 68 104 Z" fill="${c}" ${borda}/><path d="M142 104 C 144 86, 140 76, 134 72 L 132 104 Z" fill="${c}" ${borda}/>` + `<path d="M80 54 q12 -6 26 -4" stroke="${claro('#ffffff', 0)}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.35"/>`;
    case 'arrepiado':
      return `<path d="M60 88 C 54 44, 76 32, 100 36 C 124 32, 146 44, 140 88 L 132 70 L 122 76 L 114 64 L 102 74 L 90 64 L 80 76 L 70 68 Z" fill="${c}" ${borda}/>` + reflexo('M80 46 q12 -6 26 -4');
  }
}

function roupa(p: Personagem): string {
  const c = p.corRoupa;
  const borda = `stroke="${escuro(c, 0.4)}" stroke-width="1.5"`;
  const sombra = `<path d="M128 160 C 160 168 178 192 180 222 L 138 222 C 140 196 136 176 128 160 Z" fill="${escuro(c, 0.18)}" clip-path="url(#vd-corpo)"/>`;
  const corpo = `<path d="${CORPO}" fill="${c}"/>` + sombra + `<path d="${CORPO}" fill="none" ${borda}/>`;
  const decote = `<path d="M84 155 Q 100 175 116 155 Z" fill="${p.pele}" stroke="${escuro(p.pele, 0.3)}" stroke-width="1.2"/>`;
  const costura = (d: string) => `<path d="${d}" stroke="${escuro(c, 0.3)}" stroke-width="1.3" fill="none" stroke-dasharray="3 3" opacity="0.6"/>`;
  switch (p.roupa) {
    case 'camiseta':
      return corpo + decote + `<path d="M82 154 Q 100 178 118 154" stroke="${escuro(c, 0.25)}" stroke-width="3" fill="none"/>` + costura('M50 182 q4 18 2 38');
    case 'camisa':
      return (
        corpo +
        `<path d="M86 155 L 100 178 L 114 155 Z" fill="${p.pele}"/>` +
        `<path d="M84 152 L 100 176 L 90 183 L 77 161 Z" fill="${BRANCO}" stroke="${escuro(BRANCO, 0.25)}" stroke-width="1.2"/>` +
        `<path d="M116 152 L 100 176 L 110 183 L 123 161 Z" fill="${BRANCO}" stroke="${escuro(BRANCO, 0.25)}" stroke-width="1.2"/>` +
        `<path d="M100 178 L 100 220" stroke="${escuro(c, 0.3)}" stroke-width="1.4"/>` +
        `<circle cx="100" cy="194" r="2" fill="${escuro(c, 0.45)}"/><circle cx="100" cy="210" r="2" fill="${escuro(c, 0.45)}"/>`
      );
    case 'cardiga':
      return (
        corpo +
        `<path d="M86 156 L 100 220 L 114 156 Z" fill="${BRANCO}" stroke="${escuro(BRANCO, 0.25)}" stroke-width="1.2"/>` +
        decote +
        `<path d="M86 156 L 100 220 M114 156 L 100 220" stroke="${escuro(c, 0.35)}" stroke-width="2"/>` +
        `<circle cx="95" cy="196" r="2.4" fill="${claro(c, 0.5)}"/><circle cx="95" cy="210" r="2.4" fill="${claro(c, 0.5)}"/>` +
        costura('M46 186 q4 16 2 34')
      );
    case 'moletom':
      return (
        corpo +
        `<path d="M62 170 Q 100 144 138 170 Q 100 184 62 170 Z" fill="${escuro(c, 0.2)}" ${borda}/>` +
        decote +
        `<path d="M92 172 L 90 198 M108 172 L 110 198" stroke="${BRANCO}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<circle cx="90" cy="199" r="2.2" fill="${BRANCO}"/><circle cx="110" cy="199" r="2.2" fill="${BRANCO}"/>`
      );
    case 'terno':
      return (
        corpo +
        `<path d="M84 156 L 100 208 L 116 156 Z" fill="${BRANCO}"/>` +
        `<path d="M96.5 167 L 103.5 167 L 106 198 L 100 208 L 94 198 Z" fill="#e8735a" stroke="${escuro('#e8735a', 0.3)}" stroke-width="1"/>` +
        `<path d="M94 160 L 106 160 L 103.5 167 L 96.5 167 Z" fill="${escuro('#e8735a', 0.15)}"/>` +
        `<path d="M80 156 L 100 214 L 88 186 Z" fill="${escuro(c, 0.15)}" ${borda}/><path d="M120 156 L 100 214 L 112 186 Z" fill="${escuro(c, 0.3)}" ${borda}/>` +
        `<path d="M58 196 l 12 0" stroke="${claro(c, 0.3)}" stroke-width="2" stroke-linecap="round"/>`
      );
    case 'tailleur':
      return (
        corpo +
        `<path d="M84 156 L 100 202 L 116 156 Z" fill="${BRANCO}"/>` +
        decote +
        `<path d="M80 156 L 100 208 L 88 184 Z" fill="${escuro(c, 0.15)}" ${borda}/><path d="M120 156 L 100 208 L 112 184 Z" fill="${escuro(c, 0.3)}" ${borda}/>` +
        `<circle cx="100" cy="164" r="3" fill="#e8735a"/>`
      );
    case 'toga':
      return (
        corpo +
        `<path d="M64 176 Q 70 200 66 222 M80 186 Q 84 204 82 222 M136 176 Q 130 200 134 222 M120 186 Q 116 204 118 222" stroke="${claro(c, 0.18)}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
        `<path d="M84 154 L 100 180 L 116 154 L 112 151 L 100 169 L 88 151 Z" fill="${BRANCO}" stroke="${escuro(BRANCO, 0.25)}" stroke-width="1.2"/>`
      );
  }
}

/** Insígnia de quem responde: martelo (juiz) ou pasta (advogado). */
function insignia(p: Personagem): string {
  if (p.papel === 'consulente') return '';
  const icone =
    p.papel === 'juiz'
      ? `<g transform="translate(160 194) rotate(-35)"><rect x="-8" y="-5" width="16" height="7" rx="2" fill="${TRACO}"/><rect x="-1.4" y="2" width="2.8" height="11" rx="1.2" fill="${TRACO}"/></g><rect x="152" y="203" width="16" height="3" rx="1.5" fill="${TRACO}"/>`
      : `<rect x="151" y="189" width="18" height="13" rx="2.5" fill="${TRACO}"/><path d="M156 189 v-3 h8 v3" stroke="${TRACO}" stroke-width="2" fill="none"/><rect x="151" y="194" width="18" height="2" fill="${BRANCO}" opacity="0.5"/>`;
  return `<circle cx="160" cy="196" r="16" fill="${BRANCO}" stroke="${TRACO}" stroke-width="2"/>` + icone;
}

function olhos(p: Personagem, e: Expressao): string {
  const sobr = p.corCabelo === '#b8b3a9' || p.cabelo === 'calvo' ? '#6f685e' : escuro(p.corCabelo, 0.35);
  const sob = (d: string) => `<path d="${d}" stroke="${sobr}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
  const olho = (x: number, y: number, ry = 4.6) =>
    `<ellipse cx="${x}" cy="${y}" rx="3.9" ry="${ry}" fill="${TRACO}"/><circle cx="${x + 1.3}" cy="${y - 1.6}" r="1.4" fill="${BRANCO}"/>`;
  const palpebra = (x: number, y: number) => `<path d="M${x - 6} ${y - 4} q6 -4 12 0" stroke="${escuro(p.pele, 0.45)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  const cilios = p.pessoa === 'mulher' ? `<path d="M77 91 l-3 -2 M123 91 l3 -2" stroke="${TRACO}" stroke-width="1.6" stroke-linecap="round"/>` : '';
  switch (e) {
    case 'neutro':
      return sob('M73 80 q10 -5 20 -1') + sob('M107 79 q10 -4 20 1') + `<g class="vd-olhos">${olho(84, 94) + olho(116, 94)}</g>` + palpebra(84, 94) + palpebra(116, 94) + cilios;
    case 'feliz':
      return (
        sob('M73 76 q10 -7 20 -2') +
        sob('M107 74 q10 -5 20 2') +
        `<path d="M78 96 q6 -8 12 0 M110 96 q6 -8 12 0" stroke="${TRACO}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        `<path d="M77 101 q7 3 14 0 M109 101 q7 3 14 0" stroke="${escuro(p.pele, 0.3)}" stroke-width="1.2" fill="none" opacity="0.7"/>` +
        cilios
      );
    case 'duvida':
      return sob('M73 74 q10 -9 20 -3') + sob('M107 83 l20 -3') + `<g class="vd-olhos">${olho(86, 94) + olho(118, 95, 3.6)}</g>` + palpebra(86, 94) + `<path d="M112 92 l12 -1" stroke="${escuro(p.pele, 0.45)}" stroke-width="1.6" stroke-linecap="round"/>` + cilios;
    case 'medo':
      return (
        sob('M74 82 L 93 75') +
        sob('M107 75 L 126 82') +
        `<g class="vd-olhos"><ellipse cx="84" cy="95" rx="6" ry="7" fill="${BRANCO}" stroke="${TRACO}" stroke-width="1.5"/><ellipse cx="116" cy="95" rx="6" ry="7" fill="${BRANCO}" stroke="${TRACO}" stroke-width="1.5"/>` +
        `<circle cx="84" cy="96" r="3" fill="${TRACO}"/><circle cx="116" cy="96" r="3" fill="${TRACO}"/><circle cx="85" cy="94.6" r="1" fill="${BRANCO}"/><circle cx="117" cy="94.6" r="1" fill="${BRANCO}"/></g>` +
        cilios
      );
  }
}

function boca(p: Personagem, e: Expressao): string {
  switch (e) {
    case 'neutro':
      return `<path d="M91 121 q9 3 18 0" stroke="${LABIO}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M95 126 q5 2 10 0" stroke="${escuro(p.pele, 0.25)}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.6"/>`;
    case 'feliz':
      return (
        `<path d="M85 115 Q 100 136 115 115 Q 100 119 85 115 Z" fill="${BOCA}" stroke="${LABIO}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="M88.5 116.5 Q 100 120.5 111.5 116.5 L 110.5 119.5 Q 100 123 89.5 119.5 Z" fill="${BRANCO}"/>` +
        `<path d="M93 128 Q 100 124 107 128 Q 100 132 93 128 Z" fill="#c9675b"/>`
      );
    case 'duvida':
      return `<path d="M92 123 q8 -5 17 -1" stroke="${LABIO}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M110 120 q2 2 1 4" stroke="${escuro(p.pele, 0.3)}" stroke-width="1.2" fill="none" opacity="0.6"/>`;
    case 'medo':
      return `<ellipse cx="100" cy="124" rx="6.5" ry="5.5" fill="${BOCA}" stroke="${LABIO}" stroke-width="1.6"/><path d="M95 121 q5 -1.6 10 0 v1.6 q-5 -1 -10 0 Z" fill="${BRANCO}"/>`;
  }
}

function rosto(p: Personagem, e: Expressao): string {
  const sombra = escuro(p.pele, 0.2);
  let s = '';
  // Sombra do lado direito (luz vindo da esquerda) e sombra do cabelo na testa.
  s += `<path d="M118 46 C 152 62, 148 130, 102 142 C 128 124, 134 80, 118 46 Z" fill="${sombra}" opacity="0.55" clip-path="url(#vd-rosto)"/>`;
  s += `<path d="M60 88 C 76 72, 124 70, 140 88 L 140 80 C 124 66, 76 66, 60 80 Z" fill="${sombra}" opacity="0.35" clip-path="url(#vd-rosto)"/>`;
  if (p.idade === 'idoso') {
    s += `<path d="M86 66 q14 -4 28 0 M90 72 q10 -3 20 0" stroke="${escuro(p.pele, 0.3)}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.8"/>`;
    s += `<path d="M75 106 q6 3 11 0 M114 106 q6 3 11 0 M83 128 q-3 4 -1 8 M117 128 q3 4 1 8" stroke="${escuro(p.pele, 0.3)}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  }
  if (p.barba === 'barba') {
    const b = p.corCabelo;
    s += `<path fill-rule="evenodd" d="M62 102 C 64 142, 86 149, 100 149 C 114 149, 136 142, 138 102 C 130 124, 116 128, 100 128 C 84 128, 70 124, 62 102 Z" fill="${b}" stroke="${escuro(b, 0.4)}" stroke-width="1.3"/>`;
    s += `<path d="M76 130 l2 4 M88 136 l1 4 M112 136 l-1 4 M124 130 l-2 4" stroke="${claro(b, 0.35)}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
    s += `<path d="M84 116 Q 100 106 116 116 Q 100 113 84 116 Z" fill="${b}" stroke="${escuro(b, 0.4)}" stroke-width="1.1"/>`;
  } else if (p.barba === 'bigode') {
    s += `<path d="M84 117 Q 92 108 100 113 Q 108 108 116 117 Q 100 114 84 117 Z" fill="${p.corCabelo}" stroke="${escuro(p.corCabelo, 0.4)}" stroke-width="1.1"/>`;
  }
  s += `<ellipse cx="74" cy="111" rx="8" ry="5" fill="#e8735a" opacity="${e === 'feliz' ? 0.32 : 0.16}"/><ellipse cx="126" cy="111" rx="8" ry="5" fill="#e8735a" opacity="${e === 'feliz' ? 0.32 : 0.16}"/>`;
  // Nariz com volume.
  s += `<path d="M101 96 q-5 10 -2 14 q3 2 7 -0.5" stroke="${escuro(p.pele, 0.32)}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M98 99 q-1 4 -1 7" stroke="${claro(p.pele, 0.45)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.8"/>`;
  s += olhos(p, e) + boca(p, e);
  if (e === 'medo') s += `<path d="M141 68 q 6 9 0 13 q -6 -4 0 -13 Z" fill="#a9cfe0" stroke="#6f9db3" stroke-width="1"/>`;
  if (p.oculos) {
    s += `<g stroke="${TRACO}" stroke-width="2.2" fill="${BRANCO}" fill-opacity="0.16"><rect x="72" y="84" width="24" height="20" rx="7"/><rect x="104" y="84" width="24" height="20" rx="7"/></g>`;
    s += `<path d="M96 92 q4 -3 8 0 M72 92 L 61 89 M128 92 L 139 89" stroke="${TRACO}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M76 88 l5 -2 M108 88 l5 -2" stroke="${BRANCO}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>`;
  }
  return s;
}

/** O personagem em SVG (texto), com a expressão pedida, no estilo refinado. */
export function desenharRefinado(p: Personagem, e: Expressao = 'neutro', opcoes: { fundo?: boolean } = {}): string {
  const fundo = opcoes.fundo !== false ? `<circle cx="100" cy="112" r="92" fill="${mistura(p.corRoupa === '#1d211f' ? '#6f8f75' : p.corRoupa, '#eef0ea', 0.78)}"/>` : '';
  const orelha = (x: number, dx: number) =>
    `<ellipse cx="${x}" cy="98" rx="7" ry="10" fill="${p.pele}" stroke="${escuro(p.pele, 0.3)}" stroke-width="1.2"/><path d="M${x + dx} 93 q${-dx} 5 0 10" stroke="${escuro(p.pele, 0.3)}" stroke-width="1.4" fill="none"/>`;
  const brincos = p.brincos ? `<circle cx="59" cy="110" r="3.4" fill="#e8735a" stroke="${escuro('#e8735a', 0.3)}" stroke-width="1"/><circle cx="141" cy="110" r="3.4" fill="#e8735a" stroke="${escuro('#e8735a', 0.3)}" stroke-width="1"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" class="personagem refinado">` +
    DEFS +
    fundo +
    `<g class="vd-respira">` +
    cabeloAtras(p) +
    roupa(p) +
    `<path d="M88 120 L 88 152 Q 100 161 112 152 L 112 120 Z" fill="${p.pele}"/>` +
    `<path d="M88 126 Q 100 148 112 126 L 112 142 Q 100 152 88 142 Z" fill="${escuro(p.pele, 0.22)}"/>` +
    orelha(60, -2) +
    orelha(140, 2) +
    brincos +
    `<path d="${ROSTO}" fill="${p.pele}" stroke="${escuro(p.pele, 0.32)}" stroke-width="1.4"/>` +
    rosto(p, e) +
    cabeloFrente(p) +
    `</g>` +
    insignia(p) +
    `</svg>`
  );
}
