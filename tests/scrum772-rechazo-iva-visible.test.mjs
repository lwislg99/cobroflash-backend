// tests/scrum772-rechazo-iva-visible.test.mjs — SCRUM-772 (VOZ-ALB)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUE EL RECHAZO DEL IVA POR VOZ SE VEA. Es la última pieza de la cadena:
//
//   SCRUM-760 · el 100 % dejó de pintarse (la puerta RECHAZA en vez de recortar) y el motivo
//               empezó a viajar en `tipoIvaRechazado`.
//   SCRUM-771 · ninguna boca emite sin validar.
//   SCRUM-772 · (esto) el profesional SE ENTERA.
//
// ── EL ROJO, MEDIDO POR EL CAMINO REAL antes de tocar nada ───────────────────────────────
// Cargando `jobDetailView.js` del árbol en un navegador y recorriendo 🎤 Dictar → «Convertir en
// líneas» → «Añadir al parte», con el modelo devolviendo 100:
//
//   motivo que viajaba : "fuera de rango (0 a 1): 100"
//   ¿aparecía «100» en pantalla? NO — el profesional no se enteraba de nada
//   la línea entraba con 21, y ese 21 se leía como el 21 que él eligió
//
// ── LO QUE EL AVISO TIENE QUE DECIR, y por eso está escrito así ──────────────────────────
//   · EL NÚMERO QUE LLEGÓ: sin él no se sabe si falló el micro, el modelo o uno mismo.
//   · QUE EL 21 ES UN RELLENO: sin esa frase, el 21 del sistema pasa por decisión del
//     profesional — y el defecto se vuelve invisible justo cuando acierta por casualidad.
//   · NO BLOQUEA: es un aviso al lado de la línea (decisión del fundador).
//
// ── QUÉ VIGILA ESTE FICHERO Y QUÉ NO ────────────────────────────────────────────────────
// El MECANISMO. La CAJA se midió en navegador a 929 y 390 px con el texto dentro (77 car →
// 1 línea de 412,5×16,9 px y 2 líneas de 290×33,8 px, sin desbordar) y queda en el parte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { invalidTipoIva } from '../dist/core/validation/fiscalInput.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = 'public/dashboard/js/jobDetailView.js';
const fuente = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');

/** El texto FIRMADO por el asesor (6-sep-2026), con el valor recibido dentro. */
const TEXTO = (dicho) => `No he entendido el IVA (dijiste ${dicho}). Está puesto el 21 %; cámbialo si no es.`;

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1 · EL VALOR SE SACA DEL MOTIVO QUE YA VIAJA — las tres formas, DERIVADAS
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-772 · el valor dicho se deriva del motivo REAL, en sus tres formas', () => {
  const { vozIvaValorDicho } = cargarDashboard(RAIZ).ctx;
  assert.equal(typeof vozIvaValorDicho, 'function',
    '🔴 `vozIvaValorDicho` ya no es alcanzable desde el panel.');

  // 🔴 LOS MOTIVOS NO SE ESCRIBEN A MANO: los genera `invalidTipoIva`, que es quien los produce
  // en producción. Un motivo copiado aquí envejecería solo el día que alguien cambie la frase, y
  // este test seguiría verde mientras la pantalla dejaba de decir el número.
  const CASOS = [
    { entrada: 100, dicho: '100' },      // forma 2 · fuera de rango
    { entrada: 37, dicho: '37' },        // forma 2
    { entrada: 1.5, dicho: '1.5' },      // forma 2 · decimal
    { entrada: -0.2, dicho: '-0.2' },    // forma 2 · negativo
    { entrada: 'abc', dicho: 'abc' },    // forma 1 · no es un número
    { entrada: 0.15, dicho: '15 %' },    // forma 3 · el valor va DELANTE
    { entrada: 0.0825, dicho: '8.25 %' },// forma 3 · decimal
  ];
  for (const c of CASOS) {
    const motivo = invalidTipoIva(c.entrada);
    assert.ok(motivo, `🔴 \`invalidTipoIva(${JSON.stringify(c.entrada)})\` ya no rechaza: el caso no prueba nada.`);
    assert.equal(vozIvaValorDicho(motivo), c.dicho,
      `🔴 de «${motivo}» se saca ${JSON.stringify(vozIvaValorDicho(motivo))} y el valor que llegó ` +
      `es ${JSON.stringify(c.dicho)}.`);
  }

  // 🔴 LA TRAMPA DE LA TERCERA FORMA: lleva un «Admitidos: 0 %, 2 %, …» detrás. Un «lo de después
  // de los dos puntos» —que es lo primero que uno escribe— le diría al profesional que dijo
  // «0 %, 2 %, 4 %…», o sea un valor que no dijo.
  const motivo15 = invalidTipoIva(0.15);
  assert.ok(motivo15.includes('Admitidos:'), 'el caso ya no trae la lista: dejaría de probar la trampa');
  assert.ok(!vozIvaValorDicho(motivo15).includes('Admitidos'),
    '🔴 el extractor se está trayendo la lista de admitidos como si fuera lo que dijo el modelo.');

  // Sin motivo NO hay valor: quien lo use no puede inventarse un número.
  for (const vacio of [undefined, null, '', '   ', 'una frase sin dos puntos ni porcentaje']) {
    assert.equal(vozIvaValorDicho(vacio), null,
      `🔴 con ${JSON.stringify(vacio)} devuelve algo: el aviso pintaría un número inventado.`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2 · EL TEXTO, FIRMADO — y el 21 que promete es el que la fila pone
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-772 · el aviso es el texto firmado, con el valor dentro', () => {
  assert.ok(fuente.includes('`No he entendido el IVA (dijiste ${dichoIva}). Está puesto el 21 %; cámbialo si no es.`'),
    '🔴 el aviso ya no es el texto firmado por el asesor el 6-sep-2026. La microcopy no se ' +
    'cambia de refilón (regla 30).');
  assert.equal(TEXTO('100').length, 77, 'el literal con «100» dentro mide 77 caracteres');
});

test('SCRUM-772 · 🔴 el 21 que PROMETE el aviso es el que la fila pone de verdad', () => {
  // El aviso dice «Está puesto el 21 %». Ese 21 y el que `mkRow` escribe cuando no hay tipo son
  // DOS SITIOS, y el texto está firmado así que no puede derivarse. Lo que sí se puede es exigir
  // que no se separen: si alguien cambia el relleno de la fila, el aviso pasa a MENTIR sobre lo
  // que el sistema acaba de hacer, y eso es peor que no avisar.
  assert.ok(/iv\.value = \(l\.tipoIva !== undefined && l\.tipoIva !== null\) \? l\.tipoIva : 21;/.test(fuente),
    '🔴 el relleno de IVA de la fila ya no es 21, y el aviso firmado sigue prometiendo «el 21 %». ' +
    'O vuelve el 21, o hace falta microcopy nueva: es firma del asesor, no un ajuste.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3 · LO QUE NO PUEDE HACER: bloquear, o salir siempre
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-772 · ⛔ NO bloquea: ni la casilla, ni «Añadir al parte», ni la firma', () => {
  // La casilla de cada línea propuesta nace marcada, y el aviso no la toca.
  assert.ok(/chk\.type = 'checkbox'; chk\.checked = true;/.test(fuente),
    '🔴 la línea propuesta ya no nace marcada: el aviso estaría condicionando lo que se añade.');
  // El botón de añadir no mira el rechazo por ningún lado.
  const bloque = fuente.slice(fuente.indexOf("anadir.textContent = 'Añadir al parte'"), fuente.indexOf('res.appendChild(anadir);'));
  assert.ok(bloque.length > 0, 'no encuentro el bloque de «Añadir al parte»');
  assert.ok(!/tipoIvaRechazado|dichoIva|disabled/.test(bloque),
    '🔴 «Añadir al parte» ha empezado a mirar el rechazo o a deshabilitarse. La decisión del ' +
    'fundador es explícita: esto AVISA, no bloquea.');
});

test('SCRUM-772 · ✅ sólo en VALORADO, y sólo cuando hay rechazo', () => {
  // En SIN_VALORAR no hay columna de IVA que corregir: avisar de un IVA que la pantalla ni
  // enseña sería ruido. Y sin rechazo no hay aviso: si saliera siempre, no informaría.
  assert.ok(/const dichoIva = modo === 'VALORADO' \? vozIvaValorDicho\(l\.tipoIvaRechazado\) : null;/.test(fuente),
    '🔴 el aviso ha dejado de depender del modo o del rechazo. Si sale siempre, es ruido; si sale ' +
    'en SIN_VALORAR, habla de una columna que esa pantalla no tiene.');
  assert.ok(/if \(dichoIva\) \{/.test(fuente),
    '🔴 el aviso se pinta sin comprobar que haya valor: pintaría «dijiste null».');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 4 · EL DATO SIGUE LLEGANDO — si el back deja de mandarlo, esto cae
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-772 · el canal de SCRUM-760 sigue abierto: sin él no hay nada que pintar', () => {
  const svc = fs.readFileSync(path.join(RAIZ, 'src/modules/ai/domain/ai.service.ts'), 'utf8');
  assert.ok(/linea\.tipoIvaRechazado = motivo;/.test(svc),
    '🔴 `ai.service.ts` ha dejado de poner `tipoIvaRechazado`. El aviso de la pantalla se queda ' +
    'mudo y no lo nota nadie: es exactamente el defecto que este ticket vino a cerrar, al revés.');
  const rutas = fs.readFileSync(path.join(RAIZ, 'src/modules/ai/app/routes/ai.routes.ts'), 'utf8');
  assert.ok(/tipoIvaRechazado/.test(rutas),
    '🔴 la ruta ya no documenta ni sirve `tipoIvaRechazado`.');
});
