# Auditoría de cierres

> **UN documento, que se actualiza.** Cada pasada sustituye la anterior; la cabecera dice de cuándo es.
> Dueña: S0. Diseño: `docs/master/SCRUM-1348.md`. Instrumento: `scripts/auditoria-cierres.mjs` (SCRUM-1372).

**Última pasada: 1-oct-2026, 13:33Z** · contra `origin/main` = `8995084a0b7be02ec89c0aaa1d7eb3958ec89283` ·
ventana: cerrados desde el 29-sep-2026 · semilla `2026-10-01`

## Qué mide y qué no

| | qué hace | quién |
|---|---|---|
| **La criba** (esto) | dice qué cierres NO se pueden comprobar, o dicen de sí mismos que no se miraron | un script, 3 segundos |
| **La lectura** | dice si lo construido CUMPLE la frase de su aceptación | alguien que lee la aceptación y mira el producto |

La criba marca candidatos, no culpables. **Un cierre sin marca no está aprobado: solo no está marcado.**
La cifra del equipo sale de la lectura AL AZAR, no de la criba. **Esta pasada no tiene lectura: no hay cifra.**

## Población

| | |
|---|---|
| cierres en la ventana | **61** |
| cribados | 61 de 61 |
| merges en `main` en la ventana | 284 |
| sin aceptación escrita (no se pueden leer contra nada) | **31** |
| marcados | **9** |
| canario | saltó |
| C3, «sin desplegar» | no construida: no se mira |

## Los marcados

| cierre | puesto | señal | lo que vio la criba |
|---|---|---|---|
| SCRUM-1131 | J1 | sin rastro | ni registro ni commit en `main` que lo nombre |
| SCRUM-1361 | S0 | sin rastro · sin tabla | ni registro ni commit; cerrado con la norma de la tabla ya viva |
| SCRUM-1196 | J4 | trabajo fuera | `scrum-1196-fecha-de-la-politica` está fuera de `main` y fusionarla cambiaría `docs/master/SCRUM-1154.md` |
| SCRUM-1229 | S2 | dice que no se vio, **sin decir por qué** | su último comentario: «no verificable» |
| SCRUM-1142 | J1 | dice que no se vio, con su motivo | «no se ha podido ver» |
| SCRUM-1171 | S1 | dice que no se vio, con su motivo | «no visto» |
| SCRUM-1276 | S1 | dice que no se vio, con su motivo | «no se ha visto» |
| SCRUM-1279 | S1 | dice que no se vio, con su motivo | «no se ha visto» |
| SCRUM-1355 | S1 | dice que no se vio, con su motivo · sin tabla | «no se verificó»; cerrado con la norma de la tabla ya viva |

**Cinco de los seis «no se vio» dan su motivo al lado**, y es casi siempre el mismo: el entorno de pruebas
no tiene el dato que hace falta (SCRUM-1367: ni un Trabajo con presupuesto aceptado, ni un cliente sin
número, ni perfil fiscal en la cuenta QA). **Eso no es un cierre malo: es un cierre honesto con un límite
dicho.** La criba los separa del que calla, y a quien hay que mirar primero es al que no dio motivo (1229).

**Lo que ya se sabe de tres de ellos, sin leer nada más** (y por eso la criba no acusa):

- **1131** es un cierre por duplicado: el trabajo entró bajo otro commit (medido en el piloto de SCRUM-1348).
- **1361** es un cierre por DESCARTE, con sus motivos en el ticket. No hay trabajo que buscar.
- **1196** tiene su contenido en `main` por otra rama (#2023). Lo que la rama cambiaría son tres líneas de un
  registro. Es una rama por borrar.

Dos de las tres marcas «seguras» son cierres sin trabajo (un duplicado y un descarte). La criba no los
distingue de un cierre vacío, porque Jira los deja con el mismo estado.

## Sin aceptación escrita (31)

1127, 1142, 1189, 1196, 1200, 1203, 1216, 1230, 1232, 1235, 1243, 1261, 1262, 1266, 1267, 1270, 1280, 1290,
1299, 1301, 1307, 1309, 1318, 1326, 1333, 1337, 1340, 1350, 1357, 1358, 1359.

Sobre estos, «auditar contra su aceptación» no significa nada.

**¿De cuándo son?** La norma (A13.1, «un ticket sin aceptación no se reparte») entró en `main` el 1-oct a
las 12:27Z. Por fecha de APERTURA del ticket, leída de Jira:

| abierto | cuántos | cuáles |
|---|---|---|
| **después de la norma** | **0** | — |
| el 1-oct, antes de la norma | 11 | 1307, 1309, 1318, 1326, 1333, 1337, 1340, 1350, 1357, 1358, 1359 |
| el 29-sep | 9 | 1261, 1262, 1266, 1267, 1270, 1280, 1290, 1299, 1301 |
| el 28-sep | 8 | 1196, 1200, 1203, 1216, 1230, 1232, 1235, 1243 |
| el 27-sep o antes | 3 | 1127, 1142, 1189 |

Los 31 son **línea base**: ninguno se abrió con la norma viva. Los cuatro más recientes (1350, 1357, 1358,
1359) se abrieron entre 25 y 90 minutos antes de que entrara. Por equipo: 20 de Javier, 8 de Luis, 3 sin
etiqueta. La cifra que importa es la de la pasada siguiente: cuántos de los abiertos DESPUÉS de las 12:27Z
del 1-oct se cierran sin aceptación. Hoy esa población es cero, así que hoy no hay respuesta.

**No se puede comparar con el «23 de 47» del piloto.** Aquél era sobre 47 cierres (la misma ventana, seis
horas antes) y lo leyó otro agente con otra instrucción. «31 de 61» es lo que encontró quien bajó los
cierres hoy, con la orden de no deducir una aceptación que no esté rotulada. No los he releído uno a uno.

## A quién habría que leer

| grupo | cuántos | quiénes |
|---|---|---|
| seguros (van todos) | 3 | 1131, 1196, 1361 — los tres con respuesta ya conocida, arriba |
| dicen que no se vio | 6 | 1229 (sin motivo), 1142, 1171 dentro del tope · 1276, 1279, 1355 fuera |
| al azar, uno por puesto | 3 de 9 puestos | 1272 (S2), 1291 (sin área), 1305 (J6) · sin lectura: J1, J2, J3, J4, S1, S5 |

Con el tope de 6 del diseño se leen 6 de los 15 que hacen falta para tener un cierre al azar de cada
puesto y todos los que dicen de sí mismos que no se vieron. **El tope y «uno por puesto» no caben juntos
con nueve puestos cerrando.** Es una decisión de gasto, no del instrumento.

## Cómo se corre

1. Una sesión baja los cierres de la ventana con el conector de Jira y los deja en un fichero (la forma
   exacta, en la cabecera de `scripts/auditoria-cierres.mjs` y en `docs/master/SCRUM-1372.md`). El script
   no tiene credenciales. Esta vez: un agente, 2 minutos, unos 100.000 tokens.
2. `node scripts/auditoria-cierres.mjs <fichero> --desde AAAA-MM-DD --paquetes <carpeta>`, desde un árbol
   con `origin/main` al día.
3. Sale 0 (nada marcado), 1 (hay marcados) o 2 (la pasada NO VALE: no da cifra).
