// SCRUM-195 — ningún error de parseo o de subproceso puede imprimir una URL de BD.
// Sin gate: funciones puras + lectura de ficheros.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE, dicho sin adornos: en esta misma tarea filtré la contraseña de PRODUCCIÓN.
// Un script de medición leyó `DATABASE_URL` del `.env` sin quitarle las comillas, llamó a
// `new URL(...)` a pelo, y el `ERR_INVALID_URL` —que lleva la cadena ENTERA en `.message`—
// se volcó a la salida del comando. Hubo que rotar la credencial.
//
// LO QUE ESTE GUARD **NO** PUEDE HACER, y hay que decirlo antes que nada: aquel script vivía
// en el scratchpad, fuera del repo. Ningún test del repo lo habría parado, y este tampoco
// pararía al siguiente. Lo que sí hace es quitar la excusa: existe `parseBDSegura` y existe
// `redactarSecretos`, están en el fichero por el que ya pasa todo el que mira una URL de BD, y
// el repo no puede volver a la forma insegura sin que esto se ponga rojo.
//
// LA REGLA OPERATIVA, y el motivo de que el scan de abajo mire el DIRECTORIO y no git:
// **ningún script parsea una URL de BD a mano, ni siquiera uno desechable.** Se usa
// `parseBDSegura`. Y los desechables de BD van en `scripts/tmp-*.mjs` —ignorado por git— en
// vez de en el scratchpad: ahí el import de `_db-guard.mjs` es relativo, `@prisma/client`
// resuelve solo, y sobre todo **este guard los ve**. `readdirSync` lee el directorio, así que
// **un fichero ignorado sigue siendo un fichero escaneado**; en el scratchpad no lo ve nadie.
// El camino corto y el seguro, el mismo — que es lo único que funciona en zona sin red.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { soloEjecutable } from './_guard-texto.mjs';
import { parseBDSegura, describirBD, redactarSecretos } from '../scripts/_db-guard.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Una URL con la MISMA FORMA que la que se filtró. El valor es inventado; lo que importa es
// que el test pueda afirmar «esta subcadena no aparece en la salida».
const SECRETO = 'pAssw0rd-inventada-DE-MENTIRA';
const URL_BD = `postgresql://postgres:${SECRETO}@autorack.proxy.rlwy.net:23456/railway`;
// Y la forma exacta que reventó: con las comillas del `.env` pegadas.
const URL_CON_COMILLAS = `'${URL_BD}'`;

// ── 1. El parseo seguro: ni acertando ni fallando puede devolver la cadena ───────────────

test('SCRUM-195 · parseBDSegura devuelve host y base, nunca la contraseña', () => {
  const p = parseBDSegura(URL_BD);
  assert.equal(p.host, 'autorack.proxy.rlwy.net');
  assert.equal(p.base, 'railway');
  assert.ok(
    !JSON.stringify(p).includes(SECRETO),
    '🔴 el objeto devuelto lleva la contraseña dentro. Da igual que quien llame no la use hoy: ' +
      'el primero que haga `console.log(p)` para depurar la publica.',
  );
});

test('SCRUM-195 · parseBDSegura tolera las comillas del .env — la causa EXACTA de la fuga', () => {
  const p = parseBDSegura(URL_CON_COMILLAS);
  assert.ok(
    p !== null && p.host === 'autorack.proxy.rlwy.net',
    '🔴 con las comillas pegadas devuelve null. Ese es el caso REAL: la primera sonda las quitó, ' +
      'la segunda no, y `new URL()` lanzó con la contraseña dentro del mensaje. Si el parseo ' +
      'seguro tampoco las tolera, el siguiente vuelve a hacerlo a mano y volvemos a rotar.',
  );
});

test('SCRUM-195 · con una URL rota devuelve null, sin lanzar y sin decir qué era', () => {
  let r;
  assert.doesNotThrow(() => { r = parseBDSegura('no-soy-una-url ' + SECRETO); },
    '🔴 lanza. Un throw aquí lleva la cadena en el mensaje: es literalmente la fuga.');
  assert.equal(r, null);
  assert.ok(
    !describirBD('no-soy-una-url ' + SECRETO).includes(SECRETO),
    '🔴 la etiqueta de log incluye el valor ilegible. «Ilegible» ya es toda la información útil.',
  );
  assert.ok(!describirBD(URL_BD).includes(SECRETO), '🔴 describirBD publica la contraseña');
});

// ── 2. El redactor: para los errores AJENOS, que son los que de verdad muerden ───────────

// ⚠️ CORRECCIÓN A MI PROPIA PREMISA, que es el hallazgo más útil de esta tarea. La primera
// versión de este test daba por hecho que `new URL()` mete la cadena en `.message`. NO LO HACE:
// en Node 24 el mensaje es solo «Invalid URL» y la URL viaja en la propiedad `e.input`. Lo que
// publicó la credencial fue el VOLCADO DEL OBJETO del manejador de excepciones no capturadas.
// Consecuencia práctica: el reflejo de `console.error(e.message)` no habría evitado nada.
test('SCRUM-195 · en `new URL` la cadena NO va en .message, va en el objeto', () => {
  let err;
  try { new URL(URL_CON_COMILLAS); } catch (e) { err = e; }
  assert.ok(
    !String(err.message).includes(SECRETO),
    'Si esto se pone rojo, Node ha cambiado y ahora `.message` SÍ lleva la URL: revisa todos los ' +
      '`console.error(e.message)` del repo, que hasta hoy eran seguros para este vector.',
  );
  assert.ok(inspect(err).includes(SECRETO), 'premisa: el objeto SÍ la lleva (en `e.input`)');

  const limpio = redactarSecretos(err);
  assert.ok(
    !limpio.includes(SECRETO),
    '🔴 el redactor no limpia el OBJETO de error. Redactar solo cadenas deja fuera justo el vector ' +
      'que filtró la credencial de producción en esta tarea.',
  );
  // Y ESTA es la mitad que faltaba. Sin ella, un redactor que devolviese `String(err)` —o la
  // cadena vacía— pasaba el test: «no contiene el secreto» también lo cumple quien tira la
  // información a la basura. Exigir el host prueba que ha MIRADO dentro del objeto y ha
  // redactado, en vez de haberse quedado con el `toString()` de la primera línea. Verificado:
  // con el redactor limitado a cadenas, esta línea es la que se pone roja.
  assert.ok(
    limpio.includes('autorack.proxy.rlwy.net'),
    '🔴 el redactor no llega a las propiedades del error (`input`, `spawnargs`): devuelve solo su ' +
      'primera línea. Sale «limpio» porque no lleva NADA, y eso deja el diagnóstico a ciegas.',
  );
});

test('SCRUM-195 · redactarSecretos limpia las DOS vías de execFileSync', () => {
  // (a) salida ≠ 0 → la URL va en `.message`, forma literal verificada contra Node 24.
  const msg = `Command failed: pg_dump --format=custom --no-owner ${URL_BD}`;
  const limpio = redactarSecretos(msg);
  assert.ok(!limpio.includes(SECRETO), '🔴 sigue publicando la contraseña del backup');
  assert.ok(
    limpio.includes('autorack.proxy.rlwy.net'),
    '🔴 se ha redactado también el host. El host hace falta para diagnosticar y es público: ' +
      'redactarlo convierte el error en inútil y empuja a quitar el redactor.',
  );

  // (b) ENOENT (pg_dump no instalado) → `.message` sale limpio, pero `spawnargs` lleva la URL.
  const enoent = Object.assign(new Error('spawnSync pg_dump ENOENT'), {
    spawnargs: ['--format=custom', '--no-owner', URL_BD],
  });
  assert.ok(!String(enoent.message).includes(SECRETO), 'premisa: en ENOENT el mensaje es limpio');
  assert.ok(
    !redactarSecretos(enoent).includes(SECRETO),
    '🔴 no limpia `spawnargs`. Es el caso más probable de todos: `pg_dump` no instalado en la ' +
      'máquina donde se lanza el backup.',
  );
});

test('SCRUM-195 · el redactor no depende del esquema ni del nombre del usuario', () => {
  for (const u of [
    `postgres://cualquiera:${SECRETO}@h:5432/d`,
    `redis://default:${SECRETO}@h:6379`,
    `amqps://x:${SECRETO}@h/v`,
  ]) {
    assert.ok(!redactarSecretos(u).includes(SECRETO), `🔴 se escapa por ${u.split(':')[0]}`);
  }
});

// ── 3. El repo no puede volver a la forma insegura ───────────────────────────────────────

test('SCRUM-195 · ningún script parsea una URL de BD con `new URL` a pelo', () => {
  const dir = path.join(RAIZ, 'scripts');
  // `_db-guard.mjs` es el ÚNICO exento: es donde vive el parseo seguro, y su `new URL` está
  // dentro del try cuyo catch no toca el error. Excepción DECLARADA, no silenciosa.
  const EXENTOS = new Set(['_db-guard.mjs']);
  const culpables = [];

  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') && !EXENTOS.has(f))) {
    const codigo = soloEjecutable(fs.readFileSync(path.join(dir, f), 'utf8')); // principio 10
    // `new URL(<algo con pinta de URL de BD>)`.
    const m = codigo.match(/new URL\(\s*([A-Za-z_$][\w$.]*)/g) || [];
    for (const hit of m) {
      const arg = hit.replace(/new URL\(\s*/, '');
      if (/db|database|conn|dsn|postgres|pg/i.test(arg)) culpables.push(`${f} → ${hit})`);
    }
  }

  assert.deepEqual(
    culpables,
    [],
    `🔴 ${culpables.join(', ')} parsea una URL de BD a pelo. Si esa URL viene con comillas del ` +
      `.env, o mal formada de cualquier otra manera, \`new URL()\` lanza un error que lleva la ` +
      `CADENA ENTERA —contraseña incluida— en su \`.message\`, y el primer \`console.error(e.message)\` ` +
      `la publica. Ya pasó con producción. Usa \`parseBDSegura\` de scripts/_db-guard.mjs.`,
  );
});

test('SCRUM-195 · el backup redacta antes de imprimir un fallo', () => {
  // El backup corre contra PRODUCCIÓN por definición, y pasa la URL en argv porque `pg_dump`
  // la quiere ahí: es el sitio del repo donde este fallo cuesta más caro.
  const codigo = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'scripts', 'backup-dump.mjs'), 'utf8'));

  // Cualquier `console.error`/`throw` que toque una variable de error. Se comprueba la
  // PROPIEDAD («va redactado»), no una forma concreta: la primera versión de este assert
  // buscaba el literal `e?.message` y se quedó sin premisa en cuanto mejoré el propio arreglo
  // —el guard medía mi redacción de entonces, no la seguridad.
  const sospechosas = [...codigo.matchAll(/(?:console\.(?:error|log|warn)|throw new Error)\([^\n]*?\b(?:e|err|error)\b[^\n]*/g)]
    .map((m) => m[0].trim());
  assert.ok(sospechosas.length > 0, 'premisa: el script imprime o relanza errores en algún sitio');
  for (const linea of sospechosas) {
    assert.ok(
      /redactarSecretos/.test(linea),
      `🔴 \`${linea}\` saca un error sin redactar. Este script pasa la DATABASE_URL de PRODUCCIÓN ` +
        `en argv de \`pg_dump\`: al fallar, la contraseña sale por \`.message\` (exit ≠ 0) o por ` +
        `\`.spawnargs\` (ENOENT). Y un backup corre contra prod por definición.`,
    );
  }
});

// ── 4. Que el mecanismo siga siendo alcanzable ───────────────────────────────────────────

test('SCRUM-195 · el parseo seguro vive junto a los hosts, donde ya pasa todo el mundo', () => {
  const g = fs.readFileSync(path.join(RAIZ, 'scripts', '_db-guard.mjs'), 'utf8');
  const codigo = soloEjecutable(g);
  assert.ok(/export function parseBDSegura/.test(codigo) && /export function redactarSecretos/.test(codigo),
    '🔴 el helper se ha movido o renombrado: los scripts que lo importan se quedan sin él');
  // ACOTADO al cuerpo de `parseBDSegura`. La primera versión buscaba `catch {` en todo el
  // fichero y la satisfacía el catch de `hostOf`, que también es ciego: el guard daba verde
  // midiendo una función distinta de la que dice proteger.
  const cuerpo = codigo.slice(
    codigo.indexOf('export function parseBDSegura'),
    codigo.indexOf('export function describirBD'),
  );
  assert.ok(cuerpo.includes('new URL('), 'premisa: el cuerpo acotado es el que parsea');
  assert.ok(
    /catch \{/.test(cuerpo) && !/catch\s*\(/.test(cuerpo),
    '🔴 el catch de `parseBDSegura` ha dejado de ser ciego. En cuanto el error se captura en una ' +
      'variable, tarde o temprano alguien lo imprime — y ese objeto lleva la URL entera en ' +
      '`e.input`. El catch sin binding es lo que hace imposible esa línea.',
  );
});
