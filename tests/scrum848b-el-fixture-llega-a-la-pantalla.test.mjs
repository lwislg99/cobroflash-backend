// tests/scrum848b-el-fixture-llega-a-la-pantalla.test.mjs — SCRUM-848b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SCRUM-848 ARREGLÓ, LO QUE NO DEJÓ DETRÁS, Y LO QUE DIAGNOSTICÓ MAL
//
// ── LO QUE ARREGLÓ, Y ESTÁ BIEN ─────────────────────────────────────────────────────────
// La ficha de Trabajo se medía con `{}`: un Trabajo SIN `status`. El esquema declara
// `Job.status String @default("pendiente_agendar")`, así que ese objeto **el producto no puede
// producirlo**. Mientras `jobNextAction` caía al nivel 5 con cualquier estado eso pasaba por una
// pantalla normal; SCRUM-823 le puso la puerta por estado —a propósito y bien— y la pantalla
// medida se quedó sin acción de héroe. `guard:objetivo-tactil` se puso rojo y TENÍA RAZÓN.
//
// El arreglo fue darle a la superficie `/__jobdetail` un `datos: TRABAJO_DE_MUESTRA` con un
// estado que existe (`en_curso` está en `JOB_STATES`), sin tocar `distintosEsperados` ni las
// cinco excepciones. Correcto, y aquí no se toca nada de eso.
//
// ── LO QUE NO DEJÓ: nada en la tanda ────────────────────────────────────────────────────
// El diff de SCRUM-848 no tocó ni un fichero de test. Y `npm test` es
// `build && node --test tests/*.test.mjs`, así que `guard:objetivo-tactil` NO está en la tanda,
// y ningún workflow de `.github/workflows/` lo nombra: hoy sólo lo ve quien se acuerde de
// lanzarlo a mano. Medido el 15-sep-2026: dejar el Trabajo de muestra sin `status`, o con un
// estado inventado, no lo cazaba NADIE.
//
// ── 🔴 Y LO QUE DIAGNOSTICÓ MAL, que es lo que más importa dejar escrito ─────────────────
// SCRUM-848 tituló «la avería honda» otra cosa: que el banco pasaba la ruta a `fetch` pero no a
// `apiRequest`, y cambió esa línea. **Ese cambio es INERTE para las vistas.** Medido el
// 15-sep-2026 revirtiéndolo y renderizando `renderCustomer360View`: mismo html, 3.062 bytes en
// los dos casos, y el fixture recibiendo su ruta igual.
//
// El motivo lleva escrito TREINTA LÍNEAS más arriba en ese mismo fichero desde SCRUM-432:
// `api.js` declara su propio `apiRequest` de nivel superior y al cargarse PISA el del banco. Lo
// que las vistas usan es ése, que pide por `fetch` — y a `fetch` el banco SIEMPRE le pasó la
// url. O sea que los fixtures por ruta nunca estuvieron ciegos por ahí.
//
// Esto no es un detalle de archivo. Una causa falsa escrita en el código es peor que ninguna: el
// siguiente que vea una ficha medirse con datos raros irá a tocar esa línea, no encontrará nada,
// y volverá a contar la misma historia. Por eso el tercer test de abajo la fija.
//
// ── QUÉ FIJA ESTE FICHERO ───────────────────────────────────────────────────────────────
// Lo mínimo para que el defecto REAL no pueda volver en silencio, y dentro de `npm test`:
// que el fixture llegue a la pantalla y la decida, que sea un objeto que el producto pueda
// producir —con el estado derivado de `JOB_STATES`, no de una copia escrita aquí—, y que la
// ficha conserve su CTA de héroe, con el control que reproduce el síntoma exacto de SCRUM-848.
//
// NO se toca `distintosEsperados`, ni las excepciones, ni el fixture, ni el guard.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paginaDeVista, TRABAJO_DE_MUESTRA } from '../scripts/_pagina-panel.mjs';
import { JOB_STATES } from '../dist/modules/jobs/domain/job.service.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL FIXTURE LLEGA A LA PANTALLA — y por dónde llega NO es lo que decía el ticket
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-848b · 🔴 un fixture escrito POR RUTA recibe la ruta en un render de verdad', async () => {
  // La pregunta se le hace A LA PANTALLA, no a una función concreta del banco, y eso no es
  // estilo: preguntárselo a `ctx.apiRequest` da una respuesta que no significa nada (el tercer
  // test de abajo lo mide). Lo que un fixture necesita es LLEGAR a la vista; por dónde llegue es
  // asunto del banco y puede cambiar sin que esto tenga que enterarse.
  const rutas = [];
  const fixture = (url) => {
    rutas.push(String(url));
    return /\/admin\/jobs\//.test(String(url)) ? TRABAJO_DE_MUESTRA : [];
  };
  const p = await paginaDeVista(RAIZ, 'renderJobDetailView', { datos: fixture, minimoNodos: 10 });

  // SUELO: si el fixture no se llamara NUNCA, los asserts de abajo no dirían nada.
  assert.ok(rutas.length > 0,
    '🔴 la vista se ha montado sin consultar su fixture ni una vez: no se está midiendo la '
    + 'pantalla que se cree.');
  assert.ok(rutas.some((u) => u && u !== 'undefined' && u.includes('/admin/jobs/')),
    `🔴 al fixture le llegan rutas vacías (${JSON.stringify(rutas.slice(0, 4))}). Un fixture `
    + 'escrito por ruta caería siempre en su rama final, y la vista se montaría con datos que '
    + 'nadie eligió — que es como se medía la ficha de Trabajo antes de SCRUM-848.');
  assert.equal(p.aviso, null, `🔴 la ficha no monta con su fixture por ruta: ${p.aviso}`);
});

test('SCRUM-848b · 🔴 y ese fixture DECIDE la pantalla: con otro, el resultado cambia', async () => {
  // El control del de arriba. Recibir la ruta no vale de nada si lo que devuelve el fixture no
  // llega a la pantalla: se comprueba que dos fixtures distintos dan dos pantallas distintas.
  const conTrabajo = await paginaDeVista(RAIZ, 'renderJobDetailView',
    { datos: (u) => (/\/admin\/jobs\//.test(String(u)) ? TRABAJO_DE_MUESTRA : []), minimoNodos: 10 });
  const sinNada = await paginaDeVista(RAIZ, 'renderJobDetailView',
    { datos: () => [], minimoNodos: 10 });

  assert.notEqual(conTrabajo.html, sinNada.html ?? null,
    '🔴 la pantalla sale IGUAL con el Trabajo de muestra y sin nada. Entonces el fixture no '
    + 'decide lo que se mide, y cualquier número sacado de aquí vale lo mismo con datos que sin '
    + 'ellos.');
});

test('SCRUM-848b · 🔴 el `apiRequest` del banco NO es el camino: `api.js` lo PISA', () => {
  // ═══ LA CORRECCIÓN QUE HAY QUE DEJAR ESCRITA ═════════════════════════════════════════════
  //
  // SCRUM-848 tituló «la avería honda» un cambio en el `apiRequest` que arma el banco: pasarle
  // la ruta al fixture «igual que ya se hacía con `fetch`». Medido el 15-sep-2026, ese cambio es
  // INERTE para las vistas — revertirlo y renderizar `renderCustomer360View` da el MISMO html,
  // 3.062 bytes los dos, y el fixture sigue recibiendo su ruta.
  //
  // El motivo estaba escrito TREINTA LÍNEAS más arriba en ese mismo fichero desde SCRUM-432:
  // `api.js` declara su propio `apiRequest` de nivel superior, así que al cargarse PISA el del
  // banco, y lo que las vistas usan es ése — que pide por `fetch`, y a `fetch` el banco SIEMPRE
  // le pasó la url. El arreglo que de verdad curó la ficha fue el otro: darle `datos` a la
  // superficie.
  //
  // Esto se fija, no se borra. Un diagnóstico equivocado escrito en el código es peor que
  // ninguno: el siguiente que vea la ficha medirse con datos raros irá a tocar esa línea, no
  // encontrará nada, y volverá a escribir la misma historia.
  const api = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/api.js'), 'utf8');
  assert.match(api, /(function|const|let|var)\s+apiRequest\b/,
    '🔴 `api.js` ya no declara su propio `apiRequest`. Si ha dejado de hacerlo, el del banco SÍ '
    + 'pasa a ser el camino y hay que RE-MEDIR cuál de los dos sirve los datos — sin dar por '
    + 'buena ninguna de las dos historias.');

  const banco = fs.readFileSync(path.join(RAIZ, 'tests/_banco-vistas.mjs'), 'utf8');
  assert.match(banco, /al cargarse \*{0,2}PISA\*{0,2} el del banco/,
    '🔴 se ha borrado del banco la nota de SCRUM-432 que explica el pisado. Es lo único que hay '
    + 'para no volver a diagnosticar ahí una avería que no está ahí.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL FIXTURE COMPARTIDO ES UN OBJETO QUE EL PRODUCTO PUEDE PRODUCIR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-848b · SUELO: los estados del Trabajo se DERIVAN del producto', () => {
  // Si esta lista viniera escrita a mano aquí, el test de abajo comprobaría que un fixture cuadra
  // con una copia mía, no con el producto. Se importa de `job.service.js`, que es donde vive la
  // FSM. Y si el día de mañana no se pudiera importar, esto lo dice en vez de pasar vacío.
  assert.ok(Array.isArray(JOB_STATES) && JOB_STATES.length >= 2,
    '🔴 no he podido derivar `JOB_STATES` del producto. Sin eso, lo de abajo no compara con nada.');
  assert.ok(JOB_STATES.includes('pendiente_agendar'),
    '🔴 `JOB_STATES` ya no tiene el estado por defecto del esquema: o cambió la FSM, o esto no es '
    + 'la lista que creo que es.');
});

test('SCRUM-848b · 🔴 `TRABAJO_DE_MUESTRA` tiene un `status`, y es uno que EXISTE', () => {
  // El defecto de SCRUM-848 en su forma exacta: el banco montaba la ficha con un Trabajo SIN
  // `status`. El esquema declara `Job.status String @default("pendiente_agendar")` — no acepta
  // nulo—, así que un Trabajo sin estado no es un Trabajo raro: es un objeto que el producto NO
  // PUEDE PRODUCIR, y medir una pantalla montada con él es medir una pantalla que no existe.
  assert.ok(Object.hasOwn(TRABAJO_DE_MUESTRA, 'status'),
    '🔴 el Trabajo de muestra ha vuelto a quedarse SIN `status`. Eso es lo que hizo que '
    + '`guard:objetivo-tactil` midiera una ficha sin acción de héroe durante días (SCRUM-848).');
  assert.ok(JOB_STATES.includes(TRABAJO_DE_MUESTRA.status),
    `🔴 el Trabajo de muestra está en «${TRABAJO_DE_MUESTRA.status}», que no es uno de los `
    + `estados del producto (${JOB_STATES.join(', ')}). Un fixture con un estado inventado mide `
    + 'una pantalla que nadie puede ver — y el guard que lo use dará un verde que no vale.');
});

test('SCRUM-848b · SUELO: el esquema SIGUE declarando `Job.status` con `@default`', () => {
  // El razonamiento de arriba —«un Trabajo sin status no existe»— se apoya en el esquema. Si el
  // esquema cambiara, el razonamiento dejaría de valer y este fichero estaría exigiendo algo por
  // costumbre. Se LEE (regla 40: el esquema se lee, no se toca).
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  assert.match(schema, /status\s+String\s+@default\("pendiente_agendar"\)/,
    '🔴 `Job.status` ya no se declara con `@default("pendiente_agendar")`. Entonces un Trabajo sin '
    + 'estado podría ser posible, y el test de arriba habría que volver a pensarlo — no borrarlo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ Y LLEGA A LA PANTALLA: el defecto histórico, reproducido DENTRO de la tanda
//
// Hoy esto sólo lo ve `guard:objetivo-tactil`, que no está en `npm test` ni en ningún workflow.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 EL SELECTOR ES `BUTTON.btn-primary` A SECAS, y la distinción NO es un tecnicismo.
 *
 * Buscar la subcadena `btn-primary` no sirve: esta misma ficha pinta un
 * `BUTTON.btn-primary.btn-sm «Consolidar seleccionados»` que la contiene y que NO se va con el
 * fixture imposible. Lo escribí así en el primer intento y mi propio control me lo cazó — el
 * test pasaba y el control decía que la pantalla no perdía nada, que era falso.
 *
 * El que importa es el de la clase DESNUDA: es el que el guard llama «el CTA del héroe», el que
 * su excepción sitúa en 37,0 px, y el único que desaparece. Medido el 15-sep-2026: la ficha pasa
 * de OCHO botones a SIETE, y el que falta es exactamente `BUTTON.btn-primary «+ Nuevo albarán»`.
 */
const CTA_HEROE = /<button[^>]*class="btn-primary"[^>]*>/i;

test('SCRUM-848b · 🔴 la ficha de Trabajo con el fixture REAL pinta su CTA de héroe', async () => {
  const p = await paginaDeVista(RAIZ, 'renderJobDetailView', { datos: TRABAJO_DE_MUESTRA, minimoNodos: 10 });
  assert.equal(p.aviso, null, `🔴 la ficha de Trabajo no monta: ${p.aviso}`);
  assert.match(p.html, CTA_HEROE,
    '🔴 la ficha de Trabajo ya no pinta `BUTTON.btn-primary`. Es el objetivo que `guard:objetivo-'
    + 'tactil` cuenta como uno de sus 6, y su desaparición fue el síntoma entero de SCRUM-848.');
});

test('SCRUM-848b · 🔴 CONTROL: con el Trabajo IMPOSIBLE ese CTA no está — el síntoma de SCRUM-848', async () => {
  // Sin este control, el test de arriba podría estar pasando por cualquier motivo. Se reproduce
  // el fixture que había —`{}`, un Trabajo sin estado— y se comprueba que la pantalla medida
  // PIERDE la acción de héroe. Ésa es la diferencia que el guard cazó, y la razón por la que un
  // fixture imposible no es un detalle de laboratorio.
  const p = await paginaDeVista(RAIZ, 'renderJobDetailView', { datos: {}, minimoNodos: 10 });
  const perdioElCta = p.aviso !== null || !CTA_HEROE.test(p.html);
  assert.ok(perdioElCta,
    '🔴 CONTROL ROTO: con un Trabajo SIN `status` la ficha sigue pintando su CTA de héroe. '
    + 'Entonces el diagnóstico de SCRUM-848 ya no describe el árbol, y lo de arriba no está '
    + 'midiendo lo que dice. Hay que RE-MEDIR antes de tocar nada.');
});
