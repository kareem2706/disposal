// ── Administration (chargé seulement pour l’admin, voir _withAdmin) — extrait de l’ancien js/08-admin-campaigns.js ──
// ── ADMIN : CAMPAGNES E-MAIL ─────────────────────────────────────
// Envoi par l'Edge Function « campaign » (admin uniquement, désinscrits exclus par le serveur).
var _cmp={ aud:'clients', people:{clients:null,fleets:null}, sel:{clients:{},fleets:{}}, previewT:null };
var _CMP_DRAFT='bleenr_campaign_draft';
function _cmpEsc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// Mise en forme identique à render() dans supabase/functions/campaign/index.ts
function _cmpInline(s, prenom){
  return _cmpEsc(s).replace(/\{prenom\}/g,_cmpEsc(prenom))
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/(https:\/\/[^\s<]+[^\s<.,;:!?)])/g,'<a href="$1" style="color:#1B5E3B;font-weight:600;">$1</a>');
}
// Aperçu : même gabarit que les e-mails envoyés (supabase/functions/_shared/mail.ts)
var _CMP_TPL="<!DOCTYPE html>\n<html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\"><title>%%TITLE%%<\/title><\/head>\n<body style=\"margin:0;padding:0;background:#F4F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;\">\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#F4F3EF;\">\n<tr><td align=\"center\" style=\"padding:36px 14px;\">\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #EAE8E2;\">\n<tr><td style=\"padding:30px 32px 0;\">\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n<td style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:-.03em;color:#1B5E3B;\">Bleenr<\/td>\n<td align=\"right\" style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12.5px;color:#7C8580;\">Chauffeurs privés<\/td>\n<\/tr><\/table>\n<\/td><\/tr>\n<tr><td style=\"padding:30px 32px 0;\">\n<h1 style=\"margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-.02em;color:#16201B;\">%%TITLE%%<\/h1>\n<div style=\"margin-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.6;color:#3F4743;\">%%INTRO%%<\/div>\n<\/td><\/tr>\n<!--CTA--><tr><td style=\"padding:22px 32px 0;\">\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n<td align=\"center\" bgcolor=\"#1B5E3B\" style=\"border-radius:10px;\">\n<a href=\"%%CTAU%%\" style=\"display:block;padding:15px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;\">%%CTAL%%&nbsp;&nbsp;&rarr;<\/a>\n<\/td><\/tr><\/table>\n<\/td><\/tr><!--/CTA-->\n<tr><td style=\"padding:26px 32px 26px;\">\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-top:1px solid #ECEAE5;\"><tr>\n<td style=\"padding-top:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12.5px;color:#7C8580;\"><b style=\"color:#1B5E3B;font-size:14px;letter-spacing:-.02em;\">Bleenr<\/b>&nbsp;·&nbsp;Chauffeurs privés<\/td>\n<td align=\"right\" style=\"padding-top:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12.5px;color:#7C8580;\">Besoin d'aide ? <a href=\"mailto:info@bleenr.com\" style=\"color:#1B5E3B;text-decoration:underline;\">info@bleenr.com<\/a><\/td>\n<\/tr><\/table>\n<\/td><\/tr>\n<\/table>\n<div style=\"max-width:560px;margin:14px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.5;color:#9AA19C;text-align:center;\">\nVous recevez cet e-mail car vous avez un compte Bleenr. <a href=\"#\" style=\"color:#9AA19C;\">Se désinscrire des offres et nouveautés Bleenr<\/a>\n<\/div>\n<\/td><\/tr>\n<\/table>\n<\/body><\/html>";
function _cmpRender(c, prenom){
  var paras=String(c.body||'').replace(/\r/g,'').split(/\n\s*\n/).map(function(x){return x.trim();}).filter(Boolean)
    .map(function(x){ return '<p style="margin:0 0 14px;">'+_cmpInline(x,prenom).replace(/\n/g,'<br>')+'</p>'; }).join('');
  var h=_CMP_TPL;
  if(c.cta_label && /^https:\/\//.test(c.cta_url||'')) h=h.replace('%%CTAL%%',function(){ return _cmpEsc(c.cta_label); }).replace('%%CTAU%%',function(){ return _cmpEsc(c.cta_url); });
  else h=h.replace(/<!--CTA-->[\s\S]*?<!--\/CTA-->/,'');
  var ttl=c.title?_cmpInline(c.title,prenom):_cmpEsc(c.subject||'');
  return h.split('%%TITLE%%').join(ttl).replace('%%INTRO%%',function(){ return paras||'<p style="margin:0;color:#B0B0AA;">Votre message apparaîtra ici…</p>'; });
}
function _cmpContent(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  return { subject:g('cmp-subject').trim(), title:g('cmp-title').trim(), body:g('cmp-body'), cta_label:g('cmp-cta-label').trim(), cta_url:g('cmp-cta-url').trim() };
}
function _cmpFill(c){
  var set=function(id,v){ var e=document.getElementById(id); if(e) e.value=v||''; };
  set('cmp-subject',c.subject); set('cmp-title',c.title); set('cmp-body',c.body); set('cmp-cta-label',c.cta_label); set('cmp-cta-url',c.cta_url);
  _cmpChanged();
}
window._cmpChanged=function(){
  clearTimeout(_cmp.previewT);
  _cmp.previewT=setTimeout(function(){
    var c=_cmpContent();
    var fr=document.getElementById('cmp-preview'); if(fr) fr.srcdoc=_cmpRender(c,'Karim');
    var ps=document.getElementById('cmp-prev-subject'); if(ps) ps.textContent=c.subject?'Objet : '+c.subject.replace(/\{prenom\}/g,'Karim'):'';
    try{ localStorage.setItem(_CMP_DRAFT, JSON.stringify(c)); }catch(e){}
  }, 150);
};
function _cmpName(p){
  var person=((p.first_name||'')+' '+(p.last_name||'')).trim();
  return (p.company_name||'').trim() ? p.company_name.trim()+(person?' · '+person:'') : (person||p.email||'—');
}
function _cmpOptedOut(p){ return !!(p.notif_prefs && p.notif_prefs.email && p.notif_prefs.email.marketing===false); }
async function _cmpLoadPeople(aud){
  if(_cmp.people[aud]) return _cmp.people[aud];
  var res=await sb.from('profiles').select('id,email,first_name,last_name,company_name,role,client_type,fleet_verified,notif_prefs')
    .eq('role', aud==='fleets'?'driver':'client').order('company_name',{ascending:true,nullsFirst:false}).limit(3000);
  _cmp.people[aud]=(res.data||[]).filter(function(p){ return p.email && String(p.email).toLowerCase()!==ADMIN_EMAIL; })
    .sort(function(a,b){ return _cmpName(a).localeCompare(_cmpName(b),'fr'); });
  return _cmp.people[aud];
}
function _cmpVisible(){
  var q=((document.getElementById('cmp-q')||{}).value||'').trim().toLowerCase();
  var f=(document.getElementById('cmp-filter')||{}).value||'all';
  return (_cmp.people[_cmp.aud]||[]).filter(function(p){
    if(f==='validated' && p.fleet_verified!=='validated') return false;
    if(f==='pending' && p.fleet_verified==='validated') return false;
    if(f==='pro' && p.client_type!=='pro') return false;
    if(f==='perso' && p.client_type==='pro') return false;
    if(!q) return true;
    return (_cmpName(p)+' '+(p.email||'')).toLowerCase().indexOf(q)>=0;
  });
}
window._cmpRenderList=function(){
  var box=document.getElementById('cmp-list'); if(!box) return;
  var list=_cmpVisible(), sel=_cmp.sel[_cmp.aud];
  if(!list.length){ box.innerHTML='<div style="padding:22px;text-align:center;font-size:13px;color:var(--ink3);">Aucun '+(_cmp.aud==='fleets'?'fleet':'client')+'</div>'; }
  else box.innerHTML=list.map(function(p){
    var off=_cmpOptedOut(p);
    var tag=off?'<span class="cmp-tag no">Désinscrit</span>'
      : _cmp.aud==='fleets' ? (p.fleet_verified==='validated'?'<span class="cmp-tag ok">Validée</span>':'<span class="cmp-tag">En attente</span>')
      : '<span class="cmp-tag">'+(p.client_type==='pro'?'Pro':'Particulier')+'</span>';
    return '<label class="cmp-item'+(off?' off':'')+'"><input type="checkbox" data-id="'+_cmpEsc(p.id)+'"'+(sel[p.id]&&!off?' checked':'')+(off?' disabled':'')+' onchange="_cmpPick(this)">'
      +'<div style="min-width:0;"><div class="cmp-nm">'+_cmpEsc(_cmpName(p))+'</div><div class="cmp-em">'+_cmpEsc(p.email)+'</div></div>'+tag+'</label>';
  }).join('');
  _cmpCount();
};
function _cmpCount(){
  var list=_cmpVisible().filter(function(p){return !_cmpOptedOut(p);}), sel=_cmp.sel[_cmp.aud];
  var n=Object.keys(sel).filter(function(k){return sel[k];}).length;
  var c=document.getElementById('cmp-count'); if(c) c.textContent=n+' sélectionné'+(n>1?'s':'')+' sur '+(_cmp.people[_cmp.aud]||[]).filter(function(p){return !_cmpOptedOut(p);}).length;
  var all=document.getElementById('cmp-all'); if(all){ all.checked=list.length>0 && list.every(function(p){return sel[p.id];}); }
  var b=document.getElementById('cmp-send'); if(b) b.textContent=n?'Envoyer à '+n+' '+(_cmp.aud==='fleets'?'fleet':'client')+(n>1?'s':''):'Envoyer la campagne';
}
window._cmpPick=function(el){ _cmp.sel[_cmp.aud][el.dataset.id]=el.checked; _cmpCount(); };
window._cmpToggleAll=function(on){
  _cmpVisible().forEach(function(p){ if(!_cmpOptedOut(p)) _cmp.sel[_cmp.aud][p.id]=on; });
  _cmpRenderList();
};
window._cmpAudience=async function(aud){
  _cmp.aud=aud;
  document.querySelectorAll('#cmp-aud button').forEach(function(b){ b.classList.toggle('on', b.dataset.a===aud); });
  var f=document.getElementById('cmp-filter');
  if(f) f.innerHTML=aud==='fleets'
    ? '<option value="all">Toutes les fleets</option><option value="validated">Validées</option><option value="pending">Non validées</option>'
    : '<option value="all">Tous les clients</option><option value="pro">Professionnels</option><option value="perso">Particuliers</option>';
  var box=document.getElementById('cmp-list'); if(box) box.innerHTML='<div class="page-loading"><div class="page-spinner"></div></div>';
  await _cmpLoadPeople(aud);
  _cmpRenderList();
};
async function _cmpHistory(){
  var el=document.getElementById('cmp-history'); if(!el) return;
  var res=await sb.from('email_campaigns').select('*').order('created_at',{ascending:false}).limit(30);
  if(res.error){ el.innerHTML='<div style="font-size:12.5px;color:var(--ink3);">Historique indisponible (exécutez email_campaigns.sql).</div>'; return; }
  var rows=res.data||[]; window._cmpHist=rows;
  el.innerHTML=rows.length ? '<table class="cmp-hist"><tr><th>Date</th><th>Public</th><th>Objet</th><th style="text-align:right;">Envoyés</th><th></th></tr>'
    + rows.map(function(c,i){
      return '<tr><td style="white-space:nowrap;">'+new Date(c.created_at).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'2-digit'})+'</td>'
        +'<td>'+(c.audience==='fleets'?'Fleets':'Clients')+'</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_cmpEsc(c.subject)+'</td>'
        +'<td style="text-align:right;white-space:nowrap;">'+c.sent+(c.skipped?' <span style="color:var(--ink4);" title="Désinscrits ou sans adresse">(+'+c.skipped+' exclus)</span>':'')+'</td>'
        +'<td style="text-align:right;"><button class="btn btn-secondary btn-sm" onclick="_cmpReuse('+i+')">Réutiliser</button></td></tr>';
    }).join('')+'</table>'
    : '<div style="font-size:12.5px;color:var(--ink3);">Aucune campagne envoyée pour le moment.</div>';
}
window._cmpReuse=function(i){
  var c=(window._cmpHist||[])[i]; if(!c) return;
  _cmpFill(c); if(c.audience!==_cmp.aud) _cmpAudience(c.audience);
  showToast('Contenu repris : choisissez les destinataires puis envoyez');
};
window._cmpSend=async function(action){
  var err=document.getElementById('cmp-err'); if(err){ err.classList.remove('show'); err.textContent=''; }
  var fail=function(m){ if(err){ err.textContent=m; err.classList.add('show'); } };
  var c=_cmpContent();
  if(!c.subject) return fail('Indiquez l’objet de l’e-mail.');
  if(!c.body.trim()) return fail('Écrivez le message.');
  if(c.cta_label && !/^https:\/\//.test(c.cta_url)) return fail('Le lien du bouton doit commencer par https://');
  var payload=Object.assign({ action:action, audience:_cmp.aud }, c);
  if(action==='send'){
    var sel=_cmp.sel[_cmp.aud], ids=Object.keys(sel).filter(function(k){return sel[k];});
    if(!ids.length) return fail('Sélectionnez au moins un destinataire.');
    var total=(_cmp.people[_cmp.aud]||[]).filter(function(p){return !_cmpOptedOut(p);}).length;
    var who=ids.length+' '+(_cmp.aud==='fleets'?'fleet':'client')+(ids.length>1?'s':'');
    var ok=await _uiConfirm({ title:'Envoyer la campagne ?', sub:'« <b>'+_cmpEsc(c.subject)+'</b> » sera envoyé à <b>'+who+'</b>'+(ids.length===total?' (tous)':'')+'. Cet envoi ne peut pas être annulé.',
      confirm:'Envoyer', icon:'<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 6.5l9 6.5 9-6.5"/>' });
    if(!ok) return;
    payload.user_ids=ids;
  }
  var btn=document.getElementById(action==='send'?'cmp-send':'cmp-test'), lbl=btn?btn.textContent:'';
  if(btn){ btn.disabled=true; btn.textContent='Envoi…'; }
  var r=await _callEdge('campaign', payload);
  if(btn){ btn.disabled=false; btn.textContent=lbl; }
  if(r.error) return fail(/not found|404/i.test(String(r.error))?'La fonction « campaign » n’est pas encore déployée dans Supabase.':r.error);
  if(action==='test'){ showToast('✉️ Test envoyé à '+ADMIN_EMAIL); return; }
  showToast('✅ Campagne envoyée : '+r.sent+' e-mail'+(r.sent>1?'s':'')+(r.skipped?' · '+r.skipped+' exclu'+(r.skipped>1?'s':''):''));
  if(r.errors&&r.errors.length) fail('Certains envois ont échoué : '+r.errors.join(' · '));
  _cmp.sel[_cmp.aud]={}; _cmpRenderList(); _cmpHistory();
};
async function loadAdminCampaigns(){
  if(!sb||currentUser?.email!==ADMIN_EMAIL) return;
  if(!document.getElementById('cmp-subject').value){
    try{ var d=JSON.parse(localStorage.getItem(_CMP_DRAFT)||'null'); if(d) _cmpFill(d); }catch(e){}
  }
  _cmpChanged();
  await _cmpAudience(_cmp.aud);
  _cmpHistory();
}
