// tests/scrum683b-cableado-dictado.test.mjs — SCRUM-683 (cableado)
//
// EL CABLE: `parteDictado.ts` deja de ser un motor sin llamador. Este fichero prueba las tres
// cosas que el cable NO puede romper por el camino.
//
//   ① El dictado viaja como TEXTO y la protección de la cantidad SOBREVIVE al viaje.
//   ② La pantalla del técnico sigue sin un solo importe, y no usa la API de voz del navegador.
//   ③ La cantidad retirada se PINTA, en la línea a la que le falta, con el texto APROBADO.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const FUENTE_VISTA = fs.readFileSync(VISTA, 'utf8');

const { AVISOS_DEL_DICTADO } = await import('../dist/modules/jobs/domain/parteDictado.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL VIAJE: solo texto, y la protección sobrevive
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683b · 🔴 el dictado llega al modelo como TEXTO, y vuelve SIN la cantidad inventada', async () => {
  process.env.GEMINI_API_KEY = 'clave-de-mentira-para-el-test';
  process.env.GEMINI_MODEL = 'modelo-de-test';

  const cuerpos = [];
  const fetchReal = globalThis.fetch;
  // El modelo devuelve el 1 clásico en una línea que el dictado NO cuantifica.
  globalThis.fetch = async (url, init) => {
    cuerpos.push(String(init?.body ?? ''));
    const respuesta = JSON.stringify([
      { bloque: 'materiales', descripcion: 'Videograbador', unds: 1 },
      { bloque: 'mano_obra', descripcion: 'Canalización con canaleta', unds: 3 },
    ]);
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: respuesta }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const { suggestLineasDeParte } = await import('../dist/modules/ai/domain/ai.service.js');
    const dictado = 'Sustituir el videograbador y hacer canalización con canaleta';
    const p = await suggestLineasDeParte({ dictado });

    // SUELO: si no salió ninguna petición, este test no ha medido el cable, ha medido nada.
    assert.equal(cuerpos.length, 1, '🔴 CIEGO: no salió ninguna petición al modelo');

    // El cuerpo lleva el dictado, y NADA que no sea texto.
    const cuerpo = JSON.parse(cuerpos[0]);
    const partes = [...cuerpo.systemInstruction.parts, ...cuerpo.contents.flatMap((c) => c.parts)];
    assert.ok(partes.every((x) => Object.keys(x).length === 1 && typeof x.text === 'string'),
      '🔴 sale del proceso algo que no es texto: el argumento de protección de datos se cae');
    assert.ok(cuerpos[0].includes('videograbador'), '🔴 el dictado no viaja: el modelo no ve nada');

    // 🔴 LO QUE IMPORTA: el 1 y el 3 no los dice el dictado, y NO llegan.
    const todas = [...p.mano_obra, ...p.materiales, ...p.sinBloque];
    assert.equal(todas.length, 2, 'las dos líneas se proponen: no desaparece ninguna');
    for (const l of todas) {
      assert.ok(!('unds' in l),
        `🔴 «${l.descripcion}» ha cruzado el cable con cantidad ${l.unds}. El saneador está ` +
        'puenteado: el cable ha devuelto la protección al prompt, que es una petición.');
    }
    assert.equal(p.cantidadesRetiradas.length, 2, '🔴 lo retirado no se está contando');
  } finally {
    globalThis.fetch = fetchReal;
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LA PANTALLA: ni un importe, y NINGUNA API de voz
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La vista SIN comentarios: un guard de texto se caza a sí mismo en el comentario que explica la
 *  prohibición, y esta vista explica por qué NO usa `SpeechRecognition`. */
function vistaSinComentarios() {
  return FUENTE_VISTA
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
}

test('SCRUM-683b · 🔴 el campo del dictado es un TEXTAREA: cero API de voz del navegador', () => {
  const codigo = vistaSinComentarios();

  // SUELO del despojador: si se ha comido el fichero, «no hay voz» sería cierto y vacío.
  assert.ok(codigo.includes('function pintarDictado'),
    '🔴 CIEGO: el despojador de comentarios se ha llevado el código que hay que mirar');

  const VOZ = /SpeechRecognition|webkitSpeechRecognition|navigator\.mediaDevices|getUserMedia|MediaRecorder/;
  assert.ok(!VOZ.test(codigo),
    '🔴 LA PANTALLA USA LA API DE VOZ DEL NAVEGADOR.\n' +
    '   El técnico dicta con el MICRÓFONO DEL TECLADO de su móvil: funciona en iPhone y Android,\n' +
    '   es gratis y EL AUDIO NO SALE DEL TELÉFONO. Mandar voz de la obra —con el nombre del\n' +
    '   cliente y los detalles de su sistema de seguridad— a un proveedor es otra decisión, y no\n' +
    '   es ésta. Para este campo, «no hacer nada» ES la funcionalidad.');

  assert.ok(/<textarea/.test(codigo), '🔴 no hay textarea: entonces no hay dónde dictar');

  // Y el control positivo del detector: sobre un texto que SÍ la usa, tiene que saltar.
  assert.ok(VOZ.test('var r = new webkitSpeechRecognition();'),
    '🔴 el detector no reconoce ni el caso evidente: su verde no significaría nada');
});

test('SCRUM-683b · ⛔ CONTROL NEGATIVO: la pantalla del técnico sigue sin un solo importe', () => {
  const DINERO = [
    { patron: /\d+[.,]\d{2}\s*€/, que: 'un importe con el símbolo del euro' },
    { patron: /€/, que: 'el símbolo del euro' },
    { patron: /precioUnitario/, que: 'el precio unitario' },
    { patron: /tipoIva/, que: 'el tipo de IVA' },
  ];
  const encontrados = DINERO.filter((d) => d.patron.test(FUENTE_VISTA)).map((d) => d.que);
  assert.deepEqual(encontrados, [],
    '🔴 EL DICTADO HA METIDO DINERO EN LA PANTALLA DEL TÉCNICO: ' + encontrados.join(', ') + '.\n' +
    '   En el parte real firmado la columna IMPORTE está EN BLANCO.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LO RETIRADO SE PINTA, EN SU LÍNEA
// ═════════════════════════════════════════════════════════════════════════════════════════

function montar() {
  const contenedor = { innerHTML: '' };
  const ctx = { console, window: null, document: { createElement: () => ({ style: {} }) },
    Date, Array, Object, String, Number, JSON, isFinite };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(FUENTE_VISTA, ctx, { filename: 'parteDetailView.js' });
  return { ctx, contenedor };
}

test('SCRUM-683b · 🔴 la línea SIN cantidad enseña el aviso APROBADO, y la que la tiene NO', () => {
  const { ctx, contenedor } = montar();
  assert.equal(typeof ctx.partePintarPropuesta, 'function', '🔴 la vista no publica el pintor');

  const pintado = ctx.partePintarPropuesta(contenedor, {
    propuesta: {
      vacia: false, motivo: null,
      mano_obra: [{ descripcion: 'Canalización con canaleta' }],
      materiales: [{ descripcion: 'Cámara minidomo Uniview', unds: 2 }],
      sinBloque: [],
      cantidadesRetiradas: [{ descripcion: 'Canalización con canaleta', propuesta: 1 }],
    },
    avisos: AVISOS_DEL_DICTADO,
  });
  assert.equal(pintado, true, '🔴 no ha pintado una propuesta válida');

  const html = contenedor.innerHTML;
  // El aviso aparece UNA vez: solo en la línea a la que le falta.
  const cuantos = (html.match(/data-falta-cantidad="1"/g) || []).length;
  assert.equal(cuantos, 1,
    `🔴 el aviso de cantidad sale ${cuantos} veces y solo falta en UNA línea. Es un aviso DE ` +
    'LÍNEA, no un resumen: por eso el fundador lo aprobó en singular.');

  assert.ok(html.includes(AVISOS_DEL_DICTADO.cantidadesRetiradas),
    '🔴 no se pinta el texto aprobado. La cantidad retirada tiene que DECIRSE: quitarla en ' +
    'silencio deja al técnico sin saber que hubo un número.');

  // Y la línea que sí trae cantidad la lleva en su campo, para que él la corrija.
  assert.ok(html.includes('value="2"'), '🔴 la cantidad respaldada no llega al campo');
});

test('SCRUM-683b · 🔴 SUELO: propuesta vacía → se DICE, y no se pinta ninguna línea', () => {
  const { ctx, contenedor } = montar();
  const pintado = ctx.partePintarPropuesta(contenedor, {
    propuesta: { vacia: true, motivo: 'sin_lineas_reconocidas', mano_obra: [], materiales: [], sinBloque: [] },
    avisos: AVISOS_DEL_DICTADO,
  });
  assert.equal(pintado, false, 'una propuesta vacía no es un pintado con éxito');
  assert.ok(contenedor.innerHTML.includes(AVISOS_DEL_DICTADO.sin_lineas_reconocidas),
    '🔴 la pantalla se queda MUDA: el parte en blanco tiene que decir por qué');
  assert.ok(!contenedor.innerHTML.includes('data-propuesta="1"'),
    '🔴 se ha pintado alguna línea sobre una propuesta vacía: eso es rellenar con nada');
});

test('SCRUM-683b · 🔴 lo confirmado se lee de los CAMPOS, no de lo que dijo la máquina', () => {
  const { ctx } = montar();
  // Una fila con la cantidad CORREGIDA a mano, y otra sin cantidad ninguna.
  const filas = [
    { bloque: 'materiales', unds: '5', descripcion: 'Cámara minidomo Uniview' },
    { bloque: 'mano_obra', unds: '', descripcion: 'Canalización con canaleta' },
  ];
  const contenedor = {
    querySelectorAll: () => filas.map((f) => ({
      getAttribute: (k) => (k === 'data-bloque' ? f.bloque : null),
      querySelector: (sel) => (sel === 'span'
        ? { textContent: f.descripcion }
        : { value: f.unds }),
    })),
  };

  const r = ctx.parteLineasConfirmadas(contenedor);
  assert.equal(r.lineas.length, 1, '🔴 ha entrado una línea sin cantidad confirmada');
  assert.equal(r.lineas[0].unds, 5,
    '🔴 no se ha leído la cantidad del CAMPO. Si se leyera de la propuesta, corregirla en ' +
    'pantalla no cambiaría nada y se guardaría lo que dijo la máquina.');
  assert.equal(r.sinCantidad, 1, '🔴 no se está contando la que no puede entrar');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LA RUTA NO ESCRIBE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-683b · 🔴 la ruta del dictado NO escribe en el parte', () => {
  const fuente = fs.readFileSync(
    path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'partes.routes.ts'), 'utf8');

  const ini = fuente.indexOf("router.post('/:id/dictado'");
  assert.ok(ini > 0, '🔴 CIEGO: no encuentro la ruta del dictado');
  // El cuerpo de la ruta, acotado por la siguiente declaración de nivel superior.
  const fin = fuente.indexOf('\nexport default router', ini);
  assert.ok(fin > ini, '🔴 CIEGO: no encuentro el final de la ruta');
  const cuerpo = fuente.slice(ini, fin);

  for (const escritura of ['prisma.parteTrabajo.update', 'prisma.parteTrabajo.create', '.update(', '.create(']) {
    assert.ok(!cuerpo.includes(escritura),
      `🔴 LA RUTA DEL DICTADO ESCRIBE (${escritura}). Tiene que DEVOLVER una propuesta: si guarda, ` +
      'una cantidad que ha leído una máquina entra en un documento que se firma y se factura sin ' +
      'que el técnico la haya mirado.');
  }
});
