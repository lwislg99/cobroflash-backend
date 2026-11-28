# SCRUM-1109 · Que el guard de SCRUM-1097 corra solo, y avise

**Medido contra:** `origin/main` = `671296fed22b1185898e0168c6d8b9a1e3eb8955` · 2026-09-23T18:56:19Z

**Puesto:** J6 · Calidad y seguridad (`jv-j6`) · **Rama:** `scrum-1109-guard-acreditacion-programado`

**Encargo:** el fundador eligió, entre tres caminos, «el 3»: una tarea programada en Railway que
corre el guard de SCRUM-1097 sola y avisa — en vez de ensanchar permisos de una sesión o lanzarlo
él a mano. El motivo, textual: *«un guard que hay que acordarse de lanzar no acredita gran cosa;
uno que corre solo y avisa el día que deja de dar cero, sí»*.

---

## 0 · Dependencia con SCRUM-1097 — declarada, no escondida (y ya resuelta)

Este ticket no puede existir sin `scripts/guard-acreditacion-invoicing-es.mjs` (SCRUM-1097, PR
[#1744](https://github.com/lwislg99/cobroflash-backend/pull/1744)). Al empezar esta rama traía una
copia BYTE A BYTE de ese fichero y de su test (`git checkout
origin/scrum-1097-guard-acreditacion-invoicing-es -- scripts/guard-acreditacion-invoicing-es.mjs
tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs`), no una reescritura. **#1744 mergeó a
`main` a las 2026-09-23T18:55:41Z, a mitad de esta tarea**, junto con una segunda declaración de
`scripts/guard-acreditacion-invoicing-es.mjs` en `DECLARADOS`
(`tests/scrum711-guards-sin-sitio.test.mjs`) hecha por otra sesión — el mismo sitio exacto que
tocaba yo. `git merge origin/main` (commit `c1f51f62`) trajo esos 11 commits; los dos ficheros
copiados coincidieron BYTE A BYTE (merge automático, sin conflicto) y el único conflicto real, en
`DECLARADOS`, se resolvió conservando la entrada ya mergeada y sumando los campos que necesitaba
mi prueba adicional (el envoltorio + su test), sin duplicar ni tocar la lógica que ya estaba en
verde. El trabajo NUEVO de este ticket no toca ni un byte del guard de SCRUM-1097 en sí.

## 1 · Qué se construyó

`scripts/aviso-programado-acreditacion-invoicing-es.mjs` — IMPORTA (no reimplementa)
`medirAcreditacion` y `verificarSoloLecturaEstructural` del guard de SCRUM-1097, para que un
cambio futuro en el guard se herede aquí sin duplicar lógica ni el riesgo de que las dos copias
diverjan.

- **Contrato de bandera idéntico al guard base:** `--staging` (`DATABASE_URL_STAGING`) /
  `--prod-ro` (`DATABASE_URL_PROD_RO`, rol `yaqu_lectura`, ya probado en SCRUM-1097). Sin bandera,
  sale con `2` y no toca nada. **La tarea programada de Railway se despliega con `--prod-ro` fijo
  en su comando** — esa es la única vez que alguien elige la bandera; a partir de ahí corre sola.
- **El aviso es un email**, no un fichero nuevo: reutiliza `SMTP_URL`/`EMAIL_FROM` — el mismo
  transporte que ya usa `src/integrations/mailer.ts` en producción — y añade UNA variable nueva,
  `AVISO_ACREDITACION_EMAIL_DESTINO` (destinatario; admite varias direcciones separadas por coma,
  tal como las acepta `nodemailer`). Sin cualquiera de las tres variables (`--prod-ro` más
  `SMTP_URL` más el destinatario), el script se declara CIEGO **antes** de tocar la base.
- **El rastro de cada pasada ES el cuerpo del email**: fecha, host (sin credencial, vía
  `describirBD`), la consulta exacta y el recuento — la misma bandeja de entrada acumula el
  histórico. Un extracto sale también por `stdout` (Railway lo guarda igual) como red secundaria,
  nunca como la única: un registro que nadie abre no acredita nada (`puesto-j6.md`).
- **Cuatro desenlaces, no tres:** `0` limpio Y avisado · `1` HALLAZGO (se avisa igual aunque el
  envío falle: el exit code ya deja la pasada en rojo en el panel de Railway) · `2` CIEGO, que
  cubre además del caso del guard original (no se pudo medir) la configuración incompleta, el
  host inesperado, y — deliberado — **una medición limpia cuyo aviso NO se entregó**. Un «0» que
  no llegó a nadie no se puede llamar visto; tratarlo como el `0` normal sería la misma trampa que
  nombra `puesto-j6.md` aplicada al aviso en vez de a la consulta.

## 2 · Límite declarado — lo que este script NO decide

La creación de la tarea programada en Railway y sus tres variables (`DATABASE_URL_PROD_RO` con el
rol `yaqu_lectura`, y las de email) las crea y pega el fundador DIRECTO en Railway (regla 9); esta
rama no las ve ni las necesita para compilar. **Periodicidad propuesta, no decidida:** diaria
(p. ej. `0 6 * * *`, 06:00 UTC) — el coste de la consulta es una sola `findMany`, y una vez al día
detecta una acreditación indebida dentro de las 24 h sin generar ruido.

`src/core/cron/cron.ts` (S1) no se ha tocado: la programación vive fuera de la app, en la propia
tarea de Railway.

## 3 · Visto en ROJO, en vivo contra STAGING — con limpieza

Ejecutado 2026-09-23 ~18:55Z contra `DATABASE_URL_STAGING` (host `acela.proxy.rlwy.net/railway`),
con un script efímero **no committeado**
(`scripts/_tmp-scrum1109-verificacion-staging.mjs`, borrado tras el uso — `git status` limpio
después) que invoca `ejecutarPasada` con un `PrismaClient` REAL contra staging y un
`transportador` de email FALSO (sin secreto de SMTP de producción a mano, ni motivo para mandar un
email real de prueba):

| Paso | Resultado |
|---|---|
| ① Base, antes de sembrar | suelo=7 · recuento=**0** · **exit 0** · aviso "limpio" ENTREGADO (simulado) |
| ② Siembra | `merchant.create({country:'ES', flags:{INVOICING_ES_ENABLED:true}})` vía `destinoSembrable` (allowlist de host, nunca producción) → `CREADO id=4576` |
| ③ EN ROJO | suelo=8 · recuento=**1** (`id=4576`) · **exit 1** · aviso "HALLAZGO" con el id correcto |
| ④ Limpieza | `merchant.delete({id:4576})` → `BORRADO id=4576` |
| ⑤ Verde, tras limpiar | suelo=7 · recuento=**0** · **exit 0**, de vuelta al mismo suelo que ① |

El propio auto-check AST heredado del guard de SCRUM-1097 se ejerció de verdad en el mismo proceso
(sin él, ninguna de las cinco pasadas habría llegado a conectar).

## 4 · Pruebas automáticas — `tests/scrum1109-aviso-programado-acreditacion-invoicing-es.test.mjs`

Sin BD ni SMTP reales: `prisma` y `transportador` llegan inyectados (mismo patrón que
`preview-migracion.mjs` y el propio test de SCRUM-1097). 14 tests nuevos, cubren:
`validarConfiguracion` (cada variable ausente, una por una), `validarHost` (host esperado, EN
ROJO con el host equivocado, URL ilegible), `construirAviso` (CIEGO nunca dice "limpio", HALLAZGO
lista los ids, limpio declara el suelo), y `ejecutarPasada` en sus cuatro desenlaces — incluido EN
ROJO el caso de un guard importado que llama a un método fuera de la lista blanca (aborta SIN
conectar ni avisar) y el caso nuevo: medición limpia con el envío de email fallando (exit 2, no
0). Junto a los 14 heredados de SCRUM-1097 (mismo fichero, sin tocar): **28/28 pass, 0 fail, 0
skip.**

```
$ FORCE_COLOR=0 node --test tests/scrum1109-aviso-programado-acreditacion-invoicing-es.test.mjs tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs
# tests 28
# pass 28
# fail 0
# skipped 0
```

## 5 · La tanda completa (no solo la mía) encontró tres cosas propias, y se cuentan

Una primera pasada de `npm test` sobre el árbol entero (no solo los ficheros que yo elegí) dio 9
fallos; **3 eran míos de verdad**, no del árbol compartido — la propia norma de esta casa avisa de
que una lista acotada a mano miente, y aquí lo confirmó:

- **SCRUM-195/414** (`ningún script parsea una URL donde su error pueda hablar`): mi primera
  versión calculaba la ruta del guard con `fileURLToPath(new URL('./guard-…', import.meta.url))`.
  Ese censo vigila TODO `new URL(` de `scripts/`, no solo el de una URL de BD — y esta máquina
  tiene además un ESPACIO en la ruta de usuario que `new URL(...).pathname` no decodifica bien
  (`censo-alcanzabilidad.mjs`). Arreglado con el patrón que ya usa el resto de la casa:
  `path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard-acreditacion-invoicing-es.mjs')`
  — cero `new URL` en el fichero.
- **SCRUM-711** (`ningún guard deja de correr en algún sitio`): al traer
  `scripts/guard-acreditacion-invoicing-es.mjs` a esta rama, su CLI no lo invoca `npm test` ni
  ningún workflow — corre por su propio contrato de bandera, programado en Railway, fuera del
  repo. Añadida su entrada en `DECLARADOS` (`tests/scrum711-guards-sin-sitio.test.mjs`) con una
  prueba comprobable y su propio test que la sostiene: la llamada DIRECTA en
  `tests/scrum1097-…` y la llamada INDIRECTA (a través de `ejecutarPasada`) desde
  `scripts/aviso-programado-…` y `tests/scrum1109-…`.
- **SCRUM-854** (`toda rama que toca código trae su entrada de registro`): este mismo fichero
  existía en disco pero el censo lo leía por `git`, no por el sistema de ficheros — hasta que los
  ficheros nuevos quedaron `git add`-eados no lo vio. Sin arreglo de código: era orden de trabajo,
  no un defecto del guard.

Los otros 6 fallos de esa primera pasada (`SCRUM-939b` — censo de skills y ruta de `gh.exe` — y
`scrum910d-microcopy-recibo-pendiente.test.mjs`, sin detalle de aserción) son del árbol
compartido de esta máquina, no tocan ningún fichero de este ticket, y no se han tocado aquí.

## 6 · `npm test` — veredicto final, sobre el árbol YA arreglado

```
$ FORCE_COLOR=0 npm test
# tests 8224
# pass 8089
# fail 4
# skipped 131
```

Los 4 que quedan son EXACTAMENTE los mismos dos casos del árbol compartido del punto anterior
(`SCRUM-939b` ×3, `scrum910d-microcopy-recibo-pendiente.test.mjs` ×1) — ninguno nuevo, ninguno de
este ticket. Medido 2026-09-23 ~19:57Z contra este mismo worktree (`origin/main` sin moverse desde
la cabecera de este informe).

## 7 · Lo que no se ha tocado

`src/`, `src/core/cron/cron.ts` (S1), `.github/workflows/ci.yml` y los vigías (S5), los bancos e
instrumentos (S3), producción (solo se ha ejecutado `--staging`, y ejecutado por esta sesión — la
pasada `--prod-ro` la coordina el fundador, igual que en SCRUM-1097; a esta sesión se le prohibió
explícitamente intentarla). El script efímero de verificación fue borrado y no se ha committeado.

## 8 · Siguiente paso (del fundador)

1. Crear en Railway la tarea programada con el comando
   `node scripts/aviso-programado-acreditacion-invoicing-es.mjs --prod-ro` y la periodicidad que
   decida (propuesta: diaria).
2. Pegar DIRECTO en Railway (nunca en el chat ni en un fichero): `DATABASE_URL_PROD_RO` (rol
   `yaqu_lectura`), `SMTP_URL`/`EMAIL_FROM` (puede reutilizar los que ya usa el servicio principal
   si la tarea comparte variables de proyecto) y `AVISO_ACREDITACION_EMAIL_DESTINO`.
3. Confirmar aquí, en un apéndice (SCRUM-1109b), la primera pasada real contra `--prod-ro`.

---

## SCRUM-1109b · primera pasada real contra `--prod-ro` (J6, solo docs)
**Medido contra:** `origin/main` = `154c44557f771e9bb7a6e20a2f5a8e55a18c979a` · 2026-11-28T08:05:11Z
Versión: 1.2 (SCRUM-1836)

**Puesto:** J6 (`jv-j6gr`, encargo del orquestador `cobroflash-backend-2d`) · **Rama:** `scrum-1109b-primera-pasada-real` · hora: cabecera `Date:` de `gh api -i zen`

A9: aviso → cicatriz J6 «Corrí `carriles.mjs de` sobre el registro después de escribir el apéndice, no antes: la quinta de la familia de SCRUM-1218d» — no se pudo comprobar: la cerradura de carril no para (SCRUM-1506) y ningún hook de este árbol exige la consulta antes de la primera escritura

### a · Lo que muestra la captura de Railway (fuente: SCRUM-1109 c.22977 y c.22978; la transcribe el orquestador, yo no la he visto)

Servicio `guard-acreditacion`, pestaña «Cron Runs»: «Runs at 07:00 am (UTC)» · «Next run in 23 hours» · cron
`0 7 * * *` · Start Command `node scripts/aviso-programado-acreditacion-invoicing-es.mjs --pro…` (cortado en
pantalla; que es `--prod-ro` lo dice el log de abajo: `destino · [DATABASE_URL_PROD_RO]`, la clave de
esa bandera, §1 de este registro) · «Current Deployment: CRASHED · Merge pull request #3501 … 30 minutes ago».
«Recent Executions», las cuatro en rojo y de **3 s**:

| ejecución (UTC) | deployment |
|---|---|
| 2026-11-28 07:04 | #3501 |
| 2026-11-27 07:04 | #3447 |
| 2026-11-26 07:00 | #3465 |
| 2026-11-25 07:02 | #3432 |

### b · El log del 28-nov, literal (c.22978; pegado por el fundador ~07:50Z)

```
[2026-11-28T07:04:07.631Z] === SCRUM-1109 · aviso programado de acreditación INVOICING_ES ===
[2026-11-28T07:04:07.631Z] destino · [DATABASE_URL_PROD_RO] → autorack.proxy.rlwy.net/railway
[2026-11-28T07:04:07.633Z] canal del aviso · Resend (HTTPS)
[2026-11-28T07:04:07.649Z] ① midiendo · conectando y consultando
[2026-11-28T07:04:07.720Z] ① medido · filas: 1
[2026-11-28T07:04:07.720Z] ② enviando aviso · a destinatario configurado
[2026-11-28T07:04:07.974Z] ② aviso entregado
🔴 [YaQu · SCRUM-1097] HALLAZGO — 1 merchant(es) acreditado(s) sin deber estarlo · aviso ENTREGADO
```

El correo que salió de esa pasada (c.22980; captura de Gmail del fundador, remitente `YaQu <no-reply@yaqu.app>`,
recibido 7:04), cuerpo literal:

```
fecha: 2026-11-28T07:04:07.720Z
host: autorack.proxy.rlwy.net/railway
consulta: merchants WHERE country='ES' AND id<>1 AND (flags.INVOICING_ES_ENABLED=true OR EXISTS invoice.type IN (F1,F2,F3,R1,R2,R3,R4,R5))
suelo: 14 merchant(s) ES no-demo
recuento: 1
merchant id(s): 2
```

Hubo un segundo correo a las 7:30; el fundador: «Es el mismo correo» (c.22982). El host es el de
`PROD_HOST` (`scripts/_db-guard.mjs:23`), sin credencial. Del log al aviso entregado van 343 ms; los 3 s del
panel incluyen lo que el log no cuenta (arranque del contenedor: sin medir).

### c · Qué significa el «CRASHED»: un HALLAZGO, por diseño

El guard tiene tres veredictos (`scripts/guard-acreditacion-invoicing-es.mjs:41-44`): `0` limpio (`:323`),
`1` HALLAZGO (`:315`), `2` CIEGO (`:270`, `:305`). El aviso los hereda (`scripts/aviso-programado-acreditacion-invoicing-es.mjs:39-46`)
y decide el código en `:283-287`: con hallazgo sale `1` «manda igual aunque el aviso falle» (`:286`), y
`process.exit(codigo)` (`:361`). Railway pinta todo código ≠ 0 como «CRASHED»; §1 de este registro ya lo
preveía («el exit code ya deja la pasada en rojo en el panel de Railway»). **Un hallazgo no es un verde, y
el dato que vale es el correo entregado**, no el color del panel. La tarea no se cae: c.22978 corrige a
c.22977.

### d · Por qué c.22859 (26-nov) decía que la tarea no existía

No fue una medición: fue la respuesta del fundador ese día, literal «2-No sé qué tarea me hablas» y, al
explicársela, «4-DIme la tarea». Lo que había escrito antes: `docs/master/SCRUM-1097.md:174` (tramo 1097b,
24-nov) dice que el guard «corre a diario contra producción según el correo que cita c.22417», y `:176`,
«23-nov: 1 de 14»; SCRUM-1779 c.22425 (23-nov) dice que ese centinela «contó 1 (comercio id 2)». La captura
solo lista cuatro ejecuciones, así que «desde el 25-nov» es su suelo, no su comienzo. **Sin medir:** c.22417
lo he leído por esas dos citas, no en Jira; si el correo del 23-nov salió de esta tarea o de una pasada a mano.

### 2 · El hallazgo: el comercio id 2 de producción, cruzado

- **SCRUM-1814** (descripción; 0 comentarios, leído hoy): no nombra ningún comercio. Dice que el brazo (b)
  da rojo por cada comercio ES que EMITE con el flag encendido, y que con la excepción A8 ese rojo es esperado.
- **SCRUM-1779**: c.22290 (21-nov ~06:05Z), producción encendida, literal del fundador «Ok he puesto invoicing
  enabled en true y SIF no está»; c.22289 firma la excepción para **TODOS** los comercios ES de producción, no
  solo el del piloto; c.22425 (23-nov), «la variable global de producción está en `true` para TODOS los
  comercios ES», y el centinela «solo ve overrides en `true` o facturas, por eso contó 1 (comercio id 2)».
  **1779 sí nombra el id 2, como el «1» del centinela del 23-nov. Ningún ticket dice que el 2 sea el comercio
  del piloto:** 1779 pide su email «nunca su id», y las otras cuatro menciones de «comercio 2» en sus 30
  comentarios (c.22283, c.22480, c.22482, c.22483) son de STAGING, donde el 2 es la cuenta QA. Un id es de
  su base: el 2 de staging no dice nada del 2 de producción.
- **Hipótesis que cuadran con «1»:** (H1) el 2 tiene override `INVOICING_ES_ENABLED=true` (brazo a);
  (H2) el 2 ha emitido alguna F1–F3/R1–R5 desde el ON global del 21-nov (brazo b, el caso de 1814);
  (H3) las dos. La consulta es un único `OR` y el correo no dice qué brazo casó.
- **Para decidir:** (i) qué brazo, con una pasada de solo lectura por brazo en producción, que no se hace
  desde un árbol; (ii) si el 2 es el piloto: el fundador sabe qué cuenta es el 2 de producción. Basta un
  ✅/❌ suyo, sin el email en el chat.
- **Lo que el «1» NO es:** el número de comercios que pueden facturar. Con el ON global los 14 ES no-demo
  pueden emitir, y el guard no ve la variable de entorno (`scripts/guard-acreditacion-invoicing-es.mjs:17-24`;
  1097b, `:176`). Es el límite que ya estaba declarado, no un hallazgo nuevo. Del 23-nov (1 de 14) al 28-nov
  (1 de 14) el guard no ha visto ningún comercio ES más con override ni con factura.

**Control en STAGING (28-nov, solo lectura; el guard no importa ningún mailer y su rastro va a `~/.yaqu/`).**
Turno `--base staging` tomado a las 08:04:29Z y soltado después (hora de la máquina: el marcador del turno),
`estado` LIBRE al acabar. `ACREDITACION_CONFIRM=acela.proxy.rlwy.net node scripts/guard-acreditacion-invoicing-es.mjs --staging`:
misma consulta literal que el correo, `suelo: 7` · `recuento acreditados: 1` · `merchant id=2` · **exit 1**.
El 2 de staging es la cuenta QA con override en ON (1779 c.22283 y c.22480), así que el guard caza un override
cuando lo hay. El 23-sep, la misma base daba 7 y 0 (§3). No mide nada de producción.

### 3 · Lo que esto cierra, y lo que no

- **El paso 3 de §8 queda hecho:** la primera pasada real contra `--prod-ro` existe, como muy tarde, desde el
  2026-11-25 07:02 UTC; corre sola cada día a las 07:00 UTC y su aviso llega con el id. Los pasos 1 y 2 son
  del fundador, y el log los prueba: la clave `DATABASE_URL_PROD_RO` y el aviso entregado. El canal es Resend,
  no el SMTP de §1: qué PR lo cambió, sin medir.
- **SCRUM-1109 queda cerrable por efecto cuando entre este PR.** Lo cierra el orquestador (A13).
- **El hallazgo no es de 1109.** Es de 1097, 1779 y 1814: el aviso diario es esperado por decisión del fundador
  (1097b, `:174`, c.22417 «4-Da igual que suene»), y su vuelta a verde es la decisión pendiente de SCRUM-1814.
- **El panel en rojo cada día (propuesta, nada construido):** basta con que el correo sea la lectura. No se
  toca el código de salida (regla 41): un hallazgo es rojo. Pero Railway pinta igual el `1` y el `2`, así que
  el panel no distingue un HALLAZGO de un CIEGO. Lo que distingue es el ASUNTO del correo, y un CIEGO sin
  correo entregado no deja nada que leer. Lo que hay que vigilar es **el día que no llega el correo de las
  07:0x**. Si se quiere que lo vigile algo y no alguien, eso es un ticket aparte. Se propone, no se abre.

### 4 · Guards (población en la entrega de Jira)
