// SCRUM-242 · UN BACKUP QUE NO SE HA RESTAURADO NUNCA NO ES UN BACKUP.
//
// Sin gate: núcleo PURO + AST sobre el orquestador. Ni BD, ni red, ni ficheros de verdad.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE VIGILA ESTE FICHERO
//
// ① Que «no pude comprobarlo» y «está bien» NO puedan colapsar. Son tres veredictos y el del medio
//    —NO_VERIFICADO— es el que impide llamar backup a un fichero que nadie ha restaurado.
// ② Que el script NO IMPRIMA NI ESCRIBA una cadena de conexión. Ni real ni de ejemplo: la que se
//    escribe «para ilustrar» es la que alguien copia y pega con datos reales.
// ③ Que el destino externo NO se elija en el código (regla 36: coste recurrente, decide el fundador).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import {
  tablasDelInventario, veredictoDelBackup, destinoDeclarado, VERIFICADO, NO_VERIFICADO, CIEGO,
} from '../scripts/_backup-nucleo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORQ = 'scripts/backup-bd.mjs';
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// Inventario de `pg_restore --list` de mentira, con la forma real.
const INVENTARIO = `;
; Archive created at 2026-08-12 10:00:00
;     dbname: x
;
215; 1259 16385 TABLE public merchants postgres
216; 1259 16396 TABLE public customers postgres
217; 1259 16407 TABLE public charges postgres
3210; 0 16385 TABLE DATA public merchants postgres
`;

// ── ① EL CORAZÓN: los tres veredictos ────────────────────────────────────────────────────

test('SCRUM-242 · 🔴 sin restaurar NO es un backup: NO_VERIFICADO, y no es VERIFICADO', () => {
  const tablas = tablasDelInventario(INVENTARIO);
  const v = veredictoDelBackup(3, tablas, null); // null = nadie lo restauró
  assert.equal(v.estado, NO_VERIFICADO,
    '🔴 UN VOLCADO SIN RESTAURAR SE ESTÁ DANDO POR BUENO.\n\n'
    + '  Que el fichero exista y se pueda leer no prueba que sirva: puede estar truncado, ser de\n'
    + '  otra base o venir de un `pg_dump` incompatible. Las tres cosas producen bytes y fecha de\n'
    + '  hoy. Hasta que se restaure, esto es un fichero, no una copia.');
  assert.notEqual(v.estado, VERIFICADO);
  assert.match(v.motivo, /no se ha restaurado/, '🔴 el motivo no dice POR QUÉ no vale.');
});

test('SCRUM-242 · VERIFICADO exige restaurar Y que el recuento cuadre', () => {
  const tablas = tablasDelInventario(INVENTARIO);
  assert.equal(veredictoDelBackup(3, tablas, 3).estado, VERIFICADO,
    '🔴 con volcado legible, restauración hecha y recuentos iguales, tiene que salir VERIFICADO: '
    + 'si no, el camino bueno nunca se alcanza y el guard se desactiva por inútil.');
  // 🔴 Y una restauración que deja MENOS tablas no es un éxito parcial: no vale.
  assert.equal(veredictoDelBackup(3, tablas, 2).estado, CIEGO,
    '🔴 una restauración que deja 2 de 3 tablas se está dando por buena. Ahí falta una tabla '
    + 'entera y nadie se enteraría hasta necesitarla.');
});

test('SCRUM-242 · CIEGO cuando no se puede saber — y «no sé» ≠ «cero»', () => {
  const tablas = tablasDelInventario(INVENTARIO);
  assert.equal(veredictoDelBackup(null, tablas, 3).estado, CIEGO, '🔴 sin contar el origen no se puede afirmar nada.');
  assert.equal(veredictoDelBackup(3, null, 3).estado, CIEGO, '🔴 un volcado ilegible se está dando por bueno.');
  assert.equal(veredictoDelBackup(3, new Set(), null).estado, CIEGO,
    '🔴 un volcado que no declara NI UNA tabla se está tratando como «pendiente de restaurar». '
    + 'Existe y no sirve: eso es CIEGO, no NO_VERIFICADO.');
  // El que más duele: el volcado trae menos tablas que la base.
  assert.equal(veredictoDelBackup(24, tablas, null).estado, CIEGO,
    '🔴 el volcado declara 3 tablas y la base tiene 24, y no salta. Eso es exactamente un `pg_dump` '
    + 'que falló a medias y dejó un fichero con bytes dentro.');
});

test('SCRUM-242 · el inventario se LEE de verdad: «ilegible» no es «cero tablas»', () => {
  assert.equal(tablasDelInventario(''), null, '🔴 una salida vacía se lee como «cero tablas» en vez de «no se pudo leer».');
  assert.equal(tablasDelInventario(null), null);
  assert.equal(tablasDelInventario(undefined), null);
  const t = tablasDelInventario(INVENTARIO);
  assert.equal(t.size, 3, `🔴 el lector del inventario ve ${t.size} tablas y hay 3.`);
  // CONTROL POSITIVO del lector: `TABLE DATA` es contenido, no una tabla más. Si las contara, el
  // recuento saldría inflado y cuadraría con el origen por casualidad.
  assert.ok(!t.has('public.merchants postgres'), '🔴 el lector está contando líneas de TABLE DATA.');
});

// ── ② 🔴 NINGUNA CADENA DE CONEXIÓN, NI DE EJEMPLO ───────────────────────────────────────

test('SCRUM-242 · 🔴 el script no imprime ni escribe una cadena de conexión', () => {
  const fuentes = [leer(ORQ), leer('scripts/_backup-nucleo.mjs')];
  for (const src of fuentes) {
    // Ni una URL de Postgres en ningún sitio del fichero — comentarios incluidos, y ESO es a
    // propósito: la de ejemplo es la que alguien copia y rellena con datos reales.
    assert.doesNotMatch(src, /postgres(ql)?:\/\//i,
      '🔴 HAY UNA CADENA DE CONEXIÓN EN EL FUENTE. Aunque sea de ejemplo: la de ejemplo es la que '
      + 'se copia y se rellena con los datos de verdad.');
    assert.doesNotMatch(src, /PGPASSWORD\s*[:=]\s*['"`]/,
      '🔴 hay una contraseña escrita en el fuente.');
  }
  const orq = leer(ORQ);
  // Y lo que SÍ tiene que estar: las tres puertas del guard de la casa.
  for (const helper of ['describirBD', 'partirBDParaHijo', 'redactarSecretos']) {
    assert.ok(orq.includes(helper),
      `🔴 el orquestador no usa \`${helper}\` de \`_db-guard.mjs\`. Parsear una URL a mano es como `
      + 'se filtró una credencial de producción: el `catch` acaba imprimiendo el error, y el error '
      + 'ES la URL.');
  }
});

test('SCRUM-242 · 🔴 lo que se imprime del origen es la etiqueta segura, no la URL', () => {
  // Se deriva por AST: ningún `console.log/error` recibe la variable de la URL. Un `${urlOrigen}`
  // en una plantilla es exactamente cómo se publica una contraseña sin querer.
  const src = leer(ORQ);
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  const sospechosas = [];
  const PROHIBIDAS = ['urlOrigen', 'urlVerif', 'password', 'urlSinPass'];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && /^console\.(log|error|warn|info)$/.test(n.expression.getText(sf))) {
      const texto = n.arguments.map((a) => a.getText(sf)).join(' ');
      for (const mala of PROHIBIDAS) {
        // `describirBD(urlOrigen)` sí vale: la etiqueta es lo que sale, no la URL.
        const suelta = new RegExp(`(^|[^\\w.(])${mala}\\b`).test(texto.replace(/describirBD\([^)]*\)/g, ''));
        if (suelta) sospechosas.push(`línea ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${mala}`);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.deepEqual(sospechosas, [],
    `🔴 UN \`console\` RECIBE UNA URL O UNA CONTRASEÑA:\n    ${sospechosas.join('\n    ')}\n\n`
    + '  Lo que se imprime de una base es `describirBD()` → `host/base`. La URL entera no se '
    + 'imprime nunca, ni «solo en dev».');
});

// ── ③ EL DESTINO NO SE ELIGE AQUÍ ────────────────────────────────────────────────────────

test('SCRUM-242 · 🛑 el destino externo se LEE del entorno, no se elige en el código', () => {
  assert.equal(destinoDeclarado({}).hayDestino, false,
    '🔴 sin variables hay destino: alguien ha puesto uno por defecto. Contratar almacenamiento es '
    + 'coste recurrente (regla 36) y lo decide el fundador.');
  assert.match(destinoDeclarado({}).motivo, /no se sube/i);
  assert.equal(destinoDeclarado({ BACKUP_DESTINO_TIPO: 's3' }).hayDestino, false,
    '🔴 con tipo y sin ruta se da por configurado.');
  const d = destinoDeclarado({ BACKUP_DESTINO_TIPO: 's3', BACKUP_DESTINO_RUTA: 'copias/yaqu' });
  assert.equal(d.hayDestino, true);
  assert.equal(d.tipo, 's3');

  // Y en el fuente no hay ningún proveedor cableado.
  const src = leer(ORQ) + leer('scripts/_backup-nucleo.mjs');
  for (const proveedor of ['amazonaws', 'backblaze', 'cloudflarestorage', 'dropbox', 'gdrive']) {
    assert.ok(!src.toLowerCase().includes(proveedor),
      `🔴 el script trae «${proveedor}» cableado: el destino lo elige el fundador, no el código.`);
  }
});

// ── EL SUELO DEL PROPIO GUARD ────────────────────────────────────────────────────────────

test('SCRUM-242 · SUELO: el orquestador existe y sale con ERROR cuando no puede demostrarlo', () => {
  const src = leer(ORQ);
  assert.ok(src.length > 2000, `🔴 el orquestador tiene ${src.length} caracteres: no se está leyendo.`);
  // No basta con imprimir el veredicto: tiene que SALIR CON ERROR. Un script que avisa y devuelve 0
  // se integra en un cron que lo da por bueno.
  assert.match(src, /process\.exit\(1\)/,
    '🔴 el script no sale con código de error en ningún caso. Un backup que no se puede demostrar '
    + 'tiene que romper el cron, no dejar una línea en el log que nadie lee.');
  assert.match(src, /NO_VERIFICADO/, '🔴 el orquestador no distingue el caso «sin restaurar».');
  // Y la restauración no puede apuntar al origen: `--clean` borraría lo que se acaba de copiar.
  assert.match(src, /describirBD\(urlVerif\) === describirBD\(urlOrigen\)/,
    '🔴 no se comprueba que la base de verificación sea DISTINTA de la de origen. Se restaura con '
    + '`--clean`: apuntar al origen borraría la base que se acaba de copiar.');
});
