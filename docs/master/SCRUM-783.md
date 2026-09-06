# SCRUM-783 · CONT-09 — La selección sobrevive a la navegación, no a recargar

**Fecha:** 6-sep-2026 · **Carril:** producto / contactos · **Rama:** `scrum-783-seleccion-sobrevive-navegacion`
**Medido contra:** `origin/main` = `43f05e8c9322d574d91e6b7cc1b39785abb81b0c` · 2026-09-06T11:17Z
**Worktree:** `cobroflash-backend` · **Tanda:** 5642 · 5554 pass · **0 fail** · 88 skip

> 🖋️ **DECISIÓN DEL ASESOR (6-sep-2026):** la selección **SOBREVIVE A LA NAVEGACIÓN** y **NO
> sobrevive a RECARGAR**. Motivo: el profesional marca doce clientes, entra en la ficha de uno
> para comprobar algo antes de actuar, y vuelve. Hasta hoy perdía los doce, sin aviso.
> **Comprobar antes de actuar es lo que hace alguien prudente, y el mecanismo castigaba la
> prudencia.** Recargar, en cambio, es empezar de cero y así se espera.

---

## 1 · EL ROJO, ANTES DE TOCAR NADA

```
═══ ① SELECCIONAR 3 → FICHA 360 → VOLVER ═══
    recién montada          filas 3 · marcadas 0 · contador "0 clientes seleccionados" · barra "none"
    tras marcar las tres    filas 3 · marcadas 3 · contador "3 clientes seleccionados" · barra "flex"
    ✅ las tres quedan marcadas antes de navegar
    (pulsada la fila: `openCustomer360` → renderAppView('customer-360'))
    al VOLVER a Clientes    filas 3 · marcadas 0 · contador "0 clientes seleccionados" · barra "none"
    🔴 al volver siguen las TRES marcadas
    🔴 el contador dice 3 al volver
    🔴 la barra sigue abierta al volver
```

Y el verde, con el mismo instrumento:

```
    al VOLVER a Clientes    filas 3 · marcadas 3 · contador "3 clientes seleccionados" · barra "flex"
    ✅ al volver siguen las TRES marcadas   ✅ el contador dice 3   ✅ la barra sigue abierta
```

---

## 2 · DÓNDE VIVE EL ESTADO, Y POR QUÉ AHÍ

**Una línea cambia de sitio:** `let seleccion = []` sale del cierre de `renderCustomersView` y pasa
al **ámbito del script**.

El mecanismo era éste: `openCustomer360` hace `renderAppView('customer-360')` — **navega, no abre
un modal**. Al volver, `renderCustomersView` se ejecuta otra vez y todo lo que viva en su cierre
nace de cero. En el ámbito del script el fichero se evalúa **una vez por carga de página**, así que
la variable sobrevive al remontaje y muere al recargar. **Las dos mitades de la decisión salen de la
misma propiedad**, no de dos mecanismos distintos.

| | qué pasa | por qué |
|---|---|---|
| navegar y volver | la selección **sigue** | la vista se remonta; el script no se re-evalúa |
| recargar la página | la selección **se va** | el script se re-evalúa y la variable nace vacía |

**Las dos prohibiciones del encargo, cumplidas y probadas por un test:**

- ⛔ **NO en el DOM.** Estado colgado del DOM es lo que mató la tecla «N» en toda la aplicación
  (SCRUM-777, que entró hoy).
- ⛔ **NO en una columna.** No hace falta persistencia de verdad; si algún día se pidiera
  sobrevivir a la recarga, es otra decisión y llevaría diff de esquema.
- ⛔ Y **tampoco en `sessionStorage`**, que no lo prohibía el encargo pero **sobreviviría a la
  recarga** — justo lo que el asesor decidió que NO debe pasar.

Hay un test que lee la fuente por AST y **cae si `seleccion` vuelve a declararse dentro de una
función**, y otro que exige que ninguna línea que la nombre toque `dataset`/`setAttribute("data-…")`
ni almacenamiento.

**Nada más cambió.** `pintar()` ya llamaba a `FC.limitarAVisibles(seleccion, visibles)` y a
`refrescarSeleccion()` en cada pintado: con la variable persistente, esas dos líneas hacen sin
tocarlas todo el trabajo de restaurar y recortar.

---

## 3 · 🔴 LA BÚSQUEDA, CERRADA — y el motivo por el que no se midió en SCRUM-582

En 582 declaré este caso **sin medir** y no afirmé nada. La causa era medible y trivial: **el
buscador arranca un `setTimeout` de 300 ms** (`customersView.js`) y mi banco esperaba **60**. La
lista no repintaba nunca, así que el caso no se ejercitaba y un «sobrevive» habría sido un verde
sobre nada.

Con 450 ms de espera y un mock que honra `?search=`:

```
    tres marcadas                  filas 3 · marcadas 3 · contador "3 clientes seleccionados"
    tras buscar «Carmen»           filas 1 · marcadas 1 · contador "1 cliente seleccionado"
    ✅ la búsqueda SÍ repinta      ✅ la selección se RECORTA a lo visible: 3 → 1
    tras borrar la búsqueda        filas 3 · marcadas 1 · contador "1 cliente seleccionado"
    ✅ vuelven las tres filas      ✅ lo recortado NO reaparece: recortar es DEFINITIVO
```

Que el recorte sea **definitivo** importa: si al quitar el filtro reaparecieran los soltados, el
profesional actuaría sobre clientes que creía haber quitado.

---

## 4 · LA BARRA NO PUEDE MENTIR, Y POR ESO NO HACE FALTA TEXTO NUEVO

El encargo preveía que, con la selección persistente, hubiera **seleccionados fuera de pantalla** y
que el contador necesitara un texto nuevo. **Medido: no puede pasar.**

`pintar()` recorta a lo visible en **cada** pintado, incluido el primero de cada montaje, así que el
invariante `selección ⊆ visible` se mantiene también después de navegar. Hay un test que lo
comprueba **contando**: el número que dice la barra tiene que ser igual al número de casillas
marcadas en pantalla, medido tras filtrar **y** navegar.

> **Conclusión: NO se propone ningún literal nuevo, y por tanto no hay nada que firmar.** Si algún
> día se decidiera guardar lo invisible, ese día sí haría falta un texto — y entraría con marcador.

---

## 5 · EL LÍMITE, PROBADO: recargar vacía la selección

```
    tres marcadas en la página A   filas 3 · marcadas 3 · contador "3 clientes seleccionados"
    página B (recargada)           filas 3 · marcadas 0 · contador "0 clientes seleccionados" · barra "none"
    ✅ tras RECARGAR no queda nada marcado   ✅ la barra vuelve a estar cerrada
```

Sin este control, «sobrevive a la navegación» se convierte en «no se va nunca», que es pasarse de
frenada. En el banco una **página nueva** es un contexto nuevo, o sea los scripts re-evaluados: es
literalmente una recarga.

---

## 6 · LOS CONTROLES, Y LAS MUTACIONES EN ROJO

`tests/scrum783-seleccion-sobrevive-navegacion.test.mjs` — **8 tests, 8 verdes.**

| control | qué exige |
|---|---|
| 🔴 el que decide | marcar tres → ficha 360 → volver → **tres** |
| 🔴 la casilla de cada fila | y las tres salen **marcadas**, no sólo el contador |
| ✅ positivo | buscar sigue **recortando**, y el recorte es definitivo |
| 🔴 el invariante | el contador == casillas marcadas en pantalla, tras filtrar y navegar |
| ✅ el límite | recargar **vacía** la selección |
| 🔴 dónde vive | `seleccion` en ámbito de script; ni DOM ni almacenamiento |

**`meta:mutaciones` (corredor oficial): `vivas 67 · mudas 0 · ciegas 0`**, y las dos mías dentro:

```
  ✔ scrum783… · EL QUE DECIDE: marcar tres, ver una ficha y VOLVER deja los TRES
  ✔ scrum783… · POSITIVO: BUSCAR sigue RECORTANDO la selección, y el recorte es DEFINITIVO
```

- ① devuelve `seleccion` al cierre de la función: es **exactamente** el defecto que este ticket
  arregla, y en el diff no parece nada — una línea que cambia de sitio.
- ② quita el recorte a lo visible: la barra pasaría a mentir.

> ⚠️ **Mi corredor de mutaciones estaba caduco y me dijo «CIEGO».** La API del meta-guard cambió
> con los merges de hoy: `paso()` ya no recibe la salida como cadena sino un **objeto con
> `.pasados`**. El ciego era mi herramienta, no mis tests — se comprobó usando el corredor
> **oficial**, que es lo que había que hacer desde el principio.

---

## 7 · Un guard de la casa me cazó, y tenía razón

**SCRUM-237** («ninguna negación de la suite se queda SIN respaldo»):

```
  🔴 negación(es) SIN NINGÚN respaldo (patrón scrum73 — verde permanente)
  + [ 'tests/scrum783-…:230 «sessionStorage|localStorage»' ]
```

Mi `doesNotMatch(l, /sessionStorage|localStorage/)` es del tipo que **se queda verde para siempre**
si el token deja de poder aparecer: nadie sabría si es que no está o es que el detector no lo busca
bien. Se añade el **hermano del token** —cuatro positivos con las mismas expresiones sobre cadenas
de respuesta conocida—, que además es el control honesto: demostrar que el detector VE antes de
creerle que no encuentra nada.

---

## 8 · HUECO 4 de SCRUM-582, medido — y sigue abierto

El original decía «en móvil, con cero seleccionados, la barra es INALCANZABLE». **Medido, es más
preciso que eso:**

```
CON CERO SELECCIONADOS:
  casilla de CABECERA existe en el DOM: true   (vive en el <thead>)
  barra · display: "none"
  CSS: `.table--stack-mobile thead{display:none}` bajo max-width 640px
  → a <=640px las DOS vías de «seleccionar todo» están ocultas A LA VEZ.

TRAS MARCAR UNA FILA A MANO:
  barra · display: "flex"
  → la vía existe, pero está DETRÁS de marcar una a mano: dos pasos, no cero.
```

**No es inalcanzable: está gateada.** En el móvil no se puede «seleccionar todo» sin marcar antes
una a mano.

**NO se cierra aquí, y el motivo es que no es una decisión mía:** enseñar la barra con cero
seleccionados pone en pantalla, de forma permanente, un contador que diría «0 clientes
seleccionados». Eso es un estado visible nuevo y un texto que hoy nadie ve — **microcopy, y la
firma el asesor**. Lo que haría falta para cerrarlo: decidir si la barra se ve siempre en móvil y,
si sí, qué dice con cero. Queda declarado por segunda vez, ahora con el número delante.

---

## 9 · Lo que este PR toca, y lo que no

| fichero | qué |
|---|---|
| `public/dashboard/js/customersView.js` | `let seleccion` sale del cierre al ámbito del script (+ el porqué) |
| `tests/scrum783-…test.mjs` | **nuevo** · 8 controles y 2 mutaciones |

⛔ **No se tocó:** ninguna acción en bloque · `.btn-sm` ni `EXCEPCIONES_PANEL` · `productsView` ni
`providersView` (otra sesión está ahí) · ningún literal · nada en el DOM como almacén.

---

## 10 · Huecos declarados

1. **Hueco 4 sigue abierto** (§8): necesita una decisión de microcopy.
2. **La persistencia es por pestaña y por carga.** Dos pestañas del panel llevan selecciones
   independientes — es consecuencia de dónde vive el estado, y es coherente con «recargar empieza
   de cero». No se ha medido el caso de dos pestañas.
3. **No se ha verificado en yaqu.app** ni hay capturas: lo medido es el banco de vistas.
4. **Sólo la lista de Clientes.** Si mañana otra lista estrena selección, este mecanismo no se le
   aplica solo.
