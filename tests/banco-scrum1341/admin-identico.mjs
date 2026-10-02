// SCRUM-1341 · ¿el Inicio del ADMIN se pinta EXACTAMENTE igual que antes de este cambio?
//
// Monta el Inicio dos veces en el banco de vistas, con la misma red: una con el `homeView.js` de
// la referencia que se le pasa (leido con `git show`) y otra con el de este arbol. De
// cada montaje saca TODOS los nodos (etiqueta, clase, id, estilo, texto) y el marcado del bloque
// del equipo, y compara los dos por sha256.
//
// Control: con rol `tecnico` los dos montajes TIENEN que diferir (este arbol le pinta su bloque y
// la referencia no). Si salen iguales, el instrumento no ve una diferencia que sabemos que esta.
//
// Solo lee el arbol. Escribe una copia de `public/` en el directorio temporal del sistema y la borra.
// La referencia es OBLIGATORIA y no tiene valor por defecto: contra qué se compara lo dice quien lo
// lanza, y sale escrito con su sha en la primera línea de la salida.
//   node tests/banco-scrum1341/admin-identico.mjs <referencia de git>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cargarDashboard, pintarVista, todos } from '../_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const REF = process.argv[2];
if (!REF) { console.log('CIEGO: falta la referencia contra la que comparar (primer argumento)'); console.log('EXIT=2'); process.exit(2); }
const VISTA = 'public/dashboard/js/homeView.js';

const sha = spawnSync('git', ['rev-parse', REF], { cwd: RAIZ, encoding: 'utf8' }).stdout.trim();
const deRef = spawnSync('git', ['show', `${REF}:${VISTA}`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (deRef.status !== 0 || !deRef.stdout) { console.log(`CIEGO: no puedo leer ${VISTA} de ${REF}`); console.log('EXIT=2'); process.exit(2); }
const deAqui = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
console.log(`REFERENCIA: ${REF} = ${sha}`);
console.log(`homeView.js: ${deRef.stdout.length} caracteres en la referencia · ${deAqui.length} en este arbol · ${deRef.stdout === deAqui ? 'IDENTICOS' : 'distintos'}`);
if (deRef.stdout === deAqui) { console.log('CIEGO: el fichero no ha cambiado; no hay nada que comparar'); console.log('EXIT=2'); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1341-ref-'));
fs.cpSync(path.join(RAIZ, 'public'), path.join(tmp, 'public'), { recursive: true });
fs.writeFileSync(path.join(tmp, VISTA), deRef.stdout);

const EQUIPOS = {
  'con dinero, estrella, «Sin asignar» y aviso': {
    hasTeam: true,
    members: [
      { id: null, name: 'Dueña SL', role: 'owner', status: 'active', sent: 1, accepted: 1, collected: 300.29, acceptanceRate: 100, thisWeek: 1, isBest: false },
      { id: 11, name: 'Ana', role: 'tecnico', status: 'active', sent: 3, accepted: 2, collected: 900.41, acceptanceRate: 67, thisWeek: 3, isBest: true },
      { id: 12, name: 'Blas <b>', role: 'tecnico', status: 'active', sent: 4, accepted: 1, collected: 12.5, acceptanceRate: 25, thisWeek: 2, isBest: false },
      { id: 13, name: 'Caro', role: 'tecnico', status: 'active', sent: 1, accepted: 0, collected: 0, acceptanceRate: 0, thisWeek: 0, isBest: false },
      { id: 14, name: 'Dani', role: 'admin', status: 'active', sent: 0, accepted: 0, collected: 0, acceptanceRate: 0, thisWeek: 0, isBest: false },
    ],
    inactive: ['Caro'],
    sinAsignar: { label: 'Sin asignar', collected: 50.13 },
    totalCollected: 1263.33,
  },
  'sin cobros sueltos ni inactivos': {
    hasTeam: true,
    members: [
      { id: null, name: 'Dueña SL', role: 'owner', status: 'active', sent: 0, accepted: 0, collected: 0, acceptanceRate: 0, thisWeek: 0, isBest: false },
      { id: 11, name: 'Ana', role: 'tecnico', status: 'active', sent: 2, accepted: 1, collected: 9999.99, acceptanceRate: 50, thisWeek: 2, isBest: true },
    ],
    inactive: [],
    sinAsignar: null,
    totalCollected: 9999.99,
  },
  'sin equipo de campo': { hasTeam: false, members: [], inactive: [], sinAsignar: null, totalCollected: 0 },
};

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

async function montar(raiz, rol, equipo) {
  const peticiones = [];
  const fetch = async (url, opts) => {
    const u = String(url);
    peticiones.push(`${(opts && opts.method) || 'GET'} ${u.replace(/\?.*$/, '')}`);
    let cuerpo = [];
    if (/\/admin\/metrics\/(home|inicio)$/.test(u)) cuerpo = { pendingCount: 3, quotesAwaiting: 5, pendingRequests: 1, weekly: {}, sparkline: [], recentActivity: [] };
    else if (/\/admin\/metrics\/(team|actividad-equipo)$/.test(u)) cuerpo = equipo;
    else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
  };
  const b = cargarDashboard(raiz, {
    rol,
    red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch },
  });
  b.ctx.appMerchantId = 1;
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.renderAppView = () => {};
  for (const id of ['req-badge', 'nav-quotes-badge', 'nav-invoices-badge']) {
    const g = b.mk('span');
    g.id = id;
    b.ctx.document.body.appendChild(g);
  }
  const v = await pintarVista(b, 'renderHomeView');
  if (v.error || v.noMedida) throw new Error(`el Inicio no monta con rol ${rol}: ${(v.error && v.error.message) || v.noMedida}`);
  await respirar();
  const nodos = todos(v.contenedor);
  const conTabla = nodos.filter((n) => /<th[^>]*>Miembro<\/th>/.test(String(n.innerHTML || '')));
  const bloque = conTabla.length ? String(conTabla[conTabla.length - 1].innerHTML) : '';
  const arbol = nodos.map((n) => [n.tagName, n.className, n._id, (n.style && n.style.cssText) || '', n.hijos.length ? '' : String(n.textContent || '')]);
  const huella = crypto.createHash('sha256').update(JSON.stringify({ arbol, bloque, peticiones })).digest('hex');
  return { nodos: nodos.length, bloque, huella, peticiones };
}

let mal = 0;
try {
  console.log(`POBLACION: ${Object.keys(EQUIPOS).length} respuestas del equipo × 2 roles × 2 versiones de homeView.js`);
  for (const [nombre, equipo] of Object.entries(EQUIPOS)) {
    const antes = await montar(tmp, 'admin', equipo);
    const ahora = await montar(RAIZ, 'admin', equipo);
    const igual = antes.huella === ahora.huella;
    if (!igual) mal++;
    console.log(`ADMIN · ${nombre}: ${igual ? 'IDENTICO' : 'DISTINTO'} · ${antes.nodos} nodos antes, ${ahora.nodos} ahora · bloque del equipo ${antes.bloque.length} y ${ahora.bloque.length} caracteres · sha256 ${antes.huella.slice(0, 16)} / ${ahora.huella.slice(0, 16)}`);
    if (nombre !== 'sin equipo de campo' && antes.bloque.length === 0) { mal++; console.log('   CIEGO: el admin no tiene bloque del equipo en la referencia; se compara el vacio'); }
  }
  // Control: al Tecnico SI le cambia. Si no, el instrumento no distingue.
  const [primero] = Object.values(EQUIPOS);
  const antesT = await montar(tmp, 'tecnico', primero);
  const ahoraT = await montar(RAIZ, 'tecnico', primero);
  const distingue = antesT.huella !== ahoraT.huella && antesT.bloque.length === 0 && ahoraT.bloque.length > 0;
  if (!distingue) mal++;
  console.log(`CONTROL · TECNICO: ${distingue ? 'DISTINTO, como tiene que ser' : 'CIEGO: el instrumento no ve el bloque nuevo'} · bloque ${antesT.bloque.length} caracteres antes, ${ahoraT.bloque.length} ahora`);
  console.log(`   antes pedia: ${antesT.peticiones.filter((p) => /metrics/.test(p)).join(' · ')}`);
  console.log(`   ahora pide:  ${ahoraT.peticiones.filter((p) => /metrics/.test(p)).join(' · ')}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('EXIT=' + (mal === 0 ? 0 : 1));
process.exit(mal === 0 ? 0 : 1);
