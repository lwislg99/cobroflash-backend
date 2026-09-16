# SCRUM-273 · REGISTRO-POR-FICHERO: el conflicto del máster deja de existir

**Fecha:** 3-ago-2026 · **Carril:** B (docs/tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `e6946173013d59dbd0d85fd8bdadbc4d651cbbe0` · 2026-08-03T17:05:00+02:00

## El defecto

El 2-ago-2026 **siete ramas distintas chocaron en `docs/YAQU_MASTER.md`** en un solo día, todas
por lo mismo: cada ticket añade su entrada al final de la misma sección y cuatro sesiones a la vez
escriben en el mismo punto. Cada choque costaba ~10 min de sesión más una vuelta con el fundador.

**El coste peor no era el tiempo.** Resolver conflictos a mano en la única fuente de verdad del
proyecto es la operación de más riesgo que se hace aquí, y se hizo siete veces en un día. Ya rozó:
en la rama de SCRUM-234 el script de resolución ancló con `$` sobre un fichero en CRLF, encontró
2 de 3 marcadores y **abortó**. Sin ese guard habría dejado un `=======` dentro del máster.

## La decisión, y por qué

**Un fichero por ticket:** las entradas nuevas van a `docs/master/SCRUM-<n>.md`.

El conflicto **no se resuelve mejor: deja de existir**, porque dos ficheros no colisionan si dos
tickets no comparten número. Mismo principio que SCRUM-207 (imposible mejor que vigilado) y que
251/254 (cero superficie mejor que superficie filtrada).

Se descartó un **índice generado**: habría resuelto el conflicto mejor, no eliminado. La causa
raíz está un nivel más abajo — el máster mezclaba **lo que casi nunca cambia** (reglas 1-36,
decisiones, estrategia) con **lo que cambia cinco veces al día** (el registro). Esa mezcla es lo
que hacía que un apunte rutinario tocase el documento más delicado del repo.

**Lo que NO cambia:** la primacía del máster (regla 35). Esto cambia **dónde se escribe el
registro**, no **qué manda**.

## Lo que se midió

Contra `origin/main` = `e6946173013d59dbd0d85fd8bdadbc4d651cbbe0`:

* `YAQU_MASTER.md`: **1713 líneas, 476 KB, 110 entradas** ✅ en **98 números** de ticket distintos.
* **Las últimas 12 entradas viven entre las líneas 1406 y 1449.** El 11 % de las entradas en el
  2,5 % del fichero, y ahí escriben cuatro sesiones: el conflicto era **geometría, no mala suerte**.
* **7 tickets tienen más de una entrada** (SCRUM-139 tiene seis; 245, tres), porque una enmienda
  posterior es legítima. Ese dato cambió el diseño del censo — ver abajo.
* **12 ficheros mencionan el máster por programa y ninguno parsea entradas**: `zona-roja.mjs` lo
  marca por ruta, `_evidencia-tanda.mjs` ya excluye `docs/` entero del cálculo de huella, y el
  resto son menciones en prosa. **Nada se rompe al separar el registro.**

**Corrección propia durante la medición:** al principio atribuí 76 entradas a la sección `## U3`
porque mi `awk` no distinguía `#` de `##` y arrastraba la última cabecera vista. Las 110 están
**repartidas por tema** a lo largo del documento; solo las recientes se apilan al final. Se
reportó antes de que el dato entrase en ninguna decisión.

## El censo se congela por número **y cantidad**

Por línea sería inútil: cualquier edición diez líneas más arriba pondría el guard en rojo, y un
guard que grita sin motivo se acaba puenteando igual que uno que no grita nunca (SCRUM-182/203).

Y el número a secas tampoco basta: con 7 tickets teniendo varias entradas, guardar solo el
conjunto de números dejaría pasar una entrada **nueva sobre un ticket ya presente** — el hueco
exacto por el que volvería la costumbre. Por eso se congela `número → cuántas`.

## Verificado en rojo

* Añadir una entrada de un ticket **nuevo** al máster → rojo, nombrándolo.
* Añadir una **segunda** entrada de un ticket **ya censado** → rojo, diciendo cuántas declara el
  censo y cuántas hay. Este es el que el censo por número a secas no habría cazado.
* Extractor cegado (patrón que no casa) → lo caza el suelo, no el guard: sin él, «no hay entradas
  nuevas» y «no sé leer el fichero» se ven idénticos.
* Fichero mal nombrado en `docs/master/` → rojo. El nombre no es cosmético: es lo que garantiza
  que dos tickets no escriban en el mismo sitio, que es la propiedad entera del ticket.

## Lo que NO cubre

* **No migra el histórico**, a propósito: las 110 entradas anteriores siguen en el máster con su
  redacción y su orden intactos. Reescribir 476 KB habría sido aceptar hoy justo el riesgo que
  esto elimina.
* **No impide editar una entrada existente** del máster — solo que aparezcan nuevas. Corregir una
  errata en una entrada vieja sigue siendo legítimo y el guard no se entera.
* **No valida el CONTENIDO** de los ficheros de `docs/master/`: comprueba el nombre, no que el
  cuerpo siga el formato del `README.md`. Un fichero bien nombrado y vacío pasa.
* **No hay índice generado.** Quien quiera la lista de entradas nuevas hace `ls docs/master/`. Si
  algún día hace falta un índice, se genera — pero un índice a mano sería otra vez un fichero que
  todas las ramas tocan, o sea el problema de vuelta con otro nombre.

## Ficheros

* `docs/master/README.md` (nuevo) — el formato y el porqué.
* `docs/master/SCRUM-273.md` (nuevo) — esta entrada, que estrena el mecanismo.
* `docs/YAQU_MASTER.md` — **solo** el puntero fechado en la cabecera. Ni una entrada tocada.
* `tests/scrum273-registro-por-fichero.test.mjs` (4, sin gate).

## Nota de cierre

El censo se congelo en **110** entradas y se cerro en **111**: SCRUM-271 entro en  mientras este ticket se construia, y el guard lo caza durante su propio rebase. Es, literalmente, el ultimo choque que ese fichero va a tener.

---

# SCRUM-273 (parte 2) · el mensaje del guard enuncia LA ALTERNATIVA

**Fecha:** 10-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `036241eb385835005de227631f973d49c17cc8be`

## Por qué se toca un guard que funcionaba

**Tres sesiones distintas crearon un fichero suelto en tres días**: `SCRUM-403-ESPEC-COLUMNAS.md`,
`SCRUM-242-RUNBOOK.md` y `SCRUM-406-canal.md`. El guard cazó los tres — hacía su trabajo.

Pero tres personas cometiendo **el mismo** error no es un despiste. El mensaje decía **qué estaba
prohibido** y no decía **qué hacer cuando el contenido no cabe en la entrada**, y ante eso la salida
obvia es crear un fichero al lado. El defecto no estaba en la regla: estaba en el texto del rojo.

Es el mismo arreglo que se le hizo al guard de SCRUM-391: **un mensaje que acusa sin dar salida
empuja a pedir una excepción.**

## Las dos salidas, ahora dentro del rojo

* **Registro de trabajo** → va como **SECCIÓN** dentro de `SCRUM-<n>.md`. Si el fichero ya existe,
  **apéndice al final y no se borra nada** (precedente: `SCRUM-244.md`, con dos entradas seguidas).
* **Documento operativo** (runbook, procedimiento, algo que alguien EJECUTA) → va a
  `docs/RUNBOOKS.md`, y la entrada `SCRUM-<n>.md` lo **NOMBRA con su ruta**. Quien busca el
  procedimiento lo encuentra donde viven los procedimientos; quien lee el ticket sabe que existe.

## Dos tests nuevos, y el segundo es el que importa

| Test | Qué impide |
| --- | --- |
| `el mensaje del guard ENUNCIA LA ALTERNATIVA` | que alguien recorte el texto «para acortar» y vuelva el error dentro de una semana |
| `el mensaje bueno es el que se USA de verdad` | **el verde hueco**: dejar el mensaje largo escrito y a la vez poner un texto corto en línea dentro del `assert`. El guard seguiría acusando sin dar salida y nadie se enteraría |

Rojos probados, confirmando antes que la mutación se aplicó:

| Inyección | Cae |
| --- | --- |
| se recorta la salida del runbook | `🔴 el mensaje del guard ENUNCIA LA ALTERNATIVA` — y **lista lo que falta** |
| el mensaje se deja escrito pero se deja de usar | `🔴 el mensaje bueno es el que se USA de verdad` |

Control positivo con un fichero suelto de verdad: el rojo nombra el fichero **y** enseña las dos
salidas.

## Lo que NO se ha tocado

La regla. `docs/master/SCRUM-<n>.md` sigue siendo sin excepción, y el censo de colisiones intacto.
