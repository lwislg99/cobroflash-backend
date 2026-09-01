# SCRUM-620 · «No pude levantar mi servidor» contado como «he encontrado un defecto»

**Fecha:** 01-sep-2026 · **Carril:** B · **Gate:** MEDICIÓN Y PROPUESTA — no se toca ningún guard

**Medido contra:** `origin/main` = `45412c14bf8d8a5be24007e75481d95b4a001bfe` · 2026-09-01T13:47:57+01:00

Esto **propone y para**. No entra código de guard: la decisión de tocar nueve ficheros que hoy
pasan es del fundador, y es la misma clase de riesgo que SCRUM-617.

---

## 1 · Los dos hechos, provocados hoy, sobre el MISMO guard

Sin tocar nada: se provoca cada hecho y se mira qué dice el instrumento.

| hecho | cómo se provocó | exit | la puerta lo pinta |
|---|---|---|---|
| **A · no pudo levantar su servidor** | ocupando el puerto 4472 antes de lanzarlo | **1** | **`rojo(1)`** |
| **B · encontró un defecto de verdad** | los `.ibtn` de la landing forzados a 12 px | **1** | **`rojo(1)`** |

**El mismo código para los dos hechos.** La única diferencia está en el texto de la salida —el A
lleva `Error: listen EADDRINUSE: address already in use :::4472`— y sólo la ve quien la lea. El
guard **no dice en ningún sitio que no pudo medir**: comprobado, no hay «no pude arrancar» ni «no
supe mirar» en su salida.

⚠️ **Y el primer intento de provocar A NO reprodujo A**, lo cual conviene que quede escrito: se
ocupó el puerto atando a `127.0.0.1`, pero los guards atan a `::` (todas las interfaces), así que
Windows dejó al guard atar igual. Lo que salió fue otra cosa — un impostor sirviendo el puerto y una
`Navigation timeout` a los 30 s— que **también** sale como `rojo(1)`. Repetido atando como ata el
guard, apareció el `EADDRINUSE` de verdad. Un experimento que produce el código correcto por el
motivo equivocado habría «confirmado» el ticket sin medirlo.

**Y el caso no es raro: es el flujo normal.** El original (SCRUM-617) no fue otro proceso — fueron
sockets en `TIME_WAIT` de **la pasada anterior del propio guard**. Cualquiera que itere sobre un
arreglo lanza la cadena dos veces seguidas.

---

## 2 · El censo

### (a) Quién levanta servidor propio — **los 9 de 9**

| guard | fichero | puerto | variable |
|---|---|---|---|
| contraste | `scripts/guard-contraste.mjs` | **4399** | `GUARD_PUERTO` |
| caja-avisos | `scripts/guard-caja-avisos.mjs` | **4401** | `CAJA_PUERTO` |
| aviso-bizum | `scripts/guard-aviso-bizum.mjs` | **4402** | `BIZUM_PUERTO` |
| a11y-comparativa | `scripts/guard-a11y-comparativa.mjs` | **4402** | `A11Y_PUERTO` |
| vias-de-cobro | `scripts/guard-vias-de-cobro.mjs` | **4403** | `VIAS_PUERTO` |
| a11y-landing | `scripts/guard-a11y-landing.mjs` | **4403** | `A11Y_LANDING_PUERTO` |
| objetivo-tactil | `scripts/guard-objetivo-tactil.mjs` | **4472** | — |
| cls-barra-anuncio | `scripts/guard-cls-barra-anuncio.mjs` | **efímero** | lo elige el sistema |
| primera-pantalla | `scripts/guard-primera-pantalla.mjs` | **efímero** | lo elige el sistema |

### (b) Quién puede colisionar

- **Consigo mismo, en dos pasadas seguidas: los 7 de puerto FIJO.** Es el caso real de SCRUM-617.
- **Entre ellos: dos pares.** `4402` (aviso-bizum + a11y-comparativa) y `4403` (vias-de-cobro +
  a11y-landing). Hoy no se nota porque la puerta los corre **en serie**; el día que alguien los
  paralelice —o corra uno a mano mientras la cadena va— chocan.
- **Los 2 de puerto efímero NO pueden colisionar**, ni consigo mismos ni con nadie.

⚠️ **Ese dato casi lo cuento al revés.** La primera versión del censo no reconocía `listen(0, …)` y
los daba como «puerto `null`, COMPARTIDO» — convertía **el patrón bueno en un hallazgo**. Se corrigió
antes de publicar ningún número.

### (c) 🔴 La pregunta que decide: **también se propagó por copia**

> **9 de 9 crean su servidor en su propio fichero. Cero lo importan de un módulo común.**

Es exactamente el hallazgo de SCRUM-617, **una capa más abajo**: allí no había un sitio donde se
decidiera cómo arranca el NAVEGADOR; aquí no lo hay para el SERVIDOR. Y la copia tampoco fue
uniforme: **dos de las nueve mutaron a la forma buena** (puerto efímero) y las otras siete
conservaron el puerto fijo. Nadie decidió ninguna de las dos cosas en un sitio.

Consecuencia medida: **ninguno de los nueve trata el fallo de `listen`.** El error sube como
`Unhandled 'error' event` → `exit 1` → `rojo(1)`.

---

## 3 · La propuesta

**Lo que hay que arreglar es el DIAGNÓSTICO, no el puerto.** Son dos cosas y conviene no mezclarlas:
elegir bien el puerto reduce las colisiones, pero el día que el puerto lo ocupe otra cosa el
instrumento seguiría sin distinguir los dos hechos. Por eso la propuesta es la primera.

### ① Un código propio, y no reusar el 3

El vocabulario de SCRUM-522 es `0 midió · 2 NO SUPE MIRAR · 3 NO PUDE ARRANCARLO (el navegador)`.
**Se propone `4 · NO PUDE LEVANTAR MI SERVIDOR`**, y no reutilizar el 3, por lo que dice el propio
encargo: el fallo del navegador y el del servidor **se parecen, y que se parezcan es justo lo que
hay que impedir que se confunda**. Con códigos distintos, el log dice cuál de las dos capas falló
sin que nadie tenga que leer una traza.

La puerta ganaría una etiqueta más en su tabla, junto a `NO ARRANCA`.

### ② Dónde vive la decisión: un sitio único NUEVO

Por la respuesta (c), no hay dónde ponerlo: hay que crearlo. Se propone
**`scripts/_servidor.mjs`**, hermano de `_navegador.mjs`, con una sola entrada que:

- levante el servidor y **devuelva el puerto real** (lo que ya hacen los dos buenos);
- ante **cualquier** fallo de `listen` —no sólo `EADDRINUSE`— pare con **código 4** y un mensaje que
  diga qué puerto, qué errno, y **que el guard no ha medido nada**;
- **no reintente y no espere**. Un guard que reintenta hasta que le sale bien no puede decir que
  algo está roto.

### ③ Lo que NO propongo

- **No elegir un puerto libre «al azar» como arreglo.** Prohibido en el encargo y estoy de acuerdo:
  tapa el síntoma. Dicho eso, **el patrón efímero ya existe en casa, en 2 de los 9**, así que
  extenderlo o no es una decisión aparte —de higiene, no de diagnóstico— y la dejo planteada sin
  tomarla.
- **No tocar `_navegador.mjs`.** Está cerrado y es otra capa.

### ④ El coste, dicho antes

Toca **nueve ficheros que hoy pasan**. Es el mismo perfil de riesgo que SCRUM-617, y pide los mismos
controles: los 9 verdes con navegador real antes y después, y los dos sentidos sin confundirse.

---

## 4 · El control positivo: la mitad que se puede correr hoy

- **Hoy:** los dos hechos provocados dan **el mismo `rojo(1)`** (tabla del bloque 1). Ése es el
  «antes», y está medido.
- **La otra mitad —«no se confunden en ninguna de las dos direcciones»— exige el arreglo**, que no
  está autorizado. Va en el PR que lo implemente, con la avería inyectada sobre árbol commiteado y
  reversión byte a byte, como en SCRUM-617.

Reversión de la avería de este informe: `Buffer.compare(disco, testigo) === 0`.

---

## Estado del árbol

- **Suite: total 4083 · pass 4004 · fail 0 · skipped 79** (67 `QA_DB_TEST`, 9 `LIBRO_PG_URL`,
  1 `BOT_SUITE_TEST`, 1 `A55_DB_TEST`, 1 EPERM de Windows).
- **Los 9 guards de navegador en verde**, la puerta sale con **0**, arranque 0,3 s en los nueve.
- `npm run guards:entrada` en verde.

No se ha modificado ningún guard.

---

# SCRUM-620 · APÉNDICE · La implementación: código 4, sitio único, y el efímero DESPUÉS

**Fecha:** 01-sep-2026 · **Carril:** B · **Gate:** sin gate — el mecanismo corre en `npm test`

**Medido contra:** `origin/main` = `bcf30775b0e535c9c6534eb7636558b9a4200a3e` · 2026-09-01T14:02:19+01:00

Lo de arriba era la medición y la propuesta. Esto es la ejecución, en **dos commits y en este
orden**, que no era negociable.

## Por qué el orden importaba, y no fue decisión mía

> **Si el efímero entra primero, la colisión desaparece — y con ella la única forma de demostrar
> que el diagnóstico funciona.** Quedaría el código 4 escrito y nunca ejercitado: el defecto que
> este ticket persigue, cometido al arreglarlo.

Es del fundador, y es correcta. Por eso: **① `7eef46cc` el diagnóstico**, con sus tres controles
ejercitados sobre la colisión real; **② `639adf3a` el efímero**, en commit propio y revertible sin
tocar ①.

## ① El diagnóstico

`scripts/_servidor.mjs`, hermano de `_navegador.mjs`. El vocabulario queda así:

| código | significa | quién lo dice |
|---|---|---|
| 0 | midió | el guard |
| 1 | encontró un defecto | el guard |
| 2 | NO SUPE MIRAR — no hay navegador | `_navegador.mjs` |
| 3 | NO PUDE ARRANCARLO — lo hay y no levanta | `_navegador.mjs` |
| **4** | **NO PUDE LEVANTAR MI SERVIDOR** | **`_servidor.mjs`** |

**El 4 no reusa el 3**, y es el argumento del propio encargo: los dos fallos se parecen, y que se
parezcan es justo lo que hay que impedir que se confunda.

Devuelve **el puerto real**, para con 4 ante **cualquier** fallo de `listen` —no sólo `EADDRINUSE`—
y **no reintenta ni espera**. Un detalle que no es cosmético: el `once('error')` va **antes** del
`listen`, porque el evento puede llegar en el mismo tick y engancharlo después es exactamente cómo
se convierte en el `Unhandled 'error' event` que había.

**Los nueve cableados. No se ha cambiado lo que mide ninguno.**

### El test propio, y por qué hacía falta

`tests/scrum620-servidor-que-no-arranca.test.mjs` **provoca la colisión a propósito**. Sin él, el
commit ② la haría desaparecer y el código 4 quedaría sin ejercitar para siempre. El test ata **como
atan los guards** —sin host, o sea `::`— y no a `127.0.0.1`: esa distinción es la que hizo que el
primer experimento del informe anterior no probara lo que parecía probar.

## ② El efímero

Los siete de puerto fijo pasan a pedir `0`. Los otros dos ya lo hacían: **el patrón bueno ya existía
en casa, en 2 de los 9.**

**La variable de entorno sigue mandando, y no es un resto: es lo que mantiene el código 4 alcanzable
en la vida real.** Medido en las dos direcciones:

| caso | resultado |
|---|---|
| `VIAS_PUERTO=4403` y el 4403 ocupado | **exit 4 · SIN SERVIDOR** ✅ el diagnóstico sigue vivo |
| sin la variable, el mismo puerto ocupado | **exit 0 · verde** — se fue a uno libre |

Con esto se cierran también las **dos colisiones entre guards** del censo (4402 y 4403).

## Los tres controles

Árbol commiteado en **`7eef46cc`** antes de inyectar nada.

| control | qué se provocó | resultado |
|---|---|---|
| **1 · EADDRINUSE real** | puerto 4472 ocupado, atando **como ata el guard** (sin host) | **exit 4 · SIN SERVIDOR**, con sus palabras y **nombrando `EADDRINUSE`** |
| **2 · rojo real** | los `.ibtn` de la landing a 12 px | **exit 1 · `rojo(1)`**, nombrando `12.6px < 44 · BUTTON.ibtn--wa`, y **cero** menciones de «no pude levantar» |
| **3 · el impostor** | puerto ocupado por algo que **sí responde** (atado sólo a `127.0.0.1`) | **exit 1**, y **NO** lo clasifica como 4 ✅ |

**No se confunden en ninguna de las dos direcciones.** Reversión de la avería del control 2:
`Buffer.compare(disco, testigo) === 0`.

### Sobre el impostor, con precisión

Sale **1 antes y 1 después**: el `listen` **funciona** —el impostor ató sólo `127.0.0.1` y el guard
ata `::`—, así que el servidor arranca y lo que falla es después, al navegar (`TimeoutError` de
puppeteer). **Que el código 4 no salte ahí es lo correcto**: mentiría en la otra dirección.

⚠️ **Hueco declarado, no de este ticket:** ese caso sigue saliendo como `rojo(1)`, o sea «he
encontrado un defecto» cuando lo que pasa es que **se midió sobre contenido ajeno**. Es un tercer
estado —«medí, pero no lo mío»— sin código propio. Con el efímero de ② es mucho menos probable, pero
no imposible.

## El enlace con SCRUM-628

Las dos colisiones entre guards (**4402**: aviso-bizum + a11y-comparativa · **4403**: vias-de-cobro
+ a11y-landing) **no se notaban porque la puerta los corre EN SERIE**. La cadena va ya por ~97 s;
SCRUM-628 propone meterle pantallas del dashboard, y **la salida obvia cuando llegue a cinco minutos
es paralelizar** — el día que eso pase, esos dos pares chocan.

**Arreglar esto antes es lo que permite plantear 628 siquiera.** Sin el ② de hoy, paralelizar habría
producido `rojo(1)` intermitentes; y sin el ①, esos rojos se habrían leído como defectos de la
pantalla.

## Estado del árbol

- **Suite: total 4107 · pass 4028 · fail 0 · skipped 79** (67 `QA_DB_TEST`, 9 `LIBRO_PG_URL`,
  1 `BOT_SUITE_TEST`, 1 `A55_DB_TEST`, 1 EPERM de Windows).
- **Los 9 guards en verde** con Edge real, puerta con **0** — antes y después de ②. Ninguno se cayó,
  que era el riesgo declarado antes de empezar.
- `npm run guards:entrada` en verde.
