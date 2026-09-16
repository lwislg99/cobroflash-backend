# SCRUM-621 · El byte NUL que dejó un PR sin diff legible

**Fecha:** 01-sep-2026 · **Carril:** B · **Gate:** sin gate — un arreglo de un byte y otro de tres

**Medido contra:** `origin/main` = `45412c14bf8d8a5be24007e75481d95b4a001bfe` · 2026-09-01T13:33:42+01:00

## El hecho, medido

`scripts/guards-visuales.mjs` tenía **un byte 0x00 en el offset 3862** (el encargo lo situaba en
3830; se escribe el que se mide). Vivía dentro de:

```js
!tanda.includes(ficheroDe(s, k) || '<byte 0x00>')
```

Se lee como `|| ' '` porque un NUL se pinta invisible — y así lo leí yo cuando construí la puerta.

**Git decide si un fichero es texto o binario buscando un NUL en los primeros 8000 bytes.** Con ese
byte dentro, el PR de SCRUM-617 —nueve guards, un módulo nuevo, el hallazgo del arranque propagado
por copia— se revisó **sin poder leer el diff de uno de sus dos ficheros centrales**.

### Lo que hace git, comprobado antes de tocar nada

| comprobación | resultado |
|---|---|
| `git diff --stat` | `Bin 10453 -> 10456 bytes` · **0 insertions, 0 deletions** |
| `git diff` | **`Binary files a/… and b/… differ`** |
| `git grep -n "fueraDeLaTanda"` sobre el fichero | **`Binary file scripts/guards-visuales.mjs matches`** — sin línea ni contenido |
| el mismo grep sobre un fichero sin NUL (**control positivo**) | `tests/…:18:import { fueraDeLaTanda } …` — línea y contenido |
| `git grep -I --name-only` sobre el fichero | **0** — con `-I` git lo excluye por binario |

⚠️ **Un matiz sobre el enunciado, porque importa:** `git grep` **no devuelve 0 resultados**, devuelve
«Binary file … matches». El efecto práctico es el descrito —no puedes saber DÓNDE— pero el literal
sólo es cierto con `-I`, o en cualquier herramienta que salte binarios. Se deja escrito para que
nadie repita la comprobación esperando un cero y concluya que el problema no existe.

Y el propio arreglo lo demuestra mejor que cualquier explicación: **el commit que quita el NUL sale
en `git diff` como `Binary files differ`**, porque la pre-imagen todavía lo lleva. El diff del
arreglo es ilegible por el defecto que arregla.

## El arreglo

El byte crudo se sustituye por la **secuencia de escape de dos caracteres** — barra invertida, `x`,
`0`, `0` — entre comillas simples. El fichero pasa a contener los cuatro caracteres `\x00` y
**ningún** 0x00 en crudo. Creció exactamente 3 bytes.

**El comportamiento NO cambia**, y se comprobó ejecutando, no razonando:

| sonda | antes | después |
|---|---|---|
| `fueraDeLaTanda()` | los 9 guards | los 9 guards, misma lista y mismo orden |
| con `ficheroDe` resuelto | `["guard:x"]` | `["guard:x"]` |
| con `ficheroDe` **falsy** (el camino que usa el NUL) | `["guard:y"]` | `["guard:y"]` |

Y lo que devuelve la expresión sigue siendo **el mismo carácter**: longitud 1, `charCodeAt(0) === 0`,
idéntico a `String.fromCharCode(0)` — **no** la cadena `'<NUL>'` ni vacío.

## La comprobación adicional: había un segundo, y va en el mismo commit

Censo de los **1.865 ficheros versionados**, leídos los 1.865, buscando un NUL en los primeros 8000
bytes y separando lo DECLARADO binario en `.gitattributes` de lo que git decide por su cuenta:

| clase | nº |
|---|---|
| con NUL en la ventana de git | 222 |
| · declarados binarios en `.gitattributes` (correcto) | **219** ✅ control positivo del detector |
| · **NO declarados — el hallazgo** | **3** |

Los tres, y **no son la misma cosa**:

- 🔴 **`src/modules/jobs/domain/jobDireccion.ts`** — UTF-8 con **tres NUL sueltos** (offsets 6054,
  6098, 6151), los tres con el patrón idéntico al primero: justo tras la comilla de apertura, en
  `'<NUL>sonda:job.direccion'`, `'<NUL>sonda:albaran.lugarEntrega'` y
  `'<NUL>sonda:contenido-congelado'`. **Mismo defecto, mismo arreglo, mismo commit.** Creció 9 bytes.
- ⚪ **`estructura.txt` y `estructura-completa.txt`** — **UTF-16LE con BOM** (`ff fe`), medio millón
  de NUL cada uno: volcados de `tree` de Windows. Sus NUL **son la codificación**, no un byte
  perdido. Git los da por binarios con razón. Arreglarlo sería reconvertirlos a UTF-8 —un cambio de
  contenido, no de un byte— y no es este ticket. **Se anotan, no se tocan.**

Tras el arreglo el censo queda en **2 no declarados, y los dos son los UTF-16**.

⚠️ **El censo se equivocó primero, y lo cazó su propio suelo.** La primera versión comparaba `.png`
(del `.gitattributes`) contra `png` (de `path.extname`), así que **ninguna extensión casaba** y daba
**222 «hallazgos»** que eran capturas de pantalla. No se usó ese número: el control positivo del
propio censo dijo «el detector no ve NI UN binario de verdad, su cero de abajo no vale». Un censo sin
control positivo habría publicado 222.

## Después del arreglo

- `git grep -n` encuentra el símbolo **con su línea y su contenido**, en los dos ficheros.
- `git diff` de un cambio posterior es **texto legible**.
- **Los 9 guards de navegador en verde**, la puerta sale con **0**.
- `npm run build` limpio y suite entera en verde.

## Recuento de la suite

**total 4083 · pass 4004 · fail 0 · skipped 79**

| saltos | motivo declarado |
|---|---|
| 67 | `sin QA_DB_TEST=1 · npm run test:staging:gated` (dos de ellos con condición extra declarada) |
| 9 | `sin LIBRO_PG_URL` (banco local / desechable) |
| 1 | `sin BOT_SUITE_TEST=1` |
| 1 | `sin A55_DB_TEST=1` |
| 1 | EPERM de Windows creando un enlace a fichero (el mismo mecanismo lo cubre un control positivo portable que sí corre) |

`npm run guards:entrada` en verde (21 tests, 4 guards).

## Lo que NO cierra este ticket

**SCRUM-626 sigue abierto**: por qué `guard-contraste` no arrancaba en el runner. Hipótesis A
(arranque en frío) en pie y sin confirmar, con su hueco declarado en `docs/master/SCRUM-617.md`.
Aquí no se ha tocado.
