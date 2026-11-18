    // SCRUM-336: la captura first-touch en `localStorage` se retiró de esta página igual que de la
    // landing (ePrivacy art. 5.3). La atribución viaja ahora en la URL — ver `js/atribucion.js`.

    // Contador REAL de plazas founding (V0-4): si quedan, se muestra el banner y el 29 tachado.
    fetch('/public/founding-status').then(function (r) { return r.json(); }).then(function (f) {
      if (!f || typeof f.seatsLeft !== 'number' || f.seatsLeft <= 0) return;
      document.getElementById('founding-banner').classList.remove('precios-oculto');
      // SCRUM-330 · la ESCASEZ solo se pinta si alguien ha comprado DE VERDAD. La OFERTA (precio,
      // tachado, CTA) se sigue mostrando igual — es otra decisión y no es de este ticket.
      // «Quedan 20 de 20» no comunica escasez: comunica que no ha comprado nadie. Y con el dato
      // ilegible tampoco se inventa un número: la frase se queda fuera.
      var pintarPlazas = !!(f && typeof f.taken === 'number' && f.taken > 0
        && typeof f.seatsLeft === 'number' && f.seatsLeft > 0);
      document.getElementById('founding-seats').textContent = pintarPlazas
        ? 'Quedan ' + f.seatsLeft + ' de ' + f.seatsTotal + ' plazas'
        : '';
      document.getElementById('price-old').classList.remove('precios-oculto');
      document.getElementById('price').textContent = '9,90 €';
      document.getElementById('cta').textContent = 'Quiero mi plaza founding';
    }).catch(function () {});
