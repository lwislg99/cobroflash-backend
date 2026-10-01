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

---

# SCRUM-1282 · segunda parte: la ocupación sale del LATIDO, leída desde un árbol

**Rama:** `scrum-1282b-ocupacion-en-el-latido` · **Carril:** S5 (s5-1octc) · **Fecha:** 1-oct-2026
**Medido contra:** `origin/main` = `64dc3211d039cedece0cccf9fa3fcaf7d491319d` · 2026-10-01T12:55:00Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

La rama sale de la de SCRUM-1357 (#2084), no de `main`: las dos tocan `scripts/equipo/latido.mjs`.

## Qué pasaba

La primera parte dejó `sesion.mjs contexto` usable. Pero esa orden es de la copia INSTALADA, y su
puerta de integridad la para (`ALTERADO`) en cuanto `sesion.mjs` cambia en `main` y nadie refresca la
instalación. El 1-oct pasó al entrar #2002: todo el equipo se quedó sin la cifra a la vez. s5-1octb lo
curó refrescando la copia; es cura de un día, y volverá a pasar con #2090 (SCRUM-1364), que toca ese
fichero.

## El cambio

`latido.mjs` gana la sección **7 · CONTEXTO**. Importa de `sesion.mjs` sólo sus funciones puras
(`contextoDelJsonl`, `buscarJsonl`, el umbral de la A19 y los estados terminales) y lee el jsonl de
cada sesión viva del registro de trabajos. **La puerta de integridad no se toca**: sigue guardando
lanzar, relevar, parar y olvidar. Esto sólo lee.

| Caso | Qué dice |
|---|---|
| Sesión viva (no terminal, con actividad en 24 h) | su ocupación, en la población de la sección |
| Por encima de 200k (umbral de la A19) | aviso: «se releva AL TERMINAR su entrega», con los minutos desde su último turno |
| Viva y sin jsonl, o ilegible | la sección sale `NO PUDE MIRAR` (salida 2) y enseña las que sí leyó. No es cero |
| Viva y sin ningún turno todavía | se nombra; no es ceguera |
| Transcript reciente (60 min) que no es de un trabajo de fondo | sale como `(sin trabajo de fondo: <8 del id>)`. El orquestador es uno de esos |

## Medido contra las sesiones reales (1-oct-2026, ~12:50Z)

| Sesión | Ocupación |
|---|---|
| (sin trabajo de fondo: ed676fd1) | 421k |
| s3-1octd | 409k |
| s0-1oct | 349k |
| s1-1octc | 297k |
| s2-1octb | 245k |
| s5-1octc (esta) | 244k |
| s1-1octd | 136k |
| s4-1octc | 121k |

Control de la cifra: el contador de esta sesión marcaba 14.757.954 restantes de 15.000.000, o sea
242k, en el turno anterior al que leyó el latido (244k). Coinciden.

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida `tests/scrum1350-latido.test.mjs` | 26 tests, 26 pasan (22 de antes + 4 nuevos) |
| Mutación: el aviso por umbral nunca salta | caen 3 |
| Mutación: una sesión sin jsonl se salta en silencio | cae el CIEGO |
| Mutación: se miran también las terminadas | cae el de ocupación |
| Mutación: «no pude leer» devuelve `null` en vez de `undefined` | cae el de disco |

Las cuatro aplicadas a mano y restauradas. No he corrido la tanda completa en local (memoria).

## Lo que NO he comprobado, y límites

- **El orquestador sale sin nombre.** No es un trabajo de fondo, así que el registro no sabe cómo se
  llama: aparece por los 8 primeros caracteres de su sesión. Quien lea tiene que saber cuál es el suyo.
- **Lo de que la cifra BAJA al compactar** está probado con un jsonl fabricado (965k → 75k manda el
  último), no observando una compactación real desde el latido. Lo medido en real es del orquestador
  (5 compactaciones), no mío.
- **Con el umbral en 200k, hoy avisan 6 de 8.** El latido sale 1 casi siempre por esta sección. Si el
  umbral de la A19 ya no es el que se usa con opus, eso es texto de la A19 (S0), no de aquí: el latido
  lee `UMBRAL_CONTEXTO` de `sesion.mjs` y cambiará con él.
- Los transcripts sueltos se buscan sólo en las carpetas donde ya hay un trabajo de fondo.

## Mis errores

1. Lancé seis ediciones seguidas sobre un fichero que no había leído en ese árbol (lo había leído en
   otro). Fallaron las seis sin tocar nada; las repetí tras leerlo.

## Lo que sigue faltando de este ticket

El texto de la A19 con esta magnitud. Es de S0 (`00-normas-comunes.md`).
