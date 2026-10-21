// Acervo: leis (importação do HTML salvo do Planalto ou .txt, revisão de
// duplicidades), lei principal da aula, materiais (PDFs), conferência de
// artigos e teste do detector.
import { useEffect, useMemo, useState } from 'react';
import { db, excluirDiploma, listarDiplomas, salvarDiploma } from '../dados/db';
import type { Diploma, Item } from '../dados/modelo';
import { agoraISO, novoId } from '../dados/modelo';
import {
  CATALOGO,
  abreviacaoDe,
  definirDiplomaPrincipal,
  diplomaPrincipal,
  normalizarApelido,
  siglaPara,
  todosDiplomas,
  type DefDiploma,
} from '../dados/diplomas';
import {
  chaveArtigo,
  dividirConstituicao,
  fatiar,
  formatarNumeroArtigo,
  resolverDuplicidades,
  type ArtigoFatiado,
  type ResultadoFatiador,
} from '../fatiador/fatiador';
import { lerArquivo } from '../fatiador/html';
import { chaveItemArtigo, resolver } from '../comum/legislacao';
import { Detector, chaveReferencia } from '../voz/detector';
import { Folha } from './Projecao';
import { Materiais } from './Materiais';

interface Parte {
  def: DefDiploma;
  tachados: number;
  resultado: ResultadoFatiador;
}

interface Previa {
  arquivo: string;
  partes: Parte[];
}

function montarItens(artigos: ArtigoFatiado[], def: DefDiploma, arquivo: string, url: string | null): Item[] {
  const agora = agoraISO();
  return artigos.map(({ linha: _linha, ...conteudo }) => ({
    id: novoId(),
    usuario_id: null,
    criado_em: agora,
    atualizado_em: agora,
    excluido_em: null,
    tipo: 'legislacao',
    chave: chaveItemArtigo(def.sigla, conteudo.artigo, conteudo.sufixo),
    titulo: `art. ${formatarNumeroArtigo(conteudo.artigo, conteudo.sufixo)} ${def.abreviacao}`,
    rotulo: null,
    gatilhos: [`${def.sigla}:${chaveArtigo(conteudo)}`],
    etiquetas: [],
    conteudo: { ...conteudo, diploma: def.sigla },
    origem: { arquivo, url, importado_em: agora },
  }));
}

const OUTRA = '__outra';

export function Acervo() {
  const [leis, setLeis] = useState<Diploma[]>([]);
  const [principal, setPrincipal] = useState(diplomaPrincipal());
  const [escolhida, setEscolhida] = useState('cpc');
  const [outra, setOutra] = useState({ abreviacao: '', nome: '', numero: '', apelidos: '' });
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Record<string, number>>>({});
  const [url, setUrl] = useState(CATALOGO[0].url ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [arquivoKey, setArquivoKey] = useState(0);

  const recarregar = async () => setLeis(await listarDiplomas());
  useEffect(() => {
    void recarregar();
  }, []);

  const catalogoImportavel = CATALOGO.filter((d) => !d.incluidoEm);
  const defEscolhida: DefDiploma | null = useMemo(() => {
    if (escolhida !== OUTRA) return CATALOGO.find((d) => d.sigla === escolhida) ?? null;
    const abreviacao = outra.abreviacao.trim();
    if (!abreviacao) return null;
    const numero = outra.numero.replace(/\D/g, '') || null;
    let sigla = siglaPara(abreviacao, numero);
    if (CATALOGO.some((c) => c.sigla === sigla)) sigla = `${sigla}x`;
    return {
      sigla,
      abreviacao,
      nome: outra.nome.trim() || abreviacao,
      apelidos: [abreviacao, ...outra.apelidos.split(',')].map(normalizarApelido).filter((a) => a.length > 1),
      numeroLei: numero,
      maxArtigo: 3000,
      url: url.trim() || null,
    };
  }, [escolhida, outra, url]);

  const mudarEscolhida = (sigla: string) => {
    setEscolhida(sigla);
    setPrevia(null);
    setArquivoKey((k) => k + 1);
    setUrl(CATALOGO.find((d) => d.sigla === sigla)?.url ?? '');
  };

  const aoEscolherArquivo = async (arquivo: File | undefined) => {
    setMsg(null);
    setPrevia(null);
    setEscolhas({});
    if (!arquivo) return;
    if (!defEscolhida) {
      setMsg('Preencha pelo menos a abreviação da lei antes de escolher o arquivo.');
      setArquivoKey((k) => k + 1);
      return;
    }
    const bytes = await arquivo.arrayBuffer();
    const { linhas, tachadosRemovidos } = lerArquivo(arquivo.name, bytes);
    const partes: Parte[] = [];
    if (defEscolhida.sigla === 'cf') {
      // A página da Constituição traz o ADCT no fim: vira uma "lei" separada.
      const { cf, adct } = dividirConstituicao(linhas);
      partes.push({ def: defEscolhida, tachados: tachadosRemovidos, resultado: fatiar(cf, 'cf') });
      const defAdct = CATALOGO.find((d) => d.sigla === 'adct')!;
      if (adct) partes.push({ def: defAdct, tachados: 0, resultado: fatiar(adct, 'adct') });
    } else {
      partes.push({ def: defEscolhida, tachados: tachadosRemovidos, resultado: fatiar(linhas, defEscolhida.sigla) });
    }
    setPrevia({ arquivo: arquivo.name, partes });
  };

  const finaisDe = (p: Parte) => resolverDuplicidades(p.resultado.artigos, escolhas[p.def.sigla] ?? {});

  const salvar = async () => {
    if (!previa) return;
    setSalvando(true);
    try {
      const resumo: string[] = [];
      for (const parte of previa.partes) {
        const def = parte.def;
        const itens = montarItens(finaisDe(parte), def, previa.arquivo, url.trim() || null);
        const agora = agoraISO();
        const d: Diploma = {
          id: novoId(),
          usuario_id: null,
          criado_em: agora,
          atualizado_em: agora,
          excluido_em: null,
          sigla: def.sigla,
          nome: def.nome,
          apelidos: def.apelidos,
          origem_url: def.incluidoEm ? null : url.trim() || null,
          versao_em: agora,
          total_artigos: itens.length,
          abreviacao: def.abreviacao,
          numero_lei: def.numeroLei,
          max_artigo: def.maxArtigo,
        };
        await salvarDiploma(d, itens);
        resumo.push(`${itens.length} artigos ${def.abreviacao === 'ADCT' ? 'do ADCT' : `de ${def.abreviacao}`}`);
      }
      window.dispatchEvent(new Event('vide-acervo-mudou'));
      setMsg(`Pronto! Guardados neste navegador: ${resumo.join(' e ')}.`);
      setPrevia(null);
      setArquivoKey((k) => k + 1);
      await recarregar();
    } catch (err) {
      setMsg(`Não foi possível salvar: ${String(err)}`);
    } finally {
      setSalvando(false);
    }
  };

  const jaGuardada = defEscolhida && leis.some((l) => l.sigla === defEscolhida.sigla);
  const opcoesPrincipal = leis.length ? leis : [];

  return (
    <div className="pagina">
      <h1>Acervo</h1>
      <p className="ajuda">
        O acervo fica guardado <strong>neste navegador, neste computador</strong>. A aula não precisa de internet para consultá-lo
        (só o reconhecimento de voz precisa).
      </p>

      <h2>Leis no acervo</h2>
      {leis.length === 0 ? (
        <p className="ajuda">Nenhuma lei guardada ainda. Importe abaixo.</p>
      ) : (
        <div className="cartao">
          <table className="tabela">
            <thead>
              <tr><th>Lei</th><th>Artigos</th><th>Versão importada em</th><th></th></tr>
            </thead>
            <tbody>
              {leis.map((l) => (
                <tr key={l.id}>
                  <td><strong>{abreviacaoDe(l.sigla)}</strong> <span className="ajuda">· {l.nome}</span></td>
                  <td>{l.total_artigos}</td>
                  <td>{new Date(l.versao_em).toLocaleString('pt-BR')}</td>
                  <td>
                    <button
                      className="botao pequeno"
                      onClick={async () => {
                        if (!confirm(`Apagar ${abreviacaoDe(l.sigla)} do acervo?`)) return;
                        await excluirDiploma(l.sigla);
                        window.dispatchEvent(new Event('vide-acervo-mudou'));
                        await recarregar();
                      }}
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="campo" style={{ maxWidth: 520, marginTop: 14 }}>
            <label htmlFor="principal">Lei principal da aula</label>
            <select
              id="principal"
              className="seletor"
              value={principal}
              onChange={(e) => {
                setPrincipal(e.target.value);
                definirDiplomaPrincipal(e.target.value);
              }}
            >
              {!opcoesPrincipal.some((l) => l.sigla === principal) && <option value={principal}>{abreviacaoDe(principal)}</option>}
              {opcoesPrincipal.map((l) => (
                <option key={l.sigla} value={l.sigla}>{abreviacaoDe(l.sigla)}</option>
              ))}
            </select>
            <span className="ajuda" style={{ margin: 0 }}>
              É a lei usada quando você não diz qual: "artigo 70" vira art. 70 {abreviacaoDe(principal)}. Quando você diz a lei
              ("artigo 5º da Constituição"), vale a lei dita.
            </span>
          </div>
        </div>
      )}

      <h2>Importar legislação</h2>
      <div className="cartao">
        <div className="campo" style={{ maxWidth: 520 }}>
          <label htmlFor="qual">1. Qual lei você vai importar?</label>
          <select id="qual" className="seletor" value={escolhida} onChange={(e) => mudarEscolhida(e.target.value)}>
            {catalogoImportavel.map((d) => (
              <option key={d.sigla} value={d.sigla}>
                {d.abreviacao} — {d.nome}
                {d.sigla === 'cf' ? ' (inclui o ADCT)' : ''}
              </option>
            ))}
            <option value={OUTRA}>Outra lei…</option>
          </select>
        </div>

        {escolhida === OUTRA && (
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="o-abrev">Abreviação (como aparece na tela)</label>
              <input id="o-abrev" placeholder="Lei 8.429/1992" value={outra.abreviacao} onChange={(e) => setOutra({ ...outra, abreviacao: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="o-nome">Nome</label>
              <input id="o-nome" placeholder="Lei de Improbidade Administrativa" value={outra.nome} onChange={(e) => setOutra({ ...outra, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="o-num">Número da lei (para reconhecer "Lei 8.429")</label>
              <input id="o-num" placeholder="8.429" value={outra.numero} onChange={(e) => setOutra({ ...outra, numero: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="o-ap">Como você chama essa lei na aula (separe por vírgula)</label>
              <input id="o-ap" placeholder="lei de improbidade, LIA" value={outra.apelidos} onChange={(e) => setOutra({ ...outra, apelidos: e.target.value })} />
            </div>
          </div>
        )}

        <p className="ajuda" style={{ marginBottom: 4 }}>
          <strong>2.</strong>{' '}
          {url ? (
            <>
              Abra a página da lei no Planalto:{' '}
              <a href={url} target="_blank" rel="noreferrer">{url.replace('https://www.', '')}</a>
            </>
          ) : (
            'Abra a página da lei no Planalto'
          )}{' '}
          e aperte <strong>Ctrl + S</strong> para salvar o arquivo.
        </p>
        <div className="campo">
          <label htmlFor="arquivo">3. Escolha o arquivo salvo (.htm, .html, .mhtml ou .txt)</label>
          <input
            key={arquivoKey}
            id="arquivo"
            type="file"
            accept=".htm,.html,.mht,.mhtml,.txt,text/html,text/plain"
            onChange={(ev) => void aoEscolherArquivo(ev.target.files?.[0])}
          />
        </div>
        <div className="campo">
          <label htmlFor="url">Endereço de origem (para a verificação de atualizações no futuro)</label>
          <input id="url" value={url} onChange={(ev) => setUrl(ev.target.value)} />
        </div>
        {jaGuardada && !previa && (
          <p className="ajuda">{defEscolhida!.abreviacao} já está no acervo: importar de novo substitui a versão guardada.</p>
        )}
      </div>

      {msg && <div className="aviso">{msg}</div>}

      {previa && (
        <>
          {previa.partes.map((parte) => {
            const finais = finaisDe(parte);
            const dupArtigos = parte.resultado.duplicidades.filter((d) => d.tipo === 'artigo');
            const dupDispositivos = parte.resultado.duplicidades.filter((d) => d.tipo === 'dispositivo');
            const esc = escolhas[parte.def.sigla] ?? {};
            return (
              <div key={parte.def.sigla}>
                <h2>
                  {parte.def.abreviacao} — resultado da leitura de "{previa.arquivo}"
                </h2>
                <div className="numeros">
                  <div><strong>{finais.length}</strong><span>artigos a guardar</span></div>
                  {parte.tachados > 0 && <div><strong>{parte.tachados}</strong><span>trechos tachados descartados</span></div>}
                  <div><strong>{dupArtigos.length}</strong><span>artigos duplicados</span></div>
                  <div><strong>{dupDispositivos.length}</strong><span>dispositivos duplicados</span></div>
                </div>
                {parte.resultado.avisos.map((a) => (
                  <div className="aviso" key={a}>{a}</div>
                ))}
                {parte.resultado.lacunas.length > 0 && (
                  <p className="ajuda">
                    Números de artigo ausentes na sequência (normalmente artigos revogados por inteiro):{' '}
                    <strong>{parte.resultado.lacunas.slice(0, 40).join(', ')}</strong>
                    {parte.resultado.lacunas.length > 40 && ` e mais ${parte.resultado.lacunas.length - 40}`}.
                  </p>
                )}
                {dupArtigos.length > 0 && (
                  <>
                    <h3>Artigos duplicados — escolha a versão</h3>
                    <p className="ajuda">
                      Isso acontece quando o arquivo traz a redação antiga e a nova. Por padrão fica a <strong>última</strong>{' '}
                      versão, que no Planalto é a vigente.
                    </p>
                    {dupArtigos.map((d) => (
                      <div className="cartao" key={d.artigoChave} style={{ marginBottom: 10 }}>
                        <strong>{d.onde}</strong>
                        {d.versoes.map((v, i) => (
                          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '6px 0' }}>
                            <input
                              type="radio"
                              name={`dup-${parte.def.sigla}-${d.artigoChave}`}
                              checked={(esc[d.artigoChave] ?? d.versoes.length - 1) === i}
                              onChange={() => setEscolhas({ ...escolhas, [parte.def.sigla]: { ...esc, [d.artigoChave]: i } })}
                            />
                            <span>Versão {i + 1}: {v}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </>
                )}
                {dupDispositivos.length > 0 && (
                  <details>
                    <summary className="ajuda">
                      {dupDispositivos.length} dispositivos repetidos dentro de um artigo (fica a última ocorrência) — ver
                    </summary>
                    <table className="tabela">
                      <tbody>
                        {dupDispositivos.map((d, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}><strong>{d.onde}</strong></td>
                            <td>{d.versoes.map((v, j) => <div key={j}>{j + 1}. {v}</div>)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            );
          })}

          <p style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button className="botao primario" onClick={() => void salvar()} disabled={salvando}>
              {jaGuardada ? `Substituir ${defEscolhida!.abreviacao} no acervo` : 'Guardar no acervo'}
            </button>
            <button className="botao" onClick={() => setPrevia(null)}>Cancelar</button>
          </p>
        </>
      )}

      <Materiais />
      <Conferir leis={leis} />
      <TestarDetector />
    </div>
  );
}

/** Mostra como um artigo ficou guardado (e como aparecerá na projeção). */
function Conferir({ leis }: { leis: Diploma[] }) {
  const [sigla, setSigla] = useState(diplomaPrincipal());
  const [entrada, setEntrada] = useState('1');
  const [item, setItem] = useState<Item | null | undefined>(undefined);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const m = /^(\d[\d.]*)(?:-?([a-z]))?$/i.exec(entrada.trim());
      if (!m) return setItem(undefined);
      const n = parseInt(m[1].replace(/\./g, ''), 10);
      const lista = await db.itens.where('chave').equals(chaveItemArtigo(sigla, n, m[2]?.toUpperCase() ?? '')).toArray();
      setItem(lista.find((i) => !i.excluido_em) ?? null);
    }, 200);
    return () => window.clearTimeout(t);
  }, [entrada, sigla]);

  const projetavel = useMemo(() => {
    if (!item) return null;
    const ref = {
      diploma: item.conteudo.diploma,
      art: item.conteudo.artigo,
      sufixo: item.conteudo.sufixo || undefined,
      explicito: false,
      contexto: false,
      inicio: 0,
      fim: 0,
      trecho: '',
    };
    return resolver(ref, new Map([[item.chave, item]]), 'previa')?.projetavel ?? null;
  }, [item]);

  if (!leis.length) return null;
  return (
    <>
      <h2>Conferir um artigo</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="campo" style={{ minWidth: 200 }}>
          <label htmlFor="conf-lei">Lei</label>
          <select id="conf-lei" className="seletor" value={sigla} onChange={(e) => setSigla(e.target.value)}>
            {leis.map((l) => (
              <option key={l.sigla} value={l.sigla}>{abreviacaoDe(l.sigla)}</option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ maxWidth: 200 }}>
          <label htmlFor="conf">Número do artigo</label>
          <input id="conf" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
        </div>
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
  const detector = useMemo(() => new Detector({ diplomas: todosDiplomas(), principal: diplomaPrincipal() }), []);
  const r = useMemo(() => new Detector({ diplomas: todosDiplomas(), principal: diplomaPrincipal() }).detectar(frase), [frase]);
  return (
    <>
      <h2>Testar o detector</h2>
      <p className="ajuda">Escreva uma frase do jeito que você falaria (ou como o reconhecedor transcreveria).</p>
      <div className="campo">
        <textarea rows={2} value={frase} onChange={(e) => setFrase(e.target.value)} aria-label="Frase" />
      </div>
      <p className="ajuda mono">normalizado: {detector.palavrasDe(frase).join(' ')}</p>
      {r.referencias.length === 0 && r.outros.length === 0 && <p className="ajuda">Nenhuma referência a dispositivo de lei encontrada.</p>}
      <ul className="lista-simples">
        {r.referencias.map((ref, i) => {
          const res = resolver(ref, indice, 't');
          return (
            <li key={i}>
              <strong>{res?.titulo ?? `art. ${ref.art}${ref.sufixo ? `-${ref.sufixo}` : ''} ${abreviacaoDe(ref.diploma)}`}</strong>{' '}
              <span className="mono">({chaveReferencia(ref)})</span>
              {!res && ' — não está no acervo'}
              {res?.aviso && ` — ⚠ ${res.aviso}`}
              {res && <div className="ajuda" style={{ margin: 0 }}>{res.texto}</div>}
            </li>
          );
        })}
        {r.outros.map((o, i) => (
          <li key={`o${i}`}>ignorado (lei fora do catálogo): <span className="mono">{o.trecho}</span></li>
        ))}
      </ul>
    </>
  );
}
