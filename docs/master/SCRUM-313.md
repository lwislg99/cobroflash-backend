# SCRUM-313 (D2) · «¿Por qué número vas?» — la continuidad de la numeración al migrar

**Fecha:** 5-ago-2026 · **Carril:** D (alta) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `c711b7968777f29fd00fcddae69c2ba8489c576a` · 2026-08-05T14:36:26+02:00
**Tanda:** 1639 tests, 1572 pass, 0 fail, 67 skipped · `npm test` **`$? = 0`**

> Va en la misma rama que SCRUM-291 (A4): D2 **usa** el mecanismo de series y no tiene sentido
> medirlo contra un `main` que todavía no lo tiene.

## Por qué esta tarea vale lo que vale

Un autónomo que ya factura **no se cambia de programa porque el nuevo sea más bonito**. No se
cambia porque romper la serie de numeración le da miedo con Hacienda. Quien resuelve ese miedo se
lleva al cliente.

Y el aporte de D2 es **dónde se pregunta**. El competidor lo tiene en `Configuración › Numeración`,
y eso está mal aunque funcione: quien viene de otro programa no entra en Configuración el primer
día — entra, hace un presupuesto, y descubre el problema cuando ya ha emitido tres facturas mal
numeradas. Entonces ya no es configurar: es un lío. **La pregunta se hace cuando la respuesta
todavía sirve de algo.**

## 🔴 La trampa, y es fiscal: los dos campos van juntos o no van

`resolveSeriesSeq` (`invoiceNumber.service.ts:80`) decide así:

```ts
return m.invoiceSeriesYear === year ? m.nextInvoiceNumber : 1;
```

Fijar `nextInvoiceNumber = 42` **sin** fijar `invoiceSeriesYear` al año en curso **no continúa la
serie: la reinicia en 1**, en silencio. El profesional creería ir por la 42 y su primera factura
saldría `2026-CF-001` — **un número que ya usó en su programa anterior**.

**Duplicar un número emitido es peor que dejar un hueco**, y es exactamente el daño que esta tarea
existe para evitar. Por eso `arranqueDeSerie` devuelve **el par entero o un rechazo**, nunca medio
ajuste.

Y no se comprueba contra una copia de la regla: el test le pregunta a **`resolveSeriesSeq`**, que
es quien decide de verdad al emitir. Si esa regla cambia, cae este test y no al revés.

## Lo que decide, y las dos ramas

* **«Vengo de otro sitio»** → continúa por la **siguiente**: si su última fue la 41, la nuestra es
  la 42. Repetir la 41 sería emitir dos veces el mismo número.
* **«No, empiezo ahora»** → arranca en **1 del año en curso**, y **no hereda nada**: aunque la
  petición traiga un `ultimoNumero`, se ignora. Es el control negativo, y tiene su test.

Se devuelve el par explícito también en esta rama, a propósito: «no toco nada» y «arranca en 1 de
este año» no son lo mismo — dejar `invoiceSeriesYear` a `null` es un estado que también se resetea.

## Respeta la puerta de A4

Con facturas **ya emitidas** con nosotros, declarar un arranque **se para** y se dice **hasta qué
número** hemos emitido. Declarar la 42 con la 50 emitida repetiría ocho números que ya existen, y
una factura emitida no se edita (regla 29).

Un número imposible (`0`, negativo, decimal, texto, vacío, por encima del tope) **se rechaza, no se
redondea** — cada uno con su motivo.

## Verificado en rojo — los tres por `$?`, nunca leyendo el texto

* **Se devuelve el número SIN el año** → caen dos: «no se fija el año de la serie» y «el emisor no
  daría el número que la pantalla prometió». Es la trampa fiscal, reproducida.
* **El control negativo hereda** → cae «quien empieza de cero hereda un número».
* **Se rodea la puerta de A4** → cae «se deja declarar un arranque cuando ya hemos emitido».

## Suelo

El censo de sitios que fijan o leen el arranque falla si vuelve **vacío** — «nadie lo toca» y «no
supe mirar» son el mismo número — y además exige encontrar el asignador, que es quien lo lee. Si no
lo ve, no está mirando donde cree.

## Lo que NO entra, y hay que leerlo

* **⚠️ La pantalla del alta NO está construida.** Lo que entra es el **mecanismo** —la decisión
  pura, con sus dos ramas, el choque y el rechazo— y sus tests. Falta el bloque en el asistente, la
  vista previa en vivo y la **puerta de última oportunidad** antes de la primera factura. Se dice
  claro: **D2 no está cerrado**, y con él tampoco el bloque D.
* **La microcopy aprobada no se ha aplicado todavía** porque vive en esa pantalla. El texto que el
  fundador aprobó es:
  > ¿Ya has facturado este año? · [ Sí ] [ No, empiezo ahora ]
  > ¿Cuál fue el número de tu última factura?
  > *Seguimos por ahí para que tu numeración no tenga saltos. Mientras no emitas ninguna factura
  > con nosotros, esto se puede cambiar en Configuración.*
* **Matriz de dispositivos y capturas AB6: hueco declarado**, como pide el propio ticket.
* **No se ha escrito `nextInvoiceNumber` desde ninguna ruta.** El campo ya existe en `Merchant`, así
  que no hará falta schema — pero el camino de escritura es trabajo de la pantalla.

## Residuo de SCRUM-338, arreglado aquí (paso 3)

**La respuesta a la pregunta del fundador es NO: quedaba residuo.** `productsView.js` mostraba
**«No se pudo cargar el catálogo.»** cuando el servidor devolvía `already_has_products` — que no es
un fallo, es el servidor **protegiendo lo que el profesional ya tiene** (con ≥2 productos no carga
y no borra nada). Le contábamos un error donde hubo una decisión a su favor, y encima sin decirle
qué pasaba con su catálogo.

Ahora los tres casos se distinguen, y el protegido se anuncia como **aviso (`warn`), no como
error**. Ojo con el detalle que casi se cuela: `showToast` solo admite `ok|warn|error`
(`api.js:107-111`); pasar `'info'` habría caído al **verde de éxito** — justo lo contrario de lo que
pasó. El texto nuevo va `[PENDIENTE microcopy]`.

## Ficheros

* `src/core/validation/fiscalInput.ts` — `arranqueDeSerie` y `MAX_NUMERO_SERIE`, puras.
* `public/dashboard/js/productsView.js` — los tres casos de `load-catalog`, distinguidos.
* `tests/scrum313-continuidad-numeracion.test.mjs` (8, sin gate).
