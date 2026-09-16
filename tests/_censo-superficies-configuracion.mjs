// tests/_censo-superficies-configuracion.mjs — SCRUM-284: la SEGUNDA población de Configuración.
//
// ── POR QUÉ HAY UNA SEGUNDA POBLACIÓN ─────────────────────────────────────────
// El censo de campos (`_censo-configuracion.mjs`) midió 25 ajustes y no estaba mal — medía
// CAMPOS. Pero la pantalla también tiene BLOQUES QUE NO SON CAMPOS: un checklist de estado, un
// contador de consumo, la tarjeta de la página pública, la de referidos. Un mapa de submenús
// construido solo sobre los campos las deja SIN SITIO, que es el mismo fallo mudo con otra cara.
//
// Es la segunda vez que un censo derivado mío se queda corto: la primera por una FORMA
// (`createToggle`), esta por una POBLACIÓN ENTERA. Las dos las destapó el contraste humano.
//
// ── EL CRITERIO, DECLARADO — y por qué NO puede ser «tiene id» ────────────────
// **Una SUPERFICIE es una función `render…(container)` que pinta un bloque con TÍTULO PROPIO.**
//
// Se deriva de dos hechos estructurales que van juntos, y hacen falta los dos:
//   1. recibe un CONTENEDOR y pinta dentro de él (es un bloque, no un control suelto);
//   2. su marcado abre un `<h2>` (tiene título propio, o sea que el usuario la ve como «una cosa»).
//
// ⚠️ EL CRITERIO NO PUEDE SER «TIENE id», y el caso que lo prueba está medido: el contador de
// WhatsApp (`renderWaFairUseCard`, título «WhatsApp este mes») **no tiene NINGÚN id**. Un censo
// por identificadores lo perdería entero — justo la superficie que destapó que faltaba una
// población.
//
// Y tampoco puede ser «toda función render…»: `renderProfileQrButton(card, m)` recibe una TARJETA
// ya pintada, no un contenedor, y no abre título. Es un control DENTRO de una superficie, no una
// superficie. La distinción la da el primer parámetro más el título, no el nombre.
import ts from 'typescript';

function recorrer(nodo, fn) { fn(nodo); nodo.forEachChild((h) => recorrer(h, fn)); }

/** Texto plano de una plantilla, para buscar el `<h2>` del bloque. */
function textoDePlantillas(nodo) {
  let out = '';
  recorrer(nodo, (n) => {
    if (ts.isNoSubstitutionTemplateLiteral(n)) out += n.text;
    else if (ts.isTemplateExpression(n)) {
      out += n.head.text + n.templateSpans.map((s) => s.literal.text).join(' ');
    } else if (ts.isStringLiteral(n)) out += n.text;
  });
  return out;
}

/** @returns {{superficies:Array, funcionesRender:number}} */
export function censarSuperficies(fuente, ruta = 'settingsView.js') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const superficies = [];
  let funcionesRender = 0;

  recorrer(sf, (n) => {
    if (!ts.isFunctionDeclaration(n) || !n.name || !n.body) return;
    const nombre = n.name.text;
    if (!/^render/.test(nombre)) return;
    funcionesRender++;

    // (1) recibe un CONTENEDOR como primer parámetro
    const p0 = n.parameters[0];
    const primerParam = p0 && ts.isIdentifier(p0.name) ? p0.name.text : '';
    if (!/^container$/i.test(primerParam)) return;

    // (2) pinta un bloque con TÍTULO PROPIO
    const marcado = textoDePlantillas(n.body);
    const titulo = marcado.match(/<h2[^>]*>([^<]{3,60})/);
    if (!titulo) return;

    superficies.push({
      clave: nombre,
      titulo: titulo[1].trim(),
      linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
    });
  });

  superficies.sort((a, b) => a.linea - b.linea);
  return { superficies, funcionesRender };
}

/**
 * DÓNDE VAN — propuesta del asesor, NO decisión tomada.
 *
 * La regla del fundador («si no persiste, no es Configuración») resuelve dónde NO van, no dónde
 * SÍ. Y las cuatro viven hoy en Configuración sin otra pantalla donde ir.
 *
 * Van como PENDIENTES DECLARADAS y no como rojo: un guard que vive en rojo esperando una
 * decisión es un guard que alguien desactiva. Mismo patrón que los huérfanos de campos.
 */
export const SUPERFICIES_PENDIENTES = {
  renderPublicProfileCard:
    'PROPUESTA: «Tu página pública» — cae sola, y con ella los qr-* (formato/tamaño/oscuro) y el ' +
    'botón de descarga, que son controles DE esta superficie, no ajustes sueltos.',
  renderReadinessCard:
    'A DECIDIR: checklist «Tu cuenta, lista para cobrar». Es estado transversal (toca cobros, ' +
    'WhatsApp, datos fiscales), así que no cae solo en ningún submenú. Contiene además el estado ' +
    'de Connect, que por sí solo iría a Cobros.',
  renderWaFairUseCard:
    'A DECIDIR: contador «WhatsApp este mes». Informativo, no persiste — por la regla del ' +
    'fundador no es Configuración, pero hoy no tiene otra pantalla donde vivir.',
  renderReferralCard:
    'PENDIENTE MAYOR: «Invita y gana» no es un ajuste, es un canal de crecimiento. La decisión de ' +
    'sacarlo a la barra lateral es del fundador. Ya está escrito como tarjeta con render propio ' +
    'sobre un contenedor, así que moverlo es cambiar dónde se la llama, NO rehacerla.',
};

/**
 * ¿Alguna superficie se ha quedado sin sitio?
 *
 * 🔴 SCRUM-420 · «TENER SITIO» SON DOS COSAS, Y ESTA FUNCIÓN SOLO MIRABA UNA. Contaba como
 * colocada la superficie que estuviera en `SUPERFICIES_PENDIENTES`, o sea la que tiene una
 * PROPUESTA escrita. Funcionaba porque las cuatro que había estaban las cuatro sin decidir.
 *
 * La primera superficie DECIDIDA lo rompe: `renderDescargarDatosCard` está asignada a `datos` en
 * el mapa que usa la pantalla, y aun así salía «sin sitio». El guard le habría pedido que se
 * declarase pendiente **una superficie que ya está colocada** — o sea, ponerle una propuesta a algo
 * decidido, que es escribir una duda que nadie tiene.
 *
 * Ahora tiene sitio quien esté **asignada** (decidida, en `ASIGNACION_SUPERFICIE`) **o**
 * **pendiente** (con su propuesta). Y sigue sin tenerlo quien no esté en ninguna de las dos, que
 * es lo que el guard existe para cazar. No se relaja: se le enseña la otra mitad de la pregunta.
 *
 * @param claves     las superficies censadas de la vista
 * @param asignadas  el mapa `ASIGNACION_SUPERFICIE` de `settingsSubmenus.js` (las decididas)
 */
export function revisarSuperficies(claves, asignadas = {}) {
  return {
    sinSitio: claves.filter((c) => !(c in SUPERFICIES_PENDIENTES) && !(c in asignadas)),
    pendientes: claves.filter((c) => c in SUPERFICIES_PENDIENTES).length,
    decididas: claves.filter((c) => c in asignadas).length,
  };
}
