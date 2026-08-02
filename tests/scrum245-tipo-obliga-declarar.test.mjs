// SCRUM-245 FASE 2 · OLVIDAR EL MERCHANT NO COMPILA.
//
// La FASE 1 puso un guard que AVISA. Esto es la vuelta de tuerca de SCRUM-207: **imposible es
// mejor que vigilado**. El parámetro era `merchantId?: number`, y esa interrogación mentía —
// omitirlo era indistinguible de olvidarlo. Ahora hay que declarar una de las dos cosas:
//
//     merchantId: number                   → hay merchant, y queda rastro
//     sinMerchant: MotivoSinMerchant       → no lo hay, y consta POR QUÉ
//
// ALCANCE HONESTO, y hay que leerlo antes de creerse el verde: esto está aplicado a **4 de las 7
// vías** (`sendWhatsAppButtons`, `sendWhatsAppCtaUrl`, `sendWhatsAppList`,
// `sendWhatsAppLocationRequest`; `sendWhatsAppWindowFirst` ya exigía `merchantId: number` desde
// antes). Las que faltan:
//   · `sendWhatsAppText` — 30 de sus llamadores aún no declaran nada, y arreglar 21 de ellos es
//     la FASE 3. Acepta `sinMerchant` como
//     opcional para que los legítimos queden declarados ya.
//   · `sendWhatsAppTemplate` — le queda un llamador sin declarar, la rama «llamadas legacy» de
//     `whatsappNotifications`, hoy INALCANZABLE (sus dos llamadores sí pasan merchantId).
//
// Mientras tanto es el ratchet de la FASE 1 quien sostiene la regla en esas dos.
//
// POR QUÉ SE COMPRUEBA CON `tsc` Y NO LEYENDO EL FUENTE: un test que buscara `& DestinoDeEnvio`
// en el texto comprobaría que **está escrito**, no que **impide** nada — que es exactamente el
// error que SCRUM-235 vino a corregir en otro guard («está el código» ≠ «pasa lo que quiero»).
// Aquí se ejecuta el compilador, que es quien tiene la última palabra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(RAIZ, 'tests', 'fixtures');

/**
 * Los fixtures viven FUERA de `src`, que es lo único que compila el build (`tsconfig.include`).
 * Si entraran en `src`, el fichero que debe fallar rompería `npm run build` para todo el mundo.
 */
function compilar(fixture) {
  const tsc = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = spawnSync(process.execPath, [
    tsc, '--noEmit', '--strict', '--esModuleInterop',
    '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node', '--skipLibCheck',
    path.join(FIXTURES, fixture),
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { code: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('SCRUM-245 · el fixture que OMITE el merchant NO compila', () => {
  // El rojo del ticket. Si esto compilara, el tipo sería decorativo.
  const { code, salida } = compilar('scrum245-no-compila.ts');
  assert.notEqual(code, 0,
    '🔴 OLVIDAR EL MERCHANT COMPILA. El tipo no está obligando a nada: revisa que las vías lleven ' +
    '`& DestinoDeEnvio` y que la unión tenga los `?: never` que la hacen excluyente.');
  assert.match(salida, /sinMerchant/,
    '🔴 falla, pero por otro motivo: el error debe nombrar `sinMerchant` como lo que falta, o no ' +
    'estamos midiendo lo que creemos.');
});

test('SCRUM-245 · CONTROL NEGATIVO: declararlo bien SÍ compila', () => {
  // Tan importante como el rojo. Un tipo que no deja pasar lo legítimo se puentea con `as any` a
  // la primera prisa, y entonces no protege nada — solo estorba.
  const { code, salida } = compilar('scrum245-si-compila.ts');
  assert.equal(code, 0,
    `🔴 el uso CORRECTO no compila, y eso acaba en un \`as any\`:\n${salida}`);
});

test('SCRUM-245 · los fixtures existen y dicen para qué son', () => {
  // Suelo: si `compilar()` apuntara a un fichero que no existe, `tsc` fallaría igual y el primer
  // test pasaría en falso — rojo por «no encuentro el fichero», no por el tipo.
  for (const f of ['scrum245-no-compila.ts', 'scrum245-si-compila.ts']) {
    const ruta = path.join(FIXTURES, f);
    assert.ok(fs.existsSync(ruta), `🔴 falta el fixture ${f}: el rojo de arriba sería un falso rojo`);
    assert.match(fs.readFileSync(ruta, 'utf8'), /SCRUM-245/, 'el fixture debe decir de quién es');
  }
});

test('SCRUM-245 · los fixtures NO entran en el build de producción', () => {
  // Uno de ellos no compila A PROPÓSITO. Si `tsconfig` los incluyera, `npm run build` quedaría
  // roto para todas las sesiones.
  const tsconfig = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tsconfig.json'), 'utf8'));
  assert.deepEqual(tsconfig.include, ['src'],
    '🔴 el build ha dejado de compilar solo `src`: un fixture que no compila a propósito lo ' +
    'rompería. Si esto cambia, mueve los fixtures o exclúyelos explícitamente.');
});
