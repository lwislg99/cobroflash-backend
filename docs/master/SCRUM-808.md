# SCRUM-808 · El instrumento que muta el árbol se dejaba el árbol mutado

**Fecha:** 7-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `349350c8a7a34f24e9263aba1ca2af36e3cb4a91` · 2026-09-07T02:29:50+01:00
**Tanda:** `npm run build` + `node --test --test-reporter=tap tests/*.test.mjs` → **5758 pruebas ·
5656 en verde · 0 rojas · 102 saltadas** · 507,2 s · salida 0. Los **102 saltos declaran motivo y
suman 102**: 92 piden base (`QA_DB_TEST`/`A55_DB_TEST`/`AN_DB_TEST`/`BOT_SUITE_TEST`), 9 piden un
Postgres desechable (`LIBRO_PG_URL`) y 1 no puede crear un enlace en esta máquina (EPERM) **y dice
qué control portable lo cubre**.

`npm run meta:mutaciones` → **104 vivas · 0 mudas · 0 ciegas · 0 ficheros muertos**, salida 0, con
las **cuatro** de este ticket entre las vivas — y **cero denuncias**, que es el control positivo
del remedio: una pasada sana no grita.

> **`main` se movió durante el ticket** (entraron SCRUM-749, 758, 801 y 806) y **el merge chocó en
> `package.json`**: los dos lados añadían un `censo:*` en el mismo punto. Es el **peaje** que
> SCRUM-548 documenta —tres conflictos reproducidos, cero líneas borradas— y se resolvió como
> manda: **se conservan los dos**, cada uno con su `//` pegado. Después se repitieron las
> mediciones encima: el censo de escritores sale **14 / 2 / 1** igual, sobre 935 ficheros en vez
> de 930.

> `meta-guard-mutaciones` restaura el fichero mutado **en un `finally`**, y **una terminación no
> ejecuta ese `finally`**. Se mata la pasada y el fichero mutado se queda dentro del árbol.
>
> Pasó **DOS VECES el 6-sep-2026**, a dos sesiones distintas —SCRUM-801 y SCRUM-784— y **las dos
> se cazó porque a alguien se le ocurrió mirar `git status`**. Eso es vigilancia por costumbre, no
> por mecanismo.
>
> 🔴 Y lo que lo hace grave: **matar la pasada es la conducta correcta.** Se mata para no medir
> sobre un árbol caducado, que es lo que la casa pide. **El instrumento castigaba la conducta que
> él mismo exige.**

---

## 🔴 EL ROJO, PRIMERO · reproducido, no razonado

Se lanza la pasada, se espera a que aplique una mutación, se mata. El árbol después:

```
$ git status --porcelain
 M scripts/meta-guard-mutaciones.mjs

$ git diff
-  if (absDist && ORIGINAL_DIST) piezas.push({ ruta: destino, abs: absDist, ORIGINAL: ORIGINAL_DIST });
+  // la pieza de dist, retirada
```

**La mutación que sobrevivió es la que retira la segunda pieza a restaurar.** O sea: el árbol se
queda con **el propio restaurador mutilado**, y nadie dice nada.

## 🔴 Y LO QUE HABRÍA SIDO UN REMEDIO DECORATIVO — las dos sondas que lo impidieron

El encargo pedía «restaurar también ante la señal». **Antes de escribirlo se midió si aquí llega
alguna señal**, y la respuesta cambia el diseño entero.

| sonda | qué se midió | resultado |
|---|---|---|
| **① la señal** | un proceso escuchando `SIGINT`, `SIGTERM`, `SIGHUP`, `SIGBREAK`, `SIGQUIT`, más `exit` y `beforeExit`; se mata | **no se ejecutó NINGUNO**. Windows termina sin entregar señal atrapable |
| **② el vigilante externo** | un hijo `detached` + `unref()` vigilando al padre; se mata al padre | **el hijo murió con él** — su registro dejó de crecer en el mismo instante: se termina el árbol de procesos entero |

**Conclusión medida: en esta máquina NADA que viva dentro del proceso moribundo puede devolver el
árbol.** Un remedio basado sólo en señales habría *parecido* protección, sin serlo, justo en la
máquina donde el defecto ocurrió las dos veces. Y un vigilante habría costado un proceso más para
nada.

## EL REMEDIO · dos capas, y la que salva es la segunda

### ① La señal, para donde SÍ llega

`redDeSeguridad()` devuelve las piezas en vuelo y `instalarRedDeSeguridad()` la engancha a
`SIGINT`/`SIGTERM`/`SIGHUP`/`SIGBREAK` y a `exit`. **No salva en Windows** —medido arriba— pero sí
en un terminal POSIX y en CI, que es donde `kill` entrega señal de verdad. Va **separada** de la
instalación a propósito: así se puede ejercitar la restauración sin ensuciar los manejadores del
proceso que corre los tests.

🔴 **Y ahí NO se revienta.** `restaurarYVerificar` sí revienta en el camino normal —un restaurador
que traga fallos de escritura es peor que ninguno—, pero dentro de un manejador de señal una
excepción sale como un volcado **sin nombre de fichero**, que es justo la denuncia que no puede
faltar. La red atrapa, **nombra** y sale con `SALIDA_NO_RESTAURADO`.

### ② La marca en disco — la que de verdad protege

Antes de escribir la mutación se deja en `.cache/meta-guard-mutaciones/` una copia **byte a byte**
de cada pieza original y un manifiesto con el pid y la hora. Al restaurar bien, se borra. **Si el
proceso muere sin borrarla, la marca sobrevive.**

* Vive en `.cache/`, que `.gitignore` ya ignora: **la marca no puede ensuciar el árbol que protege**.
* Guarda los **BYTES**, no una referencia a git: el árbitro son los bytes de disco y no el blob —un
  fichero normalizado tiene el blob limpio y CR en la copia de trabajo (SCRUM-570).

## 🔴 EL SUELO · los tres desenlaces, y ninguno es el silencio

Al arrancar —**antes que los suelos del censo**, porque medir sobre un árbol mutado es medir otra
cosa— se mira si quedó una marca:

| qué encuentra | qué hace |
|---|---|
| no hay marca | **no dice nada** y sigue. Una pasada sana no puede gritar |
| había, y se puede reparar | devuelve los bytes y **lo dice en voz alta**, con pid y hora |
| había, y **NO** se puede | sale con **código ≠ 0 NOMBRANDO** el fichero, y **la marca se queda** como evidencia |
| la marca es **ilegible** | cuenta como **sucia**, no como ausencia: hubo una pasada muerta y no se sabe qué dejó |

`--solo-censo` abre la misma puerta en **~1 s**, así que hay una comprobación rápida del árbol sin
esperar los minutos del trabajo entero.

**Y la denuncia no depende de que alguien vuelva a lanzar el instrumento:** un test de la tanda se
pone rojo si hay una marca **huérfana** —marca presente y el proceso que la dejó ya muerto—. Una
marca de una pasada **viva** no es un defecto y no dispara nada. **Eso es lo que convierte la
costumbre en mecanismo.**

## 🔴 EL CONTROL QUE DECIDE · los dos sentidos, pegados

Reproducido con el remedio puesto:

```
① tras matar la pasada        →  scripts/meta-guard-mutaciones.mjs  MUTADO (198 líneas de diff)
② la tanda, acto seguido      →  ✖ SCRUM-808 · NO hay una marca HUÉRFANA en este árbol ahora mismo
                                 «EL ÁRBOL ESTÁ MUTADO AHORA MISMO. Lo dejó una pasada muerta
                                  (pid 71356, 2026-09-07T01:04:09.578Z)… Repáralo con --solo-censo»
③ la reparación (~1 s)        →  ⚠️ UNA PASADA ANTERIOR MURIÓ CON LA MUTACIÓN PUESTA (pid 71356…).
                                 Devuelto a sus bytes: `scripts/meta-guard-mutaciones.mjs`.
④ el árbol después            →  limpio, y `git diff` contra el trabajo guardado sale VACÍO
⑤ la tanda después            →  9 de 9 en verde
```

**✅ CONTROL POSITIVO (el otro lado):** una pasada que termina **normal** sigue restaurando igual,
**no denuncia nada** y sale con **0**. Si empezara a gritar en pasadas sanas, el remedio estaría
roto por el otro lado y el aviso dejaría de significar nada.

**✅ Y EL HOOK TENÍA RAZÓN.** Al reproducir el rojo, la reversión se hizo **por edición precisa**
sobre el `git diff`, no descartando a ciegas: `guard-dangerous` bloquea eso, y es lo que impide que
el remedio sea peor que el defecto. **No se ha tocado ni rodeado.**

## ④ ¿ESTÁ EL PATRÓN EN MÁS SITIOS? — `npm run censo:escritores-arbol`

Sin lista cableada: la población son los `.mjs` del árbol y la evidencia es el AST de cada uno.

| | |
|---|---|
| ficheros `.mjs` barridos (`scripts`, `tests`) | **935** |
| escriben dentro del árbol | **14** |
| 🔴 **capturan un fichero, lo escriben y prometen devolverlo** | **2** |
| …de ésos, con la red de SCRUM-808 | **1** |

**Los dos, nombrados:**

| | fichero | qué escribe |
|---|---|---|
| ✅ con red | `scripts/meta-guard-mutaciones.mjs` | el fuente mutado y su `dist` (4 escrituras) |
| 🔴 **SIN RED** | `scripts/censo-mudez.mjs` | **`tests/_guard-texto.mjs`**, un fichero VERSIONADO, tres veces dentro de un `try` cuyo `finally` lo devuelve |

**`censo-mudez` tiene el defecto idéntico**, y hasta lleva una comprobación posterior —«y se
COMPRUEBA, no se supone»— que **tampoco corre si el proceso muere**.

**→ CERRADO en la continuación del ticket. Ver el apéndice.**

Lo demás —12 ficheros— **generan o borran lo suyo**: no prometen devolver ningún fichero a como
estaba, así que no hay nada que se les pueda quedar a medias.

### 🔴 El censo se equivocó, y así se vio

Miraba siempre `arguments[0]`. En `copyFileSync(origen, destino)` **ése es el que se lee**:
`scrum471-node-modules-al-dia` salía como «escribe en el árbol» por **copiar `package.json` fuera
de él**, y su destino de verdad no se miraba. **Seis falsos con forma de hallazgo.** Corregido y
sujeto con su test y su mutación.

Y resuelve **un nivel** de indirección, porque el escritor más peligroso de la casa escribe
`fs.writeFileSync(abs, …)` con `const abs = path.join(RAIZ, …)`: mirando sólo el argumento, **no
habría salido en su propio censo**. Un nivel es el límite, y lo que no resuelve sale en
`NO CONCLUYENTES` con la llamada delante — nunca como ausencia.

## Ficheros

| fichero | qué cambia |
|---|---|
| `scripts/meta-guard-mutaciones.mjs` | la marca en disco (`marcarEnVuelo`, `borrarMarca`, `restaurarDesdeMarca`), la red de señales (`redDeSeguridad`, `instalarRedDeSeguridad`) y el **suelo 0** en el arranque |
| `scripts/censo-escritores-del-arbol.mjs` | **nuevo** · el censo de la obligación 4 (+ alias `censo:escritores-arbol`) |
| `tests/scrum808-el-arbol-que-queda-mutado.test.mjs` | **nuevo** · 9 pruebas, incluida la que pone la tanda roja si hay una marca huérfana. Declara **4** mutaciones |
| `package.json` | el alias y su `//` con la convención de SCRUM-548 |

**⛔ No se ha tocado:** `cayo()`, `murioElFichero()` ni `MUERTE_CUENTA_COMO` · ningún veredicto ni
el juicio de ninguna mutación · `app.js` ni su respaldo (SCRUM-801 está en la mesa del fundador) ·
el hook `guard-dangerous`.

## Huecos declarados

1. **La reparación NO es instantánea en Windows.** Medido: ni la señal ni un vigilante externo
   sobreviven. Entre el kill y la siguiente invocación, **el árbol sigue mutado** — lo que cambia
   es que ahora **se dice**: la tanda se pone roja y `--solo-censo` lo repara en ~1 s.
2. **La red de señales no está ejercitada con una señal REAL**, porque en esta máquina no llega
   ninguna. Se ejercita la función que ejecuta (`redDeSeguridad`), no el camino
   `process.on('SIGTERM')` → función. En un CI POSIX eso sí se podría medir, y no se ha hecho.
3. **El censo resuelve un nivel de indirección.** Dos variables, un parámetro o un `map` no se ven;
   salen declarados en `NO CONCLUYENTES`.
4. **La marca no distingue dos pasadas simultáneas.** Si alguien lanzase dos a la vez, la segunda
   sobrescribiría la marca de la primera. Nadie lo hace —y no debería, porque medirían un árbol
   mutado la una por la otra— pero no hay nada que lo impida.
5. ~~**`censo-mudez.mjs` sigue sin red**~~ → **CERRADO en el apéndice**, con la MISMA pieza.

---

# APÉNDICE · 7-sep-2026 · la red, a la segunda herramienta — y era peor que la primera

**Medido contra:** `origin/main` = `6fb51ab77713af1261dcf2e3f7819545c57c35b6` · 2026-09-07T03:45:45+01:00
**Tanda:** **5759 pruebas · 5657 en verde · 0 rojas · 102 saltadas** · 311,4 s · salida 0. Los 102
saltos declaran motivo y **suman 102** (92 base · 9 `LIBRO_PG_URL` · 1 EPERM de enlace).

`npm run meta:mutaciones` → **111 vivas · 0 mudas · 0 ciegas · 0 ficheros muertos**, salida 0, y
**0 denuncias** (pasada sana). Antes de reapuntar las anclas salía **2 · CIEGO**: ver abajo.

## 🔴 EL ROJO DE `censo-mudez`, reproducido antes de tocarlo

```
$ git status --porcelain
 M tests/_guard-texto.mjs

$ git diff
+  if (!globalThis.__filtroVisto) { globalThis.__filtroVisto = 1; process.stderr.write('__FILTRO_LLAMADO__\n'); }
```

**Y es peor que el caso original, por dos motivos medidos:**

1. **El fichero está VERSIONADO** y lo usan decenas de guards. Un resto aquí no se queda en un
   fichero cualquiera: se queda en algo que otro mergea sin mirar.
2. **Lo que queda puesto ESCRIBE EN `stderr` en cada llamada al filtro.** No es una línea inerte:
   es instrumentación viva en el camino que recorre media suite.

Y su comprobación posterior —«y se COMPRUEBA, no se supone»— **tampoco corre**: vive después del
`finally`, en el mismo hilo que ya no existe.

## LA MISMA PIEZA, NO UNA PARECIDA

La red se ha **extraído** a `scripts/_marca-de-arbol.mjs` y las dos herramientas la **importan**.
No se le ha escrito una red propia a `censo-mudez`: dos implementaciones del mismo remedio son la
regla 2, y dentro de seis meses una de las dos está rota sin que nadie lo sepa.

**Cada herramienta tiene su carpeta y su lista `enVuelo`**, y el módulo **no guarda estado
compartido**: dos marcas en el mismo sitio se pisarían, y una lista común haría que la red de una
intentara devolver las piezas de la otra. Por eso `dir` y `enVuelo` son argumentos **sin valor por
defecto que los una**.

`meta-guard-mutaciones` **re-exporta** lo que ya exportaba, para no romper a quien lo lea de fuera.

## 🔴 DOS DEFECTOS QUE CAZARON LOS CONTROLES, Y LOS DOS ERAN MÍOS

### ① El suelo de la tanda miraba UNA carpeta

Al matar `censo-mudez` con la red puesta, el árbol quedó mutado… **y el test siguió VERDE**. Miraba
`DIR_MARCA`, la carpeta del meta-guard, no todas. Cerrado con `marcasHuerfanas()`, que **barre
`.cache/` entero**: una herramienta nueva que adopte la marca queda vigilada sin volver a tocar el
test.

### ②bis Y la extracción dejó caducada la declaración de OTRO guard

Mover `restaurarYVerificar` a la pieza compartida dejó a
`tests/restauracion-del-arbol-ejecutable.test.mjs` apuntando al sitio viejo. **Lo cazó el propio
meta-guard**, que salió con **2 · CIEGO** —«el ancla no está… la declaración caducó»— en vez de
seguir verde con una mutación menos. Reapuntada, y con el motivo escrito al lado: **una pieza que
se mueve deja atrás las declaraciones que la apuntaban**, y eso es cobertura retirada en silencio
si nadie mira. Tras reapuntar: **111 vivas · 0 ciegas**.

### ② 🔴 El orden convertía un resto REPARABLE en uno DEFINITIVO

La primera versión reparaba **después** de capturar los bytes de referencia:

```js
const ORIGINAL = fs.readFileSync(HELPER);   // ← lee el fichero TODAVÍA MUTADO
restaurarDesdeMarca(DIR_MARCA);             // ← repara, pero ORIGINAL ya está sucio
```

Reproducido: la pasada toma como línea base el fichero mutado, su propio `finally` «restaura» **a
un estado mutado**, y el resto se vuelve **permanente** — encima **apilado**, dos líneas de
instrumentación una debajo de otra, con la marca nueva guardando como «original» unos bytes que ya
llevaban la mutación de la pasada muerta.

**El remedio, mal ordenado, empeoraba el defecto que venía a cerrar.** Sujeto con un test que
comprueba el orden **donde vive**: en `censo-mudez` por posición en el texto (es un script de nivel
superior), y en el meta-guard **dentro del bloque de arranque**, porque allí la mutación vive en una
función y su posición en el fichero no dice nada. *(La primera versión de ese test comparaba texto
y acusó al meta-guard, que está bien: el criterio equivocado acusa al inocente.)*

## 🔴 EL CONTROL QUE DECIDE, los dos sentidos

```
① matar censo-mudez a mitad  →  tests/_guard-texto.mjs MUTADO
② la tanda, acto seguido     →  ✖ «EL ÁRBOL ESTÁ MUTADO AHORA MISMO, por una pasada MUERTA
                                  · censo-mudez (pid 13428, …): tests/_guard-texto.mjs»
③ volver a lanzarlo          →  ⚠️ UNA PASADA ANTERIOR MURIÓ CON LA MUTACIÓN PUESTA (pid 13428…).
                                  Devuelto a sus bytes: `tests/_guard-texto.mjs`.
④ el árbol después           →  limpio
```

## ② EL CENSO, DESPUÉS — la comprobación que pedía el encargo

```
ficheros .mjs barridos                                     : 941
ESCRIBEN dentro del árbol                                  : 14
🔴 CAPTURAN un fichero, lo escriben y prometen devolverlo   : 2
…de ésos, con la red de SCRUM-808                          : 2     ← era 1
   ✅ con red  scripts/censo-mudez.mjs
   ✅ con red  scripts/meta-guard-mutaciones.mjs
```

**2 de 2.** Y la pieza compartida no se vuelve invisible: `scripts/_marca-de-arbol.mjs` sale en
`NO CONCLUYENTES` —escribe en un `p.abs` que llega por parámetro—, que es exactamente lo que este
instrumento sabe y no sabe decir.

## ✅ CONTROL POSITIVO · la pasada SANA de `censo-mudez`

Corrido entero: **0 denuncias**, marca borrada, `tests/_guard-texto.mjs` **intacto** (`git status`
limpio). Veredicto: **81 VIVO · 1 MUDO · 0 CIEGO · 10 NO APLICA · 0 YA ROJO**.

⚠️ **Sale con código 1, y no es la red:** es su veredicto de siempre —encuentra **1 MUDO**,
`scrum589-nombre-por-documento.test.mjs`—. Este ticket tiene **prohibido tocar el juicio**, así que
se deja como **hallazgo**, no como defecto de esta entrega. Y el árbol que midió es **byte a byte
el de siempre**: `_guard-texto.mjs` no cambia, la población sigue siendo 92 y la mutación es la
misma, así que el veredicto no lo mueve nada de lo hecho aquí. **No se ha corrido `censo-mudez`
sobre el árbol de antes para compararlo**, y por eso se dice como razonamiento y no como medida.

## Huecos que siguen declarados

* **En Windows la reparación no es instantánea**, y no se ha intentado arreglar: ya está medido que
  no se puede desde dentro del proceso —ni señal ni hijo desprendido—. Entre el kill y la siguiente
  invocación el árbol sigue mutado; **lo que cambia es que ahora se dice**.
* **`censo-mudez` no tiene un modo rápido** equivalente a `--solo-censo`: para que repare hay que
  lanzarlo entero. La tanda lo denuncia igual, y el aviso dice qué comando lo repara.
* Los otros tres huecos de la entrada siguen en pie sin cambios.
