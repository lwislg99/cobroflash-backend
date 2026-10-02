# SCRUM-1372 · Auditoría de cierres: la CRIBA mecánica

**Medido contra:** `origin/main` = `8995084a0b7be02ec89c0aaa1d7eb3958ec89283` · 2026-10-01T13:31:05Z

A9: comprobación → `tests/scrum1372-auditoria-cierres.test.mjs`

Carril S0 (`scripts/`, `tests/`, `docs/`). Es la mitad 1 del diseño de `docs/master/SCRUM-1348.md`. La
mitad 2, la lectura, NO se lanza con este ticket.

## Qué es mecánico y qué necesita que alguien lea

| pieza | ¿mecánica? | quién |
|---|---|---|
| Saber si un cierre tiene rastro, trabajo fuera de `main`, citas rotas, tabla de entrega | sí | `scripts/auditoria-cierres.mjs`, 3 s |
| Saber si el cierre dice de sí mismo que no se miró | a medias: es una búsqueda por palabras | el script; marca candidatos |
| Decidir qué es «la sección de aceptación» de un ticket | **no** | quien baja los cierres de Jira (una sesión: el script no tiene credenciales) |
| Elegir a quién se lee | sí, con semilla = fecha | el script |
| Preparar lo que recibe quien lee (aceptación literal + commits, SIN el comentario de entrega) | sí | el script, `--paquetes` |
| **Juzgar si lo construido cumple la frase de la aceptación** | **no** | alguien que lee y mira yaqu.app |
| Distinguir un cierre vacío de un cierre por duplicado o por descarte | **no, hoy** | la lectura (Jira los deja con el mismo estado) |

## Lo que entra

| fichero | qué es |
|---|---|
| `scripts/auditoria-cierres.mjs` | la criba, la muestra y los paquetes de lectura |
| `tests/scrum1372-auditoria-cierres.test.mjs` | 19 casos |
| `docs/equipo/auditoria-de-cierres.md` | EL documento de la auditoría, con la primera pasada |

### El fichero de entrada

    { "ventana": { "desde": "AAAA-MM-DD" }, "jql": "…", "bajado": "<ISO>", "total": <lo que dijo Jira>,
      "cierres": [ { "clave", "resuelto", "etiquetas": [], "resumen", "aceptacion": ["línea literal", …],
                     "comentarios": <n>, "ultimoComentario": "<literal>", "ultimoComentarioCuando",
                     "tablaA8": "<la tabla «aceptación → dónde se ve», literal, o null>" } ] }

`aceptacion` es `[]` si la descripción no tiene una sección ROTULADA de aceptación. No se deduce del resto.

### Las señales

| señal | qué mira | cambio respecto al diseño |
|---|---|---|
| C1 | ni registro `docs/master/SCRUM-n*.md` ni commit en `main` que lo nombre | — |
| C2 | rama `scrum-n-…` fuera de `main` cuyo contenido CAMBIARÍA `main` (`git merge-tree`) | por contenido, no por ancestría; una rama que no cambia nada sale como «por borrar» |
| C3 | sin desplegar | **no construida.** Cada pasada lo dice |
| C4 | el registro cita un `tests/…test.mjs` que no existe en `main` | solo ficheros de test |
| C5 | el ÚLTIMO comentario niega haberlo visto o verificado | formas nuevas (abajo) |
| C6 | sin aceptación | no acusa: se cuenta aparte y no entra en el azar |
| A8 | la tabla «aceptación → dónde se ve»: existe (equipo de Luis, desde `2026-10-01T12:27:10Z`), tantas filas como líneas, cada ruta existe, ninguna fila `NO HECHO` | nueva |

### Sale 2, sin dar cifra

Fichero ilegible, vacío, de otra ventana, con menos cierres de los que dijo Jira, con claves repetidas,
con cierres de antes de la ventana, sin fecha de bajada o bajado hace más de 24 h · algún cierre que no se
pudo cribar · `origin/main` que no se deja leer · el canario que no salta · una pasada sin canario · C5
marcando más de un tercio.

El **canario** es un cierre fabricado (`SCRUM-0`) que se sabe malo por tres motivos: pasa por la misma
criba en cada pasada y tiene que salir con C1, C5 y C6. Prueba la criba. El canario del LECTOR tiene que
ser un cierre real y es de la mitad 2.

## La aceptación del ticket → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| Con los cierres de 3 días: imprime su población y no marca más de un tercio por C5. | `docs/equipo/auditoria-de-cierres.md` (61 cierres, C5 marca 6) · `tests/scrum1372-auditoria-cierres.test.mjs` («declara su POBLACIÓN» y «el techo») |
| Con el canario quitado: sale 2. | `tests/scrum1372-auditoria-cierres.test.mjs` («el canario») |
| Con un fichero vacío, o de otra ventana: sale 2. | `tests/scrum1372-auditoria-cierres.test.mjs` («fichero vacío, de otra ventana…» y «el comando de verdad») |
| La misma fecha da la misma muestra (semilla reproducible). | `tests/scrum1372-auditoria-cierres.test.mjs` («la misma fecha da la MISMA muestra») |
| Queda escrito qué parte es mecánica y qué parte necesita que alguien lea. | `docs/master/SCRUM-1372.md` (la primera tabla) · `docs/equipo/auditoria-de-cierres.md` |

## Medido: la primera pasada (61 cierres, 29-sep → 1-oct)

| | |
|---|---|
| cribados | 61 de 61, en 3 s |
| marcados | 9: C1 2 · C2 1 · C4 0 · C5 6 (5 de ellos con el motivo dicho) · A8 2 |
| sin aceptación | 31 de 61. Por fecha de apertura: **0 después de la norma**, 11 el 1-oct antes de ella, 9 el 29-sep, 8 el 28-sep, 3 anteriores. Es línea base. No comparable con el «23 de 47» del piloto: otra población y otro lector |
| las tres marcas «seguras» (C1, C2) | las tres tienen explicación ya conocida: un duplicado (1131), un descarte (1361) y una rama zombi de tres líneas (1196) |
| bajar los 61 de Jira | un agente, 2 min, ~100.000 tokens. Es lo caro de la criba |

**Para decidir la lectura** (que es lo que pidió el orquestador antes de gastar agentes): con el tope de 6
se leen 3 de los 6 que dicen que no se vio y 3 al azar de 9 puestos. Leerlo todo son **15 lecturas**: los
6 de C5 y uno al azar por cada uno de los 9 puestos. Los 3 «seguros» no hace falta leerlos: ya se sabe
qué son.

## Lo que la medición cambió del diseño

1. **C5 con las tres formas del diseño marcaba 0 de 61.** El piloto decía que los seis casos reales «tienen
   esa forma». Hoy ninguno la tiene: dicen «no se ha visto», «NO visto», «no se verificó», «NO VERIFICABLE»,
   «no se ha podido ver». La primera versión gritaba (28 de 41); la segunda callaba. La tercera es una
   negación pegada a ver/verificar, y marca 6 de 61. Una pasada con C5 a cero lo DICE: cero puede ser «lo
   dijeron de otra forma».
1bis. **Un «no se vio» con su motivo no es lo mismo que uno que calla.** Cinco de los seis lo dicen junto a
   la frase, y casi siempre es el hueco del entorno de pruebas (SCRUM-1367). La criba mira si en los 220
   caracteres que siguen hay un motivo (un «porque», el fixture, la cuenta QA, un ticket) y lo dice en la
   fila: «límite DECLARADO, no un cierre malo». En la muestra va primero el que no da motivo. Es otra
   búsqueda por palabras: separa, no absuelve.
2. **«Uno por puesto» y «tope 6» no caben juntos.** Con nueve puestos cerrando, el azar llega a tres. El
   script reserva la mitad del tope al azar y dice qué puestos se quedan sin lectura.
3. **C1 no distingue un cierre vacío de uno por duplicado o por descarte.** Dos de dos C1 de hoy son eso.
   Si los cierres sin trabajo llevaran una etiqueta (`descartado`, `duplicado`), la criba los apartaría sin
   gastar una lectura. Es una propuesta para el orquestador, no está hecha.
4. **La norma de la tabla tiene dos horas de vida:** solo 3 de los 61 la traen, y 2 de los que debían
   traerla no la traen (1355, 1361).

## Lo que NO hace

- **No lee.** No dice si un cierre cumple. La cifra del equipo sale de la lectura al azar y hoy no existe.
- **No mira el despliegue** (C3).
- **No baja nada de Jira.** Y quien lo baja decide qué es la aceptación: 31 «sin aceptación» es lo que
  encontró un agente con la instrucción de no deducirla. No lo he releído ticket a ticket.
- **No audita a la S0.** 1361 es mío y sale marcado; que salga es la criba funcionando, no una garantía.
- **El fichero de cierres no va al repositorio** (es público y lleva texto de tickets). Va el resultado.

## Probado en rojo

Nueve mutaciones a mano sobre el script, una por pieza; las nueve tumban el test: C2 por ancestría · el
canario sin comprobar · la semilla sin entrar · el paquete con el comentario de entrega · un no-cribado que
no tumba la pasada · sin techo de C5 · C5 con las tres formas viejas · un fichero a medio bajar · A8 sin
mirar `NO HECHO`.

## Mis errores

1. **Construí C5 con las tres formas del diseño sin medirlas contra los cierres de hoy**, y la primera
   pasada dio «C5 0». Lo vi porque el piloto decía seis y cero no cuadraba; si el piloto hubiera dicho
   cero, lo habría dado por bueno. → comprobación: el caso «C5 ni grita ni calla» lleva las seis frases
   reales, y la pasada avisa cuando C5 marca cero.
2. **El primer comando reventaba antes de validar**: llamaba a la criba del canario con un repositorio
   vacío. Lo vi leyendo, antes de correrlo. → comprobación: «el comando de verdad», que lo lanza como
   proceso en cinco casos.

---

# Anexo · 2-oct-2026 · gana el tope, la etiqueta de cierre sin trabajo y la segunda medida

**Medido contra:** `origin/main` = `5d7aaebc41d71d24102a4852c1de04059d9ac559` · 2026-10-02T11:22:35Z

A9: comprobación → `tests/scrum1372-auditoria-cierres.test.mjs`

Rama `scrum-1372b-gana-el-tope-y-etiqueta-sin-trabajo` (la primera ya entró por #2109). Lo de arriba se
queda como se escribió; donde este anexo lo contradice, manda el anexo. Los casos del test son 21, no 19.

## Lo decidido por el orquestador, y lo que cambia

| decisión | qué hace ahora el script | dónde se ve |
|---|---|---|
| Se leen **cuatro** (1229 + 3 al azar), no seis ni quince | Los C5 con el motivo dicho NO se leen. Al azar van `RESERVA_AZAR` (3), sin rellenar el tope | test «GANA EL TOPE» (el caso del 1-oct: 1 que calla + 5 con límite = 4 lecturas) |
| **Gana el tope**, y la pasada dice a quién no leyó | Bloque «A QUIÉN NO SE LEE, y se dice», con cuatro filas que salen siempre, también vacías | el mismo test; `docs/equipo/auditoria-de-cierres.md` |
| Etiqueta `descartado` / `duplicado` | Con ella no hay C1 ni A8 ni azar. C2 se sigue mirando | test «la etiqueta `descartado` o `duplicado`» |

La misma pasada de ayer (61 cierres, semilla 2026-10-01) con el script nuevo: **4 lecturas** — 1229, y al
azar 1272 (S2), 1291 (sin área), 1305 (J6). **Sin lectura: J1, J2, J3, J4, S1, S5.**

## El defecto de diseño: el tope y «uno por puesto» eran incompatibles

Estaba dicho arriba (punto 2) y estaba mal resuelto: el script avisaba de los puestos sin lectura al final
de una línea larga, detrás de un `⚠️`. Una muestra que no dice a quién no miró parece cubrir a todos. Ahora
los no leídos tienen bloque propio, y el test exige que leídos y no leídos sumen TODOS los puestos.

## La historia de C5, entera y en orden

| versión | marcaba | qué pasaba |
|---|---|---|
| primera | **28 de 41** | gritaba: casaba con cualquier «pendiente» o «sin» cerca de «verificar» |
| segunda | **0 de 61** | callaba: las tres formas exactas del piloto, y ese día nadie escribió ninguna |
| tercera | **6 de 61** | una negación pegada a ver/verificar |

La causa de las dos primeras es la misma: **el criterio estaba calibrado sobre las PALABRAS del piloto**,
no sobre lo que querían decir. Un criterio que casa por la forma de la frase casa con una convención que
nadie acordó. Va a A10 con este PR.

## Segunda medida: los tickets nacidos con la norma A13.1

Ayer: 31 de 61 cierres sin aceptación, y **0 abiertos después de la norma**. Hoy, por JQL
(`created >= "2026-10-01 14:27"`, hora de Madrid = `2026-10-01T12:27Z`):

| | |
|---|---|
| tickets abiertos desde que la norma vive | 48 |
| de ellos, cerrados | 7: 1363, 1386, 1388, 1397, 1398, 1400, 1407 |
| con una sección ROTULADA «Aceptación» | **2 de 7** (1363, 1398) |
| con el criterio de cierre escrito bajo otro rótulo («Los controles», «Lo que pide», «Lo decidido») | 5 de 7 (1386, 1388, 1397, 1400, 1407) |
| sin nada contra lo que cerrar | 0 de 7 |
| del equipo de Luis | 1 de 7 (1363). Los otros 6 son del equipo de Javier |

Lo que se puede decir: la norma ya tiene tickets sobre los que aplicarse, y ninguno de los 7 nació sin
criterio de cierre. Lo que NO se puede decir: que «2 de 7» sea incumplimiento. La criba cuenta por el
rótulo, y cinco tickets traen la aceptación con otro nombre: **C6 tiene hoy el mismo defecto que tuvo C5**,
casa por la forma. Con la regla de ayer («no se deduce del resto») esos cinco saldrían «sin aceptación».
No lo he corregido en el script: qué rótulos valen como aceptación es una convención que tienen que
acordar los dos orquestadores, no una lista que yo saque de siete tickets.

**Lo que NO se ha medido hoy:** la pasada completa. Jira dice 77 cierres en la ventana desde el 29-sep
(ayer 61). No los he bajado: son unos 100.000 tokens y la comparación pedida era la de la norma. Los 7 de
arriba los leí yo en la descripción; no he leído sus comentarios ni su tabla A8.

## Probado en rojo (hoy)

Cuatro mutaciones sobre el script, y las cuatro tumban el test: el azar rellena el tope (2 fallos) · la
etiqueta no aparta (1) · se leen los de límite declarado (2) · no se dice a quién no se leyó (2).

## Mis errores (hoy)

3. **El cambio que heredé a medias dejaba fuera de la lectura a 1229**, el único cierre que la decisión
   mandaba leer: metía a los tres C1/C2 en el tope y le quitaban el sitio. Sus tests estaban en rojo y no
   lo decían, porque seguían escritos para el diseño de antes. Lo vi al correr la pasada de ayer y
   comparar con la decisión, no al leer el diff. → comprobación: el caso del 1-oct dentro del test.
4. **Fijé la expresión del ancla mirando una sola muestra**, y me salvó el suelo de población de mi propio
   guard. Es el mismo error que C5: calibrar sobre una muestra.

## Añadido el 2-oct tras la respuesta del orquestador (rama `scrum-1372c-a10-y-notas-de-registro`)

- **La forma de fallar de este instrumento, no dos anécdotas.** C5 el 1-oct y C6 el 2-oct: dos criterios
  distintos de la misma criba, dos días seguidos, el mismo error — casar por la FORMA (unas palabras, un
  rótulo). Todo criterio nuevo de la criba que busque texto se mide contra cierres que no se usaron para
  escribirlo antes de darle una cifra.
- **Convención aprobada por el orquestador de Luis y subida al fundador para el equipo de Javier:**
  etiquetas `descartado` y `duplicado`, que pone quien cierra, al cerrar; y la sección de aceptación lleva
  la palabra «Aceptación» en su título. NO hay etiqueta para «límite declarado»: pediría a quien cierra
  clasificar su propio «no lo vi».
- **La pasada completa NO se corre hasta que la convención del rótulo esté decidida** (orden del
  orquestador): con C6 casando por el rótulo marcaría «sin aceptación» a cinco cierres que la tienen.
- SCRUM-1131 lleva `duplicado` y SCRUM-1361 lleva `descartado` desde hoy. #2137 entró en `main` con el
  obligatorio en verde; verde no es «todo corrió»: no comprobé mis casos por nombre en el TAP del CI.