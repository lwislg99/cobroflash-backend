// tests/scrum827-el-trinquete-mira-el-valor.test.mjs — SCRUM-827
//
// Sin gate: lee el árbol con AST. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN TIPO DE IVA ESCRITO A MANO YA NO PASA POR DELANTE
//
// EL DEFECTO ERA DEL INSTRUMENTO, no del producto: los trinquetes del IVA vigilaban el NOMBRE y
// no el VALOR, así que un `0.21` copiado a mano pasaba y **nadie se enteraba**. Y no estaba
// escondido — estaba DECLARADO POR ESCRITO, con estas palabras:
//
//   `tests/scrum646-cortafuegos-defaultvat.test.mjs:27`
//     «Esto vigila el NOMBRE. Si alguien copia el número `0.21` a mano en un `create`, este
//      guard no lo ve. No se puede vigilar «un tipo impositivo» sin vigilar cualquier número,
//      y eso no es un guard: es ruido.»
//
//   `tests/scrum664-el-compilador-como-censo.test.mjs:11`
//     «① vigila el NOMBRE, no el VALOR: un `0.21` escrito a mano pasa por delante.
//      🔴 NO SE CUBRE AQUÍ.»
//
// 🔒 Un límite declarado y no cerrado deja de ser una advertencia y pasa a ser un permiso. Llevaba
// escrito desde el 3-sep-2026 y nadie lo había cruzado.
//
// ⛔ NINGUNO DE LOS DOS SE RELAJA. Aquéllos vigilan que nadie NOMBRE `defaultVat` fuera de la
// tabla; éste vigila que nadie escriba su VALOR. Son complementarios y se completan, no se
// sustituyen.
//
// ── POR QUÉ EL IVA Y NO OTRO NÚMERO ──────────────────────────────────────────────────────
// Es el número que decide cuánto se le cobra al cliente y cuánto se le declara a Hacienda. Un
// tipo tecleado que el trinquete no ve es un valor fiscal sin vigilancia, en un producto cuyo
// camino de emisión está protegido por todas partes menos por ésta.
//
// ⛔ Este fichero SOLO LEE el camino fiscal (regla 38). No lo modifica y no lo importa.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  censarLiteralesDeIva, esNombreFiscal, esTipoConocido, segmentos, NOMBRES_FISCALES,
} from './_censo-literales-de-iva.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const DIRS = ['src', 'public'];

/**
 * EL ÚNICO SITIO QUE PUEDE LLEVAR UN TIPO DE IVA ESCRITO: la tabla de locales.
 *
 * Es la tabla misma —el sitio donde el número ES el dato, no una copia—, y es el mismo fichero que
 * `scrum646` reconoce como único legítimo para NOMBRAR `defaultVat`. Los dos guards apuntan al
 * mismo sitio por caminos distintos, que es lo que los hace complementarios.
 */
const LA_TABLA = 'src/core/i18n/locales.ts';

const censo = censarLiteralesDeIva(DIRS, { raiz: RAIZ });

test('SCRUM-827 · 🔴 SUELO: el barrido ve la tabla — si devuelve cero, está CIEGO', () => {
  // Un cero aquí no dice «no hay tipos escritos»: dice que el AST no ha mirado. Y sabemos que hay
  // al menos seis, porque la tabla de locales los tiene por construcción.
  assert.ok(censo.length >= 6,
    `🔴 CIEGO: el censo devuelve ${censo.length} aciertos y la tabla de locales tiene SEIS por sí `
    + 'sola. O el barrido no llega a `src/`, o el detector dejó de reconocer los literales.');

  const enLaTabla = censo.filter((h) => h.fichero === LA_TABLA);
  assert.equal(enLaTabla.length, 6,
    `🔴 la tabla de locales da ${enLaTabla.length} tipos y son SEIS (ES 0.21 · MX 0.16 · CO 0.19 · `
    + 'AR 0.21 · PE 0.18 · CL 0.19). Si cambia, este número se actualiza A MANO y se dice por qué.');
});

test('SCRUM-827 · ✅ POSITIVO ENUMERADO: los seis tipos de la tabla, uno a uno', () => {
  const enLaTabla = censo.filter((h) => h.fichero === LA_TABLA).map((h) => h.valor);
  assert.deepEqual(enLaTabla, [0.21, 0.16, 0.19, 0.21, 0.18, 0.19],
    '🔴 los seis tipos de la tabla ya no salen en orden y con su valor. Un censo que no reconoce '
    + 'lo que sabe que existe no puede afirmar nada sobre lo que no encuentra.');
});

test('SCRUM-827 · 🔴 EL TRINQUETE: fuera de la tabla NO hay ni un tipo de IVA escrito a mano', () => {
  const fuera = censo.filter((h) => h.fichero !== LA_TABLA)
    .map((h) => `${h.fichero}:${h.linea}  ${h.nombre} = ${h.valor}   « ${h.texto} »`);

  assert.deepEqual(fuera, [],
    '🔴 HAY UN TIPO DE IVA ESCRITO A MANO FUERA DE LA TABLA:\n    ' + fuera.join('\n    ')
    + '\n\n  El IVA decide cuánto se cobra y cuánto se declara. Un tipo tecleado en otro sitio se '
    + 'queda diciendo lo de antes el día que cambie la tabla, y NADA avisa: sale, se guarda y el '
    + 'descuadre aparece meses después.\n'
    + `  El único sitio que puede llevarlo es \`${LA_TABLA}\`, que es la tabla misma.\n`
    + '  Si lo que necesitas es el tipo de un país, pídeselo a `getLocale(pais)`; si es el de una '
    + 'línea, sale del documento (`tiposDeIva.js`), nunca de un número escrito.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ EL CONTROL NEGATIVO, Y ESTÁ APUNTADO A CASOS QUE EXISTEN DE VERDAD
//
// No es una hipótesis: SCRUM-664 midió que un guard por VALOR SOLO daba 12 aciertos en `src/` y
// `public/`, y **cinco eran ruido**. Los cinco siguen ahí, en el árbol, hoy. Si este censo los
// contara, nacería dando rojo por el ancho de una columna de PDF — y un guard que acusa a quien
// no toca se apaga en una tarde.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-827 · ✅ NEGATIVO: un 0.21 que NO es un tipo de IVA no se cuenta', () => {
  const RUIDO_CONOCIDO = [
    ['src/modules/invoicing/infra/pdf/pdf.service.ts', 'anchura de columna (`wRot = totalsW * 0.21`)'],
    ['src/modules/jobs/infra/albaranPdf.service.ts', 'anchuras de columna (0.18 ×2)'],
    ['src/modules/system/domain/qrPagina.service.ts', 'fórmula de contraste WCAG (0.05 ×2)'],
  ];

  // SUELO del propio control: si esos ficheros ya no existen, este test pasaría vacío y estaría
  // certificando el silencio de un árbol que no ha mirado.
  for (const [f] of RUIDO_CONOCIDO) {
    assert.ok(fs.existsSync(path.join(RAIZ, f)),
      `🔴 el control negativo apunta a \`${f}\`, que ya no existe. Sin sujeto no controla nada: `
      + 'busca otro caso REAL de 0.21/0.18/0.05 que no sea fiscal, o retira el caso diciéndolo.');
  }

  const acusados = RUIDO_CONOCIDO
    .filter(([f]) => censo.some((h) => h.fichero === f))
    .map(([f, qué]) => `${f} — es ${qué}`);
  assert.deepEqual(acusados, [],
    '🔴 EL CENSO ACUSA A QUIEN NO TOCA:\n    ' + acusados.join('\n    ')
    + '\n\n  Estos números valen 0.21, 0.18 y 0.05 y NO tienen nada que ver con impuestos. Si '
    + 'salen, el criterio ha dejado de exigir el NOMBRE y ha pasado a mirar sólo el VALOR — que es '
    + 'exactamente lo que `scrum646:27` advertía que sería ruido y no un guard.');

  // Y la mitad simétrica, sobre casos fabricados: un porcentaje que no es fiscal, y un nombre
  // fiscal con un valor que no es un tipo.
  assert.equal(esNombreFiscal('descuentoGlobal'), false, 'un descuento no es un impuesto');
  assert.equal(esNombreFiscal('derivado'), false, '🔴 `iva` casando DENTRO de `derivado`: subcadena');
  assert.equal(esNombreFiscal('privado'), false, '🔴 `iva` dentro de `privado`');
  assert.equal(esNombreFiscal('activar'), false, '🔴 `iva` dentro de `activar`');
  assert.equal(esTipoConocido(0.5), false, 'medio no es un tipo de IVA');
  assert.equal(esTipoConocido(0), false, 'un `tax: 0` es una exención legítima, no un hallazgo');
});

test('SCRUM-827 · 🔴 el NOMBRE se compara por SEGMENTOS: `defaultVat` SÍ es fiscal', () => {
  // La lección literal de SCRUM-664 (`:151-152`): «`defaultVat` NO contiene `vat` — lleva `Vat`,
  // con V mayúscula, y `includes` distingue». Una comparación ingenua se dejaría fuera justo el
  // caso que originó todo esto.
  assert.deepEqual(segmentos('defaultVat'), ['default', 'vat']);
  assert.equal(esNombreFiscal('defaultVat'), true,
    '🔴 `defaultVat` ha dejado de reconocerse como fiscal: el censo se quedaría ciego al ÚNICO '
    + 'caso real que este ticket vino a cerrar.');
  assert.equal(esNombreFiscal('vatName'), true);
  assert.equal(esNombreFiscal('tipo_iva'), true, 'también por guion bajo');
  assert.ok(NOMBRES_FISCALES.includes('igic') && NOMBRES_FISCALES.includes('igv'),
    'Canarias (IGIC) y Perú (IGV) están en el producto: no son hipótesis');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO, PROVOCADO SOBRE FUENTE SINTÉTICA — y con el mecanismo VIEJO al lado
//
// El censo se ejercita sobre un árbol de mentira, no sobre el repo: provocar el caso tocando el
// árbol de verdad dejaría el rojo dependiendo de que alguien acuerde deshacerlo.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-827 · 🔴 EL ROJO: un `0.21` a mano en un sitio nuevo CAE, con fichero y línea', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum827-'));
  fs.mkdirSync(path.join(raiz, 'src'), { recursive: true });
  const f = path.join(raiz, 'src', 'algunServicio.ts');
  fs.writeFileSync(f,
    'export function crearLinea() {\n'
    + '  return { concepto: "Mano de obra", precio: 100, tax: 0.21 };\n'
    + '}\n');

  const h = censarLiteralesDeIva(['src'], { raiz });
  assert.equal(h.length, 1, '🔴 el censo NO ve un `tax: 0.21` escrito a mano: no mide lo que dice');
  assert.equal(h[0].fichero, 'src/algunServicio.ts');
  assert.equal(h[0].linea, 2, '🔴 sin la línea, el rojo obliga a buscar a mano dónde está');
  assert.equal(h[0].nombre, 'tax');
  assert.equal(h[0].valor, 0.21);

  // ── Y EL MISMO CASO CON EL MECANISMO VIEJO: pasa. Es la mitad que enseña por qué hacía falta.
  // `scrum646` vigila el NOMBRE `defaultVat`; este fichero no lo nombra, así que aquel guard no
  // tiene nada que ver aquí — el `0.21` le pasa por delante, tal y como su cabecera declaraba.
  const codigo = fs.readFileSync(f, 'utf8');
  assert.equal(/defaultVat/.test(codigo), false,
    '🔴 el caso sintético nombra `defaultVat`, así que lo cazaría el guard VIEJO y no probaría el '
    + 'hueco. El caso tiene que ser uno que el mecanismo anterior deje pasar.');

  fs.rmSync(raiz, { recursive: true, force: true });
});

test('SCRUM-827 · 🔴 el rojo también cae con el PORCENTAJE ENTERO, no sólo con la fracción', () => {
  // Las pantallas enseñan enteros y la tabla guarda fracciones: vigilar sólo una forma dejaría la
  // otra abierta, y el front es justo donde estaba el caso real.
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum827b-'));
  fs.mkdirSync(path.join(raiz, 'public'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'public', 'vista.js'),
    'const fila = { concepto: "X", tipoIva: 21 };\n');

  const h = censarLiteralesDeIva(['public'], { raiz });
  assert.equal(h.length, 1, '🔴 un `tipoIva: 21` entero pasa por delante');
  assert.equal(h[0].valor, 21);

  fs.rmSync(raiz, { recursive: true, force: true });
});
