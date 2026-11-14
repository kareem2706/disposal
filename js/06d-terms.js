// ── Conditions générales : acceptation enregistrée pour les inscriptions Google / Microsoft ──
// L'inscription par e-mail transmet l'acceptation au serveur (refus sinon). Pour Google / Microsoft, l'interrupteur
// est coché avant la redirection ; au retour, l'acceptation est enregistrée (api_terms_accept).
// Un compte créé depuis la mise en place sans acceptation (ex. Google depuis l'écran de connexion) doit accepter avant d'entrer.
var TERMS_SINCE='2026-11-14T11:30:00Z', _termsDone=false, _termsPending=false;

function _termsNeeded(){
  if(_termsDone || !sb || !currentUser || !currentProfile) return false;
  try{ if(localStorage.getItem(DEMO_MODE_KEY)) return false; }catch(e){}
  if(typeof ADMIN_EMAIL!=='undefined' && String(currentUser.email||'').toLowerCase()===ADMIN_EMAIL) return false;
  return !currentProfile.terms_accepted_at;
}

async function _termsAccept(){
  var r=await sb.rpc('api_terms_accept',{ p_version: (typeof TERMS_VERSION!=='undefined'?TERMS_VERSION:'web') });
  if(r.error) throw r.error;
  currentProfile.terms_accepted_at=new Date().toISOString();
  try{ localStorage.removeItem('bleenr_terms_ok'); }catch(e){}
}

// Résout quand on peut entrer dans l'app ; ne se résout pas si l'utilisateur se déconnecte
function _termsGate(){
  return new Promise(function(res){
    var flag=0; try{ flag=parseInt(localStorage.getItem('bleenr_terms_ok')||'0',10)||0; }catch(e){}
    // Interrupteur coché juste avant l'inscription Google / Microsoft
    if(flag && Date.now()-flag < 2*3600*1000){ _termsAccept().then(function(){ res(true); }, function(){ res(true); }); return; }
    // Comptes antérieurs à la mise en place : rien à demander
    if(!currentUser.created_at || new Date(currentUser.created_at) < new Date(TERMS_SINCE)){ res(true); return; }
    _termsShow(res);
  });
}

function _termsShow(done){
  var old=document.getElementById('terms-ov'); if(old) old.remove();
  var ld=document.getElementById('app-loader'); if(ld) ld.style.display='none';
  var o=document.createElement('div'); o.id='terms-ov';
  o.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(14,20,16,.85);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;font-family:"DM Sans",sans-serif;';
  o.innerHTML='<div style="background:#fff;border-radius:20px;max-width:440px;width:100%;padding:26px 22px;margin:auto;">'
    +'<h2 style="font:600 20px \'DM Sans\',sans-serif;margin:0 0 8px;color:var(--ink);">'+t('au.terms_title')+'</h2>'
    +'<p style="font-size:14px;color:var(--ink3);line-height:1.5;margin:0 0 16px;">'+t('au.terms_intro')+'</p>'
    +'<label class="terms-switch" for="inp-terms-gate"><input type="checkbox" id="inp-terms-gate"><span class="terms-sw" aria-hidden="true"></span><span class="terms-txt">'+t('au.terms_accept_html')+'</span></label>'
    +'<div id="terms-gate-err" class="auth-error"></div>'
    +'<button id="terms-gate-go" class="btn btn-primary btn-full" style="justify-content:center;">'+t('au.terms_continue')+'</button>'
    +'<button id="terms-gate-out" style="width:100%;margin-top:10px;padding:10px;border:none;background:none;color:var(--ink3);font:500 13px \'DM Sans\',sans-serif;cursor:pointer;">'+t('ap.logout')+'</button>'
    +'</div>';
  document.body.appendChild(o);
  var cb=o.querySelector('#inp-terms-gate'), er=o.querySelector('#terms-gate-err'), go=o.querySelector('#terms-gate-go');
  cb.onchange=function(){ if(cb.checked){ er.classList.remove('show'); cb.closest('.terms-switch').classList.remove('terms-bad'); } };
  go.onclick=async function(){
    if(!cb.checked){ er.textContent=t('au.err_terms'); er.classList.add('show'); cb.closest('.terms-switch').classList.add('terms-bad'); return; }
    go.disabled=true;
    try{ await _termsAccept(); o.remove(); done(true); }
    catch(e){ go.disabled=false; er.textContent=(e&&e.message)||String(e); er.classList.add('show'); }
  };
  o.querySelector('#terms-gate-out').onclick=function(){ o.remove(); _termsPending=false; if(typeof signOut==='function') signOut(); };
}
