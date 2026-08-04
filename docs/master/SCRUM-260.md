# SCRUM-260 · LIMPIEZA-CIEGA-1 (2ª mitad): con turno ajeno vivo, `--apply` ya no basta

**Fecha:** 3-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `dd61eb09b7a22121217c19dbbdd2ec13ab939873` · 2026-08-03T20:15:13+02:00
**Tanda:** 1163 tests, 1096 pass, 0 fail (el resto, gateados a staging)

## El defecto que quedaba

La primera mitad de este ticket (`33e0524`, `05e458c`) dejó la **constancia** hecha y bien —el
rastro se escribe **antes** de borrar, así que si un delete revienta a mitad la fila ya está a
salvo— y el **aviso** puesto. Pero el aviso se imprime justo antes de borrar y no frena nada: quien
lanza `--apply` desde otra máquina sigue sin poder evitar borrar las fixtures **vivas** de la tanda
de otra persona. Un aviso que llega a la vez que el daño informa, no protege.

El alcance declarado pedía las dos cosas —«avisar **y exigir confirmación explícita**»— y solo
estaba la primera.

## La decisión, y por qué las dos mitades pesan igual

**Con turno AJENO vivo, `--apply` exige `--pisar-turno-ajeno`; sin la bandera sale sin borrar nada
y con código 3.** Con turno **propio** o **sin turno**, se comporta como siempre.

La segunda mitad no es un detalle: *no bloquear a ciegas* es parte del enunciado, y una herramienta
manual que se planta cuando no toca **se acaba puenteando** — y entonces deja de proteger también
cuando sí tocaba. Por eso los controles pesan tanto como el caso que bloquea.

**Vigencia con el criterio de SCRUM-266,** no con uno nuevo: `decidirVigencia` mira el compromiso
publicado y solo cae al TTL supuesto si no hay ninguno. Un turno **caducado** es reclamable por
contrato, así que no bloquea: bloquear por un lock muerto sería justo el estorbo de arriba.

**«Propio» se decide por `YAQU_LOCK_DUENO`**, la misma convención que ya usa `tests/_staging-db.mjs`
para no avisarse a sí mismo. No se inventa una segunda forma de responder «¿este turno es mío?».

### Por qué la bandera NO se llama `--force`

El enunciado decía «`--force` o equivalente». Se eligió el equivalente, y por una razón concreta:
en esta casa `--force` es una **prohibición de git (AA2)** que un hook bloquea al verla escrita —
documentar este comando con ese nombre sería imposible sin disparar el guard (pasó al escribir este
mismo ticket). Además `--pisar-turno-ajeno` dice **qué** se pisa, que es lo que uno quiere leer en
el historial de la terminal seis meses después.

## El suelo · no poder leer el turno NO es «no hay turno»

El código anterior hacía `leerMarcaCruda(prisma).catch(() => ({ marca: null }))`: un fallo de
lectura y una base sin turno **eran el mismo valor**, así que la limpieza seguía adelante
precisamente cuando no sabía nada. Es el fallo mudo de este ticket con otra cara.

Ahora la lectura conserva su fallo (`{ok:false, error}`) y hay **dos** estados que no se pueden
confundir con «vía libre»:

- **lectura caída** → `ilegible`;
- **marca presente que `parsearLock` no entiende** (formato cambiado, esquema movido) → `ilegible`,
  y este es el peor sitio para suponer: sabemos que **hay** algo escrito y no de quién.

Los dos exigen la bandera. **Ruidoso, no permisivo.**

## Lo que también cambió, y por qué no es cosmético

- **El comentario «Es manual: se avisa y se sigue» está fuera.** Describía el comportamiento viejo,
  y un comentario así es peor que ninguno porque el siguiente se lo cree.
- **`mensajeAviso` ya no promete «(no bloquea)»**, por lo mismo — y lo leería justo el operador al
  que sí se le va a bloquear. Hay un test que ahora exige que **no** lo diga.
- **Un `--apply` rechazado consta en el rastro como `RECHAZADO-<motivo>`**, ni `SI` ni `dry-run`.
  `SI` afirmaría un borrado que no ocurrió; `dry-run` sería indistinguible de una pasada de prueba
  — y «¿alguien **intentó** limpiar durante mi tanda?» es justo lo que este rastro existe para
  responder. `componerEntrada` acepta ahora una cadena además de `true`/`false`, con control de
  no-regresión para los dos valores de siempre.

## Verificado en rojo

- **Primero, el que importa:** el guard estructural falló con «clean-staging no llama a
  `decidirBorrado()`: la decisión no está cableada» — o sea que los tests de la decisión no
  probaban nada del script hasta que se cableó. Exige el orden **decidir → salir → borrar**.
- **Los tres casos, mordiendo el mecanismo:** neutralizada `decidirBorrado` (retorno temprano
  `borra:true`), caen **4 de 20** — el caso del turno ajeno y los dos del suelo. Con la decisión
  puesta, 20/20. Sin esa inyección, los tests solo habrían demostrado que las funciones existen.
- **Tabla ejecutada:** ajeno+sin bandera → no borra · ajeno+bandera → borra · sin turno → borra ·
  turno propio → borra · lectura caída → no borra.

## Lo que NO cubre

- **Quien tomó el turno a mano con `turno:tomar` y no exporta `YAQU_LOCK_DUENO` se verá a sí mismo
  como ajeno.** Es **SCRUM-253**, no un defecto nuevo: allí el dueño se mide por sesión y el PID del
  segundo proceso es otro. Aquí tiene salida —la bandera— y por eso no se arregla de paso.
- **El turno sigue sin ver a un gateado suelto**, que tiene fixtures vivas y no toma turno. Por eso
  el aviso mantiene el **recuento de `@test.local` vivos**: es la señal que cubre ese hueco, y no la
  sustituye ningún estado del turno.
- **La decisión se prueba pura + estructuralmente**, no ejecutando el script contra una BD. El
  script se ejecuta entero al importarlo, así que un test que lo importara lanzaría una limpieza.

## Ficheros

`scripts/_rastro-limpieza.mjs` (`BANDERA_PISAR`, `estadoDelTurno`, `decidirBorrado`, `componerEntrada`
admite cadena, `mensajeAviso` sin la promesa vieja) · `scripts/clean-staging-tests.mjs` (lectura que
no se traga el fallo, vigencia por 266, la puerta antes del primer delete, código de salida 3) ·
`tests/scrum260-rastro-limpieza.test.mjs` (+7).
