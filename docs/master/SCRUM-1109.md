# SCRUM-1109 · Que el guard de SCRUM-1097 corra solo, y avise

**Medido contra:** `origin/main` = `671296fed22b1185898e0168c6d8b9a1e3eb8955` · 2026-09-23T18:56:19Z

**Puesto:** J6 · Calidad y seguridad (`jv-j6`) · **Rama:** `scrum-1109-guard-acreditacion-programado`

**Encargo:** el fundador eligió, entre tres caminos, «el 3»: una tarea programada en Railway que
corre el guard de SCRUM-1097 sola y avisa — en vez de ensanchar permisos de una sesión o lanzarlo
él a mano. El motivo, textual: *«un guard que hay que acordarse de lanzar no acredita gran cosa;
uno que corre solo y avisa el día que deja de dar cero, sí»*.

---

## 0 · Dependencia con SCRUM-1097 — declarada, no escondida

Este ticket no puede existir sin `scripts/guard-acreditacion-invoicing-es.mjs` (SCRUM-1097, PR
[#1744](https://github.com/lwislg99/cobroflash-backend/pull/1744), **abierto, no mergeado** al
medir esto). Esta rama trae una copia BYTE A BYTE de ese fichero y de su test
(`git checkout origin/scrum-1097-guard-acreditacion-invoicing-es -- scripts/guard-acreditacion-invoicing-es.mjs
tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs`), no una reescritura: cuando #1744
mergee a `main`, un `git merge origin/main` en esta rama encuentra el mismo blob a ambos lados y
no genera conflicto. El trabajo NUEVO de este ticket no toca ni un byte de esos dos ficheros.

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
