// SCRUM-822 · UN PUNTO EN LA RUTA DEL ÁRBOL, Y EL PRODUCTO DEJA DE SERVIR SUS PÁGINAS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y POR QUÉ SE LEÍA COMO OTRA COSA
//
// Dos guards —SCRUM-329 (enlaces legales) y SCRUM-334 (destino de los CTA)— salían en rojo
// diciendo «/privacidad y /terminos responden 404». Sonaba a landing con enlaces rotos. No lo
// era: el producto estaba sano y producción servía las dos páginas con 200.
//
// Lo que fallaba es el ARRANQUE del banco, y por un motivo que no se ve leyendo la línea que
// lo hace. `res.sendFile(rutaAbsoluta)` SIN `root` hace que `send` parta la ruta ENTERA —el
// path de instalación incluido— y le aplique su regla de dotfiles (`send/index.js:451-470`,
// `containsDotFile`): cualquier tramo que empiece por `.` y mida más de un carácter devuelve
// **404 con el fichero presente y legible**. Un checkout desechable bajo `.claude/worktrees/`,
// un `.tmp`, un árbol de laboratorio: todos caen. Producción vive en `/app` (Railway), sin
// puntos, así que el sitio público nunca lo sufrió.
//
// La firma que lo delataba estaba a la vista y nadie la miró: la MISMA página respondía **200
// como `/privacidad.html`** (la sirve `express.static`, que sí pasa `root`) y **404 como
// `/privacidad`** (la sirve `res.sendFile`, que no lo pasaba). No es «falta la ruta»: es la
// misma ruta, el mismo fichero y dos maneras de servirlo, una inmune y otra no.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA ESTE FICHERO, Y POR QUÉ ESTAS TRES COSAS
//
// ① EL MECANISMO, provocado. Un banco de verdad en dos carpetas que sólo se diferencian en un
//    punto. Sin esto, el censo de ② sería una regla de estilo que nadie sabe por qué existe: el
//    día que alguien la relaje, este caso le enseña QUÉ se rompe.
// ② EL CENSO (AST, no grep). Ningún `res.sendFile` del producto puede ir sin `root`. Con SUELO:
//    si el censo deja de VER llamadas, calla en verde y no vigila nada.
// ③ EL CONTROL DEL CENSO. Se le dan en la mano las dos formas —con y sin `root`— y tiene que
//    acusar a una y absolver a la otra. Un censo que no sabe decir que NO no es un censo.
//
// ⚠️ Sin gate: no toca BD, ni red externa, ni el árbol del repo. Escribe sólo en `os.tmpdir()`.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * GET por `node:http` y con `agent: false`.
 *
 * NO se usa `fetch` a propósito: es el remedio que SCRUM-100 dejó probado y que SCRUM-560
 * volvió a aplicar en `scrum334-destino-de-los-cta.test.mjs:44-57`. Con varias peticiones de
 * undici sobre el mismo `app.listen(0)`, el proceso puede reventar al cerrar con una aserción
 * de libuv. Sin pool, cada petición abre y cierra la suya.
 */
function pedir(puerto, ruta) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: puerto, path: ruta, method: 'GET', agent: false },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (t) => { data += t; });
        res.on('end', () => resolve({ status: res.statusCode, cuerpo: data }));
      },
    );
    req.on('error', (e) => resolve({ status: 0, cuerpo: '', _err: e?.message }));
    req.end();
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL MECANISMO · el mismo fichero, la misma línea, y un punto de diferencia
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Levanta un banco con `public/pagina.html` dentro de `<tmp>/<carpeta>/` y mide las TRES
 * maneras de pedir la misma página: `sendFile` sin `root`, `sendFile` con `root`, y el
 * estático. La única variable entre llamadas es el nombre de `carpeta`.
 */
async function bancoEn(carpeta) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum822-'));
  const publicDir = path.join(base, carpeta, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'pagina.html'), '<h1>contenido</h1>');

  const app = express();
  app.use(express.static(publicDir));
  app.get('/sin-root', (_q, r) => r.sendFile(path.join(publicDir, 'pagina.html')));
  app.get('/con-root', (_q, r) => r.sendFile('pagina.html', { root: publicDir }));
  // El 404 de `send` viaja por `next(err)`; sin este manejador Express imprimiría el stack
  // completo en la salida de la tanda por cada caso. El ESTADO no lo decide esto: lo trae
  // `err.status`, que es justo lo que se mide.
  app.use((err, _q, r, _n) => r.status(err?.status || 500).end());

  const s = app.listen(0);
  await new Promise((r) => s.once('listening', r));
  const p = s.address().port;
  const medida = {
    carpeta,
    elFicheroExiste: fs.existsSync(path.join(publicDir, 'pagina.html')),
    sinRoot: (await pedir(p, '/sin-root')).status,
    conRoot: (await pedir(p, '/con-root')).status,
    estatico: (await pedir(p, '/pagina.html')).status,
  };
  await new Promise((r) => s.close(r));
  fs.rmSync(base, { recursive: true, force: true });
  return medida;
}

test('SCRUM-822 · MECANISMO: bajo un directorio con punto, `sendFile` sin `root` da 404', async () => {
  const normal = await bancoEn('arbol-normal');
  const conPunto = await bancoEn('.arbol-desechable');

  // El control que hace legible al caso: en un árbol sin puntos las tres maneras dan 200, así
  // que lo que cambia abajo NO es el banco, ni el fichero, ni la petición — es el punto.
  assert.deepEqual(
    { existe: normal.elFicheroExiste, sinRoot: normal.sinRoot, conRoot: normal.conRoot, estatico: normal.estatico },
    { existe: true, sinRoot: 200, conRoot: 200, estatico: 200 },
    `🔴 CIEGO: en un árbol SIN puntos las tres maneras deberían servir la página, y salió ${JSON.stringify(normal)}.\n` +
    '  Si esto no da 200 tres veces, el caso de abajo no prueba nada sobre el punto: prueba que el banco no sirve.',
  );

  assert.equal(conPunto.elFicheroExiste, true, '🔴 el banco no llegó a escribir la página: medición inválida');
  assert.equal(
    conPunto.estatico, 200,
    '🔴 `express.static` también cayó bajo el directorio con punto. Es la mitad SANA de la ' +
    'comparación: si cae, lo de abajo ya no distingue `sendFile` de «aquí no se sirve nada».',
  );
  assert.equal(
    conPunto.sinRoot, 404,
    '🔴 EL DEFECTO DE SCRUM-822 YA NO SE REPRODUCE. O `send` cambió su regla de dotfiles, o este ' +
    'banco dejó de montar el caso. Compruébalo antes de tocar nada: el censo de abajo existe ' +
    'PORQUE esto pasa, y un censo cuya razón de ser ya no se puede provocar es una regla huérfana.',
  );
  assert.equal(
    conPunto.conRoot, 200,
    '🔴 CON `root` TAMBIÉN CAE, y entonces el arreglo de SCRUM-822 no arregla nada: el producto ' +
    'quedaría sin servir sus páginas legales en cualquier árbol bajo un directorio con punto.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL CENSO · ningún `res.sendFile` del producto va sin `root`
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Lee las llamadas a `.sendFile(...)` por AST, no por `grep`: el texto no distingue una llamada
 * de una mención en un comentario, y este mismo fichero está lleno de menciones.
 */
function censarSendFile(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const todas = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)
        && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'sendFile') {
      const opciones = n.arguments[1];
      const conRoot = !!opciones
        && ts.isObjectLiteralExpression(opciones)
        && opciones.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'root');
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      todas.push({ donde: `${nombre}:${line + 1}`, conRoot, texto: n.getText(sf).replace(/\s+/g, ' ') });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return todas;
}

function censoDelProducto() {
  const out = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.ts')) out.push(...censarSendFile(fs.readFileSync(p, 'utf8'), path.relative(RAIZ, p).replace(/\\/g, '/')));
    }
  };
  recorrer(path.join(RAIZ, 'src'));
  return out;
}

/**
 * SUELO. Medido el 7-sep-2026: 6 llamadas (3 páginas públicas en `app.ts` + 3 PDF). Se fija por
 * DEBAJO y no en el número exacto a propósito: añadir una llamada nueva es legítimo y no debe
 * romper la tanda — lo que no puede pasar es que el censo deje de ver las que hay.
 */
const SUELO_LLAMADAS = 6;

test('SCRUM-822 · SUELO: el censo VE las llamadas antes de decir que están bien', () => {
  const todas = censoDelProducto();
  assert.ok(
    todas.length >= SUELO_LLAMADAS,
    `🔴 CENSO CIEGO: veo ${todas.length} llamadas a \`sendFile\` en \`src/\` y el suelo son ` +
    `${SUELO_LLAMADAS}. Si el AST dejó de casarlas, el caso de abajo pasaría sin haber mirado ` +
    'ni una línea del producto — y ese verde es la mentira que este fichero vino a evitar.',
  );
});

test('SCRUM-822 · ningún `res.sendFile` del producto sirve sin `root`', () => {
  const sinRoot = censoDelProducto().filter((c) => !c.conRoot);
  assert.deepEqual(
    sinRoot.map((c) => `${c.donde} · ${c.texto}`), [],
    '🔴 HAY `sendFile` SIN `root`, y eso devuelve 404 —con el fichero presente— en cuanto el\n' +
    '  árbol viva bajo un directorio que empiece por punto (un worktree desechable, un `.tmp`,\n' +
    '  `.claude/worktrees/…`). No es teoría: es el rojo de SCRUM-822, que tuvo dos guards\n' +
    '  acusando a la landing durante días mientras producción servía las páginas con 200.\n\n' +
    '  El arreglo es una línea: `res.sendFile(nombre, { root: carpeta })` en vez de\n' +
    '  `res.sendFile(path.join(carpeta, nombre))`. Mismo comportamiento donde ya funcionaba,\n' +
    '  y de paso confina lo servido a `carpeta`.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CONTROL DEL CENSO · sabe acusar, y sabe absolver
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-822 · CONTROL: el censo acusa a la forma mala y absuelve a la buena', () => {
  const mala = censarSendFile("res.sendFile(path.join(dir, 'x.html'));", 'mentira.ts');
  assert.equal(mala.length, 1, '🔴 el censo no ve una llamada que tiene delante');
  assert.equal(mala[0].conRoot, false, '🔴 el censo da por buena una llamada SIN `root`: está ciego');

  const buena = censarSendFile("res.sendFile('x.html', { root: dir });", 'verdad.ts');
  assert.equal(buena.length, 1);
  assert.equal(buena[0].conRoot, true, '🔴 el censo acusa a una llamada CORRECTA: sería un rojo falso, y un rojo falso se ignora');

  // Y que no confunda una MENCIÓN con una llamada: si contara texto en vez de sintaxis, el
  // comentario de cabecera de este mismo fichero lo pondría rojo.
  const mencion = censarSendFile('// aquí se hablaba de res.sendFile(x) sin root\nconst a = 1;', 'comentario.ts');
  assert.deepEqual(mencion, [], '🔴 el censo cuenta texto, no llamadas: cualquier comentario lo pondría rojo');

  // Un `root` en la posición equivocada NO cuenta: es el error que se comete al arreglar esto
  // deprisa, y pasaría desapercibido porque «la palabra root está ahí».
  const posicionMala = censarSendFile("res.sendFile({ root: dir }, 'x.html');", 'posicion.ts');
  assert.equal(posicionMala[0].conRoot, false, '🔴 acepta `root` en el primer argumento, donde `send` no lo lee');
});
