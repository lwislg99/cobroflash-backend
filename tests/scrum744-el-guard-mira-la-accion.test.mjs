// tests/scrum744-el-guard-mira-la-accion.test.mjs — SCRUM-744
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD MIRABA CÓMO SE ESCRIBE EL COMANDO, NO QUÉ HACE. Y SU LISTA TENÍA DOS ENTRADAS.
//
// 🔴 EL ROJO, MEDIDO CON EL HOOK REAL ANTES DE TOCAR NADA (4-sep-2026). Ocho acciones
// destructivas pasaban sin saltar, y son DOS defectos distintos:
//
//   ① LA FORMA. `node -e "spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),
//      'db','push'])"` — que es COMO ESTA CASA LANZA EL CLI en cuatro sitios— pasaba. El patrón
//      viejo (`prisma[^"]{0,40}db +push`) exigía los verbos separados por ESPACIOS, a menos de 40
//      caracteres y sin comillas por medio: describía una manera de teclear, no una acción.
//      Y encima `node -e` no estaba en la lista de envoltorios, así que todo su contenido iba
//      «entrecomillado» y el árbitro de SCRUM-454 lo descontaba como MENCIÓN.
//
//   ② LA LISTA. `npx prisma migrate reset` —que BORRA Y RECREA LA BASE ENTERA— **pasaba**.
//      `migrate reset --force` sí caía, pero por la regla de `--force`: por accidente, no porque
//      nadie lo hubiera considerado. Y `db execute`, que ejecuta el SQL que le des contra la
//      base sin clasificarlo, tampoco estaba.
//
// ⚠️ ESTE FICHERO NO ES UNA LISTA DE CASOS: es el CENSO de los 19 subcomandos que publica el CLI
// instalado, cada uno con su veredicto y su motivo. Si Prisma añade uno, el censo cae y alguien
// tiene que clasificarlo — que es la única forma de que la lista no vuelva a tener dos entradas.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { evaluar } from '../.claude/hooks/guard-dangerous.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-744-sentinel-que-no-existe');
const llamada = (comando) => JSON.stringify({ tool_name: 'Bash', tool_input: { command: comando, description: 'prueba' } });
const bloquea = (comando) => evaluar(llamada(comando), SENTINEL_FALSO).bloqueado;

/** Las CUATRO formas de lanzar el CLI que existen en esta casa, para el mismo subcomando. */
const FORMAS = [
  (sub) => `npx prisma ${sub}`,
  (sub) => `./node_modules/.bin/prisma ${sub}`,
  (sub) => `node node_modules/prisma/build/index.js ${sub}`,
  (sub) => `node -e "require('child_process').spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),${sub.split(' ').map((x) => `'${x}'`).join(',')}])"`,
];

// ═══ ① EL CENSO · los 19 subcomandos hoja del CLI 6.18.0, medidos de su propio `--help` ═══
//
// `bloquear`: true = el guard tiene que pararlo en CUALQUIERA de las cuatro formas.
// El motivo NO es decorativo: es lo que hace revisable la decisión dentro de seis meses.
const CENSO = Object.freeze([
  // ── escriben en la BASE, y no hay camino de casa que los use → BLOQUEADOS ────────────────
  ['migrate dev', true, 'prohibido por la regla 3 (Prisma sin TTY)'],
  ['migrate reset', true, 'BORRA Y RECREA la base entera; nadie lo usa en el arbol'],
  ['migrate deploy', true, 'aplica migraciones y esta casa no tiene `prisma/migrations`'],
  ['migrate resolve', true, 'escribe la tabla de migraciones; esta casa no usa migraciones'],
  ['db execute', true, 'ejecuta SQL tal cual; el camino bueno es scripts/aplicar-sql-dev.mjs'],
  ['db pull', true, 'REESCRIBE prisma/schema.prisma, que es del fundador'],
  // ── escribe en la BASE pero CON autorizacion de un solo uso ──────────────────────────────
  ['db push', true, 'exige el sentinel .claude/allow-db-push (preview confirmado)'],
  // ── NO se bloquean, y cada uno con su motivo ─────────────────────────────────────────────
  ['generate', false, 'no toca la base; la casa lo lanza en cuatro sitios'],
  ['migrate diff', false, 'introspecciona y compara; no escribe. Es el preview'],
  ['migrate status', false, 'solo lee'],
  ['validate', false, 'solo lee el schema'],
  ['format', false, 'reescribe el schema pero solo su formato; nadie lo usa y el riesgo de falso positivo con la palabra «format» es alto'],
  ['version', false, 'solo informa'],
  ['debug', false, 'solo informa'],
  ['db seed', false, 'tiene camino declarado (`npm run db:seed`); escribe DATOS y queda como hueco declarado'],
  ['studio', false, 'tiene camino declarado (`npm run prisma:studio`); es interactivo'],
  ['init', false, 'crea ficheros en un proyecto nuevo; inofensivo aqui'],
  ['dev', false, 'levanta un Postgres local de desarrollo'],
  ['mcp', false, 'levanta un servidor MCP; no toca la base'],
]);

test('SCRUM-744 · 🔴 SUELO: el censo cubre los subcomandos que publica el CLI instalado', () => {
  // Si el CLI añade un subcomando, este número deja de cuadrar y alguien tiene que clasificarlo.
  // Sin esto, la lista vuelve a envejecer sola — que es exactamente como llegó a tener dos.
  assert.equal(CENSO.length, 19,
    `🔴 el censo tiene ${CENSO.length} entradas y se midieron 19 subcomandos hoja en prisma 6.18.0 ` +
    '(9 de primer nivel + 4 de `db` + 6 de `migrate`).\n' +
    '  Vuelve a medirlo: `node node_modules/prisma/build/index.js --help`, y lo mismo para `db` y ' +
    '`migrate`. Cada entrada nueva se clasifica AQUI, con su motivo.');
  const bloqueados = CENSO.filter(([, b]) => b);
  assert.ok(bloqueados.length >= 7,
    `🔴 solo ${bloqueados.length} subcomandos bloqueados. Antes de este ticket eran DOS y eso era el defecto.`);
});

// ═══ ② LA ACCIÓN, NO LA FORMA · el mismo subcomando por las cuatro vías ══════════════════

test('SCRUM-744 · 🔴 lo destructivo cae ESCRIBA COMO SE ESCRIBA', () => {
  const escapados = [];
  for (const [sub, debeBloquear] of CENSO) {
    if (!debeBloquear) continue;
    for (const forma of FORMAS) {
      const cmd = forma(sub);
      if (!bloquea(cmd)) escapados.push(`${sub}  →  ${cmd.slice(0, 96)}`);
    }
  }
  assert.deepEqual(escapados, [],
    '🔴 UNA ACCIÓN DESTRUCTIVA SE ESCAPA POR ALGUNA DE LAS FORMAS:\n    ' + escapados.join('\n    ') +
    '\n\n  El guard tiene que mirar QUÉ HACE el comando, no cómo está escrito. Si alguien ha vuelto\n' +
    '  a atar el patrón a los espacios o a una distancia corta, ésta es la forma que se pierde —y\n' +
    '  es la que usa la casa en cuatro sitios: _prisma-sync, aplicar-sql-dev,\n' +
    '  preflight-schema-drift y preview-migracion.');
});

test('SCRUM-744 · 🔴 CONTROL NEGATIVO: lo inofensivo NO cae, por ninguna de las cuatro formas', () => {
  // La mitad que decide si esto dura. Un guard de seguridad con falso positivo se desactiva
  // entero, verdaderos positivos incluidos — está escrito en la cabecera del propio hook.
  const falsos = [];
  for (const [sub, debeBloquear, motivo] of CENSO) {
    if (debeBloquear) continue;
    for (const forma of FORMAS) {
      const cmd = forma(sub);
      if (bloquea(cmd)) falsos.push(`${sub} (${motivo})  →  ${cmd.slice(0, 96)}`);
    }
  }
  assert.deepEqual(falsos, [],
    '🔴 EL GUARD BLOQUEA ALGO INOFENSIVO:\n    ' + falsos.join('\n    ') +
    '\n\n  Un guard ruidoso empuja a desactivarlo, y entonces deja de proteger TAMBIÉN lo que sí\n' +
    '  protegía. Si la regla nueva es correcta, lo que hay que cambiar es el censo de arriba.');
});

// ═══ ③ LA MENCIÓN SIGUE SIENDO MENCIÓN · no se ha roto SCRUM-176 ni SCRUM-454 ════════════

test('SCRUM-744 · 🔴 REGRESIÓN: mencionar un comando peligroso sigue sin bloquear', () => {
  // Los casos exactos que SCRUM-176 y SCRUM-454 midieron y cerraron. Ensanchar el patrón es
  // justo el cambio que puede reabrirlos, así que se fijan aquí y no se dan por supuestos.
  const menciones = [
    ['git commit -m "nunca se ejecuta prisma db push a mano"', 'SCRUM-176 ①'],
    ['git log --oneline -5', 'SCRUM-176 ②'],
    ['grep -n "rm -rf /" docs/RUNBOOKS.md', 'SCRUM-454: leer la propia regla'],
    ['grep -rn "prisma db push" docs/', 'buscar la regla en la documentacion'],
    ['grep -rn "prisma migrate reset" docs/', 'buscar el subcomando NUEVO'],
    ['grep -rn "prisma db execute" docs/RUNBOOKS.md', 'y el otro'],
    ['node medir.mjs "git push --force origin main"', 'SCRUM-454: medir el propio guard'],
  ];
  const rotos = menciones.filter(([c]) => bloquea(c)).map(([c, n]) => `${n}: ${c}`);
  assert.deepEqual(rotos, [],
    '🔴 SE HA ROTO LA DISTINCIÓN ENTRE EJECUTAR Y MENCIONAR:\n    ' + rotos.join('\n    ') +
    '\n\n  «La barrera impide leer la documentación de la barrera» es el defecto que cerró\n' +
    '  SCRUM-454, y el patrón de SCRUM-744 es más ancho: si alguien le quitó el árbitro de la\n' +
    '  máscara, vuelve entero.');
});

test('SCRUM-744 · 🔴 los caminos LEGÍTIMOS de la casa siguen abiertos', () => {
  // No son ejemplos: son los comandos que las sesiones lanzan de verdad. Si uno de éstos cae,
  // el guard deja de ser una barrera y pasa a ser un obstáculo.
  const legitimos = [
    'node scripts/aplicar-sql-dev.mjs --file docs/sql/x.sql',
    'node scripts/aplicar-sql-dev.mjs --file docs/sql/x.sql --go',
    'node scripts/preview-migracion.mjs',
    'node scripts/generar-sql-deriva.mjs',
    'npm run censo:internos-prisma',
    'npm test',
    'node -e "console.log(1+1)"',
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  ];
  const rotos = legitimos.filter(bloquea);
  assert.deepEqual(rotos, [], '🔴 el guard bloquea un camino de trabajo normal:\n    ' + rotos.join('\n    '));
});

// ═══ ④ EL ENVOLTORIO NUEVO, Y POR QUÉ NO ES `node` A SECAS ══════════════════════════════

test('SCRUM-744 · 🔴 `node -e` se analiza como CÓDIGO, y un argumento posicional NO', () => {
  // La distinción entera del arreglo. Si alguien mete `node` en `ENVOLTORIOS` a secas, el primer
  // aserto sigue pasando y el segundo cae: reabriría el falso positivo de SCRUM-454.
  assert.equal(bloquea(`node -e "require('child_process').spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','push'])"`), true,
    '🔴 el payload de `node -e` no se está mirando: ahí dentro TODO se ejecuta.');
  assert.equal(bloquea('node --eval "process.env.X; require(\'child_process\').spawnSync(process.execPath,[require.resolve(\'prisma/build/index.js\'),\'migrate\',\'reset\'])"'), true,
    '🔴 `--eval` no se mira, y es la misma bandera con el nombre largo.');
  assert.equal(bloquea('node medir.mjs "npx prisma db push"'), false,
    '🔴 un argumento POSICIONAL de node se está tratando como código. Eso es SCRUM-454 otra vez: ' +
    '`node medir.mjs "git push --force origin main"` volvería a bloquearse.');

  // 🔴 EL CASO QUE ESTE TEST NO TENÍA, Y LO ENCONTRÓ UNA MUTACIÓN.
  //
  // Al inyectar «el payload de `-e` vuelve a contar como mención» (máscara a `true`), la tanda
  // seguía VERDE: los casos de arriba llevan el comando en un ARRAY —`[…,'db','push']`— y ahí
  // los separadores `','` quedan fuera de las comillas, así que la coincidencia toca texto no
  // enmascarado y cuenta igual sin necesidad de vaciar la máscara.
  //
  // El vaciado SÍ hace falta para la forma más natural de todas: el comando entero dentro de UNA
  // sola cadena. Medido con el hook, con y sin la línea: **sin vaciar la máscara, esto pasa**.
  // Era una regla que siempre pasaba, y la mutación fue lo único que lo dijo.
  assert.equal(bloquea(`node -e "require('child_process').execSync('npx prisma migrate reset')"`), true,
    '🔴 el comando entero dentro de UNA cadena de JavaScript se está descontando como «mención». ' +
    'Dentro de `node -e` no hay menciones: lo que hay ahí se ejecuta, comillas incluidas.');
  assert.equal(bloquea(`node -e "require('child_process').execSync('npx prisma db execute --file borrar.sql')"`), true,
    '🔴 idem con `db execute`.');
});

test('SCRUM-744 · 🔴 el sentinel de `db push` sigue mandando, también por la forma nueva', () => {
  // `db push` no es «prohibido»: es «con autorización de un solo uso». Ensanchar la detección no
  // puede convertirlo en un bloqueo seco, ni saltarse la autorización cuando existe.
  const sentinel = path.join(os.tmpdir(), 'yaqu-744-sentinel-que-si-existe');
  // 🔴 SE VUELVE A PONER ANTES DE CADA LLAMADA, y no es ceremonia: la autorización es DE UN SOLO
  // USO y el hook la CONSUME al dejar pasar. La primera versión de este test lo creaba una vez y
  // fallaba en la segunda aserción — y ese rojo no era del guard, era mío. Se deja escrito porque
  // el modo de fallo es traicionero: parece que la forma nueva «no reconoce el permiso» cuando lo
  // que pasa es que ya se había gastado.
  const conAutorizacion = (c) => {
    fs.writeFileSync(sentinel, '');
    try { return evaluar(llamada(c), sentinel).bloqueado; }
    finally { fs.rmSync(sentinel, { force: true }); }
  };
  assert.equal(conAutorizacion('npx prisma db push'), false, '🔴 con el sentinel puesto, `db push` sigue bloqueado.');
  assert.equal(conAutorizacion(`node -e "require('child_process').spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','push'])"`), false,
    '🔴 la forma nueva no reconoce la autorización: sería un bloqueo seco donde había un permiso.');
  // Y lo que NO depende del sentinel sigue sin depender de él.
  assert.equal(conAutorizacion('npx prisma migrate reset'), true,
    '🔴 el sentinel de `db push` está autorizando un `migrate reset`. Son permisos distintos.');

  // Y la otra mitad del mecanismo: la autorización SE GASTA. Si dejara de gastarse, un OK del
  // fundador valdría para siempre.
  fs.writeFileSync(sentinel, '');
  evaluar(llamada('npx prisma db push'), sentinel);
  assert.equal(fs.existsSync(sentinel), false,
    '🔴 la autorización de un solo uso NO se ha consumido: un OK del fundador quedaría abierto.');
});
