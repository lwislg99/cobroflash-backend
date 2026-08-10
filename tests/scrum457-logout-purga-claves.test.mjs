// tests/scrum457-logout-purga-claves.test.mjs — SCRUM-457
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: un profesional cierra sesión en el móvil de la furgoneta que comparte con dos
// compañeros. Dentro se quedan el borrador de presupuesto —con el cliente y los importes— y su
// catálogo con SUS PRECIOS. Ha hecho lo único que el producto le ofrece para protegerse, y no ha
// servido.
//
// 🔴 Y MEDIO PURGADO ES PEOR QUE NINGUNO: SCRUM-455 limpia IndexedDB y las cachés, así que el
// logout PARECE que limpia y el profesional deja de preocuparse.
//
// ⚠️ EL TEST QUE DECIDE LLAMA A `logout()` DE VERDAD, con el dashboard entero montado. Probar el
// purgado por su cuenta comprobaría que la función funciona, no que el logout la llama — y lo que
// le falla al profesional es lo segundo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { censarAlmacenamiento } from './_censo-almacenamiento-publico.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lo que hay en el móvil de la furgoneta cuando el profesional le da a «Salir». */
const BORRADOR = JSON.stringify({
  customerId: 77, customerName: 'Comunidad Los Olivos', vatDefault: '21',
  lines: [{ concept: 'Sustituir bajante', qty: '1', price: '1450.00', vat: '21' }],
});
const RECIENTES = JSON.stringify([{ id: 3, name: 'Codo 90 PVC', price: '4.20', vat: '21' }]);

function movilDeLaFurgoneta() {
  return {
    localStorage: {
      // Dos compañeros han entrado con el mismo móvil: hay una familia de claves, no una clave.
      'pf_quote_draft_1': BORRADOR,
      'pf_quote_draft_42': BORRADOR,
      'pf_recent_products_1': RECIENTES,
      'yaqu_tips_shown': '{"cobros":true}',
      // Y algo que NO es nuestro. Nadie sabe de quién es, y por eso no se toca.
      'otra_app_preferencias': '{"tema":"oscuro"}',
    },
    sessionStorage: { voiceUnsupported: '1' },
  };
}

// ═══ ① EL CONTROL POSITIVO, Y ES EL TEST ═════════════════════════════════════════════════

test('SCRUM-457 · tras `logout()`, del borrador y del catálogo NO queda ni un dato', async () => {
  const banco = cargarDashboard(RAIZ, movilDeLaFurgoneta());

  // SUELO: si el banco no guardara de verdad, «no queda nada» sería cierto sin significar nada.
  assert.equal(banco.ctx.localStorage.getItem('pf_quote_draft_1'), BORRADOR,
    '🔴 BANCO CIEGO: el almacén no guarda. Este test no puede medir ningún borrado.');
  assert.equal(typeof banco.ctx.logout, 'function',
    '🔴 `logout` no está publicado: el test no estaría cerrando sesión.');

  await banco.ctx.logout();

  const queda = banco.ctx.localStorage._contenido();
  const texto = JSON.stringify(queda);
  assert.ok(!/Comunidad Los Olivos|Sustituir bajante|1450\.00/.test(texto),
    `🔴 tras cerrar sesión sigue en el móvil el borrador con el cliente y los importes: ${texto}`);
  assert.ok(!/Codo 90 PVC|4\.20/.test(texto),
    `🔴 tras cerrar sesión siguen en el móvil los precios del profesional: ${texto}. No es dato ` +
    'del cliente: es su negocio, y quien coja el aparato después puede ser su competencia.');
  assert.ok(!('pf_quote_draft_42' in queda),
    '🔴 se ha purgado el borrador de UN merchant y no el del compañero. La clave lleva el id ' +
    'dentro: es una FAMILIA, y el móvil de la furgoneta tiene una por cada uno que haya entrado.');
});

// ═══ ② CONTROL NEGATIVO — lo que NO se puede llevar por delante ══════════════════════════

test('SCRUM-457 · lo ajeno y lo exceptuado SOBREVIVE al logout', async () => {
  const banco = cargarDashboard(RAIZ, movilDeLaFurgoneta());
  await banco.ctx.logout();

  const queda = banco.ctx.localStorage._contenido();
  assert.equal(queda.otra_app_preferencias, '{"tema":"oscuro"}',
    '🔴 se ha borrado una clave que no es nuestra. `localStorage.clear()` borra por si acaso, que ' +
    'es justo lo que este ticket prohíbe: el origen es compartido y no sabemos de quién es eso.');
  assert.equal(queda.yaqu_tips_shown, '{"cobros":true}',
    '🔴 se ha borrado el «no me lo vuelvas a enseñar» de los consejos. No protege a nadie y ' +
    'devuelve el tour entero en cada cierre de sesión.');
  assert.equal(banco.ctx.sessionStorage.getItem('voiceUnsupported'), '1',
    '🔴 se ha borrado la prueba del micrófono de ESTE aparato. No hay dato de nadie ahí, y ' +
    'borrarlo solo hace repetir una prueba que ya se sabe que falla.');
});

test('SCRUM-457 · purgar dos veces seguidas no revienta y no cambia nada', async () => {
  const banco = cargarDashboard(RAIZ, movilDeLaFurgoneta());
  const primera = await banco.ctx.purgarDatosLocales();
  const segunda = await banco.ctx.purgarDatosLocales();

  // ⚠️ `[...x]` y no `x.sort()`: el array viene de dentro del `vm` y su prototipo es el de OTRO
  // realm, así que `deepStrictEqual` lo rechaza aunque el contenido sea idéntico. Ya mordió en
  // SCRUM-420 y el rojo parece del producto cuando es del banco.
  assert.deepEqual([...primera.claves].sort(),
    ['pf_quote_draft_1', 'pf_quote_draft_42', 'pf_recent_products_1'],
    `🔴 la primera purga no se llevó lo que debía: ${JSON.stringify(primera.claves)}.`);
  assert.deepEqual([...segunda.claves], [],
    `🔴 la segunda purga dice haber borrado ${JSON.stringify(segunda.claves)}, y ya no había nada.`);
  // Lo que se afirma es que purgar dos veces NO CAMBIA NADA. No que el resultado sea `GUARDADO`:
  // en este banco no hay IndexedDB y `NO_DISPONIBLE` es la respuesta correcta, las dos veces.
  assert.equal(segunda.estado, primera.estado,
    `🔴 la segunda purga da un estado distinto (${primera.estado} → ${segunda.estado}) sin que ` +
    'haya cambiado nada entre medias.');
  assert.equal(segunda.motivo, primera.motivo,
    `🔴 la segunda purga da otro motivo: «${primera.motivo}» → «${segunda.motivo}».`);
});

test('SCRUM-457 · sin `localStorage` disponible, cerrar sesión NO se rompe', async () => {
  // Safari en navegación privada, o un permiso denegado. Cerrar sesión tiene que funcionar siempre.
  const banco = cargarDashboard(RAIZ, movilDeLaFurgoneta());
  banco.ctx.localStorage = {
    get length() { throw new Error('acceso denegado'); },
    key: () => null, getItem: () => null, setItem() {}, removeItem() {},
  };
  const r = await banco.ctx.purgarDatosLocales();

  assert.equal(r.estado, banco.ctx.FALLO,
    '🔴 el almacén no dejó purgar y el resultado dice que todo fue bien. «Está borrado» y «no ' +
    'supe borrarlo» no pueden ser el mismo valor.');
  assert.ok(r.motivo, '🔴 se declara FALLO sin decir por qué: nadie puede actuar sobre eso.');
  await banco.ctx.logout(); // no lanza: si lanzara, este test moriría aquí
});

// ═══ ③ EL MECANISMO: LA QUINTA CLAVE QUE ALGUIEN AÑADA MAÑANA ════════════════════════════

test('SCRUM-457 · toda escritura del panel está en el registro, y el censo tiene suelo', () => {
  // 🔴 ESTO ES LO QUE IMPIDE QUE EL PURGADO SE QUEDE VIEJO. Escribir cuatro nombres a mano y
  // confiar en acordarse es el defecto de forma de SCRUM-265: lo que hay que acordarse de poner,
  // un día no se pone. Se recorre el panel por AST —el censo de SCRUM-336, que ya existía y no se
  // duplica— y se exige que cada escritura case con una entrada del registro que usa el purgado.
  const banco = cargarDashboard(RAIZ);
  const registro = banco.ctx.CLAVES_LOCALES;
  assert.ok(Array.isArray(registro) && registro.length > 0,
    '🔴 el registro `CLAVES_LOCALES` no está publicado: el guard mediría otra lista que el purgado.');

  const accesos = censarAlmacenamiento(path.join(RAIZ, 'public'), RAIZ);
  const escrituras = accesos.filter((a) => a.escribe && a.enElPanel && a.almacen !== 'cookie');

  // SUELOS, POR SEPARADO: un cero agregado tapa otro.
  assert.ok(accesos.length >= 8,
    `🔴 SUELO: el censo solo vio ${accesos.length} accesos en todo \`public/\`. No ha mirado.`);
  assert.ok(escrituras.length >= 4,
    `🔴 SUELO: solo ${escrituras.length} escrituras en el panel. Sabemos que hay cuatro; si salen ` +
    'menos, el censo ha dejado de ver y este guard estaría aprobando un purgado a ciegas.');

  const ciegas = escrituras.filter((e) => !e.claveResuelta);
  assert.deepEqual(ciegas.map((c) => `${c.fichero}:${c.linea}`), [],
    `🔴 hay escrituras cuya CLAVE NO SE SABE LEER: ${ciegas.map((c) => `${c.fichero}:${c.linea}`).join(', ')}. ` +
    'No se puede decir si se purgan o no, así que esto no pasa por «no hay problema»: se declara ' +
    'ciego. Si la clave se compone de otra forma, hay que enseñar al censo a resolverla.');

  const sinRegistrar = escrituras.filter((e) => !registro.some(
    (c) => c.almacen === e.almacen && c.patron.test(
      e.claveResuelta.tipo === 'prefijo' ? `${e.claveResuelta.valor}0` : e.claveResuelta.valor),
  ));
  assert.deepEqual(sinRegistrar.map((s) => `${s.fichero}:${s.linea} → ${s.claveResuelta.valor}`), [],
    '🔴 estas escrituras NO están en `CLAVES_LOCALES`, así que el logout NO las purga y nadie ha ' +
    `decidido si debían sobrevivir: ${sinRegistrar.map((s) => `${s.fichero}:${s.linea} → ` +
      `${s.almacen}['${s.claveResuelta.valor}…']`).join(' · ')}. Añádelas al registro con su ` +
    'motivo — también si la decisión es que NO se purgan.');
});

test('SCRUM-457 · cada excepción excluye algo de verdad', () => {
  // 🔴 Una excepción que no excluye nada es una regla que siempre pasa (SCRUM-450). Y una que
  // sobrevive a la clave que la justificaba es peor: parece una decisión y ya no protege nada.
  const banco = cargarDashboard(RAIZ);
  const registro = banco.ctx.CLAVES_LOCALES;
  const excepciones = registro.filter((c) => !c.purga);
  assert.ok(excepciones.length > 0,
    '🔴 no hay ninguna excepción. Si de verdad no hay claves que deban sobrevivir, dilo con esas ' +
    'palabras en la entrada de máster y borra este test; no dejes una lista vacía por simetría.');

  const escrituras = censarAlmacenamiento(path.join(RAIZ, 'public'), RAIZ)
    .filter((a) => a.escribe && a.enElPanel && a.claveResuelta);
  for (const e of excepciones) {
    assert.ok(e.motivo && e.motivo.length > 40,
      `🔴 la excepción \`${e.patron}\` no lleva motivo escrito, o es demasiado corto para revisarlo.`);
    const casa = escrituras.some((w) => w.almacen === e.almacen && e.patron.test(
      w.claveResuelta.tipo === 'prefijo' ? `${w.claveResuelta.valor}0` : w.claveResuelta.valor));
    assert.ok(casa,
      `🔴 la excepción \`${e.patron}\` (${e.almacen}) no casa con NINGUNA escritura del panel: o ` +
      'la clave ya no se escribe y la excepción sobra, o el patrón está mal y no está exceptuando ' +
      'lo que cree. En los dos casos es una decisión que ya no lo es.');
  }
});

// ═══ ④ EL ORDEN, QUE NO ES INDIFERENTE ═══════════════════════════════════════════════════

test('SCRUM-457 · el purgado va ANTES del POST de logout', async () => {
  // El purgado es local; el POST puede colgarse minutos en un sótano. Si el pro mata la pestaña
  // mientras la petición espera, los datos ya se han ido. Al revés se quedarían.
  const orden = [];
  const banco = cargarDashboard(RAIZ, movilDeLaFurgoneta());
  const purgarDeVerdad = banco.ctx.purgarDatosLocales;
  banco.ctx.purgarDatosLocales = async (...a) => { orden.push('purga'); return purgarDeVerdad(...a); };
  banco.ctx.fetch = async (url) => {
    if (String(url).includes('/auth/logout')) orden.push('POST');
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}) };
  };

  await banco.ctx.logout();
  assert.deepEqual(orden, ['purga', 'POST'],
    `🔴 el orden es ${JSON.stringify(orden)}. El purgado no depende de la red y el POST sí: si ` +
    'sale primero, una petición colgada en un sótano deja los datos del cliente en el móvil.');
});
