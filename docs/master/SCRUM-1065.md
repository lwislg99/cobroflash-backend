# SCRUM-1065 · Modelo 130 (pago fraccionado de IRPF) — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

El 130 no existe como módulo: solo dos comentarios en `retencionIrpf.ts:110,129` (confirmado
leyendo el fichero), que son notas de diseño sobre el redondeo y el signo, no un cálculo del 130.
`src/modules/invoicing/domain/retencionIrpf.ts` sí calcula la retención **sufrida**
(`calcularRetencion`, `bloqueRetencion`) que este ticket necesitaría restar — esa pieza SÍ está
construida y reutilizable el día que el ticket se desbloquee.

## Por qué no se puede construir hoy — medido, no supuesto

La aceptación (punto 1) exige **«descargar y citar literalmente la orden [del 130/131] y responder
Q-C8»** antes de nada. Medido igual que en SCRUM-1063: SCRUM-1039 sigue «Tareas por hacer» sin
commit ni rama, y Q-C8 sigue sin respuesta en `docs/producto/CONTABILIDAD.md:86` — el propio
Q-C8 nombra expresamente «130/131» entre los modelos pendientes de plazo.

Hay una segunda dependencia propia del ticket, «Resumen del trimestre» (SCRUM-1048): también en
Jira «Tareas por hacer», sin construir.

El punto 5 de la aceptación ("gastos: solo los que el asesor confirme como deducibles") es otra
cita pendiente del mismo Q-C8/asesor: no hay lista de gastos deducibles verificada en el
repositorio hoy.

## Siguiente paso exacto

Ninguno para J1 hasta SCRUM-1039 + Q-C8, y hasta que SCRUM-1048 (el resumen del trimestre) tenga
su propio cálculo. El bloque reutilizable (`retencionIrpf.ts`) no necesita cambios cuando llegue
ese momento.

## STOP respetado

No se ha tocado `retencionIrpf.ts` ni ningún camino de emisión. Solo lectura y este documento.
