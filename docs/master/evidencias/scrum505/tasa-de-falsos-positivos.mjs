// docs/master/evidencias/scrum505/tasa-de-falsos-positivos.mjs — SCRUM-505
//
// EL NUMERO QUE DECIDE EL CRITERIO. *Un guard demasiado amplio acaba relajado*, asi que la tasa
// se mide ANTES de proponer nada.
//
// ⛔ TODO FABRICADO. Ni un dato real de nadie: los correos usan `.example` (TLD reservado por la
// RFC 2606 para documentacion) y los telefonos salen del rango imposible de la casa
// (`scripts/_telefonos-prueba.mjs`, SCRUM-262), que no puede corresponder a ninguna linea.
import { fileURLToPath } from 'node:url';
const { formasEnTexto, LIMITES } = await import(new URL('../../../../tests/_dato-personal-en-contenido.mjs', import.meta.url).href);
const { telefonoDePrueba } = await import(new URL('../../../../scripts/_telefonos-prueba.mjs', import.meta.url).href);

// ── ① EL CORPUS LEGITIMO: textos de obra que un profesional escribe de verdad ─────────────
// Llevan dentro lo que mas se parece a un dato personal sin serlo: importes, fechas, NIF,
// numeros de factura, referencias, medidas, codigos postales, horas.
const LEGITIMOS = [
  'Cambiar bajante de PVC 110 en patio interior. Acceso por el portal.',
  'Presupuesto aceptado por el administrador de la finca el 12/03/2026.',
  'Material: 3 m de tubo, 2 codos 90 grados, silicona neutra.',
  'Factura 2026-CF-000123 pendiente de cobro por transferencia.',
  'Importe 1.234,56 EUR con IVA 21% incluido. Base 1020,30.',
  'NIF del cliente B12345678 comprobado en el registro.',
  'IBAN de la empresa pendiente de facilitar por el cliente.',
  'Obra en calle del Pez 14, 3 izquierda. Codigo postal 28004.',
  'Llamar antes de ir. Horario de 8 a 14 y de 16 a 19.',
  'Referencia catastral 1234567AB1234C0001XY.',
  'Se han instalado 9 radiadores de 800 x 600 mm.',
  'Pedido 987654321 del proveedor, entrega en 48 horas.',
  'Revision anual del 2026. Proxima en marzo de 2027.',
  'Descuento del 15% aplicado sobre 2.500 EUR.',
  'Albaran ALB-2026-0042 firmado por el encargado de obra.',
  'Cita el 7 de abril a las 10:30. Duracion estimada 2 horas.',
  'Caldera modelo XG-7700 con numero de serie 66778899.',
  'Contador de agua marcaba 123456 litros al entrar.',
  'Se adjuntan 4 fotos del estado previo de la instalacion.',
  'El cliente prefiere que no se avise a nadie antes de subir.',
  'Trabajo de 6 horas a 45 EUR/hora mas desplazamiento.',
  'Garantia de 24 meses desde la fecha de este parte.',
  'Presion de red 3,5 bar medida en el grifo de la cocina.',
  'Piso 7, puerta 8. El portero abre de 9 a 13.',
  'Pago fraccionado en 3 plazos de 400 EUR.',
];

// ── ② EL CORPUS CON DATO PERSONAL ESCONDIDO, tambien fabricado ────────────────────────────
//
// 🔴 LO DEL TELEFONO, QUE ES UN HALLAZGO DEL PROPIO BANCO Y NO UN DETALLE:
//
// La primera version uso `telefonoDePrueba()` —el rango IMPOSIBLE de la casa (SCRUM-262)— y el
// detector no vio NI UNO. **No era el detector: era el banco.** Ese rango empieza por `34` a
// proposito, para no poder corresponder a ninguna linea real, y por eso **no tiene forma de movil
// espanol** (que empieza por 6 o 7). Probar un detector de moviles espanoles con algo que no lo
// parece no prueba nada.
//
// La forma se prueba con una SECUENCIA ASCENDENTE trivial, que es una forma y no el numero de
// nadie. Y el caso del rango imposible se deja dentro **a proposito**, porque su «no detectado»
// es informacion: dice que el detector no dispara sobre cualquier tirada larga de digitos.
const FORMA_SINTETICA_DE_MOVIL = '612345678'; // 6-1-2-3-4-5-6-7-8: una secuencia, no una linea
const CON_DATO = [
  `El cliente pide que le escriban a ana@obra.example antes de ir.`,
  `Contacto alternativo: ${FORMA_SINTETICA_DE_MOVIL} (su hija).`,
  `Mandar el presupuesto a jefe.obra@constructora.example, no al administrador.`,
  `Telefono del portero ${FORMA_SINTETICA_DE_MOVIL} para acceder al patio.`,
  `Devolver el importe al IBAN ES9121000418450200051332.`,
  `Avisar por correo a maria.lopez@vecinos.example y esperar respuesta.`,
];

// Y aparte, el control de que el rango imposible NO se detecta — con su motivo.
const RANGO_IMPOSIBLE = `Contacto interno de pruebas: ${telefonoDePrueba(11)}.`;

let fp = 0;
const fallos = [];
for (const t of LEGITIMOS) {
  const formas = formasEnTexto(t);
  if (formas.length) { fp++; fallos.push({ texto: t, formas }); }
}

let fn = 0;
const escapados = [];
for (const t of CON_DATO) {
  if (!formasEnTexto(t).length) { fn++; escapados.push(t); }
}

console.log('CORPUS FABRICADO — ni un dato real de nadie');
console.log(`   textos legitimos de obra: ${LEGITIMOS.length}`);
console.log(`   textos con dato personal escondido: ${CON_DATO.length}`);
console.log('');
console.log('🔴 TASA DE FALSOS POSITIVOS (el numero que decide el criterio)');
console.log(`   ${fp} de ${LEGITIMOS.length}  =  ${((fp / LEGITIMOS.length) * 100).toFixed(1)} %`);
for (const f of fallos) console.log(`     🔴 «${f.texto.slice(0, 62)}…» -> ${f.formas.join(', ')}`);
console.log('');
console.log('TASA DE FALSOS NEGATIVOS (lo que se le escapa de lo que SI lleva dato)');
console.log(`   ${fn} de ${CON_DATO.length}  =  ${((fn / CON_DATO.length) * 100).toFixed(1)} %`);
for (const e of escapados) console.log(`     ⚠️ «${e.slice(0, 62)}…»`);
console.log('');

// ── SUELO del propio banco: si el corpus con dato no dispara NADA, no mide nada ───────────
const detectados = CON_DATO.length - fn;
if (detectados === 0) {
  console.log('🔴 BANCO CIEGO: el detector no ve ni uno de los textos que SI llevan dato personal.');
  console.log('   Con eso, una tasa de falsos positivos del 0 % solo significaria que no detecta nada.');
  process.exit(3);
}
console.log(`SUELO: el detector SI ve ${detectados} de ${CON_DATO.length} con dato dentro, asi que`);
console.log('       una tasa baja de falsos positivos significa algo.');
console.log('');
console.log('CONTROL DEL RANGO IMPOSIBLE (SCRUM-262) — y su «no» es informacion:');
const veElImposible = formasEnTexto(RANGO_IMPOSIBLE).length > 0;
console.log(`   «${RANGO_IMPOSIBLE.slice(0, 52)}…» -> ${veElImposible ? '🔴 detectado' : 'no detectado ✅'}`);
console.log('   Empieza por 34 y por eso NO tiene forma de movil espanol. Que no dispare dice que');
console.log('   el detector no salta sobre cualquier tirada larga de digitos — es el mismo motivo');
console.log('   por el que el «Pedido 987654321» de arriba SI dispara: aquel si tiene la forma.');
console.log('');
console.log('LIMITES DECLARADOS (lo que NO ve, dicho aqui y no descubierto en un rojo raro):');
for (const l of LIMITES) console.log(`   · ${l}`);
