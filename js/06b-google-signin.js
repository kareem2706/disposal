// ── Connexion Google sur le site (Google Identity Services) ──
// Google affiche « Bleenr / www.bleenr.com » au lieu de l'adresse technique Supabase.
// Le bouton officiel Google est posé, invisible, sur nos boutons « Google » : le design ne change pas.
// Google renvoie un jeton d'identité signé ; c'est Supabase (serveur) qui le vérifie et ouvre la session.
// Si le script Google ne charge pas (bloqueur, réseau, app Capacitor), nos boutons gardent l'ancienne
// connexion par redirection (ssoAuth('google')).
var _gis = { loading: null, ready: false, nonce: '' };

function _gisEnabled(){
  try{
    if(!BLEENR_ENV.googleClientId || window.Capacitor) return false;
    if(localStorage.getItem(DEMO_MODE_KEY) === '1') return false;
  }catch(e){ return false; }
  return true;
}

function _gisLoad(){
  if(_gis.loading) return _gis.loading;
  _gis.loading = new Promise(function(ok, ko){
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = ok; s.onerror = ko;
    document.head.appendChild(s);
  });
  return _gis.loading;
}

// Nonce : Google reçoit son empreinte SHA-256, Supabase la valeur brute (protection contre le rejeu)
async function _gisInit(){
  var raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), function(b){ return b.toString(16).padStart(2, '0'); }).join('');
  var dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  var hashed = Array.from(new Uint8Array(dig), function(b){ return b.toString(16).padStart(2, '0'); }).join('');
  _gis.nonce = raw;
  google.accounts.id.initialize({
    client_id: BLEENR_ENV.googleClientId,
    callback: _gisCallback,
    nonce: hashed,
    auto_select: false,
    cancel_on_tap_outside: true,
    ux_mode: 'popup'
  });
}

function _gisRender(btn){
  var w = btn.offsetWidth, h = btn.offsetHeight;
  var ov = btn.querySelector('.gis-ov');
  if(!w || !h){ return; }
  if(ov && ov._w === w && ov._h === h) return;
  if(!ov){ ov = document.createElement('div'); ov.className = 'gis-ov'; btn.appendChild(ov); }
  ov._w = w; ov._h = h; ov.innerHTML = '';
  var rw = Math.max(200, Math.min(400, Math.round(w)));
  var inner = document.createElement('div');
  inner.style.transformOrigin = '0 0';
  inner.style.transform = 'scale(' + (w / rw) + ',' + (h / 44) + ')';
  ov.appendChild(inner);
  google.accounts.id.renderButton(inner, { type: 'standard', size: 'large', width: rw, text: 'continue_with', shape: 'rectangular' });
}

window._gisMount = async function(){
  if(!_gisEnabled()) return;
  try{
    await _gisLoad();
    if(!_gis.ready){ await _gisInit(); _gis.ready = true; }
  }catch(e){ console.warn('[google] script indisponible, connexion par redirection'); return; }
  document.querySelectorAll('button.sso-row[onclick*="ssoAuth(\'google\')"]').forEach(function(btn){
    if(!btn._gisObs){
      btn.classList.add('gis-host');
      btn._gisObs = new ResizeObserver(function(){ _gisRender(btn); });
      btn._gisObs.observe(btn);
    }
    _gisRender(btn);
  });
};

async function _gisCallback(resp){
  var nonce = _gis.nonce;
  if(!sb){ showToast('Supabase non configuré'); return; }
  _ssoKeepRole();
  document.getElementById('auth-main').style.display = 'none';
  document.getElementById('auth-sso').style.display = 'block';
  document.getElementById('sso-msg').textContent = t('au.redirect_to', { provider: 'Google' });
  _loginInProgress = true;
  var res = await sb.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce: nonce });
  if(res.error){
    _loginInProgress = false;
    try{ await _gisInit(); }catch(e){}
    document.getElementById('auth-main').style.display = 'block';
    document.getElementById('auth-sso').style.display = 'none';
    showToast(t('au.error_prefix') + res.error.message);
    return;
  }
  // Session enregistrée : on recharge comme au retour d'une connexion par redirection
  // (même chemin : rôle choisi à l'inscription, profil, entrée dans l'application)
  location.replace(location.pathname + location.search);
}
