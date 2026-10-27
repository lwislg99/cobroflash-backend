// tests/scrum523d-version-del-sif.test.mjs — SCRUM-523d · NO SE CAMBIA EL CAMINO DE EMISIÓN SIN
// SUBIR LA VERSIÓN DEL SIF.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA DECISIÓN QUE HACE CUMPLIR (SCRUM-523 c.20878, del fundador, 26-oct-2026)
//
//   V1 · «Una versión» es un cambio de lo que el sistema HACE con los registros de facturación
//        (cómo se crean o se remiten), no cada despliegue.
//   V2 · La versión se sube a mano en `VERIFACTU_VERSION` (`productor.ts`), con una declaración
//        responsable nueva firmada por los dos administradores, y un guard impide cambiar el
//        camino de emisión sin subirla.
//
// La versión viaja en CADA registro (`SistemaInformatico/Version`), y el art. 13.2 RRSIF pide una
// declaración por versión. Si el camino cambia y la versión no, el registro dice que lo fabricó un
// sistema que ya no existe.
//
// ── CÓMO COMPARA, SIN BASE DE GIT ─────────────────────────────────────────────────────────────
// CI prueba el MERGE y no siempre trae `origin/main`, así que la base no es un commit: es lo que
// está CONGELADO abajo — la versión y una huella por fichero del camino. Si el camino cambia y la
// versión es la congelada, ROJO nombrando el fichero. Si la versión cambia, ROJO hasta que el mismo
// PR recongele: si no, tras la primera subida el guard quedaría mudo para siempre.
// Las huellas no se eligen: el mensaje de error las trae RECALCULADAS para pegarlas.
//
// ── LA POBLACIÓN, DERIVADA Y NO ESCRITA ───────────────────────────────────────────────────────
// No hay una lista de ficheros a mano. La frontera es el censo que ya existe del camino de emisión
// (`MODULOS_FISCALES` de `scripts/puerta-avisador-rojo.mjs`, regla 38). Dentro de ella, por los
// `import` de cada fichero (AST de TypeScript, no texto):
//   raíces  = lo que vive en `src/modules/fiscal/verifactu/` y lo que lo importa directamente, más
//             lo que importa `verifactu.service.ts` (el que sella y construye el XML);
//   miembros = las raíces y todo lo que ellas importan, transitivamente, sin salir de la frontera.
//
// ── LO QUE NO MIRA, Y HAY QUE SABERLO ─────────────────────────────────────────────────────────
//   · Lo que el camino importa FUERA de la frontera (`src/core/…`, `audit.service.ts`) no entra en
//     la huella: se imprime como FRONTERA. Un cambio de redondeo en `src/core/utils` no cae aquí.
//   · Quién LLAMA al sellado desde fuera (rutas de `jobs/`, `quotes/`, `system/`, `exports/`) no
//     entra: decide cuándo se sella, no qué lleva el registro.
//   · La huella se calcula sobre el código SIN comentarios y reimpreso, así que formato y
//     comentarios no cuentan; renombrar una variable SÍ cuenta (no distingue semántica).
//   · No comprueba que la versión nueva sea MAYOR ni que la declaración esté firmada: eso es el OK
//     del fundador en el PR que la sube.
//
// ⛔ Este fichero NO toca `src/` ni importa `dist/`: lee los fuentes (regla 38).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { MODULOS_FISCALES } from '../scripts/puerta-avisador-rojo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SIF = 'src/modules/fiscal/verifactu/';
const PRODUCTOR = 'src/modules/fiscal/verifactu/productor.ts';
const SELLADOR = 'src/modules/invoicing/domain/verifactu.service.ts';
/** Las tres que el camino TIENE que contener: sin ellas el instrumento no está mirando el SIF. */
const ANCLAS = [PRODUCTOR, 'src/modules/fiscal/verifactu/registro.builder.ts', SELLADOR];

/**
 * LO CONGELADO. Sólo se toca en el PR que sube `VERIFACTU_VERSION` con el OK del fundador, y se
 * pega lo que el mensaje de error trae recalculado. Medido sobre `origin/main` =
 * 81f9c0dc7 (26-oct-2026), con `VERIFACTU_VERSION` = "1.0.0" desde el 2-ago-2026.
 */
const VERSION_CONGELADA = '1.0.0';
const HUELLAS_CONGELADAS = Object.freeze({
  'src/modules/fiscal/verifactu/instalacion.ts': '4e1c8389dc52ad24',
  'src/modules/fiscal/verifactu/productor.ts': 'd57941ac9e3d0797',
  'src/modules/fiscal/verifactu/registro.builder.ts': '9cba94aa34f736ea',
  'src/modules/fiscal/verifactu/sif.client.ts': '16065f4d390ab831',
  'src/modules/fiscal/verifactu/sif.cola.ts': '0f456c225b0e4350',
  'src/modules/fiscal/verifactu/sif.procesador.ts': 'a817d5b83c318cab',
  'src/modules/invoicing/domain/clienteCongelado.ts': 'b9acb99427984fc5',
  'src/modules/invoicing/domain/emisorCongelado.ts': 'f82c1d146a9e5c15',
  'src/modules/invoicing/domain/emission.service.ts': '6bc8737eb96b7290',
  'src/modules/invoicing/domain/encolarRemision.ts': '9250c4d15ce607c2',
  'src/modules/invoicing/domain/invoiceNumber.service.ts': 'e08652a37d84d4f7',
  'src/modules/invoicing/domain/selladoEstado.ts': 'f08728ab84b81ba2',
  'src/modules/invoicing/domain/tipoDocumento.ts': '09a9e00aeb1068de',
  'src/modules/invoicing/domain/vat.service.ts': '91d10ea9159cdc0c',
  'src/modules/invoicing/domain/verifactu.service.ts': '40287a96b63efcf7',
});

// ── El instrumento ────────────────────────────────────────────────────────────────────────────

/** Todo `src/**\/*.ts` como Map ruta→texto. */
function leerArbol(raiz = RAIZ) {
  const arbol = new Map();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
        arbol.set(path.relative(raiz, p).replace(/\\/g, '/'), fs.readFileSync(p, 'utf8'));
      }
    }
  };
  walk(path.join(raiz, 'src'));
  return arbol;
}

const enFrontera = (ruta) => MODULOS_FISCALES.some((m) => ruta.startsWith(`src/modules/${m}/`));

/** Los `import`/`export from`/`import()` relativos de un fichero, resueltos a rutas del árbol. */
function importsDe(ruta, arbol) {
  const { importedFiles } = ts.preProcessFile(arbol.get(ruta), true, true);
  const out = [];
  for (const { fileName } of importedFiles) {
    if (!fileName.startsWith('.')) continue;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(ruta), fileName.replace(/\.js$/, '')));
    const destino = [`${base}.ts`, `${base}/index.ts`].find((c) => arbol.has(c));
    if (destino) out.push(destino);
  }
  return out;
}

function poblacion(arbol) {
  const raices = [...arbol.keys()].filter((r) => enFrontera(r) && (
    r.startsWith(SIF) || importsDe(r, arbol).some((i) => i.startsWith(SIF) || i === SELLADOR)
  ));
  const miembros = new Set();
  const frontera = new Set();
  const cola = [...raices];
  while (cola.length) {
    const r = cola.pop();
    if (miembros.has(r)) continue;
    miembros.add(r);
    for (const i of importsDe(r, arbol)) (enFrontera(i) ? cola.push(i) : frontera.add(i));
  }
  return { raices: raices.sort(), miembros: [...miembros].sort(), frontera: [...frontera].sort() };
}

const IMPRESORA = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

/** Huella del CÓDIGO, no del texto: sin comentarios y reimpreso (formato y CRLF no cuentan). */
function huellaDe(ruta, texto) {
  // CRLF → LF antes de parsear: un checkout de Windows y el de CI tienen que dar la misma huella, y
  // dentro de una plantilla `…` el CRLF vale lo mismo que el LF (ECMAScript normaliza el valor).
  const sf = ts.createSourceFile(ruta, texto.replace(/\r\n?/g, '\n'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  return crypto.createHash('sha256').update(IMPRESORA.printFile(sf)).digest('hex').slice(0, 16);
}

/** `VERIFACTU_VERSION` leída por AST de `productor.ts`; `null` si no está como literal exportado. */
function versionDe(arbol) {
  const texto = arbol.get(PRODUCTOR);
  if (texto == null) return null;
  const sf = ts.createSourceFile(PRODUCTOR, texto, ts.ScriptTarget.Latest, true);
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === 'VERIFACTU_VERSION'
          && d.initializer && ts.isStringLiteralLike(d.initializer)) return d.initializer.text;
    }
  }
  return null;
}

/** Huellas pegables, una por línea (A23 #15), para el PR que sube la versión. */
const pegable = (huellas) => Object.entries(huellas).map(([r, h]) => `  '${r}': '${h}',`).join('\n');

/**
 * VERDE · ROJO · CIEGO. CIEGO es «no he podido mirar», y no es verde.
 * @param {Map<string,string>} arbol
 * @param {{version: string, huellas: Record<string,string>}} congelado
 */
function veredicto(arbol, congelado) {
  const version = versionDe(arbol);
  const pob = poblacion(arbol);
  const faltan = ANCLAS.filter((a) => !pob.miembros.includes(a));
  if (version === null || faltan.length) {
    return {
      estado: 'CIEGO', codigo: 'sin-camino', pob,
      mensaje: `CIEGO: ${version === null ? 'no encuentro VERIFACTU_VERSION como literal exportado en ' + PRODUCTOR : ''}`
        + `${faltan.length ? ' el camino no contiene ' + faltan.join(', ') : ''}. No he mirado el SIF: esto no es un verde.`,
    };
  }
  const huellas = Object.fromEntries(pob.miembros.map((r) => [r, huellaDe(r, arbol.get(r))]));
  const todas = new Set([...Object.keys(huellas), ...Object.keys(congelado.huellas)]);
  const cambiados = [...todas].sort().filter((r) => huellas[r] !== congelado.huellas[r]).map((r) => ({
    ruta: r, que: !(r in congelado.huellas) ? 'entra en el camino' : !(r in huellas) ? 'sale del camino' : 'cambia',
  }));
  const lista = cambiados.map((c) => `  · ${c.ruta} — ${c.que}`).join('\n');
  const recongelar = `Lo recalculado, para pegarlo en ${path.basename(fileURLToPath(import.meta.url))} `
    + `en ESE mismo PR:\n\nconst VERSION_CONGELADA = '${version}';\nconst HUELLAS_CONGELADAS = Object.freeze({\n${pegable(huellas)}\n});`;

  if (version !== congelado.version) {
    return {
      estado: 'ROJO', codigo: 'version-sin-recongelar', cambiados, huellas, pob,
      mensaje: `SCRUM-523d · VERIFACTU_VERSION ha pasado de "${congelado.version}" a "${version}" y lo congelado `
        + 'en este guard sigue en la versión anterior. Subir la versión exige el OK del fundador y una declaración '
        + 'responsable nueva firmada por los dos administradores (SCRUM-523 c.20878, V2). Con ese OK, se recongela '
        + `aquí.\n\n${recongelar}`,
    };
  }
  if (cambiados.length) {
    return {
      estado: 'ROJO', codigo: 'camino-sin-version', cambiados, huellas, pob,
      mensaje: `SCRUM-523d · Has cambiado el camino de emisión sin subir VERIFACTU_VERSION (${PRODUCTOR}, `
        + `sigue en "${version}"):\n${lista}\n\nUna versión del SIF es un cambio de lo que el sistema hace con los `
        + 'registros de facturación (SCRUM-523 c.20878, V1), y viaja en cada registro. La versión la sube un PR con '
        + 'el OK del fundador y una declaración responsable nueva firmada por los dos administradores (V2): no la '
        + 'subas para poner esto en verde sin ese OK, y no toques las huellas sin subirla (regla 41). Si el cambio '
        + `no debía tocar el camino, se deshace.\n\nCuando haya OK: ${recongelar}`,
    };
  }
  return { estado: 'VERDE', codigo: 'igual', cambiados, huellas, pob, mensaje: '' };
}

// ── Sobre el árbol de verdad ──────────────────────────────────────────────────────────────────

const ARBOL = leerArbol();
const CONGELADO = { version: VERSION_CONGELADA, huellas: HUELLAS_CONGELADAS };

test('523d · la población: declarada, con sus anclas y su frontera', () => {
  const pob = poblacion(ARBOL);
  console.log(`  población: ${ARBOL.size} ficheros .ts de src/ leídos · ${pob.raices.length} raíces · `
    + `${pob.miembros.length} en el camino · ${pob.frontera.length} en la frontera (no entran en la huella)`);
  for (const r of pob.miembros) console.log(`    camino   ${r}`);
  for (const r of pob.frontera) console.log(`    frontera ${r}`);
  assert.ok(ARBOL.size > 100, `sólo ${ARBOL.size} ficheros en src/: no es el árbol del repo`);
  for (const a of ANCLAS) assert.ok(pob.miembros.includes(a), `el camino no contiene ${a}`);
  for (const r of pob.miembros) assert.ok(enFrontera(r), `${r} está en el camino y fuera de MODULOS_FISCALES`);
});

test('523d · el camino de emisión es el congelado, o la versión ha subido', () => {
  const v = veredicto(ARBOL, CONGELADO);
  assert.equal(v.estado, 'VERDE', v.mensaje);
  assert.equal(Object.keys(v.huellas).length, Object.keys(HUELLAS_CONGELADAS).length);
});

// ── Los controles, SEMBRADOS sobre una copia en memoria del árbol de verdad ───────────────────
// Comparan contra la BASE recalculada del árbol de hoy, no contra lo congelado: así un camino que
// ya ha cambiado tumba SOLO el test de arriba, y los controles siguen diciendo si el instrumento ve.

const BASE = (() => {
  const version = versionDe(ARBOL);
  const v = veredicto(ARBOL, { version, huellas: {} });
  assert.ok(v.huellas, `no se pudo calcular la base: ${v.mensaje}`);
  return { version, huellas: v.huellas };
})();

const conCambio = (ruta, f) => { const a = new Map(ARBOL); a.set(ruta, f(a.get(ruta))); return a; };
const BUILDER = 'src/modules/fiscal/verifactu/registro.builder.ts';
/** Un cambio de CÓDIGO: una sentencia nueva al final del fichero. */
const sembrar = (t) => `${t}\nexport const __SCRUM523D_SEMBRADO = 1;\n`;
const subir = (t) => t.replace(/(VERIFACTU_VERSION\s*=\s*")[^"]*(")/, '$19.9.9-sembrada$2');

test('523d · 🔴 tocar el camino sin subir la versión CAE y nombra el fichero', () => {
  for (const ruta of [BUILDER, SELLADOR, 'src/modules/invoicing/domain/vat.service.ts']) {
    const v = veredicto(conCambio(ruta, sembrar), BASE);
    assert.equal(v.estado, 'ROJO', `${ruta}: ${v.mensaje}`);
    assert.equal(v.codigo, 'camino-sin-version');
    assert.deepEqual(v.cambiados, [{ ruta, que: 'cambia' }]);
    assert.match(v.mensaje, /OK del fundador/);
  }
});

test('523d · 🔴 un fichero nuevo que el camino empieza a importar CAE como «entra en el camino»', () => {
  const nuevo = 'src/modules/fiscal/verifactu/__sembrado523d.ts';
  const a = conCambio(BUILDER, (t) => `import { X } from './__sembrado523d.js';\n${t}`);
  a.set(nuevo, 'export const X = 1;\n');
  const v = veredicto(a, BASE);
  assert.equal(v.estado, 'ROJO', v.mensaje);
  assert.ok(v.cambiados.some((c) => c.ruta === nuevo && c.que === 'entra en el camino'), v.mensaje);
});

test('523d · 🔴 subir la versión sin recongelar CAE; subirla y recongelar PASA', () => {
  const a = conCambio(PRODUCTOR, subir);
  a.set(BUILDER, sembrar(a.get(BUILDER)));
  assert.equal(versionDe(a), '9.9.9-sembrada', 'la siembra de la versión no se aplicó');
  const sin = veredicto(a, BASE);
  assert.equal(sin.estado, 'ROJO', sin.mensaje);
  assert.equal(sin.codigo, 'version-sin-recongelar');
  assert.match(sin.mensaje, /VERSION_CONGELADA = '9\.9\.9-sembrada'/);
  const con = veredicto(a, { version: '9.9.9-sembrada', huellas: sin.huellas });
  assert.equal(con.estado, 'VERDE', con.mensaje);
});

test('523d · 🟢 lo que NO es camino no cae: otro módulo, un comentario, un reformateo', () => {
  const otro = [...ARBOL.keys()].find((r) => r.startsWith('src/modules/quotes/'));
  assert.ok(otro, 'no hay ningún fichero en src/modules/quotes/ para sembrar el negativo');
  assert.ok(!poblacion(ARBOL).miembros.includes(otro), `${otro} no debería estar en el camino`);
  const fuera = veredicto(conCambio(otro, sembrar), BASE);
  assert.equal(fuera.estado, 'VERDE', fuera.mensaje);

  const comentario = veredicto(conCambio(BUILDER, (t) => `// SCRUM-523d sembrado\n${t}\n/* otro */\n`), BASE);
  assert.equal(comentario.estado, 'VERDE', comentario.mensaje);
  // El mismo fichero con CRLF (un checkout de Windows) y con líneas en blanco fuera del código.
  const crlf = veredicto(conCambio(BUILDER, (t) => `\n\n${t.replace(/\r?\n/g, '\r\n')}\r\n\r\n`), BASE);
  assert.equal(crlf.estado, 'VERDE', crlf.mensaje);
  // El positivo con la MISMA siembra sobre el camino: sin él, los verdes de arriba pasarían igual
  // con una huella que no viera nada.
  assert.equal(veredicto(conCambio(BUILDER, sembrar), BASE).estado, 'ROJO');
});

test('523d · ⚫ sin productor, sin versión o sin árbol el instrumento dice CIEGO, no verde', () => {
  const sinProductor = new Map(ARBOL);
  sinProductor.delete(PRODUCTOR);
  assert.equal(veredicto(sinProductor, BASE).estado, 'CIEGO');
  const sinVersion = conCambio(PRODUCTOR, (t) => t.replace(/export const VERIFACTU_VERSION[^\n]*\n/, ''));
  assert.equal(versionDe(sinVersion), null, 'la siembra (quitar la versión) no se aplicó');
  assert.equal(veredicto(sinVersion, BASE).estado, 'CIEGO');
  assert.equal(veredicto(new Map(), BASE).estado, 'CIEGO');
  assert.equal(veredicto(leerArbol(path.join(RAIZ, 'no-existe-523d')), BASE).estado, 'CIEGO');
});
