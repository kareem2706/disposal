// ── Mission progress (fleet): En chemin → Pick up terminé → Mission terminée ──
function _hhmm(ts){ if(!ts) return ''; var d=new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function _missionProgressHtml(r){
  var parts=[];
  if(r.on_way_at) parts.push('En chemin '+_hhmm(r.on_way_at));
  if(r.pickup_at) parts.push('Pick up '+_hhmm(r.pickup_at));
  return '<div style="flex:1;min-width:0;font-size:12px;color:var(--ink3);text-align:right;">'+(parts.length?parts.join(' · '):'')+'</div>';
}
// Driver ride-detail footer: secondary actions grouped in a dropdown
function _rideActionsMenu(rId, canAssign, canNote){
  var id=String(rId).replace(/'/g,'');
  var docIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg>';
  var carIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg>';
  var items='<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');generateMissionPdf(\''+id+'\')">'+docIc+t('app2.telecharger_l_ordre_de_mission')+'</button>';
  if(canAssign) items+='<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');openMissionAssignment(\''+id+'\')">'+carIc+t('app.modifier_vehicule_chauffeur')+'</button>';
  var chatIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-5A8 8 0 1121 12z"/></svg>';
  if(canNote) items+='<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');_driverNoteFromMenu(\''+id+'\')">'+chatIc+t('app.envoyer_une_note_au_client')+'</button>';
  return _ftMenu(items);
}
// Chauffeur : actions sur une demande où il a déjà fait une offre (modifier / retirer)
function _offerActionsMenu(rId, safeRd){
  var id=String(rId).replace(/'/g,'');
  var close="this.closest('.ft-menu').classList.remove('open');";
  var tagIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
  var xIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--red);"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  return _ftMenu(
    '<button class="ft-menu-item" onclick="'+close+'_editOffer(this)" data-rid="'+id+'" data-ride=\''+(safeRd||'')+'\'>'+tagIc+t('app.modifier_mon_offre')+'</button>'
   +'<button class="ft-menu-item" style="color:var(--red);" onclick="'+close+'_withdrawOffer(\''+id+'\')">'+xIc+t('app.retirer_mon_offre')+'</button>');
}
// Fenêtre de confirmation au design Bleenr (remplace confirm() du navigateur). Renvoie une promesse true/false.
window._uiConfirm=function(o){
  o=o||{};
  return new Promise(function(resolve){
    var m=document.getElementById('m-uiconfirm'); if(!m){ resolve(window.confirm(String(o.title||''))); return; }
    var e=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
    var ic=document.getElementById('uic-ic');
    ic.className='ns-ic'+(o.danger?'':' ok');
    ic.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(o.icon||'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>')+'</svg>';
    document.getElementById('uic-title').textContent=o.title||'Confirmer ?';
    document.getElementById('uic-sub').innerHTML=o.sub||'';
    var rb=document.getElementById('uic-ride'), r=o.ride;
    if(r){
      var route=r.trip_type==='disposal'?e((r.from_address||'').split(',')[0])+' · mise à disposition':e((r.from_address||'—').split(',')[0])+' → '+e((r.to_address||'—').split(',')[0]);
      var dt=r.ride_date?new Date(r.ride_date+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'})+(r.ride_time?' · '+String(r.ride_time).slice(0,5):''):'';
      rb.innerHTML=(r.booking_code?'<div class="ns-code">'+e(r.booking_code)+'</div>':'')+'<b>'+route+'</b>'+(dt?'<div>'+e(dt)+'</div>':'');
      rb.style.display='';
    } else rb.style.display='none';
    var okB=document.getElementById('uic-ok'), noB=document.getElementById('uic-cancel');
    okB.textContent=o.confirm||'Confirmer'; okB.className='btn ns-confirm'+(o.danger?'':' ok');
    noB.textContent=o.cancel||'Annuler';
    var done=function(v){ okB.onclick=noB.onclick=m.onclick=null; document.removeEventListener('keydown',key); m.classList.remove('open'); resolve(v); };
    var key=function(ev){ if(ev.key==='Escape') done(false); };
    okB.onclick=function(){ done(true); };
    noB.onclick=function(){ done(false); };
    m.onclick=function(ev){ if(ev.target===m) done(false); };
    document.addEventListener('keydown',key);
    m.classList.add('open');
  });
};
window._withdrawOffer=async function(rideId){
  if(!sb||!currentUser) return;
  var of=(await sb.from('offers').select('id,price').eq('ride_id',rideId).eq('driver_id',currentUser.id).eq('status','pending').maybeSingle()).data;
  if(!of){ showToast(t('app.offre_introuvable_ou_deja_acceptee')); return; }
  var _rr=(window._lastDetailRide&&window._lastDetailRide.id===rideId)?window._lastDetailRide:null;
  var ok=await _uiConfirm({
    title:'Retirer votre offre ?',
    sub:t('app.votre_offre_de')+' <b>'+parseFloat(of.price).toFixed(2).replace('.',',')+' € HTVA</b> '+t('app.sera_supprimee_le_client_ne'),
    ride:_rr, confirm:'Retirer l’offre', danger:true,
    icon:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><circle cx="7" cy="7" r="1.5"/>'
  });
  if(!ok) return;
  var r=await sb.rpc('driver_withdraw_offer',{ p_offer: of.id });
  if(r.error){ showToast(t('app.retrait_impossible')+r.error.message); return; }
  else if(r.data===false){ showToast(t('app.cette_offre_ne_peut_plus')); return; }
  delete _myOffers[rideId];
  closeModal('m-ride-detail');
  showToast(t('app.offre_retiree'));
  if(typeof loadMarketplace==='function') loadMarketplace();
  if(typeof loadDriverDashboard==='function') loadDriverDashboard();
};
window._driverNoteFromMenu=async function(rideId){
  if(!sb) return;
  var rd=(await sb.from('rides').select('notes').eq('id',rideId).maybeSingle()).data;
  var cur=((rd&&rd.notes||'').match(/\|offer_note:([^|]*)/)||[])[1]||'';
  openDriverNoteEdit(rideId, cur.trim());
};
function _ftMenu(items){
  return '<div class="ft-menu"><button type="button" class="ft-menu-btn" title="'+t('app.actions')+'" aria-label="'+t('app.actions')+'" onclick="event.stopPropagation();this.parentElement.classList.toggle(\'open\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button><div class="ft-menu-list">'+items+'</div></div>';
}
// Client : actions de la demande regroupées dans le menu « ⋮ » (modifier / annuler + actions propres au statut)
function _clientRideMenu(rId, canEdit, canCancel, extra){
  var id=String(rId).replace(/'/g,'');
  var close="this.closest('.ft-menu').classList.remove('open');";
  var editIc='<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var trashIc='<svg width="15" height="15" viewBox="0 0 16 16" fill="none" style="color:var(--red);"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  var items=extra||'';
  if(canEdit) items+='<button class="ft-menu-item" onclick="'+close+'editRide(\''+id+'\')">'+editIc+t('app.modifier_ma_demande')+'</button>';
  if(canCancel) items+='<button class="ft-menu-item" style="color:var(--red);" onclick="'+close+'deleteRide(\''+id+'\')">'+trashIc+t('app.annuler_ma_demande')+'</button>';
  return items?_ftMenu(items):'';
}
document.addEventListener('click',function(e){ if(!e.target.closest('.ft-menu')) document.querySelectorAll('.ft-menu.open').forEach(function(m){m.classList.remove('open');}); });
// « En chemin » : au plus tôt 4 h avant le départ, et jamais pendant une modification de prix en attente
// « En chemin » bloqué (4 h avant, supplément à payer, modification à traiter) : core/status.ts
function _onWayLock(r){ return BleenrCore.onWayLock(r); }
function _missionStepBtn(r){
  var id=String(r.id).replace(/'/g,'');
  var b=function(step,label){ return '<button class="btn btn-green ms-btn" style="margin-left:8px;" onclick="missionStep(\''+id+'\',\''+step+'\',this)">'+label+'</button>'; };
  if(!r.on_way_at){
    var lk=_onWayLock(r);
    if(lk) return '<button class="btn ms-btn" disabled style="margin-left:8px;background:#E4E8E3;color:var(--ink3);cursor:not-allowed;" title="'+_rdEsc(lk)+'">'+_rdEsc(lk)+'</button>';
    return b('on_way','En chemin');
  }
  if(!r.pickup_at) return '<button class="btn ms-btn" style="margin-left:8px;background:#fff;color:#B3261E;border:1.5px solid #F5C2BC;" onclick="missionNoShow(\''+id+'\',this)">'+t('app.no_show')+'</button>'+b('pickup','Pick up terminé');
  return b('done','Mission terminée');
}
window.missionStep=async function(rideId, step, btn){
  if(!sb||!currentUser) return;
  if(btn){ btn.disabled=true; btn.textContent='…'; }
  var now=new Date().toISOString();
  var upd = step==='on_way' ? { on_way_at:now }
          : step==='pickup' ? { pickup_at:now, status:'active' }
          : { completed_at:now, status:'done' };
  try{
    var {data:r,error}=await sb.rpc('api_mission_step',{ p_ride:rideId, p_step:step });
    if(error) throw error;
    if(!r) throw new Error('Mise à jour refusée');
    if(step==='on_way'){
      // Client is told the driver is on the way (vehicle / driver details included)
      var veh=null, drv=null;
      try{
        var {data:of}=await sb.from('offers').select('*').eq('ride_id',rideId).eq('status','accepted').maybeSingle();
        if(of&&of.vehicle_id) veh=(await sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',of.vehicle_id).maybeSingle()).data;
        if(of&&of.fleet_driver_id) drv=(await sb.from('fleet_drivers').select('first_name,last_name,phone').eq('id',of.fleet_driver_id).maybeSingle()).data;
      }catch(_e){}
      var mail=window._mailRideData(r,{
        vehicle: veh?(((veh.brand||'')+' '+(veh.model||'')+' '+(veh.color||'')).trim()+(veh.plate?' ('+veh.plate+')':'')):'',
        driver: drv?((drv.first_name||'')+' '+(drv.last_name||'')).trim():'',
        driverPhone: drv&&drv.phone?drv.phone:''
      });
      delete mail.price;
      // Email « chauffeur en route » : envoyé par la base (ride_driver_emails.sql), aussi depuis l'app iOS
      showToast(t('app.statut_en_chemin_envoye_au'));
    } else if(step==='pickup'){
      showToast(t('app.pick_up_enregistre'));
    } else {
      showToast(t('app.mission_terminee'));
    }
    closeModal('m-ride-detail');
    if(typeof loadDriverDashboard==='function') loadDriverDashboard();
    if(typeof loadMissions==='function') loadMissions();
  }catch(e){
    showToast(t('app.erreur_2')+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent='Réessayer'; }
  }
};

// No Show : le client n'est pas au rendez-vous → mission terminée + marquée « No Show » + e-mail au client
var _nsRideId=null;
window.missionNoShow=function(rideId, btn){
  if(!sb||!currentUser) return;
  _nsRideId=rideId;
  var r=(window._lastDetailRide&&String(window._lastDetailRide.id)===String(rideId))?window._lastDetailRide:null;
  if(!r){ try{ var card=btn&&btn.closest('[data-ride]'); if(card) r=JSON.parse(card.dataset.ride.replace(/&#39;/g,"'")); }catch(e){} }
  var el=document.getElementById('ns-ride');
  if(el){
    if(r){
      var e=function(x){ return String(x||'').replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
      el.innerHTML='<div class="ns-code">'+e(r.booking_code||'')+'</div>'
        +'<b>'+e(cleanAddr(r.from_address||''))+'</b>'
        +'<div style="margin-top:3px;">'+t('app.prise_en_charge_prevue_a')+' '+e(String(r.ride_time||'').slice(0,5))+(r.on_way_at?' · en chemin depuis '+_hhmm(r.on_way_at):'')+'</div>';
      el.style.display='';
    } else el.style.display='none';
  }
  var cb=document.getElementById('ns-confirm-btn'); if(cb){ cb.disabled=false; cb.textContent='Confirmer'; }
  openModal('m-noshow');
};
window._confirmNoShow=async function(btn){
  var rideId=_nsRideId; if(!rideId||!sb||!currentUser) return;
  var lbl='Confirmer';
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement…'; }
  var now=new Date().toISOString();
  try{
    var {data:_ns,error}=await sb.rpc('api_mission_no_show',{ p_ride:rideId });
    var rows=_ns?[_ns]:[];
    if(error){
      if(/no_show_at/.test(error.message||'')) throw new Error('la colonne « no_show_at » manque dans Supabase (exécuter supabase/rides_no_show.sql)');
      throw error;
    }
    if(!rows||!rows.length) throw new Error('Mise à jour refusée');
    var r=rows[0];
    var mail=window._mailRideData(r,{ noShowTime:_hhmm(now) });
    delete mail.price;
    // E-mail et notification « absence du client » : envoyés par le serveur
    showToast(t('app.no_show_enregistre_le_client'));
    closeModal('m-noshow');
    closeModal('m-ride-detail');
    if(typeof loadDriverDashboard==='function') loadDriverDashboard();
    if(typeof loadMissions==='function') loadMissions();
  }catch(e){
    showToast(t('app.erreur_2')+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent=lbl; }
  }
};
// E-mail « No Show » ; si le modèle n'existe pas encore dans la fonction send-mail, on envoie le texte via le modèle « note du chauffeur »
function _sendNoShowMail(clientId, data){
  var post=function(type, d){ return fetch('https://tuzfoqdxmxzjjhvlxsgb.supabase.co/functions/v1/send-mail',{
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+(window._sbToken||SB_KEY),'apikey':SB_KEY},
    body:JSON.stringify({ type:type, to_user_ids:[clientId], data:d }) }); };
  if(localStorage.getItem(DEMO_MODE_KEY)==='1'||!clientId) return;
  post('ride_no_show', data).then(function(resp){
    if(resp.ok) return;
    var note='Votre chauffeur s\u2019est présenté au lieu de rendez-vous'+(data.from?' ('+data.from+')':'')+(data.time?' pour la prise en charge de '+data.time:'')
      +', mais vous n\u2019étiez pas présent. La course a été clôturée (No Show).';
    return post('driver_note', Object.assign({}, data, { note:note, noteAction:'created' }));
  }).catch(function(e){ console.warn('_sendNoShowMail', e); });
}

window.completeRide=async function(rideId){
  if(!sb)return;
  try{
    var {data:_ok,error}=await sb.rpc('api_ride_complete',{ p_ride:rideId });
    if(error)throw error;
    if(!_ok)throw new Error('Clôture refusée');
    closeModal('m-ride-detail');
    showToast(t('app2.course_terminee'));
    if(typeof loadDriverDashboard==='function')await loadDriverDashboard();
    if(typeof loadMissions==='function')await loadMissions();
  }catch(e){showToast(t('app.erreur_3')+(e.message||e));}
};

