# SCRUM-1649 · Las 258 marcas «aprobado por el fundador», clasificadas una a una por procedencia

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T20:54:57Z

A9: sin fallo que generalice — sólo documentos: se suben los guiones y los JSON de una medición ya hecha, reproducida aquí byte a byte, y no se toca código, marca ni firma.

Lo escribe S4 (equipo de Luis). **Rama sólo de documentos.** La materia es la de SCRUM-1502, que lleva
`equipo-javier`: por eso esta medida vive en su propio ticket y **SCRUM-1502 no se toca**. El hallazgo
se les comunicó por comentario en 1502 (`c.21333`, `c.21340`).

## Qué se sube y dónde

`docs/master/evidencias/scrum1649/` — copia exacta de la carpeta que la sesión anterior de S4 dejó
fuera de git (`D:/MILLONARIO/cobroFlash/evidencias-s4-2nov-marcas/`):

| fichero | qué es | de quién es el dato |
|---|---|---|
| `censo.mjs` | reproduce `veredictos()` de `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs` SIN importar el test (copia literal de `MARCA`, `EXCLUIR`, `NEGACION`, `VENTANA`) | S4, medido |
| `blame.mjs` | `git blame` de la LÍNEA de cada marca: commit, fecha, tickets citados en la frase | S4, medido |
| `clasifica.mjs` | clasificación LOCAL, sin Jira (ver abajo) | S4, medido |
| `grupos.mjs` | junta la clasificación local con las lecturas de Jira y da el grupo | S4 (el guion); sus entradas de Jira, no |
| `clase.json` | salida de `clasifica.mjs`, marca a marca | S4, medido |
| `lecturas.json` | lo que dice cada comentario o ticket de Jira citado (`F-literal`, `F-transcrito`, `ASESOR-DICE`, `NADA`…) | 🔴 **DATO DE AGENTE** (ver abajo) |
| `grupos.json` | salida de `grupos.mjs`, marca a marca | mezcla: local + `lecturas.json` |

**Reproducido hoy, no sólo copiado.** Corrida la cadena entera sobre un árbol en `70eefc40c`
(con `typescript` en `node_modules`, que `tests/_procedencia-aprobacion.mjs` necesita):

```
node censo.mjs     <árbol> censo.json
node blame.mjs     <árbol> censo.json blame.json
node clasifica.mjs <árbol> censo.json blame.json clase.json
node grupos.mjs    clase.json lecturas.json grupos.json
```

`clase.json` y `grupos.json` salen **idénticos byte a byte** a los subidos (mismo hash). Los
intermedios `censo.json` y `blame.json` no se suben: los regenera cualquiera con las dos primeras
órdenes.

**Control de la población:** `censo.mjs` imprime
`{"rastreable":181,"anclado":54,"documental":12,"sin-respaldo":11,"negada":13,"citada":1}`.
181 + 54 + 12 + 11 = **258** marcas que afirman la aprobación (las 13 negadas y la 1 citada se
apartan, como hace el guard). Las 11 `sin-respaldo` son las que el guard congela. `blame.mjs`: 0 errores.

**Revisado antes de empujar (2-nov, esta sesión):** sin credenciales ni datos de clientes. Búsqueda de
claves (`sk_`, `whsec_`, `EAA…`, `API_KEY`, `DATABASE_URL`, `postgres://`, `Bearer`), correos, móviles
españoles, NIF/NIE e IBAN sobre los siete ficheros: **0 coincidencias**, con control positivo (la
misma búsqueda sobre una cadena de prueba con una clave, un correo, un móvil y un NIF inventados
casa los cuatro). Lo que llevan son rutas y frases de comentarios que ya están en el repositorio.

## 1 · 🔵 La regla de clasificación es LOCAL: otro puede recorrerla sin fiarse de nosotros

`clasifica.mjs` no consulta Jira. Para cada marca con respaldo mira tres cosas del árbol:

1. **La ficha de `docs/microcopy/`** a la que lleva (por el ticket de la frase de la marca o por la ruta
   que cita). Cada ficha se clasifica por sus 8 primeras líneas:
   - `DELEGADA` — dice «delegación».
   - `ASESOR` — «aprobado por el asesor».
   - `F-LOC` — «por el fundador» **y** trae número de comentario (`comentario NNNNN`) o el literal («literal: «»).
   - `F-TICKET` — «por el fundador» sin número de comentario.
   - Medido: 117 DELEGADA · 19 F-LOC · 18 F-TICKET · 1 ASESOR.
2. **La fecha que reclama la marca** (`NN-mes-2026` en la frase o en el bloque). De las 181 rastreables:
   34 dicen jul-ago · 63 sep · 18 oct-nov · 66 sin fecha.
3. **Si el bloque de la marca nombra al asesor.**

Y `blame.mjs` añade la fecha real de la línea (antes/después del 7-sep, cuando nació la regla 39).

Lo que **sólo** sale de Jira (y por tanto de `lecturas.json`) son los grupos `1a`, `1b`, `2a` (la
parte «en el ticket»), `2c`, `2d` y `3b`. Todo lo demás se decide con el árbol.

## 2 · 🔴 Qué midió S4 y qué es dato de un agente — sin suavizar

| pieza | quién | cómo de firme |
|---|---|---|
| la población (258) | S4 | medido, reproducido hoy |
| el blame de cada marca | S4 | medido, reproducido hoy |
| la clasificación local (`clase.json`) | S4 | medido, reproducido hoy |
| **`lecturas.json`: qué dice cada comentario y cada ticket de Jira** | **dos agentes de sólo lectura** + el §2 del registro de SCRUM-1511 | **dato de agente. S4 no releyó cada comentario.** El cuerpo de los comentarios no está en este repo: quien quiera auditar el grupo 1 tiene que abrir los 31 pares (ticket + comentario) y los 21 tickets de `lecturas.json` en Jira |
| el grupo final (`grupos.json`) | S4 | tan firme como su entrada más floja: donde la marca se decide por `lecturas.json`, es dato de agente |

Un agente «de sólo lectura» es un dato, no una verificación. Si alguien vuelve a leer esos comentarios
y uno dice otra cosa, se corrige `lecturas.json` y se vuelve a correr `grupos.mjs`: el resto de la
cadena no cambia.

## 3 · ⚠️ El asterisco abierto: «el fundador» en el equipo de Javier

Uno de los agentes trajo que en comentarios del equipo de Javier aparece «fundador (Javier)». **Si allí
«el fundador» significa Javier, parte de las 68 del grupo 1 no son firma de Luis.** Ese dato **no está
recontado**: ni cuántos comentarios, ni cuáles de las 68 caen en ellos. Está preguntado a su equipo en
`SCRUM-1502 c.21340`. **Hasta que contesten, el grupo 1 se lee con esta duda.**

## Los grupos, tal como salen hoy

| grupo | marcas | detalle (`grupos.json`) |
|---|---|---|
| **1 · palabra del fundador con localizador** | **68** | 30 `1a` literal en Jira · 14 `1c` ficha de microcopy con id de comentario · 24 `1b` cuestionario transcrito — **con el asterisco del punto 3** |
| **2 · el asesor o una sesión** | **37** | 9 `2a` asesor nombrado en la marca · 12 `2a` el ticket sólo trae al asesor/sesión · 15 `2e` verano con el ticket sin leer · 1 `2c` la sesión dice «el fundador» sin sus palabras |
| 2b · delegación del orquestador | 16 | A7 la da por válida; se aparta para no mezclarla con el 2 |
| **3 · sin respaldo** | **21** | 11 `3a` del guard · 10 `3b` el ticket citado no dice nada |
| T2 · «asesor + fundador» | 1 | `lecturas.json`: 481 = `NADA`, 300 = `ASESOR-DICE` → no se sostiene |
| **sin leer** | **115** | 93 que sólo Jira decide (ni ficha que las clasifique ni ticket leído) · 22 ficha «por el fundador» sin id de comentario |
| **total** | **258** | |

### Verano (marca que reclama jul-ago): 57

| | marcas |
|---|---|
| con la palabra del fundador (`1a` 6 + `1b` 12) | 18 |
| asesor o sesión (`2e` 15 + `2a` 10 + `2a` 3 + `2c` 1) | 29 |
| el ticket no dice nada (`3b`) | 9 |
| «asesor + fundador» que no se sostiene (`T2`) | 1 |
| **sin la palabra del fundador** | **39** |

⚠️ **Corrección:** el traspaso de S4 y la descripción de SCRUM-1649 dicen **38**. Recontado sobre
`grupos.json`: 29 + 9 + 1 = **39** (57 − 18). La diferencia es la marca `T2`, que el 38 dejaba fuera
aunque la propia descripción la cuenta entre las 57. La política que se le pide al fundador no cambia;
la cifra, sí.

### ⚠️ Corrección: las 115 sin leer NO son todas de septiembre en adelante

La descripción de SCRUM-1649 dice que sí y que, por eso, la política del verano no las alcanza.
Recontado sobre `grupos.json` + `clase.json`:

| las 115, por la fecha que reclama la marca | marcas | fecha de la LÍNEA (blame) |
|---|---|---|
| septiembre | 52 | — |
| octubre-noviembre | 15 | — |
| **sin fecha reclamada** | **48** | 5 julio · 11 agosto · 15 septiembre · 17 octubre |

Ninguna **reclama** el verano: en eso la frase acierta. Pero **16 de las 48 sin fecha tienen la línea
escrita en julio o agosto**. Si la política se formula por «la fecha que dice la marca», esas 16 quedan
fuera; si se formula por «escrita antes del 7-sep», entran. **La pregunta al fundador tiene que decir
cuál de las dos**, o la acota menos de lo que parece.

## Lo que NO se hace aquí

- ⛔ Ninguna marca cambia y no se ancla ninguna firma hasta que el fundador responda la política.
- ⛔ No se leen las 115 (coste medido: ~180k de agente por cada 20 tickets, ~900k en total).
- ⛔ No se toca SCRUM-1502.
- ⚠️ El check obligatorio cae hoy en todos los PR por la fecha de `scrum113` (SCRUM-1644, espera
  decisión del fundador). Si esta rama cae por eso, no es de esta rama.
