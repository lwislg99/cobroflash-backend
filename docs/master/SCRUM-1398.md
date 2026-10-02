# SCRUM-1398 · La colisión «misma serie y número, distinta fecha» ya se midió contra la AEAT el 28-sep-2026: la medición entra en el repositorio, y la sonda que la hizo también

**Medido contra:** `origin/main` = `d2ed6c8a2c4d2b3487c4557094d12915e9dfb83c` · 2026-10-02T02:12:10Z
(J1 del equipo de Javier, sesión J1a; encargo del orquestador `cobroflash-backend-5b`. La medición contra la AEAT
NO es de esta sesión: es del 28-sep-2026 y aquí se transcribe con su fecha.)

A9: aviso → A10 «Lo que el repositorio llama inferencia puede estar ya medido en Jira: antes de pedir una medición se lee el ticket entero, comentarios incluidos.» — no se pudo comprobar: que un comentario de Jira contradiga a un registro no lo ve ningún instrumento del repositorio, que no lee Jira; lo que sí queda sujeto es la herramienta (`tests/scrum1398-la-sonda-de-colision.test.mjs`)

## En corto

- **Ningún envío a la AEAT en este ticket.** No se ha generado ningún sobre para enviar ni se ha tocado
  ningún certificado.
- Entra en `main` lo que estaba fuera: las banderas `--serie-propia` y `--fecha-propia` de
  `scripts/sobre-soap-prueba-aeat.mjs` (Ⓐ), la medición que se hizo con ellas (Ⓑ) y un test que las
  sujeta (Ⓒ).
- `docs/master/SCRUM-1211.md` decía «inferencia… no un caso probado contra la AEAT» y lo listaba como
  pregunta sin determinar. Las dos líneas (71 y 139-140) se corrigen **en sitio, sin mover líneas**: el
  texto original se conserva y lleva al lado la corrección, con este número.

## Ⓑ La medición, transcrita

**Fuente:** Jira, SCRUM-1211, comentario 17334, creado el 28-sep-2026 a las 16:29:14 CEST. Lo firma dentro
del texto `jv-orquestador` (el orquestador del equipo de Javier de aquel día) y dice que los envíos los
hizo el fundador desde su navegador, con su certificado, en el **entorno de pruebas** de la AEAT. Leído el
2-oct-2026; lo de abajo es copia de ese comentario, no una medición nueva.

| sonda | serie y número | fecha de expedición | respuesta de la AEAT | CSV | hora del envío (28-sep) |
|---|---|---|---|---|---|
| A | `PRUEBA-COLISION-0001` | 27-09-2026 | Correcto | `A-SAQQXM7MXBDX3L` | 16:27:38 |
| B | `PRUEBA-COLISION-0001` | 28-09-2026 | Correcto | `A-ALQ5VMP5QV7QLQ` | 16:28:04 |

Mismo emisor, misma serie y mismo número; cambia sólo la fecha de expedición. **Las dos aceptadas**, con 26
segundos de diferencia.

**Los dos envíos son del 28-sep.** `docs/master/SCRUM-1296.md:49` y `docs/master/SCRUM-1319.md:58` citan
estos dos CSV como «dos sondas aceptadas» con los rótulos «(27-sep)» y «(28-sep)»: esos rótulos son la
**fecha de expedición** que llevaba cada registro, no el día en que se envió. Esos dos registros no se
tocan aquí (son de otros tickets); quien los lea, que lea esto al lado.

**El control que le da valor, del mismo día y del mismo comentario:** a las 16:02 se mandó dos veces
`PRUEBA-AEAT-970375` con la **misma** fecha, y la AEAT contestó **error 3000, «Registro de facturación
duplicado»**, citando el `IdPeticion` del primero. La AEAT sí detecta duplicados; no los detecta cuando
cambia la fecha.

**Lo que se concluye, y sólo eso:** en el entorno de pruebas, la AEAT identifica un registro por
emisor + serie y número + fecha de expedición. Es lo que SCRUM-1211 dedujo de la FAQ (su §④(b)) y
declaró como deducción; el 28-sep quedó medido.

**Suelo, copiado del comentario y sin ampliar:**

- Medido en el entorno de **pruebas**. No se ha comprobado que producción se comporte igual.
- Se probaron dos fechas del **mismo año**. No se ha probado la misma serie y número en años distintos.
  Decisión del orquestador (2-oct-2026, en el ticket): no se mide ahora. La serie F lleva el año dentro
  del número (`F26NNNN`), así que el caso no se da solo, y no está comprobado qué fechas de expedición
  admite la AEAT hacia atrás.

**Qué hizo el equipo con ello:** SCRUM-1203 se cerró el 30-sep-2026 con la opción B construida bajo
SCRUM-1216b (`docs/master/SCRUM-1216.md`): el número de arranque declarado llega a la factura.

## Ⓐ El rescate

El código estuvo sin comitear en el árbol compartido (`cobroflash-backend`, sobre `main`) desde el 28-sep.
El orquestador lo rescató el 1-oct en el commit `39733a9b6708dd2d64f42d019cfe86f20ecbb0b7` (rama local, sin
empujar). Aquí entra con `git cherry-pick`, **sin cambiar una línea**:

- `scripts/sobre-soap-prueba-aeat.mjs` era idéntico en `origin/main` y en el padre del commit (diff vacío).
- El blob resultante es el mismo que el del rescate: `b781339c4a503995c8e6aabfd1572325adfd5be4`.
- `git diff --numstat`: 32 añadidas, 2 quitadas, un fichero.

**Autoría: indicio, no prueba.** El comentario 17334 describe las dos banderas y los motivos de su diseño
con las mismas palabras que los comentarios del código, y lo firma `jv-orquestador`. El commit del rescate
dice que no consta quién lo escribió.

## Ⓒ El test — `tests/scrum1398-la-sonda-de-colision.test.mjs` (7 casos)

Ejecuta el script; no lo modifica ni toca `src/` (regla 38).

🔴 **Lo ejecuta en una COPIA, nunca en el árbol.** El script deriva su raíz de dónde está y escribe en
`<raíz>/tmp/` el puntero de la cadena. Un test que generase un sobre en sitio adelantaría ese puntero a un
registro que la AEAT no ha visto. Cada caso copia el script a un temporal y le pone delante tres pasarelas
a `dist/`; el caso ⑥ comprueba que la separación funciona.

Medido el 2-oct-2026 sobre la rama, con el script del rescate: **7 de 7**.

Visto en rojo, que es lo que le da valor:

| qué se le hizo al script | casos que caen (de 7) |
|---|---|
| el de `origin/main`, sin el rescate (`git diff --numstat`: 2 / 32) | ①, ② y ③ |
| `--fecha-propia` deja de leerse (1 / 1) | ①, ② y ③ |
| la bandera de la sonda pasa a ser `--serie` (1 / 1) | ①, ② y ⑤ |
| la validación del formato deja de abortar (1 / 1) | ③ |

Las tres últimas van declaradas en `MUTACIONES_QUE_ME_TUMBAN`, así que las ejecuta el meta-guard del CI.
Aquí se aplicaron a mano, con la base sin mutar primero (7 pasan, 0 caen) y el árbol comprobado limpio
después de cada una. El instrumento de esa pasada a mano era efímero y no se sube: lo sustituye el
meta-guard.

## La precondición de cualquier envío futuro (medida el 2-oct-2026; aquí no se resuelve)

**El puntero de la cadena no está en git.** Vive en `tmp/ultimo-registro.json` del árbol desde el que se
genera (`tmp/` está ignorado). En esta máquina hay dos: el del árbol compartido `cobroflash-backend`
(28-sep) y uno más viejo en `cobroflash-soap` (25-sep). El del árbol compartido apunta a una R1,
`PRUEBA-AEAT-963853`, generada el 28-sep a las 16:32:43 CEST: **después** de las dos sondas.

- En `main` no hay rastro de si esa R1 se **envió**: buscados `963853`, `921981` y `970375` en `docs/` y
  `scripts/`, 0 resultados (control positivo: `A-KR84MFNPTPDHMN` sí sale).
- Generar desde un árbol sin puntero da «primer registro»: comprobado en seco en `cobroflash-jv1`
  (`PrimerRegistro` = `S`). Con registros previos de ese emisor, la AEAT contesta 2007 (medido el 24-sep,
  lo dice el propio script).
- Copiar el puntero, si esa R1 nunca se envió, encadena a un registro que la AEAT no vio. Efecto sin medir.

Antes de volver a enviar hay que saber qué fue lo último que la AEAT aceptó. No se ha tocado ningún
fichero de `tmp/` de ningún árbol: sólo se leyeron.

## Dos cosas del script que ya estaban en `main` y no se tocan

Leídas y **ejercitadas en una copia aislada** el 2-oct-2026. No son de la sonda y no cambian la medición
del 28-sep, que fueron dos altas.

1. **Tras una anulación, el siguiente registro nombra como anterior una serie que no es de ningún
   registro.** El puntero guarda la serie propia que el script genera en cada pasada, y una anulación no
   la usa: se identifica por la factura que anula. Secuencia alta `A-0001` → anulación de `A-0001` (con
   `--serie-propia NO-ES-DE-NADIE`) → alta `A-0002`: el tercero lleva `RegistroAnterior` con
   `NumSerieFactura` = `NO-ES-DE-NADIE`. La huella encadenada sí es la de la anulación. Qué hace la AEAT
   con eso: **sin medir**.
2. **Una anulación como primer registro de la cadena la aborta el propio script**: su control
   `nifEnEmisor` busca `IDEmisorFactura`, y una anulación sólo lo lleva dentro del registro anterior. Con
   cadena previa el control pasa, pero por el registro anterior y no por el registro.

Se reportan al orquestador; es herramienta de laboratorio, no el camino de emisión.

## Lo que dije mal

- El primer control positivo de mi comprobación de ramas usó una rama ya mergeada y borrada: salió 0 y no
  probaba nada. Lo repetí con una rama que existe hoy antes de coger el ticket.
- La primera versión del caso ⑤ daba por hecho que una anulación se puede generar como primer registro.
  No se puede (punto 2 de arriba). Lo cazó ejecutar el test, no leer el script.

## Qué no se corrió

La tanda completa local (no cabe en esta máquina: decisión del orquestador). Se corrió la dirigida, que
se declara en el comentario de entrega del ticket; el obligatorio del CI es la tanda.
