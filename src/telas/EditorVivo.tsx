// Editor do texto do orientando com "visualização ao vivo" (como no Obsidian): o texto aparece
// já formatado — subtítulos grandes, negrito, itálico, citação longa recuada, nota de rodapé
// como número elevado, tabelas e figuras desenhadas — e as marcações (**, _, ##, >, [[ ]], :::)
// só aparecem na linha em que está o cursor. Por baixo, o texto continua o mesmo (com as
// marcações), que é o que vai para o PDF e o Word.
// Usa o CodeMirror (o mesmo motor do Obsidian); é carregado só na página do orientando.
import { useContext, useEffect, useRef } from 'react';
import { EditorSelection, EditorState, StateEffect, StateField, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, WidgetType, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { separarTabelas, textoPuro } from '../orientacao/marcacao';
import { imagemDaPagina } from '../orientacao/imagens';
import { ContextoPagina } from './contextoPagina';

/** O que a barra de botões do campo usa para mexer no texto. */
export interface Controle {
  /** Seleção atual (início, fim). */
  sel(): [number, number];
  /** Troca o trecho [de, ate) por `texto` e seleciona [selDe, selAte). */
  trocar(de: number, ate: number, texto: string, selDe?: number, selAte?: number): void;
  foco(): void;
}

interface Props {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  linhas: number;
  /** Aceita "## " e "### " (subtítulos). */
  subtitulos: boolean;
  /** Clique numa tabela/figura desenhada: abre a edição do bloco que começa em `pos`. */
  aoEditarBloco: (pos: number) => void;
  controle: (c: Controle | null) => void;
}

// ---------- Marcas de uma linha (o mesmo que lerTrechos entende, com as posições) ----------
type Marca = { tipo: 'b' | 'i'; de: number; ate: number; marcas: [number, number][] } | { tipo: 'nota'; de: number; ate: number; texto: string };

export function marcasDaLinha(l: string): Marca[] {
  const out: Marca[] = [];
  let abreB = -1;
  let abreI = -1;
  for (let i = 0; i < l.length; i++) {
    if (l.startsWith('[[', i)) {
      const fim = l.indexOf(']]', i + 2);
      if (fim > i) {
        out.push({ tipo: 'nota', de: i, ate: fim + 2, texto: l.slice(i + 2, fim).trim() });
        i = fim + 1;
        continue;
      }
    }
    if (l.startsWith('**', i)) {
      if (abreB < 0) abreB = i;
      else {
        out.push({ tipo: 'b', de: abreB + 2, ate: i, marcas: [[abreB, abreB + 2], [i, i + 2]] });
        abreB = -1;
      }
      i++;
      continue;
    }
    if (l[i] === '_') {
      const fecha = abreI >= 0 && /\S/.test(l[i - 1] ?? '');
      const abre = abreI < 0 && /\S/.test(l[i + 1] ?? '') && !/\w/.test(l[i - 1] ?? '');
      if (fecha) {
        out.push({ tipo: 'i', de: abreI + 1, ate: i, marcas: [[abreI, abreI + 1], [i, i + 1]] });
        abreI = -1;
      } else if (abre) abreI = i;
    }
  }
  return out;
}

// ---------- Desenhos (widgets) ----------
const urls = new Map<string, Promise<string>>();
function urlDaImagem(codigo: string, pin: string, id: string): Promise<string> {
  let p = urls.get(id);
  if (!p) {
    p = imagemDaPagina(codigo, id, { 'X-Vide-Pin': pin }).then((b) => (b ? URL.createObjectURL(new Blob([b as BlobPart])) : ''));
    urls.set(id, p);
  }
  return p;
}

class NotaWidget extends WidgetType {
  constructor(readonly texto: string) {
    super();
  }
  eq(o: NotaWidget) {
    return o.texto === this.texto;
  }
  toDOM() {
    const s = document.createElement('sup');
    s.className = 'cm-nota';
    s.textContent = 'nota';
    s.title = `Nota de rodapé: ${textoPuro(this.texto)}`;
    return s;
  }
  ignoreEvent() {
    return false;
  }
}

class BlocoWidget extends WidgetType {
  constructor(
    readonly texto: string,
    readonly pagina: { codigo: string; pin: string } | null,
    readonly editar: (pos: number) => void,
  ) {
    super();
  }
  eq(o: BlocoWidget) {
    return o.texto === this.texto;
  }
  toDOM(view: EditorView) {
    const caixa = document.createElement('div');
    caixa.className = 'cm-bloco';
    caixa.title = 'Clique para editar';
    const p = separarTabelas(this.texto).find((x) => x.tipo !== 'texto');
    const legenda = document.createElement('div');
    legenda.className = 'cm-bloco-legenda';
    const fonte = document.createElement('div');
    fonte.className = 'cm-bloco-fonte';
    if (p?.tipo === 'tabela') {
      const t = p.tabela;
      legenda.textContent = `${t.tipo === 'quadro' ? 'Quadro' : 'Tabela'} – ${t.titulo || 'sem título'}`;
      const tab = document.createElement('table');
      tab.className = t.tipo === 'quadro' ? 'cm-quadro' : 'cm-tabela';
      t.linhas.forEach((l, r) => {
        const tr = document.createElement('tr');
        for (const c of l) {
          const td = document.createElement(r === 0 ? 'th' : 'td');
          td.textContent = textoPuro(c);
          tr.appendChild(td);
        }
        tab.appendChild(tr);
      });
      fonte.textContent = `Fonte: ${t.fonte || 'o autor.'}`;
      caixa.append(legenda, tab, fonte);
    } else if (p?.tipo === 'figura') {
      const f = p.figura;
      legenda.textContent = `${f.tipo === 'grafico' ? 'Gráfico' : 'Figura'} – ${f.titulo || 'sem título'}`;
      const img = document.createElement('img');
      img.className = 'cm-figura';
      img.alt = f.titulo;
      img.style.width = `${f.largura}%`;
      if (this.pagina && f.imagem)
        void urlDaImagem(this.pagina.codigo, this.pagina.pin, f.imagem).then((u) => {
          if (u) img.src = u;
          else img.replaceWith(Object.assign(document.createElement('div'), { className: 'cm-figura-falta', textContent: '[imagem não encontrada]' }));
        });
      fonte.textContent = `Fonte: ${f.fonte || 'o autor.'}`;
      caixa.append(legenda, img, fonte);
    }
    caixa.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.editar(view.posAtDOM(caixa));
    });
    return caixa;
  }
  ignoreEvent() {
    return true;
  }
}

const RE_BLOCO = /^:::\s*(tabela|quadro|figura|gr[áa]fico)(?![\p{L}\d])/iu;

/** Monta a aparência do texto (o que esconder, o que formatar, o que desenhar). */
function decoracoes(estado: EditorState, subtitulos: boolean, pagina: { codigo: string; pin: string } | null, editar: (pos: number) => void): DecorationSet {
  const doc = estado.doc;
  const ativas = new Set<number>();
  for (const r of estado.selection.ranges) {
    const a = doc.lineAt(r.from).number;
    const b = doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) ativas.add(n);
  }
  const focado = estado.field(campoFoco, false) ?? false;
  const ativa = (n: number) => focado && ativas.has(n);
  const out: Range<Decoration>[] = [];
  const esconder = Decoration.replace({});
  for (let n = 1; n <= doc.lines; n++) {
    const linha = doc.line(n);
    const t = linha.text;
    // Tabela/quadro/figura/gráfico: desenhado, a não ser que o cursor esteja dentro.
    if (RE_BLOCO.test(t.trim())) {
      let fim = n + 1;
      while (fim <= doc.lines && doc.line(fim).text.trim() !== ':::') fim++;
      if (fim > doc.lines) fim = doc.lines;
      let dentro = false;
      for (let k = n; k <= fim; k++) if (ativa(k)) dentro = true;
      if (dentro) for (let k = n; k <= fim; k++) out.push(Decoration.line({ class: 'cm-bloco-cru' }).range(doc.line(k).from));
      else {
        const de = linha.from;
        const ate = doc.line(fim).to;
        out.push(Decoration.replace({ widget: new BlocoWidget(doc.sliceString(de, ate), pagina, editar), block: true }).range(de, ate));
      }
      n = fim;
      continue;
    }
    const mostrar = ativa(n);
    let ini = 0;
    const sub = subtitulos ? /^(#{2,})\s+/.exec(t) : null;
    const cit = !sub ? /^>\s*/.exec(t) : null;
    if (sub) {
      out.push(Decoration.line({ class: sub[1].length >= 3 ? 'cm-h3' : 'cm-h2' }).range(linha.from));
      ini = sub[0].length;
    } else if (cit) {
      out.push(Decoration.line({ class: 'cm-cit' }).range(linha.from));
      ini = cit[0].length;
    } else if (t.trim()) out.push(Decoration.line({ class: 'cm-par' }).range(linha.from));
    if (ini) out.push((mostrar ? Decoration.mark({ class: 'cm-marca' }) : esconder).range(linha.from, linha.from + ini));
    for (const m of marcasDaLinha(t.slice(ini))) {
      const de = linha.from + ini + m.de;
      const ate = linha.from + ini + m.ate;
      if (m.tipo === 'nota') {
        out.push((mostrar ? Decoration.mark({ class: 'cm-nota-cru' }) : Decoration.replace({ widget: new NotaWidget(m.texto) })).range(de, ate));
        continue;
      }
      if (ate > de) out.push(Decoration.mark({ class: m.tipo === 'b' ? 'cm-b' : 'cm-i' }).range(de, ate));
      for (const [a, b] of m.marcas) out.push((mostrar ? Decoration.mark({ class: 'cm-marca' }) : esconder).range(linha.from + ini + a, linha.from + ini + b));
    }
  }
  return Decoration.set(out, true);
}

const mudouFoco = StateEffect.define<boolean>();
/** Se o editor está com o foco (sem foco, tudo aparece formatado). */
const campoFoco = StateField.define<boolean>({
  create: () => false,
  update: (v, tr) => {
    for (const e of tr.effects) if (e.is(mudouFoco)) return e.value;
    return v;
  },
});

// ---------- Colar do Word: negrito, itálico e parágrafos viram as marcações ----------
export function htmlParaMarcacao(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let out = '';
  const andar = (no: Node, b: boolean, i: boolean) => {
    if (no.nodeType === Node.TEXT_NODE) {
      const t = (no.textContent ?? '').replace(/\s+/g, ' ');
      if (!t.trim()) {
        if (t && !/\s$/.test(out)) out += ' ';
        return;
      }
      const lead = /^\s/.test(t) ? ' ' : '';
      const trail = /\s$/.test(t) ? ' ' : '';
      let x = t.trim();
      if (i) x = `_${x}_`;
      if (b) x = `**${x}**`;
      out += lead + x + trail;
      return;
    }
    if (!(no instanceof HTMLElement)) return;
    const tag = no.tagName.toLowerCase();
    if (['style', 'script', 'head', 'title', 'meta'].includes(tag)) return;
    const st = no.getAttribute('style') ?? '';
    const nb = b || tag === 'b' || tag === 'strong' || /font-weight\s*:\s*(bold|[6-9]00)/i.test(st);
    const ni = i || tag === 'i' || tag === 'em' || /font-style\s*:\s*italic/i.test(st);
    const bloco = /^(p|div|li|h[1-6]|blockquote|tr|br)$/.test(tag);
    if (tag === 'br') {
      out += '\n';
      return;
    }
    if (bloco && out && !out.endsWith('\n')) out += '\n';
    if (/^h[1-6]$/.test(tag)) out += '## ';
    // Títulos já são negrito por natureza: não marca de novo.
    no.childNodes.forEach((c) => andar(c, /^h[1-6]$/.test(tag) ? false : nb, ni));
    if (bloco && !out.endsWith('\n')) out += '\n';
  };
  andar(doc.body, false, false);
  return out
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\*\*(\s*)_([^_\n]*)_(\s*)\*\*/g, '$1**_$2_**$3')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export default function EditorVivo({ id, rotulo, valor, aoMudar, linhas, subtitulos, aoEditarBloco, controle }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  const pagina = useContext(ContextoPagina);
  const cb = useRef({ aoMudar, aoEditarBloco });
  cb.current = { aoMudar, aoEditarBloco };

  useEffect(() => {
    const editar = (pos: number) => cb.current.aoEditarBloco(pos);
    const aparencia = StateField.define<DecorationSet>({
      create: (s) => decoracoes(s, subtitulos, pagina, editar),
      update: (d, tr) => (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(mudouFoco)) ? decoracoes(tr.state, subtitulos, pagina, editar) : d),
      provide: (f) => EditorView.decorations.from(f),
    });
    const envolverAtalho = (marca: string) => (v: EditorView) => {
      const r = v.state.selection.main;
      const sel = v.state.sliceDoc(r.from, r.to) || 'texto';
      v.dispatch({ changes: { from: r.from, to: r.to, insert: marca + sel + marca }, selection: EditorSelection.range(r.from + marca.length, r.from + marca.length + sel.length) });
      return true;
    };
    const v = new EditorView({
      parent: caixa.current!,
      state: EditorState.create({
        doc: valor,
        extensions: [
          history(),
          keymap.of([{ key: 'Mod-b', run: envolverAtalho('**') }, { key: 'Mod-i', run: envolverAtalho('_') }, ...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          campoFoco,
          aparencia,
          EditorView.contentAttributes.of({ spellcheck: 'true', lang: 'pt-BR', autocorrect: 'on', autocapitalize: 'sentences', 'aria-label': rotulo, id }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.aoMudar(u.state.doc.toString());
            if (u.focusChanged) setTimeout(() => u.view.dispatch({ effects: mudouFoco.of(u.view.hasFocus) }));
          }),
          EditorView.domEventHandlers({
            paste: (e, view) => {
              const html = e.clipboardData?.getData('text/html');
              if (!html || !/<(b|strong|i|em|span|p)\b/i.test(html)) return false;
              const texto = htmlParaMarcacao(html);
              if (!texto) return false;
              e.preventDefault();
              view.dispatch(view.state.replaceSelection(texto));
              return true;
            },
          }),
          EditorView.theme({ '&': { minHeight: `${Math.max(3, linhas) * 1.7}em` }, '.cm-content': { minHeight: `${Math.max(3, linhas) * 1.7}em` } }),
        ],
      }),
    });
    vista.current = v;
    controle({
      sel: () => [v.state.selection.main.from, v.state.selection.main.to],
      trocar: (de, ate, texto, selDe, selAte) => {
        v.dispatch({ changes: { from: de, to: ate, insert: texto }, ...(selDe !== undefined ? { selection: EditorSelection.range(selDe, selAte ?? selDe) } : {}), scrollIntoView: true });
        v.focus();
      },
      foco: () => v.focus(),
    });
    return () => {
      controle(null);
      v.destroy();
      vista.current = null;
    };
    // O editor é criado uma vez; o texto que muda por fora entra pelo efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitulos, pagina]);

  // Texto mudado por fora (tabela inserida, texto de outro aparelho): atualiza o editor.
  useEffect(() => {
    const v = vista.current;
    if (!v) return;
    const atual = v.state.doc.toString();
    if (atual === valor) return;
    const pos = Math.min(v.state.selection.main.head, valor.length);
    v.dispatch({ changes: { from: 0, to: atual.length, insert: valor }, selection: EditorSelection.cursor(pos) });
  }, [valor]);

  return <div ref={caixa} className="pp-editor" />;
}
