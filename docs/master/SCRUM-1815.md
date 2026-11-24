# SCRUM-1815 · El latido reconoce el puesto de los nombres `jv-jN` (S5, 24-nov)

**Medido contra:** `origin/main` = `db0a6c04541c258eda6499e1088cf16db9f1836b` · 2026-11-24T18:30:01Z

A9: sin fallo que generalice — test con rojo primero, mutaciones en el catálogo y medida declarada de lo que no se pudo medir aquí.

Hijo de SCRUM-1238, abierto por el orquestador J (`cobroflash-backend-2d`). El encargo y el diseño los trajo el
orquestador (`orquestador`, antes `cobroflash-backend-41`) por SendMessage el 24-nov, con la descripción íntegra
del ticket, que no tiene comentarios. Puesto S5: `scripts/equipo/latido.mjs` es de este carril.

## Qué pasaba

`puestoDe` (`scripts/equipo/latido.mjs`) sólo leía `sN-…` y `sesion-N`. Con un nombre del equipo de Javier
(`jv-j1iv`, `jv-j6fm`…) daba null. Entonces el CEMENTERIO no podía buscar el relevo y dejaba la pregunta en «NO SE
PUEDE SABER si su puesto siguió: su nombre no dice de qué puesto es», aunque el puesto está en el nombre. J6 lo
midió en su máquina: 85 preguntas.

## Qué cambia (sólo `scripts/equipo/latido.mjs`)

- `puestoDe('jv-j<N>…')` → **`'J<N>'`, una cadena**. Es el diseño del orquestador: un número chocaría con el
  puesto S del mismo número. La forma es la de `puestoDeNombre` en `scripts/_carriles.mjs` (SCRUM-1506c): N de 1
  a 6, y detrás hasta 3 letras o `-…`. Los nombres S siguen dando su número, igual que antes.
- `etiquetaDePuesto` (3 → `s3`, `'J1'` → `j1`) y `puestoDeEtiqueta`, que hace lo contrario. Los renglones
  plegados del cementerio y las órdenes que imprimen (`contestada j1 "…"`, `preguntas j1`) los usan, y las dos
  órdenes aceptan `j<N>` además de `s<N>`.
- Al plegar, el orden es primero S por número y luego J. Antes se restaban los puestos (`x - y`), y con una
  cadena eso da `NaN`.
- **Invariante ①:** TRASPASO no busca el traspaso de un puesto J en esta máquina (allí sería `project_sJ1_…`,
  que no existe y daría una alarma falsa). Esas sesiones se cuentan aparte, en su población: «N del equipo de
  Javier (su traspaso vive en su máquina; NO medidas)».
- `aparcar.mjs` y `parados.mjs` no cambian: `aparcar` compara con un número de puesto S, así que un J nunca le
  casa; `parados` sólo pinta el puesto.

## Test

`tests/scrum1815-latido-puesto-jv.test.mjs`, 6 casos, todos puros (sin `gh` y sin el registro de trabajos de la
máquina):

- ① los nombres reales del ticket (`jv-j1iv`, `jv-j1iw`, `jv-j2em`, `jv-j5bq`) y los de J6 (`jv-j6fm`,
  `jv-j6fj`) dan su J. Controles S: `sesion-5`, `s3-1oct`, `s4-1octb`. Siguen en null: `jv-x`, `jv-j9z`, `jv-j7`,
  `jv-j0`, `jv-j12`, `jv-j4abcd`, `jv-j`, `xjv-j1`, `cobroflash-backend-57`, `orquestador` y el vacío.
- ② **por efecto**, en el cementerio: las de J salen RELEVADAS si hay una sesión posterior de su puesto y SIN
  RELEVO si no la hay. Hay 0 en NO SE PUEDE SABER, y el renglón plegado dice `j1 · …`, con su orden.
- ③ un S y un J del mismo número no son el mismo puesto, ni al relevar ni al marcar (`marcarPuesto`).
- ④ TRASPASO sólo pide el traspaso del puesto S.
- ⑤ las órdenes entienden `j1`…`j6` y `s<N>`, y nada más.
- ⑥ **control de la parte 1 del ticket** (ver abajo).

**Rojo primero:** sobre `main` el fichero no carga, porque le faltan las dos funciones nuevas: es un rojo de
importación y no caso a caso. El rojo caso a caso es la primera mutación del catálogo, que deja `puestoDe` como
estaba en `main` para los J: tumba ① ② ③ ④ ⑥. Con la cura salen 6/6, y los 32 ficheros de test que tocan el
latido, `aparcar` o `parados` dan 348/348, con 0 saltados.

Mutaciones: catálogo → tests/scrum1815-latido-puesto-jv.test.mjs

Las corrí a mano una por una, primero la base sin mutar (6/6) y restaurando los bytes cada vez. **Las 3 vivas.**
Quitar la expresión de J tumba ①②③④⑥. Devolver el J como número tumba ①②③④⑥, ③ entre ellos. Quitar la
exclusión de TRASPASO tumba ④.

## La parte 1 del ticket («te está esperando»): no he construido nada, y por qué

El ticket pide que, cuando una sesión termina su turno con `needs`, el vigía y el latido saquen una línea. J midió
que no salía ninguna para `jv-j1iv`, `jv-j1iw`, `jv-j2em` y `jv-j5bq`.

**Lo que mide este árbol, con funciones puras:**
- **Latido:** `seccionSesiones` ya saca una línea para TODA sesión de las últimas horas con `needs`, esté en el
  estado que esté (`espera(s)` mira `state`, `tempo` o `needs`). El caso ⑥ lo prueba con `jv-j1iv` en `done` y
  con `needs`: sale con su pregunta y, desde este cambio, con su relevo y la orden `contestada j1`. Antes de este
  cambio la línea ya salía, sólo que sin relevo.
- **Vigía** (`scripts/clase-de-sesion.mjs`, SCRUM-1238b; no lo toco): ya tiene la línea literal «te está
  esperando» para TERMINADA-ESPERANDO (sin proceso, con `needs` y con un turno terminado). Con proceso, la misma
  sesión sale VIVA-BLOQUEADA y también con línea.

**MI LECTURA, no medida:** que no saliera «ninguna línea» en la máquina de J casa con la nota del propio ticket:
el latido entero sale CIEGO en 280 s con 0 B de salida. Si la pasada no termina, no imprime ninguna sección,
tampoco SESIONES. No lo he podido comprobar: esas cuatro sesiones viven en la máquina de Javier. En esta máquina
hay 123 trabajos y todos se llaman `sesion-N`, y el libro del cementerio tiene 48 preguntas, todas de S.

## Lo que NO se ha medido

- **La aceptación: re-medir el CEMENTERIO para ver si las 85 salen RELEVADAS.** Desde esta máquina no se
  puede: el libro y el registro de trabajos del equipo J están en la de Javier. La tiene que tomar J
  (`node scripts/equipo/latido.mjs preguntas`, o las funciones exportadas, como hizo J6) con este cambio en su
  árbol. Por cómo está construido, una pregunta J sale RELEVADA sólo si su puesto tiene una sesión `jv-jN`
  posterior con `createdAt`. Las que no la tengan saldrán SIN RELEVO, que es lo correcto y no un fallo.
- Allí `sesion-N` es J (`config.identidades` de `sesion.mjs`, ver la cabecera de `puestoDeNombre`), y el latido
  lo sigue leyendo como S. No lo cambio: el encargo pide la forma `jv-jN`, y traducir `sesion-N` según la máquina
  es otra decisión.
