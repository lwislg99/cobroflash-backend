# SCRUM-1482 · El buscador y la cabecera de la ficha dejan de enseñar el id de la tabla del presupuesto

**Medido contra:** `origin/main` = `bafb07340557298cd5bfde943d81ade8823d4a78` · 2026-10-06T19:29:37Z
A9: sin fallo que generalice — el primer rojo del buscador fue del banco y no del producto (el término buscado se envolvía en `<mark>` y el banco no suma el texto de los hijos); lo paró el control «CIEGO» del propio test antes de tocar código

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Dos ficheros de `public/dashboard/js` (`quotesDetailView.js`, `globalSearch.js`): cambia QUÉ texto se pinta en dos nodos que ya existían; sin marcado nuevo, sin clases, sin estilos, sin tokens.

6-oct-2026 · **S2** (`s2-6octh`) · rama `scrum-1482-el-panel-no-ensena-el-id-de-la-tabla`. Lo abrió S2
(`s2-6octf`) con su medición en yaqu.app. Gemelo: SCRUM-1483 (S1), en `main` y desplegado.

## Qué entra y qué NO

| Sitio | Antes | Ahora | Estado |
|---|---|---|---|
| Buscador de arriba (`globalSearch.js`) | `#205`, el id de la tabla | el texto que manda el servidor (`numeroVisible`: `#4`, `#4.1`); sin él, ningún número | **hecho** |
| Cabecera de la ficha, mientras carga y si la carga falla (`quotesDetailView.js`) | «Presupuesto #205» | la palabra de `appLocale.quote`, sola | **hecho** |
| Cabecera y título, cargada | «Presupuesto #4» | igual | sin tocar |
| **Título de la vista, mientras carga y si falla** (`app.js`, el router) | «Presupuesto #205» | **igual: sigue enseñando el id** | 🔴 **NO HECHO** |

Las aceptaciones 2 y 3 del ticket quedan **a medias**. El ticket no se cierra con esta entrega.

## Las firmas

- **El literal de la cabecera:** orquestador por delegación permanente, SCRUM-1482 c.18490, sobre la
  propuesta de S2 en c.18482. Registro: `docs/microcopy/2026-10-06-SCRUM-1482-ficha-sin-numero-mientras-carga.md`.
- **El buscador no lleva texto nuevo:** pinta el del servidor (SCRUM-1444 c.18429, «no se compone
  nada en el front»). Sin `numeroVisible` no pinta número: es una ausencia, no un literal. Que ahí
  deba leerse otra cosa no está firmado, y SCRUM-1483 lo dejó dicho.

## 🔴 Por qué el título de la vista no entra

El literal firmado para el título mientras carga es «Presupuesto», sin `#`. El caso 7 de
`tests/scrum832-atras-vuelve-a-la-lista.test.mjs` («el router escribe el título que la ficha sabe
CORREGIR») exige dos cosas del FUENTE:

1. que `quotesDetailView.js` corrija el título con una regex anclada sobre `viewTitleEl`; y
2. que el `case 'quotes-detail'` de `app.js` contenga, entre comillas, el mismo prefijo que esa
   regex: hoy `'Presupuesto #'`.

Con (2), el router tiene que escribir «Presupuesto #» y algo detrás antes de que exista la
respuesta, y lo único que tiene entonces es el id de la ruta. El literal firmado y ese caso no caben
a la vez. Medido por `s2-6octg` (SCRUM-1482 c.18498): con el literal puesto y la regex intacta, el
caso cae **y además** el título se queda sin número para siempre al cargar; «cuadrar la regex» deja
el número de OTRO presupuesto en el título.

Sustituir ese caso está denegado a este puesto y la denegación no la levanta el orquestador. No se
ha dejado un `'Presupuesto #'` sin uso en el router para que el caso pase: sería conseguir lo mismo
por otro camino. **Queda pedido en el ticket**, con qué mide hoy ese caso y qué debería medir.

## Cómo se ha medido

`tests/scrum1482-el-panel-no-ensena-el-id-de-la-tabla.test.mjs`: 8 casos que EJECUTAN los dos
ficheros en el banco de vistas (`_banco-vistas.mjs`), con un presupuesto de id 205 y número 4.

| Tanda | Código | Resultado |
|---|---|---|
| antes | `origin/main` `bafb0734` | 8 casos · 2 pasan (los dos CONTROL) · **6 caen** |
| después | esta rama | 8 casos · 8 pasan · 0 saltados |

Los 6 que caían son exactamente los que miran el id: cabecera mientras carga, cabecera con otro
locale, cabecera con la carga fallida, y las tres filas del buscador. Los dos controles (cargada →
«Presupuesto #4» en cabecera y título; pulsar la fila abre la ficha 205) pasan antes y después.

En yaqu.app, antes de este cambio (build `bafb0734`, cuenta QA 46, sólo GET, sonda
`sondas-s2/id-global.mjs`, fuera del repo): el servidor ya manda `numeroVisible` y buscar «205» ya
no devuelve nada (SCRUM-1483), y la fila seguía pintando «#205».

## Lo que NO se ha medido

- **Nada de esta rama en yaqu.app:** no está desplegada. Cuando lo esté: `id-global.mjs` (fila
  «búsqueda») e `id-ficha.mjs`, sin argumento.
- **El router no se ejecuta en el banco.** En el caso «cargada» el título se siembra con lo que el
  router escribe hoy; el recorrido entero es de navegador.
- **Otro país en producción:** la cuenta QA es de España. Que la palabra sale del locale está
  ejecutado en el banco con un locale de «Cotización», no visto en una cuenta real.
- Móvil. Otro navegador.

## Lo que queda fuera, nombrado

- El título de la vista (arriba).
- Un presupuesto SIN número: la ficha cargada cae al id (`quote.number ?? id`). Familia de 12
  líneas nombrada en la descripción del ticket.
- La cabecera cuando el id de la ruta no es un número («Presupuesto #-»): intacta, no entra en la firma.
- Los «Presupuesto» escritos a mano: SCRUM-1487. Leído de paso y no contado allí: el botón
  «← Volver» de la ficha escribe «Presupuestos» a mano en el título (`quotesDetailView.js`).
