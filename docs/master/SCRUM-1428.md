# SCRUM-1428 · La decisión del 6-oct, a Javier: §26 de `para-javier.md` (con `scrum1405c ④` medido sobre dos días de CI)

**Medido contra:** `origin/main` = `fc4186483266ae85cc744d020bcfd6db76d8c5d3` · 2026-10-19T06:55:25Z

A9: aviso → cicatriz S3 «Le pasé al orquestador «17 líneas» de SCRUM-1428 copiando la decisión del ticket sin contar las acusadas, y contadas eran 15: dos ya llevaban su marca y un comentario posterior del mismo ticket lo decía.» — no se pudo comprobar: es una cifra que copié de un comentario de Jira a un mensaje, y ningún test lee mis mensajes

19-oct-2026 · **S3** (equipo de Luis), por encargo de su orquestador (`cobroflash-backend-f3`, mensaje del 19-oct). Sólo `docs/`: la §26 de `docs/equipo/para-javier.md`, este registro, una línea de `docs/equipo/cicatrices/S3.md` y `docs/master/evidencias/SCRUM-1428/`. Ni una línea de `src/`, `public/`, `tests/` ni `scripts/`. Ninguna base tocada.

**Por qué este número.** La §26 lleva dos puntos: el 26.2 es este ticket, y el 26.1 (`scrum1405c ④`) es de J6 y no tiene ticket del equipo de Luis. El orquestador pidió UNA rama y UNA sección para los dos, porque ese fichero choca cada vez que dos ramas le añaden al final.

## ① Lo que faltaba: la decisión nunca salió de Jira

La decisión de SCRUM-1428 es del 6-oct (c.18325). Medido hoy sobre `main`:
- `libroRegistroView.js` (J1) sin tocar desde el 28-sep (`f597ee6a`).
- Las 22 claves del fichero, todavía en `acusadas` de `scripts/_censo-convenio-microcopy-declarados.json`.
- «1428» aparecía 0 veces en `docs/equipo/`, o sea que nunca llegó a `para-javier.md`, que es el único canal entre los dos equipos además de Jira.

## ② 15, no 17

La decisión (c.18325) habla de un lote de 17 líneas: las 10 de la descripción más 7 de c.18319. Dos de esas 7, `colTrazas` y `sinTrazas`, **ya llevan su marca** (`libroRegistroView.js:75` y `:86`), y el censo las da por APROBADO. Lo vio el propio ticket 50 minutos después (c.18379), pero la cifra 17 no se corrigió (c.18382 la repite). Contadas hoy, las 22 acusadas son:

| grupo | cuántas |
|---|---|
| firmadas el 19-ago y sin marca | **15** |
| esperan al asesor (§21 de `PREGUNTAS_ASESOR.md`) | 5 |
| `cargando` (se queda, por decisión de c.18325) | 1 |
| `menu` (muerta, sin decidir) | 1 |
| **total** | **22** |

Las referencias de la firma en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` (`:355-372`, `:402-403`, `:432`, `:433`, `:435`) están leídas hoy, línea por línea, en el fichero de `main`.

## ③ `scrum1405c ④`, medido (§26.1)

**Población:** los 150 últimos runs completados de `ci.yml`, del 2026-10-16T13:15:03Z al 2026-10-18T19:37:33Z. 106 tienen el job obligatorio; los otros 44 no lo tienen, y por qué no lo he mirado. De los 106: 72 verdes, 17 rojos y 17 cancelados. **Se bajaron los 17 logs rojos y se leyeron los 17** (ninguno se quedó sin bajar).

| | con veredicto | rojos | rojos con `scrum1405c ④` |
|---|---|---|---|
| push a `main` | 20 | 7 | 7 (lo único que cae en los 7) |
| pull request | 69 | 10 | 3 |

- `salida-ci-rojos.txt` (de `ci-rojos.mjs`): cada rojo con sus `✖` y su `ℹ fail`. `salida-denominador.txt` (de `denominador.mjs`): el reparto entre `main` y los PR.
- **El mensaje del caso, en los 10 logs que lo traen:** «con el módulo la cobaya SIGUE perdiendo casos: la salida C no basta». Extraído con un `Select-String` sobre los logs (patrón `error: '(🔴 [^:]+:[^.]+)\..*?con el módulo: (\[[^\]]*\])`): 10 de 10 casan, y en los 10 el vector «con el módulo» tiene exactamente una pasada de cuatro con `faltan` > 0 (de 3 a 13 sobre 320).
- **Lo que no se sabe:** por qué `main` cae 7 de 20 y los PR 3 de 69. Queda como diferencia medida, sin explicación.
- **El arreglo siguiente de J6:** no hay PR abierto que toque `scrum1405c`; en el remoto están las ramas `exp-1405-force-exit` y `exp-1405-testigo-en-fichero-real`.

## Lo que NO está hecho

- Marcar las 15 en el código: es J1. Aquí sólo se le escribe.
- La decisión sobre `menu`: no la tomo yo.
- No he tocado nada de `scrum1405c` ni de su módulo.

## Mis errores

- **La cifra 17.** Se la pasé al orquestador por mensaje copiándola de c.18325, sin contar. Al escribir esta sección conté las acusadas en el JSON de declarados y salieron 15. Es la cicatriz de la línea A9.
- **Bajé los logs con `gh api` sin `--allow-escape-sequences`.** La trampa ya está escrita en `docs/equipo/trampas-del-entorno.md` y caí en ella igual. No llegó a dar una cifra falsa: la primera pasada dejó 0 logs bajados y lo vi antes de leer ningún resultado. La paré y la repetí con el flag.
- **El primer control positivo del sufijo** (una rama de 231) no vio nada, porque #2568 se había mergeado y su rama ya no existía. Lo cambié por las ramas `exp-1405-*`, que sí existen hoy.

---

# SCRUM-1428b · La opción (a), PROBADA y lista para que J1 la aplique (2-nov-2026) · y la cifra de las otras once, cerrada

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T19:49:07Z

A9: sin fallo que generalice — tramo de medida y de propuesta; las dos premisas del encargo que no se sostenían (el carril y el control de `recargaFallida`) las corrigió su autor en el mismo turno, y no hay código mío que pueda fallar

2-nov-2026 · **S4** (equipo de Luis), encargo de su orquestador (`cobroflash-backend-26`): «opción (a), y por tus propios motivos». Sólo `docs/master/`: este tramo y `docs/master/evidencias/SCRUM-1428/1428b/`. **Ni una línea de `public/` ni de `scripts/`**: `libroRegistroView.js` es **J1** (`node scripts/carriles.mjs de` → `dos-equipos.md:143`), y el propio ticket ya lo había decidido (c.18325, «las marca J1 con este ticket»). La decisión ya les llegó el 19-oct (`para-javier.md` §26.2, tramo de arriba); lo nuevo de hoy es el **parche exacto**, probado.

## ① El parche, y lo que hace medido

`evidencias/SCRUM-1428/1428b/propuesta-para-j1.patch` — dos ficheros, **los dos en el MISMO PR**:
- `public/dashboard/js/libroRegistroView.js`: 15 marcas `// APROBADA (fundador, 19-ago-2026): docs/MICROCOPY_APROBADA_SIN_APLICAR.md:NNN (SCRUM-709)`, cada una DETRÁS de su clave (regla 1 del censo: firma a esa clave y sólo a ella), con la línea del registro congelado de cada una. **Cero caracteres visibles cambiados.** Y la cabecera `:25-28` corregida («Ni un rótulo de esta pantalla está aprobado» era falso).
- `scripts/_censo-convenio-microcopy-declarados.json`: las 15 salen de `acusadas` y entran en `retiradas` con su firma citada (lo que pide el censo, `_censo-convenio-microcopy.mjs:523`).
- `git apply --check` limpio sobre `70eefc40c`. Lo genera `aplicar-propuesta.mjs <raíz de una copia>`, que se niega a correr sobre un árbol con `.git`.

Medido en una COPIA fuera del repo (sin `.git`), con el censo de `main`:

| | `main` hoy | con el parche | sólo las marcas | sólo el JSON |
|---|---|---|---|---|
| hojas | 353 | 353 | 353 | 353 |
| APROBADO | 320 | **335** | 335 | 320 |
| acusadas (techo) | 33 | **18** | 18 | 33 |
| nuevas · sobran | 0 · 0 | **0 · 0** | 0 · **15** | **15** · 0 |
| fuera de alcance · por grupo | 124 · 176 | 124 · 176 | 124 · 176 | 124 · 176 |
| salida | 0 | **0** | 1 | 1 |

- 🔴 **El control que decide:** los 7 del libro que NO están firmados **siguen acusados** con el parche: `descuadre`, `avisoIlegibles`, `avisoAjenas`, `avisoSinNumero`, `trazaNoSellado` (asesor, §21), `cargando` (se queda, c.18325) y `menu` (aprobación RETIRADA, registro `:414`).
- **Las dos mitades por separado salen ROJAS** (columnas 3 y 4): por eso van en un PR.
- `tests/scrum1157-censo-convenio-microcopy.test.mjs` y los otros 12 ficheros de `tests/` que leen la vista: **138 tests, 115 pass, 23 fail, IGUALES con y sin el parche** (misma lista de `✖`). Los 23 son de la copia: no tiene `dist/` (`Cannot find module …/dist/…`). Los once de `scrum1157` pasan con el parche.
- `recuento`: lo aprobado el 19-ago es `{N} facturas` (`:364`); el singular «1 factura» lo firmó SCRUM-1232 c.17435, y su comentario sigue encima.
- ⚠️ `git apply` fuera de un repo escribe CRLF en esta máquina: los ficheros salen con otro hash y el mismo contenido (`git diff --no-index --stat` vacío, censo idéntico byte a byte).

**El encargo traía dos premisas superadas, corregidas por el orquestador:** el control era «`recargaFallida` tiene que seguir saliendo», y la firmó el fundador el 30-oct (SCRUM-1640 c.21292, `invoicesView.js:21`; ya en `retiradas`). Y las hojas son 353, no 348.

## ② Las otras once acusadas: la cifra, cerrada

Las 33 de hoy, por fichero y por si su firma consta en algún sitio que se pueda citar:

| acusadas | carril | ¿firma con localizador? | veredicto |
|---|---|---|---|
| libro · 15 | J1 | **SÍ**: registro congelado `:362-372`, `:402-403`, `:432-435` | en falso → el parche de ① |
| libro · 7 | J1 | no (5 asesor · `cargando` decidida · `menu` retirada) | con razón |
| `COBROS_COPY.cabeceras`, `.diasSinCobrar` | J2 | **SÍ**: `docs/master/SCRUM-285.md:271` y `:249` («aprobada por el asesor el 10-ago-2026», `:237`), y la cabecera del objeto lo dice (`cobrosView.js:20-21`) | en falso |
| `COBROS_COPY.diasEnTabla` («3 días») | J2 | sólo en prosa: `SCRUM-285.md:273-276` (las dos formas, «las dos con test»); la tabla `:249` lista sólo la frase larga | en falso, con esa reserva |
| `ETIQUETAS_HEREDADAS.card:stripe`, `.manual` | J2 | **no**: `SCRUM-481.md:366-371` dice «aprobadas por separado» sin decir quién ni dónde; nada en el registro congelado, en `docs/microcopy/` ni en SCRUM-398 (1 comentario, de cierre). `manual` ya declarada (SCRUM-1215 c.17505) | con razón |
| `QR_COPY` · 6 | J3 | **no**: el PR del microcopy (#298, 29-jul, SCRUM-230) aprobó 4 claves y dejó estas 6 PENDIENTES a propósito (`settingsView.js:1609-1612`); nada después | con razón |

**Cifra: de 33 acusadas, 18 son en falso (15 libro + 3 Cobros) y 15 con razón.** Con el parche de ① el techo quedaría en 18, y de esas 18, 3 seguirían siendo en falso (las de Cobros, J2).

### Lo que encontré de paso en el censo, y NO toqué (no es mío)
- **Las tres de Cobros salen acusadas por cómo se lee una CUENTA.** La cabecera de `COBROS_COPY` dice «Las **seis** cabeceras se aprobaron…», y el censo la lee como una firma que gobierna a las seis primeras CLAVES (`titulo` … `vacioPorFiltro`, las seis en `porGrupo`). Las seis cabeceras de las que habla son los seis elementos del array `cabeceras`, que se queda fuera. Hoy no da un APROBADO falso por casualidad: esas seis claves también constan en `SCRUM-285.md:244-251`. **Es una lectura que acierta por accidente**, y el día que alguien meta una clave sin firma entre las seis primeras saldrá APROBADO. Va al orquestador.
- **Quién era «el asesor» del 10-ago no lo dice ningún sitio que haya leído.** El censo acepta «asesor» como firmante (`RE_QUIEN_FIRMA`), y con esa firma ya da por buenas otras seis claves de Cobros. Si esa firma no vale, tampoco valen esas seis: la duda es de las nueve, no sólo de las tres.

## Lo que NO está hecho
- Aplicar el parche: es J1, en un PR suyo con los dos ficheros.
- Las tres de Cobros: son J2; las marcas serían `// APROBADA (asesor, 10-ago-2026): docs/master/SCRUM-285.md:NNN`, si se acepta esa procedencia.
- No he leído todo Jira buscando firmas de `card:stripe`/`manual` y de los seis del QR: el registro congelado, `docs/microcopy/`, SCRUM-230, SCRUM-285, SCRUM-398 y los registros de 285/398/481/488. «Con razón» quiere decir «sin firma en esos sitios».