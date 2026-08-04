# SCRUM-270 · EVIDENCIA-TIRADA: lo que la corrida ya midió se reporta, no se pierde

**Fecha:** 4-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `fed079eaa94931aa9893ef91df59c7a2011898c0` · 2026-08-04T14:16:00+02:00
**Tanda:** 1242 tests, 1175 pass, 0 fail (el resto, gateados a staging)

## El defecto, con su coste

Un assert que muere el primero se lleva por delante la evidencia que **ya estaba en la mano**. Dos
rojos de esta semana se cerraron como **irrecuperables** por esto: el dato que los explicaba se
obtuvo dentro de la propia corrida y no se imprimió.

El coste no es el rojo: es la ronda de diagnóstico y **la tanda que hay que volver a gastar**. Con
un turno de staging único compartido por cuatro máquinas, cada re-corrida son ~40 minutos de un
recurso serializado. Y peor: **invita a re-correr**, que es lo que SCRUM-161 prohíbe.

## El censo, derivado

Escáner AST sobre `tests/`: **1160 tests, 3334 asserts, 567 evidencias** (nombres declarados con
`await` **antes del primer assert** — «en la mano»). **86 señalados.**

**Reparto que decide la prioridad:**

| | señalados | ficheros |
|---|---|---|
| **Gateados** — cada re-corrida cuesta ~40 min de turno | **55** | 38 |
| Puros — re-correr es gratis | 31 | 14 |

> **⚠️ LOS 31 PUROS QUEDAN FUERA, Y ESTÁ DECIDIDO.** Tienen el mismo patrón y **ningún daño
> descrito por el ticket**: se vuelven a correr en segundos, en local, sin turno. Que nadie lea
> este trabajo como cobertura total del censo.

**Un fallo cazado en la propia medición:** el primer censo dio **113**. Muestreando dos casos antes
de entregarlo, `scrum221` no encajaba — su `okXml` se pide **después** del primer assert, así que
ahí no se tira nada: nunca llegó a obtenerse. Faltaba la condición de posición, que es la mitad del
criterio («ya tiene N resultados EN LA MANO»). Con ella, 86. Los otros 27 eran ruido.

## Lo construido — `tests/_evidencia.mjs`

- **`observarRespuesta(nombre, res)`** → `{nombre, status, cuerpo}`. **El cuerpo no es un extra:** un
  404 puede venir de tres capas y los cuerpos las distinguen sin discutir — handler → `{"error":…}`
  (JSON), `requireInternalSecret` → `Not found` (texto plano), Express sin ruta → HTML. Leer solo el
  número deja esa pregunta abierta y obliga a otra corrida. Best-effort: un cuerpo ilegible **se
  anota**, jamás tumba el test con una excepción distinta de la que se está diagnosticando.
- **`exigirTodas(observaciones, comprobar, porque)`** → evalúa **todas** y falla **una sola vez** con
  las N delante, diciendo **cuántas** fallaron. Si `comprobar` lanza sobre una, se anota como su
  problema y el recorrido **sigue**: una comprobación rota no puede volver a esconder las demás.
- **`tablaDeEvidencia`** → marca las que fallaron **sin esconder las que pasaron**: que tres estén
  bien es la evidencia de que el fallo no es general.

**No es un marco de aserciones, y es deliberado.** Sale de dos casos reales y cubre lo que ellos
piden. Un marco construido antes de ver casos acaba siendo el marco de un caso imaginario.

## Aplicado a los dos casos del ticket

**`scrum127`** — los dos bloques. El de plan vigente asserteaba de una en una; el de trial vencido
recorría las cuatro **con el `assert` dentro del bucle**, que es morir en la primera con otra forma.
Ahora se observan las cuatro (con cuerpo) y se exige de una vez. Es lo que separa *«falla SOLO
enviar-whatsapp»* (cadena de esa ruta) de *«fallan las cuatro»* (algo compartido: sesión, tenencia,
la fila del merchant) — y esa diferencia decide dónde mirar.

**`tenancy-permisos`** — «¿veo lo mío?» y «¿veo lo ajeno?» son diagnósticos **opuestos**, y el
segundo no llegaba a ejecutarse si caía el primero, con la lista entera ya en la mano. Ahora se
responden juntos. **El diagnóstico de tres estados de SCRUM-259 NO se reescribe:** se conserva tal
cual y solo se le pone la otra observación al lado — dos arneses del mismo hecho es SCRUM-240.

## Verificado en rojo

- Los dos casos, en rojo antes de tocarlos: «scrum127 no usa la pieza común» y «tenancy-permisos no
  usa la pieza común» — 2 de 10.
- **El corazón, probado por el mecanismo:** con 4 observaciones y la primera fallando, el mensaje
  tiene que nombrar las cuatro; el test lo exige una por una. Y el control opuesto: fallando las
  cuatro, el mensaje dice `FALLAN 4 de 4`, porque «falla una» y «fallan todas» son diagnósticos
  distintos.
- Casos límite con su rojo propio: cuerpo ilegible (se anota, no lanza), predicado que lanza (no
  esconde a los demás), y `exigirTodas([])` que **no pasa en silencio**.

## Lo que NO cubre — y el muestreo que lo dice

Repetido el muestreo antes de dar el patrón por bueno, sobre dos de los 53 gateados restantes:

- **`scrum173:76`** (`a` y `b` en la mano, dos asserts seguidos): el defecto es real, pero lo que le
  falta **no es `exigirTodas`** — es que el mensaje del primer assert lleve el valor del otro. Es una
  variante más ligera de la misma regla.
- **`scrum135:144`**: el segundo assert no mira evidencia en la mano, sino una llamada nueva. El
  señalamiento ahí es **débil**.

O sea: **55 es el techo de lo señalado, no una lista de 55 conversiones pendientes.** La pieza
cubre la forma «N observaciones del mismo tipo»; el resto pide mirarse caso a caso, y **no se
convierten 53 tests a ciegas** — eso sería generalizar de más, que es justo lo que el ticket prohíbe.

**Tampoco cubre** el escáner en sí: vive en el scratchpad como herramienta de medición, no en la
suite. Convertirlo en guard es otra decisión (haría falta trinquete, como en SCRUM-275) y no se
toma aquí.

## Ficheros

`tests/_evidencia.mjs` (nuevo) · `tests/scrum270-evidencia-reunida.test.mjs` (10) ·
`tests/scrum127-paywall-bloquea.test.mjs` · `tests/tenancy-permisos.test.mjs`.
