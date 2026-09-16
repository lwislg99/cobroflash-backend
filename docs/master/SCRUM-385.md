# SCRUM-385 · el preview de migración no puede mentir en silencio

**Fecha:** 6-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `3788ff840c70e3981d7e132b502bd7ac474a371e` · 2026-08-06T01:11:33+01:00
**Tanda:** 1897 tests, 1830 pass, 0 fail, 67 skipped

> 🔴 **LA CAUSA QUE YO MISMA DI AYER ERA FALSA, y el matiz cambia el arreglo.** Ayer informé de que
> «el CLI del proyecto es Prisma 7.9.1 y está roto». **No lo es:** `package.json` fija
> `prisma@^6.18.0` y los tres árboles instalan 6.18.0. Lo que pasó es que en un worktree con
> `node_modules` a medio instalar, **`npx prisma` no encontró el CLI local y se descargó
> `prisma@latest` (7.9.1) de la red sin decir nada**. El 7 renombró los flags y dejó de leer
> `package.json#prisma`; sin schema cargado, el diff sale vacío con exit 0.
>
> **Consecuencia práctica: fijar la versión en `package.json` NO protege**, porque `npx` ejecuta
> otra cosa igualmente. Por eso NO se ha tocado ninguna dependencia (no hizo falta el OK de la
> regla 36) y el arreglo va por donde el fundador dijo: el control positivo.

## El incidente

Preparando la migración de SCRUM-300, `prisma migrate diff` devolvió **cero bytes con exit 0** —
indistinguible de un diff legítimo sin cambios. El preview que protege producción decía «no hay
nada que aplicar» mientras la migración real añadía cuatro columnas.

## Lo que cierra el ticket: el control positivo PERMANENTE

`scripts/preview-migracion.mjs`. Antes de creerse un vacío, le pide a la herramienta lo único que
no puede salir vacío —el esquema entero contra nada, 24 tablas— y comprueba que llega. Si no
llega, **falla nombrando la avería** y jamás informa de «no hay cambios».

Dos decisiones más, las dos medidas:

* **Se ejecuta el binario LOCAL por ruta**, nunca `npx prisma`. La sustitución silenciosa fue la
  causa; el guard exige que el CLI del proyecto exista.
* **Hay DOS vacíos y se distinguen por la FRASE, no por la longitud.** Medido: cuando de verdad no
  hay cambios, Prisma escribe `-- This is an empty migration.`. Cero bytes es la herramienta sin
  contestar. Si algún día deja de escribir la frase, esto no dará un falso «sin cambios»: dará
  `sospechoso`, que es el lado seguro por el que equivocarse.

## Los dos controles, y por qué solo valen juntos

* **Positivo** — esquema entero contra vacío, con el CLI DE VERDAD: ≥20 `CREATE TABLE`.
* **Negativo** — el mismo schema a los dos lados: vacío, y ese vacío ES legítimo.

Por separado los pasa un preview roto: uno que siempre devuelve contenido pasa el positivo; uno
que siempre devuelve vacío pasa el negativo. Hay un test dedicado a enseñarlo (`cliSiempreVacio`
pasa el negativo y cae en el positivo). Sin el negativo, la reacción natural al incidente sería
«todo vacío es sospechoso» — y una alarma que salta siempre se acaba ignorando.

## Rojo por el mecanismo, contra la herramienta que rompió DE VERDAD

No solo con dobles: se apuntó el guard a `prisma@7.9.1`, el CLI exacto del incidente.

```
control con prisma@7.9.1 → ok = false · tablas = 0
¿nombra la avería?        true
¿descarta "no hay cambios"? true
preview → ok = false · clase = sospechoso   (NUNCA sin_cambios)
```

Más los dobles inyectables: CLI mudo (exit 0 + cero bytes, la avería exacta), CLI ausente, CLI
siempre-vacío y CLI sano como control del control.

## Lo que cambia para quien migre

`CLAUDE.md` ya no documenta `npx prisma migrate diff` a pelo — apunta al script, con el aviso de
por qué el comando anterior era una trampa. El script además clasifica el SQL: si aparece un
`DROP`, `RENAME`, `TRUNCATE`, `DELETE FROM` o `SET NOT NULL`, sale con código 2 y los nombra uno
a uno.
