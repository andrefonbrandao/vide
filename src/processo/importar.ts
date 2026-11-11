// Processo em texto: colar para criar (ou para acrescentar eventos) e copiar como texto.
// É o formato que a IA generativa produz a partir do pedido pronto.
import { novoId } from '../dados/modelo';
import { gerarNumero, numeroValido } from './numero';
import { prefixoSigla } from './siglas';
import { FASES, type FaseId } from './fases';
import { lerPrazo, prazoParaTexto } from './prazos';
import type { Advogado, Capa, Documento, Evento, Liberacao, Parte, Polo, Processo } from './tipos';

export interface ProcessoLido {
  titulo: string;
  capa: Partial<Capa>;
  partes: Parte[];
  eventos: Evento[];
  avisos: string[];
  /** Documentos marcados "(PDF)", que precisam do arquivo anexado depois. */
  pdfsPendentes: number;
}

export const MODELO_PROCESSO = `Processo: Turma 2027/1 — ação de cobrança
Classe: Procedimento Comum Cível
Assunto: Cobrança
Valor da causa: R$ 3.500,00
Juízo: 1ª Vara Cível da Comarca de Vide
Juiz: Dra. Helena Prado
Autuação: 02/03/2027

Autor: Rogéria Silva (pessoa física)
Advogado do autor: Carlos Mendes, OAB/VD 12.345
Réu: Loja Boa Compra Ltda. (pessoa jurídica)
Advogado do réu: Ana Duarte, OAB/VD 23.456

Evento: 02/03/2027 10:00 | PETIÇÃO INICIAL | ADVOGADO DO AUTOR | liberado
Documento: INIC1 | Petição inicial
# PETIÇÃO INICIAL
EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 1ª VARA CÍVEL DA COMARCA DE VIDE

**ROGÉRIA SILVA**, brasileira, aposentada, vem propor a presente _ação de cobrança_ em face de **LOJA BOA COMPRA LTDA.**

## DOS FATOS
A autora pagou por uma geladeira que nunca foi entregue.

## DOS PEDIDOS
- a citação da ré (art. 238 do CPC);
- a condenação da ré a devolver R$ 3.500,00.

Evento: 05/03/2027 14:00 | DESPACHO | JUIZ | aparece em 09/03/2027 08:00
Fase: citação
Prazo: 15 dias úteis para o réu contestar
Documento: DESPADEC1 | Despacho
Cite-se a ré para contestar no prazo legal (art. 335 do CPC).

Evento: 20/03/2027 09:00 | CONTESTAÇÃO | ADVOGADO DO RÉU | segurado
Documento: CONT1 | Contestação
# CONTESTAÇÃO
…
Documento: PROC2 | Procuração (PDF)`;

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** "02/03/2027 10:00", "02/03/2027", "2027-03-02T10:00" -> "2027-03-02T10:00" (hora padrão 09:00). */
export function lerDataHora(s: string, horaPadrao = '09:00'): string | null {
  const t = s.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s*(?:às|as|,)?\s*(\d{1,2})[:h](\d{2})?)?$/i.exec(t);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const hora = m[4] ? `${p2(Number(m[4]))}:${m[5] ?? '00'}` : horaPadrao;
    return `${ano}-${p2(Number(m[2]))}-${p2(Number(m[1]))}T${hora}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] ? `${m[4]}:${m[5]}` : horaPadrao}`;
  return null;
}

function lerLiberacao(s: string, dataEvento: string): Liberacao | null {
  const t = semAcento(s.trim());
  if (!t || /^(segurad|ocult|escondid|rascunho)/.test(t)) return { modo: 'segurar' };
  if (/^(liberad|agora|publicad|visivel)/.test(t)) return { modo: 'agora' };
  if (/data do evento/.test(t)) return { modo: 'data', em: dataEvento };
  const m = /(?:aparece|libera\w*|mostra\w*)?\s*(?:em|no dia|a partir de)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*(?:as|,)?\s*\d{1,2}[:h]\d{0,2})?)/.exec(t);
  if (m) {
    const em = lerDataHora(m[1], '08:00');
    if (em) return { modo: 'data', em };
  }
  return null;
}

/** "Carlos Mendes, OAB/VD 12.345" -> advogado. */
function lerAdvogado(s: string): Advogado {
  const m = /^(.*?)[,;–-]\s*(OAB.*)$/i.exec(s.trim());
  return m ? { nome: m[1].trim(), oab: m[2].trim() } : { nome: s.trim(), oab: '' };
}

/** "Rogéria Silva (pessoa física)" -> nome e qualificação. */
function lerParte(polo: Polo, s: string): Parte {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(s.trim());
  const qual = m ? m[2].trim() : '';
  return {
    id: novoId(),
    polo,
    nome: (m ? m[1] : s).trim(),
    qualificacao: qual ? qual.charAt(0).toUpperCase() + qual.slice(1) : 'Pessoa física',
    advogados: [],
  };
}

const CAMPOS_CAPA: [RegExp, keyof Capa | 'titulo'][] = [
  [/^(processo|nome|titulo)$/, 'titulo'],
  [/^(numero|n[o.]?|numero do processo)$/, 'numero'],
  [/^classe( da acao)?$/, 'classe'],
  [/^assuntos?$/, 'assuntos'],
  [/^valor( da causa)?$/, 'valorCausa'],
  [/^(juizo|orgao julgador|vara)$/, 'juizo'],
  [/^(juiz|juiza|juiz\(a\)|magistrad[oa])$/, 'juiz'],
  [/^(autuacao|data de autuacao|autuado em)$/, 'autuadoEm'],
  [/^situacao$/, 'situacao'],
];

const RE_CHAVE = /^\s*([A-Za-zÀ-ÿ() .º]+?)\s*:\s*(.*)$/;
const RE_EVENTO = /^\s*evento\s*\d*\s*:\s*(.*)$/i;
const RE_DOCUMENTO = /^\s*documento\s*:\s*(.*)$/i;

/** "citação", "Contestação e réplica", "saneamento" -> a fase do mapa. */
function lerFase(s: string): FaseId | null {
  const t = semAcento(s.trim());
  if (!t) return null;
  return FASES.find((f) => f.id === t || semAcento(f.nome) === t || semAcento(f.nome).startsWith(t) || t.startsWith(f.id))?.id ?? null;
}

/** Lê o processo (ou só eventos) em texto. Nada é guardado aqui: só a leitura. */
export function lerProcessoTexto(texto: string): ProcessoLido {
  const lido: ProcessoLido = { titulo: '', capa: {}, partes: [], eventos: [], avisos: [], pdfsPendentes: 0 };
  let evento: Evento | null = null;
  let doc: Documento | null = null;
  let linhasDoc: string[] = [];
  const siglasUsadas = new Map<string, number>();
  const fecharDoc = () => {
    if (doc && evento) {
      if (doc.tipo === 'texto') doc.texto = linhasDoc.join('\n').replace(/^\s*\n+|\n+\s*$/g, '');
      evento.documentos.push(doc);
    }
    doc = null;
    linhasDoc = [];
  };
  const fecharEvento = () => {
    fecharDoc();
    if (evento) lido.eventos.push(evento);
    evento = null;
  };
  const siglaPara = (descricao: string) => {
    const pre = prefixoSigla(descricao);
    const n = (siglasUsadas.get(pre) ?? 0) + 1;
    siglasUsadas.set(pre, n);
    return `${pre}${n}`;
  };

  texto.replace(/\r\n?/g, '\n').split('\n').forEach((linha, k) => {
    const nl = k + 1;
    const ev = RE_EVENTO.exec(linha);
    if (ev) {
      fecharEvento();
      const [dataTxt = '', descricao = '', usuario = '', lib = ''] = ev[1].split('|').map((x) => x.trim());
      const data = lerDataHora(dataTxt);
      if (!data) lido.avisos.push(`Linha ${nl}: data do evento não entendida ("${dataTxt}"). Use DD/MM/AAAA HH:MM.`);
      const dataOk = data ?? '';
      const liberacao = lerLiberacao(lib, dataOk);
      if (!liberacao) lido.avisos.push(`Linha ${nl}: liberação não entendida ("${lib}"). O evento ficou segurado.`);
      evento = { id: novoId(), data: dataOk, descricao: descricao.toUpperCase(), usuario: usuario.toUpperCase(), documentos: [], liberacao: liberacao ?? { modo: 'segurar' } };
      return;
    }
    const dc = RE_DOCUMENTO.exec(linha);
    if (dc) {
      if (!evento) {
        lido.avisos.push(`Linha ${nl}: "Documento" antes de qualquer "Evento" foi ignorado.`);
        return;
      }
      fecharDoc();
      const partes = dc[1].split('|').map((x) => x.trim());
      let [sigla, titulo] = partes.length > 1 ? partes : ['', partes[0] ?? ''];
      const pdf = /\(\s*pdf\s*\)/i.test(titulo) || /\(\s*pdf\s*\)/i.test(sigla);
      titulo = titulo.replace(/\(\s*pdf\s*\)/i, '').trim();
      sigla = sigla.replace(/\(\s*pdf\s*\)/i, '').toUpperCase().replace(/\s+/g, '');
      const ev2 = evento as Evento;
      if (!sigla) sigla = siglaPara(titulo || ev2.descricao);
      else siglasUsadas.set(sigla.replace(/\d+$/, ''), Math.max(siglasUsadas.get(sigla.replace(/\d+$/, '')) ?? 0, Number(/\d+$/.exec(sigla)?.[0] ?? 0)));
      doc = { id: novoId(), sigla, titulo, tipo: pdf ? 'pdf' : 'texto', texto: '' };
      if (pdf) lido.pdfsPendentes++;
      return;
    }
    if (doc) {
      if (/^\s*fim do documento\s*$/i.test(linha)) return fecharDoc();
      const vc = /^\s*v[ií]cio\s*:\s*(.*)$/i.exec(linha);
      if (vc && (doc as Documento).tipo === 'texto') {
        const [trecho = '', explicacao = ''] = vc[1].split('|').map((x) => x.trim());
        const d = doc as Documento;
        if (trecho) d.vicios = [...(d.vicios ?? []), { id: novoId(), trecho, explicacao }];
        else lido.avisos.push(`Linha ${nl}: "Vício:" sem o trecho foi ignorado.`);
        return;
      }
      linhasDoc.push(linha);
      return;
    }
    if (!linha.trim()) return;
    if (evento) {
      const pz = /^\s*prazo\s*:\s*(.*)$/i.exec(linha);
      if (pz) {
        const prazo = lerPrazo(pz[1]);
        if (prazo) (evento as Evento).prazo = prazo;
        else lido.avisos.push(`Linha ${nl}: prazo não entendido ("${pz[1].trim()}"). Use, por exemplo, "15 dias úteis para o réu contestar".`);
        return;
      }
      const fs = /^\s*fase\s*:\s*(.*)$/i.exec(linha);
      if (fs) {
        const f = lerFase(fs[1]);
        if (f) (evento as Evento).fase = f;
        else lido.avisos.push(`Linha ${nl}: fase não entendida ("${fs[1].trim()}").`);
        return;
      }
      lido.avisos.push(`Linha ${nl}: texto fora de um "Documento" foi ignorado ("${linha.trim().slice(0, 50)}").`);
      return;
    }
    // Capa e partes (só antes do primeiro evento).
    const m = RE_CHAVE.exec(linha);
    if (!m) {
      lido.avisos.push(`Linha ${nl} não reconhecida: "${linha.trim().slice(0, 60)}".`);
      return;
    }
    const chave = semAcento(m[1]).replace(/\s+/g, ' ').trim();
    const valor = m[2].trim();
    const campo = CAMPOS_CAPA.find(([re]) => re.test(chave))?.[1];
    if (campo === 'titulo') lido.titulo = valor;
    else if (campo === 'autuadoEm') {
      const d = lerDataHora(valor);
      if (d) lido.capa.autuadoEm = d.slice(0, 10);
      else lido.avisos.push(`Linha ${nl}: data de autuação não entendida ("${valor}").`);
    } else if (campo === 'numero') {
      if (numeroValido(valor)) lido.capa.numero = valor;
      else if (valor) lido.avisos.push(`Linha ${nl}: número fora do formato do CNJ; o Vide gera um número fictício.`);
    } else if (campo) lido.capa[campo] = valor;
    else if (/^(autora?|requerente|exequente|impetrante)s?$/.test(chave)) lido.partes.push(lerParte('ativo', valor));
    else if (/^(reu|re|requerid[oa]|executad[oa]|impetrad[oa])s?$/.test(chave)) lido.partes.push(lerParte('passivo', valor));
    else if (/^(terceir[oa]|outr[oa]|interessad[oa]|ministerio publico|assistente)s?$/.test(chave)) lido.partes.push(lerParte('outro', valor));
    else if (/^advogad[oa]s?\b/.test(chave)) {
      const polo: Polo | null = /\b(autor|autora|requerente)\b/.test(chave) ? 'ativo' : /\b(reu|re|requerid)/.test(chave) ? 'passivo' : null;
      const alvo = [...lido.partes].reverse().find((x) => !polo || x.polo === polo);
      if (alvo) alvo.advogados.push(lerAdvogado(valor));
      else lido.avisos.push(`Linha ${nl}: advogado sem parte antes dele foi ignorado.`);
    } else lido.avisos.push(`Linha ${nl}: "${m[1].trim()}" não é um campo conhecido.`);
  });
  fecharEvento();
  return lido;
}

/** Monta um processo novo a partir do texto lido (o que faltar fica com o padrão). */
export function processoDoTexto(lido: ProcessoLido, base: Processo): Processo {
  return {
    ...base,
    titulo: lido.titulo || base.titulo,
    capa: {
      ...base.capa,
      ...lido.capa,
      // Sem número no texto: gera um fictício com o ano da autuação.
      numero: lido.capa.numero ?? (lido.capa.autuadoEm ? gerarNumero(Number(lido.capa.autuadoEm.slice(0, 4))) : base.capa.numero),
    },
    partes: lido.partes.length ? lido.partes : base.partes,
    eventos: lido.eventos,
  };
}

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}` : ''}` : iso;
}

/** O processo de volta em texto, no mesmo formato (para revisar, guardar ou pedir à IA que continue). */
export function processoParaTexto(p: Processo, opcoes: { soEventos?: boolean } = {}): string {
  const l: string[] = [];
  if (!opcoes.soEventos) {
    const c = p.capa;
    l.push(`Processo: ${p.titulo}`, `Número: ${c.numero}`, `Classe: ${c.classe}`);
    if (c.assuntos) l.push(`Assunto: ${c.assuntos}`);
    if (c.valorCausa) l.push(`Valor da causa: ${c.valorCausa}`);
    l.push(`Juízo: ${c.juizo}`);
    if (c.juiz) l.push(`Juiz: ${c.juiz}`);
    l.push(`Autuação: ${dataBR(c.autuadoEm)}`, `Situação: ${c.situacao}`, '');
    const rotulo: Record<Polo, [string, string]> = { ativo: ['Autor', 'Advogado do autor'], passivo: ['Réu', 'Advogado do réu'], outro: ['Terceiro', 'Advogado'] };
    for (const x of p.partes.filter((y) => y.nome.trim())) {
      l.push(`${rotulo[x.polo][0]}: ${x.nome}${x.qualificacao ? ` (${x.qualificacao.toLowerCase()})` : ''}`);
      for (const a of x.advogados.filter((y) => y.nome.trim() || y.oab.trim())) l.push(`${rotulo[x.polo][1]}: ${a.nome}${a.oab ? `, ${a.oab}` : ''}`);
    }
    l.push('');
  }
  for (const e of p.eventos) {
    const lib = e.liberacao.modo === 'agora' ? 'liberado' : e.liberacao.modo === 'segurar' ? 'segurado' : `aparece em ${dataBR(e.liberacao.em)}`;
    l.push(`Evento: ${dataBR(e.data)} | ${e.descricao} | ${e.usuario} | ${lib}`);
    if (e.fase) l.push(`Fase: ${FASES.find((f) => f.id === e.fase)?.nome ?? e.fase}`);
    if (e.prazo) l.push(`Prazo: ${prazoParaTexto(e.prazo)}`);
    for (const d of e.documentos) {
      l.push(`Documento: ${d.sigla} | ${d.titulo}${d.tipo === 'pdf' ? ' (PDF)' : ''}`);
      if (d.tipo === 'texto' && d.texto.trim()) l.push(d.texto.trim());
      for (const v of d.vicios ?? []) l.push(`Vício: ${v.trecho.replace(/\n+/g, ' ')} | ${v.explicacao}`);
    }
    l.push('');
  }
  return l.join('\n').trim() + '\n';
}

export const FASES_PROCESSO = [
  ['contestacao', 'até a contestação'],
  ['saneamento', 'até a decisão de saneamento'],
  ['sentenca', 'até a sentença'],
  ['apelacao', 'até a apelação e as contrarrazões'],
] as const;

/** Pedido pronto para a IA generativa montar um processo fictício neste formato. */
export function pedidoProcessoIA(o: { tema: string; ate: string; eventos: number; vicios: string; inicio: string }): string {
  const fase = FASES_PROCESSO.find(([k]) => k === o.ate)?.[1] ?? 'até a sentença';
  return `Você vai me ajudar a montar um processo judicial FICTÍCIO, para fins didáticos, numa turma de graduação em Direito Processual Civil (CPC/2015). A turma vai acompanhar o processo ao longo do semestre.

Tema do caso: ${o.tema.trim() || '[TEMA, ex.: ação de cobrança por produto não entregue]'}.
O processo vai ${fase}, com cerca de ${o.eventos} eventos, começando em ${o.inicio || '[DATA DE INÍCIO]'}.
${o.vicios.trim() ? `Plante nas peças, de forma discreta, estes defeitos para a turma encontrar: ${o.vicios.trim()}. Não avise no texto das peças que são defeitos. Logo depois do texto de cada peça com defeito, escreva uma linha para cada defeito: "Vício: <trecho exato copiado da peça, de uma só linha> | <explicação curta, com o artigo do CPC>". Essas linhas ficam escondidas da turma até a conferência.\n` : ''}
Responda SOMENTE com o processo, sem comentários antes ou depois, exatamente neste formato:

${MODELO_PROCESSO}

Regras:
- Tudo é fictício: nomes de pessoas, empresas, advogados e juiz inventados, sem pessoas reais ou famosas. O juízo é "1ª Vara Cível da Comarca de Vide". OAB no formato "OAB/VD 12.345". Não escreva número de processo (o Vide gera um fictício).
- Cada evento começa com "Evento:" seguido de: data e hora (DD/MM/AAAA HH:MM) | descrição em maiúsculas (ex.: PETIÇÃO INICIAL, DESPACHO, CITAÇÃO, CONTESTAÇÃO, RÉPLICA, DECISÃO DE SANEAMENTO E ORGANIZAÇÃO, SENTENÇA) | usuário (ADVOGADO DO AUTOR, ADVOGADO DO RÉU, JUIZ, SECRETARIA, OFICIAL DE JUSTIÇA) | quando a turma vê: "segurado".
- Cada documento começa com "Documento:" seguido de: sigla (INIC1, DESPADEC1, CERT1, CONT1, REPLICA1, SENT1…) | título. O texto da peça vem nas linhas seguintes, até o próximo "Documento:" ou "Evento:".
- No texto das peças use: "# " para o título da peça, "## " para subtítulos (DOS FATOS, DO DIREITO, DOS PEDIDOS), "> " para citação de lei, "- " para itens de lista, **negrito** e _itálico_. Linha em branco separa parágrafos.
- Cite os artigos do CPC por extenso no texto ("art. 319 do CPC", "art. 335"). Use só artigos que existem e que se aplicam; os prazos e datas devem ser coerentes com o CPC (dias úteis).
- Peças realistas, mas curtas: de 1 a 4 parágrafos por seção, para caberem na leitura em aula.
- Logo abaixo da linha "Evento:", quando couber: "Fase:" (petição inicial, citação, contestação e réplica, saneamento, instrução, sentença, recurso ou cumprimento) e "Prazo:" para o evento que abre um prazo (ex.: "Prazo: 15 dias úteis para o réu contestar"), contado da data do evento.
- Para documentos que não são texto (procuração, comprovantes, fotos), escreva só a linha "Documento: SIGLA | Título (PDF)", sem texto.`;
}
