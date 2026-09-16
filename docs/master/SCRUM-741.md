# SCRUM-741 · Grita, pero apunta mal

**Fecha:** 4-sep-2026 · **Carril:** herramienta / censo de deriva · **Gate:** sin gate — `npm test`

**Medido contra:** `origin/main` = `f145a4b88ccd034b6ca16b7d6a01dc43b11b0049` · 2026-09-04T22:35:00Z

---

## PASO 0

**ENTRADA:** `npm test` → `tests/scrum461-censo-no-encoge.test.mjs`, el test ③ que contrasta el
fichero commiteado contra el `.prisma`. **MECANISMO:** el lector tolerante **ya existía** —
`leerCensoDelFichero`, que S6 construyó en SCRUM-733. El trabajo era **enchufarlo**, no escribirlo.

---

## EL DEFECTO

`paresDelSql` leía así:

```js
[...txt.matchAll(/^ {4}\('([^']+)','([^']+)'\),?$/gm)]
```

**Anclada al final de línea.** Un comentario SQL detrás —o un espacio de más— y esa entrada deja
de verse: **421 donde hay 422**.

Y como el veredicto se construye por diferencia contra el `.prisma`, la columna sale listada bajo:

> 🔴 EL CENSO SE HA ENCOGIDO: estas columnas están en `prisma/schema.prisma` y NO en
> `docs/sql/deriva-prod.sql`: `albaranes.ocultar_precios_en_documento`

**Estando en el SQL, en su línea, perfectamente escrita.**

El test caía, así que **el veredicto era correcto — por accidente**. El **diagnóstico era falso**,
señalaba al `schema.prisma`, y la acción que sugería —regenerar el fichero— era la equivocada.
Costó una vuelta a otra sesión.

Es el hermano de SCRUM-733: aquél era **el silencio** (el generador encogiéndose sin decir nada);
éste es lo contrario, y **engaña más, porque un guard que grita se cree**.

### ANTES — reproducido por el mecanismo

Se añadió `   -- SCRUM-607` detrás de `('albaranes','ocultar_precios_en_documento')` (línea 59 del
fichero real) y el test cayó nombrando **esa** columna como ausente. Revertido.

---

## Lo construido — y sobre todo, lo que NO

**No se escribió un segundo lector.** `leerCensoDelFichero` ya existía, no ancla, y —comprobado al
abrirlo— **ya tenía este mismo defecto medido y escrito en su comentario**:

> *«A PROPÓSITO MÁS TOLERANTE que el vigilante de `tests/scrum461-censo-no-encoge.test.mjs`, que
> exige la línea EXACTA. Medido: a ese le basta un comentario SQL detrás para dejar de ver ESA
> entrada, y entonces da 421 donde hay 422. Allí ese error GRITA.»*

S6 lo midió, lo documentó y dejó el lector listo. Este ticket sólo cierra el otro extremo. Dos
lectores del mismo fichero divergen, y el día que divergen cada test dice una cosa distinta sobre
el mismo SQL.

---

## 🔴 EL FILO · tolerar un comentario NO es tolerar una ausencia

Un lector más permisivo cierra el diagnóstico falso y **abre la puerta a lo contrario**: tragarse
una columna que de verdad falta. Los tres casos se distinguen y los tres están probados:

| | situación | qué pasa |
|---|---|---|
| **A** | comentario detrás de la entrada | se lee bien, la entrada **no** desaparece |
| **B** | columna que falta de verdad, fichero coherente | se lee bien y **no se la inventa**: falta y se ve |
| **C** | la cabecera declara 3 y hay 2 | `ok:false` · **«No supe leer»**, que no es «faltan columnas» |

El caso C es el que casi todo el mundo se salta. Y no basta con que el lector lo diga: **el
vigilante tiene que convertirlo en un fallo**, no en una lista corta. Devolver una lista en la que
el propio lector no confía es exactamente cómo nace un diagnóstico falso — se compararía como si
fuera buena y señalaría columnas que sí están.

**SUELO:** si lee cero, falla. Y un texto que no es el censo **no puede** leerse como «0 columnas».

**CONTROL POSITIVO:** se comprueba que **la regex vieja sí perdía** esa entrada. Sin eso, el caso A
pasaría igual aunque el defecto no hubiera existido nunca, y no sabríamos si se arregló algo.

---

## 🔴 EL TERCER TRINQUETE MUDO DEL DÍA

El control «el vigilante convierte el `ok:false` en un fallo» comprobaba que el **texto**
`throw new Error` estuviera dentro de `paresDelSql`. Al inyectar el rojo —`if (!r.ok)` →
`if (false)`— el `throw` **sigue en el fichero, inalcanzable**, y el trinquete seguía verde sobre
un vigilante que ya se tragaba la lista corta.

Ahora se mira, por AST, **un `if` cuya condición depende de `ok` y cuyo cuerpo lanza**. Eso caza
tanto que el `throw` desaparezca como que su guarda deje de mirar `ok`.

Es la **tercera vez hoy** que comparar por texto en vez de por identidad me caza —las dos de
SCRUM-740 y ésta—, y las tres las encontró lo mismo: **probar el rojo de verdad**.

### Los rojos

| inyección | qué cae |
|---|---|
| ① el vigilante vuelve a su regex anclada | «ha dejado de usar el lector compartido» |
| ② se le quita el `throw` del `ok:false` | «o el `throw` ya no está, o su condición dejó de mirar `ok`» |

**El ② no caía antes de corregir el trinquete.** Las dos revertidas, `git status` limpio, CR = 0.

**DESPUÉS:** la misma inyección del ANTES (`-- SCRUM-607` detrás de la entrada) pasa en **verde**.

---

## Lo que NO cubre

1. **No se ha tocado `leerCensoDelFichero`.** Es de S6 y funciona; sólo se consume.
2. **El caso C depende de que el fichero declare su cabecera.** Si un día el generador dejara de
   escribir `-- Columnas esperadas: N`, `columnasDeclaradas` devuelve `null` y el lector deja de
   poder contrastarse consigo mismo — volvería a no distinguir «no supe leer» de «faltan». No lo
   vigila este ticket; lo vigila el generador, que la escribe.
3. **El trinquete de la regex mira el fichero desnudo de comentarios**, así que una regex anclada
   escrita dentro de una cadena no la vería. No hay ninguna hoy.
4. **No se han buscado otros lectores anclados del mismo fichero** fuera de `scrum461`.

## HALLAZGOS FUERA DE ALCANCE

* El caso «421 de 422» que se vio hoy en el CI (`637821ab`) **tenía otra causa** —una rama detrás
  de main, con la columna de SCRUM-607 recién entrada— y se resolvió correctamente. Coincide en
  número con el síntoma de este ticket, y esa coincidencia es justo lo que hace caro el
  diagnóstico falso: **dos causas distintas dan el mismo 421**.

## Ficheros

* `tests/scrum461-censo-no-encoge.test.mjs` — `paresDelSql` usa el lector compartido y convierte
  el `ok:false` en un fallo que dice «no supe leer».
* `tests/scrum741-la-entrada-no-la-linea.test.mjs` — **nuevo**, 8 tests: suelo, el caso A con su
  control positivo, el filo (B y C), el vigilante, y el trinquete por identidad.
