// tests/scrum723-guard-contra-su-base.test.mjs — SCRUM-723
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN GUARD QUE COMPARA CONTRA UN OBJETIVO MÓVIL ACUSA A QUIEN NO HA HECHO NADA
//
// El 4-sep-2026 el guard de SCRUM-603b se puso rojo en la rama de SCRUM-605 diciendo que el PDF
// de la factura había cambiado. No había cambiado: la rama no tocó ese fichero. Lo que pasó es
// que SCRUM-594 entró en `main` tocándolo, y el guard leía la PUNTA de `origin/main`. O sea que
// no medía lo que hace la rama: medía la distancia entre dos cosas que se mueven, y una de las
// dos se movió sola.
//
// La referencia estable de una rama es su PUNTO DE PARTIDA. Eso es lo que cambia SCRUM-723:
// **contra qué compara**, no lo que exige.
//
// LO QUE SE PRUEBA AQUÍ, y en este orden porque es el orden en que se descubrió:
//   ① el CASO QUE FALLABA, reproducido: rama limpia + `main` tocando la factura. Con la lógica
//      vieja sale rojo; con la nueva, verde. Los dos veredictos en el mismo test, porque «ahora
//      está verde» no dice nada si no se ve el rojo de al lado.
//   ② el CONTROL POSITIVO: si es la RAMA la que cambia el PDF de la factura, sigue cayendo. Un
//      guard que después del arreglo ya no puede caer no está arreglado, está apagado.
//   ③ CIEGO antes que verde: sin base que resolver lo dice, y no cae hacia `origin/main`.
//   ④ el AGUJERO que 603b dejó declarado: si alguien mueve código de la factura FUERA de
//      `generateInvoicePdf`, aquel guard deja de verlo. Aquí se ata por ÁMBITO ALCANZABLE.
//   ⑤ el CENSO: quién más compara contra una referencia móvil, con suelo y con lista declarada.
//
// 🔴 EL FIXTURE ES UN REPOSITORIO SINTÉTICO, no este repo. Probar esto contra `main` de verdad
// exigiría que `main` se moviera durante el test — o sea, exigiría suerte. Y un test que dependa
// del estado real de `main` es el mismo defecto que este ticket viene a quitar.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { baseDeLaRama, contenidoEnLaBase } from './_base-de-la-rama.mjs';
import { ambitoDeLaFactura, ENTRADA_FACTURA } from './_ambito-de-la-factura.mjs';
import { censarReferenciaMovil, analizarFuente } from './_censo-referencia-movil.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REL_PDF = 'src/modules/invoicing/infra/pdf/pdf.service.ts';

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL FIXTURE · una rama y un `main` que se mueve
// ─────────────────────────────────────────────────────────────────────────────────────────
const REL = 'pdf.service.ts';

/** El fichero de mentira: dos documentos en el mismo módulo, como el de verdad. */
const modulo = (factura, presupuesto) =>
  'export async function generateInvoicePdf(x) {\n' + factura + '\n}\n\n'
  + 'export async function generateQuotePdf(x) {\n' + presupuesto + '\n}\n';

/**
 * Un repo con: un commit BASE, una rama que sale de ahí, y `origin/main` avanzado por delante.
 *
 * @param {object} o
 * @param {boolean} o.mainTocaLaFactura  `main` cambia `generateInvoicePdf` después de la rama
 * @param {boolean} o.ramaTocaLaFactura  la RAMA cambia `generateInvoicePdf`
 * @param {boolean} o.sinOrigin          no se crea ninguna referencia: no hay base que resolver
 */
function repoDeRamaYMain({ mainTocaLaFactura = true, ramaTocaLaFactura = false, sinOrigin = false } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum723-'));
  const g = (...a) => execFileSync('git', a, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g('init', '-q', '-b', sinOrigin ? 'suelta' : 'main');
  g('config', 'user.email', 'fixture@yaqu.test');
  g('config', 'user.name', 'Fixture');
  g('config', 'commit.gpgsign', 'false');
  // 🔴 `core.autocrlf` NEUTRALIZADO, y lo cazó este mismo fixture al escribirlo: esta máquina lo
  // tiene en `true` a nivel system, así que el checkout escribía CRLF mientras `git show` devolvía
  // LF y TODO salía rojo por el fin de línea — incluida la lógica buena. El repo de verdad no lo
  // sufre porque su `.gitattributes` promete LF en disco (SCRUM-533). El fixture reproduce ESO.
  g('config', 'core.autocrlf', 'false');

  const F = path.join(raiz, REL);
  fs.writeFileSync(F, modulo('  doc.text("FACTURA");', '  doc.text("PRESUPUESTO");'));
  g('add', '-A'); g('commit', '-q', '-m', 'base');
  const base = g('rev-parse', 'HEAD').trim();
  if (sinOrigin) return { raiz, base, g };

  // La rama. Toca OTRO fichero —como hacía SCRUM-603 con el albarán— salvo que se pida lo otro.
  g('checkout', '-q', '-b', 'scrum-000-la-rama');
  if (ramaTocaLaFactura) {
    fs.writeFileSync(F, modulo('  doc.text("FACTURA");\n  doc.text("DE LA RAMA");', '  doc.text("PRESUPUESTO");'));
  } else {
    fs.writeFileSync(path.join(raiz, 'albaranPdf.service.ts'), 'export const x = 1;\n');
  }
  g('add', '-A'); g('commit', '-q', '-m', 'el trabajo de la rama');

  // `main` avanza POR DEBAJO, que es el caso del ticket.
  g('checkout', '-q', 'main');
  if (mainTocaLaFactura) {
    fs.writeFileSync(F, modulo('  doc.text("FACTURA");\n  doc.text("dto");', '  doc.text("PRESUPUESTO");'));
    g('add', '-A'); g('commit', '-q', '-m', 'SCRUM-594 en main');
  }
  g('update-ref', 'refs/remotes/origin/main', g('rev-parse', 'HEAD').trim());
  g('checkout', '-q', 'scrum-000-la-rama');
  return { raiz, base, g };
}

/** El recorte que usa el guard de 603b, calcado: si aquí divergiera, esto probaría otra cosa. */
const cuerpoDeLaFactura = (txt) => {
  const ini = txt.indexOf('export async function generateInvoicePdf');
  const sig = txt.indexOf('\nexport ', ini + 1);
  return txt.slice(ini, sig === -1 ? txt.length : sig);
};

/** La lógica VIEJA, conservada aquí a propósito: sin ella no se puede enseñar el rojo. */
const comoComparabaAntes = (g) => cuerpoDeLaFactura(g('show', 'origin/main:' + REL));

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① EL CASO QUE FALLABA
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-723 · 🔴 EL CASO QUE FALLABA: rama LIMPIA y `main` tocando la factura', () => {
  const { raiz, base, g } = repoDeRamaYMain({ mainTocaLaFactura: true, ramaTocaLaFactura: false });
  const enDisco = cuerpoDeLaFactura(fs.readFileSync(path.join(raiz, REL), 'utf8'));

  // SUELO: la rama de verdad NO toca el fichero de la factura. Si lo tocara, el rojo de abajo
  // sería correcto y este test estaría probando lo contrario de lo que dice.
  const tocados = g('diff', '--name-only', base + '..HEAD').trim().split('\n').filter(Boolean);
  assert.deepEqual(tocados, ['albaranPdf.service.ts'],
    '🔴 el fixture no reproduce el caso: la rama tiene que estar LIMPIA respecto a ' + REL);

  // ── la lógica VIEJA: acusa a quien no ha hecho nada ──
  assert.notEqual(enDisco, comoComparabaAntes(g),
    '🔴 EL DEFECTO YA NO SE REPRODUCE. Este aserto existe para enseñar el rojo que motivó el '
    + 'ticket: comparando contra la PUNTA de `origin/main`, una rama limpia sale acusada porque '
    + '`main` se movió. Si esto deja de ser cierto, el test de abajo ya no prueba nada.');

  // ── la lógica NUEVA: la rama limpia queda limpia ──
  const { contenido, base: b } = contenidoEnLaBase(raiz, REL);
  assert.ok(b && b.sha === base, '🔴 `merge-base` no ha devuelto el punto de partida de la rama');
  assert.equal(enDisco, cuerpoDeLaFactura(contenido),
    '🔴 comparando contra la BASE, una rama que no ha tocado la factura sigue saliendo acusada. '
    + 'El arreglo de SCRUM-723 no arregla nada.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② CONTROL POSITIVO · sigue cayendo cuando hay que caer
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-723 · 🔴 CONTROL POSITIVO: si es LA RAMA la que toca la factura, SIGUE cayendo', () => {
  // Sin esto, apagar el guard entero pasaría el test de arriba con nota. Es la mitad que importa:
  // lo que se ha cambiado es CONTRA QUÉ compara, no lo que exige.
  const { raiz } = repoDeRamaYMain({ mainTocaLaFactura: true, ramaTocaLaFactura: true });
  const enDisco = cuerpoDeLaFactura(fs.readFileSync(path.join(raiz, REL), 'utf8'));
  const { contenido } = contenidoEnLaBase(raiz, REL);
  assert.notEqual(enDisco, cuerpoDeLaFactura(contenido),
    '🔴 LA RAMA HA CAMBIADO EL PDF DE LA FACTURA Y EL GUARD NO SE ENTERA. Después del cambio de '
    + 'referencia ya no puede caer nunca: eso no es un guard arreglado, es un guard apagado.');

  // Y con `main` quieto también cae: el rojo no depende de que `main` se haya movido.
  const quieto = repoDeRamaYMain({ mainTocaLaFactura: false, ramaTocaLaFactura: true });
  assert.notEqual(
    cuerpoDeLaFactura(fs.readFileSync(path.join(quieto.raiz, REL), 'utf8')),
    cuerpoDeLaFactura(contenidoEnLaBase(quieto.raiz, REL).contenido),
    '🔴 con `main` quieto, el guard ya no ve el cambio de la rama');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ CIEGO ANTES QUE VERDE
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-723 · sin base que resolver dice que NO SABE, y no cae hacia `origin/main`', () => {
  // Un clon somero no tiene con qué comparar. Lo que NO puede hacer es informar de un verde: «no
  // sé» y «no ha cambiado» dan exactamente el mismo color si nadie los separa.
  const { raiz } = repoDeRamaYMain({ sinOrigin: true });
  assert.equal(baseDeLaRama(raiz), null,
    '🔴 el resolutor dice haber encontrado una base donde no hay ninguna referencia');
  const r = contenidoEnLaBase(raiz, REL);
  assert.equal(r.contenido, null, '🔴 ha devuelto contenido sin base: eso sería inventárselo');
  assert.equal(r.base, null, '🔴 la base tiene que venir en `null`, no omitida');

  // CONTROL POSITIVO del resolutor: en un repo que SÍ tiene base, la encuentra. Sin esto, uno que
  // devolviera `null` siempre también pasaría el aserto de arriba.
  const bueno = repoDeRamaYMain({});
  const b = baseDeLaRama(bueno.raiz);
  assert.ok(b && b.sha === bueno.base, '🔴 el resolutor no sabe encontrar una base que existe');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ EL AGUJERO QUE 603b DEJÓ DECLARADO
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// 603b escribió, con estas palabras, que se acotaba al CUERPO de `generateInvoicePdf`. El hueco
// que eso abre no es teórico: mover diez líneas a un ayudante del módulo cambia lo que imprime la
// factura y deja el cuerpo de la función con una llamada donde antes había código.
//
// LAS PIEZAS DE HOY, medidas el 4-sep-2026 sobre `origin/main` = bf8cef31. Se declaran por NOMBRE
// y no por línea: referenciar por posición caduca al primer commit (SCRUM-710).
const AMBITO_DECLARADO = [
  'MARCADOR_MICROCOPY_DESGLOSE',
  'NOMBRE_IMPUESTO_POR_DEFECTO',
  'fmtImporte',
  'generateInvoicePdf',
  'loadLogoBuffer',
];

test('SCRUM-723 · 🔴 el ámbito de la factura es la función MÁS lo que alcanza', () => {
  const a = ambitoDeLaFactura(fs.readFileSync(path.join(RAIZ, REL_PDF), 'utf8'));
  assert.deepEqual(a.piezas, AMBITO_DECLARADO,
    '🔴 HA CAMBIADO EL ÁMBITO ALCANZABLE DE `generateInvoicePdf`.\n'
    + '     ahora:     ' + a.piezas.join(', ') + '\n'
    + '     declarado: ' + AMBITO_DECLARADO.join(', ') + '\n'
    + '  Que entre o salga una pieza no es un detalle de forma: es código que decide qué imprime '
    + 'una factura entrando o saliendo de lo que el guard vigila. Se declara aquí, con motivo.');
  assert.ok(a.texto.length > 20000,
    '🔴 SUELO: el ámbito mide ' + a.texto.length + ' caracteres. El recorte no está cogiendo las '
    + 'funciones enteras y la comparación de abajo sería casi vacía.');
});

test('SCRUM-723 · 🔴 mover código de la factura a un ayudante YA NO lo saca del guard', () => {
  // El caso exacto que 603b declaró que no veía, en un fuente de mentira para poder provocarlo.
  const antes = 'export async function generateInvoicePdf(x) {\n  doc.text("total: " + x);\n}\n'
    + 'function ayudaAlPresupuesto(y) { return y; }\n'
    + 'export async function generateQuotePdf(y) { return ayudaAlPresupuesto(y); }\n';
  const despues = 'export async function generateInvoicePdf(x) {\n  pintarTotal(doc, x);\n}\n'
    + 'function pintarTotal(doc, x) {\n  doc.text("total: " + x);\n}\n'
    + 'function ayudaAlPresupuesto(y) { return y; }\n'
    + 'export async function generateQuotePdf(y) { return ayudaAlPresupuesto(y); }\n';

  assert.deepEqual(ambitoDeLaFactura(antes).piezas, ['generateInvoicePdf'],
    '🔴 el ámbito de partida ya trae piezas de más: el caso no probaría el movimiento');
  assert.deepEqual(ambitoDeLaFactura(despues).piezas, ['generateInvoicePdf', 'pintarTotal'],
    '🔴 EL AYUDANTE NO ENTRA EN EL ÁMBITO. Es el agujero que 603b dejó declarado: se mueve el '
    + 'código de la factura a una función del módulo y el guard deja de verlo.');

  // 🔴 EL LADO QUE ABSUELVE. Sin esto, un detector que se lo tragara todo también pasaría: el
  // ayudante del PRESUPUESTO no puede entrar, o el guard volvería a bloquear el fichero entero —
  // que es justo por lo que 603b se acotó.
  assert.equal(ambitoDeLaFactura(despues).piezas.includes('ayudaAlPresupuesto'), false,
    '🔴 el ámbito se ha tragado un ayudante que la factura no llama: eso vuelve a hacer imposible '
    + 'tocar el presupuesto, que es lo que SCRUM-603b arregló.');

  // Y sin entrada no hay comparación: se dice, no se compara el vacío.
  assert.equal(ambitoDeLaFactura('export const x = 1;\n').texto, null,
    '🔴 sin `' + ENTRADA_FACTURA + '` en el fuente, el ámbito tiene que venir en `null`');
});

test('SCRUM-723 · 🔴 el ÁMBITO ENTERO de la factura no ha cambiado respecto a la base de la rama', () => {
  // Éste es el guard ancho de verdad: cubre lo que cubría 603b y además lo que la factura alcanza.
  const { contenido, base } = contenidoEnLaBase(RAIZ, REL_PDF);
  assert.ok(base && /^[0-9a-f]{40}$/.test(base.sha),
    '🔴 CIEGO: no se ha podido resolver la base de la rama. En un clon somero no hay con qué '
    + 'comparar: el checkout de CI necesita `fetch-depth: 0` (SCRUM-388).');
  assert.ok(typeof contenido === 'string' && contenido.length > 0,
    '🔴 CIEGO: no se pudo leer ' + REL_PDF + ' en la base de la rama');

  const enBase = ambitoDeLaFactura(contenido);
  const enDisco = ambitoDeLaFactura(fs.readFileSync(path.join(RAIZ, REL_PDF), 'utf8'));
  assert.ok(enBase.texto && enDisco.texto, '🔴 CIEGO: falta uno de los dos ámbitos que comparar');
  assert.equal(enDisco.texto, enBase.texto,
    '🔴 ESTA RAMA CAMBIA LO QUE IMPRIME LA FACTURA — la función o algo que ella alcanza.\n'
    + '     base:  ' + base.ref + ' @ ' + base.sha.slice(0, 8) + '\n'
    + '     piezas en la base:  ' + enBase.piezas.join(', ') + '\n'
    + '     piezas en el disco: ' + enDisco.piezas.join(', ') + '\n'
    + '  Una factura emitida no se edita ni se borra (regla 29). Si el cambio es intencionado, es '
    + 'un STOP: pide el OK antes de tocar el camino de emisión.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑤ EL CENSO · quién más compara contra algo que se mueve
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// Medido el 4-sep-2026 sobre `origin/main` = bf8cef31, tras arreglar el de 603b. Por FICHERO y
// subcomando, no por línea (SCRUM-710). Cada entrada dice por qué sigue ahí y quién la retira.
const HALLAZGOS_DECLARADOS = [
  // El CLI del reparto. Su pregunta es «¿qué hay hecho AHORA MISMO en main?», y para ESA pregunta
  // `origin/main` es la referencia correcta. No corre en CI y lo dice en su cabecera (SCRUM-387).
  'scripts/censo-reparto.mjs [ls-tree]',
  'scripts/censo-reparto.mjs [rev-parse]',
  // El vigía del despliegue. Su pregunta también es sobre la PUNTA: «¿el commit que dice
  // producción está en `main`, y cuántos lleva de retraso?». Contra la base de una rama no
  // significaría nada. Corre en su propio workflow, con `fetch-depth: 0`.
  'scripts/vigilante-de-despliegue.mjs [rev-parse]',
  // Este mismo fichero: la lógica VIEJA, conservada para poder enseñar el rojo del ticket. Vive
  // dentro de un repo SINTÉTICO —su `origin/main` no es el de nadie— y desaparece el día que se
  // borre el caso ①, no antes: sin ella, «ahora está verde» no se puede contrastar con nada.
  'tests/scrum723-guard-contra-su-base.test.mjs [show]',
];

/** Ficheros que llaman a git y nombran la referencia móvil FUERA de los argumentos. */
const INDIRECTAS_DECLARADAS = [
  // SCRUM-738 · el censo del tablero contra el árbol. Su pregunta es sobre la PUNTA de `main` —
  // «¿qué tickets tienen ya trabajo suyo AHÍ?»— así que la referencia móvil es el sujeto, no un
  // descuido: contra la base de una rama respondería sobre un pasado que a nadie le sirve. La
  // nombra al listar `refs/remotes/origin/` y al explicar el motor que consulta.
  'scripts/censo-tablero-vs-arbol.mjs',
  'scripts/censo-reparto.mjs',   // el mensaje de error del CLI de arriba
  'tests/_censo-eol.mjs',        // la lista de referencias que `merge-base` prueba: es la SOLUCIÓN
  'tests/_censo-tickets.mjs',    // recibe la referencia por parámetro (`ref = 'origin/main'`)
  'tests/scrum723-guard-contra-su-base.test.mjs',  // los mensajes y los comentarios de aquí mismo
  // SCRUM-753 · el censo de ALCANZABILIDAD. Aquí la referencia móvil no es un descuido: es el
  // sujeto de la pregunta —«¿está esto DENTRO de la punta de `main`?»— y contra la base de una
  // rama contestaría sobre un pasado que no le sirve a nadie. Lo que sí hace, y es lo que este
  // guard quiere ver, es RESOLVERLA UNA VEZ (`rev-parse`) y medir contra el sha congelado: el
  // nombre aparece como valor por defecto del parámetro `ref` y en la prosa que explica por qué
  // se congela, nunca como argumento de una comparación.
  // ⚠️ El CLI (`scripts/censo-alcanzabilidad.mjs`) NO entra: se le declaró de más al primer
  // intento y este guard lo rechazó. No nombra la referencia por su cuenta — la recibe ya
  // resuelta en la instantánea—, y una lista que declara de más deja de describir el árbol.
  'scripts/_censo-alcanzabilidad.mjs',
  'tests/_fixture-alcanzabilidad.mjs',             // el `origin/main` del repo SINTÉTICO, que no es el de nadie
  'tests/scrum753-censo-de-alcanzabilidad.test.mjs',  // los mensajes que explican la regla R10
];

test('SCRUM-723 · SUELO del censo: lee, ve los git de verdad y sabe absolver a `merge-base`', () => {
  const c = censarReferenciaMovil(RAIZ);
  // 🔴 SIN ESTO, «0 hallazgos» y «no supe mirar» son el mismo verde.
  assert.ok(c.escaneados > 400,
    '🔴 CIEGO: el censo sólo ha leído ' + c.escaneados + ' ficheros de `tests/` y `scripts/`');
  assert.ok(c.conGit >= 10,
    '🔴 CIEGO: sólo ' + c.conGit + ' ficheros parecen llamar a git. El detector no está viendo '
    + 'las llamadas, y entonces su lista de hallazgos no significa nada.');
  assert.ok(c.anclados >= 1,
    '🔴 CIEGO: el censo no ve ni un `merge-base` en el árbol. O no sabe mirar, o nadie está '
    + 'anclando a su base — y las dos cosas hay que saberlas.');
  // 🔴 EL SUELO QUE CAZÓ AL CENSO. La primera versión sólo veía `execFileSync('git', …)` a pelo y
  // contaba 38 llamadas en todo el árbol; con los ENVOLTORIOS son 133. Casi todo el git de esta
  // casa se escribe a través de un `const g = (...a) => execFileSync('git', a)`, así que aquel
  // censo era ciego al idioma más común — y devolvía un árbol limpio que no existía. Si este
  // número se desploma, es que el censo ha vuelto a quedarse mirando sólo las llamadas directas.
  assert.ok(c.llamadas >= 100,
    '🔴 CIEGO: sólo ' + c.llamadas + ' llamadas a git en todo `tests/` y `scripts/`. El censo ha '
    + 'dejado de ver las que van por un envoltorio, que son la mayoría.');

  // CONTROL POSITIVO Y NEGATIVO del clasificador, con fuentes en la mano: acusa lo que hay que
  // acusar y absuelve lo que hay que absolver. Con sólo una de las dos mitades, un clasificador
  // que dijera siempre lo mismo pasaría.
  const acusable = 'execFileSync("git", ["show", "origin/main:" + r]);';
  assert.equal(analizarFuente(acusable).filter((l) => l.esHallazgo).length, 1,
    '🔴 el censo NO ve un `git show origin/main:` que le doy en la mano: no vería el de nadie');
  const ancla = 'execFileSync("git", ["merge-base", "HEAD", "origin/main"]);';
  assert.equal(analizarFuente(ancla).filter((l) => l.esHallazgo).length, 0,
    '🔴 el censo acusa a un `merge-base`, que es precisamente lo que convierte una referencia '
    + 'móvil en un commit fijo. Acusaría a la solución y acabaría desactivado.');
  const propio = 'execFileSync("git", ["show", "HEAD:x.ts"]);';
  assert.equal(analizarFuente(propio).filter((l) => l.esHallazgo).length, 0,
    '🔴 el censo acusa a `HEAD`, que es el árbol bajo prueba y no se mueve bajo los pies de nadie');

  // 🔴 EL ENVOLTORIO, que es lo que se le escapaba. Este idioma —declarar `g` y llamar `g(...)`—
  // es el que usa medio árbol, y este mismo fichero. El censo lo absolvía a él y a todos.
  const envuelto = 'const g = (...a) => execFileSync("git", a, { cwd: r });\n'
    + 'const x = g("show", "origin/main:" + rel);';
  assert.equal(analizarFuente(envuelto).filter((l) => l.esHallazgo).length, 1,
    '🔴 el censo NO ve un git que va por un envoltorio. Así es como está escrito casi todo el git '
    + 'de esta casa: un censo ciego a eso devuelve un árbol limpio que no existe.');
  // Y no llama envoltorio a cualquier función: una que no arranque git no puede colar sus
  // argumentos como si fueran de git.
  const noEsGit = 'const f = (...a) => console.log(a);\nf("show", "origin/main:x");';
  assert.equal(analizarFuente(noEsGit).length, 0,
    '🔴 el censo trata como git a una función que no lo es: contaría hallazgos inventados');
  // Y no cuenta lo que sólo se NOMBRA: si contara el texto, se cazaría en este comentario que
  // dice `git show origin/main:` tres veces, que es la trampa de SCRUM-203.
  const soloTexto = '// git show origin/main:x\nconst s = "origin/main";';
  assert.equal(analizarFuente(soloTexto).filter((l) => l.esHallazgo).length, 0,
    '🔴 el censo cuenta menciones en texto: se cazaría a sí mismo y habría que apagarlo');
});

test('SCRUM-723 · 🔴 quién compara contra una referencia MÓVIL, y cada uno con su motivo', () => {
  const c = censarReferenciaMovil(RAIZ);
  const vistos = [...new Set(c.hallazgos.map((h) => h.ruta + ' [' + h.cmd + ']'))].sort();
  assert.deepEqual(vistos, [...HALLAZGOS_DECLARADOS].sort(),
    '🔴 HA CAMBIADO QUIÉN COMPARA CONTRA UN OBJETIVO MÓVIL.\n'
    + '     ahora:     ' + vistos.join('\n                ') + '\n'
    + '     declarado: ' + HALLAZGOS_DECLARADOS.join('\n                ') + '\n'
    + '  Uno nuevo no es necesariamente un fallo, pero SÍ es una decisión: o compara contra su '
    + 'punto de partida (`merge-base`, como `tests/_base-de-la-rama.mjs`), o se declara aquí con '
    + 'el motivo y quién lo retira. Lo que no puede es entrar en silencio: acusará a una rama '
    + 'limpia el día que otro PR toque su fichero, y ésa es la avería de SCRUM-723.');

  const indirectas = [...new Set(c.indirectas.map((i) => i.ruta))].sort();
  assert.deepEqual(indirectas, [...INDIRECTAS_DECLARADAS].sort(),
    '🔴 HA CAMBIADO QUIÉN NOMBRA UNA REFERENCIA MÓVIL FUERA DE LOS ARGUMENTOS DE GIT.\n'
    + '     ahora:     ' + indirectas.join(', ') + '\n'
    + '     declarado: ' + INDIRECTAS_DECLARADAS.join(', ') + '\n'
    + '  Esta lista existe porque el censo se quedó corto al primer intento: `_censo-tickets.mjs` '
    + 'recibe la referencia en un parámetro por defecto y no se veía. Declararla la deja a la '
    + 'vista en vez de dejarla fuera.');
});
