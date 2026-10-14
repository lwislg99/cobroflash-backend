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
