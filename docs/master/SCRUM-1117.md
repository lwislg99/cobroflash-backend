# SCRUM-1117 · Las citas del BOE anclan ahora la redacción vigente DEL BLOQUE, no la página

**Fecha:** 25-sep-2026 · **Carril:** legal / calidad · **Puesto:** J4 (jv-j4)
**Medido contra:** `origin/main` = `bf4d82c68cc74c390af36f92c90cdb915e8c31e8` · 2026-09-25T17:59:56Z

## Por qué (de SCRUM-1096)

La §8 de `docs/producto/CONTABILIDAD.md` guarda por cada fuente una URL y un hash, y **ninguno de los
dos ancla nada**:
- la URL es la del consolidado (`act.php`), que sirve siempre la versión vigente, así que no puede
  detectar un cambio;
- el hash es de la página entera y cambia en cada descarga por diseño (lo dice la propia §8).

Teníamos la sensación de estar anclados sin estarlo. El BOE ya publica la señal buena: cada bloque
del consolidado (un artículo, un anexo) marca su redacción vigente con
`<input name="p" value="AAAAMMDD" checked>`, la «Última actualización, publicada el…».

## Lo que cambia

- `docs/verificacion/comprobar-citas-contabilidad.mjs`: además de lo que ya hacía (cita literal +
  control negativo, **sin tocar esa lógica**), ancla cada cita a su fuente, a **todos** los bloques
  que la contienen y a la redacción vigente de cada uno. Se compara contra
  `docs/verificacion/anclas-citas-contabilidad.json`, y `--fijar` reescribe ese fichero.
  - **Por bloque y no por página:** el art. 7 y el anexo I de la Orden EHA/3786/2008 cambian por
    separado. Una alarma por página saltaría con cada cambio del impreso sobre la cita del plazo, y
    las falsas alarmas matan un comprobador antes que no tenerlo.
  - **Un código de salida por cada tipo de fallo; «no pude leerlo» nunca sale como «no ha cambiado».**

    | código | significado |
    |---|---|
    | 3 | FUENTE ILEGIBLE: falta el fichero, está vacío, es una página de error servida con 200 u otra norma. Se comprueba antes que nada y no afirma nada más. |
    | 1 | una cita no aparece, o falla un control |
    | 2 | NORMA CAMBIADA |
    | 4 | cita sin ancla, o ancla huérfana |
    | 0 | todo lo anterior limpio |

  - Lleva un **control del ancla en cada pasada**: una redacción envejecida a propósito tiene que salir
    como cambiada. Si no sale, exit 1, porque el comprobador estaría ciego.
  - `--fijar` se niega a escribir si alguna cita no aparece o no cae en ningún bloque: unas anclas así
    mentirían.
- `docs/verificacion/anclas-citas-contabilidad.json`: 31 anclas fijadas contra las fuentes bajadas
  con `curl` el 25-sep-2026. Ejemplo: ORDEN303 art. 7.2 → `a7@20170515`, la misma fecha que se leyó a
  mano en SCRUM-1096.
- `tests/scrum1117-anclas-por-bloque.test.mjs`: 12 casos que corren el comprobador de verdad sobre
  fuentes fabricadas en el temporal del sistema (las reales no están en git). El último caso comprueba,
  sin fuentes, que el conjunto de anclas del repo coincide con las citas de CONTABILIDAD.md: una cita
  nueva sin fijar hace caer `npm test`.

## Medición

| pasada | resultado |
|---|---|
| **rojo primero**: los 12 casos contra el comprobador anterior | **9 fallan**, 3 pasan. Los 3 que pasan lo hacen por motivos ajenos al ancla: «un bloque sin la cita cambia → 0» (el viejo nunca mira bloques), «--fijar se niega» (el viejo sale 1 porque la cita no aparece) y el de conjunto (no usa el script). |
| verde: los 12 contra el nuevo | 12/12, exit 0 |
| **mutación A**: la redacción siempre `original` (no lee el `checked`) | 2 fallan (los dos de NORMA CAMBIADA) |
| **mutación B**: se apaga la puerta de FUENTE ILEGIBLE | 5 fallan |
| fuentes reales, `--fijar` + comprobar | 31 citas, 31 encontradas, 31 anclas, 0 cambiadas, exit 0 |
| **rojo con fuentes REALES**: en el ORDEN303 bajado se cambia solo la redacción `checked` del art. 7 | exit **2**, y nombra **una sola** cita (la del plazo del 303) con `a7@20170515 → a7@20260925` |
| fuentes reales con `RFACT.html` vacío | exit **3**, «FUENTE ILEGIBLE — no se ha comprobado nada» |

**Re-medido tras rebasar sobre el `main` de hoy** (el WIP se hizo sobre `dfe1c453`; entre medias entró en
CONTABILIDAD.md la nota de SCRUM-1096, sin citas nuevas). Fuentes **bajadas otra vez con `curl`** el
25-sep-2026 ~17:50Z, las seis con HTTP 200:

| pasada | resultado |
|---|---|
| fuentes de hoy, comprobar (sin re-fijar) | 31 citas, 31 encontradas, 31 anclas, 0 cambiadas, 0 sin ancla, 0 huérfanas, exit **0** |
| mismas fuentes con `RFACT.html` vacío | exit **3**: el camino de «no pude leerlo» sigue separado de «no ha cambiado» |
| ORDEN303 de hoy con el `checked` del art. 7 cambiado a `20260925` | exit **2**, una sola cita: `a7@20170515 → a7@20260925` |
| `tests/scrum1117-anclas-por-bloque.test.mjs` | 12/12 |

Al rebasar, `npm test` destapó que el test **dejaba sus temporales sin borrar** (SCRUM-864c: un `mkdtempSync`
por caso, sin limpieza) y que el censo de SCRUM-824 no podía seguir sus escrituras (`m.fuentes`, `m.doc`). Arreglado
en el test, **sin tocar ninguno de los dos guards**: un solo temporal por fichero con `after(...rmSync)`, y todas las
escrituras por un ayudante `escribe(rel, …)` que cuelga de él. El censo clasifica ahora las 7 creaciones como `TMP`.
El rojo primero se repitió tras el arreglo: contra el comprobador de `main`, 9 de 12 fallan, como antes.

Nota del instrumento: mi primer intento de ese rojo salió exit 0 porque mi mutación cambió el `id` del
`<input>` (`lab820170515`, que contiene la misma fecha), no su `value`. Era mi mutación, no el
comprobador: con el `value` cambiado salió 2.

## Límites, declarados

- El comprobador **no baja** las fuentes: las lee de una carpeta. Detecta un cambio de la norma cuando
  alguien las vuelve a bajar y lo corre. Hacerlo periódico (cron, CI con red) es otra decisión y no se
  construye aquí.
- La redacción `checked` detecta cualquier **modificación publicada** del bloque. Una derogación de la
  norma entera que no toque los bloques no la vería. Hoy el BOE marca los bloques derogados
  («(Derogado)») y eso cambia su redacción, pero no está medido para una derogación completa.
- La §8 de CONTABILIDAD.md sigue guardando URL + hash y no se toca aquí: este ticket añade el ancla por bloque, no
  reescribe la §8. Que la §8 apunte a `anclas-citas-contabilidad.json` es un cambio de texto aparte.
  y #1761, que editan las líneas vecinas.
