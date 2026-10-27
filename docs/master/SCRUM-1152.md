# SCRUM-1152 · Generador del ancla de medición (SCRUM-267)

**Fecha:** 26-sep-2026 12:19Z (GitHub) · **Carril:** S5 · automatización y eficiencia
**Medido contra:** `origin/main` = `305666c5c6a87d1bd9ed374099cadc3f99796305` · 2026-09-26T12:19:57Z
**Rama:** `scrum-1152-generador-ancla`

> Esta misma línea de arriba salió de `node scripts/equipo/ancla.mjs` — el control positivo más
> directo que existe: si el generador no funcionara, este registro no llevaría un ancla válida.

## 0 · El encargo, en una línea

El ancla de SCRUM-267 (`**Medido contra:** \`origin/main\` = \`<sha40>\` · <ISO-8601>`) tumbó
**cinco veces en dos días** (#1793, #1795, S2, y dos veces esta misma sesión en el mismo turno),
siempre por el mismo motivo: es un dato de dos partes que se teclea a mano, y es fácil escribir
una sin la otra. Encargo directo del orquestador `cobroflash-backend-06`.

## 1 · Qué se construyó

`scripts/equipo/ancla.mjs` (nuevo). `node scripts/equipo/ancla.mjs` imprime la línea completa:

- El **sha**: `git rev-parse origin/main`, local — no fetchea por ti (fetchear es una decisión de
  red de quien lo llama, no de un generador de texto).
- El **instante**: la cabecera `Date:` de `gh api -i zen` (A14) — nunca el reloj de la máquina.
  Prueba `gh` del PATH y, si no existe (ENOENT), la ruta fija de esta máquina
  (`C:\Program Files\GitHub CLI\gh.exe`, SCRUM-360). Un `gh` que existe pero responde mal (status
  ≠ 0) **no** prueba otro binario ni rellena con el reloj local: falla cerrado.
- Si cualquiera de los dos datos no se puede leer, sale `NO PUDE MIRAR` con código 2 — nunca
  imprime un ancla a medias.

También se enlaza el generador desde los dos sitios donde alguien se topa con el problema:

- El mensaje de la aserción de `tests/scrum267-ancla-de-medicion.test.mjs` (la que hoy dice «HAY
  ENTRADAS SIN ANCLA») ahora dice también `node scripts/equipo/ancla.mjs`.
- `docs/master/README.md`, en la sección "El ancla de medición" y en la plantilla de apéndice.

## 2 · Lo que NO se tocó

El `RE_ANCLA` y el resto del guard de SCRUM-267: sin cambios. Esto es un generador que apunta al
mismo contrato que ya existía, no un guard nuevo ni uno relajado.

## 3 · Verificación

- `tests/scrum1152-generador-ancla.test.mjs` (8 casos): camino feliz con el `RE_ANCLA` REAL
  importado del propio guard (no una copia del patrón); fallback entre binarios de `gh` cuando el
  primero da ENOENT; fail-closed cuando ninguno responde, cuando uno responde pero falla de
  verdad, cuando el sha no tiene 40 hex, cuando `git rev-parse` falla, y cuando la cabecera `Date:`
  no se puede parsear. Un caso final ejecuta el script real (sin dobles) contra este repo.
- Suite completa del registro (`scrum267`, `scrum649`, `scrum811c`, `scrum859`, más el nuevo):
  **91/91 pass**, incluyendo el test que comprueba que el README declara el formato del ancla (no
  rompí ese guard al añadir la mención del generador).
- Control positivo real: la línea `**Medido contra:**` de la cabecera de este mismo fichero salió
  de `node scripts/equipo/ancla.mjs`, sin tocarla a mano.

---

# SCRUM-1152 · APÉNDICE · 17-oct-2026 · SCRUM-1152b · la mitad que `guards:entrada` no miraba: la línea A9

**Medido contra:** `origin/main` = `e244ff61b1b81dd57d3747298ca207502a5a1c59` · 2026-10-17T19:59:48Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

## El encargo y lo que se midió antes de construir

El orquestador pidió «un comando que escriba el ancla» tras dos rojos del 16-oct (S4 y S3). Ese comando
**ya existía** (`scripts/equipo/ancla.mjs`, este ticket, 26-sep) y su existencia la nombra el propio rojo
de scrum267. El encargo se reformuló a «que se use solo». Lo medido, con S0 (que reprodujo los dos casos):

- **Ninguna de las dos líneas salió de `ancla.mjs`**: las dos se teclearon. S4 escribió `= producción =`
  delante del sha (corregido en `44d967e74`); en los cinco arreglos de ancla del 15 y 16-oct
  (`44d967e74`, `7061e487b`, `23c3aeaa6`, `417c128c8`, `7349b8928`) el defecto es siempre de tecleo: sha
  corto, fecha a la española, espacio en vez de `T`, texto de más.
- **El rojo de S3 en #2528 NO era el ancla**: era la línea `A9:` (SCRUM-1294). En el run 38905690014
  scrum267 sale verde. Son dos requisitos con dos guards, y `ancla.mjs` sólo genera uno.
- **`guards:entrada` no llevaba scrum1294**: con el ancla buena y sin `A9:` decía «la entrada puede
  empujarse» (medido por S0) y el CI la tumbaba. El comando de antes del push aprobaba lo que el
  obligatorio rechaza.
- **La plantilla del registro (`docs/master/README.md`) no trae la línea `A9:`**: lo que se copia al
  escribir una entrada lleva la mitad de lo que se exige.

## Lo que se hizo

- `scripts/guards-entrada.mjs`: scrum1294 entra en `GUARDS` (el decimoquinto, ~1,4 s, sin `dist` ni base)
  y `MINIMO` pasa de 14 a 15.
- `docs/master/README.md`: la plantilla lleva la línea `A9:` debajo del ancla (el formato más común; los
  cuatro, sólo en `docs/equipo/00-normas-siempre.md`), y 1294 entra en la tabla de lo que exige
  `guards:entrada`.

## Comprobado

| corrida | resultado |
|---|---|
| entrada temporal con el ancla de `ancla.mjs` y SIN `A9:`, comando NUEVO | salida 1 · `✖ SCRUM-1294` · 15 guards |
| control: sin la entrada, comando NUEVO | salida 0 · «15 guards de entrada en verde (170 tests, 85,0 s de 90)» |
| la misma entrada con el comando de `main` | **CIEGO** (salida 2, cortado a 90 s por la carga de seis sesiones): no lo pude ver en verde yo. El verde falso es medida de S0: 17-oct, sobre `origin/main` = `78a1af25`, salida 0 y «14 guards de entrada en verde» |
| mutación: quitar scrum1294 de `GUARDS` (restaurado y comparado byte a byte) | salida 1 · «la lista tiene 14 guards y el mínimo son 15. No se ejecuta nada.» |
| los 11 tests que vigilan `guards-entrada.mjs` (976, 928, 928b, 1349, 1327, 1289, 1178b, 711, 775, 812, 1153) | 102 de 102, `skipped 0` |

La entrada temporal se borró en un `finally` y `git status` quedó con sólo `scripts/guards-entrada.mjs`.

## Lo que NO hace, y por qué no hay gancho

- **Sigue habiendo que acordarse de correr `guards:entrada`**. Esto hace que, si se corre, diga la
  verdad entera; no hace que se corra. Con la plantilla que ya trae la línea `A9:`, el caso realista
  queda cubierto: quien la copia la lleva puesta, y quien corre el comando se entera antes de empujar.
  Lo que queda es algún rojo de CI y dos minutos de arreglo, y el orquestador lo acepta.
- **Se propuso un gancho `pre-push`** (en esta máquina no hay ninguno: `core.hooksPath` vacío,
  `.git/hooks` sólo con `.sample`; uno en el `.git` común cubriría todos los árboles de trabajo). **El
  orquestador dijo NO el 17-oct-2026**, con un dato medido ese mismo día y por dos sesiones: con seis
  sesiones vivas, `guards:entrada` se queda CIEGO a los 90 s, y la máquina estaba al 85 % de memoria.
  Un gancho que corre guards al empujar, en una máquina donde los guards se quedan ciegos, no es una
  red, es un tapón: convierte el momento de guardar el trabajo en el de más riesgo de perderlo, justo
  cuando más se empuja. Y la salida de emergencia, `--no-verify`, se aprende a la tercera vez que un
  push se cuelga con prisa; a partir de ahí el gancho no protege y nadie se fía de él.

### 🔴 La condición, por si algún día se replantea (no es hoy)

**Ese gancho tendría que FALLAR ABIERTO, al revés que todo lo nuestro.** Si no puede medir —máquina
cargada, tiempo agotado, un guard que no arranca—, **deja pasar el push y lo dice**. La regla normal
de esta casa es fallar cerrado, porque callar es peor que alarmar. Aquí se invierte porque lo que hay
al otro lado es distinto: bloquear el guardado de un trabajo que ya existe es peor que dejar pasar una
entrada mal escrita que el CI obligatorio va a cazar de todos modos. El gancho sería un atajo, nunca la
red: la red es el CI.
- `ancla.mjs` no escribe en el fichero: imprime. Escribir la línea en la entrada no habría evitado
  ninguno de los dos rojos del 16-oct (uno no era del ancla, y el otro quería decir algo —el sha de
  producción— que el formato no admite delante del sha, sí en un paréntesis detrás del instante).


# SCRUM-1152 · APÉNDICE · 17-oct-2026 · SCRUM-1152c · el verde de `guards:entrada` dice dónde acaba

**Medido contra:** `origin/main` = `5204a443a569cc25ae931e616101d8113a30f7e2` · 2026-10-17T21:54:06Z

A9: comprobación → `tests/scrum1152c-el-verde-dice-donde-acaba.test.mjs`

## El defecto

Medido por S3: la lista `GUARDS` es CERRADA, elegida guard a guard con techo de tiempo (SCRUM-976), y
está bien hecha. Lo que engañaba era su verde: **«✓ 14 guards de entrada en verde… La entrada puede
empujarse»**. «Puede empujarse» es una promesa que ese comando no puede hacer: el 17-oct seis PR de tres
sesiones cayeron en el CI con este comando en verde (cifra del orquestador), por guards de árbol entero
que no están en la lista (`docs/master/SCRUM-1560.md`). Las tres habían hecho lo que se les pedía.

## Lo que se hizo (sólo `scripts/guards-entrada.mjs` y su test nuevo)

- El verde ya no dice «puede empujarse». Ahora (pasada real en este árbol, 15 guards tras #2538):

  ```
  ✓ 15 guards de entrada en verde (N tests, T s de 90): pasan los 15 de ESTA lista, y sólo eso.
    Esto NO dice que el CI pase: la tanda completa corre otros, entre ellos los de árbol entero.
    Los 5 de árbol entero que ya han tumbado PR y sólo corren en el CI (SCRUM-1560), a mano antes de empujar:
    node --test tests/scrum195-… tests/scrum414-… tests/scrum694-… tests/scrum710b-… tests/scrum737-…
  ```
- La familia vive en `FUERA_DE_LA_LISTA` (los seis de SCRUM-1560) y **se filtra contra `GUARDS` al
  pintar**: `scrum1294` entró en la lista con #2538 y ya no se nombra, sin tocar nada. Medido: antes de
  mezclar #2538 salían 6; después, 5.
- La primera línea conserva su forma (`✓ N guards de entrada en verde (M tests`), que es lo que lee
  `scrum976` en su caso positivo.
- ⛔ **La lista NO cambia.** Los de árbol entero no entran (orquestador, 17-oct): son lentos y en esta
  máquina el comando ya sale CIEGO a los 90 s. Meterlos convertiría el control previo en un tapón, que es
  el mismo motivo del NO al gancho `pre-push` de arriba.

## Comprobado

| corrida | resultado |
|---|---|
| test nuevo `scrum1152c` | **6 de 6** |
| 3 mutaciones a mano (con Edit y vuelta atrás; árbol limpio después) | **3 cazadas** |
| `guards:entrada` de verdad (antes de mezclar #2538) | salida 0, el cierre nuevo con los 6 nombrados, 27,5 s |
| la lista (15) + los 5 de fuera + `scrum1152c`, `scrum976`, `scrum808` y `scrum928`, a mano | **244 de 244**, `skipped 0`, 84 s |

Las mutaciones: no filtrar la familia contra la lista · volver a pintar la frase vieja en `main()` · no
nombrar la familia.

## La lección

**Un instrumento acotado A PROPÓSITO se vuelve mentiroso si su mensaje no dice dónde termina.** El verde
no era falso: era más ANCHO que lo que medía. Es la misma lección que SCRUM-1357f el mismo día, en el
panel: «VACIO» era verdad (no había proceso) y decía «no hay nadie» donde había alguien esperando.

## Lo que NO hace

- No corre la familia: la nombra. Quien la quiera, la pega.
- `docs/master/evidencias/SCRUM-1345/mutar.mjs` (M6) busca el literal viejo «La entrada puede
  empujarse»; es un banco histórico que ya no casaba en M1, M2 ni M5 y no está en el catálogo del
  meta-guard. No se toca.
- El caso ④ter de `scrum976` usa como cebo un verde con la frase vieja; sólo lee la primera parte, que
  no cambia. No se toca.