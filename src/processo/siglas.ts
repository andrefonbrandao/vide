// Siglas dos documentos, como no eproc (INIC1, CONT1…), pela descrição do evento.

/** Sigla do documento, como no eproc (INIC1, CONT1…), pela descrição do evento. */
export function prefixoSigla(descricao: string): string {
  const d = descricao.toUpperCase();
  const tabela: [RegExp, string][] = [
    [/INICIAL/, 'INIC'],
    [/CONTESTA/, 'CONT'],
    [/R[ÉE]PLICA/, 'REPLICA'],
    [/SENTEN/, 'SENT'],
    [/DESPACHO|DECIS/, 'DESPADEC'],
    [/MANDADO/, 'MAND'],
    [/CERTID|CITA/, 'CERT'],
    [/AUDI[ÊE]NCIA/, 'TERMOAUD'],
    [/APELA/, 'APELACAO'],
    [/CONTRARRAZ/, 'CONTRAZ'],
    [/PROCURA/, 'PROC'],
  ];
  return tabela.find(([re]) => re.test(d))?.[1] ?? 'OUT';
}


/** Renumera as siglas repetidas dos documentos novos (INIC1 já existe -> INIC2). */
export function semSiglasRepetidas<T extends { documentos: { sigla: string }[] }>(existentes: string[], novos: T[]): T[] {
  const usadas = new Set(existentes);
  const maior = new Map<string, number>();
  for (const s of existentes) {
    const pre = s.replace(/\d+$/, '');
    maior.set(pre, Math.max(maior.get(pre) ?? 0, Number(/\d+$/.exec(s)?.[0] ?? 0)));
  }
  return novos.map((e) => ({
    ...e,
    documentos: e.documentos.map((d) => {
      if (!usadas.has(d.sigla)) {
        usadas.add(d.sigla);
        const pre = d.sigla.replace(/\d+$/, '');
        maior.set(pre, Math.max(maior.get(pre) ?? 0, Number(/\d+$/.exec(d.sigla)?.[0] ?? 0)));
        return d;
      }
      const pre = d.sigla.replace(/\d+$/, '');
      const n = (maior.get(pre) ?? 0) + 1;
      maior.set(pre, n);
      usadas.add(`${pre}${n}`);
      return { ...d, sigla: `${pre}${n}` };
    }),
  }));
}
