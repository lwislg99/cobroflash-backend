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
//   ⑤ el veredicto sobre el recuento de caras: una fuente rota o sin cargar es un CIEGO;
//   ⑥ (SCRUM-1755) EL CENSO: todo script de `scripts/` que monta el panel en un navegador usa las hojas
//      de la casa, o está DECLARADO aquí con su motivo. Hasta el 18-nov ① a ④ nombraban tres bancos a
//      mano, y `guard-hojas-del-trabajo-44` nació después, no estaba en la lista y midió el ancho de un
//      texto con la letra de reserva (SCRUM-1745c: verde en Windows, rojo en el runner, 2 px de verdad).
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
    de: '  return r.locales.map((h) =>',
    a: '  return r.locales.filter((h) => !h.includes(\'/fonts/\')).map((h) =>',
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
    // La primera navegación de la landing sin su espera: la de la segunda, que viene detrás, no la tapa.
    fichero: 'scripts/guard-objetivo-tactil.mjs',
    de: "  await esperarLaFuente(page, '/');\n\n",
    a: '\n',
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
  {
    // SCRUM-1755 · el caso que lo parió: el guard de SCRUM-1745 sin su CIEGO de letra.
    fichero: 'scripts/guard-hojas-del-trabajo-44.mjs',
    de: "const sinLetra = cegueraDeLaFuente(fuente, 'la página del banco') ||",
    a: "const sinLetra = (fuente, null) ||",
    cae: 'SCRUM-1603 ⑥ ·',
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
      const i = html.indexOf(`<link rel="stylesheet" href="${h}"`, desde);
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
 * Cada `X.goto(...)` del fichero, por AST (sin comentarios ni cadenas). Una navegación ESPERA la
 * fuente si, en su misma función y DESPUÉS de ella, hay una llamada a `esperarFuentes` o a un
 * ayudante del fichero que la llama. Las dos formas existen a propósito: el censo la lleva dentro
 * de su `ir()`, y el guard la pone detrás de cada `goto` porque `_solape-de-guards.mjs` (SCRUM-548)
 * lee las URL literales de sus `goto` y un ayudante que navegara por dentro se las escondería.
 * Devuelve cuántas llamadas hay y cuáles no esperan.
 */
function navegacionesSinEspera(rel) {
  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const esFuncion = (n) => ts.isArrowFunction(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n);
  /** Las llamadas a un identificador dentro de `raiz`, con su posición. */
  // SCRUM-1755: `raiz` puede ser el MÓDULO (un guard que navega con `await` de nivel superior, como
  // `guard-caja-semaforo`). Entonces sólo cuentan las llamadas de ese nivel: la espera que vive dentro
  // de una función que nadie llama ahí no espera nada.
  const llamadas = (raiz) => {
    const out = [];
    const ver = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) out.push({ nombre: n.expression.text, pos: n.getStart() });
      if (ts.isSourceFile(raiz) && n !== raiz && esFuncion(n)) return;
      ts.forEachChild(n, ver);
    };
    ver(raiz);
    return out;
  };
  // Los ayudantes del fichero que llaman a `esperarFuentes`: `const x = async (…) => {…}` o `function x`.
  const esperadores = new Set(['esperarFuentes']);
  const verDecl = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && esFuncion(n.initializer)
      && llamadas(n.initializer).some((c) => c.nombre === 'esperarFuentes')) esperadores.add(n.name.text);
    if (ts.isFunctionDeclaration(n) && n.name && llamadas(n).some((c) => c.nombre === 'esperarFuentes')) esperadores.add(n.name.text);
    ts.forEachChild(n, verDecl);
  };
  verDecl(sf);
  /** Dónde empieza cada `.goto(` dentro de `raiz`. */
  const gotosDe = (raiz) => {
    const out = [];
    const v = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'goto') out.push(n.getStart());
      ts.forEachChild(n, v);
    };
    v(raiz);
    return out;
  };
  const gotos = [];
  const sinEspera = [];
  const ver = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'goto') {
      gotos.push(n);
      let f = n.parent;
      while (f && !esFuncion(f)) f = f.parent;
      if (!f) f = sf; // navegación de nivel superior: su ámbito es el módulo (ver `llamadas`)
      // Antes del SIGUIENTE `goto` de la misma función: si no, la espera de una navegación posterior
      // taparía a una anterior que no espera (la landing navega dos veces seguidas).
      const fin = n.getEnd();
      const siguiente = f ? Math.min(...gotosDe(f).filter((p) => p > fin), Infinity) : Infinity;
      if (!f || !llamadas(f).some((c) => c.pos > fin && c.pos < siguiente && esperadores.has(c.nombre))) {
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

// ── ⑥ EL CENSO DE LOS BANCOS (SCRUM-1755) ─────────────────────────────────────────────────────────
// La población: todo `.mjs` de `scripts/` (con sus carpetas) que abre un NAVEGADOR y monta el panel,
// es decir, que en su CÓDIGO (sin comentarios: `soloCodigo`) nombra `styles.css` o llama a una de las
// piezas de la casa que lo montan. Cada uno sale en una de tres clases:
//   · `casa`        → saca las hojas del índice (`hojasDelPanel`/`enlacesDelPanel`), espera las caras
//                     (`esperarFuentes`) y da CIEGO sin letra (`cegueraDeLaFuente`); y cada navegación
//                     suya espera la letra antes de la siguiente (lo de ④, ahora para todos);
//   · `casa-lista`  → monta con `servirListas` de `_banco-lista`, cuya página espera la letra y apunta
//                     su fallo en `__errores` (②);
//   · `a-mano`      → enlaza sus hojas escritas a mano. Sólo vale DECLARADO abajo.

/** Bancos que enlazan sus hojas a mano y NO miden texto: su veredicto no depende de la letra. */
const SOLO_GEOMETRIA = {
  'scripts/guard-aviso-bizum.mjs': 'mira si el aviso está, si cuelga de su campo (DOM) y si mide 0 px de alto',
  'scripts/guard-modo-en-ajustes.mjs': 'mira si la frase se ve: alto > 0 y visible',
  'scripts/guard-foto-del-gasto.mjs': 'mide la <img> de la foto (naturalWidth, alto > 0), no un texto',
  'scripts/guard-nif-del-gasto.mjs': 'texto, foco y checkVisibility; ninguna medida de caja',
  'scripts/guard-vias-de-cobro.mjs': 'qué fila y qué aviso se pintan; ninguna medida de caja',
  'scripts/guard-completar-lleva-al-campo.mjs': 'adónde lleva cada acción (pestaña, foco); ninguna medida de caja',
  'scripts/guard-marcadores-en-pantalla.mjs': 'qué texto sale en pantalla; ninguna medida de caja',
};

/**
 * 🔴 DEUDA (SCRUM-1755): bancos a mano que SÍ miden texto, o una caja que pone el texto. Miden hoy con
 * la letra de reserva de cada máquina. Esta lista SÓLO BAJA: cada uno sale de aquí el día que pasa a la
 * casa (patrón de SCRUM-1745c), y el test cae si uno de la lista ya está arreglado y sigue en ella.
 */
const DEUDA = {
  'scripts/guard-caja-datos-del-cliente.mjs': 'desborde, líneas y filas visuales de las etiquetas',
  'scripts/guard-caja-documento-suelto.mjs': 'desborde (scrollWidth) y líneas de cada caja',
  'scripts/guard-pad-de-firma-cabe.mjs': 'la tarjeta con 20 líneas cabe en la ventana; alto de los botones',
  'scripts/guard-notas-en-la-ficha.mjs': 'alto del botón y desborde de la página; enlaza inter.css a mano y no espera las caras',
};
/** El techo de la deuda: el 18-nov-2026 eran 7. Sólo se baja. */
const TECHO_DEUDA = 4;

/** Primitivas que miden lo que pone un TEXTO: un banco de SOLO_GEOMETRIA que use una ya no lo es. */
const MIDE_TEXTO = /\b(scrollWidth|scrollHeight|clientWidth|clientHeight|lineHeight|getClientRects|measureText|createRange)\b/;

/** Los instrumentos de la casa: montan el panel, pero son lo que se vigila en ① a ⑤, no un banco. */
const INSTRUMENTOS = new Set(['scripts/_hojas-del-panel.mjs', 'scripts/_banco-lista.mjs']);

/** Todos los `.mjs` de `scripts/`, con sus carpetas, como rutas `scripts/…` con barras. */
function scriptsDelArbol() {
  const out = [];
  const ver = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules') ver(rel); } else if (e.name.endsWith('.mjs')) out.push(rel);
    }
  };
  ver('scripts');
  return out.sort();
}

/**
 * La clase de un fuente, o `null` si no es un banco del panel. Se exporta para poder probar el
 * clasificador con un fuente que no existe (la mutación de «banco nuevo sin letra»).
 */
export function clasificarBanco(rel, fuente) {
  if (INSTRUMENTOS.has(rel)) return null;
  const codigo = soloCodigo(fuente, path.basename(rel));
  const navegador = /from\s+['"](puppeteer|puppeteer-core|playwright|playwright-core)['"]/.test(codigo)
    || /\b(lanzarNavegador|abrirNavegador)\s*\(/.test(codigo);
  const deLaCasa = /\b(hojasDelPanel|enlacesDelPanel)\s*\(/.test(codigo);
  const lista = /\bservirListas\s*\(/.test(codigo);
  if (!navegador || !(/styles\.css/.test(codigo) || deLaCasa || lista)) return null;
  if (deLaCasa && /\besperarFuentes\s*\(/.test(codigo) && /\bcegueraDeLaFuente\s*\(/.test(codigo)) return 'casa';
  if (lista) return 'casa-lista';
  return 'a-mano';
}

/** Lo que el censo tiene que decir de cada banco. Devuelve la lista de problemas (vacía = verde). */
export function veredictoDelCenso(bancos, { geometria = SOLO_GEOMETRIA, deuda = DEUDA, techo = TECHO_DEUDA } = {}) {
  const mal = [];
  const porRuta = new Map(bancos.map((b) => [b.rel, b]));
  for (const b of bancos) {
    if (b.clase !== 'a-mano') continue;
    if (deuda[b.rel]) continue;
    if (!geometria[b.rel]) {
      mal.push(`${b.rel} monta el panel con sus hojas escritas a mano y no está declarado: o usa las de la casa `
        + '(`_hojas-del-panel`, patrón de SCRUM-1745c) o se declara en SOLO_GEOMETRIA con el motivo de que su veredicto no dependa de la letra.');
    } else if (MIDE_TEXTO.test(b.codigo)) {
      mal.push(`${b.rel} está en SOLO_GEOMETRIA y usa «${b.codigo.match(MIDE_TEXTO)[1]}»: ya mide lo que pone un texto, y con la letra de reserva.`);
    }
  }
  for (const [rel] of Object.entries({ ...geometria, ...deuda })) {
    const b = porRuta.get(rel);
    if (!b) mal.push(`${rel} está declarado y el censo no lo ve como banco: se borró, se renombró o ya no monta el panel. Se quita de la lista.`);
    else if (b.clase !== 'a-mano') mal.push(`${rel} ya mide con la letra de la casa (${b.clase}) y sigue declarado: se quita de la lista (la deuda sólo baja).`);
  }
  for (const rel of Object.keys(geometria)) if (deuda[rel]) mal.push(`${rel} está a la vez en SOLO_GEOMETRIA y en DEUDA.`);
  if (Object.keys(deuda).length > techo) mal.push(`la DEUDA tiene ${Object.keys(deuda).length} bancos y el techo es ${techo}: sólo baja.`);
  return mal;
}

function censarBancos() {
  return scriptsDelArbol().map((rel) => {
    const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    return { rel, clase: clasificarBanco(rel, fuente), codigo: soloCodigo(fuente, path.basename(rel)) };
  }).filter((b) => b.clase);
}

test('SCRUM-1603 ⑥ · el censo: todo banco del panel mide con la letra de la casa, o está declarado con su motivo', () => {
  const bancos = censarBancos();
  // POBLACIÓN, y su SUELO: los dos de ④ y el de SCRUM-1745c son de la casa HOY. Si el censo no los ve,
  // el clasificador está ciego y su verde no dice nada.
  const deLaCasa = bancos.filter((b) => b.clase === 'casa').map((b) => b.rel);
  for (const rel of ['scripts/guard-objetivo-tactil.mjs', 'scripts/censo-objetivo-tactil-panel.mjs', 'scripts/guard-hojas-del-trabajo-44.mjs']) {
    assert.ok(deLaCasa.includes(rel), `🔴 CIEGO: el censo no ve ${rel} como banco de la casa; ve ${JSON.stringify(deLaCasa)}.`);
  }
  assert.ok(bancos.some((b) => b.clase === 'casa-lista'), '🔴 CIEGO: el censo no ve ningún banco montado con `servirListas`.');
  const cuenta = (c) => bancos.filter((b) => b.clase === c).length;
  console.log(`   censo de bancos del panel: ${bancos.length} (casa ${cuenta('casa')} · casa-lista ${cuenta('casa-lista')} · a mano ${cuenta('a-mano')}: `
    + `${Object.keys(SOLO_GEOMETRIA).length} solo geometría + ${Object.keys(DEUDA).length} de DEUDA)`);
  assert.deepEqual(veredictoDelCenso(bancos), []);
  // Y lo de ④, para cada banco de la casa que espera la letra él mismo: ninguna navegación sin su espera.
  for (const b of bancos.filter((x) => x.clase === 'casa')) {
    const { gotos, sinEspera } = navegacionesSinEspera(b.rel);
    assert.ok(gotos > 0, `🔴 CIEGO: ${b.rel} es banco y no encuentro ningún \`.goto(\`.`);
    assert.deepEqual(sinEspera, [], `🔴 ${b.rel}: navegaciones que no esperan la letra antes de la siguiente.`);
  }
});

test('SCRUM-1603 ⑥ · mutación: un banco NUEVO sin letra cae, y uno de la DEUDA ya arreglado también', () => {
  const bancos = censarBancos();
  // Un guard nuevo, como nació el de SCRUM-1745: navegador y hojas escritas a mano.
  const nuevo = "import puppeteer from 'puppeteer-core';\nconst CSS = ['/tokens.css', '/dashboard/css/styles.css'];\n";
  const rel = 'scripts/guard-banco-nuevo-sin-letra.mjs';
  assert.equal(clasificarBanco(rel, nuevo), 'a-mano');
  const conNuevo = [...bancos, { rel, clase: 'a-mano', codigo: nuevo }];
  assert.ok(veredictoDelCenso(conNuevo).some((m) => m.startsWith(rel)), '🔴 un banco nuevo sin letra no hace caer el censo.');
  // El mismo, con las piezas de la casa: ya no es deuda de nadie.
  const arreglado = "import puppeteer from 'puppeteer-core';\nimport { enlacesDelPanel, esperarFuentes, cegueraDeLaFuente } from './_hojas-del-panel.mjs';\n"
    + 'const H = enlacesDelPanel(P); await esperarFuentes(p); cegueraDeLaFuente(f);\n';
  assert.equal(clasificarBanco(rel, arreglado), 'casa');
  // Sin el CIEGO no es de la casa: esperar la letra y no decir nada si no llega es medir con la de reserva.
  assert.equal(clasificarBanco(rel, arreglado.replace('cegueraDeLaFuente(f)', 'f')), 'a-mano');
  // Uno de la DEUDA que pasa a la casa y sigue en la lista: cae.
  const deDeuda = Object.keys(DEUDA)[0];
  const sanado = bancos.map((b) => (b.rel === deDeuda ? { ...b, clase: 'casa' } : b));
  assert.ok(veredictoDelCenso(sanado).some((m) => m.startsWith(deDeuda) && /ya mide con la letra/.test(m)));
  // Uno de SOLO_GEOMETRIA que empieza a medir texto: cae.
  const geo = Object.keys(SOLO_GEOMETRIA)[0];
  const midiendo = bancos.map((b) => (b.rel === geo ? { ...b, codigo: b.codigo + '\nel.scrollWidth;' } : b));
  assert.ok(veredictoDelCenso(midiendo).some((m) => m.startsWith(geo) && /scrollWidth/.test(m)));
  // Y la deuda no sube.
  assert.ok(veredictoDelCenso(bancos, { techo: TECHO_DEUDA - 1 }).some((m) => /sólo baja/.test(m)));
});
