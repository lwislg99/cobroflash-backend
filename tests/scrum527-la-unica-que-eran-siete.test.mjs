// tests/scrum527-la-unica-que-eran-siete.test.mjs — SCRUM-527
//
// Sin gate y sin red: lee dos ficheros del repo. Ni BD, ni servidor, ni Meta.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// `docs/WHATSAPP_TEMPLATES.md` se declara a sí mismo «Fuente de verdad» del canal por el que
// YaQu se comunica ENTERO. El 8-sep-2026 le faltaba una plantilla que se envía a clientes
// reales (`albaran_firmado_es`, usada en cuatro ficheros de `src/`) y afirmaba que
// `quote_decision_es` era «la ÚNICA plantilla del ciclo».
//
// EL DEFECTO QUE VIGILA NO ES LA FRASE: es que el documento pueda volver a quedarse atrás.
// Corregirlo a mano lo deja correcto hoy y falso otra vez en cuanto alguien añada la octava
// plantilla — que es exactamente lo que pasó con la séptima. Un documento que sólo se sincroniza
// cuando alguien se acuerda no es una fuente de verdad: es una foto vieja con buena reputación.
//
// ⚠️ Y ESTO NO COMPRUEBA EL TEXTO DE NINGUNA PLANTILLA. El copy está aprobado por Meta y es del
// fundador (regla 30): aquí sólo se cruzan NOMBRES. Un test que fijara los literales convertiría
// cualquier retoque aprobado en Meta en un rojo de esta tanda.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = path.join(RAIZ, 'src/integrations/whatsappTemplates.ts');
const DOC = path.join(RAIZ, 'docs/WHATSAPP_TEMPLATES.md');

/**
 * Las plantillas QUE EL PRODUCTO USA, derivadas del código POR AST.
 *
 * 🔴 Del objeto `WA_TEMPLATES`, no de un `grep` de `_es`: el fichero está lleno de comentarios que
 * nombran plantillas —incluidas las que NO existen— y una búsqueda por texto las contaría igual.
 * Con AST, un nombre citado en prosa no es una propiedad y queda fuera solo.
 */
export function plantillasDelCodigo(fuente = fs.readFileSync(FUENTE, 'utf8')) {
  const sf = ts.createSourceFile('whatsappTemplates.ts', fuente, ts.ScriptTarget.Latest, true);
  const fuera = [];
  const visitar = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'WA_TEMPLATES') {
      let e = n.initializer;
      // `{...} as const`: el objeto va dentro de la aserción.
      if (e && ts.isAsExpression(e)) e = e.expression;
      if (e && ts.isObjectLiteralExpression(e)) {
        for (const p of e.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const clave = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
          if (clave && ts.isStringLiteral(p.initializer)) {
            fuera.push({ clave, plantilla: p.initializer.text });
          }
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return fuera;
}

/** El documento, sin sus bloques de código: ahí dentro hay ejemplos de consola, no declaraciones. */
function textoDelDocumento() {
  return fs.readFileSync(DOC, 'utf8').replace(/```[\s\S]*?```/g, '');
}

// ═══ ① SUELO — el ticket afirma que hay SIETE; menos de dos es el escáner roto ════════════

test('SCRUM-527 · 🔴 SUELO: el censo derivado del código ve las plantillas de verdad', () => {
  const censo = plantillasDelCodigo();
  assert.ok(censo.length >= 2,
    `🔴 ESCÁNER CIEGO: el AST sólo ve ${censo.length} plantillas en \`WA_TEMPLATES\`. El ticket\n`
    + '   midió SIETE en el código y NUEVE en Meta. Con un cero o un uno aquí, la comparación de\n'
    + '   abajo pasaría sobre un conjunto vacío y el documento parecería completo estando roto.');
  for (const { clave, plantilla } of censo) {
    assert.match(plantilla, /^[a-z0-9_]+_es$/,
      `🔴 «${plantilla}» (clave \`${clave}\`) no tiene forma de nombre de plantilla de Meta.`);
  }
});

test('SCRUM-527 · 🔴 SUELO: el AST NO se deja engañar por un nombre citado en un comentario', () => {
  // El fichero real cita en prosa plantillas que no están en el objeto. Si el censo las contara,
  // el documento tendría que documentar plantillas inexistentes para pasar este guard.
  const falso = [
    '// Aquí hablamos de fantasma_inexistente_es, que NO existe.',
    "export const WA_TEMPLATES = { real: 'real_es' } as const;",
    "const OTRO = { otra: 'otra_es' };",
  ].join('\n');
  const censo = plantillasDelCodigo(falso).map((x) => x.plantilla);
  assert.deepEqual(censo, ['real_es'],
    `🔴 el censo devuelve ${JSON.stringify(censo)}. Tiene que leer SÓLO \`WA_TEMPLATES\`: ni los\n`
    + '   comentarios, ni cualquier otro objeto que tenga cadenas parecidas.');
});

// ═══ ② EL TRINQUETE: lo que el producto ENVÍA está DOCUMENTADO ════════════════════════════

test('SCRUM-527 · 🔴 toda plantilla que el producto USA está en el documento', () => {
  const censo = plantillasDelCodigo();
  const doc = textoDelDocumento();
  const ausentes = censo.filter(({ plantilla }) => !doc.includes(plantilla));
  assert.deepEqual(ausentes.map((x) => x.plantilla), [],
    '🔴 EL DEFECTO DEL TICKET: hay plantillas que el producto ENVÍA A CLIENTES REALES y que el\n'
    + '   documento que se llama «Fuente de verdad» no menciona:\n'
    + ausentes.map((x) => `       ${x.plantilla}  (WA_TEMPLATES.${x.clave})`).join('\n')
    + '\n\n   Se añade su sección a `docs/WHATSAPP_TEMPLATES.md` con la estructura MEDIDA en\n'
    + '   `WA_TEMPLATE_SPECS` (nº de variables, botón, cabecera). El TEXTO de la plantilla no se\n'
    + '   inventa: está aprobado en Meta y es del fundador (regla 30).');
});

test('SCRUM-527 · ✅ NEGATIVO: el guard SÍ caza una plantilla sin documentar', () => {
  // Sin esto, «todas documentadas» y «el detector no mira» dan el mismo verde.
  const doc = textoDelDocumento();
  assert.ok(!doc.includes('plantilla_que_no_existe_es'),
    '🔴 el documento menciona la plantilla de control: este caso ha dejado de discriminar.');
  const inventado = [{ clave: 'fantasma', plantilla: 'plantilla_que_no_existe_es' }];
  const ausentes = inventado.filter(({ plantilla }) => !doc.includes(plantilla));
  assert.equal(ausentes.length, 1,
    '🔴 una plantilla inventada NO sale como ausente: la comprobación de arriba no mide nada.');
});

// ═══ ③ LA ADVERTENCIA QUE NO SE PUEDE PERDER AL CORREGIR EL DATO ══════════════════════════

test('SCRUM-527 · 🔴 la advertencia de NO reutilizar `quote_decision_es` SIGUE en el documento', () => {
  // 🛑 La trampa que el ticket marca en voz alta: lo que caduca es el RECUENTO («la única»); lo
  // que NO caduca es la RAZÓN — reenviar la plantilla que ABRE la conversación le llega al cliente
  // como el mensaje de antes, que es la receta del «pero si esto ya lo firmé» (SCRUM-195).
  //
  // Se comprueba por CONTENIDO y no por número de línea: las citas por posición caducan, y ya
  // mordieron dos veces esta semana (SCRUM-636 y la entrada de 632).
  const doc = textoDelDocumento();
  assert.match(doc, /quote_decision_es/,
    '🔴 el documento ya no nombra `quote_decision_es`.');
  assert.match(doc, /ya lo firm/i,
    '🔴 HA DESAPARECIDO LA ADVERTENCIA. Al corregir el recuento se ha borrado la razón: que\n'
    + '   reenviar la plantilla que abre la conversación produce el «pero si esto ya lo firmé».\n'
    + '   El arreglo habría EMPEORADO el documento — corregir el número no es quitar el aviso.');
  assert.match(doc, /SCRUM-195/,
    '🔴 la advertencia ha perdido su procedencia: sin el ticket que la decidió, el siguiente que\n'
    + '   la lea no puede saber si sigue vigente ni quién la firmó.');
});

// ═══ ④ LAS DE META POR DEFECTO, DECLARADAS PARA QUE NADIE LAS CUENTE ══════════════════════

test('SCRUM-527 · 🔴 las plantillas de Meta por defecto están declaradas COMO AJENAS', () => {
  // El inventario de ROAD-51 contó 9 en WhatsApp Manager: 7 nuestras y 2 que trae Meta de fábrica.
  // Sin dejarlo escrito, el próximo inventario vuelve a contar 9 y el documento vuelve a no cuadrar.
  const doc = textoDelDocumento();
  for (const ajena of ['hello_world', '3p_direct_integration_test_template']) {
    assert.ok(doc.includes(ajena),
      `🔴 «${ajena}» no está declarada en el documento. La trae Meta de fábrica y NO es nuestra:\n`
      + '   si no consta, el siguiente inventario la vuelve a contar como plantilla del ciclo.');
  }
  assert.ok(!plantillasDelCodigo().some((x) => ['hello_world', '3p_direct_integration_test_template'].includes(x.plantilla)),
    '🔴 una plantilla de Meta ha entrado en `WA_TEMPLATES`: eso sí sería nuestra.');
});

// ═══ ⑤ LA FRASE QUE ORIGINÓ EL TICKET NO PUEDE VOLVER ═════════════════════════════════════

test('SCRUM-527 · 🔴 no se vuelve a afirmar que hay UNA SOLA plantilla del ciclo', () => {
  // La frase original decía «la ÚNICA plantilla del ciclo». Leída en su tabla hablaba de COSTE
  // —la única que se PAGA con ventana-first— pero se citó como inventario, incluso dentro del
  // código (`src/integrations/whatsapp.ts`, bloque de SCRUM-195). Una frase que se lee mal dos
  // veces no es un lector distraído: es una frase ambigua.
  //
  // 🔴 SE MIRAN LAS LÍNEAS QUE AFIRMAN, NO LAS QUE CITAN. La primera versión de este test se cazó
  // a sí misma: el bloque del documento que explica la corrección REPRODUCE la frase vieja
  // («Este documento decía que … era “la ÚNICA plantilla del ciclo”»), así que salía rojo con el
  // defecto ya arreglado. Es la misma trampa que mordió a SCRUM-614 y a SCRUM-617.
  //
  // La salida NO es borrar la explicación —sin ella nadie sabe qué se corrigió ni por qué—, sino
  // distinguir afirmar de citar: las líneas de bloque de cita (`>`) documentan el pasado; el resto
  // habla en presente. Un documento tiene que poder contar su propio error.
  const doc = textoDelDocumento();
  const afirmaciones = doc.split('\n').filter((l) => !/^\s*>/.test(l));

  // ✅ CONTROL POSITIVO del filtro: si quitar las citas se llevara el documento entero, el assert
  // de abajo pasaría sobre un vacío y este guard dejaría de vigilar nada.
  assert.ok(afirmaciones.join('\n').includes('quote_decision_es'),
    '🔴 al quitar las líneas de cita se ha perdido el documento: lo de abajo mide sobre nada.');

  const reincidencia = afirmaciones.filter((l) => /la ÚNICA plantilla del ciclo/i.test(l));
  assert.deepEqual(reincidencia, [],
    '🔴 ha vuelto «la ÚNICA plantilla del ciclo» COMO AFIRMACIÓN:\n'
    + reincidencia.map((l) => '       ' + l.trim()).join('\n')
    + '\n\n   Si lo que se quiere decir es que es la única que se PAGA bajo ventana-first, hay que\n'
    + '   decir eso: son SIETE en el código, medidas por AST. (Citarla para explicar que era falsa\n'
    + '   sí vale, y por eso este guard sólo mira las líneas que no son bloque de cita.)');
});
