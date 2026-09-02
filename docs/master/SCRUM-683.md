# SCRUM-683 · el parte dictado — dos listas, y ni una cantidad inventada

**Medido contra:** `origin/main` = `feaaa9b929a4d764dfaff182b520ce59db5fbb77` · 2026-09-02T18:16:04+02:00

**No es la séptima vez.** El motor de dictado existe y está muy cerca, pero su decisión central es
**la contraria** a la que necesita el parte. Este ticket le da al parte su superficie **invirtiendo
una decisión**, no reescribiendo el motor.

---

## 0 · PASO 0

```
git ls-tree -r --name-only origin/main | grep -iE 'scrum-?683|lineasSugeridas'
  → src/modules/ai/domain/lineasSugeridas.ts                          [exit 0]
git ls-remote --heads origin | grep -iE 'scrum-?683'                  → vacío [exit 1]

CONTROL POSITIVO (682, mergeado hace un rato): docs/master/SCRUM-682.md  [exit 0]
  sobre 1.988 ficheros y 394 ramas
```

---

## 1 · Qué existe ya, y por qué no basta

| pieza | dónde | ¿sirve al parte? |
|---|---|---|
| dictado → líneas, con muletillas y sinónimos de obra | `ai.service.ts:271` `suggestAlbaranLines` | **sí**, y no se reescribe |
| «no copies precios», como MECANISMO y no como prompt | `ai.service.ts:208` `sanearLineasAlbaran`, modo `SIN_VALORAR` | **sí** — es el mismo requisito que ⛔ la voz nunca dicta importes |
| cantidad ausente → **1** | `lineasSugeridas.ts:42` `cantidadUtilizable` | 🔴 **NO. Es la decisión que hay que invertir** |
| el mismo 1, pedido al modelo | `ai.service.ts:244` «cantidad: la que se diga… Si no se dice, 1» | 🔴 **NO** |
| **dos bloques** mano de obra ‖ materiales | — | **no existe**: la salida de hoy es UNA lista plana |
| marcar lo supuesto | `LineaSugerida.supuestos` (presupuestos) | existe ahí; `LineaAlbaranSugerida` **no lo tiene** |

> **La coordenada del encargo era correcta hoy**, por una vez: el `1` inventado está en
> `lineasSugeridas.ts:42`, tal cual. Verificado leyendo el fichero, no el informe.

**Por qué para un presupuesto está bien y aquí no.** El fundador lo decidió el 2-ago-2026: en un
presupuesto, un número raro **se ve**, el profesional lo corrige y sigue. El parte se firma en obra
y **la oficina lo factura después**: la cantidad inventada no la mira nadie más, y acaba en una
factura a un instituto público.

---

## 2 · 🔴 Es un MECANISMO, no una petición al modelo

Se le puede pedir al modelo que no invente. Un prompt es una **petición**: si el modelo se despista,
cambia de versión o alguien edita el texto, deja de cumplirse **en silencio**. La lección ya estaba
escrita en `sanearLineasAlbaran`: *«ES EL MECANISMO, NO EL PROMPT»*.

El mecanismo de este fichero es comprobable sin red y sin modelo:

> **La cantidad propuesta tiene que APARECER EN EL TEXTO DICTADO**, en cifra o en palabra.
> Si el técnico no dijo un número, no hay número que encontrar, y da igual lo que devuelva el modelo.

* `uno`/`una` **no** cuentan como cantidad en palabra: son las palabras más frecuentes del
  castellano hablado («una cámara», pero también «una vez»). Aceptarlas reintroduciría el 1 por la
  puerta de atrás. Un `1` **en cifra** sí se acepta: nadie lo dicta por casualidad.
* Un número pegado a otro no cede una cantidad: de `2026` no sale un `2`. De `cat 6` sí sale el 6 —
  y no pasa nada, **porque el técnico confirma**.
* Lo retirado **se enseña** (`cantidadesRetiradas`), con lo que el modelo había propuesto. Quitarlo
  en silencio sería cambiar un fallo mudo por otro.

⚠️ Esto **no** garantiza que el número sea el correcto, y no lo pretende: garantiza que **no salga
de la nada**, que es donde nacen las facturas mal puestas.

---

## 3 · 🔴 `gemini.ts` es SOLO TEXTO — verificado HOY y por EJECUCIÓN

Es la afirmación en la que se apoya el argumento de RGPD, así que no se leyó: se ejecutó con un
`fetch` instrumentado y una entrada **hostil** (`inlineData`, `fileData`, `mimeType`, `parts` con
audio y un WAV en base64, todos pasados a `geminiComplete`).

**El cuerpo real que sale del proceso:**

```json
{ "systemInstruction": { "parts": [ { "text": "sistema" } ] },
  "contents": [ { "role": "user", "parts": [ { "text": "texto del tecnico" } ] } ],
  "generationConfig": { "maxOutputTokens": 1024, "temperature": 0.4 } }
```

| se buscó en el cuerpo | ¿viaja? |
|---|---|
| `inlineData` · `inline_data` · `fileData` · `file_data` | no |
| `mimeType` · `mime_type` · `audio` | no |
| el WAV en base64 inyectado | no |
| las 2 `parts`, cada una con exactamente `{text: string}` | **sí** |

✅ **El binario inyectado NO sale del proceso.** El cuerpo se construye literalmente desde
`params.system` y `params.user`, que son `string` en el tipo (`gemini.ts:21-26`, cuerpo en `:46-50`).

---

## 4 · Lo entregado — `src/modules/jobs/domain/parteDictado.ts`

Puro: sin BD, sin red, sin Express. Sin pantalla, como pedía el encargo.

* `cantidadRespaldadaPorElTexto(bruto, dictado)` → el número, o **`undefined`**. Nunca 0, nunca 1.
* `sanearDictadoDelParte(crudo, dictado)` → `{ mano_obra, materiales, sinBloque, cantidadesRetiradas, vacia, motivo }`.
  La línea **no lleva su bloque: el bloque es la lista en la que está** — la misma decisión que
  `parteTrabajo.ts` ya tomó («no son una etiqueta de la línea: son su sitio»).
* `aLineaDelParte(bloque, propuesta, undsConfirmadas)` → **la puerta**. Lanza nombrando la línea si
  nadie confirmó la cantidad. Una propuesta no es una línea del parte.
* `PROMPT_PARTE_PROPUESTO` — **texto propuesto, NO aprobado** (regla 30).

**Un bloque ilegible no se adivina y la línea no se tira:** va a `sinBloque` para que el técnico la
coloque. `BLOQUES_PARTE` es cerrado (regla 27) y de aquí no sale un tercero.

---

## 5 · Verificación — los dos rojos, con su SHA

**Commit de todo ANTES de inyectar: `f74a3772c1ecf3918789db499956cd175aca2aa3`** (verde, 13/13).

| rojo inyectado | resultado |
|---|---|
| **1 · el 1 inventado vuelve** (`cantidadRespaldadaPorElTexto` se comporta como `cantidadUtilizable`) | 🔴 **6 caen, exit 1** — «🔴 «Videograbador» ha salido con cantidad 1 y el dictado no la dice» |
| **2 · la puerta deja de exigir confirmación** | 🔴 **2 caen, exit 1** — y **solo** esas dos: el rojo es del mecanismo, no una avería general |

**Y cae con el mecanismo viejo**, que es lo que prueba que hacía falta. Sobre el mismo dictado
(*«Sustituir el videograbador y el disco duro»*):

```
cantidadUtilizable(undefined) = 1      cantidadRespaldadaPorElTexto(undefined, dictado) = undefined
cantidadUtilizable(1)         = 1      cantidadRespaldadaPorElTexto(1, dictado)         = undefined
cantidadUtilizable(4)         = 4      cantidadRespaldadaPorElTexto(4, dictado)         = undefined
```

Está escrito **como aserto** en el test: si algún día los dos coincidieran, ese test avisa de que el
mecanismo nuevo dejó de aportar y alguien está protegido por una ilusión.

**Control positivo con las cuatro líneas reales** (con «acerofles», sin puntuación fina y con un
`cat 6` que lleva un número que no es cantidad): 2 líneas a mano de obra, 2 a materiales, los dos
`2` dictados sobreviven, la canalización y el videograbador siguen **sin** cantidad, y
`cantidadesRetiradas` está vacío porque el modelo no inventó nada.

**Suelo:** sin líneas → `vacia: true`, `motivo: 'sin_lineas_reconocidas'`, y **nada relleno**.
**Sin red:** `null`, `undefined`, `'gemini_unreachable'`, `{}`, `0`, `false` → propuesta vacía, sin
lanzar. El dictado del teclado funciona sin nosotros; la ordenación es un extra que puede faltar.

---

## 6 · Declaraciones que este módulo movió

**SCRUM-411: 9 → 10**, declarado en el sitio con su motivo. Entra `parteDictado.ts` **sin llamador**:
su consumidor es la pantalla del parte (SCRUM-652 fase C), que hace **otra sesión ahora mismo**, y
el encargo dice «solo el DOMINIO, sin pantalla». Cablearlo desde aquí sería editar sus ficheros
mientras ella los edita. **Baja a 9 el commit que le ponga consumidor.**

## 7 · Microcopy propuesta, PENDIENTE de aprobación (regla 30)

El dominio devuelve **códigos**, no texto de pantalla. Las frases visibles las decide el fundador:

| código | frase propuesta |
|---|---|
| `dictado_vacio` | «No hemos entendido nada del dictado. Escribe las líneas a mano.» |
| `sin_lineas_reconocidas` | «No hemos podido proponer ninguna línea. El parte se queda en blanco.» |
| `cantidadesRetiradas` | «No dijiste cuántas. Pon tú la cantidad.» |

Y `PROMPT_PARTE_PROPUESTO` entero, que es la instrucción al modelo. **Nada del mecanismo depende de
esas palabras**: hay un test que lo prueba pasando una respuesta que ignora el prompt por completo.

## 8 · Lo que NO se tocó

`prisma/schema.prisma` · la pantalla del parte y los ficheros de SCRUM-652 fase C · el camino de
emisión · `ai.service.ts` y `lineasSugeridas.ts` (**el motor de presupuestos se queda como está: su
decisión es correcta para su documento**) · ningún importe, en ninguna dirección.
