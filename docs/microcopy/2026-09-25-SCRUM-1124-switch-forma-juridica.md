# SCRUM-1124 · switch «Empresa | Persona» del contacto: 3 textos

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## Los literales, tal cual se pintan

`public/dashboard/js/switchFormaJuridica.js`:

> Este contacto es

Pregunta que encabeza el control.

> Empresa

Etiqueta del lado EMPRESA.

> Persona

Etiqueta del lado PERSONA.

## Qué cambió

Los tres salían de una sola constante `MARCADOR` (`[PENDIENTE microcopy oficial]`), concatenada
con la palabra de trabajo (p. ej. `[PENDIENTE microcopy oficial] Empresa`). La constante se
retiró entera en el mismo commit que se aplicó el texto, junto con su exportación
(`switchFormaJuridica.MARCADOR`, `module.exports.MARCADOR`).
