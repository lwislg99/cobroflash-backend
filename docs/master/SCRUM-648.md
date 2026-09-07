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

---

# FASE B · Ejecutar la decisión C: ámbar con el motivo al lado

**Medido contra:** `origin/main` = `f707619865a5be86988a4d34b9b0e97b4449169b` · 2026-09-05T01:17:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** ejecutar la decisión C del fundador. Un plazo que **no se puede comprobar** sale
**ámbar**, con el **motivo** al lado. **No se construye un cuarto estado** (regla 27) y **no se
toca el `||` de `invoicesView`** (SCRUM-748, de otra sesión).

---

## B1 · Lo que se decidió, y por qué no es ninguno de los otros

Verde se le pinta al profesional como **«AL DÍA»** — «no tienes nada que hacer»— sobre un plazo
legal que nadie ha podido calcular. **Las dos equivocaciones no cuestan lo mismo** (criterio de
S1 en SCRUM-639): decir «al día» cuando no se sabe **oculta** un plazo fiscal; decir «mira esto»
cuesta una mirada.

**Y no es rojo:** «plazo vencido» tampoco es cierto. Es el mismo razonamiento con el que
SCRUM-622 resolvió el color del toast — *«ni rojo: un kind desconocido tampoco afirma que haya
fallado»*.

**`Semaforo` sigue siendo el union cerrado de tres.** Lo que se añade es `MotivoSemaforo`
(`plazo` | `no_computable`), que no es un estado: es **por qué** el semáforo dice lo que dice.
`ambar` pasa a significar dos cosas, comparten color porque **la acción correcta es la misma**
—mirar esto—, pero **el porqué no se comparte**: sin él, el profesional no sabe si tiene que
facturar o si tiene que revisar un dato.

## B2 · 🔴 LA CAJA, MEDIDA — y con texto dentro

`npm run guard:caja-semaforo`. Fuera de `npm test` por la misma decisión que los otros nueve
guards de navegador: la suite no arranca un navegador.

| Viewport | Sidebar | Ancho útil de la línea | El candidato (35 car.) |
|---|---|---|---|
| **929 px** | 248 px | **559 px** | **1 línea** (20,1 px) |
| **390 px** | oculto | **292 px** | **1 línea** (20,1 px) |

**Se midió CON TEXTO DENTRO**, que era la lección de S1: una caja vacía computa **0 px de alto** y
ese cero se leería como «no cabe nada», que es exactamente lo contrario.

**Referencia**: la microcopy YA APROBADA de SCRUM-171b (56 caracteres) ocupa **2 líneas a 390 px**
— o sea, dos líneas no es un defecto en esta card; simplemente deja de estar medido.

**En 390 px caben 50 caracteres en una línea.** De ahí sale el tope.

### ⚠️ Dos correcciones a la propia medida

1. **Mi primer control negativo no servía.** Era `'X'.repeat(300)`: una palabra sin espacios **no
   se puede partir**, así que el navegador la desborda en UNA línea y el detector medía lo mismo
   que el candidato. **El rojo que no sale acusa al caso, no al detector.** Cambiado a una frase
   con espacios: 161 caracteres → 2 líneas a 929 y 4 a 390.
2. **El candidato son 35 caracteres, no 34.** Cabe igual, pero el número que se ata tiene que ser
   el real.

### Y el navegador con el que se midió

**Edge —el de la casa— no arranca en este entorno**: el helper de SCRUM-522 lo dice con todas las
letras (*«el navegador ESTÁ y no levanta»*, salida 3 = NO MEDIDO). Comprobado que **le pasa a los
diez**, no sólo al mío: `npm run censo:guards-navegador` da `rojo(3)` en los diez.

La medida se tomó con **Chromium**, apuntando **al servidor de este mismo guard** —modo
`--servir`—, así que la página medida es byte a byte la del fichero y no una copia que se
quedaría vieja. La propia doctrina de `_navegador.mjs` lo contempla: *«Chrome y Chromium después:
comparten motor, así que un veredicto suyo vale, pero conviene saber cuál contestó»*. **Contestó
Chromium, y queda dicho.**

## B3 · El TOPE, atado como en SCRUM-684

**50 caracteres.** No dice «no crezcas»: dice **vuelve a medir antes de pintarlo**. Por encima, el
motivo pasa a dos líneas y **deja de estar medido**.

Lleva su propio suelo: si el tope fuera enorme no vigilaría nada.

### 🔴 Y el tope se probó mal la primera vez

La mutación con un texto de **49** caracteres —que está **dentro** del tope— tumbaba el test
igual que uno de 53, porque la aserción de igualdad («es el candidato») se evaluaba **antes**. O
sea: **el rojo no distinguía «se pasó» de «cambió»**. Reordenado, y reprobado:

| Texto | Cae por |
|---|---|
| 53 caracteres | **PASADO DEL TOPE MEDIDO** |
| 49 caracteres | **no es el candidato** |

## B4 · Microcopy: marcador, y el censo sube A CONCIENCIA

El texto se pinta con **`[PENDIENTE microcopy oficial]`** delante hasta que el fundador firme
(regla 30). La grafía es la que **cuenta** el censo de SCRUM-402, y **el censo sube**:
`invoicesView.js: 1`, declarado con su motivo, su caja medida y su árbol.

**El mecanismo no existe sin texto** — el mismo criterio con el que entraron `jobNuevoModal.js` y
`jobAsignados.js`: una línea de motivo sin texto no distingue nada, y entonces el ámbar vuelve a
significar dos cosas sin decir cuál.

**El día que se firme el rótulo, la entrada se BORRA — no se pone a 0.**

## B5 · Cuatro guards ajenos me corrigieron, y los cuatro tenían razón

| Guard | Qué pidió |
|---|---|
| **SCRUM-411** | quitar el `export` a `evaluarSemaforo` — su único consumidor está dentro del módulo. El test pasa a medir por la **superficie pública** |
| **SCRUM-522** | declarar el guard nuevo: **9 → 10** guards fuera de la tanda |
| **SCRUM-548** | declararlo como **destino no derivable**: sirve una ruta virtual, igual que `caja-avisos`, para que su hueco no se lea como «no solapa» |
| **SCRUM-402** | declarar el marcador, que es de lo que va la regla 30 |

## B6 · Dos caracterizaciones cayeron al ejecutar la decisión

Y **no se borran: se convierten en la afirmación del arreglo**, con su historia dentro.

* **SCRUM-622** decía: *«una entrada que no se sabe leer da VERDE»*, y añadía *«si esto cambia,
  alguien ha decidido qué se pinta cuando no se sabe: bien, pero que conste con su decisión»*.
  **Pues consta.**
* **El control positivo de la fase A de 648** afirmaba que los siete ilegibles salían verde. Era
  cierto, y era el defecto.

## B7 · Probado en ROJO, por el mecanismo

| Mutación | Qué cae |
|---|---|
| el ilegible vuelve a **verde** | **tres** tests, de **tres ficheros** — la decisión está atada en tres sitios |
| el texto crece a 53 caracteres | el tope, **nombrando** que se pasó de lo medido |
| el texto cambia pero cabe (49) | «no es el candidato» — **no** el tope |
| se pinta **sin** el marcador | el censo de SCRUM-402 **y** el test del marcador |

Los ficheros mutados quedaron **idénticos byte a byte** al original leído de disco.

## B8 · Lo que NO se ha tocado

* **El `||` de `invoicesView`**: es SCRUM-748 y lo lleva S5. Con la decisión C **no dispara**,
  porque el servidor sigue emitiendo sólo los tres estados de siempre — y hay un test aquí que
  vigila que siga en su sitio.
* **No hay cuarto estado.** Regla 27.
* **No se ha firmado ningún texto.** El candidato queda medido y esperando.

## B9 · Huecos declarados

* **La medida es de Chromium, no de Edge**, porque Edge no arranca en este entorno. Mismo motor,
  pero no es el navegador sobre el que se midió todo lo demás de la casa.
* **La página de medida REPRODUCE la card**, no la pinta con `renderGrupoCard` — esa función vive
  dentro de un IIFE y no es alcanzable desde fuera. Se replicaron los contenedores que deciden el
  ancho (`.layout`, `.sidebar`, `.main`, `.view-container`, `.data-card-body`, la card con su
  `padding:16px`) y se comprobó que el CSS del árbol **se aplicó**; pero si alguien cambia el
  marcado de la card, esta página no se entera sola.
* **No se ha medido a 320 px**, que es el ancho más estrecho que soporta la casa. El fundador
  pidió 929 y 390.
* **`guard:caja-semaforo` no se ha podido ejecutar de punta a punta en este entorno** (Edge). Su
  lógica de suelos y control negativo está escrita y ejercitada por partes, pero **no ha dado un
  veredicto completo aquí**.
