# SCRUM-291 (A4) · La serie no se cambia con facturas emitidas, y sus huecos se dicen con nombre

**Fecha:** 5-ago-2026 · **Carril:** A (fiscal) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `31194480c8ae0c00b99240c47cc5411715a6ea28` · 2026-08-05T13:42:13+02:00
**Tanda:** 1585 tests, 1518 pass, 0 fail, 67 skipped

> **GO PARCIAL del fundador.** Entran los puntos **④** (inmutabilidad) y **①** (huecos). El bloque
> de series —prefijo, formato, dígitos y nº inicial configurables— **NO entra**: exige
> `prisma/schema.prisma` y `allocateInvoiceNumber`, y espera GO aparte con el diff delante.

## Dónde está la frontera, y por qué esto cae de este lado

Medido antes de construir:

* **`formatInvoiceNumber`** (`invoiceNumber.service.ts:56`) tiene el formato **cableado**:
  `` `${year}-${p}${rectifying?'-R':''}-${String(seq).padStart(3,'0')}` ``. Dígitos o formato
  configurables **es cambiar esa línea**.
* **`allocateInvoiceNumber`** (`:117`) toma el `pg_advisory_xact_lock` como **primera sentencia** y
  compone el número dentro. Series nuevas **es cambiarlo**.
* Los cuatro campos de la serie viven sueltos en `Merchant`; tres series con formato propio son
  **schema**.

Los dos puntos de este PR **no tocan nada de eso**: ④ decide si se admite un **cambio de ajuste**,
y ① solo **mira** lo ya emitido. `invoiceNumber.service.ts` queda **byte-idéntico**, y hay un guard
que lo comprueba contra `origin/main` en cada `npm test`.

## ④ · El defecto VIVO: la serie se podía partir desde Configuración

`invoiceSeriesPrefix` es editable (`settingsView.js:490` → `PUT /admin/merchant`) y **nada
comprobaba si ya había facturas emitidas**. `invalidPrefijoSerie` solo valida el charset que
admite la AEAT (SCRUM-217); `merchantAdmin.ts` **no consultaba `Invoice` ni una vez**.

Un merchant con 40 facturas `2026-CF-001…040` cambiaba el prefijo a `FAC` y la siguiente salía
`2026-FAC-041`. **Mismo año, misma serie, dos prefijos** — la correlatividad que la AEAT exige,
rota. Y sin vuelta atrás: una factura emitida no se edita (regla 29), así que el daño queda dentro
del registro.

**Se BLOQUEA, no se avisa,** porque lo que se impide es irreversible. Un aviso que deja pasar
reparte la culpa y no evita nada. Error tipado (`SerieError`) antes del `update` → **409 con los
números delante**: cuántas hay emitidas y hasta cuál. Mismo patrón que `SlugError`, que ya existía.

### Las tres cosas que NO bloquea, y cada una tiene su test

* **Reenviar el mismo prefijo.** El formulario lo manda en *cada* guardado; si el guard mirase solo
  «¿hay facturas?», quien ya factura no podría volver a tocar ni su dirección.
* **Los justificantes (`J-…`).** No van en la serie fiscal ni en VeriFactu. Contarlos le negaría
  configurar la serie a quien todavía no ha emitido ni una factura.
* **Una serie de otro año.** Ya está cerrada, no admite números nuevos: cambiar el prefijo no la
  parte.

## ① · Los huecos, dichos con su nombre

El competidor pone dos avisos en gris. **Un aviso que no comprueba nada solo reparte la culpa:** si
luego falta un número, ya te lo habían dicho. Esto comprueba y **dice qué números faltan**.

### La decisión que sostiene todo: no se parsea, se compone

Lo natural sería una expresión regular que saque el `seq` de `2026-CF-001`. **Se descartó:** esa
expresión sería **una copia del formato**, y una copia se queda vieja. El día que la serie admita
otros dígitos —el bloque que espera GO— el detector seguiría leyendo bien y diría «no hay huecos»
sobre una serie que ya no entiende. *Un censo que se queda viejo no avisa: tranquiliza.*

Así que se hace al revés: se **componen** los esperados con `formatInvoiceNumber`, **la misma
función que los compuso al emitirlos**, y se pregunta cuáles no están. Si mañana cambia el formato,
cambia en un sitio y esto lo sigue solo. Un test lo fija: prohíbe `padStart`, `\d{3}`, `match(` y
`split('-')` en ese módulo.

### Efecto secundario que resultó ser un hallazgo

Como se compone con el prefijo **actual**, un número emitido con un prefijo **anterior** no casa
con nada — y sale reportado aparte, como `ajenos`, no descartado en silencio.

**Es exactamente el daño que ④ impide hacia adelante, visto hacia atrás:** si un merchant ya
cambió el prefijo con facturas emitidas, aquí se ve.

### Y el suelo

`huecos: []` con **cero facturas miradas** no es «está todo bien»: es «no supe mirar». El resultado
devuelve siempre `emitidos`, y el test exige que ese número exista para que quien lo consuma pueda
distinguir las dos cosas. También se declara `truncado` cuando el barrido llega al tope
(`MAX_SEQ_BARRIDO = 10.000`) sin poder casarlo todo — un resultado parcial se dice, no se disfraza.

## Verificado en rojo

* **Vuelve el defecto vivo** (el bloqueo no bloquea) → cae «con facturas emitidas se BLOQUEA».
* **Bloqueo de MÁS** (se niega también a quien no ha facturado) → caen dos, incluida la de los
  justificantes. Es el rojo que justifica tener la cara positiva: sin ella, *bloquear bien* y
  *bloquear a todos* se ven idénticos en verde.
* **El detector parsea en vez de componer** (copia del formato a mano) → cae el guard del formato.
* **El guard de la regla 38 no es decorativo:** se comprobó **sin tocar el camino de emisión**,
  apuntando el mismo mecanismo a un fichero que sí cambió (`merchantAdmin.ts` → «CON CAMBIOS») y al
  vigilado (→ vacío). Prueba que detecta, sin necesidad de tocar lo que el fundador pidió no tocar.

Las tres inyecciones revertidas; árbol limpio.

## 🔴 Microcopy PENDIENTE — qué necesita decir el mensaje

`MSG_SERIE_YA_EMITIDA` va con `[PENDIENTE microcopy]` y un guard que impide que se quede así sin
que nadie se dé cuenta. **Lo que el texto tiene que transmitir**, para que el fundador lo apruebe o
lo reescriba:

1. **Que no se puede**, sin ambigüedad — no «te recomendamos que no».
2. **Por qué:** ya hay facturas emitidas con esta serie **este año**, y los números tienen que
   seguir siendo correlativos.
3. **Que no es un capricho nuestro:** es cómo tiene que quedar el registro de facturación.
4. **Qué SÍ puede hacer:** el prefijo se puede cambiar **al empezar un año nuevo**, cuando la serie
   arranca de cero. Eso convierte un «no» en un «ahora no, y cuándo sí».
5. **Los datos ya viajan en la respuesta** (`emitidas`, `ultimo`, `prefijoActual`), así que el texto
   puede nombrarlos sin que haya que inventar nada.

Lo que **no** debe hacer: sugerir que se contacte con soporte para forzarlo. No hay forma legítima
de forzarlo, y ofrecerla es prometer algo que no existe.

## Lo que NO cubre

* **② «parar el choque» no se puede adelantar**, y está medido: `nextInvoiceNumber` tiene **cero
  ocurrencias** en `schemas.ts`, `merchantAdmin.ts` y `settingsView.js`. Hoy el usuario **no puede
  declarar que va por la 42** — esa puerta no existe. El guard nace con el bloque de series.
* **El detector no tiene pantalla todavía.** Es una función pura y probada; dónde se enseña (y con
  qué copy) es decisión de producto.
* **No se ha probado contra la base.** ④ se prueba con la decisión pura, no con una escritura real
  contra Postgres; lo que la ruta hace con el error sí está cableado y compila, pero no ejecutado
  contra un merchant real.
* **`allocateInvoiceNumber` y su cerrojo, intactos.** Siguen siendo lo único que impide que un
  hueco *real* llegue a existir: reserva y creación en la MISMA transacción (SCRUM-219/234). Este
  PR solo mira los que ya existieran.

## Ficheros

* `src/core/validation/fiscalInput.ts` — `numerosDeLaSerie` y `bloqueoCambioDeSerie`, puras.
* `src/modules/system/merchantAdmin.ts` — la consulta y el `SerieError`; `MSG_SERIE_YA_EMITIDA`.
* `src/app.ts` — el 409 con los números.
* `src/modules/invoicing/domain/huecosSerie.ts` (nuevo) — el detector, que **importa** y no
  modifica.
* `tests/scrum291-series-huecos.test.mjs` (14, sin gate).
