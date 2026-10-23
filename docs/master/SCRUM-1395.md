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
  El orquestador eligió el trinquete ancho (un test nuevo da siempre el ancla): el estrecho obligaría a
  juzgar en cada revisión si una aserción es «sólo positiva», y ese juicio es el que dejó pasar a
  `scrum589`. En `tests/scrum719-el-suelo-de-los-doce.test.mjs` se ANEXA una línea fechada al comentario
  que decía «opcional a propósito»; lo que firmó SCRUM-719 no se borra.
- **Dos comentarios que quedan diciendo lo de antes, PENDIENTES y sin tocar:**
  - `tests/_guard-texto.mjs`, dentro de `leerFuente`: «el `ancla` es opcional aqui … a proposito». Para un
    test nuevo ya no lo es. No se edita aquí: es el fichero que el censo de mudez muta y restaura.
  - `package.json`, comentario `//censo:mudez`: sigue diciendo que la red es la lista de los trece.

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
  son 85 ficheros sin suelo contando `leerFuente` sin ancla. Al orquestador le di «≈60–90». La
  diferencia —los que sólo usan `leerFuente` sin ancla— era justo la población que decidía si el
  trinquete iba ancho o estrecho: un recuento por texto y uno por AST no son dos aproximaciones, son
  dos poblaciones.
- El control del sufijo antes del push lo hice primero con un comodín en `ls-remote` y salió vacío
  también para la rama de control: ciego. Lo repetí sobre la lista entera (161 ramas, control presente).
- La sonda de exposición no tiene control positivo.
- Medí mi contexto tarde: a ojo dije «por debajo de 200k» y eran 261.491.
- Un `git merge` sin `-q` me devolvió cien líneas de ficheros ajenos.

# SCRUM-1395 · APÉNDICE · 6-oct-2026 · El obligatorio del PR #2224 salió ROJO: los casos del ⑤ no se podían ver por nombre

**Medido contra:** `origin/main` = `ee4331a46b2d89864d1f044dcdc43af32e4c4479` · 2026-10-06T14:02:00Z
A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

6-oct-2026 · **J4e** (puesto J4, relevo de J4c), por encargo del orquestador (`cobroflash-backend-90`).

## Lo que cayó

El obligatorio del PR #2224 sobre `4356ca71` salió FAILURE (job `112305101969`, leído por el
orquestador). Un caso, de `tests/scrum1415-nombres-construidos.test.mjs`:

> `SCRUM-1415 · 🔴 EL ÁRBOL: las llamadas de nombre construido son exactamente las de la lista, ni una más ni una menos`
> `tests/scrum719-el-suelo-de-los-doce.test.mjs: 1 de nombre construido (líneas 327) y la lista declara 0`

Visto caer en local ANTES de tocar nada, sobre la rama tal como estaba mezclada con `ee4331a4`:
`scrum1415` 5 de 6, con ese mismo `actual`.

## La ironía, que vale más que el arreglo

**SCRUM-1395 existe porque un guard puede PASAR sin medir nada.** Y lo que ha cazado `scrum1415` es
que los casos nuevos del ⑤ del propio 1395 no se pueden ver por nombre: salían de un bucle sobre
`FORMAS_VISTAS_1395` con el nombre construido por plantilla, así que la señal por nombres
(SCRUM-1339d) no habría podido decir que faltaban si la tanda los perdía. **Es el mismo defecto, en
el arreglo del defecto.**

La cifra: el guard cuenta UNA llamada (la de la línea 327), y esa llamada registraba **16 casos**, uno
por fila de la tabla. En el encargo venían como «cinco»; contados en el TAP son 16 (los otros cinco
del 1395 en ese fichero, ①②③④⑥, ya tenían nombre literal).

## El arreglo

El que dicta el mensaje del guard: `casosEscritos` de `tests/_casos-escritos.mjs`. El bucle se
escribe desenrollado en `tests/scrum719-el-suelo-de-los-doce.test.mjs`, 16 `test('…', clasifica1395(i))`
con el nombre literal, y `clasifica1395.todos()` al final, que no deja cargar el fichero si una fila
se queda sin caso. Cada caso compara su nombre escrito con el que sale de su fila. El cuerpo y la
tabla no cambian: ninguna aserción se toca.

No se toca: `tests/scrum1415-nombres-construidos.test.mjs`, su lista (sólo baja), el trinquete de
1395, la lista de 85 heredados, `tests/_guard-texto.mjs` ni `package.json`.

## Lo que se corrió y lo que no

Una pasada de ocho ficheros, TAP a fichero fuera del árbol, leído después: **87 de 87, 0 fallos, 0
saltos**. Por nombre:

| prefijo en el TAP | casos |
| --- | --- |
| `SCRUM-1415 · ` | 6 de 6 |
| `SCRUM-719 · ` | 8 |
| `SCRUM-1395 · ` (en `scrum719`; el fichero, 29 de 29) | 21 |
| de ellos, `SCRUM-1395 · ⑤ el analizador clasifica · ` | 16, cada uno con su nombre literal |
| `SCRUM-589` | 7 |
| `SCRUM-237` 8 · `SCRUM-976` 4 · `SCRUM-267` 10 · `SCRUM-1294` 4 · `SCRUM-525d` 8 | 34 |
| de regalo en esos ficheros: `SCRUM-1345` 4 · `SCRUM-1386` 3 · `SCRUM-649` 4 | 11 |
| control: `SCRUM-9999 · inventado` | 0 |

La línea del trinquete en esta pasada: «110 guards llaman al filtro de comentarios · 85 sin suelo (85
heredados declarados · 0 nuevos) · 24 con suelo · 1 no filtran · población: 1254 ficheros».

- **NO corrido:** la tanda completa (no es alcanzable en esta máquina), `censo:mudez`, nada gateado.
- `dist/` con `tsc --noCheck` en un worktree anidado, sin `prisma generate`.
- No comprobé con una mutación propia que un literal cambiado cae: lo afirma el caso 4 de `scrum1415`
  (`casosEscritos`: un nombre escrito que se separa de su fila cae), que pasó.

## Errores propios (J4e)

- La primera pasada de `scrum589` salió roja por MÍ: el worktree nuevo no tenía `dist/` y el fichero
  no cargaba. No era un rojo del cambio; compilé y repetí la pasada entera.
- Conté los cinco casos ①②③④⑥ con una clase de caracteres en `grep` y me devolvió 21, los mismos que
  el prefijo entero: la clase casaba con todo. Repetido con cadena fija, uno por uno: ① 1 · ② 1 · ③ 1 ·
  ④ 1 · ⑥ 1 · ⑤ 16 · y un ⑦ inventado, 0.

# SCRUM-1395b · 23-oct-2026 · El veredicto de `censo:mudez`, guardado en un JSON y exigido por `scrum719` (opción ②)

**Medido contra:** `origin/main` = `00179a513a5fb11ca12d61fe25b1b2dec26b51ca` · 2026-10-23T09:54:08Z (al cerrar, `origin/main` iba en `a34ce744b28c389c480791158b976e2b3caf0b49`: 4 commits de `docs/`, ninguno en la población ni en los ficheros de este tramo)
A9: comprobación → `tests/scrum719-el-suelo-de-los-doce.test.mjs`

23-oct-2026 · **J6** (sesión `jv-j6ah`), por encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`). La decisión es del fundador, c.18744 («Ok que pase»). El ticket lo declaró
J4 en c.18420; esto es un instrumento y lo construye J6. Hook de arranque: «SIN IDENTIDAD» (SCRUM-1498).

## Qué se construye

- `tests/_veredicto-mudez.mjs` — una pieza, dos consumidores: población (la misma lista de nombres del
  filtro que el censo), huella (sha256 con CRLF normalizado, 16 hex), `clasificar`, `juzgarVeredicto`.
- `tests/_veredicto-mudez.json` — 121 fichas `[clase, huella]` y la huella del filtro. Lo escribe el
  censo; una ficha por línea y en orden, para que dos PR que miden ficheros distintos no choquen.
- `scripts/censo-mudez.mjs --escribir` — guarda el veredicto; sin `--todo`, sólo vuelve a medir lo que
  falta, lo caducado y lo que salió sin juzgar (todo si cambió el filtro). Sin `--escribir`, igual que antes.
- `scrum719`, ocho casos `SCRUM-1395b · ①`…`⑧` (37 en total): ① cubre la población y al día, con la
  línea siempre · ② ningún MUDO · ③ lo no corrido se salta diciendo los nombres · ④ el censo y la pieza
  buscan los mismos nombres · ⑤ ⑥ ⑦ sembrados · ⑧ huella y JSON.

## La salida «no se pudo correr» (condición ③ de c.18744), diseñada

| qué pasa | censo | tanda |
|---|---|---|
| un fichero se pasa del tiempo o no ejecuta ni un test | ficha CIEGO · sale **2** | **no cae**: `# SKIP SIN JUZGAR · … (CIEGO)` en el ③, y la línea no lo cuenta como vivo |
| un fichero ya estaba rojo antes de mutar | ficha YA ROJO | ídem (y su propio rojo ya cae aparte) |
| la ficha falta o el fichero cambió | — | **cae** el ①: no es «no se pudo», es «no se corrió» |
| el filtro cambió | — | cae el ①: todo caducado |
| el censo entero no arranca (población < 20, sin firma, árbol sucio) | sale 2 o 3 y **no escribe** | la ficha sigue caducada: cae el ① |

**De paso, un defecto del censo:** hasta hoy un fichero que se pasaba del tiempo con el filtro roto
salía VIVO (`verde` falso = rojo = vivo): «no se pudo correr» se leía como el mejor veredicto. Ahora es
CIEGO (`clasificar`; lo vigila el caso ⑥). Y CIEGO hace salir el censo con 2, no con 0.

## Lo que cuesta, medido en esta máquina CARGADA (otras sesiones corriendo a la vez)

| quién lo paga | población | coste |
|---|---|---|
| **cada tanda** (`scrum719` lee el JSON, no corre el censo) | 1.458 `*.test.mjs` leídos para la población · 121 fichas | **0,7–1,9 s** (5 pasadas, `evidencias/scrum1395/1395b/coste-en-la-tanda.mjs`); `scrum719` entero, 3,2 s |
| **quien toca un guard de la población** | los ficheros caducados | **2 s** con uno (`ciclo-2-mudo.txt`) |
| **quien cambia `tests/_guard-texto.mjs`** | los 121 | **516 s y 658 s** (dos pasadas completas). El 6-oct eran 213–281 s; hoy la máquina está cargada y la diferencia no se ha separado entre carga y población (119 → 121) |

`tests/_guard-texto.mjs` ha cambiado 1 vez desde el 23-sep (6 en total). El fundador había aceptado
213–281 s **por tanda**; lo que queda es ~1–2 s por tanda y los minutos sólo para quien cambia el filtro.

## Verlo caer (con el árbol commiteado antes de cada inyección)

Las dos pasadas completas dictan lo mismo: **121 mirados · 111 VIVO · 0 MUDO · 0 CIEGO · 10 NO APLICA
· 0 YA ROJO**, sale 0, y el sha256 de `tests/_guard-texto.mjs` es `08264861…` antes y después de las dos
(condición ② de c.18744, comparando CONTENIDO).

| paso | `scrum719` |
|---|---|
| sin JSON (rojo primero) | 36 + 1 cae: ① CIEGO |
| `scrum888b` (heredado) pierde sus aserciones con `return;` en dos tests | 36 + 1 cae: ① caducado; **el trinquete de 1395 sigue verde: era el hueco** |
| `--escribir` → MUDO, sale 1 | 36 + 1 cae: ② «1 mudos» |
| deshecho + `CENSO_MUDEZ_TIMEOUT_MS=1 --escribir` → CIEGO, sale 2 | 36 + 1 salto, 0 caen: ③ `# SKIP SIN JUZGAR · scrum888b (CIEGO)` |
| `--escribir` → VIVO, sale 0 | 37 de 37; árbol idéntico al commit |

Mutaciones del instrumento: M5 (`cortado` en la pasada mutada vuelve a VIVO) cae ⑥ · M6 (la huella deja
de normalizar CRLF) cae ⑧ · M7 (la pieza pierde un nombre del filtro) cae ④. Tres de tres.

## Aceptación del ticket que este tramo toca

| lo que pide (literal) | dónde se ve |
|---|---|
| ④ hoy `censo:mudez` sale 1 nombrando `scrum589`. Después, ese 1 lo tiene que ver alguien sin correrlo a mano | `tests/scrum719-el-suelo-de-los-doce.test.mjs`, caso `SCRUM-1395b · ②` (y el ① si la ficha caducó) |
| ⑥ La línea que sale SIEMPRE, también con cero: «N guards mirados · K mudos», con su población | caso `SCRUM-1395b · ①`: «121 guards mirados · 0 mudos · 111 vivos · 10 no aplica · 0 sin juzgar (no se pudo correr) · 0 sin medir o caducados · población: …» |

## Lo que NO ve, dicho

- La huella es del fichero de TEST, no de lo que lee: si cambia el código vigilado y eso vuelve mudo a un
  guard, su ficha no caduca. Lo ve la siguiente pasada completa.
- Un JSON escrito a mano pasa (el mismo límite que la M3 del trinquete); se ve en el diff.
- `CENSO_MUDEZ_EN_CURSO=1` salta los casos ①②③ (los pone el censo a sus hijos). Ningún workflow lo pone hoy; no hay guard que lo impida.
- Corrido: `scrum719`, `scrum237`, `scrum976`, `scrum1415`, `scrum1185`, `scrum411`, `scrum808`,
  `scrum1178b`, `restauracion-del-arbol-ejecutable`, `scrum589`, `scrum850`: 139 de 139 sobre 11 ficheros.
  **NO corrido: la tanda completa.**

## Errores propios (J6)

- Diseñé que una ficha CIEGO con huella al día contara como «al día»: un `--escribir` normal no la habría
  reintentado nunca. Lo vi al planear el ciclo, antes de correrlo; ahora se reintenta.
- La M6 la inyecté con `sed` y no se aplicó; sin la línea de `--numstat` al lado la habría leído como
  «mutación muda». Repetida con el editor, cae.
- La segunda pasada completa pasó de 600 s y el arnés la mandó a segundo plano, contra el encargo
  («sin esperas en segundo plano»). No la maté: habría dejado el filtro mutado.
- Un `grep "censo" package.json` me volcó 43 KB de una línea de comentario.
