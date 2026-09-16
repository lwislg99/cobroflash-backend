# SCRUM-510 · La exención de SCRUM-409 deja de librar por MENCIONAR la señal, y mira si la USAN

**Medido contra:** `origin/main` = `d17e54260a953bcb19cd3382a6577d8b312f2d28` · 2026-08-13T12:18:45+01:00

**13-ago-2026** · **Carril:** guards · **Gate:** sin gate, corre en `npm test`

**LA VÍCTIMA:** el guard existe para que nadie clave el merchant DEMO en un test, y libraba a 16
ficheros de mirarlos gratis solo porque lo mencionaban en un comentario. En esos 16, alguien podía
clavarlo y nadie se enteraba. **Dos ya lo tenían clavado.**

> Es el mismo defecto que SCRUM-509 le quitó al DETECTOR, vivo todavía en su EXENCIÓN: atada a la
> FORMA —que el texto aparezca— y no al HECHO —que se use.

> ⚠️ Este ticket va en dirección contraria al anterior: **ENDURECE**, y los rojos nuevos son el
> entregable, no un efecto secundario.

---

## ① EL PASO 0 · los tres números, re-medidos

`main`: `12372404` → `d17e5426`. `docs/master/SCRUM-510.md` no existía.

Los números venían de una medición mía de ayer y `main` se ha movido desde entonces, así que se
vuelven a contar **con los dos instrumentos** sobre el mismo conjunto (sonda escrita **a fichero**,
que es la lección de ayer: una regex en línea de comandos mide los escapes, no el defecto).

| | |
|---|---|
| TOTAL ficheros auditados | **538** |
| ilegibles (suelo) | **0** |
| **A** · exentos por MENCIÓN (`texto.includes`) | **18** |
| **B** · exentos por USO real (identificador en el AST) | **2** |
| **exentos DE MÁS** (A − B) | **16** |

**Y cuadran**: `18 + 520 = 538` · `2 + 536 = 538`. Control de coherencia: *usar implica mencionar*,
y los que usan sin mencionar son **0** — si no, uno de los dos instrumentos estaría midiendo mal.

**No sale 2 y 2**, así que el ticket no se cae.

### 🔴 Y el cruce que de verdad lo decidía

Antes de tocar nada: de los 16 que perderían la exención, **¿cuántos clavan el demo?**

| | |
|---|---|
| **ROJOS NUEVOS** (clavan el demo) | **2** |
| sin ningún uso del demo (ni se enteran) | **14** |
| suma | **16** ✔ |

**Hacen falta CERO exenciones escritas a mano**, así que no se entra en el STOP 2. Si hubiera hecho
falta exentar a los 16, la señal estaría mal elegida y la decisión sería del asesor.

### (d) y (e) · nadie más la toca

`git log --all -S"SENALES_IMPORT"` y `-S"pruebaElDemo"` devuelven solo los dos commits que la
crearon (`df0ef95f`, Luis, 9-ago) y el mío de SCRUM-509 — los dos en `main`. Ninguna rama remota
pendiente. Control positivo del pickaxe: encuentra esos commits, así que sabe encontrar cuando hay.

---

## ② LOS DOS ROJOS NUEVOS, clasificados uno a uno

Los dos son **hallazgos de verdad**, no menciones legítimas. Y la ironía es el ticket entero:

```
scrum290-adicional.test.mjs:79            const REQ = { …, merchantId: 1, … }
scrum290-endpoint-convertir.test.mjs:88   const REQ = (id = 1) => ({ …, merchantId: 1, … })
```

Los dos ficheros **arreglaron con cuidado el merchant que devuelve la BD** (`p.merchant` → `id: 7`),
**escribieron el motivo** en un comentario… y dejaron el `req` clavado en el DEMO. Y **la exención
se la dio ese mismo comentario**. El segundo lo cuenta con todas las letras:

> *«La primera versión de este fichero tenía ese `id: 1` y por eso el caso del justificante salía
> 201: **el dato de prueba tapaba la comprobación, no el código**.»*

**Arreglados los dos aquí**, con `merchantId: 7` — el mismo merchant que su propia BD devuelve, así
que el `req` deja de contradecir al fixture.

### Y al arreglarlos saltó una expectativa clavada a mano

`scrum290-adicional.test.mjs:129` decía `assert.equal(cap.adicionalCreado.merchantId, 1,
'tenencia (regla 2)')`. Eso medía **el número**, no el hecho: se rompía al cambiar el fixture, y
además `1 === 1` podía cumplirse por coincidencia con el demo. Ahora se deriva:

```js
assert.equal(cap.adicionalCreado.merchantId, REQ.merchantId, 'tenencia (regla 2)');
```

Comprueba lo que dice comprobar —que el adicional hereda la tenencia **de la petición**— y deja de
depender de un número escrito a mano. **Derivar el fixture, nunca la expectativa.**

---

## ③ QUÉ SE CONSTRUYE

La exención mira el **USO**: la señal tiene que aparecer como **IDENTIFICADOR** en el AST —
importada, llamada o leída. Un comentario no es un identificador; una cadena tampoco. Es el mismo
criterio que SCRUM-509 le puso al detector, aplicado ahora a la otra mitad del guard.

**Sin listas a mano y sin excepciones nuevas**: de los 16 que la pierden, 14 no la necesitaban y 2
eran defectos.

---

## ④ VERIFICACIÓN

* **🔴 CONTROL POSITIVO PRIMERO** — los **2** ficheros que SÍ usan la señal (`emission.test.mjs`,
  `scrum115-wa-fallo-registrado.test.mjs`) **siguen exentos**, y el detector sigue cazando las ocho
  formas que enumera SCRUM-509, cuyo control **no se ha tocado**. Sin esto, «ya no exime de más» y
  «ya no exime nada» son el mismo verde.
* **AUTOPRUEBA sobre fuente sintética, en los dos sentidos** — reconoce importación, llamada y
  lectura de la constante; y **no** reconoce ni el comentario ni la cadena.
* **SUELO** — si ningún fichero usa el mecanismo, el guard **se declara ciego** en vez de dar verde:
  «cero» y «no supe mirar» por líneas distintas.
* **LAS CATEGORÍAS SUMAN SU TOTAL**, y se comprueba además que *usar implica mencionar*: si eso se
  rompe, uno de los dos instrumentos miente. Los números viajan en un `diagnostic`, así que la tanda
  los imprime sin que nadie tenga que volver a medirlos.
* **ROJO POR EL MECANISMO** — ⑤.
* **Los guards estrechados en SCRUM-509 (detector de 409 y huella de 337) y `guards:entrada`:
  verdes y SIN TOCAR.**

## ⑤ 🔴 ROJO POR EL MECANISMO, con su control negativo

Con la rama **ya en verde y commiteada** (`29e254a3`), y post-condición comprobada (`git diff
--stat` enseñó el fichero tocado).

Se clavó el merchant demo en **uno de los 14 recién destapados** —`scrum403-beneficio-sin-iva`— y el
guard cayó **nombrando fichero y línea**:

```
🔴 FIXTURES CON EL MERCHANT DEMO (id 1):
   scrum403-beneficio-sin-iva.test.mjs:272  const FIXTURE_MUTADO = { merchantId: 1, total: "10.00" };
```

**CONTROL NEGATIVO DEL EXPERIMENTO** — con la mutación puesta, el criterio VIEJO habría eximido a
ese mismo fichero:

```
¿tiene el demo clavado?   : true
criterio VIEJO (menciona) : EXENTO → pasaba en silencio
la mención que lo eximía  : // Merchant de id REAL: `isDemoMerchant` es `id === 1` y desactiva
                            comprobaciones sin tocar el guard
```

🔸 Otra vez: **el comentario que advierte del defecto era el que daba la exención**. Tres ficheros
distintos con el mismo patrón — no es casualidad, es lo que produce una exención atada a la forma.

## ⑥ Ficheros

* `tests/scrum409-fixtures-sin-merchant-demo.test.mjs` — `usaElMecanismoDelDemo` por AST, autoprueba
  del criterio nuevo y el censo que cuadra. **6 → 8 tests.**
* `tests/scrum290-adicional.test.mjs` — el `req` deja de clavar el demo, y la expectativa de tenencia
  se deriva del `REQ`.
* `tests/scrum290-endpoint-convertir.test.mjs` — el `req` deja de clavar el demo.

**Lo que NO se toca:** el detector de SCRUM-409 ni la huella de SCRUM-337 (acaban de estrecharse) ·
`prisma/schema.prisma` · textos de correos · camino de emisión y sellado · `public/` ·
`email_messages`.

## ⑦ Verificación de la tanda

Con `dist/` reconstruido y `npx prisma generate` corrido **en este worktree**, y la tanda lanzada
**después del último cambio y de la última edición de este documento**. La línea base se midió
aparte, guardando el trabajo con `git stash` (nunca `git checkout --`) y recuperándolo después.

| | ficheros | tests | pass | fail | skipped |
|---|---|---|---|---|---|
| **línea base** (`main` puro, este árbol) | 469 | **3.609** | **3.532** | **0** | **77** |
| **después** | 469 | **3.611** | **3.534** | **0** | **77** |
| diferencia | 0 | **+2** | **+2** | **0** | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fallos**.
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.
* 🔸 **El absoluto caduca en cuanto `main` se mueva; el delta sobrevive**: +2 tests, 0 fallos nuevos,
  0 saltos nuevos — y **dos fixtures que clavaban el demo, arreglados**.
* ⚠️ Los dos rojos nuevos **no aparecen en esta tabla porque se arreglaron en el mismo commit**. Que
  la tanda siga en 0 fallos no significa que el guard no destapara nada: significa que lo destapado
  se corrigió. La prueba de que destapa está en ⑤.

## ⑧ Huecos DECLARADOS

* **`{ merchantId: DEMO_MERCHANT_ID }` sigue sin cazarse.** No lo cazaba el detector viejo ni lo caza
  el nuevo: no es regresión, y no salía gratis, así que **no se cubre aquí** — se deja dicho para que
  no se vuelva permanente.
* **Los 14 ficheros que pierden la exención sin tener usos** quedan ahora vigilados de verdad, pero
  eso solo se nota el día que alguien clave el demo en ellos. Lo que hay medido hoy es que ninguno lo
  tiene; que sigan limpios lo dirá el guard.
* **No se ha medido si alguno de los 2 hallazgos cambiaba el resultado del test.** Los dos siguen en
  verde con el merchant 7, así que hoy el `req` no desviaba el camino demo; pero el guard existe
  precisamente porque eso puede cambiar sin que nadie lo note.

## ⑨ Fuera de carril (una línea cada uno)

* **Tres ficheros distintos tenían la exención gracias al comentario que advertía del defecto**
  (`scrum290-adicional`, `scrum290-endpoint-convertir`, `scrum403-beneficio-sin-iva`) — contado
  sobre los 18 que mencionaban la señal. Es el patrón que produce cualquier exención atada a la
  forma, y merece mirarse en los otros guards que eximan por `includes`.
* Sigue en el árbol el fichero suelto **`how f11e445e`** (502 bytes, salida de un `git show` de
  SCRUM-496), ya reportado en SCRUM-499, 503, 506 y 509. No es de este carril y no se toca.
