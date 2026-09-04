# SCRUM-648 · «AL DÍA» cuando el sistema no ha podido saberlo

**Medido contra:** `origin/main` = `b74f523910fdb371c098a7f265a5a60e0eae3425` · 2026-09-05T00:00:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance: MEDIR Y PROPONER, NO DECIDIR.** No se toca `calcularSemaforo`, ni `invoicesView.js`,
ni ningún fichero de `src/` o `public/`. **Cero microcopy: no se inventa ningún rótulo, así que
no se pinta marcador y el censo de SCRUM-402 no sube.**

---

## 1 · PASO 0 — la superficie es más estrecha de lo que parecía

| | |
|---|---|
| Llamadores de `calcularSemaforo` en producción | **uno**: `pendientesFacturar.service.ts:258` |
| Productores del límite que recibe | **uno**: `fechaLimiteRecapitulativa` |
| Entrada del usuario | `GET /admin/albaranes/pendientes-facturar` → panel «Pendientes» |

Que haya **un** llamador y **un** productor es lo que hace la pregunta contestable: no hay que
auditar el árbol entero, hay que apretar una función.

## 2 · 🔴 CONTROL POSITIVO PRIMERO — porque sin él un cero no vale

Inyectando a `calcularSemaforo` **siete** límites que nadie puede leer —cadena vacía, texto, un
`Date`, `null`, `undefined`, un número y una fecha invertida— **los siete salen `verde`**.

**El defecto se reproduce forzándolo.** Por eso el cero de la sección siguiente significa «no hay
camino» y no «no supe mirar», que es exactamente la distinción que pedía el encargo.

Y el contraste que hace significativo ese verde: con límites legibles se alcanzan los tres
estados (vencido → `rojo`, hoy → `ambar`, +6 días → `verde`).

## 3 · La medición: hoy NO es alcanzable por el camino real

**34 combinaciones** (17 `mesKey` degenerados × 2 tipos de destinatario) contra el único productor:

| Resultado | Cuántas |
|---|---|
| **LANZA `RangeError`** — camino cerrado, falla ruidosamente | 18 |
| Devuelve un día **legible** | 16 |
| Devuelve un día **ilegible** | **0** |

`new Date(NaN).toISOString()` lanza, así que un `mesKey` que no se pueda parsear **revienta** en
vez de colarse. **El defecto del ticket es real pero LATENTE** por el camino de la bandeja.

### ⚠️ Y aun así el ticket no baja de prioridad, por lo que ya pasó

SCRUM-643 lo alcanzó **de verdad**: un llamador que no se actualizó a la firma nueva pasó un
`Date` donde se esperaba un día ISO, y salió `verde` **801 veces**. La puerta real no es una
fecha corrupta en la base: **es una firma mal usada**, y ésa se abre sola cada vez que alguien
toca la función.

## 4 · 🔴 EL HALLAZGO, y es PEOR que el defecto del ticket

`fechaLimiteRecapitulativa` **no valida su entrada**: pasa los números a `Date.UTC`, que
**normaliza en silencio**.

| `mesKey` | Límite que devuelve | Semáforo |
|---|---|---|
| `2026-13` (mes 13, imposible) | `2027-01-31` | **verde** |
| `2026-00` (mes 0) | `2025-12-31` | rojo |
| `99999-99` | año `+100007` | **verde** |

**No da un ilegible: da un plazo plausible y equivocado.** Y eso es peor, porque **contra un
ilegible se puede programar una barrera —es detectable— y contra un plazo plausible no hay
síntoma**: el número es finito, el semáforo es correcto para ese número, y el número es de otro
mes.

Tampoco es alcanzable hoy (`mesKey` sale de `mesNaturalEn`, que sólo produce `YYYY-MM` bien
formado), así que **se mide y se nombra, no se arregla**: validar la entrada de un cálculo de
plazo legal no es un cambio que se cuele en un ticket de medición.

## 5 · 🔴 EL COSTE ASIMÉTRICO ESTÁ EN LA CAPA QUE NADIE MIRÓ

`public/dashboard/js/invoicesView.js`:

```js
const SEMAFORO_META = {
  verde: { … label: 'AL DÍA' },
  ambar: { … label: 'PLAZO PRÓXIMO' },
  rojo:  { … label: 'PLAZO VENCIDO' },
};
…
const meta = SEMAFORO_META[grupo.semaforo] || SEMAFORO_META.verde;
```

**El repliegue del navegador pinta «AL DÍA» cualquier estado que no reconozca.** O sea que el
defecto vive en **dos capas**, y manda la de abajo.

> ### 🔴 La consecuencia que ordena el trabajo
>
> **El día que el fundador apruebe un cuarto estado y el servidor lo emita, ese `||` lo pintaría
> «AL DÍA».** El mismo defecto, con más trabajo hecho y más difícil de ver.
>
> **El arreglo del navegador va ANTES o A LA VEZ que el del servidor. Nunca después.**

Aplicando el criterio de S1 en SCRUM-639: las dos equivocaciones no cuestan lo mismo. Decir «al
día» cuando no se sabe **oculta un plazo fiscal**; decir «mira esto» cuesta una mirada.

## 6 · Las salidas, SIN elegir

| | Qué hace | Estado nuevo | Microcopy | Lo que cuesta |
|---|---|---|---|---|
| **A · Lanzar** | fail-closed, como ya hace `fechaLimiteRecapitulativa` con basura | no | no | 🔴 la ruta tiene `try/catch` → **500** y el profesional pierde **la bandeja entera** por un grupo malo. Peor que un verde en un grupo |
| **B · `rojo`** | «PLAZO VENCIDO» | no | no | Afirma un hecho **falso**. En fiscal, afirmar un vencimiento que no consta tiene su propio precio |
| **C · `ambar`** | «PLAZO PRÓXIMO» | no | no | No afirma que venció; dice «mira esto». **Tampoco es exacto**, pero es la equivocación barata |
| **D · cuarto estado** | lo honesto: «no se ha podido calcular» | **sí** (regla 27) | **sí** (regla 30) | El más caro y el único que no miente. **Obliga a arreglar el navegador primero** |

### Mi recomendación, que no es una decisión

**C**, y por precedente medido de la casa, no por gusto: **SCRUM-622 resolvió el caso análogo
exactamente así** — un `kind` desconocido en el color del toast dejó de caer al verde de éxito y
pasó a **ámbar**, con este razonamiento textual: *«decir "todo bien" cuando no se sabe es la
cara; decir "mira esto", la barata. Ni rojo: un kind desconocido tampoco afirma que haya
fallado.»* Aquí el argumento es el mismo, un escalón más arriba.

**C no introduce nada nuevo, no sube el censo de microcopy y se puede hacer hoy.** **D** es más
honesto y sigue siendo el final bueno; **C** no lo impide, lo abarata.

**Y las dos, C y D, necesitan que el `||` del navegador deje de mandar a «AL DÍA» primero.**

## 7 · Lo que se construye, y es todo

`tests/scrum648-verde-que-no-sabe.test.mjs` — **4 tests, 4 verdes.** No arregla nada: ata la
medición.

**No repite nada de SCRUM-622**, que ya ató el union cerrado, el barrido de la función, el
service worker, el `fetch` y la caracterización del `Date`. **622 vigiló la SALIDA de
`calcularSemaforo`; esto vigila su ENTRADA**, que era la pregunta que faltaba.

### Probado en ROJO, por el mecanismo

| Mutación | Qué cae |
|---|---|
| el productor entrega un día ilegible para un `mesKey` | los **dos** tests que dependen de esa entrada, **nombrando** la entrada exacta |
| cambia el rótulo `'AL DÍA'` | el del navegador — es lo que mide el coste |
| aparece un **cuarto** estado en `SEMAFORO_META` | el censo, con el aviso de comprobar que el repliegue ya no manda a «AL DÍA» |

Los ficheros mutados quedaron **idénticos byte a byte** al original leído de disco.

## 8 · Huecos declarados

* **No he medido el camino del navegador en ejecución**, sólo leyendo el fichero. No sé si algún
  otro punto del front consume `semaforo` con otro repliegue.
* **17 `mesKey` degenerados no es exhaustivo.** Es un barrido a mano; podría faltar una forma que
  sí produzca un ilegible.
* **No he medido `avisoDeFacturacion`**, que recibe el mismo `semaforo` y decide si avisar. Si el
  semáforo miente, ese aviso también.
* **No sé qué pasa con un `mesKey` corrupto en base**: `mesNaturalEn` no puede producirlo hoy,
  pero no he auditado si alguna migración o import antiguo dejó filas con fechas raras.
