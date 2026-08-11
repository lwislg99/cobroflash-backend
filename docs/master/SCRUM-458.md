# SCRUM-458 · El paquete de precarga (H1 · fase 2)

**Fecha:** 10-ago-2026 · **Carril:** H (offline) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `76163fc738e2e4bff1a11964c7ab0f338eed42c1` · 2026-08-10T22:47:45+01:00
**Tanda:** 2888 tests · 2814 pass · **0 fail** · 74 gateados · `npm test` exit **0** · `guards:entrada` 17/17

## La víctima, y por qué esto ya no es una comodidad

El fundador decidió que **no se crean albaranes sin red: solo se firman**. Eso convierte la
precarga en **mecanismo**: si el albarán no bajó, **no hay nada que firmar**. Antes, fallar costaba
comodidad. Ahora cuesta el trabajo del profesional.

## PASO 0

**a) ¿Estaba hecho?** No: `docs/master/SCRUM-458.md` no existe en `main` y no hay rama `scrum-458-*`.

**b) La premisa se sostiene**, medida sobre `origin/main`: no existe ningún productor de paquete de
precarga. Lo que hay de H1 es el almacén de SCRUM-455 (`guardarAlbaranPrecargado` /
`leerAlbaranesPrecargados`), que es **dónde se guardará**, no **qué se baja**.

**ENTRADA.** No había: se crea `src/modules/jobs/domain/precarga.service.ts`.

**MECANISMO.** Existen la FSM del Job (`JOB_STATES`, `job.service.ts`), la FSM del albarán
(`canTransitionAlbaran`, `albaran.service.ts`) y el almacén de 455. Nada que rehacer.

> ⚠️ **Y un aviso que no es de este carril: SCRUM-449 NO está en `main`.** Medido de tres formas —
> no es ancestro, `docs/sql/scrum-449-instalada-pwa.sql` no está en el árbol de `main`, y ningún
> commit cita el número—. La columna **sí** está aplicada en las tres bases; lo que falta en `main`
> es el registro. No bloquea esto.

## 🔴 Las dos cosas que se midieron en vez de elegirse

### ① Qué es «abierto» — se preguntó, no se eligió

La FSM del máster (Parte L) es `pendiente_agendar → agendado → en_curso → terminado → cerrado`.
**No existe ningún estado llamado `abierto`**: es prosa del máster («editable mientras el Job esté
abierto», SCRUM-66). Por eso esa palabra **no aparece en el código como si lo fuera**.

**Decisión del asesor: todo lo que no está `cerrado`** (los cuatro restantes). Y el motivo es suyo,
no el que propuse yo primero: la lectura «solo lo que aún tiene trabajo de campo» **solo es
correcta si el pro marca `terminado` DESPUÉS de que le firmen, y eso no está medido**. Ésta es
correcta en los dos órdenes. **No se elige la opción que depende de un comportamiento que no hemos
medido.**

**Y se escribe NEGADO —`status: { not: 'cerrado' }`—, no enumerando los cuatro. Eso es la mitad de
la decisión:** si mañana alguien añade un estado, enumerar **lo deja fuera en silencio** y un
fontanero se queda en un sótano sin nada que firmar; negado entra solo, y eso solo cuesta datos de
más. **Falla por el lado del que el profesional puede salir.**

Con **guard**, para que «entra solo» no sea «entra sin que nadie se entere»: un test enumera los
estados conocidos y **cae nombrando el nuevo** cuando aparezca uno. La inclusión se decide, no se
hereda.

### ② El ancla de «la última semana» — `updatedAt`, con su coste escrito

* `createdAt` mide cuándo **nació** el trabajo, no si sigue vivo. Uno creado hace tres semanas y
  tocado ayer se quedaría fuera, y es justo el que hoy hay que firmar.
* `scheduledAt` ya es el ancla de la población ①: usarla otra vez dejaría a la ② **sin aportar nada
  a quien no agenda**, que es su motivo entero de existir.
* «Última visita» (`max(Albaran.fecha)`) es la más precisa semánticamente, pero `Albaran.fecha` es
  **editable en borrador** y por defecto `now()`: es la fecha que el pro **declara**, no un registro
  de actividad. Anclar qué se precarga a un campo editable significa que corregir una fecha cambia
  lo que baja al móvil.

**Lo que `updatedAt` significa de verdad, medido en el código:** hay **dos** escrituras a `Job` en
todo el árbol (`prisma.job.update`, 2 sitios) — el `PATCH /admin/jobs/:id` del profesional y
`recalcJobCobradoForJob`, que dispara un **webhook de cobro**, no el pro. O sea que **no** significa
«el profesional lo tocó»: significa «algo pasó en este trabajo». Eso **ensancha la población, nunca
la estrecha**, y los dos fallos no cuestan igual.

> **✋ NO SE PUDO MEDIR CON DATOS.** En `yaqu_dev_javier` hay **5 trabajos y 0 filas con
> `updated_at > created_at`**: no hay distribución real que mirar. Lo de arriba es una medición del
> **código que escribe**, no del uso.

## Lo que se construye

**La unión, no la cascada, y deduplicada:** ① agendados para hoy y mañana **Y** ② no cerrados de la
última semana. **Las dos siempre.**

> ⚠️ **Y no se colapsan aunque se solapen, porque no miden lo mismo:** la ① mira **fecha agendada
> hacia el FUTURO** y la ② **recencia hacia el PASADO**. Un trabajo agendado para mañana pero sin
> tocar en tres semanas **solo lo coge la ①**, y hay test de ese caso exacto.

**El criterio vive en una función y solo en una.** El fundador dijo al decidirlo que «esto en un
futuro, con el uso de profesionales, quizás pueda cambiar»: cambiarlo tiene que ser cambiar **un
sitio**. Hay guard, y su lista de nombres se **deriva de los `export` del propio servicio** para que
un nombre nuevo quede vigilado sin que nadie se acuerde de venir a añadirlo.

### Qué lleva cada albarán — minimización por delante (art. 32)

**🔴 Solo bajan los `emitido`.** Sale de la FSM del albarán (`canTransitionAlbaran`): la **única**
transición a `firmado` es desde `emitido`. Un `borrador` **no se puede firmar** sin pasar por el
servidor, y un `firmado` no tiene nada que firmar. Bajar cualquiera de los dos sería bajar datos
personales **que no sirven para nada**, que es exactamente lo que el art. 32 prohíbe.

| baja | por qué |
|---|---|
| `id` | sin él no se puede llamar a `/firmar` |
| `numero`, `jobTitulo`, `clienteNombre` | identifican el documento: firmar el albarán equivocado en una obra es un error caro, y el nombre es la sugerencia de un toque del firmante (SCRUM-300) |
| `lineas`, `modoValoracion` | **un albarán que baja sin sus líneas es una pantalla vacía que invita a firmar algo que no se ha cargado** |
| `fecha`, `fechaEntrega`, `lugarEntrega`, `notas` | **contenido sellado** por la firma (`evidenciaFirma.v` = 2) |
| `estado`, `jobId` | para que la pantalla no invite a firmar lo que no se puede |

**No baja, y cada uno con su motivo:** teléfono, email y datos fiscales del cliente —no hacen falta
para firmar— · `evidenciaFirma` —lleva IP y user-agent, y no sale del servidor NUNCA (SCRUM-68)— ·
`signatureUrl` —solo existe si ya está firmado, y ésos no bajan— · `firmaToken` —es la credencial de
la página pública— · `pdfUrl` —una URL necesita red, que es justo lo que no hay— · presupuesto,
estado de facturación y pendientes —contexto de **cobro**, no de **firma**—.

### El suelo, que aquí decide si el mecanismo sirve

Si el paquete sale vacío, eso **no** es «no había nada que precargar». «No había nada» y «no supe
mirar» dejan al profesional **exactamente igual**: en el sótano, sin albarán, creyendo que iba
preparado. Por eso el resultado lleva **estado** (`LISTA` / `NO_SE_PUDO` con motivo) y **un fallo no
devuelve lista vacía**.

## El tamaño, medido — y cabe

| | |
|---|---|
| un albarán de 3 / 6 / 12 líneas | **805 / 1.155 / 1.834 bytes** |
| paquete de 5 / 25 / 100 albaranes (6 líneas) | **5,7 / 28,3 / 113,0 KiB** |

**Cabe de sobra en la cuota de cualquier móvil**, así que no es hallazgo. **El método, porque el
número sin él no vale:** no sale de datos reales —`yaqu_dev_javier` tiene **0 albaranes**— sino de
un albarán **sintético** con la forma real (`AlbaranLinea`) y textos de oficio, no relleno.

## Verificado

**11 tests.** **Seis rojos por el MECANISMO**, cada uno con post-condición en disco:

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | fuera la población ① (agendados) | 🔴 «no se ha contado el trabajo **AGENDADO**» · ««agendado hoy»: el criterio dice false» |
| **R2** | fuera la población ② (no cerrados) | 🔴 «no se ha contado el trabajo **NO CERRADO reciente**» |
| **R3** | la consulta de albaranes deja de filtrar por merchant | 🔴 «la consulta de `albaran` **NO filtra por merchant**… hoy sale bien por cómo está el fixture; mañana no» |
| **R4** | el fallo devuelve lista vacía | 🔴 «la consulta falló y el paquete dice estar LISTO con cero albaranes» |
| **R5** | se enumeran los estados en vez de negar | 🔴 «ha dejado de escribirse negada… enumerar deja fuera en silencio al que se añada mañana» |
| **R6** | bajan los albaranes no firmables | 🔴 «el paquete trae `["ALB-BORRADOR","ALB-EMITIDO","ALB-FIRMADO"]`… es bajar datos personales que no sirven para nada» |

**Aislamiento por merchant, por el MECANISMO y no por el resultado:** además de comprobar que no
aparece nada del otro profesional, se comprueba que **las tres consultas llevan `merchantId`**. Un
resultado limpio con un `where` sin filtrar es una coincidencia del fixture, no una garantía.

**Controles negativos:** un agendado para dentro de un mes y un no cerrado de hace dos meses **no
entran** · un merchant sin nada sale `LISTA` y **no** como fallo · el trabajo que cae en las **dos**
poblaciones se precarga **una** vez.

**Suelos, por separado:** el caso de deduplicación **exige** que el trabajo caiga en las dos
poblaciones antes de afirmar nada · el guard de estados falla si la FSM se vacía o si `cerrado` deja
de existir · el escáner del criterio único exige extraer ≥ 8 nombres exportados · el albarán
minimizado exige ≥ 8 campos antes de decir que no hay prohibidos.

**Y un rojo que nació de mi escáner, no del producto:** el guard del «criterio en un sitio» buscaba
primero `status: { not: 'cerrado' }` y señaló a `metrics.service.ts` y `teamOverview.service.ts`,
que lo usan para lo suyo. Es un **idioma genérico de Prisma**, no este criterio. Corregido a buscar
lo que sí sería una copia —que otro fichero **declare** un nombre del servicio—, porque un escáner
que da ruido acaba relajado hasta quedarse ciego (SCRUM-451).

## Lo que NO cubre

* **No se guarda nada en `albaranesPrecargados`.** Esta fase **produce** el paquete; bajarlo y
  guardarlo es la fase siguiente, que lo consume.
* **No hay ruta HTTP.** El servicio existe y está probado, pero **nadie lo llama todavía**: no hay
  endpoint ni disparador. Mencionar no es hacer, y esto está en la mitad de «hecho» que no se ve.
* **El estado `NO_SE_PUDO` no tiene superficie**: nadie lo pinta. Es H2 (SCRUM-356).
* **No se ha probado contra una base de verdad.** Los tests inyectan un Prisma de mentira; en dev no
  hay ni un albarán con el que ejercitar la consulta real.
* **El ancla `updatedAt` no está medida con datos de uso**, solo con el código que escribe.
* **El tamaño es sintético.** Si un merchant real acumulara albaranes mucho más largos, el número
  cambia; el orden de magnitud, no.

## Ficheros

* `src/modules/jobs/domain/precarga.service.ts` (nuevo) — el criterio, la ventana, la minimización
  y el constructor del paquete.
* `tests/scrum458-paquete-de-precarga.test.mjs` (nuevo, 11).
* `tests/scrum411-exports-inalcanzables.test.mjs` — el tope SUBE de 7 a 8, con fecha y motivo.
