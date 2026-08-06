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

* **⚠️ La pantalla del alta no entraba en este tramo** — está en el segundo, al final de esta entrada.
* *(lo que sigue describía el estado de aquel momento)* **La pantalla NO estaba construida.** Lo que entra es el **mecanismo** —la decisión
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

---

## Segundo tramo · LA PANTALLA

**Fecha:** 6-ago-2026 · **Carril:** D (alta) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `3788ff840c70e3981d7e132b502bd7ac474a371e` · 2026-08-06T10:34:02+02:00
**Tanda:** 1899 tests, 1832 pass, 0 fail, 67 skipped · `npm test` **`$? = 0`**

> El **mecanismo** (`arranqueDeSerie`) entró con A4 y tiene su entrada en `docs/master/SCRUM-313.md`.
> Esto es **la pantalla**, en rama propia sobre `main` fresco: una PR verde no se queda de rehén de
> trabajo de interfaz.

## Dónde se pregunta, que es lo que aporta D2

El competidor lo tiene en `Configuración › Numeración`, y eso está mal aunque funcione: **quien
viene de otro programa no entra en Configuración el primer día**. Entra, hace un presupuesto, y
descubre el problema cuando ya ha emitido tres facturas mal numeradas. Entonces ya no es
configurar: es un lío.

La pregunta se hace **cuando la respuesta todavía sirve de algo**.

## 🔴 El año va DENTRO de la pregunta, y sale de la fecha actual

«¿Ya has facturado en **2026**?» — no «¿de qué año es esa factura?». Preguntar eso último sería
pedirle al profesional que resuelva un problema nuestro; llevándolo dentro, **la respuesta ya trae
el par completo** que necesita el mecanismo. Eso es lo que cierra la trampa de `resolveSeriesSeq`.

Y el año **nunca se cablea**. Un test lo fija y además **prohíbe cualquier año literal de cuatro
cifras en la vista**: así es como esto se rompe — alguien escribe `2026` «para probar» y se queda.
El test obligatorio del cambio de año compara un alta del 31-dic con otra del 1-ene.

⚠️ **Y ahí encontré un fallo en mi propio test:** las fechas estaban construidas como instantes
**UTC**, y `31-dic 23:59Z` en UTC+2 **ya es 1 de enero**. Las dos daban 2027, así que el test
habría pasado sin cruzar la frontera. Corregido a hora local — que además es lo correcto: el
ejercicio fiscal de un autónomo español es su año local.

## La vista previa: se le PIDE a quien decide

Es el corazón de la pantalla, no un adorno: es lo único que convierte «41» en **`2026-CF-042`**
delante de sus ojos **antes** de que sea irreversible. Sin ella, el aviso de «ya no se puede
cambiar» no protege nada, porque el usuario no sabría qué confirma.

Por eso **no se calcula en el navegador**. Se resuelve en el servidor con `resolveSeriesSeq` y
`formatInvoiceNumber` —quien de verdad decide al emitir— en una ruta de **solo lectura**, porque
cuelga de cada pulsación del teclado. Dos sitios componiendo el mismo número es exactamente cómo
la pantalla promete una cosa y la factura hace otra.

`vistaPreviaSerie` **importa** y no modifica: `invoiceNumber.service.ts` queda intacto (regla 38).

## Ruta propia, no un campo más en el perfil

`nextInvoiceNumber` gobierna qué número sale en la próxima factura. Abrirlo en
`PUT /admin/merchant` lo dejaría escribible desde **cualquier** guardado de Configuración, para
siempre. Aquí tiene su puerta y su momento.

## 🔴 El censo de SCRUM-234 cazó una carrera real, antes de `main`

La primera versión leía lo emitido y escribía un valor **absoluto** en el contador **sin cerrojo**
— literalmente la tercera forma que aquel ticket prohíbe. El guard saltó solo, nombrando
`src/app.ts`.

No es una carrera abstracta: entre leer «no hay facturas» y escribir el 42 cabe una emisión, y esa
factura consumiría la **001** — que **duplica un número que el profesional ya usó en su programa
anterior**. Es el daño exacto que D2 existe para evitar, entrando por la puerta de al lado.

Ahora va con el mismo `pg_advisory_xact_lock` y el mismo namespace que `allocateInvoiceNumber`, y
**la relectura va DENTRO de la transacción**: comprobar fuera y escribir dentro no serializa nada.
Declarado en el censo con su forma y su motivo, y con la nota de que **fija** el arranque en vez de
avanzarlo.

## Verificado en rojo — los tres por `$?`

* **Año cableado en la vista** → cae «ya no sale de la fecha actual».
* **Se rompe el par** (número sin año) → cae nombrando el descuadre: «3 escrituras del número y 3
  del año» deja de cumplirse.
* **Se quita el cerrojo** → cae el censo de SCRUM-234: «declara 'cerrojo' y NO hay
  `pg_advisory_xact_lock`».

Las tres inyecciones revertidas; árbol limpio, `npm test $? = 0`.

## Las dos caras

* **Control negativo:** «No, empiezo ahora» arranca en 1 y **no hereda nada**, ni en el caso hostil
  de que la petición traiga un número igualmente.
* **Control positivo:** el que declara la 41 acaba emitiendo la **042**, y se comprueba
  explícitamente que **no** sea `001`. Hace falta porque aquí el requisito se cumple por
  **ausencia**: sin él, la pantalla podría estar rechazándolo todo y el negativo seguiría verde.

## Dos cosas que añadí al asistente, y por qué son seguras

El bucle no soportaba `montar` ni `textoBoton` — **me los había inventado**, y lo comprobé antes de
seguir. Se añadieron al bucle de forma **aditiva**: un paso que no los declare se comporta
exactamente igual que antes.

## AB6

**Medido estáticamente y en verde:** objetivos ≥44 px, `for=` en las dos etiquetas, `aria-live` en
la vista previa, `role="alert"` en el error, `inputmode="numeric"` en el número y cero colores
fuera de los ya usados en el asistente.

* ⚠️ **Capturas antes/después: NO están.** No se levantó la app: hacerlo pedía base de datos, y hoy
  hay prohibición expresa de aplicar nada a ninguna base (SCRUM-385/383). Se declara como hueco en
  vez de dar por buena una pantalla que nadie ha visto.
* ⚠️ **Matriz de dispositivos: hueco declarado**, como pide el propio ticket. Es humana.
* Nada nuevo en `public/` más allá de la vista: **no hay banco de QA en el repo**.

## Lo que NO entra

* **La puerta de última oportunidad** (preguntar antes de la primera factura a quien se saltó el
  asistente) **no está construida**. El mecanismo la soporta —`arranqueDeSerie` para si ya hay
  emitidas— pero no hay pantalla que la dispare.
* **El campo Serie bloqueado con su motivo** se resuelve hoy por el servidor: si hay emitidas, la
  ruta responde 409 con el texto aprobado y la pantalla lo enseña. Lo que **no** hay es el campo
  saliendo ya deshabilitado *antes* de escribir — se entera al intentarlo.

## Ficheros

* `src/modules/invoicing/domain/vistaPreviaSerie.ts` (nuevo) — importa a quien decide.
* `src/app.ts` — `POST /admin/onboarding/serie` (con cerrojo) y `…/serie/previa` (solo lectura).
* `public/dashboard/js/onboardingView.js` — el paso 2, la vista previa en vivo, y los hooks
  `montar`/`textoBoton` en el bucle.
* `tests/scrum313-pantalla-numeracion.test.mjs` (11, sin gate).
* `tests/scrum234-censo-reserva-serie.test.mjs` — `src/app.ts` declarado en el censo.
