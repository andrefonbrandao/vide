// Mensagens do jogo de perguntas (celular do aluno <-> serviço <-> computador do professor).
import type { VisaoAlunoComum, VisaoPessoal } from './motor';

/** Aluno -> professor. */
export type DoAluno =
  | { t: 'entrar'; apelido: string }
  | { t: 'ola' }
  | { t: 'responder'; indice: number; alt: number }
  /** Adivinhe o conceito: a resposta digitada. */
  | { t: 'responder-texto'; indice: number; texto: string };

/** O que chega ao professor (o serviço acrescenta quem enviou). */
export type ParaAnfitriao =
  | { t: 'conectados'; tokens: string[] }
  | { t: 'conexao'; token: string; on: boolean }
  | { t: 'do-aluno'; de: string; msg: unknown };

/** O que chega ao aluno. */
export type ParaAluno =
  | ({ t: 'jogo'; voce: VisaoPessoal | null } & VisaoAlunoComum)
  | { t: 'anfitriao'; on: boolean }
  | { t: 'recusado'; motivo: string }
  /** Resultado da tentativa no "Adivinhe o conceito" (vem junto com o retrato atualizado). */
  | { t: 'tentativa'; resultado: 'certo' | 'errado' | 'aguarde' | 'invalido' }
  | { t: 'encerrado' };

/** Código de 6 algarismos (fácil de digitar no celular). */
export function gerarCodigoJogo(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(100000 + (n[0] % 900000));
}

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function gerarToken(): string {
  const n = new Uint32Array(20);
  crypto.getRandomValues(n);
  return Array.from(n, (x) => LETRAS[x % LETRAS.length]).join('');
}

export function urlDoJogo(codigo: string): string {
  return `${location.origin}/j/${codigo}`;
}
