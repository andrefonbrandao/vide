// A "casca" do app: barra lateral com as seções, topo com a busca e o "+ Criar",
// o modelo de página (caminho, título, descrição e ações) e a página de Ajustes.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CamadaAvisos } from '../comum/avisos';
import {
  IcAjustes,
  IcBusca,
  IcCasos,
  IcInicio,
  IcLei,
  IcLink,
  IcMais,
  IcPasta,
  IcPerguntas,
  IcProcesso,
  IcProjecao,
  IcRegistro,
  IcResultados,
} from '../comum/Icones';
import { Logo } from '../comum/Logo';
import { acaoDaNavegacao, irPara, useRota, type Acao, type Rota } from '../comum/navegacao';
import { SecaoLeis, SecaoTestes } from './Acervo';
import { Aula } from './Aula';
import { Busca } from './Busca';
import { Casos } from './Casos';
import { Inicio } from './Inicio';
import { LinksTurma } from './LinksTurma';
import { AdicionarMaterial, ListaMateriais } from './Materiais';
import { BotaoDrive } from './PainelDrive';
import { Processos } from './Processos';
import { AdicionarQuestoes, ListaQuestoes } from './Questoes';
import { Registro } from './Registro';
import { Pagina } from './Pagina';

interface ItemMenu {
  rota: Rota;
  rotulo: string;
  icone: ReactNode;
}

const GRUPOS: { titulo: string | null; itens: ItemMenu[] }[] = [
  {
    titulo: null,
    itens: [
      { rota: 'inicio', rotulo: 'Início', icone: <IcInicio /> },
      { rota: 'aula', rotulo: 'Aula', icone: <IcProjecao /> },
    ],
  },
  {
    titulo: 'Biblioteca',
    itens: [
      { rota: 'leis', rotulo: 'Leis', icone: <IcLei /> },
      { rota: 'materiais', rotulo: 'Materiais', icone: <IcPasta /> },
    ],
  },
  {
    titulo: 'Atividades',
    itens: [
      { rota: 'questoes', rotulo: 'Questões', icone: <IcPerguntas /> },
      { rota: 'casos', rotulo: 'Casos', icone: <IcCasos /> },
      { rota: 'processos', rotulo: 'Processos', icone: <IcProcesso /> },
      { rota: 'links', rotulo: 'Links da turma', icone: <IcLink /> },
    ],
  },
  {
    titulo: 'Turma',
    itens: [
      { rota: 'resultados', rotulo: 'Resultados', icone: <IcResultados /> },
      { rota: 'registro', rotulo: 'Registro das aulas', icone: <IcRegistro /> },
    ],
  },
];

/** Itens do "+ Criar". */
const CRIAR: { rota: Rota; acao: Acao; rotulo: string; desc: string; icone: ReactNode; cor: string }[] = [
  { rota: 'questoes', acao: 'novas-questoes', rotulo: 'Questões', desc: 'escrever, colar ou pedir à IA', icone: <IcPerguntas />, cor: '#dfe9e3' },
  { rota: 'casos', acao: 'novo-caso', rotulo: 'Caso', desc: 'para o jogo Consulta', icone: <IcCasos />, cor: '#e8e2ee' },
  { rota: 'processos', acao: 'novo-processo', rotulo: 'Processo', desc: 'em branco ou colado em texto', icone: <IcProcesso />, cor: '#e3e8ee' },
  { rota: 'questoes', acao: 'novo-treino', rotulo: 'Treino em casa', desc: 'link e QR para a turma', icone: <IcLink />, cor: '#fbe3dc' },
  { rota: 'materiais', acao: 'novo-material', rotulo: 'Material', desc: 'PDF ou imagem', icone: <IcPasta />, cor: '#efe9d9' },
  { rota: 'leis', acao: 'nova-lei', rotulo: 'Lei', desc: 'importar do Planalto', icone: <IcLei />, cor: '#e4ebe6' },
];

function MenuCriar({ aoFechar }: { aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && aoFechar();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [aoFechar]);
  return (
    <div ref={ref} className="menu-criar" role="menu" aria-label="Criar">
      {CRIAR.map((c) => (
        <button
          key={c.acao}
          type="button"
          role="menuitem"
          className="menu-criar-op"
          onClick={() => {
            aoFechar();
            irPara(c.rota, c.acao);
          }}
        >
          <span className="menu-criar-ic" style={{ background: c.cor }}>
            {c.icone}
          </span>
          <span>
            <strong>{c.rotulo}</strong>
            <span>{c.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function BotaoAcao({ children, onClick, principal = false }: { children: ReactNode; onClick: () => void; principal?: boolean }) {
  return (
    <button className={`botao com-icone${principal ? ' escuro' : ''}`} onClick={onClick}>
      {principal && <IcMais tamanho={18} />}
      {children}
    </button>
  );
}

function PaginaLeis({ acao }: { acao: Acao | null }) {
  const [importando, setImportando] = useState(acao === 'nova-lei');
  return (
    <Pagina
      caminho="Biblioteca"
      titulo="Leis"
      descricao="As leis do acervo, para projetar e citar na aula. Ficam neste computador e no seu Google Drive."
      acoes={!importando && <BotaoAcao principal onClick={() => setImportando(true)}>Importar lei</BotaoAcao>}
    >
      <SecaoLeis importando={importando} setImportando={setImportando} />
    </Pagina>
  );
}

function PaginaMateriais({ acao }: { acao: Acao | null }) {
  const [adicionando, setAdicionando] = useState(acao === 'novo-material');
  return (
    <Pagina
      caminho="Biblioteca"
      titulo="Materiais"
      descricao="Slides e PDFs para projetar na aula."
      acoes={!adicionando && <BotaoAcao principal onClick={() => setAdicionando(true)}>Adicionar material</BotaoAcao>}
    >
      {adicionando ? <AdicionarMaterial aoVer={() => setAdicionando(false)} /> : <ListaMateriais aoAdicionar={() => setAdicionando(true)} />}
    </Pagina>
  );
}

function PaginaQuestoes({ acao }: { acao: Acao | null }) {
  const [adicionando, setAdicionando] = useState(acao === 'novas-questoes');
  useState(() => {
    if (acao === 'novo-treino') {
      try {
        sessionStorage.setItem('vide.secaoQuestoes', 'treinos');
        sessionStorage.setItem('vide.criarTreino', '1');
      } catch {
        /* ignore */
      }
    }
  });
  return (
    <Pagina
      caminho="Atividades"
      titulo="Questões"
      descricao="Questões e questionários para os jogos em sala e os treinos em casa."
      acoes={!adicionando && <BotaoAcao principal onClick={() => setAdicionando(true)}>Adicionar questões</BotaoAcao>}
    >
      {adicionando ? <AdicionarQuestoes aoVer={() => setAdicionando(false)} /> : <ListaQuestoes aoAdicionar={() => setAdicionando(true)} />}
    </Pagina>
  );
}

function PaginaCasos({ acao }: { acao: Acao | null }) {
  const [chave, setChave] = useState(0);
  const abrirAdicionar = () => {
    try {
      sessionStorage.setItem('vide.secaoCasos', 'adicionar');
    } catch {
      /* ignore */
    }
    setChave((n) => n + 1);
  };
  // "+ Criar › Caso": a seção de casos já abre em "Adicionar casos".
  useState(() => {
    if (acao !== 'novo-caso') return;
    try {
      sessionStorage.setItem('vide.secaoCasos', 'adicionar');
    } catch {
      /* ignore */
    }
  });
  return (
    <Pagina caminho="Atividades" titulo="Casos" descricao="Casos com personagens para o jogo Consulta e para o treino em casa." acoes={<BotaoAcao principal onClick={abrirAdicionar}>Adicionar casos</BotaoAcao>}>
      <Casos key={chave} />
    </Pagina>
  );
}

function PaginaProcessos({ acao }: { acao: Acao | null }) {
  const [pedido, setPedido] = useState<{ acao: Acao | null; n: number }>({ acao, n: 0 });
  return (
    <Pagina
      caminho="Atividades"
      titulo="Processos da turma"
      descricao="Processos fictícios que a turma acompanha ao longo do semestre."
      acoes={
        <>
          <BotaoAcao onClick={() => setPedido((p) => ({ acao: 'colar-processo', n: p.n + 1 }))}>Colar processo</BotaoAcao>
          <BotaoAcao principal onClick={() => setPedido((p) => ({ acao: 'novo-processo', n: p.n + 1 }))}>
            Novo processo
          </BotaoAcao>
        </>
      }
    >
      <Processos key={pedido.n} acao={pedido.acao} />
    </Pagina>
  );
}

function Ajustes() {
  return (
    <Pagina titulo="Ajustes" descricao="Google Drive, conferência das leis e informações do app.">
      <section className="cartao ajustes-bloco">
        <h2>Google Drive</h2>
        <p className="ajuda">Guarda e sincroniza o acervo (leis, materiais, questões, casos, processos e registros das aulas) numa pasta "Vide" do seu Drive.</p>
        <div>
          <BotaoDrive />
        </div>
      </section>
      <section className="cartao ajustes-bloco">
        <h2>Lei principal da aula</h2>
        <p className="ajuda">É a lei usada quando você cita um artigo sem dizer qual ("artigo 70"). Escolha em Biblioteca › Leis.</p>
        <div>
          <button className="botao" onClick={() => irPara('leis')}>
            Ir para Leis
          </button>
        </div>
      </section>
      <section className="ajustes-bloco">
        <h2>Conferência e testes</h2>
        <SecaoTestes />
      </section>
      <p className="ajuda">Vide · versão {__VERSAO__.replace(/\.0$/, '')} (protótipo de teste)</p>
    </Pagina>
  );
}

function BarraLateral({ rota, recolhida }: { rota: Rota; recolhida: boolean }) {
  return (
    <aside className={`lateral${recolhida ? ' recolhida' : ''}`} aria-label="Seções do Vide" data-ui>
      <button className="lateral-logo" onClick={() => irPara('inicio')} aria-label="Início">
        <Logo altura={recolhida ? 30 : 28} soSimbolo={recolhida} />
      </button>
      <nav className="lateral-nav">
        {GRUPOS.map((g, i) => (
          <div key={i} className="lateral-grupo">
            {g.titulo && !recolhida && <div className="lateral-titulo">{g.titulo}</div>}
            {recolhida && i > 0 && <div className="lateral-separador" />}
            {g.itens.map((it) => (
              <a
                key={it.rota}
                href={`#${it.rota}`}
                className="lateral-item"
                aria-current={rota === it.rota ? 'page' : undefined}
                title={recolhida ? it.rotulo : undefined}
                onClick={(e) => {
                  // Clicar na página em que já está: volta ao começo dela.
                  e.preventDefault();
                  irPara(it.rota);
                }}
              >
                {it.icone}
                {!recolhida && <span>{it.rotulo}</span>}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="lateral-rodape">
        <a href="#ajustes" className="lateral-item" aria-current={rota === 'ajustes' ? 'page' : undefined} title={recolhida ? 'Ajustes' : undefined}>
          <IcAjustes />
          {!recolhida && <span>Ajustes</span>}
        </a>
        {!recolhida && (
          <div className="lateral-drive">
            <BotaoDrive />
          </div>
        )}
      </div>
    </aside>
  );
}

/** Barra de baixo no celular. */
function BarraCelular({ rota }: { rota: Rota }) {
  const itens: [Rota, string, ReactNode, Rota[]][] = [
    ['inicio', 'Início', <IcInicio key="i" />, ['inicio']],
    ['aula', 'Aula', <IcProjecao key="a" />, ['aula']],
    ['materiais', 'Biblioteca', <IcPasta key="b" />, ['leis', 'materiais']],
    ['questoes', 'Atividades', <IcPerguntas key="q" />, ['questoes', 'casos', 'processos', 'links']],
    ['registro', 'Turma', <IcRegistro key="t" />, ['resultados', 'registro']],
  ];
  return (
    <nav className="barra-celular" aria-label="Seções" data-ui>
      {itens.map(([r, rot, ic, grupo]) => (
        <a key={r} href={`#${r}`} aria-current={grupo.includes(rota) ? 'page' : undefined}>
          {ic}
          <span>{rot}</span>
        </a>
      ))}
    </nav>
  );
}

export function Casca() {
  const { rota, versao } = useRota();
  const [criar, setCriar] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const naAula = rota === 'aula';

  // Ctrl + K (ou ⌘ K) abre a busca de qualquer lugar.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscando(true);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const chave = `${rota}:${versao}`;
  const a = acaoDaNavegacao(versao);
  return (
    <div className={`casca${naAula ? ' na-aula' : ''}`}>
      <BarraLateral rota={rota} recolhida={naAula} />
      <div className="casca-principal">
        {!naAula && (
          <header className="casca-topo" data-ui>
            <button className="busca-gatilho" onClick={() => setBuscando(true)}>
              <IcBusca tamanho={18} />
              <span>Buscar artigo, material, questão, caso, processo…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="espaco" />
            <div className="criar-caixa">
              <button className="botao-criar" onClick={() => setCriar(!criar)} aria-expanded={criar}>
                <IcMais tamanho={18} /> Criar
              </button>
              {criar && <MenuCriar aoFechar={() => setCriar(false)} />}
            </div>
          </header>
        )}
        <main className={`casca-conteudo${naAula ? ' aula-conteudo' : ''}`}>
          {/* A aula continua montada (e ouvindo) mesmo em outra página. */}
          <div style={{ display: naAula ? 'block' : 'none', height: '100%' }}>
            <Aula ativa={naAula} />
          </div>
          {rota === 'inicio' && <Inicio key={chave} />}
          {rota === 'leis' && <PaginaLeis key={chave} acao={a} />}
          {rota === 'materiais' && <PaginaMateriais key={chave} acao={a} />}
          {rota === 'questoes' && <PaginaQuestoes key={chave} acao={a} />}
          {rota === 'casos' && <PaginaCasos key={chave} acao={a} />}
          {rota === 'processos' && <PaginaProcessos key={chave} acao={a} />}
          {rota === 'links' && <LinksTurma key={chave} />}
          {rota === 'resultados' && (
            <Pagina key={chave} caminho="Turma" titulo="Resultados" descricao="Os números de cada jogo, sem nomes de alunos.">
              <ListaQuestoes aoAdicionar={() => irPara('questoes', 'novas-questoes')} secaoFixa="resultados" />
            </Pagina>
          )}
          {rota === 'registro' && (
            <Pagina key={chave} caminho="Turma" titulo="Registro das aulas" descricao="Cada aula vira uma sessão, com a transcrição e o que foi projetado.">
              <Registro />
            </Pagina>
          )}
          {rota === 'ajustes' && <Ajustes key={chave} />}
        </main>
      </div>
      {!naAula && <BarraCelular rota={rota} />}
      {buscando && <Busca aoFechar={() => setBuscando(false)} />}
      <CamadaAvisos />
    </div>
  );
}
