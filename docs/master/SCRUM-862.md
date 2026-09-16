# SCRUM-862 · Un envío FALLIDO entra en el denominador de la tasa de entrega

**Medido contra:** `origin/main` = `026677a1bd8260ce073648680a8eb7d7003f4b39` · 2026-09-16T04:07:51Z
**Rama:** `scrum-862-el-fallo-entra-en-el-denominador` · **Carril:** producto · métricas
**Gate:** sin gate — corre en `npm test`

> ⛔ Ningún estado ni flag nuevo (27) · ninguna dependencia (36) · WhatsApp sigue siendo Meta Cloud
> API directa · nada contra producción ni staging, todos los datos fabricados · no se relaja nada
> de lo cerrado en [SCRUM-530](SCRUM-530.md).

---

## 0 · Obligación 0

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-862(-|$)"  ->  NINGUNA
git ls-remote --heads origin | grep -c 862                          ->  0   (ni suelto)
git log origin/main --oneline -i --grep="scrum-862"                 ->  vacío
docs/master/SCRUM-862.md                                            ->  no existía
```

**Caso (a): nunca se empujó.** Y la prueba por CONTENIDO, que es la que decide: `failed` seguía
fuera de `SENT_OR_MORE` y de `DELIVERED_OR_MORE`. **Vivo.**

⚠️ Y lo primero de todo, por el error de ayer: **se comprobó la rama ANTES de empezar** — se venía
de `scrum-530-…`, ya mergeada, y se abrió rama propia desde `origin/main`.

## 1 · El censo de consumidores: es un ARREGLO, no un patrón

Por AST sobre **1.503 ficheros** (`src/*.ts` + `public/*.js` + `tests/*.mjs` + `scripts/*.mjs`),
nunca por `grep` —los comentarios de la casa nombran los dos conjuntos—:

| | |
|---|---|
| usos EN CÓDIGO de `SENT_OR_MORE` / `DELIVERED_OR_MORE` | **8** |
| ficheros distintos | **1** (`whatsappLog.service.ts`) |
| control positivo (`getWhatsAppMetrics`) | 5 apariciones ✅ el instrumento ve |

**Nadie más los usa**, así que esto no es un patrón repetido por el árbol. Pero dentro del fichero
hay **tres consumidores distintos**, y ahí estaba lo que había que separar.

## 2 · 🔴 Las cifras que se mueven, medidas ANTES de tocar

| consumidor | 1 entregado + 9 fallidos, HOY | ¿correcto? |
|---|---|---|
| **MES** (KPIs de la tarjeta) | `sent=1 delivered=1 failed=9 total=10` | ✅ **sí**: los fallos se ven APARTE |
| **por plantilla** | `env=1 ent=1 tasa=100` | 🔴 no |
| **7 días** (la alerta) | `sample=1 tasa=100 activa=false` | 🔴 no |

> 🔴 **La cifra que se rompía por el lado bueno, y por eso el arreglo NO es meter `failed` en
> `SENT_OR_MORE`:** ese conjunto también alimenta `aggregateWaRows`, que calcula `month.sent`. Con
> el fallo dentro, la tarjeta pasaría a enseñar **«Enviados 10 · Fallidos 9»** contando los mismos
> nueve **dos veces**. Se midió antes, no después, y por eso los KPI del mes quedan intactos.

**El arreglo** es una función aparte, `esIntentoDeEntrega`, usada **sólo** como denominador de las
dos tasas: *el denominador de una tasa de entrega son los INTENTOS, no los que no fallaron*.

## 3 · Antes y después, con lo que NO se movió delante

| caso | antes | después |
|---|---|---|
| **1 entregado + 9 fallidos** | 7d `sample=1 tasa=100 activa=false` · plantilla `100` | **`sample=10 tasa=10 activa=true`** · plantilla **`10`** |
| 20 enviados / 10 entregados | `sample=20 tasa=50 activa=true` | **idéntico** |
| todo entregado (12) | `sample=12 tasa=100 activa=false` | **idéntico** |
| 1 entregado + 2 fallidos (el fontanero de la 530) | `sample=1 tasa=100` | `sample=3 tasa=33` |
| sin filas | `tasa=null` sin alerta | **idéntico** |
| **MES, en todos los casos** | — | **intacto** |

El caso del fontanero sigue **sin** alerta porque 3 < 10, y ahí entra el aviso de muestra corta de
SCRUM-530 — que ahora dice **3/10** en vez de 1/10. Las dos piezas encajan.

## 4 · Los controles, ejecutados

| control | resultado |
|---|---|
| 🔴 **SUELO** | cero mensajes que examinar → CIEGO |
| 🔴 **EL QUE DECIDE** | 1+9 → muestra **10**, tasa **10 %**, alerta **activa** |
| 🔴 **la tasa por plantilla** | el mismo agujero, en la misma tarjeta: 100 → **10** |
| ✅ **POSITIVO** | 20/10 sigue en 50 % y sigue alertando |
| ✅ **NEGATIVO** | todo entregado sigue en 100 % **sin** alerta |
| ⛔ **LA QUE NO SE PUEDE MOVER** | `month.sent` sigue en 1 y `month.failed` en 9 |
| — | sin mensajes la tasa es `null`, no un 0 % inventado |
| 🔴 **MUTACIÓN** | sacar el fallo del denominador devuelve el 100 % mentiroso: **CAE**, y se comprobó que **ENTRÓ en `dist/`** antes de creerse el rojo. Fuente y `dist/` restaurados `IDÉNTICO` |

**7/7 · `# skipped 0`.** Y [SCRUM-530](SCRUM-530.md), que depende de esto, sigue **7/7**.

## 5 · 🔴 Un falso «no compila» de mi propio arnés

La primera pasada de la mutación dijo **«no compila»** y **«la mutación NO entró»**. Era mentira:
llamaba a `npm run build` con `execFileSync` **sin shell**, y en Windows `npm` es un `.cmd` que
así no se ejecuta. El código estaba perfectamente. Lo cazó el comprobador de *«¿entró?»*, que está
puesto exactamente para eso — una mutación que no entra y una cobertura que no existe dan la misma
salida. Repetido invocando `tsc` con node sobre su `bin`, sin shell, y con **suelo del arnés**:
se comprueba que el build limpio sale 0 antes de creerse nada.

## 6 · Lo que NO se ha tocado

`SENT_OR_MORE` y `DELIVERED_OR_MORE` (los conjuntos siguen exactamente igual) · `aggregateWaRows`
y los KPI del mes · el umbral de muestra ni el del 90 % · el aviso de muestra corta de SCRUM-530 ·
`prisma/schema.prisma` · el camino de emisión · ningún literal de microcopy · ninguna plantilla de
WhatsApp. Ninguna base real, ninguna clave, ni un byte hacia Meta.

## 7 · 🔴 LA TANDA COMPLETA NO TERMINÓ — y eso se nombra, no se redondea

```
ARRANQUE .................. 2026-09-16T04:21:04.349Z   (concurrencia 1, tope duro 45 min)
ultimo byte del TAP ....... 2026-09-16T05:05:19.609Z   (1.484.298 bytes)
ultimo fichero nombrado ... scrum764-margen-negativo.test.mjs
minutos ................... 45 (tope) · salida 124
recuento al corte ......... ok 6032 · not ok 0
```

> **LA TANDA COMPLETA NO TERMINÓ.** «ok 6032 · not ok 0» **no es un verde**: es *cero fallos entre
> los 6.032 que llegaron a correr*. Y **mis propios tests no están entre ellos**: el corte quedó en
> `scrum764`, antes de `scrum862` por orden alfabético. Lo que no corrió no sale por ninguna parte.

⚠️ **Dato para [SCRUM-858](SCRUM-858.md), que se apunta y no se investiga (otro carril):** la misma
suite, en la misma máquina y con la misma invocación, **terminó en 18 minutos hace una hora**
(SCRUM-530, 6.865 tests) y **no cabe en 45 ahora**. No es un cuelgue —el TAP se estaba escribiendo
en el segundo del corte, igual que el caso del 15-sep— sino una **variabilidad de más del doble**.
Son tres muestras ya: 18 min completa · 35 min completa · 45 min sin terminar.

### Lo que SÍ se corrió entero, y es lo que decide este ticket

```
scrum862 + scrum530 + scrum402 + scrum755 + scrum854 + scrum236
# tests 40 · # pass 40 · # fail 0 · # skipped 0
```

Son el fichero del ticket, **el que depende de él** (SCRUM-530, la alerta que lo consume), **los
dos trinquetes de marcadores que me cazaron ayer**, el guard de rama-ticket y el del embudo, que
es el otro consumidor de la misma tarjeta. Más `npm run guards:entrada`: **26 tests · 26 pass ·
0 fail · 0 skipped**. Y `tsc` con salida **0**.

**Lo que NO puedo afirmar:** que la suite entera esté verde con este cambio. No se ha medido.
