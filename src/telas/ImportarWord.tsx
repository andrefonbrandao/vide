// "Importar do Word": o orientando envia o próprio arquivo .docx e o Vide distribui o texto pelo
// formulário (títulos, notas de rodapé, citações, tabelas e figuras). Antes, uma janela lembra de
// formatar os títulos com os estilos do Word ("Saiba como"); depois, a conferência mostra para
// onde vai cada parte, e só então o texto entra (substituindo o atual, com cópia para desfazer).
import { useContext, useState } from 'react';
import { lerDocx, type Docx } from '../orientacao/lerDocx';
import { importarFinal, importarPre, type ResultadoImportacao } from '../orientacao/importarWord';
import { lembrarImagem, reduzirImagem } from '../orientacao/imagens';
import { FINAL_VAZIO, finalDoPreProjeto } from '../orientacao/trabalhoFinalEstrutura';
import type { TextoFinal, TextoProjeto } from '../orientacao/tipos';
import { ContextoPagina } from './contextoPagina';

const LEGIVEIS: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
const novoId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

type Resultado = ResultadoImportacao<TextoFinal> | ResultadoImportacao<TextoProjeto>;

export function ImportarWord({ final, texto, aoFechar, aoImportar }: { final: boolean; texto: TextoProjeto; aoFechar: () => void; aoImportar: (t: TextoProjeto) => void }) {
  const pg = useContext(ContextoPagina);
  const [passo, setPasso] = useState<'intro' | 'lendo' | 'conferir' | 'enviando'>('intro');
  const [saibaComo, setSaibaComo] = useState(false);
  const [erro, setErro] = useState('');
  const [doc, setDoc] = useState<Docx | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [progresso, setProgresso] = useState('');

  const escolher = async (arq: File | undefined) => {
    if (!arq) return;
    setErro('');
    if (/\.doc$/i.test(arq.name)) return setErro('Este é o formato antigo do Word (.doc). Abra no Word e use "Salvar como" › "Documento do Word (.docx)".');
    if (!/\.docx$/i.test(arq.name)) return setErro('Escolha um arquivo do Word (.docx). No Google Docs: Arquivo › Fazer download › Microsoft Word (.docx).');
    setPasso('lendo');
    try {
      const d = await lerDocx(new Uint8Array(await arq.arrayBuffer()));
      const r = final
        ? importarFinal(d.elementos, { ...FINAL_VAZIO, ...(texto.final ?? finalDoPreProjeto(texto)) }, d.temEstilos)
        : importarPre(d.elementos, texto, d.temEstilos);
      setDoc(d);
      setRes(r);
      setPasso('conferir');
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível ler o arquivo.');
      setPasso('intro');
    }
  };

  const importar = async () => {
    if (!doc || !res || !pg) return;
    setPasso('enviando');
    setErro('');
    try {
      // Envia as imagens (reduzidas) e troca "@rId" pelo código de cada uma.
      const trocas = new Map<string, string>();
      let n = 0;
      for (const rid of res.imagens) {
        n++;
        const img = doc.imagens.get(rid);
        const tipo = img && LEGIVEIS[img.ext];
        if (!img || !tipo) {
          trocas.set(rid, '');
          continue;
        }
        setProgresso(`Enviando as imagens: ${n} de ${res.imagens.length}…`);
        const blob = await reduzirImagem(new Blob([img.bytes as BlobPart], { type: tipo }));
        const id = novoId();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const r = await fetch(`/api/orientacao/${pg.codigo}/imagem/${id}`, { method: 'PUT', headers: { 'Content-Type': blob.type, ...pg.cabecalho }, body: bytes });
        if (!r.ok) throw new Error(r.status === 413 ? 'o trabalho já tem imagens demais ou uma imagem é grande demais' : `erro ${r.status} ao enviar uma imagem`);
        lembrarImagem(pg.codigo, id, bytes);
        trocas.set(rid, id);
      }
      const trocar = (s: string) => s.replace(/^imagem: @(\S+)$/gm, (_m, rid: string) => `imagem: ${trocas.get(rid) ?? ''}`);
      if (final) {
        const t = res.texto as TextoFinal;
        const novo: TextoFinal = {
          ...t,
          introducao: trocar(t.introducao),
          objetivoGeral: trocar(t.objetivoGeral),
          justificativa: trocar(t.justificativa),
          consideracoes: trocar(t.consideracoes),
          capitulos: t.capitulos.map((c) => ({ ...c, texto: trocar(c.texto) })),
          apendices: t.apendices.map((c) => ({ ...c, texto: trocar(c.texto) })),
          anexos: t.anexos.map((c) => ({ ...c, texto: trocar(c.texto) })),
        };
        aoImportar({ ...texto, final: novo });
      } else {
        const t = res.texto as TextoProjeto;
        const novo = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === 'string' ? trocar(v) : v])) as unknown as TextoProjeto;
        aoImportar(novo);
      }
    } catch (e) {
      setErro(`Não foi possível importar: ${(e as Error).message}. Confira a internet e tente de novo.`);
      setPasso('conferir');
    }
  };

  const ilegiveis = doc && res ? res.imagens.filter((rid) => !LEGIVEIS[doc.imagens.get(rid)?.ext ?? '']).length : 0;
  const resumo = (c: { paragrafos: number; tabelas: number; figuras: number; notas: number; subtitulos: number }) =>
    [
      c.paragrafos && `${c.paragrafos} parágrafo${c.paragrafos > 1 ? 's' : ''}`,
      c.subtitulos && `${c.subtitulos} subtítulo${c.subtitulos > 1 ? 's' : ''}`,
      c.tabelas && `${c.tabelas} tabela${c.tabelas > 1 ? 's' : ''}`,
      c.figuras && `${c.figuras} figura${c.figuras > 1 ? 's' : ''}`,
      c.notas && `${c.notas} nota${c.notas > 1 ? 's' : ''} de rodapé`,
    ]
      .filter(Boolean)
      .join(' · ') || 'vazio';

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && passo !== 'enviando' && aoFechar()}>
      <div className="modal imp" role="dialog" aria-label="Importar do Word">
        <h2>Importar do Word</h2>
        {passo === 'intro' || passo === 'lendo' ? (
          <>
            <div className="imp-aviso">
              <strong>Antes de importar:</strong> confira se os <strong>títulos e subtítulos</strong> do seu trabalho estão formatados com os <strong>estilos de título do Word</strong> (Título 1, Título 2,
              Título 3). É por eles que o Vide sabe onde começa cada parte (introdução, objetivos, cada capítulo, referências…).
              <button type="button" className="ori-link" onClick={() => setSaibaComo(!saibaComo)} aria-expanded={saibaComo}>
                {saibaComo ? 'Fechar o passo a passo' : 'Saiba como'}
              </button>
            </div>
            {saibaComo && (
              <div className="imp-tutorial">
                <p>
                  <strong>No Word (computador)</strong>
                </p>
                <ol>
                  <li>Clique na linha do título (por exemplo, "1 INTRODUÇÃO").</li>
                  <li>
                    Na guia <strong>Página Inicial</strong>, no quadro <strong>Estilos</strong>, clique em <strong>Título 1</strong>.
                  </li>
                  <li>
                    Faça o mesmo nos subtítulos: <strong>Título 2</strong> para "2.1…" e <strong>Título 3</strong> para "2.1.1…".
                  </li>
                  <li>
                    Também em Título 1: Resumo, Referências, cada Apêndice e cada Anexo. Os números ("1", "2.1") podem ficar ou sair: o Vide numera sozinho.
                  </li>
                  <li>Para conferir, abra o <strong>Painel de Navegação</strong> (guia Exibir): ali aparecem só os títulos, em ordem.</li>
                </ol>
                <p>
                  <strong>No Google Docs</strong>
                </p>
                <ol>
                  <li>
                    Clique na linha do título e, no menu de estilos (onde está escrito "Texto normal"), escolha <strong>Título 1</strong> (ou Título 2, Título 3).
                  </li>
                  <li>
                    Depois: <strong>Arquivo › Fazer download › Microsoft Word (.docx)</strong> e importe esse arquivo aqui.
                  </li>
                </ol>
                <p className="ajuda">
                  Dica: escreva a legenda acima de cada tabela e figura ("Tabela 1 – título", "Figura 1 – título") e a fonte logo abaixo ("Fonte: …"): o Vide leva os dois junto.
                </p>
              </div>
            )}
            <p className="ajuda">
              O texto importado <strong>substitui</strong> o que está no formulário (o Vide guarda uma cópia do texto atual, para desfazer). Notas de rodapé, citações recuadas, tabelas e figuras vêm junto.
            </p>
            <div className="modal-botoes">
              <label className={`botao primario${passo === 'lendo' ? ' desligado' : ''}`}>
                {passo === 'lendo' ? 'Lendo o arquivo…' : 'Escolher o arquivo (.docx)'}
                <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden disabled={passo === 'lendo'} onChange={(e) => void escolher(e.target.files?.[0])} />
              </label>
              <button type="button" className="botao" onClick={aoFechar}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          res && (
            <>
              <p className="ajuda" style={{ marginTop: 0 }}>
                Confira para onde vai cada parte do seu arquivo:
              </p>
              {res.avisos.map((a) => (
                <p key={a} className="imp-alerta">
                  {a}
                </p>
              ))}
              <ul className="imp-destinos">
                {res.destinos.map((d, k) => (
                  <li key={k}>
                    <strong>{d.nome}</strong>
                    <span className="ajuda" style={{ margin: 0 }}>
                      {resumo(d.contagem)}
                    </span>
                  </li>
                ))}
              </ul>
              {res.ignorados.length > 0 && <p className="ajuda">Fica de fora: {res.ignorados.join(' · ')} (capa, sumário e listas o Vide monta sozinho).</p>}
              {ilegiveis > 0 && <p className="imp-alerta">{ilegiveis} imagem(ns) num formato que o Vide não lê (desenho do Word): depois de importar, toque na figura e escolha a imagem de novo.</p>}
              {passo === 'enviando' && <p className="ajuda">{progresso || 'Importando…'}</p>}
              <div className="modal-botoes">
                <button type="button" className="botao primario" disabled={passo === 'enviando' || !res.destinos.length} onClick={() => void importar()}>
                  {passo === 'enviando' ? 'Importando…' : 'Importar (substitui o texto atual)'}
                </button>
                <button type="button" className="botao" disabled={passo === 'enviando'} onClick={() => (setPasso('intro'), setRes(null))}>
                  Escolher outro arquivo
                </button>
                <button type="button" className="botao" disabled={passo === 'enviando'} onClick={aoFechar}>
                  Cancelar
                </button>
              </div>
            </>
          )
        )}
        {erro && <p className="oa-erro">{erro}</p>}
      </div>
    </div>
  );
}
