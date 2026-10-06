# SCRUM-1463 · El latido dice si la cuenta QA vive y quién la renueva, y un vigía parado deja de leerse como «sin avisos»

**Rama:** `scrum-1463-latido-qa-y-vigia-callado` (sale de `scrum-1459-latido-lee-al-vigia`: mismo fichero) · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `39af736efc8ccf7d2966063561421855b3e4c4e9` · 2026-10-06T11:38:00Z (hora de GitHub)

A9: comprobación → `tests/scrum1463-latido-qa-y-vigia-callado.test.mjs`

Carril S5: `scripts/equipo/latido.mjs` y un test. No toca ningún workflow ni
`scripts/qa/sesion-panel.mjs`. Encargo del orquestador del 6-oct-2026 (~11:33Z).

## Qué arregla y qué no

Arregla que **quien llega y corre el latido lo sepa todo de golpe**: si puede mirar producción con la
cuenta QA, y si el instrumento que vigila los PR sigue vigilando.

No acorta un parón. Si nadie corre nada durante tres días, el latido sigue sin decir nada: es un
comando (ver `docs/master/SCRUM-1459.md`).

## Qué pasaba

### La cuenta QA

La sesión caducó el 3-oct a las 16:37Z y estuvo muerta hasta el 6-oct. El latido no la miraba. El
orquestador dijo durante cuatro días que la renovaba el fundador: el 2-oct a una sesión se le denegó el
permiso, y eso se leyó como «sólo puede él». La renovó el orquestador el 6-oct con un comando. Cuatro
tickets con su código en producción quedaron sin verificar ese tiempo.

`scripts/qa/sesion-panel.mjs estado` (SCRUM-1430) ya contestaba VIVA · MUERTA · NO SE PUEDE SABER, y
con MUERTA ya daba el comando. Faltaba que alguien lo corriera, y faltaba decir **quién** puede.

### El vigía callado

Con SCRUM-1459 la sección VIGÍA lee los avisos del issue. Un vigía que deja de correr no escribe
avisos, así que la sección saldría en ✅ indefinidamente: el mismo resultado para «no hay nada» y para
«nadie está mirando».

## Qué cambia

| Antes | Ahora |
|---|---|
| El latido no miraba la cuenta QA | Sección 10, **QA**, con la frase de `estado`: cuenta, y hasta cuándo |
| — | MUERTA es alerta: lleva el comando entero y «la renueva el orquestador, o cualquier sesión de esta máquina; no hace falta el fundador» |
| — | NO SE PUEDE SABER, un código sin su frase o un reventón: sección ciega (salida 2). Nunca «viva» por omisión |
| VIGÍA sólo leía comentarios | Lee además las corridas del workflow: «última pasada del vigía hace N h» delante de la línea |
| Vigía parado = ✅ | Última pasada de más de 12 h: 🔴 «el vigía NO CORRE desde hace N h y se le pide cada 3» |
| — | Última pasada terminada en otra cosa que `success`: 🔴 aunque sea reciente |
| — | Sin corridas legibles: sección ciega |

`estado` se **llama** (`ejecutar(['estado'])` importado), no se copia. Hace una petición GET a
`/admin/me` de producción con la cookie guardada, igual que el comando a mano. El latido no entra, no
renueva y no cierra sesión.

## Una corrección al encargo

El encargo pedía alertar «si el último **aviso** del vigía tiene más edad que su intervalo». Los avisos
no tienen intervalo: el vigía sólo comenta cuando la lista empeora (un PR entra, cambia de causa o cruza
24 h / 72 h / 168 h), así que entre dos avisos pueden pasar días con todo en orden. Lo que tiene
cadencia son sus **pasadas**, y eso es lo que se mide: las corridas de `vigia-atascados.yml`.

## El tope de 12 h, con su medida

El cron pide cada 3 h y GitHub lo retrasa o se lo salta.

| Ventana | Pasadas | Hueco mediano | Hueco mayor |
|---|---|---|---|
| 17 → 29-sep (SCRUM-1270, de la cabecera del workflow) | 60 | 4,9 h | 9,8 h |
| 29-sep → 6-oct (medido hoy, 30 corridas) | 30 | no calculado | 10,1 h |

Doce horas queda por encima de todo lo medido. Con el cron retrasándose más, daría falsos avisos; con
un vigía que muere, tarda hasta 12 h en decirlo.

## Medido después

`node scripts/equipo/latido.mjs`, 6-oct-2026 ~11:37Z:

```
🔴 VIGÍA · última pasada del vigía hace 2.2 h (success) · issue #1241 · 43 comentarios, 43 son avisos del vigía · 43 sin leer (3 con algún PR aún abierto, …)
✅ QA · sesión de la cuenta QA: VIVA — GET /admin/me → 200 (luisdragonball+qa@gmail.com); según su fichero caduca el 2026-10-07T11:34:39Z, dentro de 23 h 57 min (hora del servidor).
```

Coste: una llamada más a `gh` en VIGÍA (1,7 s la sección) y 0,2 s la de QA. El latido entero, 26,5 s.

El caso MUERTA y el caso «vigía parado» no se han visto en vivo: hoy la cuenta está viva y el vigía
corre. Están en el test, con las frases reales de `estado`.

## Tests

`tests/scrum1463-latido-qa-y-vigia-callado.test.mjs` → 8 de 8. Con los otros cinco del latido: 83 de 83.

Mutaciones, con la base sin mutar en 8/8 primero. Doce de doce mueren:

| Mutación | Caen |
|---|---|
| M1 · QA muerta no es alerta | 1 |
| M2 · QA muerta no dice quién la renueva | 1 |
| M3 · «no se puede saber» se da por viva | 1 |
| M4 · salir 0 basta para VIVA, diga lo que diga | 1 |
| M5 · salir 1 basta para MUERTA | 1 |
| M6 · el vigía parado no alerta | 2 |
| M7 · una pasada fallida cuenta como que miró | 1 |
| M8 · sin corridas se da por bueno | 2 |
| M9 · una corrida en cola cuenta como terminada | 2 |
| M10 · la ceguera de la pasada no ciega la sección | 1 |
| M11 · la alerta de la pasada no llega a la sección | 1 |
| M12 · el tope sube a una semana | 3 |

## Lo que se pidió y NO se ha construido aquí

**«Que el latido cuente los tickets En curso que ya están enteros en `main`».**

- El latido no tiene credenciales de Jira, y ningún guion del repositorio las tiene (buscado en
  `scripts/`: cero). Dárselas sería un secreto nuevo, descartado ese mismo día.
- El cruce ya existe: `scripts/abierto-con-trabajo-en-main.mjs` (SCRUM-1259). Recibe una foto de los
  tickets abiertos (el JSON del conector de Jira o un TSV), exige que no tenga más de 12 h y dice cuáles
  tienen su trabajo en `main`. Es lo que el orquestador hizo a mano sobre 40 tickets.
- No se ha corrido hoy: no hay foto.

Devuelto al orquestador con dos salidas (A: no tocar el latido · B: que lea una foto en una ruta
fija, descartada porque saldría 2 casi siempre). **Decidido por él el 6-oct (~11:44Z): la A, más un
puntero.**

### El puntero

El latido imprime en cada pasada, antes del veredicto, una línea fija:

```
ℹ️ JIRA · el cruce «tickets abiertos con su trabajo ya en main» NO lo hace el latido: no tiene credenciales de Jira. Saca la foto con el conector (…) y corre: node scripts/abierto-con-trabajo-en-main.mjs --jira <foto.json …> · la foto vale 12 h (…) · «con trabajo en main» NO es «terminado» · esto es un puntero, no una medición: no cuenta para la salida
```

- No es una sección: no alerta, no ciega y no cambia la salida.
- No afirma nada sobre Jira. Convierte «acordarse de correr el cruce» en «leerlo».
- El test comprueba que el comando señalado existe y sigue aceptando `--jira` y el tope de 12 h: un
  puntero a un comando que cambió es peor que no tenerlo.
- El comando real lleva `--jira` delante de la foto (el encargo lo citaba sin él).

## Lo que sigue sin mirar

- QUÉ cuenta es la guardada frente a la que se necesita. La sección dice el correo; si hace falta otra
  (el 6-oct dos sesiones anotaron que la cookie era de `demo@yaqu.app` y no de la cuenta QA), lo ve
  quien lee.
- Que el vigía corra y no vea: una pasada `success` cuenta como «miró».
- Jira.
