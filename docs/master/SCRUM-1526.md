# SCRUM-1526 · En un árbol de trabajo sólo pasa el destino DECLARADO como no-producción

**Medido contra:** `origin/main` = `6ca2fb6516b2ae72b1a2dad065840feb9a9cc495` · 2026-10-13T05:25:09Z

A9: comprobación → `tests/scrum1526-produccion-no-se-reconoce-por-nombre.test.mjs`

Carril J3 (censos, CI, instrumentos de medida). Toca `scripts/_clave-vs-destino.mjs`,
`scripts/comprobar-claves-bd.mjs` (una frase del verde) y un test nuevo. **Ninguna URL real, ningún
fichero de entorno, ninguna base:** todo con URLs fabricadas.

## El defecto, visto antes de tocar nada

`comprobarCredencialDeProduccion` reconocía producción comparando el host con un nombre escrito a mano.
Con cualquier otro host contestaba `cuadra`. La sonda de tres preguntas, contra el código sin arreglar
(commit `3d9adc593e1fc67b62a375f99b75c9740bf65f40`, 11 casos, 7 caen):

| pregunta | antes | ahora |
|---|---|---|
| un host fabricado que nadie ha declarado | `cuadra` | `destino_no_reconocido` |
| staging (`acela…/railway`) | `cuadra` | `cuadra` |
| el host de producción de hoy | `produccion_en_arbol` | `produccion_en_arbol` |

## El arreglo

La pregunta se da la vuelta: pasa lo que está en `DESTINOS_QUE_NO_SON_PRODUCCION` (host Y base), y nada
más. Hoy son dos destinos: `acela.proxy.rlwy.net/railway` y `acela.proxy.rlwy.net/yaqu_dev_javier`.
Salen de `CLAVES_QUE_NO_SON_PRODUCCION`, escrita a mano: derivarla como «todas menos `DATABASE_URL`»
aprobaría sola cualquier clave que alguien añada a la tabla.

Lo no declarado tiene veredicto propio, `destino_no_reconocido`, y NO `produccion_en_arbol`. Motivo
medido: el barrido de todos los árboles (`scripts/claves-bd-de-todos-los-arboles.mjs`, de la S0, sin
tocar) escribe una frase fechada «N cadenas APUNTAN A PRODUCCIÓN» con ese veredicto, y de un host que
nadie conoce no se sabe eso. Con el veredicto propio cae en su rama «no se pudo decidir»: sale 2 y no
escribe la frase. `comprobar-claves-bd.mjs` cuenta como fallo todo lo que no sea `cuadra`: sale 1.

Regla 41: no se quita ninguna exigencia. Todo lo que antes gritaba sigue gritando con el mismo
veredicto; lo único que cambia de lado es lo que antes salía `cuadra` sin que nadie lo hubiera declarado.

## Mutaciones (con el árbol comiteado en `914e3bd02951872bfb31fbf22a9b5be0072d5344`)

| mutación (numstat `1 1`) | resultado |
|---|---|
| `if (!declarado)` → `if (false)` | 6 de los 11 casos de este ticket caen; los 18 de `scrum418` y `scrum1423` siguen verdes: no lo veían |
| comparar sólo el host, sin la base | cae 1, el de los parecidos |

Restaurado con `git restore --source=HEAD`; `git status --porcelain` vacío las dos veces.

## Aceptación → dónde se ve

| aceptación (literal del ticket) | dónde se ve |
|---|---|
| Verlo en rojo primero, con la sonda de las tres preguntas | commit `3d9adc59…` de esta rama; tabla de arriba |
| Un positivo SEMBRADO, no tomado del árbol | `tests/scrum1526-produccion-no-se-reconoce-por-nombre.test.mjs`, `hostSembrado` y «quitando el sembrado la sonda dice CIEGO, no verde» |
| Comprobar que un host desconocido grita | mismo fichero: «un destino no declarado tiene veredicto PROPIO» y «parecerse a un destino declarado no es serlo» |
| Que `comprobarClaveVsDestino` siga siendo una cosa distinta | mismo fichero: «discrepan en los dos sentidos» (5 casos, 2 discrepancias exigidas) |
| Pendiente operativo: tras mover producción, leer su host nuevo y comprobar que SALTA | NO HECHO → orquestador de Javier, en este ticket. Ya no hay ventana abierta (un host nuevo sale `destino_no_reconocido`), pero para que se NOMBRE como producción hay que actualizar `DESTINOS_ESPERADOS.DATABASE_URL.host` |

## Lo que NO se ha medido

- **Ningún `.env` real.** No se sabe si algún árbol tiene hoy una cadena a un destino no declarado (una
  base local, `postgres-scratch`). Si la tiene, `comprobar-claves-bd.mjs` pasa a salir 1 en ese árbol y
  el barrido de todos, 2. Es el efecto buscado, y la salida dice qué clave. Se mide con
  `node scripts/claves-bd-de-todos-los-arboles.mjs`, que no imprime ningún valor.
- **La suite completa no se ha corrido** (no hay turno ni `dist/` en este árbol). Corridos: los 6
  ficheros que importan el módulo o a sus dos consumidores (60 casos, 0 fallos) y `scrum237`, `scrum812`
  y `scrum976` (24, 0 fallos).
- **Los otros sitios que nombran el host de producción** (`scripts/_db-guard.mjs`, `db-push-prod`,
  `seed-staging.mjs`, `marcar-staging.mjs`, `_destino-de-semilla.mjs`, `tests/_staging-db.mjs`) no se
  han leído: no se sabe si alguno decide por ese nombre del mismo modo.
- Si el host público cambia al mover de región: no medido, y este arreglo no depende de ello.
