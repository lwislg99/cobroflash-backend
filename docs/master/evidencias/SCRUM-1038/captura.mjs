// docs/master/evidencias/SCRUM-1038/captura.mjs — SCRUM-1038
//
// Captura a 390 px del botón «leer el ticket» en el modal de alta de gasto, en sus TRES estados
// (AC#5 del ticket). Banco HTML fuera del repo (temporal) que carga el CSS real (tokens.css +
// styles.css) y los ficheros REALES de la vista (api.js, modalHeader.js, expensesView.js),
// suplantando solo `fetch` — el mismo patrón que docs/capturas/scrum-296. Capturado con
// chrome-headless-shell (Playwright), un navegador de verdad: la foto es un `File` real y
// `FileReader` es el del navegador, sin dobles.
//
// Uso: node docs/master/evidencias/SCRUM-1038/captura.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const OUT = import.meta.dirname;
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1223',
  'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
if (!fs.existsSync(CHROME)) throw new Error(`no encuentro chrome-headless-shell en ${CHROME}`);

const tokensCss = fs.readFileSync(path.join(RAIZ, 'public/tokens.css'), 'utf8');
const stylesCss = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const apiJs = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/api.js'), 'utf8');
const modalHeaderJs = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/modalHeader.js'), 'utf8');
const expensesViewJs = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/expensesView.js'), 'utf8');

const PROVEEDOR = { id: 42, name: 'Leroy Merlin', taxId: 'A58818501' };
const PROPUESTA_COMPLETA = {
  concept: 'Tubería PVC 20mm', amount: 12.1, baseAmount: 10, vatRate: 21, vatAmount: 2.1,
  date: '2026-09-20', providerInvoiceDate: '2026-09-20', providerInvoiceNumber: 'A-2026/114',
  proveedorNombre: 'Leroy Merlin', nifProveedor: 'A58818501', providerId: 42,
};

/** El `fetch` de la página, según el estado que se está capturando. */
function fetchStub(estado) {
  const cuerpo = {
    'boton-visible': null,
    'lectura-completa': { ok: true, propuesta: PROPUESTA_COMPLETA, descartados: [] },
    tope: { ok: false, error: 'lecturas_agotadas' },
  }[estado];
  const status = estado === 'tope' ? 429 : 200;
  return `
    window.fetch = async (url, opts) => {
      const u = String(url);
      const mk = (body, ok, st) => ({ ok, status: st, headers: { get: () => 'application/json' },
        json: async () => body, blob: async () => ({}), text: async () => JSON.stringify(body) });
      if (/\\/admin\\/providers/.test(u)) return mk([${JSON.stringify(PROVEEDOR)}], true, 200);
      if (/\\/admin\\/jobs/.test(u)) return mk([], true, 200);
      if (/\\/admin\\/expenses\\/leer-ticket/.test(u)) return mk(${JSON.stringify(cuerpo)}, ${status === 200}, ${status});
      return mk({}, true, 200);
    };
  `;
}

function paginaPara(estado) {
  const hastaClic = estado === 'boton-visible' ? '' : `
    document.getElementById('exp-leer-ticket').click();
    await tick(30);
  `;
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>${tokensCss}</style>
<style>${stylesCss}</style>
<style>body{margin:0;background:var(--neutral-50, #f5f5f5)}</style>
</head>
<body>
<script>
window.appLocale = { currency: 'EUR' };
${fetchStub(estado)}
</script>
<script>${apiJs}</script>
<script>${modalHeaderJs}</script>
<script>${expensesViewJs}</script>
<script>
function tick(n) { return (async () => { for (let i=0;i<n;i++) await new Promise((r)=>setTimeout(r,10)); })(); }
(async () => {
  openExpenseModal(null);
  await tick(20);
  const fileInput = document.getElementById('exp-receipt');
  const dt = new DataTransfer();
  const bytes = new Uint8Array(64); for (let i=0;i<64;i++) bytes[i] = i;
  const file = new File([bytes], 'ticket.jpg', { type: 'image/jpeg' });
  dt.items.add(file);
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change'));
  await tick(5);
  ${hastaClic}
  document.title = 'READY';
})();
</script>
</body></html>`;
}

const dir = fs.mkdtempSync(path.join(process.env.TEMP || '.', 'captura-1038-'));
try {
  for (const estado of ['boton-visible', 'lectura-completa', 'tope']) {
    const html = path.join(dir, `${estado}.html`);
    const png = path.join(OUT, `expensesview-${estado}-390.png`);
    fs.writeFileSync(html, paginaPara(estado));
    const r = spawnSync(CHROME, [
      '--headless', '--hide-scrollbars', '--disable-gpu',
      '--virtual-time-budget=4000',
      `--screenshot=${png}`, '--window-size=390,1500',
      'file:///' + html.replace(/\\/g, '/'),
    ], { timeout: 30000 });
    if (r.status !== 0 || !fs.existsSync(png) || fs.statSync(png).size < 1000) {
      throw new Error(`no se generó ${png} (status ${r.status}): ${r.stderr}`);
    }
    console.log(`${estado}: ${png} (${fs.statSync(png).size} B)`);
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
