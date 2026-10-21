// Acervo: importação do CPC (HTML salvo do Planalto ou .txt), revisão de
// duplicidades, conferência de artigos e teste do detector.
import { useEffect, useMemo, useState } from 'react';
import { db, diplomaAtivo, salvarDiploma } from '../dados/db';
import type { Diploma, Item } from '../dados/modelo';
import { agoraISO, novoId } from '../dados/modelo';
import {
  chaveArtigo,
  fatiar,
  formatarNumeroArtigo,
  resolverDuplicidades,
  type ArtigoFatiado,
  type ResultadoFatiador,
} from '../fatiador/fatiador';
import { lerArquivo } from '../fatiador/html';
import { chaveItemArtigo, resolver } from '../comum/legislacao';
import { Detector, chaveReferencia } from '../voz/detector';
import { normalizarFala } from '../voz/normalizar';
import { Folha } from './Projecao';

interface Previa {
  arquivo: string;
  tachados: number;
  resultado: ResultadoFatiador;
}

function montarItens(artigos: ArtigoFatiado[], arquivo: string, url: string | null): Item[] {
  const agora = agoraISO();
  return artigos.map(({ linha: _linha, ...conteudo }) => ({
    id: novoId(),
    usuario_id: null,
    criado_em: agora,
    atualizado_em: agora,
    excluido_em: null,
    tipo: 'legislacao',
    chave: chaveItemArtigo('cpc', conteudo.artigo, conteudo.sufixo),
    titulo: `art. ${formatarNumeroArtigo(conteudo.artigo, conteudo.sufixo)} CPC`,
    rotulo: null,
    gatilhos: [`cpc:${chaveArtigo(conteudo)}`],
    etiquetas: [],
    conteudo,
    origem: { arquivo, url, importado_em: agora },
  }));
}

export function Acervo() {
  const [diploma, setDiploma] = useState<Diploma | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, number>>({});
  const [url, setUrl] = useState('https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm');
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = async () => setDiploma((await diplomaAtivo('cpc')) ?? null);
  useEffect(() => {
    void recarregar();
  }, []);

  const aoEscolherArquivo = async (arquivo: File | undefined) => {
    setMsg(null);
    setPrevia(null);
    setEscolhas({});
    if (!arquivo) return;
    const bytes = await arquivo.arrayBuffer();
    const { linhas, tachadosRemovidos } = lerArquivo(arquivo.name, bytes);
    const resultado = fatiar(linhas, 'cpc');
    setPrevia({ arquivo: arquivo.name, tachados: tachadosRemovidos, resultado });
  };

  const dupArtigos = previa?.resultado.duplicidades.filter((d) => d.tipo === 'artigo') ?? [];
  const dupDispositivos = previa?.resultado.duplicidades.filter((d) => d.tipo === 'dispositivo') ?? [];
  const finais = useMemo(() => (previa ? resolverDuplicidades(previa.resultado.artigos, escolhas) : []), [previa, escolhas]);

  const salvar = async () => {
    if (!previa) return;
    setSalvando(true);
    try {
      const itens = montarItens(finais, previa.arquivo, url.trim() || null);
      const agora = agoraISO();
      const d: Diploma = {
        id: novoId(),
        usuario_id: null,
        criado_em: agora,
        atualizado_em: agora,
        excluido_em: null,
        sigla: 'cpc',
        nome: 'Código de Processo Civil (Lei nº 13.105/2015)',
        apelidos: ['cpc', 'código de processo civil', 'novo cpc'],
        origem_url: url.trim() || null,
        versao_em: agora,
        total_artigos: itens.length,
      };
      await salvarDiploma(d, itens);
      window.dispatchEvent(new Event('vide-acervo-mudou'));
      setMsg(`Pronto! ${itens.length} artigos do CPC foram guardados neste navegador.`);
      setPrevia(null);
      await recarregar();
    } catch (err) {
      setMsg(`Não foi possível salvar: ${String(err)}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="pagina">
      <h1>Acervo</h1>
      <p className="ajuda">
        O acervo fica guardado <strong>neste navegador, neste computador</strong>. A aula não precisa de internet para consultá-lo
        (só o reconhecimento de voz precisa).
      </p>

      <div className="cartao">
        <strong>CPC no acervo: </strong>
        {diploma ? (
          <>
            {diploma.total_artigos} artigos · versão importada em {new Date(diploma.versao_em).toLocaleString('pt-BR')}
            {diploma.origem_url && (
              <>
                {' '}· origem: <span className="mono">{diploma.origem_url}</span>
              </>
            )}
          </>
        ) : (
          <span>nenhum ainda.</span>
        )}
      </div>

      <h2>Importar o CPC</h2>
      <ol className="lista-simples ajuda">
        <li>
          Abra a página do CPC no Planalto:{' '}
          <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm" target="_blank" rel="noreferrer">
            planalto.gov.br/…/l13105.htm
          </a>
          .
        </li>
        <li>
          Aperte <strong>Ctrl + S</strong> e salve o arquivo (pode ser "Página da Web, completa" ou "somente HTML").
        </li>
        <li>Volte aqui, clique em "Escolher arquivo" e selecione o arquivo salvo. Também aceita .txt.</li>
      </ol>
      <div className="cartao">
        <div className="campo">
          <label htmlFor="arquivo">Arquivo (.htm, .html, .mhtml ou .txt)</label>
          <input id="arquivo" type="file" accept=".htm,.html,.mht,.mhtml,.txt,text/html,text/plain" onChange={(ev) => void aoEscolherArquivo(ev.target.files?.[0])} />
        </div>
        <div className="campo">
          <label htmlFor="url">Endereço de origem (opcional, para a verificação de atualizações no futuro)</label>
          <input id="url" value={url} onChange={(ev) => setUrl(ev.target.value)} />
        </div>
      </div>

      {msg && <div className="aviso">{msg}</div>}

      {previa && (
        <>
          <h2>Resultado da leitura de "{previa.arquivo}"</h2>
          <div className="numeros">
            <div><strong>{finais.length}</strong><span>artigos a guardar</span></div>
            <div><strong>{previa.tachados}</strong><span>trechos tachados descartados</span></div>
            <div><strong>{dupArtigos.length}</strong><span>artigos duplicados</span></div>
            <div><strong>{dupDispositivos.length}</strong><span>dispositivos duplicados</span></div>
          </div>
          {previa.resultado.avisos.map((a) => (
            <div className="aviso" key={a}>{a}</div>
          ))}
          {previa.resultado.lacunas.length > 0 && (
            <p className="ajuda">
              Números de artigo ausentes na sequência (normalmente artigos revogados por inteiro):{' '}
              <strong>{previa.resultado.lacunas.slice(0, 40).join(', ')}</strong>
              {previa.resultado.lacunas.length > 40 && ` e mais ${previa.resultado.lacunas.length - 40}`}.
            </p>
          )}

          {dupArtigos.length > 0 && (
            <>
              <h2>Artigos duplicados — escolha a versão</h2>
              <p className="ajuda">
                Isso acontece quando o arquivo traz a redação antiga e a nova (por exemplo, num .txt copiado do Planalto, onde o
                tachado se perde). Por padrão fica a <strong>última</strong> versão, que no Planalto é a vigente.
              </p>
              {dupArtigos.map((d) => (
                <div className="cartao" key={d.artigoChave} style={{ marginBottom: 10 }}>
                  <strong>{d.onde}</strong>
                  {d.versoes.map((v, i) => (
                    <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '6px 0' }}>
                      <input
                        type="radio"
                        name={`dup-${d.artigoChave}`}
                        checked={(escolhas[d.artigoChave] ?? d.versoes.length - 1) === i}
                        onChange={() => setEscolhas({ ...escolhas, [d.artigoChave]: i })}
                      />
                      <span>Versão {i + 1}: {v}</span>
                    </label>
                  ))}
                </div>
              ))}
            </>
          )}

          {dupDispositivos.length > 0 && (
            <>
              <h2>Dispositivos repetidos dentro de um artigo</h2>
              <p className="ajuda">Fica a última ocorrência de cada um. Confira se faz sentido:</p>
              <table className="tabela">
                <thead>
                  <tr><th>Onde</th><th>Versões encontradas</th></tr>
                </thead>
                <tbody>
                  {dupDispositivos.map((d, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}><strong>{d.onde}</strong></td>
                      <td>{d.versoes.map((v, j) => <div key={j}>{j + 1}. {v}</div>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button className="botao primario" onClick={() => void salvar()} disabled={salvando || finais.length === 0}>
              {diploma ? 'Substituir o CPC do acervo' : 'Guardar no acervo'}
            </button>
            <button className="botao" onClick={() => setPrevia(null)}>Cancelar</button>
          </p>
        </>
      )}

      <Conferir />
      <TestarDetector />
    </div>
  );
}

/** Mostra como um artigo ficou guardado (e como aparecerá na projeção). */
function Conferir() {
  const [entrada, setEntrada] = useState('485');
  const [item, setItem] = useState<Item | null | undefined>(undefined);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const m = /^(\d[\d.]*)(?:-([a-z]))?$/i.exec(entrada.trim());
      if (!m) return setItem(undefined);
      const n = parseInt(m[1].replace(/\./g, ''), 10);
      const lista = await db.itens.where('chave').equals(chaveItemArtigo('cpc', n, m[2]?.toUpperCase() ?? '')).toArray();
      setItem(lista.find((i) => !i.excluido_em) ?? null);
    }, 200);
    return () => window.clearTimeout(t);
  }, [entrada]);

  const projetavel = useMemo(() => {
    if (!item) return null;
    const ref = {
      diploma: 'cpc' as const, art: item.conteudo.artigo, explicito: false, contexto: false, inicio: 0, fim: 0, trecho: '',
    };
    return resolver(ref, new Map([[item.chave, item]]), 'previa')?.projetavel ?? null;
  }, [item]);

  return (
    <>
      <h2>Conferir um artigo</h2>
      <div className="campo" style={{ maxWidth: 240 }}>
        <label htmlFor="conf">Número do artigo</label>
        <input id="conf" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
      </div>
      {item === null && <p className="ajuda">Artigo não encontrado no acervo.</p>}
      {projetavel && (
        <div className="cartao" style={{ padding: 0, overflow: 'hidden', background: 'var(--fundo)' }}>
          <div className="projecao-faixa" />
          <Folha item={projetavel} fontSize="18px" />
          {item && item.conteudo.localizacao.length > 0 && (
            <p className="ajuda" style={{ padding: '0 24px 16px' }}>{item.conteudo.localizacao.join(' › ')}</p>
          )}
        </div>
      )}
    </>
  );
}

/** Digite uma frase e veja o que o detector entende. */
function TestarDetector() {
  const [frase, setFrase] = useState('o juiz extingue sem mérito no inciso sexto do 485 do CPC');
  const [indice, setIndice] = useState<Map<string, Item>>(new Map());
  useEffect(() => {
    void db.itens.toArray().then((l) => setIndice(new Map(l.filter((i) => !i.excluido_em).map((i) => [i.chave, i]))));
  }, []);
  const r = useMemo(() => new Detector().detectar(frase), [frase]);
  return (
    <>
      <h2>Testar o detector</h2>
      <p className="ajuda">Escreva uma frase do jeito que você falaria (ou como o reconhecedor transcreveria).</p>
      <div className="campo">
        <textarea rows={2} value={frase} onChange={(e) => setFrase(e.target.value)} aria-label="Frase" />
      </div>
      <p className="ajuda mono">normalizado: {normalizarFala(frase).join(' ')}</p>
      {r.referencias.length === 0 && r.outros.length === 0 && <p className="ajuda">Nenhuma referência ao CPC encontrada.</p>}
      <ul className="lista-simples">
        {r.referencias.map((ref, i) => {
          const res = resolver(ref, indice, 't');
          return (
            <li key={i}>
              <strong>{res?.titulo ?? `art. ${ref.art} CPC`}</strong>{' '}
              <span className="mono">({chaveReferencia(ref)})</span>
              {!res && ' — não está no acervo'}
              {res?.aviso && ` — ⚠ ${res.aviso}`}
              {res && <div className="ajuda" style={{ margin: 0 }}>{res.texto}</div>}
            </li>
          );
        })}
        {r.outros.map((o, i) => (
          <li key={`o${i}`}>ignorado (outro diploma): <span className="mono">{o.trecho}</span></li>
        ))}
      </ul>
    </>
  );
}
