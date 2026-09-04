# SCRUM-748 · Un «no lo sé» pintado como éxito

**Fecha:** 4-sep-2026 · **Carril:** producto / navegador · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `291b86739079a8b069992deb45fb876f944b8050` · 2026-09-05T00:05:00Z

---

## PASO 0

**ENTRADA:** Facturas → la bandeja «pendientes de facturar» →
[invoicesView.js:532](public/dashboard/js/invoicesView.js#L532). **MECANISMO:** el criterio correcto
ya existía en la casa — `invoiceStatusMeta` (`api.js:1118`) ante un estado sin mapear **no elige
uno**: construye una insignia neutra con el código a la vista. El trabajo era **copiarlo**.

---

## EL DEFECTO

```js
const meta = SEMAFORO_META[grupo.semaforo] || SEMAFORO_META.verde;
```

Cualquier estado que el servidor no supiera nombrar salía en pantalla como **«AL DÍA»**.

### ANTES — ejecutando esa misma línea con el mapa real del fichero

| `semaforo` | pintaba |
|---|---|
| `verde` / `ambar` / `rojo` | AL DÍA · PLAZO PRÓXIMO · PLAZO VENCIDO |
| `sin_datos` | 🔴 **AL DÍA** |
| `CUARTO_ESTADO` | 🔴 **AL DÍA** |
| `''` · `undefined` · `null` | 🔴 **AL DÍA** |

**Cinco de cinco.** El profesional lee que ese cliente está al corriente cuando lo que pasa es que
no sabemos qué le pasa.

### 🔴 Hoy no dispara, y aun así se cierra

El semáforo tiene tres estados y los tres están mapeados. Es **un guard que se abre solo**
(SCRUM-537) **con el disparador ya escrito en el plan**: el día que exista un cuarto estado —cuyo
único propósito sería no afirmar lo que no se sabe— el navegador lo convertiría en **la mentira
que ese estado venía a evitar**. Cerrarlo hoy es barato; el día que muerda, no.

---

## Lo construido

`metaDelSemaforo(semaforo)`: los tres conocidos, intactos. Lo desconocido se pinta con **marcador
y con su código a la vista** (`[PENDIENTE microcopy oficial] CUARTO_ESTADO`), en insignia neutra, y
avisa por `console.warn` — donde lo ve quien puede mapearlo, no quien está mirando si le deben
dinero.

**Es el reverso exacto de SCRUM-641**, y merece quedar escrito porque parecen contradecirse: en un
**aviso de error**, enseñar el código ES el defecto; en un **rótulo de estado**, esconderlo lo es.
La diferencia es qué está afirmando la pantalla.

### ⛔ Lo que NO se ha hecho

* **No se inventa el rótulo** (regla 30): va con marcador hasta que lo firme quien puede.
* **No se construye el cuarto estado** (regla 27): es del fundador. Esto sólo deja de mentir sobre él.
* **El censo de SCRUM-402 SUBE**, declarado: `invoicesView.js` entra con **1**. El trinquete me cazó
  la subida antes de que la declarara —`invoicesView.js (+1)`—, que es exactamente su trabajo.

**Orden respetado:** esto es **navegador** y va **antes** que cualquier cambio de servidor.

---

## 🔴 EL HALLAZGO: no eran tres, son SEIS

SCRUM-622 encontró uno, S4 encontró éste. El censo por AST destapa **cuatro más**.

| | |
|---|---:|
| población | **83** ficheros `.js` de `public/` |
| cota bruta (`MAPA[k] || <algo>`) | **47** |
| 🔴 **respaldos que AFIRMAN un estado** (`MAPA[k] || MAPA.algo`) | **6** |
| ✅ el patrón **honesto** (`MAPA[k] || k`, deja ver el código) | **14** |

**Los seis:**

| sitio | respaldo |
|---|---|
| `invoicesView.js:532` | `SEMAFORO_META.verde` ← **este ticket** |
| `api.js:1285` | `map.sent` |
| `api.js:1135` | `M.pendiente_agendar` |
| `jobsView.js:269` | `JOB_STATE_META.pendiente_agendar` |
| `parteDetailView.js:279` | `avisos.sin_lineas_reconocidas` |
| `expensesView.js:12` | `CATEGORY_LABELS.otros` |

🔴 **El más grave de los que quedan es `api.js:1285`:** un estado de entrega de WhatsApp que no se
sepa leer **se pinta como ENVIADO**. Es el mismo defecto sobre si un cliente recibió o no su
mensaje.

**No se arreglan aquí:** cada uno es de su carril (regla 9). Quedan **censados con trinquete**, que
aprieta también dentro de cada fichero: si uno gana otro respaldo, cae.

**Y la distinción es todo el censo:** `MAPA[k] || k` **no entra**. Devolver la clave deja ver el
código crudo — feo, pero honesto. Lo que se cuenta es elegir **otro valor del mismo mapa**, porque
eso convierte «no lo sé» en una **afirmación sobre el dominio**. La casa ya sabe hacerlo bien en 14
sitios; sólo que no en todas partes.

---

## El control

**DESPUÉS:** los tres conocidos intactos (rótulo **y** clase de insignia); los cinco desconocidos
con marcador y su código, y ninguno termina en un espacio colgando.

**CONTROL NEGATIVO:** los tres rótulos aprobados **no se mueven ni ganan marcador**. Moverlos sería
una regresión peor que el defecto: son textos firmados que el profesional ya reconoce.

**SUELO del detector del censo:** encuentra la forma exacta, y **no acusa** a cinco formas legítimas
(`|| k`, `|| 0`, `|| {}`, `|| { label: String(k) }`, y un respaldo que no es acceso indexado).

### LOS ROJOS

| inyección | qué cae |
|---|---|
| ① la vista vuelve al `\|\| SEMAFORO_META.verde` | «la LÍNEA que decide ya no lleva el respaldo» **y** el censo |
| ② el decisor existe, pero vuelve a elegir verde | «NINGÚN estado desconocido se pinta AL DÍA» |

**Son dos y no una a propósito:** el arreglo tiene dos mitades que pueden romperse por separado —la
vista podría llamar al decisor bueno mientras el decisor se corrompe, o al revés— y una sola
mutación dejaría la otra sin probar. Revertidas, `git status` limpio, CR = 0.

### ✅ Y quedan DECLARADAS (regla nueva de SCRUM-745)

Las dos están escritas en `MUTACIONES_QUE_ME_TUMBAN`, y `npm run meta:mutaciones` las ejecuta:
**vivas 4 · mudas 0 · ciegas 0** (las dos de `scrum740` y estas dos). El meta-guard de esta misma
tarde ya está corriendo las declaraciones de este ticket.

> También toqué `scrum402`, pero **no está en el censo de mudez**: su única aparición de
> `soloEjecutable` es una **mención en un comentario** —comprobado por AST, no por texto—, que es
> exactamente la trampa ① que documentó SCRUM-719.

---

## Lo que NO cubre

1. **Los otros cinco respaldos siguen ahí.** Censados con trinquete, de otros carriles.
2. **El rótulo sigue sin firmar.** Lo dice `INV_SIN_APROBAR = 1` y el marcador en pantalla.
3. **No se ha medido el mismo patrón fuera de `public/dashboard/js/`** (landing, `sw.js`).
4. **El censo no cubre otras formas de respaldo que afirman**: un `if (!M[k]) return M.verde;`
   escrito a mano no lo vería, porque no es la expresión `||`. No hay ninguno hoy, pero no está
   vigilado.
5. **No se ha visto en el navegador.** El decisor se ejercita en el banco de vistas; la insignia
   pintada con el marcador no se ha medido a 929/390 px como en SCRUM-641.

## HALLAZGOS FUERA DE ALCANCE

* `api.js:1285` — `map[…] || map.sent`: un estado de entrega desconocido se pinta como **ENVIADO**.
  Es el mismo defecto y toca si un cliente recibió su mensaje.
* Los otros cuatro de la tabla.

## Ficheros

* `public/dashboard/js/invoicesView.js` — `metaDelSemaforo`, el marcador y `INV_SIN_APROBAR`.
* `tests/scrum748-no-lo-se-no-es-al-dia.test.mjs` — **nuevo**, 7 tests + las dos mutaciones declaradas.
* `tests/scrum402-marcador-no-se-pinta.test.mjs` — el censo sube: `invoicesView.js: 1`, con motivo.
