# Tres propuestas de producto, priorizadas · lo que aún no tiene ticket

21-sep-2026 12:46Z (hora de GitHub) · medido sobre `origin/main` c090a0b49f3831ceb522599d1127d08c31d7515c
· Sesión 0 · **no abre tickets** (los abre el orquestador) y **no toca `src/` ni `public/`**.

Marcas: 👁 visto dentro de la aplicación · 📄 solo su documentación o su web · 🔒 detrás de plan, login
o un 403 que no se eludió. «Nosotros» = medido **leyendo** el código de `origin/main`, con su suelo.
Ninguna de las tres toca facturas, VeriFactu ni claims fiscales.

## Cómo se filtró (y hasta dónde llega el filtro)

La matriz (`matriz.md`) trae **21 propuestas numeradas** (§10.1-10.3, §11.4.1-3, §12.3.1-3, §13.3.1-3,
§14.3.1-3, §15.3.1-3, §16.4.1-3) **y 2 candidatas apuntadas** (§16.5 A y B) = 23.

**13 de las 23 ya tienen ticket** y no se repiten: 967 (portal), 968 (caducidad 7/15/30), 971 (gasto por
WhatsApp), 975 (voy de camino), 979 (última visita), 980 (historial en la ficha), 981 (aviso de visita), 982
(nota del cliente), 984 (presupuesto → albarán), 986 (chip «Leído» en la lista), 987 («Válido hasta» en el
PDF) y **914 (equipos del cliente), que cubre §13.3.1 y §14.3.3**. (SCRUM-983 no cuenta: es un defecto, no
una propuesta.) **Quedan 10 sin ticket**: §10.2, §11.4.2, §11.4.3, §12.3.2, §12.3.3, §13.3.2, §13.3.3,
§15.3.2, §16.4.2 y la candidata B.

🔴 **Error mío, cazado por el orquestador (A9):** la propuesta 1 se presentó como «sin ticket» y **ya
existía SCRUM-914** (creado el 17-sep, «Tareas por hacer», sin etiquetas). Causa medida: la primera
búsqueda de Jira acotó `created >= 2026-09-18` y era la única que incluía «equipo»; las demás no lo
incluían. **914 es del 17-sep y se escapó.** La propuesta 1 sigue en el documento porque aporta algo que 914
no dice (el recorte v1 de Housecall Pro y el orden detrás de 980), pero **no es un ticket nuevo**: el
orquestador la ha comentado en 914.

⚠️ **Límite del filtro:** el cruce con Jira fue por **palabras del resumen** (`summary ~ …`), no por
lectura de todos los tickets. Un ticket con otro título, o creado antes de la fecha acotada, **no lo
habría visto**, y ya ha pasado una vez. Cinco de los 10 sin ticket (§10.2, §12.3.2, §12.3.3, §13.3.2,
§13.3.3) **no se han vuelto a medir hoy contra el código**: no entran en el top 3, pero tampoco se declara
que sigan vigentes.

## 1 · Equipos v1: el aparato de cada cliente · **MEDIANO** · ya existía como SCRUM-914

**En Housecall Pro** 📄 (manual y capturas, nadie lo ha visto dentro), la ficha del equipo pide **dos
campos** (tipo y nombre); marca, modelo, serie, «instalado en» y notas son opcionales. Se da de alta desde
el trabajo y desde la dirección, y se ata al plan de servicio. **ServiceM8** 📄 exige campos obligatorios
por tipo, que es justo lo que HCP evita. Capturas en `capturas/housecall-pro/` y `capturas/servicem8/`.
**Nosotros** no tenemos la cosa, solo la periodicidad: 0 modelos de equipo en `prisma/schema.prisma`
(suelo: `model Customer` y `model Job` sí salen), 0 `equipmentId`/`equipoId` en `src/`, `public/` y
`prisma/` (suelo: la misma búsqueda sí encuentra `MaintenancePlan`); `MaintenancePlan`
(`schema.prisma:1256`) lleva un `title` escrito a mano e `intervalMonths`, y no apunta a nada;
`MAINTENANCE_ENABLED: false` (`src/core/flags.ts:37`).
**El profesional gana** saber qué aparato tiene cada cliente y qué se le hizo, que es lo que convierte un
aviso de revisión en un ingreso que se repite. *Pregunta, no hecho:* si el padre del fundador (electricidad
y seguridad) apunta hoy los aparatos en algún sitio. Desde aquí no se puede medir.
**Se construye así:** un modelo `Equipo` que cuelga **del cliente** (obligatorios tipo y nombre) más un
`equipoId` opcional en `ParteTrabajo` y en `MaintenancePlan`; alta desde la ficha del cliente y desde el
parte; y una lista dentro de la ficha, que **es la pestaña de SCRUM-980** (En curso, S1). Por eso va
**después de 980**. Sin tipos configurables, sin QR (§13.3.2 queda para después), sin mapa.
**Frenos:** ALTER aditivo en las tres bases con `node scripts/preview-migracion.mjs` (A5; lo aplica Javier)
· encender MANT-1 para todos es **STOP del fundador** (Parte P) · es el primer modelo nuevo del camino CRM,
y lo decide el fundador · los rótulos necesitan firma (regla 39). Sustituye a §13.3.1 y a §14.3.3, no se suma.

## 2 · Enviar el albarán a firmar en UN toque · **MEDIANO**

**En Verifacturamos y FacturaDirecta** 📄 el albarán se crea y se manda por WhatsApp o email y el cliente
confirma; FacturaDirecta dice que recoge la firma en la pantalla del móvil al entregar. **Lo único visto
dentro** 👁 en Verifacturamos es el formulario de alta, con «Guardar borrador» y «Marcar como entregado»:
**no se vio ningún envío**. Qué hay debajo de ese «crear y enviar» no se sabe.
**Nosotros** llegamos al mismo destino con **cuatro botones del profesional**: «Crear albarán»
(`POST /admin/jobs/:id/albaranes`, `jobs.routes.ts:1140`), «Emitir albarán» (`jobNextAction.js:141` →
`POST /admin/albaranes/:id/emitir`, `albaranes.routes.ts:871`), «Enviar para firmar» (`jobNextAction.js:139`
→ `albaranes.routes.ts:1170`) o «Firmar aquí mismo».
**El profesional gana** cerrar la entrega **en la puerta del cliente** con un toque en lugar de tres.
**Se construye así:** en la hoja de alta, un segundo botón que encadena las tres rutas que ya existen; sin
ruta nueva ni esquema. Si el envío falla, el albarán queda **emitido** y la escalera ya ofrece «Enviar para
firmar». Es **el mismo envío manual** de hoy, no uno automático: no entra en la tabla J6.
**Frenos:** choca con decisiones escritas y hay que firmarlas: SCRUM-366 (la escalera es *un paso, un
botón*) y SCRUM-841 (emitir congela al cliente: el profesional dejaría de ver el paso intermedio); el guard
de SCRUM-303 obliga a que el botón viva en `jobDetailView.js`; y **SCRUM-984 (En curso, S4) toca la misma
zona**: secuenciar detrás. Rótulo con firma.

## 3 · Decir POR QUÉ un campo de la lectura del ticket vino vacío · **PEQUEÑO, con plazo**

**En Holded** 👁 (cuenta de prueba del 17-sep) el escáner de gastos, cuando no se fía, **no rellena** y lo
marca **Revisar**; el borrador solo se crea si no detecta inconsistencias y hay confianza alta.
**Nosotros** calculamos algo mejor: nueve motivos de descarte por campo, con `no_cuadra_con_el_total`
(comprobación aritmética real), y **ya los devolvemos**: `leerTicket` retorna `{ propuesta, descartados,
justificante, modelo }` (`lecturaTicket.ts:349`) y la ruta lo reenvía (`expenses.routes.ts:256`). Pero
**ninguna pantalla llama a esa ruta**: `leer-ticket` en `public/` → **0** (suelo: 2 ficheros en `src/`), y
el expediente de SCRUM-920 no lo menciona (0 coincidencias de `descartad|motivo|leer-ticket|no_cuadra`).
**El profesional gana** pasar de un hueco en blanco (coger el ticket otra vez y teclear) a *«el IVA que leí
no cuadraba con el total»*, que se corrige en cinco segundos y enseña a hacer mejor la foto.
**Se construye así:** pintar el motivo junto al campo vacío, con el texto `es-ES` de los nueve motivos,
**dentro del diseño de SCRUM-920 (Gastos)**. Sin esquema, dinero, fiscal ni Meta.
**Plazo:** es un requisito del diseño de 920; añadirlo cuando la pantalla ya esté hecha cuesta el doble.
Los textos necesitan firma (N5).

## Qué pasó con cada una (según el orquestador, tras recibirlas)

- **1 (equipos):** comentario en **SCRUM-914**, que ya existía; no se duplica.
- **2 (albarán a firmar en un toque):** ticket nuevo **SCRUM-993**.
- **3 (motivos del campo vacío):** aviso urgente en **SCRUM-920** y a S4, antes de que termine la pantalla.

## Fuera del top 3 (sin ticket; por si el fundador prefiere otra)

- **Suscripción de calendario por token** (Tradify 📄; mediano). Ya existe un `.ics` **por trabajo**
  (`jobs.routes.ts:1099`, «Añadir a mi calendario»); no es una suscripción. Superficie pública nueva y
  choca en parte con la matriz X1 («JOB-1 cubre»). Evidencia de demanda: ninguna medida.
- **Traer clientes desde `.xlsx`** (Verifacturamos y FacturaDirecta 📄; mediano). Dependencia nueva = regla 36.
- **Bandeja de entradas de gastos** (Holded 👁; grande). Espera a 971 y a 920.
- **Murió al medirnos:** «primeros pasos» y datos de ejemplo de Verifacturamos 👁. Ya hay un asistente de
  3 pasos hasta la primera cotización (`onboardingView.js`). *Pregunta, no medida:* si hay un checklist con
  progreso después.

## Fichaje (SCRUM-913) y mapa en vivo (SCRUM-989): el veredicto

**913 va ANTES que 989.** El suelo legal de 913 está en `docs/legal/REGISTRO_JORNADA_ES.md` (entró en el
#1577); su paso 2 (diseño y diff aditivo de esquema) es de S1.

- **Fichaje = diferenciador real en España, pero solo si es el registro legal y va atado al parte.** Con un
  botón «fichar» suelto es relleno. Solo aplica con empleados. Holded lo vende aparte 📄 (`matriz.md` §4,
  fila 11: en la gema de RR.HH., desde 1,5 €/empleado/mes). **No está medido cuáles de Billin, FacturaDirecta,
  Contasimple y Anfix lo tienen:** la última fila de §16.2 agrupa «stock, bancos, contabilidad, modelos, TPV,
  fichaje» para los cuatro sin separarlos. (Una versión anterior de mis notas decía que «ninguno lo tiene»: no
  estaba sostenido y se retira.) **Tradify tiene mapa SIN fichaje**: su ayuda dice *«Tradify doesn't yet
  offer the functionality»* de que el trabajador registre su entrada y salida 📄 (no reconciliado con §15,
  que anota «cronómetro y hojas de horas» de Fergus y Tradify, que pueden ser tiempo por trabajo y no fichaje).
- **Mapa en vivo = paridad, NO propuesta propia.** Lo tienen ServiceM8, Housecall Pro, Fergus y Tradify 📄
  (Jobber no se leyó: su página dio 403 y no se eludió), y todos lo recortan por plan, horario o interruptor
  del empleado. ServiceM8: *«Staff members who have installed the ServiceM8 mobile app and allowed GPS access
  will be visible on the Dispatch Map whenever they are Clocked On»* y *«will not be shown on the Dispatch Map
  while they are Clocked Off or On Break»*. Fergus: *«Professional Plan feature only»*. Housecall Pro: *«If
  Employee GPS Tracking is included in your plan»*. Una PWA no tiene ubicación en segundo plano: lo honesto
  sería «última posición con la app abierta». Coste real: proveedor de mapas, geocodificar direcciones, tabla
  de posiciones y la decisión de RGPD del empleado (la AEPD acota la geolocalización para el registro horario;
  §8 del documento legal). Si se hiciera, como subproducto de 913 y acotado al turno (patrón ServiceM8).
- **Nosotros, hoy:** 0 proveedor de mapas, `navigator.geolocation` ni geocodificación en `src/` y `public/`
  (búsqueda `navigator\.geolocation|google\.maps|mapbox|leaflet|geocod`); 0 columnas `lat`/`lng`
  `Float|Decimal` en `schema.prisma`; solo un enlace «abrir en el mapa» por dirección
  (`jobRailBlocks.js:94`, que es el suelo de la búsqueda). **«Trabajos de hoy» → 0** en `src/` y `public/`:
  el ticket 989 dice «como el de Trabajos de hoy», y **ese mapa no existe**: la base es cero.
- **Citas literales** comprobadas contra las páginas guardadas (22 ficheros, 5 de 5 halladas). Las páginas
  están **fuera de git** (`C:\Users\Admin\s0-906-traspaso\gps-fichaje\`, máquina de Luis): quien quiera
  re-verificarlas las vuelve a bajar de las URL públicas de cada ayuda.

## Corrección a la matriz (A9)

`matriz.md` §16.4.2 dice que el alta del albarán es `POST /albaranes`. **No lo es**: es
`POST /admin/jobs/:id/albaranes` (`jobs.routes.ts:1140`). No se edita `matriz.md` aquí porque el PR #1572
lo modifica y sigue abierto; **corregirlo cuando #1572 entre**.

## Cómo se midió (reproducible, sobre un worktree fijado a `origin/main`)

```text
git grep -n -E '^model (Asset|Equipment|Equipo|Activo|Installation)\b' -- prisma/schema.prisma   -> 0
git grep -n -E '^model (Customer|Job)\b' -- prisma/schema.prisma                                 -> 2  (suelo)
git grep -n -E 'equipmentId|equipoId|equipoInstalado' -- src public prisma                       -> 0
git grep -n 'MaintenancePlan' -- src public prisma                                               -> 2  (suelo)
git grep -n 'MAINTENANCE_ENABLED' -- src/core/flags.ts                                           -> false
git grep -n -E "router\.post\('/:id/(emitir|enviar-para-firmar|albaranes)'" -- src/modules/jobs   -> 3 rutas
git grep -n -F 'leer-ticket' -- public                                                           -> 0
git grep -n -F 'leer-ticket' -- src                                                              -> 2  (suelo)
git grep -n 'descartados' -- src/modules/expenses/domain/lecturaTicket.ts                        -> :349 (retorno)
```

## Lo que NO se midió

- **Nada de esto se ha visto ejecutándose**: es lectura de código. Ni cuántos toques cuesta de verdad
  ninguna de las tres, ni con un usuario.
- **Demanda real:** no se sabe cuántos clientes de YaQu tienen aparatos que seguir, ni cuántos entregan en
  la puerta del cliente. Solo hay un usuario real y no se le ha preguntado.
- **Los competidores 📄** se leen por su documentación; lo que hacen por dentro, salvo Verifacturamos y
  Holded (👁), no se sabe.
- **Cuentas de prueba:** en esta sesión no se ha entrado en ninguna (decisión del orquestador).
