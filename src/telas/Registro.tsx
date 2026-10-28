// Registro de teste: lista as sessões e exporta em .txt e .csv.
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
  useEffect(() => {
    void recarregar();
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
    <div className="pagina">
      <h1>Registro de teste</h1>
      <p className="ajuda">
        Tudo o que acontece no modo aula fica anotado com horário: a transcrição, as referências detectadas, o que foi projetado
        e recolhido, os comandos de voz e as quedas do reconhecimento. Cada aula vira uma <strong>sessão</strong> (uma nova
        começa sozinha depois de 3 horas sem uso). O botão abaixo começa uma sessão nova na hora e limpa a tela da aula
        (transcrição, candidatos e referências); as sessões anteriores continuam guardadas aqui.
      </p>
      <p className="ajuda">
        <strong>Material de revisão:</strong> em cada aula, <strong>Copiar pacote para o Claude</strong> junta a transcrição e o
        texto integral dos dispositivos que você projetou (as alternativas que não foram projetadas ficam de fora). Cole no
        claude.ai e peça o que quiser: resumo, questões, esquema…
      </p>
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

      {sessoes.length === 0 && <p className="ajuda">Nenhum registro ainda.</p>}
      {sessoes.map((s) => {
        const c = s.contagem;
        return (
          <div className="cartao" key={s.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>
                {new Date(s.inicio).toLocaleString('pt-BR')} → {new Date(s.fim).toLocaleTimeString('pt-BR')}
              </strong>
              {s.id === atual && <span className="etiqueta">sessão atual</span>}
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
                  if (!confirm('Apagar esta sessão do registro? Não dá para desfazer.')) return;
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
