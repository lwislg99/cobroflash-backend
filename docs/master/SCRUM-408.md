# SCRUM-408 · Endurecer el parseo y REDACTAR los impresores del backup

**Fecha:** 9-ago-2026 · **Carril:** scripts / seguridad · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `b0b26a04306adb6dfc4ff0d9bb3a0e7876fdafab` · 2026-08-09T20:40:00+02:00
**Tanda:** 2336 tests, 2263 pass, 0 fail

## 🔴 EL TICKET AFIRMABA UNA FUGA QUE NO EXISTÍA

El enunciado decía que `backup-dump.mjs` **«pasa la URL de producción EN EL ARGV de pg_dump»**.
**Es falso, y lo escribí yo en el informe anterior sin comprobar ese punto.** Medido leyendo el
fichero:

```
pgPassword = decodeURIComponent(u.password);
u.password = '';          ← lo que ven pg_dump, argv y `ps`: URL SIN contraseña
execFileSync('pg_dump', [..., urlSinPass], { env: { ..., PGPASSWORD: pgPassword } })
```

La contraseña **sale por el entorno del hijo desde SCRUM-196/223**. Y el punto 2 del alcance
—«elige entre variables de entorno y `.pgpass` y justifícalo midiendo»— **ya estaba resuelto y
justificado por escrito en el propio fichero**: `.pgpass` se consideró y se descartó por «misma
exposición owner-only, pero sin fichero temporal que crear/chmod/limpiar ni el riesgo de que un
crash lo deje en disco», con la vía residual **declarada** (`/proc/<pid>/environ`, mode 0400:
dueño y root, no otros usuarios) y un aviso de no «simplificarlo» de vuelta, porque pasar la URL
como argumento es la práctica correcta contra inyección de shell.

**Se deja escrito con todas las letras porque cerrar un ticket diciendo que arregló algo que ya
estaba arreglado es exactamente el patrón que llevamos el día entero persiguiendo.**

## Lo que SÍ se cierra

**Una fuga real, más pequeña: información de conexión en el log.**
`main().catch((e) => console.error('backup FALLÓ:', e?.message || e))` imprimía sin redactar. El
`.message` de un `execFileSync` lleva **la línea de comando entera** y `.spawnargs` los argumentos:
**host, usuario y base** acababan en el log. No es la contraseña —esa salió de argv en SCRUM-196—
pero es información de conexión donde no pinta nada. Y `redactarSecretos` **ya existía** en
`_db-guard.mjs`: este script no la importaba. Redactados **los dos** impresores (el del
restore-test también: `erroneas` sale de la salida de `pg_restore`, que puede traer la cadena
dentro de su propio error).

**El parseo a pelo, endurecido.** El `new URL(...)` de la línea 167 **hoy no fugaba** —su `catch`
imprime un texto fijo—, pero esa seguridad dependía de que **ese catch siguiera siendo correcto
para siempre**, en un fichero que edita cualquiera. El arreglo es que el parseo viva en un solo
sitio, no que cada sitio lo haga con cuidado.

### Dónde se parte, y por qué no valía `parseBDSegura` tal cual

`parseBDSegura` **nunca devuelve la contraseña**, y eso es deliberado. Pero `pg_dump` necesita las
dos cosas: la URL sin contraseña para el argv y la contraseña para su entorno. La pregunta no era
si se parte, sino **dónde**.

Se parte en `_db-guard.mjs` (`partirBDParaHijo`), **el único módulo exento del guard de SCRUM-195 y
por su mismo motivo**: es donde el `new URL` vive dentro de un `try` cuyo `catch` no toca el error.
Devuelve la contraseña —inevitable si alguien va a autenticar— pero **la URL completa no sale de
ahí**: quien la recibe tiene un secreto en una variable, no una cadena lista para imprimir por
accidente.

## Censo, congelado con suelo

**Un solo sitio en cada eje** —construcción de URL a pelo y URL por argv—: `backup-dump.mjs`. No
había trampa puesta en otro lado.

El escáner del guard **no tenía suelo**: con `readdirSync` devolviendo vacío pasaba en vacío, y
«ningún script parsea a pelo» habría significado «no miré ninguno». Y el suelo **no puede ser
«≥1 violación»**, porque el objetivo es que haya cero: el suelo correcto es **demostrar que el
detector VE**, y se demuestra sobre `_db-guard.mjs` —el exento—, que sí tiene `new URL`.

## Entra el guard huérfano de SCRUM-391

`scrum195-url-bd-sin-fuga` se **extrae** de `origin/scrum-37b-agregacion-por-job` (la rama **no** se
mergea) y entra en verde. **No estaba caducado: el defecto estaba vivo**, y ésa era la razón de que
no pudiera entrar antes. Esto cierra la parte que SCRUM-391 dejó declarada.

## Verificado en rojo, por `$?`

| # | Qué se rompe | `$?` |
|---|---|---|
| 1 | Se devuelve el parseo a pelo (`new URL` en el backup) | **1**, nombrando el script y el argumento |
| 2 | El impresor deja de redactar | **1** — «saca un error sin redactar» |
| 3 | SUELO: el escáner deja de ver scripts | **1** — «solo 0 scripts leídos» |

## 🔴 HALLAZGO · el control positivo NO está verificado, y probablemente nadie lo verifica

**No se ha ejecutado el backup**: hacerlo exige una base real, y ninguna medición de este ticket
vale eso. **Declarado como no verificado.**

Y el hallazgo que sale de mirarlo: con **SCRUM-242** delante —sin backup programado, sin copia
fuera de la infraestructura, sin retención—, la lectura honesta es que **este script no lo ejecuta
nadie**. Un backup que nadie ejecuta es un backup que no existe. Va aquí como hallazgo, no como
nota al pie; el backup **como proceso** es SCRUM-242 y no se toca desde aquí.

Ficheros: `scripts/_db-guard.mjs` (+`partirBDParaHijo`) · `scripts/backup-dump.mjs` (parseo y los
dos impresores) · `tests/scrum195-url-bd-sin-fuga.test.mjs` (9, extraído + suelo nuevo).
