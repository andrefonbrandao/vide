// Normalização da fala transcrita: unifica as variações antes da busca.
// "Artigo 1.015 do Código de Processo Civil" -> ["§art", "1015", "do", "§dip:cpc"]
// "artigo 5º da Constituição"               -> ["§art", "5", "da", "§dip:cf"]
import { CATALOGO, normalizarApelido, type DefDiploma } from '../dados/diplomas';
import { lerNumero } from './numeros';

/** Marcador de lei que NÃO está no catálogo (para não sugerir o artigo errado). */
export const PALAVRA_OUTRO_DIPLOMA = '§outro';
/** Prefixo do marcador de lei conhecida: "§dip:cf". */
export const PREFIXO_DIPLOMA = '§dip:';

/** Siglas e palavras de leis/fontes fora do catálogo. */
const OUTROS_DIPLOMAS = new Set([
  'clt', 'cp', 'cpp', 'ctn', 'eca', 'leis', 'decreto', 'regimento', 'ricpc', 'ristf', 'ristj', 'estatuto',
  'sumula', 'tema', 'resolucao', 'emenda', 'convencao', 'codigo', 'portaria', 'provimento', 'instrucao',
]);

/**
 * Palavras-chave viram marcadores com "§" na frente, para não se confundirem
 * com palavras comuns da fala (ex.: "diz ali o artigo 70" — "ali" não é alínea).
 */
export const KW = { art: '§art', par: '§par', inc: '§inc', ali: '§ali', caput: '§caput' } as const;

const PALAVRAS_CHAVE: Record<string, string> = {
  art: KW.art, arts: KW.art, artigo: KW.art, artigos: KW.art, artigue: KW.art,
  paragrafo: KW.par, paragrafos: KW.par,
  inciso: KW.inc, incisos: KW.inc,
  alinea: KW.ali, alineas: KW.ali, letra: KW.ali,
  caput: KW.caput, capute: KW.caput, caputi: KW.caput,
};

export function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function ehDiploma(p: string | undefined): boolean {
  return !!p && p.startsWith(PREFIXO_DIPLOMA);
}

export function siglaDe(p: string): string {
  return p.slice(PREFIXO_DIPLOMA.length);
}

/** Separa o texto em palavras simples (minúsculas, sem acento, sem pontuação). */
function tokenizar(texto: string): string[] {
  let t = texto.toLowerCase();
  t = t.replace(/§§/g, ' paragrafos ').replace(/§/g, ' paragrafo ');
  t = semAcentos(t);
  t = t.replace(/\bn[º°o.]\s*(?=\d)/g, ' '); // "nº 70"
  t = t.replace(/(\d)[º°ª]/g, '$1');
  // Separador de milhar: "1.015" -> "1015"
  t = t.replace(/(\d)\.(?=\d{3}\b)/g, '$1');
  // Artigo com letra: "103-A" -> "103a"
  t = t.replace(/(\d)\s*-\s*([a-z])\b/g, '$1$2');
  t = t.replace(/[^a-z0-9]+/g, ' ');
  return t.split(' ').filter(Boolean);
}

export type Normalizador = (texto: string) => string[];

/** Cria o normalizador para um conjunto de leis (catálogo + leis cadastradas). */
export function criarNormalizador(diplomas: DefDiploma[] = CATALOGO): Normalizador {
  // Apelidos em palavras, do mais longo para o mais curto (o mais longo vence).
  const apelidos = diplomas
    .flatMap((d) => d.apelidos.map((a) => ({ sigla: d.sigla, palavras: normalizarApelido(a).split(' ') })))
    .sort((a, b) => b.palavras.length - a.palavras.length);
  const porNumero = new Map(diplomas.filter((d) => d.numeroLei).map((d) => [d.numeroLei!, d.sigla]));

  return (texto: string) => {
    const palavras = tokenizar(texto);
    const saida: string[] = [];
    for (let i = 0; i < palavras.length; i++) {
      const p = palavras[i];
      // 1) nome falado de uma lei do catálogo
      const ap = apelidos.find((a) => a.palavras.every((w, k) => palavras[i + k] === w));
      if (ap) {
        saida.push(PREFIXO_DIPLOMA + ap.sigla);
        i += ap.palavras.length - 1;
        continue;
      }
      // 2) "Lei 9.099", "lei nove mil e noventa e nove", "decreto-lei 4.657"
      if (p === 'lei' || (p === 'decreto' && palavras[i + 1] === 'lei')) {
        let j = p === 'decreto' ? i + 2 : i + 1;
        if (palavras[j] === 'numero' || palavras[j] === 'n') j++;
        const n = lerNumero(palavras, j);
        const sigla = n ? porNumero.get(String(n.valor)) : undefined;
        if (n && sigla) {
          saida.push(PREFIXO_DIPLOMA + sigla);
          i = j + n.tamanho - 1;
          // "/95", "de 1995": o ano faz parte do nome da lei
          if (/^\d{2,4}$/.test(palavras[i + 1] ?? '') && palavras[i + 1].length !== 3) i++;
          else if (palavras[i + 1] === 'de' && /^\d{4}$/.test(palavras[i + 2] ?? '')) i += 2;
          continue;
        }
        if (n) {
          // Lei com número fora do catálogo: outra lei (o número é consumido junto).
          saida.push(PALAVRA_OUTRO_DIPLOMA, 'lei');
          i = j + n.tamanho - 1;
          continue;
        }
        // "da lei de improbidade", "da lei": lei não identificada — trata como outra lei.
        saida.push(PALAVRA_OUTRO_DIPLOMA, 'lei');
        continue;
      }
      if (/^paragrafo$/.test(p) && palavras[i + 1] === 'unico') {
        saida.push(KW.par, 'unico');
        i++;
        continue;
      }
      if (OUTROS_DIPLOMAS.has(p)) {
        saida.push(PALAVRA_OUTRO_DIPLOMA, p);
        continue;
      }
      saida.push(PALAVRAS_CHAVE[p] ?? p);
    }
    return saida;
  };
}

/** Normalizador com o catálogo padrão (usado em testes e na tela de teste). */
export const normalizarFala: Normalizador = criarNormalizador();
