# Contactos · qué campos van a cada lado del switch — SCRUM-574 (CONT-01), punto 3

> **Fecha:** 24-ago-2026 · **Rama:** `scrum-574-switch-empresa-persona`
> **Decisión que lo enmarca:** OPCIÓN B (fundador, 24-ago-2026) — el switch guarda en
> `contact_kind`; `tipoDestinatario` **queda intacto**. Ver `docs/CENSO_TIPO_CLIENTE.md` §3.
> **Estado:** declaración escrita. **Nada de esto está construido todavía** — ver §5.

## 1. De dónde sale esta lista (las tres fuentes, separadas a propósito)

Que un campo esté aquí no significa lo mismo según de dónde venga. Se separa para que el
fundador vea qué está **medido**, qué está **copiado de Holded** y qué es **propuesta**.

| Fuente | Qué aporta | Fiabilidad |
|---|---|---|
| **① El árbol** — `customersView.js`, `customerDetailView.js`, `schemas.ts`, `customerAdmin.ts` | los campos que YaQu tiene HOY | **medido**, 24-ago-2026 |
| **② Holded** — capturas del fundador del 24-ago-2026, descritas en el ticket | qué mueve el switch allí | referencia externa, **no medida por mí**: no hay capturas de SCRUM-574 en `docs/capturas/` |
| **③ Los tickets de detrás** — CONT-03, CONT-04, CONT-19 | campos que aún no existen | **propuesta**, cada uno con su ticket |

Lo que Holded hace, según el ticket: el control «Este contacto es… Empresa \| Persona» vive
**arriba a la derecha, FUERA de las pestañas**. Al pasar a Persona **desaparece «Identificación
VAT»** y **aparece «Empresa (Seleccionar compañía)»**. El resto de campos básicos se mantienen.

## 2. Los campos que YaQu tiene hoy (fuente ①, medido)

| # | Etiqueta actual | Campo | Dónde vive hoy |
|---|---|---|---|
| 1 | Nombre *(obligatorio)* | `name` | los dos formularios |
| 2 | Teléfono (E.164 sin +) | `phone` | los dos |
| 3 | Email | `email` | los dos |
| 4 | Razón social (empresa, opcional) | `legalName` | los dos |
| 5 | NIF/CIF (opcional) | `taxId` | los dos |
| 6 | Tipo de cliente | `tipoDestinatario` | los dos |
| 7 | Recargo de equivalencia | `recargoEquivalencia` | **solo** el modal de la lista |
| 8 | Facturación pactada | `billingPeriodicity` | **solo** el modal de la ficha 360 |
| 9 | Notas | `notes` | los dos |
| 10 | Baja de WhatsApp | `waOptOut` | los dos |

> 🔴 **Los dos formularios YA DIVERGEN, y no por diseño.** El modal de la lista
> (`customersView.js`) tiene **recargo de equivalencia** y le falta **facturación pactada**; el de
> la ficha 360 (`customerDetailView.js`) tiene facturación pactada y le falta el recargo. Cada uno
> se quedó sin el campo que el otro añadió después. **Es zona de CONT-19**, se reporta y no se
> arregla aquí (regla 37).

## 3. El reparto propuesto

### 3.1 COMÚN — se ven en los dos lados

`name` · `phone` · `email` · `notes` · `waOptOut` · `tipoDestinatario` · `recargoEquivalencia` ·
`billingPeriodicity`

Justificación de los tres últimos, que es donde alguien podría dudar:

* **`tipoDestinatario` se queda, y se queda EN LOS DOS LADOS.** No es cosmética: es la
  prohibición explícita del fundador («NO MEZCLES `contact_kind` con `tipoDestinatario` en ningún
  sitio: ni en la migración, ni en el formulario, ni en un valor por defecto que deduzca uno del
  otro»). Un autónomo es **Persona** por forma jurídica y **EMPRESARIO** por capacidad fiscal:
  ponerlo solo en el lado Empresa haría **imposible** clasificar bien justo al cliente que abrió
  este ticket.
* **`recargoEquivalencia` se queda en los dos.** Es un régimen de IVA, no una forma jurídica: lo
  lleva el comerciante minorista, que puede ser persona física.
* **`billingPeriodicity` se queda en los dos.** Es un acuerdo comercial; nada en él depende de si
  el cliente es sociedad o persona.

### 3.2 Solo lado **EMPRESA**

| Campo | Por qué | Fuente |
|---|---|---|
| `legalName` — razón social | Es *la* señal de sociedad. Hoy la distinción entera vive en si está relleno; el switch existe para relevarla de ese papel. | ① + ② |
| `taxId` — NIF/CIF | Holded quita «Identificación VAT» en Persona. **⚠️ Ver §4: no lo doy por decidido.** | ② |

### 3.3 Solo lado **PERSONA**

| Campo | Por qué | Fuente | Estado |
|---|---|---|---|
| «Empresa» (seleccionar compañía) | Vincular la persona con la empresa para la que trabaja. Es lo que aparece en Holded al pasar a Persona. | ② | **CONT-03 — no se construye aquí** |

> Hoy el lado Persona **no gana ningún campo**: solo pierde los de §3.2. El campo que lo llenaría
> es de CONT-03. Se dice para que nadie lea el hueco como un olvido.

### 3.4 Lo que este ticket deja preparado y NO construye

| Ticket | Qué añade | Dónde encaja |
|---|---|---|
| CONT-03 | campo «Empresa» | lado Persona (§3.3) |
| CONT-04 | nombre comercial ≠ razón social | lado Empresa: parte `legalName` en dos |
| CONT-08 (SCRUM-581) | filtro Empresas/Personas | lee `contact_kind` — **por eso la opción C no valía** |
| CONT-19 | los campos pueden diferir entre lados | generaliza §3.1–§3.3, y tiene que resolver la divergencia ya medida en §2 |

## 4. 🔴 Lo que NO decido aquí, y necesita al fundador

**¿El NIF desaparece en el lado Persona?** Holded lo quita. En España **una persona física
también tiene NIF**, y YaQu lo necesita: `schema.prisma` deja escrito que el NIF del destinatario
es **requisito de VeriFactu** (hallazgo S1-C, F1). Esconderlo en el lado Persona significaría que
un autónomo no puede dar su NIF — y es exactamente el cliente del ticket.

Tres salidas, ninguna elegida: **(i)** el NIF es COMÚN y solo cambia su etiqueta;
**(ii)** desaparece en Persona, como Holded, asumiendo lo de arriba; **(iii)** se queda en los dos
con etiquetas distintas (CIF / NIF), que es CONT-19.
**Recomendación: (i)** — es la única que no le quita a un autónomo el dato que F1 le va a exigir.

**Toda la microcopy sigue siendo del fundador** (regla 30): las dos etiquetas del switch, la
pregunta que lo encabeza y cualquier etiqueta que cambie entre lados. Cuando se construyan irán con
el marcador oficial `[PENDIENTE microcopy oficial]`, que es la convención del repo y lo que
`scripts/censo-marcadores.mjs` cuenta — no son textos «de ejemplo».

## 5. Estado real

**Nada de este reparto está construido.** No se ha tocado `customersView.js` ni
`customerDetailView.js`. El motivo está en `docs/master/SCRUM-574.md`: el switch necesita saber
qué posición enseñar en una ficha existente sin lado declarado, y esa pregunta sigue abierta —
las tres salidas posibles pasan por declarar por el profesional, inventar un tercer estado
(regla 27), o deducirlo de otro campo (prohibido por el fundador).
