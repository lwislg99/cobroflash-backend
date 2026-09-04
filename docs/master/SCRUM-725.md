# SCRUM-725 · El micrófono y la IA que redacta — ① entregado, ② PARADA con el dato

**Medido contra:** `origin/main` = `1304643497934441f88950e441182b7e344dbb57` · 2026-09-04T18:58:33+02:00
**Rama:** `scrum-725-voz-y-redaccion`

> El ticket se pedía en dos mitades. **② se cae en el PASO 0 y se entrega el dato para que decida
> el fundador. ① se entrega** — y no como se pedía, porque el motor ya existía: lo que faltaba era
> otra cosa, y aparece midiendo.

---

# ② EL MICRÓFONO · 🔴 PARA. El audio SÍ sale del dispositivo.

## PASO 0 — dos cosas que el encargo daba por hechas y no lo estaban

**① El micrófono YA EXISTE en la app.** `public/dashboard/js/voiceInput.js` (VOZ-1), con su
gate `VOICE_QUOTE_ENABLED`. No había que construirlo.

**② `VOICE_QUOTE_ENABLED` y `VOICE_ALBARAN_ENABLED` están las dos en `false` GLOBAL.** Así que
hoy no hay exposición: está construido y apagado. Eso cambia la pregunta de «¿lo construimos?» a
«¿lo encendemos?».

**③ Y la premisa de privacidad estaba cruzada.** El encargo dice que *«SCRUM-683 se aprobó
justamente porque el audio NO salía del teléfono»*. SCRUM-683 garantiza otra cosa: que **el
binario de audio no sale de NUESTRO proceso hacia Gemini** (*«El binario inyectado NO sale del
proceso»*). Sobre lo que hace el NAVEGADOR con el audio, no dice nada.

## La medición · tres sondas, y las dos primeras no valían

| sonda | qué ve | veredicto |
|---|---|---|
| A · CDP `Network.enable` | lo que pide **la página** | ❌ no sirve: el servicio de voz es **del navegador** |
| B · `emulateNetworkConditions {offline}` | corta **la pestaña** | ❌ no sirve: no corta el proceso |
| **C · `--host-resolver-rules`** | corta **el navegador entero** | ✅ **decide** |
| **D · `--proxy-server` propio** | **destino y volumen** | ✅ **el dato pedido** |

🔴 **Las dos primeras habrían dado «cero tráfico», y ese cero no significaba nada**: sólo que la
página no manda nada, que nadie discutía. Es exactamente el *«cero no es no sale, es no he
mirado»* del encargo, y por eso se descartaron en vez de publicarse.

### Control positivo de cada instrumento — el que decide si la medida vale

* **Sonda C:** con las reglas puestas, el navegador pasa de `ALCANZA` a `FALLA` contra un host
  externo. **Las reglas muerden.**
* **Sonda D:** el proxy tiene que ver una petición que la página hace a propósito. **La primera
  versión salió en ROJO y el defecto era mío**: anotaba el host al CERRAR el túnel, así que un
  túnel abierto —justo el del dictado— no existía para el censo. Cero por no mirar, dentro de mi
  propio instrumento.

### 🔴 EL RESULTADO

```
CON red        → start · result · result …           reconoce
SIN salida de proceso → start · error:network · end  NO reconoce nada
```

```
speech.platform.bing.com   subidos 401.355 B · bajados 14.652 B   ← ~12 s de dictado
edge.microsoft.com          subidos  18.755 B · bajados 70.584 B
```

**401 KB subiendo contra 14 KB bajando.** Esa asimetría es el audio. Y sin salida de red el
reconocimiento **no ocurre**: luego no ocurre en el aparato.

### ⚠️ Alcance de la medida, declarado

Medido en **Edge headless (Chromium 152) sobre Windows**, que es la mejor aproximación disponible
aquí — **no** en Chrome de Android ni Safari de iOS, que es lo que pedía el encargo y lo que usan
los técnicos. Chrome comparte el motor de voz de Chromium, así que el resultado traslada con alta
confianza cambiando el destino (Google en vez de Bing). **Safari/iOS es otro motor y NO está
medido.**

### Y la pregunta 4, contestada de paso

**No funciona sin cobertura.** Es el mismo hecho: sin red, `error: network`. El parte se cierra en
garajes y cuartos técnicos. Ya está asumido en el código (`voiceInput.js:186` avisa), pero
confirma que el micro no es una función de obra: es una función de sitio con cobertura.

## VEREDICTO

**El audio sale → NO se implementa nada.** Es proveedor nuevo con dato sensible —nombre del
cliente, dirección de la obra y detalles de su sistema de alarma, en una empresa de SEGURIDAD— y
lo decide el fundador. **Lo que hay que decidir no es construirlo: es si se ENCIENDE el flag.**

---

# ① LA IA REDACTA · entregado, y el hueco era otro

## PASO 0 — el motor no era `lineasSugeridas.ts`, y ya estaba cableado

El camino completo existe desde SCRUM-683: `POST /partes/:id/dictado` → `ai.service.ts` con
`PROMPT_PARTE_APROBADO` → `sanearDictadoDelParte`. Y el prompt ya prohibía **cantidades, marcas,
modelos y precios**.

Así que se probó lo que el encargo pide probar —**los casos adversarios**— contra el mecanismo tal
como estaba:

| dictado | mecanismo de SCRUM-683 | |
|---|---|---|
| «cambie los detectores del pasillo» | `unds: 3` **retirada** | ✅ |
| «puse cable» | `unds: 20` **retirada** | ✅ |
| **«reviso la central»** | **«Revision de central Honeywell Galaxy G3-144»** | 🔴 |
| «cambié 3 detectores Honeywell» | el `3` y la marca **sobreviven** | ✅ |

🔴 **El tercero pasaba entero.** `sanearDictadoDelParte` comprobaba **sólo `unds`**: la
`descripcion` viajaba **verbatim, sin verificar nada**. El prompt lo prohibía y nada lo hacía
cumplir — **una prohibición sin mecanismo**, que es la familia cara de este repo.

🔒 Y no acaba en una pantalla fea: ese `G3-144` es **el modelo de la central de alarma del
cliente**, escrito en un documento que el cliente FIRMA y que después se factura.

## Lo construido

`datosNoRespaldados(descripcion, dictado)` dentro de `parteDictado.ts`, y un campo
`datosRetirados` en la propuesta — **paralelo a `cantidadesRetiradas`: se enseña, no se borra**.
Quitar una palabra de mitad de una frase deja el texto roto, y el técnico es quien sabe si dijo
«Honeywell».

### Dónde se pone el listón, y por qué no más alto

Exigir que **toda** palabra esté en el dictado mataría la función: redactar es justamente pasar de
«cambie los detectores» a «Cambio de detectores». Se exige respaldo **sólo donde vive el daño**:

* **todo token con un DÍGITO** — `G3-144`, `20`, `2N`: ahí viven modelos y medidas;
* **todo token en Mayúscula que no abre la frase** — `Honeywell`, `Galaxy`: ahí viven las marcas.

La primera palabra se exime **de la mayúscula, no del dígito**: una frase redactada empieza en
mayúscula siempre, pero no empieza con un modelo por casualidad.

**Y el cotejo va por RAÍZ, no por igualdad.** `reviso` → `Revisión` es la misma palabra; un cotejo
exacto la habría dado por inventada y habría convertido el arreglo en un generador de falsos
positivos. Un guard ruidoso acaba apagado.

## Verificación

**🔴 El rojo, y que cae con el mecanismo viejo:** quitando la llamada, el caso «reviso la central»
se pone rojo y el resto sigue verde. Es el estado de ayer.

**Los cuatro adversarios + el simétrico, como tests permanentes.** El simétrico es el que se
olvida: *un corrector que se come los datos buenos es tan malo como uno que los inventa*.

**✅ Controles negativos, enumerados:** cuatro redacciones legítimas no saltan; la raíz aguanta
conjugación y plural; la primera palabra no salta por ir en mayúscula **pero sí si lleva un
modelo**.

**⛔ Importes:** hay test de que la línea propuesta sólo puede tener `descripcion` y `unds`. Que no
exista el CAMINO es más fuerte que prohibirlo por prompt.

**Un guard me corrigió y tenía razón:** `scrum411` cazó `datosNoRespaldados` como export huérfano
—su único consumidor externo era mi test— y pidió medir por la **superficie pública**. Se le quitó
el `export` y los tests van por `sanearDictadoDelParte`.

**BUILD exit 0** (antes que los tests, como se pidió) · **suite 5234 · 5146 pass · 0 fail · 88
skipped**, re-medida sobre el árbol ya mezclado · `guards:entrada` **21/21, exit 0**.

## ⛔ PENDIENTE DE FIRMA (regla 30) — no se ha inventado ni un rótulo

El mecanismo viaja en el dato y **la pantalla no lo pinta**, porque el aviso necesita microcopy
aprobada. Los literales **propuestos**, para que los firme el fundador:

| dónde | literal propuesto |
|---|---|
| aviso de dato sin respaldo | «Esto no lo has dicho — bórralo o confírmalo» |
| botón del micrófono | *(no se propone: ② está parada)* |
| estado «escuchando» | *(ídem)* |
| «no te he entendido» | *(ídem)* |

Los tres de ② **no se proponen a propósito**: pedir copy para una función que no debe encenderse
sería empujar la decisión.

## ⛔ No tocado

`prisma/schema.prisma` · el camino de emisión (regla 38) · `voiceInput.js` y los flags de voz ·
`PROMPT_PARTE_APROBADO` · ninguna base · producción · la rama `scrum-653-dos-firmas`, que sigue
bloqueada esperando el ALTER de Javier.
