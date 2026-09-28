// tests/banco-scrum1220/medir-ajustes-modo-justificante.mjs — SCRUM-1220 · PASO 0
//
// ¿QUÉ SE PINTA DE VERDAD EN AJUSTES PARA UN PROFESIONAL ESPAÑOL CON LA EMISIÓN APAGADA?
//
// El encargo partía de una LECTURA (settingsView.js L39 y L44). Un rótulo dentro de un `if` que
// nadie cumple sería código muerto, no un defecto. Por eso esto EJECUTA, en dos tramos, y el
// segundo recibe lo que dio el primero — no un valor escrito a mano:
//
//   ① SERVIDOR · la app real (`dist/app.js`) con el doble de Prisma: `/admin/me` de un merchant
//      ES, no demo, con `INVOICING_ES_ENABLED` fuera. ¿Qué `modoEmision` devuelve?
//   ② NAVEGADOR · el dashboard cargado en el banco de vistas, `window.appModoEmision` = lo que
//      dijo ①, `renderSettingsView`, se pulsa cada pestaña y se lee el texto VISIBLE de su panel.
//
// Control positivo: el mismo tramo ② con `fiscal` tiene que pintar «Se emiten facturas». Si no
// lo pinta, el banco no ve la fila y su «no sale» no valdría nada.
//
// Uso:  node tests/banco-scrum1220/medir-ajustes-modo-justificante.mjs      (tras `npm run build`)
// Sale ≠ 0 si el instrumento se declara ciego.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAppReal, bancoDePrisma, sesionesDe } from '../_banco-camino-real.mjs';
import { cargarDashboard, pintarVista, todos } from '../_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
delete process.env.INVOICING_ES_ENABLED;

// ── ① SERVIDOR ──────────────────────────────────────────────────────────────────────────
const MERCHANT_ID = 4242; // ≠ 1: el demo (regla 8) daría `demo`, que es otra rama.
const merchantES = {
  id: MERCHANT_ID, name: 'Fontanería QA 1220', email: 'qa1220@test.local', country: 'ES',
  flags: null, iban: null, bizumPhone: null, whatsappPhone: '+34600000000',
  plan: 'pro', onboardingCompleted: true, isPlatformOwner: false,
};
const app = await montarAppReal();
const ses = sesionesDe(MERCHANT_ID, { id: 9, role: 'tecnico' });
bancoDePrisma().programar({
  authSession: ses.tabla,
  merchant: { findUnique: async () => merchantES, findFirst: async () => merchantES },
});
const me = await app.pedir('/admin/me', { token: ses.PROPIETARIO });
await app.cerrar();
console.log(`① /admin/me → HTTP ${me.status} · modoEmision=${JSON.stringify(me.json?.modoEmision)}`
  + ` · documentoSuelto=${JSON.stringify(me.json?.documentoSuelto)}`);
if (me.status !== 200 || !me.json) { console.error('CIEGO: /admin/me no contestó'); process.exit(2); }

// ── ② NAVEGADOR ─────────────────────────────────────────────────────────────────────────
async function pintarAjustes(modo) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/me\b/.test(String(url)) ? { ...me.json, ...merchantES, modoEmision: modo } : []),
  });
  banco.ctx.appModoEmision = modo;
  banco.ctx.appBizumSinTelefono = me.json.bizumSinTelefono ?? null;
  const r = await pintarVista(banco, 'renderSettingsView');
  if (r.error) { console.error(`CIEGO (${modo}): la vista revienta: ${r.error.message}`); process.exit(2); }
  const pestanas = todos(r.contenedor).filter((n) => n.dataset?.submenu && n.getAttribute?.('role') === 'tab');
  const porPestana = [];
  for (const p of pestanas) {
    p.click();
    await new Promise((res) => setImmediate(res));
    // Tras el clic la nav se repinta: se busca el panel visible, no el botón viejo.
    const panel = todos(r.contenedor).find((n) => n.className === 'settings-panel' && n.style.display === 'flex');
    porPestana.push({ rotulo: p.textContent, clave: p.dataset.submenu, textos: panel ? todos(panel).map((n) => String(n.textContent || '').trim()).filter(Boolean) : null });
  }
  return { porPestana, nodos: r.nodos, rechazos: r.rechazos };
}

const HALLAR = [
  'Se emiten justificantes de cobro',
  'Cada cobro genera un justificante',
  'Se emiten facturas',
  'IBAN (para pagos por transferencia',
  'Móvil de Bizum (para cobros por Bizum)',
  'Pagar por Bizum',
];

for (const modo of [me.json.modoEmision, 'fiscal']) {
  const { porPestana, nodos, rechazos } = await pintarAjustes(modo);
  console.log(`\n② modo=${modo} · ${nodos} nodos · ${porPestana.length} pestañas · rechazos=${rechazos.length}`);
  if (porPestana.length === 0) { console.error('CIEGO: cero pestañas'); process.exit(2); }
  for (const { rotulo, clave, textos } of porPestana) {
    if (!textos) { console.error(`CIEGO: la pestaña ${clave} no deja ningún panel visible`); process.exit(2); }
    const hallados = HALLAR.filter((h) => textos.some((t) => t.includes(h)));
    console.log(`  [${rotulo}] (${clave}) ${textos.length} textos · ${hallados.length ? hallados.map((h) => `«${h}»`).join(' ') : '—'}`);
    if (hallados.length) for (const t of textos.filter((x) => HALLAR.some((h) => x.includes(h)))) console.log(`      › ${t.replace(/\s+/g, ' ').slice(0, 220)}`);
  }
}
