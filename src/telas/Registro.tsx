// Registro de teste: lista as sessões e exporta em .txt e .csv.
import { SemVinculo } from './FaixaTurma';
import { useTurmas } from './Turmas';
import { rotuloTurma } from '../turmas/banco';
import { confirmar } from '../comum/avisos';
import { Figura } from './ConsultaTela';
import { useEffect, useState } from 'react';
import type { EventoRegistro } from '../dados/modelo';
import { controlador } from './controlador';
import {
  apagarSessao,
  baixar,
  eventosDaSessao,
  exportarCsv,
  exportarTxt,
  listarSessoes,
  nomeArquivo,
  sessaoAtual,
  type ResumoSessao,
} from '../comum/registro';
import { montarPacote, nomeArquivoPacote } from '../comum/pacote';
import { carregarIndice } from '../dados/db';
import { abreviacaoDe, todosDiplomas } from '../dados/diplomas';

/** "CPC — Código de Processo Civil (Lei 13.105/2015)". */
function nomeDaLei(sigla: string): string {
  const d = todosDiplomas().find((x) => x.sigla === sigla);
  return d && d.nome && d.nome !== d.abreviacao ? `${d.abreviacao} — ${d.nome}` : abreviacaoDe(sigla);
}

async function pacoteDa(s: ResumoSessao): Promise<string> {
  const [ev, indice] = await Promise.all([eventosDaSessao(s.id), carregarIndice()]);
  return montarPacote(ev, indice, nomeDaLei);
}

export function Registro() {
  const [sessoes, setSessoes] = useState<ResumoSessao[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [eventos, setEventos] = useState<EventoRegistro[]>([]);
  const [atual, setAtual] = useState(sessaoAtual());
  const [avisoPacote, setAvisoPacote] = useState<{ id: string; texto: string } | null>(null);

  const copiarPacote = async (s: ResumoSessao) => {
    const texto = await pacoteDa(s);
    try {
      await navigator.clipboard.writeText(texto);
      setAvisoPacote({ id: s.id, texto: 'Pacote copiado. No claude.ai, cole (Ctrl + V) e escreva o que você quer com ele.' });
    } catch {
      baixar(nomeArquivoPacote(s.inicio), texto, 'text/plain');
      setAvisoPacote({ id: s.id, texto: 'Não foi possível copiar; o pacote foi baixado como arquivo. Anexe-o no claude.ai.' });
    }
  };

  const recarregar = async () => setSessoes(await listarSessoes());
  const { disciplinas, turmas } = useTurmas();
  const rotulos = new Map(turmas.map((t) => { const d = disciplinas.find((x) => x.id === t.disciplinaId); return [t.id, { rotulo: rotuloTurma(d, t), cor: d?.cor ?? '#1e3a34' }]; }));
  useEffect(() => {
    void recarregar();
    // Aulas que chegaram de outro computador (Google Drive).
    const r = () => void recarregar();
    window.addEventListener('vide-registro-mudou', r);
    return () => window.removeEventListener('vide-registro-mudou', r);
  }, []);
  useEffect(() => {
    if (aberta) void eventosDaSessao(aberta).then(setEventos);
  }, [aberta]);

  const exportar = async (s: ResumoSessao, tipo: 'txt' | 'csv') => {
    const ev = await eventosDaSessao(s.id);
    if (tipo === 'txt') baixar(nomeArquivo(s.inicio, 'txt'), exportarTxt(ev), 'text/plain');
    else baixar(nomeArquivo(s.inicio, 'csv'), exportarCsv(ev), 'text/csv');
  };

  return (
    <div>
      <details className="ajuda-dobravel">
        <summary>Como funciona o registro</summary>
        <p className="ajuda">
          Tudo o que acontece na aula fica anotado com horário: a transcrição, as referências detectadas, o que foi projetado e
          recolhido e os comandos de voz. Cada aula vira uma <strong>sessão</strong> (uma nova começa sozinha depois de 3 horas sem
          uso). <strong>Copiar pacote para o Claude</strong> junta a transcrição e o texto integral dos dispositivos projetados:
          cole no claude.ai e peça um resumo, questões, um esquema…
        </p>
      </details>
      <p>
        <button
          className="botao"
          onClick={async () => {
            await controlador().novaSessao();
            setAtual(sessaoAtual());
            await recarregar();
          }}
        >
          Começar uma nova sessão agora
        </button>
      </p>

      {sessoes.length === 0 && (
        <div className="vazio-guia">
          <Figura id="h6" expressao="neutro" className="vazio-guia-figura" />
          <div>
            <h2>Nenhuma aula registrada ainda</h2>
            <p className="ajuda">Quando você der uma aula no Vide, ela aparece aqui: o que foi dito, o que foi projetado e as marcas de "Registrar momento".</p>
          </div>
        </div>
      )}
      {sessoes.map((s) => {
        const c = s.contagem;
        return (
          <div className="cartao" key={s.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>
                {new Date(s.inicio).toLocaleString('pt-BR')} → {new Date(s.fim).toLocaleTimeString('pt-BR')}
              </strong>
              {s.id === atual && <span className="etiqueta">sessão atual</span>}
              {s.turmaId && rotulos.get(s.turmaId) && <span className="selo-disciplina" style={{ ['--cor' as string]: rotulos.get(s.turmaId)!.cor }}>{rotulos.get(s.turmaId)!.rotulo}</span>}
              <SemVinculo item={s} tipo="turma" />
              <span className="espaco" />
              <button className="botao pequeno escuro" onClick={() => void copiarPacote(s)} title="Transcrição + texto integral dos dispositivos projetados">
                Copiar pacote para o Claude
              </button>
              <button
                className="botao pequeno"
                onClick={async () => {
                  baixar(nomeArquivoPacote(s.inicio), await pacoteDa(s), 'text/plain');
                  setAvisoPacote({ id: s.id, texto: 'Pacote baixado (pasta Downloads). No claude.ai, anexe o arquivo e escreva o que você quer com ele.' });
                }}
              >
                Baixar pacote
              </button>
              <button className="botao pequeno" onClick={() => void exportar(s, 'txt')}>Exportar .txt</button>
              <button className="botao pequeno" onClick={() => void exportar(s, 'csv')}>Exportar .csv (Excel)</button>
              <button className="botao pequeno" onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                {aberta === s.id ? 'Fechar' : 'Ver'}
              </button>
              <button
                className="botao pequeno"
                onClick={async () => {
                  if (!(await confirmar({ titulo: 'Apagar esta sessão do registro?', texto: 'Não dá para desfazer.', botao: 'Apagar', perigo: true }))) return;
                  await apagarSessao(s.id);
                  if (aberta === s.id) setAberta(null);
                  void recarregar();
                }}
              >
                Apagar
              </button>
            </div>
            {avisoPacote?.id === s.id && (
              <p className="aviso-pacote" onClick={() => setAvisoPacote(null)}>
                {avisoPacote.texto}
              </p>
            )}
            <div className="numeros">
              <div><strong>{c.fala ?? 0}</strong><span>trechos de fala</span></div>
              <div><strong>{c.detectado ?? 0}</strong><span>referências detectadas</span></div>
              <div><strong>{c.projetado ?? 0}</strong><span>projeções</span></div>
              <div><strong>{c.comando_voz ?? 0}</strong><span>comandos de voz</span></div>
              <div><strong>{c.marcacao ?? 0}</strong><span>marcações</span></div>
              <div><strong>{c.nao_encontrado ?? 0}</strong><span>fora do acervo</span></div>
              <div><strong>{(c.voz ?? 0)}</strong><span>eventos da voz (quedas etc.)</span></div>
            </div>
            {aberta === s.id && (
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto', background: '#fff', padding: 12, borderRadius: 10 }}>
                {exportarTxt(eventos)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
