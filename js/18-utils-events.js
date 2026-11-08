// ── UTILS ─────────────────────────────────────────────
// Strip accidental "HH:MM:" prefix that can appear in from_address for mixed rides
function cleanAddr(addr){ return BleenrCore.cleanAddr(addr); }   // core/notes.ts

function formatDate(d){
  if(!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('fr-BE', {day:'numeric',month:'short'});
}
function timeAgo(ts){
  const diff = Date.now() - new Date(ts).getTime();
  if(diff < 60000) return 'à l\'instant';
  if(diff < 3600000) return Math.floor(diff/60000) + ' min';
  if(diff < 86400000) return Math.floor(diff/3600000) + 'h';
  return formatDate(ts);
}
function tripTypeLabel(t_){
  const m = {ab:'A→B', disposal:'Disposition', mixed:'Mixte'};
  return m[t_] || t_ || '—';
}
function _ymdLocal(d){ d=d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayStr(){ return _ymdLocal(new Date()); }
function tomorrowStr(){ const d=new Date(); d.setDate(d.getDate()+1); return _ymdLocal(d); }

function showError(el, msg){ el.textContent = msg; el.classList.add('show'); }
function setLoading(btn, loading, text){
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="auth-loading"><span class="spinner-sm"></span>${text}</span>` : text;
}

function _tagModalClose(m){ if(!m||m.id==='m-confirm-delete') return; m.querySelectorAll('.modal-ft button').forEach(function(b){ if((b.textContent||'').trim()==='Fermer') b.classList.add('m-close-mob'); }); }
window.openModal  = id => { var _m=document.getElementById(id); if(!_m) return; _tagModalClose(_m); if(_m.classList.contains('rd-panel')) _rdEnsureBack(_m); _m.classList.add('open'); if(_m.classList.contains('rd-panel')) _rdOpened(id); };
// ══ ÉVÉNEMENTS : plusieurs véhicules envoyés comme demandes séparées, liées à une demande mère ══
window._evTarget=null;   // ajout de véhicules à un événement existant { id, name, contact_name, contact_phone }
function _evRows(){ return [].slice.call(document.querySelectorAll('#ev-vehicles .ev-veh')); }
function _evClassOpts(){ var s=document.getElementById('ride-vehicle'); return s?s.innerHTML:'<option value="business">Business</option>'; }
function _evGp(el){
  if(!el||el._gp||!(window.google&&google.maps&&google.maps.places)) return;
  el._gp=new google.maps.places.Autocomplete(el,{ language:'fr', fields:['formatted_address','name'], componentRestrictions:{ country:['be','fr','lu','nl','de','gb','ch'] } });
  el._gp.addListener('place_changed',function(){ var pl=el._gp.getPlace(); if(!pl) return; var nm=pl.name||'', ad=pl.formatted_address||'';
    el.value = nm&&ad&&ad.toLowerCase().indexOf(nm.toLowerCase())===-1 ? nm+', '+ad : (ad||nm);
    var row=el.closest&&el.closest('.ev-veh'); if(row) _evTr(row); });
}
function _evVal(row,c){ var e=row.querySelector('.'+c); return e?String(e.value||'').trim():''; }
// Gammes pour les événements : capacité (places) utilisée par les suggestions
var _EV_CLS=[ {k:'lowcost',n:'Economy',cap:3,info:'3 à 7 places'}, {k:'business',n:'Business',cap:3,info:'3 places'}, {k:'luxe',n:'Luxe',cap:3,info:'3 places'}, {k:'van',n:'Van',cap:7,info:'7 places'}, {k:'bus',n:'Bus',cap:50,info:'minibus, autocar'} ];
function _evClsName(k){ var c=_EV_CLS.filter(function(x){ return x.k===k; })[0]; return c?c.n:k; }
function _evCounts(r){ try{ return JSON.parse(r.getAttribute('data-cnt')||'{}')||{}; }catch(e){ return {}; } }
function _evTotal(c){ return Object.keys(c).reduce(function(t,k){ return t+(parseInt(c[k],10)||0); },0); }
function _evCntLabel(c){ return _EV_CLS.slice().sort(function(a,b){ return b.cap-a.cap; }).filter(function(x){ return c[x.k]>0; }).map(function(x){ return c[x.k]+' '+x.n; }).join(' + '); }
function _evSeats(c){ var t=0, bus=false; _EV_CLS.forEach(function(x){ var n=c[x.k]||0; if(x.k==='bus'){ if(n) bus=true; } else t+=n*x.cap; }); return {seats:t, bus:bus}; }
// Solutions proposées pour N personnes (jamais d'Economy, pas de Luxe d'office)
function _evSuggest(N){
  N=parseInt(N,10)||0; if(N<1) return [];
  var out=[], seen={}, push=function(c,sub){ var k=JSON.stringify(c); if(seen[k]) return; seen[k]=1; out.push({c:c,sub:sub}); };
  var vans=Math.floor(N/7), rest=N%7, mix={};
  if(rest>=1 && rest<=3){ if(vans) mix.van=vans; mix.business=1; } else { mix.van=vans+(rest?1:0); }
  var seats=function(c){ return (c.van||0)*7+(c.business||0)*3; };
  var nv=function(c){ return _evTotal(c); };
  push(mix, nv(mix)+' véhicule'+(nv(mix)>1?'s':'')+' · '+seats(mix)+' places');
  var nb=Math.ceil(N/3); if(nb<=12) push({business:nb}, nb+' véhicule'+(nb>1?'s':'')+' · '+nb*3+' places');
  var nl=Math.ceil(N/3); if(nl<=12) push({luxe:nl}, nl+' véhicule'+(nl>1?'s':'')+' · '+nl*3+' places');
  var nvn=Math.ceil(N/7); push({van:nvn}, nvn+' véhicule'+(nvn>1?'s':'')+' · '+nvn*7+' places');
  if(N>=8){ var bs=Math.ceil(N/50); push({bus:bs}, bs>1?bs+' véhicules · autocars':'minibus / autocar'); }
  return out.slice(0,6);
}
function _evRenumber(){
  var rows=_evRows(), n=rows.length, tot=0;
  rows.forEach(function(r,i){ r.querySelector('.n').textContent=i+1; r.querySelector('.ev-ttl').textContent='Trajet '+(i+1); r.querySelector('.ev-del').style.display=n>1?'':'none'; tot+=_evTotal(_evCounts(r)); });
  var c=document.getElementById('ev-count'); if(c) c.textContent='Trajets ('+n+')';
  var m=document.getElementById('m-new-ride'), b=document.getElementById('btn-submit-ride');
  if(b && m.classList.contains('nr-event')) b.innerHTML='Publier '+tot+' demande'+(tot>1?'s':'')+' &rarr;';
}
// Dessine le bloc « Véhicules pour ce trajet » selon le mode (choix manuel / nombre de personnes)
function _evDrawVeh(r){
  var mode=r.getAttribute('data-vm')||'manual', c=_evCounts(r), box=r.querySelector('.ev-vbody'), h='';
  r.querySelectorAll('.ev-vm button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-v')===mode); });
  if(mode==='manual'){
    h+=_EV_CLS.map(function(x){ var v=c[x.k]||0;
      return '<div class="ev-cnt'+(v?'':' z')+'"><span class="ev-cn">'+x.n+'</span><small>'+x.info+'</small><span class="ev-st"><button type="button" aria-label="'+_T('app.retirer')+'" onclick="_evInc(this,\''+x.k+'\',-1)">−</button><b>'+v+'</b><button type="button" aria-label="'+_T('app.ajouter_2')+'" onclick="_evInc(this,\''+x.k+'\',1)">+</button></span></div>'; }).join('');
    var t=_evTotal(c), st=_evSeats(c);
    h+=t?'<div class="ev-sum">'+t+' véhicule'+(t>1?'s':'')+(st.bus?'':' · jusqu’à '+st.seats+' personnes')+'</div>':'<div class="ev-sum warn">'+_T('app.choisissez_au_moins_un_vehicule')+'</div>';
  } else {
    var N=r.getAttribute('data-n')||'';
    h+='<div class="form-grid" style="margin-top:4px;"><div class="input-group"><label>'+_T('app.nombre_de_personnes')+' <span style="color:var(--red)">*</span></label><input class="ev-n" type="number" min="1" max="500" inputmode="numeric" placeholder="'+_T('app.ex_15')+'" value="'+N+'" oninput="_evSetN(this)"></div></div>';
    var sg=_evSuggest(N), key=JSON.stringify(c);
    if(sg.length){
      h+='<label style="display:block;font-size:12px;color:var(--ink3);margin-top:4px;">'+_T('app.solutions_proposees')+'</label><div class="ev-sg">'
        +sg.map(function(o,i){ return '<button type="button" class="'+(JSON.stringify(o.c)===key?'on':'')+'" onclick="_evPickSg(this,'+i+')">'+_evCntLabel(o.c)+'<small>'+o.sub+'</small></button>'; }).join('')+'</div>';
      var t=_evTotal(c);
      if(t) h+='<div class="ev-sum">✓ '+t+' véhicule'+(t>1?'s':'')+' : '+_evCntLabel(c)+' '+_T('app.vous_pouvez_ajuster_dans_je')+'</div>';
    }
  }
  box.innerHTML=h;
  _evRenumber();
}
window._evVM=function(btn,m){ var r=btn.closest('.ev-veh'); r.setAttribute('data-vm',m); _evDrawVeh(r); if(m==='pax'){ var i=r.querySelector('.ev-n'); if(i&&!i.value) i.focus(); } };
window._evInc=function(btn,k,d){ var r=btn.closest('.ev-veh'), c=_evCounts(r); c[k]=Math.max(0,Math.min(50,(c[k]||0)+d)); if(!c[k]) delete c[k]; r.setAttribute('data-cnt',JSON.stringify(c)); _evDrawVeh(r); };
window._evSetN=function(inp){
  var r=inp.closest('.ev-veh'); r.setAttribute('data-n', inp.value);
  var sg=_evSuggest(inp.value); r.setAttribute('data-cnt', JSON.stringify(sg[0]?sg[0].c:{}));
  clearTimeout(r._t); r._t=setTimeout(function(){ var pos=inp.selectionStart; _evDrawVeh(r); var n=r.querySelector('.ev-n'); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} } }, 350);
  _evRenumber();
};
window._evPickSg=function(btn,i){ var r=btn.closest('.ev-veh'), sg=_evSuggest(r.getAttribute('data-n')); if(sg[i]){ r.setAttribute('data-cnt',JSON.stringify(sg[i].c)); _evDrawVeh(r); } };
window._evAdd=function(d){
  d=d||{}; var box=document.getElementById('ev-vehicles'); if(!box) return;
  var last=_evRows().slice(-1)[0];
  if(!d.date && last) d.date=_evVal(last,'ev-date');
  var e=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); };
  var min=(typeof todayStr==='function')?todayStr():'';
  var div=document.createElement('div'); div.className='ev-veh';
  div.setAttribute('data-vm', d.vm||'manual'); div.setAttribute('data-n', d.n||''); div.setAttribute('data-cnt', JSON.stringify(d.cnt||{business:1}));
  div.innerHTML='<div class="ev-vh"><span class="n"></span><span class="ev-ttl"></span><span class="tl"><button type="button" onclick="_evDup(this)">'+t('app.dupliquer')+'</button><button type="button" class="ev-del" onclick="_evDel(this)">'+t('app.supprimer')+'</button></span></div>'
    +'<div class="form-grid">'
    +'<div class="input-group full"><label>'+t('app.type_de_trajet')+'</label><select class="ev-type" onchange="_evType(this)"><option value="ab">'+t('app.transfert_simple')+'</option><option value="disposal">'+t('app.mise_a_disposition')+'</option></select></div>'
    +'<div class="input-group full"><label class="ev-from-lbl">'+t('app.depart')+' <span style="color:var(--red)">*</span></label><input class="ev-from" autocomplete="off" placeholder="'+t('app.adresse_gare_aeroport')+'" value="'+e(d.from)+'"></div>'
    +'<div class="input-group full ev-to-grp"><label>'+t('app.arrivee')+' <span style="color:var(--red)">*</span></label><input class="ev-to" autocomplete="off" placeholder="'+t('app.destination')+'" value="'+e(d.to)+'"></div>'
    +'<div class="input-group full tr-pair ev-trp" style="display:none;">'
    +['flight','train','flight2','train2'].map(function(k){ return '<div class="input-group ev-'+k+'-grp" style="display:none;"><label class="ev-'+k+'-lbl"></label><input class="ev-'+k+' tr-input" placeholder="'+(k.indexOf('flight')===0?'Ex. SN 3123':'Ex. IC 1832')+'" autocomplete="off" maxlength="10" value="'+e(d[k])+'"></div>'; }).join('')
    +'</div>'
    +'<div class="input-group full ev-dur-grp" style="display:none;"><label>'+t('app.duree_heures')+'</label><input class="ev-dur" type="number" min="1" max="24" value="'+e(d.dur||'3')+'"></div>'
    +'<div class="input-group"><label>'+t('app.date')+' <span style="color:var(--red)">*</span></label><input class="ev-date" type="date" min="'+min+'" value="'+e(d.date)+'"></div>'
    +'<div class="input-group"><label>'+t('app.heure')+' <span style="color:var(--red)">*</span></label><input class="ev-time" type="time" value="'+e(d.time)+'"></div>'
    +_lugBlock('','',null,null,'ev-lugL','ev-lugS')
    +'<div class="input-group ev-pax-grp full" style="display:none;"><label>'+t('app.contact_pour_ce_trajet')+'</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><input class="ev-pname" maxlength="120" placeholder="'+t('app.nom_et_prenom')+'" value="'+e(d.pname)+'"><input class="ev-pphone" maxlength="40" placeholder="'+t('app.telephone')+'" inputmode="tel" value="'+e(d.pphone)+'"></div></div>'
    +'</div>'
    +'<div class="ev-sub-t veh-lbl">'+t('app.vehicules_pour_ce_trajet')+' <button type="button" class="veh-info" onclick="openVehGuide()" title="'+t('app.voir_les_gammes')+'">i</button></div>'
    +'<div class="ev-seg ev-vm"><button type="button" data-v="manual" onclick="_evVM(this,\'manual\')">'+t('app.je_choisis_les_vehicules')+'</button><button type="button" data-v="pax" onclick="_evVM(this,\'pax\')">'+t('app.jindique_le_nombre_de_personnes')+'</button></div>'
    +'<div class="ev-vbody"></div>';
  box.appendChild(div);
  if(d.type){ div.querySelector('.ev-type').value=d.type; _evType(div.querySelector('.ev-type')); }
  if(d.lugL) div.querySelector('.ev-lugL').value=d.lugL; if(d.lugS) div.querySelector('.ev-lugS').value=d.lugS;
  if(_evModeVal()==='per') div.querySelector('.ev-pax-grp').style.display='';
  _evGp(div.querySelector('.ev-from')); _evGp(div.querySelector('.ev-to'));
  ['ev-from','ev-to'].forEach(function(c){ var i=div.querySelector('.'+c); ['input','change','blur'].forEach(function(ev){ i.addEventListener(ev, function(){ _evTr(div); }); }); });
  _evTr(div);
  _evDrawVeh(div);
  return div;
};
// Aéroport → numéro de vol ; gare → numéro de train (même règle que la demande simple)
window._evTr=function(r){
  if(!r||!window._trKindOf) return;
  var disp=_evVal(r,'ev-type')==='disposal';
  _trPairApply(r.querySelector('.ev-trp'), _trPairPlan(_evVal(r,'ev-from'), disp?null:_evVal(r,'ev-to')), function(k){ return r.querySelector('.ev-'+k+'-grp'); }, function(k){ return r.querySelector('.ev-'+k+'-lbl'); });
};
window._evDup=function(btn){
  var r=btn.closest('.ev-veh');
  var d={ lugL:_evVal(r,'ev-lugL'), lugS:_evVal(r,'ev-lugS'), type:_evVal(r,'ev-type'), from:_evVal(r,'ev-from'), to:_evVal(r,'ev-to'), flight:_evVal(r,'ev-flight'), train:_evVal(r,'ev-train'), flight2:_evVal(r,'ev-flight2'), train2:_evVal(r,'ev-train2'), dur:_evVal(r,'ev-dur'), date:_evVal(r,'ev-date'), time:_evVal(r,'ev-time'), vm:r.getAttribute('data-vm'), n:r.getAttribute('data-n'), cnt:_evCounts(r) };
  var nw=_evAdd(d); if(nw && r.nextSibling!==nw) r.parentNode.insertBefore(nw, r.nextSibling); _evRenumber();
};
window._evDel=function(btn){ if(_evRows().length<2) return; btn.closest('.ev-veh').remove(); _evRenumber(); };
window._evType=function(sel){
  var r=sel.closest('.ev-veh'), disp=sel.value==='disposal';
  r.querySelector('.ev-to-grp').style.display=disp?'none':'';
  r.querySelector('.ev-dur-grp').style.display=disp?'':'none';
  r.querySelector('.ev-from-lbl').innerHTML=(disp?'Lieu de prise en charge':'Départ')+' <span style="color:var(--red)">*</span>';
  if(r.querySelector('.ev-trp')) _evTr(r);
};
function _evModeVal(){ var b=document.querySelector('#ev-mode-grp .ev-seg .on'); return b?b.getAttribute('data-m'):'one'; }
window._evMode=function(m){
  document.querySelectorAll('#ev-mode-grp .ev-seg button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-m')===m); });
  var c=document.getElementById('ev-contact'); if(c) c.style.display=m==='one'?'':'none';
  _evRows().forEach(function(r){ r.querySelector('.ev-pax-grp').style.display=m==='per'?'':'none'; });
};
// Affiche / masque le formulaire « Événement » dans la fenêtre Nouvelle demande
window._evSetMode=function(on){
  var m=document.getElementById('m-new-ride'); if(!m) return;
  m.classList.toggle('nr-event', !!on);
  m.classList.remove('ev-recap-on');
  var pe=document.getElementById('panel-event'); if(pe) pe.style.display=on?'block':'none';
  var tl=document.getElementById('ride-modal-title');
  var b=document.getElementById('btn-submit-ride');
  if(on){
    ['panel-ab','panel-disposal','panel-mixed'].forEach(function(id){ var p=document.getElementById(id); if(p) p.style.display='none'; });
    if(tl) tl.textContent=window._evTarget?'Ajouter un trajet':'Nouvel événement';
    if(!_evRows().length){
      var cn=document.getElementById('ev-cname'), cp=document.getElementById('ev-cphone');
      if(cn&&!cn.value) cn.value=(window._evTarget&&window._evTarget.contact_name)||(window._newRidePaxName||((currentProfile&&((currentProfile.first_name||'')+' '+(currentProfile.last_name||'')).trim())||''));
      if(cp&&!cp.value) cp.value=(window._evTarget&&window._evTarget.contact_phone)||(window._newRidePaxTel||(currentProfile&&currentProfile.phone)||'');
      _evAdd({});
    }
    _evRenumber();
  } else {
    if(tl && !(document.getElementById('ride-edit-id')||{}).value) tl.textContent=t('new_ride_title');
    if(b) b.innerHTML=t('btn_publish')+' &rarr;';
  }
};
window._evReset=function(){
  window._evTarget=null;
  var box=document.getElementById('ev-vehicles'); if(box) box.innerHTML='';
  ['ev-name','ev-cname','ev-cphone'].forEach(function(id){ var e=document.getElementById(id); if(e){ e.value=''; e.readOnly=false; } });
  var m=document.getElementById('m-new-ride'); if(m) m.classList.remove('ev-add-only');
  _evMode('one'); _evSetMode(false);
};
// « + Ajouter un véhicule » depuis la fiche d'un événement
window._evAddToEvent=function(ev){
  // La fiche de l'événement reste en dessous : la flèche retour y ramène
  cancelRideModal(); _evReset(); window._evTarget=ev; window._evAddPending=true;
  _rdPushUnder('m-event');
  openModal('m-new-ride');
  var n=document.getElementById('ev-name'); if(n){ n.value=ev.name||''; n.readOnly=true; }
  document.getElementById('m-new-ride').classList.add('ev-add-only');
  _nrPick('event');
};

// Récapitulatif de l'événement : liste des trajets avant confirmation
window._evShowRecap=function(d){
  var m=document.getElementById('m-new-ride'), box=document.getElementById('ev-recap'); if(!m||!box) return;
  var esc=_rdEsc, fd=function(x){ if(!x) return ''; var t=new Date(x+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).replace(/\./g,''); return t.charAt(0).toUpperCase()+t.slice(1); };
  var h='<div class="evr-hd"><div class="k">'+t('app.recapitulatif_de_levenement')+'</div><div class="t">'+esc(d.name)+'</div>'
    +'<div class="s">'+esc([d.trips.length+' trajet'+(d.trips.length>1?'s':''), d.total+' véhicule'+(d.total>1?'s':''), d.mode==='one'&&d.cname?'contact : '+d.cname+(d.cphone?' · '+d.cphone:''):(d.mode==='per'?'un contact par trajet':'')].filter(Boolean).join(' · '))+'</div></div>';
  d.trips.forEach(function(tr){
    var t=tr.t, disp=t.type==='disposal', nv=_evTotal(tr.c), st=_evSeats(tr.c);
    h+='<div class="evr-trip"><div class="evr-th"><span class="n">'+tr.i+'</span>'+_T('app.trajet')+' '+tr.i+' <span class="ty">· '+(disp?'Mise à disposition':'Transfert simple')+'</span><span class="dt">'+esc(fd(t.date))+' · '+esc(t.time)+'</span></div>'
      +'<div class="evr-rt">'+(disp
        ?'<div><i style="background:#E09A2B"></i><span>'+esc(t.from)+'</span></div>'
        :'<div><i style="background:#4E8F69"></i><span>'+esc(t.from)+'</span></div><div><i style="background:#D8705F"></i><span>'+esc(t.to)+'</span></div>')+'</div>'
      +'<div class="evr-kv"><span><b>'+esc(_evCntLabel(tr.c))+'</b></span>'
      +'<span>'+(tr.n?'<b>'+tr.n+'</b> '+_T('app.personne')+(tr.n>1?'s':''):(st.bus?'capacité selon le bus':_T('app.jusqua')+' <b>'+st.seats+'</b> '+_T('app.personnes')))+'</span>'
      +(disp?'<span>'+_T('app.duree')+' <b>'+(parseInt(t.dur,10)||2)+' h</b></span>':'')
      +(t.flight?'<span>'+_T('app.vol')+' <b>'+esc(t.flight)+'</b></span>':'')
      +(t.train?'<span>'+_T('app.train')+' <b>'+esc(t.train)+'</b></span>':'')
      +(t.flight2?'<span>'+_T('app.vol')+' <b>'+esc(t.flight2)+'</b></span>':'')
      +(t.train2?'<span>'+_T('app.train')+' <b>'+esc(t.train2)+'</b></span>':'')
      +(d.mode==='per'&&(t.pname||t.pphone)?'<span>'+_T('app.contact')+' <b>'+esc([t.pname,t.pphone].filter(Boolean).join(' · '))+'</b></span>':'')
      +'</div></div>';
  });
  h+='<div class="evr-tot">'+'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg><span>'+(d.total>1?d.total+' demandes seront envoyées aux chauffeurs, regroupées dans cet événement.':'1 demande sera envoyée aux chauffeurs, rattachée à cet événement.')+'</span></div>';
  box.innerHTML=h;
  m.classList.add('ev-recap-on');
  var tl=document.getElementById('ride-modal-title'); if(tl) tl.textContent='Récapitulatif';
  var b=m.querySelector('.modal-body'); if(b) b.scrollTop=0;
  _evRenumber();
};
// Récapitulatif d'une demande simple / mise à disposition / trajet mixte
window._nrShowRecap=function(d){
  var m=document.getElementById('m-new-ride'), box=document.getElementById('ev-recap'); if(!m||!box) return;
  var esc=_rdEsc, fd=function(x){ if(!x) return ''; var t=new Date(x+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).replace(/\./g,''); return t.charAt(0).toUpperCase()+t.slice(1); };
  var cls=function(v){ return ({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[v]||v||''; };
  var chip=function(k,v){ return v?'<span>'+(k?k+' ':'')+'<b>'+esc(v)+'</b></span>':''; };
  var trips=[];
  if(d.type==='mixed'){
    parseMixedNotes(d.notes||'').forEach(function(sg){ var disp=sg.type.toLowerCase().indexOf('disp')>=0;
      trips.push({ disp:disp, date:sg.date, time:sg.time, from:sg.from, to:sg.to, dur:sg.dur?String(sg.dur).replace(/h$/,''):'', pax:sg.pax, veh:sg.veh, fl:[sg.flight,sg.flight2].filter(Boolean), trn:[sg.train,sg.train2].filter(Boolean), instr:sg.note, pname:sg.paxName, ptel:sg.paxTel, lug:_lugTxt(sg.lugL,sg.lugS) }); });
  } else {
    var tr=d.tr||{};
    trips.push({ disp:d.type==='disposal', date:d.date, time:d.time, from:d.from, to:d.to, dur:d.dur, pax:d.pax, veh:d.veh, fl:[tr.flight,tr.flight2].filter(Boolean), trn:[tr.train,tr.train2].filter(Boolean), instr:d.instr, lug:_lugTxt(d.lugL,d.lugS) });
  }
  var pn=(window._newRidePaxName||'').trim(), pt=(window._newRidePaxTel||'').trim();
  if(d.type==='mixed' && _mixPMVal()==='one'){ pn=(document.getElementById('mix-cname')||{}).value||''; pt=(document.getElementById('mix-cphone')||{}).value||''; }
  if(trips.some(function(t){ return t.pname||t.ptel; })){ pn=''; pt=''; }
  var ttl={ab:'Transfert simple',disposal:'Mise à disposition',mixed:'Trajet mixte'}[d.type]||'Demande';
  var h='<div class="evr-hd" style="background:#F3F8F4;"><div class="k" style="color:#2E7A4F;">'+t('app.recapitulatif_de_la_demande')+'</div>'+(d.type==='mixed'?'<div class="t">'+esc(ttl)+'</div>':'')
    +'<div class="s">'+esc([trips.length>1?trips.length+' trajets':'', pn?(d.type==='mixed'?'contact : ':'passager : ')+pn+(pt?' · '+pt:''):(d.type==='mixed'&&trips.some(function(t){ return t.pname; })?'un contact par trajet':'')].filter(Boolean).join(' · ')||'Vérifiez les informations avant de publier.')+'</div></div>';
  trips.forEach(function(t,i){
    h+='<div class="evr-trip"><div class="evr-th">'+(trips.length>1?'<span class="n">'+(i+1)+'</span>'+_T('app.trajet')+' '+(i+1)+' <span class="ty">· '+(t.disp?'Mise à disposition':'Transfert simple')+'</span>':'<span>'+(t.disp?'Mise à disposition':'Transfert simple')+'</span>')+'<span class="dt">'+esc(fd(t.date))+(t.time?' · '+esc(t.time):'')+'</span></div>'
      +'<div class="evr-rt"><div><i style="background:'+(t.disp?'#E09A2B':'#4E8F69')+'"></i><span>'+esc(t.from||'—')+'</span></div>'+(!t.disp&&t.to?'<div><i style="background:#D8705F"></i><span>'+esc(t.to)+'</span></div>':'')+'</div>'
      +'<div class="evr-kv">'+chip('',cls(t.veh))+(t.pax?'<span><b>'+esc(t.pax)+'</b> '+_T('app.passager')+(String(t.pax)==='1'?'':'s')+'</span>':'')
      +(t.lug?'<span>'+_T('app.bagages')+' <b>'+esc(t.lug)+'</b></span>':'')
      +(t.disp&&t.dur?'<span>'+_T('app.duree')+' <b>'+esc(t.dur)+' h</b></span>':'')
      +t.fl.map(function(x){ return chip('Vol',x); }).join('')+t.trn.map(function(x){ return chip('Train',x); }).join('')
      +(t.pname||t.ptel?'<span>'+_T('app.contact')+' <b>'+esc([t.pname,t.ptel].filter(Boolean).join(' · '))+'</b></span>':'')+'</div>'
      +(t.instr?'<div style="font-size:12.5px;color:var(--ink3);margin-top:12px;padding-top:12px;border-top:1px solid #F0EEE9;line-height:1.45;"><span style="color:var(--ink2);font-weight:600;">'+_T('app.instructions_2')+' </span>'+esc(t.instr)+'</div>':'')
      +'</div>';
  });
  h+='<div class="evr-tot">'+'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg><span>'+((d.type==='mixed'&&_mixDrvVal()==='any')?trips.length+' demandes séparées seront envoyées aux chauffeurs (une par trajet) : chaque trajet peut être pris par un chauffeur différent.':'Votre demande sera envoyée aux chauffeurs, qui vous feront leurs offres.')+'</span></div>';
  box.innerHTML=h;
  m.classList.add('nr-recap-on');
  var tl=document.getElementById('ride-modal-title'); if(tl) tl.textContent='Récapitulatif';
  var b=m.querySelector('.modal-body'); if(b) b.scrollTop=0;
};
window._nrRecapBack=function(){
  var m=document.getElementById('m-new-ride'); if(!m) return;
  m.classList.remove('nr-recap-on');
  var tl=document.getElementById('ride-modal-title'); if(tl) tl.textContent=t('new_ride_title');
};
window._evEditBack=function(){
  var m=document.getElementById('m-new-ride'); if(!m) return;
  m.classList.remove('ev-recap-on');
  var tl=document.getElementById('ride-modal-title'); if(tl) tl.textContent=window._evTarget?'Ajouter un trajet':'Nouvel événement';
  var err=document.getElementById('ride-err'); if(err){ err.textContent=''; err.classList.remove('show'); }
  _evRenumber();
};
// ── Annulation d'un événement : annule tous les trajets encore annulables ──
function _evCxOk(r){ return !!r && ['waiting','offers','confirmed','pending_payment'].indexOf(r.status)>=0 && !r.on_way_at; }
window._evMenu=function(e){
  e.stopPropagation(); var pop=document.getElementById('ev-pop'); if(!pop) return;
  var open=!pop.classList.contains('open'); pop.classList.toggle('open', open);
  if(open) setTimeout(function(){ document.addEventListener('click', function f(){ pop.classList.remove('open'); document.removeEventListener('click', f); }); },0);
};
window._evCancelAsk=async function(){
  var pop=document.getElementById('ev-pop'); if(pop) pop.classList.remove('open');
  var ev=window._evCur||{}, rides=(window._evRides||[]).filter(_evCxOk), skip=(window._evRides||[]).filter(function(r){ return r.status!=='cancelled' && !_evCxOk(r); });
  if(!rides.length){ showToast(t('app.aucun_trajet_a_annuler')); return; }
  try{ await _loadRefundRules(); }catch(_e){}
  var paid=rides.filter(function(r){ return r.status==='confirmed' && parseFloat(r.final_price)>0; });
  var esc=_rdEsc, fd=function(r){ return (r.ride_date?formatDate(r.ride_date):'')+(r.ride_time?' · '+String(r.ride_time).slice(0,5):''); };
  var cls=function(v){ return ({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[v]||'Véhicule'; };
  var delays=paid.map(function(r){ return _refundDelayHours(r); }).filter(function(v,i,a){ return a.indexOf(v)===i; });
  var h='<div class="evx-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg></div>'
    +'<div class="evx-t">'+(ev.kind==='mixed'?'Annuler le trajet mixte ?':'Annuler l’événement ?')+'</div>'
    +'<div class="evx-s">'+t('app.les')+' <b>'+rides.length+' trajet'+(rides.length>1?'s':'')+'</b> '+t('app.de')+' '+esc(ev.name||'Événement')+' » seront annulés et les chauffeurs concernés prévenus.'+(skip.length?' '+skip.length+' trajet'+(skip.length>1?'s':'')+' déjà terminé'+(skip.length>1?'s':'')+' ou en cours ne '+(skip.length>1?'sont':'est')+' pas concerné'+(skip.length>1?'s':'')+'.':'')+'</div>';
  if(paid.length){
    var nr=0, tot=0;
    h+='<div class="evx-warn"><div class="evx-wt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>'+(paid.length>1?paid.length+' demandes ont déjà été confirmées et payées':'1 demande a déjà été confirmée et payée')+'</div>'
      +'<div class="evx-wx">'+t('app.conformement_aux_conditions_dutilisation_une')+' <b>'+t('app.plus_remboursable')+'</b> '+t('app.lorsquelle_est_annulee_a_moins')+' <b>'+delays.join(' / ')+' h</b> '+t('app.du_depart')+'</div><div class="evx-list">';
    paid.forEach(function(r){
      var ok=_minsUntilRide(r)>=_refundDelayHours(r)*60 && r.payment_method!=='non_refundable', amt=parseFloat(r.final_price)||0;
      if(!ok){ nr++; tot+=amt; }
      h+='<div class="evx-row"><div><b>'+esc(cls(r.vehicle_type))+'</b> · '+esc(fd(r))+'<span>'+esc(r.booking_code||'')+'</span></div><div class="evx-amt">'+amt.toFixed(2).replace('.',',')+' €<i class="'+(ok?'ok':'ko')+'">'+(ok?'Remboursable':'Non remboursable')+'</i></div></div>';
    });
    h+='</div>'+(nr?'<div class="evx-tot">'+t('app.montant_non_rembourse')+' <b>'+tot.toFixed(2).replace('.',',')+' €</b></div>':'')+'</div>';
  }
  var _w=ev.kind==='mixed'?'le trajet mixte':'l’événement';
  h+='<div class="evx-ft"><button type="button" class="btn btn-secondary" id="evx-no">'+t('app.garder')+' '+_w+'</button><button type="button" class="btn evx-go" id="evx-yes">'+t('app.annuler')+' '+_w+'</button></div>';
  var ov=document.createElement('div'); ov.id='evx-pop'; ov.className='evx-ov'; ov.innerHTML='<div class="evx-box">'+h+'</div>';
  document.body.appendChild(ov);
  var close=function(){ ov.remove(); };
  ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
  ov.querySelector('#evx-no').onclick=close;
  ov.querySelector('#evx-yes').onclick=async function(){ var b=this; b.disabled=true; b.textContent='Annulation…'; await _evCancelDo(rides); close(); };
};
async function _evCancelDo(rides){
  var ev=window._evCur||{};
  if(!sb || localStorage.getItem(DEMO_MODE_KEY)==='1'){ showToast(t('app.evenement_annule')+rides.length+' trajets)'); return; }
  var ok=0, ko=0, offs={};
  try{ var o=await sb.from('offers').select('ride_id,driver_id').in('ride_id', rides.map(function(r){ return r.id; })); (o.data||[]).forEach(function(x){ (offs[x.ride_id]=offs[x.ride_id]||[]).push(x.driver_id); }); }catch(_e){}
  for(var i=0;i<rides.length;i++){
    var r=rides[i];
    try{
      var res=await sb.rpc('api_ride_cancel',{ p_ride:r.id });
      if(res.error){ ko++; console.warn('[event cancel]', r.booking_code, res.error.message); continue; }
      ok++;
      try{ _notifyRideCancelled(r.id, !(res.data && res.data.refundable===false), offs[r.id]||[]); }catch(_e){}
    }catch(e){ ko++; }
  }
  showToast(ko?('⚠️ '+ok+' trajet'+(ok>1?'s':'')+' annulé'+(ok>1?'s':'')+', '+ko+' impossible'+(ko>1?'s':'')+' à annuler'):('✅ Événement annulé ('+ok+' trajet'+(ok>1?'s':'')+')'));
  try{ await openEventDetail(ev.id, true); }catch(_e){}
  try{ await loadClientDashboard(); var rp=document.getElementById('page-rides'); if(rp&&rp.classList.contains('active')) await loadRides(); }catch(_e){}
}
async function _mixSplitSubmit(segs, gName, gTel, btn, err){
  var fail=function(msg){ if(err){ err.textContent=msg; err.classList.add('show'); err.style.display=''; } };
  if(!segs.length) return fail(t('err_required'));
  var one=_mixPMVal()==='one';
  if(one){ gName=((document.getElementById('mix-cname')||{}).value||'').trim(); gTel=((document.getElementById('mix-cphone')||{}).value||'').trim(); }
  var sh=function(a){ return String(cleanAddr(a)||'').split(',')[0].trim(); };
  var first=segs[0], last=segs[segs.length-1];
  var name=sh(first.from)+' → '+sh(last.to||last.from);
  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){ closeModal('m-new-ride'); cancelRideModal(); showToast('✅ '+segs.length+' demandes envoyées aux chauffeurs'); await loadClientDashboard(); return; }
  if(btn) setLoading(btn, true, t('app.publication'));
  var ids=[], created=[];
  try{
    for(var k=0;k<segs.length;k++){
      var s=segs[k], disp=s.type.toLowerCase().indexOf('disp')>=0, notes='';
      if(disp) notes='Durée:'+(parseInt(s.dur,10)||2)+'h';
      if(s.note) notes=(s.note.replace(/\|/g,' ')+(notes?' '+notes:''));
      var pn=s.paxName||gName, pt=s.paxTel||gTel;
      if(pn) notes+='|pax:'+pn.replace(/\|/g,' ');
      if(pt) notes+='|tel:'+pt.replace(/\|/g,' ');
      ['flight','train','flight2','train2'].forEach(function(x){ if(s[x]) notes+='|'+x+':'+s[x]; });
      var rd={ client_id:currentUser.id, trip_type:disp?'disposal':'ab', from_address:s.from, to_address:disp?null:s.to, ride_date:s.date||todayStr(), ride_time:s.time||'08:00',
               passengers:parseInt(s.pax,10)||1, vehicle_type:s.veh||null, luggage_large:s.lugL||0, luggage_small:s.lugS||0, notes:notes||null, status:'waiting' };
      var res=await sb.rpc('api_ride_create',{ p:rd });
      if(res.error) throw new Error('Trajet '+(k+1)+' : '+(res.error.message||'refusé'));
      rd.id=res.data&&res.data.id; rd.booking_code=res.data&&res.data.booking_code; ids.push(rd.id); created.push(rd);
    }
    var lk=await sb.rpc('api_event_create',{ p:{ name:name, kind:'mixed', contact_name:one?gName:'', contact_phone:one?gTel:'', ride_ids:ids } });
    if(lk.error) throw new Error('Demandes créées, mais non regroupées : '+(lk.error.message||''));
    created.forEach(function(rd){ try{ _notifyMarketplaceDrivers(rd); }catch(_e){} });
    if(currentProfile&&currentProfile.email&&created[0]){ try{ window.sendMail('ride_created', currentProfile.email, Object.assign(window._mailRideData(created[0]), { clientName:(currentProfile.first_name||'') })); }catch(_e){} }
    closeModal('m-new-ride'); cancelRideModal();
    showToast('✅ '+created.length+' demandes envoyées aux chauffeurs');
    await loadClientDashboard();
    var rp=document.getElementById('page-rides'); if(rp&&rp.classList.contains('active')) await loadRides();
  }catch(e){ console.error('mixSplit', e); fail(e.message||'Erreur'); }
  finally{ if(btn){ setLoading(btn,false,t('app.publier')); btn.disabled=false; btn.innerHTML=t('btn_publish')+' &rarr;'; } }
}
async function submitEvent(){
  var err=document.getElementById('ride-err'), btn=document.getElementById('btn-submit-ride');
  var fail=function(msg){ if(err){ err.textContent=msg; err.classList.add('show'); err.style.display=''; } };
  if(err){ err.textContent=''; err.classList.remove('show'); }
  var tg=window._evTarget, name=(document.getElementById('ev-name')||{}).value||''; name=name.trim();
  if(!tg && !name) return fail('Indiquez le nom de l’événement.');
  var mode=_evModeVal(), cname=((document.getElementById('ev-cname')||{}).value||'').trim(), cphone=((document.getElementById('ev-cphone')||{}).value||'').trim();
  var rows=_evRows(), list=[], trips=[];
  for(var i=0;i<rows.length;i++){
    var r=rows[i], ty=_evVal(r,'ev-type'), t={ type:ty, from:_evVal(r,'ev-from'), to:_evVal(r,'ev-to'), dur:_evVal(r,'ev-dur'), date:_evVal(r,'ev-date'), time:_evVal(r,'ev-time'), pname:_evVal(r,'ev-pname'), pphone:_evVal(r,'ev-pphone'), lugL:parseInt(_evVal(r,'ev-lugL'),10)||0, lugS:parseInt(_evVal(r,'ev-lugS'),10)||0 };
    var _vis=function(c){ var g=r.querySelector('.'+c); return g && g.style.display!=='none'; };
    var _bad='';
    ['flight','train','flight2','train2'].forEach(function(k){
      t[k]=_vis('ev-'+k+'-grp')?_evVal(r,'ev-'+k).toUpperCase().replace(/\s+/g,' '):'';
      if(t[k] && !_bad && !(k.indexOf('flight')===0?/^[A-Z0-9]{2,3} ?\d{1,4}[A-Z]?$/:/^[A-Z]{0,4} ?\d{1,5}$/).test(t[k])) _bad=k.indexOf('flight')===0?'numéro de vol invalide (ex. SN 3123)':'numéro de train invalide (ex. IC 1832)';
    });
    if(_bad) return fail('Trajet '+(i+1)+' : '+_bad+'.');
    if(!t.from || (ty==='ab' && !t.to) || !t.date || !t.time) return fail('Trajet '+(i+1)+' : indiquez '+(!t.from?(ty==='ab'?'le départ':'le lieu de prise en charge'):(ty==='ab'&&!t.to)?'l’arrivée':!t.date?'la date':'l’heure')+'.');
    if(_leadErr(t.date,t.time)){ var _de=r.querySelector('.ev-date'), _te=r.querySelector('.ev-time'); setTimeout(function(){ if(_de) _de.classList.add('fld-err'); if(_te) _te.classList.add('fld-err'); },40); return fail('Trajet '+(i+1)+' : il doit commencer au moins 1 heure à l’avance.'); }
    var vm=r.getAttribute('data-vm'), N=parseInt(r.getAttribute('data-n'),10)||0, c=_evCounts(r);
    if(vm==='pax' && !N) return fail('Trajet '+(i+1)+' : indiquez le nombre de personnes.');
    if(!_evTotal(c)) return fail('Trajet '+(i+1)+' : choisissez au moins un véhicule.');
    // Un véhicule = une demande ; les personnes sont réparties du plus grand au plus petit véhicule
    var veh=[]; _EV_CLS.slice().sort(function(a,b){ return b.cap-a.cap; }).forEach(function(x){ for(var q=0;q<(c[x.k]||0);q++) veh.push(x); });
    trips.push({ t:t, n:N, c:c, i:i+1 });
    var left=N;
    veh.forEach(function(x,q){
      var pax;
      if(N){ var others=veh.length-q-1; pax=Math.max(1, Math.min(x.k==='bus'?left-others:x.cap, left-others)); left-=pax; }
      else pax=x.k==='bus'?8:x.cap;
      // bagages du trajet répartis entre ses véhicules
      var nv=veh.length, sh=function(tot){ return Math.floor(tot/nv)+(q<tot%nv?1:0); };
      list.push(Object.assign({}, t, { cls:x.k, pax:pax, trip:i+1, lugL:sh(t.lugL), lugS:sh(t.lugS) }));
    });
  }
  if(!list.length) return fail('Ajoutez au moins un véhicule.');
  window._evLastList=list;
  // Étape récapitulatif avant la création des demandes
  var _m=document.getElementById('m-new-ride');
  if(!_m.classList.contains('ev-recap-on')){ _evShowRecap({ name:name||(tg&&tg.name)||'', mode:mode, cname:cname, cphone:cphone, trips:trips, total:list.length }); return; }
  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){ closeModal('m-new-ride'); cancelRideModal(); showToast(_T('app.evenement_publie')+list.length+' demandes'); await loadClientDashboard(); return; }
  if(btn) setLoading(btn, true, _T('app.publication'));
  var ids=[], created=[];
  try{
    for(var k=0;k<list.length;k++){
      var v=list[k], notes=v.type==='disposal'?('Durée:'+(parseInt(v.dur,10)||2)+'h'):'';
      var pn=mode==='per'?(v.pname||cname):cname, pp=mode==='per'?(v.pphone||cphone):cphone;
      if(pn) notes+='|pax:'+pn.replace(/\|/g,' ');
      if(pp) notes+='|tel:'+pp.replace(/\|/g,' ');
      if(v.flight) notes+='|flight:'+v.flight;
      if(v.train) notes+='|train:'+v.train;
      if(v.flight2) notes+='|flight2:'+v.flight2;
      if(v.train2) notes+='|train2:'+v.train2;
      var rd={ client_id:currentUser.id, trip_type:v.type, from_address:v.from, to_address:v.type==='ab'?v.to:null, ride_date:v.date, ride_time:v.time,
               passengers:parseInt(v.pax,10)||1, vehicle_type:v.cls||null, luggage_large:v.lugL||0, luggage_small:v.lugS||0, notes:notes||null, status:'waiting' };
      var res=await sb.rpc('api_ride_create',{ p:rd });
      if(res.error) throw new Error('Trajet '+v.trip+' ('+_evClsName(v.cls)+') : '+(res.error.message||'refusé'));
      rd.id=res.data&&res.data.id; rd.booking_code=res.data&&res.data.booking_code; ids.push(rd.id); created.push(rd);
    }
    var lk=await sb.rpc('api_event_create',{ p:{ name:name, contact_name:mode==='one'?cname:'', contact_phone:mode==='one'?cphone:'', ride_ids:ids, event_id:tg?tg.id:null } });
    if(lk.error) throw new Error('Demandes créées, mais non regroupées en événement : '+(lk.error.message||''));
    created.forEach(function(rd){ try{ _notifyMarketplaceDrivers(rd); }catch(_e){} });
    if(currentProfile&&currentProfile.email&&created[0]){
      try{ window.sendMail('ride_created', currentProfile.email, Object.assign(window._mailRideData(created[0]), { clientName:(currentProfile.first_name||'') })); }catch(_e){}
    }
    var evId=lk.data&&lk.data.id;
    closeModal('m-new-ride'); cancelRideModal();
    showToast('✅ '+created.length+' demande'+(created.length>1?'s':'')+' envoyée'+(created.length>1?'s':'')+' aux chauffeurs');
    await loadClientDashboard();
    var rp=document.getElementById('page-rides'); if(rp&&rp.classList.contains('active')) await loadRides();
    if(tg && evId) setTimeout(function(){ openEventDetail(evId); }, 500);
  }catch(e){
    console.error('submitEvent', e); fail(e.message||'Erreur');
  }finally{ if(btn){ setLoading(btn,false,_T('app.publier')); btn.disabled=false; _evRenumber(); } }
}

// Listes client : les véhicules d'un même événement sont regroupés en une seule ligne
function _groupEvents(list){
  var out=[], seen={};
  (list||[]).forEach(function(r){
    if(r && r.event_id){
      if(seen[r.event_id]){ seen[r.event_id].rides.push(r); return; }
      var g={ _evt:true, id:r.event_id, name:r.event_name||'Événement', kind:r.event_kind||'event', rides:[r] }; seen[r.event_id]=g; out.push(g);
    } else out.push(r);
  });
  return out;
}
function _evSummary(rides){
  var cnt={}; rides.forEach(function(r){ var c=({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[r.vehicle_type]||'Véhicule'; cnt[c]=(cnt[c]||0)+1; });
  return rides.length+' véhicule'+(rides.length>1?'s':'')+' · '+Object.keys(cnt).map(function(k){ return cnt[k]+' '+k; }).join(' · ');
}
function renderEventItem(g){
  var rides=g.rides.slice().sort(function(a,b){ return String(a.ride_date+a.ride_time).localeCompare(String(b.ride_date+b.ride_time)); });
  var f=rides[0]||{}, d=f.ride_date?new Date(f.ride_date+'T00:00:00'):null;
  var day=d?String(d.getDate()).padStart(2,'0'):'--', mon=d?d.toLocaleDateString('fr-FR',{month:'short'}).toUpperCase().replace('.',''):'';
  var conf=rides.filter(function(r){ return ['confirmed','active','done','pending_payment'].indexOf(r.status)>=0; }).length;
  var offers=rides.reduce(function(s,r){ return s+((r.status==='offers'||r.status==='waiting')?(r._offerCount||(r.offers&&r.offers[0]?parseInt(r.offers[0].count)||0:0)):0); },0);
  var paid=rides.reduce(function(s,r){ return s+((['confirmed','active','done'].indexOf(r.status)>=0&&r.final_price)?parseFloat(r.final_price):0); },0);
  var pct=Math.round(conf/Math.max(rides.length,1)*100);
  var cx=rides.filter(function(r){ return r.status==='cancelled'; }).length, pctx=Math.round(cx/Math.max(rides.length,1)*100);
  return '<div class="ride-card ev-card" onclick="openEventDetail(\''+String(g.id).replace(/'/g,'')+'\')">'
    +'<div class="ride-card-date-col"><div class="ride-card-date-month">'+mon+'</div><div class="ride-card-date-day">'+day+'</div></div>'
    +'<div style="display:flex;align-items:center;">'+(g.kind==='mixed'?'<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:var(--blue-bg);color:var(--blue);padding:2px 7px;border-radius:20px;">'+t('app.mixte')+'</span>':'<span class="ev-tag">'+t('app.evenement')+'</span>')+'</div>'
    +'<div style="min-width:0;"><div class="ride-card-col-label">'+(g.kind==='mixed'?'Trajets':'Événement')+'</div><div class="ride-card-col-val" style="font-weight:700;">'+_rdEsc(g.name)+'</div></div>'
    +'<div style="min-width:0;"><div class="ride-card-col-label">'+t('app.vehicules')+'</div><div class="ride-card-col-val">'+_rdEsc(_evSummary(rides))+'</div></div>'
    +'<div><div class="ride-card-col-label">'+t('app.statut')+'</div><div style="font-size:12px;color:var(--ink2);">'+conf+' / '+rides.length+' confirmée'+(conf>1?'s':'')+'</div><div class="ev-bar"><i style="width:'+pct+'%"></i>'+(cx?'<i class="cx" style="width:'+pctx+'%"></i>':'')+'</div>'+(cx?'<div style="font-size:11.5px;color:#C8453A;margin-top:3px;">'+cx+' annulée'+(cx>1?'s':'')+'</div>':'')+(offers?'<div style="font-size:11.5px;color:#2456A6;margin-top:3px;">'+offers+' offre'+(offers>1?'s':'')+' reçue'+(offers>1?'s':'')+'</div>':'')+'</div>'
    +'<div style="text-align:right;"><div class="ride-card-col-label">'+t('app.prix')+'</div><div class="ride-card-col-val" style="font-weight:700;">'+(paid>0?paid.toFixed(2)+' €':'---')+'</div></div>'
    +'<svg class="ride-card-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    +'</div>';
}
function _renderListItem(x){ return x&&x._evt?renderEventItem(x):renderRideItem(x); }

// Fiche de l'événement (client) : compteurs + liste des véhicules
window._evOpenId=null;
window.openEventDetail=async function(id, silent){
  window._evOpenId=id;
  var body=document.getElementById('ev-body'), title=document.getElementById('ev-title'), ft=document.getElementById('ev-ft');
  if(!silent){ if(body) body.innerHTML='<div class="rd-skel" style="height:180px;"></div>'; if(title) title.innerHTML=''; if(ft) ft.innerHTML=''; openModal('m-event'); }
  if(!sb||localStorage.getItem(DEMO_MODE_KEY)==='1') return;
  try{
    var [rr, er]=await Promise.all([
      sb.from('rides').select('*').eq('event_id',id).order('ride_date',{ascending:true}).order('ride_time',{ascending:true}),
      sb.from('ride_events').select('*').eq('id',id).maybeSingle()
    ]);
    var rides=rr.data||[], ev=er.data||{ id:id, name:(rides[0]&&rides[0].event_name)||'Événement' };
    await _mergeRidePrivate(rides);
    if(rides.length){
      var oc=await sb.from('offers').select('ride_id').eq('status','pending').in('ride_id', rides.map(function(r){ return r.id; }));
      var c={}; (oc.data||[]).forEach(function(o){ c[o.ride_id]=(c[o.ride_id]||0)+1; }); rides.forEach(function(r){ r._offerCount=c[r.id]||0; });
    }
    if(window._evOpenId!==id) return;
    var f=rides[0]||{}, l=rides[rides.length-1]||{}, _fd=function(x,o){ return x?new Date(x+'T00:00:00').toLocaleDateString('fr-BE',o).replace(/\./g,''):''; };
    var dd=(f.ride_date&&l.ride_date&&f.ride_date!==l.ride_date)?_fd(f.ride_date,{day:'numeric',month:'short'})+' \u2013 '+_fd(l.ride_date,{day:'numeric',month:'short'}):_fd(f.ride_date,{weekday:'short',day:'numeric',month:'short'});
    dd=dd?dd.charAt(0).toUpperCase()+dd.slice(1):'';
    var _mx=ev.kind==='mixed'||(rides[0]&&rides[0].event_kind==='mixed'); ev.kind=_mx?'mixed':'event';
    if(title) title.innerHTML='<span class="rd-hd2">'+(_mx?'':'<span class="rd-evline" style="margin:0;"><span>'+t('app.evenement')+'</span></span>')+'<b class="rd-hd2-code">'+_rdEsc(ev.name)+'</b><span class="rd-hd2-sub">'+_rdEsc([dd, rides.length+' véhicule'+(rides.length>1?'s':''), ev.contact_name?'contact : '+ev.contact_name:''].filter(Boolean).join(' · '))+'</span></span>';
    var nConf=rides.filter(function(r){ return ['confirmed','active','done','pending_payment'].indexOf(r.status)>=0; }).length;
    var nOff=rides.filter(function(r){ return r.status==='offers'; }).length, nWait=rides.filter(function(r){ return r.status==='waiting'; }).length;
    var sh=function(a){ return String(cleanAddr(a)||'').split(',')[0].trim(); };
    var cls=function(v){ return ({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[v]||'Véhicule'; };
    var h='<div class="ev-kpis"><div><b>'+nConf+'</b><span>'+t('app.confirmee')+(nConf>1?'s':'')+'</span></div><div><b>'+nOff+'</b><span>'+t('app.avec_offres')+'</span></div><div><b>'+nWait+'</b><span>'+t('app.en_attente_2')+'</span></div></div>';
    var _dl=function(x){ if(!x) return ''; var t=new Date(x+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'}); return t.charAt(0).toUpperCase()+t.slice(1); };
    var _days=rides.map(function(r){ return r.ride_date||''; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
    var _lastDay=null;
    rides.forEach(function(r,i){
      var isD=r.trip_type==='disposal';
      h+=_tripCardHtml({ n:i+1, disp:isD, date:r.ride_date, time:r.ride_time, from:r.from_address, to:isD?'':r.to_address,
        dur:isD?(((r.notes||'').match(/Durée:([^\s|,]+)/)||[])[1]||''):'', veh:r.vehicle_type, pax:r.passengers||1,
        lug:_lugTxt(r.luggage_large,r.luggage_small), fl:[_rdTag(r.notes,'flight')], trn:[_rdTag(r.notes,'train')],
        contact:_rdTag(r.notes,'pax'), right:_statusBadge(r.status, r._offerCount||0),
        attrs:' onclick="_rdPushUnder(\'m-event\');openRideDetail(this)" data-ride=\''+JSON.stringify(r).replace(/'/g,'&#39;')+'\'' });
    });
    _mxFillKm();
    if(!rides.length) h+='<div class="rd-muted">'+t('app.aucun_vehicule')+'</div>';
    if(body) body.innerHTML=h;
    window._evCur=ev; window._evRides=rides;
    var _canCx=rides.some(function(r){ return _evCxOk(r); });
    // Événement terminé (tous les trajets terminés ou annulés) : plus d'ajout de trajet
    var _evOver=rides.length>0 && rides.every(function(r){ return r.status==='done'||r.status==='cancelled'; });
    if(ft) ft.innerHTML=(_canCx?'<div class="ev-menu" style="margin-right:auto;"><button type="button" class="ev-dots" aria-label="'+t('app.actions')+'" onclick="_evMenu(event)"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg></button><div class="ev-pop" id="ev-pop"><button type="button" onclick="_evCancelAsk()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'+(_mx?'Annuler le trajet mixte':'Annuler l’événement')+'</button></div></div>':'')
      +((_mx||_evOver)?'':'<button class="btn btn-green" style="margin-left:auto;" onclick="_evAddToEvent(window._evCur)">'+t('app.ajouter_un_trajet')+'</button>');
  }catch(e){ console.warn('openEventDetail', e); if(body&&!silent) body.innerHTML='<div class="rd-muted">'+t('app.impossible_de_charger_levenement')+'</div>'; }
};

