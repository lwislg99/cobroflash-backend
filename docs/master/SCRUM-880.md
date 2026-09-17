# SCRUM-880 — El empate del sello: la cadena bifurca cuando alta y anulación caen en el mismo segundo

*17-sep-2026 · rama `scrum-880-el-empate-del-sello`*

**Medido contra:** `origin/main` = `76c786f60721e0caeb7eac056b5f65863abb6b6b` · 2026-09-17T10:53:37+01:00

> ⛔ **STOP FISCAL RESPETADO. ESTA ENTREGA MIDE Y PROPONE. NO TOCA EL CAMINO DE EMISIÓN.**
> El diff de abajo está **escrito y no aplicado**, ni en una rama «para probar». `git diff` de
> `src/` contra el merge-base: vacío.

## 0 · Lo que se re-leyó en la fuente en vez de heredarlo

| afirmación del ticket | comprobada dónde | veredicto |
| --- | --- | --- |
| el desempate usa `>` estricto | `verifactu.service.ts:481` — `return tAnul > tAlta ? …` | **cierta** |
| los dos sellos se guardan sin milisegundos | `:326`+`:348` y `:410`+`:427` — `new Date(formatFechaHoraHuso(new Date()))`, y el formateador trunca al segundo en `:66-75` | **cierta, y por CONSTRUCCIÓN**: los ms guardados son siempre 0 |

⚠️ **El matiz que el ticket atribuye a `:66-75` no está donde dice.** Esas líneas son el
**formateador de la cadena que se hashea**; lo que hace que el sello *persistido* pierda los
milisegundos es que se re-parsea esa cadena (`new Date(timestamp)`) antes de guardarla. La
conclusión es la misma; el sitio donde arreglarlo, no.

## ① Lo que el ticket declaraba NO COMPROBADO, medido

El ticket decía: *«NO COMPROBADO: que en staging no empate (deducido de la latencia, no medido)»*.

🔴 **La deducción no es sólo imprecisa: la variable está mal elegida.** El empate **no depende de
cuánto se tarde**, sino de si los dos instantes caen **en el mismo segundo de reloj**. Dos sellos
separados por 1 ms que cruzan la frontera del segundo NO empatan; dos separados por 900 ms dentro
del mismo segundo SÍ.

Medido en `tests/scrum880-el-empate-del-sello.test.mjs`, recorriendo los 1000 arranques posibles
dentro de un segundo:

| separación alta↔anulación | empata en | |
| --- | --- | --- |
| 0 ms | 1000 / 1000 | 100 % |
| 100 ms | 900 / 1000 | 90 % |
| 250 ms | 750 / 1000 | 75 % |
| 500 ms | 500 / 1000 | 50 % |
| **900 ms** | **100 / 1000** | **10 %** |
| 999 ms | 1 / 1000 | 0,1 % |
| **1000 ms** | **0 / 1000** | **0 %** |

**La ley es exacta: P(empate) = 1 − separación/1000, y deja de ocurrir en ≥ 1000 ms.**

> Con **900 ms de latencia —casi un segundo entero— todavía empata una de cada diez veces.** Eso
> es lo que desmonta el «se deduce de la latencia»: ninguna latencia por debajo de un segundo
> entero es una garantía, y una por encima no hace falta medirla.

### 🔴 El control positivo, que es lo que hace válido el resultado

El banco **demuestra que sabe producir un empate** antes de afirmar nada: dos instantes separados
300 ms dentro del mismo segundo se persisten con el **mismo** sello, y sus milisegundos son 0.
Sin esa comprobación, cualquier «no ocurre» sería el suelo del experimento y no un resultado.

Y el defecto se ejercita **sobre el camino real**, no sobre una copia de su lógica: se le inyecta a
`applyVeriFactuAnulacion` un `prismaClient` de mentira —el parámetro ya es inyectable— y se observa
a qué huella encadena. **Con empate encadena al ALTA** (la anulación queda huérfana: cadena
bifurcada). **Con 1000 ms de separación encadena a la ANULACIÓN**, que es lo correcto. El doble
revienta ruidosamente ante cualquier consulta que no sepa interpretar, para no contestar otra cosa.

## ② La propuesta — escrita, NO aplicada

### Opción A · cambiar el CRITERIO: `>` → `>=`

```diff
--- a/src/modules/invoicing/domain/verifactu.service.ts
+++ b/src/modules/invoicing/domain/verifactu.service.ts
@@ -478,7 +478,7 @@
   // Se compara por el sello del REGISTRO (cuándo se generó), no por la fecha de la factura.
   const tAlta = (ultimaAlta.vfTimestamp ?? ultimaAlta.createdAt).getTime();
   const tAnul = (ultimaAnul.vfAnulTimestamp as Date).getTime();
-  return tAnul > tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;
+  return tAnul >= tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;
 }
```

**Qué cambia:** una comparación. **Qué arrastra:** nada. Cero datos tocados, cero migración, cero
sellos reescritos, reversible en un commit.

**Qué arregla:** el caso **causalmente forzado** — una factura no puede anularse antes de emitirse,
así que si un alta y la anulación *de esa misma factura* empatan, la anulación es siempre la
posterior y `>=` acierta.

🔴 **Qué NO arregla, y hay que decirlo: mueve el defecto, no lo elimina.** Si el empate es entre una
anulación y un alta **posterior no relacionada**, `>=` hace ganar a la anulación y ahora es el alta
la que queda huérfana. **Con dos sellos idénticos no se puede saber cuál fue el último: cualquier
desempate por reloj es una apuesta.** La virtud de `>=` es que apuesta a favor del único caso que
está garantizado por causalidad.

### Opción B · cambiar LO QUE SE GUARDA: persistir el instante con milisegundos

```diff
@@ -324,7 +324,8 @@  (applyVeriFactu)
     // El instante se toma DENTRO del cerrojo: es el que entra en la huella y tiene que ser
-    const timestamp = formatFechaHoraHuso(new Date());
+    const ahora = new Date();
+    const timestamp = formatFechaHoraHuso(ahora);   // la huella sigue usando el truncado
@@ -348
-      data: { vfHash, vfPrevHash: prevHash, qrData: qrUrl, vfTimestamp: new Date(timestamp) },
+      data: { vfHash, vfPrevHash: prevHash, qrData: qrUrl, vfTimestamp: ahora },
@@ -408,7 +409,8 @@  (applyVeriFactuAnulacion)  — el mismo cambio, simétrico
-    const timestamp = formatFechaHoraHuso(new Date());
+    const ahora = new Date();
+    const timestamp = formatFechaHoraHuso(ahora);
@@ -427
-      data: { vfAnulHash, vfAnulPrevHash: prevHash, vfAnulTimestamp: new Date(timestamp) },
+      data: { vfAnulHash, vfAnulPrevHash: prevHash, vfAnulTimestamp: ahora },
```

**Qué cambia:** lo que se persiste. **Qué arregla:** el empate **en origen** — dos sellos distintos,
desempate total, y la opción A deja de hacer falta para los registros nuevos.

**✅ NO hace falta tocar el esquema. MEDIDO, no supuesto:** en desarrollo,
`vf_timestamp` y `vf_anul_timestamp` son `timestamp without time zone` con
`datetime_precision = 3`. **Las columnas ya guardan milisegundos: la base nunca fue la
limitación.** Los ceros los pone el código al re-parsear la cadena truncada.

**✅ NO rompe la verificabilidad de la huella.** El XML emite
`formatFechaHoraHuso(inv.vfTimestamp)` (`:773` y `:863`), que vuelve a truncar: la cadena que un
tercero recompone sigue siendo **idéntica** a la que se hasheó. Lo que cambia es que el campo pasa
de ser *exactamente* lo hasheado a ser *lo hasheado más la precisión que el hash descarta*, y eso
hay que dejarlo escrito donde SCRUM-145 prometió lo primero (`:343-345`).

**✅ NO toca ningún sello ya guardado.** Sólo afecta a los registros FUTUROS; las filas existentes
conservan ms = 0 y siguen siendo válidas. La comparación funciona igual con precisión mixta.

> 🔴 **Y AQUÍ VA LA ADVERTENCIA EN MAYÚSCULAS QUE EL ENCARGO PIDE: SI ALGUIEN PROPONE RELLENAR
> LOS MILISEGUNDOS DE LOS SELLOS YA GUARDADOS, ESO ES REESCRIBIR UN SELLO EMITIDO Y LA REGLA 29
> LO PROHÍBE. NINGUNA DE ESTAS DOS OPCIONES LO HACE, Y NINGUNA VARIANTE QUE LO HAGA DEBE
> APLICARSE.**

**Riesgo de B:** medio-bajo. Antes de aplicarla hay que censar que nadie compare `vfTimestamp` por
igualdad exacta contra el string de la huella. Los dos únicos consumidores localizados (`:773`,
`:863`) lo re-truncan, así que están a salvo — pero el censo va antes que el cambio.

### Opción C · desempatar por algo estrictamente monótono, no por el reloj

**Es la que sigue la doctrina que este mismo fichero ya escribió.** En `:266-271` declara que
ordenar por reloj es frágil y que las altas se ordenan por `id desc`, *«estrictamente monótono y
nunca nulo»*, añadiendo textualmente: *«`vfTimestamp` NO sirve de criterio»*. **El desempate entre
lados es el único sitio donde el fichero vuelve al reloj que él mismo descartó.**

**Coste, y por eso va la tercera:** hoy no existe una columna monótona común a los dos lados — el
`id` de la factura no ordena *cuándo se selló* su anulación. Haría falta un contador de registro,
o sea **estado nuevo (regla 27) y cambio de esquema (dominio exclusivo del fundador)**. No es
proponible sin GO explícito y merece ticket propio.

Se nombra porque **es la única que elimina la clase entera del defecto**, no sólo esta puerta.

### Recomendación

**A + B, en ese orden, y ninguna toca datos sellados.** A es una línea y arregla la apuesta en el
caso forzado; B quita el empate de raíz para todo lo nuevo. C queda como ticket de fondo.

## ③ El alcance vivo

### Población en DESARROLLO — cero MEDIDO

```
población: 5 facturas en la base · 0 con algún sello · 0 REGISTROS sellados (0 altas · 0 anulaciones)
registros que COMPARTEN segundo con otro del mismo merchant: 0 en 0 grupo(s)
grupos con ALTA y ANULACION en el MISMO segundo (los que bifurcan): 0
```

Medido con `scripts/censo-sellos-que-empatan.mjs`, **solo lectura**. El cero significa que esta
base **está vacía de cadena**, no que el defecto no exista: el mecanismo se mide aparte y sí
ocurre. Y no dice nada de otros entornos, que el encargo prohíbe mirar.

⚠️ **El host de `DATABASE_URL_DEV` es `acela.proxy.rlwy.net`, el mismo que `_db-guard.mjs` declara
como `STAGING_HOST`.** Lo que decide es el DESTINO —el nombre de la base—, como dejó el criterio
SCRUM-418, y `_clave-vs-destino.mjs` lo clasifica como **DESARROLLO ✅**. El script se apoya en esa
función y no en una expresión propia: reescribir el criterio sería una segunda verdad que mantener.

### ¿Hay más sitios que comparen sellos sin milisegundos? **Dos, y sólo uno es puerta**

| # | sitio | qué hace | ¿explotable? |
| --- | --- | --- | --- |
| 1 | `:479-481` | `tAnul > tAlta` decide la punta de la cadena | 🔴 **SÍ — es el defecto** |
| 2 | `:611-626` | `sort((a,b) => a.sello - b.sello)` ordena altas y anulaciones para construir el XML | **NO** |

**El segundo está tapiado, y por una decisión anterior.** Su único consumidor es `anulacionPrev`
(`:495-512`), que resuelve el `RegistroAnterior` con
`registros.find(r => r.huella === inv.vfAnulPrevHash)` — **una búsqueda por huella persistida, no
por orden**. Lo cambió SCRUM-145d precisamente porque *«con dos anulaciones próximas en el tiempo
los sellos pueden empatar o invertirse»*. El empate sigue ahí; **nadie lee el resultado**.

> Es un defecto con dos puertas y una está tapiada. Que lo esté **no es suerte**: alguien ya se
> encontró esta misma debilidad por el otro lado y la cerró. Lo que quedó abierto es el desempate.

## Lo NO tocado

`src/` entero — **el diff de la propuesta está escrito y no aplicado** · `prisma/schema.prisma` ·
`DESIGN.md` · `docs/equipo/00-normas-comunes.md` · ningún sello, ninguna factura, ningún dato
reescrito (regla 29) · ningún estado ni flag (27) · ninguna dependencia (36) · ningún texto de
usuario (30 / A7), y nada en `docs/microcopy/`, que exige firma válida a todo lo que contiene
(SCRUM-726). **Staging y producción: no tocados, ni para mirar.**

## Hallazgo de otro carril, reportado y no arreglado (regla 9)

`node scripts/comprobar-claves-bd.mjs` sale con **❌ 2 problemas** en este worktree:
`DATABASE_URL_STAGING` y `DATABASE_URL_TESTS` están **ausentes** de `cobroflash-b4`.

`CLAUDE.md`, regla 3, afirma —con fecha **10-ago-2026** y como «REGISTRO MEDIDO»— que *«los cuatro
worktrees llevan `DATABASE_URL_STAGING`, `_DEV` y `_TESTS`»*. **Esa medición ha caducado**, al menos
para este árbol. Va aquí y no en `CLAUDE.md` porque ése es derivado (regla 35) y porque re-fecharlo
es trabajo de quien vuelva a medir los cuatro, no de quien mide uno.
