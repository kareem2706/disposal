// ── Admin : double authentification obligatoire (code à 6 chiffres d'une application d'authentification) ──
// Le serveur n'accorde les droits admin qu'avec une session validée par ce code (jeton « aal2 », voir supabase/admin_mfa.sql).
// Ici : 1re fois → activation (QR code à scanner) ; ensuite → code demandé à chaque connexion.
var _mfaOk=false, _mfaPending=false;

function _mfaEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

async function _adminMfaGate(){
  var a=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(a.data && a.data.currentLevel==='aal2') return true;
  var f=await sb.auth.mfa.listFactors();
  if(f.error) throw f.error;
  var all=(f.data && f.data.all)||[];
  var ok=all.filter(function(x){ return x.factor_type==='totp' && x.status==='verified'; });
  if(ok.length) return new Promise(function(res){ _mfaShow('challenge', ok[0], res); });
  // Activation interrompue auparavant : on repart de zéro
  for(var i=0;i<all.length;i++){ if(all[i].status!=='verified') await sb.auth.mfa.unenroll({ factorId: all[i].id }).catch(function(){}); }
  return new Promise(function(res){ _mfaShow('enroll', null, res); });
}

function _mfaClose(){ var o=document.getElementById('mfa-ov'); if(o) o.remove(); }

async function _mfaShow(mode, factor, done){
  _mfaClose();
  var o=document.createElement('div'); o.id='mfa-ov';
  o.style.cssText='position:fixed;inset:0;z-index:100000;background:#0E1410;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;font-family:"DM Sans",sans-serif;';
  o.innerHTML='<div style="background:#fff;border-radius:20px;max-width:420px;width:100%;padding:28px 24px;box-shadow:0 20px 60px rgba(0,0,0,.35);">'
    +'<div style="width:44px;height:44px;border-radius:12px;background:#0E1410;color:#D6F27A;display:flex;align-items:center;justify-content:center;margin-bottom:14px;">'
    +'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/></svg></div>'
    +'<h2 style="font:600 20px \'DM Sans\',sans-serif;margin:0 0 6px;color:#0E1410;">'+(mode==='enroll'?'Activer la double authentification':'Code de sécurité')+'</h2>'
    +'<div id="mfa-body" style="font-size:14px;color:#5A6560;line-height:1.5;">Chargement…</div>'
    +'<div id="mfa-err" style="display:none;margin-top:10px;font-size:13px;color:#C0392B;"></div>'
    +'<input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" '
    +'style="display:none;width:100%;box-sizing:border-box;margin-top:14px;font:600 26px \'DM Sans\',sans-serif;letter-spacing:.35em;text-align:center;padding:12px;border:1.5px solid #E6E4DD;border-radius:12px;outline:none;">'
    +'<button id="mfa-go" style="display:none;width:100%;margin-top:12px;padding:14px;border:none;border-radius:999px;background:#D6F27A;color:#0E1410;font:600 15px \'DM Sans\',sans-serif;cursor:pointer;">Valider</button>'
    +'<button id="mfa-out" style="width:100%;margin-top:10px;padding:10px;border:none;background:none;color:#5A6560;font:500 13px \'DM Sans\',sans-serif;cursor:pointer;">Se déconnecter</button>'
    +'</div>';
  document.body.appendChild(o);
  var body=o.querySelector('#mfa-body'), inp=o.querySelector('#mfa-code'), go=o.querySelector('#mfa-go'), err=o.querySelector('#mfa-err');
  function fail(m){ err.textContent=m; err.style.display='block'; }
  o.querySelector('#mfa-out').onclick=function(){ _mfaClose(); _mfaPending=false; if(typeof signOut==='function') signOut(); };
  inp.addEventListener('input',function(){ inp.value=inp.value.replace(/\D/g,'').slice(0,6); if(inp.value.length===6) go.click(); });

  var factorId=factor && factor.id;
  if(mode==='enroll'){
    var e=await sb.auth.mfa.enroll({ factorType:'totp', friendlyName:'Bleenr admin '+new Date().toISOString().slice(0,16) });
    if(e.error){ body.textContent=''; fail('Activation impossible : '+(e.error.message||e.error)); return; }
    factorId=e.data.id;
    var secret=(e.data.totp && e.data.totp.secret)||'', qr=(e.data.totp && e.data.totp.qr_code)||'';
    var uri=(e.data.totp && e.data.totp.uri)||'';
    var mob=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    var bt='display:block;width:100%;box-sizing:border-box;text-align:center;margin-top:8px;padding:12px;border-radius:999px;font:600 14px \'DM Sans\',sans-serif;text-decoration:none;cursor:pointer;';
    var phoneBtns=(uri?'<a href="'+_mfaEsc(uri)+'" style="'+bt+'background:#0E1410;color:#D6F27A;border:none;">Ouvrir dans l’app d’authentification</a>':'')
      +'<button type="button" id="mfa-copy" style="'+bt+'background:#fff;color:#0E1410;border:1.5px solid #E6E4DD;">Copier la clé</button>';
    body.innerHTML='Le compte administrateur exige un code à 6 chiffres en plus du mot de passe ou du code e-mail.'
      +'<ol style="margin:12px 0 0;padding-left:18px;">'
      +'<li>Ouvrez une application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>'
      +(mob
        ? '<li>Touchez « Ouvrir dans l’app d’authentification ». Si rien ne s’ouvre : « Copier la clé », puis dans l’app « Ajouter » › « Saisir une clé de configuration » et collez-la.</li></ol>'+phoneBtns
        : '<li>Scannez ce QR code avec votre téléphone :</li></ol>'
          +(qr?'<div style="display:flex;justify-content:center;margin:12px 0;"><img src="'+_mfaEsc(qr)+'" alt="QR code" style="width:190px;height:190px;border:1px solid #ECEAE4;border-radius:12px;padding:6px;background:#fff;"></div>':''))
      +'<div style="font-size:12.5px;margin-top:10px;">Clé de configuration : <code style="font-size:12.5px;word-break:break-all;background:#F1F0EB;padding:2px 6px;border-radius:6px;user-select:all;">'+_mfaEsc(secret)+'</code></div>'
      +(mob?'':phoneBtns.replace(/^<a[^>]*>.*?<\/a>/,''))
      +'<div style="margin-top:10px;">3. Revenez ici et entrez le code affiché par l’application :</div>'
      +'<div style="font-size:12px;color:#9AA29D;margin-top:4px;">Si cette page se recharge, une nouvelle clé est créée : supprimez alors l’ancienne entrée « Bleenr » dans l’app et recommencez.</div>';
    var cp=o.querySelector('#mfa-copy');
    if(cp) cp.onclick=function(){
      var done2=function(){ cp.textContent='Clé copiée ✓'; setTimeout(function(){ cp.textContent='Copier la clé'; },2500); };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(secret).then(done2,function(){ prompt('Clé de configuration :',secret); });
      else prompt('Clé de configuration :',secret);
    };
  } else {
    body.textContent='Entrez le code à 6 chiffres affiché par votre application d’authentification.';
  }
  inp.style.display='block'; go.style.display='block'; setTimeout(function(){ inp.focus(); },50);
  go.onclick=async function(){
    var code=inp.value.trim();
    if(!/^\d{6}$/.test(code)){ fail('Entrez les 6 chiffres.'); return; }
    err.style.display='none'; go.disabled=true; go.textContent='Vérification…';
    var v=await sb.auth.mfa.challengeAndVerify({ factorId:factorId, code:code });
    go.disabled=false; go.textContent='Valider';
    if(v.error){
      // Le code a pu être accepté malgré une erreur de réseau : on vérifie avant d'afficher l'erreur
      var a2=await sb.auth.mfa.getAuthenticatorAssuranceLevel().catch(function(){ return {}; });
      if(a2 && a2.data && a2.data.currentLevel==='aal2'){ _mfaClose(); done(true); return; }
      inp.value=''; inp.focus(); fail(/rate|too many/i.test(v.error.message||'')?'Trop d’essais, patientez une minute.':'Code incorrect ou expiré.'); return; }
    _mfaClose(); done(true);
  };
}
