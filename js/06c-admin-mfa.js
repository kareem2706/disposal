// ── Double authentification (code à 6 chiffres d'une application d'authentification, TOTP) ──
//  • Admin : obligatoire (activation imposée à la 1re connexion).
//  • Clients et fleets : facultative, activée dans Profil › Compte.
//  • Compte avec double authentification : le code est demandé à chaque connexion, AVANT tout chargement.
// Le serveur refuse tout accès tant que le code n'est pas validé (jeton « aal2 », voir supabase/user_mfa.sql et admin_mfa.sql).
var _mfaOk=false, _mfaPending=false, _mfaGateP=null;

function _mfaEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
// Textes (français par défaut, anglais / espagnol selon la langue du site)
var _MFA_T={
  en:{'Activer la double authentification':'Turn on two-step verification','Code de sécurité':'Security code','Chargement…':'Loading…','Valider':'Confirm','Se déconnecter':'Sign out','Annuler':'Cancel',
    'Le compte administrateur exige un code à 6 chiffres en plus du mot de passe ou du code e-mail.':'The administrator account requires a 6-digit code in addition to the password or e-mail code.',
    'À chaque connexion, un code à 6 chiffres vous sera demandé en plus du mot de passe ou du code e-mail.':'At every sign-in, you will be asked for a 6-digit code in addition to your password or e-mail code.',
    'Ouvrez une application d’authentification :':'Open an authenticator app:',
    'iPhone / Mac : l’app « Mots de passe » est déjà installée.':'iPhone / Mac: the built-in “Passwords” app works.',
    'Android / Windows : installez Google Authenticator ou Microsoft Authenticator (gratuit).':'Android / Windows: install Google Authenticator or Microsoft Authenticator (free).',
    'Touchez « Ouvrir dans l’app d’authentification ». Si rien ne s’ouvre : « Copier la clé », puis dans l’app « Ajouter » › « Saisir une clé de configuration » et collez-la.':'Tap “Open in authenticator app”. If nothing opens: “Copy key”, then in the app “Add” › “Enter a setup key” and paste it.',
    'Scannez ce QR code avec votre téléphone :':'Scan this QR code with your phone:','Clé de configuration :':'Setup key:','Ouvrir dans l’app d’authentification':'Open in authenticator app','Copier la clé':'Copy key','Clé copiée ✓':'Key copied ✓',
    'Revenez ici et entrez le code affiché par l’application :':'Come back here and enter the code shown by the app:',
    'Si cette page se recharge, une nouvelle clé est créée : supprimez alors l’ancienne entrée « Bleenr » dans l’app et recommencez.':'If this page reloads, a new key is created: delete the old “Bleenr” entry in the app and start again.',
    'Entrez le code à 6 chiffres affiché par votre application d’authentification.':'Enter the 6-digit code shown by your authenticator app.',
    'Entrez les 6 chiffres.':'Enter the 6 digits.','Vérification…':'Checking…','Code incorrect ou expiré.':'Wrong or expired code.','Trop d’essais, patientez une minute.':'Too many attempts, wait a minute.','Activation impossible : ':'Cannot turn on: ',
    'Double authentification':'Two-step verification','Configuration (une seule fois). Ensuite, le code sera demandé à chaque connexion.':'One-time setup. After that, the code will be asked at every sign-in.','Activée':'On','Désactivée':'Off','Activer':'Turn on','Désactiver':'Turn off',
    'Protégez votre compte : en plus du mot de passe ou du code e-mail, un code à 6 chiffres de votre téléphone sera demandé à chaque connexion.':'Protect your account: besides your password or e-mail code, a 6-digit code from your phone is asked at every sign-in.',
    'Un code à 6 chiffres de votre application d’authentification est demandé à chaque connexion.':'A 6-digit code from your authenticator app is asked at every sign-in.',
    'Obligatoire pour le compte administrateur.':'Required for the administrator account.',
    'Désactiver la double authentification ? Votre compte ne sera plus protégé que par le mot de passe ou le code e-mail.':'Turn off two-step verification? Your account will only be protected by your password or e-mail code.',
    'Double authentification activée ✓':'Two-step verification turned on ✓','Double authentification désactivée':'Two-step verification turned off'},
  es:{'Activer la double authentification':'Activar la verificación en dos pasos','Code de sécurité':'Código de seguridad','Chargement…':'Cargando…','Valider':'Confirmar','Se déconnecter':'Cerrar sesión','Annuler':'Cancelar',
    'À chaque connexion, un code à 6 chiffres vous sera demandé en plus du mot de passe ou du code e-mail.':'En cada inicio de sesión se le pedirá un código de 6 cifras además de la contraseña o del código por e-mail.',
    'Ouvrez une application d’authentification :':'Abra una aplicación de autenticación:',
    'iPhone / Mac : l’app « Mots de passe » est déjà installée.':'iPhone / Mac: la app «Contraseñas» ya está instalada.',
    'Android / Windows : installez Google Authenticator ou Microsoft Authenticator (gratuit).':'Android / Windows: instale Google Authenticator o Microsoft Authenticator (gratis).',
    'Touchez « Ouvrir dans l’app d’authentification ». Si rien ne s’ouvre : « Copier la clé », puis dans l’app « Ajouter » › « Saisir une clé de configuration » et collez-la.':'Pulse «Abrir en la app de autenticación». Si no se abre nada: «Copiar la clave» y, en la app, «Añadir» › «Introducir una clave» y péguela.',
    'Scannez ce QR code avec votre téléphone :':'Escanee este código QR con su teléfono:','Clé de configuration :':'Clave de configuración:','Ouvrir dans l’app d’authentification':'Abrir en la app de autenticación','Copier la clé':'Copiar la clave','Clé copiée ✓':'Clave copiada ✓',
    'Revenez ici et entrez le code affiché par l’application :':'Vuelva aquí e introduzca el código que muestra la app:',
    'Si cette page se recharge, une nouvelle clé est créée : supprimez alors l’ancienne entrée « Bleenr » dans l’app et recommencez.':'Si esta página se recarga, se crea una nueva clave: borre la entrada «Bleenr» anterior en la app y vuelva a empezar.',
    'Entrez le code à 6 chiffres affiché par votre application d’authentification.':'Introduzca el código de 6 cifras de su aplicación de autenticación.',
    'Entrez les 6 chiffres.':'Introduzca las 6 cifras.','Vérification…':'Comprobando…','Code incorrect ou expiré.':'Código incorrecto o caducado.','Trop d’essais, patientez une minute.':'Demasiados intentos, espere un minuto.','Activation impossible : ':'No se puede activar: ',
    'Double authentification':'Verificación en dos pasos','Configuration (une seule fois). Ensuite, le code sera demandé à chaque connexion.':'Configuración (una sola vez). Después, el código se pedirá en cada inicio de sesión.','Activée':'Activada','Désactivée':'Desactivada','Activer':'Activar','Désactiver':'Desactivar',
    'Protégez votre compte : en plus du mot de passe ou du code e-mail, un code à 6 chiffres de votre téléphone sera demandé à chaque connexion.':'Proteja su cuenta: además de la contraseña o del código por e-mail, se pedirá un código de 6 cifras de su teléfono en cada inicio de sesión.',
    'Un code à 6 chiffres de votre application d’authentification est demandé à chaque connexion.':'Se pide un código de 6 cifras de su aplicación de autenticación en cada inicio de sesión.',
    'Désactiver la double authentification ? Votre compte ne sera plus protégé que par le mot de passe ou le code e-mail.':'¿Desactivar la verificación en dos pasos? Su cuenta solo quedará protegida por la contraseña o el código por e-mail.',
    'Double authentification activée ✓':'Verificación en dos pasos activada ✓','Double authentification désactivée':'Verificación en dos pasos desactivada'}
};
function _mt(s){ var l=(typeof currentLang!=='undefined'&&currentLang)||'fr'; return (_MFA_T[l]&&_MFA_T[l][s])||s; }
function _mfaIsAdmin(){ return !!(currentUser && typeof ADMIN_EMAIL!=='undefined' && String(currentUser.email||'').toLowerCase()===ADMIN_EMAIL); }

// Portail de connexion : appelé avant le chargement du profil et avant l'entrée dans l'app.
// Se résout quand la connexion est suffisante ; ne se résout jamais si l'utilisateur se déconnecte depuis l'écran du code.
function _mfaGate(){
  if(_mfaOk || !sb || !currentUser) return Promise.resolve(true);
  try{ if(localStorage.getItem(DEMO_MODE_KEY)) return Promise.resolve(true); }catch(e){}
  if(_mfaGateP) return _mfaGateP;
  _mfaGateP=(async function(){
    var a=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    var cur=a.data&&a.data.currentLevel, next=a.data&&a.data.nextLevel;
    if(cur==='aal2') return true;
    var ld=document.getElementById('app-loader'); if(ld) ld.style.display='none';
    if(next==='aal2'){
      var f=await sb.auth.mfa.listFactors();
      var ok=((f.data&&f.data.all)||[]).filter(function(x){ return x.factor_type==='totp' && x.status==='verified'; });
      if(ok.length) return new Promise(function(res){ _mfaShow('challenge', ok[0], res); });
    }
    if(_mfaIsAdmin()){ await _mfaCleanup(); return new Promise(function(res){ _mfaShow('enroll', null, res); }); }
    return true;
  })().then(function(ok){ _mfaGateP=null; if(ok) _mfaOk=true; return ok; }, function(e){ _mfaGateP=null; throw e; });
  return _mfaGateP;
}
// Ancien nom (utilisé par enterApp)
function _adminMfaGate(){ return _mfaGate(); }

// Activations interrompues (facteurs non vérifiés) : supprimées
async function _mfaCleanup(){
  var f=await sb.auth.mfa.listFactors(); var all=(f.data&&f.data.all)||[];
  for(var i=0;i<all.length;i++){ if(all[i].status!=='verified') await sb.auth.mfa.unenroll({ factorId: all[i].id }).catch(function(){}); }
}

function _mfaClose(){ var o=document.getElementById('mfa-ov'); if(o) o.remove(); }

// mode 'challenge' | 'enroll' ; opt.cancel : bouton « Annuler » (activation depuis le profil) au lieu de « Se déconnecter »
async function _mfaShow(mode, factor, done, opt){
  opt=opt||{};
  _mfaClose();
  var o=document.createElement('div'); o.id='mfa-ov';
  o.style.cssText='position:fixed;inset:0;z-index:100000;background:'+(opt.cancel?'rgba(14,20,16,.72)':'#0E1410')+';display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;font-family:"DM Sans",sans-serif;';
  o.innerHTML='<div style="background:#fff;border-radius:20px;max-width:420px;width:100%;padding:28px 24px;box-shadow:0 20px 60px rgba(0,0,0,.35);margin:auto;">'
    +'<div style="width:44px;height:44px;border-radius:12px;background:#0E1410;color:#D6F27A;display:flex;align-items:center;justify-content:center;margin-bottom:14px;">'
    +'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/></svg></div>'
    +'<h2 style="font:600 20px \'DM Sans\',sans-serif;margin:0 0 6px;color:#0E1410;">'+_mt(mode==='enroll'?'Activer la double authentification':'Code de sécurité')+'</h2>'
    +'<div id="mfa-body" style="font-size:14px;color:#5A6560;line-height:1.5;">'+_mt('Chargement…')+'</div>'
    +'<div id="mfa-err" style="display:none;margin-top:10px;font-size:13px;color:#C0392B;"></div>'
    +'<input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" '
    +'style="display:none;width:100%;box-sizing:border-box;margin-top:14px;font:600 26px \'DM Sans\',sans-serif;letter-spacing:.35em;text-align:center;padding:12px;border:1.5px solid #E6E4DD;border-radius:12px;outline:none;">'
    +'<button id="mfa-go" style="display:none;width:100%;margin-top:12px;padding:14px;border:none;border-radius:999px;background:#D6F27A;color:#0E1410;font:600 15px \'DM Sans\',sans-serif;cursor:pointer;">'+_mt('Valider')+'</button>'
    +'<button id="mfa-out" style="width:100%;margin-top:10px;padding:10px;border:none;background:none;color:#5A6560;font:500 13px \'DM Sans\',sans-serif;cursor:pointer;">'+_mt(opt.cancel?'Annuler':'Se déconnecter')+'</button>'
    +'</div>';
  document.body.appendChild(o);
  var body=o.querySelector('#mfa-body'), inp=o.querySelector('#mfa-code'), go=o.querySelector('#mfa-go'), err=o.querySelector('#mfa-err');
  function fail(m){ err.textContent=m; err.style.display='block'; }
  var factorId=factor && factor.id;
  o.querySelector('#mfa-out').onclick=function(){
    _mfaClose();
    if(opt.cancel){ if(mode==='enroll' && factorId) sb.auth.mfa.unenroll({ factorId:factorId }).catch(function(){}); done(false); return; }
    _mfaPending=false; _mfaGateP=null; if(typeof signOut==='function') signOut();
  };
  inp.addEventListener('input',function(){ inp.value=inp.value.replace(/\D/g,'').slice(0,6); if(inp.value.length===6) go.click(); });

  if(mode==='enroll'){
    var e=await sb.auth.mfa.enroll({ factorType:'totp', friendlyName:'Bleenr '+new Date().toISOString().slice(0,16) });
    if(e.error){ body.textContent=''; fail(_mt('Activation impossible : ')+(e.error.message||e.error)); return; }
    factorId=e.data.id;
    var secret=(e.data.totp && e.data.totp.secret)||'', qr=(e.data.totp && e.data.totp.qr_code)||'';
    var uri=(e.data.totp && e.data.totp.uri)||'';
    var mob=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    var bt='display:block;width:100%;box-sizing:border-box;text-align:center;margin-top:8px;padding:12px;border-radius:999px;font:600 14px \'DM Sans\',sans-serif;text-decoration:none;cursor:pointer;';
    var openBtn=uri?'<a href="'+_mfaEsc(uri)+'" style="'+bt+'background:#0E1410;color:#D6F27A;border:none;">'+_mt('Ouvrir dans l’app d’authentification')+'</a>':'';
    var copyBtn='<button type="button" id="mfa-copy" style="'+bt+'background:#fff;color:#0E1410;border:1.5px solid #E6E4DD;">'+_mt('Copier la clé')+'</button>';
    body.innerHTML=_mt(_mfaIsAdmin()?'Le compte administrateur exige un code à 6 chiffres en plus du mot de passe ou du code e-mail.':'À chaque connexion, un code à 6 chiffres vous sera demandé en plus du mot de passe ou du code e-mail.')
      +'<div style="margin-top:8px;font-weight:600;color:#0E1410;">'+_mt('Configuration (une seule fois). Ensuite, le code sera demandé à chaque connexion.')+'</div>'
      +'<ol style="margin:12px 0 0;padding-left:18px;">'
      +'<li>'+_mt('Ouvrez une application d’authentification :')+'<div style="font-size:12.5px;margin-top:2px;">• '+_mt('iPhone / Mac : l’app « Mots de passe » est déjà installée.')+'<br>• '+_mt('Android / Windows : installez Google Authenticator ou Microsoft Authenticator (gratuit).')+'</div></li>'
      +(mob
        ? '<li>'+_mt('Touchez « Ouvrir dans l’app d’authentification ». Si rien ne s’ouvre : « Copier la clé », puis dans l’app « Ajouter » › « Saisir une clé de configuration » et collez-la.')+'</li></ol>'+openBtn+copyBtn
        : '<li>'+_mt('Scannez ce QR code avec votre téléphone :')+'</li></ol>'
          +(qr?'<div style="display:flex;justify-content:center;margin:12px 0;"><img src="'+_mfaEsc(qr)+'" alt="QR code" style="width:190px;height:190px;border:1px solid #ECEAE4;border-radius:12px;padding:6px;background:#fff;"></div>':''))
      +'<div style="font-size:12.5px;margin-top:10px;">'+_mt('Clé de configuration :')+' <code style="font-size:12.5px;word-break:break-all;background:#F1F0EB;padding:2px 6px;border-radius:6px;user-select:all;">'+_mfaEsc(secret)+'</code></div>'
      +(mob?'':copyBtn)
      +'<div style="margin-top:10px;">3. '+_mt('Revenez ici et entrez le code affiché par l’application :')+'</div>'
      +'<div style="font-size:12px;color:#9AA29D;margin-top:4px;">'+_mt('Si cette page se recharge, une nouvelle clé est créée : supprimez alors l’ancienne entrée « Bleenr » dans l’app et recommencez.')+'</div>';
    var cp=o.querySelector('#mfa-copy');
    if(cp) cp.onclick=function(){
      var ok2=function(){ cp.textContent=_mt('Clé copiée ✓'); setTimeout(function(){ cp.textContent=_mt('Copier la clé'); },2500); };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(secret).then(ok2,function(){ prompt(_mt('Clé de configuration :'),secret); });
      else prompt(_mt('Clé de configuration :'),secret);
    };
  } else {
    body.textContent=_mt('Entrez le code à 6 chiffres affiché par votre application d’authentification.');
  }
  inp.style.display='block'; go.style.display='block'; setTimeout(function(){ inp.focus(); },50);
  go.onclick=async function(){
    var code=inp.value.trim();
    if(!/^\d{6}$/.test(code)){ fail(_mt('Entrez les 6 chiffres.')); return; }
    err.style.display='none'; go.disabled=true; go.textContent=_mt('Vérification…');
    var v=await sb.auth.mfa.challengeAndVerify({ factorId:factorId, code:code });
    go.disabled=false; go.textContent=_mt('Valider');
    if(v.error){
      // Le code a pu être accepté malgré une erreur de réseau : on vérifie avant d'afficher l'erreur
      var a2=await sb.auth.mfa.getAuthenticatorAssuranceLevel().catch(function(){ return {}; });
      if(a2 && a2.data && a2.data.currentLevel==='aal2'){ _mfaClose(); done(true); return; }
      inp.value=''; inp.focus(); fail(_mt(/rate|too many/i.test(v.error.message||'')?'Trop d’essais, patientez une minute.':'Code incorrect ou expiré.')); return;
    }
    _mfaClose(); done(true);
  };
}

// ── Profil › Compte : activer / désactiver (clients et fleets ; admin : toujours activée) ──
async function _pfMfaRender(){
  var el=document.getElementById('pf-mfa'); if(!el||!sb||!currentUser) return;
  var f=await sb.auth.mfa.listFactors().catch(function(){ return {}; });
  var on=((f.data&&f.data.all)||[]).filter(function(x){ return x.factor_type==='totp' && x.status==='verified'; });
  var adm=_mfaIsAdmin();
  var pill=on.length?'<span style="font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:99px;background:var(--ok-bg,#E3F1E8);color:var(--ok,#1B5E3B);">'+_mt('Activée')+'</span>'
                    :'<span style="font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:99px;background:var(--sand);color:var(--ink3);">'+_mt('Désactivée')+'</span>';
  el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
    +'<div style="display:flex;align-items:center;gap:8px;"><span style="font-weight:600;font-size:13.5px;">'+_mt('Double authentification')+'</span>'+pill+'</div>'
    +(adm?'':on.length?'<button class="btn btn-secondary btn-sm" onclick="_pfMfaOff()">'+_mt('Désactiver')+'</button>'
                       :'<button class="btn btn-green btn-sm" onclick="_pfMfaOn()">'+_mt('Activer')+'</button>')
    +'</div><div style="font-size:12px;color:var(--ink3);margin-top:6px;line-height:1.5;">'
    +_mt(adm?'Obligatoire pour le compte administrateur.':on.length?'Un code à 6 chiffres de votre application d’authentification est demandé à chaque connexion.':'Protégez votre compte : en plus du mot de passe ou du code e-mail, un code à 6 chiffres de votre téléphone sera demandé à chaque connexion.')
    +'</div>';
}
window._pfMfaOn=async function(){
  await _mfaCleanup();
  var ok=await new Promise(function(res){ _mfaShow('enroll', null, res, { cancel:true }); });
  if(ok){ _mfaOk=true; if(typeof showToast==='function') showToast(_mt('Double authentification activée ✓')); }
  _pfMfaRender();
};
window._pfMfaOff=async function(){
  if(_mfaIsAdmin()) return;
  if(!confirm(_mt('Désactiver la double authentification ? Votre compte ne sera plus protégé que par le mot de passe ou le code e-mail.'))) return;
  var f=await sb.auth.mfa.listFactors(); var all=(f.data&&f.data.all)||[];
  for(var i=0;i<all.length;i++){ var r=await sb.auth.mfa.unenroll({ factorId: all[i].id }); if(r.error){ if(typeof showToast==='function') showToast(r.error.message); break; } }
  try{ await sb.auth.refreshSession(); }catch(e){}
  if(typeof showToast==='function') showToast(_mt('Double authentification désactivée'));
  _pfMfaRender();
};
