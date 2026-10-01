# SCRUM-1349 · La familia del entorno prestado: el censo deja de acusar a un limpio, y la lista solo baja

**Rama:** `scrum-1349-entorno-prestado-trinquete` · **Carril:** S3 · instrumentos (s3-1oct)
**Medido contra:** `origin/main` = `bdebd30ee4c39ce79a565fca2f314f33fe799430` · 2026-10-01T10:55:37Z

## Qué es

Un test o script que lanza un `node` hijo sin limpiar `FORCE_COLOR` / `NODE_OPTIONS` /
`NODE_TEST_CONTEXT` le presta su entorno. Desde #2000 (SCRUM-1289b) ya no pueden romper el TAP: el
daño está contenido y la deuda sigue viva. El censo que los cuenta era informativo: ningún test
exigía nada, así que nada impedía que entrara uno nuevo.

## Una ceguera de la otra dirección: el censo acusó a tres limpios

El 1-oct el censo dio **18 acusados** donde el 29-sep había 15. Los tres nuevos eran bancos nacidos
ese día (`tests/banco-scrum1102f`, `1322`, `1329`, los tres `mutar.mjs`), y **estaban limpios**:
borran las tres variables con `for (const k of [...]) delete entorno[k];`. El censo solo reconocía
el `delete` escrito a mano y los clasificó `SPREAD_SIN_LIMPIAR`.

Las cegueras anteriores de esta casa iban todas en el mismo sentido: «no puedo ver» devolvía lo
mismo que «no hay nada». Esta va al revés: **«no reconozco cómo lo hiciste» devolvía «lo hiciste
mal»**. El daño es otro: la primera esconde defectos; ésta manda a alguien a arreglar lo que
funciona, y en este caso a otro equipo.

Dos cosas que quedan escritas porque pasaron:

- **La cifra se repartió sin abrir los ficheros.** S3 dio «18, y tres son de una plantilla que nace
  acusada» al orquestador, y con eso se iba a avisar al otro equipo de que su molde estaba mal. No
  hay molde (ningún fichero del repo genera esos `mutar.mjs`) y no estaba mal. Se corrigió al abrir
  el primero, antes de que el aviso saliera.
- **El «0 motivos para no fiarse» no cubría esto.** `motivosParaNoFiarse` solo mira una dirección
  (que el censo no se quede ciego). Con `[]` delante, la cifra se creyó. Un «me fío» que no dice de
  qué NO responde, no es un me fío: ahora lo dice (`NO_RESPONDE_DE`), y el rojo del trinquete
  manda abrir el fichero antes de arreglar nada.

## Qué cambia

| fichero | qué |
|---|---|
| `scripts/_censo-entorno-prestado.mjs` | reconoce el borrado en un `for…of` sobre una lista LITERAL de cadenas (`clavesDelBucle`). Lo que no se puede leer sigue sin limpiar nada. Nuevos: `contraDeclarados` (el trinquete) y `NO_RESPONDE_DE` |
| `scripts/_entorno-prestado-declarados.json` | los acusados de hoy, UNO A UNO: fichero, llamadas, dueño, si el dueño está confirmado, motivo |
| `tests/scrum1349-entorno-prestado-solo-baja.test.mjs` | el censo en los dos sentidos (5 casos) y el trinquete con su control positivo |
| `tests/scrum754-el-juez-que-oscila.test.mjs`, `tests/scrum949-el-suelo-como-cociente.test.mjs` | los dos de S3, arreglados: borran las tres. Salen de la lista |

## Población

`censar()` sobre este árbol: **1.590 ficheros · 45 llamadas a un `node` hijo · 32 limpias · 13
acusadas · 0 motivos para no fiarse** (y ese último no responde de que cada acusado lo sea de
verdad). Antes de los arreglos de esta rama eran 18 acusadas: 3 falsas, 2 de S3, 13 de otros.

## Los 13 que quedan, por dueño

Tabla §3.3 de `docs/equipo/dos-equipos.md`, aplicada literal («el test de un ticket: el puesto que
trabaja el ticket», leído del `Carril:` de su registro; «`scripts/` verificación y censos: S0»).

| dueño | ficheros |
|---|---|
| S5 (7 llamadas, 6 ficheros) | `scrum1123` (2), `scrum932`, `scrum946`, `scrum966`, y `scrum928` + `scrum976`, que arregla #1990 |
| S5, **NO CONFIRMADO** (2) | `scrum899d` (sin registro; atribuido por el ticket 899) y `node-p-capturado-sin-color` (sin número de ticket; por el commit en que nació) |
| S1 (1) | `scrum815` |
| S0 (3) | `scripts/censo-mudez.mjs`, `scripts/guards-entrada.mjs`, `scripts/verificacion-s5/romper-los-quince.mjs` |

⚠️ `scripts/verificacion-s5/` se llama como un puesto y la tabla dice otro: es un hueco de carril.

**Quien arregla el suyo borra su entrada del JSON en el mismo commit.** Si no, el trinquete sale en
rojo diciendo «puede apretar y no se ha apretado». Eso vale para #1990: si entra después de esta
rama, tiene que borrar las entradas de `scrum928` y `scrum976`.

## Probado en ROJO

Base en verde (8/8) y 8 mutaciones, cada una restaurada byte a byte:

| mutación | cae |
|---|---|
| el censo deja de reconocer el bucle | «NO ACUSA A UN LIMPIO», el control real de los tres bancos y el trinquete |
| el trinquete deja de mirar ficheros que no conoce | su control positivo |
| `scrum949` vuelve a heredar `FORCE_COLOR` | el trinquete |
| `scrum754` vuelve a heredar `NODE_OPTIONS` | el trinquete |
| un fichero NUEVO en `tests/` que lanza `node --test` sin `env` | el trinquete |
| una entrada declarada que ya no se acusa | el trinquete («puede apretar») |
| una entrada sin dueño | la carga de la lista |
| la lista no existe | la carga de la lista |

Las tres primeras van declaradas en `MUTACIONES_QUE_ME_TUMBAN`.

## Lo que se corrió

`scrum1349` (8), `scrum1153` (15), `scrum754` y `scrum949`: **55 tests, 55 pass, 0 fallos, 0 saltos**.
NO se corrió `npm test` entero (SCRUM-1244: en esta máquina revienta por memoria): el veredicto
completo es el del CI. Ni `meta:mutaciones` entero.

## Lo que queda de este ticket (otra rama)

El diario de `meta:mutaciones`: parar ese instrumento a medias deja el árbol mutado (medido el
1-oct, por accidente propio). Va aparte porque toca otro instrumento.
