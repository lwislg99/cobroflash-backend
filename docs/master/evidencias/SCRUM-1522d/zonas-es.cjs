// SCRUM-1522d: lo que el motor (Intl de node) sabe de las zonas de ES, sin dependencias.
// Poblacion declarada en la primera linea; EXIT en la ultima.
const zonas = Intl.supportedValuesOf('timeZone');
console.log('POBLACION zonas que conoce Intl =', zonas.length, '· node', process.version, '· ICU', process.versions.icu);

// 1) Las tres zonas de ES existen para el motor (positivo) y una inventada no (cero).
const valida = (z) => { try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; } };
for (const z of ['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta', 'Europe/Zzqx1522d']) {
  console.log('  zona', z, '· en la lista:', zonas.includes(z), '· la acepta el motor:', valida(z));
}

// 2) Cuantas horas de 2026 marcan un reloj distinto del de Madrid.
const f = (z) => new Intl.DateTimeFormat('en-US', { timeZone: z, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' });
const fm = f('Europe/Madrid');
const ini = Date.UTC(2026, 0, 1), fin = Date.UTC(2027, 0, 1);
const horas = (fin - ini) / 3600000;
for (const z of ['Atlantic/Canary', 'Africa/Ceuta', 'Europe/Madrid']) {
  const fz = f(z); let dist = 0;
  for (let t = ini; t < fin; t += 3600000) if (fz.format(t) !== fm.format(t)) dist++;
  console.log('  horas de 2026 con reloj distinto de Madrid ·', z, '=', dist, 'de', horas);
}

// 3) Lo que el NAVEGADOR diria (aqui, lo que dice esta maquina): la zona del dispositivo.
console.log('  zona del dispositivo segun Intl =', Intl.DateTimeFormat().resolvedOptions().timeZone);

// 4) Nombres en castellano que el motor sabe dar de una zona (para el texto de confirmacion).
for (const z of ['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta']) {
  const p = new Intl.DateTimeFormat('es-ES', { timeZone: z, timeZoneName: 'longGeneric' }).formatToParts(Date.UTC(2026, 6, 1)).find((x) => x.type === 'timeZoneName');
  console.log('  nombre en castellano de', z, '=', p && p.value);
}
console.log('EXIT=0');
