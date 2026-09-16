# SCRUM-509 · Dos guards dejan de cobrar peaje sobre código correcto, sin dejar de cazar lo que cazan

**Medido contra:** `origin/main` = `1237240417ffa623c0def283d8c4603db4b02e96` · 2026-08-13T11:49:59+01:00

**13-ago-2026** · **Carril:** guards · **Gate:** sin gate, corren en `npm test`

**LA VÍCTIMA:** dos guards se ponen rojos sobre código que está bien, dos días seguidos. Y uno de
ellos tenía la tanda de `main` **en rojo al empezar este ticket**.

> 🔴 Un guard que cobra peaje por código correcto acaba apagado. No de golpe: alguien lo relaja
> «solo esta vez», y ese día deja de proteger lo que protegía. Es nuestro propio canon aplicado a
> nosotros — *un detector atado a la FORMA y no al HECHO se pone rojo sobre código correcto*.

---

## ① EL PASO 0 · los falsos positivos, reproducidos ANTES de tocar nada

`main`: `81be7735` → `12372404`. `docs/master/SCRUM-509.md` no existía.

La afirmación del encargo venía de un informe ajeno, así que se comprobó con **el guard real**, no
razonándola. **Los dos reproducen**, y uno trajo un tercer caso que nadie había nombrado.

### CASO 1 · SCRUM-409 — tres saltos, no dos

Sonda: un fichero temporal en `tests/` con los dos casos, el guard corrido, y el fichero borrado.

| caso | qué pasó |
|---|---|
| `merchantId: 1.5` | **marcado como merchant demo**. El `\b` de `merchantId:\s*1\b` casa entre `1` y `.`: leía el PREFIJO, no el valor |
| `merchantId: 1` dentro de una **cadena** | **marcado**. Es la fuente sintética con la que otro guard se autoprueba: ahí no hay ningún merchant, hay un texto que habla de uno |
| 🔴 **un COMENTARIO** | **marcado, y con la tanda en rojo HOY** — ver abajo |

**El tercero no estaba en el encargo y es el que más importa.** El guard estaba **ROJO en `main`**
saltando sobre `scrum508-los-cinco-dejan-fila.test.mjs:76`, que es literalmente el comentario
*«7 y no 1: el guard de SCRUM-409 lee un `merchantId: 1` como el merchant DEMO y salta»* — o sea,
**el guard saltaba sobre la línea que documenta que salta**, escrita por la sesión anterior que ya
había tenido que rodearlo.

Causa medida con una sonda aislada (no deducida): el despojo `linea.replace(/\/\/.*$/, '')` **no
funciona con finales CRLF**. `$` sin flag `m` no casa antes de un `\r`, así que el comentario
entero se analizaba como código:

```
LINEA      : "  // ... lee un `merchantId: 1` como el merchant DEMO y salta.\r"
SIN COMENT : "  // ... lee un `merchantId: 1` como el merchant DEMO y salta.\r"   ← no despojó nada
CASA?      : true
sin \r     : "  "                                                                 ← con LF sí despoja
CASA?      : false
```

🔸 **Y una lección de método**: los dos primeros intentos de medir esto dieron resultados
contradictorios porque mis escapes de `bash` falseaban la regex. Se resolvió escribiendo la sonda a
fichero y ejecutándola sin intermediarios. Un instrumento con un escape mal puesto no mide el
defecto: mide el escape.

### CASO 2 · SCRUM-337 — la huella abarca más de lo que promete

Sonda: un cambio de **plomería puro** sobre `lifecycle.service.ts` —renombrar `r` a `resultado`—
sin tocar ni un asunto, ni un cuerpo, ni un botón, ni una condición. El diff entero fueron dos
líneas de la variable. Resultado:

```
✖ SCRUM-337 · si cambia lo que el correo DICE, hay que volver a mirar lo que el producto HACE
      day12 (línea 229): declarada 624cb7cc1a5b2de4, derivada 835002a29dea674e
```

Reproduce. La sonda se deshizo con `git stash` (nunca `git checkout --`), con post-condición: el
guard volvió a sus 9 tests en verde.

### ⚠️ Este guard es de los buenos, y por eso se estrecha en vez de tocarse

El 12-ago un refactor lo dejó ciego y **él lo cantó en rojo en vez de callarse**: eso es lo que
existe para hacer. El problema no es que exista, es que **la huella abarca más de lo que promete**.
Si dice que vigila lo que el correo PROMETE, tiene que moverse cuando cambia una promesa, no cuando
cambia una variable intermedia.

### (d) y (e) · nadie más los toca

Todos los commits sobre los dos guards y su derivador están en `main` (el más reciente, `17efe128`
de SCRUM-508, hoy 11:01). Ninguna rama remota pendiente. Control positivo del pickaxe: `git log
--all -S"MERCHANT DEMO A PROPOSITO"` devuelve los dos commits que lo introdujeron, así que sabe
encontrar cuando hay.

---

## ② QUÉ SE CONSTRUYE · el HECHO, no la forma

### CASO 1 — de una regex sobre texto a una propiedad del AST

El hecho es *«un fixture asigna el merchant demo»*: una **propiedad `merchantId` cuyo VALOR es 1,
en el código**. Con AST:

* un **comentario** no es una propiedad → cae el caso 3;
* una **cadena** tampoco → cae el caso 2;
* se compara `Number(literal) === 1` → `1.5` no vale 1 (cae el caso 1) y `1.0` **sí** salta, porque
  ése sí es el demo.

**Los tres desaparecen sin una sola excepción escrita a mano**, que es la diferencia entre estrechar
y aflojar.

### CASO 2 — de la huella del bloque entero a la huella de la promesa

| entra en la huella | queda fuera |
|---|---|
| **CUÁNDO** se manda (la condición del `if`) | cómo se captura el resultado del envío |
| **A QUIÉN** y con qué **ASUNTO** (los argumentos de `sendEmail` menos el cuerpo) | cómo se llama la variable |
| el **CUERPO** (1.er argumento de `wrap`) | el `continue` |
| el **BOTÓN** (2.º argumento de `wrap`) | |

**🔴 Lo que sale de la huella NO queda sin vigilar, y se midió ANTES de estrecharla:**
`tests/scrum475-ignoran-el-resultado.test.mjs:499` ya comprueba **sobre el fichero real**, con su
propio suelo (≥7 llamadas), que ningún `markSent` de `lifecycle.service.ts` se ejecuta sin mirar el
resultado del envío — y con más precisión que una huella que solo sabía decir «algo cambió». Dos
guards, cada uno en lo suyo, **ningún hueco**.

---

## ③ 🔴 EL TEST QUE DECIDE NO ES EL QUE COMPRUEBA QUE DEJÓ DE SALTAR

«Ya no da falsos positivos» y «ya no vigila» **son el mismo verde**. Cada guard estrena un control
positivo que **enumera lo que existe para cazar** y lo comprueba **uno a uno** con el criterio
nuevo puesto:

* **SCRUM-409** — ocho formas de escribir un fixture con el demo: objeto literal · clave
  entrecomillada · decimal exacto (`1.0`) · anidado · dentro de un array · en el argumento de una
  llamada · en una función de fábrica · en una respuesta simulada.
* **SCRUM-337** — las cinco promesas, cambiadas una a una: cuándo · a quién · asunto · cuerpo ·
  botón.

Los dos llevan **su propio suelo** (`>= 8` casos, `=== 5` promesas), porque vaciar la lista es la
forma barata de aflojar un guard sin que se note.

### ⚠️ Y ese control positivo cazó un fallo MÍO mientras lo escribía

Escribí el fixture del control positivo **a mano**, con la firma `sendEmail(destinatario, asunto,
html)`. Pero **SCRUM-508 ya le había metido el `merchantId` delante** esta misma mañana. Con índices
de argumento fijos, la huella se quedaba **SIN EL ASUNTO** —la promesa más visible— y el control
positivo **daba verde igual**, porque el fixture escrito a mano tenía la firma vieja.

Dos correcciones, y las dos son la misma lección:

1. La huella toma **todos los argumentos del envío MENOS el cuerpo** (identificado por el nombre de
   la variable que sale de `wrap`), en vez de posiciones fijas. Una firma nueva ya no puede dejar
   una promesa fuera en silencio.
2. **El fixture se DERIVA del fichero real** y se muta con post-condición: si el texto que muta ya
   no existe, el test cae diciendo *«el fixture ya no encaja con el código real: actualízalo contra
   el fichero, no inventes uno que sí encaje»*.

**Derivar el fixture, nunca la expectativa.** Un fixture desalineado del código no prueba nada, y
encima lo dice en verde.

---

## ④ SUELOS NUEVOS · un cero se declara ciego

* **SCRUM-409** — si un fichero de test no se puede analizar, el guard lo dice: *«no están limpios,
  están SIN MIRAR»*. Antes un fichero ilegible habría devuelto «cero usos», indistinguible de
  «limpio». Medido: **538 ficheros, 0 ilegibles**.
* **SCRUM-337** — si alguna de las piezas de la promesa no se puede extraer, **no se compone una
  huella a medias**: el aviso se queda sin huella y el suelo lo declara. Una huella incompleta daría
  verde sobre un aviso sin mirar.

## ⑤ 🔴 ROJO POR EL MECANISMO

Con la rama **ya en verde y commiteada** (`f7781f9c`), y con post-condición comprobada en las dos.

| mutación | qué cae |
|---|---|
| **A** · un fixture REAL con `merchantId: 1` en `tests/` | SCRUM-409, **nombrando fichero y línea** |
| **B** · cambiar una PROMESA de verdad: el botón del `day12` («Activar plan Pro» → «Activar plan Empresa») | SCRUM-337, **nombrando el aviso**: `day12 (línea 240): declarada c4b11c8cfefc3175, derivada f89d97c72cff5fa4` |

🔸 La mutación B tira **dos** tests, y el segundo es información: el control positivo también cae,
con su mensaje propio *«el fixture ya no encaja con el código real»*. Es lo correcto — el fixture
está atado al fichero y se entera cuando el fichero se mueve, que es justo lo que le faltaba.

## ⑥ Las cinco huellas, rehechas por TERCER día — pero por un motivo distinto

Las dos veces anteriores (SCRUM-475 el 12, SCRUM-508 el 13) se movieron porque **cambió el código**.
Esta vez **no cambia ni una línea de `lifecycle.service.ts`**: cambia el **CRITERIO** con el que se
calcula la huella. Los cinco valores son nuevos aunque los cinco correos digan exactamente lo mismo,
y queda escrito en el fichero.

**Es la última vez que se mueven sin que cambie una promesa**: el peaje que las movía ya no entra en
el cálculo.

## ⑦ Ficheros

* `tests/scrum409-fixtures-sin-merchant-demo.test.mjs` — detector por AST, suelo de legibilidad,
  autoprueba de los tres falsos positivos y control positivo de ocho formas. **4 → 6 tests.**
* `tests/_censo-aviso-vs-bloqueo.mjs` — `piezasDeLaPromesa`, y la huella compuesta de ellas.
* `tests/scrum337-aviso-atado-al-bloqueo.test.mjs` — control positivo de las cinco promesas con
  fixture derivado, suelo de piezas, y las cinco huellas al criterio nuevo. **9 → 10 tests.**

**Lo que NO se toca:** `prisma/schema.prisma` · los textos de ningún correo · el camino de emisión y
el sellado · `public/` · nada de `email_messages`.

## ⑧ Verificación de la tanda

Con `dist/` reconstruido y `npx prisma generate` corrido **en este worktree**, y la tanda lanzada
**después del último cambio y de la última edición de este documento**.

| | ficheros | tests | pass | **fail** | skipped |
|---|---|---|---|---|---|
| **línea base** (`main` puro, este árbol) | 469 | **3.606** | **3.528** | **1** 🔴 | **77** |
| **después** | 469 | **3.609** | **3.532** | **0** ✅ | **77** |
| diferencia | 0 | **+3** | **+4** | **−1** | **0** |

* 🔴 **La línea base NO era cero fallos**, y ése es el ticket: `main` estaba en rojo por el guard de
  SCRUM-409 saltando sobre un comentario. El absoluto de hoy (0 fallos) caduca en cuanto `main` se
  mueva; **el delta (−1 fallo, +3 tests, ningún salto nuevo) es lo que sobrevive**.
* `npm run guards:entrada` — **17 tests, 4 guards, 0 fallos**.
* Los `+4 pass` son los `+3` tests nuevos más el que estaba fallando y ahora pasa.
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.

## ⑨ Huecos DECLARADOS

* **La EXENCIÓN de SCRUM-409 sigue atada a la forma, y no se ha tocado.** Un fichero queda exento si
  su TEXTO contiene `isDemoMerchant` / `DEMO_MERCHANT_ID` / … aunque sea **en un comentario**. Medido
  hoy: **18 exentos por texto contra 2 por código** — o sea 16 ficheros exentos por mención. Es el
  mismo defecto en la otra dirección, pero **afloja en vez de cobrar peaje**, así que arreglarlo no
  es «dejar de cobrar peaje»: es endurecer el guard, con rojos nuevos en ficheros ajenos. Alcance
  distinto y no pedido → va como hallazgo (⑩), no como cambio de este carril.
* **El `1.0` salta y el `1` de una constante importada no.** `{ merchantId: DEMO_MERCHANT_ID }` no lo
  cazaba el detector viejo ni lo caza el nuevo: no es regresión, pero tampoco está cubierto.
* **No se ha medido cuántos falsos positivos costaron en tiempo real** más allá de los dos días que
  cita el encargo; lo que sí consta es el rastro en `scrum508:76`.

## ⑩ Fuera de carril (una línea cada uno)

* **La exención de SCRUM-409 exime 16 ficheros por mencionar la señal en un comentario** — contado
  comparando `texto.includes(senal)` (18) contra la señal como IDENTIFICADOR en el AST (2), sobre
  los 538 ficheros de `tests/`. Afloja el guard; merece su ticket.
* Sigue en el árbol el fichero suelto **`how f11e445e`** (502 bytes, salida de un `git show` de
  SCRUM-496), ya reportado en SCRUM-499, 503 y 506. No es de este carril y no se toca.
