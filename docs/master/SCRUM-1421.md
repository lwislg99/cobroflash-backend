# SCRUM-1421 · La caja de firma del albarán se separa con una clase, no con un estilo en línea

**Medido contra:** `origin/main` = `9acfbeba61c997aa838ad2460103a219141cd293` · 2026-10-07T16:38:54Z
A9: aviso → cicatriz S4 «escribí en el comentario de un trinquete cuántas asignaciones de estilo tenía un fichero contándolas a ojo sobre una búsqueda, puse siete y el contador del propio guard dio cinco: la cifra que acompaña a un trinquete se saca con el contador de ese trinquete» — no se pudo comprobar: el comentario es prosa y ningún test lo lee

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Una clase nueva de una regla en `public/dashboard/css/styles.css` y una línea en `public/dashboard/js/albaranDetailView.js`: sin marcado nuevo, sin color, sin tipografía, sin texto. El hueco es el `spacing.md` (16 px) de `DESIGN.md`, el mismo que ya había.

7-oct-2026 · **S4** · rama `scrum-1421-la-caja-de-firma-del-albaran-sin-estilo-en-linea`. Resto de SCRUM-1376. «Lo coge» y PASO 0: SCRUM-1421 c.18764.

## Qué había

`cajaDeFirma`, en la ficha del albarán, envuelve tres cosas que ocupan el mismo sitio encima de la barra de acciones: la caja del estado de la firma («Solo en este móvil», «A salvo»), el aviso de firma rechazada (SCRUM-1376) y el recordatorio de la copia (SCRUM-1460). Su separación era `cajaFirma.style.cssText = 'margin:0 0 16px'`. La medida era buena y vivía donde no debe (A7: ni un `style=` en línea).

## Por qué una clase NUEVA, y dónde

La aceptación pedía «una clase o un token que exista». Mirado antes de tocar:

- `public/tokens.css` no tiene ninguna variable de espaciado. `DESIGN.md` nombra `spacing.md: 16px`, pero sólo en su cabecera.
- En `styles.css`, las reglas con `margin-bottom: 16px` (`.section-header`, `.toolbar`, `.jobs-cabecera`, `.gastos-cabecera`…) traen además `display: flex` o son de otra pantalla: usarlas aquí cambiaría la disposición, no sólo el hueco.

Así que va una clase propia, `.albaran-caja-firma { margin: 0 0 16px; }`, en `styles.css`, junto a la otra regla del albarán (`.alb-siguiente-numero`).

**Carril, desviación declarada:** `styles.css` es contenedor de S2 (`docs/equipo/dos-equipos.md:150`). El ticket lo preveía («S4 añade su bloque marcado o se pide a S2») y la cerradura de carril deja pasar los contenedores. Va como bloque marcado `/* S4 · SCRUM-1421 … */`, dicho en c.18764 antes de hacerlo.

## Qué cambia

- `albaranDetailView.js`: `cajaFirma.className = 'albaran-caja-firma'` en lugar del estilo en línea.
- `styles.css`: la regla, con su comentario.
- `tests/scrum713c-trinquete-de-estilos-en-js.test.mjs`: `TECHO` 336 → 335. Lo pidió el propio guard («HAN BAJADO … 335 frente al techo 336»); con su contador, ese fichero pasa de 5 a 4.
- `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`: los tests de SCRUM-1376 y SCRUM-1460 medían la separación mirando `style.cssText`. Miden lo mismo por la clase (mismo envoltorio, misma clase). Y tres tests nuevos: el lector de reglas ve una regla que existe; la clase tiene UNA regla y es `margin: 0 0 16px`; los tres envoltorios llevan la clase y ninguno lleva estilo en línea.

Son dos mitades y se miden las dos, porque con una sola el hueco desaparece sin un rojo: una clase sin regla no separa nada.

## Verificado

- Antes del cambio, con los tests ya escritos: 36 tests · 32 pass · 4 fail (los dos migrados y los dos nuevos). Después, con el trinquete: 39 de 39.
- Mutación (`mut1421.mjs`, fuera del repo): base 39 de 39 y **8 de 8 mutantes mueren** (regla quitada, con otro hueco, duplicada, con algo más que el hueco; el JS con el estilo en línea, con clase Y estilo, con otra clase, sin nada).

## Medido en pantalla (yaqu.app, cuenta QA, albarán 46; sólo GET)

Tres casos × dos anchos (390 y 1280 px). La cola y los rechazos de este móvil los contesta la sonda; «firmado» se simula cambiando el estado en la respuesta del GET.

| Pasada | JS | CSS | Envoltorio | Hueco hasta la barra |
|---|---|---|---|---|
| producción hoy (build `818cb29b`) | con estilo en línea | sin la regla | sin clase, `style="margin: 0px 0px 16px;"` | 16 px en las 6 filas |
| la rama, servida encima de yaqu.app | con la clase | con la regla | `albaran-caja-firma`, sin `style` | 16 px en las 6 filas |
| CONTROL: JS de la rama + CSS de producción | con la clase | sin la regla | `albaran-caja-firma`, sin `style` | **0 px en las 6 filas** |

El control dice que la sonda sabe leer un hueco roto. Y dice otra cosa, que se nombra aquí sin tocarla: durante un despliegue, un navegador que reciba el JS nuevo con el `styles.css` viejo vería el aviso pegado a la barra hasta que recargue. Es cosmético y dura lo que tarde en llegar el CSS.

## Lo que salió al medir

- **Un rojo mío, cazado por la dirigida y arreglado en mi código:** al apuntar la bajada en el comentario del trinquete escribí el nombre del fichero de la ficha del albarán, y `tests/scrum1363-tests-que-cubren.test.mjs` usa ese trinquete como su caso real de «test que recorre el panel sin nombrar esa vista». Con el nombre dentro, el caso dejaba de reproducir su defecto y caía. El comentario ya no lo nombra y dice por qué. El guard no se ha tocado.
- **La cifra a ojo:** escribí que ese fichero pasaba de 7 a 6 asignaciones contando sobre una búsqueda; con el contador del guard son 5 y 4 (no cuenta `style.display`). Corregido antes del commit; es la cicatriz de hoy.
- Dirigida, 8 de 8 tramos, después del último cambio de código: 517 ficheros · 4.779 tests · 4.772 pass · 0 fail · 7 saltos nombrados (SCRUM-781 ×4 sin `QA_DB_TEST`, SCRUM-759 ×2 sin base de fusión, SCRUM-476 ×1 sin enlace a fichero en Windows).

## Lo que NO está medido

- En yaqu.app con el cambio desplegado: falta, hasta que mergee. La sonda es `qa1421.mjs prod`, y cada fila debe decir `albaran-caja-firma`, sin estilo en línea y 16 px.
- El recordatorio de la copia (SCRUM-1460) en pantalla: sale sólo justo después de firmar en el pad, que es escribir. Lo cubre el test (misma clase que «A salvo»).
- Un albarán `firmado` de verdad: la cuenta QA no tiene ninguno.

## Lo que NO entra aquí

Los otros estilos en línea del mismo fichero (cuatro, con el contador del guard) y el `style="margin:6px 0 0"` del detalle que pinta `estadoFirma.js`. El ticket es de esta caja.
