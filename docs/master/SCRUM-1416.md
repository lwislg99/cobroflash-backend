# SCRUM-1416d · Tres nombres construidos que entraron en `main` a la vez que el guard de SCRUM-1415

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:13Z

A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

Rama corta `scrum-1416d-main-rojo-tres-nombres-construidos`, de `main`, por encargo del orquestador.

Tres PR se cruzaron: el guard de SCRUM-1415 entró en `main` a las 12:32Z, `scrum1420` a las 12:38Z y
`scrum1379b` a las 12:42Z (horas del orquestador). Cada uno verde contra su base; juntos, la mitad ①
del guard cae en todo PR que se pruebe contra `main`: `construidas=98` contra una lista de 95.

- `tests/scrum1379b-id-fuera-de-rango-resto.test.mjs` — 2 sitios, 48 casos. El bucle llevaba una
  constante `nombre` que sólo se usaba dentro de los dos nombres; se ha metido en las dos plantillas.
- `tests/scrum1420-el-pad-avisa-al-cerrarse.test.mjs` — 1 sitio, 4 casos.

No se añaden a `DECLARADAS` (sólo baja): pasan a literal con `casosEscritos`. Sólo cambia la FORMA
de declarar los casos; ninguna aserción se toca.

| fichero | casos antes | casos después | fail después | conjunto de nombres |
|---|---|---|---|---|
| `scrum1379b-id-fuera-de-rango-resto` | 49 | 49 | 0 | idéntico |
| `scrum1420-el-pad-avisa-al-cerrarse` | 11 | 11 | 0 | idéntico |

Población del guard tras el arreglo, sobre `main`: `ficheros=1214 llamadas=9896 literales=9801 construidas=95 en_ficheros=56 lista=95 en_ficheros=56`.

Lo que NO se ha visto: un run de CI de `main` en rojo por esto. Sus últimas corridas están canceladas
o en cola; el rojo está medido en local y en los artefactos de #2153 y #2155.
