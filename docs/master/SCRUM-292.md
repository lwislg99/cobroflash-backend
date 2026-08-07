# SCRUM-292 · A1: pedir el NIF antes de emitir

**Fecha:** 7-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `2732d811f594f7a870c6531a603d636aa0d5ab7c` · 2026-08-07T10:12:01+02:00

## El ticket describía un defecto que no existe

Decía que el producto «PREGUNTA en vez de PROPONER: trece opciones en un desplegable». Medido:

- **Ese desplegable no existe.** Barrido de los 46 ficheros del dashboard con recuento de
  `<option>`: el `<select>` más grande del producto entero tiene **3** opciones.
- **El tipo de factura no lo elige nadie.** Se deriva dentro del camino de emisión
  (`registro.builder.ts`, `invoiceNumber.service.ts`). El profesional nunca lo toca.
- El censo derivado del código da **4 tipos** (`F1`, `F2`, `JUST`, `R1`), no trece.
- Y `resolveTipoDestinatario` (`null → PARTICULAR`) **no toca el tipo de factura**: alimenta la
  bandeja de pendientes y su semáforo. El puente entre `tipoDestinatario` y la simplificada, que
  era la premisa del rediseño, **no existe en el código**.

## El defecto real, y es peor

**Una factura sin NIF del cliente se emite, se envía y se cobra — y queda FUERA del registro.**
`resolverSinDestinatario` lanza `DestinatarioSinDictamenError` y el documento se excluye.
**En pantalla es idéntica a una registrada.** El profesional no se entera.

No es que el producto pregunte de más: es que **decide solo, en silencio**.

## Lo que se construye — y no toca el camino de emisión

**La derivación se queda donde está.** No se mueve, no se copia y no se reimplementa en el front.
Lo que se añade es que el producto **pida el dato que le falta** antes de llegar ahí:

1. **Sin NIF → se pregunta antes de emitir.** La respuesta se guarda en `Customer.taxId` **por el
   PATCH que ya existe** —el mismo que usan la ficha de cliente y el alta—, no por un camino nuevo.
   Con el dato puesto, la derivación acierta sola.
2. **Se enseña antes de emitir lo que va a salir.** Con la regla 29 delante (emitida no se toca),
   ver el documento antes de que sea irreversible es la mitad del valor de la tarea.

**Cero cambios en `registro.builder.ts`.** El único cambio de backend es exponer `taxId` en el
serializer del Trabajo —aditivo y de solo lectura, igual que el `email` que ya iba— para que la
revisión pueda saber si falta. Hay guard de que el modo activo sigue siendo `SIN_DICTAMEN`.

### El módulo no propone ningún tipo, y es deliberado

Sin NIF, `decidible: false`. **No se propone «el más común por si acaso»**: el esquema admite dos
salidas y cuál procede lo decide el dictamen, no el código. Proponer por defecto es adivinar con
buena letra, y un `ClaveRegimen` adivinado es una declaración falsa. Hay guard de que el módulo no
menciona `F1`, `F2`, `R1`, `JUST`, `resolverSinDestinatario` ni `ClaveRegimen`.

## La mitad que NO cubre, declarada con su bloqueo

Hay clientes que **legítimamente no tienen NIF** — el particular de la reparación de 40 €. Ése es el
caso de la simplificada, y **esa rama está apagada**: `MODO_SIN_DESTINATARIO = 'SIN_DICTAMEN'`.
Ahí el producto no emite algo a medias: dice que todavía no puede.

**P11 queda planteada** en `docs/legal/PREGUNTAS_ASESOR.md`, con la cita literal del código y la
nota de que hay una rama esperándola. Se etiquetó **P11** —el nombre que le da el propio código— y
no «H», para no colisionar con **el guion H2**, que en este proyecto ya significa otra cosa
(regla 26).

## Microcopy (reglas 30 y 26)

**Todos los textos nuevos salen con `[PENDIENTE microcopy oficial]` y con procedencia `SCRUM-292`**
—el guard de SCRUM-387 exige un `SCRUM-<n>`, una fecha sola no vale—.

Y **ninguno explica el registro, VeriFactu, la AEAT ni el calendario**: esa pregunta se responde
solo con el guion H2. Hay guard que barre el bloque buscando esas palabras. Un texto que explica mal
una obligación fiscal no es feo: es peligroso.

## 🔴 La trampa del guard ciego, probada

Un guard que inspecciona literales **se queda ciego en cuanto el valor pasa a ser una expresión** —
al hacer que un rótulo dependiera de un ternario, el guard de A0.3 pasó en verde porque dejó de ver
nada.

El censo de este ticket va **por AST y abre las dos ramas** del ternario (y los `||`, y
recursivamente). Con **suelo doble**: falla si no ve asignaciones, y falla si el número de valores
no supera al de asignaciones — porque eso significaría que no ha abierto ningún ternario.

**Probado:** con un texto inventado escondido en la rama del `else`, caen **dos** guards a la vez,
el de la regla 30 y el de la regla 26.

## Los cinco rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Texto inventado escondido en una rama | 🔴 reglas 30 **y** 26 |
| 2 | Neutralizar la puerta | 🔴 «se emitiría sin que nadie se entere» |
| 3 | Una cadena vacía cuela como NIF | 🔴 el suelo del detector |
| 4 | Proponer un tipo sin NIF | 🔴 «adivinar con buena letra» |
| 5 | Encender `SIMPLIFICADA_F2` | 🔴 regla 24: se construye, no se enciende |

### Tres fallos míos que el propio guard cazó

- **Recorte anclado en un comentario** sobre el texto del que ya se quitaron los comentarios:
  `indexOf` daba -1 y `slice(i, -1)` medía 35 351 caracteres. Lo dijo el suelo del recorte. Dos
  veces, en dos tests distintos.
- **`indexOf` cogía la PRIMERA de dos ocurrencias** de `if (revisionInicial.faltaNif)` —una pinta
  la caja, otra es la puerta— y el recorte medía el bloque equivocado.
- **Un censo demasiado ancho** reclamaba textos preexistentes y ya aprobados (`err.textContent`).
  Un rojo por código ajeno es un rojo que alguien silencia.

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0**: **2043 tests · 1975 pass · 0 fail · 68
  skipped**.
- Fixture con **merchant de id real** (7): `isDemoMerchant` es `id === 1` y con el demo la puerta
  de la regla 24 no se ejercita en ningún caso.
- Cero migraciones y cero `db push`.

## Pregunta abierta para el fundador

**Cuántos clientes tienen `tipoDestinatario` a `null`.** No se mide: `.env` apunta a producción.

## Lo que NO se tocó

`registro.builder.ts` y todo el camino de emisión (regla 38) · `prisma/schema.prisma` ·
`resolveTipoDestinatario` y la bandeja de pendientes · el modo `SIN_DICTAMEN` (regla 24).

## El conflicto con SCRUM-386, y lo que enseñó

`main` **extrajo** `openFacturarParcialSheet` del ámbito de la vista a una función de nivel superior
con firma `(alb, ctx)`. Git lo vio como un borrado en la posición vieja y mi bloque como un añadido:
el conflicto parecía «main ha borrado la función». **No la había borrado: la había movido.** Se
midió antes de resolver — la función está entera en `main`, y `albaranDetailView.js` ya la llama por
nombre.

Así que la puerta se **re-aplicó en el sitio nuevo**, no se pegó donde estaba. Y el cliente entra
por `ctx` **en su propia línea**: el guard de SCRUM-386 exige que la hoja no capture nada de
`renderJobDetailView` —por eso aquí no se puede tocar `job`— y que su desestructuración siga siendo
`const { refresh, setStatus } = ctx;` literal.

### Y un guard ajeno volvió a caer por la FORMA, no por el hecho

`SCRUM-386 · los dos llamadores le pasan el contexto` exigía la llamada **literal**
`openFacturarParcialSheet(alb, { refresh, setStatus })`. Al añadir `customer` salió **rojo con el
código correcto**: extender un contexto no es dejar de pasarlo.

Lo llamativo es que **ese mismo test ya lo había sufrido una vez** y su comentario lo dice: «Ahora
se cuentan los PASOS de contexto, que es el hecho, y no la forma de escribirlos». Seguía atado a la
forma. Reescrito para exigir que la hoja **reciba `refresh` y `setStatus`**, admitiendo lo aditivo.

### ⚠️ Y una tanda verde que no valía

Tras el merge conflictivo, `npm test` dio **exit 0 con dos marcadores de conflicto vivos** en
`jobDetailView.js`. Ningún guard los vio. La suite se volvió a correr **después** de resolver, y los
cinco rojos se repitieron enteros.

**Queda como hallazgo:** no hay ningún guard que falle si un fichero publicado contiene
`<<<<<<<` / `>>>>>>>`. Un árbol en conflicto puede pasar la suite entera.
