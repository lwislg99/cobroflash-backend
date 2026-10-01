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
| marcados | 9: C1 2 · C2 1 · C4 0 · C5 6 · A8 2 |
| sin aceptación | 31 de 61 (el piloto del 1-oct por la mañana: 23 de 47) |
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
