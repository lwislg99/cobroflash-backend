21-sep-2026 13:28Z · medido sobre `origin/main = 1dd09882fefa41186e9852c5bb39f20d4aa495d8` · clon `cobroflash-backend` (el del orquestador de Javier)

# TRASPASO DEL EQUIPO DE JAVIER — estado

Este documento es el **ESTADO** del equipo de Javier. El **MÉTODO** es `orquestador.md` (común a los
dos equipos) y lo que cambia para éste, `orquestador-javier.md`. Los **LÍMITES** son
`limites-del-fundador.md`. **Si algo de aquí contradice a una medición de hoy, gana la medición.**

> **Por qué existe.** Los dos orquestadores **no pueden hablarse**: máquinas distintas, cuentas
> distintas, y la memoria de una máquina no la ve nunca la otra (`dos-equipos.md` §5). Lo único que
> ven los dos equipos es **Jira y el repositorio**. Éste es el hermano de `traspaso.md`, que es el
> del equipo de Luis: **cada orquestador escribe el suyo y lee el del otro al arrancar**
> (`dos-equipos.md` §5.5). Nace tarde, en SCRUM-995: el equipo existe desde el 18-sep y hasta hoy
> el equipo de Luis no tenía ninguna forma de saber en qué estábamos.

## 1 · El objetivo vigente de este equipo

**SIF-1 es la prioridad absoluta**, por decisión de Javier del 18-sep-2026 (SCRUM-612, comentario
15950), literal: «**B: no se cobra hasta que no haya factura. La factura en formato correcto,
Verifactu, es nuestro cuello de botella y prioridad.**»

Su consecuencia, ya decidida y escrita: con el interruptor de facturación en OFF, **ni documento ni
cobro por YaQu**. La decisión anterior del mismo día (comentario 15946, E-1) decía la primera mitad:
«Nada hasta que factura no esté lista no hay documento. No nos andamos con medias tintas.»

⚠️ **Lo que esto NO alcanza:** el **merchant demo** (id=1) sigue emitiendo factura con marca de agua y
cobrando en TEST — decisión de Javier del **21-sep-2026** (P-1, comentario 16166). Es coherente con la
regla 24 y con que el modo `demo` se decide una línea antes de leer el interruptor; no es una
excepción nueva.

## 2 · Los puestos, y quién los ocupaba al escribir esto

Los puestos y sus áreas están en `dos-equipos.md` §2.2 y §3; las fichas, en `puesto-j1.md` …
`puesto-j6.md`. Las **sesiones** se relevan, los **puestos** no (A19). Sus traspasos viven en la
memoria de la máquina de Javier (`project_j1_traspaso.md` …) y **el otro equipo no los ve**: lo que
tenga que saber, va aquí o a Jira.

| puesto | sesión | estado el 21-sep 13:28Z |
|---|---|---|
| **J1** · Facturación y VeriFactu | `jv-j1` | **viva**, con SCRUM-955 |
| **J6** · Calidad y seguridad | `jv-j6` | **viva**, con SCRUM-908c |
| **J2** · Clientes y cobro | — | sin levantar. Primer ticket de su ficha: SCRUM-678 |
| **J3** · Alta y crecimiento | — | sin levantar. Primer ticket de su ficha: SCRUM-335 |
| **J4** · Legal y cumplimiento | — | sin levantar. Primer ticket de su ficha: SCRUM-950 |
| **J5** · Competencia y producto | — | sin levantar. Hereda `docs/competencia/` de la S0 |

Un puesto sin cola **no se levanta** (A19 · `orquestador-autonomo.md` §5bis.4): una sesión viva sin
encargo gasta uso y contesta mensajes que no llevan a nada.

## 3 · Los tickets vivos de este equipo

| ticket | quién | dónde está |
|---|---|---|
| **SCRUM-612** | Javier (jefe) | **Acción del fundador.** El expediente de la enmienda al máster está escrito (PR #1520, mergeado el 18-sep). Quedan **7 preguntas P-1…P-7**; **P-1 contestada el 21-sep**, P-2…P-7 abiertas. Es el único ticket del equipo con `decision-jefe` |
| **SCRUM-955** | J1 | **En curso.** Mapa medido de lo que le falta a SIF-1. Censo por AST escrito y **nunca corrido**; rama `scrum-955-mapa-sif1`, commit `7845a57a` **sin empujar** (a propósito) |
| **SCRUM-908** | J6 | **En curso.** El medidor de mutaciones sale mudo. **PASO 0: el defecto EXISTE HOY.** Mecanismo **NO reproducido** (A18): el caso de 908c se calibró con una capacidad que nunca se midió. PR **#1519 en ROJO A PROPÓSITO**, y con **auto-merge armado**: el día que se ponga verde entra solo |
| **SCRUM-957** | S0 (equipo de Luis) | **Por hacer.** Propuesta de este equipo: Windows 11 ya no trae `wmic` y `scrum858b` cae sin haber podido mirar. Texto propuesto dentro |
| **SCRUM-995** | orquestador de Javier | **En curso.** Este fichero |

**Cerrados por efecto en esta tanda:** SCRUM-956 (el filtro de afirmaciones de este equipo,
`afirmaciones-verificadas-javier.md`, en `main` desde el 18-sep por el PR #1521).

## 4 · Lo que este equipo le debe al de Luis, y al revés

- **SCRUM-957** espera a la **S0**: es una trampa de máquina medida aquí, con su texto propuesto para
  `trampas-del-entorno.md`. Sin coger desde el 18-sep.
- **SCRUM-953** (el aviso de uso no arranca si el usuario de Windows lleva un espacio) espera a la
  **S5**. Sin coger desde el 18-sep. Corregido a mano en esta máquina; el instalador sigue igual.
- **SCRUM-908** toca `scripts/meta-guard-mutaciones.mjs`, que es de la **S3**. Decisión del
  orquestador de Javier, y sigue en pie: **J6 no lo toca ni parchea `tests/scrum859`**. Cuando el caso
  esté bien calibrado, el arreglo de raíz se le pide a S3 por Jira. Hasta entonces **es una hipótesis
  con su literal, no un arreglo**.
- **Del equipo de Luis a éste:** la S5 dejó el 21-sep a las 13:08Z un comentario de solo datos en
  SCRUM-908 con un segundo fichero mudo (`vigia-atascados.test.mjs`, run 35601265329). Es la
  observación que la hipótesis de J6 predice.
- ⚠️ **Hueco de etiquetas:** `dos-equipos.md` §4 exige dos etiquetas (equipo + área) y las de área van
  de `area-j1` a `area-j6`. **No hay ninguna para el orquestador**, aunque §3.3 le asigna ficheros
  propios. SCRUM-995 usa `area-orquestador` a falta de otra cosa; la S0 decide el nombre.

## 5 · Recursos compartidos, medidos en esta máquina

- **Turno de suite completa:** es **por máquina**, así que lo da el orquestador de este equipo. Umbral
  fijado el 18-sep midiendo este PC (16.299 MB): **2.200 MB libres y ninguna otra suite corriendo**.
  El 21-sep está **dado a J6**.
- **Rojos conocidos de esta máquina**, que no son defectos del producto: 3 de `scrum939b` (`gh` sí
  está instalado aquí) y 1 de `scrum858b` (`wmic` no existe en Windows 11 — SCRUM-957).
- **Staging:** el turno es un cerrojo en la propia base y vale entre máquinas; se respeta igual.
- ⚠️ **Merchant QA de staging: COMPARTIDO, y sigue PENDIENTE de un jefe** (`dos-equipos.md` §5.1 y §7).
  Hasta que se decida, **cada siembra de este equipo se declara en su ticket**, porque sale en las
  mediciones del otro.
- **Base de desarrollo de Javier:** la aplica su carril; quien la necesite al día **la pide**.
- **Los ALTER los aplica Javier para los DOS equipos** (A5). Esperando su ALTER el 21-sep:
  SCRUM-529 y 779 (en «Acción del fundador»), 913 y 914 (por hacer), 674 (En curso, del equipo de
  Luis).

## 6 · Trabajo commiteado que no está en ningún remoto

Medido con `node scripts/equipo/huerfanos.mjs` el 21-sep 13:15Z — 28 árboles mirados, 0 sin poder
mirar:

| árbol | rama | último commit |
|---|---|---|
| `cobroflash-jv1` | `scrum-955-mapa-sif1` | 18-sep — **es el trabajo vivo de J1**, sin empujar a propósito |
| `cobroflash-b24` | `scrum-637-verificacion-s5` | 8-sep — **pendiente de decidir con Javier**, no es de este equipo |
| `cobroflash-b12` | `scrum-744-guard-por-la-accion` | 4-sep — **pendiente de decidir con Javier**, no es de este equipo |

## 7 · La máquina y su arranque automático

- Instalación: `C:\Users\Javier Pereira\AppData\Local\yaqu-equipo`. Prefijo **`jv-`**, puestos
  `orquestador,j1…j6`, tandas **08:25, 13:30 y 18:35** (media hora corridas respecto al equipo de
  Luis, para no chocar en staging ni en CI).
- 🔴 **Las tres tareas programadas NO se han ejecutado NUNCA.** Medido el 21-sep por tres vías
  independientes: el programador dice «última ejecución: nunca», el fichero `arranque.log` no existe,
  y el registro del sistema no tiene ningún evento suyo en cuatro días. **Causa confirmada por Javier:
  el ordenador estuvo apagado a esas horas.** Las tareas llevan `StartWhenAvailable: False` y
  `DisallowStartIfOnBatteries: True`, así que **una cita perdida no se recupera nunca**. Mientras el PC
  no esté encendido a esas horas, **el equipo sólo arranca a mano**.
- ⚠️ **La copia instalada de `sesion.mjs` se queda vieja si no corre ninguna tanda.** La reescribe
  `arranque.cmd` desde `origin/main` en cada tanda, y `puertaDeIntegridad` se niega (`ALTERADO`) si
  difiere. El 21-sep estaba tres versiones por detrás (SCRUM-954, 959b y 990) y el lanzador no
  funcionaba; se refrescó a mano con la misma línea que usa `arranque.cmd`.
- **Trampas de esta máquina** que van en todo encargo: `FORCE_COLOR=0` · el cwd del shell vuelve a
  `cobroflash-backend` tras cada comando · `gh` está en `"C:/Program Files/GitHub CLI/gh.exe"`, fuera
  del PATH · **una sesión de fondo que usa la herramienta de entrar en un worktree se queda bloqueada
  pidiendo un permiso que nadie puede contestar** · las sesiones de fondo **no ejecutan** el
  `statusLine`, así que el aviso de uso sólo lo alimenta una conversación interactiva.

## 8 · Autorizaciones

**No se heredan** (A19), ni entre sesiones ni entre tandas. Al 21-sep:

- **Lanzar sesiones en segundo plano:** autorizado por Javier el 21-sep para esa tanda, con su frase.
- Sin autorizaciones de dinero, de base de datos, de despliegue ni de datos de clientes.
- **Este orquestador NO tiene delegada la firma de microcopy** (`orquestador-javier.md` §3): propone el
  literal y firma un jefe. La delegación que el fundador dio al orquestador de Luis **no se supone**
  para éste.
