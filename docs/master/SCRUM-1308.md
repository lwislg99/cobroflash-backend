# SCRUM-1308 · Ningún script fuera de `tests/` se llama como un test

**Medido contra:** `origin/main` = `46195e86903cdccc85a04327c0a68577773c4693` · 2026-10-01T00:02:00+01:00
(J3 del equipo de Javier, por encargo del orquestador `cobroflash-backend-47`)

A9: comprobación → `tests/scrum1308-scripts-sin-nombre-de-test.test.mjs`

## 0 · El permiso

**Javier, 1-oct-2026, literal: «3-Autorizo»** (consta en el ticket), sobre renombrar los dos ficheros en
vez de poner un hook. El orquestador amplió después, por escrito, a las autorreferencias de los dos
scripts como consecuencia mecánica del renombrado (ver §3).

## 1 · El defecto

`node --test` sin ficheros descubre por NOMBRE, ejecuta lo que casa con su patrón y lo cuenta como
test en verde si sale 0. El 30-sep, con una lista vacía, ejecutó los dos scripts de `scripts/` que se
llamaban como tests: la tanda gateada (conectó a una base) y la sonda de WhatsApp.

**El patrón, preguntado a `node` v24.18.0** (`kDefaultPattern` del runner), no copiado:
`**/{test,test/**/*,test-*,*[._-]test}.{js,mjs,cjs,ts,mts,cts}`. Es más ancho que lo que decía el
encargo: también `.ts/.mts/.cts`, `test.*` y cualquier fichero dentro de una carpeta `test/`.

**Población medida** (recorrido del disco, sin `node_modules/` ni `.git/`, `dist/` y `.claude/`
incluidos): 4.782 ficheros; casan 1.133 en `tests/` (los tests de verdad) y **2 fuera**, los de este
ticket. Tras el renombrado, **0 fuera**.

## 2 · Tabla de correspondencia

| nombre hasta el 30-sep-2026 | nombre desde SCRUM-1308 | motivo |
|---|---|---|
| `test-staging-gated.mjs` (en `scripts/`) | `scripts/staging-gated.mjs` | el prefijo `test-` casaba con el patrón de `node --test` |
| `wa-test.mjs` (en `scripts/`) | `scripts/wa-prueba.mjs` | el sufijo `-test` casaba con el patrón de `node --test` |

`npm run test:staging:gated` y `npm run test:staging` **se llaman igual**: sólo cambia la ruta que hay
dentro de `package.json`.

## 3 · Qué se cambió y qué NO, con el criterio

**Cambiado (referencias VIVAS, las que alguien ejecuta o lee para actuar hoy):** `package.json`,
`.github/CODEOWNERS`, `.gitignore`, `docs/ASESOR.md`, `docs/QA/SUITE_REGRESION.md`,
`docs/WHATSAPP_TEMPLATES.md`, cinco `scripts/_*.mjs` y `scripts/preflight-schema-drift.mjs`
(comentarios), un comentario de `src/integrations/whatsappTemplates.ts`, y los tests que leen la ruta
del runner (entre ellos `scrum161`, `182`, `187`, `188`, `199`, `239`, `249`, `265`, `268` y `124`).
En `tests/_espera-automatica.mjs` el detector de «este comando lanza la tanda» pasa de buscar el nombre
viejo a buscar `staging-gated`, que casa con los dos: no se estrecha lo que detecta.

**Autorreferencias de los dos scripts** (cabecera, dos prefijos de error, las líneas de uso de la sonda
y la etiqueta `runner` del recibo de la tanda): cambiadas, y NADA más de su contenido; el diff de los
dos ficheros son 9 líneas y todas son su propio nombre. Medido antes: ningún código valida la etiqueta
`runner` (sólo la escribe el runner y la copian dos fixtures de test).

**NO cambiado, a propósito — la HISTORIA:** los registros de `docs/master/` (15 y una evidencia de
SCRUM-863), las nueve líneas de `docs/YAQU_MASTER.md` (entradas ✅ DONE de SCRUM-180, 175, 182, 188, 239,
161, 265 y el bloque de SCRUM-249), `docs/BUGS.md`, `docs/historico/` y `docs/equipo/cicatrices/J2.md`.
Describen lo que existía entonces: reescribirlos haría que un registro de julio citara un fichero que
en julio no existía. Esta tabla (§2) es la correspondencia para quien los lea. Criterio aceptado por el
orquestador, que además corrigió ante Javier el alcance de «una línea» del máster (eran nueve, y
ninguna es una instrucción viva).

**Tampoco:** `wa-test-secret` en tres tests es una clave de prueba, no la ruta; no se toca.

## 4 · El guard

`tests/scrum1308-scripts-sin-nombre-de-test.test.mjs`:

- pregunta a `node` su patrón y compara con `path.matchesGlob`, el comparador de `node`;
- **contraste con el runner de verdad**: fabrica once ficheros de juguete en un temporal, lanza
  `node --test` sin argumentos y exige que lo que se EJECUTA sea exactamente lo que el comparador dice
  que casa (si el patrón se estrechara, este caso caería);
- **control positivo**: el detector ve un nombre que casa y nombra los dos viejos;
- recorre el árbol entero y exige **cero** fuera de `tests/`.

**Rojo visto:** con un fichero vacío con cada nombre viejo puesto en `scripts/` (vacío: no se ejecutó
nada real), el guard cae y lo nombra; borrado, vuelve a verde. Los dos scripts NO se ejecutaron en
ningún momento de este trabajo.

**Rojo del CI en la primera vuelta (#2026, mío).** En local el contraste pasaba; en CI salió CIEGO («no
ejecutó los juguetes», status 1). Causa medida: el CI pone en `NODE_OPTIONS` los reporters con destino
al TAP de la tanda, y el `node --test` hijo los heredaba: salía 1 sin ejecutar nada y, además, habría
escrito encima de ese TAP. Arreglo con el patrón de la casa (SCRUM-813/938/1153): el entorno del hijo
se construye a mano sin `NODE_TEST_CONTEXT`, `NODE_OPTIONS` ni `FORCE_COLOR`. Reproducido en local
con el mismo `NODE_OPTIONS` del CI: la versión empujada cae igual que en CI; la arreglada pasa y el TAP
de fuera sólo contiene los tres tests del runner de fuera. Salió CIEGO y no verde: el suelo del caso
hizo su trabajo.
