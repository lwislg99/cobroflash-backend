# SCRUM-1705 — FLAKY scrum25-export-zip («falta la traza de audit del ZIP»): el test espera la escritura y el fallo dice por qué

**Medido contra:** `origin/main` = `ba6fe36b628f4c97dede14d18270ccc84cd4316b` · 2026-11-11T17:52:22Z

**Rama:** `scrum-1705-audit-dice-por-que` · **Carril:** S1 · exports / auditoría.

A9: comprobación → `tests/scrum1705-audit-fire-safe-dice-por-que.test.mjs`

(La espera nueva vive en `tests/scrum25-export-zip.test.mjs`, que corre con banco: abajo, «Medido».)

## La decisión (del orquestador, SCRUM-1705, 11-nov)

`recordAudit` SIGUE siendo no bloqueante para la acción del usuario —un export no puede caer porque
la auditoría hipe—, pero deja de tragarse el error en silencio: se dice por el canal de errores del
servidor. Y el test deja de confiar en el timing: espera la traza explícitamente.

**Por qué no es un STOP (garantías de auditoría más gordas):** la clasificación ya estaba decidida en
el código. Lo que tiene que dejar traza sí o sí (`exportacion_fiscal`, `portabilidad_solicitada`,
`portabilidad_atendida`) está en `ACCIONES_BLOQUEANTES` (`audit.service.ts`) y va por
`recordAuditOrThrow`, que espera y propaga. `datos_exportados` es fire-safe por diseño desde SCRUM-25
(`exports.routes.ts`, `auditExport`). Este ticket no mueve ninguna acción de puerta.

## El arreglo

1. **`recordAudit` (`src/modules/system/audit.service.ts`).** El `.catch` imprimía sólo `e?.message`,
   y en el CI del 11-nov esa línea salió VACÍA decenas de veces (c.21522). Ahora dice acción, merchant,
   entidad, tipo y código del error, y el mensaje, o `String(e)` si viene vacío. `meta` NO se imprime,
   porque puede llevar datos personales. Sigue devolviendo `void` y sigue sin lanzar.
   - El canal es `console.error` → stderr, que es lo que recoge Railway: no hay otro (ni Sentry ni
     logger en `src/`, medido con grep).
2. **`tests/scrum25-export-zip.test.mjs`.** Leía `auditLog.findMany` UNA vez, justo después de la
   segunda descarga, sin esperar a la escritura. Ahora usa el helper que ya existía para esto,
   `tests/_audit-log-sync.mjs` (SCRUM-255): se intercepta `prisma.auditLog.create` antes de las dos
   descargas del admin y se espera a que ARRANQUEN dos escrituras y TERMINEN (`esperarAlMenos(2)`).
   Si una falló, el rojo lo dice (`explicar`). La red de 60 s solo convierte «colgado» en «rojo con
   motivo»: no decide el veredicto.
   - Desviación declarada respecto al encargo («sondeo corto con tope»): no hay sondeo. Se espera a la
     PROMESA de la escritura, que es determinista y es el mecanismo de la casa desde SCRUM-255. Así el
     flaky muere por diseño, y no por un tope más largo.

## Medido

**Rojo primero, por mutación de la sonda y no del código** (un preload en el tmp del job que retrasa
800 ms `auditLog.create` del cliente compartido; banco desechable `127.0.0.1:55674`, `yaqu_1674_test`):

| | `scrum25` de `HEAD` | `scrum25` nuevo |
|---|---|---|
| escritura retrasada 800 ms (la traza que llega tarde) | ✖ `falta la traza de audit del ZIP`, el literal del CI | ✔ |
| `create` que FALLA con P2024 | — | ✖ `falta la traza…` **↳ la escritura de AuditLog FALLÓ: P2024 Timed out fetching a new connection…** |
| sin sonda, 5 corridas | — | 5/5 ✔ |

Con el `create` fallando, el servidor imprimió, una vez por descarga:
`[audit] no se pudo registrar «datos_exportados» (merchant 65, export -): PrismaClientKnownRequestError P2024: Timed out fetching a new connection from the connection pool.`

**Test nuevo `scrum1705`** (sin BD: doble de `prisma.auditLog.create` sobre el mismo cliente, escucha
de `console.error`). Contra el `audit.service.ts` de `HEAD` caen 2 de 2, y el primero cae por lo que
tiene que caer: `la línea debe decir QUÉ acción no se registró: [audit] no se pudo registrar: Timed out…`.
Con el arreglo pasan 2 de 2.

**Vecinos** (todo test que nombra `audit.service`, `recordAudit`, `scrum25`, `export-zip` o
`_audit-log-sync`, con banco): 37 ficheros · 272 tests · 272 ok · 0 fallos · 0 saltados.

## Lo que esto NO arregla, dicho

- Si la causa de las caídas del CI es que el `create` FALLA bajo carga (MI LECTURA en c.21522, no
  medida), el test seguirá cayendo esas veces. Pero ya cae con el motivo, y el servidor deja la línea
  atribuible. Eso es lo que se pidió: que no sea mudo. Que la traza deje de ser fire-safe sería una
  decisión de producto del fundador, y no se toca.
- No se toca `recordAuditOrThrow` ni ninguna acción bloqueante.
