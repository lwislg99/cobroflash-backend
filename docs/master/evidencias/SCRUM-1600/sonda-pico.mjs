// Sonda --import (mismo instrumento que SCRUM-1244 ③): al salir, escribe el maxRSS del proceso.
import fs from 'node:fs';
const destino = process.env.SONDA_PICO_FICHERO;
process.on('exit', () => {
  if (!destino) return;
  const ru = process.resourceUsage();
  fs.appendFileSync(destino, JSON.stringify({ pid: process.pid, argv: process.argv.slice(1).join(' '), maxRSS_MB: Math.round(ru.maxRSS / 1024), seg: Math.round(process.uptime() * 10) / 10 }) + '\n');
});
