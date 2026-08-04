<!-- ─────────────────────────────────────────────────────────────────────────────
CABECERA (no forma parte del diseño — la añade SCRUM-287, no la epic)

  FUENTE:      descripción de la epic SCRUM-276 (BLOQUE A · Núcleo fiscal), en Jira.
  COPIADO EL:  5-ago-2026, por SCRUM-287 · A0.1.
  ORIGEN:      https://yaqu.atlassian.net/browse/SCRUM-276
  QUÉ ES:      COPIA VERBATIM de la DESCRIPCIÓN (no los comentarios). No se resumió, no se
               reordenó, no se "mejoró". Si algo parece mal, se reporta en el informe de
               SCRUM-287, NO se corrige aquí.
  ⚠️ STALE:    Es una copia. Si la epic cambia en Jira, este fichero queda desactualizado —
               exactamente lo que le pasó al máster A22 con el precio. La fecha de arriba dice
               contra qué versión se copió.
───────────────────────────────────────────────────────────────────────────── -->

## 🟢 DISEÑADO · El diseño completo está aquí abajo

La primera tarea del bloque lo deja commiteado en `docs/diseno/bloque-a.md` para que viva en el repo.

Nace de comparar el producto contra **Verifacturamos** (9 €/mes, VERI\*FACTU incluido). Conclusión medida: **estamos por delante en lo difícil (cobro, firma, WhatsApp, trabajo, equipo) y por detrás en lo fácil (profundidad fiscal)**. Esa es la posición buena — pero solo si sobrevivimos a los primeros 90 segundos de comparación, y hoy no.

Decisión del fundador (4-ago-2026): **competimos en facturación Y somos el sistema del negocio**. La facturación pasa a tener que estar perfecta.

**Reglas vigentes en todo el bloque:** 24 (`INVOICING_ES_ENABLED` off para merchants reales) · 29 (factura emitida no se edita ni se borra) · 26 (VeriFactu solo con el guion H2) · 30 (microcopy la aprueba el fundador) · `prisma/schema.prisma` es territorio exclusivo del fundador.

---

# A0 · De dónde nace una factura — VA PRIMERO

## Ellos

Tres puertas visibles: **suelta** («Nueva factura», su camino principal; el panel tiene `Crear factura` · `Crear presupuesto` · `Crear albarán`), **desde presupuesto** («Convertir en factura») y **desde albarán** («Convertir en factura» como acción primaria).

## Nosotros

Una sola: presupuesto aceptado → trabajo → emitir. La pantalla de Facturas **no tiene botón de crear**.

## Decisión 1 del fundador — la factura suelta es puerta principal

Sin exigir presupuesto, trabajo ni albarán. Es el camino del que viene de Excel y el de la reparación de 40 €. Hoy le obligamos a inventarse un presupuesto y un trabajo para cobrar algo que ya hizo.

## Decisión 2 del fundador — el albarán vuelve a ser origen de factura

**ENMIENDA la decisión del 2-ago en SCRUM-257**, que decía «el albarán es comprobante de entrega, no origen de la factura». Queda así:

> El albarán **sigue sin llevar precios** — eso no cambia, y es lo que evita reteclear en obra. Pero **sí es origen de factura**: al convertirlo, las **cantidades** salen del albarán y los **precios** del **presupuesto firmado**.

### 🏆 Aquí les ganamos

Sus albaranes tampoco llevan precio (`DESCRIPCIÓN | CANT`, sin columna de importe), así que su conversión tiene que sacarlo del catálogo o preguntárselo al usuario. **Nosotros tenemos un presupuesto firmado detrás.** Entregas 3 de 10 y facturas 3 al precio que el cliente aceptó y firmó. Desbloquea además la certificación por partes (SCRUM-18).

## 🔴 Las líneas añadidas en obra — resuelto por la LEY, no por preferencia

Se planteó como decisión del fundador y **la investigación la resolvió sola**. La primera propuesta del asesor era «entran sin precio y se avisa», y **era legalmente incorrecta**.

### Dos regímenes

**B2B — cliente empresa o autónomo.** Art. 1593 CC: se pueden cobrar los adicionales si hubo **autorización del propietario**, y el Supremo admite que sea **verbal o tácita**. Matiz: **reparar algo mal ejecutado no genera derecho a cobro adicional**.

**B2C — cliente particular.** El 90 % de la clientela de un gremio, y aquí se aprieta:

* El presupuesto aceptado **es vinculante**: la factura debe coincidir con él.
* Si aparecen trabajos nuevos, hay que comunicarlo y **el consumidor debe aceptar el nuevo presupuesto por escrito**.
* La normativa de reformas exige presupuesto escrito con contenido tasado (materiales con cantidad, calidad y precio; mano de obra; desplazamiento; plazos; garantía) y **hueco para la firma del consumidor**.
* Si renuncia al presupuesto, la renuncia la escribe **de su puño y letra** y la firma.
* El consumidor **puede rechazar** la modificación, y entonces esos trabajos no deben ejecutarse.

### Por qué la propuesta inicial estaba mal

«Entran sin precio y se avisa» convierte a YaQu en **la herramienta que produce la factura mayor que el presupuesto** — exactamente la situación que la normativa de consumo persigue y por la que se abren la mitad de las reclamaciones en OMIC.

### La respuesta correcta, y ya está en el tablero

Lo que la ley pide es un **presupuesto adicional aceptado y firmado**. Eso es **literalmente SCRUM-195**.

> Al convertir un albarán en factura, las líneas que no estaban en el presupuesto **no se facturan**: disparan un **presupuesto adicional** que se manda por WhatsApp y se firma. Firmado, se incorpora y la factura sale entera. Sin firmar, se factura lo pactado y lo demás queda **pendiente y visible**.

**SCRUM-195 pasa a ser dependencia de A0.**

### 🏆 La mejor ventaja competitiva del proyecto

**Verifacturamos no puede hacer esto.** No tiene firma, ni WhatsApp, ni landing de decisión. Lo máximo que ofrece es que hagas otro presupuesto a mano y lo mandes por email.

Nosotros convertimos una obligación legal en **treinta segundos desde el móvil, en la propia obra**. Lo que parecía una restricción molesta es la mejor demostración de por qué la firma y el WhatsApp valen dinero.

### Avisos

**Esto no es un dictamen.** Va a `docs/legal/PREGUNTAS_ASESOR.md`: (1) ¿basta la firma digital que usamos para acreditar la aceptación del adicional? (2) ¿qué contenido mínimo debe llevar? Y **hay que medir**, no suponer, si distinguimos cliente **consumidor** de **empresa** — el régimen cambia.

## Lo que hay que MEDIR antes de construir

1. ¿`Invoice` exige `jobId` o `quoteId`? ¿En el esquema o solo de hecho?
2. ¿Se puede casar una línea de albarán con su línea de presupuesto? Hoy `Albaran.lineas` es `Json` plano y SCRUM-257 dejó **fuera de alcance** guardar el origen por línea.
3. ¿Qué se rompe si un albarán `SIN_VALORAR` pasa a ser facturable? `facturar-parcial` y `consolidar` exigen `VALORADO`.

---

# A1 · Tipo de factura

## Ellos — desplegable agrupado, primera decisión del formulario

| Grupo | Opciones |
| --- | --- |
| Facturas estándar | Ordinaria · Multi-IVA · Simplificada (Ticket) |
| Intracomunitarias | Bienes UE · Servicios UE · Venta a distancia bajo umbral · B2B |
| Extracomunitarias | Exportación de bienes · Exportación de servicios |
| Exenciones y no sujeciones | Operación Exenta · Operación No Sujeta |
| Impuestos territoriales | IGIC _(próximamente)_ · IPSI _(próximamente)_ |
| Rectificativas | Nota de crédito / Abono · Factura de sustitución |

En el detalle muestran el **Tipo Fiscal** codificado: `F1`.

## Nosotros

**No existe la derivación S2/N1/N2** — es SCRUM-212. Más el `MODO_TIPO_RECTIFICATIVA = 'INCREMENTAL_I'` de SCRUM-216.

## 🏆 Dónde lo hacemos mejor

Su desplegable tiene **quince opciones** y se las planta a un fontanero en el primer campo. «Venta a distancia intracomunitaria por debajo del umbral» no significa nada para quien cambia termos.

1. **Tres opciones visibles**: `Factura normal` · `Ticket (particular sin datos)` · `Rectificativa`. Cubren el 98 % de un gremio.
2. **«Otros casos» plegado** con las doce restantes, agrupadas igual que ellos.
3. **Proponer en vez de preguntar.** Si el cliente tiene NIF intracomunitario, proponemos el tipo y explicamos por qué. El usuario confirma o cambia. **Nunca se elige solo: se propone y se confirma.**

> Un desplegable de quince opciones traslada al usuario una decisión fiscal que él no sabe tomar. Proponer con el motivo escrito le enseña; obligarle a elegir le asusta.

**Absorbe SCRUM-212.**

---

# A2 · Retención IRPF y suplidos

**Ellos:** desplegable por factura en «4. Datos fiscales adicionales» — Sin retención / 7 % profesionales (inicio) / 15 % profesionales / 19 % empresariales, con la nota _«la retención se excluye del total VERI_FACTU»_\*. Y casilla **Suplido** por línea.

**Nosotros:** nada de lo uno ni de lo otro.

## 🏆 Mejor

**La retención no es una propiedad de la factura: es del profesional.** Un electricista o tiene retención o no la tiene. Ellos te obligan a elegirla **cada vez** — una invitación a equivocarte 30 veces al mes.

Nosotros: **se configura una vez** en `Configuración › Facturación`, sale por defecto, y se puede cambiar en la factura concreta. El mismo dato pedido una vez en lugar de treinta.

Y el **suplido** lleva aviso corto de qué es — es el campo que peor se entiende de la factura española: _lo que pagas por cuenta del cliente y le repercutes sin IVA ni margen_.

---

# A3 · Recargo de equivalencia y criterio de caja

**Ellos:** el **recargo** vive en la **ficha del cliente**, con esta explicación (que es correcta y la copiamos en espíritu): _«solo puede aplicarse a comerciantes personas físicas o entidades en atribución de rentas — nunca a sociedades»_. El **criterio de caja (RECC)** vive en `Configuración › Empresa`.

Que el recargo esté en el cliente y no en la factura **es correcto**: es condición de quién compra, no de qué se vende.

## 🏆 Mejor — y es la más importante del bloque

**El criterio de caja significa que el IVA se devenga cuando cobras, no cuando facturas.**

Ellos lo ofrecen como casilla. Pero **no saben cuándo cobras**: no tienen pasarela, ni Bizum, ni conciliación. Su usuario con RECC marcado tiene que llevar a mano qué facturas cobró.

**Nosotros sabemos exactamente cuándo entró cada euro.** Así que en YaQu el criterio de caja **no es una casilla informativa: es una liquidación que se calcula sola**. Ver A5.

Esto no es copiarles mejor. Es hacer algo que ellos **no pueden hacer**.

---

# A4 · Series de numeración

**Ellos:** `Configuración › Numeración`. Tres series (**Ordinaria** `F`, **Rectificativa** `R`, **Simplificada** `FS`), cada una con **Prefijo**, **Formato** (`{prefijo}-{año}-…`), **Dígitos** (5) y **Nº inicial**. Vista previa: _«Próxima factura: F-2026-00001»_. Con dos avisos sobre no dejar huecos y sobre continuar la numeración al migrar.

**Nosotros:** un **prefijo** suelto. Sin series, sin formato, sin nº inicial, sin continuidad.

## 🏆 Mejor

**Sus avisos son texto. Un aviso que no comprueba nada solo reparte la culpa.** Nosotros lo verificamos:

* **Detectar huecos en nuestra propia serie** y avisar con los números que faltan.
* **Al migrar, avisar del choque real**: si dice que va por la 42 y ya hay emitidas por encima, eso se para, no se deja pasar en gris.
* **La numeración es inmutable una vez emitida la primera factura de la serie.** Cambiar el formato con facturas emitidas rompe la secuencialidad que la AEAT exige. Se bloquea, con el motivo escrito.

**Es la base del Bloque D2** (continuidad al migrar).

---

# A5 · Modelo 303

**Ellos:** liquidación por trimestre con **casillas mapeadas** (21 % → 07-09, 10 % → 04-06, 4 % → 01-03, TOTAL casilla 27), cabecera con facturas emitidas / base / IVA devengado / total facturado, y enlace al Libro de Registro. Con el aviso _«Resumen orientativo — consulta con tu asesor fiscal»_.

**Nosotros:** en Informes hay **IVA REPERCUTIDO - MODELO 303** con tipo, base y cuota. La mitad del camino, sin las casillas.

## 🏆 Mejor

1. **Las casillas mapeadas**, como ellos. Eso es alcanzarles.
2. **El 303 cruzado con los cobros reales.** Para un usuario con **criterio de caja** eso no es un informe bonito: es la diferencia entre liquidar bien y liquidar mal. Ellos ofrecen la casilla del RECC y **no pueden calcular su consecuencia**.

El aviso de «orientativo» es **obligatorio** también en el nuestro. No somos asesores fiscales.

---

# A6 · Libro de Registro

**Ellos:** enlazado desde el 303, presente desde su plan de 9 €. **Nosotros:** nada con ese nombre.

Se construye el registro de facturas emitidas en el formato que el asesor espera, exportable.

## 🏆 Lo que añadimos

Que cada asiento **enlace a su origen**: presupuesto firmado, albarán firmado, trabajo y cobro. En una inspección o en una discusión con un cliente, un asiento que lleva detrás la firma del cliente vale más que uno que solo lleva un número.

---

# A7 · Exportar evidencias de cumplimiento

**Ellos — y está muy bien hecho:** `Configuración › Exportar Compliance`. Un ZIP por periodo con **snapshot inmutable, PDF, respuesta VERI\*FACTU y metadatos del QR**, más un `manifest.json` con **checksums SHA-256** y registro de auditoría con usuario y timestamp.

```
compliance-export-<NIF>-<desde>-<hasta>.zip
├── manifest.json          ← metadatos + checksums SHA-256
├── F-2026-00001/
│   ├── immutable_snapshot.json
│   ├── invoice.pdf
│   ├── verifactu_response.json
│   └── qr_metadata.json
└── ...
```

Es exactamente la disciplina que usamos en el repo: **artefacto, checksum, y un manifiesto que ata los dos**. Se copia la estructura entera.

**Nosotros:** `VeriFactu XML` en las descargas y la huella encadenada. Piezas sueltas sin paquete.

## 🏆 Mejor

Su ZIP prueba **lo que se declaró a Hacienda**. El nuestro puede probar además **lo que ocurrió de verdad**: el **presupuesto firmado** por el cliente, el **albarán firmado** en obra con sus fotos, y el **cobro** con su vía.

> Un facturador puede demostrar que emitió. Nosotros podemos demostrar que el cliente aceptó, que se entregó y que se pagó. En un gremio, donde las broncas son «yo no pedí eso» y «eso no me lo hicieron», esa carpeta vale más que la respuesta de la AEAT.

---

# A8 · El interruptor

**Ellos:** `Configuración › Firma electrónica VERI*FACTU` con **Estado: Pendiente** y dos botones. Y al intentar emitir sin firma, un modal con **dos caminos**: «Lo hago yo mismo» (si tienes certificado, 5 minutos) y «Enviar a mi gestoría» (la forma más rápida). **Ese modal de dos caminos es muy bueno** y se copia la forma: reconoce que la mitad de los autónomos no tiene ni idea de certificados y que su gestoría sí.

**Nosotros:** `INVOICING_ES_ENABLED` existe y está **off** (regla 24). Falta que el usuario **vea en qué modo está** y que activarlo sea un interruptor.

Dos modos, nombrados:

* **Se guarda** — la factura se emite, se numera, se sella y **se queda aquí**. Es el estado de hoy.
* **Se envía** — además va a la AEAT por VERI\*FACTU.

## El mensaje, decidido (4-ago-2026)

> **«Preparado para VERI\*FACTU. Se activa con un interruptor en cuanto Hacienda te lo exija.»**

**Prohibido** «VERI\*FACTU incluido» mientras el flag esté apagado: prometería hoy algo que hoy no funciona.

**Y es argumento de venta:** ellos te meten en VERI\*FACTU desde el día uno lo quieras o no. Nosotros te dejamos elegir cuándo entras.

---

# Orden dentro del bloque

```
A0  ← primero, decide el modelo
 ├─ A4  series de numeración      ← base de D2 (migración)
 ├─ A1  tipos de factura          ← absorbe SCRUM-212
 ├─ A2  IRPF y suplidos
 ├─ A3  recargo y criterio de caja
 ├─ A5  Modelo 303                ← necesita A1, A2, A3
 ├─ A6  Libro de Registro         ← necesita A5
 ├─ A7  Exportar evidencias
 └─ A8  el interruptor            ← independiente
```

**A0 y A4 son los cimientos.** A5 y A6 son consecuencia. A7 y A8 son independientes.

---

# Lo que NO entra

* **La presentación** — es el Bloque B.
* **La migración** — el importador es D1; la continuidad de numeración es D2 y se apoya en A4.
* **El envío al gestor** — es E1.
* **Facturas recurrentes** — bloque propio, decidido el 4-ago. (Oportunidad medida: ya tenemos `maintenancePlan`, así que la nuestra puede colgar de un **contrato de mantenimiento** en vez de ser una casilla suelta como la suya.)
* **IGIC e IPSI** — ellos los tienen como «próximamente»; nosotros ni eso. **Fuera de alcance y declarado**, para que nadie lo lea como cobertura total.

---

# MICROCOPY PENDIENTE

Todo el bloque es texto fiscal que ve el usuario, con una capa extra de riesgo: **un texto fiscal mal escrito no es feo, es peligroso.** Nada sin aprobación del fundador (regla 30); lo que toque VeriFactu, **solo el guion H2** (regla 26).

A aprobar: rótulos de los tipos de factura y sus explicaciones · aviso del suplido · aviso del recargo de equivalencia · aviso del criterio de caja · los dos avisos de numeración · el «resumen orientativo» del 303 · los nombres de los dos modos del interruptor.
