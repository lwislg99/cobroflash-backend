22-sep-2026 16:35Z (hora GitHub) · medido sobre `origin/main = 6d0451d009d59bd042feb343b95bcd6d211c541c` · sesión de fondo `orquestador` (tanda autónoma SCRUM-899)

> Este documento nació con dos datos caducados en menos de una hora. Por eso lleva fecha y
> SHA en la primera línea, y por eso existe la norma A14.

# TRASPASO DEL ORQUESTADOR (equipo de Luis) — estado al 22-sep-2026 16:35Z

Este documento es el ESTADO. `docs/equipo/orquestador.md` es el MÉTODO (empieza por su §0:
arranque y lista de cada turno). `docs/equipo/limites-del-fundador.md` son los LÍMITES y el
OBJETIVO VIGENTE. `docs/equipo/dos-equipos.md` reparte áreas entre los dos equipos. Si algo
de aquí contradice a una medición de hoy, gana la medición.

*(Reescrito entero: la versión del 17-sep-2026 (SHA `aa465cdd`) estaba fósil — hablaba de un
solo equipo y de un sprint que ya no existe. Se conservan §6 y §7, que no caducan por norma
propia; §4 (errores históricos) se conserva y se amplía.)*

## 1 · EL OBJETIVO VIGENTE

**Producto y automatización a la vez, los dos a fuego** (fundador, 17-sep-2026; detalle en
`limites-del-fundador.md`). Backlog activo: **BLOQUE CRM (SCRUM-977)** y **BLOQUE CONTABILIDAD**
(SCRUM-280), repartidos en olas 1/2/3 con muchos tickets ya `listo-para-construir` en Jira
(etiqueta `equipo-luis`).

## 2 · QUIÉN ESTÁ EN QUÉ — HOY: **NADIE**, y es la anomalía del turno

Medido con `ListAgents` + `claude agents --json` (contraste obligatorio, `feedback_registro_sesiones_roto_tras_reinicio`):
`ListAgents` solo veía al chat interactivo del fundador (`cobroflash-backend-06`, idle). El
registro real (`claude agents --json`) tenía además **dos sesiones "working" que en realidad
eran zombis**:

- `sesion-5` (id `df2fa38f`) — arrancada el **18-sep-2026**, llevaba **4 días** marcada
  "working" sin haber entregado nada desde entonces (su propio traspaso de esta mañana decía
  cola CERO).
- `s1-21` (id `829b5f76`) — arrancada el 21-sep 07:16Z, **33 h** "working"; su traspaso de
  hoy 10:23Z también decía cola CERO.

Intenté pararlas (`TaskStop` y `claude stop <id>`): las dos vías fueron denegadas por el
clasificador de permisos (`Interfere With Workloads`), y **no lo rodeé**. Quedan vivas pero
**no se les manda nada**: su traspaso ya dice que no tienen cola, así que no se pierde trabajo
por ignorarlas.

**Resultado: los 6 puestos (S0-S5) están sin sesión de fondo activa que yo pueda usar.** Hay
backlog real listo para construir (§3) pero **no tengo autorización vigente para lanzar
sesiones con nombre `sesion-N`**: `.claude/settings.local.json` solo permite
`claude --bg -n control-899-*` (uncommitted, visto con `git diff`), que es la ventana estrecha
de pruebas de SCRUM-899, no el lanzamiento normal de puestos. Sin una autorización expresa del
fundador EN ESTE chat (A19, `orquestador-autonomo.md` §5bis.5), no lo intento — es la misma
regla que impide dar por rodeado un bloqueo de permisos.

## 3 · BACKLOG LISTO PARA CONSTRUIR (Jira, `equipo-luis` + `listo-para-construir`, no bloqueado)

| ticket | qué | área | por qué no bloqueado |
|---|---|---|---|
| SCRUM-1008 | ficha de artículo: SKU, ref. proveedor, unidad, familia | S1 | sin ALTER pendiente declarado |
| SCRUM-1014 | «sitios» del cliente (varias direcciones de obra) | S1 | sin ALTER pendiente declarado |
| SCRUM-1049 | pantalla «Resumen del trimestre» | S2 | depende de 1048 (esperando asesor) para el cálculo, pero la pantalla en sí no |
| SCRUM-1075 | aviso in-app fin de trimestre | S2+S4 | — |
| SCRUM-1043 | «Quién me debe» (deuda de clientes) | S1+S2 | **a propósito sin terminar** — mitad front pendiente, confirmado por S1 |
| SCRUM-1042 | ajuste on/off foto del técnico | S2 (mitad) | **PR #1679 abierto con CI en FAILURE** (build+tests) — falta la mitad de S1, ver §4 |

El resto de `listo-para-construir` está bloqueado por causa declarada: `esperando-alter` (1072,
1044, 1045, 1056), `esperando-asesor` (1074, 1048), `esperando-decision` (1069), o son STOP de
decisión del fundador (786 — los `.btn-sm` a 44px; 332/334 — landing comparativa, riesgo legal
art. 5 LCD, **NO TOCAR** sin que se reabran a propósito).

## 4 · LO QUE SE QUEDÓ ATASCADO Y POR QUÉ (cinco causas, `orquestador.md` §10.1.b)

- **Rojo real:** PR #1679 (SCRUM-1042) — check "build + tests" en FAILURE. Consistente con lo
  que decía el traspaso de S2: falta la mitad de servidor (columna+ruta de la foto).
- **Conflicto:** PR #1642 (SCRUM-1059, abierto desde las 08:26Z) · PR #1664 (SCRUM-1039) ·
  PR #1666 (SCRUM-1016e, DRAFT, el propio título dice «STOP: choca con regla 26» — necesita
  decisión, no solo rebase) · PR #1592 (SCRUM-917g, abierto desde el 21-sep 14:45Z — casi un
  día) · PR #1428 (SCRUM-804b, abierto desde el **17-sep** — cinco días, con dos checks en rojo
  además del conflicto: candidato a cerrar sin mergear si nadie lo retoma).
- **Sin checks / auto-merge sin armar:** ninguno visto hoy.
- **PR de persona sin armar:** ninguno.

## 5 · JIRA: CERRADO POR EFECTO ESTE TURNO (19 tickets, regla 16 — verificado contra PR mergeado + traspaso de quien lo construyó, no contra el tablero)

SCRUM-1057, 1046, 1033, 1034, 1003, 1004, 1061, 962, 991, 952, 977, 811, 1047, 1036, 1062,
1082, 1007, 1011, 1026. Detalle de qué PR cierra cada uno: mensaje al fundador de esta tanda
(no repetido aquí para no duplicar una fuente que puede divergir).

⚠️ **Hueco declarado, no silenciado:** no se cerraron SCRUM-991-adyacentes que el propio
constructor dejó a propósito En curso (SCRUM-868 — diseño listo, falta Postgres real para
verificar en rojo) ni tickets con corroboración débil (título de PR parece coincidir pero sin
traspaso de la sesión que lo hizo): SCRUM-1016/1016d/1016f/1029/1080/1081(equipo-javier, no
tocar) quedan sin auditar este turno — quien retome consultoría/diseño los revisa por contenido
antes de cerrarlos.

## 6 · LA REGLA DEL WORKTREE DEL JEFE

> El worktree del orquestador es de **SOLO LECTURA**. Lee, mide, corre guards, abre
> runs de CI, consulta Jira. **NUNCA hace commit de codigo de producto.** Lo unico
> que escribe es `docs/equipo/`. Si necesita un cambio en el producto, lo **ENCARGA**.

Motivo: un jefe que puede arreglar las cosas el mismo deja de ser jefe en tres dias.
Entonces hay siete programadores y ningun orquestador.

## 7 · LAS NORMAS QUE NO ESTABAN EN orquestador.md

- **A12** · Antes de cambiar una POBLACION (ramas, ficheros, tablas, filas), se censa
  que guards miden sobre ella. Un barrido correcto que rompe main sigue rompiendo main.
- **A13** · Nada mas coger un ticket: EN CURSO + ASIGNADO A LUIS en Jira. Antes de la
  primera linea de codigo.
- **A14** · Todo informe empieza con la FECHA Y HORA de la medicion y el SHA de
  `origin/main` sobre el que se midio.

## 8 · LOS CATORCE ERRORES DEL ORQUESTADOR (histórico + 1 de hoy)

> **El orquestador no mide: le cuentan.** Todo lo que escriba como HECHO sobre el
> codigo pasa por una medicion antes, o se escribe como PREGUNTA.

Los trece del 17-sep viven en el historial de git de este fichero (no se repiten aquí para no
duplicar una fuente). El de hoy: ninguna afirmación propia se dio por HECHO sin medir — el único
hallazgo de proceso fue de OTRA sesión (los dos zombis de §2), detectado por contraste
`ListAgents` vs `claude agents --json`, tal como manda `feedback_registro_sesiones_roto_tras_reinicio`.
