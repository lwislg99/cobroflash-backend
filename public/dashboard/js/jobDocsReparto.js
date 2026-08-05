// public/dashboard/js/jobDocsReparto.js — SCRUM-319 (G4)
//
// EL REPARTO DE LA PILA «DOCUMENTOS» DEL TRABAJO.
//
// En una sola lista ordenada por fecha convivían objetos con ciclos de vida y significados legales
// distintos. Un objeto que es ÚNICO no pertenece a una lista, y dos documentos con significados
// legales distintos no se ordenan juntos por fecha.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO DERIVADO CORRIGE AL TICKET EN DOS SITIOS
//
// El ticket enumeraba cuatro tipos —presupuesto, albaranes, justificantes y gastos— y esa lista
// salía de UNA CAPTURA. Derivada del código, la pila tiene **cinco**, y ni son esos cuatro ni están
// todos:
//
//   1. `presupuesto`    — uno, de `job.quote`
//   2. `albaran`        — n, de `job.albaranes`
//   3. `justificante`   — de `job.invoices`, cuando `type === 'JUST'` o el número empieza por `J-`
//   4. `factura`        — de `job.invoices`, el resto
//   5. `rectificativa`  — de `job.invoices`, cuando `type === 'R1'`
//
// **GASTOS no está, y nunca estuvo.** En la vista no hay un solo gasto: lo único que existe es el
// botón de alta, y el propio código lo dice donde se creó — «el gasto no se pinta en esta ficha;
// mostrarlo sería rentabilidad por obra, que es otro ticket». Una sección GASTOS con su total no
// sería repartir lo que hay: sería construir lo que no hay.
//
// **FACTURA y RECTIFICATIVA sí están, y el ticket no las nombra.** Son exactamente el «quinto tipo
// que no está en las capturas» que el propio ticket manda reportar en vez de colocar por cuenta
// propia (regla 9) — y con más motivo aquí: mandar una FACTURA al bloque DINERO junto a los
// justificantes sería repetir el error que B4 vino a arreglar, que es precisamente juntar dos
// documentos con significados legales distintos.

/** Tipos de `job.invoices`. MISMA condición que usa `jobDetDocLabel` para su rótulo. */
function tipoDeFactura(inv) {
  if (inv && inv.type === 'R1') return 'rectificativa';
  if (inv && (inv.type === 'JUST' || String(inv.number || '').startsWith('J-'))) return 'justificante';
  return 'factura';
}

// A DÓNDE VA CADA TIPO. Tabla declarativa: la vista reparte desde aquí y el guard verifica contra
// aquí. Un tipo nuevo sin entrada en esta tabla hace fallar el guard — que es el punto: una lista
// escrita a mano nunca avisa de lo que le falta.
//
//   'albaranes'        → su propia sección, con su acción
//   'rail-presupuesto' → el bloque PRESUPUESTO del rail (SCRUM-318). Es uno y no cambia.
//   'rail-dinero'      → el bloque DINERO del rail, enlazados
//   'sin-destino'      → NO SE DECIDE AQUÍ. Se quedan donde estaban, juntos y visibles, hasta que
//                        el fundador diga dónde van. Es la única opción que no inventa un diseño
//                        ni pierde un documento: las dos cosas que este ticket prohíbe.
const DESTINO_POR_TIPO = {
  presupuesto: 'rail-presupuesto',
  albaran: 'albaranes',
  justificante: 'rail-dinero',
  factura: 'sin-destino',
  rectificativa: 'sin-destino',
};

const DESTINOS_DOCUMENTO = ['albaranes', 'rail-presupuesto', 'rail-dinero', 'sin-destino'];

/**
 * Reparte los descriptores de la pila por destino.
 *
 * Trabaja sobre `{ tipo, clave }`, no sobre DOM, para que el test de «nada se pierde» pueda
 * comparar conjuntos sin montar un navegador. Un documento sin destino conocido **no se descarta**:
 * va a `desconocidos`, y hay un guard que falla si esa lista no está vacía. Descartarlo sería
 * perderlo en silencio, que es el peor resultado posible de reordenar una pantalla.
 */
function repartirDocumentos(items) {
  const out = { 'albaranes': [], 'rail-presupuesto': [], 'rail-dinero': [], 'sin-destino': [], desconocidos: [] };
  for (const it of items || []) {
    const destino = DESTINO_POR_TIPO[it && it.tipo];
    if (destino) out[destino].push(it);
    else out.desconocidos.push(it);
  }
  return out;
}

// LAS SECCIONES DEL CUERPO, EN ORDEN. Estructura, igual que los bloques del rail en G1:
//
//   · `que-falta-para-cobrar` — es **G5** y no se pinta. Se declara para que G5 tenga sitio y para
//     que el orden quede fijado aquí y no en el punto del render donde a alguien le venga bien.
//   · `albaranes`             — la sección de este ticket.
//   · `gastos`                — DECLARADA Y VACÍA, y no por pereza: **en esta vista no hay ni un
//     gasto**. La pila nunca tuvo ninguno; lo único que existe es el botón de alta, y el propio
//     código lo dice donde se creó. Una sección GASTOS con su total exigiría traerlos, sumarlos y
//     calcular margen — construir lo que no hay, no repartir lo que hay. Y el ticket declara «el
//     mecanismo de gastos» fuera de alcance.
//   · `documentos`            — lo que queda sin destino decidido.
const SECCIONES_CUERPO = ['que-falta-para-cobrar', 'albaranes', 'gastos', 'documentos'];

/** Todas las claves repartidas, para comprobar contra las de la pila original. */
function clavesRepartidas(reparto) {
  return DESTINOS_DOCUMENTO
    .flatMap((d) => reparto[d])
    .concat(reparto.desconocidos)
    .map((it) => it.clave);
}

if (typeof window !== 'undefined') {
  window.tipoDeFactura = tipoDeFactura;
  window.repartirDocumentos = repartirDocumentos;
  window.DESTINO_POR_TIPO = DESTINO_POR_TIPO;
  window.DESTINOS_DOCUMENTO = DESTINOS_DOCUMENTO;
  window.SECCIONES_CUERPO = SECCIONES_CUERPO;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tipoDeFactura, repartirDocumentos, clavesRepartidas, DESTINO_POR_TIPO, DESTINOS_DOCUMENTO, SECCIONES_CUERPO };
}
