// docs/master/evidencias/SCRUM-1451/sonda-1451-un-centimo-de-menos.mjs — SCRUM-1451 (S4, 22-oct-2026)
//
// ¿UN CÉNTIMO COBRADO DE MENOS SE LE ENSEÑA HOY AL PROFESIONAL COMO UNA DEUDA?
//
// SCRUM-141 acepta que la suma de las facturas por tramos quede a 1-2 céntimos de lo aceptado. Por
// ARRIBA el panel ya calla (`cobradoDeMas`, margen de 0,02 €). Esta sonda mira el caso de ABAJO:
// todo facturado y cobrado, pero 0,01 € por debajo de lo aceptado.
//
// LO QUE ES REAL (sin navegador, sin base, sin red):
//   · el SERVIDOR: `estadoCobroFor` e `importeDeReferencia` de `dist/.../job.service.js` (base
//     doblada por `require.cache`, sólo para poder cargar el módulo: no se consulta);
//   · la LISTA de Trabajos (`renderJobsView`) y la FICHA (`renderJobDetailView`), en el banco de vistas,
//     con el estado que devuelve el servidor de verdad.
//
// CONTROLES, con la MISMA forma que el caso medido (cambia sólo lo cobrado):
//   · igual (3,40 de 3,40) → tiene que salir «Pagado» / «✓ Cobrado» / «Cobrado del todo»;
//   · deuda real (1,70 de 3,40) → tiene que salir «Parcial» / «1,70 €» / «Te falta por cobrar».
//   Si alguno no sale así, la sonda no está mirando (salida 2).
//
// Salida: 0 = HOY se pinta una deuda de un céntimo · 1 = no se pinta · 2 = no supe mirar.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));

// La base, doblada: el módulo la importa al cargarse, y esta sonda no hace ninguna consulta.
const rutaPrisma = requiere.resolve('./dist/core/db/prisma.js');
const vacio = new Proxy({}, { get: () => new Proxy({}, { get: () => async () => null }) });
requiere.cache[rutaPrisma] = { id: rutaPrisma, filename: rutaPrisma, loaded: true, exports: { prisma: vacio } };
const { estadoCobroFor, importeDeReferencia } = requiere('./dist/modules/jobs/domain/job.service.js');

const ACEPTADO = 3.40;
const CASOS = [
  { nombre: 'un céntimo de MENOS', cobrado: 3.39 },
  { nombre: 'control · igual', cobrado: 3.40 },
  { nombre: 'control · deuda real', cobrado: 1.70 },
];

const { cargarDashboard, pintarVista, todos } = await import(new URL('../../../../tests/_banco-vistas.mjs', import.meta.url));
const { datosDelCenso } = await import(new URL('../../../../scripts/_datos-del-censo.mjs', import.meta.url));
const texto = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const clase = (n) => String((n && n.className) || '');

async function medir(cobrado) {
  const estado = estadoCobroFor(cobrado, ACEPTADO, ACEPTADO);
  const referencia = importeDeReferencia(ACEPTADO, ACEPTADO);
  // Las dos facturas de los tramos, emitidas y pagadas: no queda ningún documento pendiente.
  const facturas = [
    { id: 901, number: 'F-2026-0901', status: 'paid', type: 'F1', total: Math.round(cobrado * 50) / 100, currency: 'EUR' },
    { id: 902, number: 'F-2026-0902', status: 'paid', type: 'F1', total: Math.round((cobrado - Math.round(cobrado * 50) / 100) * 100) / 100, currency: 'EUR' },
  ];
  const ajustar = (j) => Object.assign(j, {
    status: 'terminado', totalAceptado: ACEPTADO, totalCobrado: cobrado, importeReferencia: referencia,
    estadoCobro: estado, invoices: facturas, albaranes: [], entregaPendiente: null,
  });
  const dc = datosDelCenso();
  const datos = (url) => {
    const v = dc.datos(url);
    if (/\/admin\/jobs(\?|$)/.test(url) && Array.isArray(v)) return v.slice(0, 1).map(ajustar);
    if (/\/admin\/jobs\/\d+(\?|$)/.test(url) && v && typeof v === 'object') return ajustar(v);
    return v;
  };

  dc.enVista('renderJobsView');
  let banco = cargarDashboard(RAIZ, { datos });
  banco.ctx.renderAppView = () => {};
  const rl = await pintarVista(banco, 'renderJobsView');
  // Los terminados pueden vivir en un grupo plegado: se despliega con el botón del producto.
  for (const b of rl.contenedor ? todos(rl.contenedor).filter((n) => n.tagName === 'BUTTON' && /\bjobs-grupo-abrir\b/.test(clase(n._padre && n._padre._padre))) : []) b.click();
  const fila = rl.contenedor && todos(rl.contenedor).find((n) => n.tagName === 'TR' && /\bjobs-fila\b/.test(clase(n)));
  const celda = fila && todos(fila).find((n) => n.tagName === 'TD' && /\bcell-amount\b/.test(clase(n)));

  dc.enVista('renderJobDetailView');
  banco = cargarDashboard(RAIZ, { datos });
  banco.ctx.renderAppView = () => {};
  const rd = await pintarVista(banco, 'renderJobDetailView', 1);
  const de = (c) => { const n = rd.contenedor && todos(rd.contenedor).find((x) => new RegExp(`\\b${c}\\b`).test(clase(x))); return n ? texto(n) : null; };
  const pildora = rd.contenedor && todos(rd.contenedor).find((x) => /\bstatus-pill\b/.test(clase(x)) && /^(Pagado|Parcial|Pendiente)$/.test(texto(x)));

  return {
    estado,
    lista: celda ? texto(celda) : null,
    ficha: [de('detail-dinero__rotulo'), de('detail-dinero__grande')].filter(Boolean).join(' · ') || null,
    pildora: pildora ? texto(pildora) : null,
    errores: [rl.error, rd.error].filter(Boolean).map((e) => e.message),
  };
}

console.log(`aceptado ${ACEPTADO.toFixed(2)} € · dos facturas de tramo, emitidas y pagadas`);
console.log('caso'.padEnd(24) + 'servidor'.padEnd(11) + 'lista (importe)'.padEnd(26) + 'ficha (franja)'.padEnd(34) + 'píldora');
const r = {};
for (const c of CASOS) {
  r[c.nombre] = await medir(c.cobrado);
  const x = r[c.nombre];
  console.log(`${c.nombre.padEnd(24)}${String(x.estado).padEnd(11)}${String(x.lista).padEnd(26)}${String(x.ficha).padEnd(34)}${x.pildora}` + (x.errores.length ? `   ⚠ ${x.errores.join(' | ')}` : ''));
}

const ig = r['control · igual'];
const dr = r['control · deuda real'];
const ok = ig.estado === 'Pagado' && /Cobrado/.test(String(ig.lista)) && dr.estado === 'Parcial' && /1,70/.test(String(dr.lista));
if (!ok) { console.error('🔴 NO SUPE MIRAR: los controles no salen como deben'); process.exit(2); }
console.log('✅ controles: «igual» sale cobrado y «deuda real» sale con su deuda');
const m = r['un céntimo de MENOS'];
const deuda = m.estado === 'Parcial' || /0,01/.test(String(m.lista)) || /0,01/.test(String(m.ficha));
console.log(deuda
  ? `🔴 HOY SE PINTA UNA DEUDA DE UN CÉNTIMO: servidor «${m.estado}» · lista «${m.lista}» · ficha «${m.ficha}» · píldora «${m.pildora}»`
  : 'NO se pinta deuda con un céntimo de menos');
process.exit(deuda ? 0 : 1);
