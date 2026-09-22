17-sep-2026 10:30 CEST · medido sobre `origin/main = aa465cdd6fc64625bc5a4e16d575fd0810064be6` · worktree `wt-jefe`

> Este documento nació con dos datos caducados en menos de una hora. Por eso lleva fecha y
> SHA en la primera línea, y por eso existe la norma A14.

# TRASPASO DEL ORQUESTADOR — estado al 17-sep-2026

Este documento es el ESTADO. `docs/equipo/orquestador.md` es el MÉTODO (empieza por su §0:
arranque y lista de cada turno). `docs/equipo/limites-del-fundador.md` son los LÍMITES y el
OBJETIVO VIGENTE. Si algo de aquí contradice a una medición de hoy, gana la medición.

*(Sustituye al traspaso del 9-sep, que sigue en el historial de git. Se conservan sus §4, §6 y §7,
que no caducan.)*

## 1 · EL OBJETIVO VIGENTE

**Producto y automatización a la vez, los dos a fuego** (fundador, 17-sep-2026; detalle en
`limites-del-fundador.md`). S0-S4 van a producto, cada una en su carril. La S5 va solo a
automatización. La automatización **ya no se da por cerrada**: queda retirada la decisión del
16-sep («solo #1367 + meta-guard y después todo a producto»).

## 2 · QUIÉN ESTÁ EN QUÉ (encargos del 17-sep por la mañana)

| sesión | carril | ticket ahora | lo siguiente de su carril |
|---|---|---|---|
| S0 | consultoría | SCRUM-892: código en main (#1381, 08:22Z; **excepción declarada**: S0 no toca `src/`). Falta su veredicto en staging; el ticket lo cierra el orquestador | A20 en `00-normas-comunes.md` («encargo fuera de carril → se dice y no se empieza») |
| S1 | backend · dinero | SCRUM-887 PR 2 (descuento global; un albarán con descuento global NO factura, y el literal del rechazo se propone y se para) | SCRUM-893 (pago de la cliente sin Connect) |
| S2 | front | SCRUM-894 (Cobros no avisa del NIF que falta) | — |
| S3 | bancos | SCRUM-897 (`_banco-vistas.mjs` añade en vez de reemplazar) | SCRUM-876 T3/T4 (aparcados el 16-sep) |
| S4 | microcopy · parte · albarán | SCRUM-890 PR 2 (firma delegada en el comentario 15665; condición: dos pestañas + `onversionchange`) | SCRUM-895 (albarán firmado con marcador) |
| S5 | automatización | SCRUM-839: probar «Conflicto de registro» por efecto (encendido por el fundador; medido `active` el 17-sep a las 08:20Z) | §3 |

⚠️ El 17-sep a primera hora se mandaron 893 a la S3 y 895 a la S5, fuera de carril. Se corrigió
el mismo turno: la S3 y la S5 dejan su PASO 0 como comentario en el ticket. Ver `orquestador.md` §13.

**Javier (carril B):** SCRUM-866 (la mutación muda de `scrum859`) es lo ÚNICO que falta para
marcar el meta-guard como obligatorio (SCRUM-836). Tiene prompt. Tiene además abierto el #1379
(«A19 + SCRUM-665A»).

## 3 · LA AUTOMATIZACIÓN: lo que hay y lo que falta

| pieza | estado |
|---|---|
| PR que se abren, arman y mergean solos | ✅ funciona |
| Aviso de rojo en check obligatorio | ✅ funciona (SCRUM-853) |
| Conflictos solo de registro, resueltos solos | ⚠️ #1367 en main y workflow encendido el 17-sep; **sin prueba por efecto todavía** (S5, SCRUM-839) |
| Meta-guard obligatorio | ⏳ espera a SCRUM-866 (Javier). Con main en verde, el fundador marca la casilla |
| Push del bot → CI en `action_required`, sin checks | 🔴 volvió a pasar con #1367. **Desaparcado** el 17-sep |
| Conflictos de código | 🔴 **desaparcado** el 17-sep |
| Orquestador ↔ sesiones sin que el fundador copie y pegue | ✅ **EN USO desde el 17-sep ~08:50Z** (`orquestador-autonomo.md`). Lo que sigue es la nota de antes de usarlo: **Medido el 17-sep:** desde la sesión del orquestador, `ListAgents` ve 7 sesiones locales de `cobroflash-backend` y `SendMessage` podría escribirles. No se ha usado: hacerlo cambia la regla §10.5-10.6 («prompt solo a quien trae el fundador») y lo decide él |
| Orquestador que arranca solo por la mañana | 🆕 objetivo del fundador. Sin diseñar; si cuesta dinero (rutinas en la nube), lo decide el fundador. **Actualizado 17-sep:** cron provisional en marcha (`orquestador-autonomo.md` §2, F5) |

## 3bis · CONTRADICCIONES ABIERTAS EN LO QUE SE LEE AL ARRANCAR

- ~~**A19 (chat nuevo).**~~ ✅ **CERRADA el 17-sep-2026:** la Sesión 0 alineó A19 con la decisión final del fundador (nunca chat nuevo por tamaño; solo si lleva >1 h parado o Claude Code no deja seguir) en el PR #1395.
  ⚠️ **SUPERADA el 17-sep-2026** (decisión del fundador tras la prueba de relevo de SCRUM-899): ya no
  vale «mismo chat». El puesto es fijo y la sesión se releva: al terminar una entrega si el contexto
  pasa de 200k, tras más de 1 h parada o al empezar la tanda del día siguiente; nunca a mitad; y las
  autorizaciones del fundador no se heredan. El texto vigente es A19 de `00-normas-comunes.md`.
- **Derivados del máster con reglas caducadas** (regla 35: se cambian por cambio de máster):
  `CLAUDE.md` dice «el merge del PR lo hace un HUMANO»; la skill `cerebro-yaqu` dice «`gh` NO está
  instalado, el PR lo abre el fundador» y «entrada en YAQU_MASTER.md». Hoy: auto-merge,
  `gh` instalado fuera del PATH y registro en `docs/master/SCRUM-NN.md` (SCRUM-273).

## 4 · LOS TRECE ERRORES DEL ORQUESTADOR

> **El orquestador no mide: le cuentan.** Todo lo que escriba como HECHO sobre el
> codigo pasa por una medicion antes, o se escribe como PREGUNTA.

| lo que afirmo | lo que era |
|---|---|
| «171 llamadas a git» | 71 — conto texto, no AST |
| «cuatro sitios del atajo» | seis |
| «el NIF se imprime en la factura» | no se imprime |
| SCRUM-724, los 44 px | no existia; lo habia decidido SCRUM-352 |
| SCRUM-822, «main esta rojo» | main estaba verde |
| «la tabla ocupa 730 px» | 978 |
| «faltan los objetivos tactiles» | ya hechos en SCRUM-720d |
| «el auto-merge falla por el conflicto» | eran permisos |
| «Jira no funciona en Visual» | si funciona |
| mando mergear PR ya mergeados | leyo una captura como estado actual |
| «Presupuestos no usa el router y por eso falla el atras» | las CINCO listas fallan; la causa es `HASH_VIEWS` sin los `*-detail` |
| tomo por actual un informe ya usado | nada en el informe decia cuando se midio → norma A14 |
| «RTT a la base = 175 ms» | era la latencia de la MÁQUINA QUE MIDIÓ, desde España; las dos regiones están en US West. El control de los 880 ms arrastraba el mismo sesgo. Casi lleva a mover la base a Netherlands, poniendo 9.000 km entre la app y su base. **Lo paró Javier midiendo.** |

## 5 · QUIÉN ES QUIÉN, Y QUÉ FICHEROS TOCA

La tabla vive ahora en `orquestador.md` §11bis (17-sep-2026), con lo que NO se le manda a cada
sesión. La del 9-sep que había aquí daba S5 = automatización y es la que se confirmó.

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
