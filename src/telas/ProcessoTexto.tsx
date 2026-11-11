// Processo em texto, na tela do professor: colar para criar, colar eventos,
// copiar como texto e o pedido pronto para a IA montar um processo.
import { useMemo, useState } from 'react';
import { processoEmBranco, salvarProcesso } from '../processo/banco';
import { FASES_PROCESSO, lerProcessoTexto, MODELO_PROCESSO, pedidoProcessoIA, processoDoTexto, processoParaTexto, type ProcessoLido } from '../processo/importar';
import { dadosParaPublicar } from '../processo/publicar';
import type { Evento, Processo } from '../processo/tipos';
import { VisaoProcesso } from './ProcessoAluno';

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function hojeBR(): string {
  return new Date().toLocaleDateString('pt-BR');
}

/** Avisos da leitura do texto. */
function Avisos({ lido }: { lido: ProcessoLido }) {
  if (!lido.avisos.length && !lido.pdfsPendentes) return null;
  return (
    <div className="proc-avisos">
      {lido.avisos.map((a, i) => (
        <p key={i} className="digitar-msg erro" style={{ padding: 0, flexBasis: 'auto' }}>
          {a}
        </p>
      ))}
      {lido.pdfsPendentes > 0 && (
        <p className="ajuda" style={{ margin: 0 }}>
          {lido.pdfsPendentes} {lido.pdfsPendentes === 1 ? 'documento marcado' : 'documentos marcados'} "(PDF)": depois de criar, anexe o arquivo no
          evento (aparece "falta anexar o PDF").
        </p>
      )}
    </div>
  );
}

/** Pedido pronto para a IA montar um processo fictício no formato do Vide. */
export function PedidoIAProcesso() {
  const [tema, setTema] = useState('');
  const [ate, setAte] = useState('sentenca');
  const [eventos, setEventos] = useState(10);
  const [vicios, setVicios] = useState('');
  const [inicio, setInicio] = useState(hojeBR());
  const [copiado, setCopiado] = useState<string | null>(null);
  return (
    <div className="cartao">
      <h3 style={{ marginTop: 0 }}>Pedir o processo a uma IA</h3>
      <p className="ajuda">
        Preencha e copie o pedido. Cole no Claude (ou outra IA), copie a resposta e cole no campo abaixo. Revise as peças antes de liberar:
        a IA pode errar artigos e prazos.
      </p>
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="ia-tema">Tema do caso</label>
          <input id="ia-tema" type="text" placeholder="ex.: cobrança por geladeira não entregue" value={tema} onChange={(e) => setTema(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="ia-ate">Até que fase</label>
          <select id="ia-ate" className="seletor" value={ate} onChange={(e) => setAte(e.target.value)}>
            {FASES_PROCESSO.map(([k, r]) => (
              <option key={k} value={k}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ia-eventos">Quantos eventos (mais ou menos)</label>
          <input id="ia-eventos" type="number" min={3} max={40} value={eventos} onChange={(e) => setEventos(Math.max(3, Math.min(40, Number(e.target.value) || 3)))} style={{ width: 90 }} />
        </div>
        <div className="campo">
          <label htmlFor="ia-inicio">Data de início</label>
          <input id="ia-inicio" type="text" placeholder="DD/MM/AAAA" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="ia-vicios">Defeitos para plantar (opcional)</label>
        <input id="ia-vicios" type="text" placeholder="ex.: citação nula; contestação intempestiva; petição sem o valor da causa" value={vicios} onChange={(e) => setVicios(e.target.value)} />
      </div>
      <div className="linha-opcoes">
        <button className="botao escuro" onClick={async () => setCopiado((await copiar(pedidoProcessoIA({ tema, ate, eventos, vicios, inicio }))) ? 'pedido' : null)}>
          {copiado === 'pedido' ? 'Pedido copiado ✓' : 'Copiar pedido para a IA'}
        </button>
        <button className="botao pequeno" onClick={async () => setCopiado((await copiar(MODELO_PROCESSO)) ? 'modelo' : null)}>
          {copiado === 'modelo' ? 'Modelo copiado' : 'Copiar só o modelo'}
        </button>
      </div>
    </div>
  );
}

/** Colar um processo inteiro (capa, partes, eventos e peças) para criá-lo. */
export function ColarProcesso({ aoCriar, aoCancelar }: { aoCriar: (id: string) => void; aoCancelar: () => void }) {
  const [texto, setTexto] = useState('');
  const [verModelo, setVerModelo] = useState(false);
  const lido = useMemo(() => (texto.trim() ? lerProcessoTexto(texto) : null), [texto]);
  const previa = useMemo(() => (lido ? processoDoTexto(lido, processoEmBranco(lido.titulo || 'Processo colado')) : null), [lido]);
  return (
    <div className="proc-colar">
      <PedidoIAProcesso />
      <div className="cartao">
        <h3 style={{ marginTop: 0 }}>Colar o processo</h3>
        <p className="ajuda">
          Capa e partes, uma linha por informação; cada <strong>Evento:</strong> com data e hora | descrição | usuário | quando a turma vê
          (liberado, segurado ou "aparece em DD/MM/AAAA HH:MM"); cada <strong>Documento:</strong> com sigla | título e o texto da peça nas
          linhas seguintes.{' '}
          <button type="button" className="link-discreto" style={{ marginLeft: 0 }} onClick={() => setVerModelo(!verModelo)}>
            {verModelo ? 'esconder o modelo' : 'ver o modelo'}
          </button>
        </p>
        {verModelo && <pre className="mono modelo-questoes">{MODELO_PROCESSO}</pre>}
        <div className="campo">
          <label htmlFor="colar-processo">Processo em texto</label>
          <textarea id="colar-processo" rows={14} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui…" className="mono" />
        </div>
        {lido && previa && (
          <>
            <p>
              <strong>{lido.titulo || 'Processo sem nome'}</strong> · {previa.partes.filter((x) => x.nome).length} partes · <strong>{lido.eventos.length}</strong>{' '}
              {lido.eventos.length === 1 ? 'evento' : 'eventos'} · {lido.eventos.reduce((n, e) => n + e.documentos.length, 0)} documentos
            </p>
            <Avisos lido={lido} />
            <details className="proc-previa-colar">
              <summary>Ver como a turma vai ver</summary>
              <VisaoProcesso dados={dadosParaPublicar(previa)} previa />
            </details>
          </>
        )}
        <div className="modal-botoes">
          <button
            className="botao primario"
            disabled={!lido || (!lido.eventos.length && !lido.partes.length && !Object.keys(lido.capa).length)}
            onClick={async () => {
              const p = await salvarProcesso(previa!);
              aoCriar(p.id);
            }}
          >
            Criar o processo
          </button>
          <button className="botao" onClick={aoCancelar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Colar só eventos para acrescentar a um processo que já existe. */
export function ColarEventos({ aoAcrescentar, aoCancelar }: { aoAcrescentar: (eventos: Evento[]) => void; aoCancelar: () => void }) {
  const [texto, setTexto] = useState('');
  const lido = useMemo(() => (texto.trim() ? lerProcessoTexto(texto) : null), [texto]);
  const ignorados = lido && (lido.partes.length > 0 || Object.keys(lido.capa).length > 0 || lido.titulo);
  return (
    <div className="cartao">
      <h3 style={{ marginTop: 0 }}>Colar eventos</h3>
      <p className="ajuda">
        Cole um ou mais eventos no formato <span className="mono">Evento: DD/MM/AAAA HH:MM | DESCRIÇÃO | USUÁRIO | segurado</span>, cada um com seus{' '}
        <span className="mono">Documento: SIGLA | Título</span> e o texto da peça. Eles entram no fim da lista.
      </p>
      <textarea id="colar-eventos" rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui…" className="mono" style={{ width: '100%' }} />
      {lido && (
        <>
          <p>
            <strong>{lido.eventos.length}</strong> {lido.eventos.length === 1 ? 'evento entendido' : 'eventos entendidos'}
            {lido.eventos.length > 0 && `: ${lido.eventos.map((e) => e.descricao || '(sem descrição)').join(' · ')}`}
          </p>
          {ignorados && <p className="ajuda">A capa e as partes que estavam no texto foram ignoradas (aqui só entram eventos).</p>}
          <Avisos lido={lido} />
        </>
      )}
      <div className="modal-botoes">
        <button className="botao primario" disabled={!lido?.eventos.length} onClick={() => aoAcrescentar(lido!.eventos)}>
          {lido?.eventos.length ? `Acrescentar ${lido.eventos.length} ${lido.eventos.length === 1 ? 'evento' : 'eventos'}` : 'Acrescentar'}
        </button>
        <button className="botao" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Copia o processo inteiro como texto (para revisar, guardar ou pedir à IA que continue). */
export function CopiarComoTexto({ p }: { p: Processo }) {
  const [feito, setFeito] = useState<string | null>(null);
  return (
    <>
      <button
        className="botao pequeno"
        onClick={async () => setFeito((await copiar(processoParaTexto(p))) ? 'Processo copiado como texto. Cole no Word ou na IA ("continue com os próximos eventos").' : 'Este navegador não deixou copiar.')}
        title="Copia capa, partes, eventos e peças no formato de texto do Vide"
      >
        Copiar como texto
      </button>
      {feito && (
        <span className="ajuda" style={{ margin: 0 }}>
          {feito}
        </span>
      )}
    </>
  );
}
