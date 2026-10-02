# SCRUM-1325 · una tilde no cambia lo que el bot entiende: un solo idioma, y un guard que censa las expresiones

**Medido contra:** `origin/main` = `ce567ed45a800d7b67032480e31131954ec11741` · 2026-10-01T04:21:58+02:00 (J2c, equipo de Javier)

A9: comprobación → `tests/banco-scrum1325/mutar.mjs`

**Decisiones:** del orquestador del equipo de Javier (`cobroflash-backend-5b`), por mensaje entre
sesiones el 1-oct-2026, a las mediciones de abajo. Cinco: (A) la rama no se empuja hasta que SCRUM-1322
esté en `main`; (B) se tocan `maintenance.service.ts` y `quoteDecisionLanding.routes.ts`, que no son
del bot; (C) `NO_ZONE_RE` pasa por el helper y no se borra; (D) un solo idioma, todo ASCII, y el
patrón de la eñe se ancla; (E) la baja del canal queda como excepción visible. No es firma del
fundador ni la necesita: no cambia ningún texto, ningún estado ni ningún envío.

## La premisa del ticket, corregida

El ticket decía «`\b` **sin la bandera unicode** no ve frontera de palabra después de una letra
acentuada». Medido con el literal de `main`: con la bandera `u` y con la `v`, «no sé» sigue sin casar.
En JavaScript `\b`, `\w` y `[a-z]` sólo conocen las letras ASCII, con cualquier bandera. Poner la
bandera no arregla nada; comparar sin tildes, sí.

Y la clase no es «`\b`». Es **una expresión con letras, comparada con texto de persona sin
normalizar**, y falla en las dos direcciones:

- no casa lo que debe: «sí» contra `s[ií]\b` (detrás de la «í» no hay frontera);
- casa lo que no debe: «síntoma» contra `s[ií]\b` (entre la «í» y la «n» hay una frontera falsa);
- y sin `\b` ni `\w` ni rango: «edítalo» contra `edita(?:r|lo)?`, porque el patrón lleva la letra
  sin tilde. Un censo de `\b|\w|[a-z]` habría nacido corto por este lado.

## ① El censo

AST sobre `src/`: **311 ficheros `.ts` · 186 expresiones** (179 literales y 7 `RegExp(`).

- **99 fuera por construcción:** no llevan letras, ni `\b`, ni `\w` (`/\D/g`, `/\s+/`, `/\p{M}/gu`…).
  No pueden tener el agujero.
- **87 declaradas**, una por una, en `tests/_expresiones-de-texto.json` (84 entradas; tres aparecen
  dos veces en su fichero):
  - **63 `maquina`** — no miran lenguaje: XML de la AEAT, data-URL, colores, NIF, cookies, ids de
    botón, nuestros propios literales.
  - **23 `persona`** — miran lo que escribe alguien. 6 del bot, 9 semillas de mantenimiento, 4 del
    icono de la línea, 2 del dictado del parte, 1 de la cabecera del CSV de clientes, 1 del código de
    referido.
  - **1 `persona-sin-normalizar`** — la baja del canal (abajo).

De las 23 de persona, **4 ya comparaban sin tildes** antes de este ticket (dictado ×2, CSV, referido)
y **19 no**. De las 19, medidas con sus literales de `main` y pares con y sin tilde:

| sitio (`main`) | qué pasaba | víctima |
|---|---|---|
| `botFlow:454` «¿Lo envío?» | «si» envía; «sí», «Sí», «sí, envíalo» **no**. Y «síntoma de humedad» **envía**. | **Sí**: la solicitud no se crea y vuelve el recordatorio de botones |
| `botFlow:456` reescribir | «editalo», «cambialo» sí; «edítalo», «cámbialo» **no** | Sí: no reinicia |
| `botFlow:86` `NO_ZONE_RE` | «no se» casa; «no sé» **no** | **Ninguna**: la guarda es redundante (abajo) |
| `botFlow:82`, `:84`, `:675` | la tilde enumerada a mano (`men[uú]`): bien con la tilde de un carácter, **mal con la combinatoria** | Sólo si el teclado manda la combinatoria |
| `maintenance:62` | `bomb[ií]n`: igual, mal con la combinatoria | Ídem |
| `maintenance:50-68`, las otras 8 | `baño`, medido: sin fallo con la tilde de un carácter. Las otras 7 no llevan letra acentuable | — |
| `quoteDecisionLanding:354-357` | sin fallo: los cuatro cortan la raíz antes de la tilde (`instalaci`, `revisi`) | — |

El idioma «NFD y quitar las marcas» ya estaba escrito **siete veces** en `src/`, cada una en una
función privada (`parteDictado` ×2, `importarClientes`, `referral`, `products`, `albaranesListado`,
`ai.service`). No se unifican aquí: son de otros módulos y ninguna falla.

## ② El idioma, uno

`src/core/texto/sinTildes.ts`: `texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()`. Es el
de SCRUM-1322, sacado de `decisionPorTexto.ts`, que ahora lo importa. Las 19 expresiones se aplican a
`sinTildes(texto)` y van en ASCII (`s[ií]` → `si`, `bomb[ií]n` → `bombin`).

**Lo que cuesta, y se dice:** quita TODAS las marcas, así que la eñe sale «n».

- En todo el censo sólo una expresión de persona llevaba eñe: `/reforma|obra|baño|cocina/i`. Como
  `bano` casa dentro de «urbano», el patrón pasa a `\bbano`. «baño» deja de casar dentro de otra
  palabra («rebaño» casaba antes): era un falso positivo que nadie había medido.
- 🔴 **«ño» → «no» → RECHAZA un presupuesto, hoy, en SCRUM-1322.** Medido con `parseDecision`: «ño» y
  «Ño» dan `reject`. Hace falta que el mensaje entero sea esa palabra, y nadie lo vio porque las
  listas de 1322 no llevan eñes. No se arregla aquí: es una propiedad del idioma, y queda escrita
  donde la encuentre quien lo toque.

## ③ Rojo y positivo

`tests/scrum1325-una-tilde-no-rompe-lo-que-entiende.test.mjs`: el bot real (`handleBotMessage` de
`dist/`) y `suggestMaintenance`, con dobles. Cada entrada con tilde va en sus **dos formas**
(construidas por código y comprobado que son cadenas distintas). Antes del arreglo, sobre el `dist/` de
la base: **6 casos de 8 en rojo** y los 2 controles en verde. Después: 9 de 9.

- Positivo de cada sitio: la misma entrada sin tilde sigue entendiéndose.
- Negativo: «síntoma de humedad», «silla rota», «valencia», «okupas» no envían; «holanda» y «menudo
  susto» no piden el menú; «estudio urbano» no propone mantenimiento.
- Control: una descripción y una zona de verdad, con sus tildes, pasan.

**Dos sitios sin rojo por efecto, y no se finge:**

- `NO_ZONE_RE`: `isValidZone` devuelve lo mismo con ella que sin ella (todo lo que casa pasa también
  por «no es un saludo y tiene 2 letras o más»). Se pasa por el helper y se conserva.
- El icono de la línea: sus patrones cortan antes de la tilde, y normalizar no cambia ningún resultado.

A los dos los sujeta el guard, no el test de efecto.

## ④ El guard

`tests/scrum1325b-expresiones-sobre-texto-de-persona.test.mjs`, con el motor en
`tests/_censo-expresiones-de-texto.mjs`. El árbol real y los casos fabricados pasan por la misma
función.

- Una expresión con letras, `\b` o `\w` que no esté en el catálogo → rojo: **«NO SÉ si mira texto
  escrito por una persona»**. Va por identidad (fichero + su texto): editarla la convierte en otra.
- Un `RegExp(` cuyo patrón no se puede leer → se trata como sensible, no como inofensivo.
- Declarada `persona`: en ASCII, y cada sitio donde se aplica tiene que recibir texto normalizado. Si
  no puede seguir el texto hasta el normalizador (un parámetro, un `let`, la expresión pasada a otra
  función) → rojo: **«NO SÉ decidir»**.
- Los normalizadores se reconocen **por lo que hacen** (`.normalize('NFD').replace(…)`), no por el
  nombre: una función que se llame `sinTildes` y no quite las marcas no pasa.
- La excepción es una lista cerrada en el propio test.

**La excepción: `/^(baja|stop)[.!]?$/i`.** Mira texto de persona y no tiene forma con tilde: no hay
rojo posible, y pasarla por el idioma haría que «bajá» diera de baja. Qué cuenta como una baja es
decisión de producto y nadie la ha tomado; el orquestador lo deja anotado.

## Cómo se comprobó

- **Rojo primero, por efecto:** el test del bot contra el `dist/` de la base, antes de tocar código:
  6 de 8 en rojo, los 2 controles en verde. Las semillas de mantenimiento se escribieron después del
  arreglo; su rojo se vio con las mutaciones S6 y S7.
- **Banco de mutaciones** (`tests/banco-scrum1325/mutar.mjs`, un build entero por cada mutación de
  `src/`): **22 lanzadas, 22 caen donde se esperaba, 0 mudas, 0 ciegas.** Base verde primero; al
  final, build limpio y árbol limpio.
  - **S, 11 — el código deja de comparar sin tildes.** Nueve caen por efecto Y por el guard. Dos
    caen SÓLO por el guard, y estaba declarado antes de lanzarlas: `NO_ZONE_RE` (S5) y el icono de la
    línea (S8), los dos sitios sin efecto observable.
    S10 (el helper deja de pasar a minúsculas) cae sólo por efecto: el guard mira que se quiten las
    marcas, no la caja.
  - **G, 11 — el guard se vuelve ciego.** Las 11 tumban el test del guard: deja de ver las letras,
    da todo texto por normalizado, calla ante un parámetro, reconoce el normalizador por el nombre,
    deja pasar la que está sin declarar, la que no sabe dónde se aplica, la entrada que sobra, el
    `normalize('NFD')` a secas, la tilde en el patrón, el `RegExp(` ilegible y la clase inventada.
- **Venenos dentro del propio test** (en memoria, sin escribir en disco): quitar `sinTildes(` de
  cada uno de los 7 sitios deja en rojo exactamente las expresiones que dependen de él, 19 en total,
  y ninguna más.
- **Tanda dirigida** tras traer `main` (`ce567ed4`): 248 ficheros, 2.315 casos, 0 rojos, 9 saltos
  (lo relacionado con los ficheros tocados y los guards de suite: `scrum237`, `scrum267`, `scrum377`,
  `scrum411`, `scrum775`, `scrum850`, `scrum854`, `scrum976`, `scrum1294`).
  La tanda completa NO se ha corrido en local: va de una en una por máquina y con turno.

## Lo que NO se ha medido, y lo que queda fuera

- **`public/`** (el panel) no está en el censo: el ticket pedía `src/`.
- **Comparaciones que no son expresiones** (`===`, `includes`) sobre texto de persona: se miraron en
  el bot (`botFlow.service.ts` y `whatsappIncoming.routes.ts`) y no hay ninguna; en el resto de `src/`
  no se han censado.
- **Si WhatsApp entrega la tilde combinatoria** no se ha medido contra Meta. El idioma cubre las dos.
- El guard no mira qué hace el helper de la casa por dentro cuando se importa: lo ven por efecto este
  test y el de SCRUM-1322. Sí fija que su fuente sigue siendo la cadena normalizadora.
- `^(no|…)\b` en `botFlow:456` hace que «no sé» REINICIE la solicitud. Es el defecto de SCRUM-1322
  (prefijo, no tilde) en otro sitio. Declarado al orquestador, que lo abre aparte.
- «corrígelo» no reinicia, ni con tilde ni sin ella: el vocabulario no se ha tocado.
- **No hay verificación en `yaqu.app`.** El bot va detrás de `BOT_INBOUND_ENABLED`, que su propia
  cabecera da por apagado por defecto; su valor en producción no se ha mirado.

## Errores propios (A9)

1. **El banco contaminó sus propias filas, y es el que generaliza.** En la primera pasada, las 11
   mutaciones del guard hicieron caer también el test de EFECTO, que no las puede ver. Causa: una
   mutación de `src/` deja su build en `dist/` aunque el fuente se restaure, y las del guard no
   compilan, así que corrían contra el `dist/` de la mutación anterior (S11). No cambió ningún
   veredicto —el del guard se lee de `src/`—, pero una fila decía «cae además el otro» y era
   mentira. Lo delató que el banco imprime qué test cae y cuál se esperaba. Arreglado: el banco
   recompila antes de una mutación del guard si el `dist/` viene mutado, y se relanzó entero.
2. **Afirmé antes de medir.** Le dije al orquestador que «ño» rechazaba un presupuesto en SCRUM-1322
   razonándolo sobre el idioma; lo ejecuté después. Era cierto. El orden era el contrario.
3. **Un positivo mío daba por buena una clase que era de otra expresión.** Puse «hola» con el emoji
   compuesto como saludo que pide el menú (`botFlow:675`); ese emoji sólo lo admite la de `:82`. Lo
   cazó la primera pasada en verde, que no lo estaba. Ahora va donde corresponde y construido por
   código.
4. **Pasé un guion a node por un heredoc de bash**, que se comió las barras invertidas de una
   expresión. No arrancó (exit 1, sin población) y por eso se vio. Es una trampa conocida del
   puesto; los guiones siguientes fueron a fichero.
5. **Pares mal hechos en la sonda de medición.** Tres no eran pares («corrige» / «corrígelo») o no
   eran castellano («bajá», «nó»). No llegaron a ninguna cifra publicada; las del registro salen de
   los tests.

# SCRUM-1325b · El PR llevaba un día en conflicto con `main`: la mezcla, y el banco repetido sobre ella

**Medido contra:** `origin/main` = `f7d013778fc979caff89d7c9ac47d8ed79dca248` · 2026-10-02T03:35:59Z

A9: sin fallo que generalice — el tramo es una mezcla de `main` con un conflicto de tres líneas y la repetición de un banco que ya existía; lo que tuvo parado el PR (un conflicto no vuelve a lanzar el CI, y con el auto-merge armado parece atendido) ya lo nombra el latido de arranque, que lo lista como «CONFLICTO con main» con sus horas.

**Cruce de carril, declarado:** el ticket no lleva etiqueta de área y lo construyeron J2c y J2d. Este
tramo lo hace J3b (sesión `jv-j3b`, equipo de Javier) por encargo del orquestador
(`cobroflash-backend-5b`), que lo asume por mensaje entre sesiones el 2-oct-2026.

## Qué pasaba

El PR #2051 estaba en `DIRTY` / `CONFLICTING` desde el 1-oct-2026 (cabeza `abf3181b`, último cambio
a las 03:44Z de ese día) con el auto-merge armado. Un PR en conflicto no lanza el CI: el rojo que
enseñaba era de una base que ya no existía.

## La mezcla

- `git merge origin/main` dentro de la rama, sin rebase. Dos mezclas: la de `bbe633ac` (punta
  `140045f68e0b7dd430a8dc057b9c4c8f463f8de1`) y la de `f7d01377`, que sólo traía dos registros de
  `docs/master/` y entró sin conflicto.
- **Un conflicto, en un fichero:** `src/modules/whatsappBot/domain/decisionPorTexto.ts`. La rama
  añadía el `import` de `sinTildes` justo encima del tipo `Decision`; `main` (SCRUM-1326) cambió ese
  tipo para añadir `'ask'`. Se conservan las dos mitades: el `import`, y el tipo con `'ask'`.
- Comprobado por efecto, el 2-oct-2026 sobre `140045f6`: el fichero resuelto difiere del de `main`
  sólo en lo de esta rama (el `import` y `tramos()` pasando por `sinTildes`); ningún marcador de
  conflicto; el diff del PR contra `main` son los mismos 12 ficheros de antes de mezclar. De esos
  12, `main` sólo había tocado ése. Ningún literal del bot cambia.
- El trinquete de `scrum812` no chocó y pasa sin regenerar nada.
- El guard de este ticket sale verde sobre el árbol fusionado: lo que trajo `main` a `src/` no mete
  ninguna expresión sin declarar.

## El banco: el 22 de 22 de arriba había caducado, y se ha repetido

El «22 lanzadas, 22 caen» de «Cómo se comprobó» lo midió J2c el 1-oct-2026 sobre `40972fc0`, antes
de que SCRUM-1326 entrara en `main` y cambiara `decisionPorTexto.ts`. Sobre el árbol fusionado ese
dato no valía: era de otro árbol.

**Repetido el 2-oct-2026 sobre `140045f6`** (`node tests/banco-scrum1325/mutar.mjs`, entero, 163 s):
base verde (efecto 9 de 9, guard 10 de 10); **22 mutaciones de 22, las 22 caen donde se esperaba,
0 mudas, 0 ciegas**; al final build limpio y árbol limpio. En las 22 filas los casos que informan
suman 9 en el test de efecto y 10 en el del guard: ninguna fila perdió casos.

Lo que el banco NO mide, y sigue sin medirse aquí: no muta `decisionPorTexto.ts`. A ese fichero sólo
le llegan S9 y S10, que mutan el helper que usa. Las mutaciones propias de ese fichero son las del
banco de SCRUM-1322, que este tramo no ha lanzado sobre el árbol fusionado.

## Lo corrido en local antes de empujar, y lo que no

- El 2-oct-2026 sobre `140045f6`: build limpio; 13 ficheros de test a mano, de uno en uno y sin
  `--test-force-exit`: 107 casos, 107 pasan, 0 saltos. Por nombre, los 19 de este ticket (9 de
  efecto y 10 del guard). `guards:entrada`: 12 guards en verde. `scrum976` a solas: 11 de 11.
- **No corrido:** la tanda completa en local (va con turno, y no se pidió). La
  primera pasada entera sobre la mezcla es la del CI.
- **Sin verificación en `yaqu.app`**, igual que arriba.
