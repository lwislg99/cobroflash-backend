# SCRUM-1469 · El inventario de SCRUM-419 sube de 42 a 44 porque cuenta llamadas escritas, no casos

**Medido contra:** `origin/main` = `a3a2f3b0de69803c1f16444b72a69f6908a5254e` · 2026-10-06T12:39:40Z

A9: aviso → cicatriz S3 «Escribí en el motivo de una lista de un test que una cifra vivía también en ci.yml sin buscarla en ese fichero, y el orquestador la heredó como motivo para escalar al fundador.» — no se pudo comprobar: es una frase en prosa dentro de un motivo, y ningún guard lee lo que un motivo afirma sobre otro fichero

Carril S3 (tests · bancos · instrumentación). Hijo de SCRUM-1416: era lo único que le quedaba dentro.

## Qué se ha hecho

| fichero | cambio |
|---|---|
| `tests/scrum809-paywall-tras-cancelar.test.mjs` | el bucle sobre las dos puertas de cancelación, desenrollado con `casosEscritos`: cuatro llamadas `test(` con su nombre literal |
| `tests/scrum419-ci-declara-lo-que-no-corre.test.mjs` | `GATEADOS_DECLARADOS`: ese fichero pasa de 5 a 7, con el motivo, el invariante y las dos fechas escritos junto al número |
| `tests/scrum1415-nombres-construidos.test.mjs` | `DECLARADAS` queda vacía: se retira la última entrada, y con ella una frase que era falsa |

## La decisión, y de quién es

El 2-oct la conversión de `scrum809` se dejó parada «hasta que el fundador decida sobre el
inventario». El motivo escrito era que la cifra «también vive en `ci.yml`».

**Medido el 6-oct: no vive ahí.** Ningún workflow de `.github/workflows/` nombra el inventario, ni
`scrum419`, ni `scrum809`, y la palabra `42` no aparece en `.github/` ni en este árbol ni en
`0dbf8eae` (el `main` del 2-oct). La cifra vive en un solo sitio: la suma de `GATEADOS_DECLARADOS`.

Con eso delante, el orquestador `cobroflash-backend-57` tomó la decisión por mensaje el 6-oct. Está
copiada literal en Jira, SCRUM-1469, c.18375. En corto: sube, porque cambia el contador y no la
cobertura, y no se aprueba como aflojar un trinquete (regla 41) sino como corregir una unidad de
medida.

## El invariante: 7 casos antes y 7 después

`GATEADOS_DECLARADOS` cuenta llamadas `test(` escritas con salto por falta de banco. El bucle
escribía dos y registraba cuatro casos. Desenrollado, escribe cuatro y registra cuatro.

Medido corriendo el fichero sin banco, antes y después del cambio, con `run()` de `node:test`:

| | llamadas `test(` con salto | casos registrados | nombres |
|---|---|---|---|
| antes (`a3a2f3b0`) | 5 | 7, los 7 saltados | — |
| después | 7 | 7, los 7 saltados | los mismos 7, en el mismo orden |

El cuerpo de los dos casos del bucle no cambia: `git diff -w` sobre el fichero enseña sólo la
cabecera de cada uno, las cuatro llamadas nuevas y el `import`.

## Visto en rojo

Con `scrum809` ya desenrollado y las dos listas sin tocar:

- `scrum419` cae en dos casos y sólo en ésos: «el inventario … está declarado, fichero por fichero»
  y «CI DECLARA lo que no ha ejecutado» (`se declaran 42 tests sin ejecutar y hay 44`). Los otros
  seis pasan.
- `scrum1415` cae en «EL ÁRBOL», pidiendo bajar la cifra de `DECLARADAS`.

Con el 5 cambiado por 7 y la entrada retirada: `scrum419` 8 de 8, `scrum1415` 6 de 6,
`scrum809b-paywall-sin-banco` 3 de 3. No ha salido rojo nada que no fuera ese recuento.

## Lo que NO he hecho

- **No he corrido los siete casos de `scrum809` con banco.** En esta máquina salen saltados. Los
  ejecuta el obligatorio del PR, que levanta el Postgres desechable. Ahí es donde `casosEscritos`
  comprueba que cada nombre escrito es el de su puerta.
- No toco `ci.yml` ni ningún workflow.
- La cabecera de `GATEADOS_DECLARADOS` sigue diciendo «7 tests» de cuando la lista tenía siete. Es
  de antes y no es de este cambio.

## Reproducir

    npm run build
    node --test tests/scrum419-ci-declara-lo-que-no-corre.test.mjs tests/scrum1415-nombres-construidos.test.mjs
    node --test tests/scrum809-paywall-tras-cancelar.test.mjs    # sin banco: 7 saltados
