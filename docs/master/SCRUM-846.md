# SCRUM-846 · Instrumentos de medición sin un caso conocido delante: de 19 (inflado) a 0

**Fecha:** 15-sep-2026 · **Carril:** verificación (Sesión 0) · **Gate:** censo + siembras vistas caer

**Medido contra:** `origin/main` = `5359f41d9593c22cbba7926bbe5a41510d79f3a1` · 2026-09-15T12:45+02:00

**Rama:** `scrum-846b-siembras-a-los-quince` · **Preámbulo:** `prisma generate` rc=0 ·
`git rev-list --count HEAD..origin/main` = **0** al ramificar (sobre `d9a05138cb61a30916300951a979db84121d8002`)
· árbol limpio.

> ⚠️ **`main` se movió 13 commits durante la tanda**, y entre ellos un censo nuevo
> (`scripts/censo-estado-no-contemplado.mjs`, SCRUM-707). Como el cierre se juzga EN MAIN, se trajo
> con `git merge origin/main`, se regeneró Prisma, se recompiló y se volvió a medir: **0 sin caso**.

## Qué es un caso conocido, y por qué hacía falta

Un instrumento que sólo lee el árbol de verdad devuelve un cero que no distingue «no hay nada» de
«no he sabido mirar». Un caso conocido es una entrada FABRICADA —un literal, un árbol temporal, una
mutación inyectada— cuya respuesta se sabe de antemano, y lleva su mitad negativa: una entrada que
tiene que dar SÍ y otra que tiene que dar NO. Sin la negativa, un instrumento que dijera «sí» a todo
pasaría.

## Cómo se llegó a cero

| tanda | qué | cifra |
| --- | --- | --- |
| 9-sep · PR #1238 | casos para `_censo-eol`, `_censo-target-tactil`, `_censo-marcado-de-cobro` y `frontera-dist` | el enunciado decía 19, y estaba inflado |
| 9-sep · PR #1248 y 15-sep · PR #1257 | el censo que los cuenta: arista de llamada para las hermanas, control negativo sembrado, procedencia resuelta por AST en su ámbito | 15 sin caso, calibrado 20/20 contra juicio a mano |
| 15-sep · esta rama | una siembra con SÍ y NO para cada uno de los 15, y un rompedor que las hace caer | **0 sin caso** |

## Los quince, en el orden de lo que gobiernan

El orden se leyó en cada instrumento, no en su nombre: primero lo que decide sobre dinero, tenencia,
camino fiscal o producción; lo de botones, lo último.

| # | instrumento | qué gobierna | siembra |
| --- | --- | --- | --- |
| 1 | `scrum245 · censarLlamadas` | que cada envío de WhatsApp declare su merchant (tenencia) | en su propio fichero |
| 2 | `_censo-copy-vs-flag · censoCopy` | si un rótulo con «factura» lo elige `INVOICING_ES_ENABLED` (camino fiscal) | `scrum846b-siembras-a-los-quince` |
| 3 | `_censo-estrechamientos-linea` | líneas de factura rehechas con cuatro claves que pierden lo demás | ídem |
| 4 | `scrum746 · censoDeConexiones` | clientes de base que pueden alcanzar producción sin comprobar el destino | en su propio fichero |
| 5 | `_censo-new-url` | errores de `new URL()` alcanzables, que llevan la cadena de conexión | `scrum846b-siembras-a-los-quince` |
| 6 | `_puertas-del-presupuesto` | qué campos lleva cada puerta del PDF del presupuesto | ídem |
| 7 | `censo-guards-gateados` | que un test saltado no cuente como uno que corrió | ídem |
| 8 | `_censo-almacenamiento-publico` | qué guarda la landing en el navegador y qué enlaces al registro atribuyen | ídem |
| 9 | `_texto-fuera-del-censo` | promesas de capacidad en `#comparativa` (caso diferencial: el registro de anclas es el real) | ídem |
| 10 | `_censo-body-apirequest` | la forma del `body` de cada `apiRequest` | ídem |
| 11 | `_censo-peticiones-panel` | los `fetch` que se saltan el plazo de red | ídem |
| 12 | `_inventario-detalle-trabajo` | las acciones del detalle del trabajo | ídem |
| 13 | `_censo-superficies-configuracion` | los bloques de Configuración | ídem |
| 14 | `_censo-modal-footer` | los pies de modal y sus botones | ídem |
| 15 | `_censo-clases-de-boton` | variantes de botón sin la base `btn` | ídem |

Los dos que viven en su propio fichero lo hacen porque su instrumento está DENTRO de un `.test.mjs`:
importarlo desde otro test volvería a registrar todos sus tests.

## Visto caer

`node scripts/verificacion-s5/romper-los-quince.mjs`

- **Suelo:** las 15 siembras, sin romper nada, en verde y con al menos un test ejecutado cada una.
- **Roturas:** 31 —«dice que sí a todo» y «dice que no a todo» por instrumento, tres en
  almacenamiento—, y las 31 tumban su siembra. Cada fichero roto se restaura y se comprueba byte a
  byte.
- **Un ancla caducada cuenta como fallo, no se salta.** Pasó en la primera corrida: el texto que se
  rompía en `scrum245` está dos veces —`censarLlamadas` y `censarTexto` repiten la comprobación— y
  el rompedor lo dio en rojo en vez de romper la que no era. Se corrigió declarando cuál se rompe,
  tras comprobar que la primera aparición está dentro de `censarLlamadas`.

Commit de las siembras: `19291ab63be7100c8c5ab8fa1d58a91dc67a79e6`, comiteado ANTES de inyectar el
primer rojo.

## Cómo se comprueba el cierre

`node scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs` → `SIN ninguno: 0`, con sus tres
suelos y sus 19 siembras propias en verde. **No hay excepciones declaradas**: los quince admitieron un
caso fabricado.

## Cambios fuera de las siembras, todos aditivos

- `censoDeConexiones` (scrum746) recibe la raíz por parámetro, con la de siempre por defecto.
- `censarMarcadores` y `censarLectores` (PR #1238), lo mismo.

## Límites declarados

- **Lo que el censo no mira no sale en su cero.** Su población son las funciones EXPORTADAS con verbo
  de medida en `scripts/` y `tests/`, sin subcarpetas. Un script que mide sin exportar nada —como
  `scripts/censo-estado-no-contemplado.mjs`, que entró durante esta misma tanda— no cuenta ni para
  bien ni para mal.
- El censo sólo mira el PRIMER argumento de cada llamada.
- Donde su criterio laxo y el estricto coinciden, no se ha juzgado a mano.
- Una siembra demuestra que el instrumento VE su caso fabricado; no que su cifra sobre el árbol de
  verdad sea la correcta.
