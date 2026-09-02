# SCRUM-679 · Los dos últimos asertos sobre duración medida. La familia queda a CERO

**Medido contra:** `origin/main` = `7bdb3a9012fd5f53dc5f2f44f4939b20964397b0` · 2026-09-02T22:40:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-679-cero-asertos-de-reloj` · 8 núcleos

## LO QUE QUERÍA MEDIR CADA UNO — leído del código y de su comentario

### 1 · `scrum362-residuales.test.mjs:303` — `ms < 8000`

Su comentario lo dice: *«si esto se nota en la tanda, el banco se desactiva al primer roce y
entonces no comprueba nada (SCRUM-351)»*. **El hecho no es «tarda menos de 8 s»** —eso es una
propiedad de la máquina—: es que **el banco sea barato**, y en concreto que **el escenario nuevo no
cueste más que el de siempre**.

Eso se cuenta. **Medido: 143 operaciones de disco por pasada**, idénticas en los dos escenarios y
constantes entre pasadas.

> Se afirma la **COMPARACIÓN**, no un absoluto. Un `=== 143` caducaría en cuanto otra rama añadiera
> un `<script>` al dashboard — trabajo legítimo que no encarece este banco. Lo que no puede pasar
> es que el escenario NUEVO cueste más que el normal, ni que crezca de una pasada a otra.

⚠️ **Calentamiento descartado a propósito:** la primerísima carga paga la resolución de módulos
(+2 ops, medidas: 145 y luego 143 fijo). Ese coste no es del escenario, así que la primera pasada
se tira. Sin eso, el aserto sería no determinista en la primera vuelta.

### 2 · `scrum501-una-fila-por-envio.test.mjs:171` — `tardado < 2_000`

**El hecho es que al llamador lo suelta EL PLAZO, no la escritura.** «Tardó poco» era el proxy.

Y tenías razón en que éste era el peligroso, y por lo contrario de lo que parece: 40 ms reales
contra un tope de 2.000 **no caen casi nunca**, así que el intermitente no se elimina — se
**aplaza**, y cuando por fin sale es en la rama de otra sesión, sin relación con lo que tocó. Un
intermitente con mucho margen es un intermitente al que además le hemos quitado el contexto.

## LA CURA: la misma de ayer — el temporizador SE RECIBE

`registrarEnvio` acepta `temporizar?: (fn, ms) => () => void`, que **devuelve su propia
cancelación** (hacía falta: el `finally` llamaba a `clearTimeout`). Por defecto, el de siempre:
`setTimeout` con su `unref`. En producción no cambia nada y ningún llamador lo pasa.

Y el test nuevo prueba **más** de lo que probaba el reloj:

| | reloj (antes) | mecanismo (ahora) |
|---|---|---|
| el plazo programado es el que se pidió | no | **sí** (`msPedidos === 40`) |
| **antes** de vencer NO suelta al llamador | **no** | **sí** |
| al vencer, suelta y no espera a la escritura | indirecto | sí |
| el temporizador se cancela al salir | no | **sí** (si no, una fuga por envío) |

## VERIFICACIÓN

**CONTROL POSITIVO CON LA MÁQUINA CARGADA** — 16 procesos en 8 núcleos, que es la condición en la
que caía la familia. Aislado y en calma no vale: es el caso que ya funcionaba.

| | exit | resultado |
|---|---|---|
| máquina vacía | **0** | 23/23 |
| máquina cargada, pasada 1 | **0** | 23/23 |
| máquina cargada, pasada 2 (determinismo) | **0** | 23/23 |

## 🔴 LA FAMILIA QUEDA A CERO, y con el censo detrás

Pasado otra vez el censo de SCRUM-671 sobre el árbol curado —**1.185 ficheros leídos**, mismos
patrones, mismo suelo de alcance (falla si no llega a sus tres controles):

**Asertos sobre una duración medida que dependen de la carga: 0.**

El grupo 1 baja de 15 a **10 líneas, y las 10 son los falsos positivos ya documentados** en
SCRUM-671: `scrum642` (4, curado ayer con reloj inyectado), `scrum645` (2, lee una fixture de
texto), y `scrum216` / `scrum249` / `scrum457` / `scrum666` (un importe, una fecha ISO, un precio y
un ratio). **`scrum362` y `scrum501` han desaparecido de la lista.**

Los tres curados y su técnica:

| ticket | guard | técnica |
|---|---|---|
| SCRUM-520 | `scrum351` | contar OPERACIONES en vez de segundos |
| SCRUM-671 | `scrum642` | el **reloj se recibe** como parámetro |
| SCRUM-679 | `scrum362` | contar OPERACIONES (comparación, no absoluto) |
| SCRUM-679 | `scrum501` | el **temporizador se recibe** como parámetro |

**No se ha subido ningún umbral.** Los dos han desaparecido, no se han relajado.

## Lo que NO se ha tocado

Los **45 del grupo 2** (otra familia: no asertan tiempo, se MUEREN sin plazo) · el grupo 3 ·
`guard-contraste.mjs` y `scripts/guards-visuales.mjs` (sesión 1, SCRUM-673) ·
`prisma/schema.prisma` (sesión 3).
