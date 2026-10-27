// SCRUM-1625b · CENTINELA del experimento: esta rama saca la sonda de SCRUM-1574 fuera de ④ de
// scrum1405c para medir en el CI si es ella la que sube la pérdida del brazo CON (c.21102, decisión
// del fundador en c.21104). La rama NO puede entrar en main y el bot arma el auto-merge en cada
// empujón: este caso cae SIEMPRE, así que el obligatorio sale rojo y el auto-merge no mergea nunca.
// Si lo ves en main, alguien lo ha mergeado a mano: se revierte el merge entero.
import test from 'node:test';
import assert from 'node:assert/strict';

test('SCRUM-1625b · EXPERIMENTO — NO MERGEAR', () => {
  assert.fail('🔴 SCRUM-1625b · EXPERIMENTO — NO MERGEAR: esta rama mide la sonda de 1574 fuera de ④ y no puede entrar en main');
});
