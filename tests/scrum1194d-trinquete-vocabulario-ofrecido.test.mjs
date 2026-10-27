// SCRUM-1194d · TRINQUETE «el servidor acepta un VALOR que la pantalla no ofrece» (método A).
//
// Decisión del fundador, SCRUM-1194 c.21005: «A en J6 ya», con su trinquete y los 14 pares
// declarados desde el principio. El censo es `tests/_censo-vocabulario-ofrecido.mjs` (el de 1194b,
// traído sin cambiar el algoritmo). Sólo LEE `src/` y `public/`; la sonda de 1185 la lee y
// parchea una copia en memoria, sin tocar su fichero.
//
// QUÉ VIGILA: el conjunto de pares vocabulario × ruta en los que las pantallas llamadoras no
// nombran algún valor (PARCIAL), no nombran ninguno, o no se pudieron leer. Hoy son 14 y todos
// están revisados a mano (`docs/master/SCRUM-1194.md`, tramos 1194, 1194b y 1194d).
//   · Sube (un par nuevo): o se arregla la pantalla —en su carril— o se declara aquí, con su
//     motivo, en el mismo PR. Es la forma de SCRUM-1136.
//   · Baja (un par declarado que ya no sale): se quita de la lista diciendo por qué. Una bajada
//     que nadie ha hecho es un instrumento roto hasta que se demuestre lo contrario (A23 #7).
//
// LO QUE NO VE (declarado en 1194 y 1194b; no se arregla aquí): vocabularios no literales, valores
// que pone OTRO fichero de la pantalla (un componente), un solo salto de import en el servidor y
// uno de envoltorio en el front, y el envoltorio casa por NOMBRE de función. «Ofrece todo» es una
// cota optimista: un valor que aparece en el llamador por otro motivo cuenta como ofrecido.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarVocabulario, clavePar, FALTAN_SEMBRADOS } from './_censo-vocabulario-ofrecido.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los 14 pares, declarados al nacer. Clave = `clavePar` (ruta · vocabulario [valores] · fichero).
// `faltan` es lo que ninguna pantalla llamadora nombra. Uno por línea.
export const DECLARADOS = [
  { par: 'POST /admin/quotes/:id/archivar · ESTADOS_ARCHIVABLES [draft|rejected|expired] · src/modules/quotes/domain/archivado.ts', veredicto: 'PARCIAL', faltan: ['expired'], motivo: 'falso positivo (1194b): la ruta no lee cuerpo y compara con el status GUARDADO; el botón se ofrece en cualquier estado y decide el 409' },
  { par: 'POST /admin/onboarding/serie · PROHIBIDOS_SERIE ["|\'|<|>|=] · src/core/validation/fiscalInput.ts', veredicto: 'no nombra NINGUNO', faltan: ['"', "'", '<', '>', '='], motivo: 'no es la forma (1194): es una lista NEGRA de caracteres' },
  { par: 'POST /admin/products · ITEM_KIND [PRODUCTO|SERVICIO] · src/core/validation/schemas.ts', veredicto: 'no nombra NINGUNO', faltan: ['PRODUCTO', 'SERVICIO'], motivo: 'falso positivo (1194): los valores los pone el componente switchTipoArticulo.js' },
  { par: 'PUT /admin/products/:id · ITEM_KIND [PRODUCTO|SERVICIO] · src/core/validation/schemas.ts', veredicto: 'no nombra NINGUNO', faltan: ['PRODUCTO', 'SERVICIO'], motivo: 'falso positivo (1194): los valores los pone el componente switchTipoArticulo.js' },
  { par: 'POST /admin/customers · customerCreateSchema [EMPRESA|PERSONA] · src/core/validation/schemas.ts', veredicto: 'no nombra NINGUNO', faltan: ['EMPRESA', 'PERSONA'], motivo: 'falso positivo (1194): contactKind lo pone el componente switchFormaJuridica.js' },
  { par: 'POST /admin/customers · customerCreateSchema [NINGUNA|QUINCENAL|MENSUAL] · src/core/validation/schemas.ts', veredicto: 'no nombra NINGUNO', faltan: ['NINGUNA', 'QUINCENAL', 'MENSUAL'], motivo: 'variante (1194): billingPeriodicity se acepta al CREAR y sólo se ofrece al EDITAR; decisión de producto, carril J2' },
  { par: 'POST /admin/entorno · ENTORNOS_APP [instalada|pestana|desconocido] · src/modules/auth/domain/entornoApp.service.ts', veredicto: 'no nombra NINGUNO', faltan: ['instalada', 'pestana', 'desconocido'], motivo: 'falso positivo (1194): lo calcula window.entornoDeLaApp(), en otro fichero' },
  { par: 'POST /admin/expenses/leer-ticket · MODELOS_LECTURA [gemini-3.5-flash-lite|gemini-3.1-flash-lite|gemini-2.5-flash-lite] · src/modules/expenses/domain/lecturaTicket.ts', veredicto: 'no nombra NINGUNO', faltan: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'], motivo: 'no es la forma (1194): configuración interna (modelos de IA)' },
  { par: 'POST /admin/albaranes/:id/fotos · FOTO_MIME_ALLOWLIST [image/jpeg|image/png|image/webp] · src/modules/jobs/app/routes/albaranes.routes.ts', veredicto: 'no nombra NINGUNO', faltan: ['image/jpeg', 'image/png', 'image/webp'], motivo: 'falso positivo (1194): el MIME viene del propio archivo' },
  { par: 'POST /admin/partes · TIPOS_PARTE [reparacion_asistencia|mantenimiento|instalacion] · src/modules/jobs/domain/parteTrabajo.ts', veredicto: 'no nombra NINGUNO', faltan: ['reparacion_asistencia', 'mantenimiento', 'instalacion'], motivo: 'variante (1194): el alta manda sólo { jobId } y el tipo se ofrece en el PATCH; ya es pieza de cuerpo en 1185; carril S1' },
  { par: 'PATCH /admin/partes/:id · ESTADOS_PARTE [borrador|firmado|facturado] · src/modules/jobs/domain/parteTrabajo.ts', veredicto: 'no nombra NINGUNO', faltan: ['borrador', 'firmado', 'facturado'], motivo: 'no es la forma (1194): estado interno del parte' },
  { par: 'POST /admin/partes/:id/firmar-tecnico · ESTADOS_PARTE [borrador|firmado|facturado] · src/modules/jobs/domain/parteTrabajo.ts', veredicto: 'no nombra NINGUNO', faltan: ['borrador', 'firmado', 'facturado'], motivo: 'no es la forma (1194d): estado interno del parte; liga por el salto de import a parteTrabajo.ts, no por el cuerpo' },
  { par: 'POST /admin/partes/:id/firmar · ESTADOS_PARTE [borrador|firmado|facturado] · src/modules/jobs/domain/parteTrabajo.ts', veredicto: 'no nombra NINGUNO', faltan: ['borrador', 'firmado', 'facturado'], motivo: 'no es la forma (1194d): estado interno del parte; liga por el salto de import a parteTrabajo.ts, no por el cuerpo' },
  { par: 'POST /admin/partes/:id/dictado · ESTADOS_PARTE [borrador|firmado|facturado] · src/modules/jobs/domain/parteTrabajo.ts', veredicto: 'no nombra NINGUNO', faltan: ['borrador', 'firmado', 'facturado'], motivo: 'no es la forma (1194): estado interno del parte' },
];

// Lo que tumba a este fichero (SCRUM-745; lo ejecuta `scripts/meta-guard-mutaciones.mjs`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El PARCIAL desaparece como veredicto: la pareja sembrada de 1136 deja de salir.
    fichero: 'tests/_censo-vocabulario-ofrecido.mjs',
    de: "faltan.length === v.valores.length ? 'no nombra NINGUNO' : 'PARCIAL'",
    a: "'no nombra NINGUNO'",
    cae: 'SIEMBRA: la pareja de 1136 sale PARCIAL',
  },
  {
    // Quitar la siembra con el parámetro puesto: el positivo fabricado no está.
    fichero: 'tests/_censo-vocabulario-ofrecido.mjs',
    de: '    if (sembrar) {',
    a: '    if (false) {',
    cae: 'SIEMBRA: la pareja de 1136 sale PARCIAL',
  },
  {
    // Sin siembra, el censo daría números en vez de CIEGO: un verde sin control.
    fichero: 'tests/_censo-vocabulario-ofrecido.mjs',
    de: '  if (fallo) return ciego(fallo);',
    a: '  if (fallo && sembrar) return ciego(fallo);',
    cae: 'SIN SIEMBRA: el censo sale CIEGO',
  },
  {
    // PUT y PATCH tratados como GET: dos pares declarados se van sin que nadie los quite.
    fichero: 'tests/_censo-vocabulario-ofrecido.mjs',
    de: "      if (r.method === 'GET') { salida.push({ v, r }); continue; }",
    a: "      if (r.method === 'GET' || r.method === 'PUT' || r.method === 'PATCH') { salida.push({ v, r }); continue; }",
    cae: 'TRINQUETE no baja en silencio',
  },
  {
    // Las pantallas .html dejan de leerse: tiene que salir «no pude medir», no un verde.
    fichero: 'tests/_censo-vocabulario-ofrecido.mjs',
    de: "    if (file.endsWith('.html')) { conValue(txt); tokensCache.set(file, out); return out; }",
    a: "    if (file.endsWith('.html')) { tokensCache.set(file, null); return null; }",
    cae: 'SUELO: población declarada y ningún «no pude medir»',
  },
  {
    // Un par del árbol sin declarar: la forma de 1136 entrando sin que nadie la mire.
    fichero: 'tests/scrum1194d-trinquete-vocabulario-ofrecido.test.mjs',
    de: "  { par: 'POST /admin/quotes/:id/archivar",
    a: "  { par: 'xPOST /admin/quotes/:id/archivar",
    cae: 'TRINQUETE no sube',
  },
];

const HOY = await censarVocabulario(RAIZ);
const SIN_SIEMBRA = await censarVocabulario(RAIZ, { sembrar: false });
const ciegoHoy = () => assert.equal(HOY.ciego, undefined, `🔴 CIEGO — ${HOY.ciego}. No es un verde: el censo no ha medido.`);
const firma = (x) => `${x.veredicto} · faltan [${x.faltan.join('|')}]`;

test('SCRUM-1194d · SIEMBRA: la pareja de 1136 sale PARCIAL con los 8 que faltan, y su gemela «ofrece todo»', () => {
  ciegoHoy();
  assert.equal(HOY.controles.positivo.veredicto, 'PARCIAL');
  assert.deepEqual(HOY.controles.positivo.faltan, FALTAN_SEMBRADOS);
  assert.equal(HOY.controles.negativo.veredicto, 'ofrece todo');
});

test('SCRUM-1194d · SIN SIEMBRA: el censo sale CIEGO, no verde', () => {
  assert.match(SIN_SIEMBRA.ciego || '', /control positivo SEMBRADO.*ni aparece/,
    'sin el positivo fabricado el censo tiene que decir CIEGO; si da números, un árbol sin la forma y un censo roto se leen igual');
});

test('SCRUM-1194d · SUELO: población declarada y ningún «no pude medir»', (t) => {
  ciegoHoy();
  const p = HOY.poblacion;
  t.diagnostic(`población · ${p.vocabularios} vocabularios (${p.zod} z.enum + ${p.arrays} arrays) · ${p.rutas} rutas (sonda 1185) · `
    + `${p.sinRuta} sin ruta · ${p.pares} pares: ${p.get} GET, ${p.sinPantalla} sin pantalla, ${p.ofreceTodo} ofrece todo, `
    + `${p.parcial} PARCIAL, ${p.ninguno} no nombra ninguno, ${p.noPudeMedir} no pude medir · `
    + `${HOY.soloPorEnvoltorio.length} «ofrece todo» sólo por envoltorio · declarados ${DECLARADOS.length}`);
  assert.ok(p.vocabularios > 0 && p.rutas > 0 && p.pares > 0, `🔴 CIEGO: población vacía (${JSON.stringify(p)})`);
  const noPude = HOY.filas.filter((f) => f.veredicto === 'NO PUDE MEDIR').map(clavePar);
  assert.deepEqual(noPude, [], `🔴 pantallas llamadoras que no se pudieron leer: ${noPude.join(' · ')}`);
});

test('SCRUM-1194d · TRINQUETE no sube: toda discrepancia del árbol está declarada con su motivo', () => {
  ciegoHoy();
  const claves = DECLARADOS.map((d) => d.par);
  assert.equal(new Set(claves).size, claves.length, 'un par declarado dos veces');
  for (const d of DECLARADOS) assert.ok(d.motivo && d.motivo.length > 10, `par declarado sin motivo: ${d.par}`);
  const declarados = new Map(DECLARADOS.map((d) => [d.par, firma(d)]));
  const nuevos = HOY.discrepancias.filter((f) => declarados.get(clavePar(f)) !== firma(f))
    .map((f) => `${clavePar(f)} → ${firma(f)} (ruta ${f.r.file}:${f.r.line}; pantallas ${f.llamadores.join(', ')})`);
  assert.deepEqual(nuevos, [], '🔴 la forma de SCRUM-1136: una ruta acepta valores que ninguna pantalla llamadora ofrece. '
    + 'Se arregla la pantalla (en su carril) o se declara en DECLARADOS con su motivo, en el mismo PR:\n  ' + nuevos.join('\n  '));
});

test('SCRUM-1194d · TRINQUETE no baja en silencio: todo par declarado sigue en el árbol, con el mismo veredicto', () => {
  ciegoHoy();
  const hoy = new Map(HOY.discrepancias.map((f) => [clavePar(f), firma(f)]));
  const idos = DECLARADOS.filter((d) => hoy.get(d.par) !== firma(d))
    .map((d) => `${d.par} → declarado ${firma(d)}, hoy ${hoy.get(d.par) || 'no sale'}`);
  assert.deepEqual(idos, [], '🔴 un par declarado ya no sale como se declaró. Si se arregló, se quita de DECLARADOS diciendo '
    + 'por qué; si nadie lo tocó, el censo se ha descarrilado:\n  ' + idos.join('\n  '));
});
