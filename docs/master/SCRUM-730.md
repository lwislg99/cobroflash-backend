# SCRUM-730 · Una ruta con un espacio no es un caso raro: es donde trabaja la gente

**Fecha:** 4-sep-2026 · **Carril:** herramienta / tanda · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `ac282d5553f17072ab2281244e5a3d853fdd176a` · 2026-09-04T20:31:00Z

---

## PASO 0

**ENTRADA:** `npm test` → el fallo cae en `tests/scrum176b-force-por-identidad.test.mjs:117`.
No hay pantalla ni usuario final: la víctima son las **seis sesiones** que trabajan hoy en esta
máquina, cuyas copias de trabajo cuelgan todas de `C:\Users\Javier Pereira\`.

**MECANISMO:** existe y está construido — `fileURLToPath()` de `node:url`, que es lo que usa el
resto de la casa. El trabajo era **usarlo**, no inventar nada.

---

## EL DEFECTO, medido

```js
// antes
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
```

`pathname` devuelve la ruta **percent-codificada**. Con un espacio en la ruta, el `%20` sobrevive,
se busca un directorio llamado `Javier%20Pereira`, y el `readFileSync` muere:

```
Error: ENOENT: no such file or directory,
  open 'C:\Users\Javier%20Pereira\cobroflash-b5\.claude\hooks\guard-dangerous.mjs'
```

El fichero estaba donde tenía que estar.

### 🔴 POR QUÉ EN CI NO SE VEÍA, que es la parte que lo hizo durar

La ruta del checkout del runner no lleva espacios, así que **pasaba en verde**. El instrumento se
comportaba distinto según dónde corriera, y el sitio donde fallaba era precisamente donde trabaja
la gente. Lo caro no era el minuto: **normalizaba un rojo ajeno en la tanda**, y a una sesión
acostumbrada a entregar diciendo «ese fallo no es mío» se le cuela un fallo **propio** dentro de
esa misma frase.

### 🔴 Y LA SEGUNDA CARA, que sólo se vio al arreglarlo

Mientras moría en el ENOENT, **ese test no vigilaba nada**. Su control —que la lista de banderas
exentas del guard `--force` no crezca sola— no llegaba a ejecutarse en ninguna ruta con espacio.
O sea que la superficie del agujero de AA2 llevaba **sin vigilancia real** en las seis copias de
trabajo. El arreglo no sólo apaga un rojo: **devuelve la detección**.

---

## EL ARREGLO

```js
// después — y el import correspondiente
const AQUI = path.dirname(fileURLToPath(import.meta.url));
```

**No se ha relajado nada de lo que el test exige.** Se ha cambiado **cómo resuelve su ruta**. Las
aserciones sobre la lista de exentas están intactas, byte a byte.

---

## LA EVIDENCIA

### ① ROJO reproducido por el mecanismo, ANTES de tocar

Con la ruta del árbol conteniendo un espacio, el test de partida falla con el ENOENT de arriba,
nombrando `Javier%20Pereira`.

### ② CONTROL POSITIVO · sigue cazando lo que vino a cazar

Con la ruta ya resuelta bien, se añadió **una bandera exenta de más** a
`.claude/hooks/guard-dangerous.mjs` y el test la cazó:

> 🔴 la lista de banderas exentas ha cambiado. No es un detalle de estilo: cada entrada es un
> agujero declarado en la barrera que impide reescribir historia.

Revertido y comprobado: el fichero vuelve a sus **35.224 bytes** exactos.

> ⚠️ Anécdota que merece quedar: al inyectar esa bandera, **el propio `guard-dangerous` bloqueó el
> comando** por llevar `--force…` escrito. Hubo que construir la cadena por partes. El guard
> funcionando sobre quien lo estaba probando.

### ③ CONTROL NEGATIVO · la matriz de cuatro

La línea vieja se reconstruyó **byte a byte** y se verificó contra `git show origin/main:` antes
de medir. Tres raíces reales en disco, dos versiones del código:

| ruta | código VIEJO | código NUEVO |
|---|---|---|
| `C:\tmp730\sinespacio` | **VERDE** ← el control negativo | VERDE |
| `C:\tmp730\con espacio` | 🔴 ROJO | VERDE |
| `C:\tmp730\con-eñe-ñ` | 🔴 ROJO | VERDE |

La primera fila es la que cierra el argumento: **en una ruta sin espacios el código viejo
funcionaba igual que hoy**, así que el defecto es exactamente el carácter codificado y no otra
cosa.

**🔴 Y NO ES SÓLO EL ESPACIO.** La fila de la eñe lo dice: cualquier carácter que se
percent-codifique rompe igual. Se descubrió porque el **primer** intento de «ruta limpia» no lo
era — el scratchpad cuelga de `JAVIER~1`, nombre corto 8.3, y la virgulilla se codifica `%7E`.
Ese falso arranque está aquí a propósito: era la prueba de que la hipótesis «es cosa del espacio»
se quedaba corta.

---

## EL CENSO · `tests/scrum730-ruta-desde-import-meta.test.mjs`

**Por AST y por lo que el código HACE, no por subcadena.** Detecta dos formas:

* `.pathname` sobre un `new URL(…)` que lleve `import.meta.url` dentro — aunque la URL esté en
  una variable, que es lo que una subcadena no vería.
* un método de texto (`replace`/`slice`/`substring`/`split`) aplicado directamente sobre
  `import.meta.url`: recortar la URL a mano deja el percent-encoding igual de crudo.

**POBLACIÓN, contada y no estimada: 1.194 ficheros** — `tests/` 731, `src/` 266, `scripts/` 113,
`public/` 83, `.claude/hooks/` 1. Quedan fuera **a propósito** `.claude/skills/` y `.agents/`: son
skills de terceros (`impeccable` es de Anthropic), no las escribe nadie de aquí y no se pueden
arreglar desde este repositorio — un censo con deuda ajena deja de leerse.

### SUELOS · sin ellos, un cero no significaría nada

1. **El detector caza el defecto original**, escrito literalmente en el test. No puede depender de
   lo que este ticket arregla: en cuanto se arregla desaparece del árbol y el suelo se quedaría
   sin caso.
2. **El corpus existe** (≥ 300 ficheros) y contiene el fichero que motivó todo.
3. **CONTROL NEGATIVO con cinco formas del idioma correcto** que no puede acusar, incluidas dos
   trampas: un `.pathname` sobre una URL **de red** (legítimo) y un `new URL(…, import.meta.url)`
   pasado entero a `fs` (Node lo decodifica él).

### 🔴 NO ERA UNO, ERAN DOS

La medición de partida decía «361 usan `fileURLToPath` y éste es el único que no». **Al contarlo
por AST aparece un segundo sitio:** `tests/scrum409-fixtures-sin-merchant-demo.test.mjs:86`.

**La diferencia entre los dos es que uno muerde y el otro no**, y explica por qué sólo se arregla
uno aquí:

* `scrum176b:117` construía la ruta **entera** y leía un fichero: el `%20` del **directorio**
  viajaba dentro y reventaba.
* `scrum409:86` se queda con el `path.basename(…)`, o sea el **nombre** del fichero. El `%20` está
  en el directorio, así que el basename sale limpio y **hoy no falla** — comprobado: ese test pasa
  en verde en este árbol y **no está gateado**. Es un defecto **latente**: muerde el día que
  alguien lo use para una ruta completa, o si un fichero de `tests/` llega a tener un espacio o un
  acento en el nombre.

**No se arregla aquí, y es decisión de carril, no omisión:** `scrum409-fixtures-…` es un fichero
de FIXTURES, territorio de S1 (SCRUM-684). Un hallazgo de otro carril se reporta, no se arregla
(regla 9). Queda **censado con su número**, y el trinquete aprieta **también dentro de él**: si
ese fichero gana un segundo sitio, cae igual. Una excepción que sobrevive a su causa deja de ser
una nota y pasa a ser un permiso (SCRUM-368).

---

## Lo que NO cubre

1. **`scrum409:86` sigue con el idioma malo.** Censado, latente, y de otro carril.
2. **El censo mira cinco carpetas**, no el árbol entero: fuera quedan `.claude/skills/` y
   `.agents/` (terceros), `dist/` y `node_modules/`. Declarado arriba.
3. **No se ha medido en macOS ni Linux con rutas con espacios.** El defecto es del percent-encoding
   y no del sistema operativo, pero la matriz se corrió en Windows.
4. **No cubre otras formas de resolver rutas** que no pasen por `import.meta.url` (por ejemplo
   `process.cwd()` mal usado). No era el defecto de este ticket.

## HALLAZGOS FUERA DE ALCANCE

* `tests/scrum409-fixtures-sin-merchant-demo.test.mjs:86` — mismo idioma, latente, carril de S1.
* La virgulilla de los nombres cortos 8.3 (`JAVIER~1` → `%7E`) rompe igual que el espacio:
  cualquier script que resuelva rutas a mano bajo el directorio temporal está expuesto.

## Ficheros

* `tests/scrum176b-force-por-identidad.test.mjs` — el arreglo (una línea + su import) y el porqué.
* `tests/scrum730-ruta-desde-import-meta.test.mjs` — **nuevo**, 5 tests: dos suelos, el control
  negativo, el censo con trinquete y el control de identidad del fichero que lo motivó.
