(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal on scroll
  var rev = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && !reduce){
    var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.15});
    rev.forEach(function(e){io.observe(e);});
  } else { rev.forEach(function(e){e.classList.add('in');}); }

  // Interactive playable demo
  (function(){
    var screen=document.getElementById('iscreen'); if(!screen)return;
    var scrs=screen.querySelectorAll('.iscr'), steps=document.querySelectorAll('#trySteps .try-step');
    var miniRows=screen.querySelectorAll('[data-scr="0"] .cl-r.anim'), miniTotal=document.getElementById('miniTotal');
    function buildQuote(){
      if(reduce){miniRows.forEach(function(r){r.classList.add('show');});if(miniTotal)miniTotal.textContent='961,95 €';return;}
      if(miniTotal)miniTotal.textContent='—';
      miniRows.forEach(function(r,i){r.classList.remove('show');setTimeout(function(){r.classList.add('show');if(i===miniRows.length-1&&miniTotal)miniTotal.textContent='961,95 €';},300+i*350);});
    }
    function show(n){
      scrs.forEach(function(s){s.classList.toggle('on', +s.dataset.scr===n);});
      var active=Math.min(n,2);
      steps.forEach(function(st){var s=+st.dataset.s;st.classList.toggle('on',s===active);st.classList.toggle('done',s<active);});
      if(n===0) buildQuote();
    }
    var fin=null;
    function terminar(){
      fin=null;
      var sb=document.getElementById('signBtn'), ok=document.getElementById('signOk');
      sb&&sb.classList.add('is-hidden'); ok&&ok.classList.add('on');
      steps.forEach(function(st){st.classList.remove('on');st.classList.add('done');});
    }
    screen.addEventListener('click',function(e){
      var go=e.target.closest('[data-go]'); if(go){show(+go.dataset.go);return;}
      var sg=e.target.closest('[data-sign]');
      // SCRUM-1130 · la demo TERMINA: al acabar el trazo (1,1 s; al momento sin animación) el paso 3
      // queda hecho y el botón deja su sitio al estado final. Antes se quedaba apagado para siempre.
      if(sg){var pad=document.getElementById('ipadSign');pad&&pad.classList.add('draw');
        sg.disabled=true;sg.removeAttribute('data-sign');
        if(reduce)terminar();else fin=setTimeout(terminar,1100);return;}
      var pm=e.target.closest('[data-pm]');
      if(pm){pm.parentNode.querySelectorAll('[data-pm]').forEach(function(x){x.classList.remove('sel');});pm.classList.add('sel');return;}
    });
    var reset=document.getElementById('tryReset');
    reset&&reset.addEventListener('click',function(){
      if(fin){clearTimeout(fin);fin=null;}
      var pad=document.getElementById('ipadSign');pad&&pad.classList.remove('draw');
      var sb=document.getElementById('signBtn');if(sb){sb.disabled=false;sb.setAttribute('data-sign','1');sb.classList.remove('is-hidden');}
      var ok=document.getElementById('signOk');ok&&ok.classList.remove('on');
      show(0);
    });
    buildQuote();
  })();

  // Founding: contador REAL de plazas (si el endpoint falla o no quedan, no se muestra nada falso).
  (function(){
    if(!window.fetch)return;
    fetch('/public/founding-status').then(function(r){return r.json();}).then(function(s){
      // SCRUM-330 · DOS decisiones distintas sobre el MISMO bloque, y por eso van separadas:
      //   · la OFERTA (el precio founding y su condición) se enseña mientras queden plazas. No es
      //     de este ticket, y su texto no se toca NI SE CITA aquí: el guard de SCRUM-341 exige que
      //     toda promesa de permanencia lleve su condición al lado, y un comentario que la copiara
      //     sería una promesa más a ojos de ese guard — con razón. Cazó este mismo comentario;
      //   · la ESCASEZ («quedan N plazas») solo si alguien ha comprado DE VERDAD.
      // Gatear el bloque entero por ventas haría desaparecer el precio founding justo cuando no ha
      // comprado nadie, y entonces nadie podría comprarlo: el pez que se muerde la cola.
      // «Quedan 20 de 20» no comunica escasez: comunica que no ha comprado nadie. Y si el dato no
      // se puede leer, tampoco se pinta — un número inventado es peor que ninguno, porque quien lo
      // lee no tiene forma de saber que lo es. Misma expresión, con el mismo nombre, en precios.html.
      var pintarPlazas = !!(s && typeof s.taken==='number' && s.taken>0
        && typeof s.seatsLeft==='number' && s.seatsLeft>0);
      if(s && typeof s.seatsLeft==='number' && s.seatsLeft>0){
        if(pintarPlazas){
          var a=document.getElementById('ann-left'), f=document.getElementById('founding-left');
          if(a)a.textContent=s.seatsLeft; if(f)f.textContent=s.seatsLeft;
        }else{
          var ap=document.getElementById('ann-plazas'), fp=document.getElementById('founding-plazas');
          if(ap)ap.hidden=true; if(fp)fp.hidden=true;
        }
        var ab=document.getElementById('announce'), fb=document.getElementById('founding-banner');
        if(ab)ab.hidden=false; if(fb)fb.hidden=false;
      }
    }).catch(function(){});
  })();

  // SCRUM-336: la atribución YA NO se persiste en el navegador del visitante (ePrivacy art. 5.3:
  // almacenar sin consentimiento algo que no es imprescindible para el servicio pedido). Ahora
  // viaja en la URL hasta el registro — ver `js/atribucion.js`, cargado abajo.
})();
