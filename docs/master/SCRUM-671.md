# SCRUM-671 · El segundo guard que medía reloj de pared, y el censo del patrón

**Medido contra:** `origin/main` = `4b3865f8201fe24fe367f45c4f6fba34933a1de0` · 2026-09-02T20:15:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-671-tramos-sin-reloj` · 8 núcleos

## PARTE A · scrum642

### 1 · Reproducido, no supuesto

| | exit | resultado |
|---|---|---|
| aislado | **0** | 9/9 · 3.549 ms |
| suite entera (sin carga añadida) | **0** | 4471 tests, 0 fail — **no salió por suerte** |
| aislado **con 16 procesos de carga** (8 núcleos) | **1** | 8/9 |

Esperar a que salga solo no es reproducir, así que se forzó la condición. Lo que imprime el rojo
es todo el diagnóstico:

    actual:   ⟦arranque⟧ 0.9 s COMPLETA · proceso+ws 0.8 s · primera-página 0.1 s
    expected: /primera-página 0\.0/

**EL REPARTO ERA CORRECTO Y EL GUARD LO LLAMABA ROTO.** Se le metieron 0,7 s al primer tramo y el
primer tramo se los quedó (0,8). El otro salió 0,1 porque la máquina le robó CPU, y el aserto
exigía un literal `0.0`. El defecto no estaba en el código medido: estaba en el aserto.

### 2 · Qué protegía, antes de reescribirlo — y qué vigila ahora, en una frase

Protegía que **la marca de arranque diga DÓNDE se fue el tiempo y no sólo cuánto**: que 0,7 s
metidos en un tramo aparezcan en ESE tramo y no en el otro. Eso sigue igual.

> **El hecho que vigila ahora:** que el tiempo transcurrido en cada fase se ATRIBUYA a su tramo —
> comprobado con un reloj que pone el test, así que el veredicto es el mismo con la máquina vacía
> y con la máquina llena.

Lo que se ha tirado no es el hecho: es el PROXY. «Este tramo tarda entre 0,5 y 0,9 s» era una
propiedad de la máquina; «estos 700 ms se han contado en este tramo» es una propiedad del código.

### 3 · La cura: el reloj se recibe, igual que ya se recibía puppeteer

`lanzarNavegador(puppeteer, opciones = {}, ahora = Date.now)`. Las seis lecturas del reloj pasan
por el inyectado; **cero `Date.now()` dentro de la función**. En producción no cambia nada: el
tercero es opcional y ningún llamador lo pasa.

El doble del test ya no duerme de verdad: **avanza un contador**. Así el reparto se comprueba
exacto (`proceso+ws 0.7 s · primera-página 0.0 s`) sin depender de nada externo.

| | antes | después |
|---|---|---|
| aserciones sobre reloj de pared | 3 | **0** |
| duración del fichero, aislado | 3.549 ms | **505 ms** |
| con **24** procesos de carga (3× núcleos) | — | **9/9, exit 0** |

Y desaparece la tolerancia `Math.abs(a-b) <= 0.3` de los totales: existía sólo para absorber el
ruido de la máquina. Ahora son **idénticos**.

## PARTE B · EL CENSO

### Alcance — declarado, y comprobado

**Qué se barrió:** los **1.974 ficheros seguidos por git**, filtrados a extensión de código
(`.mjs .js .cjs .ts .tsx .sh`) → **1.182 candidatos, 1.182 leídos de verdad**.
Por carpeta: `tests=638 · src=257 · scripts=103 · public=74 · .claude=55 · .agents=53 · .codex=1 ·
prisma=1`. `node_modules`, `dist` y `.git` quedan fuera por construcción: git no los sigue.

**Patrones:** `Date.now` · `performance.now` · `process.hrtime` · `setTimeout(x, N)` con N>0 ·
`timeout:` con literal · número decimal dentro del patrón asertado + señal de tiempo en el
contexto (`s`, `ms`, `tramo`, `arranque`, `tardó`, `≥N`).

**Suelo del alcance:** el censo **falla y no imprime nada** si no llega a tres controles conocidos
(`scripts/_navegador.mjs`, `scrum642`, `scrum351`) o si lee menos de 300 ficheros. Un «no hay» de
un barrido corto sería «no miré» — que es lo que me pasó en SCRUM-651.

### 🔴 Y el instrumento falló dos veces antes de servir. Las dos van escritas

1. **La primera versión NO habría cazado scrum642.** Sólo veía «cronómetro + umbral numérico»
   (`ms < 8000`), y la forma de scrum642 era **un regex contra una duración ya impresa**
   (`assert.match(linea, /proceso\+ws 0\.[5-9]/)`). Lo destapó pasarle la versión PRE-CURA del
   propio fichero: **el censo del patrón no veía el caso que motivó el ticket.**
2. **La corrección se pasó al otro lado:** el grupo 1 saltó de 5 a **61**, casi todo falso —
   fechas ISO, importes (`100.00`), `process.exit(1)`. Un censo con 56 falsos no es un censo.
   Se apretó exigiendo decimal EN el patrón **y** señal de tiempo en el contexto: **15**, de los
   que 4 siguen siendo falsos y van marcados abajo.

### GRUPO 1 · asertan sobre una duración medida → **el veredicto depende de la carga**

| fichero:línea | aserción | ¿depende de la carga? |
|---|---|---|
| `tests/scrum362-residuales.test.mjs:303` | `assert.ok(ms < 8000)` sobre 5 pasadas reales | **SÍ** — mismo mecanismo exacto que scrum351 y scrum642. Su propio comentario cita SCRUM-351 |
| `tests/scrum501-una-fila-por-envio.test.mjs:171` | `assert.ok(tardado < 2_000)` con la base sin contestar | **SÍ**, con margen ancho (plazo 40 ms contra tope 2.000): cae más tarde, pero cae |
| `tests/scrum642-…:121,123,129,131` | `assert.match(linea, /… 0\.7 s/)` | **NO — curado en este ticket** (reloj inyectado) |
| `tests/scrum645-la-puerta-no-tira-los-tramos.test.mjs:75,85` | `/19\.2 s/`, `/≥30\.0 s/` | **NO** — falso positivo: lee una FIXTURE de texto, no una medida |
| `scrum216:315` · `scrum249:192` · `scrum457:64` · `scrum666:163` | importe `100.00`, fecha ISO, precio `4.20`, ratio `0.4–0.9` | **NO** — falsos positivos, no hay tiempo |

**Pendientes de verdad: DOS** (`scrum362`, `scrum501`). No se tocan: esto es censo.

### GRUPO 2 · no asertan tiempo, pero **MUEREN** si la máquina va lenta — 45 líneas

Forma distinta y por eso va aparte: no juzgan una duración, se quedan sin plazo.

* **`scripts/guard-contraste.mjs:278-279` — el tercer caso, SCRUM-673, de otra sesión.**
  `page.goto(…, { timeout: 15000 })` y `setTimeout(r, 600)` por ruta, más el tope de arranque de
  `lanzarNavegador`. **No aserta ninguna duración**: se muere. Se reporta y **no se toca**.
* Esperas reales en tests: `scrum448` (6), `scrum451` (6), `bot-suite` (5, con dos de 1.500 ms),
  `scrum268-espera-automatica` (2 de **60.000 ms**), `scrum358` (×2), `scrum460`, `scrum50`,
  `scrum620`…
* Topes de red en producción: `src/integrations/whatsapp.ts:141,149` (15 s y 20 s) y
  `scripts/capture-demo.mjs` (3 × 45 s).

### GRUPO 3 · usan el reloj y NO juzgan con él

`Date.now()` para ids únicos, `setTimeout(…, 0)` para ceder el turno, `timeout:` de configuración.
**No dependen de la carga en su veredicto.** Se cuentan y no se listan uno a uno: son el ruido que
hay que separar para que los otros dos grupos signifiquen algo. **Las categorías suman el total.**

## Lo que NO se ha tocado

`prisma/schema.prisma` · `scripts/guards-visuales.mjs` · `guard-contraste.mjs` (SCRUM-673, otra
sesión) · los dos pendientes del grupo 1 (es censo, no arreglo).
