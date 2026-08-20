// scripts/_registro-de-lo-aprobado.mjs — SCRUM-563
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 NADA EN EL ÁRBOL DECÍA QUÉ MICROCOPY ESTÁ APROBADA
//
// Había un documento de PROPUESTA (51 textos) y marcadores que dicen «pendiente». No había
// ningún sitio que dijera «aprobado, esta fecha, ESTO exactamente». La consecuencia no es
// burocrática: en un solo día se abrieron tres tickets sobre una premisa falsa, y el último
// —SCRUM-561— nació diciendo que 20 textos eran inéditos cuando los 20 estaban en un documento
// del repositorio. Hizo falta cruzarlos a mano para desmentirlo.
//
// Este fichero es ese sitio. Y guarda el TEXTO LITERAL, no una descripción: la pregunta que
// tiene que poder contestar es «¿este texto de hoy es el que se aprobó?», y ésa se contesta con
// `Buffer.compare`, no leyendo.
//
// ⚠️ ESTE FICHERO NO APRUEBA NADA. Registra lo que ya se decidió, con su fecha y su autor.
//
// ── El mecanismo es el de SCRUM-551, copiado, no reinventado ─────────────────────────────
// El registro de anclas guarda el TEXTO de cada frase: si alguien la reescribe, el ancla caduca
// sola porque el texto ya no coincide. Aquí igual: la aprobación va atada al texto literal, así
// que reescribir una frase aprobada **caduca su aprobación y lo dice**, con su identificador y
// su fecha. No hay que acordarse de nada.
//
// ── Dónde vive, y por qué aquí ───────────────────────────────────────────────────────────
// En un módulo, no en un comentario del HTML. Un comentario del HTML fue justo lo que estuvo a
// punto de dejar mal registrado lo de F7: decía una cosa y el encargo decía otra, y se resolvió
// por suerte. Un comentario no lo lee ningún test; esto sí.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { citar } from './_citar-fuera-del-censo.mjs';

/** Los tres estados. `NI_UNA_COSA_NI_OTRA` es el que hoy no existía y el que más ha costado. */
export const APROBADO = 'APROBADO';
export const PENDIENTE = 'PENDIENTE';
export const NI_UNA_COSA_NI_OTRA = 'NI_UNA_COSA_NI_OTRA';

/**
 * Los marcadores que ya existen en el máster. **No se inventa ninguno**: no hay
 * `data-microcopy="APROBADO"` ni nada parecido, porque los estados salen del máster y si
 * faltara uno se preguntaría. Lo aprobado se sabe por ESTE registro, no por un atributo nuevo.
 */
export const MARCADORES_DE_PENDIENTE = [
  /data-microcopy="PENDIENTE_FUNDADOR"/,
  /data-propuesta="microcopy-sin-aprobar"/,
];

/**
 * EL REGISTRO. **52 entradas**, en dos tandas del mismo día:
 *
 *   · 41 · el 20-ago-2026. «Los 38 del esquema» + «los 4 de F7», que son 41 y no 42 porque uno
 *     de los cuatro de F7 ya está entre los 38 (`contacto-publico/h2#1` es un `<h2>`, o sea
 *     unidad del esquema). Los otros tres viven en atributos. 38 + 3 = 41.
 *   · 11 · seis textos más, aprobados tras el censo de SCRUM-561 — cinco de un nodo y «Empezar
 *     gratis →», que está seis veces en el marcado (una por gremio). 5 + 6 = 11.
 *
 * Cada entrada se generó DEL MARCADO, no se copió a mano: 52 textos con tildes y flechas
 * copiados a mano es la manera más fácil de meter una errata que mañana se lee como «el texto
 * cambió».
 */
export const REGISTRO = [
  { id: 'heroe-f4/h1#1',
    texto: 'Del presupuesto al cobro, sin salir de WhatsApp.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'heroe-f4/p#1',
    texto: 'Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con tarjeta, Bizum o transferencia. No hace falta que te fíes: haz tú el recorrido completo antes de dar tu correo.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'heroe-f4/p#2',
    texto: '14 días gratis Sin tarjeta',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios/h2#1',
    texto: 'El recorrido es el mismo. El trabajo, no.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios/p#1',
    texto: 'Busca el tuyo — así es un día normal con YaQu en la mano.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[fontaneria]/h3#1',
    texto: 'Fontanería',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[fontaneria]/p#1',
    texto: 'Presupuestas un desatasco desde la furgoneta, el cliente firma en su móvil y cobras al terminar — sin volver a casa a hacer papeles.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[electricidad]/h3#1',
    texto: 'Electricidad',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[electricidad]/p#1',
    texto: 'Cambias un cuadro y aparecen dos puntos de luz más. Añades las líneas en la misma escalera, el cliente acepta en el momento y no se quedan sin cobrar.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[reformas]/h3#1',
    texto: 'Reformas',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[reformas]/p#1',
    texto: 'Una obra de tres semanas y cuatro pagos. Cobras por tramos según avanza y cada parte firmado queda con su fecha.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[climatizacion]/h3#1',
    texto: 'Climatización',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[climatizacion]/p#1',
    texto: 'Revisas la caldera antes del invierno. El presupuesto sale de la sala de máquinas y la revisión del año que viene queda anotada sola.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[cerrajeria]/h3#1',
    texto: 'Cerrajería',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[cerrajeria]/p#1',
    texto: 'Una apertura a las dos de la mañana. Presupuestas en el portal, el cliente firma en su móvil y cobras antes de recoger la herramienta.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[pintura]/h3#1',
    texto: 'Pintura',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'gremios[pintura]/p#1',
    texto: 'Mides el piso y mandas el presupuesto antes de bajar la escalera. La señal entra antes de que compres la pintura.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa/h2#1',
    texto: 'Tu libreta no firma, no cobra y no avisa.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa/p#1',
    texto: 'Seis situaciones de cualquier semana, y cómo se resuelven hoy.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[firma]/p#1',
    texto: 'El cliente dice que él nunca autorizó ese trabajo.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[firma]/p#2',
    texto: 'Tu método actual Tu palabra contra la suya.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[firma]/p#3',
    texto: 'Con YaQu Lo aceptó con su firma y su fecha, y la firma queda dentro del PDF.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[cobro-pendiente]/p#1',
    texto: 'La factura lleva tres semanas sin pagarse y te da corte insistir.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[cobro-pendiente]/p#2',
    texto: 'Tu método actual O llamas tú, o no llama nadie.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[cobro-pendiente]/p#3',
    texto: 'Con YaQu El recordatorio sale solo. Tú no tienes que ser el pesado.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[presupuesto-sin-respuesta]/p#1',
    texto: 'Pasaste el presupuesto hace diez días y el cliente no ha dicho nada.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[presupuesto-sin-respuesta]/p#2',
    texto: 'Tu método actual Se queda en la libreta hasta que te acuerdas.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[presupuesto-sin-respuesta]/p#3',
    texto: 'Con YaQu Se le recuerda solo, y el presupuesto caduca cuando toca.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[historial-cliente]/p#1',
    texto: '«¿Cuánto me cobraste por lo del año pasado?»',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[historial-cliente]/p#2',
    texto: 'Tu método actual A buscar entre hojas, si es que la guardaste.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[historial-cliente]/p#3',
    texto: 'Con YaQu Cada movimiento queda en su ficha, con su fecha.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[margen-mes]/p#1',
    texto: 'Acaba el mes y no sabes si has ganado dinero.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[margen-mes]/p#2',
    texto: 'Tu método actual Lo sabrás cuando lo diga la gestoría.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[margen-mes]/p#3',
    texto: 'Con YaQu Lo que entró menos lo que salió, mes a mes.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[catalogo-precios]/p#1',
    texto: 'Vuelves a escribir a mano los precios de siempre.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[catalogo-precios]/p#2',
    texto: 'Tu método actual Los copias hoja a hoja, y alguno sale mal.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'comparativa[catalogo-precios]/p#3',
    texto: 'Con YaQu Salen de tu catálogo según escribes.',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'contacto-publico/h2#1',
    texto: '¿Tienes una duda antes de empezar?',
    via: 'elemento', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'contacto-publico@data-wa-etiqueta',
    texto: 'Escríbenos por WhatsApp',
    via: 'atributo', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'contacto-publico@data-wa-texto',
    texto: 'Hola, tengo una duda sobre YaQu',
    via: 'atributo', fecha: '2026-08-20', quien: 'fundador' },
  { id: 'contacto-publico@data-email-etiqueta',
    texto: 'Escríbenos por correo',
    via: 'atributo', fecha: '2026-08-20', quien: 'fundador' },

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // SEIS MÁS · aprobadas el 20-ago-2026 tras el censo de SCRUM-561
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // Son seis de las siete que el documento proponía y ninguna aprobación cubría. La séptima
  // —«El ERP por WhatsApp para los oficios»— se queda PENDIENTE y NO está en esta lista:
  // necesita aprobación Y ancla, y las dos las decide el fundador.
  //
  // 🔴 `via: 'texto-del-elemento'` ES NUEVO, y nace de un caso real: «Empezar gratis →» NO
  // existe como secuencia contigua de bytes. En el marcado es
  //     <a class="p-link" href="/register.html">Empezar gratis <span class="ar">→</span></a>
  // o sea DOS nodos de texto por tarjeta, doce en total. Buscar la cadena en el fichero daría
  // «no está», y eso se leería como «alguien cambió el texto».
  //
  // Se resuelve recomponiendo el TEXTO ENTERO DEL ELEMENTO que nombra el identificador —lo que
  // el visitante lee de corrido— y comparándolo con `===` y `Buffer.compare` como todo lo
  // demás. No se guarda un trozo ni una descripción: se guarda lo aprobado, tal cual.
  //
  // ⚠️ SIENTA PRECEDENTE, y por eso se escribe la regla: `texto-del-elemento` se usa cuando el
  // texto aprobado ABARCA varios nodos del mismo elemento. NO sirve para juntar texto de
  // elementos distintos —eso sería inventar una frontera que el marcado no tiene— ni para
  // partir uno en trozos. Las cinco entradas de un solo nodo van igualmente por aquí porque el
  // texto del elemento y el del nodo coinciden: una regla uniforme se comprueba, una excepción
  // se olvida.
  { id: 'heroe-f4/a#1',
    texto: 'Probar la demo',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F4-4' },
  { id: 'heroe-f4/a#2',
    texto: 'Empieza gratis',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F4-5' },
  { id: 'comparativa/span#1',
    texto: 'PROPUESTA · La diferencia',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F5-1' },
  { id: 'comparativa/span#2',
    texto: 'La situación',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F5-4' },
  { id: 'gremios/span#1',
    texto: 'Tu oficio',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F6-1' },
  // F6-6 · la misma frase aprobada una vez, seis veces en el marcado (una por gremio).
  { id: 'gremios[fontaneria]/a#1',
    texto: 'Empezar gratis →',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F6-6' },
  { id: 'gremios[electricidad]/a#1',
    texto: 'Empezar gratis →',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F6-6' },
  { id: 'gremios[reformas]/a#1',
    texto: 'Empezar gratis →',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F6-6' },
  { id: 'gremios[climatizacion]/a#1',
    texto: 'Empezar gratis →',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F6-6' },
  { id: 'gremios[cerrajeria]/a#1',
    texto: 'Empezar gratis →',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F6-6' },
  { id: 'gremios[pintura]/a#1',
    texto: 'Empezar gratis →',
    via: 'texto-del-elemento', fecha: '2026-08-20', quien: 'fundador', doc: 'F6-6' },
];

/**
 * 🔴 LA QUE NO SE APROBÓ, escrita aquí para que su ausencia sea una DECISIÓN y no un olvido.
 *
 * Un texto que falta del registro y uno que se decidió dejar fuera se leen igual: los dos son
 * «no está». Ésta se dejó fuera a propósito el 20-ago-2026 — dice qué **es** el producto, y eso
 * necesita aprobación Y ancla. Un test comprueba que sigue fuera y que sigue saliendo PENDIENTE.
 */
export const NO_APROBADAS = [
  { id: 'heroe-f4/span#1', texto: 'El ERP por WhatsApp para los oficios', doc: 'F4-1',
    motivo: 'afirma la CATEGORÍA del producto. Necesita aprobación y ancla; las dos son del '
      + 'fundador. Citada en docs/MICROCOPY_FUERA_DEL_ESQUEMA.md.' },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL INSTRUMENTO
// ═════════════════════════════════════════════════════════════════════════════════════════
export const LANDING = 'public/index.html';
export const SECCIONES = ['heroe-f4', 'gremios', 'comparativa', 'contacto-publico'];
export const ATRIBUTOS_DE_TEXTO = ['data-wa-etiqueta', 'data-wa-texto', 'data-email-etiqueta'];

const limpiar = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Fuera de la medida: comentarios, `<script>`, `<style>` y `<svg>`. */
export function podar(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
}

/** El cuerpo de una `<section>` por su id, tolerando atributos en cualquier orden (SCRUM-553). */
export function cuerpoDeSeccion(html, id) {
  const m = new RegExp(`<section[^>]{0,400}?\\bid="${id}"[\\s\\S]{0,400}?>`).exec(html);
  if (!m) return null;
  const fin = html.indexOf('</section>', m.index);
  return html.slice(m.index, fin === -1 ? html.length : fin);
}

/**
 * El texto que hay HOY en cada identificador. Mismo esquema derivado que el censo de anclas
 * (`sección[ámbito]/etiqueta#orden`), más los atributos con `sección@atributo`.
 *
 * ⚠️ No se importa `unidades()` del censo de S1 porque aquél sólo recorre las secciones que ESE
 * censo declara censadas (hoy dos de cuatro), y este registro cubre las cuatro. El esquema es el
 * mismo y el test lo comprueba contra su salida en las dos que comparten.
 */
export function textosDeHoy(html) {
  const H = podar(html);
  const mapa = new Map();
  for (const id of SECCIONES) {
    const cuerpo = cuerpoDeSeccion(H, id);
    if (cuerpo === null) continue;
    const cuenta = {};
    for (const u of cuerpo.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const texto = limpiar(u[2]);
      if (!texto) continue;
      const ambito = [...cuerpo.slice(0, u.index).matchAll(/data-(?:gremio|fila)="([^"]+)"/g)].pop()?.[1] || '';
      const clave = id + (ambito ? `[${ambito}]` : '') + '/' + u[1];
      cuenta[clave] = (cuenta[clave] || 0) + 1;
      mapa.set(`${clave}#${cuenta[clave]}`, texto);
    }
    for (const a of ATRIBUTOS_DE_TEXTO) {
      const m = new RegExp(a + '\\s*=\\s*"([^"]*)"').exec(cuerpo);
      if (m) mapa.set(`${id}@${a}`, m[1]);
    }
  }
  // Y los que el esquema no alcanza —rótulos en `<span>`, etiquetas en `<a>`—, resueltos por el
  // TEXTO ENTERO DE SU ELEMENTO. Se reutiliza el censo de SCRUM-561, que ya deriva esos
  // identificadores con el mismo esquema; montar aquí un segundo extractor sería tener dos
  // versiones de la misma verdad y descubrir la discrepancia el día que importe.
  for (const n of citar(html).fuera) {
    const t = n.textoDeLaAccion || n.textoDelElemento;
    if (t && !mapa.has(n.id)) mapa.set(n.id, t);
  }
  return mapa;
}

/**
 * TODO el texto que se lee dentro de un cuerpo: nodos de texto de cualquier etiqueta, más los
 * atributos que un script convierte en texto. No se filtra por etiqueta a propósito — filtrar
 * por `h1|h2|h3|p|li` es exactamente lo que dejaba fuera veinte textos (SCRUM-561).
 */
export function textosVisiblesDe(cuerpo) {
  const out = [];
  for (const m of cuerpo.matchAll(/>([^<>]+)</g)) {
    const t = limpiar(m[1]);
    if (t) out.push(t);
  }
  for (const a of ATRIBUTOS_DE_TEXTO) {
    const m = new RegExp(a + '\\s*=\\s*"([^"]*)"').exec(cuerpo);
    if (m && m[1]) out.push(m[1]);
  }
  return out;
}

/** Igualdad de texto: `===` Y `Buffer.compare`. Nunca `includes()`. */
export const mismoTexto = (a, b) => typeof a === 'string' && typeof b === 'string'
  && a === b && Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0;

/**
 * El estado de un texto cualquiera. **Éste es el que decide**, porque es la pregunta que ha
 * mordido tres veces: dado un texto de la landing, ¿está aprobado, está pendiente, o no es ni
 * una cosa ni otra?
 *
 * El tercer estado no es un detalle: hoy la mayor parte del copy PUBLICADO —#como, #todo,
 * #precios, #probar, #faq— no está aprobado ni marcado como pendiente. Nadie lo había dicho
 * porque no había dónde decirlo.
 */
export function estadoDe(texto, html) {
  const enRegistro = REGISTRO.find((r) => mismoTexto(r.texto, texto));
  if (enRegistro) return { estado: APROBADO, id: enRegistro.id, fecha: enRegistro.fecha, quien: enRegistro.quien };

  // ⚠️ El marcador es de la SECCIÓN, así que alcanza a TODO lo que hay dentro — no sólo a las
  // unidades del esquema. Si aquí se preguntara sólo por unidades, «Tu oficio» —un `<span>` de
  // una sección marcada— saldría «ni una cosa ni otra», y no es verdad: está pendiente. Ése fue
  // justo el punto ciego que midió SCRUM-561.
  const H = podar(html);
  for (const id of SECCIONES) {
    const cuerpo = cuerpoDeSeccion(H, id);
    if (cuerpo === null) continue;
    const apertura = cuerpo.slice(0, cuerpo.indexOf('>') + 1);
    if (!MARCADORES_DE_PENDIENTE.some((re) => re.test(apertura))) continue;
    if (textosVisiblesDe(cuerpo).some((t) => mismoTexto(t, texto))) {
      return { estado: PENDIENTE, seccion: id };
    }
  }
  return { estado: NI_UNA_COSA_NI_OTRA };
}

/**
 * Aprobaciones que han CADUCADO: el identificador sigue existiendo y el texto ya no es el que se
 * aprobó. Es el mecanismo de SCRUM-551 tal cual — el registro guarda el texto, así que reescribir
 * una frase caduca su aprobación sola.
 *
 * `SIN_ANCLAJE` es distinto de `CADUCADA` y por eso se separan: el texto puede seguir aprobado y
 * ser el marcado el que se movió. Meterlos en el mismo saco haría que un cambio de estructura
 * pareciera un cambio de copy.
 *
 * ⚠️ EL IDENTIFICADOR LLEVA ORDINAL, y eso hay que saberlo antes de leer un informe: quitar o
 * meter una unidad EN MEDIO de un grupo renumera las siguientes, y entonces esto informa de
 * varias aprobaciones «caducadas» cuando lo que ha pasado es un corrimiento. **No se disimula
 * porque no es un fallo del mecanismo:** el ordinal es lo que permite distinguir dos frases
 * idénticas en sitios distintos —«Tu método actual» está seis veces— y sin él no habría
 * identificador. Lo que importa es que el cambio NO PASE EN SILENCIO, y no pasa. Si algún día
 * molesta, la salida es poner `id` en el marcado, no adivinar.
 */
export function revisar(html) {
  const hoy = textosDeHoy(html);
  const caducadas = [];
  const sinAnclaje = [];
  const vigentes = [];
  for (const r of REGISTRO) {
    if (!hoy.has(r.id)) { sinAnclaje.push(r); continue; }
    const ahora = hoy.get(r.id);
    if (mismoTexto(ahora, r.texto)) vigentes.push(r);
    else caducadas.push({ ...r, ahora });
  }
  return { caducadas, sinAnclaje, vigentes, total: REGISTRO.length };
}

/** Lectura desde disco, para no obligar a cada llamante a saber dónde está la landing. */
export const leerLanding = (raiz) => fs.readFileSync(path.join(raiz, LANDING), 'utf8');

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TERCER GRUPO · lo que el documento propone y NINGUNA aprobación cubrió
// ═════════════════════════════════════════════════════════════════════════════════════════
export const DOC_PROPUESTA = 'docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md';

/** Las entradas del documento de propuesta, con su número (`F4-1`, `F5-12`…). */
export function entradasDelDocumento(raiz) {
  const md = fs.readFileSync(path.join(raiz, DOC_PROPUESTA), 'utf8');
  return [...md.matchAll(/^### (F[0-9]-[0-9]+)[^\n]*\n\n> ([^\n]+)/gm)]
    .map((m) => ({ num: m[1], texto: m[2].trim() }));
}

/**
 * Las entradas del documento que el registro NO cubre, separadas en dos, porque meterlas en el
 * mismo saco daría un número alarmante y medio falso:
 *
 *   · `sinCubrir`  — nadie aprobó ese texto ni nada que lo contenga. Son los que el esquema del
 *                    censo no alcanza: rótulos, etiquetas de botón, cabeceras de columna.
 *   · `partidoDistinto` — las palabras SÍ están aprobadas, dentro de una unidad más larga. El
 *                    documento las partió de otra manera que el extractor. No es una aprobación
 *                    que falte: es la misma frase con otra frontera (territorio de SCRUM-553).
 *
 * ⚠️ La pertenencia se decide por CONTENCIÓN, y se dice: aquí `indexOf` es la pregunta correcta
 * («¿estas palabras viven dentro de una unidad aprobada?»). La pregunta de identidad —«¿es este
 * texto el aprobado?»— es la de `mismoTexto`, y ésa nunca usa contención.
 */
export function reconstruir(raiz) {
  const doc = entradasDelDocumento(raiz);
  const sinCubrir = [];
  const partidoDistinto = [];
  const cubierto = [];
  for (const d of doc) {
    const exacto = REGISTRO.find((r) => mismoTexto(r.texto, d.texto));
    if (exacto) { cubierto.push({ ...d, id: exacto.id }); continue; }
    const dentroDe = REGISTRO.find((r) => r.texto.indexOf(d.texto) !== -1);
    if (dentroDe) { partidoDistinto.push({ ...d, dentroDe: dentroDe.id, unidad: dentroDe.texto }); continue; }
    sinCubrir.push(d);
  }
  return { doc, cubierto, partidoDistinto, sinCubrir };
}
