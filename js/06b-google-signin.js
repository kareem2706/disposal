// ── Connexion Google sur le site (Google Identity Services) ──
// Google affiche « Bleenr / www.bleenr.com » au lieu de l'adresse technique Supabase.
// Le bouton officiel Google est posé, invisible, sur nos boutons « Google » : le design ne change pas.
// Tout se passe dans la même fenêtre : Google renvoie le jeton à /auth/google (worker.js), qui revient
// sur la page avec #gcred=<jeton> ; _gisReturn() le lit, l'efface et ouvre la session.
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
  try{ sessionStorage.setItem('bleenr_gis_nonce', raw); }catch(e){}
  google.accounts.id.initialize({
    client_id: BLEENR_ENV.googleClientId,
    nonce: hashed,
    auto_select: false,
    ux_mode: 'redirect',
    login_uri: location.origin + '/auth/google'
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

// Le clic tombe dans le cadre Google : la page perd le focus juste avant de partir chez Google.
// On mémorise alors le rôle choisi à l'inscription (client / chauffeur), comme pour ssoAuth.
window.addEventListener('blur', function(){
  setTimeout(function(){
    var a = document.activeElement;
    if(a && a.tagName === 'IFRAME' && a.closest && a.closest('.gis-ov')) _ssoKeepRole();
  }, 0);
});

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

// Retour de Google (#gcred=<jeton>) : jeton effacé de l'adresse, puis vérifié par Supabase avec le nonce
_onReady(async function _gisReturn(){
  var m = /[#&]gcred=([\w.-]+)/.exec(location.hash);
  if(!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  var nonce = '';
  try{ nonce = sessionStorage.getItem('bleenr_gis_nonce') || ''; sessionStorage.removeItem('bleenr_gis_nonce'); }catch(e){}
  _loginInProgress = true;
  var _l = document.getElementById('app-loader'); if(_l) _l.style.display = '';
  await window._appReady;
  if(_l) _l.style.display = '';
  var res = sb ? await sb.auth.signInWithIdToken({ provider: 'google', token: m[1], nonce: nonce }) : { error: { message: 'Supabase non configuré' } };
  if(res.error){ _loginInProgress = false; _showAuthProblem(t('au.error_prefix') + res.error.message); return; }
  // Session ouverte : rechargement, même chemin qu'un retour de connexion par redirection
  location.replace(location.pathname + location.search);
});
