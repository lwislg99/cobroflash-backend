# SCRUM-1631 · La fila del fallo de WhatsApp se espera antes de devolver

## J2 · SCRUM-1631 · carrera probada, vía (a) construida

**Medido contra:** `origin/main` = `06ad4f1bd53d25b701cd11ae42791db753329ceb` · 2026-10-30T17:30:06Z (hora de GitHub; sesión `jv-j2bt`, puesto J2, en su árbol `cobroflash-jv-j2bt`)

A9: comprobación → `tests/scrum1631-la-fila-del-fallo-se-espera.test.mjs`

### ① Lo medido

Banco: Postgres 16.14 desechable en loopback, UTF8, DDL de `migrate diff --from-empty` (33 tablas = 33 modelos), mismo `dist/` para el antes y el después salvo el arreglo. Salidas enteras en `evidencias/SCRUM-1631/antes.salida.txt` y `despues.salida.txt`; los instrumentos, al lado.

| qué se mide | población | sin arreglo | con arreglo |
|---|---|---|---|
| fila ausente al volver el envío, `not_configured` | 200 envíos | **174** | 0 |
| fila ausente al volver, tras una espera a la base (`template_invalid`) | 200 envíos | **164** | 0 |
| fila que no llegó nunca, proceso vivo | esos 400 | 0 (retraso máximo 26 ms) | 0 |
| fila perdida si el proceso muere al volver (`process.exit`) | 30 procesos | **30** | 0 |
| fila perdida si muere por SIGTERM | 30 procesos | **30** | 0 |
| `scrum116` solo, sin `WHATSAPP_*` | 25 procesos | **9 rojos**, «PREMISA ROTA» | 0 |
| `scrum116` solo, con `WHATSAPP_DRY_RUN=1` | 25 procesos | **1 rojo**, «PREMISA ROTA» | 0 |

Control de la sonda: una fila sembrada con espera se ve y una inexistente no; si falla, sale `CIEGO`. Control de los procesos que mueren: el mismo instrumento pasa de 0 a 30 filas con el arreglo, así que el cero de la tercera columna no es ceguera.

**La carrera queda PROBADA.** Con el proceso vivo la fila llega siempre, tarde: es lectura adelantada, no pérdida. La pérdida exige que el proceso muera dentro de esa ventana.

### ② La discrepancia entre S5 y 1599t

No había una buena y una mala: midieron dos entornos. S5 corrió sin `WHATSAPP_*` (su log dice `not_configured`) y 1599t con `WHATSAPP_DRY_RUN=1` (`evidencias/SCRUM-1599/medicion-1599t.salida.txt:62`, «corredor de 1599q (dry)»). Sin `WHATSAPP_*` el envío corta antes de tocar la base y hay menos consultas entre la escritura y la lectura del test. Con n=25: 9 rojos contra 1. El 2 de 7 de S5 y el 7 de 7 de 1599t caben en esas dos tasas. Que el 2 de 6 «con vecino y dry» de 1599t sea esta misma carrera es probable y NO está medido.

### ③ Producción: NO medida

No se ha intentado: esta sesión no toca producción, y una fila que falta no deja rastro en la base. Harían falta los logs de Railway para cruzar los avisos con las filas. Leído en el código, no intentado: `src/` no lleva ningún manejador de SIGTERM, así que un despliegue corta lo que esté en vuelo. La ventana medida es de milisegundos por envío fallido, de modo que el 30 de 30 es el peor caso forzado, **no una frecuencia**.

### ④ El arreglo

`src/integrations/whatsapp.ts`: las 7 `logFailure` pasan a `async`, sus 32 llamadas llevan `await`, y también las 3 escrituras de fallo que no pasan por ella: `resolverReservaDePlantilla` en `rechazada` y `sin_respuesta`, y el corte de la baja de `sendWhatsAppWindowFirst`. Esas 3 las nombro porque el fallo real de Meta con reserva nunca pasa por `logFailure`: arreglar sólo lo que dice el título dejaba fuera el caso principal.

Censo por AST de las 32 llamadas (`censo-1631.cjs.txt`): todas en función `async`, ninguna usa el valor, 31 seguidas de `return` y 1 al final de su rama `if`. Lo que devuelven las funciones no cambia. Sobre `$transaction`: 0 llamadas directas a los 8 envíos, con control sembrado; y 0 llamadas con nombre de envío dentro de los 33 `$transaction` de `src/` (por nombre, sin siembra: una función de nombre neutro que envíe por dentro no saldría).

**El `.catch` vacío.** El ticket decía que se tragaba cualquier error sin rastro. Medido en el código, no era así: `recordWaMessage` y `resolverReservaDePlantilla` ya capturan y escriben en el log, y nunca rechazan, así que el `.catch` era código muerto. Se sustituye por `filaDelFalloPerdida`, que escribe en el log si algún día rechazan. Se conserva para que el resultado del envío no dependa de ese contrato.

**El coste, y es real:** con la base inaccesible, un envío `not_configured` tarda unos 2 s (2.037–2.072 ms, 10 de 10) y devuelve lo mismo. Sin arreglo no lo medí; leído en el código, no esperaba. No he puesto plazo propio: esperar es el cambio pedido, y un plazo fijo decidiría cuándo se abandona la fila.

### ⑤ El test y las mutaciones

`tests/scrum1631-la-fila-del-fallo-se-espera.test.mjs`, 5 casos, sin base: para la escritura a medias y mira si el envío ha vuelto, en las 8 vías y en la plantilla reservada; comprueba que un fallo de escritura no cambia lo devuelto; y por AST vigila que ninguna escritura de fallo se quede sin esperar.

- Sin el arreglo: **5 de 5 caen**. Con él: 5 de 5 pasan. El arreglo se quitó con `git apply -R` y volvió con los bytes idénticos.
- Mutaciones, las 4 del catálogo, con `aplicarUna` de la casa: **4 de 4 cazadas**, árbol restaurado.
- `scrum115` con banco: 2 de 2.
- Tanda dirigida (139 ficheros que tocan envíos + guards): **1.348 casos = 1.333 pass + 15 skip, 0 fail**. Lista elegida por mí, no la suite.
- `guards:entrada`: salida 0. Los 4 de árbol entero que nombra y que no estaban ya en la tanda: 33 de 33. `scrum737` iba en la tanda.
- Build con tipos: salida 0.

**Sin correr:** suite entera local · `scrum116` con su fichero real (corrió una copia que sólo quita el gate de staging) · staging · la ruta `sin_respuesta` en marcha (sólo por AST: en un proceso de test la salida a Meta se bloquea y da `no_enviado`) · CI.

### ⑥ Lo que queda fuera, decidido

Las 8 escrituras de lo que **SÍ salió** (`sent`, `enviada`) siguen sin esperarse y con su `.catch` vacío: el ticket habla del fallo, y esperar ahí añade latencia a cada envío correcto. El mecanismo es el mismo: si el proceso muere en esa ventana, esa fila se pierde. Una plantilla con reserva se queda en `queued`, que es el lado seguro (P2). Las de texto, que no llevan reserva, no tienen ese respaldo.

Pieza 5 de SCRUM-1621: el motivo de la parada ya no está si esto entra en `main`. Medido sobre mi rama: 25 de 25 en los dos entornos, sin vecino. No he probado la rama de S5.

### ⑦ Errores míos

- Mi modo `cap` de la sonda no llegó al tope: la plantilla sin componentes se paró antes en `template_invalid`. Lo delató su propia columna `razones`. El dato sirve (hay una espera a la base antes del fallo), pero no es lo que el nombre dice, y por eso en la tabla va con el motivo real. El camino del tope sí lo recorrió `scrum116` en `dry`, `customer_daily_cap` en 24 de 25.
- Le pasé a node un guion por heredoc y bash se comió una barra invertida: otra vez la línea de las cicatrices de J2. Falló en alto y lo rehíce con la herramienta de ficheros.
- Crucé los 200k de contexto y lo vi al medirme después de la tanda dirigida, en 233.547, no en el momento de cruzarlos.
- El caso «si la base falla» cae sin el arreglo por el orden, no porque faltara el aviso: el aviso existía, pero llegaba después de volver el envío.
