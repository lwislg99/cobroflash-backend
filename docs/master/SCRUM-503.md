# SCRUM-503 · `desconocido` deja de leerse como un error: es una respuesta, no un valor roto

**Medido contra:** `origin/main` = `3ddd2d2ea3c462c73bea97a90ec17c68a8da7915` · 2026-08-12T14:07:22+02:00

**12-ago-2026** · **Carril:** Cobros / Informes · **Gate:** sin gate, corre en `npm test`

**LA VÍCTIMA:** el sistema declara que no consta cómo entró el dinero —que es lo correcto— y la
pantalla le contesta al profesional «⚠️ Método no reconocido (desconocido)»: que no entendemos
nuestra propia declaración, con el valor crudo de la base delante.

---

## ① EL PASO 0 · ¿hay víctima? — la pregunta que podía tumbar el ticket

`main` se movió tres veces durante el trabajo (`01025aaf` → `91b519e1` → `3b30191b` → `3ddd2d2e`;
en la tercera entró **SCRUM-499**, del que este ticket depende). La línea base se re-midió después
del último merge.

### 🔴 SÍ hay productor: DOS caminos vivos escriben `desconocido` hoy

Sin escritor no habría víctima y el ticket se caería (regla 37). Medido con **dos instrumentos**:

| instrumento | qué encontró |
|---|---|
| **qué devuelven** (funciones de `dist`) | `metodoDesdePreferencia('mp')` → `desconocido` · `metodoDesdeMercadoPago(null)` → `desconocido` |
| **quién las LLAMA** (AST, autoprobado) | `charges.routes.ts:44` y `integrations/mercadopago.ts:89` — las dos con llamada real, no solo importación |
| control positivo del detector | ve `metodoDesdePreferencia(p)` y **rechaza** un `import` sin llamada |

Los dos son deliberados y recientes: **MercadoPago es una PASARELA, no un método**, y al CREAR el
cobro nadie sabe todavía con qué pagará el cliente (SCRUM-486); y MP puede no mandar
`payment_type_id` (SCRUM-489). En los dos casos declarar que no consta es lo correcto — inventar
«suele ser tarjeta» es lo que la regla 22 prohíbe.

### ⚠️ Pero la víctima NO es la del enunciado, y conviene saberlo

El encargo decía «le preguntamos al profesional cómo entró el dinero y contesta que no lo sabe».
**Medido: el selector NO escribe `desconocido`.** Su opción «Sin especificar» devuelve `null` a
propósito (`selectorMetodoCobro.js:82`: *«No se devuelve `''` ni `'desconocido'`… "desconocido", que
sería haber preguntado y no saberlo»*), y `null` es AUSENCIA.

Así que la víctima real es **«el cobro nació en una pasarela que todavía no sabía con qué se iba a
pagar»**. El texto aprobado encaja igual de bien, pero deja una asimetría que hay que decir:

| lo que ve el profesional | lo que se guarda | cómo se lee en Informes |
|---|---|---|
| elige **«Sin especificar»** en el selector | `null` | «⚠️ **Sin método**» |
| no elige nada: lo declara la pasarela | `desconocido` | «⚠️ **Método sin especificar**» |

Los dos textos dicen la verdad y ninguno se contradice, pero **el que se parece al rótulo del
selector es el que el selector NO produce**. Unificarlo es microcopy (regla 30) y no se toca aquí.

### Nadie lo había añadido ya

`git grep` sobre `main`: cero apariciones de la clave en `paidViaEtiquetas.js` y en `paidVia.ts`.
`git log --all -S` sobre `desconocido: '⚠️` y sobre `Método sin especificar`: **cero commits en
todas las refs** — con control positivo del pickaxe, que sí devuelve los dos commits que han tocado
`ETIQUETAS_HEREDADAS`. Ninguna rama relacionada.

---

## ② QUÉ SE CONSTRUYE — una línea, y dónde va importa

```js
desconocido: '⚠️ Método sin especificar',      // en ETIQUETAS_HEREDADAS
```

**Va en los HEREDADOS y no en el conjunto cerrado**, y no es un detalle de colocación:
`desconocido` **no está en `PAID_VIA`** —`esMetodoValido` lo devuelve `false` adrede— y ampliarlo
sería cambio de la regla 22. Meterlo arriba habría tumbado el guard de SCRUM-398, que exige que las
claves de (1) sean **exactamente** las del conjunto. Encaja además con la definición de (2): un valor
que la base ya tiene escrito y que el conjunto no nombra, **con su procedencia escrita**.

**🔴 EL GUARD DE SCRUM-398 SIGUE VERDE, 8 de 8, sin tocarlo.** Era el STOP 2 y no se ha dado.

### Los TRES estados, y por qué no pueden compartir salida

| estado | qué significa | cómo se lee |
|---|---|---|
| `null`, `''`, ausente | nadie registró nada | «⚠️ Sin método» *(ya existía)* |
| `desconocido` | **se preguntó y consta que no se sabe** | «⚠️ Método sin especificar» *(nuevo)* |
| fuera de `PAID_VIA` | alguien escribió algo que no existe | «⚠️ Método no reconocido (x)» *(intacto)* |

El tercero **se queda exactamente como estaba**: es un defecto real, tiene que verse como tal y con
su valor dentro para poder investigarlo (SCRUM-398). Y ausencia y `desconocido` no son lo mismo: en
el segundo **SÍ hay constancia**, y lo que consta es que no se sabe — la misma distinción que separó
el MÉTODO del REGISTRO en SCRUM-491.

---

## ③ 🔴 LA PANTALLA, MEDIDA PINTADA

Banco de un solo uso con `reportsView.js` y `paidViaEtiquetas.js` **reales** y el `loadX2` de
verdad; el ANTES se obtiene quitando la entrada de la copia en memoria, así que las dos capturas
salen del MISMO código. Evidencia: `docs/master/evidencias/scrum503/scrum503-tres-estados.png`.

| ANTES | € | cobros | | DESPUÉS | € | cobros |
|---|---|---|---|---|---|---|
| 💳 Tarjeta | 1.200,00 | 1 | → | 💳 Tarjeta | 1.200,00 | 1 |
| **⚠️ Método no reconocido (desconocido)** | 600,00 | 2 | → | **⚠️ Método sin especificar** | 600,00 | 2 |
| ⚠️ Sin método | 90,00 | 1 | → | ⚠️ Sin método | 90,00 | 1 |
| ⚠️ Método no reconocido (sepa_instantanea_x) | 55,00 | 1 | → | ⚠️ Método no reconocido (sepa_instantanea_x) | 55,00 | 1 |

**Mismas filas, mismos importes, mismo nº de cobros**: un rótulo no mueve dinero. Y el pie de
SCRUM-499 sigue diciendo «Marcados a mano: 3 cobros · 405,00 €» en los dos.

🔸 Ninguna caja desborda. La etiqueta nueva mide **25** unidades UTF-16 contra las **37** del «no
reconocido (desconocido)» que sustituye, así que la caja mejora; el techo aprobado sigue siendo el
de «📲 Bizum (confirmado a mano)» (28) y el guard de SCRUM-488 ⑥ no se mueve.

---

## ④ VERIFICACIÓN

* **SUELO** — se leen el diccionario, el conjunto y los tres estados; si el corpus encoge, el
  fichero **se declara ciego** en vez de comparar de menos.
* **DOS INSTRUMENTOS para la víctima** (①), cada uno diciendo lo suyo: qué devuelven las funciones,
  y **quién las llama** por AST — *mencionar no es hacer*: un productor sin llamante no produce nada.
  El detector se autoprueba y **rechaza una importación sin llamada**.
* **CONTROL POSITIVO** — el texto aprobado, comparado **literal**; y no solo en el diccionario:
  **llega a la fila del informe** por el camino de verdad (`filasDelInforme`). Que un mapa tenga la
  clave no prueba que la pantalla pase por ella.
* **🔴 CONTROL NEGATIVO, el que decide** — los tres estados se comprueban uno a uno **y además** se
  exige que sus tres salidas sean **distintas entre sí**. Si dos comparten línea se ha perdido un
  hecho, y el que se pierde siempre es el del medio: «se preguntó y no consta» se parece a los otros
  dos y no es ninguno.
* **LAS TRES PANTALLAS leen el mismo valor** por `metodoDeUnCobro` (SCRUM-499), cada una por su
  puerta real: `filasDelInforme`, `fundirCobros` y la cadena del HTML de la disputa.
* **🔴 EL PAQUETE DE DISPUTA NO TRADUCE, comprobado** — ahí el valor va CRUDO porque es prueba ante
  un banco (SCRUM-499). Hay dos asertos: que lo que se pinta **no** es el rótulo, y que el fichero
  no ha empezado a usar el vocabulario de la pantalla. Si esto cambiara, se habría roto la prueba.
* **EL INVARIANTE** — total, importe, nº de cobros, cubos y el pie de SCRUM-499, idénticos antes y
  después, con control positivo dentro (mínimo de filas antes de creerse la igualdad).
* **ROJO POR EL MECANISMO** — ⑤.

---

## ⑤ 🔴 EL ROJO POR EL MECANISMO, y la mutación que hubo que rehacer

Con la rama **ya en verde y commiteada** (`3292eeb5`).

**El primer intento no valió, y se dice**: borrar la línea con una expresión regular se llevó por
delante el `};` de cierre del objeto —quedó dentro de un comentario— y **rompió la sintaxis del
fichero**. Un fichero roto no mide el defecto que se quiere medir: mide otra cosa. Se deshizo con
`git stash` (nunca `git checkout --`), se comprobó la post-condición —el fichero volvía a dar sus 8
tests en verde— y se rehízo **sobre el valor de la clave**, que es una mutación limpia y con
post-condición legible (`git diff --stat` → 1 línea).

| mutación | qué cae |
|---|---|
| la clave deja de coincidir (`desconocido` → `desconocido_MUTADO`) | **4 tests**: el control positivo, los tres estados, el rojo por mecanismo y el censo de SCRUM-488 |

El mensaje, literal:

```
🔴 la pantalla dice «⚠️ Método no reconocido (desconocido)» de una respuesta que el sistema
declaró a propósito. El texto está aprobado (regla 30) y se compara literal.

🔴 «"desconocido"» (desconocido declarado) se lee «⚠️ Método no reconocido (desconocido)»,
que no es la línea de su estado.
```

**Control negativo del experimento:** el guard de SCRUM-398 sigue **verde** con la mutación puesta —
no tiene por qué detectar esto: vigila el conjunto cerrado, no los heredados.

🔸 Y dentro del propio test hay un rojo *sin tocar el disco*: se borra la entrada de una **copia en
memoria** del mapa y se restaura en `finally`, comprobando después que el diccionario volvió a su
sitio para que el resto de la tanda no mida un mapa envenenado.

---

## ⑥ El censo de SCRUM-488 sube de 4 a 5, y eso es lo que tiene que pasar

Su guard cayó pidiendo re-medición, que es justo para lo que existe. Ahora `desconocido` es la
quinta divergencia declarada:

```
desconocido    COBROS «Método no registrado»  ·  INFORMES «⚠️ Método sin especificar»
```

🔴 **Y no es de grafía.** Informes ya distingue «se preguntó y no consta» de «nadie registró nada»;
**Cobros no**: mete el desconocido en el cubo `sin-metodo` y lo llama «Método no registrado», que
afirma la ausencia. O sea que Cobros **borra justo la distinción que este ticket hace**. Arreglarlo
pide un rótulo nuevo en el vocabulario de Cobros → microcopy, la aprueba el asesor. Queda declarado
en el censo y aquí, no escondido.

## ⑦ Ficheros

* `public/dashboard/js/paidViaEtiquetas.js` — **una entrada**, con su procedencia y quién la escribe.
* `tests/scrum503-desconocido-no-es-error.test.mjs` (**nuevo, 8 tests**).
* `tests/scrum488-un-solo-vocabulario.test.mjs` — el censo re-medido con su motivo.
* `docs/master/evidencias/scrum503/scrum503-tres-estados.png`.

**Lo que NO se toca:** `prisma/schema.prisma` · `PAID_VIA` (no se amplía: regla 22) · la agrupación
por cubo de SCRUM-488 · el pie de SCRUM-499 · el paquete de evidencia de disputa · ninguna otra
entrada del diccionario.

## ⑧ Verificación de la tanda

Con `main` (`3ddd2d2e`) dentro, `npx prisma generate` y `dist/` reconstruido **en este worktree**, y
la tanda lanzada **después del último cambio de código y de la última edición de este documento**.

| | ficheros | tests | pass | fail | skipped |
|---|---|---|---|---|---|
| **línea base** (el conjunto que declara `main`, sobre este árbol) | 456 | **3.508** | **3.431** | **0** | **77** |
| **después** (tanda entera, `npm test`) | 457 | **3.516** | **3.439** | **0** | **77** |
| diferencia | +1 | **+8** | **+8** | **0** | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fallos**.
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.
* El test de SCRUM-488 que se modificó no cambia el recuento: es el mismo, con el censo re-medido.

## ⑨ Huecos DECLARADOS

* **No se ha verificado en `yaqu.app`**: sin desplegar —el merge lo hace un humano—. Lo que hay es
  la pantalla pintada en banco de un solo uso con los ficheros reales de `public/`, y `fmtMoneyEs`
  sustituido por un `Intl.NumberFormat` equivalente porque `api.js` no se puede cargar suelto.
* **Cuántos cobros tienen `desconocido` hoy en producción: NO SE HA CONTADO.** Pide una consulta
  contra la base y no es de este carril. Lo que sí consta es que los dos escritores están vivos y
  con llamante.
* **Cobros sigue sin distinguir el desconocido de la ausencia** (⑥). Es microcopy.

## ⑩ Fuera de carril (una línea cada uno)

* **`card:paypal` se lee distinto según por dónde se mire**, y es coherente pero conviene saberlo:
  `cuboDeCobro` SÍ parte por «:» y lo agrupa en `card` —la pasarela es libre (SCRUM-474)—, mientras
  que el diccionario NO parte y su etiqueta suelta dice «no reconocido»; en el informe esa fila
  viaja con el representante del cubo y se lee «💳 Tarjeta». Medido y atado en el test.
* Sigue en el árbol el fichero suelto **`how f11e445e`** (502 bytes, 12:37, salida de un `git show`
  con commits de SCRUM-496), ya reportado en SCRUM-499. No es de este carril y no se toca.
* Hay un **`git stash` de otra rama** sin recoger: `stash@{0}: On scrum-411-alcance-desde-entradas:
  reversion temporal para medir la linea base (recuperable)`. No es mío y no se toca.
