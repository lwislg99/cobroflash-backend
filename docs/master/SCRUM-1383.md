# SCRUM-1383 · Una firma rechazada durante el cierre de sesión desaparece sin aviso (todo menos el literal)

**Medido contra:** `origin/main` = `a2fe215e5fdd5f86b6b13fe009198daed27b3a5a` · 2026-10-02T12:22:24Z
A9: comprobación → `tests/scrum1383-rechazo-durante-el-cierre.test.mjs`

Carril S2 (`public/dashboard/js/app.js`) · rama `scrum-1383-rechazo-durante-el-cierre` · sesión `s2-2octa`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión. Dicho como fue: la cargué DESPUÉS de editar `app.js` y antes del commit; no cambió nada del diff. Cambio de lógica: sin marcado, sin estilos y **sin texto nuevo en pantalla** (el literal está pendiente de firma y no se pinta).

## El defecto, reproducido ejecutando

Estaba «leído, no ejecutado». Sonda sobre el banco de `tests/_banco-almacen-local.mjs` contra `main` con el aviso de SCRUM-1302 dentro; el servidor contesta `400 firma_invalida` al `POST …/firmar`:

- **Control positivo** (drenado sin logout): 1 en cola → 1 intento → 0 en cola → 1 constancia.
- **El caso** (`logout()` con esa firma en cola): 1 intento de subida · 0 preguntas · `/auth/logout` llamado · en el login · 0 en cola · **0 constancias**.

La firma no está en el servidor ni en el móvil, y nadie lo ha dicho.

**Lo crea la mitad (b) de SCRUM-1302, no sólo lo hereda.** Antes el logout no intentaba subir: el rechazo sólo podía venir de un drenado anterior, con la sesión abierta. Ahora puede producirse dentro del propio cierre, justo antes del purgado.

## Lo que NO se hace: conservar la constancia

Se propuso no purgar `yaqu_firma_rechazada_<clave>`. Medido, no vale:

1. La constancia no dice de qué cuenta es (`{ clave, tipo, documentoId, codigo, rechazadaEn }`) y la pantalla la casa por `firma:albaran:<id>`. Si sobrevive al cierre, otra cuenta en ese móvil con un albarán del mismo id vería un rechazo ajeno.
2. Purgarla es una decisión escrita (`almacenLocal.js`, inventario, art. 32 RGPD).
3. La fija `tests/scrum890b-rechazo-visible.test.mjs` («cerrar sesión borra también las constancias»).

El purgado no cambia. Se pregunta ANTES.

## Lo construido

En `confirmarCierreConFirmasSinSubir` (`app.js`):

- Las constancias se cuentan **después** del intento de subida y **antes** del purgado (`firmasRechazadasAlCerrar`).
- Se cuentan **todas** las del móvil, no sólo las que nacen en este cierre.
- **No se cuenta `invalid_id`**, igual que la pantalla del albarán: con ese código volver a pedir la firma da el mismo no.
- Va **una** pregunta (`textoAlCerrarSesion`): si hay rechazadas y sin subir, las dos cifras llegan al mismo texto.
- «Cancelar» sale de `logout()` antes del purgado: ni cierra, ni borra la cola, ni borra las constancias.
- Constancias ilegibles → no se pregunta por ellas (sin cifra cierta no se afirma nada).

**El literal no está.** `textoFirmasRechazadasAlCerrar(rechazadas, sinSubir)` devuelve `null`, y con `null` no se pregunta por las rechazadas: en producción, este cambio se comporta **igual que `main`**. El defecto sigue abierto hasta que entre el texto firmado. Con firmas sin subir, la pregunta firmada de SCRUM-1302 sigue saliendo como hoy.

## Decisiones (orquestador, 2-oct, por mensaje; el texto sube al fundador)

(a) todas las constancias · (b) `invalid_id` no se cuenta · (c) no se dice qué documento · (d) una pregunta, no dos.

## Texto PROPUESTO, sin firmar y sin pintar

- una: «1 firma no se ha podido registrar y hay que volver a pedirla. Si cierras sesión ahora, este aviso se borra de este móvil. ¿Cerrar sesión?»
- varias: «${n} firmas no se han podido registrar y hay que volver a pedirlas. Si cierras sesión ahora, este aviso se borra de este móvil. ¿Cerrar sesión?»
- combinado (rechazadas y sin subir): «Hay firmas que no han llegado: ${s} por subir y ${r} que no se han podido registrar. Si cierras sesión ahora, se borran de este móvil y habrá que volver a pedirlas. ¿Cerrar sesión?»

## Verificado, ejecutando

`tests/scrum1383-rechazo-durante-el-cierre.test.mjs`, con el `logout()` real. Para medir la fontanería sin el literal, el test pone un texto de banco en el hueco.

- **Rojo antes** (con el `app.js` de `main`): 7 de 12 caen (el suelo, que no encuentra el hueco, y los seis del defecto); pasan los controles.
- **Verde después:** 11 de 12, **1 saltado a propósito** («el literal firmado», pendiente de firma).
- Un caso fija lo de hoy: sin literal, con rechazadas no se pregunta.
- Vecinos (`scrum1302i`, `scrum1351`, `scrum455`, `scrum457`, `scrum460`, `scrum890b`, `scrum1185`, `scrum1344`) más éste: 118 verdes, 0 rojos, 1 saltado.
- La tanda dirigida de `app.js` son más de 150 ficheros: no se corrió en local; el juez es el CI.

## Límites

- **El aviso no dice QUÉ documento.** La constancia sólo lleva el id interno, y un identificador interno no se enseña.
- **`invalid_id` se pierde callado**, aquí igual que en la pantalla del albarán. No hay texto cierto que dar.
- Medido con albaranes y con `firma_invalida`, `firma_sin_nombre` e `invalid_id`; no con partes.
- No visto en un navegador ni en yaqu.app.

## Queda

1. La firma del fundador sobre los tres literales → entran en `textoFirmasRechazadasAlCerrar` y el test saltado se escribe.
2. Verlo en yaqu.app.

# APÉNDICE · 2-oct-2026 · los dos literales, y dos preguntas seguidas en vez de una

**Medido contra:** `origin/main` = `eca8566d130fc35e455b27508b1f3c199dc6263b` · 2026-10-02T16:57:37Z
A9: comprobación → `tests/scrum1383-rechazo-durante-el-cierre.test.mjs`

Carril S2 (`public/dashboard/js/app.js`) · rama `scrum-1383-dos-preguntas-al-cerrar-sesion` · sesión `s2-2octe`.

**Skill UI:** cargada (`yaqu-premium-ui`) antes de editar `app.js`. Sin marcado y sin estilos: es el texto de un `confirm` del navegador, el mismo mecanismo que ya usa la pregunta de SCRUM-1302.

## La firma, dicha como es

Los dos literales están aprobados **por el orquestador, por delegación del fundador** (2-oct-2026): Jira SCRUM-1383, comentario 18204. No lo escribió el fundador; el comentario relata su respuesta («decide tu») y lo dice él mismo. Trae también las cuatro decisiones.

- una: «1 firma no se ha podido registrar y hay que volver a pedirla. Si cierras sesión ahora, este aviso desaparece y no volverás a verlo. ¿Cerrar sesión?»
- varias: «${n} firmas no se han podido registrar y hay que volver a pedirlas. Si cierras sesión ahora, este aviso desaparece y no volverás a verlo. ¿Cerrar sesión?»

El texto propuesto más arriba («este aviso se borra de este móvil») y el combinado **no** son los aprobados y no se han construido.

## Qué cambia respecto a lo que entró con #2146

- `textoFirmasRechazadasAlCerrar(n)` devuelve el literal y ya no recibe las sin subir.
- `textoAlCerrarSesion` desaparece; en su lugar `preguntasAlCerrarSesion(sinSubir, rechazadas)` devuelve las preguntas en orden. **Son dos seguidas, no una combinada:** primero las sin subir (texto de SCRUM-1302, c.17889) y, sólo si a ésa se dice que sí, las rechazadas. Un «Cancelar» en cualquiera de las dos sale antes del purgado.
- No cambia: se cuentan todas las constancias del móvil menos `invalid_id`, después del intento de subida; ilegibles → no se pregunta; **la constancia se sigue purgando al cerrar** (`scrum890b`, art. 32).

## Verificado, ejecutando

- **Banco** (`logout()` real): rojo con el `app.js` de `main` 8 de 14, verde 14 de 14, ninguno saltado. Del test anterior cambian los dos casos que fijaban «una pregunta con las dos cifras» y «hoy, sin literal» (la decisión cambió en el c.18204), y el saltado pasa a ser el de los literales con `===`. Vecinos (`scrum1302i`, `1351`, `455`, `457`, `460`, `890b`, `1185`, `1344`, `1415`, `514`, `402`, `378`) con éste: 187 de 187.
- **Navegador, en yaqu.app** (Chromium de escritorio, cuenta QA, build `eca8566d`). La rama no está desplegada: la sonda sirvió el `app.js` de la rama sobre su GET. Nada salió a producción: `POST …/firmar` lo contestó la sonda (400 `firma_invalida` para el albarán 46, 500 para otro id) y `POST /auth/logout` se cortó, con control positivo del corte antes de pulsar. Botón «Salir» real:
  - 1 rechazada, «Cancelar» → la pregunta en singular, literal; sigue en el panel, 1 constancia, sin llamada de cierre.
  - 1 rechazada y 1 sin subir, «Aceptar» y «Cancelar» → dos preguntas, en ese orden; sigue en el panel, 1 en cola y 1 constancia.
  - 1 rechazada, «Aceptar» → la pregunta, se llama al cierre, va al login, 0 constancias.
  - control, nada pendiente → ninguna pregunta, cierra.

## Límites

- El plural de las rechazadas («${n} firmas…») está medido en el banco, no en el navegador.
- No medido en un móvil ni con partes; sólo albaranes.
- Tras desplegar falta repetir la sonda sin servir el fichero de la rama.
- La tanda dirigida de `app.js` pasa de 150 ficheros: no se corre en local; el juez es el CI.

## Errores propios de esta tanda

- Corrí el guard de la skill (`scrum811c`) antes de escribir este registro y cayó por eso mismo; no era un rojo del cambio.
