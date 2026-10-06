# SCRUM-1395 · El filtro sin suelo no crece, y `scrum589` deja de estar mudo

**Medido contra:** `origin/main` = `b71719f32f623729debec40518e3c7c6d3601086` · 2026-10-06T13:42:22Z

A9: comprobación → `tests/scrum719-el-suelo-de-los-doce.test.mjs`

Sesión J4c (`jv-j4`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). El
ticket no lleva etiqueta de área; el orquestador lo declara del equipo de Javier y del puesto J4.
Los dos censos de mudez y las cuatro esquinas se corrieron sobre `6aaec0dc8f0267518a50f626299ae901f81e2ae1`;
entre ese commit y el del ancla `main` no tocó ningún fichero de este PR (`git diff --stat`, vacío).

Se toca: `tests/` (un ayudante nuevo, una lista nueva, casos añadidos a `scrum719` y UNA aserción de
`scrum589`), este registro y su carpeta de evidencias. **Nada de `src/`, ningún workflow, ningún guard
relajado.**

## ① Por qué `scrum589` era mudo, y desde cuándo

Su línea 164 era `assert.ok(!/sustituye al nombre/.test(soloEjecutable(src)))`: una negación sobre el
texto filtrado, sin nada que compruebe que el filtro devolvió algo. Es la forma exacta que describe la
cabecera de `tests/scrum719-el-suelo-de-los-doce.test.mjs`.

**Desde que nació.** El fichero tenía un solo commit (`c45b89c6`, 6-sep-2026) y esa línea era la misma.
No lo causó un cambio en lo que vigila. Nació dos días después de que SCRUM-719 (`6074df38`, ancestro
suyo) pusiera suelo a los trece, cuando `ejecutableDe` ya existía. No se corrió el censo sobre
`c45b89c6`: se deduce de «misma línea» más lo medido hoy.

**No estaba muerto.** Las cuatro esquinas, con `docs/master/evidencias/scrum1395/cuatro-esquinas.mjs`
(7 tests en las ocho pasadas; el árbol se devuelve byte a byte y se comprueba):

| esquina | antes | después |
|---|---|---|
| A · árbol sano | verde | verde |
| B · filtro vaciado (la mutación del censo) | **verde** | **rojo** |
| C · filtro sano + la frase prohibida en el código de `quotesView.js` | rojo | rojo |
| D · filtro vaciado + la frase prohibida | **verde** | **rojo** |

En las tres que caen, cae el mismo caso: «la nota ya no afirma la sustitución automática». «Mudo»
aquí quería decir «sin respaldo si el filtro se queda ciego», no «no caza».

**El arreglo** es esa línea: pasa a `ejecutableDe(src, { ancla: 'dfNote.textContent', donde: VISTA })`.
El ancla es la asignación de la nota, de la que ese mismo test ya depende tres líneas antes. La
aserción afirma lo mismo; cambia de dónde sale el texto. Autorizado por el orquestador con la
condición de la tabla de arriba.

## ② Las dos listas, enfrentadas

| | `npm run censo:mudez` | `scrum719` antes de este PR |
|---|---|---|
| población | todo `*.test.mjs` que nombre el filtro: **119** | una lista cerrada de **13** nombres |
| qué dicta | VIVO · MUDO · CIEGO · NO APLICA, midiendo | que los trece conservan su ancla |
| un guard que nace después | lo mira | no lo ve |
| dónde corre | en ningún sitio: a mano | en la tanda |

El hueco no era sólo «vigila el ancla y no la mudez»: vigilaba 13 de 119. `scrum589` no podía estar en
la lista porque nació después de escribirla. Los 106 restantes, y todo guard futuro, no tenían red.

El censo de mudez, antes y después (salidas enteras en la carpeta de evidencias; el `sha256` de
`tests/_guard-texto.mjs` es el mismo antes y después de cada pasada):

| | VIVO | MUDO | CIEGO | NO APLICA | YA ROJO | salida | segundos |
|---|---|---|---|---|---|---|---|
| antes | 108 | 1 (`scrum589`) | 0 | 10 | 0 | 1 | 281 |
| después | 109 | 0 | 0 | 10 | 0 | 0 | 213 |

Los 4 «YA ROJO» que J6j dejó sin juzgar el 1-oct eran de su copia sin `.git`; en un árbol con git se
juzgan, y salen VIVO.

## ③ Lo que se construye: la opción sin workflow

Decisión del orquestador (6-oct, por mensaje; recogida en Jira c.18420).

`tests/_censo-filtro-sin-suelo.mjs` lee cada `*.test.mjs` por AST, sigue lo que importa de
`_guard-texto.mjs` (con alias, `import * as` y `await import`) y clasifica cada llamada:

- **sin suelo:** `soloEjecutable(x)`, `leerFuente(r)` sin `ancla`, `ejecutableDe` con `sinAncla`;
- **con suelo:** `ejecutableDe(x, { ancla })`, `leerFuente(r, { ancla })`, `ejecutablesDe`;
- **no filtra:** `leerFuente(r, { conComentarios: true })`;
- **sin juzgar:** opciones que no son un literal legible, o un fichero que no parsea. Cuenta como sin suelo.

Y `scrum719` gana estos casos (21; el fichero pasa de 8 a 29):

- ① la línea, siempre, con su población;
- ② un test nuevo no llama al filtro sin suelo;
- ③ la lista de heredados no baja en silencio, su número está escrito dos veces y conserva su motivo;
- ④ `scrum589` tiene suelo y no es un heredado;
- ⑤ dieciséis formas que el analizador tiene que clasificar (diez sin suelo o sin juzgar, seis que no acusa);
- ⑥ un fuente que no parsea sale sin juzgar.

La línea de hoy:

> SCRUM-1395 · 110 guards llaman al filtro de comentarios · 85 sin suelo (85 heredados declarados · 0
> nuevos) · 24 con suelo · 1 no filtran · población: 1247 ficheros *.test.mjs de tests/ leídos, 0 sin
> parsear · aparte: 3 módulos de apoyo llaman al filtro y no se juzgan

**Dos sondas que coinciden:** el censo de mudez, ejecutando, dice que 109 llaman al filtro de verdad y
que `scrum201` no pasa por él; el censo por AST, leyendo, dice 110 con `scrum201` como «no filtra». Los
otros nueve NO APLICA del censo de mudez no salen en el de AST. Se comparó por recuento y por esos diez
nombres; el censo de mudez no imprime los nombres de los VIVO, así que el conjunto entero no se cotejó.

### Los 85 heredados, declarados

Están en `tests/_filtro-sin-suelo-heredados.json` (84 sin suelo y 1 sin juzgar, `scrum191`, que llama a
`leerFuente(ruta, 'utf8')`). Salieron del censo, no se escribieron a mano
(`docs/master/evidencias/scrum1395/generar-heredados.mjs`).

- **Por qué se toleran:** en el censo de mudez de hoy los 85 son VIVO, porque tienen otra aserción que
  cae sobre la nada. Eso no es un suelo.
- **Lo que queda sin vigilar:** si alguien quita esa otra aserción, el fichero pasa a mudo y nada avisa
  hasta la siguiente pasada manual del censo.
- **Qué los retira:** pasarlos a una forma con suelo y quitar su nombre, en el mismo commit.
- **Añadir uno cuesta dos ficheros:** el JSON y `TECHO_HEREDADOS_1395` en `scrum719`. El mensaje del
  rojo dice que subirlo es una decisión del orquestador, no un arreglo.

### El trinquete, visto caer

`docs/master/evidencias/scrum1395/mutar.mjs` (salida en `salida-mutar.txt`), con la base sin mutar
primero (29 de 29) y el árbol devuelto byte a byte:

| mutación | resultado |
|---|---|
| M1 · nace un test con `soloEjecutable` directo | cae ② |
| M2 · nace y se cuela en la lista, sin tocar el techo | cae ③ |
| M3 · se cuela en la lista **y** se sube el techo | **no cae: es el límite, declarado** |
| M4 · se borra un heredado de la lista sin arreglarlo | caen ② y ③ |
| M5 · un nombre de más en la lista | cae ③ |
| M6 · `scrum589` vuelve a la forma sin suelo | caen ② y ④ |
| M7 · la lista pierde su motivo | cae ③ |

Seis vivas de siete. La M3 no la puede ver ningún trinquete: quien toca los dos ficheros ha tomado la
decisión a mano. Lo que hace el trinquete es que se vea en el diff.

## La aceptación del ticket, línea a línea

| lo que pide (literal) | dónde se ve |
|---|---|
| ① Por qué `scrum589` es mudo, y DESDE CUÁNDO | este registro, §① · `docs/master/evidencias/scrum1395/cuatro-esquinas.mjs` |
| ② ¿qué parte del veredicto de `censo-mudez` queda sin vigilar al no estar en CI? | este registro, §② y «Los 85 heredados» |
| ③ Qué hacer con los 5 minutos | `tests/scrum719-el-suelo-de-los-doce.test.mjs`, casos `SCRUM-1395 · ①` a `⑥` |
| ④ hoy `censo:mudez` sale 1 nombrando `scrum589`. Después, ese 1 lo tiene que ver alguien sin correrlo a mano | el 1: `censo-mudez-antes.txt`. **PARCIAL:** lo que se ve sin correrlo a mano es que nazca OTRO como él (caso ②), no que un heredado se vuelva mudo |
| ⑤ los 104 VIVO siguen saliendo VIVO, y ninguna aserción cambia en ningún guard | `censo-mudez-despues.txt`: 108 → 109 VIVO, 0 mudos. **Cambia UNA aserción, la de `scrum589`, con autorización**; ninguna otra |
| ⑥ La línea que sale SIEMPRE: «N guards mirados · K mudos» | **NO HECHO en esa unidad** → la línea del caso ① dice «N llaman al filtro · K sin suelo», que es lo que se puede medir en la tanda. «K mudos» sólo lo dicta `censo:mudez`, a mano. Decide el orquestador |

## Lo que NO cierra, y la alternativa medida

- **Los heredados entre dos pasadas del censo.** Es el hueco del ④ y del ⑥.
- **La alternativa que lo cerraría, sin construir:** que el censo de mudez escriba su veredicto a un
  JSON versionado y `scrum719` exija que todo fichero de la población figure en él. Mide de verdad,
  pero obliga a correr el censo (213 a 281 s medidos hoy, y muta `tests/_guard-texto.mjs` mientras
  corre) cada vez que nace o cambia un guard, en los dos equipos. El orquestador no la impone a otro
  equipo y la sube al fundador.
- **Un job programado:** es un workflow. No se toca.
- **Los envoltorios.** Tres módulos de apoyo (`_afirmaciones-derivadas.mjs`, `_censo-correo.mjs`,
  `_condiciones-vs-emisor.mjs`) llaman al filtro por dentro; quien los use no sale en este censo. Se
  cuentan en la línea y no se juzgan.
- **Tensión con SCRUM-719, dicha:** `leerFuente` dejó el `ancla` opcional a propósito, porque también lo
  usan tests que sólo exigen. Desde hoy un test NUEVO tiene que dársela aunque sólo exija. Cuesta una
  opción, y es lo que hace que no haya que distinguir a mano quién prohíbe y quién exige.
- **`package.json`, comentario `//censo:mudez`:** sigue diciendo que la red es la lista de los trece. No
  se ha tocado.

## Exposición

`docs/master/evidencias/scrum1395/exposicion.mjs`, 6-oct ~13:32Z: 8 PR abiertos, 0 añaden un test que
llame al filtro sin suelo, 1 sin poder mirar (#2215: el fichero no estaba en el objeto traído). La
sonda no lleva control positivo: no había ningún PR abierto que se supiera expuesto.

## Lo que se corrió y lo que no

- `tests/scrum719…`: 29 de 29. `tests/scrum589…`: 7 de 7.
- `censo:mudez` entero, dos veces, con turno del orquestador y entorno limpio (sin `FORCE_COLOR`).
- **Tanda completa local: NO** (no es alcanzable en esta máquina; el obligatorio del CI es la tanda).
- `dist/` compilado con `tsc --noCheck` en un worktree anidado que hereda `node_modules`, sin
  `prisma generate`.

## Errores propios

- El primer recuento de población fue por texto y dio «61 llaman a `soloEjecutable` directo»; por AST
  son 85 ficheros sin suelo contando `leerFuente` sin ancla. Al orquestador le di «≈60–90».
- La sonda de exposición no tiene control positivo.
- Medí mi contexto tarde: a ojo dije «por debajo de 200k» y eran 261.491.
- Un `git merge` sin `-q` me devolvió cien líneas de ficheros ajenos.
