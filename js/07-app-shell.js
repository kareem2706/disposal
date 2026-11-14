// ── ENTER APP ─────────────────────────────────────────

async function loadMyOffers(){
  if(!sb || !currentUser) return;
  if(localStorage.getItem(DEMO_MODE_KEY) === '1') return;
  _myOffers = {}; // reset before reload
  try {
    var result = await sb.from('offers')
      .select('*')   // inclut outdated_at / outdated_reason / outdated_changes
      .eq('driver_id', currentUser.id)
      .in('status', ['pending', 'accepted']);
    if(result.error) return;
    var rows = result.data || [];
    rows.forEach(function(row){
      _myOffers[row.ride_id] = { id: row.id, status: row.status, vehicle: row.vehicle_id || null, price: row.price, msg: row.message || '', km: row.included_km || null,
        outdated: row.status==='pending' && !!row.outdated_at, reason: row.outdated_reason || '', changes: row.outdated_changes || '' };
    });
  } catch(e){ console.warn('loadMyOffers error:', e); }
}

// Thème de l'espace fleet : 'lemon' (noir + citron vert) ou 'forest' (thème d'origine).
// Pour revenir en arrière : FLEET_THEME = 'forest'. Les clients restent toujours en forest.
var FLEET_THEME = 'lemon';
// Statistiques (Admin › Statistiques) : « actif aujourd'hui sur le site », enregistré par le serveur (api_activity_ping)
var _actDay='';
function _activityPing(){
  try{
    if(!sb || !currentUser) return;
    var d=new Date().toDateString(); if(d===_actDay) return; _actDay=d;
    sb.rpc('api_activity_ping',{p_platform:'web'}).then(function(){},function(){});
  }catch(e){}
}
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') _activityPing(); });
function _applyFleetTheme(isFleet){
  var on = isFleet && FLEET_THEME === 'lemon';
  document.body.classList.toggle('th-lemon', on);
  var lg = document.querySelector('.sidebar-logo img');
  if(lg){
    if(!lg.dataset.forest) lg.dataset.forest = lg.getAttribute('src');
    lg.setAttribute('src', on ? 'logo_text_dark.png' : lg.dataset.forest);
  }
}

function enterApp(){
  console.log('[enterApp] called, _entering=',_entering);
  if(_entering)return;
  // Admin : double authentification validée avant tout accès (sinon le serveur refuse les droits admin)
  if(currentUser?.email === ADMIN_EMAIL && !_mfaOk && sb && !localStorage.getItem(DEMO_MODE_KEY)){
    if(_mfaPending) return; _mfaPending=true;
    var _ld=document.getElementById('app-loader'); if(_ld) _ld.style.display='none';
    _adminMfaGate().then(function(ok){ _mfaPending=false; if(ok){ _mfaOk=true; enterApp(); } })
      .catch(function(e){ _mfaPending=false; if(typeof showToast==='function') showToast('Double authentification indisponible : '+(e&&e.message||e)); });
    return;
  }
  _entering=true;
  if(/^#course\//.test(location.hash||'')) setTimeout(_rdDeepLink, 900);
  var _l=document.getElementById('app-loader');if(_l)_l.style.display='none';
  showScreen('app');
  const metaRole = currentUser?.user_metadata?.role;
  const role = currentProfile?.role || metaRole || 'client';
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  console.log('[enterApp] email:', currentUser?.email, 'ADMIN_EMAIL:', ADMIN_EMAIL, 'isAdmin:', isAdmin, 'role:', role);
  const isAdminDriver = isAdmin && role === 'driver';
  currentRole = isAdmin ? 'admin' : role;
  _applyFleetTheme(!isAdmin && role==='driver');
  _activityPing();
  document.getElementById('nav-client').style.display = (!isAdmin && role === 'client') ? 'block' : 'none';
  document.getElementById('nav-driver').style.display = (isAdminDriver || (!isAdmin && role === 'driver')) ? 'block' : 'none';
  var adminNav=document.getElementById('nav-admin');if(adminNav)adminNav.style.display=isAdmin?'block':'none';
  var cCta=document.getElementById('nav-cta-client');if(cCta)cCta.style.display=(!isAdmin && role==='client')?'block':'none';
  var dCta=document.getElementById('nav-cta-driver');if(dCta)dCta.style.display=(isAdminDriver || (!isAdmin && role==='driver'))?'block':'none';
  // Fixed help card in the sidebar (above Déconnexion) for clients and fleets
  var helpCard=document.getElementById('client-help-card');
  if(helpCard){
    helpCard.style.display = (!isAdmin && (role==='client' || role==='driver')) ? 'block' : 'none';
    helpCard.classList.toggle('help-drv', !isAdmin && role==='driver'); // fleets: shown in the menu on mobile only
  }

  // Update nav user pill
  const fn = currentProfile?.first_name || '';
  const ln = currentProfile?.last_name || '';
  const co = currentProfile?.company_name || '';
  var isPro = role==='client' && currentProfile?.client_type==='pro';
  // Pro clients and fleets are shown by their company name
  var navDisplayName = (isPro || role==='driver')
    ? (co || (fn+' '+ln).trim() || currentUser?.email?.split('@')[0] || '—')
    : ((fn || (fn+' '+ln).trim()) || currentUser?.email?.split('@')[0] || '—');
  document.getElementById('nav-name').textContent = navDisplayName;
  var roleLabel = isAdmin ? (isAdminDriver ? 'Admin / Fleet' : 'Admin') : (role==='client' ? (currentProfile?.client_type==='pro' ? 'Client Pro' : 'Client') : t(role));
  document.getElementById('nav-role').textContent = roleLabel;
  ['nav-acct-badge'].forEach(function(id){ var b=document.getElementById(id); if(b) b.textContent=roleLabel; });
  // Show Passagers menu only for pro clients
  var passBtnNav = document.getElementById('nav-passengers-btn');
  if(passBtnNav) passBtnNav.style.display = (!isAdmin && role==='client' && currentProfile?.client_type==='pro') ? 'flex' : 'none';
  const avEl = document.getElementById('nav-avatar');
  if(currentProfile?.avatar_url){
    avEl.innerHTML = `<img src="${currentProfile.avatar_url}" alt="">`;
  } else {
    avEl.textContent = (navDisplayName[0] || '?').toUpperCase();
  }

  // Admin goes to admin-dashboard by default
  if(isAdmin){
    showPage('admin-dashboard');
  } else if(role === 'driver' && sb && !localStorage.getItem(DEMO_MODE_KEY)){
    loadMyOffers().then(function(){
      showPage('d-dashboard');
    });
  } else {
    showPage(role === 'driver' ? 'd-dashboard' : 'dashboard');
  }

  // Subscribe to realtime notifications
  subscribeRealtime();

  // Mobile check
  var mbEl=document.getElementById('mob-btn');if(mbEl&&_vw()<=900)mbEl.style.display='flex';

  // Handle Stripe return if coming back from checkout
  if(window._stripePendingReturn){
    var _sr = window._stripePendingReturn;
    // cancel is handled by the self-contained overlay — ignore it here
    if(_sr.status === 'cancel'){ window._stripePendingReturn = null; }
    else {
    window._stripePendingReturn = null;
    setTimeout(async function(){
      if(_sr.status==='success' && _sr.ride && _sr.supp && sb){
        // Supplément payé après une modification de la mission
        try{
          var vs=await _callEdge('verify-checkout',{sessionId:_sr.session});
          if(vs && vs.refunded){ if(typeof loadClientDashboard==='function') await loadClientDashboard(); showPaymentResult('error','Paiement rembours\u00e9','Le suppl\u00e9ment ne pouvait plus \u00eatre pay\u00e9 (d\u00e9lai d\u00e9pass\u00e9 ou course modifi\u00e9e). Votre paiement a \u00e9t\u00e9 int\u00e9gralement rembours\u00e9.'); return; }
          if(!vs || !vs.confirmed) throw new Error((vs&&vs.error)||'Paiement non vérifié');
          if(typeof loadClientDashboard==='function') await loadClientDashboard();
          await _showPaymentSuccess(_sr.ride, vs.amount);
        }catch(e){ console.error('Stripe supp return error:',e); showPaymentResult('error','Erreur','Paiement re\u00e7u mais erreur de mise \u00e0 jour. Contactez le support.'); }
      } else if(_sr.status==='success' && _sr.ride && _sr.offer && sb){
        try{
          var tvac=parseFloat(localStorage.getItem('stripe_pending_tvac')||'0');
          localStorage.removeItem('stripe_pending_tvac');
          // La course est confirmée par le serveur après vérification du paiement auprès de Stripe
          var vr=await _callEdge('verify-checkout',{sessionId:_sr.session});
          if(vr && vr.refunded){
            // Course déjà payée / plus disponible : le serveur a remboursé automatiquement
            if(typeof loadClientDashboard==='function') await loadClientDashboard();
            showPaymentResult('error','Paiement rembours\u00e9','Cette course \u00e9tait d\u00e9j\u00e0 pay\u00e9e ou n\u2019est plus disponible. Votre paiement'+(vr.amount?' de '+Number(vr.amount).toFixed(2).replace('.',',')+' \u20ac':'')+' a \u00e9t\u00e9 int\u00e9gralement rembours\u00e9 (d\u00e9lai bancaire de 5 \u00e0 10 jours).');
            return;
          }
          if(!vr || !vr.confirmed) throw new Error((vr&&vr.error)||'Paiement non vérifié');
          var payDriverId=vr.driverId||null;
          if(vr.amount) tvac=vr.amount;
          await _promoteNotesToDriver(_sr.ride);
          _notifyRideConfirmed(_sr.ride, payDriverId);
          if(typeof loadClientDashboard==='function') await loadClientDashboard();
          await _showPaymentSuccess(_sr.ride, tvac);
        }catch(e){ console.error('Stripe return error:',e); showPaymentResult('error','Erreur','Paiement re\u00e7u mais erreur de mise \u00e0 jour. Contactez le support.'); }
      } else if(_sr.status==='error'){
        if(typeof loadClientDashboard==='function') await loadClientDashboard();
        _payPopup({ tone:'error', title:'Le paiement a échoué', sub:'Aucun montant n’a été débité.', msg:'Le paiement n’a pas pu être traité. Vous pouvez réessayer depuis vos demandes.' });
      }
    }, 1200);
    }
  }
}

// Payment confirmed screen (Stripe return)
async function _showPaymentSuccess(rideId, amount){
  var r=null;
  try{ if(sb&&rideId){ var q=await sb.from('rides').select('*').eq('id',rideId).maybeSingle(); r=q.data; } }catch(e){}
  var esc=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var amt=amount||(r&&r.final_price)||0;
  var row=function(l,v){ return '<div style="display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-top:1px solid #ECECEC;font-size:13px;"><span style="color:#7A867B;">'+l+'</span><span style="color:#1A2E1A;font-weight:600;text-align:right;">'+v+'</span></div>'; };
  var rows='';
  if(r){
    rows+=row('Réservation','<span style="font-family:monospace;">'+esc(r.booking_code||String(r.id).slice(0,8))+'</span>');
    if(r.ride_date) rows+=row('Date',esc(formatDate(r.ride_date))+(r.ride_time?' · '+esc(r.ride_time.slice(0,5)):''));
    rows+=row('Trajet',esc((r.from_address||'—').split(',')[0])+(r.trip_type==='disposal'?' (mise à disposition)':' → '+esc((r.to_address||'—').split(',')[0])));
  }
  if(amt) rows+=row('Montant payé',parseFloat(amt).toFixed(2).replace('.',',')+' € TVAC');
  rows=rows.replace('border-top:1px solid #ECECEC;','');
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(14,20,16,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML='<div style="background:#fff;border-radius:20px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:\'DM Sans\',sans-serif;animation:scaleIn .25s ease;">'
    +'<div style="background:linear-gradient(135deg,#1B5E3B 0%,#2E7A50 100%);padding:30px 24px 24px;text-align:center;color:#fff;">'
      +'<div style="width:62px;height:62px;border-radius:50%;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">'
        +'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>'
      +'<div style="font-size:20px;font-weight:700;letter-spacing:-.2px;">Paiement confirmé</div>'
      +'<div style="font-size:13.5px;opacity:.85;margin-top:5px;">Votre course est réservée.</div>'
    +'</div>'
    +'<div style="padding:16px 24px 6px;">'+rows+'</div>'
    +'<div style="padding:4px 24px 0;font-size:12px;color:#7A867B;line-height:1.5;">Un e-mail de confirmation vous a été envoyé avec le détail de votre réservation.</div>'
    +'<div style="padding:18px 24px 22px;display:flex;gap:10px;">'
      +'<button data-act="rides" style="flex:1;padding:12px;background:#fff;color:#1B5E3B;border:1.5px solid #CFE3D6;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Mes demandes</button>'
      +'<button data-act="close" style="flex:1;padding:12px;background:#1B5E3B;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Continuer</button>'
    +'</div></div>';
  ov.addEventListener('click',function(e){
    var b=e.target.closest('button[data-act]'); if(!b) return;
    ov.remove(); if(b.dataset.act==='rides') showPage('rides');
  });
  document.body.appendChild(ov);
}

