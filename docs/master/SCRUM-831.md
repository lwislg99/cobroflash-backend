# SCRUM-831 · La lista de Albaranes no dejaba hacer nada con un albarán

**Medido contra:** `origin/main` = `0269e8cd24b6a393e23d05db6ac13307b4ac1c1d` · 2026-09-09T09:35:28+02:00
**Rama:** `scrum-831-albaranes-sin-acciones`, partida de `scrum-823-la-escalera-mira-el-estado`.
**Orden de merge:** SCRUM-816 → SCRUM-823 → **831**. Los tres tocan la misma familia de pantallas.

---

## 1 · El hecho, medido

Del censo de las cinco listas (`docs/CENSO_ACCION_DEL_80.md`), Albaranes era la peor por tres
hechos que no se solapan:

1. **Cero acciones en la fila.** Sus dos pulsables eran enlaces de navegación.
2. **La fila no se anunciaba pulsable** (`cursor: auto`), mientras las otras cuatro usan `pointer`.
3. **`.cell-actions` contenía un enlace al Trabajo**, no una acción.

Y el autor de esa fila ya lo había dejado escrito, palabra por palabra:

> *«PERO LA RANURA SE LLAMA `actions` POR ALGO: ESTÁ PRESTADA. El día que esta fila reciba acciones
> de verdad, chocan. Entonces las acciones se quedan con `cell-actions` y el Trabajo necesita
> RANURA PROPIA en la rejilla. No se comparte.»*

Ese día era hoy, y se ha hecho exactamente eso.

---

## 2 · 🔴 La causa: la TERCERA vez del mismo defecto

**La escalera del albarán ya existía.** `ALBARAN_ACTION_REGISTRY` (SCRUM-302) declara, por estado,
cuál es la primaria — con sus razones escritas. Lo que no existía era el acceso: su resolutor,
`primariaDeAlbaran`, vivía **dentro de `jobDetailView.js`**, así que la lista no podía preguntarle.

| ticket | qué vivía encerrado | quién no podía nombrarlo |
| --- | --- | --- |
| SCRUM-366 | `jobNextAction` | la lista de Trabajos |
| SCRUM-823 | `abrirAgendarTrabajo` | el detalle del Trabajo |
| **SCRUM-831** | `primariaDeAlbaran` | **la lista de Albaranes** |

🔒 *Una función correcta que la otra pantalla no puede nombrar acaba en una de dos: o se reescribe
peor, o no se usa.* Aquí pasó lo segundo, y costó tres tickets de lista sin una sola acción.

### La escalera del albarán NO se parece a la de Trabajos, y por eso no se copia

- La de **Trabajos** es una FUNCIÓN: calcula el siguiente paso mirando otros documentos, el dinero
  y el estado.
- La de un **albarán** es una TABLA POR ESTADO: su siguiente paso lo decide él mismo
  (`borrador → Emitir`, `emitido → Enviar para firmar`, `firmado → facturar`, contextual).

Copiar la forma habría metido una escalera de seis peldaños donde el trabajo real tiene tres. **Se
comparte la lección —una sola fuente, alcanzable— no la forma.**

---

## 3 · Y al mudarlo se destaparon DOS huecos que ya existían

### 🔴 (a) El contexto de la ficha del Trabajo estaba a medias

`jobDetailView` declaraba **una** condición (`valorado-con-pendiente`) y el registro tiene **dos**
primarias contextuales para `firmado`. La otra —`sin-valorar-convertible`, la del parte SIN
precios, que es el modo **por defecto**— no se evaluaba nunca ahí. El detalle del albarán sí la
calculaba. Dos copias del mismo contexto, y una se había quedado corta.

### 🔴 (b) A la lista le faltaban los datos, y el hueco se pintaba igual que «nada que hacer»

`modoValoracion` y `quote` **no viajaban**. Sin ellos, `undefined === 'VALORADO'` es `false`, las
dos condiciones caen, y un albarán `firmado` se quedaba sin siguiente paso **por falta de dato**.
Los dos casos se pintan igual —celda vacía— y significan lo contrario. Es SCRUM-816 con otro
documento.

Arreglado con **cero consultas nuevas**: `modoValoracion` es columna del propio albarán y `quoteId`
del Trabajo, que ese listado ya carga en lote.

---

## 4 · Las tres decisiones que pedía el ticket

### La primaria NAVEGA, no ejecuta

🔒 *Un acto irreversible no es nunca la acción principal.* **Emitir no tiene vuelta atrás**:
`canTransitionAlbaran` sólo admite `borrador → emitido → firmado` y emitir quema número de serie.
Un botón que lo dispara con un clic en una lista de veinte filas es justo lo que ese canon prohíbe.

La fila **dice qué toca y lleva hasta donde se hace**, que es el precedente aprobado en SCRUM-366 y
el que la ficha del Trabajo ya usa en sus filas de documento: un solo ejecutor, en el detalle.

### La fila NO se anuncia pulsable — y se contesta con el censo, no con la coherencia

Las otras cuatro usan `cursor: pointer`. Aquí **no**, y es deliberado:

- el censo dice que en Albaranes el 80% es **actuar** sobre el documento, no abrirlo;
- el número ya abre el detalle y **sí se anuncia** (verde + `pointer`, medido);
- con acciones dentro de la fila, hacerla pulsable entera pondría el gesto de navegar pegado al de
  actuar — el candado de SCRUM-727 — **sin beneficio medido que lo pague**.

### El enlace al Trabajo: sale de la ranura, no del producto

Pasa a `cell-trabajo`, con su propia área en la tarjeta de móvil vía `.table--albaranes` — el mismo
modificador **acotado** que usó `.table--trabajos` en SCRUM-727b para no mover a las cuatro listas
hermanas. Conserva su ancho completo y sus **44 px de AB6**: cambiar de área no puede encoger un
objetivo táctil.

---

## 5 · ⛔ PARO: un rótulo que no existe

**`btnConvertirFactura` no tiene rótulo firmado.** Es la primaria de un albarán *firmado, sin
precios y con presupuesto detrás* — y el detalle lo pinta hoy con `[PENDIENTE microcopy oficial]`.

En la lista **no se pinta nada** para ese caso, y no es una omisión:

- el identificador en pantalla es una tubería interna asomando;
- el marcador lo caza `guard:marcadores-en-pantalla` (SCRUM-722), con razón;
- y no se inventa un sinónimo para tapar el hueco (regla 30).

El hueco **no es silencioso**: `guard:albaranes-con-acciones` lo NOMBRA en cada pasada.

### Texto propuesto, para firma

> **Convertir en factura**

**Por qué éste:** es VERBO, como sus dos vecinos de la misma ranura («Emitir», «Enviar para
firmar») y como «Facturar lo entregado», que es su excluyente. Dice lo que hace sin adornarlo, y
distingue del otro camino: «Facturar lo entregado» factura los precios del propio parte; éste
convierte el parte **contra el presupuesto** porque no lleva precios.

El día que se firme son dos líneas: la entrada en `ROTULOS_ALBARAN` y nada más — la lista ya lo
lee de ahí.

### Y una segunda, que se puede vetar en una línea

La columna nueva se llama **«Acciones»**. No es palabra nueva en el producto —es el rótulo que
`jobsView.js` y `quotesListView.js` ya usan en producción para esta misma columna, y se copia tal
cual en vez de estrenar un sinónimo—, pero **sí es nueva en esta pantalla**, cuyas seis cabeceras
estaban firmadas como conjunto. Queda dicho para que se pueda cambiar en un renglón.

---

## 6 · Verificación

`npm run guard:albaranes-con-acciones` (Edge, `page.setViewport` real a 1700 px):

```
nº             estado      acción en la fila
A-2026-0021    borrador    «Emitir»
A-2026-0022    emitido     «Enviar para firmar»
A-2026-0023    firmado     «Facturar lo entregado»
A-2026-0024    firmado     (ninguna)   ⏳ HUECO DECLARADO: falta la firma del rótulo
A-2026-0025    firmado     (ninguna)   ✅ ya facturado del todo: no hay siguiente paso
   ✅ SUELO · 5 casos dan 4 respuestas distintas: hay algo que comparar
   ✅ ningún rótulo es un identificador ni un marcador
   ✅ `.cell-actions` no contiene ningún enlace de navegación
   ✅ la primaria lleva al detalle y NO escribe nada
   ✅ la fila no se anuncia pulsable
```

**Probado en rojo** devolviendo el enlace del Trabajo a `.cell-actions`: cae ② nombrando las cinco
filas y avisando de que el Trabajo desapareció de su celda. Exit 2.

### 🔴 Y el guard se cazó a sí mismo en la primera pasada

Salió **verde** con la fila `A-2026-0024` mostrando «btnConvertirFactura» — el id crudo. Un guard
que cuenta acciones y no mira **qué dicen** deja pasar un identificador a la pantalla. Ahora falla
si algún rótulo casa con `btn[A-Z]` o con el marcador.

---

## 7 · Los guards de la casa que reaccionaron. Ninguno se relajó

| guard | qué dijo | qué se hizo |
| --- | --- | --- |
| SCRUM-304 | «ESCÁNER CIEGO: no encuentro `function ctxAlbaranEnFila`» | se actualiza el ancla a sus DOS casas; **sigue ejecutando** los decisores de verdad |
| SCRUM-304 | el patrón móvil ya no casa | leía una clase exacta y ahora hay modificador; lee el patrón compartido y deja pasar el modificador |
| SCRUM-301 | 7 celdas contra 6 columnas | entra «Acciones» en la copia aprobada, con su porqué |
| SCRUM-301 | «`.cell-trabajo` no está en la hoja» | sí estaba, **acotada a la tabla**; el lector sólo miraba la rejilla compartida — acotar es MÁS preciso, y es el patrón de `.table--trabajos` |
| SCRUM-242 | «un script promete `docs/master/SCRUM-831.md` y no está» | este documento |

## 8 · Regla 4

`albaranesView.js` pasa de **9 a 6** asignaciones de `style.cssText`; en todo `dashboard/js/`, de
**351 a 348**. Un trinquete sólo baja.

> ⚠️ Mi primer recuento dijo 353 → 353: contaba también **mis propios comentarios**, que mencionan
> `style.cssText` al explicar el cambio. La trampa de auto-referencia, en mi propia medición.

## Lo que NO se ha tocado

- `ALBARAN_ACTION_REGISTRY` — quien decide sigue siendo él; aquí sólo se le pregunta.
- El detalle del albarán · el camino de emisión (regla 38) · `prisma/schema.prisma`.
- `invoicesView` con `fetch` crudo — reportado, de otro carril (regla 9).
