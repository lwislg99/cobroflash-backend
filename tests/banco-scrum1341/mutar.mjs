// Mutaciones de SCRUM-1341. Cada una: se aplica (y se comprueba que SE APLICO), se compila si toca
// `src/`, se corre el test del ticket, se mira que caiga EL CASO que tiene que caer, y se restaura.
// Al final: build limpio + arbol limpio.
//
// ⚠️ MUTA `src/` y `public/`, y reescribe `dist/` (un build ENTERO por cada mutacion de `src/`).
// Se lanza a mano, con el arbol comiteado, y mientras corre no se mide nada mas en este arbol:
//   node tests/banco-scrum1341/mutar.mjs            (todas)
//   node tests/banco-scrum1341/mutar.mjs M1,M7      (solo esas)
//
// El build va con `--noCheck`: varias mutaciones devuelven un campo que el tipo no declara (un
// `id`, una estrella), y lo que se mide es si el TEST las caza, no si las caza el compilador.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const en = (rel) => path.join(RAIZ, rel);
const PURA = en('src/modules/metrics/domain/actividadEquipo.ts');
const SERVICIO = en('src/modules/metrics/domain/metrics.service.ts');
const RUTAS = en('src/modules/metrics/app/routes/metrics.routes.ts');
const DECLARADAS = en('src/core/http/adminRouteDeclarations.ts');
const VISTA = en('public/dashboard/js/homeView.js');
const HOJA = en('public/dashboard/css/styles.css');
const TEST = 'tests/scrum1341-actividad-del-equipo-sin-importes.test.mjs';

const CONSULTAS = "      orderBy: { id: 'asc' },\n    }),\n    prisma.quote.findMany({\n      where: { merchantId, status: { not: 'draft' }, createdAt: { gte: monthStart } },\n      select: { teamMemberId: true, status: true, createdAt: true },\n    }),\n";
const MANO = "    return res.json(await getActividadEquipo(req.merchantId));";

// `cae`: un trozo del NOMBRE del caso que tiene que caer. Se comprueba contra la base antes de
// mutar nada: un trozo que no nombra ningun caso daria «muda» sin haber medido.
const MUTACIONES = [
  { id: 'M1 la fila de cada persona devuelve su id', f: PURA, cae: 'lista CERRADA',
    de: '    return {\n      name,\n      role,', a: '    return {\n      id: k,\n      name,\n      role,' },
  { id: 'M2 las filas se pasan enteras, como vienen de la base', f: PURA, cae: 'lista CERRADA',
    de: '...members.map((m) => fila(m.id, m.name, m.role, m.status)),', a: '...members.map((m) => ({ ...m, ...fila(m.id, m.name, m.role, m.status) })),' },
  { id: 'M3 la consulta de presupuestos pide el total', f: SERVICIO, cae: 'por EFECTO en la base',
    de: CONSULTAS, a: CONSULTAS.replace('createdAt: true },', 'createdAt: true, total: true },') },
  { id: 'M4 la funcion consulta las facturas cobradas', f: SERVICIO, cae: 'por EFECTO en la base',
    de: CONSULTAS, a: CONSULTAS + "    prisma.invoice.findMany({ where: { merchantId, status: 'paid' } }),\n" },
  { id: 'M5 la ruta recorta por campo el panel del admin y se deja la estrella', f: RUTAS, cae: 'NI UN EURO',
    de: MANO, a: '    const t = await getTeamMetrics(req.merchantId);\n    return res.json({ hasTeam: t.hasTeam, members: t.members.map(({ collected, id, ...resto }) => resto) });' },
  { id: 'M6 la ruta recorta por campo y deja la clave de «Sin asignar», vacia', f: RUTAS, cae: 'los cinco mecanismos',
    de: MANO, a: '    const t = await getTeamMetrics(req.merchantId);\n    return res.json({ ...(await getActividadEquipo(req.merchantId)), sinAsignar: t.sinAsignar ? {} : null });' },
  { id: 'M7 la respuesta lleva el total cobrado del negocio', f: RUTAS, cae: 'NI UN EURO',
    de: MANO, a: '    const t = await getTeamMetrics(req.merchantId);\n    return res.json({ ...(await getActividadEquipo(req.merchantId)), totalCollected: t.totalCollected });' },
  { id: 'M8 las filas salen ordenadas por lo cobrado, sin la cifra', f: RUTAS, cae: 'NI UN EURO',
    de: MANO, a: '    const t = await getTeamMetrics(req.merchantId);\n    const a = await getActividadEquipo(req.merchantId);\n    const cobrado = new Map(t.members.map((m) => [m.name, m.collected]));\n    return res.json({ hasTeam: a.hasTeam, members: [...a.members].sort((x, y) => (cobrado.get(y.name) || 0) - (cobrado.get(x.name) || 0)) });' },
  { id: 'M9 la consulta de miembros pierde su orderBy', f: SERVICIO, cae: 'el orden está DECLARADO',
    de: CONSULTAS, a: CONSULTAS.replace("      orderBy: { id: 'asc' },\n", '') },
  { id: 'M10 la ruta nueva exige admin', f: RUTAS, cae: 'lista CERRADA',
    de: "router.get('/actividad-equipo', async", a: "router.get('/actividad-equipo', requireRole('admin'), async" },
  { id: 'M11 la ruta del dinero pierde su requireRole', f: RUTAS, cae: 'le sigue contestando 403',
    de: "router.get('/team', requireRole('admin'), async", a: "router.get('/team', async" },
  { id: 'M12 la ruta nueva sale de TECNICO_ALLOWED', f: DECLARADAS, cae: 'DECLARADAS',
    de: "  { method: 'GET', path: '/admin/metrics/actividad-equipo', why:", a: "  { method: 'GET', path: '/admin/metrics/actividad-equipo-x', why:" },
  { id: 'M13 PENDIENTE_MAX sube a 1', f: DECLARADAS, cae: 'DECLARADAS',
    de: 'export const PENDIENTE_MAX = 0;', a: 'export const PENDIENTE_MAX = 1;' },
  { id: 'M14 el recuento de aceptados diverge del del admin', f: PURA, cae: 'persona a persona',
    de: "if (q.status === 'accepted') a.accepted++;", a: "if (q.status !== 'rejected') a.accepted++;" },
  { id: 'M15 la consulta de miembros no filtra por merchant', f: SERVICIO, cae: 'por EFECTO en la base',
    de: "      where: { merchantId },\n      select: { id: true, name: true, role: true, status: true },\n      // Explícito", a: "      where: {},\n      select: { id: true, name: true, role: true, status: true },\n      // Explícito" },
  { id: 'M16 el titulo pierde el separador firmado', f: VISTA, cae: 'título firmado',
    de: '<div class="equipo-actividad-titulo">Actividad del equipo · este mes</div>', a: '<div class="equipo-actividad-titulo">Actividad del equipo este mes</div>' },
  { id: 'M17 el bloque del Tecnico pide la ruta del admin', f: VISTA, cae: 'título firmado',
    de: "data = await apiRequest('/admin/metrics/actividad-equipo');", a: "data = await apiRequest('/admin/metrics/team');" },
  { id: 'M18 el bloque del Tecnico pinta la estrella', f: VISTA, cae: 'aunque le LLEGUE',
    de: '<td class="equipo-actividad-miembro">${esc(m.name)}<div', a: '<td class="equipo-actividad-miembro">${esc(m.name)}${m.isBest ? " ⭐ Mejor del mes" : ""}<div' },
  { id: 'M19 el bloque del Tecnico gana la columna de lo cobrado', f: VISTA, cae: 'aunque le LLEGUE',
    de: '        <td class="${tono}">${tasa}%</td>\n', a: '        <td class="${tono}">${tasa}%</td>\n        <td class="equipo-actividad-num">${fmtMoney(m.collected)}</td>\n' },
  { id: 'M20 el bloque del Tecnico pinta el aviso de inactividad', f: VISTA, cae: 'aunque le LLEGUE',
    de: '          <tbody>${rows}</tbody>\n        </table>\n      </div>\n    </div>\n  `;\n  container.appendChild(section);\n}', a: '          <tbody>${rows}</tbody>\n        </table>\n      </div>\n      ${(data.inactive || []).length ? "Sin actividad esta semana: " + data.inactive.map(esc).join(", ") : ""}\n    </div>\n  `;\n  container.appendChild(section);\n}' },
  { id: 'M21 el bloque del Tecnico lleva el boton al hub', f: VISTA, cae: 'aunque le LLEGUE',
    de: '<div class="equipo-actividad-titulo">Actividad del equipo · este mes</div>', a: '<div class="equipo-actividad-titulo">Actividad del equipo · este mes</div><button class="btn-ghost btn-sm" type="button">Ver equipo →</button>' },
  { id: 'M22 al Tecnico no se le pinta nada, como antes', f: VISTA, cae: 'título firmado',
    de: "window.appUserRole !== 'admin') return renderTeamActivity(container);", a: "window.appUserRole !== 'admin') return;" },
  { id: 'M23 al admin se le pinta el bloque del Tecnico', f: VISTA, cae: 'Inicio del ADMIN sigue',
    de: "if (window.appUserRole && window.appUserRole !== 'admin') return renderTeamActivity(container);", a: 'if (window.appUserRole) return renderTeamActivity(container);' },
  { id: 'M24 el admin pierde la columna «Cobrado»', f: VISTA, cae: 'Inicio del ADMIN sigue',
    de: '            <th style="text-align:right">Cobrado</th>\n', a: '' },
  { id: 'M25 el bloque se pinta aunque no haya equipo de campo', f: VISTA, cae: 'sin equipo de campo',
    de: "  if (!data || !data.hasTeam || !Array.isArray(data.members)) return;\n\n  const section = document.createElement('div');\n  section.className", a: "  if (!data || !Array.isArray(data.members)) return;\n\n  const section = document.createElement('div');\n  section.className" },
  { id: 'M26 el titulo lleva un estilo en linea', f: VISTA, cae: 'título firmado',
    de: '<div class="equipo-actividad-titulo">Actividad', a: '<div class="equipo-actividad-titulo" style="color:red">Actividad' },
  { id: 'M27 el rotulo de rol vuelve al gris del panel del admin', f: HOJA, cae: 'llega a AA',
    de: '.equipo-actividad-rol { font-size: 11px; font-weight: 400; color: var(--neutral-600); }', a: '.equipo-actividad-rol { font-size: 11px; font-weight: 400; color: var(--neutral-500); }' },
  { id: 'M28 el % alto vuelve al verde de marca', f: HOJA, cae: 'llega a AA',
    de: '.table td.equipo-actividad-tasa-alta { color: var(--green-700);', a: '.table td.equipo-actividad-tasa-alta { color: var(--green-600);' },
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
// En un worktree anidado `node_modules` es el del checkout de arriba: se resuelve, no se supone.
const tsc = createRequire(en('package.json')).resolve('typescript/bin/tsc');
const MUCHO = 64 * 1024 * 1024;
const build = () => spawnSync(process.execPath, [tsc, '--noCheck', '-p', '.'], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: MUCHO });
const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: MUCHO });
  const out = r.stdout || '';
  // Un TAP sin su recuento final es un proceso que no acabo: CIEGO, no «muda».
  const entero = /^# tests \d+$/m.test(out) && !r.error && r.status !== null;
  return { entero, pasan: [...out.matchAll(/^ok \d+ - (.*)$/gm)].map((m) => m[1]), caen: [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]) };
};
const esDeSrc = (f) => f.startsWith(en('src'));
/** El arnes de las sesiones reescribe este fichero por su cuenta: no es del arbol de trabajo. */
const arbol = () => spawnSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' }).stdout
  .split('\n').filter((l) => l.trim() && !l.endsWith('.claude/settings.local.json')).join('\n');

if (arbol() !== '') { console.log('CIEGO: el arbol no esta comiteado; no se muta encima de trabajo sin guardar\n' + arbol()); process.exit(2); }

// BASE sin mutar, primero.
let b = build();
if (b.status !== 0) { console.log('CIEGO: el build base falla\n' + b.stdout); process.exit(2); }
const base = correr();
console.log(`BASE: pasan=${base.pasan.length} caen=${base.caen.length}`);
if (!base.entero || base.caen.length || !base.pasan.length) { console.log('CIEGO: la base no esta verde\n' + base.caen.join('\n')); process.exit(2); }
const sinCaso = MUTACIONES.filter((m) => base.pasan.filter((n) => n.includes(m.cae)).length !== 1);
if (sinCaso.length) { console.log('CIEGO: `cae` no nombra UN caso de la base: ' + sinCaso.map((m) => m.id).join(' · ')); process.exit(2); }

const SOLO = (process.argv[2] || '').split(',').filter(Boolean);
const ELEGIDAS = MUTACIONES.filter((x) => !SOLO.length || SOLO.some((p) => x.id.startsWith(p + ' ')));
const filas = [];
let mudas = 0;
// Una mutacion de `src/` deja su build en `dist/` aunque el fuente se restaure: antes de una que
// no compila (la pantalla) se recompila, o el test correria contra el `dist/` de la anterior.
let distMutado = false;
for (const m of ELEGIDAS) {
  const original = fs.readFileSync(m.f, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { filas.push(`${m.id}: CIEGO — el ancla aparece ${veces} veces, no se aplico`); mudas++; continue; }
  try {
    if (!esDeSrc(m.f) && distMutado) { b = build(); distMutado = false; }
    fs.writeFileSync(m.f, original.replace(m.de, () => m.a));
    if (esDeSrc(m.f)) {
      b = build();
      distMutado = true;
      if (b.status !== 0) { filas.push(`${m.id}: NO COMPILA (${(b.stdout || '').split('\n')[0]})`); mudas++; continue; }
    }
    const r = correr();
    if (!r.entero) { filas.push(`${m.id}: CIEGO — el test no llego a su recuento final`); mudas++; continue; }
    const cumple = r.caen.some((n) => n.includes(m.cae));
    if (!cumple) mudas++;
    filas.push(`${m.id}: ${cumple ? 'CAE' : 'MUDA'} (se esperaba: ${m.cae}) · pasan=${r.pasan.length} caen=${r.caen.length}`
      + r.caen.map((c) => `\n      - ${c}`).join(''));
  } finally {
    fs.writeFileSync(m.f, original);
  }
}
b = build();
const fin = correr();
console.log(filas.join('\n'));
console.log(`\nPOBLACION: ${ELEGIDAS.length} mutaciones de ${MUTACIONES.length} · mudas o ciegas: ${mudas}`);
console.log(`FINAL: build=${b.status} · pasan=${fin.pasan.length} caen=${fin.caen.length}`);
console.log(`ARBOL: ${arbol() === '' ? 'limpio' : 'SUCIO\n' + arbol()}`);
const bien = mudas === 0 && b.status === 0 && fin.entero && fin.caen.length === 0 && arbol() === '';
console.log('EXIT=' + (bien ? 0 : 1));
process.exit(bien ? 0 : 1);
