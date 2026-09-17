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

---

# APÉNDICE · Fase c — A y B aplicados, con GO del fundador

*17-sep-2026 · rama `scrum-880c-el-desempate-y-los-milisegundos`*

**Medido contra:** `origin/main` = `6598e735fb3c8b4fbaa43a236713c51ad2609fdb` · 2026-09-17T14:06:36+01:00

> **GO concedido para A + B. C queda fuera** (estado nuevo y esquema: ticket aparte).
> El motivo del GO, escrito porque es la mitad del valor de la decisión: **producción tiene CERO
> facturas y CERO albaranes**, así que no existe ni un sello viejo sin milisegundos con el que los
> nuevos puedan empatar. **B es un cambio limpio hoy y deja de serlo con la primera factura real.**

## El diff efectivo — cinco líneas, ni una más

```
-  return tAnul > tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;      A
+  return tAnul >= tAlta ? ultimaAnul.vfAnulHash : ultimaAlta.vfHash;

-    const timestamp = formatFechaHoraHuso(new Date());                   B · alta
+    const ahora = new Date();
+    const timestamp = formatFechaHoraHuso(ahora);
-      data: { …, vfTimestamp: new Date(timestamp) },
+      data: { …, vfTimestamp: ahora },

-    const timestamp = formatFechaHoraHuso(new Date());                   B · anulación
+    const ahora = new Date();
+    const timestamp = formatFechaHoraHuso(ahora);
-      data: { …, vfAnulTimestamp: new Date(timestamp) },
+      data: { …, vfAnulTimestamp: ahora },
```

⛔ **El `sort` de la construcción del XML NO se ha tocado** — cero líneas suyas en el diff,
comprobado. Sigue tapiado porque su único consumidor busca por huella desde SCRUM-145d.
⛔ **Ningún sello ya guardado se reescribe** (regla 29): sólo cambia lo que se guarda de aquí en
adelante.

## ② La comprobación del esquema, repetida y citada

Antes de escribir una línea, **segunda vez**, sobre `DATABASE_URL_DEV` a las
`2026-09-17T12:57:41.795Z`:

```sql
select table_name, column_name, data_type, datetime_precision
  from information_schema.columns
 where column_name in ('vf_timestamp','vf_anul_timestamp');
```
```
invoices.vf_anul_timestamp → timestamp without time zone · datetime_precision = 3
invoices.vf_timestamp      → timestamp without time zone · datetime_precision = 3
```

**`precision = 3` es milisegundos: NO hace falta ALTER.** Las columnas nunca fueron la
limitación; el truncado lo ponía el código al re-parsear la cadena de la huella.

Y donde SCRUM-145 prometió *«se PERSISTE el instante exacto que entró en la huella»* queda escrito
el matiz: ahora se guarda **eso más la precisión que el hash descarta**. La verificación de un
tercero no cambia, y **eso no se razona: se comprueba recomputando la huella** (abajo).

## ③ Los controles — A y B por separado

| control | qué prueba | |
| --- | --- | --- |
| **🔴 A · EL QUE DECIDE** | con alta y anulación empatadas, la cadena **ya no bifurca**: encadena a la anulación | ✅ |
| **✅ A · VERDE REAL** | con la anulación sellada **ANTES** que el alta, encadena al **alta** | ✅ |
| **🔴 A · MUTACIÓN** | `>` y `>=` dan respuestas **distintas** sobre el mismo empate, en 3 separaciones | ✅ |
| **🔴 B · milisegundos** | 50 sellos escritos por el camino real; si todos salieran a 0 sería el truncado de vuelta | ✅ |
| **🔴 B · invariante** | la huella se **recomputa de verdad** desde el sello guardado, 20 veces | ✅ |
| **🔴 mecanismo** | la cadena hasheada sigue truncada al segundo — por eso `>=` no sobra | ✅ |

🔴 **EL SUELO DEL EXPERIMENTO VA DENTRO DEL QUE DECIDE:** antes de afirmar nada, el banco comprueba
que **ha producido el empate** (los dos sellos idénticos, milisegundos a 0). Si no lo produjera,
el verde sería el suelo del experimento y no una prueba de que el arreglo funciona.

🔴 **Y EL VERDE REAL ES LA RAMA QUE RESPONDE DISTINTO.** «Anulación 1 s después» habría dado la
misma respuesta con `>` y con `>=` — no mide nada. El caso que discrimina es la **anulación
sellada ANTES**: ahí tiene que ganar el alta. Sin él, un `>=` mal escrito como «la anulación gana
siempre» pasaría el control de arriba sin que nadie lo notara.

### Las dos mutaciones declaradas, y que cada una cae SOLA

| mutación | tumba | y NO tumba |
| --- | --- | --- |
| devolver `>` estricto | `A · EL QUE DECIDE` | el de B |
| volver a `new Date(timestamp)` | `B · milisegundos` | el de A |

**Que cada una caiga sola es lo que prueba que son dos arreglos.** Un test que sólo pasara con los
dos puestos no diría cuál hace el trabajo.

### 🔴 Y la sonda de mutación me cazó a mí primero

Las dos mutaciones salían **`exit 0`**: el guard no caía. No era que el arreglo no funcionara —
era que **la sonda editaba el `.ts` y los tests importan de `dist/`**. Sin recompilar, una mutación
sobre código compilado es **MUDA**: da exactamente la misma salida que un guard que no detecta.

El meta-guard de la casa ya lo sabe —SCRUM-763 lo dejó escrito: *«si el fichero que la declaración
muta se COMPILA, también se emite su `.js` a `dist/`»*— y mi sonda no. Arreglada recompilando entre
mutación y ejecución, las dos caen. **Si me hubiera fiado del primer `exit 0` habría concluido que
los controles eran ciegos, y lo ciego era el instrumento que los medía.**

## Lo NO tocado

El resto de `verifactu.service.ts` · el `sort` del XML · `prisma/schema.prisma` (no hace falta
ALTER, medido) · ningún sello guardado (regla 29) · ningún estado ni flag (27) · ninguna
dependencia (36) · ningún texto de usuario (30). **Producción y staging: no tocados.**

### 🔴 Y un guard de otro carril cazó la consecuencia que yo no había visto

`SCRUM-525d` salió en rojo en la tanda: **mis 38 líneas de comentario desplazaron el fichero**, y
`docs/legal/AUDITORIA_CAMINO_EMISION.md:39` citaba `verifactu.service.ts:536` para
`buildVerifactuRegistrosXml`, que pasó a **574**.

No es un fallo del guard ni una casualidad: **es exactamente para lo que existe**. Una coordenada
`fichero:línea` en un documento de auditoría se rompe cada vez que alguien escribe encima, y sin
algo que lo compruebe apunta a otra cosa sin que nadie lo note — el documento sigue pareciendo
correcto.

**Arreglada la coordenada, no relajado el guard** (regla 41): `536` → `574`. Se cambia el número,
no la afirmación: sigue señalando la misma función.

⚠️ **Y deja una lección para el que escriba comentarios largos en el camino fiscal:** explicar bien
un cambio de una línea cuesta 38 líneas, y esas 38 líneas rompen coordenadas ajenas. El precio no
es no explicar — es acordarse de que el fichero es un sistema de coordenadas para otros documentos.

### Rojo ajeno en la tanda, demostrado y NO arreglado (regla 9)

`SCRUM-804 · CONTROL POSITIVO DERIVADO` sale en rojo:

```
🔴 EL INSTRUMENTO NO VE ESTAS RAMAS, que `for-each-ref` sí lista:
   · scrum-904 → SCRUM-904
```

**No es el intermitente que ya está registrado**: aquél parpadeaba (9/9, 8/9, 9/9) y éste falla
**3 de 3 en aislamiento**. Es reproducible, o sea que es otra cosa.

**Y no es mío, demostrado y no afirmado:** con `main` en el árbol —sin ninguno de mis cambios—
**falla igual**. El test lee refs de git, que son compartidas, así que el veredicto no depende de
la rama en la que se esté.

La causa: la rama remota **`scrum-904`** (17-sep-2026 11:23, de otra sesión, trabajando en la
colisión de contador del 522) **se llama sin slug** — `scrum-904` en vez de `scrum-904-<slug>`,
que es la forma que manda la constitución (`scrum-<n>-<slug>`). El barrido de SCRUM-804 no la
alcanza, y su propio mensaje lo dice bien: *«un `SIN RASTRO` sobre ellas no dice "no hay trabajo":
dice que el barrido no llega»*.

**Reportado, no tocado**: es de otro carril y no bloquea esto. Quien lleve el 904 puede renombrar
la rama, o SCRUM-804 ampliar su criterio — pero esa decisión no es de aquí.
# APÉNDICE · Fase b — Las afirmaciones con sello «medido», y el host que parece staging

*17-sep-2026 · rama `scrum-880b-afirmaciones-caducadas`*

**Medido contra:** `origin/main` = `e437a51f7d58bc8b7bbcf20c1386a9fa9c1acb38` · 2026-09-17T11:19:56+01:00

⛔ **Esto MIDE. No arregla ni re-fecha nada** (regla 9). `docs/equipo/00-normas-comunes.md` se ha
**leído y no escrito**: tiene un dueño, la Sesión 0.

> 🔒 Una afirmación con el sello «medido» y sin fecha de caducidad es la forma más convincente que
> tiene un dato viejo de seguir pareciendo cierto.

## ① Las tres cifras

```
a) POBLACIÓN     55 afirmaciones con marca de medición · 14 ficheros
b) VERIFICABLES   9 desde este worktree, sin tocar staging ni producción
c) SIGUEN CIERTAS 3   ·   🔴 CADUCADAS 6
   NO VERIFICABLE 46, contadas aparte
```

**La población**, declarada: `CLAUDE.md` + `docs/equipo/*.md`. **No** se mira `docs/master/` ni el
máster — ahí una medición es el REGISTRO fechado de un trabajo, que es lo que debe ser; en estos
dos sitios son **instrucciones vivas** que alguien lee para decidir hoy.
Criterio: participio de medición (`medid*`, `censad*`, `contad*`, `comprobad*`, `verificad*`) como
palabra. **Descontadas y declaradas:** 4 instrucciones («hay que medir», «mídelo» — mandan hacer,
no afirman) y 5 apariciones de la palabra dentro de un nombre de fichero.
Instrumento: `scripts/censo-afirmaciones-medidas.mjs`.

### 🔴 De las 9 comprobables, 6 han caducado

| # | afirmación | hoy | |
| --- | --- | --- | --- |
| 1 | `CLAUDE.md:77` (regla 3, **REGISTRO MEDIDO** 10-ago-2026) · «los cuatro worktrees llevan `_STAGING`, `_DEV` y `_TESTS`» | en `cobroflash-b4` **faltan dos** | 🔴 **CADUCADA** |
| 2 | `sesion-4.md:102` y `:162` · «**A15 NO EXISTE**, la numeración salta de A14 a A16» | **A15 existe**: `00-normas-comunes.md:249`, «`git stash` es estado COMPARTIDO» | 🔴 **CADUCADA** (×2 líneas) |
| 3 | `sesion-1.md:135` · «66 ficheros de `tests/` gateados, 63 por `QA_DB_TEST`» | **81 gateados · 67 por `QA_DB_TEST`** | 🔴 **CADUCADA** |
| 4 | `afirmaciones-verificadas.md:59` · «el `CLAUDE.md` del checkout tiene **102 líneas**» | **160** | 🔴 **CADUCADA** |
| 5 | `afirmaciones-verificadas.md:58` · «el checkout va **3.782 commits** por detrás» | **41** | 🔴 **CADUCADA**, y ver la nota |
| 6 | `afirmaciones-verificadas.md:31` · «cuatro sitios del atajo N» → **seis** | **6 con tecla**, de 10 botones | ✅ sigue cierta |
| 7 | `afirmaciones-verificadas.md:50` · «`YAQU_MASTER.md` no está en la raíz» | no está | ✅ sigue cierta |
| 8 | `sesion-1.md:30` · «en `verifactu.service.ts` el NIF del cliente no se imprime: DECIDE» | `MODO_SIN_DESTINATARIO` sigue ahí y el comentario lo mantiene | ✅ sigue cierta |

⚠️ **La #5 caduca ANUNCIÁNDOLO y hay que decirlo a su favor:** su propia fila dice *«Cierto en su
momento, y crece»*. Es la única de las seis que lleva su caducidad escrita — el número cambió, pero
el lector estaba avisado. Lo que sí ha dejado de ser cierto es el «y crece»: **decreció**, de 3.782
a 41, porque alguien actualizó el checkout.

⚠️ **Y la #6 sigue cierta por poco:** «seis» sigue siendo el número con tecla, pero la población
pasó de los sitios de entonces a **10 botones de crear**, con **4 sin tecla**. Un número que
acierta sobre un denominador que ha cambiado envejece sin que se note.

### 🔴 El caso que abrió esto demuestra que la fecha no basta

`CLAUDE.md` regla 3 **lleva fecha** (10-ago-2026) y **aun así caducó**, porque afirma un estado en
**presente** —«los cuatro worktrees llevan…»— que el lector toma por vigente. Medido sobre el
propio censo: de las 55, **17 llevan fecha y 38 no**; y **31 no llevan ni fecha ni con qué volver
a preguntarlo**. La fecha protege del olvido, no de la lectura.

### Las 46 NO VERIFICABLES, y por qué

Contadas aparte, clasificadas **por lectura** (lo que no pude decidir fue al lado malo):

* **~22 no son afirmaciones de estado**: doctrina, encabezados, anclas de medición (`medido sobre
  origin/main = <sha>`), o líneas que **se declaran a sí mismas como no comprobadas** —
  `sesion-1.md:193` («lo medido, no un hecho comprobado. Se dice así a propósito»),
  `sesion-4.md:160-161` («contado por el fundador, **no medido aquí**»), `sesion-4.md:168` («esta
  sesión NO lo ha comprobado, a propósito»). **Ésas son el modelo**: una afirmación que declara su
  propio alcance no puede caducar en silencio.
* **~15 son eventos pasados fechados**: «el 8-sep se barrieron 456 ramas», «el PR #1214 llevó 3
  tickets». No pueden dejar de ser ciertos: dicen lo que pasó, no lo que hay.
* **~9 necesitan algo fuera de este worktree**: GitHub/CI (`delete_branch_on_merge`, runs de
  workflows, PRs), Jira/MCP, transcripts de otras conversaciones, o el runtime del orquestador.

### Lo que esto significa para la decisión

**6 de 9 comprobables han caducado — el 67 %.** Y la muestra no está sesgada hacia lo viejo: dos
de las seis son de **ayer y de hoy** (`afirmaciones-verificadas.md`, 17-sep). El problema no es
que las notas sean antiguas: es que **nada vuelve a preguntarlas**.

## ② El host que parece staging

**Resultado: tres mecanismos deciden mirando el HOST. Dos contestan la pregunta correcta; uno la
equivocada — y ese uno falla CERRADO.**

La clave la deja escrita el propio guard, `_db-guard.mjs:180`: *«staging, y las demás bases del
mismo Postgres (**SCRUM-84: el criterio es el HOST**)»*. **Son dos preguntas distintas y la casa
las contesta con dos criterios distintos, a propósito:**

| pregunta | criterio correcto | quién lo usa |
| --- | --- | --- |
| **«¿es seguro ESCRIBIR aquí?»** | **HOST** — todo lo que vive en ese Postgres es no-producción, y para un permiso eso es exactamente lo que hace falta saber | `assertSafeStagingUrl` (`_db-guard.mjs:291`) → `marcar-staging`, `test-staging-gated`, `turno-staging` · `DESTINOS_SEMBRABLES` (`:180`, `:260`) |
| **«¿QUÉ es esto: staging, desarrollo o producción?»** | **DESTINO** — el host aloja dos bases distintas | `_clave-vs-destino.mjs` (SCRUM-418) → `comprobar-claves-bd` |

### 🔴 El único que mezcla las dos

`scripts/conciliar-auditoria-fiscal.mjs:103-104`:

```js
if (h === PROD_HOST)    return { clase: 'prod',    host: h };
if (h === STAGING_HOST) return { clase: 'staging', host: h };
```

Contesta la pregunta de **identidad** con el criterio de **permiso**: una base de **DESARROLLO**
sale clasificada como `staging`.

✅ **Y no es explotable hoy, porque falla CERRADO** — medido leyendo `:144-147`:

```
if (clase === 'staging' && !marcada) {
  console.error('❌ El host dice staging pero la base NO lleva el marcador YAQU_STAGING.');
  console.error('   Abortado: si no se puede verificar de qué base se trata, no se lee.');
```

Una base de desarrollo clasificada como `staging` **aborta** en vez de leerse. El mensaje describe
literalmente la confusión —*«el host dice staging pero…»*— sin saber que la está describiendo.

**El resultado del censo, entonces, no es «hay un defecto»: es «hay un criterio equivocado que hoy
no hace daño porque otro mecanismo lo tapa».** El día que cambie el host, o que alguien marque la
base de desarrollo, deja de taparlo.

## Lo NO tocado

`docs/equipo/00-normas-comunes.md` (leído, no escrito — es de la Sesión 0) · ninguna afirmación
re-fechada ni corregida · `conciliar-auditoria-fiscal.mjs` sin tocar · `CLAUDE.md` sin tocar:
re-fechar la regla 3 exige medir **los cuatro** worktrees y desde aquí sólo se ve uno.
**Staging y producción: no tocados, ni para mirar.**
