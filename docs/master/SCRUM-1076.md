# SCRUM-1076 · Calendario de plazos con estado — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

Ningún fichero de `src/` o `public/dashboard/js/` contiene `calendario` en sentido fiscal (grep sin
resultados relevantes). No hay tabla en `prisma/schema.prisma` para un estado
«pendiente/llevado al asesor» por modelo y trimestre.

## Por qué no se puede construir hoy — medido, no supuesto

La aceptación (punto 1) exige **explícitamente**: «Solo tras SCRUM-1039: las órdenes de los
modelos descargadas, los plazos citados literalmente y comprobados por el script con control
negativo, y Q-C8 respondida». El propio ticket ya trae la prueba de que hoy no hay fecha
verificable: cita `CONTABILIDAD.md §4 (Q-C8)` diciendo que «el art. 71 RIVA localizado no contiene
los plazos» y da como contraejemplo medido (por un subagente, sin releer) el calendario de Billin
con fechas de 2024 dentro de un calendario de 2026 — exactamente el defecto que este ticket
existe para evitar. Medido igual que el resto del lote: SCRUM-1039 «Tareas por hacer», Q-C8 sin
respuesta en `docs/producto/CONTABILIDAD.md:86`.

El punto 3 de la aceptación repite el mismo criterio que el resto del lote: «sin cita, la fila no
aparece». Sin ninguna fecha citada, el calendario no tendría ninguna fila que pintar.

## Siguiente paso exacto

Ninguno para J1 hasta SCRUM-1039 (plazos citados y comprobados por su propio script con control
negativo) y Q-C8. Depende también de qué modelos existan ya (303/130/111-115/347/390): si algunos
de ese lote siguen sin construir cuando esto se desbloquee, el calendario nace con menos filas de
las que el ticket imagina.

## STOP respetado

No se ha inventado ninguna fecha ni estado. Solo lectura y este documento.

## SCRUM-1076b · Plazos de 130, 111, 115, 347 y 390 citados con su orden y comprobados por script (J5, 13-nov-2026)

**Medido contra:** `origin/main` = `e1ebdcf627097b2a2efaae7b967f55b62b4b3987` · 2026-11-13T18:27:26Z
**Rama:** `scrum-1076b-plazos-citados` · **Puesto:** J5 (sesión jv-j5bb) · **Encargo:** orquestador J, 13-nov-2026, a partir de SCRUM-1076 c.21839 (jv-j1es: el bloqueo ya no son los modelos, son las citas de plazo)

A9: comprobación → `tests/scrum1076b-fuentes-de-los-plazos.test.mjs`

**Cruce de carril, declarado:** una línea de `tests/scrum1117-anclas-por-bloque.test.mjs` (SCRUM-1117, `area-j4`): las cinco claves nuevas en su constante `BOE`, ninguna aserción tocada. Autorizado por el orquestador J el 13-nov por mensaje («tócalo tú en tu PR», con esas condiciones). El script y `CONTABILIDAD.md` no tienen dueño en `carriles.mjs`.

### Qué se hizo

1. **Los cinco plazos, en `docs/producto/CONTABILIDAD.md` §10**, cada uno literal de su orden: 130 → Orden EHA/672/2007, art. 7 · 111 → Orden EHA/586/2011, art. 3.1.c · 115 → Orden de 20-nov-2000, apartado séptimo · 347 → Orden EHA/3012/2008, art. 10 (redacción de la Orden HAC/1148/2018) · 390 → Orden EHA/3111/2009, art. 8 (añadido por la HAP/2725/2012). El 303 sigue en §3 (Orden EHA/3786/2008, art. 7.2).
2. **Vigencia, con dos sondas:** el consolidado (`act.php`, la redacción marcada de cada bloque) y la API de legislación consolidada (`…/texto/bloque/<bloque>`: la última `version` y su `fecha_vigencia`; `…/metadatos`: `vigencia_agotada` = N en las cinco). Control positivo de la API: el art. 10 del 347 devuelve sus 4 versiones (2009, 2012, 2018-ene, 2018-nov).
3. **El mismo script que el 303** (`docs/verificacion/comprobar-citas-contabilidad.mjs`): cinco fuentes obligatorias más (`ORDEN130`, `ORDEN111`, `ORDEN115`, `ORDEN347`, `ORDEN390`), y sus cinco anclas en `anclas-citas-contabilidad.json`, **añadidas a mano desde un `--fijar` sobre un fichero temporal**. No se ha corrido `--fijar` sobre el JSON real: reescribiría las 31 anclas y apagaría la alarma del art. 91 y del art. 20 de la LIVA que SCRUM-1039f dejó viva a propósito.
4. **De paso, un defecto del script, arreglado:** decidía si un HTML es la norma por el campo `name="id"` del formulario de redacciones, y una norma que **nunca se ha modificado** no trae ese formulario (medido: la del 111 tiene 0 selectores de redacción; las otras cuatro, de 11 a 38). Salía «FUENTE ILEGIBLE». Ahora acepta también el `id_local` de los metadatos ELI, **con el mismo id exigido**; una página con el `id_local` de otra norma sigue saliendo 3.

### Medido

| | |
|---|---|
| rojo 1 (citas nuevas, script de `main`) | 36 citas · 31 encontradas · **5 NO ENCONTRADA** (las cinco nuevas) · salida 1 |
| tras el cambio | **36 / 36** · control negativo OK · control del ancla OK · sin ancla 0 · huérfanas 0 · norma cambiada **5** (las de la LIVA, previas) → salida **2**, igual que en SCRUM-1039f |
| CIEGO | carpeta sin `ORDEN347.html`: salida 3, la nombra |
| población de fuentes | 11 HTML, GET público hacia las 18:19Z (`Date:` del BOE); bytes y SHA-256 en §8 |
| `tests/scrum1076b-…` | con el script de `main` (variable `COMPROBADOR_CITAS`): **8 de 8 caen** · con el de la rama: 8 de 8 pasan |
| `tests/scrum1117-…` | con las 5 fuentes nuevas y sin su línea: **6 de 12 caen** (los que esperan 0, 2 o 4) · con la línea: 12 de 12 |

### Lo que NO se ha hecho, a propósito

- **Sábados, festivos, prórrogas y domiciliación: no se citan.** Esperan al asesor (Q-C8, SCRUM-1264). Lo que sí se ha visto, sin transcribir: las órdenes del 130, el 111 y el 115 traen una frase sobre vencimientos en sábado o día inhábil; la del 347 remite al art. 17.2 de la Orden HAP/2194/2013 (**NO VERIFICADO**: no se ha bajado), y la del 390 al art. 4.4 de su propia orden, que el consolidado da **suprimido con efectos de 1-ene-2023** (Orden HFP/1124/2022). Las dos remisiones van al asesor tal cual.
- Ni `src/`, ni esquema, ni texto de usuario. El calendario de SCRUM-1076 sigue sin construir: lo que cambia es que ya hay plazo citado de los seis modelos, y Q-C8 sigue abierta para los casos límite.
- `CONTABILIDAD.md` se cita por `fichero:línea` en diez registros (hasta la `:135`): la §10 va al final y las filas nuevas de §8 debajo de la `:200`; la única línea anterior que cambia es la `:78`, en sitio.

### Errores míos

- Leí Jira antes de la lectura de arranque, así que mis dos puntos de medida de contexto salieron en uno (145.037).
- Puse primero la entrada de versión arriba del documento, cuatro líneas que habrían desplazado diez anclas `CONTABILIDAD.md:<línea>`. Lo vi antes del commit (`git grep` de las anclas) y la quité.
