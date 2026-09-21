# Reconciliación de la matriz: las "7 sin re-medir" eran 0 — J5, tercera sesión

**Medido contra:** `origin/main` = `beef7b362ed44a7bb431ab4f145879f11abd0c24` · 21-sep-2026 16:34:16Z (hora de GitHub)
· J5 · **no toca `src/` ni `public/`, no abre cuentas de prueba, no toca `docs/competencia/capturas/`**
(el PR #1590 del equipo de Luis que las bloqueaba ya está MERGED, comprobado antes de nada).
**Ticket:** SCRUM-1030.

## El encargo, y por qué no se cumple tal como estaba escrito

El PASO 0 de mi arranque pedía localizar y re-medir **"7 entradas de la matriz sin re-medir hoy"**
(`docs/competencia/propuestas-priorizadas-21sep.md`, escrito por la Sesión 0 el 21-sep a las 12:46Z)
más **3 candidatas fuera del top-3**, y decía explícitamente: *"Si al contarlas no son 7, eso ya es un
dato: dilo."*

**No son 7. Son 0.** Hoy no queda ninguna de las 23 propuestas numeradas de `matriz.md` (§10.1-10.3,
§11.4.1-3, §12.3.1-3, §13.3.1-3, §14.3.1-3, §15.3.1-3, §16.4.1-3) ni de las 2 candidatas (§16.5 A/B) —
25 entradas en total — sin ticket, sin comentario, sin decisión o sin construcción ya mergeada.

## Cómo se midió

1. Reconstruí las 25 entradas de `matriz.md` con su título y tamaño, leyendo las secciones que las
   sesiones anteriores no habían recorrido en detalle (§12.3 a §16.5, líneas 1108-1976 del documento).
2. Crucé cada una con Jira **por contenido** (`searchJiraIssuesUsingJql`, cloud
   `30938fdf-d6f0-4c3e-92a9-b11339b41567`) y con una consulta `key in (...)` sobre los 22 tickets
   citados por nombre en los documentos heredados, para confirmar que clave, resumen y estado existen
   de verdad — no que alguien los mencionó.
3. Verifiqué el caso dudoso (§12.3.3, abajo) directamente contra el código de `origin/main` de hoy con
   `git grep`, no contra lo que dice la matriz.

## La tabla completa (25 entradas)

| § | Título | Tamaño | Estado hoy |
|---|---|---|---|
| 10.1 | Portal del cliente, en el mensaje | MEDIANO | SCRUM-967 (En curso) |
| 10.2 | Que el presupuesto llegue a quien decide | GRANDE | SCRUM-969 (Por hacer, aparcado por el orquestador 21-sep 09:21 con motivo escrito) |
| 10.3 | Caducidad en un toque 7/15/30 | PEQUEÑO | SCRUM-968 (Por hacer) |
| 11.4.1 | El gasto entra por WhatsApp | MEDIANO | SCRUM-971 (Por hacer) |
| 11.4.2 | La bandeja de gastos | GRANDE | SCRUM-1017 (Por hacer, J5 sesión 1) |
| 11.4.3 | Por qué un campo vino vacío | PEQUEÑO | aviso en SCRUM-920 (En curso) |
| 12.3.1 | «Voy de camino» | MEDIANO | SCRUM-975 (Por hacer) |
| 12.3.2 | Quién va a ir y en qué franja | MEDIANO | SCRUM-1018 (Por hacer, J5 sesión 1) |
| 12.3.3 | Dinero sin facturar en el digest del lunes | PEQUEÑO | **YA CONSTRUIDO**: SCRUM-974 (Finalizada, PR #1564, resuelta 21-sep 07:58:52Z) |
| 13.3.1 | Ficha del equipo (grande) | GRANDE | comentario en SCRUM-914, sustituida por 14.3.3 |
| 13.3.2 | QR del equipo | MEDIANO | SCRUM-1019 (Por hacer, J5 sesión 1) |
| 13.3.3 | Fotos del cliente juntas | GRANDE (corregido de PEQUEÑO) | SCRUM-1020 (Por hacer, J5 sesión 1) |
| 14.3.1 | Historial en la ficha del cliente | MEDIANO | SCRUM-980 (Finalizada) |
| 14.3.2 | «Última visita» en lista de clientes | PEQUEÑO | SCRUM-979 (Finalizada) |
| 14.3.3 | Equipos v1 (recorte) | MEDIANO | SCRUM-914 (Por hacer) |
| 15.3.1 | Aviso de visita, la víspera | MEDIANO | SCRUM-981 (Acción del fundador) |
| 15.3.2 | Calendario webcal | MEDIANO | SCRUM-1021 (Por hacer, J5 sesión 1) |
| 15.3.3 | Nota del cliente en la ficha del trabajo | PEQUEÑO | SCRUM-982 (Finalizada) |
| 16.4.1 | Presupuesto → albarán en un toque | PEQUEÑO | SCRUM-984 (Finalizada) |
| 16.4.2 | Crear y enviar a firmar en un toque | MEDIANO | SCRUM-993 (Por hacer) |
| 16.4.3 | Chip «Leído» en la lista | MEDIANO | SCRUM-986 (Por hacer) |
| 16.5-A | «Válido hasta» en el PDF | PEQUEÑO | SCRUM-987 (Por hacer) |
| 16.5-B | Importar `.xlsx` | MEDIANO | SCRUM-1022 (Por hacer, J5 sesión 1) |

Faltan 10.1-10.3 y 11.4.1-11.4.3 y 12.3.1-12.3.3 en la cuenta de "23": son 21 filas de §10-§16.4 más
§16.5 A/B = 23 numeradas + 2 candidatas = 25, tal como las cuenta `propuestas-priorizadas-21sep.md`.

## La causa del desfase: una foto de las 12:46Z, y el código se movió ANTES de esa hora

La única entrada que de verdad quedaba en el aire era **§12.3.3**. Ni `propuestas-priorizadas-21sep.md`
(que la marcó entre las "5 no re-medidas hoy") ni la primera sesión J5
(`docs/competencia/backlog-convertido-a-tickets-21sep-j5.md`, que escribió una frase confusa dándola
por cubierta sin decir cómo: *"§11.4.1/§14.3.1/§14.3.2/§15.3.1/§15.3.3/§16.4.1/§16.4.3/candidata-A ya
tenían ticket"* — una lista que ni siquiera nombra §12.3.3) la cerraron con una medición.

**Verificado hoy, por mí:**

```text
git grep -n "bloqueFirmadoSinFacturar" origin/main -- src/modules/messaging/domain/weeklyDigest.service.ts
  -> weeklyDigest.service.ts:109 (la función) y :170 (su uso)
```

**SCRUM-974** ("el dinero firmado y sin facturar, en el correo del lunes") está **Finalizada**, con
`resolutiondate` **2026-09-21T09:58:52+0200 = 07:58:52Z** — **antes de que
`propuestas-priorizadas-21sep.md` se escribiera (12:46Z)**. Las dos sesiones que citaron §12.3.3 como
pendiente estaban leyendo una matriz más vieja que el propio código que describían.

    🔒 Re-medir "contra la matriz" no es re-medir: la matriz es una foto, y el código sigue
       moviéndose por debajo de ella incluso dentro del mismo día.

## Consecuencia: no se abre ningún ticket de construcción

No hay ningún hueco de la matriz sin cubrir hoy. Los 6 tickets nuevos que sí hacían falta
(SCRUM-1017 a 1022) los abrió ya la primera sesión J5, y siguen en pie, todos detrás de SIF-1 (ninguno
toca facturación ni cobro; `INVOICING_ES_ENABLED` sigue OFF y en España no hay cobro por YaQu hasta
SIF-1, regla 24 enmendada por SCRUM-612).

## Lo que NO pude verificar de forma independiente

- El comentario real dejado en **SCRUM-914** que cubriría §13.3.1: confío en el registro de
  `propuestas-priorizadas-21sep.md`, no leí el comentario en Jira directamente.
- El motivo y la hora exactos del aparcamiento de **SCRUM-969**: no recuperé sus comentarios.
- Las secciones descriptivas de `matriz.md` sin propuestas numeradas (§5-9, §11.1-11.3, §16.1-16.3):
  no aportan al recuento de las 25 y no se leyeron íntegras.

**No se ha tocado ningún fichero de otra sesión.** Este documento es propio de esta entrega; los
heredados (`matriz.md`, `propuestas-priorizadas-21sep.md`, `backlog-convertido-a-tickets-21sep-j5.md`,
`con-que-venden-sin-cobro-21sep-j5.md`) no se editan aquí.
