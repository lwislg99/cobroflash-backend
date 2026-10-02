# SCRUM-1425 · Gastos: la foto que cabe también tiene que ser una foto

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:04:52Z
A9: comprobación → `tests/scrum1425-foto-pequena-que-no-es-imagen.test.mjs`

Carril S2 (`public/dashboard/js/expensesView.js`) · rama `scrum-1425-foto-pequena-que-no-es-imagen` · sesión `s2-2octa`. Sale del barrido de producción del 2-oct (al mirar #1979).

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en un fichero de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto nuevo**.

## El defecto, medido en yaqu.app

`fotoParaGuardar` sólo abría la foto cuando no cabía en la petición (data-URI de más de ~1,5 MB). Una que cabía se mandaba sin mirarla.

Formulario real de «Nuevo gasto», cuenta QA, build `b06d474d`, 2-oct-2026:

| Fichero elegido como foto | Qué pasó |
| --- | --- |
| 1,4 MB que no es una imagen | sale el aviso firmado; no se manda nada |
| 37 bytes que no es una imagen | **ningún aviso**; el panel manda `POST /admin/expenses` con eso como justificante |

(La sonda cortó la petición. Qué hace el servidor con ese contenido no está medido, y con este arreglo deja de llegarle.)

## El texto

No es texto nuevo. Es el ya firmado para este mismo formulario, este mismo momento y esta misma acción: «No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del ticket.» — aprobado por el orquestador por delegación del fundador, 18-sep-2026, SCRUM-947 comentario 15931 (`docs/microcopy/2026-09-18-SCRUM-947-foto-del-gasto.md`). Reutilizarlo aquí lo decidió el orquestador el 2-oct-2026.

## Lo construido

La foto que cabe ahora se ABRE antes de mandarla (`esUnaFotoQueSeAbre`). Si abre y tiene ancho y alto, se manda **el original, tal cual**: no se recomprime. Si no, sale el aviso y no se manda nada. Vale también para «Leer el ticket», que pasa por la misma función.

No cambia el techo de 1,5 MB, ni cómo se reduce la que no cabe, ni lo que se manda cuando la foto es buena.

### La excepción, y por qué no es «abrir siempre» a secas

El encargo era abrir siempre. Medido antes de construir: una **HEIC pequeña en un navegador que no sabe abrir HEIC** (Chrome; la propia ficha de SCRUM-947 nombra ese caso) hoy se guarda bien, y el servidor la lee (`lecturaTicket.ts` admite `image/heic`). Con «abrir siempre» esa foto pasaría a rechazarse: se arreglaría el agujero rompiendo un camino que funciona.

Así que, si no se puede abrir, se mira la **cabecera** del fichero (`ftyp` + marca HEIF, los 12 primeros bytes): si es HEIF, se manda como hasta hoy. Se decide por el contenido, no por el nombre ni por el tipo que el fichero declara: un texto llamado `.heic` no pasa.

## Verificado, ejecutando

`tests/scrum1425-foto-pequena-que-no-es-imagen.test.mjs`, con el modal real de Gastos en el banco:

- **Rojo antes** (con el `expensesView.js` de `main`): caen los cuatro del defecto (fichero pequeño que no es imagen, el que sólo se llama `.heic`, el que abre sin tamaño, y «Leer el ticket») y «lo abierto se suelta», que antes no se abría. Pasan el suelo, la imagen pequeña buena y la HEIC pequeña: lo que ya funcionaba.
- **Verde después:** 8 de 8. La imagen pequeña buena se manda con el mismo data-URI, sin aviso.
- Vecinos (`scrum1233d`, `scrum1038`, `scrum1155`, `scrum522`, `scrum1185`, `scrum1344`, `scrum644`, `scrum378`, `scrum947` y los del registro) más éste: 198 de 198.

### Un test vecino cambió, y se dice

`tests/scrum1038-leer-el-ticket-gasto.test.mjs` cayó al abrir la foto que cabe (19 casos). Su «foto» de prueba son tres bytes (`ABC`) declarados como JPEG, y el mini-DOM del banco no decodifica imágenes: era, literalmente, un fichero pequeño que no es una imagen. Se le ha puesto a SU banco un `createImageBitmap` que abre (dos sitios, una línea cada uno), para que su foto de prueba haga de foto buena. **No se ha tocado ninguna aserción** de ese fichero; lo que pasa con una foto que no se abre lo mide el test nuevo.

## Límites

- **No visto en un navegador con este código.** En el banco, «se abre» o «no se abre» lo decide el fichero de prueba; no hay un decodificador de verdad.
- **Una HEIC pequeña y corrupta por dentro** con la cabecera bien, en un navegador que no abre HEIC, sigue pasando: ahí el navegador no puede juzgar. En Safari, que sí abre HEIC, se detecta.
- **Una imagen que abre pero es ilegible** (borrosa, negra) no la detecta nadie aquí: se comprueba que es una imagen, no que se lea el ticket.
- `scripts/guard-foto-del-gasto.mjs` (navegador real, fuera de la tanda) no se ha tocado; su caso «pequeña que ya cabía» usa un JPEG de verdad y debe seguir igual. No tiene caso de «pequeña que no es imagen».
