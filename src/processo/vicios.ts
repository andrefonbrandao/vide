// Caça aos vícios: defeitos plantados nas peças escritas para a turma encontrar.
// O aluno toca nos parágrafos (ou itens de lista) suspeitos; acerta se o trecho do vício está ali.
// Sem dependências do navegador.
import { lerTexto } from './texto';

export interface Vicio {
  id: string;
  /** O trecho exato da peça (como o professor selecionou). */
  trecho: string;
  /** O que está errado, com o artigo: "falta o valor da causa (art. 319, V)". */
  explicacao: string;
}

/** Uma parte que o aluno pode tocar: um parágrafo, título, citação ou item de lista. */
export interface Unidade {
  chave: string;
  plano: string;
}

/** Sem marcações, acentos, maiúsculas e espaços repetidos. */
export function normalizar(s: string): string {
  return s
    .replace(/^\s*(#{1,2}|>|[-•])\s+/gm, '')
    .replace(/[*_]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** As partes da peça, na mesma ordem em que aparecem (chave "3" ou "3.1" para o item 1 da lista 3). */
export function unidades(texto: string): Unidade[] {
  const saida: Unidade[] = [];
  lerTexto(texto).forEach((b, i) => {
    if (b.tipo === 'lista') b.itens.forEach((it, k) => saida.push({ chave: `${i}.${k}`, plano: normalizar(it.map((t) => t.t).join('')) }));
    else saida.push({ chave: `${i}`, plano: normalizar(b.trechos.map((t) => t.t).join('')) });
  });
  return saida;
}

/** Onde está o vício: a parte que contém o trecho (ou as partes que ele atravessa). */
export function chavesDoVicio(us: Unidade[], v: Vicio): string[] {
  const t = normalizar(v.trecho);
  if (!t) return [];
  const dentro = us.filter((u) => u.plano.includes(t)).map((u) => u.chave);
  if (dentro.length) return dentro.slice(0, 1);
  return us.filter((u) => u.plano.length >= 8 && t.includes(u.plano)).map((u) => u.chave);
}

/** Chave da parte -> os vícios que estão nela. */
export function mapaVicios(texto: string, vicios: Vicio[]): Map<string, Vicio[]> {
  const us = unidades(texto);
  const mapa = new Map<string, Vicio[]>();
  for (const v of vicios) for (const k of chavesDoVicio(us, v)) mapa.set(k, [...(mapa.get(k) ?? []), v]);
  return mapa;
}

/** Vícios cujo trecho não está mais no texto (o professor mudou a peça depois de marcar). */
export function viciosPerdidos(texto: string, vicios: Vicio[]): Vicio[] {
  const us = unidades(texto);
  return vicios.filter((v) => !chavesDoVicio(us, v).length);
}

/** Quantos vícios o aluno achou com as partes que marcou. */
export function achados(texto: string, vicios: Vicio[], marcadas: string[]): Set<string> {
  const mapa = mapaVicios(texto, vicios);
  const ids = new Set<string>();
  for (const k of marcadas) for (const v of mapa.get(k) ?? []) ids.add(v.id);
  return ids;
}
