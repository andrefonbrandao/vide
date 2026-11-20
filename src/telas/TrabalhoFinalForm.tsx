// "Meu trabalho final" (TCC II) na página do orientando: as partes do modelo da Uniftec.
// O desenvolvimento é feito de capítulos que o orientando cria, nomeia, ordena e remove
// (fica pelo menos um); apêndices e anexos também, com o nome que ele quiser. Tabelas, quadros,
// figuras e gráficos entram no texto pelos botões da barra.
import { novaParte } from '../orientacao/trabalhoFinalEstrutura';
import type { ParteNomeada, TextoFinal } from '../orientacao/tipos';
import { CampoTexto, type DefCampo } from './PreProjetoForm';

type CampoTextoFinal = Exclude<keyof TextoFinal, 'capitulos' | 'apendices' | 'anexos'>;
type Def = DefCampo & { campo: CampoTextoFinal };

const IDENTIFICACAO: Def[] = [
  { campo: 'titulo', nome: 'Título', ajuda: 'Vai em maiúsculas na capa, na folha de rosto e na página do resumo.', linhas: 1, simples: true },
  { campo: 'subtitulo', nome: 'Subtítulo (se houver)', ajuda: '', linhas: 1, simples: true },
  { campo: 'tituloIngles', nome: 'Título em inglês', ajuda: 'Para a página do abstract.', linhas: 1, simples: true },
  { campo: 'subtituloIngles', nome: 'Subtítulo em inglês (se houver)', ajuda: '', linhas: 1, simples: true },
  { campo: 'email', nome: 'Seu e-mail', ajuda: 'Aparece com o seu nome na página do resumo.', linhas: 1, simples: true },
];

const OPCIONAIS: Def[] = [
  { campo: 'dedicatoria', nome: 'Dedicatória', ajuda: 'Fica no pé da página, à direita. Em branco, não entra.', linhas: 3 },
  { campo: 'agradecimentos', nome: 'Agradecimentos', ajuda: 'Em branco, não entra.', linhas: 5 },
  { campo: 'epigrafe', nome: 'Epígrafe', ajuda: 'Uma citação com o autor, que fica no pé da página, à direita. Em branco, não entra.', linhas: 3 },
];

const RESUMO: Def[] = [
  {
    campo: 'resumo',
    nome: 'Resumo',
    ajuda: 'De 150 a 500 palavras, num parágrafo só, na terceira pessoa: objetivos, método, resultados e conclusões. A ideia central logo na primeira frase. Sai em fonte 10, espaço simples.',
    linhas: 7,
  },
  { campo: 'palavrasChave', nome: 'Palavras-chave', ajuda: 'De três a cinco, separadas por ponto: "Precedentes. Processo civil. Fundamentação."', linhas: 1, simples: true },
  { campo: 'abstract', nome: 'Abstract (o resumo em inglês)', ajuda: '', linhas: 7 },
  { campo: 'keywords', nome: 'Keywords', ajuda: 'As palavras-chave em inglês, separadas por ponto.', linhas: 1, simples: true },
];

const contar = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="proc-caixa pp-grupo">
      <legend className="proc-caixa-titulo">{titulo}</legend>
      <div className="pp-campos">{children}</div>
    </fieldset>
  );
}

/** Lista de partes com nome próprio: capítulos, apêndices ou anexos. */
function Partes({
  partes,
  mudar,
  minimo,
  numero,
  rotuloNovo,
  ajudaTexto,
  exemplo,
}: {
  partes: ParteNomeada[];
  mudar: (p: ParteNomeada[]) => void;
  minimo: number;
  numero: (k: number) => string;
  rotuloNovo: string;
  ajudaTexto: string;
  exemplo: string;
}) {
  const trocar = (k: number, p: Partial<ParteNomeada>) => mudar(partes.map((x, i) => (i === k ? { ...x, ...p } : x)));
  const mover = (k: number, d: -1 | 1) => {
    const l = [...partes];
    [l[k], l[k + d]] = [l[k + d], l[k]];
    mudar(l);
  };
  return (
    <>
      {partes.map((c, k) => (
        <div key={c.id} className="pp-parte">
          <CampoTexto
            def={{ campo: `parte-${c.id}`, nome: c.titulo, ajuda: ajudaTexto, linhas: 10, subtitulos: true, subsub: true, tabelas: true }}
            valor={c.texto}
            aoMudar={(v) => trocar(k, { texto: v })}
            rotulo={
              <span className="pp-parte-cab">
                <span className="pp-parte-num">{numero(k)}</span>
                <input aria-label={`Nome de ${numero(k)}`} value={c.titulo} placeholder={exemplo} onChange={(e) => trocar(k, { titulo: e.target.value })} />
                <button type="button" className="botao pequeno" disabled={k === 0} onClick={() => mover(k, -1)} title="Subir" aria-label="Subir">
                  ↑
                </button>
                <button type="button" className="botao pequeno" disabled={k === partes.length - 1} onClick={() => mover(k, 1)} title="Descer" aria-label="Descer">
                  ↓
                </button>
                <button
                  type="button"
                  className="botao pequeno"
                  disabled={partes.length <= minimo}
                  title={partes.length <= minimo ? 'O desenvolvimento precisa de pelo menos um capítulo' : 'Remover'}
                  onClick={() => (!c.texto.trim() || window.confirm(`Remover "${c.titulo || 'sem nome'}" e todo o texto dele?`)) && mudar(partes.filter((_, i) => i !== k))}
                >
                  Remover
                </button>
              </span>
            }
          />
        </div>
      ))}
      <button type="button" className="botao" onClick={() => mudar([...partes, novaParte()])}>
        + {rotuloNovo}
      </button>
    </>
  );
}

export function CamposFinal({ fin, mudar }: { fin: TextoFinal; mudar: (p: Partial<TextoFinal>) => void }) {
  const campo = (d: Def) => <CampoTexto key={d.campo} def={d} valor={fin[d.campo] ?? ''} aoMudar={(v) => mudar({ [d.campo]: v })} />;
  const capitulos = fin.capitulos.length ? fin.capitulos : [novaParte()];
  const palavras = contar(fin.resumo);
  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return (
    <>
      <Grupo titulo="Identificação">{IDENTIFICACAO.map(campo)}</Grupo>
      <Grupo titulo="Dedicatória, agradecimentos e epígrafe (opcionais)">{OPCIONAIS.map(campo)}</Grupo>
      <Grupo titulo="Resumo e abstract">
        {campo(RESUMO[0])}
        {palavras > 0 && (
          <span className={`ajuda pp-contagem${palavras < 150 || palavras > 500 ? ' fora' : ''}`} style={{ margin: '-6px 0 8px' }}>
            {palavras} {palavras === 1 ? 'palavra' : 'palavras'} (de 150 a 500)
          </span>
        )}
        {RESUMO.slice(1).map(campo)}
      </Grupo>
      <Grupo titulo="Lista de abreviaturas e siglas (opcional)">
        {campo({
          campo: 'siglas',
          nome: 'Siglas usadas no trabalho',
          ajuda: 'Uma por linha, com um traço: "STF – Supremo Tribunal Federal". O Vide põe em ordem alfabética. Em branco, a lista não entra.',
          linhas: 4,
          simples: true,
        })}
      </Grupo>
      <Grupo titulo="1 Introdução">
        {campo({
          campo: 'introducao',
          nome: 'Introdução',
          ajuda: 'O tema em linhas gerais, a delimitação, o problema, os objetivos, a justificativa, a metodologia e como o trabalho está organizado (as partes que o compõem).',
          linhas: 10,
          subtitulos: true,
          tabelas: true,
        })}
      </Grupo>
      <Grupo titulo="2 Objetivos e justificativa">
        {campo({ campo: 'objetivoGeral', nome: '2.1 Objetivo geral', ajuda: 'Uma frase curta, com um único verbo no infinitivo.', linhas: 2 })}
        {campo({ campo: 'objetivosEspecificos', nome: '2.1.1 Objetivos específicos', ajuda: 'Um por linha, com verbo no infinitivo. Sem marcador; o ponto final o Vide põe.', linhas: 4, simples: true })}
        {campo({ campo: 'justificativa', nome: '2.2 Justificativa', ajuda: 'A relevância do estudo, a oportunidade e a viabilidade.', linhas: 6 })}
      </Grupo>
      <fieldset className="proc-caixa pp-grupo">
        <legend className="proc-caixa-titulo">Desenvolvimento: capítulos</legend>
        <div className="pp-campos">
          <p className="ajuda" style={{ marginTop: 0 }}>
            Crie os capítulos do seu trabalho e dê a cada um o nome que fizer sentido para o seu objeto (por exemplo, "Fundamentação teórica", "O sistema de precedentes no CPC", "Análise das
            decisões"). Cada capítulo começa numa página nova, com o número na ordem (3, 4, 5…). Use as setas para mudar a ordem.
          </p>
          <Partes
            partes={capitulos}
            mudar={(l) => mudar({ capitulos: l })}
            minimo={1}
            numero={(k) => String(k + 3)}
            rotuloNovo="Adicionar capítulo"
            ajudaTexto='Use "Subtítulo" para dividir o capítulo (3.1, 3.2…), "Tabela ou quadro" para uma tabela e "Figura ou gráfico" para uma imagem.'
            exemplo="Nome do capítulo"
          />
        </div>
      </fieldset>
      <Grupo titulo={`${capitulos.length + 3} Considerações finais`}>
        {campo({
          campo: 'consideracoes',
          nome: 'Considerações finais',
          ajuda: 'A resposta ao problema de pesquisa, se os objetivos foram alcançados e as hipóteses confirmadas ou não, e o que fica para pesquisas futuras.',
          linhas: 8,
          subtitulos: true,
        })}
      </Grupo>
      <Grupo titulo="Referências">
        {campo({
          campo: 'referencias',
          nome: 'Referências',
          ajuda: 'Uma por linha, no padrão da ABNT, com o título da obra em negrito: SOBRENOME, Nome. **Título**. Edição. Local: Editora, ano. O Vide põe em ordem alfabética.',
          linhas: 8,
        })}
      </Grupo>
      <fieldset className="proc-caixa pp-grupo">
        <legend className="proc-caixa-titulo">Apêndices e anexos (opcionais)</legend>
        <div className="pp-campos">
          <p className="ajuda" style={{ marginTop: 0 }}>
            Apêndice: material feito por você (questionário, roteiro de entrevista, planilha). Anexo: material de outra pessoa (lei, decisão, documento). Cada um começa numa página nova, com letra
            (Apêndice A, B…).
          </p>
          <Partes
            partes={fin.apendices}
            mudar={(l) => mudar({ apendices: l })}
            minimo={0}
            numero={(k) => `Apêndice ${LETRAS[k] ?? k + 1}`}
            rotuloNovo="Adicionar apêndice"
            ajudaTexto=""
            exemplo="ex.: Roteiro da entrevista"
          />
          <div style={{ height: 12 }} />
          <Partes
            partes={fin.anexos}
            mudar={(l) => mudar({ anexos: l })}
            minimo={0}
            numero={(k) => `Anexo ${LETRAS[k] ?? k + 1}`}
            rotuloNovo="Adicionar anexo"
            ajudaTexto=""
            exemplo="ex.: Súmula vinculante nº 10"
          />
        </div>
      </fieldset>
    </>
  );
}
