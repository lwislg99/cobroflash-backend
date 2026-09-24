# SCRUM-977 · Constancia: el fundador levantó de palabra el veto ERP/CRM de la Parte Z

**Fecha:** 22-sep-2026 · **Carril:** S5 (documentación, encargo del orquestador) · **Gate:** ninguno — solo constancia escrita, cero código
**Medido contra:** `origin/main` = `fc08703449d85b5ec4033f084dd813b8c2455f01` · 2026-09-22T10:12:33Z

## El defecto

El máster (`docs/YAQU_MASTER.md`, Parte Z, Z1) lista dos vetos escritos:

- Línea 1716: `CRM con pipeline | ❌ nunca | QuoteRequest + ficha 360 bastan`.
- Línea 1706: `Contabilidad completa (libros, 303/130 presentación) | ❌ nunca | exports al gestor; jamás competir con gestorías (son canal)`.

El **17-sep-2026** el fundador levantó ambos vetos **de palabra**, en conversación con el equipo (recogido en la memoria de equipo `project_yaqu_es_erp.md`, máquina/carpeta del orquestador de Luis): quiere «el software definitivo mega pulido», con **CRM** y **gestoría/contabilidad** «pulidísimos». Esa decisión oral **nunca llegó al máster escrito**: ninguna enmienda formal (regla 27) la registró. Resultado medido: una sesión que lee sólo la Parte Z sigue viendo «❌ nunca» y puede frenar o rechazar una propuesta de CRM citando un veto que el fundador ya retiró — el «veto fantasma» que motiva este registro.

## La decisión, y por qué

**Esta entrada NO enmienda el máster.** Cambiar la Parte Z exige enmienda formal (regla 27) y eso sigue siendo del fundador — no se toca `docs/YAQU_MASTER.md` aquí. Lo que hace esta entrada es dejar **constancia por escrito, en el registro**, de que el veto ya no representa la voluntad del fundador, para que:

1. Ninguna sesión futura use la Parte Z como argumento único para frenar una propuesta de CRM o de gestoría/contabilidad ampliada.
2. El hueco quede nombrado: falta la enmienda formal de la Parte Z (quién la escribe y en qué términos exactos) y decidir dónde vive esto en `cerebro-yaqu` — **las dos, decisión pendiente del fundador**, no de esta sesión.

## Dónde vive cada pieza hoy

- **Gestoría/contabilidad**: ya tiene hueco en la cola — es el **BLOQUE E** (SCRUM-280), que ya existe como ticket/bloque propio.
- **CRM**: el contenedor es **SCRUM-977** (`🟦 BLOQUE CRM · la ficha del cliente como centro`, Jira, estado «Tareas por hacer» al escribir esto) — de ahí el número de este fichero.

## Lo que NO cubre

- No decide el contenido, alcance ni prioridad del CRM ni de la contabilidad ampliada — eso es trabajo de producto, no de esta constancia.
- No enmienda `docs/YAQU_MASTER.md` ni ninguna otra parte del máster.
- No decide dónde exactamente va esta nota en `cerebro-yaqu` ni en qué términos — pendiente, del fundador (tal como pide el encargo que origina esta entrada).
- No toca `src/`, `public/`, `prisma/` ni ningún test: cero código.

## Ficheros

`docs/master/SCRUM-977.md` (nuevo, este fichero). Ninguno más.
