# Política de privacidad, §5 «Con quién compartimos los datos» · SCRUM-1154

**Aprobado por el fundador** el 29-sep-2026, en **SCRUM-1154**.

Javier firma **en persona**, no por delegación: es texto legal publicado, y la delegación permanente
de `docs/equipo/limites-del-fundador.md` **no cubre** los textos legales (regla 39).

Su literal, en el comentario 17576 de SCRUM-1154: **«Firmo y quitala».** Las dos mitades de esa
frase son las dos mitades del cambio — *firmo* la fila de Google, *quítala* la de Anthropic.

## El texto aprobado

| Ranura | Texto aprobado |
|---|---|
| `encargado-google` | `<li><strong>Google (Gemini)</strong> — asistencia de inteligencia artificial. Recibe: el texto que escribes o dictas cuando pides ayuda para redactar un presupuesto, junto con productos de tu catálogo; el dictado del técnico en un parte de trabajo; y la foto del ticket de gasto que subes, de la que extrae el proveedor, su NIF, el importe, el IVA y la fecha. Si tu cuenta tiene activada la ayuda por voz en albaranes, también recibe la descripción del albarán. Los textos son libres, así que pueden incluir el nombre de tu cliente si lo mencionas. Transferencia internacional.</li>` |

## La fila de Anthropic: SE QUITA

No se reescribe: **se borra.** Y el motivo va con la decisión, porque es lo que impide que alguien
la «arregle» mañana:

**Hoy no le llega nada.** Sólo se usaría si faltara `GEMINI_API_KEY`, y `ANTHROPIC_API_KEY` **ni
está puesta**. El «proveedor de respaldo» **se midió y no existe**: con un 429 de Google, cero
llamadas a Anthropic.

Una política de privacidad lista **quién recibe datos**. Anthropic no recibe ninguno, así que no
se lista.

⚠️ **El día que se encienda, vuelve a firma.** No queda un texto «por si acaso».

## Por qué este texto y no los tres anteriores

| Versión | Qué pasa con ella |
|---|---|
| **16198** (SCRUM-950, 22-sep) | ❌ NO se firma. Superada, y su fila de Anthropic es **falsa** |
| **L1** (SCRUM-1196, firmada el 29-sep a las 00:30Z) | ⚠️ Incompleta: omitía el dictado de los partes, y describía «el mensaje que acompaña a un presupuesto», que **no existe** — no tiene botón |
| **L1′** (propuesta en SCRUM-1247, sin firmar) | ⚠️ Arreglaba lo del mensaje, pero **seguía sin los partes** |
| **Ésta** | ✅ Firmada. Cubre los caminos medidos |

## Los cinco caminos medidos antes de firmar

Todos pasan por `src/integrations/gemini.ts` → `generativelanguage.googleapis.com`:

| Camino | Qué se manda | ¿Tiene botón? |
|---|---|---|
| `POST /admin/ai/suggest-quote` | descripción libre (hasta 2.000 car.) + hasta 40 productos + país y moneda | sí |
| `POST /admin/partes/:id/dictado` | el dictado del técnico | **sí** |
| `POST /admin/expenses/leer-ticket` | **la foto entera del ticket**; devuelve proveedor, NIF, importe, IVA y fecha | sí, **y sin respaldo** |
| `POST /admin/ai/suggest-albaran-lines` | descripción + catálogo | detrás de `VOICE_ALBARAN_ENABLED`, `false` por defecto |
| `POST /admin/ai/quote-message` | nombre de cliente, concepto, total | ❌ **ninguno** |

Eso explica la forma del texto: nombra los tres caminos que el profesional puede recorrer hoy, y la
frase «Si tu cuenta tiene activada la ayuda por voz en albaranes» es el cuarto, que depende de una
marca. El quinto **no se nombra porque no se puede usar** — y nombrarlo fue el defecto de L1.

## Dónde se pinta

`public/privacidad.html`, §5 «Con quién compartimos los datos», última fila de la lista de
encargados. El guard es `tests/scrum1154-google-encargado.test.mjs`.

## 🔴 Lo que este texto NO arregla

**La facturación del proyecto de Google.** Sus condiciones para la API de Gemini exigen **servicio
de pago** para poner clientes a disposición de usuarios del EEE, y el repositorio documenta que
producción va en el **nivel gratuito**. Si el proyecto de producción no tiene facturación activa,
este tratamiento no es lícito con usuarios en España **se escriba lo que se escriba en la política**.

Está medido en el comentario 17317 de SCRUM-1154 y va al equipo de Luis. Aplicar este texto **no
cierra ese asunto**.

Tampoco se ha comprobado si `GEMINI_API_KEY` está puesta en producción: los documentos dicen que sí,
**nadie lo ha mirado**.

## Dos huecos que este ticket NO toca, y piden ticket propio

- ~~**Google Fonts.**~~ **CORREGIDO el 30-sep: este hueco NO existe.** Lo cerró **SCRUM-1234** el
  28-sep: `fonts.googleapis.com` y `fonts.gstatic.com` salen **0 veces** de `public/` y de `src/`,
  Inter se sirve del propio dominio (`public/fonts/`) y hay un guard que impide que vuelva
  (`tests/scrum1234-inter-autoalojada.test.mjs`). Verificado además en `yaqu.app`. Lo midió J5; yo
  lo había dado por abierto sin comprobarlo.
- **Cloudflare.** `yaqu.app` va detrás de Cloudflare, que ve todo el tráfico y reescribe el HTML
  servido. No figura en el §5.
