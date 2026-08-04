# SCRUM-268 · TURNO-6 — el turno no se le gana a un humano con un bucle

> ⚠️ **ESTE TICKET VA EN DOS RAMAS.** Los **puntos 1 y 2** (`turno:ceder --a <ref>` y que
> `adquirirLock` rechace a quien no es el destinatario) cambian la **semántica** del turno y
> tienen **GATE de fundador**: viven en `scrum-268-cesion`. Este fichero documenta **solo el
> punto 3**, que no toca la semántica. Al mergear, **se conservan las dos secciones** — es la
> excepción a «un fichero por ticket», porque aquí un ticket tiene dos ramas y no dos números.

---

## Punto 3 · Un guard: nadie espera el turno en un bucle y lo toma

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `fed079eaa94931aa9893ef91df59c7a2011898c0` · 2026-08-04T13:15:04+02:00
**Tanda:** 1245 tests, 1178 pass, 0 fail, 67 skipped
**Ficheros:** `tests/_espera-automatica.mjs` (detector puro), `tests/scrum268-espera-automatica.test.mjs` (13)

### El incidente

Un esperador en segundo plano consultaba `turno:estado` cada 60 s. En el intento 8 vio LIBRE y
**tomó** el turno (`DESKTOP-T5MONF5.22844`, 14:01:05Z), quedándose con lo que un humano acababa de
ceder a otra sesión.

> **cualquier automatismo que espere y tome gana siempre a un humano que espera y decide**

No es descortesía: un bucle no duerme, no lee el chat y no cede. Compite con ventaja estructural
contra una persona que está decidiendo.

### Qué se prohíbe: la COMPOSICIÓN, no cada mitad

- Esperar **mirando** es legítimo — un `estado` en bucle que solo imprime no compite con nadie.
- Adquirir **una vez** es legítimo — es lo que hacen el CLI y el runner, fuera de todo bucle.
- **Reintentar hasta conseguirlo** es lo que gana siempre al humano.

Por eso `refrescarLock` **no** cuenta como adquisición, y esa distinción es la que hace viable el
guard sin falsos positivos: medido en `main`, el runner adquiere en `test-staging-gated.mjs:272`
**fuera** de todo bucle, y lo que hay dentro de su bucle de hijos es `refrescarLock`. Quien refresca
ya tiene el turno; no compite por él. Confundirlos habría puesto en rojo al runner legítimo.

### AST, no texto — y el segundo motivo es el que decide

1. Un `grep` no distingue «llamada **dentro** de un bucle» de «llamada y, aparte, un bucle».
2. **Un guard de texto se caza a sí mismo** en el comentario que explica la prohibición
   (SCRUM-176/168/3, el motivo de que exista `_guard-texto.mjs`). Aquí ni se plantea: el código
   escrito dentro de una cadena **no produce nodos de bucle**, así que los casos de prueba viven en
   el propio fichero del guard sin denunciarlo. **La inmunidad es estructural, no una excepción.**

**Censo derivado del árbol** (`scripts/`, `tests/`, `src/`), jamás una lista a mano: la lista a mano
no avisa de lo que le falta.

### El SUELO, y por qué no es decorativo

«No hay esperador» y «no supe mirar» son **el mismo número** y significan lo contrario. Tres asserts
lo separan: el censo recorrió ≥100 ficheros, el detector **ve** ≥50 bucles reales del repo, y **ve**
≥1 adquisición real (la del CLI y la del runner).

**Demostrado, no argumentado.** Con el detector cegado (`LOOPS → false`) **y un esperador real
presente en el repo**, el test del repo dio **VERDE mintiendo** y lo cazó el suelo:
`🔴 el detector solo vio 0 bucles en 434 ficheros`. Sin ese assert, un esperador real habría pasado
limpio.

### Un falso positivo real, cazado y corregido

La primera versión marcó `tests/scrum188-turno-staging.test.mjs:246`, que recorre una **tabla de
casos** (`[null, 'PROD', 'YAQU_STAGINGX', '']`) contra un cliente falso para comprobar que
`adquirirLock` **se niega**. Eso no espera: itera fixtures. **Un guard que tumba lo legítimo no
distingue, y uno que no distingue se acaba desactivando.**

Un esperador se reconoce porque **su continuación depende de obtener el turno**. Tres señales, basta
una: **duerme** entre intentos · **corta** el flujo (`break`/`return`) · su **condición** está atada
a algo que el propio cuerpo asigna (`while (!tengoTurno)`). La tabla de casos no tiene ninguna.

El caso real queda como **control negativo, no como excepción**: una excepción tapa el caso; un
control explica por qué es legítimo y avisa el día que el detector deje de distinguirlo.

### Qué cubre

Las **dos vías** de adquirir: en proceso (`adquirirLock`) y por **subproceso** (spawn del CLI en
modo `tomar`, o del runner). La forma **evasiva** (`const x = adquirir(); if (x)`), que esquiva a
cualquier guard que solo mire la llamada como sentencia. Y la **indirección dentro del fichero**,
por punto fijo sobre las funciones locales.

### Cobertura: medida, no supuesta

Este ticket nace de una lección reciente — **SCRUM-253 se cerró con 1196 tests en verde y ningún
test ejecutaba su CLI**, así que el `ReferenceError` de `turno:tomar` viajó a `main` sin que nada lo
delatara (lo arregló SCRUM-258). Por eso aquí no basta con ver verde:

```
node --test --experimental-test-coverage tests/scrum268-espera-automatica.test.mjs
  _espera-automatica.mjs | 100.00 líneas | 96.64 ramas | 96.00 funcs
```

**100 % de líneas del detector, ejecutadas por el test.**

### Límites declarados

- **Fuera del repo no se ve.** El esperador del incidente era un comando en segundo plano, no un
  fichero commiteado. Ningún guard de ficheros lo habría parado y este tampoco pararía al siguiente.
  Esa superficie necesita un hook `PreToolUse` (estilo `guard-dangerous`) y **no está construida**.
- **La indirección entre ficheros no se sigue** (bucle en A, adquisición en B).
- **La recursión con `setTimeout` que se auto-reprograma** no se detecta como repetición.
- Un bucle que adquiriera **sin dormir, sin cortar y sin condición atada** no caería — pero eso no
  es un esperador, es un bucle infinito de adquisiciones: un fallo distinto y ruidoso.
