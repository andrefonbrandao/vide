// Número do processo no formato do CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO), com dígito verificador
// correto, mas no "tribunal 99", que não existe: nunca coincide com um processo real.

const J = '8';
const TR = '99';

/** Dígito verificador (módulo 97, como na Resolução 65/2008 do CNJ). */
export function digitoVerificador(sequencial: string, ano: string, origem: string): string {
  const base = BigInt(`${sequencial}${ano}${J}${TR}${origem}00`);
  return String(98n - (base % 97n)).padStart(2, '0');
}

export function gerarNumero(ano = new Date().getFullYear(), aleatorio = Math.random): string {
  const seq = String(Math.floor(aleatorio() * 9_000_000) + 1_000_000);
  const a = String(ano).padStart(4, '0');
  const origem = '0001';
  return `${seq}-${digitoVerificador(seq, a, origem)}.${a}.${J}.${TR}.${origem}`;
}

/** Confere o dígito verificador de um número no formato do CNJ. */
export function numeroValido(n: string): boolean {
  const m = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/.exec(n.trim());
  if (!m) return false;
  const base = BigInt(`${m[1]}${m[3]}${m[4]}${m[5]}${m[6]}${m[2]}`);
  return base % 97n === 1n;
}
