// public/dashboard/js/jobAsignados.js — SCRUM-650 (T1) · LA PANTALLA DE ASIGNAR A VARIOS
//
// EN EL PARTE DE PAPEL DE TECNOSEL, EL CAMPO «TÉCNICO» DICE: «Israel, Miguel y Jesús.L».
//
// Tres nombres en la misma línea. El motor (`asignacionDeTrabajo.ts`), la tabla (`job_assignees`)
// y el filtro de los tres ejes ya existen y están en producción; lo que faltaba era el sitio donde
// el jefe los mete sin tener que elegir a uno y apañarse.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 DOS CAMPOS QUE NO SE MEZCLAN, y es lo que más fácil se rompe
//
//   `assignedUserId` / `job_assignees` — quién EJECUTA el trabajo (SCRUM-10). **Esto.**
//   `operarioId`                       — AUTORÍA, congelada al aceptar el presupuesto (SCRUM-52).
//
// Son dos ideas distintas y el esquema las declara aparte. El rail pinta la autoría bajo el rótulo
// RESPONSABLE y NO es lo mismo que esto: un presupuesto lo redacta uno y lo ejecutan tres. Este
// módulo no nombra `operarioId` en ninguna parte, y hay un test que lo comprueba sobre el fichero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES UN MÓDULO Y NO CÓDIGO DENTRO DE LA VISTA
//
// Metido en `jobDetailView.js`, la única forma de probar «quitar a uno deja de enseñarle el
// trabajo» sería montar un navegador, y ese test acaba siendo uno que nadie ejecuta. Aquí las
// piezas son funciones que devuelven datos o nodos, y su test las CORRE con un DOM de juguete —
// el mismo patrón de SCRUM-229/500/655.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ MICROCOPY SIN APROBAR (regla 30) · el marcador se ve EN PANTALLA a propósito
//
// El mecanismo NO EXISTE SIN TEXTO: un selector sin rótulos no se puede usar. Mismo caso que
// `jobNuevoModal.js` en el censo de SCRUM-402. Los CINCO textos salen de UNA sola constante,
// así que el día que el fundador los firme se apagan de golpe y la entrada del censo se BORRA.
var MARCA_ASIGNADOS = '[PENDIENTE microcopy oficial]';

var TEXTOS_ASIGNADOS = {
  titulo: MARCA_ASIGNADOS + ' Quién ejecuta este trabajo',
  vacio: MARCA_ASIGNADOS + ' Todavía no lo ejecuta nadie',
  soloAdmin: MARCA_ASIGNADOS + ' Solo un administrador puede cambiar quién ejecuta',
  sinEquipo: MARCA_ASIGNADOS + ' Todavía no hay empleados a los que asignar',
  noSeGuardo: MARCA_ASIGNADOS + ' No se ha podido guardar quién ejecuta este trabajo',
};

/**
 * El equipo llegó vacío. NO es «este negocio no tiene empleados»: todo merchant tiene al menos su
 * propietario, así que un cero aquí es que no se ha leído nada.
 */
function EquipoCiego(mensaje) {
  var e = new Error(mensaje);
  e.name = 'EquipoCiego';
  return e;
}

/**
 * A QUIÉN SE PUEDE ASIGNAR, del listado de `GET /admin/team`.
 *
 * 🔴 EL SUELO. Un cero aquí no puede pasar por «no hay a quien asignar»: `getTeamOverview`
 * sintetiza SIEMPRE al propietario, así que una lista vacía significa que la petición falló, o
 * devolvió otra cosa, o nadie la esperó. Y con ese cero la pantalla pintaría un selector vacío —
 * el jefe leería «no tengo empleados» de un negocio que tiene tres.
 *
 * 🔴 Y EL PROPIETARIO SE QUEDA FUERA, que no es lo mismo que ceguera. No tiene fila en
 * `team_members` (`getTeamOverview` lo sintetiza con `id: null`), así que asignárselo reventaría
 * la clave ajena de `job_assignees` — el PATCH lo rechaza con `invalid_assignee`. Ofrecerlo sería
 * ofrecer un clic que siempre falla.
 */
function tecnicosAsignables(miembros) {
  if (!Array.isArray(miembros) || miembros.length === 0) {
    throw EquipoCiego(
      'EQUIPO CIEGO · el listado de empleados ha llegado con ' +
      (Array.isArray(miembros) ? '0 miembros' : 'algo que no es una lista') +
      '. Eso NO se puede leer como «este negocio no tiene empleados»: todo merchant tiene al ' +
      'menos su propietario, así que un cero aquí es que no se ha leído nada — la petición a ' +
      '/admin/team falló, o devolvió otra forma, o nadie la esperó. Con este cero el selector se ' +
      'pintaría vacío y el jefe leería «no tengo a quien asignar» de un negocio que sí tiene equipo.'
    );
  }
  return miembros.filter(function (m) {
    if (!m || m.id == null) return false;           // el propietario: no tiene fila que referenciar
    return m.status !== 'inactive' && m.status !== 'removed';
  });
}

/**
 * Los nombres, tal y como se leen en el parte de papel: «Israel, Miguel y Jesús.L».
 *
 * Devuelve cadena vacía si no hay nadie — quien la pinta decide si eso es un hueco o un texto, y
 * así esta función no tiene que saber nada de microcopy.
 */
function nombresDeAsignados(asignados) {
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
function construirSelectorAsignados(doc, opts) {
  var o = opts || {};
  var asignables = tecnicosAsignables(o.miembros);   // el suelo, antes de pintar nada
  var yaAsignados = Array.isArray(o.asignados) ? o.asignados : [];
  var marcados = {};
  yaAsignados.forEach(function (a) { if (a && a.id != null) marcados[a.id] = true; });

  var caja = doc.createElement('div');
  caja.className = 'job-asignados';

  var titulo = doc.createElement('div');
  titulo.className = 'job-asignados-titulo';
  titulo.textContent = TEXTOS_ASIGNADOS.titulo;
  caja.appendChild(titulo);

  // SOLO LECTURA (técnico): ve quién ejecuta, no lo cambia. La norma de SCRUM-89 es que un gate
  // no deje UI huérfana — así que se ve el dato y se dice por qué no se puede tocar, en vez de
  // esconder el bloque o dejar casillas muertas.
  if (!o.puedeEditar) {
    var linea = doc.createElement('div');
    linea.className = 'job-asignados-lectura';
    linea.textContent = nombresDeAsignados(yaAsignados) || TEXTOS_ASIGNADOS.vacio;
    caja.appendChild(linea);
    var nota = doc.createElement('p');
    nota.className = 'job-asignados-nota';
    nota.textContent = TEXTOS_ASIGNADOS.soloAdmin;
    caja.appendChild(nota);
    return { elemento: caja, casillas: [], idsMarcados: function () { return []; }, editable: false };
  }

  // Sin nadie a quien asignar (equipo de una sola persona: solo el propietario). NO es ceguera —
  // `tecnicosAsignables` ya habría parado— y por eso se dice, en vez de pintar una lista vacía.
  if (asignables.length === 0) {
    var vacio = doc.createElement('p');
    vacio.className = 'job-asignados-nota';
    vacio.textContent = TEXTOS_ASIGNADOS.sinEquipo;
    caja.appendChild(vacio);
    return { elemento: caja, casillas: [], idsMarcados: function () { return []; }, editable: true };
  }

  var lista = doc.createElement('div');
  lista.className = 'job-asignados-lista';
  caja.appendChild(lista);

  var casillas = [];
  asignables.forEach(function (m) {
    var fila = doc.createElement('label');
    // El objetivo táctil de 44 px (AB6) vive en la HOJA, no aquí: escrito en los dos sitios son
    // dos fuentes para el mismo número, y se separan en cuanto alguien toca una.
    fila.className = 'job-asignados-fila';

    var casilla = doc.createElement('input');
    casilla.type = 'checkbox';
    casilla.className = 'job-asignados-casilla';
    casilla.checked = marcados[m.id] === true;
    // El id viaja EN LA CASILLA, no en el texto: leerlo del nombre obligaría a volver a buscar a
    // quién pertenece, y dos empleados pueden llamarse igual.
    casilla.value = String(m.id);
    casilla.teamMemberId = m.id;
    if (casilla.setAttribute) casilla.setAttribute('aria-label', String(m.name || m.id));

    var nombre = doc.createElement('span');
    nombre.className = 'job-asignados-nombre';
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
 * 🔴 Aquí es donde se rompería lo de arriba: escribir `operarioId` o `assignedUserId` desde una
 * pantalla que habla de QUIÉN EJECUTA. El backend admite las dos formas —`assignedUserIds` (lista)
 * y `assignedUserId` (uno)— y esta pantalla manda SIEMPRE la lista: es la que puede llevar tres.
 */
function cuerpoDeAsignacion(ids) {
  return { assignedUserIds: (Array.isArray(ids) ? ids : []).slice() };
}

if (typeof window !== 'undefined') {
  window.construirSelectorAsignados = construirSelectorAsignados;
  window.tecnicosAsignables = tecnicosAsignables;
  window.nombresDeAsignados = nombresDeAsignados;
  window.cuerpoDeAsignacion = cuerpoDeAsignacion;
  window.TEXTOS_ASIGNADOS = TEXTOS_ASIGNADOS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    construirSelectorAsignados, tecnicosAsignables, nombresDeAsignados,
    cuerpoDeAsignacion, TEXTOS_ASIGNADOS, MARCA_ASIGNADOS,
  };
}
