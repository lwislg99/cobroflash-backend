# SCRUM-860 · Clasificadas las 146: el número que decide es 81, no 146

**Fecha:** 15-sep-2026 · **Carril:** seguridad · datos · **Gate:** sin gate
**Medido contra:** `origin/main` = `8b9b0d9b0dce14b635327e5b74a14c0bafcd5be7` · 2026-09-15T14:22:43Z
**Rama:** `scrum-860-clasificar-las-146`

⛔ **ESTA TANDA CLASIFICA. No arregla ninguna de las 146 y no escribe el guard** (§3 del ticket):
el criterio del guard tiene que DERIVARSE de esta clasificación, y con la clasificación recién
hecha lo honesto es entregarla y que el arreglo lo decida quien venga (regla 9). `src/` intacto.

---

## 1 · El número que decide

| | |
|---|---|
| lecturas de Prisma en `src/` | 430 |
| · con `select` de primer nivel | 284 |
| · **sin** `select` | **146** ← el censo |
| | |
| 🔴 **HACIA FUERA** — se serializan a una respuesta | **81** ← **el número que decide** |
| INTERNA — no salen por la API | **36** |
| ⚠️ **NO CLASIFICADO** — no lo sé | **29** |
| **suma** | **146** ✅ cuadra con el censo |

**146 era el tamaño del censo; el del problema es 81.** Y dentro de los 81 la prioridad tampoco es
plana:

| modelo | hacia fuera |
|---|---|
| `invoice` | 18 |
| `quote` | 18 |
| `charge` | 10 |
| `job` | 9 |
| `albaran` | 5 |
| resto (13 modelos) | 21 |

Los cuatro de cabeza son exactamente los que llevan datos de cliente y dinero, que es lo que el
ticket temía: **46 de las 81 están en `invoice`, `quote` y `charge`.**

---

## 2 · El método, declarado — y sus límites con él

Por cada lectura sin `select`: se ensucia lo que liga, se propaga dentro de su función
(asignaciones, destructuring, `for…of` y derivadas), y entonces:

1. si algo sucio entra en `res.json(x)` / `res.send(x)` de esa función → **HACIA FUERA (directo)**;
2. si no, y la función **devuelve** algo sucio → se buscan sus llamadores en `src/`; si alguno
   serializa el resultado → **HACIA FUERA (por su llamador)**;
3. si devuelve algo sucio y no se puede seguir → **NO CLASIFICADO**;
4. si lo sucio no se devuelve ni se serializa → **INTERNA**.

### 🔴 Los límites, antes que el número

* **El seguimiento de llamadores es de UN salto.** Una cadena servicio→servicio→handler sale NO
  CLASIFICADO, no INTERNA.
* No se resuelven llamadas dinámicas ni re-exportaciones.
* 🔒 **NO CLASIFICADO NO ES SANO.** Es «no lo sé». Se cuenta aparte a propósito: esta mañana, de 29
  candidatos clasificados estáticamente, **26 cambiaron de veredicto al ejecutarlos** (SCRUM-844).
  Una clasificación estática es una hipótesis hasta que alguien sigue el camino.

### Los 29 no clasificados, por qué

| nº | motivo |
|---|---|
| 20 | devuelve el dato y su llamador (1 salto) no serializa: **la cadena sigue** y no la he seguido |
| 9 | devuelve el dato y **no se le encuentran llamadores** en `src/` |

Los 9 sin llamadores son los más sospechosos: o son código muerto, o los llama algo que este
análisis no ve. **Ninguno de los 29 debe contarse como sano.**

---

## 3 · 🔴 EL CONTROL QUE DECIDE, ejecutado

Se añade `margenObjetivoInterno` al modelo **en memoria** —una columna que nadie nombra en ninguna
parte del código— y se comprueba si sale sola por una lectura clasificada HACIA FUERA:

```
🔴 SUELO · la mutación entró: la fila doblada lleva `margenObjetivoInterno`

🔴 EL QUE DECIDE · `listProducts` (clasificada HACIA FUERA, sin `select`)
   claves servidas: 14
   ¿sale `margenObjetivoInterno` sin que nadie la nombre?  🔴 SÍ

✅ CONTRASTE · `exportProductsCsv` (CON `select`, mismo doble, misma columna nueva)
   ¿saca la columna nueva?  ✅ no

✅ NEGATIVO · `listProducts` SIGUE sirviendo `cost` (decisión del fundador, SCRUM-609)
   cost = 12.00  ✅
```

### Por qué el doble respeta `select`, y sin eso esto no probaría nada

Un doble que devolviera siempre la fila entera sacaría la columna nueva por **todas** las lecturas,
con `select` o sin él, y el control sería **circular**: demostraría lo que hace el doble, no lo que
decide el código. Por eso imita la semántica real de Prisma —con `select`, sólo las claves pedidas;
sin él, la fila entera—. **El contraste con `exportProductsCsv` es lo que prueba que el doble no
miente**, y por eso va dentro del control y no aparte.

### Y se comprobó que la mutación ENTRÓ

🔒 Una mutación que no entra y una cobertura que no existe dan la misma salida. Medido hoy mismo en
SCRUM-844, donde un `split/join` que casó cero veces dejó el fichero intacto, el test pasó en verde
y por poco declaro NO CUBIERTO el punto más grave de aquel ticket. Aquí se afirma **antes** de leer
el veredicto que la fila doblada lleva la columna nueva.

### ✅ El control negativo, y la distinción que evita el desastre

> 🔒 **«HACIA FUERA» ES UNA CLASIFICACIÓN, NO UN VEREDICTO DE DEFECTO.**

`listProducts` está clasificada HACIA FUERA **y eso no la convierte en un defecto**. Que sirva
`cost` está DECIDIDO (SCRUM-609, `adminRouteDeclarations.ts:205`) y es correcto. Lo que esta tanda
mide es otra cosa: **que la columna de mañana sale sola, sin pasar por ninguna decisión.** Un guard
que confundiera las dos cosas marcaría `listProducts` y sería el guard que acaban relajando.

### Comprobación a mano, contra la clasificación automática

`auth.service.ts:250` (`verifyMagicLink`) sale **INTERNA**. Leído: lee `authSession` sin `select`,
la usa sólo para comprobaciones y para un `update`, y devuelve `string | null` — **la fila nunca
sale**. La clasificación acierta en el caso comprobado. Es UNA muestra, no una validación del
conjunto, y se dice así.

---

## 4 · Lo que esto deja preparado para el arreglo (y NO se hace aquí)

El ticket §3 pide un guard cuyo criterio **se derive** de esta clasificación, no una lista a mano.
La clasificación ya da el criterio derivable: **una lectura sin `select` de primer nivel cuyo
resultado se serializa a una respuesta**. Sobre `main` de hoy eso son **81**, y el guard tendría que
partir de esa cifra y no dejarla crecer.

⚠️ Y una advertencia para quien lo escriba: **los 29 no clasificados no pueden entrar como sanos**.
Si el guard se deriva sólo de los 81, los 29 quedan fuera de la red sin que nadie lo haya decidido
— que es exactamente el mecanismo que este ticket denuncia, una capa más arriba.

## 5 · Lo NO tocado

`src/` entero · `listProducts` · el `select` de `exportProductsCsv` (es la cabecera del CSV, medido
en SCRUM-752; **no se recuenta como caso**) · `prisma/schema.prisma` · el camino de emisión fiscal
(leído, regla 38) · ningún estado ni flag (27) · ninguna dependencia (36). Ninguna base, ninguna
clave. **Nada ejecutado contra producción ni contra staging.**
