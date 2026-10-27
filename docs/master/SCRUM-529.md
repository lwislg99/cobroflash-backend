# SCRUM-529 · Cada envío de WhatsApp guarda a qué número se mandó (`toPhone`)

**Medido contra:** `origin/main` = `1d338a5ae8afa6166282c28e7a8c818c5375a856` · 2026-10-14T01:49:44Z

A9: sin fallo que generalice — una de mis tres mutaciones no llegó a aplicarse (un `sed` que no casó) y salió «12 de 12» como si el test no la viera; lo delató el `git diff --numstat` vacío impreso al lado, que ya es norma (A23 nº 8), y se repitió bien

14-oct-2026 · **J2** (sesión `jv-j2a`, equipo de Javier). [Escrito por la sesión, no por Javier ni por su orquestador.]

## Qué estaba decidido, y qué no

- **Decidido:** guardar el destinatario. Jira c.16296 (21-sep-2026): «Fundador (21-sep): SÍ al ALTER aditivo
  `toPhone String? @map("to_phone")` en WhatsAppMessage». ⚠️ Límite: en Jira todo lo del equipo de Luis sale
  bajo la misma cuenta; ese comentario se presenta como del fundador y no lleva marca de sesión, pero su
  autoría no se ha comprobado en origen. Su contenido casa con el registro del ALTER.
- **Quién lo construye:** J2. Los dos ficheros donde se escribe el dato son de J2 (`dos-equipos.md:124`,
  medido con `node scripts/carriles.mjs de <ruta>`, control: `src/core/cron/cron.ts` → S1). El equipo de Luis
  lo pidió en c.19412 y el orquestador de Javier pasó el ticket de `area-s1` a `area-j2` el 14-oct-2026.
- **No decidido aquí, y no se toca:** auditar el CAMBIO de teléfono de un cliente (c.16296 lo saca a ticket
  aparte).

## El orden del esquema (A5)

| paso | estado | quién lo midió |
|---|---|---|
| ① decisión | c.16296 | — |
| ② ALTER en desarrollo | aplicado el 28-sep-2026 (0/1 → 1/1 por catálogo) | J6, en `docs/MIGRATIONS_PENDING.md`, «LOTE DE 7» |
| ② forma de la columna en desarrollo | `text`, admite nulos, sin valor por defecto | el orquestador de Javier, 14-oct-2026, leyendo el catálogo (con control positivo y negativo). No yo |
| ② ALTER en staging y producción | consta aplicado y verificado 23/23 el 29-sep-2026 | Javier, a mano, según ese mismo registro. Comprueba que la columna EXISTE |
| ② forma de la columna en staging y producción | **NO MEDIDO** | nadie: este árbol no tiene ninguna clave de base, y esas dos son del fundador |
| ③ esquema + código + tests | este PR | — |

DDL: `docs/sql/scrum-529-to-phone.sql`. Yo no he medido ninguna base: lo de arriba es lo que dicen el
registro y el orquestador.

## Lo pedido → dónde se ve

| «Hecho =» del ticket | dónde se ve |
|---|---|
| El campo en el esquema | `prisma/schema.prisma`, modelo `WhatsAppMessage`: `toPhone String? @map("to_phone")`, sin `@default` |
| Poblado en cada envío | `src/integrations/whatsapp.ts` (los 15 apuntes y la reserva de la plantilla) y `src/modules/messaging/domain/whatsappLog.service.ts` (`recordWaMessage` y `reservarPlantilla`) · `tests/scrum529-a-que-numero-se-envio.test.mjs` |
| La migración registrada en las tres bases | `docs/MIGRATIONS_PENDING.md`, «LOTE DE 7» (registro del 28 y 29-sep; no lo he tocado) |
| Verlo en yaqu.app | **NO HECHO** → no hay pantalla que lo enseñe, y la fila de producción sólo la puede leer un jefe |

## Qué se guarda

El número **tal cual se le da al proveedor** (`params.to`), no el de la ficha del cliente: la ficha se
corrige, y ése era el defecto. Lo llevan las filas de los envíos que salen, las de los que no salen
(sin credenciales, baja, tope, rechazo) y la reserva en cola de la plantilla, que nace antes de hablar con el
proveedor. El mensaje ENTRANTE se queda a `NULL`: no se mandó a ningún número. Las filas anteriores a este
cambio también, y no se rellenan.

En el tipo, `toPhone` es obligatorio en `recordWaMessage` y en `reservarPlantilla`: un envío nuevo que no lo
pase no compila.

## Lo medido

- **El test, 12 casos, 12 pasan.** Cubre en marcha los 15 apuntes de `whatsapp.ts` (7 fallos, 5 envíos, la
  plantilla sin reserva y los dos de ventana-first) y la reserva; un caso por árbol sintáctico comprueba que
  son 15 y 1, y que todos toman el número de `params.to`.
- **Visto en rojo, 3 mutaciones de 3**, cada una con su `git diff --numstat` y con `dist/` reconstruido:
  la reserva no escribe el número (cae 1) · `recordWaMessage` no lo escribe (caen 7) · un apunte lo toma de
  otro sitio (caen 2). Base sin mutar antes y después: 12 de 12.
- **Quién lee la tabla:** 6 lecturas fuera del servicio. Cinco llevan `select` sin la columna. La sexta, el
  paquete de disputa (`invoicesAdmin.routes.ts:363`, de J1), lee la fila entera pero su plantilla imprime
  sólo fecha, tipo, plantilla, documento y estado: el número no sale en ese documento.

- **Vecinos: 194 ficheros de test** (los que leen el esquema, el canal, el doble de envío y los guards de
  suite), 1.927 casos: 1.891 pasan, 24 se saltan, **12 caen**. Tres eran de este cambio y están arreglados:
  - `docs/sql/deriva-prod.sql` no preguntaba por la columna (dos tests). Lleva ahora 513 pares. No se pudo
    regenerar con su script: usa el cliente de Prisma, y el de este árbol es el del checkout compartido.
    Se sacó con la función de la casa (`generarSql`) sobre los 512 pares del fichero más el nuevo, con el
    control de que esa función reproduce el fichero de partida byte a byte. El CI lo compara con el
    cliente recién generado: si no coincide, cae ahí.
  - Una coordenada de `docs/legal/AUDITORIA_CAMINO_EMISION.md` apunta a `prisma/schema.prisma` por número
    de línea, y la columna la desplazaba tres líneas. Por eso va en una línea que estaba en blanco: el
    esquema tiene las mismas 1.838 líneas que en `main` y ningún documento cambia.
  Los otros nueve no son de este cambio: seis comparan el esquema con el cliente de Prisma compartido, al que
  le falta también `quotes.series_year`, y tres piden el CLI de Prisma, que este árbol no tiene. Tras los
  arreglos se repitieron los ficheros afectados (79 casos: 74 pasan, 2 se saltan, 3 caen, los tres por ese
  cliente). La tanda de 194 NO se repitió entera después.

## 🔴 El hueco que este cambio abre, y que NO se cierra aquí

`to_phone` es un teléfono de cliente guardado fuera de `customers`.

- **Borrado de un comercio:** cubierto. `borradoMerchant.ts` borra `whatsAppMessage` entero.
- **Anonimizado de un comercio (art. 17, conserva las filas):** NO cubierto. `CAMPOS_PERSONALES`
  (`anonimizarMerchant.ts`, de J3) no tiene `whatsAppMessage`: el teléfono de la ficha se redacta y el mismo
  número queda en claro en esta columna.
- **El guard que existe para esto no lo ve.** `tests/scrum497-dato-personal-no-sobrevive.test.mjs` casa los
  nombres de columna uno a uno contra una lista (`tests/_censo-datos-personales.mjs`), y `toPhone` no está.
  Corrido con su propia función sobre el esquema de `main` y sobre el esquema con esta línea: 33 columnas
  personales en los dos, ninguna nueva. Control: sí ve `customer.phone`.
- **El precedente** es `emailMessage.toEmail` (SCRUM-497), decidido en ese mismo fichero: se anonimiza, no se
  borra — la fila acredita el envío y lo que desaparece es la dirección.

No se arregla aquí: el fichero es de J3 y tocar la supresión de datos de clientes lo decide un jefe.
**Orden acordado con el orquestador (14-oct-2026, confirmado por el fundador según su mensaje): J3 entra
primero y este PR se empuja detrás.** Lo que entra primero es la pieza concreta: `whatsAppMessage: ['toPhone']`
en `CAMPOS_PERSONALES` y `toPhone` en el vocabulario del censo. Que el censo sólo vea los nombres que alguien
le escribió es otro asunto, más grande, y va en SCRUM-1547: este PR no lo espera. No existe supresión de
cliente final, así que ahí no hay nada que alcanzar.

## Lo que NO se ha medido

- Ninguna base, por mí. La forma de la columna en staging y en producción, por nadie.
- La suite completa en este árbol: su `dist/` se construye sin comprobar tipos y con el cliente de Prisma
  del checkout compartido, que no conoce la columna. Los tipos los comprueba el CI.
- El preview de la migración (`preview-migracion.mjs --desde`): no arranca aquí, por el mismo CLI que falta.
- Que una fila real de producción lleve el número después del despliegue.

---

# SCRUM-529d · El relevo: las tres piezas en UN PR, medidas juntas

**Medido contra:** `origin/main` = `cb30885dd69c4df7f33d3a0066fed93698926857` · 2026-10-14T02:14:00Z

A9: comprobación → `tests/scrum244-supresion-y-anonimizado.test.mjs`

14-oct-2026 · **J2** (sesión `jv-j2b`, relevo de `jv-j2a`; equipo de Javier). [Escrito por la sesión, no por
Javier ni por su orquestador.] La línea `A9:` la propuso `jv-j3a`: el caso CONTRA POSTGRES de ese test es
quien impide que una clave entre en `CAMPOS_PERSONALES` sin su columna en el esquema.

## Qué cambia respecto al tramo de arriba

El tramo de arriba dice «J3 entra primero y este PR se empuja detrás», y que el hueco del anonimizado «NO se
cierra aquí». **Las dos frases quedan superadas** y se dejan como se escribieron, con su ancla: son lo que se
midió entonces. `jv-j3a` midió que el orden en dos PR no existe (Jira c.19514): `suprimirMerchant` recorre
todas las claves de `CAMPOS_PERSONALES`, y con `whatsAppMessage: ['toPhone']` sin la columna declarada le pide
a Prisma un campo que el cliente no conoce.

**Autorización:** Jira SCRUM-529 c.19515 (14-oct-2026), escrita por el orquestador de Javier recogiendo la
decisión del fundador: opción B1, un solo PR con la columna, la escritura y la pieza de supresión. Ahí mismo
declara el cruce de carril: `anonimizarMerchant.ts` es de J3 y entra en este PR de J2. Cubre eso y sólo eso:
no se toca `borradoMerchant.ts`, ni el camino de emisión, ni nada más del esquema.

## Qué trae este PR

Dos commits traídos por `cherry-pick`, **sin conflicto y sin tocar una línea de ninguno**, más el merge de
`origin/main` (que no toca ninguno de los 11 ficheros):

| de quién | commit de origen | ficheros |
|---|---|---|
| `jv-j2a` (J2) | `2b2bb6c1d353a9dcc5f8df8fe51266fc103c8413` | esquema, `whatsappLog.service.ts`, `whatsapp.ts`, su test, `docs/sql/deriva-prod.sql`, este registro |
| `jv-j3a` (J3) | `65310ab34ed215502170a9ae7623a2a508b92d47` | `anonimizarMerchant.ts`, `tests/_censo-datos-personales.mjs`, `scrum244`, `scrum440`, `scrum497` |

Mío es este tramo del registro y, **de paso**, una línea del test de 529: quitaba el comentario de la línea
del esquema con un filtro propio que corta en cualquier barra doble, y el trinquete de SCRUM-700 (filtros que
ciegan código, tope 7) subía a 8. El primer obligatorio de este PR cayó por eso. Ahora usa `soloEjecutable`
de `tests/_guard-texto.mjs`. Visto pasar (12 de 12), caer con un `@default` puesto en la columna (cae 1, el
caso del esquema; `numstat` 1/1) y volver a pasar con el esquema restaurado. Mi tanda de vecinos no llevaba
`scrum700`: no nombra nada de lo que usé para elegirlos.

**Y ese arreglo trajo otro rojo, mío:** llamé a `soloEjecutable` a secas, y `scrum719` (SCRUM-1395 ②) no deja
que un test nuevo llame al filtro sin suelo. El segundo obligatorio cayó por eso. Ahora es `ejecutableDe` con
el ancla `toPhone`. Antes del tercer empujón corrí lo que debí correr antes del segundo: los 175 ficheros de
`tests/` que barren la propia carpeta de tests (más `scrum237`, `scrum976`, `scrum1415`, `scrum1387`): 1.763
casos, 1.761 pasan, 1 se salta y cae 1, `scrum476`, que es de los 13 del árbol (no hay `node_modules` aquí).
El caso del esquema, otra vez: cae 1 con el `@default` puesto (`numstat` 1/1) y 12 de 12 al restaurar.

Los dos obligatorios que cayeron, leídos por nombre (11.408 casos, 11.317 pasan, 89 se saltan, 2 caen en cada
uno): el primero, `SCRUM-700` y `SCRUM-1387`; el segundo, `SCRUM-1395 ②` y `SCRUM-1387`. `SCRUM-1387` no es de
este PR: nombra `docs/master/evidencias/SCRUM-1544/mutaciones.mjs`. En los dos pasaron los dos casos que sólo
el CI podía decidir: `scrum222` (el SQL de deriva) y `scrum244 · CONTRA POSTGRES`.

## Lo medido, los dos commits JUNTOS sobre el merge

`dist/` reconstruido con `tsc --noCheck` (salida 0) después del merge.

- **Los cinco ficheros del cambio** (`scrum529`, `scrum244`, `scrum440`, `scrum497`, `scrum525d`): 47 casos,
  46 pasan, 0 caen, 1 se salta (`scrum244 · CONTRA POSTGRES`, sin `LIBRO_PG_URL`).
- **Vecinos: 463 ficheros de los 1.332 de `tests/`**, elegidos por contenido (los que nombran el canal, el
  esquema, la supresión, el SQL de deriva o `docs/master`) más los guards de suite por nombre. 4.283 casos:
  4.214 pasan, 56 se saltan, **13 caen**, en 7 ficheros.
- **Los 13 son del árbol y no del cambio, medido y no supuesto:** esos 7 ficheros corridos sobre un árbol
  fijado a `origin/main` @ `cb30885dd…`, construido igual, dan 98 casos, 82 pasan, 3 se saltan y **caen los
  mismos 13** (los dos conjuntos de nombres, comparados uno a uno: idénticos). Causas que nombran los
  propios tests: el cliente de Prisma es el del checkout compartido y le falta `Quote.seriesYear`
  (`scrum235`, `scrum252`, `scrum461`, `scrum222`), y este árbol no tiene `node_modules` propio, así que no
  encuentran `tsc` ni el CLI de Prisma (`scrum245`, `scrum475`, `scrum476`).
- **El esquema conserva sus 1.838 líneas** después del merge, las mismas que `origin/main`
  (`numstat` 1/1): la coordenada de `docs/legal/AUDITORIA_CAMINO_EMISION.md` no se mueve, y `scrum525d` pasa.
- **`docs/sql/deriva-prod.sql`** difiere de `main` en dos líneas: la cabecera (512 → 513 columnas) y el par
  `('whatsapp_messages','to_phone')`, en su sitio alfabético.

## Lo que NO se ha medido

- En local, que `docs/sql/deriva-prod.sql` sea byte a byte lo que saca el generador con un cliente al día:
  `scrum222` cae aquí igual en la rama que en `main` (el cliente compartido da 511 columnas). **Lo midió el
  CI: pasa** (arriba).
- En local, `scrum244 · CONTRA POSTGRES`: se salta aquí. **Lo midió el CI: pasa** (arriba).
- Las mutaciones de los dos tramos de origen no se repitieron sobre el merge.
- La suite completa (869 ficheros no entraron en la tanda) y la comprobación de tipos: CI.
- Ninguna base. La forma de `to_phone` en staging y producción sigue sin medir por nadie.
- El valor de `MERCHANT_DELETE_ENABLED` en Railway.
