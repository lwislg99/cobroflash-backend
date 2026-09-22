// scripts/verificacion-s5/tabla-dentro-de-su-scroll.mjs — carril de VERIFICACIÓN (sesión 5)
//
// SCRUM-699 midió que `customersView` metía la tabla en el `.table-scroll` y ACTO SEGUIDO la
// movía al `.data-card`, dejando el envoltorio VACÍO. Esto lo comprueba sobre el DOM EJECUTADO:
// se pregunta por la CADENA DE PADRES de cada <table>, que es lo único que decide si el contrato
// de scroll lo cumple alguien.
//
// SUELO: si no se monta ninguna vista con tabla, falla declarándose ciego.
// CONTROL POSITIVO: se inyecta el defecto (mover la tabla fuera de su envoltorio) y se comprueba
// que este instrumento LO VE. Un verde que no sabría ponerse rojo no es un verde.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from '../../tests/_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const clases = (n) => String(n.className || '').split(/\s+/);

// 🔴 LA PROPIEDAD ES `_padre`, NO `padre`. Con `padre` la cadena sale SIEMPRE vacía y las nueve
// tablas se declaran FUERA: un rojo perfecto y perfectamente falso. Por eso abajo se cruzan las
// dos cuentas (tablas dentro vs. envoltorios no vacíos): si no cuadran, el instrumento miente.
function cadena(n, raiz) { const c = []; let x = n._padre; while (x && x !== raiz._padre) { c.push(x); x = x._padre; } return c; }

async function censar(vistas) {
  const filas = [], ciegas = [];
  for (const fn of vistas) {
    const banco = cargarDashboard(RAIZ, { datos: datosDeMuestra });
    const r = await pintarVista(banco, fn);
    if (r.error) { ciegas.push(fn); continue; }
    const envoltorios = todos(r.contenedor).filter((n) => clases(n).includes('table-scroll'));
    for (const env of envoltorios) {
      const tablasDentro = todos(env).filter((n) => n !== env && n.tagName === 'TABLE');
      filas.push({ vista: fn, tablas: tablasDentro.length });
    }
    for (const t of todos(r.contenedor).filter((n) => n.tagName === 'TABLE')) {
      const dentro = cadena(t, r.contenedor).some((p) => clases(p).includes('table-scroll'));
      filas.push({ vista: fn, tabla: true, dentro });
    }
  }
  return { filas, ciegas };
}

const b0 = cargarDashboard(RAIZ);
const VISTAS = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
const { filas, ciegas } = await censar(VISTAS);
const tablas = filas.filter((f) => f.tabla);
const envVacios = filas.filter((f) => f.tablas === 0);

console.log('vistas:', VISTAS.length, '· <table> encontradas:', tablas.length, '· envoltorios .table-scroll VACÍOS:', envVacios.length, '· ciegas:', ciegas.length);
if (tablas.length === 0) { console.log('🔴 SUELO ROTO: cero tablas. El instrumento está ciego.'); process.exit(2); }
for (const f of tablas) console.log(`  ${f.dentro ? '✅ dentro de .table-scroll' : '🔴 FUERA de su .table-scroll'}  ${f.vista}`);
if (envVacios.length) console.log('  envoltorios vacíos en:', envVacios.map((f) => f.vista).join(', '));

// ── CRUCE DE CUENTAS: las dos formas de contar lo mismo tienen que coincidir ──────────────
const dentro = tablas.filter((f) => f.dentro).length;
const enEnvoltorios = filas.filter((f) => f.tablas !== undefined).reduce((a, f) => a + f.tablas, 0);
if (dentro !== enEnvoltorios) {
  console.log(`
🔴 INSTRUMENTO INCOHERENTE: ${dentro} tablas «dentro» por cadena de padres, pero ${enEnvoltorios} contadas desde los envoltorios. Ningún veredicto de este script vale.`);
  process.exit(2);
}

// ── CONTROL POSITIVO: se inyecta el defecto de SCRUM-699 y el instrumento TIENE que verlo ──
{
  const banco = cargarDashboard(RAIZ, { datos: datosDeMuestra });
  const r = await pintarVista(banco, 'renderCustomersView');
  const t = todos(r.contenedor).find((n) => n.tagName === 'TABLE');
  const card = cadena(t, r.contenedor).find((p) => clases(p).includes('data-card')) || r.contenedor;
  card.appendChild(t); // exactamente lo que hacía la l. 207 de antes: MOVER la tabla fuera
  const sigueDentro = cadena(t, r.contenedor).some((p) => clases(p).includes('table-scroll'));
  console.log(`
CONTROL POSITIVO (defecto reinyectado) → ${sigueDentro ? '🔴 el instrumento NO lo ve: no sirve' : '✅ el instrumento lo VE (sale fuera)'}`);
  if (sigueDentro) process.exit(2);
}

const cust = tablas.filter((f) => f.vista === 'renderCustomersView');
console.log(`\nSCRUM-699 → Clientes: ${cust.length} tabla(s), ${cust.filter((f) => f.dentro).length} dentro de su envoltorio.`);
console.log(cust.length && cust.every((f) => f.dentro)
  ? '  ✅ el defecto que describe el ticket YA NO OCURRE.'
  : '  🔴 EXISTE HOY: la tabla de clientes sigue fuera de su .table-scroll.');
