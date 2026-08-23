global.game = {i18n:{lang:'en',localize:key=>key}};
const {contenidoEstadoBitacora}=require('./foundry-module/scripts/bitacora-nave.mjs');
const nave={callsign:'<script>alert("x")</script>', position:{x:12,y:3}, heading:200, hull:50, hull_max:100, energy:60, energy_max:80, shields_active:true};
const marca='<b>Marca</b>';
console.log(contenidoEstadoBitacora(nave,marca));
