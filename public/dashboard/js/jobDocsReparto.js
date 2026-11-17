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
//   'albaranes'        → su propia sección: lo ENTREGADO
//   'facturas'         → su propia sección: lo FACTURADO. Decisión del fundador — ni al rail, ni al
//                        bloque DINERO con los justificantes (sería el error de B4 en dirección
//                        contraria), ni fuera de la pantalla: que el Trabajo enseñe el ciclo
//                        completo es el diferencial del producto.
//   'anclada'          → COLGANDO de su factura original, nunca suelta (ver abajo)
//   'rail-presupuesto' → el bloque PRESUPUESTO del rail (SCRUM-318). Es uno y no cambia.
//   'rail-dinero'      → el bloque DINERO del rail, enlazados
const DESTINO_POR_TIPO = {
  presupuesto: 'rail-presupuesto',
  albaran: 'albaranes',
  justificante: 'rail-dinero',
  factura: 'facturas',
  rectificativa: 'anclada',
};

const DESTINOS_DOCUMENTO = ['albaranes', 'facturas', 'anclada', 'rail-presupuesto', 'rail-dinero'];

/**
 * Reparte los descriptores de la pila por destino.
 *
 * Trabaja sobre `{ tipo, clave }`, no sobre DOM, para que el test de «nada se pierde» pueda
 * comparar conjuntos sin montar un navegador. Un documento sin destino conocido **no se descarta**:
 * va a `desconocidos`, y hay un guard que falla si esa lista no está vacía. Descartarlo sería
 * perderlo en silencio, que es el peor resultado posible de reordenar una pantalla.
 */
function repartirDocumentos(items) {
  const out = { 'albaranes': [], 'facturas': [], 'anclada': [], 'rail-presupuesto': [], 'rail-dinero': [], desconocidos: [], huerfanas: [] };
  for (const it of items || []) {
    const destino = DESTINO_POR_TIPO[it && it.tipo];
    if (destino) out[destino].push(it);
    else out.desconocidos.push(it);
  }

  // ── LA RECTIFICATIVA NUNCA VA SUELTA ────────────────────────────────────────────────
  //
  // Ordenada por fecha como una fila más es **legalmente ilegible**: no dice a qué factura
  // corrige. Se ancla a su original (`rectificaClave`), colgando de ella.
  //
  // Si su original NO está en este Trabajo —una rectificativa de una factura de otro Job, o el
  // dato ausente— **no se esconde**: baja a la sección de facturas, visible, y queda anotada en
  // `huerfanas` para que el guard lo diga. Perderla sería peor que enseñarla mal.
  const clavesFactura = new Set(out.facturas.map((f) => f.clave));
  const ancladas = [];
  for (const r of out.anclada) {
    if (r.rectificaClave && clavesFactura.has(r.rectificaClave)) ancladas.push(r);
    else { out.huerfanas.push(r); out.facturas.push(r); }
  }
  out.anclada = ancladas;
  return out;
}

// LAS SECCIONES DEL CUERPO, EN ORDEN. Estructura, igual que los bloques del rail en G1:
//
//   · `que-falta-para-cobrar` — es **G5** y no se pinta. Se declara para que G5 tenga sitio y para
//     que el orden quede fijado aquí y no en el punto del render donde a alguien le venga bien.
//   · `albaranes`             — lo entregado.
//   · `gastos`                — DECLARADA Y VACÍA, y no por pereza: **en esta vista no hay ni un
//     gasto**. La pila nunca tuvo ninguno; lo único que existe es el botón de alta, y el propio
//     código lo dice donde se creó. Una sección GASTOS con su total exigiría traerlos, sumarlos y
//     calcular margen — construir lo que no hay, no repartir lo que hay. Y el ticket declara «el
//     mecanismo de gastos» fuera de alcance.
//   · `facturas`              — lo facturado, con sus rectificativas colgando.
//   · `notas`                 — SCRUM-427. Va la ÚLTIMA y FUERA del ciclo a propósito: las tres
//     de arriba son pasos del dinero (qué falta → entregado → facturado) y ésta no es un paso, es
//     CONTEXTO. Meterla en medio rompería la lectura del ciclo; dejarla fuera de la lista la
//     escondería del contrato, que es donde se mira qué secciones existen.
const SECCIONES_CUERPO = ['que-falta-para-cobrar', 'albaranes', 'facturas', 'gastos', 'notas'];

/** Todas las claves repartidas, para comprobar contra las de la pila original. */
function clavesRepartidas(reparto) {
  // Las huérfanas YA están dentro de `facturas`: contarlas otra vez inventaría un documento
  // que no existe y el test de «nada se pierde» se pondría rojo por su propia aritmética.
  return DESTINOS_DOCUMENTO
    .flatMap((d) => reparto[d])
    .concat(reparto.desconocidos)
    .map((it) => it.clave);
}

// ── SCRUM-1694 · ¿HAY UN BORRADOR DE HOY EN ESTE TRABAJO? ─────────────────────────────────────
//
// D2 (SCRUM-1686 c.21461) y M2 en el máster: un parte por visita. «+ Nuevo parte» CREA, salvo que
// el trabajo ya tenga un parte en `borrador` de HOY: entonces abre ése, para que entrar a mirar no
// deje partes vacíos. Un parte `firmado` hoy NO cuenta (esa visita ya se cerró) y un borrador de
// ayer tampoco (es otra visita).
//
// «HOY» ES EL DÍA NATURAL EN LA ZONA DEL MERCHANT (`Merchant.timezone`, regla de `zonaDelMerchant`:
// sin zona → UTC). Es la misma con la que el alta del parte le pone el año al número
// (`partes.routes.ts`, POST): contar «hoy» en la zona del navegador haría que un móvil con la hora
// de otro sitio abriera o creara lo que no toca.
//
// `cal` es `window.quoteCaducidad` (SCRUM-633), que ya sabe el día natural en una zona; se pasa
// como argumento para no atar esta pieza a un orden de carga y poder probarla en Node.
// `partes` llega ordenada por fecha DESC (la ordena el servidor): el primero que case es el más
// reciente.
function borradorDeHoy(partes, merchant, ahora, cal) {
  if (!Array.isArray(partes) || !partes.length || !cal) return null;
  const zona = cal.zonaDelMerchant(merchant);
  const hoy = cal.diaNaturalEn(ahora instanceof Date ? ahora : new Date(), zona);
  for (const p of partes) {
    if (!p || p.estado !== 'borrador' || !p.fecha) continue;
    if (cal.diaNaturalEn(p.fecha, zona) === hoy) return p;
  }
  return null;
}

// ── SCRUM-1751 · ANTES DE CREAR EL PARTE DE OTRA VISITA, SE PREGUNTA ──────────────────────────
//
// Las dos puertas al parte («Abrir parte» en la lista, «+ Nuevo parte» en la ficha) CREAN uno
// cuando no encuentran un borrador que abrir. Con el último parte del trabajo ya FIRMADO eso es
// empezar otra visita, y hasta este ticket pasaba sin decir nada: quien entraba a mirar lo de ayer
// se encontraba un parte vacío recién creado.
//
// La regla y el aviso viven AQUÍ, junto a `borradorDeHoy`, para que las dos puertas no puedan
// decidir distinto (es el defecto de SCRUM-366: mismo trabajo, dos respuestas).
//
// Texto aprobado por el orquestador por delegación del fundador (SCRUM-1656 c.21978), en
// SCRUM-1751; ficha en `docs/microcopy/2026-11-17-SCRUM-1751-aviso-visita-nueva.md`. «Cancelar» no
// está aquí: lo pone `jobsModal`, que es quien pinta el pie.
const AVISO_VISITA_NUEVA = Object.freeze({
  titulo: '¿Empezar una visita nueva?',
  cuerpo: 'El último parte de este trabajo ya está firmado. Si sigues, se crea un parte nuevo para otra visita.',
  crear: 'Crear parte nuevo',
});

/**
 * ¿Hay que preguntar antes de crear? Sólo si el ÚLTIMO parte del trabajo está `firmado` y no hay
 * NINGÚN `borrador`. Con un borrador —de hoy o de otro día— cada puerta hace lo que ya hacía; sin
 * ningún parte, es la primera visita y no hay nada que confundir.
 *
 * `partes` son los de UN trabajo y llegan ordenados por fecha DESC (los ordena el servidor): el
 * primero es el último.
 */
function pideAvisoDeVisitaNueva(partes) {
  const suyos = Array.isArray(partes) ? partes.filter(Boolean) : [];
  if (!suyos.length) return false;
  if (suyos.some((p) => p.estado === 'borrador')) return false;
  return suyos[0].estado === 'firmado';
}

/**
 * Pinta el aviso en el modal de la casa (`jobsModal`, jobAgendar.js) y llama a `alCrear` SÓLO si
 * se pulsa «Crear parte nuevo». Cancelar —con el botón, con Escape o pulsando fuera— no hace nada
 * más que cerrar, así que este código no tiene que enterarse de CÓMO se cierra el modal.
 *
 * Sin `jobsModal` LANZA: quien llama enseña su aviso de fallo y no se crea nada sin preguntar.
 */
function avisarDeVisitaNueva(alCrear) {
  if (typeof window.jobsModal !== 'function') throw new Error('sin_modal_de_trabajos');
  const cuerpo = document.createElement('div');
  cuerpo.className = 'jobs-modal-cuerpo';
  const frase = document.createElement('p');
  frase.className = 'jobs-modal-vacio';
  frase.textContent = AVISO_VISITA_NUEVA.cuerpo;
  cuerpo.appendChild(frase);
  let crear = null;
  window.jobsModal(AVISO_VISITA_NUEVA.titulo, cuerpo, (pie, cerrar) => {
    crear = document.createElement('button');
    crear.className = 'btn-primary btn-sm';
    crear.setAttribute('data-crear-parte-nuevo', '1');
    crear.textContent = AVISO_VISITA_NUEVA.crear;
    // Se cierra ANTES de crear, como «Agendar»: con el aviso fuera no cabe un segundo clic.
    crear.addEventListener('click', () => { cerrar(); alCrear(); });
    pie.appendChild(crear);
  });
  // El foco entra en el diálogo: quien va con teclado no se queda detrás del velo.
  setTimeout(() => { if (crear && typeof crear.focus === 'function') crear.focus(); }, 0);
}

if (typeof window !== 'undefined') {
  window.borradorDeHoy = borradorDeHoy;
  window.pideAvisoDeVisitaNueva = pideAvisoDeVisitaNueva;
  window.avisarDeVisitaNueva = avisarDeVisitaNueva;
  window.tipoDeFactura = tipoDeFactura;
  window.repartirDocumentos = repartirDocumentos;
  window.DESTINO_POR_TIPO = DESTINO_POR_TIPO;
  window.DESTINOS_DOCUMENTO = DESTINOS_DOCUMENTO;
  window.SECCIONES_CUERPO = SECCIONES_CUERPO;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { borradorDeHoy, pideAvisoDeVisitaNueva, avisarDeVisitaNueva, AVISO_VISITA_NUEVA, tipoDeFactura, repartirDocumentos, clavesRepartidas, DESTINO_POR_TIPO, DESTINOS_DOCUMENTO, SECCIONES_CUERPO };
}
