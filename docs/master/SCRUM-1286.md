# SCRUM-1286 · El CI etiqueta solo el intermitente de SCRUM-1281

**Medido contra:** `origin/main` = `e75b94ca8755bd5d27981940c5ff4c01b2df8695` · 2026-09-29T16:36:28Z

Encargo del orquestador (`cobroflash-backend-57`), 29-sep-2026. Es la parte CI de SCRUM-1281: la
fixture es de S3 (rama `scrum-1281-fixture-git-raiz-propia`), la detección es de S5. Los ficheros no
se cruzan: S3 no toca `.github/`, S5 no toca `tests/_censo-fixture.mjs`.

## El problema

El único check obligatorio, `build + tests`, cae a veces porque git pierde un fichero bajo
`.git/objects` mientras monta o clona la fixture de censos. No lo causa el código del PR. El equipo
de Javier decidió que un relanzamiento manual exige leer el log antes. Aquí lo lee la máquina y deja
el veredicto escrito: «¿era el intermitente?» pasa de juicio a dato.

## Qué entra

- `scripts/equipo/intermitente-1281.mjs`: clasifica el log del job `build + tests`.
  - **INTERMITENTE** solo si el único paso caído es el de la tanda **y** todos los fallos traen la
    firma: el marcador `[SCRUM-1281-FIRMA]` que emite la fixture de S3, o el texto crudo de git de
    los cuatro casos, para los logs anteriores al marcador.
  - **NO-ES-EL-INTERMITENTE** si hay un solo fallo sin la firma o ha caído otro paso.
  - **CIEGO** si no hay log, no hay pasos o no encuentra «✖ failing tests:». En ese caso no se toca
    ninguna etiqueta.
  - Cuando un fichero cae a nivel de proceso, la sección de fallos solo dice «'test failed'»; el
    error está encima, como stderr. Se toma ese bloque y solo cuenta si su pila nombra ESE fichero.
- `avisador-rojo.yml`, que ya corre en cada CI en failure, gana el paso «¿Es el intermitente de
  SCRUM-1281?», **antes** del aviso a la sesión y con `continue-on-error`. En cada PR abierto de ese
  commit pone o quita la etiqueta `intermitente-1281` y deja **un** comentario por commit, sin
  `@claude`: informa, no despierta a nadie. Va con `github.token`, cuyos comentarios no disparan
  workflows. No añade job ni runner: son segundos dentro del job del avisador, que ya corría.
- Permiso nuevo: `actions: read`, solo lectura, para leer el job y su log.

## Medido

| población | INTERMITENTE | NO-ES | CIEGO |
|---|---|---|---|
| los 4 casos de SCRUM-1281 | 3 (388, 753, 775 del 28-sep) | 1 (el mixto del 25-sep: 775 + 804b real) | 0 |
| los 123 jobs `build + tests` en failure del 22–29 sep | 2 (los conocidos que siguen en la población) | 121 | 0 |

Cero falsos positivos. El 753 no está en la población de 123 porque se relanzó y su intento verde
tapó el rojo. Esa es exactamente la tirada de dados que describe SCRUM-1281.

Test: `tests/scrum1286-intermitente-1281.test.mjs`, 12 casos con fragmentos de los logs reales. Las
5 mutaciones de `MUTACIONES_QUE_ME_TUMBAN` se comprobaron en ROJO antes del commit (1 fail cada una).
Los 10 ficheros de test que leen el avisador: 169/169 en verde.

## Hallazgo de paso: «Por qué cayó» no ve nada

El paso «Por qué cayó (del TAP, sólo si la tanda falla)» del job obligatorio busca `^not ok` en el
TAP de la tanda. En el rojo del 29-sep (run 36558271547) ese TAP tiene **2.979 líneas para 9.064
tests** y ninguna `not ok`: `npm test` no manda al TAP el detalle de cada fichero. El paso imprime su
cabecera y nada más. Es un «no pude mirar» que se lee como «no hay nada». **No se arregla aquí**, porque
vive en el job obligatorio y eso lo decide el orquestador. El log `spec` sí trae los fallos, y de ahí
lee este clasificador.

## Lo que NO hace

- No relanza nada. Etiqueta y comenta; relanzar sigue siendo una decisión de alguien.
- No silencia el aviso a la sesión. Si se quiere que un rojo INTERMITENTE no despierte a nadie, es un
  cambio de comportamiento del avisador y lo decide el orquestador.
