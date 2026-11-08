// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try{ setLang(currentLang, { noSave:true }); }catch(e){ console.warn('i18n init', e); }
  // Initialise stripe fee label from constant so it's always in sync
  var _feeEl = document.getElementById('stripe-fee-label');
  if(_feeEl){ _feeEl.textContent = 'Des frais supplémentaires peuvent s\'appliquer'; }

  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){initDemoMode();return;}

  var _safetyTimer = setTimeout(function(){
    var _ls=document.getElementById('app-loader');
    if(_ls && _ls.style.display!=='none'){
      console.warn('Safety timeout: forcing landing screen');
      _ls.style.display='none';
      _entering=false;
      showScreen('landing');
    }
  }, 5000);
  try {
    console.log('[init] starting...');
    // Bibliothèque Supabase indisponible sur le CDN principal : seconde source
    if(!window.supabase){ await new Promise(function(res){ var sc=document.createElement('script'); sc.src='https://unpkg.com/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'; sc.onload=res; sc.onerror=res; document.head.appendChild(sc); }); }
    initSupabase(SB_URL,SB_KEY);
    console.log('[init] supabase ready, checking session...');
    await checkSession();
    console.log('[init] session checked');
    clearTimeout(_safetyTimer);
  } catch(e) {
    clearTimeout(_safetyTimer);
    console.error('Init error:', e);
    _entering=false;
    var _lErr=document.getElementById('app-loader');if(_lErr)_lErr.style.display='none';
    showScreen('landing');
  }
  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    const btn = document.getElementById('notif-btn');
    if(panel&&panel.classList.contains('open')&&!panel.contains(e.target)&&btn&&!btn.contains(e.target)) panel.classList.remove('open');
  });
  document.addEventListener('click', e => {
    const sb2 = document.getElementById('sidebar');
    const btn = document.getElementById('mob-btn');
    if(sb2&&sb2.classList.contains('open')&&!sb2.contains(e.target)&&btn&&!btn.contains(e.target)) sb2.classList.remove('open');
  });
});

// Réseau : si le serveur ne répond pas après quelques secondes (coupure, maintenance…), on abandonne la requête
// et on affiche un message clair au lieu d'un bouton qui tourne indéfiniment.
var _netWarnAt = 0;
function _netWarn(k){
  var _au = document.getElementById('screen-auth'); if(_au && _au.classList.contains('active')) return;   // écran de connexion : message sous le formulaire
  var now = Date.now(); if(now - _netWarnAt < 8000) return; _netWarnAt = now;
  try{ showToast('⚠️ ' + t(k || 'net.unreachable')); }catch(e){}
}
function _sbFetch(input, init){
  init = init || {};
  var url = String((input && input.url) || input || '');
  var ms = /\/storage\/|\/functions\//.test(url) ? 60000 : 10000;   // envois de fichiers / IA : plus long
  var ctl = new AbortController(), timedOut = false;
  var tm = setTimeout(function(){ timedOut = true; ctl.abort(); }, ms);
  if(init.signal){ if(init.signal.aborted) ctl.abort(); else init.signal.addEventListener('abort', function(){ ctl.abort(); }); }
  return fetch(input, Object.assign({}, init, { signal: ctl.signal })).then(function(r){
    clearTimeout(tm);
    if(r.status >= 500){
      _netWarn();
      // page d'erreur HTML (Cloudflare 52x, maintenance…) : jamais affichée telle quelle
      var ct = (r.headers.get('content-type') || '').toLowerCase();
      if(ct.indexOf('json') < 0){
        var m = t('net.unreachable');
        return new Response(JSON.stringify({ code:r.status, error:'server_unavailable', error_code:'server_unavailable', error_description:m, msg:m, message:m }), { status:r.status, headers:{ 'Content-Type':'application/json' } });
      }
    }
    return r;
  }, function(e){
    clearTimeout(tm);
    if(!timedOut && init.signal && init.signal.aborted) throw e;   // annulation voulue : pas de message
    _netWarn(timedOut ? 'net.timeout' : 'net.unreachable');
    var er = new Error(t(timedOut ? 'net.timeout' : 'net.unreachable')); er.name = 'NetworkError'; throw er;
  });
}
// Le serveur répond-il ? (avant d'envoyer l'utilisateur vers une page du serveur : Google, Microsoft…)
async function _sbReachable(){
  try{
    var ctl = new AbortController(), tm = setTimeout(function(){ ctl.abort(); }, 6000);
    var r = await fetch((window._sbUrl || SB_URL) + '/auth/v1/health', { headers:{ apikey:(window._sbKey || SB_KEY) }, signal:ctl.signal });
    clearTimeout(tm);
    return r.status < 500;
  }catch(e){ return false; }
}
function initSupabase(u,k){
  if(sb)return;
  window._sbUrl = u || SB_URL; window._sbKey = k || SB_KEY;
  sb=window.supabase.createClient(u||SB_URL,k||SB_KEY,{auth:{storageKey:'disposal-auth',autoRefreshToken:true,persistSession:true,detectSessionInUrl:true},global:{fetch:_sbFetch}});
  // Jeton de session courant : utilisé pour appeler les Edge Functions au nom de l'utilisateur
  try{
    sb.auth.getSession().then(function(r){ window._sbToken = r&&r.data&&r.data.session ? r.data.session.access_token : null; });
    sb.auth.onAuthStateChange(function(_e, sess){ window._sbToken = sess ? sess.access_token : null; });
  }catch(e){}
}

let _authListenerRegistered = false;
let _passwordRecoveryActive = false;
let _initialCheckDone = false;
let _loginInProgress = false;
// Erreur renvoyée par Google / Microsoft / Supabase au retour d'une connexion (?error=… ou #error=…)
function _readOAuthError(){
  try{
    var q=new URLSearchParams(location.search), h=new URLSearchParams(location.hash.replace(/^#/,''));
    var code=q.get('error')||h.get('error'); if(!code) return null;
    return { code:code, sub:q.get('error_code')||h.get('error_code')||'', desc:(q.get('error_description')||h.get('error_description')||code).replace(/\+/g,' ') };
  }catch(e){ return null; }
}
function _showAuthProblem(msg){
  console.warn('[auth] '+msg);
  var _l=document.getElementById('app-loader'); if(_l) _l.style.display='none';
  showScreen('auth');
  var am=document.getElementById('auth-main'); if(am) am.style.display='block';
  var sso=document.getElementById('auth-sso'); if(sso) sso.style.display='none';
  var el=document.getElementById('auth-err-email'); if(el) showError(el, msg);
}
async function checkSession(){
  var _oauthErr=_readOAuthError();
  if(!sb)initSupabase();
  if(!_authListenerRegistered){
    _authListenerRegistered = true;
    sb.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth event]', event, 'initialDone:', _initialCheckDone, 'loginInProgress:', _loginInProgress);
      if(event==='PASSWORD_RECOVERY'&&session){
        _entering=false;
        _passwordRecoveryActive=true;
        currentUser=session.user;
        var _l3=document.getElementById('app-loader');if(_l3)_l3.style.display='none';
        showScreen('auth');
        document.getElementById('auth-main').style.display='none';
        document.getElementById('auth-new-pwd').style.display='block';
        return;
      }
      // Skip during initial check or active login — those flows call enterApp themselves
      if(!_initialCheckDone || _loginInProgress) return;
      if((event==='SIGNED_IN'||event==='TOKEN_REFRESHED')&&session&&!_entering&&!_passwordRecoveryActive){
        currentUser=session.user; await loadProfile(); enterApp();
      }
      if(event==='SIGNED_OUT'){if(window._closeAllOverlays)_closeAllOverlays();currentUser=null;currentProfile=null;currentRole='client';_entering=false;_passwordRecoveryActive=false;showScreen('landing');}
    });
  }
  // Lien reçu par e-mail (mot de passe oublié, changement d'adresse, invitation) : ?th=<jeton>&tt=<type>
  try{
    var _q=new URLSearchParams(location.search), _th=_q.get('th'), _tt=_q.get('tt');
    if(_th && /^(recovery|email_change|invite|signup|magiclink|email)$/.test(_tt||'')){
      history.replaceState(null,'',location.pathname+location.hash);
      if(_tt==='recovery') _passwordRecoveryActive=true;
      var _vr=await sb.auth.verifyOtp({ token_hash:_th, type:_tt });
      if(_vr.error){
        _passwordRecoveryActive=false;
        var _ve=String(_vr.error.code||_vr.error.error_code||'');
        _showAuthProblem(_ve==='server_unavailable'||_vr.error.name==='NetworkError'||_vr.error.status>=500 ? t('net.unreachable') : t('au.err_link_expired'));
        _initialCheckDone=true; return;
      }
      if(_tt==='recovery' && _vr.data && _vr.data.session){
        currentUser=_vr.data.session.user; _initialCheckDone=true;
        var _l4=document.getElementById('app-loader'); if(_l4) _l4.style.display='none';
        showScreen('auth');
        document.getElementById('auth-main').style.display='none';
        document.getElementById('auth-new-pwd').style.display='block';
        return;
      }
    }
  }catch(e){ console.warn('lien e-mail', e); }
  try {
    console.log('[checkSession] getting session...');
    const { data: { session } } = await sb.auth.getSession();
    console.log('[checkSession] got session:', !!session);
    _initialCheckDone = true;
    if(_passwordRecoveryActive) return;
    if(_oauthErr) history.replaceState(null,'',location.pathname);
    if(session){
      currentUser = session.user;
      await loadProfile();
      enterApp();
    } else if(_oauthErr){
      _showAuthProblem('Connexion impossible : '+_oauthErr.desc+(_oauthErr.sub?' ('+_oauthErr.sub+')':''));
    } else {
      var _l2=document.getElementById('app-loader');if(_l2)_l2.style.display='none';
      showScreen('landing');
    }
  } catch(e) {
    console.error('checkSession error:', e);
    _initialCheckDone = true;
    _entering=false;
    if(_oauthErr || currentUser){ _showAuthProblem('Connexion impossible : '+((_oauthErr&&_oauthErr.desc)||e.message||e)); return; }
    var _l2=document.getElementById('app-loader');if(_l2)_l2.style.display='none';
    showScreen('landing');
  }
}

// Role chosen before an OAuth sign-up (valid 30 min)
// Read only: loadProfile can run twice during a login, the value is cleared once applied
function _takePendingRole(){
  try{
    var p = JSON.parse(localStorage.getItem('bleenr_pending_role')||'null');
    if(p && p.role && (Date.now()-(p.ts||0)) < 30*60*1000) return p;
    localStorage.removeItem('bleenr_pending_role');
  }catch(e){}
  return null;
}
function _clearPendingRole(){ try{ localStorage.removeItem('bleenr_pending_role'); }catch(e){} }

// Persists the sign-up role and checks it really landed in the database.
// RPC apply_signup_role (security definer) bypasses RLS rules that block a user from changing his own role.
async function _applySignupRole(role, clientType, company){
  var ct = role==='driver' ? null : (clientType==='pro' ? 'pro' : 'perso');
  try{
    var r = await sb.rpc('apply_signup_role', { p_role: role, p_client_type: ct, p_company: company||null });
    if(!r.error && r.data === role) return true;
    if(r.error) console.warn('[signup role] rpc', r.error.message);
  }catch(e){ console.warn('[signup role] rpc', e); }
  return false;
}

async function loadProfile(){
  if(!sb || !currentUser) return;
  const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if(data) {
    currentProfile = data;
    try{ _i18nSyncProfile(); }catch(e){ console.warn('lang profile', e); }
    var updates = {};
    if(currentUser.email && data.email !== currentUser.email){ updates.email = currentUser.email; currentProfile.email = currentUser.email; }
    if(currentUser.phone && data.phone !== currentUser.phone){ updates.phone = currentUser.phone; currentProfile.phone = currentUser.phone; }
    var meta2 = currentUser.user_metadata || {};
    if(!data.role && meta2.role){ updates.role = meta2.role; currentProfile.role = meta2.role; }
    // ── Sign-up choice (client perso / client pro / fleet), applied once ──
    // Covers a profile pre-created with defaults (DB trigger) for email, Google or Microsoft sign-ups.
    var _pend = _takePendingRole();
    var _intent = meta2.role ? { role: meta2.role, client_type: meta2.client_type, company_name: meta2.company_name }
                             : (_pend ? { role: _pend.role, client_type: _pend.client_type, company_name: _pend.company_name } : null);
    var _ageMs = data.created_at ? (Date.now() - new Date(data.created_at).getTime()) : 0;
    if(currentUser.email !== ADMIN_EMAIL && !meta2.signup_synced && _ageMs < 7*24*3600*1000){
      if(_intent && (_intent.role === 'client' || _intent.role === 'driver')){
        var _ct = _intent.role === 'driver' ? null : (_intent.client_type === 'pro' ? 'pro' : 'perso');
        var _okRole = (currentProfile.role === _intent.role && currentProfile.client_type === _ct)
          || await _applySignupRole(_intent.role, _ct, data.company_name ? null : _intent.company_name);
        currentProfile.role = _intent.role; currentProfile.client_type = _ct;
        if(!data.company_name && _intent.company_name) currentProfile.company_name = _intent.company_name;
        // Mark as synced only once the database holds the right role (otherwise retried at next login)
        try{ sb.auth.updateUser({ data: _okRole ? { role: _intent.role, client_type: _ct, signup_synced: true } : { role: _intent.role, client_type: _ct } }); }catch(e){}
        // OAuth sign-up on a pre-created profile: welcome email not sent yet
        if(!meta2.role && _pend && _ageMs < 30*60*1000 && currentUser.email){
          window.sendMail(_intent.role==='driver' ? 'welcome_driver' : 'welcome_client', currentUser.email, {
            name: currentProfile.first_name || '', isPro: _ct==='pro' ? 'yes' : 'no'
          });
        }
        _clearPendingRole();
      }
    }
    // Admin account is never a client (an admin acting as fleet keeps role "driver")
    if(currentUser.email === ADMIN_EMAIL && (!currentProfile.role || currentProfile.role === 'client')){
      updates.role = 'admin'; updates.client_type = null;
      currentProfile.role = 'admin'; currentProfile.client_type = null;
    }
    if(!data.client_type && meta2.client_type){ updates.client_type = meta2.client_type; currentProfile.client_type = meta2.client_type; }
    if(!data.first_name && meta2.first_name){ updates.first_name = meta2.first_name; currentProfile.first_name = meta2.first_name; }
    if(!data.last_name && meta2.last_name){ updates.last_name = meta2.last_name; currentProfile.last_name = meta2.last_name; }
    if(!data.company_name && meta2.company_name){ updates.company_name = meta2.company_name; currentProfile.company_name = meta2.company_name; }
    // Synchronisation (e-mail, téléphone, nom…) faite par le serveur à partir du compte
    if(Object.keys(updates).length > 0){
      try{sb.rpc('api_profile_sync').then(function(){},function(){});}catch(ex){}
    }
  } else {
    // Profile doesn't exist — create it (e.g. Google OAuth first login)
    var meta = currentUser.user_metadata || {};
    var _isAdminAcc = currentUser.email === ADMIN_EMAIL;
    var _pendNew = _takePendingRole();
    if(!meta.role && _pendNew){
      meta = Object.assign({}, meta, { role: _pendNew.role, client_type: _pendNew.client_type, company_name: meta.company_name || _pendNew.company_name });
    }
    if(!_isAdminAcc && meta.role){
      // Keep the choice in the account metadata (so a later login can still repair the profile)
      try{ sb.auth.updateUser({ data: { role: meta.role, client_type: meta.role==='driver' ? null : (meta.client_type||'perso') } }); }catch(e){}
    }
    var metaRole2 = _isAdminAcc ? 'admin' : (meta.role || 'client');
    var newProfile = {
      id: currentUser.id,
      email: currentUser.email || null,
      first_name: meta.first_name || (meta.full_name ? meta.full_name.split(' ')[0] : (meta.name||'').split(' ')[0]) || null,
      last_name: meta.last_name || (meta.full_name ? meta.full_name.split(' ').slice(1).join(' ') : (meta.name||'').split(' ').slice(1).join(' ')) || null,
      role: metaRole2,
      client_type: metaRole2==='client' ? (meta.client_type==='pro' ? 'pro' : 'perso') : null,
      company_name: meta.company_name || null,
      avatar_url: meta.avatar_url || meta.picture || null,
    };
    try {
      var {data:created} = await sb.rpc('api_profile_sync');
      currentProfile = created || newProfile;
      // Insert refused (profile pre-created by a trigger) or stored with another role → force the chosen one
      if(!_isAdminAcc && meta.role){
        var _okNew = (created && created.role === metaRole2) || await _applySignupRole(metaRole2, newProfile.client_type, newProfile.company_name);
        currentProfile.role = metaRole2; currentProfile.client_type = newProfile.client_type;
        if(_okNew){
          _clearPendingRole();
          try{ sb.auth.updateUser({ data: { role: metaRole2, client_type: newProfile.client_type, signup_synced: true } }); }catch(e){}
        }
      }
      // First OAuth login = account creation → welcome email
      if(created && created.email && !_isAdminAcc){
        window.sendMail(metaRole2==='driver' ? 'welcome_driver' : 'welcome_client', created.email, {
          name: created.first_name || '',
          isPro: created.client_type==='pro' ? 'yes' : 'no'
        });
      }
    } catch(ex) {
      currentProfile = newProfile;
    }
  }
}

