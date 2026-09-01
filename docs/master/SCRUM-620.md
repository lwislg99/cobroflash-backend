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
