# SCRUM-780 · El formato `F260001` en la factura — por CORTE, jamás por migración

**Fecha:** 7-sep-2026 · **Carril:** fiscal / documentos · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `9c989bf0ef2faa3db33d00cd06601c1664aa54fe` · 2026-09-07T08:11:26+01:00
**Tanda:** **5863 pruebas · 5761 en verde · 0 rojas · 102 saltadas** · 229,3 s · **salida real 0**
(comprobada con el codigo de salida REAL de `npm test`, no con `| tail`, que devuelve el de
`tail`: en la primera pasada eso habria leido **18 rojas como verde**)

**Firmas del fundador (7-sep-2026), las tres:** «Se adopta el F260001 desde ya» · corte por fecha
desde hoy, serie nueva que empieza en 0001 · **`invoiceSeriesPrefix` SE RETIRA** del número.
**Sin firmar y por tanto intacta:** la letra de la rectificativa, que se queda en `R`.

---

## LO QUE MANDA, Y POR QUÉ NO ES UNA PREFERENCIA DE FORMATO

**REGLA 29:** una factura EMITIDA no se edita, no se borra y **no se renumera**. La regla no
distingue si el merchant era de prueba — distingue **si el documento salió**. El fundador añadió
que todos los merchants son de prueba; eso **no se ha usado como permiso**, y por eso el diseño es
un corte y no una migración: **ni una sola factura ya emitida cambia de número.**

De ahí sale la forma del código, y es lo único que hay que recordar: **el formato no se decide por
lo que hay configurado hoy — se decide por LA FECHA DE LA FACTURA**, que es un dato de la factura y
no cambia nunca. Decidirlo por configuración haría que el pasado cambiara cada vez que alguien
toca una preferencia.

---

## OBLIGACIÓN 0 · dónde viven esas facturas. MEDIDO, no supuesto

Lectura directa contra la base, sin imprimir credenciales (regla R7):

| | |
|---|---|
| **clave** | `DATABASE_URL_DEV` |
| **host** | `acela.proxy.rlwy.net` |
| **base** | `yaqu_dev_javier` |
| **facturas totales** | **5** — y ninguna de otro formato |

| merchant | número | tipo | `createdAt` |
|---|---|---|---|
| 1 | `2026-FG-001` | F1 | 2026-08-19T11:30:00Z |
| 1 | `2026-FG-002` | F1 | 2026-08-23T11:30:00Z |
| 1 | `2026-FG-003` | F1 | 2026-09-02T11:30:00Z |
| 1 | `2026-FG-004` | F1 | 2026-09-04T11:30:00Z |
| 1 | `2026-FG-005` | F1 | 2026-09-03T11:30:00Z |

🔴 **El 004 es POSTERIOR al 005 en fecha.** No es una errata de la medición: **la secuencia no va
en orden de fecha**. Por eso el corte se decide con la fecha de CADA factura y nunca con «el número
es menor que N», que es la forma en que esto se habría hecho mal sin que nada lo delatara.

**Contadores medidos:** merchant 1 → `invoiceSeriesYear=2026`, `nextInvoiceNumber=6`,
`nextRectInvoiceNumber=1`. Los otros cinco merchants (2, 114, 173, 210, 742) están todos en
`nextInvoiceNumber=1` y sin año de serie: **nunca han emitido**.

### NO MEDIBLE, y se declara

- **PRODUCCIÓN.** No hay credencial en este árbol y no se ha pedido. El `.env` sólo declara
  `DATABASE_URL_DEV`, `_STAGING` y `_TESTS` — **no existe `DATABASE_URL`**, que es lo que la regla
  3 de `CLAUDE.md` ya registraba. **No sé cuántas facturas hay emitidas en producción ni con qué
  prefijos.** El diseño no necesita esa respuesta: el corte es por fecha, así que lo que haya allí
  conserva su número sea lo que sea.
- **STAGING.** No medido **por regla, no por incapacidad**: el encargo prohíbe tocarlo.

---

## LO QUE SE CONSTRUYE

### ① El formato, en el punto único — y una corrección al encargo

El encargo situaba `formatInvoiceNumber` en
`src/modules/billing/invoicing/domain/invoiceNumber.service.ts:183`. **Esa ruta no existe.** La
real es `src/modules/invoicing/domain/invoiceNumber.service.ts:183` — sin `billing/`. La línea
acertaba; la carpeta no.

**La afirmación del encargo sobre `huecosSerie` SÍ se verificó** en vez de heredarla: ese módulo
**compone** con `formatInvoiceNumber` en lugar de parsear (lo dice y lo hace, y desde SCRUM-306
hasta acepta un `componer` inyectable). Con eso, el cambio de formato vive de verdad en un sitio.

```ts
export const CORTE_FORMATO_F = Object.freeze({ desde: new Date('2026-09-07T00:00:00.000Z') });
formatInvoiceNumber(prefix, year, seq, rectifying, emitidaEn?, corte?)
```

- **La fecha de corte es UN DATO con nombre**, no una condición dentro de un `if`. Quien la mueva
  está renumerando facturas ya emitidas, y eso tiene que verse en el diff.
- **Sin fecha se formatea como siempre.** No es comodidad: es lo que protege a los llamadores que
  componen números ya emitidos sin conocer su fecha (`huecosSerie`, `vistaPreviaSerie`). Si al no
  saber la fecha esto eligiera el formato nuevo, el detector de huecos dejaría de reconocer lo ya
  emitido y lo daría por perdido.
- **El instante exacto del corte cae del lado nuevo** (`>=`): con el borde abierto quedaría un
  instante sin formato definido.
- **La letra `F` sale del sitio único** (`core/documentos/formatoNumero`), el mismo que compone
  `P260001` y `AB260001`. Escribir aquí una segunda plantilla es el defecto que ese módulo existe
  para impedir.

En `formatoNumero.ts` había escrito, con su motivo: «LA FACTURA NO ENTRA AQUÍ… su formato lleva
prefijo por merchant, migrarla lo perdería». **Era cierto y ha dejado de serlo** al retirarse el
prefijo. No se ha borrado la frase: se ha escrito encima, con la fecha y la firma, porque un motivo
retirado en silencio se vuelve a discutir dentro de seis meses sin que nadie sepa qué se decidió.

### ② La serie F empieza en 0001 — y el contador viejo no puede darlo

El fundador firmó que `F26xxxx` es una serie **nueva, que empieza en 0001 y es correlativa dentro
de sí misma**. `nextInvoiceNumber` **no puede darla**: en dev vale 6 para el merchant 1, que ya
gastó `2026-FG-001..005`. Con él, su primera factura del formato nuevo saldría `F260006` y **la
serie F nacería con cinco huecos imposibles de cerrar** — cerrarlos exigiría renumerar.

Un contador propio querría una columna nueva y el schema es del fundador, así que **se DERIVA de lo
ya emitido**, que es la única fuente que no puede desincronizarse de la realidad.

🔴 **Es seguro porque vive DENTRO del cerrojo.** `allocateInvoiceNumber` toma
`pg_advisory_xact_lock` como primera sentencia, así que dos emisiones del mismo merchant no pueden
derivar el mismo máximo. Fuera de él sería un read-then-write con carrera: el defecto exacto que
arregló SCRUM-234.

**Se toma el MÁXIMO, no el recuento.** Con un hueco, contar devolvería un número ya emitido y el
índice `@@unique([merchantId, number])` tumbaría la emisión con un 500 — y la emisión era válida.

**`nextInvoiceNumber` NO retrocede** (`Math.max`). Bajarlo de 6 a 2 dejaría el contador de la serie
vieja apuntando a `2026-FG-002`, que ya existe. **Medido: los 7 llamadores de
`allocateInvoiceNumber` usan el reloj real** (ninguno pasa `now`), así que hoy no puede emitirse un
número del formato viejo. **Precisamente por eso el diseño no se apoya en ello**: conservando el
máximo, el duplicado deja de ser posible aunque mañana alguien emita con fecha pasada.

### ③ La vista previa, que si no mentiría

`vistaPreviaSerie` es la puerta de última oportunidad. Con el contador viejo enseñaría `F260006`
mientras la emisión saca `F260001`. Ahora recibe la fecha y la secuencia derivada, y **lanza si le
falta** en vez de adivinar: prometer un número que no va a salir es peor que no prometer ninguno,
porque el profesional confirma creyendo que sabe qué confirma.

---

## LOS TRES CONTROLES QUE PIDE EL ENCARGO

| | qué prueba |
|---|---|
| 🔴 **EL QUE DECIDE** | Los **cinco números REALES de dev**, con su fecha medida, compuestos después del cambio: salen **byte a byte iguales**. No son inventados — un caso inventado prueba lo que yo creo que hay. Va con **suelo propio**: si la lista se vaciara, el caso pasaría sin comprobar nada. |
| ✅ **POSITIVO** | Una factura del día del corte y posteriores sale `F260001`, `F260007`, `F270001`… y **los cinco prefijos posibles dan el MISMO número**, que es la retirada del prefijo comprobada y no afirmada. |
| 🔴 **SUELO** | Con **los mismos argumentos y dos fechas de distinto lado**, el formateador tiene que dar **dos respuestas distintas**. Un formateador que devolviera siempre lo viejo pasaría el control que decide; uno que devolviera siempre F pasaría el positivo. Sólo este suelo prueba que **la fecha decide**. Más un suelo de que el corte está ENCENDIDO y es la fecha firmada. |

**El rojo se provocó ANTES:** con el test escrito y el código sin tocar, los controles positivos y
los suelos salieron rojos (6 de 9) y **el control que decide salió VERDE** — como tenía que ser,
porque describe lo que no debe cambiar. Después del cambio: 13 de 13.

---

## LA RECTIFICATIVA · sin firmar, se queda en R — y no es cosmético

`usaFormatoF` la **excluye explícitamente**. El motivo está probado en el test y no es de estilo:

Las dos series tienen **contadores independientes** (`nextInvoiceNumber` y
`nextRectInvoiceNumber`), así que la ordinaria y la rectificativa pueden estar las dos en el seq 3
a la vez. Metida en `F` **sin letra propia**, una `F260003` ordinaria y una `F260003` rectificativa
**chocarían** en cuanto un merchant emita tres de cada — y con `@@unique([merchantId, number])` la
segunda emisión, que era válida, revienta con un 500.

⇒ **Un formato F para la rectificativa necesita letra propia, y esa letra es decisión del
fundador.** Hasta entonces: `2026-CF-R-003`, con su contador y su reinicio anual propios, intacta.
**Aquí me paro**, que es lo que pedía el encargo.

---

## (a) `invoiceSeriesPrefix` · QUÉ QUEDA APUNTANDO A UN CAMPO QUE YA NO DECIDE

**Medido: 63 ocurrencias.** No se ha borrado nada — el encargo pedía medir y proponer.

| capa | dónde | estado tras el corte |
|---|---|---|
| **UI profesional** | `public/dashboard/js/settingsView.js` (Configuración → Facturación, `settingsSubmenus.js`) | **ofrece configurar algo que ya no decide el número** |
| **UI admin** | `public/admin.html:447` — rótulo «Serie factura (prefijo)» | ídem |
| **API** | `src/core/validation/schemas.ts:443` (zod), `src/modules/system/merchantAdmin.ts` (PATCH), `src/app.ts` (`/admin/onboarding/serie`) | siguen aceptándolo y validándolo |
| **Barrera** | `bloqueoCambioDeSerie` (`src/core/validation/fiscalInput.ts:154`) | **NO está muerta — ver abajo** |
| **Tests** | 23 ficheros lo mencionan | |

🔴 **LO QUE CORRIGE A LA PREGUNTA (a):** el enunciado da por hecho que la barrera de SCRUM-291
queda «vigilando un campo que ya no decide nada». **Medido, eso es sólo medio cierto y la otra
mitad importa:** `huecosDeLaSerie` compone los números esperados **con el prefijo ACTUAL**. Las
facturas anteriores al corte se compusieron con el prefijo de entonces, así que **si alguien cambia
el prefijo hoy, las facturas viejas dejan de casar y salen reportadas como `ajenos`**. La barrera
sigue protegiendo algo real: **la capacidad de reconocer lo ya emitido.** Lo que ha cambiado no es
si sirve, es **su motivo** — y borrarla por «campo muerto» rompería el detector de huecos para todo
lo anterior al corte.

**PROPUESTA, no ejecutada:**
1. **Conservar** `bloqueoCambioDeSerie` y **reescribir su motivo** en el código: ya no protege el
   número futuro, protege la legibilidad del pasado.
2. **Marcar la UI como histórica**, no retirarla: el campo sigue describiendo cómo se numeró lo ya
   emitido. Retirar el control sin más dejaría al profesional sin explicación de por qué sus
   facturas viejas se llaman `2026-FG-…`.
3. **La API deja de aceptar cambios** (pasa a sólo lectura) en un ticket propio. Hoy sigue
   aceptándolos, y ése es el hueco que queda abierto y declarado.
4. **No tocar el schema.** El campo debe seguir existiendo: es lo que explica los números viejos.

### 🔴 UN HUECO MÁS QUE NO ESTABA EN EL ENCARGO, y queda abierto

`huecosDeLaSerie` compone **sin fecha**, así que después del corte compone el formato **viejo** para
2026 y **reportará todas las facturas `F26…` como `ajenos`**. No lo he tocado —el encargo prohíbe
tocar el mecanismo de SCRUM-291— y no es un fallo silencioso: el módulo ya tiene el asiento
inyectable (`componer`, SCRUM-306) que lo resuelve pasándole un compositor con fecha. **Ticket
propio.** Lo digo porque un detector que reporta como ajeno todo lo nuevo se acaba ignorando, y el
día que cace un hueco real ya nadie lo mirará.

---

## EL SELLO DEL EMISOR, Y POR QUÉ SE TOCA

`tests/scrum291-series-huecos.test.mjs` sella el SHA-256 de `invoiceNumber.service.ts` para que
tocar el camino de emisión exija GO. **Avisó, como debe.** El GO existe y está firmado en el
encargo, así que el hash se actualiza **en el mismo commit que el cambio** —que es lo que el propio
guard pide— con el diff descrito: qué cambió y, sobre todo, **qué NO**: el `pg_advisory_xact_lock`
sigue siendo la primera sentencia con el mismo namespace, el `recordAuditOrThrow` sigue en la misma
`tx` y en el mismo punto, el reinicio anual y los dos contadores siguen donde estaban, y el
justificante no consume serie fiscal.

## LA TANDA ME CAZÓ CUATRO COSAS, Y LAS CUATRO TENÍAN RAZÓN

Primera pasada: **18 rojas, salida real 1**. Ninguna era ruido.

| guard | qué cazó | cómo se arregló |
|---|---|---|
| **SCRUM-219** · tx tipada | `leerSeqDeLaSerieF(prisma)` recibía el cliente GLOBAL en un parámetro tipado `Prisma.TransactionClient`, y **compila limpio** porque es un `Omit<PrismaClient>` | se declara `LectorDeFacturas`, **exactamente lo que la función usa**. No se hace excepción al guard: se deja de pedir lo que no se necesita |
| **SCRUM-313** · la vista previa no reimplementa | le añadí `usaFormatoF` a la línea de import que el guard vigila | import aparte; la línea vigilada queda intacta |
| **SCRUM-411** · exports huérfanos | `CORTE_FORMATO_F` y `siguienteSeqDeLaSerieF` sin declarar | declarados con categoría y motivo |
| **7 dobles de `tx`** | la lectura nueva no existía en ninguno | `findMany: async () => []` |

**Comprobado el código de salida DE VERDAD**, no el de `tail`: la tanda se escribe a fichero y el
`$?` se anota en la misma línea. Con `npm test | tail` las 18 rojas se habrían leído como verde.
