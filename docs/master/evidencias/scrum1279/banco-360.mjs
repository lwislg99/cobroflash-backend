// Banco de medida SCRUM-1279: vuelca la landing REAL (dist) con 5 cláusulas largas a un HTML con
// una sonda que mide en el navegador. Se ejecuta desde el worktree: node <este> <worktree> <salida>
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [wt, salida] = process.argv.slice(2);
const doblado = await import(pathToFileURL(path.join(wt, 'tests', '_envio-doblado.mjs')).href);
const TOKEN = 'e'.repeat(32);
const largo = (n) => `Cláusula ${n}: ` + 'El profesional responde de los defectos de ejecución durante el plazo indicado, siempre que la instalación no haya sido manipulada por terceros ni usada fuera de las condiciones normales. '.repeat(3);
const q = {
  id: 1279, merchantId: doblado.MERCHANT, customerId: doblado.CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
  lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1279, revision: 0, decisionToken: TOKEN,
  validUntil: new Date(Date.now() + 864e6), paymentTerms: 'FULL_UPFRONT', tiers: null, discountGlobalAmount: null,
  docHeaderText: 'Visita del 3 de octubre.', docFooterText: 'Precio válido con el acceso libre.', clausulasExcluidas: null,
  createdAt: new Date(), updatedAt: new Date(),
  merchant: { id: doblado.MERCHANT, name: 'Fontanería 1279', country: 'ES', timezone: 'Europe/Madrid', whatsappPhone: '34000001279',
    clausulasPresupuesto: [1, 2, 3, 4, 5].map((n) => ({ id: 'c' + n, titulo: 'Condición número ' + n, texto: largo(n) })) },
  customer: { name: 'Cliente 1279' },
};
const L = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
doblado.inyectarBase({ 'quote.findUnique': () => JSON.parse(JSON.stringify(q)) }, [L]);
const { quoteDecisionLandingRouter } = doblado.moduloDeDist(L);
const capa = quoteDecisionLandingRouter.stack.find((l) => l.route && Array.isArray(l.route.path) && l.route.path.includes('/quote/:token') && l.route.methods.get);
let html = '';
const res = { status() { return res; }, setHeader() { return res; }, send(b) { html = String(b); return res; } };
await capa.route.stack[capa.route.stack.length - 1].handle({ params: { token: TOKEN }, query: {} }, res);
const sonda = `<script>addEventListener('load',()=>{const d=document.documentElement,b=document.getElementById('btn-accept'),c=document.querySelector('.doc-clausulas'),w=document.getElementById('btn-accept-wrapper');
const r=b.getBoundingClientRect(),rc=c.getBoundingClientRect();const o=document.createElement('pre');o.id='medida';
o.textContent=JSON.stringify({vw:innerWidth,vh:innerHeight,scrollW:d.scrollWidth,docH:d.scrollHeight,botonY:Math.round(r.top+scrollY),botonH:Math.round(r.height),botonVisibleTrasScroll:(r.top+scrollY)<d.scrollHeight,cajaH:Math.round(rc.height),cajaScrollH:c.scrollHeight,cajaDesborda:c.scrollHeight>c.clientHeight,cajaAntesDeFirma:rc.top<w.getBoundingClientRect().top});document.body.appendChild(o);});</script>`;
fs.writeFileSync(salida, html.replace('</body>', sonda + '</body>'));
console.log('ok', html.length);
