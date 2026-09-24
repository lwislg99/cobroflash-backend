# SCRUM-926 · DUPLICAR NO PUEDE PERDER LO QUE COBRA

**Carril:** S2 (panel) · **Rama:** `scrum-926-duplicar-conserva` · **Banco:** `scripts/guard-duplicar-926.mjs`
**Medido contra:** `origin/main` = `79061a9b6890c5f214695dd6614fe26836be5459` · 2026-09-20T13:34:59Z

El **rojo** de más abajo se midió contra `17a1ec5736dabd19e2638c2d3a3cc17fcc88a02b`, que era
`origin/main` al empezar; el árbol final es el de arriba, con `main` mergeado, y sobre él se
volvieron a correr el guard (9/9) y el contador de `scrum522` (30, remedido tras el merge).

---

## PASO 0 · el defecto existe HOY, y se corrió antes de escribir una línea

La sonda que dejó escrita la sesión anterior **nunca se había corrido**. Se corrió: arranca
(TESTIGO impreso), declara POBLACIÓN 2 casos, carga las 2 líneas en los dos y no deja errores de
página. Duplicando un presupuesto con 25 € de descuento global, el editor abre con el campo
**vacío y cerrado**. El defecto es real.

## Lo que cambió el reparto: un comentario caducado mandaba el ticket al carril equivocado

`quotesDetailView.js` llevaba este aviso:

> ⚠️ EL DESCUENTO GLOBAL … Hoy `GET /admin/quotes/:id` NO lo devuelve (medido en staging
> `e437a51f`, 17-sep-2026): hasta que lo mande el servidor, …

Leído en frío, eso convierte 926 en un ticket de servidor. **Se fechó con `git log -L` en vez de
creérselo**, y el resultado es que el aviso estaba muerto:

| qué | commit | cuándo |
|---|---|---|
| se escribe el aviso «el servidor no lo manda» | `8e1b8e9f` (SCRUM-888) | **17-sep 12:42** |
| el servidor empieza a mandarlo (`quoteAdmin.ts:239`) | `0035fcb9` (SCRUM-888d) | **17-sep 15:54** |

**Tres horas y doce minutos**, el mismo día, y nadie volvió a borrar el aviso. Dos días después
seguía ahí, listo para mandar a la siguiente sesión a pedirle al servidor algo que ya hacía. El
aviso se ha sustituido por lo que hoy es verdad, con la fecha dentro.

    🔒 Un aviso caducado en el código es peor que ninguno: el que no está no engaña a nadie.
       Un comentario que dice «hasta que X» tiene que morir el día que X ocurre.

O sea: **926 es front entero.** No había nada que repartirle al carril de servidor.

## El alcance real: CUATRO campos viajaban, DOS se pueden arreglar

`duplicateQuote` arma la copia con `name`, `currency`, `lines`, `tiers` y `paymentTerms`. Medido
campo a campo, no supuesto:

| campo | ¿viaja en la copia? | ¿lo restaura el editor? | veredicto |
|---|---|---|---|
| `lines` | sí | **sí** | ya funcionaba |
| `name` | sí | sí (en el aviso «Plantilla … cargada») | ya funcionaba |
| `discountGlobalAmount` | **NO llegaba a viajar** | no | **arreglado: las dos mitades** |
| `paymentTerms` | sí | **no** | **arreglado: faltaba la mitad del editor** |
| `tiers` | sí | no | **no arreglable aquí:** `quotesView.js` **no nombra `tiers` ni una vez**. El editor no tiene tramos: no hay campo que restaurar |
| `currency` | sí | no | **no hace falta:** el editor no tiene selector de moneda, usa `currentMerchant.defaultCurrency \|\| 'EUR'` |

⚠️ **Esto corrige a la baja lo que esta sesión había dicho antes.** Se habló de «otros tres
campos»; medido, los que tienen dónde restaurarse son **dos**. `tiers` y `currency` se declaran
aquí en vez de fingir que se arreglan.

**`tiers` es un LÍMITE DECLARADO, y a propósito no lleva ticket** (decisión del orquestador,
20-sep): un ticket que nadie puede coger es ruido, porque no hay editor de tramos donde
restaurarlo. Queda anotado aquí y remitido a **SCRUM-37** (el editor de tramos): el día que el
editor tenga tramos, esto ya está escrito — **la copia YA los trae y el editor los tira**, así que
ese trabajo se lleva medio arreglo hecho y la otra mitad identificada.

## El arreglo, dos mitades y quince líneas

1. **`quotesDetailView.js`** · la copia lleva `discountGlobalAmount: detail.discountGlobalAmount ?? null`.
   `??` y no `||`: un descuento de **0** es una decisión escrita, no «no hay descuento».
2. **`quotesView.js`** · al cargar una plantilla se restauran el global —con **el mismo gesto que
   ya usaba el borrador** (`loadDraft`): poner el importe y **ABRIR** su campo— y las condiciones
   de pago. No se inventa un patrón nuevo para algo que la pantalla ya sabía hacer.

Que el campo quede **abierto** no es cosmético: un importe detrás de un botón cerrado es un
descuento que nadie ve, y es la misma regla (CONT-01) que ya obligó en SCRUM-888c.

## Verificado en rojo, y cada campo con SU rojo

Banco commiteado **antes** de tocar el código (`be641ae7`), y el árbol entero commiteado antes de
cada inyección (`b951a73c`), con el `git diff --numstat` impreso al lado de cada una.

**① En `main`, con el banco nuevo y el código sin tocar:** caen **3 de 9** casillas — las dos del
descuento global y la de condiciones de pago. Las otras 6 verdes son el suelo y los controles.

**② Por mutación sobre el código ya arreglado**, una mitad cada vez:

| mutación | `--numstat` | qué cae |
|---|---|---|
| M1 · la copia vuelve a no llevar `discountGlobalAmount` | `0 1 quotesDetailView.js` | **solo** las 2 casillas del global (P sigue verde) |
| M2 · el editor vuelve a no restaurar `paymentTerms` | `0 1 quotesView.js` | **solo** la casilla de cobro (las 2 de G siguen verdes) |

Revertidas con `git restore --source=HEAD` y `git status --porcelain` vacío las dos veces: **9/9**.
Cada mitad del arreglo está anclada a sus propias casillas, que es lo que impide que un test del
descuento se dé por bueno para el cobro.

## Los controles, que son la mitad que decide

Un campo vacío y un lector que no sabe mirar ese campo **se leen exactamente igual**. Por eso cada
campo lleva su control positivo **en la misma pantalla**:

* **POSITIVO G** · se abre el campo a mano y se teclea 25 → el lector lo ve («25», abierto).
* **POSITIVO P** · se pone `FIFTY_FIFTY` a mano en el desplegable → el lector lo ve.
* **CONTROL DEL CASO P** · `FIFTY_FIFTY` **no** es el valor de nacimiento del editor.

Este último no es adorno. El editor **nace en `FULL_UPFRONT`** (`quotesView.js`), así que un caso
escrito con `FULL_UPFRONT` habría salido **verde sin que nadie restaurara nada**: verde por
coincidencia. Es la trampa que la ficha de esta sesión ya tiene escrita —«lo que funciona por
casualidad se rompe el día que alguien hace lo correcto»— y aquí habría funcionado al revés: lo
roto se habría leído como bueno.

    🔒 Un caso de prueba cuyo valor coincide con el valor de NACIMIENTO de la pantalla sale verde
       aunque nadie restaure nada.

Es la misma familia que el contador que nunca se ha visto disparar y que la aserción que casa con
su propio contrario: el instrumento no miente, es que **no se le ha pedido nada que no se cumpliera
ya solo**. Por eso la casilla «el valor del caso NO es el de nacimiento» está dentro del guard y no
en un comentario: una comprobación que vive en la prosa no se ejecuta.

## La tanda, y el rojo de 952 fallos que no era un rojo

**Primera pasada: 5.230 tests, 952 fail.** Casi se publica como catástrofe. No lo era:

> 🔒 **Un build que falta no da un verde que no vale: da un ROJO que no vale** — y con 952 fallos
> tiene toda la pinta de ser culpa del cambio que acabas de hacer.

Lo que lo destapó **no fue leer los fallos, fue mirar el RECUENTO contra la población conocida
antes de leerlos**: la referencia de la tanda anterior eran **7.727** tests y aquí había **5.230**.
Dos mil quinientos tests que no llegaron a correr. Un instrumento que no arranca, no un hallazgo.

La causa, medida y dicha por los propios tests en su mensaje de fallo: **`dist/` no existía en este
worktree.** Un worktree recién creado nace sin `dist`, y la junction de `node_modules` no lo trae;
además, llamar al runner por `scripts/tanda-con-veredicto.mjs` **se salta la compilación que hace
`npm test`**. `npm run build` (EXIT=0, 288 ficheros) y a correr otra vez.

**Segunda pasada, con `dist` construido: 7.715 tests · 7.599 pass · 5 fail · 111 skip.** De los
cinco, **tres son los de `scrum939b`** (ajenos y conocidos) y **dos eran míos**, los dos por añadir
un guard nuevo:

| test | qué pedía | qué se hizo |
|---|---|---|
| **SCRUM-258** · identificadores sin declarar | `guard-duplicar-926.mjs` usaba `document` léxico en las flechas de puppeteer | **se cambió el CÓDIGO, no el censo** (A7): todo lo que corre dentro del navegador pasa a `new Function`, que es la convención de la casa |
| **SCRUM-548** · quién mide qué página | el guard estrena solape sobre `#quotes-detail/1` con `guard:descuentos-en-el-detalle` | se DECLARA el solape nuevo, que es para lo que existe ese censo, **con el motivo de no fusionarlos**: uno observa la ficha, el otro la usa de puerta para pulsar «Duplicar» y juzgar el editor |

Tras los dos arreglos: `scrum258` + `scrum548` 18/18, y el guard de 926 sigue 9/9 — el paso a
`new Function` no le quitó vista.

## Lo que NO cubre

* `tiers` y `currency`, por lo dicho en la tabla.
* La sonda original (`sondas-s2/sonda926.mjs`, fuera del repo) **no distinguía** «se perdió el
  descuento» de «no sé leer el campo»: su caso rojo y su caso positivo daban la misma salida. Se
  ha sustituido por este guard, que sí los distingue, y el banco queda **dentro del repo** (A8).
* El guard no mide la EDICIÓN de un presupuesto, solo la copia: es otro camino.

## Ficheros

* `public/dashboard/js/quotesDetailView.js` — el global viaja en la copia; muere el aviso caducado.
* `public/dashboard/js/quotesView.js` — la plantilla restaura global y condiciones de pago.
* `scripts/guard-duplicar-926.mjs` + su entrada y su `//` en `package.json`.
* `tests/scrum522-guards-fuera-de-la-tanda.test.mjs` — el contador, **medido corriendo el test**
  (29 → 30), no sumando uno. Es la octava vez que este número se toca y la norma A4 es explícita:
  una cifra derivada no se elige, se regenera.
