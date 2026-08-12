// tests/_afirmaciones-derivadas.mjs — SCRUM-498 · el «21» se CUENTA; la prosa que lo escribe, se ATA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA VÍCTIMA, Y TIENE FECHA
//
// `EmailMessage` lleva `merchantId` y entra en `schema.prisma` en cuanto se desbloquee SCRUM-497:
// ya está escrito en `scrum-475-schema-emailmessage` (`56a5e462`), esperando merge. **Ese día la
// población pasa de 21 a 22 y trece frases del árbol se vuelven falsas a la vez, sin que caiga
// nada.**
//
// Y no es teórico. Esta misma mañana la cabecera de `docs/sql/scrum-475-email-messages.sql` mandaba
// distinguir staging de producción contando `invoices` con una cifra del 7-ago, y estuvo a punto de
// usarse para decidir **en qué base se escribía**.
//
//   🔴 Un número escrito en prosa no tiene fecha de caducidad visible, y el que lo lee no sabe
//      que ya no vale.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE SE MIDIÓ Y CORRIGE EL ENCUADRE: EL SUELO NO ESTABA MAL CALIBRADO
//
// La sospecha era «un suelo con holgura convierte una afirmación exacta en decorativa». Medido, hay
// **tres** suelos sobre esta población y ninguno es un descuido:
//
//   · `portabilidadCompleta.ts` → `MINIMO_MODELOS = 15`, y su autor lo argumenta: *«El número no se
//     fija a 21 a propósito: un mínimo no estorba cuando alguien añade un modelo, y un exacto
//     obligaría a tocar esto en cada PR ajeno hasta que alguien lo desactive.»* Tiene razón.
//   · `scrum314` → `>= 20`  ·  `scrum243` → `>= 21`
//
// **Su trabajo es detectar CEGUERA, no vigilar la cifra.** Un mínimo es la forma correcta de eso: si
// la derivación devuelve 0 porque el DMMF llegó vacío, el paquete de portabilidad saldría vacío y
// verde. Pedirle además que vigile la afirmación es pedirle dos trabajos con una sola cifra.
//
// 🔴 **La avería real no es que el suelo tenga holgura: es que la AFIRMACIÓN no la vigilaba nadie.**
// Así que aquí no se toca ni un suelo. Se ata la prosa, que es lo que estaba suelto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ATAR Y NO DERIVAR EN LOS TRECE SITIOS
//
// **Un comentario no puede contar.** Donde el número vive en un mensaje interpolable, se DERIVA y
// desaparece —es el caso de `scrum314:60`—. Donde vive en prosa de un comentario, derivar es
// imposible: lo único que queda es atarlo a un guard que lo compare con la cifra contada. Un
// comentario que no se puede derivar y que nadie vigila es peor que no tener número.
//
// ⚠️ Y UNA EXCEPCIÓN MEDIDA: un número **con su fecha visible** no es el defecto. `scrum243:148`
// dice *«el 30-jul había 21»*, y eso seguirá siendo cierto cuando sean 22. No se registra, y se
// dice por qué: lo que caduca en silencio es el número SIN fecha.
import fs from 'node:fs';
import path from 'node:path';

/** El campo que marca la pertenencia. Un solo sitio lo nombra (igual que `CAMPO_TENENCIA`). */
export const CAMPO = 'merchantId';

/**
 * INSTRUMENTO ② — el TEXTO de `schema.prisma`, bloque a bloque.
 *
 * El ① es la herramienta de la casa (`modelosDelMerchant()` sobre el DMMF) y **gana ella**: ya
 * existe, es inyectable y está probada. Éste no la sustituye: la CONTRASTA. Los dos leen la misma
 * verdad por caminos distintos —uno el cliente generado, otro el fichero— y si discrepan, lo que
 * hay es un cliente desparejado, que es un fallo que este repo ya ha pagado.
 */
export function modelosDelTexto(texto) {
  const out = [];
  let actual = null;
  for (const linea of texto.split(/\r?\n/)) {
    const abre = /^\s*model\s+([A-Za-z0-9_]+)\s*\{/.exec(linea);
    if (abre) { actual = { nombre: abre[1], campos: [] }; continue; }
    if (actual && /^\s*\}\s*$/.test(linea)) { out.push(actual); actual = null; continue; }
    if (!actual) continue;
    const campo = /^\s*([A-Za-z0-9_]+)\s+\S/.exec(linea.replace(/\/\/.*$/, ''));
    if (campo) actual.campos.push(campo[1]);
  }
  return {
    total: out.length,
    conCampo: out.filter((m) => m.campos.includes(CAMPO)).map((m) => m.nombre).sort(),
  };
}

/**
 * LAS AFIRMACIONES ATADAS. Una por sitio donde la prosa escribe el tamaño de esta población.
 *
 * 🔴 El patrón es un REGEX con UN grupo: el número. No se guarda la línea — las líneas se mueven
 * con cualquier edición y un registro que apunta a un número de línea rota sin que nadie lo note.
 * Y si el patrón deja de casar, el guard NO da verde: dice que se ha quedado ciego, porque «la
 * frase ya no dice 21» y «no sé leer la frase» no pueden salir por la misma línea.
 */
export const AFIRMACIONES = [
  { fichero: 'src/app.ts', patron: /cubre los (\d+) modelos con/ },
  { fichero: 'src/modules/exports/domain/portabilidadCompleta.ts', patron: /\*\*de los (\d+) modelos/ },
  { fichero: 'src/modules/system/domain/barridoDemo.ts', patron: /\*\*10 de los (\d+) modelos con/ },
  { fichero: 'src/modules/system/domain/barridoDemo.ts', patron: /Los (\d+) con `merchantId`, en el orden/ },
  { fichero: 'tests/_censo-merchant-de-la-url.mjs', patron: /medido: (\d+) modelos la tienen/ },
  { fichero: 'tests/scrum244-cobertura-portabilidad.test.mjs', patron: /De los (\d+) modelos con merchantId/ },
  { fichero: 'tests/scrum272-criterio-referencial.test.mjs', patron: /durante los (\d+) `deleteMany`/ },
  { fichero: 'tests/scrum272-criterio-referencial.test.mjs', patron: /de los (\d+) modelos, \*\*\d+ llevan/ },
  { fichero: 'tests/scrum314-wipedemo-derivado.test.mjs', patron: /\*\*10 de los (\d+) modelos con/ },
  { fichero: 'tests/scrum314-wipedemo-derivado.test.mjs', patron: /«cubrir los (\d+)»/ },
  { fichero: 'tests/scrum314-wipedemo-derivado.test.mjs', patron: /los (\d+) por merchant/ },
  { fichero: 'tests/scrum440-tenencia-supresion.test.mjs', patron: /medido: (\d+) modelos la tienen/ },
];

/**
 * 🔴 DECLARADAS FUERA, con su motivo. Una ausencia sin explicar es indistinguible de un olvido.
 *
 * `tests/_merchant-fixture.mjs` (×3) — zona de SCRUM-495/497, con otra sesión dentro. Sus tres
 * frases dicen 21 y se volverán falsas el mismo día que las demás. **No se tocan aquí**, y quedan
 * nombradas para que el hueco no se vuelva permanente.
 */
export const PENDIENTES_FUERA_DE_CARRIL = [
  { fichero: 'tests/_merchant-fixture.mjs', ocurrencias: 3, motivo: 'SCRUM-495/497, otra sesión dentro' },
];

/**
 * ⚠️ NO REGISTRADAS A PROPÓSITO, y el motivo importa:
 *   · `tests/scrum243-tenencia-lectura.test.mjs` — dice «el 30-jul había 21»: número CON FECHA, que
 *     seguirá siendo cierto cuando sean 22. Lo que caduca en silencio es el número sin fecha.
 *   · `tests/scrum172-cobertura-tenancy.test.mjs` — narra un comentario del pasado, no afirma el hoy.
 *   · `finalInvoice.service.ts` (21/10/4/0 son tipos de IVA), `scrum245` (respuestas del bot),
 *     `scrum301`/`scrum426`/`scrum76` (datos de fixture): otro «21», otra población.
 */

/** Comprueba cada afirmación contra la cifra CONTADA. */
export function verificar(raiz, derivado) {
  const filas = [];
  for (const { fichero, patron } of AFIRMACIONES) {
    const ruta = path.join(raiz, fichero);
    if (!fs.existsSync(ruta)) { filas.push({ fichero, patron, ciega: true, motivo: 'el fichero ya no existe' }); continue; }
    const texto = fs.readFileSync(ruta, 'utf8');
    const m = patron.exec(texto);
    if (!m) { filas.push({ fichero, patron, ciega: true, motivo: 'el patrón ya no casa: la frase cambió de redacción' }); continue; }
    const dice = Number(m[1]);
    const linea = texto.slice(0, m.index).split(/\r?\n/).length;
    filas.push({ fichero, patron, dice, linea, ciega: false, ok: dice === derivado });
  }
  return {
    derivado,
    filas,
    ciegas: filas.filter((f) => f.ciega),
    viejas: filas.filter((f) => !f.ciega && !f.ok),
  };
}

/** El rojo, NOMBRANDO qué frase se quedó vieja — no «el número no coincide». */
export function mensajeDeViejas(r) {
  return r.viejas.map((f) =>
    `   ${f.fichero}:${f.linea}  dice ${f.dice} y son ${r.derivado}`).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA AUTOPRUEBA — sobre fuente sintética, antes de creerse ningún número
// ─────────────────────────────────────────────────────────────────────────────────────────

export const SCHEMA_SINTETICO = `
model Uno {
  id         Int @id
  merchantId Int
}

model Dos {
  id         Int @id
  merchantId Int  // con comentario detrás
}

model SinTenencia {
  id   Int @id
  otro String
}
`;

/** El mismo esquema con un modelo MÁS que lleva `merchantId`: el día D, en pequeño. */
export const SCHEMA_SINTETICO_CRECIDO = SCHEMA_SINTETICO + `
model Tres {
  id         Int @id
  merchantId Int
}
`;

/**
 * 🔴 LA AUTOPRUEBA. Cuatro cosas, y las cuatro tienen que salir antes de creerse el número real:
 *
 *   · el contador de texto cuenta bien, y NO cuenta el modelo sin `merchantId`;
 *   · una frase que dice la cifra correcta pasa (control positivo);
 *   · una frase que se quedó vieja CAE, y se puede nombrar (el ensayo del día D en pequeño);
 *   · una frase que cambió de redacción se declara CIEGA, no verde — porque «ya no dice 21» y
 *     «no sé leer la frase» no pueden salir por la misma línea.
 */
export function autoprueba() {
  const antes = modelosDelTexto(SCHEMA_SINTETICO);
  const despues = modelosDelTexto(SCHEMA_SINTETICO_CRECIDO);

  const AFIRMA = [{ fichero: 'a.ts', patron: /son (\d+) modelos/ }];
  const buena = { 'a.ts': '// aquí son 2 modelos con merchantId' };
  const reescrita = { 'a.ts': '// aquí hay dos modelos, escritos con letra' };

  return {
    cuentaBien: antes.conCampo.length === 2 && antes.total === 3,
    noCuentaElQueNoTiene: !antes.conCampo.includes('SinTenencia'),
    // el día D, en pequeño: entra un modelo con `merchantId` y la cifra sube
    laCifraSube: despues.conCampo.length === 3,
    // control positivo
    laFraseBuenaPasa: verificarEnMemoria(buena, antes.conCampo.length, AFIRMA).viejas.length === 0,
    // 🔴 y con la cifra crecida, ESA MISMA frase cae
    laFraseViejaCae: verificarEnMemoria(buena, despues.conCampo.length, AFIRMA).viejas.length === 1,
    // y si la frase cambia de redacción, el guard se declara ciego en vez de dar verde
    laFraseReescritaSeDeclaraCiega: verificarEnMemoria(reescrita, antes.conCampo.length, AFIRMA).ciegas.length === 1,
    // SUELO del contador: un esquema sin modelos no puede pasar por «cero modelos con merchantId»
    sinModelosNoCuenta: modelosDelTexto('').total === 0,
  };
}

/** Igual que `verificar` pero sin tocar disco: se le pasa el contenido de los ficheros. */
export function verificarEnMemoria(ficheros, derivado, afirmaciones) {
  const filas = [];
  for (const { fichero, patron } of afirmaciones) {
    const texto = ficheros[fichero];
    if (texto === undefined) { filas.push({ fichero, ciega: true, motivo: 'no existe' }); continue; }
    const m = patron.exec(texto);
    if (!m) { filas.push({ fichero, ciega: true, motivo: 'el patrón ya no casa' }); continue; }
    const dice = Number(m[1]);
    filas.push({ fichero, dice, ciega: false, ok: dice === derivado });
  }
  return { derivado, filas, ciegas: filas.filter((f) => f.ciega), viejas: filas.filter((f) => !f.ciega && !f.ok) };
}
