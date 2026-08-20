# Registro de microcopy APROBADA — bloque F

**SCRUM-563.** Qué texto, con qué identificador, en qué fecha y por quién. **Guarda el texto
LITERAL**, no una descripción: la pregunta que tiene que contestar es *«¿este texto de hoy es
el que se aprobó?»*, y ésa se contesta con `Buffer.compare`, no leyendo.

> ⚠️ **Generado** (`node scripts/registro-de-lo-aprobado.mjs`). La fuente es
> `scripts/_registro-de-lo-aprobado.mjs`, que es lo que leen los tests. Este documento es la
> vista para leer; **no lo edites a mano** — se regenera y perderías el cambio.

> ⛔ **Esto no aprueba nada.** Registra lo ya decidido.

---

## Estado de hoy

| | |
|---|---|
| textos registrados como aprobados | **41** |
| **vigentes** (el texto de hoy es el aprobado) | **41** |
| 🔴 **caducados** (alguien reescribió la frase) | **0** |
| 🟠 sin anclaje (el identificador ya no existe) | **0** |

**La aritmética, porque el encargo decía 42:** son «los 38 del esquema» + «los 4 de F7», pero
**uno de los cuatro de F7 ya está entre los 38** (`contacto-publico/h2#1` es un `<h2>`, o sea
unidad del esquema). Los otros tres viven en atributos. **38 + 3 = 41.** No falta ninguno:
sobraba un recuento.

---

## 🔴 Lo que el documento de propuesta propone y NINGUNA aprobación cubre

Cruce con `docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md` (**51** entradas), con `===` y `Buffer.compare`:

| | |
|---|---|
| cubiertas exactamente por el registro | **28** |
| las mismas palabras, **partidas de otra manera** | **16** |
| 🔴 **sin cubrir por ninguna aprobación** | **7** |

### 🔴 Las que no cubre nadie

Éstas son las que hay que mirar. Ninguna es una frase larga: son **rótulos, etiquetas de
botón y cabeceras de columna** — justo lo que el esquema `h1|h2|h3|p|li` no alcanza
(SCRUM-561). Y una de ellas dice qué **es** el producto.

| nº en el documento | texto literal |
|---|---|
| `F4-1` | «El ERP por WhatsApp para los oficios» |
| `F4-4` | «Probar la demo» |
| `F4-5` | «Empieza gratis» |
| `F5-1` | «PROPUESTA · La diferencia» |
| `F5-4` | «La situación» |
| `F6-1` | «Tu oficio» |
| `F6-6` | «Empezar gratis →» |

### Las que están, pero partidas de otra manera

**No son aprobaciones que falten.** Las palabras están aprobadas dentro de una unidad más
larga: el documento las separó y el extractor las junta (territorio de SCRUM-553). Se listan
para que nadie las cuente dos veces ni las dé por inéditas.

| nº | texto del documento | vive dentro de |
|---|---|---|
| `F4-6` | «14 días gratis» | `heroe-f4/p#2` |
| `F4-7` | «Sin tarjeta» | `heroe-f4/p#2` |
| `F5-5` | «Tu método actual» | `comparativa[firma]/p#2` |
| `F5-6` | «Con YaQu» | `comparativa[firma]/p#3` |
| `F5-8` | «Tu palabra contra la suya.» | `comparativa[firma]/p#2` |
| `F5-9` | «Lo aceptó con su firma y su fecha, y la firma queda dentro del PDF.» | `comparativa[firma]/p#3` |
| `F5-11` | «O llamas tú, o no llama nadie.» | `comparativa[cobro-pendiente]/p#2` |
| `F5-12` | «El recordatorio sale solo. Tú no tienes que ser el pesado.» | `comparativa[cobro-pendiente]/p#3` |
| `F5-14` | «Se queda en la libreta hasta que te acuerdas.» | `comparativa[presupuesto-sin-respuesta]/p#2` |
| `F5-15` | «Se le recuerda solo, y el presupuesto caduca cuando toca.» | `comparativa[presupuesto-sin-respuesta]/p#3` |
| `F5-17` | «A buscar entre hojas, si es que la guardaste.» | `comparativa[historial-cliente]/p#2` |
| `F5-18` | «Cada movimiento queda en su ficha, con su fecha.» | `comparativa[historial-cliente]/p#3` |
| `F5-20` | «Lo sabrás cuando lo diga la gestoría.» | `comparativa[margen-mes]/p#2` |
| `F5-21` | «Lo que entró menos lo que salió, mes a mes.» | `comparativa[margen-mes]/p#3` |
| `F5-23` | «Los copias hoja a hoja, y alguno sale mal.» | `comparativa[catalogo-precios]/p#2` |
| `F5-24` | «Salen de tu catálogo según escribes.» | `comparativa[catalogo-precios]/p#3` |

---

## Los tres estados

Dado un texto cualquiera de la landing, el registro contesta una de tres cosas. **La tercera
es la que no existía**, y es la que ha hecho equivocarse tres veces en un día:

- `APROBADO` — su texto literal está en el registro, byte a byte.
- `PENDIENTE` — vive dentro de una sección con marcador de pendiente. ⚠️ El marcador es de
  la **sección**, así que alcanza a todo lo que hay dentro, no sólo a las unidades del
  esquema: por eso «Tu oficio», que es un `<span>`, sale `PENDIENTE` y no «ni una cosa ni otra».
- `NI_UNA_COSA_NI_OTRA` — ni registrado ni dentro de una sección marcada. **La mayor
  parte del copy PUBLICADO está aquí** (`#como`, `#todo`, `#precios`, `#probar`, `#faq`):
  nadie lo aprobó y nadie lo marcó como pendiente. No es un fallo nuevo — es que hasta hoy
  no había dónde decirlo.

```
node scripts/registro-de-lo-aprobado.mjs --estado "Seis herramientas. Una sola app."
  → NI_UNA_COSA_NI_OTRA
```

---

## Los 41 textos registrados

| identificador | texto literal | vía | fecha | quién |
|---|---|---|---|---|
| `heroe-f4/h1#1` | «Del presupuesto al cobro, sin salir de WhatsApp.» | elemento | 2026-08-20 | fundador |
| `heroe-f4/p#1` | «Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con tarjeta, Bizum o transferencia. No hace falta que te fíes: haz tú el recorrido completo antes de dar tu correo.» | elemento | 2026-08-20 | fundador |
| `heroe-f4/p#2` | «14 días gratis Sin tarjeta» | elemento | 2026-08-20 | fundador |
| `gremios/h2#1` | «El recorrido es el mismo. El trabajo, no.» | elemento | 2026-08-20 | fundador |
| `gremios/p#1` | «Busca el tuyo — así es un día normal con YaQu en la mano.» | elemento | 2026-08-20 | fundador |
| `gremios[fontaneria]/h3#1` | «Fontanería» | elemento | 2026-08-20 | fundador |
| `gremios[fontaneria]/p#1` | «Presupuestas un desatasco desde la furgoneta, el cliente firma en su móvil y cobras al terminar — sin volver a casa a hacer papeles.» | elemento | 2026-08-20 | fundador |
| `gremios[electricidad]/h3#1` | «Electricidad» | elemento | 2026-08-20 | fundador |
| `gremios[electricidad]/p#1` | «Cambias un cuadro y aparecen dos puntos de luz más. Añades las líneas en la misma escalera, el cliente acepta en el momento y no se quedan sin cobrar.» | elemento | 2026-08-20 | fundador |
| `gremios[reformas]/h3#1` | «Reformas» | elemento | 2026-08-20 | fundador |
| `gremios[reformas]/p#1` | «Una obra de tres semanas y cuatro pagos. Cobras por tramos según avanza y cada parte firmado queda con su fecha.» | elemento | 2026-08-20 | fundador |
| `gremios[climatizacion]/h3#1` | «Climatización» | elemento | 2026-08-20 | fundador |
| `gremios[climatizacion]/p#1` | «Revisas la caldera antes del invierno. El presupuesto sale de la sala de máquinas y la revisión del año que viene queda anotada sola.» | elemento | 2026-08-20 | fundador |
| `gremios[cerrajeria]/h3#1` | «Cerrajería» | elemento | 2026-08-20 | fundador |
| `gremios[cerrajeria]/p#1` | «Una apertura a las dos de la mañana. Presupuestas en el portal, el cliente firma en su móvil y cobras antes de recoger la herramienta.» | elemento | 2026-08-20 | fundador |
| `gremios[pintura]/h3#1` | «Pintura» | elemento | 2026-08-20 | fundador |
| `gremios[pintura]/p#1` | «Mides el piso y mandas el presupuesto antes de bajar la escalera. La señal entra antes de que compres la pintura.» | elemento | 2026-08-20 | fundador |
| `comparativa/h2#1` | «Tu libreta no firma, no cobra y no avisa.» | elemento | 2026-08-20 | fundador |
| `comparativa/p#1` | «Seis situaciones de cualquier semana, y cómo se resuelven hoy.» | elemento | 2026-08-20 | fundador |
| `comparativa[firma]/p#1` | «El cliente dice que él nunca autorizó ese trabajo.» | elemento | 2026-08-20 | fundador |
| `comparativa[firma]/p#2` | «Tu método actual Tu palabra contra la suya.» | elemento | 2026-08-20 | fundador |
| `comparativa[firma]/p#3` | «Con YaQu Lo aceptó con su firma y su fecha, y la firma queda dentro del PDF.» | elemento | 2026-08-20 | fundador |
| `comparativa[cobro-pendiente]/p#1` | «La factura lleva tres semanas sin pagarse y te da corte insistir.» | elemento | 2026-08-20 | fundador |
| `comparativa[cobro-pendiente]/p#2` | «Tu método actual O llamas tú, o no llama nadie.» | elemento | 2026-08-20 | fundador |
| `comparativa[cobro-pendiente]/p#3` | «Con YaQu El recordatorio sale solo. Tú no tienes que ser el pesado.» | elemento | 2026-08-20 | fundador |
| `comparativa[presupuesto-sin-respuesta]/p#1` | «Pasaste el presupuesto hace diez días y el cliente no ha dicho nada.» | elemento | 2026-08-20 | fundador |
| `comparativa[presupuesto-sin-respuesta]/p#2` | «Tu método actual Se queda en la libreta hasta que te acuerdas.» | elemento | 2026-08-20 | fundador |
| `comparativa[presupuesto-sin-respuesta]/p#3` | «Con YaQu Se le recuerda solo, y el presupuesto caduca cuando toca.» | elemento | 2026-08-20 | fundador |
| `comparativa[historial-cliente]/p#1` | ««¿Cuánto me cobraste por lo del año pasado?»» | elemento | 2026-08-20 | fundador |
| `comparativa[historial-cliente]/p#2` | «Tu método actual A buscar entre hojas, si es que la guardaste.» | elemento | 2026-08-20 | fundador |
| `comparativa[historial-cliente]/p#3` | «Con YaQu Cada movimiento queda en su ficha, con su fecha.» | elemento | 2026-08-20 | fundador |
| `comparativa[margen-mes]/p#1` | «Acaba el mes y no sabes si has ganado dinero.» | elemento | 2026-08-20 | fundador |
| `comparativa[margen-mes]/p#2` | «Tu método actual Lo sabrás cuando lo diga la gestoría.» | elemento | 2026-08-20 | fundador |
| `comparativa[margen-mes]/p#3` | «Con YaQu Lo que entró menos lo que salió, mes a mes.» | elemento | 2026-08-20 | fundador |
| `comparativa[catalogo-precios]/p#1` | «Vuelves a escribir a mano los precios de siempre.» | elemento | 2026-08-20 | fundador |
| `comparativa[catalogo-precios]/p#2` | «Tu método actual Los copias hoja a hoja, y alguno sale mal.» | elemento | 2026-08-20 | fundador |
| `comparativa[catalogo-precios]/p#3` | «Con YaQu Salen de tu catálogo según escribes.» | elemento | 2026-08-20 | fundador |
| `contacto-publico/h2#1` | «¿Tienes una duda antes de empezar?» | elemento | 2026-08-20 | fundador |
| `contacto-publico@data-wa-etiqueta` | «Escríbenos por WhatsApp» | atributo | 2026-08-20 | fundador |
| `contacto-publico@data-wa-texto` | «Hola, tengo una duda sobre YaQu» | atributo | 2026-08-20 | fundador |
| `contacto-publico@data-email-etiqueta` | «Escríbenos por correo» | atributo | 2026-08-20 | fundador |

