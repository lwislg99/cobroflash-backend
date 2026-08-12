# SCRUM-485 · «Bórrame la cuenta»: la distancia entre lo que se promete, lo que hay y lo que llega

**Medido contra:** `origin/main` = `75b2b01820f71bdb1bf2b3244b19f801d69e24f6` · 2026-08-12T10:14:30+02:00
**Medido en:** host `DESKTOP-T5MONF5` · **Mido, no construyo.** Cero schema, cero emisión, y **ni una
coma de las páginas legales**.

---

## 🔴 Lo primero, porque corrige la premisa del encargo (y la mía de ayer)

El encargo dice: *«un profesional no puede pedir que le borren la cuenta, y lo prometemos por escrito
en la página de privacidad»*. **Medido: las dos mitades son más matizadas.**

1. **`borrarMerchant` sigue con CERO llamadores** — confirmado con dos instrumentos —, pero **no está
   olvidado: está SUPERADO.** La supresión real la hace **otra función**, `suprimirMerchant`, que sí
   tiene ruta montada. Mi hallazgo de SCRUM-484 sigue siendo cierto y **su interpretación cambia**:
   la imposibilidad del profesional **no viene de ese huérfano**.
2. **La página NO promete un botón.** Promete un **correo**. Así que la promesa que hay que medir no
   es «self-service» sino «escríbenos y lo atendemos».

## Los dos instrumentos sobre la ausencia de llamadores

| instrumento | resultado |
|---|---|
| **AST por export** (`_alcance-dominio.mjs`, SCRUM-411) | `borrarMerchant` es **export huérfano** dentro de un módulo vivo |
| **Barrido de texto en TODO el repo** (cubre el `const { X } = await import(…)`, que es mi límite medido en SCRUM-484) | **ninguna llamada**: 11 apariciones y **todas** son documentación (`docs/master/…`) o **un comentario** en `supresion.routes.ts:3` |

⚠️ **Y el comentario casi me engaña**: `supresion.routes.ts` **nombra** `borrarMerchant` en su
cabecera para explicar por qué existe. Un barrido de texto sin mirar la línea lo habría contado como
llamador y **habría cerrado el ticket en falso**. Es la trampa de la casa otra vez: el nombre no es
el hecho.

---

# LA TABLA · las tres cosas y su distancia

### 1 · Qué hace EXACTAMENTE el motor — **derivado del código, no del nombre**

**`suprimirMerchant`** (`system/domain/supresionMerchant.service.ts`) **ANONIMIZA. No borra.**

* Quita los datos personales del merchant **y los de sus clientes** (`CAMPOS_PERSONALES`,
  `planDeAnonimizado`, `redaccionesPara`), por `updateMany` — **no hay `delete`**.
* **Conserva el asiento**, citando **art. 17.3.b RGPD** (decisión del fundador, 10-ago-2026).
* Deja rastro: escribe `action: 'merchant_anonimizado'` en `auditLog` con el actor y lo `conservado`.
* Tiene una lista de **intocables** (`tocaIntocables`) para no pisar lo que debe conservarse.

**`borrarMerchant`** (`system/domain/borradoMerchant.ts`) es el **anterior**: ése sí borraba la fila
del merchant. **Quedó sin llamadores cuando la decisión ③ de SCRUM-244 mandó anonimizar en vez de
borrar.** No es un cable que falte: es un motor **sustituido** que sigue en el árbol.

### 2 · Qué promete LITERALMENTE `public/privacidad.html` — **cita, no resumen**

> **§7. Tus derechos** — «Tienes derecho a acceder, rectificar, eliminar, limitar u oponerte al
> tratamiento de tus datos, así como a la portabilidad. **Para ejercerlos escríbenos a
> hola@yaqu.app.** Si consideras que no hemos atendido tu solicitud correctamente, puedes reclamar
> ante la **Agencia Española de Protección de Datos (AEPD)**, www.aepd.es.»

> **§6. Conservación** — «Conservamos los datos de tu cuenta mientras esté activa. Los datos de
> facturación y demás documentación mercantil se conservan durante el plazo legal (con carácter
> general, **6 años** desde su fecha, conforme al **artículo 30 del Código de Comercio**, sin
> perjuicio de plazos fiscales adicionales). La evidencia de firma se conserva mientras pueda ser
> relevante para acreditar la operación correspondiente. **Puedes solicitar la eliminación de tu
> cuenta en cualquier momento, sin perjuicio de lo que debamos retener por obligación legal.**»

**La página es más cuidadosa de lo que el ticket suponía:** ya dice «sin perjuicio de lo que debamos
retener por obligación legal», que es exactamente lo que el motor hace. **No promete borrado total ni
promete un botón.**

**Lo que NO dice, comprobado con control positivo** (el mismo barrido encuentra 19 apariciones de
«derecho/datos», así que estaba leyendo el fichero): **ningún PLAZO DE RESPUESTA a la solicitud.** El
único plazo que aparece es el de **conservación**, que es otra cosa.

### 3 · Qué hay hoy en Configuración › Tus datos

**Nada propio.** `public/dashboard/js/settingsSubmenus.js:246`, en su propio comentario:

> «Lo que NO ha cambiado: «Tus datos» sigue sin contenido PROPIO. Portabilidad y borrar cuenta no…»

Y el barrido sobre `public/`: **ninguna pantalla llama a `/admin/supresion`.**

### La distancia, en una tabla

| | promete la página | hay de verdad | distancia |
|---|---|---|---|
| **canal** | escribir a `hola@yaqu.app` | correo | **cero.** No promete botón, y no hay botón |
| **qué se suprime** | «eliminar», con la salvedad de la obligación legal | **anonimiza y conserva el asiento** (art. 17.3.b) | **coherente sobre el papel** — quién decide si «anonimizar» satisface «eliminar» es dictamen, no producto |
| **quién lo ejecuta** | «nosotros» | `POST /admin/supresion/:merchantId`, **admin-only**, **tras `MERCHANT_DELETE_ENABLED` = `false`** (`core/flags.ts:34`) → **la ruta responde 404** | 🔴 **hoy no lo puede ejecutar nadie**, ni el fundador por la ruta: está construida y apagada |
| **plazo de respuesta** | **no se promete ninguno** | `portabilidadRegistro.ts` tiene `PLAZO_MESES`, `fechaLimite` y `solicitudesPendientes`… **y los tres son exports huérfanos** (SCRUM-484) | 🔴 **nadie puede ver si una solicitud se atendió dentro de plazo** |
| **superficie** | — | «Tus datos» sin contenido propio | motor + ruta **sin pantalla** |

> **El resumen honesto:** no hay una promesa incumplida en el texto. Hay **un mecanismo construido y
> apagado**, **sin pantalla**, y **sin forma de acreditar que una solicitud se atendió a tiempo** —
> que es justo lo que el §7 invita a reclamar ante la AEPD.

---

## 🔴 La pregunta para el asesor — redactada, **sin contestar**

> Cuando un profesional nos pide que borremos su cuenta, **no podemos borrarlo todo**: sus facturas
> emitidas hay que conservarlas (art. 30 del Código de Comercio, 6 años, más plazos fiscales), y
> nuestro propio sistema no permite editar ni borrar una factura emitida. Lo que hacemos hoy es
> **anonimizar**: quitamos sus datos personales y los de sus clientes, y conservamos el asiento
> contable, al amparo del art. 17.3.b RGPD.
>
> **①** ¿Es correcto que **anonimizar conservando el asiento** sea nuestra respuesta a una solicitud
> de supresión, o hay algo que sí debamos borrar de verdad?
> **②** De lo que conservamos, **¿qué campos exactamente** están amparados por la obligación legal y
> **cuáles no** deberíamos seguir guardando? (Hoy la decisión de qué es «intocable» la tomamos
> nosotros.)
> **③** ¿**Cuánto tiempo** conservamos lo anonimizado, y qué pasa al cumplirse el plazo?
> **④** ¿Qué **plazo de respuesta** debemos comprometer en la política —y por tanto medir— desde que
> alguien escribe a `hola@yaqu.app`?
> **⑤** ¿Y respecto a los **clientes finales** del profesional, sobre los que él es el responsable y
> nosotros encargados: su solicitud nos llega a través de él, o también directamente?

⚠️ **No contesto ninguna.** Una factura emitida no se borra (regla 29), así que «bórrame la cuenta»
no puede significar «bórralo todo» — y **dónde está exactamente esa raya es dictamen**.

---

## Lo que NO se ha hecho

**No he construido el borrado**, no he tocado el flag, **no he tocado una coma de `privacidad.html`
ni de ninguna página legal**, cero schema, cero emisión. **No he retirado `borrarMerchant`**: que un
motor sustituido siga en el árbol es una decisión, y de ella sale un ticket, no un `git rm` mío.

---

# SCRUM-485 · SEGUNDA ENTREGA · la retirada que PARO, y el primer paso sobre los 189


## 🛑 1 · NO he retirado `borrarMerchant`, y el motivo es nuevo

La decisión estaba tomada y era mía de proponer. **Al ejecutarla apareció algo que no estaba sobre
la mesa cuando se decidió**, así que paro antes de un borrado irreversible:

**`borrarMerchant` es el SUJETO EJECUTABLE de dos guards**, no solo del control de SCRUM-411:

| guard | qué verifica **ejecutándolo** |
|---|---|
| `tests/scrum192-borrado-merchant.test.mjs` (4 llamadas) | *«borra en el ORDEN declarado, no en otro»* — corre la función contra un `prisma` falso y comprueba la secuencia |
| `tests/scrum244-colgados-de-otro-modelo.test.mjs` (2 llamadas) | *«`reconciliation` se borra, y ANTES que sus charges»* — el orden que impide que la FK RESTRICT tumbe el borrado |
| `tests/scrum411-exports-inalcanzables.test.mjs` | el control «un módulo vivo por una CONSTANTE esconde una función muerta» |

**Cero llamadores en producción sigue siendo cierto.** Lo que cambia es la etiqueta: **no es código
muerto, es la especificación EJECUTABLE del orden de borrado seguro para las claves ajenas.** Y
`suprimirMerchant` **no puede heredar esos guards**: anonimiza con `updateMany`, no borra, así que no
tiene orden de borrado que verificar.

**Si se retira, se retira con ella la única comprobación de ese orden** — y ese orden es lo que hace
que un borrado real no falle a mitad dejando datos personales dentro.

### Las tres salidas, para que decidas con esto delante

1. **Se queda, reclasificado** — no como «muerto», sino como *especificación ejecutable sin
   superficie*. Cuesta cero y conserva la comprobación. **Es lo que recomiendo.**
2. **Se retira y se retiran los dos guards** — se pierde la verificación del orden de borrado.
3. **Se retira y se reescriben 192/244** contra otro sujeto. Hoy no existe: nada más borra.

⚠️ Y el control de 411 habría que mudarlo en cualquier caso a otro ejemplo con la misma forma
(módulo vivo + función huérfana): `team.service.ts → listTeamMembers` sirve. **No lo he tocado**: es
el guard de otra sesión y solo se muda si se retira la función.

---

## 2 · Los 189, primer paso DERIVADO — y lo que NO he hecho

**El criterio duro del encargo aplicado a máquina:** *deliberado solo si su motivo está ESCRITO*. Se
busca en el fichero de cada export si consta un motivo con las frases de la casa (`no lo llama
nadie`, `deliberado`, `a propósito`, `STOP`, `regla 24/38`, `espera schema/migración/dictamen`,
`entrega parcial`, `no se enciende`, `flag`…).

| | exports | módulos |
|---|---|---|
| **con MOTIVO ESCRITO** en su fichero | **131** | 43 |
| **SIN motivo escrito** → candidatos a **OLVIDO** | **59** | 23 |
| **total** | **190** | 66 |

**Aritmética comprobada por el propio instrumento: 131 + 59 = 190. CUADRA.** (190 incluye el falso
positivo medido en SCRUM-484 — `sendQuoteEmail` —, así que los reales son **189**.)

### 🔴 Lo que esto NO es

**No es la clasificación en las cinco clases.** He derivado la **primera bifurcación** —la que tu
criterio duro convierte en mecánica— y **no he leído uno por uno los 183 restantes**. Clasificados a
mano hasta hoy: **8 módulos enteros** (SCRUM-484) y **6 exports** (SCRUM-484) + el de supresión
(SCRUM-485). **El resto sigue sin leer, y lo digo con el número.**

Una clasificación que pareciera completa sin serlo es peor que ésta: por eso va el recuento exacto.

### Los 23 módulos sin motivo escrito — los que más pesan

| exports | módulo |
|---|---|
| 6 | `jobs/domain/albaranContenidoFuentes.ts` · `messaging/domain/whatsappLog.service.ts` |
| 5 | `auth/domain/entornoApp.service.ts` · `jobs/domain/pendientesFacturar.service.ts` · `system/domain/qrPagina.service.ts` |
| 3 | `billing/domain/fechaDeCobro.ts` · `billing/domain/metodoDeCobro.ts` · `system/domain/importarClientes.service.ts` |

⚠️ **«Sin motivo escrito» no es «olvido» todavía**: es *candidato*. Un módulo puede tener su motivo
en su entrada de máster y no en el fichero — y esa distinción hay que leerla, no derivarla. Lo que
sí afirma la máquina es dónde **no** está escrito **en el sitio donde lo leería quien toca el
fichero**, que es la mitad que importa.

---

## Los límites, otra vez declarados (se arrastran de SCRUM-484)

* `nombresImportados` solo lee imports **estáticos**: un `const { X } = await import(…)` no ata el
  nombre. **Acotado: 1 falso positivo, nombrado.**
* `import * as x` da el módulo por vivo entero → **189 es SUELO, no techo.**
* El **frontend vanilla** no entra en el grafo.
* **Y el nuevo, de Javier, aplicado:** las categorías suman su total, y la suma la hace el
  instrumento, no yo.

## Lo que NO se ha hecho

No he retirado `borrarMerchant` (paro declarado arriba), no he tocado los guards de 192, 244 ni 411,
no he encendido ningún flag, cero schema, cero emisión.
