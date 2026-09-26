# Mapa de técnicos — investigación (SCRUM-989)

> **Sin código, sin coste, sin dependencia nueva.** Documento de S0 para que el fundador decida en
> dos minutos. Medido el 26-sep-2026 contra `origin/main` = `5d7285d3`. Las fuentes externas van con
> enlace; lo que no está verificado contra la fuente primaria lo dice.

## En dos minutos

| | |
|---|---|
| **Qué hace la competencia de oficios** | ServiceM8 y Tradify enseñan al técnico en el mapa **mientras tiene la app nativa abierta y ha fichado**; Jobber guarda la posición **solo cuando el técnico pulsa algo** (fichar, empezar o terminar una visita, añadir una nota). |
| **Qué tenemos hoy** | **Nada de mapa y nada de posición.** No existe «el mapa de Trabajos» que cita el ticket: solo enlaces que abren Google Maps fuera de la app (`api.js:1401`, `jobRailBlocks.js:94`). Cero `navigator.geolocation` y cero campos de latitud o longitud en el esquema. |
| **Qué gana el profesional** | Saber qué técnico tiene más cerca cuando entra un aviso urgente, y poder decirle al cliente «va para allá» sin llamar a nadie. |
| **El límite que decide** | YaQu es una **web** (PWA), no una app nativa. Un navegador **deja de dar la posición en segundo plano o con la pantalla apagada**. Un «mapa en vivo» como el de ServiceM8 **no se puede hacer bien sin una app nativa**. |
| **Recomendación** | **TODAVÍA NO** (va detrás de SIF-1 8/8, como ya se decidió). Cuando toque: **SÍ a la versión «posición al pulsar»**, al estilo Jobber: cabe en la web, respeta la proporcionalidad del art. 90 LOPDGDD y no necesita app nativa. **NO al mapa en vivo continuo** mientras YaQu sea una web. |
| **Tamaño** | «Posición al pulsar»: **M** (ALTER aditivo + servidor S1 + mapa en el panel S2), con 2 STOP delante (coste/dependencia y RGPD laboral). Mapa en vivo continuo: **L**, y exige app nativa. |

**STOP antes de construir cualquiera de las dos versiones:**
1. **Coste y dependencia → fundador.** Pintar un mapa dentro del panel exige una librería de mapas y un proveedor de teselas. Ver §3.
2. **Datos de un empleado → J4.** La posición de un técnico es un dato personal suyo. Ver §4.

## 1 · Lo medido en nuestro repositorio (`5d7285d3`)

* Librerías o servicios de mapas (`leaflet`, `maplibre`, `mapbox`, `openstreetmap`, `google.maps`, `maps.googleapis`, `here.com`, `tomtom`) en `public/`, `src/` y `package.json`: **0**.
* `navigator.geolocation`, `watchPosition`, `getCurrentPosition` en `public/` y `src/`: **0**.
* Latitud o longitud en `prisma/schema.prisma`: **0**.
* **Control positivo** (la búsqueda no está ciega): sí encuentra los enlaces `https://www.google.com/maps/search/?api=1&query=…` de `api.js:1401` y `jobRailBlocks.js:94` («Cómo llegar»).
* La premisa del ticket «un mapa como el de Trabajos de hoy» **no se sostiene**: ese mapa no existe.

## 2 · La competencia (documentación pública; sin entrar en cuentas)

| competidor | qué hace | fuente |
|---|---|---|
| ServiceM8 | Posición en vivo en el «Dispatch Map» **solo con la sesión fichada** y el GPS permitido en su app de iOS; no aparece con la jornada cerrada ni en pausa. Informe de ruta de la jornada («Shift GPS») y enlace para que el cliente siga la llegada («Track My Arrival», un complemento aparte). | [live GPS](https://support.servicem8.com/questions/staff/does-servicem8-support-live-gps-tracking-of-technicians) · [Shift GPS](https://support.servicem8.com/help-center/servicem8-add-ons/reports/how-to-use-the-team-timesheet-shift-gps-reports) · [Track My Arrival](https://support.servicem8.com/help-center/servicem8-add-ons/servicem8-add-ons/what-is-track-my-arrival) |
| Tradify | Posición desde su **app instalada y abierta**; el técnico puede **apagarla** en ajustes; por defecto usa precisión reducida (red móvil y wifi) para ahorrar batería. | [ajustes de ubicación](https://help.tradifyhq.com/hc/en-us/articles/360031145933-Staff-Location-GPS-Settings) · [activar o desactivar](https://help.tradifyhq.com/hc/en-us/articles/23981403398169-Enable-and-disable-location-map-tracking) |
| Jobber | **«Waypoints»**: la posición se guarda solo **cuando el técnico hace una acción** (fichar, empezar o parar una visita, nota, adjunto), con un círculo de precisión. Lo continuo es un complemento de flota aparte (FleetSharp / Force). | [GPS Waypoints](https://help.getjobber.com/hc/en-us/articles/115009612507-GPS-Waypoint-Tracking) · [Force Fleet](https://help.getjobber.com/hc/en-us/articles/29976893311255-Jobber-and-Force-Fleet-Tracking) |

Los tres lo atan a **la jornada** (fichado) o a **una acción**, no a «siempre». Y los dos que dan posición continua lo hacen desde **app nativa**.

## 3 · Proveedor de mapas y coste — **STOP: lo decide el fundador**

Pintar un mapa en el panel necesita dos cosas: una **librería** (dependencia nueva) y un **proveedor de teselas**.

| proveedor | coste | uso comercial | ojo |
|---|---|---|---|
| Google Maps Platform (Dynamic Maps) | 10.000 cargas al mes gratis por SKU; a partir de ahí, **5,60 USD por cada 1.000** (tramo 100.001-500.000) | sí | exige **cuenta de facturación** (tarjeta); «Product availability, functionality and terms may differ» para clientes con facturación en el **EEE** · [precios](https://mapsplatform.google.com/pricing/) · [tabla](https://developers.google.com/maps/billing-and-pricing/pricing) |
| MapTiler Cloud | Free: 0 USD, **sin uso comercial**; Flex: **30 USD al mes**, 25.000 sesiones, con tarjeta | solo de pago | una «sesión» cubre toda la interacción con el mapa · [precios](https://www.maptiler.com/cloud/pricing/) |
| Teselas estándar de OpenStreetMap | 0 | permitido, pero «access may be withdrawn at any point» | **sin SLA**, atribución obligatoria, User-Agent propio, caché ≥ 7 días, prohibido descargar en bloque · [política](https://operations.osmfoundation.org/policies/tiles/) |

**Orden de magnitud (estimación mía, no medida):** en «posición al pulsar» el mapa solo lo abre el dueño en el panel. Con unas 20 aperturas al día y 22 días, salen unas 440 cargas al mes por negocio: un proveedor con 10.000 gratis cubre unos 20 negocios activos antes de pagar. **Ninguna opción es «gratis y segura»**: OSM no da garantía, MapTiler gratis no permite uso comercial y Google pide tarjeta. Por eso es STOP.

## 4 · Datos del técnico — **STOP: lo decide J4, no S0**

La posición es un dato personal **del empleado**. El marco es el **art. 90 LOPDGDD**. Texto tomado de una transcripción completa ([Iberley](https://www.iberley.es/legislacion/articulo-90-ley-organica-proteccion-datos-personales-garantia-derechos-digitales-lopdgdd)); **⚠ pendiente de cotejar con el BOE consolidado**, porque la página del BOE llegó truncada:

> «1. Los empleadores podrán tratar los datos obtenidos a través de sistemas de geolocalización para el ejercicio de las funciones de control de los trabajadores o los empleados públicos previstas, respectivamente, en el artículo 20.3 del Estatuto de los Trabajadores y en la legislación de función pública, siempre que estas funciones se ejerzan dentro de su marco legal y con los límites inherentes al mismo.
> 2. Con carácter previo, los empleadores habrán de informar de forma expresa, clara e inequívoca a los trabajadores o los empleados públicos y, en su caso, a sus representantes, acerca de la existencia y características de estos dispositivos. Igualmente deberán informarles acerca del posible ejercicio de los derechos de acceso, rectificación, limitación del tratamiento y supresión.»

**Lo que esto implica para el diseño** (lectura de S0, **no dictamen**; lo confirma J4 o el asesor):
* El **responsable es el profesional** (empleador); YaQu es encargado. Hace falta que el profesional **informe antes** a su técnico. ¿Lo pedimos en la pantalla? ¿Con qué texto? → J4 y firma.
* **Proporcionalidad:** la versión «posición al pulsar» recoge un punto por acción de trabajo. La continua recoge un rastro de la jornada entera, y **fuera de la jornada no hay base**. Por eso la recomendación va hacia la primera.
* **Histórico:** si se guarda dónde ha estado alguien, ¿cuánto tiempo? ¿Quién lo ve? ¿Lo ve el propio técnico? → J4. **Esta propuesta no guarda un rastro continuo.**

**Preguntas para J4** (no las contesto yo):
1. ¿Basta el art. 90.2 (información previa) o además hace falta un análisis de impacto o un registro de actividad nuevo para el profesional?
2. Conservación de la posición por acción: ¿qué plazo?
3. ¿El técnico puede apagarla? Tradify lo permite. Si puede, ¿qué ve el dueño: «ubicación desactivada» o nada?
4. ¿Encaja con el registro de jornada obligatorio (SCRUM-913, fichaje) o se mantienen separados?

## 5 · Qué se puede hacer en una web, y qué no

* La geolocalización del navegador exige **HTTPS** y **permiso explícito** del usuario ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)). YaQu cumple lo primero; el permiso lo daría cada técnico.
* **Segundo plano:** el navegador **deja de informar la posición** con la pantalla apagada o la app en segundo plano, y **no existe API web** para posición continua en segundo plano. Eso sí lo tienen las apps nativas de iOS con `CLLocationManager` ([resumen con fuentes](https://progressier.com/pwa-capabilities/geolocation); ⚠ fuente secundaria, no documentación de Apple).
* ⇒ En la web solo es **fiable** la posición **en el momento en que el técnico pulsa algo con la app delante**, que es justo el modelo de Jobber.

## 6 · Las dos versiones

| | A · posición al pulsar (recomendada) | B · mapa en vivo continuo |
|---|---|---|
| qué | Al pulsar «Llego», «Empiezo» o «Termino» en un Trabajo, se guarda su posición (si el técnico dio permiso). El dueño ve en un mapa el último punto de cada técnico, con la hora. | Posición cada pocos minutos durante la jornada. |
| cabe en una web | **sí** | **no** (se corta en segundo plano) |
| RGPD laboral | un punto por acción de trabajo (proporcional) | rastro de jornada; más exigente |
| esquema | ALTER aditivo: lat/lng/precisión/hora en el evento del Trabajo | tabla de posiciones + retención |
| tamaño | **M** (S1 servidor + S2 mapa) | **L** + app nativa |
| STOP | coste/dependencia (§3) + J4 (§4) + textos (regla 39) | lo mismo + app nativa |

**No se enciende nada:** no hay nada «ya hecho a medias» que activar.

## 7 · Recomendación

**TODAVÍA NO.** La decisión del 21-sep la deja detrás de SIF-1 8/8, y nada de lo medido lo cambia. Cuando toque, **SÍ a la versión A** con estas tres decisiones previas, en este orden: ① J4 responde las 4 preguntas del §4; ② el fundador elige proveedor y acepta el coste (§3); ③ firma de los textos (aviso al técnico y rótulos). **NO a la versión B** mientras YaQu no tenga app nativa.
