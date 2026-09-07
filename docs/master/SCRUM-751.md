# SCRUM-751 · Dos claves iguales en un censo, y `main` mergeado en rojo

**Fecha:** 5-sep-2026 · **Carril:** suite / trinquetes · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `28b045855d9a68f12906f218bfe78fa5e0472433` · 2026-09-05T16:13:42Z

---

## PASO 0 — LO QUE SE MIDIÓ ANTES DE TOCAR

El objeto `CENSO` de [scrum402-marcador-no-se-pinta.test.mjs](tests/scrum402-marcador-no-se-pinta.test.mjs)
abre en la línea 54 y cierra en la 593. Dentro, la clave `'invoicesView.js'` aparecía **dos veces**:

| línea | la puso | por qué |
|---|---|---|
| 139 | SCRUM-748 (4-sep) | el rótulo del cuarto estado del semáforo |
| 578 | SCRUM-648b (5-sep) | el motivo del ámbar en la bandeja de pendientes |

Cada ticket «ENTRÓ con 1» sin ver al otro. Git los mezcló limpio porque estaban a **439 líneas de
distancia**: ningún conflicto que revisar.

---

## EL DEFECTO

**JavaScript se queda callado ante una clave repetida y gana la última.** El censo declaraba **1**
mientras la pantalla pintaba **2**, así que el trinquete del 402 no podía apretar y el rojo salió
DESPUÉS del merge (PR #1065).

`Object.freeze` no protege de esto: el pisado ocurre **al construir el literal**, antes de congelar.

```js
const CENSO = Object.freeze({
  'invoicesView.js': 1,   // línea 139 — la pisa la de abajo
  /* … 439 líneas … */
  'invoicesView.js': 1,   // línea 578 — ésta es la que vale
});
```

🔴 **Lo que faltaba no era una entrada nueva: era subir a 2 la que ya había.**

---

## LO QUE SE HIZO

### ① El rótulo, firmado y retirado EN EL MISMO COMMIT

El fundador firmó **«No hemos podido comprobar el plazo.»** (35 caracteres; el tope medido son 50
a 390 px). El marcador `[PENDIENTE microcopy oficial]` sale de
[invoicesView.js](public/dashboard/js/invoicesView.js).

La firma y la retirada van juntas a propósito: si el rótulo se aprueba en un chat y el código sigue
diciendo `[PENDIENTE`, **el repositorio afirma algo que ha dejado de ser verdad** — que es
exactamente como el PR #1065 se mergeó en rojo.

### ② La entrada duplicada, BORRADA (no puesta a 0)

Sale la entrada de SCRUM-648b, cuyo rótulo queda firmado. **Sobrevive la de SCRUM-748 con 1**,
porque ese otro rótulo —el del cuarto estado— sigue sin firmar y su marcador sigue en pantalla.

Un 0 sería un sujeto que se mide y da cero; una entrada borrada es un sujeto que ya no existe.

### 🔴 La trampa que había que nombrar

Tras la firma, las dos claves valían 1 y el valor correcto pasaba a ser 1: **el censo habría
acertado por casualidad.** Por eso el guard nuevo no compara valores — exige que la clave aparezca
**una sola vez**.

### ③ El guard, sobre el FUENTE

En ejecución la prueba ya no existe: `{ a: 1, a: 2 }` construye un objeto con UNA clave. Cualquier
guard que importe el módulo y cuente claves llega tarde por diseño. Se lee por AST.

El detector vive en un helper, [_claves-duplicadas.mjs](tests/_claves-duplicadas.mjs), y no dentro
de su test: el defecto es de **todos** los censos de la casa, no del que lo sufrió.

---

## EL CENSO, CON SU UNIDAD

**1.229 ficheros** `.ts/.js/.mjs/.cjs` leídos · **0 claves duplicadas** tras el arreglo.

Suelo **por familia**, no agregado — un total escondería que una rama entera dejó de leerse:

| familia | leídos | suelo |
|---|---|---|
| `tests/` | 759 | 700 |
| `scripts/` | 117 | 100 |
| `src/` | 268 | 240 |
| `public/` | 84 | 75 |
| `prisma/` | 1 | 1 |

---

## EL CONTROL QUE DECIDE

El detector puesto contra el fichero **tal y como estaba en `origin/main`**:

```
DUPLICADOS: 1
  invoicesView.js -> lineas 139, 578
```

Y contra el arreglado: `DUPLICADOS: 0`. **Rojo sobre el defecto real, verde sobre el arreglo.**

Control del instrumento, en cinco casos: ve un duplicado fabricado · no inventa donde no hay ·
`a` y `'a'` son la misma clave · `get a`/`set a` NO es duplicado · una clave computada se ignora
en vez de adivinarse.

---

## MUTACIONES DECLARADAS Y COMPROBADAS

`MUTACIONES_QUE_ME_TUMBAN` en el propio guard, ejecutadas con `npm run meta:mutaciones`:

| mutación | qué prueba |
|---|---|
| duplicar `'invoicesView.js': 1` (mismo valor) | el caso REAL, el que «acertaría por casualidad» |
| duplicar `'settingsView.js'` con valor distinto | que el guard no depende de que los valores difieran |

Resultado: **vivas 8 · mudas 0 · ciegas 0**, estable en tres pasadas seguidas.

---

## TESTS

- [tests/scrum751-clave-duplicada-en-silencio.test.mjs](tests/scrum751-clave-duplicada-en-silencio.test.mjs)
- [tests/_claves-duplicadas.mjs](tests/_claves-duplicadas.mjs)
- [tests/scrum402-marcador-no-se-pinta.test.mjs](tests/scrum402-marcador-no-se-pinta.test.mjs)
- [tests/scrum648b-motivo-del-ambar.test.mjs](tests/scrum648b-motivo-del-ambar.test.mjs)

`scrum648b` **cambia de lado**: hasta la firma exigía que el marcador ESTUVIERA (regla 30); desde
la firma exige que **no vuelva**. Un marcador reaparecido sobre un texto ya aprobado volvería a
meter `invoicesView.js` en el censo del 402 sin que nadie lo decida.

---

## EL EXIT 0 QUE NO EXISTÍA

Se abrió este ticket sospechando que un rojo salía con **código 0**. **No hay tal defecto:**

| camino | estado |
|---|---|
| `node --test` con un rojo | **1** |
| `npm test` con un rojo | **1** |
| `node --test … ; echo` | **0** ← el del `echo`, no el de node |
| `node --test … \| tee` | `PIPESTATUS = 1 0` |

La medición original decía «exit 0» porque se leyó el estado de un **comando compuesto terminado en
`echo`**. El propio registro lo demuestra: imprimió `EXIT_TANDA=1` y el compuesto salió 0.

El CI corre `npm test` **directo, sin tubería**, y además `suelo-de-la-tanda.mjs` con `if: always()`.
**No está ciego.**

---

## HUECOS DECLARADOS

- La primera pasada de `meta:mutaciones` declaró mis dos mutaciones **CIEGAS**; las tres siguientes
  dieron VIVAS con el mismo fichero de guard. **No reproducido ni explicado.**
- El censo cubre `tests/ scripts/ src/ public/ prisma/`. **No** cubre ficheros `.json`, `.md` ni
  otros directorios.
- Claves computadas (`[k]: 1`) quedan fuera por diseño: no se pueden resolver leyendo.
