# SCRUM-788 · Los colaterales: ¿cobertura redundante o arrastre?

**Fecha:** 6-sep-2026 · **Carril:** instrumentos · **Gate:** medición; no se construye ningún juicio

**Medido contra:** `origin/main` = `ff4e1c4a14f474d0fb4095cb0643e069388e4935` · 2026-09-06T13:27:43+01:00

> **Este ticket MIDE.** No cambia ningún veredicto del arnés, no añade ninguna puerta y no toca
> `cayo()`, `murioElFichero()` ni `MUERTE_CUENTA_COMO`. Lo único que se ha tocado del instrumento
> es la CAPTURA: `correr()` guarda ahora de qué murió cada caído, porque sin ese dato la pregunta
> del ticket no se puede contestar.

---

## 1 · EL CENSO — recorriendo el árbol, y las cifras NO son las del encargo

| | encargo | **medido hoy** |
|---|---|---|
| declaraciones del árbol | — | **81** |
| con colaterales | 33 | **45** |
| colaterales | 55 | **76** |
| guards afectados | 17 | **21** |

El 33/55/17 era de un árbol anterior. **No hay ninguna lista cableada**: el censo sale de
`censoDeDeclaraciones()` recorriendo `tests/`, y las cifras se mueven con el árbol — de hecho se
movieron entre el encargo y esta medición.

---

## 2 · 🔴 EL DISCRIMINADOR: la primera versión SUSPENDIÓ SU CONTROL

### Por qué no vale el (b) del encargo

*«¿el test colateral importa el fichero mutado?»* — **no puede discriminar aquí, y es estructural:**
el arnés corre **un solo fichero de guard** por mutación, así que **todos los colaterales son otros
tests DEL MISMO fichero** y comparten sus imports con el nombrado. La respuesta es idéntica para el
test nombrado y para sus colaterales. Medido: en las 45 declaraciones con colaterales, el fichero
mutado aparece en el guard en **45 de 45**.

### v1 — «`AssertionError` ⇒ LEGÍTIMO». Suspendió.

Reparto crudo de los 76: **75 `AssertionError`, 1 `TypeError/ERR_INVALID_ARG_TYPE`**. Con eso, v1
daba *1 de 45 con arrastre*. **Y el control negativo la tumbó.**

### 🔴 EL CONTROL QUE DECIDE — mutación NEUTRA

`export async function correr(guard) {` → **dos espacios** entre `function` y `correr`. Formato
puro: comportamiento idéntico.

```
línea base: 11 pasados · 0 caídos
tras mutar: 10 pasados · 1 caídos

🔴 CAE: SCRUM-745 · 🔴 los dos lectores NO cuelgan de ningún reporter
   error: AssertionError/ERR_ASSERTION
   mi clasificador dice: LEGITIMO   🔴🔴 MIENTE
```

**Un cambio que no cambia nada tumba un test con `AssertionError`.** Luego `AssertionError` **no**
separa cobertura de arrastre: los guards que aseveran sobre TEXTO caen igual ante daño puramente
textual. La v1 queda retirada y su 75/1 **no se firma**.

*(Las cuatro primeras mutaciones neutras que probé —comillas, comentarios al final— no tumbaron
nada. Eso no era un verde: era que el rojo no salía y **el rojo que no sale acusa al caso**. La
quinta, sobre un fichero que un guard sí lee por texto, sí decidió.)*

### v2 — la pregunta que faltaba: ¿sobre QUÉ asevera el colateral?

| clase | criterio, derivado por AST del cuerpo del test |
|---|---|
| **ARRASTRE-ESTRUCTURAL** | murió de algo que no es un aserto (sintaxis, import, fixture) |
| **ARRASTRE-TEXTO** | asevera sobre el TEXTO del fichero mutado (lo lee con `readFileSync` y pregunta dentro): su caída prueba que el texto cambió, **no** que cambiara el comportamiento |
| **LEGÍTIMO** | ejerce el código y falla un aserto |
| **INDETERMINADO** | no se pudo mapear el nombre del test a su cuerpo. **No se reparte al montón mayoritario** |

**Los tres controles de v2, y los pasa:**

| control | esperado | obtenido |
|---|---|---|
| 🔴 negativo (el de los dos espacios) | ARRASTRE-TEXTO | ✔ ARRASTRE-TEXTO |
| ✅ positivo — la puerta de `scrum765`, cobertura legítima conocida de antemano | LEGÍTIMO ×2 | ✔ LEGÍTIMO ×2 |
| ✅ estructura — el `TypeError` de `scrum763` | ARRASTRE-ESTRUCTURAL | ✔ ARRASTRE-ESTRUCTURAL |

### D1 (¿parsea tras mutar?) — y un falso positivo mío, declarado

El medidor de sintaxis lleva su propio control (texto sano → 0 errores, texto roto → ≥1) y aborta
si no distingue. Dio **1 mutación «rompe la sintaxis»**: `public/dashboard/index.html`. **Es un
falso positivo:** es HTML, y yo lo estaba parseando como JavaScript. **NO APLICA**, no «sintaxis
rota». Esa declaración tiene 0 colaterales y no entra en la tabla. Ninguna de las 45 con
colaterales deja de parsear.

---

## 3 · 🔴 EL TITULAR

**31 de las 45 declaraciones con colaterales tienen AL MENOS un colateral por ARRASTRE.**

| | de 76 colaterales |
|---|---|
| LEGÍTIMOS | **38** |
| ARRASTRE por TEXTO | **35** |
| ARRASTRE ESTRUCTURAL | **1** |
| INDETERMINADOS | **2** |

---

## 4 · 🔴 Y LOS 35 NO SON 35 PROBLEMAS: 27 SON UN SOLO MECANISMO

**27 de los 36 colaterales por arrastre son tests que vigilan LAS PROPIAS DECLARACIONES de
mutación.** El patrón, literal, en `tests/scrum753-censo-de-alcanzabilidad.test.mjs:532`:

```js
assert.ok(fs.readFileSync(abs, 'utf8').includes(m.de),
  `🔴 el ancla de la mutación «${m.cae}» ya no está en «${m.fichero}»: la declaración caducó.`);
```

Ese aserto comprueba que **el ancla sigue en el fichero**. Cuando el arnés aplica **esa misma
mutación**, el ancla se sustituye por `m.a` y desaparece. **Cae por definición, siempre.**

**No es un radio demasiado ancho: es el mecanismo inspeccionando el árbol en plena operación.** Un
guard que se autocomprueba no puede acertar mientras se le está aplicando su propia mutación.

Descontados esos 27, **el arrastre "de verdad" son 9 colaterales**: 8 de guards de texto normales
y 1 estructural.

---

## 5 · LAS PEORES DECLARACIONES

| # | guard · línea | fichero mutado | arrastre | por qué |
|---|---|---|---|---|
| 1 | `scrum586-forma-de-pago-por-cliente.test.mjs:636` | `public/dashboard/js/quotesView.js` | **2 / 2 (100 %)** | sus dos colaterales son auto-referenciales: el CONTADOR de ranuras sin firmar y «cada mutación declara un texto que EXISTE». Ninguno mira el comportamiento mutado |
| 2 | `scrum753-censo-de-alcanzabilidad.test.mjs:541` | `scripts/_censo-alcanzabilidad.mjs` | **2 / 2 (100 %)** | «el LECTOR OFICIAL VE mis declaraciones» + «el instrumento DECLARA lo que no puede ver». El primero es el aserto de ancla de arriba |
| 3 | `scrum783-seleccion-sobrevive-navegacion.test.mjs:256` | `public/dashboard/js/customersView.js` | **2 / 3 (67 %)** | uno auto-referencial y otro que asevera sobre el texto del fichero, no sobre la selección que el guard vigila |

Empatadas a 2 de arrastre, con menor proporción: `scrum750` (2/4) y `scrum763` (2/4 — el único
`ARRASTRE-ESTRUCTURAL` del árbol, un `TypeError/ERR_INVALID_ARG_TYPE`).

---

## 6 · RECOMENDACIÓN — y NO la construyo

**Ni «que el arnés juzgue los colaterales» ni «el 76 es ruido tolerable». Las dos son falsas con
los números delante.**

- **Juzgar los colaterales hoy pondría rojo un árbol sano**: 31 de 45 declaraciones tienen
  arrastre, y **27 de los 36** son el auto-chequeo del ancla — un patrón que la casa escribió *a
  propósito* y que funciona. Un veredicto sobre colaterales condenaría a los guards mejor
  instrumentados del árbol.
- **Pero tampoco es ruido**: quedan **9** colaterales de arrastre real, y sobre todo hay **un
  defecto nombrable** debajo.

**Lo que recomiendo, por orden y sin construir nada:**

1. 🔴 **Arreglar el auto-chequeo del ancla, no los colaterales.** El aserto «el ancla sigue ahí»
   debería leer el fichero **como estaba antes de mutar**, o declararse no aplicable mientras el
   arnés está operando. Es UN patrón repetido en varios guards, y quita **27 de 36** arrastres de
   un golpe. Es un ticket de guards, no del arnés.
2. **Después de eso, volver a medir.** Con 9 arrastres el número es pequeño y sí se puede mirar
   caso a caso.
3. **Mientras tanto, seguir CONTANDO sin juzgar**, que es lo que hace hoy. Añadiría sólo una cosa
   al recuento impreso: **el reparto** (legítimos / arrastre-texto / arrastre-estructural), para
   que el número deje de ser un total opaco. Eso es medición, no veredicto.
4. ⛔ **Un quinto veredicto, NO.** El arrastre no es un defecto del guard mutado ni del arnés: es
   una propiedad de la relación entre una mutación y OTRO test. Un veredicto que condena al guard
   por lo que le pasa a un test vecino acusaría al que no es.

---

## HUECOS DECLARADOS

- **2 INDETERMINADOS** (`scrum785`, dos tests): el clasificador no supo mapear su nombre a un cuerpo
  de test. **No se han repartido al montón mayoritario**, que es lo que convertiría un número en
  una impresión.
- **v2 no está probada contra un fixture compartido que muera dando `AssertionError`.** Su control
  negativo cubre el daño textual; un fixture roto que se manifieste como aserto fallido se
  clasificaría LEGÍTIMO. No he sabido provocar ese caso.
- La clasificación **texto vs comportamiento** es del cuerpo del test por AST: un test que haga las
  dos cosas cuenta como texto. Es el lado conservador (marca arrastre de más), y se dice.
- El censo cubre `tests/`. `dist/` aparece como fichero mutado en dos declaraciones de `scrum608`;
  se han clasificado igual que el resto.
