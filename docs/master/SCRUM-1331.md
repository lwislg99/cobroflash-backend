# SCRUM-1331 · Sin red, `scrum804b` declara sus tests y el rojo dice que no es tu cambio

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:09:40Z
(J3e del equipo de Javier, relevo de J3d, por encargo del orquestador `cobroflash-backend-5b`)

A9: comprobación → `tests/scrum1331-sin-red-se-dice.test.mjs`

## 0 · En una frase

`tests/scrum804b-el-barrido-de-la-42.test.mjs` llamaba a `git ls-remote` **al cargar el módulo**.
Con el runner sin DNS no declaraba ni un caso y tumbaba el check obligatorio con «1 fail» sin
nombre (PR #2046: el único rojo de 9.404 tests). Ahora declara sus 5 casos haya red o no, los 3
que dependen de la red caen diciendo **«CIEGO · SIN RED · ESTO NO ES TU CAMBIO»**, y el envoltorio
de la tanda repite al final del log qué rojos **no son un caso que falle**.

Medir lo hizo J3d (comentario 17734 del ticket). Esto es la construcción.

## 1 · El rojo primero, y el después

El DNS caído se fabrica sin tocar el runner ni la máquina: una reescritura de URL de git que vive
sólo en el entorno de ese comando, a un host `.invalid` (dominio reservado: nunca resuelve).

    GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0='url.https://sin-dns.invalid/.insteadOf' \
    GIT_CONFIG_VALUE_0='https://github.com/' \
    node --test --test-reporter=tap tests/scrum804b-el-barrido-de-la-42.test.mjs

| | con red | sin DNS |
|---|---|---|
| antes (`258fc29b`) | 5 tests · 5 pass · exit 0 | **1 «test» (el fichero) · 0 casos declarados** · exit 1 |
| después | 5 tests · 5 pass · exit 0 | **5 tests · 2 pass · 3 fail (CIEGO · SIN RED)** · exit 1 |

Salida: `docs/master/evidencias/scrum1331/salida-804b-antes-y-despues.txt`.

Y el test nuevo, contra el fichero viejo: con `tests/scrum804b-…` devuelto a `258fc29b`
(`git diff --numstat`: 17 / 68), `tests/scrum1331-sin-red-se-dice.test.mjs` cae en su primer caso
con «sin red el fichero declara 1 caso(s) y tiene 5». Restaurado después; árbol limpio.

## 2 · Lo que cambia

- **`tests/scrum804b-…`** — `negativoVivo()` ya no se llama en el nivel superior: se deriva dentro
  del caso que lo usa, una vez por proceso. Los 3 casos de red pasan por `ciego()`, que **cae**
  con el motivo. Los asertos del censo no cambian: ni uno se quita, se salta ni se relaja (regla 41).
- **`scripts/censo-regla-42.mjs`** — la red se llamaba en DOS sitios (lo midió J3d): también
  dentro de `censar()`. Nuevo `censarConMotivo()`: `{ censo, ciego }`, con `ciego.que` =
  `SIN_RED` / `SIN_REFS` / `SIN_ARBOL` y `ciego.detalle` = lo que dijo git. `censar()` y
  `ramasRemotas()` conservan su contrato (`null` si no se pudo). Único llamador: el propio 804b.
- **`scripts/_huella-de-la-caida.mjs`** (nuevo) y **`scripts/tanda-con-veredicto.mjs`** — el
  envoltorio de `npm test` ya veía pasar toda la salida; ahora además la lee y, al final, por la
  salida de error, dice:
  - `NO HABÍA RED · <fichero>` — fichero caído sin caso caído, con frase de red de git/curl;
  - `MURIÓ EL PROCESO, NO FALLÓ UN TEST · <fichero>` — ídem con huella nativa (SCRUM-1332);
  - `FICHERO CAÍDO SIN CASO CAÍDO · <fichero>` — sin huella: **no se absuelve**, puede ser del cambio;
  - `CIEGO · «<caso>»` — un caso que cae porque no pudo mirar;
  - `ESTA TANDA NO COMPROBÓ «<caso>»` — un caso **saltado** cuyo motivo dice CIEGO.
  **No cambia el código de salida** y no escribe nada en una tanda sana. Con un reporter que no sea
  `spec` no ve la sección de caídos y lo dice («no pude mirar»), en vez de callar.

Ningún workflow. Ningún fichero de `src/`.

## 3 · La decisión del CIEGO sin red — firmada, y con su condición

J3d la dejó formulada sin elegir (comentario 17734). La decidió el **orquestador del equipo de
Javier**, por mensaje, el 1-oct-2026 (en respuesta al mío de las 05:43Z), con estas palabras:

> «A se queda —sin red, el check cae diciendo que no es tu PR—. Se pasa a B cuando el aviso final
> esté en `main` y se haya visto en un run real, no antes. […] cambiar a B son 3 líneas en
> `ciego()` y necesita mi palabra, no la de quien lo toque.»

- **A (lo que hay):** sin red el caso cae. No relaja nada; su coste es que un PR sano espera a
  que alguien relance.
- **B (no firmada):** el caso se salta con su motivo y el check pasa. Sólo es aceptable si alguien
  VE el salto, y un salto sólo se ve en el TAP, que llega ilegible al CI (SCRUM-1289). La línea
  `ESTA TANDA NO COMPROBÓ` del envoltorio es lo que lo haría visible **en el log del job** sin
  esperar a ese arreglo: por eso va en este PR.
- El caso ① de `tests/scrum1331-…` fija la A: exige `skipped 0` y `fail 3` sin red. Quien cambie
  `ciego()` para que salte lo tumba, a propósito.

Sin medir: cuántos runs han caído por esto. Consta uno (#2046).

## 4 · Los controles

`tests/scrum1331-sin-red-se-dice.test.mjs`, 5 casos, sin red y sin base (la red la quita él):

1. 804b real con el DNS caído: 5 declarados, 2 pasan, 3 caen por CIEGO · SIN RED, 0 saltados.
   Testigo de A21: el host fabricado tiene que aparecer en la salida, o el caso se declara ciego.
2. `censarConMotivo`: DNS caído → `SIN_RED`; fuera de un repositorio (`GIT_DIR` a un directorio
   vacío) → `SIN_REFS`. Y las frases una a una: un 403 **no** es red.
3. Una tanda fabricada de 6 ficheros por el envoltorio: mismo código de salida que sin él, la
   población declarada, cada clase en su línea, y el NEGATIVO — un fichero que no carga sin
   huella no se manda a relanzar.
4. Tanda sana: ni un byte en la salida de error. Con color (`FORCE_COLOR=3`): lee igual. Con
   reporter TAP: dice que no pudo mirar.
5. El lector por dentro, alimentado a trozos de 7 caracteres: la frase de red que escribió un
   caso que PASA no se le cuelga al fichero que cae después.

Mutaciones declaradas, aplicadas a mano una a una (`evidencias/scrum1331/mutar.mjs`, con el
`git diff --numstat` al lado y la restauración comprobada por sha): **3 vivas de 3** —
`salida-mutaciones.txt`.

Guards de suite corridos con el cambio (un solo comando, TAP a fichero fuera del árbol):
`scrum1331`, `scrum804b`, `scrum858b`, `scrum928`, `scrum928b`, `scrum836`, `scrum237`, `scrum708`,
`scrum711`, `scrum850`, `scrum702`, `scrum812`, `scrum808`, `scrum745`, `scrum723`, `scrum267`,
`scrum273`, `scrum1294`, `scrum976`, `scrum570` → **157 tests · 156 pass · 0 fail · 1 skip** (el
de señales POSIX de 858b, que en Windows no aplica y lo mide el CI). Y `npm run guards:entrada`:
**12 guards, 122 tests, 0 fail**, después del último cambio de código.
La tanda completa NO se ha corrido en local: no había turno.

## 5 · La población (de J3d, subida aquí porque vivía en un scratchpad)

Medida por EJECUCIÓN, no por grep: un `--import` que anota cada proceso hijo, `fetch`, socket no
local y `dns.lookup` de cada fichero, en una pasada de sólo carga (`evidencias/scrum1331/`:
`sonda-carga.mjs`, `analiza.mjs`, `sonda-todo.jsonl`, `salida-analiza.txt`). Medido por J3d el
1-oct-2026 03:34Z sobre `e4b969e0`:

- **1.146 ficheros** observados, 1.146 líneas de arranque;
- 17 lanzan algo al cargar (casi todo `git` local);
- **1 llama a la red al cargar: `scrum804b`.** Es un caso, no una clase: no hace falta guard general.

## 6 · Lo que NO está hecho, dicho

- **La red DENTRO de los tests** de los otros ficheros sigue sin medir (pide una tanda completa con
  la sonda; no hubo turno). La sonda vio de pasada un `git push` de `scrum946` en fase de test, a
  un remoto en un temporal: local, no red.
- **Los 6 ficheros que lanzan `node`/`bash`/`tar` al cargar**: la sonda ve que se lanzan, no lo que
  hacen dentro.
- **Reintentar antes de declararse ciego** (la opción C de J3d): no construida. No hay medida de
  cuánto dura un fallo de DNS del runner, y un reintento con espera fija sin esa medida es una
  tolerancia a ojo.
- **El aviso del envoltorio no se ha visto en un run real de CI**: sólo en local, con tandas
  fabricadas. Es la condición que el orquestador puso para la B.
- **Límites del lector**, declarados en su cabecera: sólo lee `spec`; `spec` no trae el código de
  salida del fichero, así que una muerte nativa que no escriba nada sale «sin huella reconocida»;
  y la cola de salida de error del fichero anterior puede entrar en la ventana del que cae.

## 7 · Dos errores míos

**El segundo lo cazó un guard, no yo.** Al mover el mensaje de CIEGO de 804b a una plantilla y
escribir `origin/main` en el detalle de `SIN_ARBOL`, cambié sin saberlo QUIÉN nombra una
referencia móvil fuera de los argumentos de git: `tests/scrum723-guard-contra-su-base.test.mjs`
(guard de entrada) salió rojo — 804b había salido de su lista y el censo había entrado. No toqué
el guard (regla 41): el mensaje de 804b vuelve a ser una cadena literal, como era, y el detalle
del censo ya no nombra la referencia. La lista declarada de scrum723 queda idéntica. Lo que
corrí antes de eso —mis tests y catorce guards elegidos a ojo— estaba verde: la muestra no era
la población, y lo que lo dijo fue `npm run guards:entrada`.

**El primero, corregido antes de correr nada:**

La primera lista de frases de red llevaba `unable to access`. Git antepone esa frase a CUALQUIER
fallo de https — también a un `The requested URL returned error: 403`, que es de permisos. Habría
mandado a «relanzar» un fallo que no se arregla relanzando. La quité al releer la lista, y el
caso ② lo fija: el 403 tiene que dar `false`.
