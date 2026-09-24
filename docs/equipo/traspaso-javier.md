21-sep-2026 16:30Z · medido sobre `origin/main = beef7b362ed44a7bb431ab4f145879f11abd0c24` · worktree `cobroflash-orq`

# TRASPASO DEL EQUIPO DE JAVIER — estado

Este documento es el **ESTADO** del equipo de Javier. El **MÉTODO** es `orquestador.md` (común a los
dos equipos) y lo que cambia para éste, `orquestador-javier.md`. Los **LÍMITES** son
`limites-del-fundador.md`. **Si algo de aquí contradice a una medición de hoy, gana la medición.**

> **Por qué existe.** Los dos orquestadores **no pueden hablarse**: máquinas distintas, cuentas
> distintas, y la memoria de una máquina no la ve nunca la otra (`dos-equipos.md` §5). Lo único que ven
> los dos equipos es **Jira y el repositorio**. Éste es el hermano de `traspaso.md`, que es el del
> equipo de Luis: **cada orquestador escribe el suyo y lee el del otro al arrancar** (§5.5).

*(Segunda escritura, SCRUM-995b. La primera, de las 13:28Z de hoy, **nació desfasada en dos horas**:
decía que J2-J5 no estaban levantados y no recogía la enmienda. Se reescribe entera; el historial queda
en git. La lección va aquí porque vale para los dos equipos: **un traspaso escrito a media tanda
caduca antes de que alguien lo lea.**)*

## 1 · El objetivo vigente de este equipo

**SIF-1 es la prioridad absoluta**, por decisión de Javier del 18-sep-2026 (SCRUM-612, comentario
15950): «**B: no se cobra hasta que no haya factura. La factura en formato correcto, Verifactu, es
nuestro cuello de botella y prioridad.**»

## 2 · 🔴 LO QUE CAMBIÓ HOY, Y AFECTA A LOS DOS EQUIPOS

**La enmienda de SCRUM-612 está en `main`** (PR **#1593**, 21-sep 14:55:34Z). Javier, como jefe,
contestó las **siete preguntas P-1…P-7** y ordenó aplicarla. **24 reemplazos: 21 en el máster y 3 en
`CLAUDE.md`.** Expediente y controles en `docs/master/SCRUM-612.md` §SCRUM-612c.

**La regla 24 ahora dice:** con `INVOICING_ES_ENABLED` en OFF, en España, **YaQu no emite ningún
documento y no cobra a los clientes del profesional** — ni enlace de pago, ni señal, ni recordatorios,
ni «marcar como cobrada», ni pantalla de Cobros, ni recibo público. Presupuestos, firma, albaranes y
partes **siguen igual**. Dos matices decididos el 21-sep: **el merchant demo sigue** emitiendo con
marca de agua y cobrando en TEST (P-1), y **un enlace de pago ya enviado sigue cobrando** (P-2).

### 2.1 · Lo que eso abre, y toca al equipo de Luis

🔴 **El máster y el argumentario de venta se contradicen desde hoy.** J4 verificó contra el `main` de
hoy las **12 líneas comerciales** que §4 de `docs/master/SCRUM-612.md` había señalado: **11 siguen
exactas** y 1 se resolvió con la respuesta P-4. Las de mayor gravedad son **`public/index.html` y
`public/precios.html`**, que **hoy le dicen a un visitante real que YaQu le cobra**. Esas páginas son de
**S2/S4** y su copy lo firma un jefe. Análisis y literales propuestos: **SCRUM-1016**.

**Dato para decidir el ángulo de venta, medido por J5** (SCRUM-1016 y `docs/competencia/`): de **13
competidores, 0 usan el cobro como titular**; **9 de 13 sí ofrecen cobro online**, pero como función
secundaria. **No es que no puedan prometerlo: eligen no abrir por ahí.**

### 2.2 · El reloj: el camino REGENERA documentos

| cuándo | qué | fuente |
|---|---|---|
| 8-sep | borrado del fundador: producción **a 0 documentos**, verificado con seis vistas | SCRUM-825 fase 1 |
| **20-sep 20:42** | **aparece un justificante nuevo** — merchant 18, **que no es el demo** (demo = id 1) | consulta de E-4, pegada por Javier el 21-sep |
| 21-sep 14:55Z | la enmienda entra en `main` | PR #1593 |

**Dos mediciones independientes separadas por doce días: no quedaron restos, el camino los fabrica.**

**E-4 queda RESUELTA:** producción tiene **1 documento y es un justificante**; staging, **9, todos
JUST**; `F1 = 0` y `R1 = 0` en las dos — **YaQu no ha emitido nunca una factura fiscal en producción**.

⚠️ **Control que falló y hubo que rehacer, y vale para quien mida bases:** `current_database()` devuelve
**`railway` en las dos** (nombre por defecto de Railway): **no identifica nada**. Se resolvió corriendo
lo mismo en las dos y comparando, más la corroboración de los 9 de staging ya medidos el 18-sep.

## 3 · Los puestos, y en qué están (21-sep 16:30Z)

Los puestos y áreas están en `dos-equipos.md` §2.2 y §3. **Las sesiones se relevan, los puestos no**
(A19). Sus traspasos viven en la memoria de la máquina de Javier y **el otro equipo no los ve**.

| puesto | en qué está |
|---|---|
| **J1** · Facturación y VeriFactu | **SCRUM-1027** (que con el flag en OFF deje de generarse el documento; **GO de Javier para CONSTRUIR, no para desplegar**) y después **SCRUM-825 fase 2**, que es el expediente para la firma, no código |
| **J2** · Clientes y cobro | SCRUM-1018 y 1022, que le llegaron de J5 |
| **J3** · Alta y crecimiento | qué promete hoy el alta a un merchant ES que ya no puede cobrar |
| **J4** · Legal y cumplimiento | `docs/legal/ALCANCE_BETA.md`, que es lo que un founding firma **antes de pagar** |
| **J5** · Competencia y producto | las 7 entradas de la matriz que nadie ha re-medido |
| **J6** · Calidad y seguridad | SCRUM-908 y `vigia-atascados` |

**Medido hoy y útil para los dos equipos:** `area-j3` tiene **1 ticket** y el tramo del alta **está
peinado** (6 tickets cerrados lo cubrieron). Que nadie gaste una tanda redescubriéndolo.

## 4 · Lo que este equipo le debe al de Luis, y al revés

**Abierto por este equipo hacia el vuestro, hoy:**

| ticket | qué |
|---|---|
| **SCRUM-1024** · `area-s1` | **los CUATRO defectos que cortan «del alta al primer presupuesto» son los cuatro vuestros** (969, 967, 1001, 893). El patrón es el hallazgo: con la enmienda, ese tramo **ya no es la mitad del producto en España, es TODO** |
| **SCRUM-1001** · `area-s1` | la página del cliente promete un pago que luego no está. **Literal FIRMADO por Javier** dentro |
| **SCRUM-1011** · `area-s5` | `lanzar` devuelve **LANZADA y exit 0** sobre sesiones que **no arrancan** (4 de 4). ⚠️ La hipótesis del «tope de 2» **quedó REFUTADA** por su propio autor con una predicción declarada antes de medir |
| **SCRUM-1026** · `area-s5` | una sesión **bloqueada** esperando un permiso **parece viva**; 2 casos, uno de ~30 min |
| **SCRUM-1007** · `area-s5` | `relevar` **no puede dar verde nunca** por el camino que manda su propio protocolo |
| **SCRUM-997** · `area-orquestador` | escribir en `limites-del-fundador.md` la decisión de Javier: **no se vende en País Vasco ni Navarra de momento** |
| **SCRUM-957** · `area-s0` | la trampa de `wmic` (Windows 11 ya no lo trae) |

**Recibido del vuestro:** el dato de la S5 sobre la mudez del meta-guard (comentario 16159 de
SCRUM-908); **SCRUM-1000** (el arranque automático: **ya estaba instalado aquí desde el 18-sep** — lo
que falta no es montarlo, es que el PC esté encendido a esas horas); y el aviso de **SCRUM-999**.

⚠️ **Hueco de la norma, para la S0:** `dos-equipos.md` §4 exige dos etiquetas (equipo + área) y **no hay
ninguna para el orquestador**, aunque §3.3 le asigna ficheros propios. Se usa `area-orquestador` a falta
de otra cosa.

## 5 · Recursos compartidos, medidos en esta máquina

- **Turno de suite completa:** es **por máquina**. Umbral medido el 18-sep (PC de 16.299 MB): **2.200 MB
  libres y ninguna otra suite**. Hoy lo tiene J6.
- **Rojos conocidos de esta máquina**, que no son del producto: 3 de `scrum939b` (`gh` sí está instalado
  aquí) y 1 de `scrum858b` (`wmic`, SCRUM-957).
- **Staging:** el turno es un cerrojo en la propia base y vale entre máquinas.
- ⚠️ **Merchant QA de staging: COMPARTIDO y PENDIENTE de un jefe** (`dos-equipos.md` §5.1 y §7). Cada
  siembra de este equipo se declara en su ticket.
- **Los ALTER los aplica Javier para los DOS equipos** (A5). Esperando su ALTER: SCRUM-529 y 779
  («Acción del fundador»), 913 y 914 («Por hacer»), 674 (En curso, del equipo de Luis).

## 6 · Trabajo commiteado que no está en ningún remoto

Medido con `node scripts/equipo/huerfanos.mjs`: `cobroflash-b24` (`scrum-637-verificacion-s5`, 8-sep) y
`cobroflash-b12` (`scrum-744-guard-por-la-accion`, 4-sep). **No son de este equipo y no se tocan**;
pendientes de decidir con Javier.

## 7 · La máquina y su arranque automático

- Instalación en `AppData\Local\yaqu-equipo`. Prefijo **`jv-`**, puestos `orquestador,j1…j6`, tandas
  **08:25, 13:30 y 18:35** (media hora corridas respecto a las del equipo de Luis).
- 🔴 **Las tres tareas programadas NO se han ejecutado NUNCA.** Medido por tres vías independientes
  («última ejecución: nunca», `arranque.log` inexistente, cero eventos en el registro del Programador).
  **Causa confirmada por Javier: el PC estuvo apagado a esas horas.** Llevan `StartWhenAvailable: False`,
  así que **una cita perdida no se recupera**. Javier decidió mantener esas horas: **hoy el equipo sólo
  arranca a mano.**
- ⚠️ **La copia instalada de `sesion.mjs` se queda vieja si no corre ninguna tanda**, y entonces
  `puertaDeIntegridad` la rechaza (`ALTERADO`) y **no se puede lanzar ni relevar nada**. Es **SCRUM-991**,
  ya abierto por vosotros; confirmado desde esta máquina. Se arregla refrescándola desde `origin/main`
  con la misma línea que usa `arranque.cmd`.
- **Trampas de esta máquina:** `FORCE_COLOR=0` en todo · el cwd del shell vuelve a `cobroflash-backend`
  tras cada comando · `gh` en `"C:/Program Files/GitHub CLI/gh.exe"`, fuera del PATH · 🔴 **una sesión de
  fondo que usa EnterWorktree se queda bloqueada pidiendo un permiso que nadie puede contestar** (dos
  casos hoy) · las sesiones de fondo **no ejecutan** el `statusLine`, así que el aviso de uso sólo lo
  alimenta una conversación interactiva · **un worktree nuevo nace sin `node_modules`** y
  `guards:entrada` falla hasta hacer `npm ci` · al escribir en Jira, **un enlace en Markdown puede
  perderse en la conversión a ADF sin avisar**: se relee el cuerpo devuelto y se ponen las URL en texto
  plano.

## 8 · Autorizaciones

**No se heredan** (A19), ni entre sesiones ni entre tandas. Al 21-sep 16:30Z:

- **Lanzar sesiones de fondo:** autorizado por Javier el 21-sep.
- **Construir SCRUM-1027**, que toca el camino de emisión: **GO expreso de Javier**, literal, «825 tal
  cual y el atajo también». 🔴 **Ese GO NO incluye desplegar:** empujar es desplegar, y en el camino del
  cobro **el sí lo escribe un jefe en el chat de la sesión** (`orquestador-autonomo.md` §7).
- Sin autorizaciones de base de datos ni de datos de clientes. **Las consultas de producción de E-4 las
  pegó Javier**; ninguna sesión toca producción.
- **Este orquestador NO tiene delegada la firma de microcopy** (`orquestador-javier.md` §3): propone el
  literal y firma un jefe. La delegación que el fundador dio al orquestador de Luis **no se supone**
  para éste.
