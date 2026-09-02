# SCRUM-684 · Tecnosel: el tipo de intervención se guarda, y un parte firmado ya se puede valorar

**Medido contra:** `origin/main` = `a5aef1b9bbd2570eccbde82b407c9d3675192c2d` · 2026-09-03T17:40:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

## PARTE A · el tipo de intervención (la barata)

La columna llegó (`schema.prisma:911`) y **mi propia puerta seguía rechazándola**: la validación
devolvía `tipo_intervencion_sin_columna` incluso para un valor válido, y había un test mío que
EXIGÍA ese rechazo. Abierta: se acepta y **se persiste** (`trabajoDirecto.ts`).

### El guard no se borró: se reapuntó

> **El hecho que vigila ahora, en una frase:** que el tipo que elige el profesional **llegue a la
> fila que se escribe**, y que un valor de fuera del vocabulario cerrado siga sin entrar.

Antes protegía «no ofrezcas un campo que no se puede guardar»; el hecho cambió al llegar la
columna, así que el guard **se reapunta en vez de retirarse**. Las dos mitades importan: sin la
primera vuelve el fallo mudo que el test original evitaba; sin la segunda, el vocabulario deja de
ser cerrado (regla 27).

### El desplegable, y una cosa que destapó otro guard

Sin valor por defecto: la primera opción va vacía. **Elegir por el profesional qué clase de trabajo
hizo acaba impreso en un parte que firma el cliente.**

🔴 **Y lo escribí mal la primera vez.** Puse los tres valores dentro de `jobNuevoModal.js` y **cayó
el guard de fuente única** que yo mismo construí en SCRUM-651 — con razón: eso era una SEGUNDA lista
del vocabulario cerrado. Corregido siguiendo el precedente de la casa (`cobrosCubos`,
`albaranRotulos`): el servidor los deriva y los manda en `/admin/me`; **el navegador no decide qué
tipos existen, los recibe**.

**Y `''` no es un valor inválido: es AUSENTE.** Un `<select>` con la opción vacía manda exactamente
eso, y tratarlo como error bloquearía un envío legítimo. Tres formas de ausente —`undefined`,
`null`, `''`— y las tres dejan el tipo en `null`.

## PARTE B · precios después de firmar (el camino de escritura)

### El defecto, medido en la certificación y confirmado ejecutando

`puedeEditarPrecios` decía lo correcto —en `firmado` **deja**— y **no cerraba ninguna escritura**:
sólo se calculaba y se devolvía. El único `PATCH` se cerraba con `puedeEditarContenido` para la
**petición entera**, y en `firmado` eso es `false`:

    parte firmado + PATCH que sólo toca precios  →  409 `parte_locked`

El técnico firmaba sin importes —que es el diseño— y **el jefe no podía ponerlos nunca**. Sin
valorar no se cobra.

### Lo construido: el permiso se decide POR CAMPO

`permisoDeCampos(estado, campos)` en el dominio, con los dos grupos que fijó el fundador:

| grupo | campos | candado |
|---|---|---|
| contenido | `obra` `referencia` `entrada` `salida` `notas` `tipo` `desplazamientos` `kilometros` `tecnicos` `lineas` | `puedeEditarContenido` — cierra al FIRMAR |
| precios | `precios` | `puedeEditarPrecios` — cierra al FACTURAR (regla 29) |

**Los precios viajan en su PROPIA clave** (`precios: [{indice, precioUnitario, tipoIva}]`) y no
mezclados dentro de `lineas`: mezclarlos haría que «esta petición toca precios» dependiera de mirar
dentro de un array, y entonces **«mixta» sería opinable**.

**Una petición mixta se rechaza ENTERA**, y el permiso se comprueba **antes** de construir el
cambio — hay un test que mide ese orden, porque comprobarlo después dejaría escribir parte de lo
pedido antes de rechazar.

### El control que no puede caer

`serializeParteParaElTecnico` **no se ha tocado**. El `PATCH` sigue respondiendo con él, así que el
dinero no cruza el cable al móvil, y hay un test que lo fija.

## Lo que NO entra, y es deliberado

**La pantalla de oficina no está.** Como avisaste, prefiero la mitad medida: entra el camino de
escritura con sus cuatro controles, y la vista —con **su propio serializador**, nunca el del
técnico— va en la siguiente. Hoy la API responde al PATCH de precios con la serialización del
técnico: es seguro (no lleva dinero) pero **la oficina no ve lo que acaba de escribir**, y ése es
el primer trabajo de la vista.

**Tampoco:** facturar desde el parte (fila 10, decisión del fundador — regla 24), `schema.prisma`,
ni los ficheros del dictado y de las revisiones.

## Microcopy

Los rótulos de los tres tipos y el del desplegable salen con **marcador** (regla 30) y viven junto
al vocabulario, no en el navegador. Se proponen; no se aprueban aquí.
