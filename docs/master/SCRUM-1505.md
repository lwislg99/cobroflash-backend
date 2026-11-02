# SCRUM-1505 · `ya-esta` y el commit que entrega varios tickets: medido, censado, y NO arreglado (el fichero es de S5)

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:33:38Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/scrum1505/control-de-cero.mjs`

Lo hace J4 (equipo de Javier, sesión `jv-j4`). Mide y propone. No toca `scripts/`, `tests/`, `src/` ni
`public/`: lo único que entra son este registro y tres guiones de evidencias que LLAMAN al instrumento
real sin copiarlo. El hook de arranque dijo «SIN IDENTIDAD» (no reconoce el nombre `jv-j4`; es
SCRUM-1498, carril de S5): se siguió por indicación de la ficha común del 8-oct, y queda dicho aquí.

## 0 · En corto

| lo que pedía el ticket | lo medido |
|---|---|
| título: el guion dijo «NO ESTÁ» de SCRUM-1471 | **No se reproduce.** Dice `YA ESTÁ` hoy y en el propio merge del PR #2220; `NO ESTÁ` sólo en el commit anterior al merge. Lo que sí es cierto es la línea de commits: «ninguno de main es suyo», con sus 3 entregas en «lo citan» |
| ③ cuántos tickets salen hoy «NO ESTÁ» siendo falso | **0** de 224 preguntados (todos los que salen en posición no primera de algún asunto). 8 salen `NO ESTÁ` y los 8 son citas de verdad, leídas una a una. **2 latentes** (SCRUM-377 y SCRUM-1471): los salva su registro |
| ① el arreglo | **NO HECHO.** `scripts/equipo/ya-esta.mjs` es de S5 (`dos-equipos.md` §3, fila `scripts/equipo/**`) y §3.4 no declara excepción. Va el criterio, probado sobre el instrumento real, en §3 |
| ② verlo caer y pasar con SCRUM-1471 | No se puede con el árbol real: ya dice `YA ESTÁ`. Se ve caer y pasar con el caso FABRICADO (el mismo ticket sin su registro), y el que de verdad no está sigue sin estar (§3) |
| ④ un control de cero que dé cero | `docs/master/evidencias/scrum1505/control-de-cero.mjs` (§4) |

## 1 · La premisa, corrida

    node scripts/equipo/ya-esta.mjs 1471                         → 🟢 YA ESTÁ · DESDE el 2026-10-06
    node scripts/equipo/ya-esta.mjs 1471 --ref 6b375fa8 …        → 🟢 YA ESTÁ   (el merge del PR #2220)
    node scripts/equipo/ya-esta.mjs 1471 --ref 6b375fa8^1 …      → ⚪ NO ESTÁ   (un commit antes: aún no había entrado)

El registro `docs/master/SCRUM-1471.md` entra en `main` en ese mismo merge (`git log --first-parent`
lo da en `6b375fa8b`), y `veredictoDe` cuenta el registro. Así que desde que el trabajo está en `main`
la primera línea nunca pudo decir «NO ESTÁ».

Lo que J2 escribió en su entrega (comentario 18834 de SCRUM-1471) es otra cosa, y es exacta: que el
guion dice «ningún commit de main es suyo». El «`⚪ NO ESTÁ`» del enunciado de SCRUM-1505 no está en
ese comentario. **No medido:** qué salida tuvo delante quien repartió, ni desde qué árbol; en el
checkout compartido el guion no existe (va 1.810 commits por detrás de `main`).

El defecto real, hoy, en la salida de SCRUM-1471:

    commits    · ninguno de main es suyo (ninguno lleva su número por delante en el asunto)
    🟠 lo citan · 3 commit(s) de OTRO ticket lo citan en su asunto — NO cuentan como trabajo suyo (suele ser el commit que lo ABRE):
                 53aa9edea … (es de SCRUM-1470) SCRUM-1470 · SCRUM-1471 · SCRUM-1472: la fecha impresa es…

Las dos frases son falsas para ese commit: es suyo, y no lo abre: lo entrega.

## 2 · Dónde está: en la capa, no en el motor

`censarTicket` (`tests/_censo-tickets.mjs`) devuelve los tres commits: acepta cualquier mención en el
asunto. Quien los aparta es `duenoDelAsunto` de `ya-esta.mjs` (SCRUM-1454), que se queda con el PRIMER
número, y lo dice su comentario: «Con dos tickets en el asunto, el segundo es una referencia». Fue una
decisión, tomada para arreglar el falso «YA ESTÁ» de SCRUM-1434, y avisa de su coste: «Se equivoca
hacia “falta trabajo”».

Dos sondas de acuerdo: los 224 tickets que mi lectura de los asuntos da en posición no primera tienen
TODOS algún commit en `commitsAjenos` del motor (`SIN_AJENOS=0`).

## 3 · El censo y el criterio propuesto

    node docs/master/evidencias/scrum1505/censo.mjs a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0

    POBLACION  commits=8719  con_numero=7927  con_mas_de_un_numero=352  tickets_en_posicion_no_primera=224
    CONTROL_CERO  max+1 de los asuntos  NO ESTÁ  propios=0  ajenos=0  OK
    RECUENTO  preguntados=224  clasificados=224  CAMBIA=0  LATENTE=2  CITA=217  PROPIO=5  CIEGO=0  SIN_AJENOS=0
    EXIT=0

- **CAMBIA = 0.** Ningún ticket sale hoy `NO ESTÁ` teniendo una entrega en la cabecera de un asunto.
- **Los 8 `NO ESTÁ` con algún commit ajeno** son SCRUM-27, 54, 269, 1013, 1115, 1158, 1203 y 1434. Sus
  asuntos están leídos uno a uno: los 8 son menciones («sin llamador desde», «absorbe», «para reutilizar
  en», «confirma», «la opción A de», «y el ticket abierto (…)»). El cajón «lo citan» acierta en los 8.
  SCRUM-54 es el que merece abrirse: `61600e16a` dice que SCRUM-55 lo ABSORBE, o sea, hecho bajo otro número.
- **LATENTE = 2:** SCRUM-377 (`79479b9af`, «SCRUM-380 + SCRUM-377: …») y SCRUM-1471. Dicen `YA ESTÁ`
  sólo por su registro; sin él dirían `NO ESTÁ`.
- **PROPIO = 5** (SCRUM-108, 402, 815, 834, 1472): tienen commits propios y además alguna entrega en
  cabecera que hoy se les cuenta como cita. La respuesta no cambia.
- **No leído:** los asuntos de los 217 de la clase CITA que ya dicen `YA ESTÁ` (209 de ellos). Si alguno
  entrega con una forma que `enCabecera` no reconoce, sale ahí; su respuesta es `YA ESTÁ` igualmente.

**El criterio** (`enCabecera`, en `censo.mjs`): son del commit los tickets que el asunto lleva EN
CABEZA como lista —`SCRUM-A · SCRUM-B: …`, con `·`, `,`, `+`, `&`, `/`, «y» o «e» entre ellos—, y la
lista se corta en lo primero que no sea un número o un conector. Lo que venga después es cita. Con un
solo número coincide con `duenoDelAsunto`.

    node docs/master/evidencias/scrum1505/prueba-del-criterio.mjs a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0

    ok  1471 real · hoy                                   visto=YA ESTÁ
    ok  1471 real · propios/ajenos hoy                    visto=0/3
    ok  1471 FABRICADO sin registro · hoy → ROJO          visto=NO ESTÁ
    ok  1471 FABRICADO sin registro · con la cabecera     visto=YA ESTÁ
    ok  1434 real · lo cita un commit de otro ticket      visto=con citas
    ok  1434 real · con la cabecera sigue sin estar       visto=NO ESTÁ
    ok  enCabecera sobre los dos asuntos                  visto=[[1470,1471,1472],[1123]]
    RECUENTO  casos=7  fallos=0

Y sobre los 224: la columna `respuesta_con_cabecera` es idéntica a `respuesta_hoy` (216 `YA ESTÁ`,
8 `NO ESTÁ`). El criterio no convierte nada en «ya está».

**Lo que le toca a S5, si lo acepta** (no aplicado; lo mide quien lo escriba):
1. en `ya-esta.mjs`, que `repartirCommits` dé por propio el commit cuya CABECERA contiene el ticket, y
   no sólo el que lo lleva primero; `duenoDelAsunto` se queda para decir de quién es el que lo cita;
2. la línea «ninguno de main es suyo (ninguno lleva su número por delante…)» pasa a hablar de la cabecera;
3. en `tests/scrum1424-ya-esta.test.mjs`, casos nuevos y no un test nuevo: el asunto de `53aa9edea`
   es de los TRES; el de `da3798df8` sigue sin ser de SCRUM-1434; un ticket sin registro cuyo único
   commit lo lleva segundo en la cabecera sale `YA ESTÁ`.

## 4 · El control de cero

`git log --all --grep` da UN commit para el número fijo que se repartía: `9e47c9f9a`, cuyo asunto es de
SCRUM-1397 y lo lleva en el CUERPO (`--grep` mira el mensaje entero). Además lo nombran 3 ficheros del
árbol. Es, de hecho, el mayor número que el repositorio contiene.

    node docs/master/evidencias/scrum1505/control-de-cero.mjs

    POBLACION  menciones: mensajes=16229 refs=1130 arbol=65025
    POSITIVO   el máximo que el repositorio nombra   mensajes=1 refs=0 ficheros=3   OK: las búsquedas ven
    CERO       el máximo más uno                     mensajes=0 refs=0 ficheros=0   OK: da cero

Da el mayor número de ticket que aparece en los mensajes de todas las refs, en sus nombres y en el
árbol, más uno. No puede estar (es mayor que todos) ni casar como subcadena de otro (el que lo
contuviera sería mayor que el máximo), y lo comprueba con las mismas búsquedas, que a su vez se
comprueban con el máximo. **El número no va escrito aquí a propósito:** en cuanto un número fijo se
escribe en una ficha, un registro o un commit, deja de dar cero; así cayó el anterior. En las fichas va
el comando. Si alguien lo escribe, la siguiente pasada da el siguiente.

**No cubre:** Jira (ahí un número mayor puede existir), ni los binarios (`git grep -I`).

## 5 · Lo que NO se ha hecho

- El arreglo del guion y sus casos de test (S5).
- La tanda completa. Sólo los candados de registro y de árbol, sobre este PR.
- Leer el check obligatorio de la punta de `main`.

---

## 6 · 1505b · El arreglo, en la capa (S5, 2-nov-2026)

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T20:45:33Z (hora de GitHub)
A9: comprobación → `tests/scrum1424-ya-esta.test.mjs`

Lo hace S5 (sesión fresca, encargo del orquestador: «superficie de conflicto cero»). Sólo toca
`scripts/equipo/ya-esta.mjs`, `tests/scrum1424-ya-esta.test.mjs` y este registro. Los tres guiones de J4
**no se tocan**: son su evidencia, anclada a `a65a8c756`.

**Primero, el motor.** El ticket avisa de que el defecto podía estar en el motor y no en la capa. No lo
está: `censarTicket` devuelve `79479b9af` para 377 (la salida en vivo lo enseña en «lo citan», y ese
cajón sólo se llena con `censo.commits`). Quien lo aparta es `repartirCommits`, que sólo miraba
`duenoDelAsunto`. Así que el arreglo va en la capa.

**El arreglo.** `ticketsDelAsunto(asunto)` (nueva, exportada) da TODOS los tickets de la cabecera del asunto
con la expresión de `enCabecera` de J4. Sin cabecera (un merge, `feat(x): … (SCRUM-N)`) se queda en
`[duenoDelAsunto]`, como antes. `repartirCommits` da por propio el commit cuya cabecera contiene el ticket;
cuando lo cita, el dueño que se enseña sigue siendo `duenoDelAsunto`. La línea «ninguno de main es
suyo» pasa de «ninguno lleva su número por delante en el asunto» a «ninguno lo lleva en la cabecera de su asunto».

### Los controles, rojo primero

| control | sin el arreglo | con el arreglo |
|---|---|---|
| `tests/scrum1424-ya-esta.test.mjs` | 16 tests · **4 fallan** (3 por el defecto; el 4.º, el positivo, sólo por el texto nuevo de la línea: su veredicto NO ESTÁ ya era bueno) | **16/16** |
| sonda viva sobre `70eefc40c`, 10 casos (377 real y **sin registro**, 1434 **sin lo suyo**, las tres entregas de 1471 del 6-oct) | **7 FALLA** | **0 FALLA** |
| · 377 sin registro | `NO ESTÁ` | **`YA ESTÁ`**, y no salen «ninguno de main es suyo» ni «lo citan» |
| · 🔴 el POSITIVO: 1434 sin sus commits ni su registro | `NO ESTÁ` | **`NO ESTÁ`**; `da3798df8` sigue en «lo citan» (es de SCRUM-1123) |
| tests vecinos (`scrum723`, `scrum1463b/c` de `cierre-sin-clic`, que llama a `mirar`; `scrum824*`) | — | 8/8 · 17/17 · 16/16 (`SIN PROBAR no crece` ✔) |

La sonda falla en el código sin el arreglo, así que caza. Se corrió sobre el árbol de `wt-s5-2nov-1621`, que
sólo cambia docs sobre `70eefc40c` (`git diff --stat` en `scripts tests` = vacío).

### La población entera, antes y después

El censo de J4 (`censo.mjs`, sin tocar), corrido dos veces sobre el mismo `70eefc40c`: primero con
`ya-esta.mjs` de `main` y luego con el arreglo.

    POBLACION  commits=11282  con_numero=10419  con_mas_de_un_numero=454  tickets_en_posicion_no_primera=268
    CONTROL_CERO  max+1 de los asuntos  NO ESTÁ  propios=0  ajenos=0  OK          (en las dos pasadas)
    antes    RECUENTO  preguntados=268  clasificados=268  CAMBIA=0  LATENTE=1  CITA=260  PROPIO=7  CIEGO=0  SIN_AJENOS=0
    después  RECUENTO  preguntados=268  clasificados=268  CAMBIA=0  LATENTE=0  CITA=262  PROPIO=0  CIEGO=0  SIN_AJENOS=6

- **Ninguna respuesta cambia:** 259 `YA ESTÁ` y 9 `NO ESTÁ` antes y después, ticket a ticket. Los 9 son
  los mismos (27, 54, 269, 1013, 1044, 1203, 1264, 1535, 1604) y siguen siendo citas. **El arreglo no
  convierte nada en «ya está»**: éste es el positivo sobre la población entera.
- **LATENTE 1 → 0:** el único que quedaba era 377, y pasa a SIN_AJENOS (su único ajeno era `79479b9af`).
  1471 ya no es latente desde el 23-oct (tiene commits propios).
- **PROPIO 7 → 0:** a esos siete sus entregas en cabecera ya se les cuentan como suyas. Cinco se quedan
  sin ningún ajeno (SIN_AJENOS = 5 + 377 = 6) y dos, que además tienen citas de verdad, pasan a CITA (260 → 262).
- Lo que el arreglo cambia es el INFORME, no el veredicto: las dos líneas falsas («ninguno de main es suyo»
  y «lo citan … suele ser el commit que lo ABRE») dejan de salir cuando el commit entrega el ticket.

### 🔴 Los controles de J4 están VIEJOS: 3 FALLA de 7, con y sin el arreglo

    node docs/master/evidencias/scrum1505/prueba-del-criterio.mjs 70eefc40cba2eb9636992b733223bf1555c1755f

| caso | esperado (7-oct) | visto hoy, sin arreglo | visto hoy, con arreglo |
|---|---|---|---|
| 1471 real · propios/ajenos | 0/3 | 3/4 | 6/1 |
| 1471 FABRICADO sin registro → rojo | NO ESTÁ | YA ESTÁ | YA ESTÁ |
| 1434 real · con la cabecera sigue sin estar | NO ESTÁ | YA ESTÁ | YA ESTÁ |

No es el arreglo: el 18-oct entraron commits propios de 1434 y el 23-oct los de 1471b, y desde entonces
los dos tickets ya no sirven de caso «sin nada suyo». **Un control con un caso real CADUCA cuando el
caso deja de serlo.** Por eso los controles nuevos FABRICAN la ausencia (quitan el registro y los
commits propios de lo que da `mirar`), en vez de esperar que el árbol la conserve. Los guiones de J4
siguen valiendo anclados a `a65a8c756`, que es lo que su registro dice. El `6/1` de 1471: el ajeno que
queda es `98cfd08cc Merge origin/main (SCRUM-1470c) en scrum-1471b`, un merge de main en la rama; su
asunto empieza por «Merge», así que no tiene cabecera y cuenta el primero (1470). No es una entrega, y ahí se queda.

### Lo que NO se ha hecho

- La tanda completa: el obligatorio cae hoy en todo PR por `scrum113` (SCRUM-1644, con el fundador).
- El guion de J4 no se ha re-anclado ni re-escrito: es evidencia suya.
