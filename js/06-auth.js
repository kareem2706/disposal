// ── SCREENS ───────────────────────────────────────────
function showScreen(name){
  document.documentElement.classList.remove('boot-landing');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
  if(name==='auth' && window._gisMount) _gisMount();
}

// ── CONFIG ────────────────────────────────────────────
/* config hardcoded */

// ── DEMO MODE ─────────────────────────────────────────
function initDemoMode(){
  // Create fake profile
  currentProfile = {
    id: 'demo-user-1',
    first_name: 'Marie',
    last_name: 'Dupont',
    role: 'client',
    rating: 4.9,
    rating_count: 12,
    phone: '+32 478 123 456',
    vat_number: 'BE 0123.456.789'
  };
  currentUser = { id: 'demo-user-1', email: 'marie@disposal.be' };
  enterApp();
}

// ── AUTH STATE ────────────────────────────────────────
let _authCurrentMode = 'login';
let _authCurrentMethod = 'email';
let _authSelectedRole = 'client';
let _otpType = 'email'; // 'email' | 'phone'
let _phoneForOTP = '';

window.authMode = function(mode){
  _authCurrentMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode==='login');
  document.getElementById('tab-register').classList.toggle('active', mode==='register');
  var loginPanel = document.getElementById('login-panel');
  var registerPanel = document.getElementById('register-panel');
  if(loginPanel) loginPanel.style.display = mode==='login' ? 'block' : 'none';
  if(registerPanel) registerPanel.style.display = mode==='register' ? 'block' : 'none';
  if(mode==='register'){
    // Reset to step 1
    _regCurrentStep = 1;
    _showRegStep(1);
  }
  ['auth-err-email','auth-err-email-reg'].forEach(function(id){
    var e=document.getElementById(id);if(e)e.classList.remove('show');
  });
};

var _regCurrentStep = 1;
var _regClientType = 'perso';

function _showRegStep(step){
  ['reg-step1','reg-step2-client','reg-step3','reg-done'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display='none';
  });
  if(step===1) document.getElementById('reg-step1').style.display='block';
  else if(step===2) document.getElementById('reg-step2-client').style.display='block';
  else if(step===3){
    document.getElementById('reg-step3').style.display='block';
    var isDriver = _authSelectedRole==='driver';
    var isPro = _regClientType==='pro';
    var cf=document.getElementById('reg-client-fields'); if(cf) cf.style.display=isDriver?'none':'block';
    var df=document.getElementById('reg-driver-fields'); if(df) df.style.display=isDriver?'block':'none';
    // For client: show perso fields (fname/lname) OR pro fields (company), not both
    var pf=document.getElementById('reg-perso-fields'); if(pf) pf.style.display=(!isDriver && !isPro)?'grid':'none';
    var prof=document.getElementById('reg-pro-fields'); if(prof) prof.style.display=(!isDriver && isPro)?'block':'none';
    var vat=document.getElementById('reg-vat'); if(vat) vat.style.display=(isDriver||isPro)?'block':'none';
  }
}

window.regNextStep = function(){
  if(_regCurrentStep===1){
    if(_authSelectedRole==='driver'){
      _regCurrentStep=3; _showRegStep(3);
    } else {
      _regCurrentStep=2; _showRegStep(2);
    }
  }
};

window.regPrevStep = function(){
  if(_regCurrentStep===3 && _authSelectedRole==='driver'){ _regCurrentStep=1; _showRegStep(1); }
  else if(_regCurrentStep===3){ _regCurrentStep=2; _showRegStep(2); }
  else if(_regCurrentStep===2){ _regCurrentStep=1; _showRegStep(1); }
};

window.regShowForm = function(){
  _regCurrentStep=3; _showRegStep(3);
};

window.selectClientType = function(type){
  _regClientType = type;
  document.getElementById('ctype-perso').classList.toggle('active', type==='perso');
  document.getElementById('ctype-pro').classList.toggle('active', type==='pro');
};

// submitEmailReg reads from reg-specific fields
window.submitEmailReg = async function(){
  var email = (document.getElementById('inp-email-reg')?.value||'').trim().toLowerCase();
  var errEl = document.getElementById('auth-err-email-reg');
  if(!_validEmail(email)){ if(errEl){errEl.textContent=t('au.err_email_invalid');errEl.classList.add('show');} return; }

  var role = _authSelectedRole||'client';
  var clientType = role==='client' ? (_regClientType||'perso') : null;
  var fname='', lname='', company='';

  if(role==='driver'){
    company = (document.getElementById('inp-company-driver')?.value||'').trim();
    fname = company; lname = '';
  } else if(clientType==='pro'){
    company = (document.getElementById('inp-company-client')?.value||'').trim();
    if(!company){ if(errEl){errEl.textContent=t('au.err_company_required');errEl.classList.add('show');} return; }
    fname = company; lname = '';
  } else {
    fname = (document.getElementById('inp-fname')?.value||'').trim();
    lname = (document.getElementById('inp-lname')?.value||'').trim();
  }

  if(role==='driver' && !company){ if(errEl){errEl.textContent=t('au.err_company_required');errEl.classList.add('show');} return; }
  if(!sb){ if(errEl){errEl.textContent='Supabase non configuré';errEl.classList.add('show');} return; }
  if(errEl) errEl.classList.remove('show');
  var btn = document.getElementById('btn-reg-submit');
  if(btn) setLoading(btn,true,t('au.sending_code'));
  var meta = {role, client_type:clientType, first_name:fname||null, last_name:lname||null, company_name:company||null};
  var vat = (document.getElementById('inp-vat')?.value||'').trim();
  var {error} = await _sendEmailCode(email, true, meta);
  if(btn) setLoading(btn,false,t('au.recevoir_un_code'));
  if(error){
    var _m=error.message||'';
    if(errEl){ errEl.textContent=/rate|security purposes|seconds/i.test(_m)?t('au.err_rate'):_m; errEl.classList.add('show'); }
    return;
  }
  // Même rôle mémorisé que pour Google / Microsoft (appliqué au premier chargement du profil)
  try{ localStorage.setItem('bleenr_pending_role', JSON.stringify({ role:role, client_type:clientType, company_name:company||null, ts:Date.now() })); }catch(e){}
  _otpPurpose='register'; _otpRegExtra={ meta:meta, vat:vat, email:email };
  _otpOpen(email);
};

// Après validation du code d'inscription : TVA + e-mail de bienvenue (une seule fois, compte neuf)
async function _afterCodeSignup(){
  var x=_otpRegExtra||{}; _otpRegExtra=null;
  if(!currentUser) return;
  var isNew = currentUser.created_at && (Date.now()-new Date(currentUser.created_at).getTime() < 30*60*1000);
  if(!isNew) return; // adresse déjà inscrite : simple connexion
  try{ if(x.vat && currentProfile && !currentProfile.vat_number){ await sb.rpc('api_profile_update',{p:{vat_number:x.vat}}); currentProfile.vat_number=x.vat; } }catch(e){}
  try{
    var m=x.meta||{};
    window.sendMail(m.role==='driver' ? 'welcome_driver' : 'welcome_client', currentUser.email, { name:(m.first_name||'').trim(), isPro: m.client_type==='pro' ? 'yes' : 'no' });
  }catch(e){ console.warn('welcome mail', e); }
}

// Ancienne inscription par mot de passe (conservée, plus appelée)
async function _legacySignupWithPassword(email, pwd, meta, role, clientType, fname, lname, company, errEl){
  var {data,error} = await sb.auth.signUp({email,password:pwd,options:{data:meta,emailRedirectTo:window.location.origin+window.location.pathname}});
  if(error){ if(errEl){errEl.textContent=error.message;errEl.classList.add('show');} return; }
  if(data?.user){
    var profileData = {id:data.user.id, email:email, role:role, client_type:role==='driver' ? null : (clientType||'perso'), first_name:fname||null, last_name:lname||null, company_name:company||null};
    try{ await sb.rpc('api_profile_sync'); if(profileData.vat_number) await sb.rpc('api_profile_update',{p:{vat_number:profileData.vat_number}}); }catch(ex){ console.warn('profile sync error',ex); }
    // Welcome email — sent after the profile exists so the recipient check passes
    try{
      window.sendMail(role==='driver' ? 'welcome_driver' : 'welcome_client', email, {
        name: (fname||'').trim(),
        isPro: clientType==='pro' ? 'yes' : 'no'
      });
    }catch(ex){ console.warn('welcome mail', ex); }
  }
  if(data?.user&&!data.session){
    // Show on-screen confirmation that a verification link was sent
    ['reg-step1','reg-step2-client','reg-step3'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.style.display='none';
    });
    var doneEl=document.getElementById('reg-done'); if(doneEl) doneEl.style.display='block';
  } else if(data?.session){
    currentUser=data.user; await loadProfile(); enterApp();
  }
};


window.authMethod = function(method){
  _authCurrentMethod = method;
  document.getElementById('mtab-email').classList.toggle('active', method==='email');
  document.getElementById('mtab-phone').classList.toggle('active', method==='phone');
  document.getElementById('panel-email').style.display = method==='email' ? 'block' : 'none';
  document.getElementById('panel-phone').style.display = method==='phone' ? 'block' : 'none';
};

window.selectRole = function(role){
  _authSelectedRole = role;
  document.getElementById('role-client').classList.toggle('active', role==='client');
  document.getElementById('role-driver').classList.toggle('active', role==='driver');
  updateRegFields();
};

window.updateRegFields = function(){
  if(_authCurrentMode !== 'register') return;
  var isDriver = _authSelectedRole === 'driver';
  var isClient = !isDriver;
  // Email panel
  var ecf=document.getElementById('reg-client-fields');
  var edf=document.getElementById('reg-driver-fields');
  if(ecf) ecf.style.display=isClient?'block':'none';
  if(edf) edf.style.display=isDriver?'block':'none';
  // Phone panel
  var pcf=document.getElementById('reg-phone-client-fields');
  var pdf2=document.getElementById('reg-phone-driver-fields');
  if(pcf) pcf.style.display=isClient?'block':'none';
  if(pdf2) pdf2.style.display=isDriver?'block':'none';
  // VAT only for driver
  var vat=document.getElementById('reg-vat');
  if(vat) vat.style.display=(isDriver||_regClientType==='pro')?'block':'none';
};

window.toggleClientType = function(){
  var isPro = document.getElementById('inp-pro-client').checked;
  document.getElementById('reg-perso-fields').style.display = isPro?'none':'grid';
  document.getElementById('reg-pro-fields').style.display   = isPro?'block':'none';
};

window.toggleClientTypePhone = function(){
  var isPro = document.getElementById('inp-pro-client-p').checked;
  document.getElementById('reg-phone-perso-fields').style.display = isPro?'none':'grid';
  document.getElementById('reg-phone-pro-fields').style.display   = isPro?'block':'none';
};

window.submitEmail = async function(){
  const email = (document.getElementById('inp-email')?.value||'').trim();
  const pwd   = (document.getElementById('inp-pwd')?.value||'');
  const err   = document.getElementById('auth-err-email');
  const btn   = document.getElementById('btn-email-submit');
  if(!email || !pwd){ if(err){err.textContent=t('au.err_email_pwd_required');err.classList.add('show');} return; }
  if(localStorage.getItem(DEMO_MODE_KEY) === '1'){ enterApp(); return; }
  if(!sb){ if(err){err.textContent='Supabase non configuré';err.classList.add('show');} return; }
  if(btn) setLoading(btn, true, 'Connexion…');
  if(err) err.classList.remove('show');
  try {
    _loginInProgress = true;
    _entering = false;
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
    if(error) throw error;
    currentUser = data.user;
    await loadProfile();
    if(btn) setLoading(btn, false, t('au.login_btn'));
    enterApp();
    _loginInProgress = false;
  } catch(e){
    _loginInProgress = false;
    const msg = e.message?.includes('Invalid login') ? t('au.err_bad_credentials') : e.message || t('au.err_unknown');
    if(err){err.textContent=msg;err.classList.add('show');}
    if(btn) setLoading(btn, false, t('au.login_btn'));
  }
};

window.submitPhone = async function(){
  const prefix = document.getElementById('inp-prefix').value;
  const num    = document.getElementById('inp-phone').value.trim();
  const err    = document.getElementById('auth-err-phone');
  const btn    = document.getElementById('btn-phone-submit');

  if(!num){ showError(err, t('err_required')); return; }
  if(!sb){ showError(err, 'Supabase non configuré'); return; }

  _phoneForOTP = prefix + num.replace(/\s/g, '');
  _otpType = 'phone';

  setLoading(btn, true, t('au.sending'));
  err.classList.remove('show');

  try {
    const { error } = await sb.auth.signInWithOtp({ phone: _phoneForOTP });
    if(error) throw error;
    document.getElementById('otp-label').textContent = t('au.code_sent_phone', { phone:_phoneForOTP });
    showOTPScreen();
    setLoading(btn, false, t('au.send_code'));
  } catch(e){
    showError(err, e.message || t('au.err_sms'));
    setLoading(btn, false, t('au.send_code'));
  }
};

function _ssoKeepRole(){
  // OAuth sign-up: the provider returns no role, so keep the choice made on the register screen
  try{
    if(_authCurrentMode==='register'){
      localStorage.setItem('bleenr_pending_role', JSON.stringify({
        role: _authSelectedRole||'client',
        client_type: (_authSelectedRole==='driver') ? null : (_regClientType||'perso'),
        company_name: ((_authSelectedRole==='driver'
          ? document.getElementById('inp-company-driver')?.value
          : (_regClientType==='pro' ? document.getElementById('inp-company-client')?.value : '')) || '').trim() || null,
        ts: Date.now()
      }));
    } else {
      localStorage.removeItem('bleenr_pending_role');
    }
  }catch(e){}
}

window.ssoAuth = async function(provider){
  if(localStorage.getItem(DEMO_MODE_KEY) === '1'){ enterApp(); return; }
  if(!sb){ showToast('Supabase non configuré'); return; }

  document.getElementById('auth-main').style.display = 'none';
  document.getElementById('auth-sso').style.display = 'block';
  document.getElementById('sso-msg').textContent = t('au.redirect_to', { provider: provider==='azure' ? 'Microsoft' : provider.charAt(0).toUpperCase() + provider.slice(1) });
  _ssoKeepRole();

  if(!(await _sbReachable())){
    document.getElementById('auth-main').style.display = 'block';
    document.getElementById('auth-sso').style.display = 'none';
    var _eo = document.getElementById('auth-err-email'); if(_eo) showError(_eo, t('net.unreachable')); else showToast('⚠️ ' + t('net.unreachable'));
    return;
  }
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + window.location.pathname, ...(provider==='azure' ? {scopes:'email profile openid'} : {}) }});
  if(error){
    document.getElementById('auth-main').style.display = 'block';
    document.getElementById('auth-sso').style.display = 'none';
    showToast(t('au.error_prefix') + error.message);
  }
};

function showOTPScreen(){
  document.getElementById('auth-main').style.display = 'none';
  document.getElementById('auth-otp').style.display = 'block';
  document.querySelectorAll('#otp-inputs input').forEach(i => i.value = '');
  setTimeout(() => document.querySelector('#otp-inputs input')?.focus(), 80);
}

window.otpNext = function(el){
  var v=(el.value||'').replace(/\D/g,'');
  if(v.length>1){ _otpFill(v); return; } // collage / autoremplissage iOS-Android
  el.value=v;
  if(v.length === 1){ if(el.nextElementSibling) el.nextElementSibling.focus(); else if(_otpType==='email') verifyOTP(); }
};
function _otpFill(v){
  var ins=document.querySelectorAll('#otp-inputs input');
  for(var i=0;i<ins.length;i++) ins[i].value=v[i]||'';
  (ins[Math.min(v.length,ins.length)-1]||ins[0]).focus();
  if(v.length>=ins.length && _otpType==='email') verifyOTP();
}
document.addEventListener('paste', function(e){
  if(!e.target || !e.target.closest || !e.target.closest('#otp-inputs')) return;
  var v=((e.clipboardData||window.clipboardData).getData('text')||'').replace(/\D/g,'');
  if(v.length>1){ e.preventDefault(); _otpFill(v); }
});

// ── Connexion / inscription par code e-mail ──
var _loginPwdMode=false, _otpEmail='', _otpPurpose='login', _otpRegExtra=null, _otpResendAt=0;
window.toggleLoginPwd=function(force){
  _loginPwdMode = (typeof force==='boolean') ? force : !_loginPwdMode;
  var w=document.getElementById('login-pwd-wrap'); if(w) w.style.display=_loginPwdMode?'block':'none';
  var b=document.getElementById('btn-email-submit'); if(b) b.textContent=_loginPwdMode?t('au.login_btn'):t('au.recevoir_un_code');
  var l=document.getElementById('login-mode-link'); if(l) l.textContent=_loginPwdMode?t('au.code_instead'):t('au.login_with_pwd');
  var er=document.getElementById('auth-err-email'); if(er) er.classList.remove('show');
  if(_loginPwdMode){ var p=document.getElementById('inp-pwd'); if(p) setTimeout(function(){p.focus();},50); }
};
window.submitLoginMain=function(){ return _loginPwdMode ? submitEmail() : sendLoginCode(); };
function _validEmail(e){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }
async function _sendEmailCode(email, createUser, meta){
  var opts={ shouldCreateUser: !!createUser, emailRedirectTo: window.location.origin+window.location.pathname };
  if(meta) opts.data=meta;
  return sb.auth.signInWithOtp({ email: email, options: opts });
}
function _otpOpen(email){
  _otpType='email'; _otpEmail=email; _otpResendAt=Date.now()+60000;
  var lbl=document.getElementById('otp-label'); if(lbl) lbl.innerHTML=t('au.code_sent_email', { email:'<b>'+String(email).replace(/</g,'&lt;')+'</b>' });
  var err=document.getElementById('auth-err-otp'); if(err) err.classList.remove('show');
  var b=document.getElementById('btn-otp'); if(b) setLoading(b,false,t('au.confirm'));
  showOTPScreen(); _otpResendTick();
}
function _otpResendTick(){
  var b=document.getElementById('btn-otp-resend'); if(!b) return;
  var left=Math.ceil((_otpResendAt-Date.now())/1000);
  if(left>0){ b.disabled=true; b.textContent=t('au.resend_in', { s:left }); setTimeout(_otpResendTick,1000); }
  else { b.disabled=false; b.textContent=t('au.resend'); }
}
window.sendLoginCode=async function(){
  var email=(document.getElementById('inp-email')?.value||'').trim().toLowerCase();
  var err=document.getElementById('auth-err-email'), btn=document.getElementById('btn-email-submit');
  if(!_validEmail(email)){ showError(err,t('au.err_email_invalid')); return; }
  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){ enterApp(); return; }
  if(!sb){ showError(err,'Supabase non configuré'); return; }
  err.classList.remove('show'); setLoading(btn,true,t('au.sending_code'));
  var {error}=await _sendEmailCode(email,false,null);
  setLoading(btn,false,t('au.recevoir_un_code'));
  if(error){
    var m=error.message||'';
    var _ec=String(error.code||error.error_code||'');
    if(_ec==='server_unavailable' || error.name==='NetworkError' || error.status>=500) showError(err,t('net.unreachable'));
    else if(/signups? not allowed|not found|user not found|otp_disabled|signup_disabled|user_not_found/i.test(m+' '+_ec)) showError(err,t('au.err_no_account'));
    else if(/rate|security purposes|seconds/i.test(m)) showError(err,t('au.err_rate'));
    else showError(err,m);
    return;
  }
  _otpPurpose='login'; _otpRegExtra=null; _otpOpen(email);
};

window.otpKey = function(e, el){
  if(e.key === 'Backspace' && !el.value) el.previousElementSibling?.focus();
};

window.verifyOTP = async function(){
  const inputs = document.querySelectorAll('#otp-inputs input');
  const token  = Array.from(inputs).map(i => i.value).join('');
  const err    = document.getElementById('auth-err-otp');
  const btn    = document.getElementById('btn-otp');

  if(token.length < 6){ showError(err, t('au.err_6_digits')); return; }

  if(localStorage.getItem(DEMO_MODE_KEY) === '1'){ enterApp(); return; }
  if(!sb){ showError(err, 'Supabase non configuré'); return; }

  setLoading(btn, true, t('au.verifying'));
  err.classList.remove('show');

  try {
    let result;
    if(_otpType === 'phone'){
      result = await sb.auth.verifyOtp({ phone: _phoneForOTP, token, type: 'sms' });
    } else {
      _loginInProgress = true; _entering = false;
      result = await sb.auth.verifyOtp({ email: _otpEmail || document.getElementById('inp-email').value, token, type: 'email' });
    }
    if(result.error) throw result.error;
    currentUser = result.data.user;
    await loadProfile();
    if(_otpType==='email' && _otpPurpose==='register') await _afterCodeSignup();
    setLoading(btn, false, t('au.confirm'));
    enterApp();
    _loginInProgress = false;
  } catch(e){
    _loginInProgress = false;
    showError(err, t('au.err_bad_code'));
    setLoading(btn, false, t('au.confirm'));
    document.querySelectorAll('#otp-inputs input').forEach(function(i){ i.value=''; });
    var f=document.querySelector('#otp-inputs input'); if(f) f.focus();
  }
};

window.resendOTP = async function(){
  if(_otpType==='email'){
    if(!sb || !_otpEmail || Date.now()<_otpResendAt) return;
    var r=await _sendEmailCode(_otpEmail, _otpPurpose==='register', _otpRegExtra && _otpRegExtra.meta);
    if(r.error){ showError(document.getElementById('auth-err-otp'), /rate|seconds/i.test(r.error.message||'')?t('au.err_wait'):r.error.message); return; }
    _otpResendAt=Date.now()+60000; _otpResendTick(); showToast('📧 Nouveau code envoyé'); return;
  }
  if(!sb || !_phoneForOTP) return;
  const { error } = await sb.auth.resendSignUp({ type: 'sms', phone: _phoneForOTP });
  if(!error) showToast('📱 Nouveau code envoyé');
};

window.backToAuthMain = function(){
  var _bo=document.getElementById('btn-otp'); if(_bo) setLoading(_bo,false,t('au.confirm'));
  document.getElementById('auth-otp').style.display = 'none';
  document.getElementById('auth-sso').style.display = 'none';
  document.getElementById('auth-reset-request').style.display = 'none';
  document.getElementById('auth-new-pwd').style.display = 'none';
  document.getElementById('auth-main').style.display = 'block';
};

window.forgotPassword = function(){
  document.getElementById('auth-main').style.display = 'none';
  document.getElementById('auth-reset-request').style.display = 'block';
  var emailVal = document.getElementById('inp-email')?.value?.trim() || '';
  if(emailVal) document.getElementById('inp-reset-email').value = emailVal;
  document.getElementById('inp-reset-email').focus();
};

window.submitResetRequest = async function(){
  var email = document.getElementById('inp-reset-email').value.trim();
  var err   = document.getElementById('auth-err-reset');
  var btn   = document.getElementById('btn-reset-submit');
  if(!email){ showError(err, t('err_required')||'Champ requis'); return; }
  if(!sb){ showError(err, 'Supabase non configuré'); return; }
  setLoading(btn, true, t('au.sending'));
  err.classList.remove('show');
  try {
    var { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    if(error) throw error;
    setLoading(btn, false, t('au.envoyer_le_lien'));
    showToast((t('toast_reset_sent')||'📧 Un lien de réinitialisation a été envoyé à {email}').replace('{email}', email));
    backToAuthMain();
  } catch(e){
    showError(err, e.message || t('au.err_send'));
    setLoading(btn, false, t('au.envoyer_le_lien'));
  }
};

window.submitNewPassword = async function(){
  var pwd  = document.getElementById('inp-new-pwd').value;
  var pwd2 = document.getElementById('inp-new-pwd2').value;
  var err  = document.getElementById('auth-err-new-pwd');
  var btn  = document.getElementById('btn-new-pwd-submit');
  if(!pwd || !pwd2){ showError(err, t('err_required')||'Champ requis'); return; }
  if(pwd !== pwd2){ showError(err, t('err_pwd_match')||'Les mots de passe ne correspondent pas'); return; }
  if(pwd.length < 6){ showError(err, t('err_pwd_short')||'Le mot de passe doit contenir au moins 6 caractères'); return; }
  if(!sb){ showError(err, 'Supabase non configuré'); return; }
  setLoading(btn, true, t('au.updating'));
  err.classList.remove('show');
  try {
    var { error } = await sb.auth.updateUser({ password: pwd });
    if(error) throw error;
    setLoading(btn, false, t('au.confirmer'));
    showToast(t('toast_pwd_updated')||'✅ Mot de passe mis à jour avec succès');
    document.getElementById('auth-new-pwd').style.display = 'none';
    _passwordRecoveryActive = false;
    await checkSession();
  } catch(e){
    showError(err, e.message || t('au.err_update'));
    setLoading(btn, false, t('au.confirmer'));
  }
};

// Ferme tout ce qui est ouvert (panneaux de course, fenêtres, menus, suivi en direct) — utilisé à la déconnexion
window._closeAllOverlays = function(){
  try{ if(_liveCh){ sb.removeChannel(_liveCh); _liveCh=null; } }catch(e){}
  try{ if(typeof closeLiveTracking==='function' && typeof _lt!=='undefined' && _lt) closeLiveTracking(); }catch(e){}
  try{ _rdHist=false; _rdHideAll(); }catch(e){}
  document.querySelectorAll('.modal-overlay.open').forEach(function(m){ m.classList.remove('open','rd-under'); });
  document.querySelectorAll('.ft-menu.open').forEach(function(m){ m.classList.remove('open'); });
  ['m-pax-edit'].forEach(function(id){ var el=document.getElementById(id); if(el) el.remove(); });
  document.body.classList.remove('rd-open','rd-nav');
  // retire le lien #course/… pour que la course ne se rouvre pas à la prochaine connexion
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
};

window.signOut = async function(){
  _closeAllOverlays();
  if(sb) await sb.auth.signOut({ scope: 'local' });   // ce navigateur seulement (l'app iOS reste connectée)
  currentUser = null;
  currentProfile = null;
  currentRole = 'client';
  _entering = false;
  _passwordRecoveryActive = false;
  localStorage.removeItem(DEMO_MODE_KEY);
  if(typeof _applyFleetTheme==='function') _applyFleetTheme(false);
  if(typeof _actDay!=='undefined') _actDay='';
  if(typeof _mfaOk!=='undefined'){ _mfaOk=false; _mfaPending=false; _mfaGateP=null; if(typeof _mfaClose==='function') _mfaClose(); }
  _resetAuthUI();
  showToast(t('toast_signout'));
  showScreen('landing');
};
// Après déconnexion : écran de connexion remis à zéro (onglet Connexion, champs vides, plus d'étape « code »)
function _resetAuthUI(){
  try{
    if(window.backToAuthMain) backToAuthMain();
    var scr=document.getElementById('screen-auth');
    if(scr){
      scr.querySelectorAll('input').forEach(function(i){ if(i.type==='checkbox'||i.type==='radio') i.checked=false; else i.value=''; i.classList&&i.classList.remove('fld-err'); });
      scr.querySelectorAll('.auth-error').forEach(function(e){ e.classList.remove('show'); e.textContent=''; });
    }
    var bo=document.getElementById('btn-otp'); if(bo){ bo.disabled=false; bo.textContent=t('au.confirm'); }
    var be=document.getElementById('btn-email-submit'); if(be){ be.disabled=false; }
    if(window.toggleLoginPwd) toggleLoginPwd(false);
    if(typeof _showRegStep==='function') _showRegStep(1);
    if(window.authMode) authMode('login');
    try{ _phoneForOTP=''; }catch(e){}
  }catch(e){ console.warn('resetAuthUI', e); }
}

