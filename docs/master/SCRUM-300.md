# SCRUM-300 · C5: FIRMADO POR y lugar de entrega en el albarán, con el sello a v:2

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** STOP con GO (schema + sello de firma)
**Medido contra:** `origin/main` = `de6abbd325419a9e85d60cf13b1588596125d66b` · 2026-08-05T05:30:16Z
**Tanda:** 1488 tests, 1421 pass, 0 fail, 67 skipped — corrida contra el `main` RESULTANTE del
rebase (`main` se movió durante el trabajo: `077fa8a` → `de6abbd`, que trajo SCRUM-284 y SCRUM-286).

## El defecto

Tenemos el mejor mecanismo de firma del mercado —canvas in situ, firma remota por WhatsApp con
`firmaToken`, evidencias con fotos, hash de contenido sellado— **y guardábamos un trazo sin
nombre**. La jurisprudencia dice las dos cosas juntas: «las firmas ilegibles o no identificadas
requieren prueba complementaria» y «es habitual que personal de la misma obra rubrique la
recepción». Identificar al firmante es lo que separa esas dos frases, por el coste de un campo.

Y faltaban dos de los siete contenidos mínimos obligatorios del albarán: lugar y fecha de entrega.

## Lo que se midió — y las DOS premisas del ticket que cayeron

### 🔴 ① `Albaran.fecha` YA era la fecha de entrega. El ticket decía que no.

El ticket afirma «hoy solo tenemos la de creación». **Falso a nivel de datos.** Son dos columnas
distintas y lo eran desde siempre:

| Campo | Columna | Ancla |
|---|---|---|
| `Albaran.fecha` | `albaranes.fecha` | `prisma/schema.prisma:769` — *«fecha de la visita/entrega»* |
| `Albaran.createdAt` | `albaranes.created_at` | `prisma/schema.prisma:792` |

Cinco pruebas independientes de que son dos cosas: `ensureAlbaranPdf` las pasa como dos parámetros
(`albaran.service.ts:394-395`); `generateAlbaranPdf` las declara por separado
(`albaranPdf.service.ts:19-20`); el PDF **ya imprimía las dos rotuladas distinto**
(`albaranPdf.service.ts:99`); el seed escribe ambas en el mismo `create`
(`seed-video.mjs:511-518`); y **el hash canónico sella `fecha` y NO sella `createdAt`**
(`albaran.service.ts:260-278`) — lo que se firma es la entrega, no la creación.

**Lo que faltaba de verdad: ninguna UI la escribe.** El editor mandaba `{lineas, notas,
modoValoracion}` (`jobDetailView.js:964`) y la creación no la incluye
(`jobs.routes.ts:521-530`), así que caía siempre al `@default(now())`. Es decir: **`fecha`
gobernaba el mes natural de la recapitulativa (art. 13 RD 1619/2012) con un valor que nadie había
elegido nunca.** Es el patrón de la casa otra vez —el mecanismo existe y nadie lo dispara— con la
diferencia de que éste no estaba inerte.

**Consecuencia: se RETIRÓ la cuarta columna autorizada.** El fundador había aprobado
`fechaEntrega`; al medirlo la retiró él mismo. Dos fechas de entrega podrían divergir, y el día que
lo hicieran el PDF diría julio y la recapitulativa agruparía en agosto — una factura recapitulativa
mal agrupada se la come el profesional delante de Hacienda. **La fecha de entrega se resuelve
EXPONIENDO `Albaran.fecha`.** Una sola fecha: divergencia imposible, no vigilada.

### ② El sello llevaba meses guardando el lugar de obra VACÍO

El contenido canónico ya sellaba `obra`, tomándola de `Job.direccion` — cuyo **único escritor en
todo el árbol** es `scripts/seed-video.mjs:488`. `job.service.ts:65` la pone a null explícitamente
y el schema declara «sin fuente hoy». Para cualquier merchant real es null.

No faltaba un campo: **había un campo sellado que nunca tuvo contenido.**

### El coste en toques: 3 → 3

Medido desde la fila del albarán en `emitido` (`Firmar` es visible, no está tras el «⋯»):

| Canal | Antes | Después |
|---|---|---|
| **In situ** | `Firmar` → trazo → `Confirmar firma` | **igual** |
| **Remoto** | link WhatsApp → trazo → `Firmar el parte` | **igual** |

**2 toques + 1 trazo, sin cambio**, porque los dos campos llegan precargados con el caso
mayoritario. Solo paga quien firma siendo otra persona — el caso que el documento necesitaba
capturar. El banco AB6 mide que **el canvas no encoge** (190 px a 390 y a 360): la firma es el
gesto, y estrecharlo para hacer sitio habría empeorado justo lo que esto refuerza.

## La decisión, y por qué

**El lugar de entrega es campo DEL ALBARÁN** (decisión del asesor). `Job.direccion` queda como
precarga opcional. Se edita **preparando el documento**, no al firmar: teclear una dirección con el
cliente delante y las manos sucias es la fricción que el ticket manda evitar.

**El sello sube a v:2** porque `obra` **cambia de fuente**, no porque se añadan campos. Dos hashes
calculados con reglas distintas bajo la misma versión serían indistinguibles.

* **v:1 se conserva escrito ENTERO Y APARTE**, sin helper compartido con v:2. `JSON.stringify`
  depende del orden de inserción de claves: un helper convertiría cualquier retoque futuro del v:2
  en un cambio silencioso del hash de v:1, y ese hash tiene que poder recalcularse igual dentro de
  diez años. Duplicar diez líneas es el precio de que eso sea imposible.
* **La versión se LEE DEL DATO** (`evidencia.v`). `obraSegunVersion` despacha la fuente.
* **Una versión desconocida se DICE**, no se aproxima con la más parecida: aproximarla devolvería
  «no coincide» sobre un documento intacto, que es una acusación que no se puede hacer sola.
* **Ningún hash existente se recalcula para guardarse.** El PDF sigue leyendo el guardado
  (`albaranPdf.service.ts:237`).

**La microcopy vive en UN sitio y se SIRVE.** El dashboard es vanilla y no puede importar el módulo
de dominio; copiar las cinco cadenas era la tentación. Van por `/admin/me` desde
`albaranFirmante.ts` — mismo criterio, escrito, que SCRUM-289. Divergencia **imposible**, no
vigilada: la lección de las dos cabeceras de `gastos.csv` y las tres copias del porqué de
`borradoMerchant`.

## 🔴 UNA PALANCA NUEVA: el profesional ya puede mover el mes del art. 13

**Al exponer `Albaran.fecha`, el profesional puede mover el mes de agrupación de la factura
recapitulativa (art. 13 RD 1619/2012). Es lo que la ley quiere —la fecha de entrega real manda— y
hasta hoy no existía en la interfaz.**

Queda escrito aquí con esas palabras por un motivo concreto: **el día que alguien vea una
recapitulativa agrupada en un mes que no esperaba, la explicación está en este párrafo.** No es un
fallo ni un efecto secundario: `mesNaturalKey(a.fecha)` siempre gobernó la rotura
(`albaran.service.ts:215`, `consolidacionCliente.service.ts:180`); lo que cambia es que hasta ahora
lo hacía con el instante de creación, que **nadie había elegido nunca**, y ahora lo hace con una
fecha que alguien sí ha elegido.

Los dos límites que la acotan, medidos:

* **A un albarán FIRMADO no se le puede mover.** `PATCH` devuelve 409 `albaran_locked`
  (`albaranes.routes.ts:321-323`), y `fecha` está dentro del hash canónico. El sello está a salvo
  por construcción.
* **El valor por defecto NO cambia.** Los albaranes nuevos se siguen creando con `now()`; los
  existentes no se tocan. Exponer el campo solo permite cambiarlo.

## Verificado en rojo

1. **El sello, saboteado.** Se hizo que `obraSegunVersion` ignorase la versión (el fallo exacto que
   el parámetro evita). **La primera tanda siguió EN VERDE**: el fixture v:1 tenía `Job.direccion` y
   `lugarEntrega` **ambos a null** —«lo realista»— y con las dos fuentes vacías leer una u otra da
   lo mismo. **Un caso mal elegido vuelve decorado el guard.** Con el fixture corregido
   (`jobDireccion` con valor, que es el caso del seed) el sabotaje **tumba** el test de
   retrocompatibilidad con su mensaje entero.
2. **Rojo por campo en el PDF.** Quitado el bloque de `firmadoPorCalidad` de
   `albaranPdf.service.ts`: el test cae nombrándolo — *«🔴 «firmadoPorCalidad» NO llega al PDF
   firmado»*— y los otros dos siguen verdes, así que el rojo señala al culpable.
3. **El lector del PDF, probado antes de fiarme de él.** La primera versión buscaba texto entre
   paréntesis y sacaba **0 caracteres**: pdfkit escribe en HEX dentro de `TJ`. Un extractor ciego
   habría dado verde en todos los tests de este fichero. Hay SUELO que lo comprueba.
4. **El guard de microcopy dio dos falsos rojos y se corrigió**: se cazaba a sí mismo en el
   comentario que explica la prohibición (el tropiezo clásico de los guards de texto aquí) y
   confundía «Otros gastos» con la ranura «Otro». Ahora mira **literales de cadena**, no
   subcadenas, con inyección y control negativo.
5. **`deriva-prod.sql`**: se le quitó una de las tres filas nuevas y su guard cayó nombrando el
   remedio.
6. **Un guard ajeno cazó mi prosa**: `scrum233-prosa-sin-url-insegura` se puso rojo por escribir
   la forma insegura de `migrate diff` literalmente en `MIGRATIONS_PENDING.md` para explicar que la
   evitaba. Tenía razón — un runbook enseña formas que se copian. Reescrito.

## Lo que NO cubre

* **La migración no está aplicada en ninguna de las tres bases.** Turno del fundador (staging →
  `yaqu_dev_javier` → producción). El preview se generó **sin tocar ninguna base**: `migrate diff`
  de datamodel contra datamodel, evitando `--from-schema-datasource` (habría conectado a la base de
  `.env`, que es producción).

  🔴 **EL ORDEN NO ES UNA RECOMENDACIÓN: schema PRIMERO, merge DESPUÉS.** Mergear dispara el
  auto-deploy de Railway desde `main`. Si el código llega antes que las columnas, el chequeo de
  arranque encuentra deriva y **la app NO ARRANCA** — `desenlaceDeArranque` devuelve
  `arranca: false` en `production` y `assertSchemaSinDeriva` lanza
  (`src/core/db/schemaDrift.ts:242-276`). No es un 500 en una ruta: es yaqu.app caída entera.
  Es la decisión correcta de SCRUM-222 («mejor no arrancar que arrancar mintiendo»), y aquí
  significa que invertir el orden es una caída total, no una degradación.

  **Y eso ya no cae sobre una demo:** el 5-ago-2026 se midió desde otro carril que hay **cuatro
  merchants reales en producción**, uno de pago con 31 presupuestos y 6 facturas desde mayo. La
  regla vigente decía que producción era toda fake y no lo es.
* **La matriz de dispositivos de AB6 NO está pasada** y se declara como hueco, no se finge. El
  banco es un Edge headless a dos anchos; eso no es la matriz. Pendiente: el `<select>` nativo de
  Safari iOS, el teclado en pantalla tapando el canvas, y el dedo con guante.
* **Microcopy: cerrada.** Los seis rótulos tienen aprobación explícita del 5-ago-2026 —«Fecha de
  entrega» del fundador; los otros cinco del asesor— y el censo anota **quién aprobó cada uno**,
  porque un texto aprobado sin rastro de quién lo aprobó vuelve a ser un texto que cualquiera
  cambia. Los dos del PDF se aprobaron **solo después de verlos literales**, con su razón: en un
  PDF que puede acabar en un juzgado no se aprueba un rótulo por su descripción. **No llevan el
  marcador `[PENDIENTE microcopy oficial]` y ya nunca lo llevarán**: un marcador impreso ahí sería
  peor que el rótulo. Guard aparte para el **espacio final** de los dos del PDF, que es funcional
  (`continued: true`): sin él sale «Firmado por:Marta».
* **No se verificó en `yaqu.app`**: sin la migración aplicada no hay nada que ver en producción.
* **No se tocó** el mecanismo de firma (se le añaden datos), el listado (C1), el detalle (C2) ni la
  conversión a factura (A0.4). Los tres campos quedan listos para que **C2 los pinte en su rail**.
* **`Job.direccion` sigue sin camino de escritura** (Bloque G). No bloquea: hoy el profesional
  escribe el lugar de entrega.

## Ficheros

* `prisma/schema.prisma` · `docs/MIGRATIONS_PENDING.md` · `docs/sql/deriva-prod.sql` — commit AISLADO
* `src/modules/jobs/domain/albaranFirmante.ts` (nuevo, fuente única de la microcopy)
* `src/modules/jobs/domain/albaran.service.ts` · `src/modules/jobs/infra/albaranPdf.service.ts`
* `src/modules/jobs/app/routes/albaranes.routes.ts` · `.../albaranPublic.routes.ts` · `src/app.ts`
* `public/dashboard/js/{app,signaturePad,jobDetailView}.js`
* `tests/scrum300-albaran-firmado-por.test.mjs` · `tests/scrum300-microcopy-firmante.test.mjs`
* `docs/diseno/bloque-c.md` (epic SCRUM-278 verbatim) · `docs/capturas/scrum-300/`
