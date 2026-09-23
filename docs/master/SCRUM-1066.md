# SCRUM-1066 · Modelos 111 y 115 — medir qué datos hay (paso 1 de la aceptación)

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — no hay nada construido con otra redacción

`git log --oneline -- src/modules/fiscal` y un grep por `303|347|390|111|115|modelo|trimestre` no
encuentran ningún módulo de retenciones PRACTICADAS. Sí existe `src/modules/fiscal/modelo303/`
(SCRUM-295), que es otro ticket de este mismo lote (1063/1064) y no toca esto.

## El paso 1 de la aceptación era MEDIR, sin código. Esto es la medición.

**Pregunta:** ¿guarda YaQu hoy algún dato de una retención que el PROPIO profesional PRACTICA al
pagar a otro (empleado, subcontrata, alquiler del local)?

**Método:** grep de `retenci` (sin acento, case-insensitive) sobre `prisma/schema.prisma` y sobre
`src/`, más lectura de los dos sitios que el ticket señala (`retencionIrpf.ts:110,129`) y del
modelo `Expense`.

**Resultado — un solo eje, y es el otro:**

- `prisma/schema.prisma:168-169` — las únicas dos columnas de retención de todo el esquema:
  `retencionIrpfDeclarada` / `retencionIrpfTipo`, en el modelo `Merchant`. Por su propio
  comentario (`schema.prisma:155-167`, autorización expresa del fundador en SCRUM-293): declaran
  si al profesional **le retienen** sus clientes al pagarle sus facturas — la retención que
  **sufre**, no la que practica.
- `src/modules/invoicing/domain/retencionIrpf.ts` entero (líneas 90-150 leídas) calcula sobre esas
  mismas columnas: `calcularRetencion`, `liquidoAPercibir`, `bloqueRetencion` — todo restando del
  **total que cobra** el profesional. Es el dato que alimenta el 130 (SCRUM-1065), no el 111/115.
- `model Expense` (`schema.prisma:929-959`): `concept`, `amount`, `category` (incluye
  `subcontrata`), `baseAmount`, `vatRate` — **ningún campo de retención**. Un gasto de categoría
  `subcontrata` no distingue si esa factura llevaba una retención practicada.
- Cero resultados de `retenci` en `expenses.service.ts` y en cualquier fichero de `Empleado`
  (`TeamMember`) o de nóminas: no existe el concepto de nómina ni de pago a un empleado con
  retención en este esquema.
- El propio `retencionIrpf.ts:110,129` que cita el ticket son comentarios de diseño (el redondeo y
  el signo), no código de un eje distinto: no hay una segunda función ni una segunda tabla ahí.

**Conclusión medida, no deducida:** YaQu hoy **no guarda ningún dato** de una retención que el
profesional practique sobre un pago a un tercero. El único eje de retención que existe en el
producto es el que el ticket 1065 ya usa (la sufrida). La sospecha del propio ticket
("es probable... confirmar") queda **confirmada**.

## El ticket termina aquí, con la propuesta (aceptación punto 2)

No se construye pantalla sobre datos inexistentes (punto 2 de la aceptación). Propuesta de datos
mínimos, **sin aplicar** — el ALTER lo decide y lo aplica Javier (A5), y solo tendría sentido una
vez el asesor confirme Q-C8 (plazos/quién declara) y la orden del 111/115 esté citada
(SCRUM-1039), porque hoy no se sabe ni siquiera si YaQu es sujeto obligado a estos modelos con su
volumen de operaciones:

- `Expense.retencionPracticadaTipo` (Int?, nullable = "no consta") y
  `Expense.retencionPracticadaBase` (Decimal?, cuando difiera de `baseAmount`) — el mismo patrón de
  dos-por-el-null que ya usa `retencionIrpf` en `Merchant` (tres estados, no dos), aplicado por
  gasto en vez de por merchant, porque la retención practicada varía factura a factura, no es una
  política fija del profesional.
- Para nómina de empleados (si el oficio la tiene): no hay ni siquiera un concepto de "pago a
  empleado" en el esquema — `TeamMember` es una cuenta de acceso, no un beneficiario de pagos. Eso
  sería un modelo nuevo, no una columna, y está fuera de alcance de esta medición.

## STOP respetado

No se ha tocado `prisma/schema.prisma`, ni el camino de emisión, ni ningún flag. Solo lectura y
este documento.
