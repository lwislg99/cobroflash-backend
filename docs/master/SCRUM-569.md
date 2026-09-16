# SCRUM-569 · `AGENTS.md` estaba fosilizado y mandaba lo que `CLAUDE.md` prohíbe

**Fecha:** 20-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-20T23:12:00+01:00

> ⚠️ Esa hora es la del árbol contra el que se midió, no una lectura de reloj — criterio R14.

---

## Lo grave, y por qué fue primero  **[EXISTE]**

`AGENTS.md` traía `npx prisma migrate diff` **como instrucción**. `CLAUDE.md` lo trae **como
prohibición**, con su motivo: si falta el CLI local, `npx` se baja otro de la red **en silencio** y
su salida vacía se lee como «sin cambios» (incidente del 5-ago-2026). Y «Nunca `npx` para el CLI
de Prisma» es una de las restricciones permanentes que viajan verbatim en cada encargo.

Dos ficheros de arranque diciendo lo contrario **sobre una operación que toca el esquema**. Una
sesión que arrancara por `AGENTS.md` recibía instrucciones que la casa prohíbe, sin forma de
saberlo.

**Y el árbitro que el fundador fijó el 20-ago —gana el CÓDIGO— no resuelve éste**, con esas
palabras: no es un choque sobre un hecho medible sino sobre **una orden**, y el código no dice qué
está permitido hacer. Por eso hizo falta un arreglo y no una medición.

Se corrigió **solo y primero**, en `8cb36d49`, antes de censar nada. Y el texto bueno **no se
reescribió: se extrajo de `CLAUDE.md`** dentro del propio script del cambio, byte a byte (549 B).
Copiarlo a mano habría sido otra paráfrasis con licencia para divergir — que es exactamente cómo
se llegó aquí.

> ⛔ **No se ejecutó `npx prisma migrate diff`** para «comprobar si funciona»: está prohibido y no
> había versión de este ticket en la que se ejecutara. `prisma/schema.prisma`, sin tocar.

## El censo: 64 afirmaciones, 5 falsas  **[EXISTE]**

**El instrumento no depende de mi vocabulario**, y eso importa porque en SCRUM-566 un criterio
léxico sobre documentos me dio cuatro falsos de cinco. `AGENTS.md` no era un documento
independiente: era una **copia** de `CLAUDE.md` con «Claude» sustituido por «Codex». Deshecha la
sustitución, toda línea que siga sin casar es adaptación deliberada o afirmación que se quedó atrás.

| | |
|---|---|
| afirmaciones totales | **64** |
| idénticas al gemelo vivo (vigentes) | **59** — 92 % |
| 🔴 divergentes | **5** — 8 % |
| rutas nombradas · comandos `npm` | 19 · 2 (**los dos existen** ✅) |

**Las cinco se abrieron antes de contarlas.** Cuatro son falsas: «una tarea → un commit → push»,
«deploy = push a `main`», «`.env` apunta a PROD» y «`src/integrations/` … Codex» (el fichero real
es `claude.ts`). **La quinta es divergente pero CIERTA**: `docs/MIGRATIONS_PENDING.md` sólo estaba
incompleta.

De las rutas, **`.Codex/skills/` no existe y nunca existió** —las skills espejo viven en
`.agents/skills/`—; `.Codex/*` es un glob que mi extractor leyó como ruta, y `src/modules/voice/`
es una capa planeada nombrada **igual en los dos** ficheros. **Total: cinco afirmaciones falsas.**

## Por qué sólo puede mantenerse uno — y esto no es opinión  **[EXISTE]**

| | commits | último |
|---|---|---|
| `AGENTS.md` | **1** en toda su vida | 29-jun-2026 |
| `CLAUDE.md` | **20**, **7 de ellos posteriores** | 10-ago-2026 |

**La divergencia no es un riesgo: ya ocurrió siete veces.**

## La salida es REMITIR, y la fijó el máster  **[EXISTE]**

> *«"Revisar el espejo" es una prohibición sin mecanismo, y ya había fallado […] Excepción, **y el
> camino a seguir con el resto**: `guard-dangerous` ya NO está duplicado (SCRUM-176) — una sola
> implementación y dos envoltorios finos, con un test que impide que el espejo vuelva a llevar su
> propia copia.»*

**Esto es ese resto.** Las otras dos salidas se descartaron, cada una por su motivo:

- **MANTENER** — descartada por el propio máster: sincronizar dos documentos a mano es cómo se
  llegó aquí, y declarar un responsable no cambia que el mecanismo no exista.
- **RETIRAR** — descartada **por medición**, que es lo que exigía la prohibición del encargo:
  **sí hay lector.** El tooling de Codex está vivo (`.codex/config.toml`, `.codex/hooks.json`,
  `.codex/hooks/guard-dangerous.sh` que **delega** en el de `.claude/`, y `.agents/skills/`), y el
  máster declara `AGENTS.md` «espejo de `CLAUDE.md` para el harness de Codex». En cambio **ningún
  script lee su contenido**: los dos que lo nombran (`scripts/_evidencia-tanda.mjs`,
  `tests/scrum239-huella-de-codigo.test.mjs`) sólo lo clasifican como «no es código», así que
  vaciarlo de reglas no rompe nada.

## El guard sujeta la IMPOSIBILIDAD, no vigila la contradicción  **[EXISTE]**

El guard obvio —comparar las dos constituciones y saltar cuando choquen— **se descartó con mi
propia medición**: en SCRUM-566 un criterio léxico sobre documentos dio **cuatro falsos de cinco**,
y un rojo permanente es el que el segundo que lo ve desactiva (SCRUM-559).

Así que la contradicción no se vigila: **no cabe**. `AGENTS.md` no puede dar una orden que
`CLAUDE.md` contradiga **porque no puede dar ninguna orden ejecutable**, y eso se comprueba por
**forma** —arranque de línea y cercas ` ```bash `—, sin vocabulario. Más el **recuento exacto** de
líneas copiadas (cero, no un umbral con holgura: un umbral sólo cazaría la copia entera y dejaría
pasar la que empieza por tres reglas, SCRUM-559).

`tests/scrum569-agents-es-puntero.test.mjs`, 4 tests.

## Verificación

- 🔴 **Rojo por el mecanismo, dos veces.** Commit antes: `5bb7d230`.
  1. Inyectado **el comando exacto que originó el ticket** → cae **nombrándolo**:
     *«L32 (dentro de un bloque ```bash): `npx prisma migrate diff --from-schema-datasource …`»*,
     y dice qué hacer: moverlo a `CLAUDE.md`.
  2. Inyectada **una línea copiada literal de `CLAUDE.md`** (la regla 2, multi-tenant) → cae
     nombrándola y mandando borrarla de allí.
  **Reversión byte a byte verificada** contra el blob `d7fa7504`:
  `Buffer.compare(disco, blob) === 0`, árbol limpio.
- ✅ **Control positivo:** la afirmación de `AGENTS.md` que **sí** es correcta no se denuncia — los
  **2 comandos `npm`** existen y las rutas de tooling que nombra existen las **6**. El guard
  comprueba rutas contra el disco y calla cuando son ciertas.
- 🔴 **Calibración del instrumento:** el detector se prueba contra el comando de verdad (tiene que
  acusarlo) **y** contra prosa que sólo nombra un fichero (tiene que callar). Sin la segunda mitad
  daría rojos falsos el primer día.
- 🔴 **Suelo:** si el lector no ve líneas en los dos ficheros, falla declarándose ciego — un cero
  de comandos sobre un fichero que no se lee no es un verde.

## Lo que queda fuera, dicho

- ⚠️ **Pendiente del fundador:** el máster describe `AGENTS.md` como «espejo de `CLAUDE.md` …
  mismas 10 reglas, AA1, stop conditions» (línea 1790). **Con este cambio esa descripción se queda
  vieja.** No lo he tocado (guard de SCRUM-273); queda anotado para que lo suba quien puede.
- **`.agents/skills/` no se toca:** es el espejo de skills, otro carril y otro ticket.
- **La norma de estado de SCRUM-566** vive en `CLAUDE.md` en su rama, **pendiente de merge**. Se
  ha aplicado igual a `AGENTS.md`: cabecera «qué es este fichero, y qué no» y etiqueta por sección.
