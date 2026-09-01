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
