// tests/scrum797-el-dueno-se-escribe.test.mjs — SCRUM-797
//
// UN ALTA DE CLIENTE QUE NO DICE DE QUIÉN ES, NO PASA.
//
// EL DEFECTO: `Customer.merchantId` llevaba `@default(1)` en el schema, y el merchant 1 ES LA
// CUENTA DEMO. Un `create` que se olvidara del dueño no fallaba: la base archivaba la fila bajo
// el demo, devolvía HTTP 201, y el profesional que la había creado NO LA VEÍA EN SU LISTA.
// Medido por el camino real contra dev el 7-sep-2026: `POST /charges` desde el merchant 1044
// dejó el cliente id=932 con `merchantId = 1`. El demo lo veía; su dueño, no.
//
// ── POR QUÉ EL GUARD NO ES «que no vuelva el @default(1)» Y YA ───────────────────────────────
// Porque ésa es la mitad barata. La cara es la de arriba: el ALTA tiene que DECIR el dueño,
// lleve la columna el defecto o no. Con la columna ya obligatoria una omisión es ruidosa
// —Prisma se niega—, pero eso sólo se descubre EJECUTANDO ese camino, y el que trajo el defecto
// (`POST /charges`) no tiene test de integración con BD en la tanda normal. Esto lo lee del
// código fuente, sin BD y sin gate.
//
// ── POR QUÉ AST, Y NO `grep` (SCRUM-203) ─────────────────────────────────────────────────────
// `customer.createdAt` casa con un `grep` de `customer.create`, y un guard de texto se caza a sí
// mismo en el comentario que explica la regla. El instrumento es `scripts/_censo-alta-de-cliente.mjs`
// (SCRUM-795), que además DERIVA DEL SCHEMA qué modelos existen y qué forma tiene su `merchantId`.
// Aquí no hay ninguna lista de ficheros escrita a mano: la población son los fuentes del árbol.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import { modelosDelSchema, censar, altaDeCliente } from '../scripts/_censo-alta-de-cliente.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // EL DEFECTO EXACTO que originó el ticket: el alta de `POST /charges` deja de decir el dueño.
    fichero: 'src/modules/billing/app/routes/charges.routes.ts',
    de: '          merchantId: body.merchant_id,',
    a: '          /* SCRUM-797 mutacion: el duenno deja de escribirse */',
    cae: 'SCRUM-797 · 🔴 ningún alta de Customer se calla de quién es',
  },
  {
    // «EL DEFECTO HA VUELTO»: la columna se vuelve a clasificar como donante.
    fichero: 'scripts/_censo-alta-de-cliente.mjs',
    de: "      if (/@default\\(1\\)/.test(l)) forma = 'default-1';",
    a: "      if (/@default\\(1\\)|@map\\(/.test(l)) forma = 'default-1'; /* SCRUM-797 mutacion */",
    cae: 'SCRUM-797 · 🔴 la columna del dueño NO vuelve a ser donante',
  },
  {
    // EL SUELO: si el barrido deja de ver altas, un cero de omisiones sería mentira.
    fichero: 'scripts/_censo-alta-de-cliente.mjs',
    de: "export const METODOS_CREACION = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);",
    a: "export const METODOS_CREACION = new Set([]); /* SCRUM-797 mutacion: barrido ciego */",
    cae: 'SCRUM-797 · 🔴 SUELO: si no veo altas, no he medido',
  },
];

// ── LA POBLACIÓN, DERIVADA ───────────────────────────────────────────────────────────────────
// Los directorios NO se escriben: son los de primer nivel del repo que contienen fuentes. Lo que
// se excluye son destinos generados y datos, no código que alguien haya decidido no mirar.
const NO_ES_CODIGO = new Set(['node_modules', 'dist', 'coverage', 'prisma', 'public', 'docs']);
const tieneFuentes = (p) => fs.readdirSync(p, { withFileTypes: true }).some((e) => (e.isDirectory()
  ? (!NO_ES_CODIGO.has(e.name) && tieneFuentes(path.join(p, e.name)))
  : /\.(ts|mjs|js)$/.test(e.name)));

const dirs = fs.readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !NO_ES_CODIGO.has(e.name) && !e.name.startsWith('.'))
  .map((e) => e.name)
  .filter((d) => tieneFuentes(path.join(RAIZ, d)));

const modelos = modelosDelSchema(fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8'));
const creaciones = censar({ raiz: RAIZ, dirs, modelos });
const altas = altaDeCliente(creaciones);
const donde = (c) => `${c.fichero}:${c.linea}`;
const listar = (xs) => xs.map((d) => `     · ${d}`).join('\n');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① 🔴 SUELO · un cero de omisiones sobre un barrido que no ve nada es la lectura más cara
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-797 · 🔴 SUELO: si no veo altas, no he medido', () => {
  assert.ok(dirs.length >= 2,
    `🔴 CIEGO: sólo derivo ${dirs.length} directorio(s) de código (${dirs.join(', ')}).`);
  assert.ok(modelos.size >= 20,
    `🔴 CIEGO: sólo leo ${modelos.size} modelos del schema. Sin población no clasifico nada.`);
  assert.ok(altas.length >= 20,
    `🔴 CIEGO: sólo veo ${altas.length} altas de Customer en todo el árbol, y hay decenas.\n`
    + '    Un «0 omiten» sacado de un barrido que no llega al código no es un verde: es no haber\n'
    + '    mirado. Antes de creerte este fichero, arregla el barrido.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL QUE DECIDE · ningún alta se calla de quién es
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-797 · 🔴 ningún alta de Customer se calla de quién es', () => {
  const mudas = altas.filter((c) => c.merchantId === false).map(donde);
  assert.deepEqual(mudas, [],
    `🔴 ${mudas.length} alta(s) de Customer NO escriben \`merchantId\`:\n\n${listar(mudas)}\n\n`
    + '    Así nació SCRUM-797: `POST /charges` creaba el cliente sin decir el dueño y la columna\n'
    + '    lo archivaba bajo el merchant 1 —LA CUENTA DEMO— en silencio, con HTTP 201.\n'
    + '    SE ARREGLA ESCRIBIENDO EL DUEÑO en ese `create`. El id del merchant ya está a mano en\n'
    + '    todos los caminos: ninguno crea un cliente sin saber de quién es.');
});

test('SCRUM-797 · 🔴 y en `src/` ninguna que no se pueda leer', () => {
  // `null` no es «la escribe»: es «no se sabe». En código de aplicación eso es un agujero, porque
  // absolver un camino sin haberlo mirado cuesta exactamente lo mismo que la omisión.
  const opacas = altas.filter((c) => c.merchantId === null && c.fichero.startsWith('src/')).map(donde);
  assert.deepEqual(opacas, [],
    `🔴 ${opacas.length} alta(s) de Customer en \`src/\` construyen su \`data\` de forma que no se\n`
    + `    puede leer si escriben el dueño:\n\n${listar(opacas)}\n\n`
    + '    SE ARREGLA PONIENDO `merchantId` VISIBLE en el literal, aunque venga también por spread.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ 🔴 y el defecto no vuelve por la puerta de atrás: la columna deja de donar
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-797 · 🔴 la columna del dueño NO vuelve a ser donante', () => {
  const donantes = [...modelos.values()].filter((m) => m.forma === 'default-1');
  assert.deepEqual(donantes.map((m) => `${m.modelo} → ${m.declaracion}`), [],
    '🔴 hay modelo(s) cuyo `merchantId` vuelve a tener `@default(1)`:\n\n'
    + listar(donantes.map((m) => `${m.modelo} → ${m.declaracion}`))
    + '\n\n    El merchant 1 es LA CUENTA DEMO. Un `@default(1)` ahí convierte cada olvido en una\n'
    + '    fila regalada al demo SIN UN SOLO ERROR. Con la columna obligatoria el olvido es\n'
    + '    ruidoso: Prisma se niega y se descubre al primer intento, no meses después.\n'
    + '    Firmado por el fundador el 7-sep-2026 («la más segura y más sólida»).');

  const customer = modelos.get('customer');
  assert.equal(customer && customer.forma, 'obligatorio',
    `🔴 \`Customer.merchantId\` está como \`${customer && customer.forma}\`, y tiene que ser`
    + ' obligatorio: es la columna que dice de qué profesional es cada cliente.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ ✅ CONTROL POSITIVO · el alta normal sigue estando bien, y no se la denuncia
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-797 · ✅ POSITIVO: el alta real (`createCustomer`) se ve y escribe el dueño', () => {
  // Si el instrumento no encuentra el camino real del alta, su «0 omiten» no vale nada: estaría
  // mirando un árbol donde no está el código que importa.
  const real = altas.find((c) => c.fichero === 'src/modules/system/customerAdmin.ts');
  assert.ok(real,
    '🔴 CIEGO: no veo el alta de `createCustomer` en `src/modules/system/customerAdmin.ts`.'
    + ' Es EL camino real del alta de clientes; si no lo veo, no estoy midiendo el árbol bueno.');
  assert.equal(real.merchantId, true,
    `🔴 el alta real (${donde(real)}) ha dejado de escribir el dueño.`);
  assert.equal(real.portalToken, true,
    `🔴 el alta real (${donde(real)}) ha dejado de escribir el portalToken.`);
});
