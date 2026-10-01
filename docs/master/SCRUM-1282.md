# SCRUM-1282 · `sesion.mjs contexto` acepta los nombres con los que trabaja el equipo (primera parte, antes de la A19)

**Rama:** `scrum-1282-lista-blanca-sesion` · **Carril:** S5 · automatización (s5-29d) · **Fecha:** 29-sep-2026
**Medido contra:** `origin/main` = `f9b5cdbf74901a1a7dd34d7caa27596628827328` · 2026-09-29T17:28:50Z

## Qué pasaba

`sesion.mjs contexto <nombre>` da la magnitud buena para decidir un relevo: input + cache_read +
cache_creation del último turno del jsonl. Pero estaba **inservible**. Pasaba por la lista blanca del
equipo (`orquestador`, `sesion-0..5`) y rechazaba con NOMBRE-NO-PERMITIDO los nombres con los que se
trabaja de verdad. Por eso todas las sesiones restaban a mano. **Una herramienta que existe y no se
puede usar es igual que no tenerla.**

## El cambio

`contexto` **solo lee**: busca el nombre por `===` en `claude agents --json` y lee un jsonl. Ya no pasa
por la lista blanca y le basta una FORMA de nombre segura (`validarNombreDeLectura`: letras, números,
`.`, `_` y `-`, hasta 64, sin empezar por signo). La lista blanca estricta **se queda** en lanzar,
relevar, parar y olvidar, que son las acciones que actúan sobre procesos. Se distingue por lo que hace
la orden, no por quién la pide.

## Medido, con las funciones del módulo sobre las sesiones vivas (29-sep-2026)

| nombre | antes | ahora | contexto del último turno |
|---|---|---|---|
| `s5-29d` | NOMBRE-NO-PERMITIDO | ok | 258.528 tokens · 285 turnos |
| `cobroflash-backend-57` (orquestador) | NOMBRE-NO-PERMITIDO | ok | **646.130 tokens · 4.169 turnos** |
| `s3-29e` | NOMBRE-NO-PERMITIDO | ok | 105.898 tokens · 22 turnos |
| `../x`, `--help` | rechazado | rechazado (NOMBRE-INVALIDO) | — |

**Es la primera vez que se mide el contexto del orquestador.** Hasta hoy era imposible, porque la
herramienta rechazaba nuestros propios nombres, y los relevos se decidían con una resta hecha a mano
sobre un número que nadie había validado. La cifra de `s5-29d` cuadra con «15M − restantes»
(259.539) a unos mil tokens.

⚠️ El cambio llega a la copia **instalada** cuando se mergea: la puerta de integridad compara esa copia
con `origin/main`.

`tests/scrum1282-contexto-nombres-de-hoy.test.mjs`: los nombres de hoy se aceptan, lo que no tiene
forma de nombre se rechaza (control positivo), la lista blanca de las acciones que actúan no cambia,
y la acción `contexto` usa la validación de lectura. Tiene dos mutaciones, las dos comprobadas en rojo.

## Lo que falta de este ticket (sin empezar)

**La A19 reescrita con esta magnitud.** La medición de s5-29c (comentario 17569) corrige la premisa:
«15M − restantes» **no** es consumo acumulado. En su sesión coincidía con la ocupación de ventana, y el
acumulado de sus 288 turnos habría sido de decenas de millones. 🔴 **Queda ABIERTO, y la norma tiene
que decirlo: no se sabe qué hace ese contador DESPUÉS de una compactación.** Es una sola medida, y sin
compactación por medio.
