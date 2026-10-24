// tests/scrum1603-el-banco-mide-con-la-fuente-del-panel.test.mjs — SCRUM-1603
//
// Sin gate: lee scripts/ y public/, y levanta el servidor del banco en 127.0.0.1. Ni BD ni navegador.
//
// LO QUE IMPIDE. Los tres bancos que montan el panel a mano enlazaban `tokens.css` y `styles.css`
// escritos a mano, y el índice enlaza además `/fonts/inter.css`. El banco medía con la fuente de
// reserva y producción con Inter: «Descuento global» 44,6 en el banco y 43,6 en yaqu.app (SCRUM-962g),
// el campo `.input` 36 px en el banco y 34 en la app (SCRUM-1603 c.20680). Un veredicto del banco a
// menos de 1 px del umbral no predecía producción.
//
// La GEOMETRÍA la miden en navegador `guard:objetivo-tactil`, `censo:tactil-panel` y el recorrido del
// editor de SCRUM-962c (ver `docs/master/SCRUM-1603.md`, tramo 1603b). Este test vigila lo que la sostiene:
//   ① las hojas del banco son LAS DEL ÍNDICE, con la de la fuente;
//   ② la página de `_banco-lista.mjs` las enlaza, sirve las letras y ESPERA la fuente antes de «lista»;
//   ③ el «antes» que materializa `arbolDePartida` lleva las letras (si no, antes y después miden con
//      fuentes distintas y todo guard que los compara dice «HA CAMBIADO»);
//   ④ el guard táctil y el censo montan con esas hojas y esperan la fuente en CADA navegación;
//   ⑤ el veredicto sobre el recuento de caras: una fuente rota o sin cargar es un CIEGO.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const { hojasDelPanel, ESPERAR_FUENTES, cegueraDeLaFuente } = await import('../scripts/_hojas-del-panel.mjs');
const { servirListas, EXTENSIONES_DEL_ARBOL } = await import('../scripts/_banco-lista.mjs');

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_hojas-del-panel.mjs',
    de: '  return r.locales.map((h) => new URL(',
    a: '  return r.locales.filter((h) => !h.includes(\'/fonts/\')).map((h) => new URL(',
    cae: 'SCRUM-1603 ① ·',
  },
  {
    fichero: 'scripts/_banco-lista.mjs',
    de: '${enlacesDelPanel(publico)}',
    a: '<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">',
    cae: 'SCRUM-1603 ② ·',
  },
  {
    fichero: 'scripts/_banco-lista.mjs',
    de: '    window.__fuentes = await ${ESPERAR_FUENTES};',
    a: '    window.__fuentes = null;',
    cae: 'SCRUM-1603 ② ·',
  },
  {
    fichero: 'scripts/_banco-lista.mjs',
    de: 'export const EXTENSIONES_DEL_ARBOL = /\\.(html|css|js|woff2)$/;',
    a: 'export const EXTENSIONES_DEL_ARBOL = /\\.(html|css|js)$/;',
    cae: 'SCRUM-1603 ③ ·',
  },
  {
    fichero: 'scripts/guard-objetivo-tactil.mjs',
    de: '  const f = await esperarFuentes(page);',
    a: '  const f = null;',
    cae: 'SCRUM-1603 ④ ·',
  },
  {
    fichero: 'scripts/censo-objetivo-tactil-panel.mjs',
    de: 'const HOJAS = enlacesDelPanel(PUBLIC);',
    a: 'const HOJAS = \'<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">\';',
    cae: 'SCRUM-1603 ④ ·',
  },
  {
    fichero: 'scripts/_hojas-del-panel.mjs',
    de: '  if (f.fallidas > 0) return',
    a: '  if (false) return',
    cae: 'SCRUM-1603 ⑤ ·',
  },
  {
    fichero: 'scripts/_hojas-del-panel.mjs',
    de: '  if (f.hojasSinCargar.length) return',
    a: '  if (false) return',
    cae: 'SCRUM-1603 ⑤ ·',
  },
];

/** Una petición GET al servidor del banco: estado, tipo y cuerpo. */
function pedir(puerto, ruta) {
  return new Promise((ok, mal) => {
    http.get({ host: '127.0.0.1', port: puerto, path: ruta }, (res) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('end', () => ok({ estado: res.statusCode, tipo: res.headers['content-type'] || '', cuerpo: Buffer.concat(trozos) }));
    }).on('error', mal);
  });
}

test('SCRUM-1603 ① · las hojas del banco son las del índice, en su orden, y una es la de la fuente', () => {
  const indice = hojasDeLaPagina(fs.readFileSync(path.join(PUBLIC, 'dashboard', 'index.html'), 'utf8'));
  const banco = hojasDelPanel(PUBLIC);
  // Suelo: el caso del ticket tiene que estar en el índice HOY; si no, este test no prueba nada.
  assert.ok(indice.locales.includes('/fonts/inter.css'),
    '🔴 CIEGO: el índice ya no enlaza `/fonts/inter.css`; este test se escribió para ese caso y hay que releerlo.');
  assert.equal(banco.length, indice.locales.length,
    `🔴 el banco monta ${banco.length} hojas y el índice declara ${indice.locales.length}: ${JSON.stringify(banco)}`);
  assert.ok(banco.includes('/fonts/inter.css'),
    '🔴 el banco ha perdido la hoja de la fuente: volvería a medir con la de reserva (SCRUM-962g, SCRUM-1603).');
  assert.ok(banco.every((h) => h.startsWith('/')), '🔴 una hoja del banco no es una ruta absoluta del sitio: ' + JSON.stringify(banco));
});

test('SCRUM-1603 ② · la página de _banco-lista enlaza esas hojas, sirve las letras y espera la fuente antes de darse por lista', async () => {
  const { srv, puerto } = await servirListas(PUBLIC, [{ ruta: '/__1603', fnVista: 'renderNada', datos: '() => null' }]);
  try {
    const pagina = await pedir(puerto, '/__1603');
    assert.equal(pagina.estado, 200);
    const html = pagina.cuerpo.toString('utf8');
    let desde = 0;
    for (const h of hojasDelPanel(PUBLIC)) {
      const i = html.indexOf(`<link rel="stylesheet" href="${h}">`, desde);
      assert.ok(i >= 0, `🔴 la página del banco no enlaza «${h}» (o no en el orden del índice).`);
      desde = i;
    }
    const espera = html.indexOf(ESPERAR_FUENTES);
    const lista = html.indexOf('window.__listo = true');
    assert.ok(espera >= 0, '🔴 la página del banco ya no espera la fuente: medirá con la de reserva cuando gane la carrera.');
    assert.ok(lista > espera, '🔴 la página se da por lista ANTES de esperar la fuente.');

    // Las letras que pide `inter.css` se sirven, y con su tipo.
    const css = fs.readFileSync(path.join(PUBLIC, 'fonts', 'inter.css'), 'utf8');
    const letras = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, '')))];
    assert.ok(letras.length > 0, '🔴 CIEGO: no encuentro ninguna `url(...)` en `public/fonts/inter.css`.');
    const latina = letras.find((l) => /inter-latin\.woff2$/.test(l)) || letras[0];
    const r = await pedir(puerto, latina);
    assert.equal(r.estado, 200, `🔴 el banco no sirve ${latina}.`);
    assert.match(r.tipo, /^font\/woff2/, `🔴 ${latina} sale como «${r.tipo}».`);
  } finally {
    srv.close();
  }
});

test('SCRUM-1603 ③ · el «antes» que copia arbolDePartida lleva las letras que pide la hoja de la fuente', () => {
  const css = fs.readFileSync(path.join(PUBLIC, 'fonts', 'inter.css'), 'utf8');
  const letras = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, '')))];
  assert.ok(letras.length > 0, '🔴 CIEGO: no encuentro ninguna `url(...)` en `public/fonts/inter.css`.');
  for (const l of letras) {
    assert.ok(EXTENSIONES_DEL_ARBOL.test('public' + l),
      `🔴 el «antes» no copiaría ${l}: antes y después medirían con fuentes distintas.`);
  }
  for (const f of ['public/dashboard/index.html', 'public/tokens.css', 'public/dashboard/js/app.js']) {
    assert.ok(EXTENSIONES_DEL_ARBOL.test(f), `🔴 el «antes» ha dejado de copiar ${f}.`);
  }
});

/**
 * Cada `X.goto(...)` del fichero, con la función que lo contiene; por AST, sin comentarios ni cadenas.
 * Devuelve cuántas llamadas hay y cuáles están en una función que NO llama a `esperarFuentes`.
 */
function navegacionesSinEspera(rel) {
  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const esFuncion = (n) => ts.isArrowFunction(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n);
  const llamaA = (raiz, nombre) => {
    let si = false;
    const ver = (n) => {
      if (si) return;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) { si = true; return; }
      ts.forEachChild(n, ver);
    };
    ver(raiz);
    return si;
  };
  const gotos = [];
  const sinEspera = [];
  const ver = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'goto') {
      gotos.push(n);
      let f = n.parent;
      while (f && !esFuncion(f)) f = f.parent;
      if (!f || !llamaA(f, 'esperarFuentes')) {
        sinEspera.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
      }
    }
    ts.forEachChild(n, ver);
  };
  ver(sf);
  return { gotos: gotos.length, sinEspera };
}

test('SCRUM-1603 ④ · el guard táctil y el censo montan con las hojas del índice y esperan la fuente en cada navegación', () => {
  for (const rel of ['scripts/guard-objetivo-tactil.mjs', 'scripts/censo-objetivo-tactil-panel.mjs']) {
    const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), path.basename(rel));
    assert.ok(codigo.includes('enlacesDelPanel(PUBLIC)'), `🔴 ${rel} ya no saca sus hojas del índice.`);
    assert.ok(!/href="\/tokens\.css"/.test(codigo),
      `🔴 ${rel} vuelve a escribir sus hojas a mano: la lista caduca el día que el índice gana una.`);
    const { gotos, sinEspera } = navegacionesSinEspera(rel);
    assert.ok(gotos > 0, `🔴 CIEGO: no encuentro ningún \`.goto(\` en ${rel}; este test ya no mira nada.`);
    assert.deepEqual(sinEspera, [],
      `🔴 navegaciones que no esperan la fuente: medirían con la de reserva cuando gane la carrera.`);
  }
});

test('SCRUM-1603 ⑤ · el veredicto de la fuente: hoja sin cargar, rota, sin cargar o sin recuento es un CIEGO', () => {
  const sano = { hojasSinCargar: [], declaradas: 35, cargadas: 5, fallidas: 0, familias: ['Inter'] };
  assert.equal(cegueraDeLaFuente(sano), null);
  assert.equal(cegueraDeLaFuente({ ...sano, declaradas: 0, cargadas: 0, familias: [] }), null,
    'una página sin caras declaradas, con todas sus hojas, no tiene nada que esperar');
  // La que caza el 404 de `/fonts/inter.css`: sin la hoja no hay caras, y sin caras «no hay nada que esperar».
  assert.match(cegueraDeLaFuente({ ...sano, hojasSinCargar: ['/fonts/inter.css'], declaradas: 0, cargadas: 0, familias: [] }), /HOJA SIN CARGAR/);
  assert.match(cegueraDeLaFuente({ ...sano, cargadas: 4, fallidas: 1 }), /FUENTE ROTA/);
  assert.match(cegueraDeLaFuente({ ...sano, cargadas: 0, familias: [] }), /SIN CARGAR/);
  assert.match(cegueraDeLaFuente(undefined), /NO SUPE MIRAR/);
  assert.match(cegueraDeLaFuente({ declaradas: 35, cargadas: 5, fallidas: 0, familias: ['Inter'] }), /NO SUPE MIRAR/,
    'un recuento sin la lista de hojas es de otra versión del instrumento: no se le da por bueno');
});
