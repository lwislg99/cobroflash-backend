// public/dashboard/js/documentoAsignados.js — SCRUM-597 (DOC-07)
//
// ASIGNAR USUARIOS AL DOCUMENTO. Factura y presupuesto, la misma pieza.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ ES Y QUÉ NO ES
//
// Dice QUIÉN LLEVA este documento. **No es un permiso**: no cambia quién puede editarlo ni
// emitirlo —eso lo siguen dando el rol y el `requireRole` de cada ruta— y **no abre la economía**:
// un técnico asignado sigue sin ver coste ni margen, porque eso se decide por ROL en el servidor
// y la asignación no entra en esa pregunta (P-DOC-3, fundador, 7-sep-2026).
//
// ⚠️ NO CONFUNDIR CON EL AUTOR. `Quote.teamMemberId` es quién CREÓ el presupuesto y el panel lo
// pinta como RESPONSABLE; esto es otra cosa. Un documento lo redacta uno y puede estar asignado a
// tres. Este módulo no nombra `teamMemberId` en ninguna parte, igual que `jobAsignados.js` no
// nombra `operarioId`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ES UN MÓDULO Y NO CÓDIGO DENTRO DE LAS DOS VISTAS
//
// Metido en `quotesDetailView.js` y en `invoiceDetailView.js` serían DOS copias de la misma
// pantalla, y se separarían en cuanto alguien tocara una. Aquí las piezas son funciones que
// devuelven datos o nodos, y su test las CORRE con un DOM de juguete — el mismo patrón de
// `jobAsignados.js` (SCRUM-650) y de SCRUM-229/500/655.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ MICROCOPY SIN APROBAR (regla 30) · el marcador se ve EN PANTALLA a propósito
//
// El mecanismo NO EXISTE SIN TEXTO: un selector sin rótulos no se puede usar — quien lo abre no
// sabría si está marcando a quien lo lleva, a quien lo redactó o a quien cobra, que son tres cosas
// distintas en esta pantalla. Mismo caso y mismo trato que `jobAsignados.js`.
//
// Los CINCO textos salen de UNA sola constante, así que el día que el fundador los firme se
// apagan de golpe y la entrada del censo se BORRA (no se pone a 0: SCRUM-424 / SCRUM-405).
// `DOC_ASIGNADOS_SIN_APROBAR` dice cuántos son de verdad, que es lo que el «1» del censo de
// SCRUM-402 —que cuenta marcas ESCRITAS, no superficies pintadas— no puede decir.
var MARCA_DOC_ASIGNADOS = '[PENDIENTE microcopy oficial]';

/** Cuántas ranuras sin firmar hay de verdad — el 1 del censo no lo puede decir. */
var DOC_ASIGNADOS_SIN_APROBAR = 5;

var TEXTOS_DOC_ASIGNADOS = {
  titulo: MARCA_DOC_ASIGNADOS + ' quién lleva este documento',
  vacio: MARCA_DOC_ASIGNADOS + ' no lo lleva nadie',
  soloAdmin: MARCA_DOC_ASIGNADOS + ' solo un administrador puede cambiar quién lleva este documento',
  sinEquipo: MARCA_DOC_ASIGNADOS + ' todavía no has dado de alta a nadie en tu equipo',
  noSeGuardo: MARCA_DOC_ASIGNADOS + ' no se ha podido guardar quién lleva este documento',
};

/**
 * El equipo llegó vacío. NO es «este negocio no tiene empleados»: todo merchant tiene al menos su
 * propietario, así que un cero aquí es que no se ha leído nada.
 */
function EquipoCiegoDoc(mensaje) {
  var e = new Error(mensaje);
  e.name = 'EquipoCiego';
  return e;
}

/**
 * A QUIÉN SE PUEDE ASIGNAR, del listado de `GET /admin/team`.
 *
 * 🔴 EL SUELO. Un cero aquí no puede pasar por «no hay a quien asignar»: `getTeamOverview`
 * sintetiza SIEMPRE al propietario, así que una lista vacía significa que la petición falló, o
 * devolvió otra cosa, o nadie la esperó. Con ese cero la pantalla pintaría un selector vacío y el
 * jefe leería «no tengo a quien asignar» de un negocio que sí tiene equipo.
 *
 * 🔴 Y EL PROPIETARIO SE QUEDA FUERA, que no es lo mismo que ceguera. No tiene fila en
 * `team_members` (`getTeamOverview` lo sintetiza con `id: null`), así que asignárselo reventaría
 * la clave ajena de `quote_assignees` — el PATCH lo rechaza con `invalid_assignee`. Ofrecerlo
 * sería ofrecer un clic que siempre falla.
 */
function asignablesDelDocumento(miembros) {
  if (!Array.isArray(miembros) || miembros.length === 0) {
    throw EquipoCiegoDoc(
      'EQUIPO CIEGO · el listado de empleados ha llegado con '
      + (Array.isArray(miembros) ? '0 miembros' : 'algo que no es una lista')
      + '. Eso NO se puede leer como «este negocio no tiene empleados»: todo merchant tiene al '
      + 'menos su propietario, así que un cero aquí es que no se ha leído nada — la petición a '
      + '/admin/team falló, o devolvió otra forma, o nadie la esperó.'
    );
  }
  return miembros.filter(function (m) {
    if (!m || m.id == null) return false;           // el propietario: no tiene fila que referenciar
    return m.status !== 'inactive' && m.status !== 'removed';
  });
}

/**
 * Los nombres, como se leen de corrido: «Israel, Miguel y Jesús.L».
 *
 * Devuelve cadena vacía si no hay nadie — quien la pinta decide si eso es un hueco o un texto, y
 * así esta función no tiene que saber nada de microcopy.
 */
function nombresDeAsignadosDoc(asignados) {
  var nombres = (Array.isArray(asignados) ? asignados : [])
    .map(function (a) { return a && a.name ? String(a.name).trim() : ''; })
    .filter(Boolean);
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

/**
 * EL SELECTOR. Devuelve el nodo y una forma de leer lo marcado SIN volver a buscar en el DOM:
 * `idsMarcados()` cierra sobre las casillas que esta misma función creó, así que no hay dos
 * criterios (uno para pintar y otro para leer) que puedan separarse.
 *
 * @param doc  `document` (o el de juguete del test)
 * @param opts { miembros, asignados, puedeEditar }
 */
function construirAsignadosDeDocumento(doc, opts) {
  var o = opts || {};
  var asignables = asignablesDelDocumento(o.miembros);   // el suelo, antes de pintar nada
  var yaAsignados = Array.isArray(o.asignados) ? o.asignados : [];
  var marcados = {};
  yaAsignados.forEach(function (a) { if (a && a.id != null) marcados[a.id] = true; });

  var caja = doc.createElement('div');
  caja.className = 'doc-asignados';

  var titulo = doc.createElement('div');
  titulo.className = 'doc-asignados-titulo';
  titulo.textContent = TEXTOS_DOC_ASIGNADOS.titulo;
  caja.appendChild(titulo);

  // SOLO LECTURA (técnico): ve quién lo lleva, no lo cambia. La norma de SCRUM-89 es que un gate
  // no deje UI huérfana — así que se ve el dato y se dice por qué no se puede tocar, en vez de
  // esconder el bloque o dejar casillas muertas.
  if (!o.puedeEditar) {
    var linea = doc.createElement('div');
    linea.className = 'doc-asignados-lectura';
    linea.textContent = nombresDeAsignadosDoc(yaAsignados) || TEXTOS_DOC_ASIGNADOS.vacio;
    caja.appendChild(linea);
    var nota = doc.createElement('p');
    nota.className = 'doc-asignados-nota';
    nota.textContent = TEXTOS_DOC_ASIGNADOS.soloAdmin;
    caja.appendChild(nota);
    return { elemento: caja, casillas: [], idsMarcados: function () { return []; }, editable: false };
  }

  // Sin nadie a quien asignar (equipo de una sola persona: sólo el propietario). NO es ceguera
  // —`asignablesDelDocumento` ya habría parado— y por eso se dice, en vez de pintar una lista vacía.
  if (asignables.length === 0) {
    var vacio = doc.createElement('p');
    vacio.className = 'doc-asignados-nota';
    vacio.textContent = TEXTOS_DOC_ASIGNADOS.sinEquipo;
    caja.appendChild(vacio);
    return { elemento: caja, casillas: [], idsMarcados: function () { return []; }, editable: true };
  }

  var lista = doc.createElement('div');
  lista.className = 'doc-asignados-lista';
  caja.appendChild(lista);

  var casillas = [];
  asignables.forEach(function (m) {
    var fila = doc.createElement('label');
    // El objetivo táctil de 44 px (AB6) vive en la HOJA, no aquí: escrito en los dos sitios son
    // dos fuentes para el mismo número, y se separan en cuanto alguien toca una.
    fila.className = 'doc-asignados-fila';

    var casilla = doc.createElement('input');
    casilla.type = 'checkbox';
    casilla.className = 'doc-asignados-casilla';
    casilla.checked = marcados[m.id] === true;
    // El id viaja EN LA CASILLA, no en el texto: leerlo del nombre obligaría a volver a buscar a
    // quién pertenece, y dos empleados pueden llamarse igual.
    casilla.value = String(m.id);
    casilla.teamMemberId = m.id;
    if (casilla.setAttribute) casilla.setAttribute('aria-label', String(m.name || m.id));

    var nombre = doc.createElement('span');
    nombre.className = 'doc-asignados-nombre';
    nombre.textContent = String(m.name || m.id);

    fila.appendChild(casilla);
    fila.appendChild(nombre);
    lista.appendChild(fila);
    casillas.push(casilla);
  });

  return {
    elemento: caja,
    casillas: casillas,
    editable: true,
    idsMarcados: function () {
      return casillas
        .filter(function (c) { return c.checked === true; })
        .map(function (c) { return c.teamMemberId; });
    },
  };
}

/**
 * EL CUERPO DEL PATCH, y no lo arma la vista.
 *
 * Es la MISMA forma que ya manda el selector de los trabajos (`cuerpoDeAsignacion`), y se repite
 * a propósito: el servidor acepta una sola forma —`assignedUserIds`— para los tres sitios.
 */
function cuerpoDeAsignacionDeDocumento(ids) {
  return { assignedUserIds: (Array.isArray(ids) ? ids : []).slice() };
}

/** La ruta del PATCH según el documento. Lista CERRADA: aquí no se inventa un tercero. */
function rutaDeAsignacion(documento, id) {
  if (documento === 'quote') return '/admin/quotes/' + id + '/asignados';
  if (documento === 'invoice') return '/admin/invoices/' + id + '/asignados';
  throw new Error('documento no asignable: ' + String(documento));
}

/**
 * EL CABLEADO ENTERO, para que las dos vistas no lleven una copia cada una.
 *
 * Recibe `pedir` (el `apiRequest` de la vista) y `avisar` (su `setStatus`) en vez de tomarlos del
 * global: así esta función se puede EJECUTAR en el test con un DOM de juguete y sin red, que es
 * la razón de que este módulo exista.
 *
 * @param opts { doc, documentoId, contenedor, asignados, puedeEditar, miembrosDeRespaldo,
 *               pedir, avisar, alGuardar }
 */
async function cablearAsignadosDeDocumento(doc, opts) {
  var o = opts || {};
  try {
    // Al técnico se le pinta en SOLO LECTURA con los nombres que YA trae el detalle: pedirle
    // `/admin/team` sería un 403 garantizado (va con `requireRole('admin')`) y dejaría el bloque
    // sin pintar. Es la norma de SCRUM-89 — un gate no deja UI huérfana.
    var miembros = o.puedeEditar
      ? await o.pedir('/admin/team')
      : (o.asignados || []).map(function (a) { return { id: a.id, name: a.name }; });

    // 🔴 Con el equipo vacío, `construirAsignadosDeDocumento` LANZA en vez de pintar un selector
    // sin nadie: un cero ahí es «no supe leer», no «no hay empleados». Cae en el catch de abajo.
    var sel = construirAsignadosDeDocumento(doc, {
      miembros: miembros,
      asignados: o.asignados || [],
      puedeEditar: o.puedeEditar,
    });
    o.contenedor.appendChild(sel.elemento);

    sel.casillas.forEach(function (casilla) {
      casilla.addEventListener('change', async function () {
        var antes = sel.casillas.map(function (c) { return c.checked; });
        try {
          await o.pedir(rutaDeAsignacion(o.doc, o.documentoId), {
            method: 'PATCH',
            body: JSON.stringify(cuerpoDeAsignacionDeDocumento(sel.idsMarcados())),
          });
          if (o.alGuardar) o.alGuardar();
        } catch (e) {
          // Se deshace la casilla: dejarla marcada diría que se guardó, y no se guardó.
          sel.casillas.forEach(function (c, i) { c.checked = antes[i]; });
          // 🔴 NO se pinta el `.message` del servidor (SCRUM-644): un `invalid_assignee` en
          // pantalla es una tubería interna asomando. El texto es de la pantalla y va marcado.
          if (o.avisar) o.avisar('error', TEXTOS_DOC_ASIGNADOS.noSeGuardo);
        }
      });
    });
    return sel;
  } catch (e) {
    // Incluye el EquipoCiego: se dice que no se pudo leer, en vez de pintar un selector vacío que
    // el jefe leería como «no tengo a quien asignar».
    if (typeof console !== 'undefined') console.error('[SCRUM-597] asignados del documento:', (e && e.message) || e);
    if (o.contenedor && o.contenedor.remove) o.contenedor.remove();
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.cablearAsignadosDeDocumento = cablearAsignadosDeDocumento;
  window.construirAsignadosDeDocumento = construirAsignadosDeDocumento;
  window.asignablesDelDocumento = asignablesDelDocumento;
  window.nombresDeAsignadosDoc = nombresDeAsignadosDoc;
  window.cuerpoDeAsignacionDeDocumento = cuerpoDeAsignacionDeDocumento;
  window.rutaDeAsignacion = rutaDeAsignacion;
  window.TEXTOS_DOC_ASIGNADOS = TEXTOS_DOC_ASIGNADOS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    construirAsignadosDeDocumento, cablearAsignadosDeDocumento, asignablesDelDocumento, nombresDeAsignadosDoc,
    cuerpoDeAsignacionDeDocumento, rutaDeAsignacion,
    TEXTOS_DOC_ASIGNADOS, MARCA_DOC_ASIGNADOS, DOC_ASIGNADOS_SIN_APROBAR,
  };
}
