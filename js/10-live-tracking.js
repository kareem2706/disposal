// ── LIVE DRIVER TRACKING ──────────────────────────────
// Driver side: while a ride is "En chemin" or in progress, the phone's position is shared (table ride_locations).
var _trk={ watch:null, rides:[], lastSent:0, lastPos:null, wake:null, status:'' };
function _trkDist(a,b){ var R=6371000,toR=Math.PI/180,dLa=(b.lat-a.lat)*toR,dLo=(b.lng-a.lng)*toR; var x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); }
function _trkSetStatus(txt, warn){
  _trk.status=txt;
  var el=document.getElementById('trk-status'); if(!el) return;
  el.textContent=txt; el.style.color=warn?'var(--red)':'var(--ink3)';
}
async function _trkSend(pos){
  if(!sb||!currentUser||!_trk.rides.length) return;
  var c=pos.coords, p={ lat:c.latitude, lng:c.longitude }, acc=c.accuracy||9999, now=Date.now();
  // 1) Precision filter: keep only real GPS fixes (≤ 25 m). Wi-Fi/cell estimates (50 m – 3 km) are discarded,
  //    unless no GPS fix has been obtained for 30 s (then sent, but flagged).
  if(acc<=25) _trk.lastGood=now;
  if(acc>25 && _trk.lastGood && now-_trk.lastGood<30000) return;
  if(acc>25 && !_trk.lastGood && (!_trk.firstFix || now-_trk.firstFix<30000)){ _trk.firstFix=_trk.firstFix||now; _trkSetStatus('📍 Recherche du signal GPS… (précision actuelle ± '+Math.round(acc)+' m)'); return; }
  // 2) Reject impossible jumps (> 60 m/s ≈ 216 km/h) caused by a bad fix
  if(_trk.lastPos && _trk.lastSent){ var dt=(now-_trk.lastSent)/1000; if(dt>0 && _trkDist(_trk.lastPos,p)/dt>60 && acc>10) return; }
  // 3) Send often: every 2 s when moving (≥ 3 m), heartbeat every 5 s when stopped
  var moved=_trk.lastPos?_trkDist(_trk.lastPos,p):Infinity;
  if(_trk.lastPos && !((moved>=3 && now-_trk.lastSent>=2000) || now-_trk.lastSent>=5000)) return;
  if(_trk.sending) return;
  _trk.sending=true; _trk.lastSent=now; _trk.lastPos=p;
  var rows=_trk.rides.map(function(id){ return { ride_id:id, driver_id:currentUser.id, lat:p.lat, lng:p.lng,
    heading:(c.heading!=null&&!isNaN(c.heading))?c.heading:null,
    speed:(c.speed!=null&&!isNaN(c.speed))?c.speed:null,
    accuracy:Math.round(acc), updated_at:new Date().toISOString() }; });
  try{
    if(_trkNativeGeo()){
      var _ss=(await sb.auth.getSession()).data.session;
      var _res=await Capacitor.registerPlugin('CapacitorHttp').request({ url:SB_URL+'/rest/v1/rpc/api_location_push', method:'POST',
        headers:{ apikey:SB_KEY, Authorization:'Bearer '+(_ss?_ss.access_token:SB_KEY), 'Content-Type':'application/json' }, data:{ p_rows: rows } });
      if(!_res || _res.status>=300) throw new Error('HTTP '+(_res?_res.status:'?'));
    } else {
      var {error}=await sb.rpc('api_location_push',{ p_rows: rows });
      if(error) throw error;
    }
    var t=new Date().toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    if(acc>25) _trkSetStatus('⚠️ Précision faible (± '+Math.round(acc)+' m) — activez « Position exacte » pour le navigateur dans les réglages du téléphone · '+t,true);
    else _trkSetStatus('📍 Position GPS partagée (± '+Math.round(acc)+' m)'+(_trkNativeGeo()?' · même écran verrouillé':'')+' · '+t);
  }catch(e){ console.warn('[tracking] upsert failed',e); _trkSetStatus('⚠️ Position non envoyée ('+(e.message||e)+')',true); }
  finally{ _trk.sending=false; }
}
async function _trkWakeLock(on){
  try{
    if(on && !_trk.wake && navigator.wakeLock){ _trk.wake=await navigator.wakeLock.request('screen'); _trk.wake.addEventListener('release',function(){ _trk.wake=null; }); }
    if(!on && _trk.wake){ await _trk.wake.release(); _trk.wake=null; }
  }catch(e){}
}
// Called with the driver's rides in progress; starts/stops GPS sharing accordingly
// Inside the Bleenr Chauffeur app (Capacitor), GPS continues in the background / screen locked
function _trkNativeGeo(){
  try{ if(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.registerPlugin){ return _trk.bg || (_trk.bg=Capacitor.registerPlugin('BackgroundGeolocation')); } }catch(e){}
  return null;
}
function _syncDriverTracking(list){
  _trk.rides=(list||[]).map(function(r){ return r.id; });
  var BG=_trkNativeGeo();
  if(!_trk.rides.length){
    if(_trk.nativeId){ try{ BG&&BG.removeWatcher({id:_trk.nativeId}); }catch(e){} _trk.nativeId=null; }
    if(_trk.watch!=null){ navigator.geolocation.clearWatch(_trk.watch); _trk.watch=null; }
    _trkWakeLock(false); _trk.lastPos=null; _trk.lastGood=null; _trk.firstFix=null; return;
  }
  if(BG){
    if(!_trk.nativeId && !_trk.nativeStarting){
      _trk.nativeStarting=true;
      _trkSetStatus('📍 Activation de la localisation…');
      (async function(){
        try{ if(Capacitor.getPlatform()==='android'){ await Capacitor.registerPlugin('LocalNotifications').requestPermissions(); } }catch(e){}
        try{
          _trk.nativeId=await BG.addWatcher({
            backgroundTitle:'Bleenr — course en cours',
            backgroundMessage:'Votre position est partagée avec le client jusqu\'à la fin de la mission.',
            requestPermissions:true, stale:false, distanceFilter:3
          },function(loc,err){
            if(err){
              if(err.code==='NOT_AUTHORIZED'){ _trkSetStatus('⚠️ Localisation refusée — touchez ici pour ouvrir les réglages',true); var st=document.getElementById('trk-status'); if(st) st.onclick=function(){ BG.openSettings(); }; }
              else _trkSetStatus('⚠️ Position indisponible',true);
              return;
            }
            if(!loc) return;
            _trkSend({ coords:{ latitude:loc.latitude, longitude:loc.longitude, accuracy:loc.accuracy, heading:loc.bearing, speed:loc.speed } });
          });
        }catch(e){ _trkSetStatus('⚠️ Localisation impossible ('+(e.message||e)+')',true); }
        _trk.nativeStarting=false;
      })();
    } else if(_trk.status){ _trkSetStatus(_trk.status); }
    return;
  }
  if(!navigator.geolocation){ _trkSetStatus('⚠️ Localisation non disponible sur cet appareil',true); return; }
  _trkWakeLock(true);
  if(_trk.watch==null){
    _trkSetStatus('📍 Activation de la localisation…');
    _trk.watch=navigator.geolocation.watchPosition(_trkSend,function(err){
      _trkSetStatus(err&&err.code===1?'⚠️ Localisation refusée — autorisez-la pour que le client vous suive':'⚠️ Position indisponible',true);
    },{ enableHighAccuracy:true, maximumAge:0, timeout:15000 });
  } else if(_trk.status){ _trkSetStatus(_trk.status); }
}
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible' && _trk.rides.length){ _trkWakeLock(true); _trk.lastSent=0; } });

// ── LIVE TRACKING VIEW (client & admin) — Uber/Bolt style ─────────────
var _lt=null;
function _ltWhenMaps(cb, n){ n=n||0; if(window.google&&google.maps&&google.maps.Map) return cb(); if(n>60) return; setTimeout(function(){ _ltWhenMaps(cb,n+1); },250); }
function _ltBearing(a,b){ var toR=Math.PI/180, y=Math.sin((b.lng-a.lng)*toR)*Math.cos(b.lat*toR), x=Math.cos(a.lat*toR)*Math.sin(b.lat*toR)-Math.sin(a.lat*toR)*Math.cos(b.lat*toR)*Math.cos((b.lng-a.lng)*toR); return (Math.atan2(y,x)/toR+360)%360; }
function _ltCarSymbol(rot){
  return { path:'M -7,-12 Q 0,-16 7,-12 L 8,10 Q 0,15 -8,10 Z M -5.5,-6 L 5.5,-6 L 4.5,-1 L -4.5,-1 Z',
    fillColor:'#1B5E3B', fillOpacity:1, strokeColor:'#FFFFFF', strokeWeight:2, scale:1.35, rotation:rot||0, anchor:new google.maps.Point(0,0) };
}
function _ltPin(color,label){
  return { url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 39s13-13.4 13-23.5A13 13 0 002 15.5C2 25.6 15 39 15 39z" fill="'+color+'" stroke="#fff" stroke-width="2"/><text x="15" y="20" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="#fff">'+label+'</text></svg>'),
    scaledSize:new google.maps.Size(30,40), anchor:new google.maps.Point(15,39) };
}
window.openLiveTracking = async function(rideId){
  if(!sb) return;
  closeLiveTracking();
  var esc=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var ov=document.createElement('div'); ov.id='lt-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:9500;background:#E9EEEA;font-family:\'DM Sans\',sans-serif;';
  ov.innerHTML='<div id="lt-map" style="position:absolute;inset:0;"></div>'
    +'<button onclick="closeLiveTracking()" aria-label="'+t('app.fermer')+'" style="position:absolute;top:calc(14px + env(safe-area-inset-top));left:14px;z-index:2;width:44px;height:44px;border-radius:50%;border:none;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A2E1A" stroke-width="2.4" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>'
    +'<button id="lt-recenter" onclick="_ltRecenter()" aria-label="'+t('app.recentrer')+'" style="position:absolute;right:14px;bottom:calc(var(--lt-sheet,190px) + 14px);z-index:2;width:44px;height:44px;border-radius:50%;border:none;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B5E3B" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>'
    +'<div id="lt-sheet" style="position:absolute;left:0;right:0;bottom:0;z-index:2;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -6px 30px rgba(0,0,0,.16);padding:10px 20px calc(18px + env(safe-area-inset-bottom));max-width:620px;margin:0 auto;">'
      +'<div style="width:40px;height:4px;border-radius:2px;background:#D9D9D9;margin:0 auto 14px;"></div>'
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
        +'<div style="min-width:0;"><div id="lt-title" style="font-size:19px;font-weight:700;color:#1A2E1A;">'+t('app.chargement')+'</div><div id="lt-sub" style="font-size:13px;color:#5A7A5A;margin-top:3px;"></div></div>'
        +'<div id="lt-eta" style="flex-shrink:0;text-align:center;background:#1B5E3B;color:#fff;border-radius:12px;padding:8px 12px;display:none;"><div id="lt-eta-v" style="font-size:20px;font-weight:700;line-height:1;"></div><div style="font-size:10.5px;opacity:.85;margin-top:3px;">'+t('app.min')+'</div></div>'
      +'</div>'
      +'<div id="lt-progress" style="display:flex;gap:6px;margin:14px 0;"></div>'
      +'<div id="lt-driver" style="display:flex;align-items:center;gap:12px;padding-top:12px;border-top:1px solid #EEE;"></div>'
      +'<div id="lt-upd" style="font-size:11px;color:#9EB0A3;margin-top:10px;"></div>'
    +'</div>';
  document.body.appendChild(ov);
  document.body.style.overflow='hidden';
  _lt={ id:rideId, ride:null, loc:null, shown:null, rot:0, follow:true, channels:[], timers:[], esc:esc, raf:null };
  var sheet=document.getElementById('lt-sheet');
  var setSheetVar=function(){ if(sheet) ov.style.setProperty('--lt-sheet', sheet.offsetHeight+'px'); };

  // Ride + people
  try{ _lt.ride=(await sb.from('rides').select('*').eq('id',rideId).maybeSingle()).data; }catch(e){}
  if(!_lt||!_lt.ride){ document.getElementById('lt-title').textContent='Course introuvable'; return; }
  var r=_lt.ride, veh=null, drv=null;
  try{
    var of=(await sb.from('offers').select('vehicle_id,fleet_driver_id,driver_id').eq('ride_id',r.id).eq('status','accepted').maybeSingle()).data;
    if(of&&of.vehicle_id) veh=(await sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',of.vehicle_id).maybeSingle()).data;
    if(of&&of.fleet_driver_id) drv=(await sb.from('fleet_drivers').select('first_name,last_name,phone').eq('id',of.fleet_driver_id).maybeSingle()).data;
    if(!drv&&r.driver_id) drv=(await sb.from('profiles').select('first_name,last_name,phone,company_name').eq('id',r.driver_id).maybeSingle()).data;
  }catch(e){}
  if(!_lt) return;
  var dName=drv?(((drv.first_name||'')+' '+(drv.last_name||'')).trim()||drv.company_name||'Chauffeur'):'Chauffeur';
  var vName=veh?[((veh.brand||'')+' '+(veh.model||'')).trim(),veh.color].filter(Boolean).join(' · '):'';
  var initials=dName.split(' ').map(function(w){return w.charAt(0);}).join('').slice(0,2).toUpperCase();
  document.getElementById('lt-driver').innerHTML='<div style="width:46px;height:46px;border-radius:50%;background:#EAF7EF;color:#1B5E3B;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+esc(initials||'—')+'</div>'
    +'<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;color:#1A2E1A;">'+esc(dName)+'</div>'
      +'<div style="font-size:12.5px;color:#5A7A5A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(vName||'—')+'</div></div>'
    +(veh&&veh.plate?'<div style="flex-shrink:0;font-family:monospace;font-weight:700;font-size:13px;background:#fff;color:#C0392B;border:1.5px solid #C0392B;border-radius:6px;padding:4px 8px;">'+esc(veh.plate)+'</div>':'')
    +(drv&&drv.phone?'<a href="tel:'+esc(drv.phone)+'" aria-label="'+t('app.appeler')+'" style="flex-shrink:0;width:42px;height:42px;border-radius:50%;background:#1B5E3B;display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z"/></svg></a>':'');
  _ltRenderStatus(); setSheetVar();

  _ltWhenMaps(function(){
    if(!_lt) return;
    _lt.map=new google.maps.Map(document.getElementById('lt-map'),{ center:{lat:50.8466,lng:4.3528}, zoom:13, disableDefaultUI:true, clickableIcons:false, gestureHandling:'greedy',
      styles:[{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'simplified'}]}] });
    _lt.map.addListener('dragstart',function(){ if(_lt) _lt.follow=false; });
    _lt.route=new google.maps.Polyline({ map:_lt.map, strokeColor:'#1B5E3B', strokeOpacity:.9, strokeWeight:5 });
    var geo=new google.maps.Geocoder();
    var place=function(addr,color,label,key){ if(!addr) return; try{ geo.geocode({address:addr},function(res,st){ if(_lt&&st==='OK'&&res[0]){ _lt[key]=res[0].geometry.location; new google.maps.Marker({map:_lt.map,position:_lt[key],icon:_ltPin(color,label),zIndex:5}); if(!_lt.loc) _lt.map.setCenter(_lt[key]); _ltRoute(true); } }); }catch(e){} };
    place(r.from_address,'#1B5E3B','A','pickup');
    if(r.trip_type!=='disposal' && r.to_address) place(r.to_address,'#C0392B','B','dest');
    if(_lt.loc) _ltOnLoc(_lt.loc,true);
  });

  // Data: realtime + polling fallback
  var pull=async function(){
    if(!_lt) return;
    try{ var l=(await sb.from('ride_locations').select('*').eq('ride_id',rideId).maybeSingle()).data; if(l) _ltOnLoc(l); else if(!_lt.loc) _ltRenderStatus(); }catch(e){}
    try{ var rr=(await sb.from('rides').select('*').eq('id',rideId).maybeSingle()).data; if(rr&&_lt){ var ph=!!_lt.ride.pickup_at!==!!rr.pickup_at; _lt.ride=rr; _ltRenderStatus(); if(ph) _ltRoute(true); } }catch(e){}
  };
  await pull();
  try{ _lt.channels.push(sb.channel('lt_'+rideId).on('postgres_changes',{event:'*',schema:'public',table:'ride_locations',filter:'ride_id=eq.'+rideId},function(pl){ if(pl&&pl.new&&pl.new.lat!=null) _ltOnLoc(pl.new); }).subscribe()); }catch(e){}
  _lt.timers.push(setInterval(pull,4000));
  _lt.timers.push(setInterval(function(){ _ltRenderUpd(); },15000));
  window.addEventListener('resize',setSheetVar);
};
window.closeLiveTracking=function(){
  if(_lt){ _lt.channels.forEach(function(c){ try{ sb.removeChannel(c); }catch(e){} }); _lt.timers.forEach(clearInterval); if(_lt.raf) cancelAnimationFrame(_lt.raf); }
  _lt=null;
  var ov=document.getElementById('lt-overlay'); if(ov) ov.remove();
  document.body.style.overflow='';
};
window._ltRecenter=function(){ if(!_lt||!_lt.map) return; _lt.follow=true; _ltFrame(true); };
function _ltTarget(){ if(!_lt) return null; return _lt.ride&&_lt.ride.pickup_at ? (_lt.dest||null) : (_lt.pickup||null); }
function _ltFrame(force){
  if(!_lt||!_lt.map||!_lt.shown||(!_lt.follow&&!force)) return;
  var t=_ltTarget(), car=new google.maps.LatLng(_lt.shown.lat,_lt.shown.lng);
  if(t){ var b=new google.maps.LatLngBounds(); b.extend(car); b.extend(t); var sh=(document.getElementById('lt-sheet')||{}).offsetHeight||200; _lt.map.fitBounds(b,{top:90,left:50,right:50,bottom:sh+40}); if(_lt.map.getZoom()>17) _lt.map.setZoom(17); }
  else { _lt.map.panTo(car); if(_lt.map.getZoom()<15) _lt.map.setZoom(15); }
}
function _ltOnLoc(l, initial){
  if(!_lt) return;
  var prevLoc=_lt.loc; if(prevLoc && prevLoc.updated_at===l.updated_at && prevLoc.lat===l.lat && prevLoc.lng===l.lng) return; _lt.loc=l; _ltRenderUpd();
  if(!_lt.map) return;
  var to={lat:l.lat,lng:l.lng};
  if(l.heading!=null && !isNaN(l.heading)) _lt.rot=l.heading;
  else if(_lt.shown && _trkDist(_lt.shown,to)>5) _lt.rot=_ltBearing(_lt.shown,to);
  if(!_lt.car){
    _lt.car=new google.maps.Marker({ map:_lt.map, position:to, icon:_ltCarSymbol(_lt.rot), zIndex:20 });
    _lt.shown=to; _ltFrame(true); _ltRoute(true); _ltRenderStatus(); return;
  }
  // smooth glide between the two positions
  var from=_lt.shown||to, t0=performance.now(), dur=initial?0:1000;
  if(_lt.raf) cancelAnimationFrame(_lt.raf);
  var step=function(now){
    if(!_lt||!_lt.car) return;
    var k=dur?Math.min(1,(now-t0)/dur):1, e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    _lt.shown={ lat:from.lat+(to.lat-from.lat)*e, lng:from.lng+(to.lng-from.lng)*e };
    _lt.car.setPosition(_lt.shown); _lt.car.setIcon(_ltCarSymbol(_lt.rot));
    if(k<1) _lt.raf=requestAnimationFrame(step); else { _lt.raf=null; _ltFrame(); }
  };
  _lt.raf=requestAnimationFrame(step);
  _ltRoute(false);
}
function _ltRoute(force){
  if(!_lt||!_lt.map||!_lt.loc||!window.google||!google.maps.DirectionsService) return;
  var t=_ltTarget();
  if(!t){ _lt.route.setPath([]); _lt.etaMin=null; _ltRenderStatus(); return; }
  if(!force && _lt.routeAt && Date.now()-_lt.routeAt<30000) return;
  _lt.routeAt=Date.now();
  try{
    new google.maps.DirectionsService().route({ origin:{lat:_lt.loc.lat,lng:_lt.loc.lng}, destination:t, travelMode:'DRIVING' },function(res,st){
      if(!_lt) return;
      if(st==='OK'&&res.routes[0]){ _lt.route.setPath(res.routes[0].overview_path); var leg=res.routes[0].legs[0]; _lt.etaMin=Math.max(1,Math.round(leg.duration.value/60)); _lt.distTxt=leg.distance.text; }
      else { _lt.route.setPath([{lat:_lt.loc.lat,lng:_lt.loc.lng},t]); }
      _ltRenderStatus(); _ltFrame();
    });
  }catch(e){}
}
function _ltRenderUpd(){
  var el=document.getElementById('lt-upd'); if(!el||!_lt) return;
  if(!_lt.loc){ el.textContent=''; return; }
  var s=Math.max(0,Math.round((Date.now()-new Date(_lt.loc.updated_at).getTime())/1000));
  el.innerHTML=(s>120?'<span style="color:#B7791F;font-weight:600;">'+t('app.signal_gps_perdu_depuis')+' '+Math.round(s/60)+' '+t('app.min')+'</span>':'● Position en direct'+(_lt.loc.accuracy?' (± '+Math.round(_lt.loc.accuracy)+' m)':'')+' · mise à jour '+(s<10?'à l\'instant':'il y a '+(s<60?s+' s':Math.round(s/60)+' min')))
    +' · '+_lt.esc(_lt.ride&&_lt.ride.booking_code||'');
}
function _ltRenderStatus(){
  if(!_lt||!_lt.ride) return;
  var r=_lt.ride, t=document.getElementById('lt-title'), s=document.getElementById('lt-sub'), eb=document.getElementById('lt-eta'), ev=document.getElementById('lt-eta-v'), pg=document.getElementById('lt-progress');
  if(!t) return;
  var hhmm=function(min){ var d=new Date(Date.now()+min*60000); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  var stage=r.status==='done'?3:(r.pickup_at?2:(r.on_way_at?1:0));
  if(stage===3){ t.textContent='Course terminée'; s.textContent='Merci d\'avoir voyagé avec Bleenr.'; eb.style.display='none'; if(_lt.route) _lt.route.setPath([]); }
  else if(stage===2){
    if(r.trip_type==='disposal'){ t.textContent='Mise à disposition en cours'; s.textContent='Votre chauffeur est avec vous.'; eb.style.display='none'; }
    else { t.textContent='En route vers la destination'; s.textContent=_lt.etaMin?('Arrivée prévue à '+hhmm(_lt.etaMin)+(_lt.distTxt?' · '+_lt.distTxt:'')):_lt.esc((r.to_address||'').split(',')[0]); eb.style.display=_lt.etaMin?'block':'none'; if(_lt.etaMin) ev.textContent=_lt.etaMin; }
  } else if(stage===1){
    t.textContent=_lt.etaMin&&_lt.etaMin<=1?'Votre chauffeur arrive':'Votre chauffeur est en route';
    s.textContent=_lt.loc?(_lt.etaMin?'Arrivée au point de prise en charge vers '+hhmm(_lt.etaMin):_lt.esc((r.from_address||'').split(',')[0])):'En attente de la position du chauffeur…';
    eb.style.display=_lt.etaMin?'block':'none'; if(_lt.etaMin) ev.textContent=_lt.etaMin;
  } else { t.textContent='Course confirmée'; s.textContent='Le suivi démarre dès que le chauffeur se met en route.'; eb.style.display='none'; }
  var lbl=['En route','Pris en charge','Terminée'];
  if(pg) pg.innerHTML=lbl.map(function(l,i){ var on=stage>=i+1; return '<div style="flex:1;"><div style="height:4px;border-radius:2px;background:'+(on?'#1B5E3B':'#E3E8E4')+';"></div><div style="font-size:10.5px;margin-top:5px;color:'+(on?'#1B5E3B':'#9EB0A3')+';font-weight:'+(on?'700':'500')+';">'+l+'</div></div>'; }).join('');
}

// Admin dashboard: every ride in progress, live
var _admLive={ map:null, markers:{}, timer:null };
async function _loadAdminLive(){
  var box=document.getElementById('admin-live-rides'); if(!box||!sb) return;
  var rides=[];
  try{ rides=(await sb.from('rides').select('*').or('status.eq.active,and(status.eq.confirmed,on_way_at.not.is.null)').order('ride_date',{ascending:true})).data||[]; }catch(e){}
  if(!rides.length){ box.style.display='none'; box.innerHTML=''; _admLive.map=null; _admLive.markers={}; return; }
  var ids=rides.map(function(r){return r.id;}), fleetIds=rides.map(function(r){return r.driver_id;}).filter(Boolean);
  var locs={}, fleets={};
  try{ ((await sb.from('ride_locations').select('*').in('ride_id',ids)).data||[]).forEach(function(l){ locs[l.ride_id]=l; }); }catch(e){}
  try{ if(fleetIds.length) ((await sb.from('profiles').select('id,first_name,last_name,company_name,role,email').in('id',fleetIds)).data||[]).forEach(function(p){ fleets[p.id]=p; }); }catch(e){}
  var esc=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var rows=rides.map(function(r){
    var l=locs[r.id], age=l?Math.round((Date.now()-new Date(l.updated_at).getTime())/60000):null;
    var st=r.pickup_at?'Client à bord · depuis '+_hhmm(r.pickup_at):'En route vers le client · depuis '+_hhmm(r.on_way_at);
    return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--sand2);">'
      +'<span class="live-dot" style="'+(l&&age<=2?'':'background:#C9A227;animation:none;')+'"></span>'
      +'<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--ink);"><span style="font-family:monospace;">'+esc(r.booking_code||String(r.id).slice(0,8))+'</span> · '+esc(_arDisplayName(fleets[r.driver_id]))+'</div>'
        +'<div style="font-size:12px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+st+' · '+(l?(age<1?'GPS à l\'instant':'GPS il y a '+age+' min')+(l.accuracy?' (± '+Math.round(l.accuracy)+' m)':''):'pas encore de position')+'</div></div>'
      +'<button class="btn btn-green btn-sm" style="flex-shrink:0;" onclick="openLiveTracking(\''+String(r.id).replace(/'/g,'')+'\')">'+t('app.suivre')+'</button>'
    +'</div>';
  }).join('');
  if(!document.getElementById('adm-live-map')){
    box.innerHTML='<div class="card" style="padding:16px 18px;margin-bottom:20px;">'
      +'<div style="display:flex;align-items:center;gap:9px;margin-bottom:12px;"><span class="live-dot"></span><span style="font-size:15px;font-weight:700;color:var(--ink);">'+t('app.courses_en_cours')+'</span><span id="adm-live-count" style="font-size:12px;color:var(--ink3);"></span></div>'
      +'<div id="adm-live-map" style="height:300px;border-radius:12px;overflow:hidden;background:var(--sand2);margin-bottom:6px;"></div>'
      +'<div id="adm-live-list"></div></div>';
    _admLive.map=null; _admLive.markers={};
  }
  box.style.display='block';
  document.getElementById('adm-live-count').textContent='('+rides.length+')';
  document.getElementById('adm-live-list').innerHTML=rows;
  _ltWhenMaps(function(){
    if(!document.getElementById('adm-live-map')) return;
    if(!_admLive.map) _admLive.map=new google.maps.Map(document.getElementById('adm-live-map'),{ center:{lat:50.8466,lng:4.3528}, zoom:11, disableDefaultUI:true, zoomControl:true, clickableIcons:false });
    var b=new google.maps.LatLngBounds(), n=0;
    Object.keys(_admLive.markers).forEach(function(id){ if(!locs[id]){ _admLive.markers[id].setMap(null); delete _admLive.markers[id]; } });
    rides.forEach(function(r){
      var l=locs[r.id]; if(!l) return;
      var p={lat:l.lat,lng:l.lng}, m=_admLive.markers[r.id];
      if(!m){ m=_admLive.markers[r.id]=new google.maps.Marker({ map:_admLive.map, position:p, icon:_ltCarSymbol(l.heading||0), title:(r.booking_code||'') }); m.addListener('click',function(){ openLiveTracking(r.id); }); }
      else { m.setPosition(p); m.setIcon(_ltCarSymbol(l.heading||0)); }
      b.extend(p); n++;
    });
    if(n && !_admLive.fitted){ _admLive.map.fitBounds(b,60); if(_admLive.map.getZoom()>15) _admLive.map.setZoom(15); _admLive.fitted=true; }
  });
  if(!_admLive.timer) _admLive.timer=setInterval(function(){ if(document.querySelector('#page-admin-dashboard.active')) _loadAdminLive(); },5000);
}

function _renderDriverActiveRides(list, boxId, forClient){
  var box=document.getElementById(boxId||'driver-active-rides'); if(!box) return;
  if(!list||!list.length){ box.style.display='none'; box.innerHTML=''; return; }
  var esc=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var cards=list.map(function(r){
    var code=r.booking_code||String(r.id).slice(0,8);
    var from=esc((r.from_address||'—').split(',')[0]);
    var to=r.trip_type==='disposal'?'Mise à disposition':esc((r.to_address||'—').split(',')[0]);
    var pax=(r.notes||'').match(/\|pax:([^|]+)/);
    var safe=JSON.stringify(r).replace(/'/g,'&#39;');
    var id=String(r.id).replace(/'/g,'');
    return '<div data-ride=\''+safe+'\' onclick="openRideDetail(this)" style="background:#fff;border:1.5px solid #6FCF97;border-radius:14px;padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px;">'
      +'<div style="flex:1;min-width:200px;">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--ink2);">'+esc(code)+'</span>'
          +(r.pickup_at?'<span style="font-size:11.5px;color:var(--ink3);">'+t('app.pick_up_a')+' '+_hhmm(r.pickup_at)+'</span>':(r.on_way_at?'<span style="font-size:11.5px;color:var(--ink3);">'+(forClient?'Chauffeur en route depuis ':'En chemin depuis ')+_hhmm(r.on_way_at)+'</span>':''))+'</div>'
        +'<div style="font-size:14px;font-weight:600;color:var(--ink);">'+from+' <span style="color:var(--ink4);">→</span> '+to+'</div>'
        +(pax?'<div style="font-size:12px;color:var(--ink3);margin-top:3px;">'+t('app.passager_2')+' '+esc(pax[1])+'</div>':'')
      +'</div>'
      +(forClient ? '' : r.pickup_at||r.status==='active'
        ? '<button class="btn btn-green ms-btn" style="flex-shrink:0;" onclick="event.stopPropagation();missionStep(\''+id+'\',\'done\',this)">'+t('app.mission_terminee_2')+'</button>'
        : '<button class="btn ms-btn" style="flex-shrink:0;background:#fff;color:#B3261E;border:1.5px solid #F5C2BC;" onclick="event.stopPropagation();missionNoShow(\''+id+'\',this)">'+t('app.no_show')+'</button>'
          +'<button class="btn btn-green ms-btn" style="flex-shrink:0;" onclick="event.stopPropagation();missionStep(\''+id+'\',\'pickup\',this)">'+t('app.pick_up_termine')+'</button>')
      +(forClient ? '<button class="btn btn-green" style="flex-shrink:0;display:flex;align-items:center;gap:7px;" onclick="event.stopPropagation();openLiveTracking(\''+id+'\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 22s7-6.6 7-12a7 7 0 00-14 0c0 5.4 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>'+t('app.suivre_en_direct')+'</button>' : '')
    +'</div>';
  }).join('');
  box.innerHTML='<div style="background:#EAF7EF;border:1px solid #BFE5CC;border-radius:16px;padding:14px 14px 4px;margin:4px 0 22px;">'
    +'<div style="display:flex;align-items:center;gap:9px;margin:0 2px 12px;"><span class="live-dot"></span><span style="font-size:15px;font-weight:700;color:var(--green);">'+t('app.course')+(list.length>1?'s':'')+' '+t('app.en_cours')+'</span><span style="font-size:12px;color:var(--ink3);">('+list.length+')</span></div>'
    +(forClient?'':'<div id="trk-status" style="font-size:11.5px;color:var(--ink3);margin:-6px 2px 10px;">'+(_trk.status||(_trkNativeGeo()?'📍 Votre position est partagée avec le client pendant la course.':'📍 Votre position est partagée avec le client — gardez cette page ouverte (ou utilisez l\'application Bleenr Chauffeur pour un suivi écran verrouillé).'))+'</div>')
    +cards+'</div>';
  box.style.display='block';
}

async function loadDriverDashboard(){
  if(window._chgExpire) _chgExpire();
  const uid = currentUser?.id;
  let missions = [], pending = [];
  _renderDriverVerifyBanner();

  // Always refresh own offers so dashboard shows current driver's offer state
  await loadMyOffers();

  // Load fleet vehicles for compatibility filtering
  if(_fleetVehicles.length === 0 && sb && uid && !localStorage.getItem(DEMO_MODE_KEY)){
    var fvDash = await sb.from('fleet_vehicles').select('*').eq('fleet_id', uid).eq('active', true);
    _fleetVehicles = fvDash.data || [];
  }

  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    // Reload fresh profile to get latest rating
    var {data:freshProfile} = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if(freshProfile) currentProfile = freshProfile;

    const [m, p] = await Promise.all([
      sb.from('rides').select('*').eq('driver_id', uid).order('ride_date',{ascending:true}).order('ride_time',{ascending:true}),
      sb.from('rides').select('*').in('status', ['waiting', 'offers']).order('ride_date',{ascending:true}).order('ride_time',{ascending:true})
    ]);
    missions = m.data || [];

    // Also find confirmed rides via accepted offers (in case driver_id wasn't set)
    var {data:acceptedOffers}=await sb.from('offers').select('ride_id').eq('driver_id',uid).eq('status','accepted');
    if(acceptedOffers&&acceptedOffers.length>0){
      var acceptedRideIds=acceptedOffers.map(function(o){return o.ride_id;});
      var existingIds=missions.map(function(r){return r.id;});
      var missingIds=acceptedRideIds.filter(function(id){return existingIds.indexOf(id)<0;});
      if(missingIds.length>0){
        var {data:extraRides}=await sb.from('rides').select('*').in('id',missingIds);
        if(extraRides)missions=missions.concat(extraRides);
      }
    }
    var allPending = p.data || [];

    // Auto-cancel overdue pending rides (waiting/offers past their start time)
    await _autoCancelOverdueRides(allPending);

    // Re-fetch pending after auto-cancel
    var pRefresh = await sb.from('rides').select('*').in('status', ['waiting', 'offers']).order('ride_date',{ascending:true}).order('ride_time',{ascending:true});
    allPending = pRefresh.data || [];

    // Exclude own subcontracts from pending (they show in "Mes sous-traitances" only)
    pending = allPending.filter(function(r){return !(r.is_subcontract && r.client_id === uid);});
  } else {
    missions = getDemoMissions();
    pending  = getDemoMarketplace();
  }

  const now = new Date();
  const todayISO = now.toISOString().slice(0,10);

  // Auto-complete overdue confirmed rides
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    await _autoCompleteOverdueRides(missions.filter(function(r){return r.status==='confirmed';}));
    // Re-fetch after auto-complete
    var refreshed = await sb.from('rides').select('*').eq('driver_id', uid).order('ride_date',{ascending:true}).order('ride_time',{ascending:true});
    missions = refreshed.data || [];
  }

  // Update missions badge
  var confirmedUpcoming = missions.filter(function(r){
    return r.status==='active' || (r.status==='confirmed' && r.ride_date >= todayISO);
  });
  var badge = document.getElementById('missions-badge');
  if(badge){
    if(confirmedUpcoming.length > 0){ badge.textContent = confirmedUpcoming.length; badge.style.display='inline-block'; }
    else { badge.style.display='none'; }
  }

  const monthMissions = missions.filter(function(r){
    if(r.status!=='done')return false;
    var d=new Date(r.ride_date||r.created_at);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  });
  // Revenue = HTVA of done missions (excl. refunded) minus the platform commission (Admin → Facturation)
  const _cRate = (await _commPct(currentProfile && currentProfile.address_country)) / 100;
  // Remboursées et sous-traitances non comptées (core/billing.ts)
  const revenueNet = monthMissions.reduce(function(a,r){ return a + BleenrCore.rideNetRevenue(r, _cRate*100); },0);
  // Tendance des revenus par rapport au mois précédent (même calcul)
  var _pm=new Date(now.getFullYear(), now.getMonth()-1, 1);
  var _revPrev = missions.filter(function(r){
    if(r.status!=='done'||r.payment_method==='refunded'||r.is_subcontract) return false;
    var d=new Date(r.ride_date||r.created_at); return d.getMonth()===_pm.getMonth()&&d.getFullYear()===_pm.getFullYear();
  }).reduce(function(a,r){ return a + _rideHtva(r)*(1-_cRate); },0);
  var _revTrend = _revPrev>0
    ? (function(){ var pc=Math.round((revenueNet-_revPrev)/_revPrev*100); return '<span class="sc-trend '+(pc>0?'up':pc<0?'down':'flat')+'">'+(pc>0?'\u2191 ':pc<0?'\u2193 ':'\u2192 ')+Math.abs(pc)+' %</span>'; })()
    : '<span class="sc-trend flat">\u2192 0 %</span>';
  const upcomingMissions = missions.filter(function(r){return r.status==='confirmed'||r.status==='pending_payment';});

  // Compute live score directly from ratings table (bypasses stale currentProfile.rating)
  var liveRating = null, liveRatingCount = 0;
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    var {data:myRatings} = await sb.from('ratings').select('score').eq('driver_id', uid);
    if(myRatings && myRatings.length > 0){
      liveRatingCount = myRatings.length;
      liveRating = Math.round(myRatings.reduce(function(s,r){return s+r.score;},0)/myRatings.length*10)/10;
    }
  }
  var scoreDisplay = liveRating !== null ? liveRating.toFixed(1)+' \u2605' : ((currentProfile&&currentProfile.rating)?currentProfile.rating.toFixed(1)+' \u2605':'\u2014');

    var dI=function(s,bg){return '<div class="stat-card-icon" style="background:'+bg+'">'+s+'</div>';};
  // Au moins une sous-traitance terminée ce mois : répartition clients / sous-traitances
  var _doneSplitHtml=function(list){
    var subs=list.filter(function(r){return r.is_subcontract;}).length, cli=list.length-subs;
    if(!subs) return '';
    var ic=function(bg,col,path){ return '<span style="width:16px;height:16px;border-radius:50%;background:'+bg+';color:'+col+';display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">'+path+'</svg></span>'; };
    return '<div style="display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--ink3);">'
      +'<span style="display:flex;align-items:center;gap:6px;">'+ic('var(--green-bg)','var(--green)','<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>')+'<b style="color:var(--ink);">'+cli+'</b> '+t('app.client')+(cli>1?'s':'')+'</span>'
      +'<span style="display:flex;align-items:center;gap:6px;">'+ic('var(--amber-bg)','var(--amber)','<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>')+'<b style="color:var(--ink);">'+subs+'</b> '+t('app.sous_traitance')+(subs>1?'s':'')+'</span>'
      +'</div>';
  };
  document.getElementById('driver-stats').innerHTML=
    '<div class="stat-card sc sc-g"'+(upcomingMissions.length?' onclick="showPage(\'missions\')" style="cursor:pointer;" title="Voir mes missions à venir"':'')+'>'+dI('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>','var(--green-bg)')+'<div class="stat-label">'+t('app2.missions_a_venir')+'</div><div class="stat-val">'+upcomingMissions.length+'</div></div>'
    +'<div class="stat-card sc sc-b" onclick="_goDoneMissions()" style="cursor:pointer;" title="'+t('app.voir_les_missions_terminees')+'">'+dI('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>','var(--blue-bg)')+'<div class="stat-label">'+t('app.ce_mois')+'</div><div style="display:flex;align-items:center;gap:14px;"><div class="stat-val">'+monthMissions.length+'</div>'+_doneSplitHtml(monthMissions)+'</div></div>'
    +'<div class="stat-card sc sc-o" onclick="showPage(\'d-invoices\')" style="cursor:pointer;" title="'+t('app.voir_la_facturation')+'">'+dI('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6.5A6 6 0 007.5 9M17 17.5A6 6 0 017.5 15M5 10.5h8M5 13.5h8"/></svg>','var(--red-bg)')+''+_revTrend+'<div class="stat-label">'+t('app.revenus')+'</div><div class="stat-val stat-money">'+(revenueNet>0?revenueNet.toFixed(2).replace('.',',')+' \u20ac':'0 \u20ac')+'</div></div>'
    +'<div class="stat-card sc sc-p">'+dI('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>','#FFF3DC')+'<div class="stat-label">'+t('app.score')+'</div><div style="display:flex;align-items:flex-end;gap:10px;"><div class="stat-val">'+scoreDisplay.replace(' \u2605','')+'</div>'+(liveRatingCount?'<div class="sc-side">'+t('app2.sur_5')+' '+liveRatingCount+' '+t('app.avis_2')+'</div>':'')+'</div></div>';

  // Update marketplace badge immediately (hidden per spec)
  var badgeEl = document.getElementById('badge-marketplace');
  if(badgeEl){ badgeEl.style.display = 'none'; }

  // In progress = driver on the way (En chemin) or pick-up done
  var _drvInProgress = missions.filter(function(r){ return r.status==='active' || (r.status==='confirmed' && r.on_way_at); });
  _renderDriverActiveRides(_drvInProgress);
  _syncDriverTracking(_drvInProgress.filter(function(r){ return r.driver_id===uid; }));

  var latestPending = pending.filter(_driverCanHandleRide).slice().sort(_byNewest);
  document.getElementById('driver-latest-requests').innerHTML = latestPending.length
    ? latestPending.slice(0,3).map(function(r){ var isMine=r.is_subcontract&&currentUser&&r.client_id===currentUser.id; return renderMkItem(r, r.is_subcontract, isMine); }).join('')
    : `<div class="empty-state"><p class="empty-text">${t('empty_marketplace')}</p></div>`;
  if(typeof renderDriverStatsChart==='function') renderDriverStatsChart(missions);
}

async function renderScoreCard(){
  var r = 0, n = 0;
  if(sb && currentUser && !localStorage.getItem(DEMO_MODE_KEY)){
    var {data:myRatings} = await sb.from('ratings').select('score').eq('driver_id', currentUser.id);
    if(myRatings && myRatings.length > 0){
      n = myRatings.length;
      r = Math.round(myRatings.reduce(function(s,rt){return s+rt.score;},0)/n*10)/10;
    }
  } else {
    r = currentProfile?.rating || 0;
    n = currentProfile?.rating_count || 0;
  }
  var el = document.getElementById('driver-score-card');
  if(!el) return;
  el.innerHTML = `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px;">
      <div class="score-ring"><div class="score-num" style="color:${r>=4?'var(--green)':r>=2.5?'#C47F00':'var(--red)'}">${r > 0 ? r.toFixed(1) : '—'}</div><div class="score-lbl">/ 5.0</div></div>
      <div><div style="font-weight:600;margin-bottom:2px;">${r >= 4.5 ? 'Excellent' : r >= 4 ? 'Bien' : r > 0 ? 'Moyen' : '—'}</div><div class="text-xs">${n} évaluation${n>1?'s':''}</div></div>
    </div>
    <div style="font-size:12px;color:var(--ink3);">${n === 0 ? 'Aucune évaluation pour l\'instant' : 'Score basé sur vos dernières courses'}</div>
  `;
}

// MARKETPLACE
async function loadMarketplace(){
  let clientRides = [], subRides = [];

  // Ensure fleet vehicles are loaded for compatibility filtering
  if(_fleetVehicles.length === 0 && sb && currentUser && !localStorage.getItem(DEMO_MODE_KEY)){
    var fvRes = await sb.from('fleet_vehicles').select('*').eq('fleet_id', currentUser.id).eq('active', true);
    _fleetVehicles = fvRes.data || [];
  }

  // Always refresh own offers before rendering so each driver sees their own state
  await loadMyOffers();

  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    const [c, s] = await Promise.all([
      sb.from('rides').select('*').in('status', ['waiting', 'offers']).or('is_subcontract.is.null,is_subcontract.eq.false').order('ride_date',{ascending:true}).order('ride_time',{ascending:true}),
      sb.from('rides').select('*').in('status', ['waiting', 'offers']).eq('is_subcontract',true).order('ride_date',{ascending:true}).order('ride_time',{ascending:true})
    ]);
    clientRides = (c.data || []).sort(_byNewest);
    subRides    = (s.data || []).sort(_byNewest);

    // Badge hidden per spec
    const badge = document.getElementById('badge-marketplace');
    if(badge){ badge.style.display = 'none'; }
  } else {
    clientRides = getDemoMarketplace();
    clientRides.sort(_byNewest);
    subRides = [];
  }

  // My own subcontracts
  let mySubRides = [];
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    const ms = await sb.from('rides').select('*').eq('client_id', currentUser.id).eq('is_subcontract', true).order('ride_date',{ascending:false});
    if(ms && ms.data) await _mergeRidePrivate(ms.data);
    mySubRides = ms.data || [];
  }

  document.getElementById('mk-client').innerHTML = clientRides.filter(_driverCanHandleRide).length
    ? clientRides.filter(_driverCanHandleRide).map(r => renderMkItem(r)).join('')
    : `<div class="empty-state"><p class="empty-text">${t('empty_marketplace')}</p></div>`;

  // Filter out my own subcontracts from the shared tab
  var othersSubRides = subRides.filter(function(r){ return !currentUser || r.client_id !== currentUser.id; });
  document.getElementById('mk-sub').innerHTML = othersSubRides.length
    ? othersSubRides.map(function(r){ return renderMkItem(r, true, false); }).join('')
    : `<div class="empty-state"><p class="empty-text">Aucune sous-traitance disponible</p></div>`;

  var mineEl = document.getElementById('mk-mine-list');
  if(mineEl) mineEl.innerHTML = mySubRides.length
    ? mySubRides.map(function(r){ return renderMkItem(r, false, true); }).join('')
    : `<div class="empty-state"><p class="empty-text">Vous n'avez pas encore publié de sous-traitance</p></div>`;
}

window.mkSwitch = function(btn, target){
  document.querySelectorAll('.mktab').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  ['mk-client','mk-sub','mk-mine'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display=id===target?'block':'none';
  });
};

// MISSIONS
window._goDoneMissions=function(){
  showPage('missions');
  setTimeout(function(){ var b=document.getElementById('mstab-done'); if(b) msSwitch(b,'ms-done'); },60);
};
window.msSwitch = function(btn, target){
  document.querySelectorAll('#page-missions .mktab').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  ['ms-upcoming','ms-done','ms-cancelled'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display = id===target ? 'block' : 'none';
  });
};

async function loadMissions(){
  if(window._chgExpire) _chgExpire();
  let missions = [];
  const MISSIONS_ALL = [...MISSION_STATUSES, 'cancelled'];
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    const { data } = await sb.from('rides').select('*').eq('driver_id', currentUser.id).in('status', MISSIONS_ALL).order('ride_date',{ascending:true}).order('ride_time',{ascending:true});
    missions = data || [];

    // Also find rides via accepted offers (in case driver_id wasn't set on ride)
    var {data:acceptedOffers}=await sb.from('offers').select('ride_id').eq('driver_id',currentUser.id).eq('status','accepted');
    if(acceptedOffers&&acceptedOffers.length>0){
      var acceptedRideIds=acceptedOffers.map(function(o){return o.ride_id;});
      var existingIds=missions.map(function(r){return r.id;});
      var missingIds=acceptedRideIds.filter(function(id){return existingIds.indexOf(id)<0;});
      if(missingIds.length>0){
        var {data:extraRides}=await sb.from('rides').select('*').in('id',missingIds).in('status',MISSIONS_ALL);
        if(extraRides)missions=missions.concat(extraRides);
      }
    }

    // Auto-complete overdue confirmed rides
    var confirmedMissions=missions.filter(function(r){return r.status==='confirmed';});
    if(confirmedMissions.length>0){
      await _autoCompleteOverdueRides(confirmedMissions);
      var refreshed=await sb.from('rides').select('*').eq('driver_id', currentUser.id).in('status', MISSIONS_ALL).order('ride_date',{ascending:true}).order('ride_time',{ascending:true});
      missions=refreshed.data||[];
    }
  } else {
    missions = getDemoMissions().filter(r => MISSIONS_ALL.includes(r.status));
  }

  const upcoming   = missions.filter(function(r){return r.status==='confirmed'||r.status==='active';}).sort(_byNewest);
  const done       = missions.filter(function(r){return r.status==='done';}).sort(_byNewest);
  const cancelled  = missions.filter(function(r){return r.status==='cancelled';}).sort(_byNewest);
  // Titre de l'onglet et pastille du menu : nombre de missions à venir
  try{ var _ut=document.getElementById('mstab-upcoming'); if(_ut) _ut.textContent=t('upcoming_missions')+(upcoming.length?' ('+upcoming.length+')':'');
    var _mb=document.getElementById('missions-badge'); if(_mb){ if(upcoming.length){ _mb.textContent=upcoming.length; _mb.style.display='inline-block'; } else _mb.style.display='none'; } }catch(_e){}

  document.getElementById('ms-upcoming').innerHTML = upcoming.length
    ? upcoming.map(r => renderRideItem(r)).join('')
    : '<div class="empty-state"><p class="empty-text">'+t('app.aucune_mission_a_venir')+'</p></div>';

  document.getElementById('ms-done').innerHTML = done.length
    ? done.map(r => renderRideItem(r)).join('')
    : '<div class="empty-state"><p class="empty-text">'+t('app.aucune_mission_terminee')+'</p></div>';

  document.getElementById('ms-cancelled').innerHTML = cancelled.length
    ? cancelled.map(r => renderRideItem(r)).join('')
    : '<div class="empty-state"><p class="empty-text">'+t('app.aucune_mission_annulee')+'</p></div>';
}

// PROFILE


