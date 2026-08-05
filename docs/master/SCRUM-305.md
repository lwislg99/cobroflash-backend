# SCRUM-305 · C6 — «Quedan 3»: el eje de ENTREGA, y las tres veces que decide no contestar

**Fecha:** 5-ago-2026 · **Carril:** A (producto) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `425301c8ddc79ad20e8605b49194f608ecdf339c` · 2026-08-05T22:27:24+01:00

**Tanda:** 1793 tests, 1726 pass, 0 fail, 67 skipped (los 67 son los gateados de staging)

## Lo que se midió antes de construir (y una premisa que cayó)

La medición previa contestó las cuatro preguntas del asesor:

1. **Sí hay enlace** línea↔línea: `AlbaranLinea.quoteLineIndex`, que trajo **SCRUM-367**. El
   registro de C2 decía que no lo había y su test seguía verde, porque **mide otro sitio** (el
   modelo `AlbaranLineaFacturada` del schema): el test no miente sobre lo que mira, la frase de su
   cabecera generaliza desde otro sitio. La corrección la lleva S1 en su rama.
2. **Las unidades no son comparables**: la línea de presupuesto (`{concept, qty, price, tax}`) no
   tiene campo de unidad; la del albarán la exige, el prellenado mete `'ud'` y es editable.
3. **Un Trabajo puede tener varios presupuestos** (`Quote.jobId`, SCRUM-195), y `Job.quoteId @unique`
   sigue vivo: los dos sentidos conviven.
4. **El adicional se puede crear pero nada lo dispara** desde una línea añadida en obra, y **nada
   calculaba «quedan»**: lo único parecido era `pendientePorLinea`, que es el eje de FACTURACIÓN.

## Las tres decisiones del asesor, y cómo quedan en código

### ① Contra el ORIGINAL — y con adicionales, NO SALE NÚMERO

`quoteLineIndex` significa hoy «índice en el presupuesto original»: así lo valida
`contarLineasDePresupuesto` y así lo escribe el prellenado. Es coherente **por el camino, no por el
dato** — el índice no dice de qué presupuesto es.

Por eso un Trabajo con adicionales devuelve `calculable: false` con motivo `hay_adicionales`, y es
**la primera puerta**: da igual lo bien que cuadre todo lo demás. Un «quedan 3» calculado solo
contra el original sería falso **en la dirección peligrosa** —dice que queda MENOS de lo que queda—
y el profesional cerraría la obra creyendo que lo entregó todo.

**Qué haría falta para levantarlo:** que el índice supiera **de qué presupuesto es**. Eso es
esquema, es territorio del fundador, y es el **paso 2 de SCRUM-195** (retirar `Job.quoteId @unique`
cuando ningún consumidor lo use). Aquí no se propone ni se construye.

### ② Una línea sin índice no se cuenta, y se dice cuántas son

Ese hueco significa hoy tres cosas —añadida en obra, albarán VALORADO, o tecleada a mano— y este
módulo no puede distinguirlas, así que no finge que sí.

> 🔴 **La regla, que vale igual para A5 y A6:** un número que resume tiene que **declarar lo que no
> pudo contar**. Si no, el resumen no dice «quedan 3»: dice «quedan 3 y no ha pasado nada más», que
> es una afirmación que nadie ha comprobado.

Por eso el informe lleva SIEMPRE tres cuentas de lo no contado —`sinAtribuir`,
`enPartesSinFirmar`, `albaranesValorados`— **también cuando no hay número**: «no puedo contestar»
sin decir qué se quedó fuera se lee otra vez como «no pasa nada más».

Y cuando hay entregas firmadas y **ninguna** lleva enlace, tampoco sale número (`nada_atribuible`):
diría «queda todo» sobre una obra en la que se ha entregado. Es el caso del albarán **VALORADO**,
donde el enlace no se escribe nunca — medido en el prellenado, que en ese modo devuelve cero líneas
porque `validarLineas` exige precio en todas y el presupuesto llega sin él.

### ③ El número va desnudo, sin unidad

«Quedan 3», nunca «quedan 3 metros». La unidad del albarán no es la del sistema: es texto libre que
el profesional puede cambiar sin que nada se entere, y el presupuesto no tiene ninguna con la que
contrastarla. Hay un test que rechaza que aparezca una unidad, tanto en el informe como en la copy.

## Una decisión más, que era mía: solo cuenta lo FIRMADO

El asesor no la fijó, así que la tomé con su mismo criterio y queda declarada: **un borrador no es
una entrega y un emitido es una entrega sin confirmar.** Contar de más encoge el «quedan», que es la
dirección peligrosa de ①; contar de menos solo molesta.

Y lo no contado no se calla: las líneas que viven en partes sin firmar viajan con su propio recuento
(`enPartesSinFirmar`), por la misma regla de ②.

## Dos ejes, dos módulos — y un guard que lo sostiene

`pendientePorLinea` (`albaranFacturacion.ts`) contesta **cuánto de lo servido queda por facturar**.
Esto contesta **cuánto de lo presupuestado queda por entregar**. Reutilizarlo por parecerse sería
volver a tener dos fuentes de verdad para dos preguntas que no se contestan igual — el propio
comentario de SCRUM-367 ya avisaba de que el libro «está al lado equivocado del ciclo».

La aritmética está escrita entera aquí y **este módulo no importa nada**: ni facturación, ni Prisma.
Un guard AST lo comprueba y falla nombrando el import que entró.

## Verificado en rojo

Diecisiete sabotajes, cada uno aplicado, compilado, corrido y revertido con verificación byte a byte:

| Se quita la cosa vigilada | Sale rojo |
| --- | --- |
| **El número se mueve pero `sinAtribuir` se queda a cero** | ① el rojo obligatorio, y 2 más |
| **`sinAtribuir` sube pero el número no se mueve** | ① el rojo obligatorio |
| Con adicionales sí se da número | ② la puerta de los adicionales |
| El VALORADO sin enlaces da número igualmente | ③ nada atribuible |
| Los partes sin firmar descuentan | ④ solo cuenta lo firmado |
| Lo no contado deja de viajar cuando no hay número | ③ y 1 más |
| Entregar de más da negativo | «quedan −8» |
| Un índice basura (`'0'`, `-1`, `1.5`) se usa como enlace | el enlace no utilizable |
| Un motivo pierde su marcador de microcopy | microcopy |
| El módulo importa el eje de facturación | ⑤ dos ejes, dos módulos |

Los **dos primeros son el rojo obligatorio, y están separados a propósito**: el número y lo no
contado tienen que moverse JUNTOS. Si solo se mueve uno, el resumen miente por omisión — y cada
mitad tiene su sabotaje para que ninguna pueda pasar por la otra.

## Microcopy: las cinco ranuras FIRMADAS, y dos reglas que vienen con ellas

El asesor firmó los cinco textos. Dos decisiones suyas cambian lo que yo había propuesto, y las dos
quedan escritas junto a la copy porque no son de estilo:

* **«albaranes», no «partes».** En pantalla ese objeto se llama **Albarán** —lo dicen la entrada del
  menú, el listado global y la tabla del Trabajo—. Un segundo nombre para la misma cosa obliga al
  profesional a aprenderse que son lo mismo, y no hay motivo para cobrarle eso. «Parte» vale para
  hablar entre nosotros; no para la pantalla.
* 🔴 **Singular y plural DE VERDAD, nunca `(s)`.** «1 línea(s)» delata que la frase la escribió un
  programa, y quien la lee es un fontanero con el móvil en la mano. Cambia el sustantivo **y el
  verbo** («que no sale» → «que no salen»), así que se alterna la frase entera: `fraseDeCuenta`
  elige por el número y es una rama de una línea. Hay un test que rechaza el `(s)` **y otro que
  rechaza el plural hecho pegando una «s» al singular**, que es la misma trampa disimulada.

Y el aviso de error se acortó (fuera el «así que»): dos frases cortas se leen de un vistazo en un
móvil al sol; una subordinada, no. En ③ el «así que» SÍ se queda, porque ahí la relación
causa-efecto es lo que explica el mensaje.

Siete rojos más, todos revertidos byte a byte: una letra en un motivo · devolver el «así que» de ① ·
devolver «no están enlazadas» a ③ · devolver el `(s)` · hacer el plural pegando una «s» · devolver
«parte» a la pantalla · y quitar la rama del singular para que todo salga en plural.

## Lo que NO cubre

* 🔴 **No hay pantalla, y esta vez NO es porque falte decidirlo.** El asesor eligió el sitio —encima
  de la tabla de albaranes del Trabajo— y la copy ya está firmada. Lo que falta es que se pueda
  tocar `jobDetailView.js`: **cuatro ramas vivas tienen ediciones pendientes dentro de
  `renderJobDetailView`** (medido: `scrum-300-campos-albaran` +34 líneas, `scrum-300-firmado-por`
  +52, `scrum-302-detalle-albaran` +8, `scrum-316-detalle-b2` +11, ninguna en `main`). Se paró antes
  de tocar el fichero, como pidió el asesor: el orden de merge lo decide él.
* **No hay ruta ni consulta.** `resumenEntrega` es puro y recibe el presupuesto, los albaranes y
  `hayAdicionales`. Quien lo conecte tiene que resolver `hayAdicionales` leyendo `Quote.jobId`
  (SCRUM-195) — el módulo no consulta nada a propósito, para que su lógica se pruebe sin base de
  datos y su tenencia sea la de quien lo llama.
* **No se toca el enlace ni el esquema.** El vínculo es el de SCRUM-367 tal cual.
* **No se distingue «añadido en obra» de «tecleada a mano».** Hoy es el mismo dato vacío; separarlos
  exige un campo, o sea esquema. Mientras tanto, las dos cuentan como no atribuidas y se declaran.
* **Nada dispara el presupuesto adicional** cuando aparece una línea sin enlace. Existe el mecanismo
  de crearlo (`POST /admin/quotes` con `job_id`), pero conectarlo es SCRUM-290, no esto.

## Ficheros

* `src/modules/jobs/domain/entregaPendiente.ts` — **nuevo**. El eje de entrega, puro, con su copy
  marcada.
* `tests/scrum305-entrega-pendiente.test.mjs` — **nuevo**, 12 tests.
