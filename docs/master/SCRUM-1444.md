# SCRUM-1444 · Censo del patrón gemelo en `src/`: existe un helper y hay sitios que no lo usan

**Medido contra:** `origin/main` = `d73c5ad9102dc0c5aba8a7ec4ea37ac383db06b0` · 2026-10-02T17:25:00Z

A9: aviso → cicatriz S1 «Antes de abrir un ticket o subir una pregunta, se busca en el repositorio si ya está contestada.» — no se pudo comprobar: `ya-esta` mira un número de ticket, no una pregunta, y nada obliga a correrlo

Sesión S1 (`s1-2octe`) · rama `scrum-1439-sondas-como-evidencia`. **Sólo evidencia.** Las líneas de cada
familia, con su carril, están en la descripción del ticket en Jira; aquí va el método y el instrumento.

## El método, antes de la cifra

`docs/master/evidencias/SCRUM-1444/censo-gemelos.mjs`:

    node censo-gemelos.mjs <repo> origin/main                      los recuentos
    node censo-gemelos.mjs <repo> origin/main --lineas <familia>   las líneas

Para cada familia, `git grep -n -E` en `src/` del helper y de la forma cruda, quitando las líneas que
son sólo comentario. **Es texto, no sintaxis.** Se queda fuera: un crudo partido en dos líneas, un crudo
escrito de otra forma que el patrón, `public/` entero, y las familias que no se me ocurrieron (las elegí
yo). **Es un suelo, no un techo.** «Lo lee una persona» se decidió leyendo la línea, sin abrir el fichero.

⚠️ No lo corre nadie: ni la tanda ni CI. Es evidencia de una medición, no un guard. Los dos guards que
saldrán de aquí (un `#${…id…}` en un texto que sale hacia fuera y un `toFixed(2)` pegado a una moneda)
son de S3 y van por AST.

## Lo que salió (2-oct-2026)

| Familia | Helper | Sitios en crudo que lee una persona |
|---|---|---|
| Número del presupuesto | `displayQuoteNumber`, 4 usos, todos en `quotes.routes.ts` | unos 31 |
| Importe | `formatMoneyEs` y familia | 7 |
| Aritmética de línea | `calcTotal`, `lineasQueSuman`, `precioConDto` | 6 (SCRUM-1442) |
| Fecha | `zonaDelMerchant`, `diaNaturalEn` | los que imprimen: ya censados en SCRUM-1093h (SCRUM-1445) |
| «Aceptado» | `presupuestoAceptado`, 2 usos | 16 comparaciones a mano: un gemelo dormido, no se toca |
| Id de columna | `cabeEnColumnaInt` | 34 en J1 y J2 (SCRUM-1379) y 3 en SCRUM-1441 |

**Tres nombres para un documento:** el mismo presupuesto se llama con su número de serie
(`displayQuoteNumber`), «#secuencia» en casi todo, y «#id global» en el correo de aceptación por el bot
(`whatsappIncoming.routes.ts` le pasa `quote.id` a `sendMerchantQuoteAcceptedEmail`).

## La víspera

`docs/master/evidencias/SCRUM-1444/sonda-fechas-vispera.cjs` (sin argumentos) ejecuta las mismas
expresiones `toLocaleDateString` que usa `src/`, en un proceso con `TZ=UTC` y en otro con
`TZ=Europe/Madrid`. Con UTC, un instante de las 00:30 de Madrid se pinta con la fecha del día anterior.

## Errores propios

- Escribí que para las fechas «no existe helper». Existe (`zonaDelMerchant`, `diaNaturalEn`) y lo usa la
  numeración; salió en mi propio grep y no lo até.
- Abrí SCRUM-1445 preguntando por la zona de producción. `docs/master/SCRUM-643.md` ya decía que es UTC,
  y SCRUM-1093h ya tenía el censo de fechas por AST. El ticket se reescribió el mismo día.

## Lo que NO está hecho

No se ha abierto cada sitio · `public/` sin mirar · ninguno visto en pantalla ni en un correo de verdad.

## Segunda tanda (6-oct) · el número de la página y del correo es el del papel

**Medido contra:** `origin/main` = `0dbf8eae7e47b8fd272aa644b810041c6ec3f9c0` · 2026-10-06T10:50:00Z

A9: aviso → cicatriz S1 «Un script que no conoce `--help` no lo ignora: arranca entero, y si es de los que escriben en el árbol, lo escribe.» — no se pudo comprobar: es una orden tecleada en la consola de la sesión, no pasa por ningún guard

Sesión S1 · rama `scrum-1444-numero-del-presupuesto-al-cliente`.

### El encargo no se sostuvo al medirlo, y se dice

El encargo era poner `displayQuoteNumber` (`P260012`) en lo que lee el cliente final. Abierto cada
sitio: **el PDF que el cliente recibe y que se abre desde la página pública imprime `#12`**
(`pdf.service.ts`, `numeroVisible`), igual que el panel y que la variable de la plantilla de WhatsApp.
`P260012` sólo lo pintan los cuatro avisos al PROFESIONAL de `quotes.routes.ts`. Poner el helper en la
página la habría hecho discrepar del papel que enlaza: un nombre más, no uno menos. **No se ha hecho.**
Cuál de los dos formatos es el bueno es un texto que ve el usuario (regla 39) y toca el PDF (J1) y la
plantilla de Meta (STOP): lo decide un jefe.

### Lo que sí era un gemelo, y se arregla

SCRUM-688 hizo que el papel de una revisión diga `#12.1`. La página donde se firma y el correo que lleva
el presupuesto seguían con `quoteNumber ?? id`: **la revisión se llamaba igual que su original**. Ahora
los seis sitios salen de `numeroQueImprimeElPapel` (`quotes/domain/revision.ts`, sobre `numeroConRevision`):

| Sitio | Fichero |
|---|---|
| Rótulo «Presupuesto #…» de la página | `quoteDecisionLanding.routes.ts` |
| Mensaje de WhatsApp de «Tengo una duda» | ídem |
| Mensaje de WhatsApp del presupuesto caducado | ídem |
| Mensaje de WhatsApp del presupuesto rechazado | ídem |
| «Hemos registrado el rechazo del presupuesto #…» | ídem |
| Asunto y cuerpo del correo del presupuesto | `messaging/domain/email.service.ts` |

Ningún literal nuevo: cambia el dato, y sólo en una revisión. Un original sale byte a byte como antes.

### Test — `tests/scrum1444-el-numero-de-la-pagina-es-el-del-papel.test.mjs` (10 casos)

Por las rutas reales de `dist/` con la base doblada, y `sendQuoteEmail` con un cliente de Prisma doble.
El caso del correo se vio rojo antes del arreglo; los seis sitios, con un mutante cada uno: base 10/10, y
cada mutante deja 9/10 tumbando sólo su caso. La mutación de `tests/scrum596-…` que anclaba en la línea
tocada se reancló (lo pidió el guard de SCRUM-836); imita lo mismo que antes.

### Lo que NO está hecho

- **No se ha visto en pantalla ni en un correo de verdad**: la cuenta QA está caducada desde el 3-oct.
- **No compara contra el PDF.** `pdf.service.ts` (J1) conserva su copia de la regla; si cambia allí, el
  test de aquí sigue verde.
- **Un presupuesto sin `quoteNumber` enseña su `id` global** al cliente, en la página, el correo y el
  papel. Se deja como está el papel. No sé cuántos hay en producción: no se ha podido mirar.
- Los nombres de fichero (`presupuesto-12.pdf`) no llevan la revisión, ni en la página ni en el correo.
- **Fuera de mi carril, nombrados y sin tocar:** el portal (`customerPortal.routes.ts:360`, J2) · el bot
  (`whatsappIncoming.routes.ts:462,476,499,564`, J2 y K1) y su correo al profesional, que recibe
  `quote.id` (`:524`) mientras el mismo correo desde la web recibe `P260012` · `botFlow.service.ts:561`
  (J2) · `invoicesAdmin.routes.ts:400` (J1).
- De mi carril, para el profesional y sin tocar: `expire.service.ts:22`, `reminder.service.ts:70`,
  `quotesAdmin.routes.ts:767`, `maintenance.service.ts:515`.

## SCRUM-1444c · `numeroVisible` en las respuestas de S1 (§3.2 de c.18501), al lado del número crudo

**Medido contra:** `origin/main` = `b8cdb771cb2554a072c10fd71bd10322559130ef` · 2026-10-18T18:28:05Z (hora de GitHub al escribir: 18:48:07Z)
A9: comprobación → `tests/scrum1444c-numero-visible-en-las-respuestas.test.mjs`

Carril S1 · árbol `s1-1444c` · rama `scrum-1444c-numero-visible-en-las-respuestas`. Encargo del orquestador
(`cobroflash-backend-f3`), 18-oct-2026. Sin cambio en pantalla: ninguna pantalla lee todavía el campo nuevo.

### La decisión que había que tomar antes (orquestador, 18-oct, opción A)

`numeroVisibleDelPresupuesto` (`revision.ts`, SCRUM-1483) lleva escrita la regla «la respuesta que use esta
función NO manda además `quoteNumber`». Cumplirla aquí obligaba a quitar el número crudo, y las pantallas de hoy
lo leen. **Opción A:** se AÑADE `numeroVisible` y el crudo (`number` / `quoteNumber` / `numero`) se queda; cada
pantalla que pase a leer `numeroVisible` pide quitar el crudo de SU respuesta. La excepción está escrita junto a
la regla, en `revision.ts`, con este ticket. **Condición de cierre de 1444 (la lleva el orquestador):** que no
quede ninguna respuesta con los dos.

### Re-medida de la tabla de c.18485 (12 días después), y qué se hizo con cada fila

| # | respuesta | hecho | crudo que se queda |
| --- | --- | --- | --- |
| 1 | `GET /admin/quotes` (`listQuotesAdmin`) | ✅ | `number` |
| 2 | `GET /admin/albaranes/presupuestos` (`filasParaElegirPresupuesto`) | ✅ (lo recibe de la fila 1) | `numero` |
| 3 | `GET /admin/quotes/:id` (`getQuoteDetailAdmin`) | ✅ arriba y en cada fila de `revisiones` | `number`, `numero` |
| 4 | `POST /quote/create` | ✅ sobre la fila recién creada | `number` |
| 5 | `GET /admin/metrics/home` e `/inicio` (`recentActivity`) | ✅ | `quoteNumber` |
| 6 | `GET /admin/jobs/:id` (`quote`) | ✅ y **`revision` añadida a `QUOTE_SELECT`** | `number` |
| 7 | `GET /admin/jobs` (`quote` de cada fila) | ✅ por el mismo `QUOTE_SELECT` | `number` |
| 8 | `GET /admin/albaranes/:id` (`quote`) | ✅ y **`revision` añadida a su `select`** | `number` |
| 10 | `POST /admin/quotes/:id/revisiones` | ✅ | `numero` |
| 7 (título), 9, 12 | el título «Presupuesto #N · cliente» de `tituloDeTrabajo` (Trabajos, gastos, historial del cliente) | ❌ **NO hecho, a propósito** | — |

**Por qué las filas de título no:** ahí el número no viaja en un campo, va DENTRO de un texto que compone el
servidor (`tituloDeTrabajo`, `trabajoDirecto.ts`). Cambiarlo cambia lo que se ve: una revisión pasaría de `#12`
a `#12.1`, y un presupuesto sin número dejaría de caer al `id` de la tabla (que es el gemelo de c.18405, punto 2).
Eso no es «sin cambio en pantalla» y queda para decidir.

**🔴 Y es un defecto pequeño y real, no sólo un formato viejo** (lo pidió declarar así el orquestador, 18-oct):

| | |
| --- | --- |
| qué se ve | un Trabajo que nació de la REVISIÓN `.1` del presupuesto 12 se titula «Presupuesto #12 · cliente» en Trabajos, en gastos y en el historial del cliente |
| qué debería verse | «Presupuesto #12.1 · cliente»: el número del documento que de verdad está detrás |
| por qué está mal | `#12` es el número del ORIGINAL, que es otro documento. Se le enseña al profesional un número que no es el del presupuesto que mira |
| por qué no se toca aquí | cambiarlo cambia la pantalla, y la opción A era «sin cambio en pantalla». Es una decisión de una línea del fundador: el orquestador la lleva al documento de estado del producto |
| dónde se arreglaría | `tituloDeTrabajo` (`trabajoDirecto.ts`), pasando a `numeroVisibleDelPresupuesto`. Con el mismo cambio, un presupuesto sin número dejaría de caer al `id` de la tabla. Las consultas de gastos e historial (`expenses.service.ts`, `historialDelCliente.ts`) tendrían que pedir además `revision` |

**`QUOTE_SELECT` está en `jobs.routes.ts`, donde vive también la facturación del Trabajo.** Comprobado antes de
tocarlo: lo usan sólo `loadJobRefs` y `quotesDeJob`, que alimentan los serializadores de la lista y del detalle.
Ninguna ruta de emisión. Añadir un campo leído no cambia nada de lo que se factura.

### Verificado, ejecutando

- Test nuevo, 8 casos (filas 1, 2, 3, 5, 6, 7, 8 y 10): el presupuesto de todos es la revisión `.1` del 12, y el
  doble de Prisma **honra el `select`**, así que una consulta que no pida `revision` no la recibe. Cada caso pide
  `numeroVisible = '#12.1'` y que el crudo siga.
- **Rojo primero:** sobre `dist/` de `main` sin el cambio (árbol aparte), **0 de 8**, todos por el campo ausente y
  ninguno por un 500. **Con el cambio: 8 de 8.**
- **Mutantes sobre `dist/`:** sin `revision` en `QUOTE_SELECT` → caen las filas 6 y 7; sin `revision` en el
  `select` del albarán → cae la 8. Restaurado: 8 de 8. (Sin `revision`, la función escribe `#12` en silencio:
  por eso se pide.)
- **Fila 4 (`POST /quote/create`) sólo por `tsc`**: por el banco generaría el PDF en disco. Es la misma función
  sobre la fila completa que devuelve el `create`.
- **Un test ajeno ampliado, y se dice (regla 41):** `tests/scrum302-presupuesto-y-fotos.test.mjs` ③ exigía con
  `deepEqual` que `quote` fuera `{ id, number }`. No caza un defecto: fija la forma, y la forma se amplía por la
  decisión A. Pasa a `{ id, number, numeroVisible }`, con `revision: 0` en su doble (la consulta ya la pide y la
  base la da). El `deepEqual` sigue exacto. **Aprobado por el orquestador (18-oct):** «no es tocar un guard en
  rojo para taparlo: ese test fija una FORMA, no caza un defecto, y la forma la ensanché yo al elegir (A)». Si
  alguien quiere revertirlo, que mire antes este párrafo: el campo nuevo es contrato decidido, no ruido.
- 658 ficheros de `tests/` vecinos: **6066 pasan, 64 saltados**. Caían 7: el de 302 (arriba), SCRUM-854 (faltaba
  esta entrada) y **5 que caen IGUAL en la base sin el cambio** (`scrum222` censo SQL, `scrum461` ①/control,
  `scrum733` ×2). Son del cliente de Prisma viejo de este árbol (sin `prisma generate`), no de este cambio.
- `tsc`: sólo el error conocido de `merchantAdmin.ts:147`.

### Lo que NO cubre

- Ninguna pantalla lee todavía `numeroVisible`: lo hace S2 (y S4 la del albarán, J3 la de `teamView`).
- La serie `P260012.1` sigue fuera (es otra decisión: la función escribe hoy lo mismo que el papel).
- Las filas de título (arriba).
