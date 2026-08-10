// tests/scrum361-version-al-firmar.test.mjs — SCRUM-361 (H6)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VÍCTIMA, EN UNA LÍNEA
//
// Un cliente abre el enlace de firma, y mientras lo tiene abierto el profesional corrige una línea
// del albarán desde el ordenador. El cliente firma LA PANTALLA QUE TENÍA, y queda sellado un
// contenido que él no vio. **La firma vale cero y parece que vale.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO SE DUPLICA EL HASH, Y ES LO MÁS IMPORTANTE DE ESTE FICHERO
//
// H0 (SCRUM-355 · P4) midió que `computeAlbaranContentHash` vive en el servidor y no es ejecutable
// en el navegador: habría que **duplicarlo**, y dos implementaciones del mismo hash que derivan en
// silencio dan conflictos falsos o —peor— conflictos NO detectados, en el mecanismo que existe
// precisamente para detectarlos.
//
// No hace falta. El cliente **no compone contenido**: solo firma lo que bajó. Así que basta con
// que devuelva el `Albaran.version` que vio, y que el servidor lo compare. Un entero.
//
// 🔴 Y eso descansa en un hecho MEDIDO, no en una creencia: hoy `version` significa exactamente
// «el contenido del documento cambió», porque el ÚNICO escritor que toca contenido es el PATCH y
// ese sí la incrementa. **El guard del final de este fichero es lo que mantiene esa frase cierta.**
// Sin él, la propuesta es correcta hoy y muda mañana.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// La herramienta de la casa para leer un fuente SIN comentarios (SCRUM-193). Gana ella.
import { leerFuente } from './_guard-texto.mjs';
import { escriturasDeAlbaran } from './_censo-escrituras-albaran.mjs';

import {
  puedeFirmarEstaVersion,
  ERROR_ALBARAN_CAMBIADO,
  COPY_ALBARAN_CAMBIADO,
  COPY_ALBARAN_CAMBIADO_BOTON,
} from '../dist/modules/jobs/domain/albaranFirmante.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_PUBLICA = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'albaranPublic.routes.ts');
const F_ADMIN = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'albaranes.routes.ts');

// ── 🔴 EL TEST · LO QUE PASA CUANDO EL ALBARÁN CAMBIA ────────────────────────────────────

test('SCRUM-361 · 🔴 se abre el enlace, el albarán cambia, se firma con la vieja → NO se firma', () => {
  // El cliente pintó la v:3; el PATCH la subió a 4 mientras la tenía abierta.
  const r = puedeFirmarEstaVersion(3, 4);
  assert.equal(r.ok, false,
    '🔴 SE HABRÍA SELLADO UN CONTENIDO QUE EL CLIENTE NO VIO.\n\n' +
    '  Es el defecto entero de este ticket: el cliente firma la pantalla que tenía y el servidor\n' +
    '  sella lo que hay AHORA. La firma queda puesta sobre un documento que él nunca leyó, y\n' +
    '  nada en el sistema lo dice.');
  assert.equal(r.error, ERROR_ALBARAN_CAMBIADO,
    `🔴 el código es «${r.error}»: quien lo lea en un log tiene que saber QUÉ pasó sin abrir el fichero`);
  assert.equal(r.message, COPY_ALBARAN_CAMBIADO,
    '🔴 el mensaje no es el APROBADO por el asesor. Reformularlo es cambio de máster, no una mejora.');
});

test('SCRUM-361 · 🔴 CONTROL POSITIVO 2: sin cambios de por medio, la firma funciona IGUAL QUE HOY', () => {
  // Y es el que hace que el resto signifique algo. Un mecanismo que bloquea siempre no protege:
  // estorba, y acaba desactivado — el final de SCRUM-450.
  for (const v of [1, 2, 7, 99]) {
    const r = puedeFirmarEstaVersion(v, v);
    assert.equal(r.ok, true,
      `🔴 con la MISMA versión (v:${v}) no deja firmar. El camino normal —que es el 99,9 % de las ` +
      'firmas— acaba de romperse, y este mecanismo se desactivará al primer roce.');
  }
});

test('SCRUM-361 · 🔴 SUELO: si la versión NO LLEGA, eso no es «coincide» — es «no lo sé», y NO se firma', () => {
  // Un cliente con la página vieja en caché, o un enlace de antes de este ticket, manda la firma
  // SIN versión. Tratarlo como «coincide» sería exactamente el agujero que este ticket cierra,
  // abierto por la puerta de atrás y en silencio.
  //
  // Manda la asimetría de coste: perder una firma que hay que repetir cuesta cinco minutos;
  // sellar un contenido que el cliente no vio NO SE DESHACE.
  for (const nada of [undefined, null, '', '3', NaN, Infinity, 3.5, {}, [], true]) {
    const r = puedeFirmarEstaVersion(nada, 3);
    assert.equal(r.ok, false,
      `🔴 se acepta firmar con version=${JSON.stringify(nada) ?? String(nada)} contra la v:3 real. ` +
      '«No sé qué vio el cliente» se está leyendo como «vio lo mismo».');
    assert.equal(r.error, ERROR_ALBARAN_CAMBIADO, '🔴 y ni siquiera lo nombra igual');
  }

  // CONTROL del suelo, DENTRO del mismo test: el 3 de verdad sí pasa. Si no, lo de arriba se
  // cumpliría con una función que devuelve `false` siempre.
  assert.equal(puedeFirmarEstaVersion(3, 3).ok, true,
    '🔴 rechaza también la versión correcta: entonces el bucle de arriba no distingue nada.');
});

// ── LA MICROCOPY, QUE LA APRUEBA EL ASESOR ───────────────────────────────────────────────

test('SCRUM-361 · la microcopy es la APROBADA, y no suena a error del programa', () => {
  assert.equal(COPY_ALBARAN_CAMBIADO,
    'Este albarán ha cambiado desde que abriste esta página. Míralo otra vez antes de firmar.',
    '🔴 el texto no es el aprobado por el asesor (10-ago-2026). Reformularlo es cambio de máster.');
  assert.equal(COPY_ALBARAN_CAMBIADO_BOTON, 'Ver la versión actual',
    '🔴 el botón no es el aprobado.');

  // Lo que el asesor PROHIBIÓ expresamente: que suene a fallo del programa o le pida al cliente
  // entender qué ha pasado por dentro.
  const prohibido = /error|fall[oó]|sesi[oó]n caducada|caduc|conflicto|versi[oó]n obsoleta|reintenta|token/i;
  assert.doesNotMatch(COPY_ALBARAN_CAMBIADO, prohibido,
    `🔴 el mensaje suena a error del programa: «${COPY_ALBARAN_CAMBIADO}». Lo lee un CLIENTE que ` +
    'solo quería firmar un papel.');

  // Y el marcador de microcopy sin aprobar NO puede estar aquí: si lo estuviera, este texto no
  // estaría aprobado y no debería salir a producción (regla 30).
  for (const t of [COPY_ALBARAN_CAMBIADO, COPY_ALBARAN_CAMBIADO_BOTON]) {
    assert.doesNotMatch(t, /PENDIENTE|TODO|\[.*microcopy/i, `🔴 microcopy sin aprobar en producción: «${t}»`);
  }
});

// ── EL CAMINO: LA VERSIÓN VIAJA Y VUELVE ─────────────────────────────────────────────────

test('SCRUM-361 · la versión VIAJA al cliente y VUELVE con la firma', () => {
  // ⚠️ `leerFuente` y no `readFileSync`: devuelve el fichero YA sin comentarios. Es la herramienta
  // de la casa (SCRUM-193) y existe porque este defecto ha mordido CUATRO veces — un guard que
  // prohíbe una palabra cae sobre el comentario que explica la prohibición. Me mordió a mí
  // también, con el comentario de aquí abajo que dice por qué no se duplica el hash.
  const fuente = leerFuente(F_PUBLICA);

  // Mencionar no es hacer: no basta con que el fichero diga «version», tiene que ponerla en el
  // cuerpo del POST y compararla en el servidor.
  assert.match(fuente, /version:\$\{JSON\.stringify\(albaran\.version\)\}/,
    '🔴 la página de firma NO manda la versión que pintó. Sin eso el servidor no tiene contra qué ' +
    'comparar, y el cliente puede firmar un documento que ya cambió.');
  assert.match(fuente, /puedeFirmarEstaVersion\(req\.body\?\.version, albaran\.version\)/,
    '🔴 el servidor NO compara la versión recibida con la de ahora. La manda el cliente y nadie la mira.');

  // 🔴 Y NO se ha duplicado el hash: era el riesgo entero que H0 señaló.
  for (const rastro of ['crypto.subtle', 'computeAlbaranContentHash', 'contenidoCanonico', 'sha256', 'digest(']) {
    assert.ok(!fuente.includes(rastro),
      `🔴 la página pública menciona «${rastro}» EN CÓDIGO: se está recalculando el hash en el cliente.\n\n` +
      '  H0 midió por qué no: habría DOS implementaciones del mismo hash, y dos que derivan en\n' +
      '  silencio dan conflictos falsos o —peor— conflictos NO DETECTADOS. No hace falta: el\n' +
      '  cliente no compone contenido, así que basta con devolver el entero que vio.');
  }

  // CONTROL POSITIVO del propio filtro, DENTRO del mismo test: si `leerFuente` devolviera vacío
  // —o el fichero cambiara de sitio— los cinco `includes` de arriba pasarían por no leer nada.
  assert.ok(fuente.length > 5000,
    `🔴 solo se han leído ${fuente.length} caracteres de la ruta pública: el guard está vacío.`);
  assert.ok(fuente.includes('puedeFirmarEstaVersion'),
    '🔴 el filtro se ha comido también el código: no queda ni la llamada que se acaba de exigir.');
});

// ── 🔴 EL GUARD QUE HACE SEGURA LA PROPUESTA ─────────────────────────────────────────────
//
// «Nada obliga a que `version` suba: si mañana una octava ruta edita `lineas` sin
// `version: { increment: 1 }`, el detector quedaría CIEGO EN SILENCIO.»
//
// Hoy hay UN solo escritor de contenido, así que sale barato. Sin este guard, todo lo de arriba
// es correcto hoy y mudo mañana.

/** Los campos que SON el contenido del documento: lo que el cliente lee antes de firmar. */
const CAMPOS_DE_CONTENIDO = ['lineas', 'notas', 'fecha', 'modoValoracion', 'lugarEntrega', 'fechaEntrega'];

/**
 * ¿Esta escritura toca el CONTENIDO del documento?
 *
 * Mira el literal del `data:` **y** los campos que se le asignan indirectamente (`data.lineas = …`
 * antes del `update`). Con solo el literal, la ÚNICA escritura que toca contenido —el PATCH, que
 * hace `data: { ...data, version: … }`— salía clasificada como metadatos: el guard habría vigilado
 * todo menos lo que importa.
 */
function tocaContenido(e) {
  const texto = `${e.data} ${e.indirecto || ''}`;
  return CAMPOS_DE_CONTENIDO.some((c) => new RegExp(`\\b${c}\\b`).test(texto));
}

// El censo vive en `_censo-escrituras-albaran.mjs` desde SCRUM-462: lo usan DOS tickets para dos
// preguntas distintas —que toda escritura de CONTENIDO incremente `version` (aquí) y que toda
// escritura que marque FIRMADO traiga su sobre (allí)—. Dos copias del mismo censo se
// desincronizan en cuanto una mejore, que es la familia de defectos que esta casa persigue.

test('SCRUM-361 · SUELO del censo de escrituras: ve el árbol, y ve escrituras', () => {
  // Dos recuentos, DOS asserts. Si solo mirase el total de escrituras, un escáner que leyera
  // cuatro ficheros y encontrara escrituras en ellos pasaría igual estando ciego para el resto.
  const { escrituras, ficheros } = escriturasDeAlbaran(RAIZ);
  assert.ok(ficheros > 100,
    `🔴 ESCÁNER CIEGO: solo ${ficheros} ficheros .ts recorridos en src/`);
  assert.ok(escrituras.length >= 5,
    `🔴 ESCÁNER CIEGO: solo ${escrituras.length} escrituras de Albaran encontradas. Había OCHO al ` +
    'escribir esto, y con cero el guard de abajo pasaría vacío — «ninguna escritura está mal» y ' +
    '«no supe encontrarlas» son el mismo número con significados opuestos.');
});

test('SCRUM-361 · 🔴 toda escritura que toca CONTENIDO incrementa `version`', () => {
  const { escrituras } = escriturasDeAlbaran(RAIZ);
  const ciegas = escrituras
    .filter((e) => tocaContenido(e))
    .filter((e) => !/version:\s*\{\s*increment/.test(e.data));

  assert.deepEqual(ciegas.map((e) => `${e.fichero}:${e.linea} → ${e.data.slice(0, 70)}`), [],
    '🔴 UNA RUTA EDITA EL CONTENIDO DEL ALBARÁN SIN INCREMENTAR `version`:\n' +
    ciegas.map((e) => `   · ${e.fichero}:${e.linea}\n     ${e.data.slice(0, 120)}`).join('\n') + '\n\n' +
    '  El detector de conflictos de la firma se queda CIEGO ANTE ESA RUTA, y en silencio: el\n' +
    '  cliente firmará un contenido que no vio y todo parecerá correcto. `Albaran.version` es lo\n' +
    '  único que separa «el documento cambió» de «no cambió», y solo vale mientras TODAS las\n' +
    '  escrituras de contenido la suban.\n\n' +
    '  Se arregla añadiendo `version: { increment: 1 }` a esa escritura — NO quitando el campo de\n' +
    '  la lista de contenido para que el guard calle.');
});

test('SCRUM-361 · CONTROL NEGATIVO: una escritura de METADATOS no hace caer el guard', () => {
  // Si el guard acusara a las siete escrituras que tocan estado, firma, pdfUrl, token o invoiceId,
  // se desactivaría al primer roce. Esas NO cambian lo que el cliente lee, así que no son conflicto.
  const { escrituras } = escriturasDeAlbaran(RAIZ);
  const metadatos = escrituras.filter((e) =>
    !tocaContenido(e));

  assert.ok(metadatos.length >= 4,
    `🔴 solo se ven ${metadatos.length} escrituras de metadatos y había siete: o el censo está ` +
    'corto, o el criterio se ha vuelto tan ancho que ya acusa a todo.');
  for (const m of metadatos) {
    assert.ok(!/version:\s*\{\s*increment/.test(m.data),
      `🔴 una escritura de METADATOS incrementa \`version\` (${m.fichero}:${m.linea}). Entonces la ` +
      'versión deja de significar «el contenido cambió» y empieza a saltar sin motivo: el cliente ' +
      'no podría firmar porque se regeneró un PDF.');
  }

  // Y el control positivo del propio criterio, DENTRO del mismo test: el PATCH —la única que SÍ
  // toca contenido— tiene que estar clasificada como contenido, o el guard de arriba no mira nada.
  const deContenido = escrituras.filter((e) =>
    tocaContenido(e));
  assert.ok(deContenido.length >= 1,
    '🔴 el censo no clasifica NINGUNA escritura como «de contenido». El PATCH edita `lineas`, así ' +
    'que si no sale aquí el criterio está roto y el guard de arriba pasa vacío.');
  assert.ok(deContenido.every((e) => /albaranes\.routes\.ts/.test(e.fichero)),
    `🔴 hay escrituras de contenido fuera del PATCH: ${deContenido.map((e) => e.fichero + ':' + e.linea).join(', ')}. ` +
    'Puede estar bien, pero deja de ser cierto que «un solo escritor toca contenido» — y ese hecho ' +
    'es lo que sostiene esta solución. Míralo antes de seguir.');
});

test('SCRUM-361 · el PATCH sigue siendo quien incrementa, y no se ha tocado su candado', () => {
  // Lo que este ticket NO hace: cambiar qué bloquea el PATCH. Que un albarán enviado a firmar se
  // pueda editar es un hallazgo aparte y otra decisión — aquí solo se evita firmar a ciegas.
  const admin = fs.readFileSync(F_ADMIN, 'utf8');
  assert.match(admin, /version:\s*\{\s*increment:\s*1\s*\}/,
    '🔴 el PATCH ya no incrementa `version`: el detector de conflictos se ha quedado sin señal.');
  assert.match(admin, /estado === 'firmado'/,
    '🔴 el PATCH ya no comprueba el estado firmado.');
});
