// ── Version « plein écran » : historique du navigateur + lien direct #course/CODE ──
var _rdHist=false, _rdClosing=false;
function _rdCode(id){ var r=id==='m-ar-detail'?window._lastArRide:window._lastDetailRide; return r?(r.booking_code||String(r.id||'')):''; }
function _rdOpened(id){
  document.body.classList.add('rd-open');
  var isDetail=(id==='m-ride-detail'||id==='m-ar-detail');
  var code=isDetail?_rdCode(id):'', url=location.pathname+location.search+(code?'#course/'+encodeURIComponent(code):(isDetail?'':location.hash));
  try{ if(_rdHist) history.replaceState({rd:id},'',url); else { history.pushState({rd:id},'',url); _rdHist=true; } }catch(e){}
}
function _rdHideAll(){ document.querySelectorAll('.modal-overlay.rd-panel.open').forEach(function(m){ m.classList.remove('open','rd-under'); }); _rdStack=[]; document.body.classList.remove('rd-open','rd-nav'); }
// Une demande est ouverte et on clique sur une autre demande de la liste : on ferme l'écran ouvert
// (et ceux empilés dessous) puis la nouvelle s'ouvre normalement.
document.addEventListener('click', function(e){
  var t=e.target; if(!t||!t.closest) return;
  var el=t.closest('[data-ride], .ride-card, [onclick*="Detail("]');
  if(!el || el.closest('.modal-overlay')) return;
  if(!document.querySelector('.modal-overlay.rd-panel.open')) return;
  _rdHideAll();
}, true);
// Pile des écrans précédents (ex. fiche → offres → paiement) : « retour » revient d'un cran
var _rdStack=[], _rdSkipPop=0;
window._rdPushUnder=function(prevId){
  var p=document.getElementById(prevId);
  if(!p || !p.classList.contains('open') || p.classList.contains('rd-under')) return;
  p.classList.add('rd-under'); _rdStack.push(prevId); document.body.classList.add('rd-nav');
  try{ history.pushState({rd:'nav'},'',location.href); }catch(e){}
};
function _rdPopTo(curId){
  var cur=curId&&document.getElementById(curId); if(cur) cur.classList.remove('open');
  var prev=document.getElementById(_rdStack.pop()||'');
  if(prev){ prev.classList.remove('rd-under'); prev.classList.add('open'); }
  if(!_rdStack.length) document.body.classList.remove('rd-nav');
}
window._rdBack=function(id){
  if(!_rdStack.length){ closeModal(id); return; }
  _rdPopTo(id); _rdSkipPop++;
  try{ history.back(); }catch(e){ _rdSkipPop--; }
};
window.addEventListener('popstate', function(){
  if(_rdSkipPop>0){ _rdSkipPop--; return; }
  if(_rdStack.length){ var top=document.querySelector('.modal-overlay.rd-panel.open:not(.rd-under)'); _rdPopTo(top?top.id:null); return; }
  if(_rdHist){ _rdHist=false; _rdHideAll(); }
});
document.addEventListener('keydown', function(e){
  if(e.key!=='Escape' || document.querySelector('.modal-overlay.open:not(.rd-panel)')) return;
  var top=document.querySelector('.modal-overlay.rd-panel.open:not(.rd-under)'); if(top) _rdBack(top.id);
});
// Ouverture d'une course depuis un lien …#course/CODE (après connexion)
async function _rdDeepLink(){
  var m=(location.hash||'').match(/^#course\/([^&]+)$/); if(!m||!sb||!currentUser) return;
  var code=decodeURIComponent(m[1]);
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  try{
    var q=sb.from('rides').select('*'); q=/^[0-9a-f-]{36}$/i.test(code)?q.eq('id',code):q.eq('booking_code',code);
    var r=(await q.maybeSingle()).data; if(!r) return;
    var fake=document.createElement('div'); fake.dataset.ride=JSON.stringify(r).replace(/'/g,"&#39;");
    if(currentRole==='admin') await _withAdmin(function(){ arOpenDetail(fake); }); else openRideDetail(fake);
  }catch(e){ console.warn('[deep link]', e); }
}
// Footers rebuilt while a modal is open (e.g. after rating) get tagged too
(function(){ try{ new MutationObserver(function(muts){ muts.forEach(function(mu){ var t=mu.target; if(t&&t.closest&&t.closest('.modal-ft')) _tagModalClose(t.closest('.modal-overlay')); }); }).observe(document.body,{childList:true,subtree:true}); }catch(e){} })();
// Vehicle guide: re-parented to the end of <body> so it can never sit
// behind the modal that opened it, whatever the DOM order or stacking context.
window.openVehGuide = function(){
  // Built in JS and appended straight to <body> with inline styles.
  // Nothing here depends on the app's CSS, so no ancestor stacking context
  // (e.g. the backdrop-filter on .modal-overlay) can push it behind.
  var old = document.getElementById('vg-pop');
  if(old){ old.remove(); return; }

  var GUIDE = [
    ['Economy', 'Tout type de v\u00e9hicule de 3 \u00e0 7 places'],
    ['Business', 'Mercedes Classe E ou \u00e9quivalent'],
    ['Luxe',     'Mercedes Classe S ou \u00e9quivalent'],
    ['Van',      'Mercedes Classe V'],
    ['Bus',      'V\u00e9hicule de type bus, minibus, autocar\u2026']
  ];

  var ov = document.createElement('div');
  ov.id = 'vg-pop';
  ov.setAttribute('style',
    'position:fixed;top:0;left:0;right:0;bottom:0;'+
    'z-index:2147483647;'+
    'background:rgba(14,14,12,.5);'+
    'display:flex;align-items:center;justify-content:center;padding:20px;'+
    'font-family:\'DM Sans\',sans-serif;'
  );

  var rows = GUIDE.map(function(r, k){
    return '<div style="display:flex;gap:14px;padding:12px 0;'+
           (k < GUIDE.length-1 ? 'border-bottom:1px solid #EFEDE8;' : '')+'">'+
             '<div style="flex:0 0 86px;font-size:13px;font-weight:600;color:#1A1A18;">'+r[0]+'</div>'+
             '<div style="font-size:12.5px;color:#6B6B68;line-height:1.5;">'+r[1]+'</div>'+
           '</div>';
  }).join('');

  ov.innerHTML =
    '<div style="background:#fff;border-radius:14px;max-width:420px;width:100%;'+
         'box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;'+
           'padding:18px 22px;border-bottom:1px solid #EFEDE8;">'+
        '<div style="font-size:15px;font-weight:700;color:#1A1A18;">'+t('app2.gammes_de_vehicules')+'</div>'+
        '<button type="button" id="vg-x" aria-label="'+t('app.fermer')+'" style="background:#F2F2F0;border:none;'+
          'width:26px;height:26px;border-radius:50%;cursor:pointer;color:#6B6B68;'+
          'font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;">&times;</button>'+
      '</div>'+
      '<div style="padding:6px 22px 16px;">'+rows+'</div>'+
      '<div style="padding:12px 22px 18px;display:flex;justify-content:flex-start;">'+
        '<button type="button" id="vg-ok" style="background:#1B5E3B;color:#fff;border:none;'+
          'padding:9px 22px;border-radius:6px;cursor:pointer;font-size:13.5px;font-weight:500;'+
          'font-family:\'DM Sans\',sans-serif;">'+t('app.compris')+'</button>'+
      '</div>'+
    '</div>';

  function close(){ ov.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e){ if(e.key === 'Escape') close(); }

  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
  ov.querySelector('#vg-x').addEventListener('click', close);
  ov.querySelector('#vg-ok').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
};
window.closeModal = id => {
  var _cm=document.getElementById(id), _extra=0;
  if(_cm && _cm.classList.contains('rd-panel') && !_cm.classList.contains('rd-under') && _rdStack.length){
    _extra=_rdStack.length;
    _rdStack.splice(0).forEach(function(x){ var e=document.getElementById(x); if(e) e.classList.remove('open','rd-under'); });
    document.body.classList.remove('rd-nav');
  }
  if(_cm) _cm.classList.remove('open','rd-under');
  if(_cm && _cm.classList.contains('rd-panel') && !document.querySelector('.modal-overlay.rd-panel.open')){
    document.body.classList.remove('rd-open');
    if(_rdHist){ _rdHist=false; try{ history.go(-(1+_extra)); }catch(e){} }
  }
  // Clear fleet modal errors on close
  if(id==='m-fleet-doc'){var e=document.getElementById('fd-err');if(e)e.classList.remove('show');}
  if(id==='m-vehicle'){var e=document.getElementById('veh-err');if(e)e.classList.remove('show');}
  if(id==='m-driver'){var e=document.getElementById('drv-err');if(e)e.classList.remove('show');}
};
document.querySelectorAll('.modal-overlay').forEach(el =>
  el.addEventListener('click', e => { if(e.target===el) window.closeModal(el.id); })
);


window.submitOffer = async function(){
  var price = parseFloat(document.getElementById('offer-price').value);
  var msg   = (document.getElementById('offer-msg').value||'').trim();
  var err   = document.getElementById('offer-err');
  var btn   = document.getElementById('btn-offer-submit');

  if(!price || price <= 0){ showError(err, t('err_required')); return; }

  // Km inclus required for disposal ride / disposal segments
  var _kmRes = _readOfferKm();
  if(!_kmRes.ok){ showError(err, t('app.veuillez_indiquer_le_nombre_de')); return; }
  var includedKm = _kmRes.km;

  // Vehicle selection required for fleet
  var vehSel=document.getElementById('offer-vehicle-select');
  var selectedVehicleId=null;
  if(isDriverRole()){
    selectedVehicleId=vehSel?vehSel.value:'';
    if(!selectedVehicleId){showError(err,t('app2.veuillez_selectionner_un_vehicule'));return;}
  }

  if(localStorage.getItem(DEMO_MODE_KEY) === '1'){
    _myOffers[currentRideId] = {price: price, msg: msg, km: includedKm};
    closeModal('m-submit-offer');
    showToast(t('app.offre_soumise'));
    if(typeof loadDriverDashboard === 'function') loadDriverDashboard();
    return;
  }

  if(!sb){ showError(err, t('app.supabase_non_configure')); return; }
  if(!currentUser){ showError(err, t('app.non_connecte')); return; }
  if(!currentRideId){ showError(err, t('app.course_introuvable')); return; }

  setLoading(btn, true, t('app.envoi'));
  err.classList.remove('show');

  try {
    // Offre créée ou modifiée par le serveur (fleet validée, demande ouverte, véhicule de la flotte)
    var offerResult = await sb.rpc('api_offer_submit', { p_ride: currentRideId, p_price: price, p_message: msg || null,
                                                         p_vehicle: selectedVehicleId || null, p_km: includedKm || null });
    if(offerResult.error) throw offerResult.error;

    // Notify the client that a new offer arrived (only on first submission)
    // Email « offre reçue » : envoyé par la base à la création de l'offre (ride_driver_emails.sql)

    var _wasOutd = !!(_myOffers[currentRideId] && _myOffers[currentRideId].outdated);
    _myOffers[currentRideId] = { price: price, msg: msg, km: includedKm };
    setLoading(btn, false, t('app.soumettre'));
    if(_wasOutd){ closeModal('m-submit-offer'); showToast(t('app.offre_mise_a_jour')); if(typeof loadDriverDashboard === 'function') loadDriverDashboard(); var _mk=document.getElementById('page-marketplace'); if(_mk && _mk.classList.contains('active') && typeof loadMarketplace === 'function') loadMarketplace(); return; }
    closeModal('m-submit-offer');
    showToast(t('app.offre_soumise_avec_succes'));
    if(typeof loadDriverDashboard === 'function') loadDriverDashboard();
    var mkPage = document.getElementById('page-marketplace');
    if(mkPage && mkPage.classList.contains('active') && typeof loadMarketplace === 'function') loadMarketplace();

  } catch(e){
    console.error('submitOffer error:', e);
    showError(err, _stripeErr(e) || e.message || 'Erreur lors de la soumission');
    setLoading(btn, false, t('app.soumettre'));
  }
};;;


var _offerTimerID = null;
var _offerAnimID  = null;
var _offerCounting = false;
var _OFFER_DELAY   = 5000;

window._offerBtnClick = function(){
  if(_offerCounting){
    // Cancel
    clearTimeout(_offerTimerID); _offerTimerID = null;
    cancelAnimationFrame(_offerAnimID); _offerAnimID = null;
    _offerCounting = false;
    var btn = document.getElementById('btn-offer-submit');
    var bar = document.getElementById('offer-progress-bar');
    if(btn){ btn.textContent = 'Soumettre →'; btn.className = 'btn btn-green'; btn.style.width='100%'; }
    if(bar){ bar.style.width = '0%'; }
    showToast(t('app.soumission_annulee'));
  } else {
    // Validate first
    var price = parseFloat(document.getElementById('offer-price').value);
    var err   = document.getElementById('offer-err');
    if(!price || price <= 0){ showError(err, t('err_required')); return; }
    if(!_readOfferKm().ok){ showError(err, t('app.veuillez_indiquer_le_nombre_de')); return; }
    // Start countdown
    _offerCounting = true;
    var btn = document.getElementById('btn-offer-submit');
    var bar = document.getElementById('offer-progress-bar');
    if(btn){ btn.textContent = 'Annuler'; btn.className = 'btn btn-offer-cancel'; btn.style.width='100%'; }
    if(bar){ bar.style.width = '0%'; }
    var t0 = Date.now();
    function step(){
      var pct = Math.min(100, ((Date.now()-t0) / _OFFER_DELAY) * 100);
      if(bar) bar.style.width = pct + '%';
      if(pct < 100){
        _offerAnimID = requestAnimationFrame(step);
      }
    }
    _offerAnimID = requestAnimationFrame(step);
    _offerTimerID = setTimeout(function(){
      _offerTimerID = null;
      cancelAnimationFrame(_offerAnimID); _offerAnimID = null;
      _offerCounting = false;
      var b2 = document.getElementById('btn-offer-submit');
      var br = document.getElementById('offer-progress-bar');
      if(b2){ b2.textContent = 'Soumettre →'; b2.className = 'btn btn-green'; }
      if(br){ br.style.width = '0%'; }
      submitOffer();
    }, _OFFER_DELAY);
  }
};

function resetOfferBtn(){
  if(_offerTimerID){ clearTimeout(_offerTimerID); _offerTimerID=null; }
  if(_offerAnimID){ cancelAnimationFrame(_offerAnimID); _offerAnimID=null; }
  _offerCounting = false;
  var btn = document.getElementById('btn-offer-submit');
  var bar = document.getElementById('offer-progress-bar');
  var existingOffer = _myOffers && currentRideId && _myOffers[currentRideId];
  var _upd = !!(existingOffer && existingOffer.outdated);
  if(btn){ btn.textContent = _upd ? 'Mettre à jour mon offre →' : 'Soumettre →'; btn.className = _upd ? 'btn btn-red-solid' : 'btn btn-green'; btn.style.width='100%'; }
  if(bar){ bar.style.width = '0%'; }
  // Respect existing offer state: keep submit wrap hidden if offer already submitted (sauf offre à mettre à jour)
  var wrap = document.getElementById('offer-btn-wrap');
  if(wrap){ wrap.style.display = existingOffer && !_upd ? 'none' : ''; }
}



window.showLandingAuth = function(mode){
  showScreen('auth');
  // Reset all auth buttons to initial state
  ['btn-email-submit','btn-phone-submit','btn-otp'].forEach(function(id){
    var b = document.getElementById(id);
    if(b){
      b.disabled = false;
      if(id==='btn-email-submit') b.textContent = (window._loginPwdMode ? t('au.login_btn') : t('au.recevoir_un_code'));
      if(id==='btn-phone-submit') b.textContent = t('au.send_code');
      if(id==='btn-otp') b.textContent = t('au.confirm');
    }
  });
  setTimeout(function(){
    if(typeof authMode === 'function') authMode(mode||'login');
  }, 50);
};

// Auth screen (Signature) — sync side copy with mode & role
(function(){
  var reg = document.getElementById('tab-register'), drv = document.getElementById('role-driver');
  var msgs = [].slice.call(document.querySelectorAll('#screen-auth .au-msg'));
  var eye = document.getElementById('au-head-eye'), ttl = document.getElementById('au-head-t');
  if(!reg || !msgs.length) return;
  function sync(){
    var k = reg.classList.contains('active') ? (drv && drv.classList.contains('active') ? 'driver' : 'client') : 'login';
    msgs.forEach(function(m){ m.classList.toggle('on', m.getAttribute('data-au') === k); });
    var side=document.getElementById('au-side'); if(side){ side.classList.toggle('is-login', k==='login'); [].forEach.call(side.querySelectorAll('.au-side-img img'),function(i){ i.classList.toggle('on', i.getAttribute('data-au')===k); }); }
    if(k === 'login'){ eye.textContent = t('au.head_login'); ttl.innerHTML = t('au.head_login_t'); }
    else { eye.textContent = k === 'driver' ? t('au.head_reg_driver') : t('au.head_reg'); ttl.innerHTML = t('au.head_reg_t'); }
  }
  window._auSideSync = sync;
  var mo = new MutationObserver(sync);
  [reg, drv].forEach(function(el){ if(el) mo.observe(el, { attributes:true, attributeFilter:['class'] }); });
  sync();
})();

// Landing (scroll, services, classes, démo) : déplacée dans js/landing/04-landing.js


window._debugOffers = async function(){
  console.log('=== DEBUG OFFERS ===');
  console.log('currentUser:', currentUser?.id);
  console.log('currentProfile role:', currentProfile?.role);
  
  // Test 1: Can we read rides?
  const r1 = await sb.from('rides').select('id,status,client_id').limit(5);
  console.log('rides (limit 5):', r1.data, 'error:', r1.error);
  
  // Test 2: Can we read ALL offers?
  const r2 = await sb.from('offers').select('*').limit(10);
  console.log('offers (limit 10):', r2.data, 'error:', r2.error);
  
  // Test 3: Get my ride ids
  if(r1.data && r1.data.length > 0){
    const ids = r1.data.map(r => r.id);
    const r3 = await sb.from('offers').select('*').in('ride_id', ids);
    console.log('offers for my rides:', r3.data, 'error:', r3.error);
  }
  
  console.log('=== END DEBUG ===');
};

window._debugRides = async function(){
  console.log('=== DEBUG RIDES ===');
  const { data, error } = await sb.from('rides').select('id,status,client_id,from_address');
  console.log('My rides:', data);
  console.log('Error:', error);
  
  if(data && data.length > 0){
    const r = data[0];
    console.log('Testing offers for ride:', r.id);
    const o = await sb.from('offers').select('*').eq('ride_id', r.id);
    console.log('Offers:', o.data, 'Error:', o.error);
  }
};


window.openSubRideModal=function(){if(window._lugCapsLoad)_lugCapsLoad();['sub-cli-name','sub-cli-tel','sub-cli-email','sub-cli-ref'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});openModal('m-subcontract');};


async function loadNotifications(){
  if(!sb||!currentUser||localStorage.getItem(DEMO_MODE_KEY)==='1')return;
  var res=await sb.from('notifications').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(30);
  if(res.error)return;
  var notifs=res.data||[];
  var unread=notifs.filter(function(n){return !n.read;}).length;
  var badge=document.getElementById('notif-badge');
  if(badge){badge.textContent=unread;badge.style.display=unread>0?'flex':'none';}
  var list=document.getElementById('notif-list');if(!list)return;
  if(!notifs.length){list.innerHTML='<div style="padding:24px 16px;text-align:center;font-size:13px;color:var(--ink4);">Pas de notifications</div>';return;}
  list.innerHTML=notifs.map(function(n){
    var diff=(Date.now()-new Date(n.created_at))/1000;
    var ago=diff<60?'il y a quelques secondes':diff<3600?'il y a '+Math.floor(diff/60)+' min':diff<86400?'il y a '+Math.floor(diff/3600)+'h':'il y a '+Math.floor(diff/86400)+' j';
    return '<div class="notif-item'+(n.read?'':' unread')+'" data-nid="'+n.id+'"><div class="notif-title">'+_rdEsc(n.title||'')+'</div><div class="notif-body">'+_rdEsc(n.body||'')+'</div><div class="notif-time">'+ago+'</div></div>';
  }).join('');
  list.onclick=function(e){var el=e.target.closest('[data-nid]');if(el){markNotifRead(el.dataset.nid,el);}};
}
window.markNotifRead=async function(id,el){if(el)el.classList.remove('unread');if(sb)await sb.rpc('api_notif_read',{p_id:id});loadNotifications();};
window.markAllRead=async function(){if(!sb||!currentUser)return;await sb.rpc('api_notif_read',{p_id:null});loadNotifications();};
window.toggleNotifPanel=function(){var p=document.getElementById('notif-panel');if(!p)return;var open=p.classList.toggle('open');if(open)loadNotifications();};
function subscribeRealtime(){
  if(!sb||!currentUser)return;loadNotifications();
  try{sb.channel('notifs_'+currentUser.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+currentUser.id},function(pl){loadNotifications();if(window._liveRefreshSoon)window._liveRefreshSoon();var n=pl.new;if(n&&n.title)showToast('🔔 '+n.title);}).subscribe();}catch(e){}
  if(!window._notifPoll)window._notifPoll=setInterval(loadNotifications,15000);
  _subscribeLiveData();
}

