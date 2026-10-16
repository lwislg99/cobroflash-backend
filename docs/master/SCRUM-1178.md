# SCRUM-1178 · Comentarios que citan como red algo que no corre en CI

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:08Z

A9: sin fallo que generalice — el error de esta tanda es de un instrumento, no mío (`restaurarDesdeMarca`, abajo, arreglado en la segunda tanda); mi censo marca gateado el fichero entero y no el caso, y está dicho como límite.

S3 · rama `scrum-1178-citas-a-redes-que-no-corren` · worktree `wt-s3-1293` (hora del `Date:` de GitHub).

## Qué mentía

Comentarios que justifican «aquí no se vigila X» porque «eso lo hace» un censo que sólo corre a mano, o
un test gateado por `QA_DB_TEST`, que el CI no pone (`.github/workflows/ci.yml` sólo pone
`LIBRO_PG_URL`, `SERIE_PG_URL` y `TRAMOS_PG_URL`; el propio YAML explica por qué no pone la de staging).

## Cuánto

Censo de las líneas de comentario de `tests/` y `scripts/` (1.843 ficheros): citas entre comillas de
código a un `npm run X` que ningún workflow ejecuta (ni directa ni transitivamente: de 187 scripts de npm,
47 corren en CI) o a un test gateado por una variable que el CI no pone (69 ficheros). Control: `test` y
`censo:tactil-panel` salen como «corren»; `cr:censo` y `scrum76` como «no».

**43 citas en 38 ficheros.** Leídas una a una:

| clase | cuántas |
|---|---|
| la presentan como vigilancia y no lo es | **5** — las del ticket menos la que ya resolvió SCRUM-1172 |
| dicen lo CONTRARIO y ya es falso: que `censo:tactil-panel` no corre en ningún sitio, cuando desde SCRUM-1179-C corre en cada PR (informativo) | **2** — no venían en el ticket |
| herramientas (`dev`, `db:seed`, `topologia`, `arbol:mio`, `guards:entrada`, la tanda gateada…), historia de una medición, o ya dicen que no corre / que está gateado | 36 |

⚠️ Límite del censo: marca gateado el FICHERO entero, no el caso. `scripts/generar-sql-deriva.mjs:13`
sale como cita a un gateado y es cierta: el caso de `scrum222` que compara el SQL generado no lleva gate
(líneas 259-264). Y no ve una cita sin comillas de código: la de `scrum72` (que sí arreglo) no la cazó.

## Lo que se cambia (sólo comentarios; ninguna aserción)

| cita | antes | ahora |
|---|---|---|
| `tests/scrum570-cr-en-disco.test.mjs:13` | «eso lo hace `npm run cr:censo`» | lo mide `cr:censo` A MANO; el checkout no lo vigila nada |
| `tests/scrum754-el-juez-que-oscila.test.mjs:790` | «El recuento vive en `censo:gateados`» | … que se lanza A MANO |
| `scripts/censo-objetivo-tactil-panel.mjs:14-16` | el total «ya está bajo vigilancia (`censo:guards-navegador`)» y «esto se ejecuta cuando alguien quiere el número, no en cada tanda» | lo CUENTA a mano, no es vigilancia; y este censo SÍ corre en cada PR desde SCRUM-1179-C, informativo |
| `tests/scrum72-pdfs-privados.test.mjs:163-164` | «con test propio en `scrum76`» | … GATEADO: esa cobertura no existe en el check obligatorio |
| `tests/_pdf-texto.mjs:8` | «Los tests de PDF que había (`pdfs.test.mjs`)» | … GATEADOS: el CI no los corre |
| `scripts/guard-objetivo-tactil.mjs:381-384` | «esa red no corre en ningún sitio automático» (cierto el 27-sep) | se conserva y se fecha: desde SCRUM-1179-C SÍ corre, informativo, y sigue sin bloquear |

Ninguna se arregla haciendo que lo citado corra donde bloquea (la opción 1 del ticket): `cr:censo` tarda,
`censo:gateados` ejecuta la carpeta entera y `scrum76`/`pdfs` piden la base de staging, que el CI no
recibe por la regla 9. Las cinco quedan como comentarios que dicen la verdad.

## De paso: `restaurarDesdeMarca` pisa trabajo nuevo con una copia vieja — ARREGLADO (ver abajo)

`guards:entrada` paró el empuje con una marca huérfana de `meta-guard-mutaciones` en este worktree (pid
3228, 2026-10-01T10:45:47Z, `public/dashboard/js/homeView.js`): mi propia pasada muerta del 1-oct, ya
reparada a mano entonces. El remedio que propone (`--solo-censo`) llama a
`restaurarDesdeMarca` (`scripts/_marca-de-arbol.mjs:261-262`), que escribe la copia guardada **siempre
que los bytes difieran**, sin comprobar que lo que hay sea la mutación. Aquí la copia es el `homeView.js`
del 1-oct (75.033 B) y el de `main` hoy mide 85.825 B: **habría revertido ~10 KB de `main`** en el árbol.
No se lanzó. Comprobado que el árbol no estaba mutado (`git diff --quiet HEAD -- homeView.js` → igual;
copia ≠ fichero de hoy) y la marca se sacó del árbol, conservada fuera como evidencia.

El arreglo (guardar la huella de los bytes MUTADOS al marcar y restaurar sólo si lo que hay es eso) no
cabe en esta sesión, que pasa de 300k de contexto: queda para la siguiente S3, en su carril. Toca
`marcarEnVuelo` y sus llamantes (`meta-guard-mutaciones`, `censo-mudez`) y los bancos de `scrum808` y
`scrum754`, que marcan sin pasar los bytes mutados.

### El arreglo (segunda tanda de S3, 2026-10-15 16:38Z de GitHub, sobre `origin/main` `e8d27c636dfce4e80071a28552b40479e7195265`)

- **La marca apunta lo que escribe.** `apuntarMutacion(dir, abs, bytes)` (`scripts/_marca-de-arbol.mjs`)
  guarda en `en-vuelo.json` la huella sha256 de cada mutación, ANTES de escribirla. La llaman las dos
  herramientas: `meta-guard-mutaciones` (fuente y `dist`) y `censo-mudez` (sus dos escrituras).
- **La restauración sólo devuelve lo suyo.** Por pieza: igual a la copia → nada; igual a una mutación
  apuntada → se devuelve y se verifica; cualquier otra cosa (trabajo de después, fichero borrado, marca del
  formato de antes sin huellas, copia ilegible) → **no se escribe**, sale en `sucios` con «NO lo piso» y en
  `ajenos`, y la marca se queda. Fail-closed: lo que no se sabe nunca cuenta como mutación.
- **El aviso no manda pisar.** `marcasHuerfanas` separa `ajenas`, y `avisoDeMutacionPuesta`
  (`guards-entrada.mjs`) ya no las llama «mutado» ni les propone `--solo-censo`: dice que no es una
  mutación y que, si lo de ahora es lo bueno, sobra la marca. La trampa está en
  `docs/equipo/trampas-del-entorno.md` §11.

**El rojo primero, sembrado** (commit `4f8454f27ed0f491637097ba6db59b142682c1b7`, sólo el test):
`tests/scrum1178b-la-marca-no-revierte.test.mjs` contra el código de antes → 8 de 8 rojos; el que importa,
«🔴🔴 HA REVERTIDO EL FICHERO A LA COPIA DE LA MARCA», y también «una marca que no sabe qué escribió ha
escrito igual» y «ha recreado un fichero que alguien borró después».

**Sobre el árbol real, no sólo en el banco** (en `wt-s3-1293`, con el arreglo commiteado):
1. Lanzado `meta-guard-mutaciones` y matado (`taskkill /T` de SU pid) con la mutación puesta: marca con
   `mutaciones` = la huella del fichero mutado; `git diff --numstat` 1 1. `--solo-censo` → «Devuelto a sus
   bytes», salida 0, árbol limpio.
2. Otra vez matado; después, el fichero devuelto a HEAD + una línea nueva (trabajo de después, no la
   mutación). `--solo-censo` → **salida 3**, «NO lo piso…», y el sha256 del fichero idéntico antes y
   después. El aviso de `guards:entrada` sobre esa marca: «Esto NO es una mutación». Limpiado a mano y la
   marca fabricada retirada.

**Rojo propio en CI (punta `8bb3042ad`):** probé sólo los tests que importan los módulos tocados, y cayeron
dos censos transversales sobre mi test nuevo: `scrum1415` (los dos casos de ⑥ con nombre construido →
ahora literales) y `scrum824` (su banco cuelga de `temporal()` → declarado en `SIN_PROBAR_CONOCIDOS`, como
951d/1298/1089b). Lección: un test nuevo se pasa también por los censos de tests, no sólo por sus vecinos.

**Bancos tocados:** `scrum808` ① y `scrum754` (`bancoConMarca`) apuntan su mutación como las herramientas;
sin eso fijaban el comportamiento de antes («cualquier diferencia se devuelve»).

## Pruebas

27 ficheros (los seis tocados, los que los leen, `scrum710b` y `scrum737`): 252 tests · 251 pass · 0 fail
· 1 skip (`scrum72`, el gateado: en local sin base; en CI corre con `LIBRO_PG_URL`). Sin guard nuevo: lo
que distingue «cita una red» de «cita una herramienta» es el sentido de la frase, y un guard por texto
sobre eso daría rojos que no se reproducen. La norma general va en el ticket estructural del fundador
(SCRUM-1179, STOP: no se toca).
