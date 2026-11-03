// Sincronização do acervo com a pasta remota (Google Drive).
//
// Na pasta ficam:
//   - "Vide - dados.json": questões, questionários, resultados dos jogos, e os
//     dados (sem o arquivo) dos materiais, das leis e das aulas registradas;
//   - um arquivo por lei importada, um por material (o PDF/imagem) e um por aula.
// Regra: para cada item, vale a versão alterada por último (atualizado_em).
// Exclusões são marcas (excluido_em), para chegarem aos outros computadores.
import type { BancoVide } from '../dados/db';
import type { Diploma, EventoRegistro, Item, Material } from '../dados/modelo';
import type { Questao, Questionario, ResultadoJogo } from '../jogo/tipos';
import type { LinkTreino } from '../treino/tipos';
import type { ArmazemRemoto, ArquivoRemoto } from './remoto';

export type MaterialMeta = Omit<Material, 'arquivo'>;

export interface SessaoMeta {
  id: string;
  inicio: string;
  /** Horário do último evento. */
  ultimo: string;
  total: number;
  excluido_em: string | null;
}

export interface DadosRemotos {
  formato: 'vide-dados@1';
  questoes: Questao[];
  questionarios: Questionario[];
  jogos: ResultadoJogo[];
  /** Links de treino em casa (com a chave para poder desativá-los de outro computador). */
  treinos?: LinkTreino[];
  materiais: MaterialMeta[];
  diplomas: Diploma[];
  sessoes: SessaoMeta[];
}

export interface ResumoSincronia {
  baixados: string[];
  enviados: string[];
  /** Coleções que mudaram neste computador (para atualizar as telas). */
  mudou: Set<'acervo' | 'materiais' | 'questoes' | 'registro'>;
}

const VAZIO: DadosRemotos = { formato: 'vide-dados@1', questoes: [], questionarios: [], jogos: [], treinos: [], materiais: [], diplomas: [], sessoes: [] };

interface ComData {
  id: string;
  atualizado_em: string;
}

/** Junta duas listas pelo id; fica a versão alterada por último (empate: a local). */
export function mesclar<T extends ComData>(local: T[], remoto: T[]): { resultado: T[]; paraLocal: T[]; remotoDesatualizado: boolean } {
  const mapa = new Map<string, T>(local.map((x) => [x.id, x]));
  const paraLocal: T[] = [];
  const remotos = new Map(remoto.map((x) => [x.id, x]));
  for (const r of remoto) {
    const l = mapa.get(r.id);
    if (!l || r.atualizado_em > l.atualizado_em) {
      mapa.set(r.id, r);
      paraLocal.push(r);
    }
  }
  let remotoDesatualizado = false;
  for (const l of local) {
    const r = remotos.get(l.id);
    if (!r || l.atualizado_em > r.atualizado_em) remotoDesatualizado = true;
  }
  return { resultado: [...mapa.values()], paraLocal, remotoDesatualizado };
}

function json(x: unknown): Blob {
  return new Blob([JSON.stringify(x)], { type: 'application/json' });
}

async function lerJson<T>(b: Blob): Promise<T> {
  return JSON.parse(await b.text()) as T;
}

function semArquivo(m: Material): MaterialMeta {
  const { arquivo: _arquivo, ...meta } = m;
  return meta;
}

function nomeSeguro(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
}

function extensao(m: MaterialMeta): string {
  if (m.tipo === 'pdf') return '.pdf';
  const e = m.mime.split('/')[1];
  return e ? `.${e === 'jpeg' ? 'jpg' : e}` : '';
}

/** Retrato das aulas registradas neste computador. */
async function sessoesLocais(banco: BancoVide): Promise<Map<string, SessaoMeta>> {
  const mapa = new Map<string, SessaoMeta>();
  await banco.registro.orderBy('seq').each((e) => {
    const s = mapa.get(e.sessao_id);
    if (!s) mapa.set(e.sessao_id, { id: e.sessao_id, inicio: e.em, ultimo: e.em, total: 1, excluido_em: null });
    else {
      s.total++;
      if (e.em > s.ultimo) s.ultimo = e.em;
    }
  });
  for (const a of await banco.apagados.toArray()) {
    if (!a.chave.startsWith('sessao:')) continue;
    const id = a.chave.slice(7);
    const s = mapa.get(id);
    mapa.set(id, { id, inicio: s?.inicio ?? a.em, ultimo: s?.ultimo ?? a.em, total: 0, excluido_em: a.em });
  }
  return mapa;
}

export async function sincronizar(banco: BancoVide, remoto: ArmazemRemoto, aviso: (t: string) => void = () => {}): Promise<ResumoSincronia> {
  const resumo: ResumoSincronia = { baixados: [], enviados: [], mudou: new Set() };
  aviso('lendo o Drive…');
  const arquivos = await remoto.listar();
  const achar = (tipo: string, id?: string): ArquivoRemoto | undefined =>
    arquivos.find((a) => a.props.vide === tipo && (id === undefined || a.props.id === id));
  const arqDados = achar('dados');
  const rem: DadosRemotos = arqDados ? { ...VAZIO, ...(await lerJson<DadosRemotos>(await remoto.baixar(arqDados.id))) } : VAZIO;

  // ---------- questões, questionários, resultados ----------
  const q = mesclar(await banco.questoes.toArray(), rem.questoes);
  const qz = mesclar(await banco.questionarios.toArray(), rem.questionarios);
  const jg = mesclar(await banco.jogos.toArray(), rem.jogos);
  const tr = mesclar(await banco.treinos.toArray(), rem.treinos ?? []);
  if (tr.paraLocal.length) {
    await banco.treinos.bulkPut(tr.paraLocal);
    resumo.mudou.add('questoes');
  }
  if (q.paraLocal.length) await banco.questoes.bulkPut(q.paraLocal);
  if (qz.paraLocal.length) await banco.questionarios.bulkPut(qz.paraLocal);
  if (jg.paraLocal.length) await banco.jogos.bulkPut(jg.paraLocal);
  if (q.paraLocal.length + qz.paraLocal.length + jg.paraLocal.length) {
    resumo.mudou.add('questoes');
    resumo.baixados.push(`${q.paraLocal.length + qz.paraLocal.length + jg.paraLocal.length} questões/questionários/resultados`);
  }

  // ---------- materiais ----------
  const locaisMat = await banco.materiais.toArray();
  const blobLocal = new Map(locaisMat.map((m) => [m.id, m.arquivo]));
  const mat = mesclar(locaisMat.map(semArquivo), rem.materiais);
  const materiaisFinal = new Map(mat.resultado.map((m) => [m.id, m]));
  for (const r of mat.paraLocal) {
    const blob = blobLocal.get(r.id);
    if (r.excluido_em) {
      await banco.materiais.put({ ...r, arquivo: new Blob([]) });
    } else if (blob && blob.size > 0) {
      // O arquivo de um material não muda; só os dados (pasta, etiquetas…).
      await banco.materiais.put({ ...r, arquivo: blob });
    } else {
      const arq = achar('material', r.id);
      if (!arq) {
        // O outro computador ainda não terminou de enviar o arquivo: tenta na próxima vez.
        materiaisFinal.delete(r.id);
        const antigo = rem.materiais.find((x) => x.id === r.id);
        if (antigo) materiaisFinal.set(r.id, antigo);
        continue;
      }
      aviso(`baixando "${r.nome}"…`);
      const conteudo = await remoto.baixar(arq.id);
      await banco.materiais.put({ ...r, arquivo: new Blob([conteudo], { type: r.mime }) });
      resumo.baixados.push(`material "${r.nome}"`);
    }
    resumo.mudou.add('materiais');
  }
  for (const m of materiaisFinal.values()) {
    const arq = achar('material', m.id);
    const blob = blobLocal.get(m.id);
    if (!m.excluido_em && !arq && blob && blob.size > 0) {
      aviso(`enviando "${m.nome}"…`);
      await remoto.criar(`Material - ${nomeSeguro(m.nome)}${extensao(m)}`, { vide: 'material', id: m.id }, blob);
      resumo.enviados.push(`material "${m.nome}"`);
    } else if (m.excluido_em && arq) {
      await remoto.lixeira(arq.id);
    }
  }

  // ---------- leis ----------
  const locaisDip = await banco.diplomas.toArray();
  const dip = mesclar(locaisDip, rem.diplomas);
  const diplomasFinal = new Map(dip.resultado.map((d) => [d.id, d]));
  const ativoLocal = (sigla: string) => locaisDip.find((d) => d.sigla === sigla && !d.excluido_em);
  for (const r of dip.paraLocal) {
    const local = locaisDip.find((d) => d.id === r.id);
    if (r.excluido_em) {
      if (local && !local.excluido_em) {
        // Lei apagada em outro computador: apaga aqui também (itens inclusive).
        await banco.transaction('rw', banco.itens, banco.diplomas, async () => {
          const itens = await banco.itens.where('chave').startsWith(`${r.sigla}:`).toArray();
          for (const i of itens) if (!i.excluido_em) await banco.itens.put({ ...i, excluido_em: r.excluido_em, atualizado_em: r.atualizado_em });
          await banco.diplomas.put(r);
        });
        resumo.mudou.add('acervo');
      } else await banco.diplomas.put(r);
      continue;
    }
    if (local && !local.excluido_em) {
      await banco.diplomas.put(r); // só os dados mudaram
      continue;
    }
    const atual = ativoLocal(r.sigla);
    if (atual && atual.id !== r.id && atual.criado_em > r.criado_em) {
      // Aqui há uma importação mais nova da mesma lei: a remota fica como antiga.
      diplomasFinal.set(r.id, { ...r, excluido_em: atual.criado_em, atualizado_em: atual.criado_em });
      continue;
    }
    const arq = achar('lei', r.id);
    if (!arq) {
      diplomasFinal.delete(r.id);
      const antigo = rem.diplomas.find((x) => x.id === r.id);
      if (antigo) diplomasFinal.set(r.id, antigo);
      continue;
    }
    aviso(`baixando a lei ${r.abreviacao ?? r.sigla.toUpperCase()}…`);
    const itens = await lerJson<Item[]>(await remoto.baixar(arq.id));
    await banco.transaction('rw', banco.itens, banco.diplomas, async () => {
      const agora = r.criado_em;
      const antigos = await banco.itens.where('chave').startsWith(`${r.sigla}:`).toArray();
      for (const a of antigos) if (!a.excluido_em) await banco.itens.put({ ...a, excluido_em: agora, atualizado_em: agora });
      const dipAntigos = await banco.diplomas.where('sigla').equals(r.sigla).toArray();
      for (const d of dipAntigos) {
        if (d.excluido_em || d.id === r.id) continue;
        const marcado = { ...d, excluido_em: agora, atualizado_em: agora };
        await banco.diplomas.put(marcado);
        diplomasFinal.set(d.id, marcado);
      }
      await banco.diplomas.put(r);
      await banco.itens.bulkPut(itens);
    });
    resumo.baixados.push(`lei ${r.abreviacao ?? r.sigla.toUpperCase()}`);
    resumo.mudou.add('acervo');
  }
  for (const d of diplomasFinal.values()) {
    const arq = achar('lei', d.id);
    if (!d.excluido_em && !arq && locaisDip.some((x) => x.id === d.id && !x.excluido_em)) {
      aviso(`enviando a lei ${d.abreviacao ?? d.sigla.toUpperCase()}…`);
      const itens = (await banco.itens.where('chave').startsWith(`${d.sigla}:`).toArray()).filter((i) => !i.excluido_em);
      await remoto.criar(`Lei - ${nomeSeguro(d.abreviacao ?? d.sigla.toUpperCase())} (${d.id.slice(0, 8)}).json`, { vide: 'lei', id: d.id }, json(itens));
      resumo.enviados.push(`lei ${d.abreviacao ?? d.sigla.toUpperCase()}`);
    } else if (d.excluido_em && arq) {
      await remoto.lixeira(arq.id);
    }
  }

  // ---------- aulas registradas ----------
  const locaisSes = await sessoesLocais(banco);
  const sessoesFinal = new Map<string, SessaoMeta>();
  const remotas = new Map(rem.sessoes.map((s) => [s.id, s]));
  for (const id of new Set([...locaisSes.keys(), ...remotas.keys()])) {
    const l = locaisSes.get(id);
    const r = remotas.get(id);
    if (l?.excluido_em || r?.excluido_em) {
      const em = l?.excluido_em ?? r!.excluido_em!;
      sessoesFinal.set(id, { ...(l ?? r)!, total: 0, excluido_em: em });
      if (r?.excluido_em && !l?.excluido_em && l) {
        await banco.transaction('rw', banco.registro, banco.apagados, async () => {
          await banco.registro.where('sessao_id').equals(id).delete();
          await banco.apagados.put({ chave: `sessao:${id}`, em });
        });
        resumo.mudou.add('registro');
      } else if (r?.excluido_em && !l) {
        await banco.apagados.put({ chave: `sessao:${id}`, em });
      }
      const arq = achar('aula', id);
      if (arq) await remoto.lixeira(arq.id);
      continue;
    }
    const remotaMaior = r && (!l || r.total > l.total);
    if (remotaMaior) {
      const arq = achar('aula', id);
      if (!arq) {
        if (l) sessoesFinal.set(id, l);
        else sessoesFinal.set(id, r);
        continue;
      }
      aviso('baixando o registro de uma aula…');
      const eventos = await lerJson<EventoRegistro[]>(await remoto.baixar(arq.id));
      await banco.transaction('rw', banco.registro, async () => {
        await banco.registro.where('sessao_id').equals(id).delete();
        await banco.registro.bulkAdd(eventos.map(({ seq: _seq, ...e }) => e));
      });
      sessoesFinal.set(id, r);
      resumo.baixados.push('registro de aula');
      resumo.mudou.add('registro');
      continue;
    }
    sessoesFinal.set(id, l!);
    const versao = `${l!.total}:${l!.ultimo}`;
    const arq = achar('aula', id);
    if (!arq || arq.props.versao !== versao) {
      const eventos = await banco.registro.where('sessao_id').equals(id).sortBy('seq');
      const corpo = json(eventos.map(({ seq: _seq, ...e }) => e));
      const d = new Date(l!.inicio);
      const p = (n: number) => String(n).padStart(2, '0');
      const nome = `Aula - ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}h${p(d.getMinutes())} (${id.slice(0, 8)}).json`;
      if (arq) await remoto.atualizar(arq.id, corpo, { versao });
      else await remoto.criar(nome, { vide: 'aula', id, versao }, corpo);
      resumo.enviados.push('registro de aula');
    }
  }

  // ---------- arquivo de dados ----------
  const novo: DadosRemotos = {
    formato: 'vide-dados@1',
    questoes: q.resultado,
    questionarios: qz.resultado,
    jogos: jg.resultado,
    treinos: tr.resultado,
    materiais: [...materiaisFinal.values()],
    diplomas: [...diplomasFinal.values()],
    sessoes: [...sessoesFinal.values()],
  };
  const ordenar = (d: DadosRemotos) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(d)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort((a, b) => String(a.id).localeCompare(String(b.id))) : v]),
      ),
    );
  if (!arqDados || ordenar(novo) !== ordenar(rem)) {
    if (arqDados) await remoto.atualizar(arqDados.id, json(novo));
    else await remoto.criar('Vide - dados.json', { vide: 'dados' }, json(novo));
    if (q.remotoDesatualizado || qz.remotoDesatualizado || jg.remotoDesatualizado || tr.remotoDesatualizado || mat.remotoDesatualizado || dip.remotoDesatualizado) {
      resumo.enviados.push('dados');
    }
  }
  aviso('');
  return resumo;
}
