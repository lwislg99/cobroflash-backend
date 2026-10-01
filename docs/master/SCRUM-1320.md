# SCRUM-1320 · Un guard que encuentra defectos y además se queda ciego salía rotulado «no medido»

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:45:23Z
A9: comprobación → `tests/scrum1320-hallazgo-y-ciego-no-son-excluyentes.test.mjs`
**Rama:** `scrum-1320-hallazgo-manda-sobre-ciego`. **Sesión:** J1b (relevo de J1).

⚠️ **La rama nace de la punta de SCRUM-1313 (`b397e075e9132be137b56f80f36b129a0bab2c33`), no de
`main`.** La prueba de partida es un guard del documento suelto, y sin los arneses de SCRUM-1313 ese
guard está ciego entero: no habría caso que reproducir. No se empuja hasta que SCRUM-1313 esté en `main`.

## En corto

- El defecto se **reprodujo antes de tocar nada**: mismo editor roto, `guard-915g` imprime 5 hallazgos
  y 1 ciego y sale con **2**. Con el arreglo, la misma pasada sale con **1** y dice las dos cuentas.
- **No era un guard: eran 21 de 40.** Y no se arregla invirtiendo el orden: el veredicto sale de una
  función que recibe las DOS cuentas (`scripts/_hallazgos-y-ciegos.mjs`).
- Un guard con 0 hallazgos y ciegos **sigue saliendo por ciego** (medido de verdad, no sólo en el test).
- Quedan **3 guards con otra forma del mismo defecto** y **3 con el orden pero un solo código**. No se
  han tocado: están contados abajo y declarados en el test.

## ① El censo

Población: los **40** ficheros `scripts/guard-*.mjs` (37 de ellos son los que corre la puerta
`scripts/guards-visuales.mjs`; a los otros 3 no los corre ella, y ninguno de los 3 tiene el defecto). Medido dos veces y por dos vías
distintas —leyendo la cola de los 40, y por AST con `tests/_salidas-de-guard.mjs` sobre el árbol de
antes (`git show b397e075:…`) y el de ahora—, y las dos dan lo mismo.

| clase | cuántos | qué hacen |
|---|---|---|
| **el defecto del ticket** | **21** | acumulan hallazgos y ciegos, y al final miran `ciegos` primero y salen con el 2 |
| otra forma, sin arreglar | 3 | ABORTAN en el primer ciego y tiran lo acumulado (`caja-datos-del-cliente`, `caja-documento-suelto`, `portal-en-la-ficha`) |
| el orden, con un solo código | 3 | miran `ciegos` primero y salen con 1 las dos veces (`aviso-bizum`, `vias-de-cobro`, `firma-con-tramos`) |
| ya lo hacía bien | 1 | `completar-lleva-al-campo`: hallazgo primero y el ciego impreso siempre, desde SCRUM-904 |
| junta las dos cuentas en una | 1 | `marcadores-en-pantalla`: el ciego suma como fallo, se dice, y sale con 1 |
| no distinguen dos estados | 11 | sólo salen por hallazgo, o su ciego es del instrumento entero antes de juzgar nada |

Los 21: `915e1-documento-vivo`, `915g-ajustes-del-justificante`, `915h-conceptos-limpios`,
`915i-cabecera`, `965-un-solo-presupuesto`, `albaranes-con-acciones`, `arranque-sin-red`,
`caja-avisos`, `cls-barra-anuncio`, `descuento-redibuja`, `descuentos-en-el-detalle`,
`detalle-trabajo-917`, `escalera-por-estado`, `falta-en-otra-pestana`, `foto-del-gasto`,
`lista-gastos`, `lista-trabajos`, `lista-trabajos-917`, `nif-del-gasto`, `pasos-del-editor`,
`rotulos-de-la-linea`.

De los 21, **10 ni siquiera imprimían los hallazgos** cuando había un ciego: salían antes de llegar
a ese bloque (los nueve de cola `ciegos`/`hallazgos` a nivel de módulo y `caja-avisos`). Los otros
11 sí los dejaban en la salida —los cuatro `915*` al final, y siete sobre la marcha, caso a caso— y
salían igualmente con el 2.

El detector por AST marca 26 en el árbol de antes: los 21, los 3 de la otra forma,
`completar-lleva-al-campo` (decide a mano, aunque bien) y `nombres-no-declarados` (su 2 es del
instrumento entero). En el de ahora marca 5, que son los declarados.

**Ya se había arreglado una vez, en un solo guard.** SCRUM-904 lo vio en
`guard-completar-lleva-al-campo.mjs` («el barrido encontró sus 33 acciones mudas y el guard contestó
NO SUPE MEDIR»), escribió la regla encima de esa cola y la ancló con un test de ese fichero. La
regla se quedó a vivir allí y los otros 21 siguieron igual.

## ② La regla

`veredictoDe({ hallazgos, ciegos })`, pura:

| hallazgos | ciegos | código | línea |
|---|---|---|---|
| > 0 | 0 | 1 | `N hallazgos · 0 ciegos → salida 1 (hallazgo)` |
| > 0 | > 0 | **1** | `N hallazgos · M ciegos → salida 1 (hallazgo) · ⚠️ … NO es la lista completa de defectos` |
| 0 | > 0 | **2** | `0 hallazgos · M ciegos → salida 2 (no supe medir) · un ciego no es un verde` |
| 0 | 0 | 0 | — |

No hay orden que elegir: el código lo da el hallazgo y la línea dice siempre las dos cuentas. Una
cuenta que no es un recuento (`undefined`, `NaN`, una cadena) **lanza**, porque `undefined > 0` es
`false` y ese `false` se leería como «ningún hallazgo».

Los 21 guards imprimen ahora las dos listas y sacan su código de ahí. En los cuatro `915*`, además,
el `main().catch` deja de tirar lo ya encontrado: lo imprime y cuenta el reventón como un ciego más.

**La puerta.** El código sólo puede llevar una de las dos cosas, así que la otra viaja en la línea
(`⟦veredicto⟧`). `guards-visuales.mjs` la lee: la fila del guard dice `rojo(1) · 5 hallazgos · 1 ciego`
y el recuento `… · 1 rojo (1 con casos sin medir)`. El aviso «lo que este recuento no sabe» que
SCRUM-1313 dejó escrito en `recuento` queda resuelto y reescrito.

## ③ El rojo primero, con el caso que ya existía

Mutación: `public/dashboard/js/quotesView.js:2038`, `if (esDocumentoSuelto)` → `if (false)` (no se
monta «Ajustes del documento»). `git diff --numstat` 1/1 en cada pasada, deshecha después y árbol
limpio comprobado.

| pasada de `guard-915g` | antes del arreglo | después |
|---|---|---|
| editor sano (base) | salida 0 | salida 0 |
| editor roto (:2038) | 5 hallazgos + 1 ciego → **salida 2** | `5 hallazgos · 1 ciego` → **salida 1** |
| arnés sirviendo un modo que no pinta el editor (el estado de SCRUM-1313) | — | `0 hallazgos · 6 ciegos` → **salida 2** |
| editor sano + reventón a mitad (un `throw` puesto a mano en el último caso) | — | `0 hallazgos · 1 ciego` → salida 2 |
| editor roto + reventón a mitad | — | `4 hallazgos · 2 ciegos` → salida 1, con los 4 impresos |

Y uno de la otra receta: `guard-pasos-del-editor` con la misma mutación → `1 hallazgo · 0 ciegos` → salida 1.

La tercera fila es el **control positivo** del ticket: lo que SCRUM-1313 ganó (un ciego no es un
rojo) sigue en pie.

## La comprobación (A9)

`tests/scrum1320-hallazgo-y-ciego-no-son-excluyentes.test.mjs`, sin navegador:

- la regla en sus cuatro cuadrantes, el caso visto y el control positivo;
- lo que el guard escribe es lo que la puerta lee, y el recuento de la puerta en los dos sentidos;
- **el censo**: ningún `scripts/guard-*.mjs` decide a mano entre ciego y hallazgo fuera de los cinco
  declarados, con sus dos mitades (uno nuevo sin declarar cae; una entrada que ya no hace falta, también).
  El detector tiene su suelo: cinco colas sintéticas —la de antes, la de antes con números, la buena,
  **la invertida** y **el ciego puesto otra vez delante del veredicto**— y sólo aprueba la buena.


Visto en rojo, con la inyección comprobada (`git diff --numstat`) y deshecha cada vez:

| mutación | qué cae |
|---|---|
| la regla vuelve a «el ciego gana» (`h > 0 && c === 0` en `veredictoDe`) | 4 de los 9 tests, entre ellos el caso visto |
| la salida vieja por ciego, repuesta en `guard-foto-del-gasto.mjs` | el censo, nombrando el fichero y la línea |
| una entrada de más en `DECIDEN_A_MANO` | el censo, por la mitad «caduca» |

## Lo medido en este árbol (1-oct-2026, `prisma generate` + `build` en 0 antes de medir)

- **Puerta de navegador entera** (`node scripts/guards-visuales.mjs`): 37 guards, `37 verdes · 0 CIEGOS · 0 rojos`, salida 0.
  Los 21 tocados siguen pasando por su camino verde.
- **La salida real de `guard-915g` pasada por las funciones de la puerta**: editor roto → fila
  `rojo(1) · 5 hallazgos · 1 ciego`, recuento `… · 1 rojo (1 con casos sin medir)`, salida 1; sólo ciego →
  fila `CIEGO · 0 hallazgos · 6 ciegos`, recuento `… · 1 CIEGO · 0 rojos`, salida 2. ⚠️ La puerta ENTERA con
  el editor roto no se ha corrido: son otros diez minutos y cada pieza está medida por separado.
- **Tests, en dos tandas parciales** (no la suite completa: ésa queda para el CI): 122 ficheros que
  citan o barren los scripts tocados → 1148 tests, 1 rojo mío (la cita, arriba en «Mis errores», corregido
  y repetido en verde), 2 saltos gateados por `QA_DB_TEST`; y 278 ficheros más de censos que barren el
  árbol → 2411 tests, 1 rojo (`scrum854`: el registro aún no existía; repetido en verde con él), 1 salto
  (enlace a fichero, no se puede crear en esta máquina).
- `npm run guards:entrada`: 12 guards, 112 tests, salida 0.

## Lo que NO arregla

- **Los 3 que abortan en el primer ciego.** Es el mismo defecto por otro camino (el hallazgo ya
  acumulado se pierde), pero arreglarlo es rehacer el bucle de cada uno, no cambiar la cola. Quedan
  declarados con su motivo en `DECIDEN_A_MANO`, dentro del test. Reportado al orquestador.
- **Los 3 que salen con 1 las dos veces.** Ahí el hallazgo no sale «no medido»; pasa lo contrario: un
  ciego puro sale `rojo(1)`. Es el defecto de vocabulario de SCRUM-639, no éste. Reportado.
- **Un guard sin `await` protegido que revienta** (los de cola a nivel de módulo) sigue saliendo con el
  1 de node y sin sus hallazgos. La puerta lo cuenta como rojo, que es el lado seguro.

## Mis errores

- Escribí «el control de regla NN de SCRUM-1313» en dos comentarios. `tests/scrum189-citas-con-destino`
  no deja citar una regla por número sin nombrar su documento, y lo cazó **mi tanda local**, no el CI:
  la primera selección de tests ya incluía los que barren `scripts/`. Reformulado sin el número.
- Di por bueno `git restore` para deshacer la mutación; `guard-dangerous` lo bloquea aunque el traspaso
  lo daba por válido. Las mutaciones se deshicieron con la edición inversa y `git status --porcelain` vacío.
