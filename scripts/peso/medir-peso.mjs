// Teste de "peso" do Vide: quanto o navegador baixa e como o app responde num computador lento.
// Roda o site em http://127.0.0.1:8790 (wrangler dev), com o processador desacelerado 4 vezes
// (imita um notebook de entrada), e compara com os limites de PESO.md.
// Uso: npm run peso   (faz o build, sobe o servidor local, mede e acrescenta o resultado em PESO.md)
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const RAIZ = new URL('../../', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:8790/';
const LENTO = 4;
const passo = (m) => process.stderr.write(`· ${m}\n`);

/** Limites: passou de algum, é hora de recomendar a divisão do programa em partes (ou outra melhoria). */
const LIMITES = {
  jsPrincipalKB: 400,
  abrirMs: 2000,
  digitarMs: 400,
  projetarMs: 400,
  paginaPesadaMs: 1500,
  buscaMs: 600,
  memoriaMB: 80,
  ociosoPct: 3,
};

function requirePlaywright() {
  const r = createRequire(import.meta.url);
  try {
    return r('playwright');
  } catch {
    return r(join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
}

// ---------- 1. O que o navegador baixa ----------
function tamanhos() {
  const pasta = join(RAIZ, 'dist/assets');
  const arqs = readdirSync(pasta);
  const gz = (f) => Math.round(gzipSync(readFileSync(join(pasta, f))).length / 1024);
  const principal = arqs.find((f) => /^index-.*\.js$/.test(f));
  const css = arqs.find((f) => /^index-.*\.css$/.test(f));
  const NOMES = [
    [/^pdf\.worker/, 'leitor de PDF (parte que roda à parte)'],
    [/^pdf-/, 'leitor de PDF'],
    [/^es-/, 'montador do PDF dos autos'],
  ];
  const sob = arqs
    .filter((f) => /\.m?js$/.test(f) && f !== principal)
    .map((f) => ({ f: NOMES.find(([re]) => re.test(f))?.[1] ?? f.replace(/-[\w-]+\.m?js$/, ''), kb: gz(f) }))
    .filter((x) => x.kb >= 2)
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 4);
  return { jsPrincipalKB: gz(principal), cssKB: gz(css), principalBrutoKB: Math.round(statSync(join(pasta, principal)).size / 1024), sobDemanda: sob };
}

// ---------- 2. Arquivos de exemplo (criados na hora) ----------
async function exemplos(pw, pasta) {
  // Lei do tamanho do CPC: 1.100 artigos com incisos e parágrafo.
  const partes = ['<html><head><title>L13105</title></head><body><p>LEI Nº 13.105, DE 16 DE MARÇO DE 2015.</p><p>Código de Processo Civil.</p>'];
  for (let n = 1; n <= 1100; n++) {
    const o = n < 10 ? 'º' : '';
    partes.push(`<p>Art. ${n}${o} O processo observará, neste artigo ${n}, as normas fundamentais e as garantias das partes, assegurada a paridade de tratamento.</p>`);
    for (const r of ['I', 'II', 'III']) partes.push(`<p>${r} - hipótese ${r} do artigo ${n}, descrita de forma suficientemente longa para ocupar uma linha inteira;</p>`);
    partes.push(`<p>Parágrafo único. O juiz observará o disposto no art. ${n}${o} sempre que couber.</p>`);
  }
  partes.push('</body></html>');
  const lei = join(pasta, 'L13105.htm');
  writeFileSync(lei, partes.join('\n'));
  // PDF de 8 páginas: as pares são "slides com foto" (imagem grande, que pesa para desenhar).
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.setContent('<canvas id="c" width="1920" height="1080"></canvas><script>const c=document.getElementById("c").getContext("2d");const d=c.createImageData(1920,1080);for(let i=0;i<d.data.length;i+=4){d.data[i]=Math.random()*255;d.data[i+1]=(i/4)%255;d.data[i+2]=Math.random()*255;d.data[i+3]=255}c.putImageData(d,0,0)</script>');
  const foto = await p.screenshot({ type: 'png' });
  await b.close();
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const img = await pdf.embedPng(foto);
  for (let i = 1; i <= 8; i++) {
    const pg = pdf.addPage([960, 540]);
    if (i % 2 === 0) pg.drawImage(img, { x: 0, y: 0, width: 960, height: 540 });
    else for (let l = 0; l < 12; l++) pg.drawText(`Slide ${i} · linha ${l + 1} da aula de processo civil`, { x: 40, y: 480 - l * 36, size: 22, font: fonte });
  }
  const slides = join(pasta, 'slides.pdf');
  writeFileSync(slides, await pdf.save());
  return { lei, slides };
}

// ---------- 3. O app num computador lento ----------
async function medirApp(pw, ex) {
  const b = await pw.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(String(e)));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: LENTO });
  await cdp.send('Performance.enable');
  const metrica = async (c, n) => (await c.send('Performance.getMetrics')).metrics.find((x) => x.name === n)?.value ?? 0;
  const r = {};
  let t = Date.now();
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForSelector('.inicio-hero');
  r.abrirMs = Date.now() - t;
  t = Date.now();
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.inicio-hero');
  r.reabrirMs = Date.now() - t;
  passo('abrir ok');
  // Lei
  await p.click('.botao-criar');
  await p.click('.menu-criar-op:has-text("Lei")');
  t = Date.now();
  await p.setInputFiles('#arquivo', ex.lei);
  await p.click('button:has-text("Guardar no acervo")');
  await p.waitForSelector('text=Ver legislação', { timeout: 240000 });
  r.importarLeiMs = Date.now() - t;
  passo('lei ok');
  // Material
  await p.click('.botao-criar');
  await p.click('.menu-criar-op:has-text("Material")');
  await p.setInputFiles('#material', [ex.slides]);
  await p.waitForSelector('button:has-text("Ver materiais")', { timeout: 120000 });
  passo('material ok');
  // Aula
  t = Date.now();
  await p.click('[href="#aula"]');
  await p.waitForSelector('.digitar-artigo input');
  r.abrirAulaMs = Date.now() - t;
  t = Date.now();
  await p.fill('.digitar-artigo input', '489');
  await p.keyboard.press('Enter');
  await p.waitForSelector('[data-candidato]');
  r.digitarMs = Date.now() - t;
  const [proj] = await Promise.all([ctx.waitForEvent('page'), p.click('.pilula:has-text("Abrir projeção")')]);
  await proj.waitForLoadState('load');
  await proj.waitForTimeout(1500);
  const cdp2 = await ctx.newCDPSession(proj);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: LENTO });
  t = Date.now();
  await p.click('[data-candidato]');
  await proj.waitForSelector('.projecao-titulo', { timeout: 20000 });
  r.projetarMs = Date.now() - t;
  passo('projeção ok');
  // Slides: página leve (1) e pesada (2)
  await p.click('.aula-faixa-material .botao-seletor');
  await p.locator('.popover-mat').getByText('slides', { exact: false }).first().click();
  const assinatura = () =>
    proj.evaluate(() => {
      const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (!c || !c.width) return '';
      const d = c.getContext('2d')?.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 4, 4).data;
      return d ? `${c.width}x${c.height}:${Array.from(d).join(',')}` : '';
    });
  const esperarMudar = async (antes) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const a = await assinatura();
      if (a && a !== antes) return Date.now() - t0;
      await proj.waitForTimeout(25);
    }
    return null;
  };
  r.primeiraPaginaMs = await esperarMudar('');
  await p.waitForTimeout(800);
  const antes = await assinatura();
  await p.mouse.move(5, 5);
  t = Date.now();
  await p.keyboard.press('PageDown');
  const mud = await esperarMudar(antes);
  r.paginaPesadaMs = mud === null ? null : Date.now() - t;
  await p.waitForTimeout(2000);
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  r.memoriaMB = +((await metrica(cdp, 'JSHeapUsedSize')) / 1e6).toFixed(1);
  const s0 = (await metrica(cdp, 'ScriptDuration')) + (await metrica(cdp2, 'ScriptDuration'));
  await p.waitForTimeout(10000);
  const s1 = (await metrica(cdp, 'ScriptDuration')) + (await metrica(cdp2, 'ScriptDuration'));
  r.ociosoPct = +(((s1 - s0) / 10) * 100).toFixed(1);
  await proj.close();
  await p.click('[href="#inicio"]');
  await p.waitForTimeout(500);
  t = Date.now();
  await p.keyboard.press('Control+k');
  await p.fill('.busca-campo input', 'garantias');
  await p.waitForSelector('.busca-item');
  r.buscaMs = Date.now() - t;
  r.erros = erros;
  await b.close();
  return r;
}

function servidor() {
  return new Promise((ok, falha) => {
    const s = spawn('npx', ['-y', 'wrangler', 'dev', '--port', '8790', '--ip', '127.0.0.1'], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
    const t = setTimeout(() => falha(new Error('o servidor local não subiu em 90 s')), 90000);
    const ver = (d) => {
      if (String(d).includes('Ready')) {
        clearTimeout(t);
        ok(s);
      }
    };
    s.stdout.on('data', ver);
    s.stderr.on('data', ver);
  });
}

const pw = requirePlaywright();
const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const tam = tamanhos();
const pasta = mkdtempSync(join(tmpdir(), 'vide-peso-'));
const ex = await exemplos(pw, pasta);
passo('exemplos criados');
const srv = await servidor();
passo('servidor no ar');
let app;
try {
  app = await medirApp(pw, ex);
} finally {
  srv.kill();
  try {
    execSync('pkill -f "[w]orkerd"');
  } catch {
    /* já parou */
  }
}

const linhas = [
  ['JS principal (gzip), baixado ao abrir', `${tam.jsPrincipalKB} KB`, `${LIMITES.jsPrincipalKB} KB`, tam.jsPrincipalKB <= LIMITES.jsPrincipalKB],
  ['Visual (CSS, gzip)', `${tam.cssKB} KB`, '—', true],
  ['Abrir o Vide (primeira vez)', `${app.abrirMs} ms`, `${LIMITES.abrirMs} ms`, app.abrirMs <= LIMITES.abrirMs],
  ['Abrir de novo (com cache)', `${app.reabrirMs} ms`, '—', true],
  ['Importar uma lei do tamanho do CPC', `${app.importarLeiMs} ms`, '—', true],
  ['Abrir a Aula', `${app.abrirAulaMs} ms`, '—', true],
  ['Digitar artigo até a alternativa', `${app.digitarMs} ms`, `${LIMITES.digitarMs} ms`, app.digitarMs <= LIMITES.digitarMs],
  ['Clicar e o artigo aparecer no projetor', `${app.projetarMs} ms`, `${LIMITES.projetarMs} ms`, app.projetarMs <= LIMITES.projetarMs],
  ['Primeira página do PDF no projetor', app.primeiraPaginaMs === null ? 'não apareceu' : `${app.primeiraPaginaMs} ms`, '—', app.primeiraPaginaMs !== null],
  ['Passar para um slide com foto grande', app.paginaPesadaMs === null ? 'não mudou' : `${app.paginaPesadaMs} ms`, `${LIMITES.paginaPesadaMs} ms`, app.paginaPesadaMs !== null && app.paginaPesadaMs <= LIMITES.paginaPesadaMs],
  ['Busca geral (Ctrl K)', `${app.buscaMs} ms`, `${LIMITES.buscaMs} ms`, app.buscaMs <= LIMITES.buscaMs],
  ['Memória (Aula + projeção + PDF)', `${app.memoriaMB} MB`, `${LIMITES.memoriaMB} MB`, app.memoriaMB <= LIMITES.memoriaMB],
  ['Processador com a aula parada', `${app.ociosoPct}%`, `${LIMITES.ociosoPct}%`, app.ociosoPct <= LIMITES.ociosoPct],
];
const passou = linhas.filter((l) => !l[3]);
const hoje = new Date().toISOString().slice(0, 10);
const md = [
  `### ${hoje} · versão ${pacote.version}`,
  '',
  `Processador ${LENTO} vezes mais lento (imita um notebook de entrada). Baixado só quando usado (gzip): ${tam.sobDemanda.map((s) => `${s.f} ${s.kb} KB`).join(', ')}.`,
  '',
  '| Medida | Resultado | Limite | |',
  '|---|---|---|---|',
  ...linhas.map(([n, v, l, ok]) => `| ${n} | ${v} | ${l} | ${ok ? 'ok' : '**passou do limite**'} |`),
  '',
  passou.length
    ? `**Veredito: pesado em ${passou.length} ${passou.length === 1 ? 'ponto' : 'pontos'}** (${passou.map((l) => l[0]).join('; ')}). Recomendar ao professor a melhoria (ex.: dividir o programa em partes).`
    : '**Veredito: leve.** Nenhum limite passou; não é preciso mexer.',
  app.erros.length ? `\nErros de página durante o teste: ${app.erros.join(' | ')}` : '',
  '',
].join('\n');
console.log(md);
if (!process.argv.includes('--sem-registro')) appendFileSync(join(RAIZ, 'PESO.md'), `\n${md}`);
