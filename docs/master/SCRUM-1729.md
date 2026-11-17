# SCRUM-1729 — `causa` y las bocas de emisión transparentes: guard de solo lectura

17-nov-2026 07:48Z (hora de GitHub) · medido sobre `origin/main` a3510f52b208b060e755c81e0c8cc1accc299672 · S1 · rama `scrum-1729-guard-causa-en-las-bocas`

## De dónde sale

El **parte de SCRUM-1729 (comentario c.21959)**, entregado por la S1 anterior y pegado en el
ticket por el orquestador: de las 7 bocas que acaban en `crearFacturaEmitida`, las de albaranes ×2
y la recapitulativa rehacen la línea campo a campo (no les llega `causa`), y **cuatro son
TRANSPARENTES**: copian la línea del presupuesto con un spread (`lineasParaFacturar` /
`stageLinesReconciled`) y **no llaman a `exigirDestinatarioParaIsp`**.

| boca transparente | dónde |
|---|---|
| facturar el trabajo | `src/modules/jobs/app/routes/jobs.routes.ts:1611` |
| cobro del presupuesto | `src/modules/quotes/app/routes/quotes.routes.ts:658` |
| tramo | `src/modules/system/app/routes/quotesAdmin.routes.ts:363` |
| factura entera | `src/modules/system/app/routes/quotesAdmin.routes.ts:656` |

Hoy las protegen dos puertas que tiran `causa`: ① zod (`QuoteLineSchema` no la declara y
`z.object` la borra) y ② `validarLineas` (rehace la línea). El GO del orquestador (17-nov) fue a un
**test que SOLO LEE** (regla 38) que fije las dos puertas y un trinquete: si `causa` entra en
`QuoteLineSchema`, las 4 bocas deben llamar a `exigirDestinatarioParaIsp` → si no, rojo.

## Lo que se ha hecho

`tests/scrum1729-causa-no-entra-por-las-bocas.test.mjs`. **No toca `src/`**: ni un export nuevo,
ni un helper extraído, ni una firma. La puerta ① se alcanza por lo que ya se exporta
(`CreateQuoteSchema.shape.lines.unwrap().element`), la ② por `validarLineas` (ya `export`), y las
bocas se miran por AST de TypeScript, sin ejecutar nada del camino de emisión.

| test | qué fija | control positivo |
|---|---|---|
| puerta ① | zod tira `causa` | `description` (declarada, opcional) sobrevive |
| puerta ② | `validarLineas` no copia `causa`, VALORADO y SIN_VALORAR | `concepto` y `cantidad` sobreviven |
| trinquete | si `causa` entra (por zod en runtime **o** por clave en el AST), las 4 bocas exigen destinatario | el AST ve `exigirDestinatarioParaIsp` en `src/lib/invoicing.ts`, donde está |
| censo | el conjunto de ficheros que importan/llaman a `crearFacturaEmitida` es el clasificado (4 transparentes + 4 con motivo) | suelo: >100 ficheros `.ts` vistos |

Población declarada en la salida: `4 bocas · causa por zod=false · por clave=false · sin exigir=4`
y `358 ficheros .ts · llaman a crearFacturaEmitida: 7` (+ la definición).

## Rojo primero (A23 #8-#11)

Commit de todo el árbol antes de cada inyección; `npm run build` entre una y otra; deshecha cada
una a mano y comprobada con `git status --porcelain`; base verde al final (4/4).

| # | inyección (local, no comiteada) | numstat | resultado |
|---|---|---|---|
| R1 | `causa: z.string().optional()` en `QuoteLineSchema` | `1 0 schemas.ts` | ✖ puerta ① · ✖ trinquete (las 4 bocas nombradas) · `por zod=true · por clave=true` |
| R1b | `z.object` → `z.looseObject` (causa entra SIN declararla) | `1 1 schemas.ts` | ✖ puerta ① · ✖ trinquete · `por zod=true · por clave=false` |
| R2 | `validarLineas` copia `l.causa` | `1 0 albaran.service.ts` | ✖ puerta ② (VALORADO) |
| R3 | fichero nuevo con `(crearFacturaEmitida as any)(…)` | fichero nuevo | ✖ censo, con la boca nombrada |
| R1 otra vez | la misma de R1, con el instrumento ya definitivo | `1 0 schemas.ts` | ✖ puerta ① · ✖ trinquete |

**Dos agujeros del instrumento que cazaron las propias inyecciones**, arreglados antes de entregar:
- R1b: la mitad AST solo buscaba `z.object`; con `looseObject` se declaraba CIEGA. Fallaba hacia
  cerrado, pero con el motivo equivocado. Ahora reconoce `object`/`looseObject`/`strictObject`, y la
  entrada por `looseObject` la caza la mitad runtime (por eso hay dos).
- R3: el censo contaba la llamada por `Identifier`; `(crearFacturaEmitida as any)(…)` **salía VERDE**.
  Ahora el censo cuenta por IMPORT (un alias no lo esquiva) y la llamada desenvuelve paréntesis, `as` y `!`.

## Límite que queda dicho

El trinquete mira la **sentencia de nivel de fichero** que contiene la boca (el `router.post(...)`
o la función): si un día la comprobación se hace en un helper fuera de ella, el trinquete no la ve
y sale rojo. Falla hacia cerrado; se arregla llamando a `exigirDestinatarioParaIsp` en la boca.

| aceptación (GO del orquestador) | dónde se ve |
|---|---|
| test que solo lee | `tests/scrum1729-causa-no-entra-por-las-bocas.test.mjs` · el diff de la rama no toca `src/` |
| fija las dos puertas (zod tira causa; validarLineas también) | mismo test, casos «puerta ①» y «puerta ②» |
| trinquete: `causa` en QuoteLineSchema sin `exigirDestinatarioParaIsp` en las 4 bocas → rojo | mismo test, caso «trinquete» · rojos R1/R1b arriba |
| rojo primero | tabla de inyecciones de arriba |
