# SCRUM-640 · Cinco tests que medían la máquina, no el producto

**Medido contra:** `origin/main` = `9ae6ec070d76da8fbad21d8d6209f2ffd609eab6` · 2026-09-01T22:10:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** se arreglan **los tests no fiscales**. Los fiscales se **miden y se proponen**, y no
se tocan. No se cambia el producto para que un test pase. No se tocan los otros sitios de la
caducidad (SCRUM-633), ni `_navegador.mjs`, ni los guards (S3), ni `guards-visuales.mjs` (S1).

---

## 0 · 🔴 Un desajuste con el encargo, dicho antes de tocar nada

El encargo repartía «tres no fiscales + dos fiscales». **Medido por lo que toca cada uno, el
reparto es 2 + 3:**

| Test | ¿Toca emisión / AEAT? | Clase |
|---|---|---|
| `SCRUM-300 · la FECHA DE ENTREGA sale impresa` | albarán; **no** aparece en `verifactu/` | no fiscal |
| `SCRUM-397 · una fecha FUTURA se rechaza` | cobros, recibos y exports; **no** llega a `librosAeat` ni a VeriFactu | no fiscal |
| `calcularSemaforo: fronteras exactas` | plazo del **art. 13.2 RD 1619/2012** | **fiscal** |
| `SCRUM-70 · rotura por mes natural (art. 13)` | qué albaranes entran en qué recapitulativa | **fiscal** |
| `SCRUM-70 (ruta 1) · "hasta el 31"` | el rango de la recapitulativa | **fiscal** |

Los dos de SCRUM-70 son **los dos extremos del mismo límite de mes**, así que se tratan juntos y
con los fiscales. Se arreglan **dos**, se proponen **tres**.

## 1 · Los dos no fiscales, arreglados

### 1.1 · `SCRUM-300` — el fixture estaba a MEDIANOCHE UTC

El PDF del albarán formatea con `toLocaleDateString('es-ES', …)` **sin `timeZone`**
(`albaranPdf.service.ts:111`), o sea con la zona del proceso. El fixture usaba
`new Date('2026-08-02T00:00:00Z')`: en una máquina con desfase negativo eso es el día 1 por la
tarde, y el test caía diciendo «falta la fecha de ENTREGA» cuando lo que fallaba era la máquina.

Las tres fechas del fixture pasan a **mediodía local**, que es la misma fecha natural de −11 a
+12. **No se toca el producto.** Y para que el arreglo no ESCONDA la dependencia, se añade un
trinquete: si algún día el formateador fija `timeZone`, el test cae y avisa de que el fixture ya
puede volver a medianoche.

> El barrido de seis zonas cazó una segunda fecha después de arreglar la primera: `emisionAt` iba
> a las 09:00Z, y en `Pacific/Honolulu` (−10) eso es el día anterior. Arreglar una y dar el
> trabajo por hecho habría dejado la otra.

### 1.2 · `SCRUM-397` — esto no se arregla sólo en el test, y se dice

El producto compara `new Date('2026-04-03')` —medianoche **UTC**— con un `finDeHoy` que es fin de
día **LOCAL** (`fechaDeCobro.ts:60-61`). **Ninguna elección de `hoy` reconcilia las dos
convenciones**, porque el lado izquierdo es fijo en UTC.

Se parte en dos, que es lo honesto:

* **El CRITERIO** (una fecha futura se rechaza, hoy vale) se prueba con `Date` explícitos: los dos
  lados hablan la misma zona y lo que se mide es el criterio, que es lo que dice el nombre.
* **La CADENA `YYYY-MM-DD`** —que es lo que manda un `<input type="date">`— tiene su propia
  prueba de **caracterización**, que afirma la verdad medida:
  * desfase ≥ 0 (UTC, Madrid, Tokio) → se rechaza ✅
  * desfase < 0 (América) → **se acepta una fecha de mañana** 🔴

**En Railway el desfase es 0**, así que el producto se comporta bien donde corre. Es un defecto
**latente**, no vivo. Queda escrito y **no se arregla aquí**.

### 1.3 · El control: las dos, verdes de UTC+14 a UTC−11

| Zona | `scrum300` | `scrum397` |
|---|---|---|
| Pacific/Kiritimati (+14) | 9 · fail 0 | 10 · fail 0 |
| Asia/Tokyo (+9) | 9 · fail 0 | 10 · fail 0 |
| Europe/Madrid (+1/+2) | 9 · fail 0 | 10 · fail 0 |
| Europe/London | 9 · fail 0 | 10 · fail 0 |
| UTC | 9 · fail 0 | 10 · fail 0 |
| America/New_York (−5/−4) | 9 · fail 0 | 10 · fail 0 |
| Pacific/Honolulu (−10) | 9 · fail 0 | 10 · fail 0 |
| Pacific/Midway (−11) | 9 · fail 0 | 10 · fail 0 |

## 2 · 🔴 LOS TRES FISCALES · PROPONGO Y PARO

La pregunta del encargo era si **miente el test** o **está mal el producto**. Medido con el
producto **compilado**, corriendo en un proceso hijo con la zona forzada a **UTC — que es como
corre en Railway** (sin variable `TZ`), y dándole instantes **españoles**:

### 2.1 · Las dos respuestas, que son distintas

**MIENTE EL TEST: sí, los tres.** Construyen los fixtures con `new Date('YYYY-MM-DD')`
—medianoche **UTC**— mientras el producto trabaja con componentes **locales**
(`mesNaturalKey`, `startOfDay`, `setHours`). Son dos convenciones mezcladas.

**ESTÁ MAL EL PRODUCTO: sí, los tres también — y este defecto está VIVO en producción.**

| Qué se le pregunta al producto (proceso en UTC = Railway) | Respuesta | En Madrid |
|---|---|---|
| `mesNaturalKey` de un albarán del **1-abr 00:30 hora española** | **`2026-03`** 🔴 | `2026-04` ✅ |
| `mesNaturalKey` del **1-abr 01:30 hora española** | **`2026-03`** 🔴 | `2026-04` ✅ |
| `calcularSemaforo` el **1-abr 00:30 hora española**, plazo 31-mar | **`ambar`** 🔴 | `rojo` ✅ |
| `calcularSemaforo` el **1-abr 01:30 hora española** | **`ambar`** 🔴 | `rojo` ✅ |
| ¿entra en el rango «hasta 31-mar» un albarán del **1-abr 00:30 hora española**? | **SÍ** 🔴 | NO ✅ |

**Son el mismo defecto, visto por tres sitios:** el producto usa el reloj **local del servidor**
para decidir a qué **día o mes natural español** pertenece un instante — y el servidor está en
**UTC** mientras España está en **UTC+1/+2**. La ventana es de **1 a 2 horas cada día**
(00:00–01:00 en invierno, 00:00–02:00 en verano, hora peninsular).

### 2.2 · Por qué esto no es cosmético

* Un albarán creado de madrugada el día 1 **entra en la recapitulativa del mes anterior**. Esa
  factura se **emite**, y una factura emitida no se edita ni se borra (regla 29): sólo R1 o
  anulación con registro.
* El **semáforo dice ámbar con el plazo ya vencido**, o sea deja de avisar justo cuando más
  falta — y el plazo es el del art. 13.2, que es ley y no un acuerdo comercial.

### 2.3 · Lo que propongo, sin ejecutarlo

**No es «cambiar `local` por `UTC`».** El comentario de `pendientesFacturar.service.ts:39-42`
eligió local **a propósito**, y con un buen motivo: `toISOString()` desplaza el plazo un día en
zonas con desfase positivo. El error no fue elegir local: fue suponer que «local» sería España.

La salida coherente es **hacer explícita la zona FISCAL del merchant** —para un merchant español,
`Europe/Madrid`— y derivar de ella los tres cálculos, en vez de heredar la del proceso. Eso:

* es la misma medicina que SCRUM-630 (2/2), un escalón más arriba;
* deja los tres sitios cuadrando por construcción en vez de por tres arreglos sueltos
  (*imposible mejor que vigilado*);
* y **necesita decisión del fundador**, porque toca el criterio de un plazo legal y puede cambiar
  en qué factura cae un albarán ya registrado.

**Alcance de lo emitido:** cuántas facturas ya emitidas llevan un albarán del mes que no toca
**no se ha medido** —haría falta consulta contra producción— y **no se decide aquí** (regla 29).

## 3 · El censo · ¿cuántos tests más dependen de la zona?

Suite entera (**4.193 pruebas**) en tres zonas extremas —`Pacific/Kiritimati` (+14), `UTC` y
`Pacific/Midway` (−11)—, anotando qué prueba **cambia de veredicto**.

**CONTROL POSITIVO:** el mismo barrido sobre los ficheros de `origin/main` tiene que encontrar
los cinco que ya se conocían. **Los encuentra los cinco.** Sin eso, el número de abajo no valdría.

| | Pruebas que cambian de veredicto según la zona |
|---|---|
| `origin/main` (control positivo) | **5** — los cinco conocidos |
| Esta rama | **3** — los tres fiscales, intactos a propósito |

**Límite declarado:** el censo ve las que **cambian de veredicto** en esas tres zonas. Una prueba
puede depender de la zona y no fallar en ninguna de las tres —porque su borde caiga fuera—, y
este barrido no la vería. No es un «cero de dependencias»: es un cero de **veredictos que
cambian**, que es lo que se puede afirmar.

## 4 · 🔴 HALLAZGOS FUERA DE ALCANCE

1. **Un rojo mío, ya arreglado, que sólo salió porque el censo miraba las tres zonas.** Mis
   ediciones dejaron **229 y 273 CR** en disco en los dos ficheros de test (`main` tenía 0), y
   `scrum480-fin-de-linea` cayó — en las **tres** zonas, que es justo lo que lo delató como *no*
   dependiente de zona. Normalizado a LF; el guard vuelve a verde.
2. **`resolverFechaDeCobro` mezcla instante UTC con fin de día local** (§1.2). Latente: en
   Railway (UTC) se comporta bien. Ticket propio.
3. **El PDF del albarán formatea sin `timeZone`** (`albaranPdf.service.ts:111`), igual que la
   landing del presupuesto (SCRUM-633 §6). Es la misma familia que los tres fiscales.

## Tests que introduce esta entrada

* `tests/scrum300-albaran-campos.test.mjs` — fixtures a mediodía local; **+2** pruebas: la
  caracterización de que el PDF formatea sin `timeZone` y el control de su detector.
* `tests/scrum397-fecha-real-de-cobro.test.mjs` — el criterio con `Date` explícitos; **+1**
  prueba: la caracterización del comportamiento con cadena `YYYY-MM-DD` según el desfase.

---

# APÉNDICE · El ticket ya estaba ENTREGADO — y la familia ha VUELTO A CRECER

**Medido contra:** `origin/main` = `64b5d80ae3b11dcc34d736de21670eb6b5ce6dda` · 2026-09-07T13:00:00+02:00

> ⚠️ Esa hora es la del trabajo de esta sesión, no una lectura de reloj — criterio R14.

**Alcance: MEDIR Y REPORTAR.** Cero líneas de producto. **Cero líneas de test.** Lo único que
cambia en el árbol es esta entrada.

---

## 0 · Obligación 0, con la prueba dura y no con un tablero

El encargo llegaba como si SCRUM-640 estuviera por hacer. **No lo estaba**, y eso no se comprueba
leyendo un resumen en prosa (R2):

| Prueba | Resultado |
|---|---|
| `git ls-remote --heads origin` completo (542 ramas) | **una sola** del número: `scrum-640-tests-que-miden-la-maquina` |
| `git merge-base --is-ancestor f67d9449 origin/main` | **sí** — la punta de esa rama es ancestro de `main` |
| El merge | `c3108665` · PR **#889** · **2-sep-2026** |
| La entrada | `docs/master/SCRUM-640.md`, ya escrita (lo que hay encima de este apéndice) |

**Y la parte fiscal que 640 dejó PROPUESTA también está ejecutada**, por SCRUM-643 fase ③
(`6a67c8b9`): `src/core/zonaDelMerchant.ts` como sitio único, `calcularSemaforo(limite, hoy,
zona)`, `mesNaturalEn`, `inicioDelDiaEn`/`finDelDiaEn`. Los tres tests fiscales fijan hoy
`Europe/Madrid` **a mano**, y su propio comentario cita este ticket por su número.

> El reparto del encargo («tres no fiscales + dos fiscales») sigue sin coincidir con lo medido
> (2 + 3). Eso ya se declaró en §0 de esta misma entrada el 1-sep-2026; no se vuelve a discutir.

## 1 · La tabla de cinco zonas, RE-MEDIDA hoy sobre `main`

`TZ` va como **entorno de un proceso hijo**; el prefijo `TZ=x node` de Git Bash **no funciona**, y
el medidor lo comprueba antes de medir nada (sonda: `Intl…resolvedOptions().timeZone` en el hijo
devuelve las cinco zonas pedidas, o se declara **CIEGO** y no imprime tabla).

| Fichero (prueba del encargo) | Madrid | London | UTC | New_York | Tokyo |
|---|---|---|---|---|---|
| `scrum300-albaran-campos` | 9 · 0 | 9 · 0 | 9 · 0 | 9 · 0 | 9 · 0 |
| `scrum397-fecha-real-de-cobro` | 10 · 0 | 10 · 0 | 10 · 0 | 10 · 0 | 10 · 0 |
| `scrum69-pendientes-facturar` (`calcularSemaforo`) | 6 · 0 | 6 · 0 | 6 · 0 | 6 · 0 | 6 · 0 |
| `scrum70-consolidacion-cliente` (las **dos** de SCRUM-70) | 9 · 0 | 9 · 0 | 9 · 0 | 9 · 0 | 9 · 0 |

**Los cinco pasan en las cinco.** ✅ **Y en UTC siguen pasando**, que es el control que exigía el
encargo: si arreglarlos hubiera roto UTC, se habría cambiado el producto en vez del test.

## 2 · 🔴 CONTROL POSITIVO — el instrumento SÍ ve el rojo

Un verde sólo vale si el mismo aparato es capaz de dar rojo. Se sacan las versiones **anteriores
al arreglo** (`f67d9449^`) y se corren por el mismo camino:

| | Madrid | London | UTC | New_York | Tokyo |
|---|---|---|---|---|---|
| `scrum300` **viejo** | 7 · 0 | 7 · 0 | 7 · 0 | **6 · 1** 🔴 | 7 · 0 |
| `scrum397` **viejo** | 9 · 0 | 9 · 0 | 9 · 0 | **8 · 1** 🔴 | 9 · 0 |

Caen nombrándose: *«SCRUM-300 · la FECHA DE ENTREGA sale impresa…»* y *«SCRUM-397 · una fecha
FUTURA se rechaza…»*. Es exactamente el síntoma del encargo: **verdes en UTC, rojos con desfase
negativo**.

**Por qué esa comparación es legítima:** `f67d9449` tocó `docs/master/SCRUM-640.md` y **dos
ficheros de `tests/`, y ninguno de `src/`** (medido con `git show --stat`), así que la versión
vieja del test corre contra el producto de hoy sin mezclar dos cambios.

**Límite declarado:** el producto de hoy no es el de entonces; lo que este control demuestra es
que **el medidor ve el rojo**, no la historia exacta del 1-sep.

## 3 · El censo · **3**, y NO son los cinco

Suite entera (**710 ficheros · 5.838 pruebas**) en tres zonas extremas, anotando qué prueba
**cambia de veredicto**:

| `TZ` | tests | pass | fail |
|---|---|---|---|
| `Pacific/Kiritimati` (+14) | 5838 | 5736 | **0** |
| `UTC` (el runner de CI) | 5838 | 5736 | **0** |
| `Pacific/Midway` (−11) | 5838 | 5733 | **3** |

**CAMBIAN DE VEREDICTO: 3.** Ninguna es de las cinco del encargo:

| Prueba | Fichero | Cae en |
|---|---|---|
| `allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie` | `quoteNumber.test.mjs` | New_York · Midway |
| `SCRUM-592 · una mezcla de renumerados y sin renumerar no se pisa` | `scrum592-numeracion-doc02.test.mjs` | New_York · Midway |
| `SCRUM-592 · el display se DERIVA: no hay columna de texto que pueda discrepar` | `scrum592-numeracion-doc02.test.mjs` | New_York · Midway |

Las tres, **aisladas fichero a fichero** en seis zonas: verdes en Madrid, London, UTC y Tokyo;
rojas en New_York (−5/−4) y Midway (−11). Reproducible, no un cruce entre ficheros.

**CONTROL POSITIVO DEL CENSO** (porque un censo que da un número sin haber demostrado que ve algo
no es una medida): el mismo barrido, con la misma regla de «cambia de veredicto», sobre un juego
de cinco ficheros que **incluye las dos copias pre-arreglo** → devuelve **2**, y las **nombra**.
Sin eso, el 3 de arriba no valdría.

### 🔴 Y esto es lo que importa: **la familia volvió a crecer, y lo hizo DOS DÍAS DESPUÉS**

| Hecho | Commit | Fecha |
|---|---|---|
| SCRUM-640 se mezcla en `main` | `c3108665` (PR #889) | **2-sep-2026** |
| SCRUM-592 (DOC-02) crea los tres | `271e461f` | **4-sep-2026** |

`scrum592-numeracion-doc02.test.mjs` **nace** en ese commit y `quoteNumber.test.mjs` **se
reescribe entero** en ese commit. O sea: el defecto no sobrevivió a 640 — **volvió a entrar por un
ticket posterior**.

**Y nada lo impide.** Medido: en el árbol de hoy **ningún test ni script corre la suite en más de
una zona**; el censo de 640 (§3) fue una medición de una vez, no un trinquete. Un instrumento que
sólo se pasa cuando alguien se acuerda es lo que esta casa llama *vigilar* en vez de *hacer
imposible*.

## 4 · 🔴 ¿MIENTE EL TEST o ESTÁ MAL EL PRODUCTO? — las dos respuestas, por separado

**MIENTE EL TEST: sí, los tres.** El fixture es `new Date('2027-01-01')` —medianoche **UTC**—
mientras el producto lee componentes **locales**. Con desfase negativo ese instante es el
31-dic-2026, así que la serie no reinicia y sale `P260003` donde el test espera `P270001`. Dos
convenciones mezcladas: el mismo defecto de §1.1 y §1.2 de esta entrada.

**ESTÁ MAL EL PRODUCTO: sí — y YA ESTÁ REGISTRADO, no es un hallazgo nuevo.** El año de la serie
sale de `now.getFullYear()`, o sea del reloj de la máquina:

* `quoteNumber.service.ts:77,100` · `albaranNumber.service.ts:115` · **`invoiceNumber.service.ts:282`**

Los tres están censados en **`docs/master/SCRUM-643.md` §A** («el **año de la serie** → la
numeración correlativa»), **medidos y PARADOS esperando al fundador**. Este apéndice no los
re-descubre: confirma que **el hueco sigue abierto y que ahora hay tres tests que lo tocan**.

**La ventana:** el 1 de enero entre las 00:00 y la 01:00 hora peninsular (enero es invierno, +1),
un documento creado en España recibe el número de la serie del **año anterior**. En `invoice` eso
es numeración fiscal.

## 5 · Lo que propongo, sin ejecutarlo

**Por qué NO arreglo los tres aquí, aunque el arreglo cabría en cuatro líneas:** hoy esos tres
rojos son **la única evidencia automática** del defecto que SCRUM-643 §A dejó registrado y sin
decidir. Fijarles la zona los deja verdes en las cinco — y **apaga la alarma antes de que el
fundador haya decidido**. Un test que cambia de veredicto sobre numeración fiscal es exactamente
la parte del encargo que dice *PROPÓN Y PARA*.

**Si hay GO, el método ya existe y está probado dos veces** (§1.1 de esta entrada, y lo que
SCRUM-643 hizo con `scrum69`/`scrum70`):

1. La zona **escrita a mano** en el fichero, y **es la de la máquina donde ese código corre de
   verdad**: `allocateQuoteNumber` corre en el **servidor**.
2. Un test de **CARACTERIZACIÓN** al lado, que afirme la verdad medida —el año de la serie sale
   del reloj del proceso— para que el fixture arreglado **no esconda** lo que 643 §A dejó abierto.
3. El **trinquete que falta**: algo que cuente cuántas pruebas cambian de veredicto entre dos
   zonas extremas y caiga si el número **sube**. Es lo único que convierte «lo arreglamos otra
   vez» en «no puede volver a entrar». Va **fuera de `npm test`** (una pasada son ~10 min), como
   `meta:mutaciones`.

## 6 · 🔴 HALLAZGO APARTE · un test que mide **CÓMO SE ESCRIBE** la ruta donde corre

Salió de rebote: mi primer censo daba **un cuarto rojo**, `scrum784 · 🔴 la ruta se compara
RESUELTA, no por texto`, caído en **las tres** zonas. No es dependencia de zona — y ésa es
justamente la razón por la que el censo **no lo contó**. La causa, medida:

| `cwd` con el que se lanza el runner | Veredicto |
|---|---|
| `C:/Users/…/cobroflash-b3` (unidad **mayúscula**) | **fail 0** ✅ |
| `c:/Users/…/cobroflash-b3` (unidad **minúscula**) | **fail 1** 🔴 |

`RUTA_YO` sale de `import.meta.url`, así que **hereda la grafía de la invocación**. Con la unidad
ya en minúscula, `enMinuscula === RUTA_YO` y salta el **SUELO** del propio test: *«hay letra de
unidad y aun así las dos rutas salen iguales: el caso no prueba nada»*.

**No es un defecto de producto ni una mentira del test:** es el suelo haciendo exactamente su
trabajo — negarse a dar verde sobre un caso que no ha podido construir. Lo que sí queda
**asimétrico**, y se deja escrito para quien decida:

* en **Linux** la misma situación («aquí ese caso no existe») se **DECLARA** — `t.diagnostic(...)`
  y `return`, sin `skip` silencioso;
* en **Windows con la unidad en minúscula** la misma situación es un **ROJO duro**.

Y el aviso de vuelta, que me toca a mí: **mi propio medidor pasaba el `cwd` en minúscula**. El
censo se rehízo entero con la grafía correcta, y es el número del §3 el que vale.

## 7 · Entrega

```
tanda   ·  5.838 tests · 5.736 pass · 0 fail · 102 skipped · exit 0
meta    ·  vivas 144 · mudas 0 · ciegas 0 · ficheros muertos 0 · exit 0
censo   ·  710 ficheros × 3 zonas · cambian de veredicto: 3 (control positivo: 2, nombradas)
árbol   ·  limpio tras `meta:mutaciones` (SCRUM-808: nada quedó mutado dentro)
```

**Lo que NO se ha tocado:** ni una línea de `src/`, ni de `tests/`, ni `prisma/schema.prisma`, ni
los otros sitios de la caducidad (SCRUM-633). Nada contra producción ni contra staging.
