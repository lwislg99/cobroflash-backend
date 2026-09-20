# SCRUM-952 · La IA de presupuestos sin respaldo: PASO 0 y plan

**Fecha:** 18-sep-2026 · **Carril:** S1 (servidor de producto: IA) · **Estado:** PASO 0 hecho, plan SIN aprobar. **No se ha cambiado nada del producto.**
**Medido contra:** `origin/main` = `bfa8859a04bee7182d0c5526c59582412ab056cd` · 2026-09-18T12:40:08Z (hora de GitHub)
**Condición del fundador que no se negocia:** gratis, sin coste nuevo y **sin respaldo con Claude** (SCRUM-934).

---

## PASO 0 · ¿el defecto existe hoy?

**Respuesta: a medias. El 2.º eslabón está muerto seguro; que la cadena entera no tenga respaldo NO está demostrado.**

1. **La cadena de hoy** (`src/integrations/gemini.ts:142` y `src/core/config/env.ts:81`, el mismo texto en dos sitios):
   `gemini-2.5-flash → gemini-2.0-flash → gemini-flash-latest`, salvo que `GEMINI_MODEL` esté puesta en Railway (**no lo sé**: lo puede mirar el fundador; el nombre del modelo no es un secreto). Se salta al siguiente con 429, 404 o respuesta vacía; con cualquier otro error, se para.
2. **`gemini-2.0-flash` está muerto por dos lados:** cupo 0 en la tabla de AI Studio del fundador (18-sep) y **«Shut down»** en la página de modelos de Google (leída hoy, `ai.google.dev/gemini-api/docs/models`). Solo gasta una ida y vuelta.
3. **`gemini-flash-latest` es un ALIAS, y no sé a qué apunta.** Google: «apunta a la última versión de una variante; puede ser estable, preview o experimental» y «se cambia en caliente con cada versión» (aviso de 2 semanas para cambios que rompen). La página no dice a cuál apunta hoy. Si apunta a `gemini-3.8-flash`, **hay respaldo** (otras 20 al día, con su propio cupo); si apunta a un preview sin cupo, no.
   → **Por eso el enunciado «sin respaldo que funcione» no está medido**: el tercer eslabón puede estar funcionando. Se resuelve con UNA petición real: la respuesta de Google trae `modelVersion`. Y aunque funcione, un alias no es «cupo medido»: puede cambiar de modelo sin que nadie de aquí se entere, y con él la calidad de los presupuestos.
4. **Las 20 diarias de `gemini-2.5-flash` no son solo de los presupuestos.** `aiComplete` (`src/modules/ai/domain/ai.service.ts`) la usan CUATRO funciones con la misma lista: líneas del presupuesto (l. 139), líneas del albarán por voz (l. 368), el mensaje de WhatsApp del presupuesto (l. 397) y el dictado del parte (l. 415). El techo de 20 es para las cuatro juntas.
5. **Con clave de Gemini puesta, `aiComplete` no cae a Claude**: el error de Gemini sube tal cual. SCRUM-934 se cumple hoy.
6. **Staging no tiene `GEMINI_API_KEY`** (medido en SCRUM-912b: 503 `ai_not_configured`). En staging la IA de presupuestos no funciona, así que tampoco se puede medir allí.
7. Uso real: según el traspaso de la sesión anterior, el máximo han sido 2 al día en 28 días. **No lo he medido yo.**

### Hallazgo, sin ticket (tope de 3 y sin víctima clara hoy)
`ai.routes.ts` contesta a CUALQUIER 429 de Google «La IA gratuita alcanzó su límite diario», también cuando el corte es por minuto (5 por minuto en 2.5 Flash). 912 ya distingue los dos cortes (`cuotasDelError`). Es un texto que ve el usuario: no lo toco (regla 30).

---

## Cómo se puede medir sin tocar `src/` (probado, sin red)

`docs/master/evidencias/SCRUM-952/sonda-viabilidad.mjs` corre el `suggestQuoteLines` **REAL** de `dist/` (mismo prompt, mismo esquema JSON, mismo `mapearLineasSugeridas`) con dos costuras que YA existen:
- **catálogo:** `dist/core/db/prisma.js` usa `global.prisma` si existe → un doble con `findMany`, sin base;
- **modelo:** `config.GEMINI_MODEL` se lee de `process.env` al cargar → **un proceso por candidato**, con UNA sola entrada en la lista: mide ese modelo y no su respaldo.

Verde: 1 petición, al modelo pedido, con el catálogo doble en el prompt y el esquema. **Rojo inyectado** (quitando `GEMINI_MODEL` en una copia): la app pide `gemini-2.5-flash` y la sonda sale 1. No se exporta nada ni se cambia una firma.

---

## PLAN (necesita aprobación; no se ha hecho nada de esto)

### Paso 1 · El banco de calidad (instrumento; no toca el producto)
`docs/master/evidencias/SCRUM-952/banco.mjs`, sobre la sonda. Por cada candidato, un proceso; por cada caso, una petición real a Google. Guarda por petición: líneas devueltas, `modelVersion`, tokens (`usageMetadata`), ms y error. Aborta si una petición no llegó a un modelo (A21) y declara la población («N casos × M modelos, K contestadas»).

**Catálogo del banco** (fontanería, EUR): Mano de obra fontanería (hora) 40 · Cisterna completa 95 · Grifo monomando 65 · Termo eléctrico 80 L 320 · Desatasco 90 · Desplazamiento 25.

**Los 5 casos** (dictados; cada uno con su verdad, comprobada por el banco, no a ojo):

| # | dictado | debe salir | no debe salir |
|---|---|---|---|
| 1 | «eh mira ponme cambiar la cisterna del váter y dos horas de mano de obra» | Cisterna completa ×1 a 95 · Mano de obra ×2 a 40 (UNA línea) | desplazamiento, «eh», «mira» |
| 2 | «cambiar el calentador por uno de ochenta litros, la instalación son unos doscientos euros» | Termo eléctrico 80 L a 320 · instalación a 200 | desatasco |
| 3 | «dos grifos monomando uno en la cocina y otro en el baño» | Grifo monomando ×2 a 65 (UNA línea) | termo, cisterna |
| 4 | «desagüe embozado en el fregadero y apúntame el desplazamiento» | Desatasco a 90 · Desplazamiento a 25 | cisterna, grifo |
| 5 | «pintar un salón de veinte metros cuadrados con la pintura incluida» | 2-8 líneas, ninguna del catálogo, total entre 150 y 900 € | cualquier línea del catálogo |

Y en los cinco: JSON válido, `tax` 0,21 en todas las líneas, entre 2 y 8 líneas (el 3 puede dar 1 y no se penaliza), cero `descartadas`.
**Nota** = comprobaciones cumplidas / comprobaciones. Lo que NO mide, declarado: dictados reales con ruido, otros oficios, otros países, y la varianza si solo hay una pasada.

**Candidatos** (solo cupo medido distinto de 0, tabla del fundador del 18-sep): `gemini-2.5-flash` (el de hoy, la referencia) · `gemini-3.8-flash` · `3.7-flash` · `3.6-flash` · `3.5-flash` · el «3 Flash» de la tabla (20/día cada uno; los ids de API de los 3.x **no los he comprobado**: el banco aborta si uno da 404) · `gemini-3.5-flash-lite` · `3.1-flash-lite` (500) · `gemini-2.5-flash-lite` (20) · Gemma 4 (14,4K/día; su id de API **no está comprobado**, y con 16K tokens/min hay que medir que el prompt quepa) · y **una** petición a `gemini-flash-latest` solo para leer su `modelVersion`.
**Fuera:** `gemini-2.0-flash`, `2.0-flash-lite`, `2.5-pro`, `3.1-pro` (cupo 0).

**Coste: 0 €, pero gasta cupo.** 5 peticiones por candidato (≈ 51 en total), cada una del cupo de SU modelo. La única que toca el cupo de producción de hoy es la referencia (`gemini-2.5-flash`: 5 de las 20 diarias).

### Paso 2 · La lista (un cambio de una línea, con su test)
Entran **solo** modelos con cupo medido distinto de 0 **y** una nota en el banco al menos igual a la de `gemini-2.5-flash`, sin ningún JSON inválido. Orden: calidad y luego cupo. Forma probable, **a confirmar con los números**: `gemini-2.5-flash` → los 3.x Flash que empaten → como último recurso un modelo de cupo grande.
- `gemini-flash-latest` **sale** de la lista: un alias no tiene cupo medido.
- Los Flash-Lite 3.x ya los usa la lectura de tickets (SCRUM-912, `MODELOS_LECTURA`). Si entran aquí, **comparten** sus 500 diarias con la lectura, y eso tiene que decidirse, no pasar sin que nadie lo vea.
- **Línea única:** hoy la lista por defecto está escrita dos veces (`env.ts:81` y `gemini.ts:142`); quedará en un solo sitio, con un test que falle si aparece un modelo sin cupo medido.
- 🔴 **Si `GEMINI_MODEL` está puesta en Railway, manda sobre el código** y el cambio no haría nada en producción: una operación que no se ejecuta y se lee como hecha. Antes de desplegar, el fundador mira la variable.

### Paso 3 · Comprobación en producción
Después del despliegue, UNA sugerencia real con el merchant demo o de prueba, con permiso, mirando qué modelo contestó en el log.

---

---

## Plan APROBADO (orquestador, 18-sep 12:55Z) · el banco, construido y probado SIN red

`docs/master/evidencias/SCRUM-952/banco.mjs` (Paso 1 del plan). **No ha hecho ni una petición real**: espera la clave.
- Un proceso hijo por modelo (`GEMINI_MODEL=<ese>`), los 5 casos en serie con 13 s entre peticiones (5 por minuto en los Flash). El hijo deja un testigo en stdout; sin testigo, el padre sale 1 (A21).
- Por petición guarda las líneas, `modelVersion`, `usageMetadata`, ms y el código de error. La clave se lee de un fichero, se pasa al hijo por entorno y se tapa en cualquier texto que salga.
- El juez (`juzgar`) es puro: 34 comprobaciones sobre los 5 casos.
- **Autoprueba `--simulado`**: `sim-perfecto` saca **34/34**; `sim-malo` (un error por caso) suspende los 5 casos, **26/34**. Sale 1 si el perfecto no llega al 100 % o si el malo aprueba un caso entero.
- **Rojo inyectado** en el juez (todas las comprobaciones de caso a `true`): el control negativo salta y sale 1.
- **Camino de error, contra Google real y con una clave FALSA** (gratis): 5 × `gemini_bad_key`, «ninguna petición llegó a un modelo», sale 1, y la clave no aparece ni en la salida ni en el JSON. Con la clave mala se para en el primer modelo.

Lo que NO prueba la autoprueba: que Google conteste en el formato que espera el banco con un modelo 3.x (el `modelVersion` y `usageMetadata` son del formato documentado), ni la varianza (una pasada por caso).

## Lo que necesito para seguir (y quién lo decide)

1. **Aprobación del plan** (orquestador / fundador).
2. **Una clave de Gemini para el banco, sin pasar por el chat** (regla 9). Dos opciones, decide el fundador:
   - **(a, recomendada)** una clave de un **proyecto NUEVO** de AI Studio, en el nivel gratis y sin facturación. Tiene sus propios cupos: el banco **no toca** las 20 diarias de producción. La deja en un fichero FUERA del repo, y el banco lo lee al arrancar sin imprimirlo.
   - **(b)** la clave de producción, igual por fichero. Gasta 5 de las 20 diarias de producción (la referencia) y del cupo de cada candidato del mismo proyecto.
3. **Que el fundador mire en Railway (producción) si existe `GEMINI_MODEL`** y qué lista tiene.

---

## SCRUM-952b · La entrada sale de la máquina dos días tarde (20-sep-2026)

**Medido contra:** `origin/main` = `f2fa091bfeb8c754ab0dcba5ddb95d0ed3d987d4` · 2026-09-20T13:05:24Z (hora de GitHub)
**Carril:** S1 · **No se ha tocado `src/`, `public/` ni `prisma/`.** Esta entrada es SOLO documentos.

**Por qué existe esta sección.** Los cuatro commits de arriba se quedaron **en local desde el 18-sep**:
la sesión anterior los dejó sin empujar a propósito (no había turno de suite) y cerró por fin de uso
esa misma tarde. El censo de huérfanos del 20-sep los encontró en el worktree
`.claude/worktrees/scrum-912-leer-ticket-gasto`, rama `scrum-952-paso0-plan`, head `020b0020`, **fuera
de todo remoto**. Un trabajo que solo existe en un disco no existe (A8).

    🔒 Una rama sin empujar no está «a medias»: está a una máquina de distancia de no existir.

**Lo hecho hoy, y nada más:**
1. `git merge origin/main` dentro de la rama (**nunca rebase**, A4): 65 commits por detrás, **57 ficheros,
   sin conflictos**. Comprobado que el merge no se come a nadie en silencio: `origin/main` es ancestro de
   `HEAD` (`merge-base --is-ancestor`, exit 0) y el delta `origin/main...HEAD` son **exactamente los 4
   ficheros de 952** y ninguno más.
2. A1 tras el merge: `prisma generate` exit 0 y `git rev-list --count HEAD..origin/main` = **0**.
3. `npm run guards:entrada`: **4 guards, 26 tests, 0 fail** (población declarada por el propio comando).
4. `.claude/settings.local.json` aparece modificado en el árbol y **NO es de este trabajo**: no se comitea.
   Queda tal cual, como lo dejó la sesión anterior.

**Lo que sigue BLOQUEADO, medido hoy y no heredado:**
- **El Paso 1 del plan no se puede correr.** `Test-Path C:\Users\Admin\Documents\yaqu-gemini-pruebas.txt`
  = **False** a las 13:05Z: la clave del punto 2 de «Lo que necesito para seguir» **no está en la máquina**.
  El banco **no ha hecho ni una sola petición real**, y nada de lo que dice arriba sobre los modelos
  candidatos se ha medido contra Google todavía. Sigue siendo un plan.
- El punto 3 (`GEMINI_MODEL` en Railway de producción) **sigue sin respuesta del fundador**.

**Lo que esta entrada NO afirma:** que la lista de modelos del plan sea la buena, que `gemini-flash-latest`
tenga o no respaldo, y que los ids de API de los 3.x existan. Las tres cosas esperan a la clave.

---

### Error propio de esta entrada, y lo que destapó: **el recuento de A22 NO ve el BOM**

Es la misma familia que el escape de color que estuvo 16 merges en la línea principal de `main`
(A22), así que va escrito con lo que hace falta para cazarlo: qué lo mete, cómo se ve y cómo se cuenta.

**Qué lo mete.** El mensaje de commit se escribió a fichero con `Out-File -Encoding utf8`. En
**PowerShell 5.1** ese `utf8` es UTF-8 **CON BOM**: antepone los bytes `239,187,191` (U+FEFF). `git
commit -F` se los traga como parte del asunto, así que el commit `dcc1089a` nació con un carácter
invisible pegado delante de `SCRUM-952b:`.

**Cómo se ve.** No se ve. No sale en el diff, ni en el visor, ni en una revisión a ojo. Lo delató que
el propio `git commit` devolvió el asunto por pantalla y ahí el carácter sí se dibujó. Se arregló con
`[IO.File]::WriteAllText($f, $msg, (New-Object Text.UTF8Encoding $false))` y un `--amend`
**antes de cualquier push**: no se reescribe historia publicada (A4).

**Cómo se cuenta — y aquí está el hallazgo.** El recuento que A22 manda usar es

    ([IO.File]::ReadAllBytes($f) | Where-Object { ($_ -lt 32 -and $_ -notin 9,10,13) -or $_ -eq 127 }).Count

y **un BOM le da 0**, porque sus tres bytes (`239,187,191`) están todos por encima de 32. Medido hoy,
con el control positivo disparando primero para que el 0 signifique algo:

| fichero | bytes | recuento A22 |
|---|---|---|
| ESC real (`[char]27`) | `72,111,108,97,` **`27`** `,91,51,49,109` | **1** ✅ el contador SÍ funciona |
| NUL real (`[char]0`) | `72,111,108,97,` **`0`** | **1** ✅ |
| BOM (`Out-File -Encoding utf8`) | **`239,187,191`** `,72,111,108,97,13,10` | **0** ❌ **ciego** |

⚠️ **El primer intento de este control salió VACÍO y casi me lo creo.** Escribí el ESC como
`` `e[31m ``, que es sintaxis de **PowerShell 6+**: en la 5.1 no existe y aterrizó una `e` normal. El
contador dio 0 sobre un fichero *sin* ESC, y ese 0 se lee exactamente igual que «el contador no ve el
ESC». Sin repetirlo con `[char]27`, la conclusión de esta tabla habría sido la contraria y falsa.

    🔒 Un contador que no has visto disparar no da ceros: da silencio.

**Lo que esto NO dice:** que haya BOMs en el árbol. No lo he barrido — sería otro ticket, y el tope de
hallazgos por tanda es 3. Lo que dice es que **el recuento de A22, tal y como está escrito, no puede
encontrarlos**, y que un carácter invisible que la propia norma no cuenta es justo el que sobrevive.
La norma A22 es de `00-normas-comunes.md`, cuya dueña es la **Sesión 0**: esto se le reporta, no se
edita desde aquí.
