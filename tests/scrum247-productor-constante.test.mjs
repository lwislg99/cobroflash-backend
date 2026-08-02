// SCRUM-247 · LA IDENTIDAD DEL PRODUCTOR ANTE LA AEAT NO ES CONFIGURACIÓN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// Las cinco `VERIFACTU_PRODUCTOR_*` identifican a YaQu como fabricante del sistema informático
// de facturación y viajan dentro de CADA registro VeriFactu emitido. Vivían solo en el panel de
// Railway: estaban en staging y **NO en producción** —el log de arranque de producción lo decía
// literalmente—, así que encender `INVOICING_ES_ENABLED` no habría emitido nada. Eran precondición
// de SCRUM-218 y no había forma de verlo leyendo el código.
//
// Ahora son constantes versionadas. **Cambiar el NIF del productor es un hecho fiscal, no
// configuración**: como constante aparece en un diff, se revisa y queda fechado; como variable de
// panel, alguien la cambia un martes y no queda rastro. No es hipotético — la SL está en
// constitución y ese NIF va a cambiar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS GUARDS, Y POR QUÉ HACEN FALTA LOS DOS
//
//   ① QUE NO VUELVAN AL ENTORNO. Sin esto, el arreglo dura hasta el primer PR que «solo por
//      comodidad» las lea otra vez de `process.env`.
//   ② QUE NINGUNA ESTÉ VACÍA. Este es el RELEVO de la protección que se retiró, no un extra.
//      SCRUM-145 tenía un test que exigía fallar en claro cuando el ENTORNO no traía el dato; ese
//      escenario ya no existe. Pero el peligro no desapareció, cambió de forma:
//          antes → «¿y si el entorno no las trae?»
//          ahora → «¿y si alguien deja una constante vacía en un PR?»
//      Sin ② esto sería cambiar un fail-open VIGILADO por uno INVISIBLE — peor que el estado del
//      que se partía. Con ②, es estrictamente mejor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO EXISTE, A PROPÓSITO
//
// No hay override por entorno, **ni siquiera para tests**. Se evaluó y lo descartó el fundador:
// un camino que SUSTITUYE la identidad fiscal va contra la razón de ser del ticket, aunque viviera
// solo en tests y fuese visible — una puerta que existe se acaba usando. Los seis tests fiscales
// que antes inyectaban un «QA Productor» por entorno ahora emiten con la identidad REAL, que es
// más fiel a producción y no sale de la máquina.
//
// ⚠️ AST y no `grep` en ①: este fichero está lleno de las palabras que vigila porque son las que
// hay que escribir para explicar la prohibición, y un guard de texto se cazaría a sí mismo
// (SCRUM-176/168/3/193).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  PRODUCTOR_VERIFACTU, VERIFACTU_ID_SISTEMA,
} from '../dist/modules/fiscal/verifactu/productor.js';
import { invalidVerifactuIdSistema } from '../dist/core/config/env.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOMBRES = [
  'VERIFACTU_PRODUCTOR_NOMBRE', 'VERIFACTU_PRODUCTOR_NIF', 'VERIFACTU_ID_SISTEMA',
  'VERIFACTU_VERSION', 'VERIFACTU_NUM_INSTALACION',
];

// ── ② EL RELEVO: ninguna vacía ───────────────────────────────────────────────────────────

test('SCRUM-247 · las cinco constantes del productor tienen valor', () => {
  // Suelo: si el módulo dejara de exportarlas, el bucle de abajo recorrería cero y pasaría en
  // verde sin comprobar nada. Un cero que puede significar «todo bien» o «no miré» no es medición.
  assert.deepEqual(Object.keys(PRODUCTOR_VERIFACTU).sort(), [...NOMBRES].sort(),
    '🔴 el módulo del productor ya no exporta las cinco: lo de abajo no estaría comprobando nada');

  const vacias = NOMBRES.filter((k) => !String(PRODUCTOR_VERIFACTU[k] ?? '').trim());
  assert.deepEqual(vacias, [],
    '🔴 HAY CONSTANTES DEL PRODUCTOR VACÍAS: ' + vacias.join(', ') + '\n\n' +
    '  Estas cinco identifican a YaQu como fabricante del software ante la AEAT y viajan dentro\n' +
    '  de cada registro emitido. Con una vacía, el emisor falla en claro\n' +
    '  (`verifactu_productor_no_configurado`) y NO SE EMITE NADA — que es lo correcto, pero el\n' +
    '  sitio donde eso se tiene que ver es AQUÍ, en el PR, no en producción al encender la\n' +
    '  facturación.\n\n' +
    '  Este test es el RELEVO del que SCRUM-145 tenía para «el entorno no trae el dato». Aquel\n' +
    '  escenario ya no existe; éste sí. No lo relajes: sin él, el fail-open deja de estar\n' +
    '  vigilado y pasa a ser invisible.');
});

test('SCRUM-247 · el id del sistema cumple el formato que exige la AEAT (1177)', () => {
  // No basta con «no vacío»: la AEAT exige EXACTAMENTE 2 posiciones, mayúscula (salvo Ñ) o
  // dígito. Un valor presente y MAL no lo para el emisor y llega a la AEAT como error 1177 —
  // el hueco que abrió SCRUM-217. Se reutiliza SU validador, no se reescribe.
  assert.equal(invalidVerifactuIdSistema(VERIFACTU_ID_SISTEMA), null,
    `🔴 VERIFACTU_ID_SISTEMA no es válido: ${invalidVerifactuIdSistema(VERIFACTU_ID_SISTEMA)}`);

  // Suelo del validador: que siga sabiendo decir que no.
  assert.ok(invalidVerifactuIdSistema('abc'), '🔴 el validador acepta 3 caracteres: está ciego');
  assert.ok(invalidVerifactuIdSistema(''), '🔴 el validador acepta el vacío');
});

// ── ① QUE NO VUELVAN AL ENTORNO ──────────────────────────────────────────────────────────

/** Accesos `process.env.<X>` que aparecen como NODO (no en un comentario ni en una cadena). */
function accesosAEntorno(codigo, ruta) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const visitar = (n) => {
    if (ts.isPropertyAccessExpression(n) && NOMBRES.includes(n.name.text)) {
      const base = n.expression;
      if (ts.isPropertyAccessExpression(base) && base.name.text === 'env' &&
          ts.isIdentifier(base.expression) && base.expression.text === 'process') {
        out.push({ ruta, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, nombre: n.name.text });
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

test('SCRUM-247 · ① el analizador ve el acceso al entorno y NO marca lo legítimo', () => {
  assert.equal(accesosAEntorno('const x = process.env.VERIFACTU_PRODUCTOR_NIF;', 'x.ts').length, 1,
    '🔴 no reconoce el acceso que persigue: el verde de abajo no valdría nada');
  assert.equal(accesosAEntorno('const x = process.env.VERIFACTU_PRODUCTOR_NIF || "";', 'x.ts').length, 1,
    '🔴 no lo reconoce con el `|| ""`, que es EXACTAMENTE la forma que tenía el defecto');

  // Negativos: la constante importada, y el nombre en un comentario.
  assert.deepEqual(accesosAEntorno('const x = VERIFACTU_PRODUCTOR_NIF;', 'x.ts'), [],
    '🔴 marca el uso de la CONSTANTE, que es la vía correcta');
  assert.deepEqual(accesosAEntorno('// nunca uses process.env.VERIFACTU_PRODUCTOR_NIF\nconst y = 1;', 'x.ts'), [],
    '🔴 mira TEXTO y no nodos: se cazaría a sí mismo en la prosa que explica la prohibición');
});

test('SCRUM-247 · nadie en src/ lee el productor de process.env', () => {
  const ficheros = [];
  (function andar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) ficheros.push(p);
    }
  })(path.join(RAIZ, 'src'));

  // Suelo: que se haya recorrido un árbol de verdad.
  assert.ok(ficheros.length > 100,
    `🔴 solo ${ficheros.length} ficheros .ts en src/: el barrido no está mirando donde cree`);

  const fugas = ficheros.flatMap((f) =>
    accesosAEntorno(fs.readFileSync(f, 'utf8'), path.relative(RAIZ, f).split(path.sep).join('/')))
    .map((h) => `${h.ruta}:${h.linea}  process.env.${h.nombre}`);

  assert.deepEqual(fugas, [],
    '🔴 EL PRODUCTOR HA VUELTO A LEERSE DEL ENTORNO:\n    ' + fugas.join('\n    ') + '\n\n' +
    '  Eso reabre el defecto entero: la identidad fiscal vuelve a depender de un panel donde un\n' +
    '  cambio no deja rastro, y vuelve a poder faltar en producción sin que nadie lo vea desde el\n' +
    '  código. Son CONSTANTES en `src/modules/fiscal/verifactu/productor.ts`: impórtalas.\n\n' +
    '  Si de verdad hiciera falta un productor distinto por entorno, se decide y se escribe allí —\n' +
    '  no se resuelve con una variable de entorno que reintroduzca el agujero.');
});
