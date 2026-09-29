# SCRUM-1246 · A22 del máster: la demo «Pruébalo tú» termina en la firma

**Medido contra:** `origin/main` = `0afa87cd95645317226f59bc379edae59a7bea44` · 2026-09-28T18:46:21Z (reloj de la máquina, UTC)

Sesión J3 (jv-j3). Cambio de máster aprobado por el fundador («1-Okey la dejamos en firma y
corregimos master», citado literal en la descripción de SCRUM-1246 por el orquestador).

## 1 · Premisa comprobada antes de tocar

- `docs/YAQU_MASTER.md:438` (A22, en `origin/main` de arriba) decía exactamente lo que cita el
  ticket: demo interactiva "Pruébalo tú" (crear→enviar→firmar→factura→pagar).
- La demo real tiene tres pantallas y termina en la firma, medido en yaqu.app para SCRUM-1130.
- El motivo citado existe: la enmienda de la regla 24 es `docs/master/SCRUM-612.md` §«SCRUM-612c ·
  La enmienda FIRMADA, aplicada al máster y a `CLAUDE.md`».

## 2 · El cambio: una frase, sin borrar lo que decía

Solo el paréntesis de la demo interactiva en A22 (`git diff --numstat`: 1 línea, la 438). Queda:

> demo interactiva "Pruébalo tú" (crear→enviar→firmar) — ✅ *corregido el 28-sep-2026 (SCRUM-1246,
> decisión del fundador: «la dejamos en firma y corregimos master»). Antes decía
> «crear→enviar→firmar→factura→pagar». La demo termina en la firma: enseñar una factura y un cobro
> en la landing pública afirmaría documento y cobro por YaQu, que la regla 24 impide en España antes
> de SIF-1; este apartado se aprobó el 7-jul-2026, antes de esa enmienda de la regla 24 (SCRUM-612c).*

Se sigue la forma que ya usa el máster para sus correcciones («Antes decía «…»», con el motivo al
lado) y AA1.7: ✅ con motivo, nunca borrar.

## 3 · Lo que NO se toca

- El resto de A22 (héroe, secciones, precios, FAQ, copy). En particular, la animación de **cabecera**
  sigue describiéndose como «presupuesto→WhatsApp→firma→cobrado»: es otra cosa, con su análisis
  pendiente en SCRUM-1130 comentario 17403. No se aprovecha este cambio para tocarla.
- Ningún paso de factura ni de pago en la demo.
- No se añade ninguna entrada de registro al máster: este registro vive aquí (SCRUM-273).

## 4 · Comprobaciones

- `tests/scrum273-registro-por-fichero.test.mjs`: 6 de 6 (el censo de entradas del máster no cambia).
- Los 15 tests que leen `YAQU_MASTER.md`: 150 de 150, 0 saltados.
- `docs/YAQU_MASTER.md` está en la zona roja (`scripts/zona-roja.mjs`) y en `.github/CODEOWNERS`. La
  zona roja solo comenta en el PR, no lo bloquea.
