# SCRUM-530 · La alerta de tasa de entrega dejaba de existir para el cliente del Pioneer

**Medido contra:** `origin/main` = `cae27c2e6dc1482db0567a8561ebeb6863c996b8` · 2026-09-15T15:05:39Z
**Rama:** `scrum-530-la-alerta-que-no-puede-pronunciarse` · **Carril:** producto · métricas
**Gate:** sin gate — corre en `npm test`

> ⛔ Ni estado ni flag nuevo (27) · ninguna dependencia (36) · WhatsApp sigue siendo Meta Cloud API
> directa · nada ejecutado contra producción ni staging, todos los datos fabricados · el texto del
> caso nuevo es del fundador y va **marcado, no escrito** (regla 30).

---

## 0 · Obligación 0, con las dos causas separadas

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-530(-|$)"   ->  NINGUNA
git log origin/main --oneline -i --grep="scrum-530"                  ->  vacío
docs/master/SCRUM-530.md                                             ->  no existía
```

**Caso (a): nunca se empujó.** Contraste: el `grep` suelto de `530` sobre `ls-remote` devuelve
**1** y el anclado **0** — esa de más es `22156a4d…d42fa3`, el número vive dentro de un sha.

**Y la prueba por CONTENIDO, que es la que decide:** el umbral sigue en el código, literal —
`whatsappLog.service.ts`, `active: rate7d !== null && week.enviados >= 10 && rate7d < 90`.
El ticket está vivo.

## 1 · 🔴 El número NO se eligió, y la medición dijo algo mejor que un número

El encargo pedía derivar el umbral en vez de cambiar 10 por 3 «porque suena mejor». Medido:

**No hay datos de uso real accesibles desde aquí.** Lo único que el árbol declara sobre el volumen
de un Pioneer es el **techo**: `src/core/entitlements.ts` → `founding: { waFairUseMonthly: 300 }`.
Eso es fair-use, no uso típico, y no vale para derivar una muestra mínima. Producción y staging
están fuera de alcance. **Se dice en vez de inventar una cifra.**

### 🔴 Y entonces la medición destapó por qué bajar el 10 no habría servido de nada

Corrido el servicio REAL con la base doblada:

| filas de la semana | `sample` | `deliveryRate7d` | `alert.active` |
|---|---|---|---|
| 1 entregado + 2 fallidos | **1** | **100** | false |
| **1 entregado + 9 fallidos** | **1** | **100** | false |
| 20 enviados, 10 entregados | 20 | 50 | true |

`failed` no está en `SENT_OR_MORE` ni en `DELIVERED_OR_MORE`: **un mensaje fallido no entra en el
denominador**. Con nueve fallos de diez, `sample` sigue valiendo **1**.

> **Bajar el umbral de 10 a 3 no habría arreglado el caso del ticket.** Con 9 fallos la muestra es
> 1, así que la alerta habría seguido callada — y encima la pantalla enseña **100 %**.

Eso es un defecto más grande que el umbral, **y no se arregla aquí**: cambiar el denominador cambia
a quién se avisa, y eso es decisión de producto (regla 9). Va a `docs/BUGS.md` como **`P1-WA-TASA`**
con su tabla. Tampoco se pincha en un assert: un límite declarado y fijado deja de ser advertencia
y pasa a ser permiso (SCRUM-827).

## 2 · El arreglo: la pantalla deja de callar

El mínimo de población **es correcto** —con 2 envíos y 1 fallo el 50 % no significa nada—. Lo que
estaba mal es que al no poder pronunciarse la tarjeta pintaba **exactamente lo mismo** que si todo
fuera bien.

> 🔒 **Una alerta que nunca se activa y una alerta que no tiene datos se leen igual y significan
> lo contrario.** Es «un CERO no es *está limpio*, es *no he mirado*» (A3), aplicado a lo que ve un
> cliente de pago.

| dónde | qué |
|---|---|
| `whatsappLog.service.ts` | el umbral pasa a constante `MIN_MUESTRA_ALERTA` **de módulo (no se exporta: un export sin llamador es lo que caza SCRUM-411)** y viaja en el DTO como `alert.minimo` |
| `reportsView.js` | **tres casos, no dos**: alerta activa · muestra corta · nada. El de muestra corta dice `[PENDIENTE microcopy oficial] · 3/10` |

El umbral **no se escribe en la vista**: la misma regla en dos sitios es cómo una de las dos se
queda atrás. Hay un test que lo exige.

**Microcopy:** el texto es del fundador. Se entrega con `[PENDIENTE microcopy oficial]` y
`data-microcopy="PENDIENTE_FUNDADOR"`, que es como se entregaron los rótulos de albaranes.

## 3 · Los controles, ejecutados

| control | resultado |
|---|---|
| 🔴 **SUELO** | la tarjeta pinta de verdad, o CIEGO |
| 🔴 **EL QUE DECIDE** | 3 envíos y 2 fallos: antes **silencio**, ahora lo dice |
| ✅ **POSITIVO** | 20 envíos y 95 %: **ninguna** alerta y ninguna marca |
| ✅ **NEGATIVO** | 20 envíos y 50 %: sigue alertando igual que hoy, con su `50%` |
| 🔴 **CONTRATO** | el servicio real manda `minimo`, y el fixture del banco cae si el umbral cambia |
| 🔴 **MUTACIÓN** | con `muestraCorta = false` vuelve el silencio y caen dos casos; fuente restaurado `IDÉNTICO` |

## 4 · 🔴 Dos errores míos, y el primero invalidaba el rojo

1. **El suelo me cazó el primer rojo.** Le pasaba a `pintarVista` un contenedor propio, pero el
   banco crea el suyo y lo manda como PRIMER argumento: la vista pintaba en el del banco y yo leía
   un `div` vacío. El «que decide» salía rojo **por el motivo equivocado** — que es justo lo que el
   suelo estaba puesto para cazar. Sin él lo habría dado por bueno.
2. **La herramienta de edición me convirtió el servicio a CRLF**: 279 CR en un fichero que estaba
   en LF, y `git status` no lo delata porque el fichero está normalizado (`text=set eol=lf`, caso B
   de SCRUM-570). Lo cazó contar los CR con node —nunca con `grep` (SCRUM-766)— y se limpió con
   `npm run cr:limpiar`.

## 5 · Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión · el denominador de la tasa (§1, va aparte) · el
umbral de 90 % · ningún literal de microcopy · ninguna plantilla de WhatsApp · ningún estado ni
flag · ninguna dependencia. Ninguna base real, ninguna clave, ni un byte hacia Meta.

## 6 · La tanda, con su población y sus saltos aparte

```
ARRANQUE 2026-09-16T03:34:52.987Z · concurrencia 1 · tope duro 45 min
✅ LA TANDA TERMINÓ · 18 minutos · último fichero: whatsappTemplates.test.mjs

# tests 6865 · # pass 6755 · # fail 0 · # skipped 110 · # todo 0
población: 808 ficheros de tests/     not ok: 0
```

Los **110 saltados** son los gateados de siempre (base real, navegador), cada uno con su motivo
declarado; van **aparte del pass** a propósito, porque «0 fail» sin decir sobre cuántos no es un
verde: es una frase (norma A3, nacida de [SCRUM-850](SCRUM-850.md)).

### 🔴 Los seis rojos que trajo la primera pasada, y cinco eran míos por el mismo motivo

| rojo | de quién |
|---|---|
| `SCRUM-402` ×2 · el censo de marcadores PINTABLES no sube | **mío**: `reportsView.js (+1)` |
| `SCRUM-755` ×3 · el árbol pinta más marcadores de los declarados | **mío**: `30 !== 29` |
| `SCRUM-854` · esta rama, si toca código, trae su entrada | **mío**, y de los gordos |

Los cinco primeros son **el trinquete haciendo su trabajo**: añadí un marcador y la casa lleva
censo de qué ficheros los pintan. Aquí **declarar SÍ es el camino**, y es lo contrario de lo que
tocó en [SCRUM-815](SCRUM-815.md) con `MARCA_CORREO`: allí el export SOBRABA y se quitó; aquí el
marcador es **obligatorio por la regla 30**, porque el texto es del fundador y no lo escribo yo.
La subida se declara con su motivo en las tres tablas (`CENSO` de 402, `CENSO_DE_SITIOS` de 755
—29 → 30— y `PINTAN_Y_NO_CUENTAN` con el porqué). **Ningún guard relajado.**

### 🔴 Y el sexto me pilló en la rama equivocada

```
rama:     scrum-815-el-correo-una-sola-vez
ticket:   SCRUM-815 (por rama)
falta:    docs/master/SCRUM-815.md
```

**Había hecho toda la 530 encima de la rama de la 815.** Nunca creé la suya. Lo cazó un guard, no
yo, y es exactamente el defecto «un número, una regla» que este equipo tiene medido. Se resolvió
limpio porque la 815 ya estaba en `main` y la rama no la adelantaba: el trabajo sin commitear se
movió a `scrum-530-la-alerta-que-no-puede-pronunciarse` sin reescribir nada ni usar `git stash`.
