// scripts/verificacion-s5/kbd-en-botones-de-crear.mjs — carril de VERIFICACIÓN (sesión 5)
//
// Contesta CORRIENDO, no leyendo, la pregunta de SCRUM-721: ¿el botón de crear de cada lista
// pinta la tecla del atajo? El ticket midió que «Nueva factura» NO pasaba por `etiquetar` y por
// tanto no pintaba `<kbd>`, mientras «Nuevo presupuesto» y «Nuevo cliente» sí.
//
// SUELO: si el banco no monta las vistas, o no encuentra NINGÚN botón de crear, el script falla
// declarándose ciego. Un cero aquí significaría «no he mirado», no «no hay defecto».
// CONTROL POSITIVO: las dos listas que el ticket midió como SANAS tienen que seguir saliendo con
// tecla. Si salieran sin ella, el instrumento estaría mirando mal y su veredicto no vale.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from '../../tests/_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERBO_DE_CREAR = /\b(nuev[oa]s?|crear)\b/i;

const banco0 = cargarDashboard(RAIZ);
const VISTAS = Object.keys(banco0.ctx)
  .filter((k) => /^render[A-Z].*View$/.test(k) && typeof banco0.ctx[k] === 'function').sort();

const filas = [];
const ciegas = [];
for (const fn of VISTAS) {
  const banco = cargarDashboard(RAIZ, { datos: datosDeMuestra });
  const r = await pintarVista(banco, fn);
  if (r.error) { ciegas.push(`${fn} → ${String(r.error.message).slice(0, 60)}`); continue; }
  for (const b of todos(r.contenedor).filter((n) => n.tagName === 'BUTTON'
    && /btn-primary/.test(n.className || '') && VERBO_DE_CREAR.test(n.textContent || ''))) {
    const kbd = todos(b).filter((n) => n.tagName === 'KBD');
    filas.push({ vista: fn, rotulo: (b.textContent || '').trim().slice(0, 28), tecla: kbd.length ? kbd.map((k) => k.textContent).join('') : null });
  }
}

console.log('vistas montadas:', VISTAS.length, '· botones de crear:', filas.length, '· ciegas:', ciegas.length);
if (ciegas.length) console.log('  ciegas:', ciegas.join(' | '));
for (const f of filas.sort((a, b) => a.vista.localeCompare(b.vista))) {
  console.log(`  ${f.tecla ? '✅ tecla «' + f.tecla + '»' : '🔴 SIN TECLA     '}  ${f.vista.padEnd(24)} «${f.rotulo}»`);
}

let malo = 0;
if (VISTAS.length < 20 || filas.length < 8) { console.log('\n🔴 SUELO ROTO: el instrumento está ciego, ningún veredicto de este script vale.'); malo = 1; }
if (ciegas.length) { console.log('🔴 SUELO ROTO: hay vistas que no se montan.'); malo = 1; }
for (const v of ['renderQuotesListView', 'renderCustomersView']) {
  const f = filas.find((x) => x.vista === v);
  if (!f || !f.tecla) { console.log(`🔴 CONTROL POSITIVO CAÍDO: «${v}» tenía tecla el 4-sep y ahora no se le ve. El instrumento mide mal.`); malo = 1; }
}
const inv = filas.find((x) => x.vista === 'renderInvoicesView');
console.log(`\nSCRUM-721 → «Nueva factura» ${inv ? (inv.tecla ? 'SÍ pinta la tecla «' + inv.tecla + '»: el defecto YA NO OCURRE' : '🔴 sigue SIN tecla: el defecto EXISTE HOY') : '❓ no se encontró el botón'}`);
process.exit(malo);
