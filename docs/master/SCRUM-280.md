# SCRUM-280 · Bloque E, punto 4 — CAMINO 1: se entrega LIBRO DE REGISTRO, no asiento

**Fecha:** 7-ago-2026 · **Carril:** decisión (cero construcción) · **Gate:** ninguno — esto no toca código

**Medido contra:** `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T18:15:10Z

> **Decidido por el ASESOR, por delegación expresa del fundador.** Se firma como suyo y no como
> «decisión del fundador»: quien delega no decide, y atribuirle a alguien una decisión que no tomó
> es un error que este proyecto ya ha pagado.

## Por qué existe este fichero

La decisión se tomó y vivía **solo en Jira**. Al construir E4 (SCRUM-325) se buscó en el árbol para
apoyarse en ella y **no había nada contra lo que comprobar**: ni en `YAQU_MASTER.md`, ni en
`docs/master/`. Una decisión que no está en el repo no se puede citar, no entra en una revisión de
PR y no la encuentra quien retome el bloque dentro de tres semanas.

> **Una decisión que solo vive en Jira no es algo contra lo que se pueda comprobar nada.**

Es la misma familia que el aviso de `docs/METODO_YAQU.md` sobre los guards de otra rama: el anuncio
no es el hecho.

## La decisión

**Se entrega el LIBRO DE REGISTRO. No se entrega el asiento contable.**

**Motivo:** A6 (SCRUM-296) ya **CONSTRUYE** el libro — asientos con base, cuota, desglose por tipo
de IVA y los enlaces de trazabilidad. El Camino 1 se limita a **ENTREGARLO**: por periodo y en un
fichero que se pueda abrir. No hay que calcular nada nuevo, y por eso E4 cabe en un ticket.

El diseño describe el **Camino 2** —producir el asiento contable, con plan de cuentas y partida
doble— como **«más caro que los cinco formatos juntos»**. Y hoy se pagaría con **cero gestorías
pidiéndolo**: SCRUM-321 (E0) dejó Q6, Q7 y Q8 marcadas como **NO SE PUEDE MEDIR HOY** — no
sabemos qué proporción de usuarios tiene gestoría, ni qué le manda hoy a su asesor, ni quién elige
el software. Construir el camino caro contra tres incógnitas es exactamente lo que la regla 13
existe para impedir.

**Reversible barato, y ése es el argumento que lo cierra:** del libro al asiento se sube el día que
un asesor real lo exija. Lo contrario —bajar de un asiento mal planteado a un libro— no es
reversible: hay que tirar el plan de cuentas y lo que se haya cableado encima.

## Lo que esta decisión NO decide

Se escribe porque un documento de decisión que no acota su alcance se acaba citando para justificar
lo que no dijo:

* **Qué formato contable primero (E2)** — A3, Contaplus, Sage… SIN DECIDIR.
* **Exportación programada vs sitio del despacho (E1)** — SIN DECIDIR.
* **Google Drive y PSD2** — SIN DECIDIR, y las dos son **dependencia nueva → regla 36**: no se
  construyen, no se dejan a medias y **no se pintan como «próximamente»**, que es prometer.
* **El visto bueno legal del art. 28 RGPD** (encargado del tratamiento, si los datos salen hacia el
  despacho del asesor) — SIN DECIDIR y **fuera del carril técnico**.

## Qué se construyó al amparo de esta decisión

* **SCRUM-325 (E4)** — el libro de A6 por trimestre, en CSV. Entrega, no cálculo.
  ⚠️ Con **tres huecos declarados** en su propia entrada, y uno de ellos toca directamente a este
  documento: **lo entregado NO es todavía el formato de Libros Registro de la AEAT**. Ver
  `docs/master/SCRUM-325.md`.
