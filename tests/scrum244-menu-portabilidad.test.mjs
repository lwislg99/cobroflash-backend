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
// Y EL SEGUNDO VIGILA LA REGLA 30
//
// Los textos de esta card los aprueba el fundador y todavía no existen. Lo que se vigila no es
// que estén —no pueden estar— sino que **nadie los rellene de su cosecha ni los adapte de la
// card de gestoría**, que es lo que pasó en SCRUM-264: el texto existente hablaba de importe y
// hacía falta para cantidad, y cambiar el sustantivo ES escribir microcopy nueva.
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

const MARCA = '[PENDIENTE microcopy oficial]';

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

test('SCRUM-244 · regla 30: NADIE ha rellenado la microcopy pendiente por su cuenta', () => {
  // Se acota a la card de portabilidad y a su manejador: el resto de la vista tiene microcopy
  // aprobada y no se toca. Medir el fichero entero daría rojo contra texto legítimo — el error
  // del ámbito demasiado ancho que este repo ya conoce.
  // ⚠️ El recorte se ancla en DOS extremos que existen, y se comprueba que existen. Un `indexOf`
  // que no encuentra su ancla devuelve -1, y `slice(inicio, -1)` se lleva medio fichero: la
  // primera versión de este test dio rojo contra `0 && ds.length`, código de la función de
  // filtros que está fuera de la card. El ámbito demasiado ancho, otra vez.
  const iCard = VISTA.indexOf('id="portabilidad-card"');
  const iFin = VISTA.indexOf('portabilidad-info', iCard);
  assert.ok(iCard > 0 && iFin > iCard, '🔴 ESCÁNER CIEGO: no encuentro los extremos de la card');
  const card = VISTA.slice(iCard, VISTA.indexOf('</p>', iFin));
  const handler = VISTA.slice(VISTA.indexOf('btnPort.addEventListener'), VISTA.indexOf('btn.addEventListener'));
  assert.ok(card.length > 100 && handler.length > 200, '🔴 ESCÁNER CIEGO: no encuentro la card o su manejador');

  // Todo lo que el usuario LEE en esta card tiene que ser el marcador, no un texto inventado.
  const visibles = [
    ...card.matchAll(/>([^<>{}]{4,})</g),
    ...handler.matchAll(/showToast\('([^']+)'/g),
    ...handler.matchAll(/textContent = '([^']+)'/g),
  ].map((m) => m[1].trim()).filter(Boolean);

  const inventados = visibles.filter((t) => !t.startsWith(MARCA));
  assert.deepEqual(
    inventados, [],
    '🔴 HAY MICROCOPY SIN APROBAR EN LA CARD DE PORTABILIDAD:\n' +
      inventados.map((t) => `    «${t}»`).join('\n') +
      '\n\n  Los textos los aprueba el fundador (regla 30) y NO se adaptan de la card de\n' +
      '  gestoría: cambiar «tus datos para el asesor» por «todos tus datos» ES escribir\n' +
      '  microcopy nueva. Es la lección de SCRUM-264. Cuando lleguen aprobados, esto es un\n' +
      `  reemplazo de «${MARCA}», no una obra.`,
  );
  assert.ok(visibles.length >= 4, `🔴 ESCÁNER CIEGO: solo veo ${visibles.length} textos visibles en la card`);
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
