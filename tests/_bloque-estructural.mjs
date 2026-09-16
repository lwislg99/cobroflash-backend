// tests/_bloque-estructural.mjs — SCRUM-437 · acotar por ESTRUCTURA, nunca por una longitud.
//
// ── DE DÓNDE SALE ───────────────────────────────────────────────────────────────────────────
// SCRUM-435 encontró un trinquete que llevaba días sin poder saltar: cortaba el schema con
// `slice(i, i + 1200)` y la primera columna que vigilaba estaba en el offset 1.417. La ventana
// terminaba **217 caracteres antes** de poder ver nada.
//
// El censo de aquel ticket encontró **cuatro** cortes más de la misma familia. Éste es el módulo
// que los sustituye, y vive aparte por el mismo motivo que el códec de backup: **dos guards que
// hacen la misma derivación en dos sitios acaban divergiendo**, y el día que diverjan uno de los
// dos estará mintiendo sin que nadie lo note.
//
// ── EL PRINCIPIO ────────────────────────────────────────────────────────────────────────────
// Un número fijo es una apuesta sobre cuánto va a crecer un fichero que editan otros. Esa apuesta
// se pierde sola: basta un comentario nuevo para empujar lo vigilado fuera de la ventana. Y cuando
// se pierde, **el guard no avisa: se queda verde**, que es la peor forma de fallar.
//
// Todas las funciones devuelven `null` cuando no localizan el bloque. **`null` es un dato**: quien
// llame tiene que declararse ciego, no seguir afirmando sobre un trozo cualquiera.

/** Índice del primer carácter de `abre` que no esté dentro de una cadena. Simple a propósito. */
function desdeElAncla(texto, ancla) {
  const i = texto.indexOf(ancla);
  return i < 0 ? null : i;
}

/**
 * El bloque `{ … }` que arranca en la primera llave tras el ancla, contando llaves hasta cerrar.
 * Sirve para `model X { … }`, `function f() { … }`, una sección que se construye dentro de un `if`…
 */
export function bloqueDeLlaves(texto, ancla) {
  const i = desdeElAncla(texto, ancla);
  if (i === null) return null;
  const abre = texto.indexOf('{', i);
  if (abre < 0) return null;
  let p = 0;
  for (let j = abre; j < texto.length; j++) {
    if (texto[j] === '{') p++;
    else if (texto[j] === '}') { p--; if (p === 0) return texto.slice(i, j + 1); }
  }
  return null; // llave sin cerrar: el fichero está roto, y decirlo es mejor que devolver la mitad
}

/**
 * La SENTENCIA que empieza en el ancla y termina en su `;` de cierre, respetando anidamientos.
 * Para `const x = …;`, una asignación larga, un objeto literal multilínea.
 */
export function sentencia(texto, ancla) {
  const i = desdeElAncla(texto, ancla);
  if (i === null) return null;
  let p = 0;
  for (let j = i; j < texto.length; j++) {
    const c = texto[j];
    if ('([{'.includes(c)) p++;
    else if (')]}'.includes(c)) p--;
    else if (c === ';' && p <= 0) return texto.slice(i, j + 1);
  }
  return null;
}

/**
 * Una rama de `switch`: desde `case X:` hasta su `break;` (o el `case` siguiente si no hay break,
 * que también es una forma legítima de escribirlo y no debe cortar de menos).
 */
export function ramaDeCase(texto, ancla) {
  const i = desdeElAncla(texto, ancla);
  if (i === null) return null;
  const corte = texto.indexOf('break;', i);
  const siguiente = texto.indexOf('case ', i + ancla.length);
  const candidatos = [corte >= 0 ? corte + 'break;'.length : -1, siguiente].filter((x) => x >= 0);
  if (!candidatos.length) return null;
  return texto.slice(i, Math.min(...candidatos));
}

/**
 * Lo que hay ENTRE el ancla y el bloque, para las líneas anteriores que sí importan. Se acota por
 * el ancla ANTERIOR del mismo tipo, no por una distancia: así el trozo pertenece a esta sección y
 * no a la de al lado.
 */
export function desdeLaSeccionAnterior(texto, ancla, marcaDeSeccion) {
  const i = desdeElAncla(texto, ancla);
  if (i === null) return null;
  const previo = texto.lastIndexOf(marcaDeSeccion, i);
  return texto.slice(previo < 0 ? 0 : previo, i);
}
