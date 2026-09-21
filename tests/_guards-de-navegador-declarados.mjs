// tests/_guards-de-navegador-declarados.mjs — SCRUM-970
//
// LOS GUARDS DE NAVEGADOR QUE HOY QUEDAN FUERA DE `npm test`, DECLARADOS POR NOMBRE.
//
// ── POR QUÉ ESTE FICHERO EXISTE, y no es orden: es un mecanismo ───────────────────────────────
// Hasta el 20-sep-2026 el número de estos guards se escribía A MANO en
// `scrum522-guards-fuera-de-la-tanda.test.mjs`, dentro de un `assert.equal(fuera.length, 30)`, con
// los motivos de cada uno en comentarios justo encima. Esa forma colisionó **OCHO veces en cuatro
// días** (27, 28, 29, 30 y 31), y siempre igual:
//
//   · dos ramas añaden un guard cada una y las dos escriben el MISMO número nuevo;
//   · git marca conflicto en los COMENTARIOS, que son distintos → alguien lo ve y los suma;
//   · pero la línea del número es IDÉNTICA en las dos ramas, así que git la auto-mezcla **sin
//     conflicto** y el fichero queda mintiendo por uno.
//
//       🔒 El conflicto que sí ves te tapa el que no.
//
// Medido el 20-sep-2026 con un merge de tres vías de verdad (`git merge-file`) sobre el fichero
// real: partiendo de 30, dos ramas que añaden un guard cada una dejan **31 donde la verdad son 32**,
// y encima con marca de conflicto al lado. No es mala suerte ni descuido de las sesiones: se lo
// dijimos a todas y cayeron ocho. **Cuando un aviso hay que repetirlo ocho veces, el problema no
// son las sesiones: es que la cifra se puede escribir a mano.**
//
// ── LA FORMA, Y SUS DOS PROPIEDADES ───────────────────────────────────────────────────────────
// 1. **La cifra NO se escribe: se deriva** de esta lista (`DECLARADOS.length`). No queda ningún
//    número que pueda entrar mal por su cuenta.
// 2. **Un guard por línea, y los nuevos AL FINAL.** Dos ramas que añaden uno cada una escriben
//    líneas DISTINTAS en el MISMO sitio, así que git da conflicto de verdad — y la resolución es
//    la de siempre y la única correcta: **se quedan las dos, no se elige lado y no se calcula
//    nada.** Es la norma de la casa («un elemento por línea») aplicada donde más ha costado.
//
// ⚠️ ESTO NO RELAJA EL TRINQUETE: lo endurece. Antes decía «han cambiado de 30 a 31»; ahora dice
//    QUÉ guard sobra o falta por su nombre. Un guard nuevo que nadie declare aquí sigue tumbando
//    el test, que es para lo que existe.
//
// ⚠️ Y NO SE TOCA PARA QUE PASE. Si esta lista y la realidad discrepan, el árbol tiene razón: se
//    mira QUÉ guard ha aparecido o desaparecido y por qué, y sólo después se escribe aquí. Ajustar
//    la lista a lo que uno esperaba es exactamente el fallo que este fichero viene a impedir.
//
// Los MOTIVOS de cada guard —por qué no cabe en la tanda— siguen donde estaban, en los comentarios
// de `scrum522-guards-fuera-de-la-tanda.test.mjs`. Aquí sólo viven los nombres: un fichero que
// duplicara la prosa sería otra copia que mantener, y otra cosa que puede divergir.

export const DECLARADOS = [
  'guard:contraste',
  'guard:caja-avisos',
  'guard:caja-semaforo',
  'guard:caja-documento-suelto',
  'guard:portal-en-la-ficha',
  'guard:caja-datos-del-cliente',
  'guard:cls-barra-anuncio',
  'guard:primera-pantalla',
  'guard:vias-de-cobro',
  'guard:arranque-sin-red',
  'guard:descuento-redibuja',
  'guard:descuentos-en-el-detalle',
  'guard:rotulos-de-la-linea',
  'guard:pasos-del-editor',
  'guard:firma-con-tramos',
  'guard:falta-en-otra-pestana',
  'guard:foto-del-gasto',
  'guard:completar-lleva-al-campo',
  'guard:aviso-bizum',
  'guard:a11y-comparativa',
  'guard:a11y-landing',
  'guard:objetivo-tactil',
  'guard:lista-trabajos',
  'guard:lista-trabajos-917',
  'guard:escalera-por-estado',
  'guard:albaranes-con-acciones',
  'guard:nif-del-gasto',
  'guard:duplicar-conserva',
  'guard:rastro-del-menu',
  'guard:marcadores-en-pantalla',
  'guard:un-solo-presupuesto',
  'guard:documento-vivo',
  'guard:detalle-trabajo-917',
  // 👆 EL TUYO VA AQUÍ, EN SU PROPIA LÍNEA, Y NO SE TOCA NINGUNA DE LAS DE ARRIBA.
  //    Si al mergear sale conflicto en esta línea es que otra rama añadió el suyo a la vez:
  //    se quedan LOS DOS. Es el conflicto que se buscaba, no un problema.
];

/** Lo que sobra y lo que falta respecto a lo declarado. Pura: la realidad llega por argumento. */
export function diferencias(reales, declarados = DECLARADOS) {
  const dec = new Set(declarados);
  const real = new Set(reales);
  return {
    sinDeclarar: reales.filter((g) => !dec.has(g)),
    declaradosQueYaNoEstan: declarados.filter((g) => !real.has(g)),
  };
}
