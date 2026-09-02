# SCRUM-672 · Un test que desaparece no falla

**Fecha:** 2-sep-2026 · **Carril:** S3
**Medido contra:** `origin/main` = `a464d978051268f647bdddfa7837538dead8d921` · 2026-09-02T21:03:41Z
**Rama:** `scrum-672-un-test-que-desaparece`

**El defecto**, medido por otra sesión como efecto colateral: al romper un `import`, la tanda pasó
de **4391 a 4377** con `fail 2` — **catorce tests desaparecieron**. Aquella vez hubo señal porque
el import produjo rojos. Cualquier otro camino se los lleva **en silencio**.

---

## PASO 0

### ENTRADA

**Para `npm test`: no existe ninguna.** Nada compara el total de la tanda ungated contra nada.

### MECANISMO: existe, y está RANCIO

**`SUELO_TOTAL = 646` en `scripts/_evidencia-tanda.mjs`.** Su propio comentario ya avisaba:

> *«RATCHET MANUAL — NO SUBE SOLO. […] Es otra cifra a mano que envejece.»*

**Hoy la tanda real va por 4.766 con ese suelo en 646.** Margen: **4.120**. Ese suelo ya no separa
«tanda completa» de «media suite borrada» — y además sólo se aplica al **recibo de la tanda
GATEADA**, no a `npm test`, que es donde se midió el defecto.

Así que el trabajo no era inventar un mecanismo: era **darle superficie** al total que el runner ya
publica, en la tanda donde falta.

## Las tres mediciones que condicionaban la forma

### ① Qué imprime el runner, y qué es estable

| Fuente | Estable |
|---|---|
| `ℹ tests N` (reporter `spec`, stdout) | **NO.** Medido: con el reporter TAP activo **esa línea no existe**. Depende de qué reporter esté puesto |
| `# tests N` (reporter TAP) | **SÍ.** Lo emite el propio reporter, siempre y en el mismo formato |

Y el CI **ya escribe ese TAP en cada tanda** (`--test-reporter=tap` a un fichero). Esto no añade
nada que mantener: le da superficie a un artefacto que ya existía.

### ② ¿Es determinista el total?

**Sí. Tres pares de ejecuciones consecutivas, todas idénticas:**

| Árbol | Pasada 1 | Pasada 2 |
|---|---|---|
| antes de mezclar `main` | 4722 | **4722** |
| tras mezclar `main` | 4731 | **4731** |
| con este ticket dentro | 4743 | **4743** |
| tras absorber  (SCRUM-580) | 4766 | **4766** |

Era la medición que podía matar el ticket (lección de SCRUM-520: no se cambia una comprobación
frágil por otra frágil). No lo mata.

### ③ 🔴 ¿Ha bajado el total sin que nadie lo reclamara? SÍ, UNA VEZ

**Primero, el hallazgo que hace falta decir:** el recibo de evidencia **no está en git** (`git log`
sobre él: **0 apariciones**). O sea que **no existe ningún histórico del total**, y por tanto nadie
podría haber notado una bajada aunque hubiera querido.

Así que se midió un **proxy estático** sobre los 25 últimos merges de `main`: ficheros de test y
llamadas `^test(`. Es un proxy —los tests en bucle cuentan una vez— y se dice.

**Bajó una vez:**

```
ec1845cd  2026-09-02   ficheros 561 (Δ0)   test( 4381 (Δ −4)
Merge pull request #932 from lwislg99/scrum-680-prosa-sin-numero
```

Investigado: `tests/scrum498-cifra-derivada.test.mjs` pasó de **9 a 5** tests, **sin que se
añadiera ni un test en ningún otro fichero** de ese commit, y **sigue en 5 hoy**. Los cuatro que
desaparecieron:

* `🔴 CONTROL POSITIVO: con el esquema tal cual, verde y ninguna frase vieja`
* `🔴 ninguna afirmación atada está CIEGA: si la frase cambió, se dice`
* `🔴 EL ENSAYO DEL DÍA D: entra EmailMessage y las doce frases CAEN, nombradas`
* `el registro cubre los ocho ficheros del encargo, y dice cuál queda fuera`

**Si fue deliberado, está bien y no hay nada que hacer.** Lo que no hubo fue nadie que lo mirara: es
cobertura perdida sin reclamar, y es exactamente el caso que este ticket viene a hacer visible.
**No lo persigo — no es mi carril.**

> **CONTESTADO por SCRUM-695 (2-sep-2026): fue DELIBERADO, y además obligatorio.** Los cuatro
> vigilaban un registro que SCRUM-680 dejó sin sujeto; resucitados contra el registro de hoy dan
> **dos verdes huecos y dos rojos permanentes**. El motivo ya estaba escrito en la cabecera del
> propio fichero. Detalle en `docs/master/SCRUM-695.md`.

## Lo construido

| Pieza | Qué es |
|---|---|
| `scripts/_suelo-de-la-tanda.mjs` | el veredicto, **PURO**, y el número con su procedencia |
| `scripts/suelo-de-la-tanda.mjs` | el CLI: lee el TAP y aplica |
| paso `¿Ha perdido tests la tanda?` en `ci.yml` | con **`if: always()`** |

### `if: always()` no es un detalle: es la mitad del ticket

**El defecto que persigue sale VERDE.** Si el paso corriera sólo cuando la tanda falla, no lo vería
nunca. Un test que lo ata: cae si aparece un `if: failure()`.

### Es un SUELO, no un espejo — y el margen se imprime siempre

`SUELO_TESTS = 4766`, **sin tolerancia**. Un margen «por si acaso» sería el umbral con holgura que
SCRUM-559 tuvo que retirar.

La contrapartida —un suelo viejo deja perder tests— se compensa **imprimiendo el margen en cada
ejecución**: `suelo 4766 · total actual 4766 · margen 0`. Un suelo rancio tiene que verse sin que
nadie vaya a buscarlo, que es justo lo que le faltó al 646.

### ⚠️ La regla de conflicto, escrita DONDE se resuelve el conflicto

**Si dos ramas cambian el número a la vez, se queda EL MÁS ALTO. Nunca el más bajo.** Está en la
cabecera del propio fichero —no en esta entrada— porque quien resuelve un conflicto está mirando
ese fichero, y una regla que vive en otro sitio no se lee. Un merge que elija el menor baja el
suelo en silencio: el defecto de este ticket entrando por la puerta de atrás. Hay un test que
comprueba que esa regla sigue escrita ahí.

## 🔴 El rojo, por el mecanismo — y el primer intento no valía

El encargo era explícito: *si sólo cae por el `fail`, no has probado nada*.

**Primer intento:** renombrar el fichero. La tanda bajó de 4731 a 4720 (−11, exactos), **pero
produjo `fail 1`** — y no por el renombrado, sino porque la huella de SCRUM-239 vio un fichero sin
trackear. Colateral de mi método. **No valía.**

**Segundo intento, el bueno:** un **patrón de descubrimiento que deja de casar** un fichero — uno
de los caminos que el propio ticket nombra. Resultado:

```
# tests 4720 · # pass 4637 · # fail 0 · # skipped 83     ← código de salida 0
```

**Tanda VERDE, salida 0, y once tests menos. Nada gritó.** Y el guard sobre ese mismo TAP:

```
🔴 LA TANDA HA PERDIDO 11 TEST(S): 4720 corridos, suelo 4731.
```

## Controles

| Control | Resultado |
|---|---|
| **NEGATIVO** · la tanda CRECE (+40) | no cae, e imprime `margen 40` |
| borde exacto (total == suelo) | pasa: es un mínimo, no un «más que» |
| **tolerancia cero** · UN solo test perdido | cae |
| **SUELO del propio guard** · TAP vacío o sin `# tests` | «NO SUPE MIRAR», salida **2**, distinta del 1 del hallazgo |
| control del suelo · un TAP bueno | **no** se declara ciego |

## 🕳️ Huecos declarados

1. **El guard sólo corre en CI.** Localmente `npm test` no genera TAP, así que un desarrollador no
   lo ve hasta que abre el PR. Se puede correr a mano generando el TAP, pero no es automático.
2. **El proxy del histórico es estático**: cuenta `^test(`, así que un test dentro de un bucle
   cuenta una vez y un `test` anidado no cuenta. Sirve para detectar **bajadas**, no para conocer
   el total de entonces — el total real de aquellos commits **no es recuperable**, porque nadie lo
   guardó.
3. **`SUELO_TOTAL = 646` de `_evidencia-tanda.mjs` sigue rancio.** No se toca aquí: es otro carril
   (la tanda gateada) y ampliarlo sería mejorar de paso.

---

## Añadido el 2-sep-2026, después de que SCRUM-695 contestara la §③

Aquella bajada resultó ser una **retirada correcta** — y este suelo **habría llorado igual**. Es su
diseño (es un suelo, no un juez), pero la regla de conflicto podía leerse como si el número no
pudiera bajar nunca, y eso dejaría a la siguiente sesión sin saber que **retirar tests con el motivo
escrito es legítimo**.

Se añade **sólo un comentario** a `scripts/_suelo-de-la-tanda.mjs` —17 líneas, ninguna de lógica, el
número intacto— diciendo que «se queda el más alto» resuelve un choque entre ramas y no prohíbe una
bajada deliberada; lo prohibido sigue siendo bajarlo para desatascar un rojo que no se ha mirado.

**Comprobado que el comentario NO ENSOMBRECE al guard:** el test ata la cadena de la regla, y un
comentario que la repitiera dejaría pasar el día que alguien borrara la regla de verdad. Medido: la
cadena sale **una sola vez**, y al romper la original el test cae (`not ok 10`). Restaurada, 12/12.

**Y la procedencia del número se contradecía a sí misma:** el docstring decía `bdce57dc` y la
constante `MEDIDO_CONTRA` decía `a464d978`. Son dos merges reales de `main` separados 11 minutos.
Manda `a464d978`, que es lo que declara también la cabecera de esta entrada. Corregido el docstring
—un comentario, no el número—, porque una procedencia que se contradice no sirve para lo que existe.

**Tanda de esta rama tras el cambio: 4766 tests, 4683 pass, 0 fail, 83 skipped.** Y el suelo, corrido
sobre ese TAP: `✅ suelo 4766 · total actual 4766 · margen 0` — el borde exacto, ejercitado de verdad.

⚠️ **`main` ha avanzado 6 commits** desde el punto de medida (`a464d978`) y esta rama no los lleva.
Quien cierre este PR mezcla `main` y **vuelve a medir**: si la tanda crece, el suelo sube; es la
operación de una línea que este mismo fichero describe.
