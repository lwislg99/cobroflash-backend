// SCRUM-244 · LA DESCARGA DE PORTABILIDAD TIENE DÓNDE PULSARSE, Y NO SE CONFUNDE CON LA OTRA.
//
// Sin gate: lee dos ficheros. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CASO REAL QUE LO ORIGINA
//
// La ruta funcionaba y el fundador no consiguió usarla: intentó abrirla a mano y la puso
// DETRÁS del hash del dashboard (`/dashboard/#invoice-detail/admin/exports/portabilidad.zip`),
// así que la petición **nunca salió del navegador**. No era un fallo del backend: era que no
// había dónde pulsar. Un endpoint sin sitio en la interfaz es, para quien lo necesita,
// exactamente lo mismo que un endpoint que no existe.
//
// Por eso el primer test no comprueba estilos: comprueba que **existe el botón y llama a SU
// ruta**. Es la clase de defecto que ningún test de backend puede ver.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// Y EL SEGUNDO VIGILA LA REGLA 30 — PERO YA NO EN LA MISMA DIRECCIÓN
//
// Nació exigiendo que los textos fueran marcadores `[PENDIENTE microcopy oficial]`, porque no
// había textos aprobados. **El 4-ago-2026 el fundador aprobó los ocho y el guard se dio la
// vuelta:** ahora exige que sean EXACTAMENTE ésos.
//
// La pregunta que contesta no ha cambiado —«¿ha escrito alguien microcopy sin pasar por el
// fundador?»— y por eso sirve para las dos etapas sin ser dos guards. Lo que cambió es contra
// qué se compara: antes un marcador, ahora el texto congelado.
//
// Es la lección de SCRUM-264: el texto existente hablaba de importe y hacía falta para cantidad,
// y cambiar el sustantivo ES escribir microcopy nueva.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'exportView.js'), 'utf8');
const RUTAS = fs.readFileSync(
  path.join(RAIZ, 'src', 'modules', 'exports', 'app', 'routes', 'exports.routes.ts'), 'utf8',
);

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS OCHO TEXTOS APROBADOS POR EL FUNDADOR (4-ago-2026). LITERALES.
//
// ⚠️ ESTA DUPLICACIÓN ES DELIBERADA, y es lo contrario de las listas que este repo lleva la
// semana desmontando. Allí había dos copias de un DATO y ninguna era la autoridad, así que
// derivaban. Aquí la copia ES la autoridad: este bloque congela lo que el fundador aprobó, y el
// código tiene que coincidir. Si alguien cambia una coma en la vista, esto se pone rojo.
//
// Y por eso NO se importa desde la vista: un test que comparase el fichero consigo mismo pasaría
// siempre sin comprobar nada — el medidor dentro de lo medido. Cambiar un texto obliga a tocar
// ESTE fichero, y eso aparece en el diff donde un humano lo ve. Ése es todo el mecanismo: no hace
// falta trinquete, porque el conjunto es CERRADO y no crece solo.
const APROBADOS = {
  rotulo: 'TUS DATOS',
  titulo: 'Descargar todos mis datos',
  descripcion: 'Todo lo que YaQu guarda de tu negocio, sin filtros: clientes, presupuestos, facturas, cobros, trabajos, albaranes, gastos, proveedores, equipo y mensajes de WhatsApp. En formato abierto, para que puedas llevártelo donde quieras.',
  boton: 'Descargar todo',
  preparando: 'Preparando tus datos… puede tardar un minuto.',
  exito: 'Listo. La descarga ha empezado.',
  error: 'No hemos podido preparar tus datos ahora mismo. Vuelve a intentarlo en unos minutos; si sigue sin funcionar, escríbenos y lo resolvemos.',
  aviso: 'Este archivo contiene datos de tus clientes. Guárdalo en un sitio seguro.',
};

test('SCRUM-244 · SUELO: la vista de descargas sigue siendo la que creo que es', () => {
  // Si alguien mueve o renombra la vista, los tests de abajo pasarían sobre un fichero que ya
  // no pinta nada. Se ancla en algo que SOLO puede estar aquí.
  assert.match(
    VISTA, /function renderExportView/,
    '🔴 ESCÁNER CIEGO: `exportView.js` ya no define `renderExportView`. Si la vista se movió, ' +
      'actualiza las anclas de este test EN EL MISMO commit.',
  );
  assert.ok(
    VISTA.includes('/admin/exports/datos.zip'),
    '🔴 ESCÁNER CIEGO: la descarga de gestoría ha desaparecido de la vista',
  );
});

test('SCRUM-244 · la portabilidad TIENE DÓNDE PULSARSE, y el botón llama a SU ruta', () => {
  assert.ok(
    VISTA.includes('id="btn-portabilidad"'),
    '🔴 NO HAY BOTÓN DE PORTABILIDAD EN LA VISTA.\n\n' +
      '  La ruta puede estar perfecta y el derecho seguir sin poder ejercerse: pasó de verdad —\n' +
      '  se intentó abrir a mano detrás del hash del dashboard y la petición nunca salió del\n' +
      '  navegador. Un endpoint sin sitio donde pulsar no existe para quien lo necesita.',
  );
  assert.ok(
    VISTA.includes("fetch('/admin/exports/portabilidad.zip'"),
    '🔴 el botón de portabilidad no llama a `/admin/exports/portabilidad.zip`',
  );
});

test('SCRUM-244 · las DOS descargas se distinguen: la de portabilidad no lleva filtros', () => {
  // La de gestoría es «dame mi actividad» (por fechas, seis entidades). Ésta es «dame TODO lo
  // mío». Si la de portabilidad aceptara `from`/`to` o `incluir`, sería la misma pregunta dos
  // veces y la gente se bajaría la que no era creyendo que se lleva todo.
  const bloque = VISTA.slice(VISTA.indexOf('btnPort.addEventListener'), VISTA.indexOf('btn.addEventListener'));
  assert.ok(bloque.length > 200, '🔴 ESCÁNER CIEGO: no encuentro el manejador de portabilidad');
  for (const filtro of ['from=', 'to=', 'incluir=', 'params()']) {
    assert.ok(
      !bloque.includes(filtro),
      `🔴 la descarga de portabilidad acepta el filtro «${filtro}». Es «TODO lo mío»: ofrecer ` +
        'filtros invita a ejercer a medias un derecho que no admite medias tintas, y borra la ' +
        'diferencia con la descarga de gestoría.',
    );
  }
});

test('SCRUM-244 · el nombre del fichero lleva la FECHA', () => {
  assert.match(
    RUTAS, /filename="portabilidad-\$\{dia\}\.zip"/,
    '🔴 el ZIP de portabilidad se descarga con un nombre fijo. Dos ficheros iguales en la carpeta ' +
      'de Descargas se convierten en `portabilidad (1).zip` y nadie sabe cuál es cuál — y este se ' +
      'descarga más de una vez por naturaleza (antes y después de un cambio, o para comparar).',
  );
  assert.match(
    RUTAS, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/,
    '🔴 la fecha del nombre no es `YYYY-MM-DD`. Ese formato ordena alfabéticamente igual que ' +
      'cronológicamente, que es la mitad de su utilidad en una carpeta.',
  );
});

/**
 * TODO RECORTE COMPRUEBA SUS DOS EXTREMOS. Criterio, no manía.
 *
 * `indexOf` devuelve **-1** cuando no encuentra su ancla, y `slice(inicio, -1)` no falla: se
 * lleva el fichero entero menos un carácter. El resultado es un rojo **que no es tuyo** y que te
 * manda a mirar donde no es — la primera versión de este guard cayó contra `0 && ds.length`,
 * código de la función de filtros que está fuera de la card.
 *
 * Por eso esto no hace `slice` a pelo: exige los dos índices, comprueba que existen y que van en
 * orden, y falla nombrando cuál falta. Un ámbito equivocado no se nota en la salida —el rojo se
 * lee igual de convincente— así que la única defensa es no dejar que ocurra.
 */
function recorte(texto, desde, hasta, etiqueta) {
  const i = texto.indexOf(desde);
  assert.ok(i >= 0, `🔴 ESCÁNER CIEGO: no encuentro el ancla de INICIO de ${etiqueta} («${desde}»)`);
  const j = texto.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `🔴 ESCÁNER CIEGO: no encuentro el ancla de FIN de ${etiqueta} («${hasta}») después del inicio`);
  return texto.slice(i, j);
}

test('SCRUM-244 · regla 30: los OCHO textos son EXACTAMENTE los aprobados', () => {
  // El guard cambió de sentido el 4-ago-2026. Antes exigía que fueran marcadores `[PENDIENTE]`,
  // porque no había textos; ahora que están aprobados exige que sean ESOS y no otros. La
  // pregunta que contesta es la misma en los dos casos: «¿ha escrito alguien microcopy sin
  // pasar por el fundador?».
  const card = recorte(VISTA, 'id="portabilidad-card"', 'portabilidad-info', 'la card');
  const handler = recorte(VISTA, 'btnPort.addEventListener', 'btn.addEventListener', 'el manejador');

  // 1) Cada texto aprobado está donde tiene que estar.
  for (const [clave, texto] of Object.entries(APROBADOS)) {
    const donde = ['rotulo', 'titulo', 'descripcion', 'boton'].includes(clave) ? card : handler;
    assert.ok(
      donde.includes(texto),
      `🔴 FALTA O SE HA CAMBIADO EL TEXTO APROBADO «${clave}».\n\n` +
        `  Esperado, literal:\n    ${texto}\n\n` +
        '  Los textos los aprueba el fundador (regla 30). Cambiar una coma, un plural o un\n' +
        '  sustantivo ES escribir microcopy nueva — la lección de SCRUM-264, donde el texto\n' +
        '  existente hablaba de importe y hacía falta para cantidad. Si de verdad hay que\n' +
        '  cambiarlo, se aprueba primero y se actualiza APROBADOS en el mismo commit: así el\n' +
        '  cambio aparece en el diff donde un humano lo ve.',
    );
  }

  // 2) Y NO hay ningún texto visible que no esté aprobado. Sin esto, añadir una frase nueva
  //    pasaría desapercibida: los ocho seguirían estando.
  const visibles = [
    ...card.matchAll(/>([^<>{}]{4,})</g),
    ...handler.matchAll(/showToast\('([^']+)'/g),
    ...handler.matchAll(/textContent = '([^']+)'/g),
  ].map((m) => m[1].trim()).filter(Boolean);

  const aprobados = new Set(Object.values(APROBADOS));
  const sinAprobar = [...new Set(visibles.filter((t) => !aprobados.has(t)))];
  assert.deepEqual(
    sinAprobar, [],
    '🔴 HAY TEXTO VISIBLE SIN APROBAR EN LA CARD DE PORTABILIDAD:\n' +
      sinAprobar.map((t) => `    «${t}»`).join('\n') +
      '\n\n  No basta con que los ocho aprobados sigan ahí: una frase AÑADIDA también es\n' +
      '  microcopy nueva, y pasaría desapercibida si solo se comprobara la presencia.',
  );

  assert.ok(
    visibles.length >= Object.keys(APROBADOS).length - 1,
    `🔴 ESCÁNER CIEGO: solo veo ${visibles.length} textos visibles y hay ${Object.keys(APROBADOS).length} aprobados. ` +
      'Si el extractor dejó de verlos, la comprobación de arriba sería cierta sobre casi nada.',
  );
});

test('SCRUM-244 · el botón NO construye su etiqueta: pegarle un contador cambiaría el texto', () => {
  // La card de gestoría muestra «Preparando… 12s», o sea que CONSTRUYE la cadena. Aquí el texto
  // de espera está aprobado literal, así que concatenarle nada lo modificaría. Se comprueba que
  // el manejador no arma etiquetas: si alguien añade un contador «para mejorar la espera»,
  // estaría reescribiendo microcopy aprobada sin darse cuenta.
  const handler = recorte(VISTA, 'btnPort.addEventListener', 'btn.addEventListener', 'el manejador');
  assert.ok(
    !/btnPort\.textContent\s*=\s*[^;]*\+/.test(handler),
    '🔴 el manejador CONCATENA algo a la etiqueta del botón. El texto de espera está aprobado ' +
      'literal («' + APROBADOS.preparando + '»); pegarle un contador detrás es modificarlo. La ' +
      'espera ya la comunica la propia frase, que dice cuánto puede tardar.',
  );
});

test('SCRUM-244 · la vista NO ofrece la supresión: sigue bloqueada por dictamen', () => {
  for (const pista of ['borrar', 'eliminar cuenta', 'darme de baja', 'suprimir']) {
    assert.ok(
      !VISTA.toLowerCase().includes(pista),
      `🔴 la vista de descargas menciona «${pista}». La supresión (art. 17) sigue BLOQUEADA por ` +
        'dictamen: hoy ejecutarla destruiría el AuditLog fiscal. Portabilidad y supresión son ' +
        'derechos distintos y esta pantalla solo ofrece el primero.',
    );
  }
});
