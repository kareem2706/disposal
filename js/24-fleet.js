// ── Profil flotte : onglets Société / Compte / Notifications / Documents / Flotte ──
var _PF_TABS_DRIVER=[
  {k:'company', l:'Société',        cards:[['pf-identity-card','pf-bank-card'],'pf-stripe-card']},
  {k:'account', l:'Compte',         cards:['pf-account-card']},
  {k:'notif',   l:'Notifications',  cards:['pf-notif-card']},
  {k:'docs',    l:'Documents',      cards:['pf-docs-card']},
  {k:'fleet',   l:'Véhicules',      cards:['pf-veh-card']},
  {k:'drivers', l:'Chauffeurs',     cards:['pf-drv-card']}
];
// Clients (particulier / professionnel) et admin : Profil (ou Données de l'entreprise) / Compte / Notifications
function _pfTabsClient(pro){ return [
  {k:'company', l:pro?'Données de l’entreprise':'Profil', cards:['pf-identity-card'], narrow:true},
  {k:'account', l:'Compte',        cards:['pf-account-card'], narrow:true},
  {k:'notif',   l:'Notifications', cards:['pf-notif-card'],   narrow:true}
]; }
var _PF_TABS=_PF_TABS_DRIVER;
var _pfTab='company', _pfOrig=[];
// Retour à la mise en page d'origine (ex. déconnexion d'une flotte puis connexion d'un client sans recharger)
function _pfTeardownDriverTabs(){
  var bar=document.getElementById('pf-tabs'), panels=document.getElementById('pf-panels');
  if(!bar||!bar.dataset.ready) return;
  _pfOrig.slice().reverse().forEach(function(o){ o[1].insertBefore(o[0],o[2]); o[0].style.marginBottom=o[3]; });
  _pfOrig=[]; panels.innerHTML=''; bar.innerHTML=''; bar.style.display='none'; delete bar.dataset.ready; delete bar.dataset.set;
  var mc=document.getElementById('pf-main-cols'); if(mc) mc.style.removeProperty('display');
  var fs=document.getElementById('pf-fleet-sections'); if(fs){ fs.style.removeProperty('display'); fs.style.display='none'; } // sections flotte : chauffeurs uniquement
}
function _pfSetupDriverTabs(tabs, setKey){
  var bar=document.getElementById('pf-tabs'), panels=document.getElementById('pf-panels');
  if(!bar||!panels) return;
  setKey=setKey||'driver';
  if(bar.dataset.ready && bar.dataset.set!==setKey) _pfTeardownDriverTabs();
  _PF_TABS=tabs||_PF_TABS_DRIVER;
  if(!_PF_TABS.some(function(t){ return t.k===_pfTab; })) _pfTab='company';
  if(!bar.dataset.ready){
    bar.dataset.set=setKey;
    bar.innerHTML=_PF_TABS.map(function(t){ return '<button class="pf-tab" role="tab" data-k="'+t.k+'" onclick="_pfShowTab(\''+t.k+'\')">'+t.l+'</button>'; }).join('');
    _PF_TABS.forEach(function(t){
      var pn=document.createElement('div'); pn.className='pf-panel'+(t.narrow?' pf-narrow':''); pn.id='pf-panel-'+t.k; pn.style.display='none';
      t.cards.forEach(function(c){
        [].concat(c).forEach(function(id){ var el=document.getElementById(id); if(el) _pfOrig.push([el,el.parentNode,el.nextSibling,el.style.marginBottom]); });
        if(Array.isArray(c)){ // two cards side by side on desktop
          var g=document.createElement('div'); g.className='pf-panel-grid';
          c.forEach(function(id){ var el=document.getElementById(id); if(el){ el.style.marginBottom='0'; g.appendChild(el); } });
          pn.appendChild(g);
        } else { var el=document.getElementById(c); if(el) pn.appendChild(el); }
      });
      panels.appendChild(pn);
    });
    // Original containers are now empty
    ['pf-main-cols','pf-fleet-sections'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.setProperty('display','none','important'); });
    bar.dataset.ready='1';
  }
  bar.style.display='flex';
  _pfShowTab(_pfTab);
}
window._pfShowTab=function(k){
  _pfTab=k;
  document.querySelectorAll('#pf-tabs .pf-tab').forEach(function(b){ var on=b.dataset.k===k; b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); });
  _PF_TABS.forEach(function(t){ var pn=document.getElementById('pf-panel-'+t.k); if(pn) pn.style.display=(t.k===k?'block':'none'); });
};
function _pfFmtIban(v){ return String(v||'').replace(/\s+/g,'').toUpperCase().replace(/(.{4})/g,'$1 ').trim(); }
function _pfIbanValid(v){
  var x=String(v||'').replace(/\s+/g,'').toUpperCase();
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(x)) return false;
  var r=(x.slice(4)+x.slice(0,4)).replace(/[A-Z]/g,function(c){ return String(c.charCodeAt(0)-55); });
  var m=0; for(var i=0;i<r.length;i++){ m=(m*10+parseInt(r[i],10))%97; }
  return m===1;
}
window.saveBankInfo=async function(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value.trim():''; };
  var err=document.getElementById('pf-bank-err'); if(err) err.classList.remove('show');
  var iban=g('pf-iban').replace(/\s+/g,'').toUpperCase(), bic=g('pf-bic').replace(/\s+/g,'').toUpperCase(), holder=g('pf-bank-holder');
  var fail=function(m){ if(err){ err.textContent=m; err.classList.add('show'); } };
  if(iban && !_pfIbanValid(iban)) return fail('IBAN invalide — vérifiez le numéro.');
  if(bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) return fail('BIC invalide (8 ou 11 caractères).');
  var upd={ iban:iban||null, bic:bic||null, bank_holder:holder||null };
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    var {error}=await sb.rpc('api_bank_save',{ p_iban:iban||null, p_bic:bic||null, p_holder:holder||null });
    if(error) return fail(/function/i.test(error.message||'') ? 'Exécutez server_actions.sql dans Supabase.' : 'Erreur : '+error.message);
  }
  Object.assign(currentProfile,upd);
  var ib=document.getElementById('pf-iban'); if(ib) ib.value=_pfFmtIban(iban);
  showToast(t('toast_saved'));
};

// ═══════════════════════════════════════════════════════════════
// FLEET PROFILE: Documents, Vehicles, Drivers
// ═══════════════════════════════════════════════════════════════
var _fleetVehicles=[];
var _fleetDrivers=[];

async function loadFleetProfile(){
  if(!sb||!currentUser)return;
  await Promise.all([loadFleetDocs(), loadFleetVehicles(), loadFleetDriversList(), loadStripeStatus()]);
}

// ═══════════════════════════════════════════════════════════════
// VERSEMENTS AUTOMATIQUES — Stripe Connect Express (supabase/stripe_connect.sql, fonction stripe-connect)
// La flotte s'inscrit chez Stripe ; chaque course terminée lui est ensuite virée par le serveur.
// ═══════════════════════════════════════════════════════════════
// Retour de l'inscription Stripe : ?stripe=return (terminé ou interrompu) | ?stripe=refresh (lien expiré)
var _stripeBack=(function(){
  try{
    var q=new URLSearchParams(location.search), v=q.get('stripe');
    if(!v) return null;
    q.delete('stripe');
    history.replaceState(null,'',location.pathname+(q.toString()?'?'+q.toString():'')+location.hash);
    return v==='refresh'?'refresh':'return';
  }catch(e){ return null; }
})();
if(_stripeBack){
  (window._appReady||Promise.resolve()).then(function(){
    var n=0, iv=setInterval(function(){
      if(++n>40){ clearInterval(iv); return; }
      if(currentRole!=='driver' || !document.getElementById('screen-app')?.classList.contains('active')) return;
      clearInterval(iv);
      showPage('profile'); _pfShowTab('company');
      if(_stripeBack==='refresh') stripeOnboard(); else showToast('✅ '+t('st.back_ok'));
      setTimeout(function(){ document.getElementById('pf-stripe-card')?.scrollIntoView({behavior:'smooth',block:'center'}); }, 400);
    }, 250);
  });
}

var _stripeState=null;
async function loadStripeStatus(){
  var card=document.getElementById('pf-stripe-card');
  if(!card || currentRole!=='driver' || localStorage.getItem(DEMO_MODE_KEY)==='1'){ if(card) card.style.display='none'; return; }
  card.style.display='';
  var row=null, pays=[];
  try{
    var r1=await sb.from('fleet_stripe').select('account_id,details_submitted,payouts_enabled,payouts_since').eq('driver_id',currentUser.id).maybeSingle();
    if(r1.error){ card.style.display='none'; return; }   // stripe_connect.sql pas encore exécuté
    row=r1.data;
    // Inscription en cours : l'état est relu chez Stripe (au retour de l'inscription notamment)
    if(row && !row.payouts_enabled){
      var st=await _callEdge('stripe-connect',{action:'status'});
      if(!st.error){ var r2=await sb.from('fleet_stripe').select('account_id,details_submitted,payouts_enabled,payouts_since').eq('driver_id',currentUser.id).maybeSingle(); row=r2.data||row; }
    }
    if(row && row.payouts_enabled){
      var r3=await sb.from('ride_payouts').select('ride_id,amount,status,updated_at').eq('driver_id',currentUser.id).order('updated_at',{ascending:false}).limit(5);
      pays=r3.data||[];
    }
  }catch(e){ console.warn('stripe status', e); }
  _stripeState=row;
  _stripeRender(row, pays);
}

function _stripeRender(row, pays){
  var body=document.getElementById('pf-stripe-body'), act=document.getElementById('pf-stripe-actions'),
      pill=document.getElementById('pf-stripe-pill'), list=document.getElementById('pf-stripe-list');
  if(!body) return;
  var state=!row?'none':row.payouts_enabled?'active':row.details_submitted?'pending':'incomplete';
  var btn=function(label, fn, primary){ return '<button class="btn '+(primary?'btn-primary':'btn-secondary')+'" onclick="'+fn+'()">'+label+'</button>'; };
  pill.className='st-pill st-'+state;
  pill.textContent=state==='active'?'Stripe ✓':state==='pending'?'Stripe…':'';
  if(state==='none'){ body.textContent=t('st.intro'); act.innerHTML=btn(t('st.activate'),'stripeOnboard',true); }
  else if(state==='incomplete'){ body.textContent=t('st.incomplete')+' '+t('st.intro'); act.innerHTML=btn(t('st.continue'),'stripeOnboard',true); }
  else if(state==='pending'){ body.textContent=t('st.pending'); act.innerHTML=btn(t('st.complete'),'stripeOnboard',true)+btn(t('st.dashboard'),'stripeDashboard'); }
  else {
    var d=row.payouts_since?new Date(row.payouts_since).toLocaleDateString(_i18nLocale()):'';
    body.textContent=t('st.active',{date:d})+' '+t('st.manual');
    act.innerHTML=btn(t('st.dashboard'),'stripeDashboard',true);
  }
  var money=function(v){ return (Math.round((+v||0)*100)/100).toLocaleString(_i18nLocale(),{style:'currency',currency:'EUR'}); };
  list.innerHTML=(pays&&pays.length)?'<div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-bottom:6px;">'+t('st.recent')+'</div>'
    +pays.map(function(p){ return '<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line,#ECECE8);font-size:13px;">'
      +'<span>'+new Date(p.updated_at).toLocaleDateString(_i18nLocale())+'</span>'
      +'<span style="color:var(--ink3)">'+t('st.'+(p.status==='paid'?'paid':p.status==='reversed'?'reversed':'failed'))+'</span>'
      +'<b>'+money(p.amount)+'</b></div>'; }).join(''):'';
}

window.stripeOnboard=async function(){
  var err=document.getElementById('pf-stripe-err'); if(err) err.classList.remove('show');
  var b=document.querySelector('#pf-stripe-actions .btn-primary'); if(b){ b.disabled=true; b.dataset.l=b.textContent; b.textContent='…'; }
  var d=await _callEdge('stripe-connect',{action:'onboard', returnUrl:location.origin+location.pathname});
  if(d.url){ location.href=d.url; return; }
  if(b){ b.disabled=false; b.textContent=b.dataset.l||b.textContent; }
  if(err){ err.textContent=d.error||'Erreur'; err.classList.add('show'); }
};
window.stripeDashboard=async function(){
  var err=document.getElementById('pf-stripe-err'); if(err) err.classList.remove('show');
  // Fenêtre ouverte tout de suite (sinon bloquée comme pop-up), puis dirigée vers Stripe
  var w=window.open('','_blank');
  var d=await _callEdge('stripe-connect',{action:'dashboard'});
  if(d.url){ if(w) w.location=d.url; else location.href=d.url; return; }
  if(w) w.close();
  if(err){ err.textContent=d.error||'Erreur'; err.classList.add('show'); }
};

// ── Upload helper ──
var _bucketChecked=false;
async function _ensureBucket(){
  // Le dossier « fleet-docs » est créé et sécurisé côté Supabase (privé) : rien à faire ici
  _bucketChecked=true;
}
async function _uploadFleetFile(file, folder){
  var ext=file.name.split('.').pop().toLowerCase();
  if(ext==='jpeg') ext='jpg';
  var _mimes={pdf:'application/pdf',jpg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif'};
  if(!_mimes[ext])throw new Error('Formats accept\u00e9s : PDF, JPG, PNG, WEBP ou HEIC');
  if(file.size>10485760)throw new Error('Fichier trop volumineux (10 Mo maximum)');
  await _ensureBucket();
  var path=currentUser.id+'/'+folder+'/'+Date.now()+'.'+ext;
  var {data,error}=await sb.storage.from('fleet-docs').upload(path,file,{upsert:true,contentType:_mimes[ext]});
  if(error)throw error;
  var {data:urlData}=sb.storage.from('fleet-docs').getPublicUrl(path);
  return urlData.publicUrl;
}

// ── Helper: extract storage path from public URL ──
function _storagePathFromUrl(url){
  if(!url)return null;
  var marker='/object/public/fleet-docs/';
  var idx=url.indexOf(marker);
  if(idx<0)return null;
  return decodeURIComponent(url.slice(idx+marker.length));
}

// ── Documents privés : les liens enregistrés (…/object/public/fleet-docs/…) sont ouverts
// via un lien signé temporaire (5 min), accessible seulement au propriétaire et à l'admin ──
document.addEventListener('click', function(e){
  var a = e.target.closest && e.target.closest('a[href*="/object/public/fleet-docs/"]');
  if(!a || !sb) return;
  e.preventDefault();
  var path = _storagePathFromUrl(a.getAttribute('href'));
  if(!path) return;
  var w = window.open('', '_blank');   // ouvert tout de suite pour ne pas être bloqué
  sb.storage.from('fleet-docs').createSignedUrl(path, 300).then(function(r){
    if(r.error || !r.data){ if(w) w.close(); showToast(t('app.document_inaccessible')); return; }
    if(w) w.location.href = r.data.signedUrl; else window.location.href = r.data.signedUrl;
  });
}, true);

// ── Status badge helper ──
function _sectionStatusHtml(items){
  if(!items||items.length===0)return '';
  var allValidated=items.every(function(i){return i.status==='validated';});
  if(allValidated)return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:var(--green-bg);color:var(--green);font-size:10px;font-weight:600;"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+t('app2.valide_2')+'</span>';
  return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-size:10px;font-weight:600;">'+t('app.en_attente')+'</span>';
}

// ── Fleet Documents ──
var _fleetDocsData=[];
async function loadFleetDocs(){
  var el=document.getElementById('fleet-docs-list');if(!el)return;
  var {data,error}=await sb.from('fleet_documents').select('*').eq('fleet_id',currentUser.id).order('uploaded_at',{ascending:false});
  _fleetDocsData=data||[];
  // Update section status
  var statusEl=document.getElementById('fleet-docs-status');
  if(statusEl)statusEl.innerHTML=_sectionStatusHtml(_fleetDocsData);
  if(error||!data||data.length===0){el.innerHTML='<div style="color:var(--ink4);font-size:12px;">'+t('app2.aucun_document_ajoute')+'</div>';return;}
  var docLabels={licence_lvc:'Licence LVC',assurance_rc:'Assurance RC Pro',kbis:'Extrait Kbis/BCE',statuts:'Statuts',autre:'Autre'};
  el.innerHTML=data.map(function(d){
    var safeId=d.id.replace(/'/g,'');
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--sand2);">'
      +'<div style="flex:1;min-width:0;">'
      +'<a href="'+d.file_url+'" target="_blank" style="display:inline-block;font-size:11px;padding:3px 8px;background:var(--blue-bg);color:var(--blue);border-radius:5px;text-decoration:none;font-weight:500;">'+(docLabels[d.doc_type]||d.doc_type)+'</a>'
      +'</div>'
      +'<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">'
      +'<button style="background:none;border:none;color:var(--ink3);cursor:pointer;padding:2px;" title="'+t('app.modifier')+'" onclick="editFleetDoc(\''+safeId+'\',\''+d.doc_type+'\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      +'<button style="background:none;border:none;color:var(--red);cursor:pointer;padding:2px;" title="'+t('app.supprimer')+'" onclick="deleteFleetDoc(\''+safeId+'\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>'
      +'</div></div>';
  }).join('');
}

window.openFleetDocModal=function(editId,editType){
  var titleEl=document.querySelector('#m-fleet-doc .modal-title');
  var typeEl=document.getElementById('fd-type');
  if(editId){
    window._editFleetDocId=editId;
    if(titleEl)titleEl.textContent='Remplacer le document';
    if(typeEl){typeEl.value=editType||'autre';typeEl.disabled=false;}
  } else {
    window._editFleetDocId=null;
    if(titleEl)titleEl.textContent='Ajouter un document soci\u00e9t\u00e9';
    if(typeEl){typeEl.disabled=false;typeEl.selectedIndex=0;}
  }
  var fi=document.getElementById('fd-file');if(fi)fi.value='';
  document.getElementById('fd-err').classList.remove('show');
  checkFleetDocTypeStatus();
  openModal('m-fleet-doc');
};

window.checkFleetDocTypeStatus=function(){
  var typeEl=document.getElementById('fd-type');
  var statusDiv=document.getElementById('fd-type-status');
  if(!typeEl||!statusDiv)return;
  var selectedType=typeEl.value;
  var existing=_fleetDocsData.find(function(d){return d.doc_type===selectedType;});
  if(existing){
    statusDiv.style.display='block';
    statusDiv.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;">'
      +'<span style="display:flex;align-items:center;gap:6px;">'
      +'<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      +'<span style="font-weight:500;color:var(--green);">'+t('app2.document_deja_ajoute')+'</span></span>'
      +'<a href="'+existing.file_url+'" target="_blank" style="font-size:11px;color:var(--blue);text-decoration:none;">'+t('app.voir_le_pdf')+'</a>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--ink4);margin-top:2px;">'+t('app.un_nouveau_fichier_remplacera_le')+'</div>';
    statusDiv.style.background='var(--green-bg)';
  } else {
    statusDiv.style.display='none';
  }
};

window.editFleetDoc=function(id,docType){openFleetDocModal(id,docType);};

window.saveFleetDoc=async function(){
  var errEl=document.getElementById('fd-err');
  var fileInput=document.getElementById('fd-file');
  var typeEl=document.getElementById('fd-type');
  if(!fileInput.files[0]){showError(errEl,t('app2.veuillez_selectionner_un_fichier_pdf'));return;}
  try{
    var url=await _uploadFleetFile(fileInput.files[0],'company');
    // Check if editing existing or if this type already has a doc (auto-replace)
    var existingDoc=window._editFleetDocId
      ? _fleetDocsData.find(function(d){return d.id===window._editFleetDocId;})
      : _fleetDocsData.find(function(d){return d.doc_type===typeEl.value;});
    if(existingDoc){
      // Delete old file from storage
      var oldPath=_storagePathFromUrl(existingDoc.file_url);
      if(oldPath){try{await sb.storage.from('fleet-docs').remove([oldPath]);}catch(e){}}
      var {error}=await sb.rpc('api_doc_save',{ p_kind:'fleet', p_owner:null, p_doc:existingDoc.id, p:{doc_name:fileInput.files[0].name,file_url:url} });
      if(error)throw error;
      showToast(t('app2.document_remplace'));
    } else {
      var {error}=await sb.rpc('api_doc_save',{ p_kind:'fleet', p_owner:null, p_doc:null, p:{doc_type:typeEl.value,doc_name:fileInput.files[0].name,file_url:url} });
      if(error)throw error;
      showToast(t('app2.document_ajoute'));
    }
    window._editFleetDocId=null;
    closeModal('m-fleet-doc');fileInput.value='';
    await loadFleetDocs();
  }catch(e){showError(errEl,e.message||'Erreur');}
};

function _fleetConfirm(title,msg,cb){
  var t=document.getElementById('fleet-confirm-title');if(t)t.textContent=title;
  var m=document.getElementById('fleet-confirm-msg');if(m)m.textContent=msg;
  window._fleetConfirmCb=async function(){closeModal('m-fleet-confirm');await cb();};
  openModal('m-fleet-confirm');
}

window.deleteFleetDoc=function(id){
  _fleetConfirm('Supprimer ce document ?','Le fichier sera d\u00e9finitivement supprim\u00e9.',async function(){
    // Find the doc to get file_url for storage deletion
    var doc=_fleetDocsData.find(function(d){return d.id===id;});
    if(doc&&doc.file_url){
      var storagePath=_storagePathFromUrl(doc.file_url);
      if(storagePath){try{await sb.storage.from('fleet-docs').remove([storagePath]);}catch(e){}}
    }
    await sb.rpc('api_doc_delete',{ p_kind:'fleet', p_doc:id });
    await loadFleetDocs();showToast(t('app2.document_supprime'));
  });
};

// ── Car Brands & Models ──
var CAR_BRANDS_MODELS={
  'Audi':['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','e-tron','RS3','RS6','TT','A6 e-tron','Q4 e-tron','Q6 e-tron','Q8 e-tron','e-tron GT'],
  'BMW':['S\u00e9rie 1','S\u00e9rie 2','S\u00e9rie 3','S\u00e9rie 4','S\u00e9rie 5','S\u00e9rie 7','X1','X2','X3','X4','X5','X6','X7','iX','i4','i7','M3','M5','S\u00e9rie 8','i5','iX1','iX2','iX3','XM'],
  'Mercedes-Benz':['Classe A','Classe B','Classe C','Classe E','Classe S','CLA','CLS','GLA','GLB','GLC','GLE','GLS','EQA','EQB','EQE','EQS','Vito','Classe V','Sprinter','CLE','Classe G','AMG GT','EQE SUV','EQS SUV','EQV','eVito','eSprinter','Tourismo','Travego','Intouro'],
  'Volkswagen':['Golf','Passat','Arteon','Touareg','Tiguan','T-Roc','ID.3','ID.4','Multivan','Transporter','ID.5','ID.7','ID. Buzz','Caravelle','Crafter','Tayron'],
  'Volvo':['S60','S90','V60','V90','XC40','XC60','XC90','C40','EX30','EX40','EC40','EX90','ES90','9700','9900'],
  'Lexus':['ES','IS','LS','NX','RX','UX','LX','RZ','LBX','LM'],
  'Tesla':['Model 3','Model S','Model X','Model Y'],
  'Peugeot':['208','308','408','508','3008','5008','e-208','e-2008','Rifter','Traveller','e-308','e-3008','e-5008','Expert','e-Traveller'],
  'Renault':['Clio','M\u00e9gane','Talisman','Austral','Espace','Koleos','Zoe','Kangoo','Sc\u00e9nic E-Tech','Rafale','Symbioz','Renault 5','Trafic','Master'],
  'Citro\u00ebn':['C3','C4','C5 X','C5 Aircross','SpaceTourer','Berlingo','\u00eb-C3','\u00eb-C4','\u00eb-C4 X','\u00eb-SpaceTourer','Jumpy','Jumper'],
  'Toyota':['Corolla','Camry','Prius','C-HR','RAV4','Land Cruiser','Yaris','Proace','bZ4X','Mirai','Yaris Cross','Proace Verso','Proace City'],
  'Hyundai':['i20','i30','Elantra','Tucson','Santa Fe','IONIQ 5','IONIQ 6','Staria','IONIQ 9','Kona','Inster'],
  'Kia':['Ceed','Stinger','EV6','Sportage','Sorento','Carnival','Niro','EV3','EV4','EV9','PV5'],
  'Skoda':['Octavia','Superb','Kodiaq','Karoq','Enyaq','Elroq','Kamiq','Scala'],
  'Seat':['Leon','Toledo','Tarraco','Ateca','Ibiza','Arona'],
  'Ford':['Focus','Mondeo','Galaxy','S-Max','Kuga','Explorer','Transit Custom','Tourneo','Mustang Mach-E','Capri','Puma','Tourneo Custom','Transit'],
  'Opel':['Astra','Insignia','Grandland','Mokka','Vivaro','Zafira','Corsa','Frontera','Movano'],
  'Jaguar':['XE','XF','XJ','F-Pace','I-Pace','F-Type','E-Pace'],
  'Land Rover':['Discovery','Discovery Sport','Range Rover','Range Rover Sport','Range Rover Velar','Range Rover Evoque','Defender'],
  'Porsche':['Panamera','Cayenne','Taycan','Macan','911'],
  'Maserati':['Ghibli','Quattroporte','Levante','Grecale','GranTurismo'],
  'Rolls-Royce':['Ghost','Phantom','Cullinan','Spectre','Wraith','Dawn'],
  'Bentley':['Continental GT','Bentayga','Flying Spur','Mulsanne'],
  'Maybach':['Classe S','GLS'],
  // ── Marques ajout\u00e9es ──
  'BYD':['Dolphin','Dolphin Surf','Atto 2','Atto 3','Seal','Seal U','Seal U DM-i','Sealion 7','Han','Tang'],
  'MG':['MG3','MG4','MG5','ZS','HS','Marvel R','S5 EV','Cyberster'],
  'Polestar':['Polestar 2','Polestar 3','Polestar 4'],
  'Cupra':['Born','Formentor','Leon','Tavascan','Terramar'],
  'Dacia':['Sandero','Spring','Jogger','Duster','Bigster'],
  'Nissan':['Micra','Juke','Qashqai','X-Trail','Leaf','Ariya','Townstar','Primastar','Interstar'],
  'Mazda':['Mazda2','Mazda3','Mazda6','CX-30','CX-5','CX-60','CX-80','MX-30'],
  'Honda':['Jazz','Civic','HR-V','ZR-V','CR-V','e:Ny1'],
  'Genesis':['G70','G80','G90','GV60','GV70','GV80'],
  'Lynk & Co':['01','02','08'],
  'NIO':['ET5','ET5 Touring','ET7','EL6','EL7','EL8'],
  'XPeng':['G6','G9','P7','X9'],
  'Zeekr':['001','7X','X'],
  'Leapmotor':['T03','B10','C10'],
  'Smart':['#1','#3','#5'],
  'Fiat':['500e','600','Tipo','Doblo','Scudo','Ducato'],
  'Jeep':['Avenger','Renegade','Compass','Grand Cherokee'],
  'DS':['DS 3','DS 4','DS 7','DS 9','N\u00b04'],
  'Alfa Romeo':['Giulia','Stelvio','Tonale','Junior'],
  'Mini':['Cooper','Countryman','Aceman'],
  'Suzuki':['Swift','Vitara','S-Cross','Across'],
  'Mitsubishi':['ASX','Eclipse Cross','Outlander'],
  'Cadillac':['Lyriq','Optiq','Escalade'],
  'Aston Martin':['DB12','DBX','Vantage'],
  'Lucid':['Air','Gravity'],
  // ── Bus & autocars ──
  'Setra':['ComfortClass','TopClass','MultiClass'],
  'Irizar':['i4','i6','i6S','i8'],
  'VDL':['Futura','Citea'],
  'Van Hool':['TX','EX','Astromega'],
  'Iveco':['Daily','Crossway','Evadys'],
  'MAN':['TGE','Lion\'s Coach','Lion\'s Intercity'],
  'Neoplan':['Tourliner','Cityliner','Skyliner'],
  'Scania':['Touring','Interlink'],
  'Temsa':['HD','MD','LD'],
  'Altro':['Autre']
};

window.populateVehBrands=function(){
  var sel=document.getElementById('veh-brand');if(!sel)return;
  sel.innerHTML='<option value="">'+t('app.choisir')+'</option>';
  Object.keys(CAR_BRANDS_MODELS).sort().forEach(function(b){
    var opt=document.createElement('option');opt.value=b;opt.textContent=b;sel.appendChild(opt);
  });
};

window.populateVehModels=function(){
  var brand=document.getElementById('veh-brand').value;
  var sel=document.getElementById('veh-model');if(!sel)return;
  sel.innerHTML='';
  if(!brand){sel.innerHTML='<option value="">'+t('app.choisir_une_marque')+'</option>';return;}
  var models=CAR_BRANDS_MODELS[brand]||['Autre'];
  sel.innerHTML='<option value="">'+t('app2.choisir_un_modele')+'</option>';
  models.forEach(function(m){var opt=document.createElement('option');opt.value=m;opt.textContent=m;sel.appendChild(opt);});
};

// ── Fleet Vehicles ──
async function loadFleetVehicles(){
  var el=document.getElementById('fleet-vehicles-list');if(!el)return;
  var {data,error}=await sb.from('fleet_vehicles').select('*').eq('fleet_id',currentUser.id).eq('active',true).order('created_at',{ascending:false});
  _fleetVehicles=data||[];
  var statusEl=document.getElementById('fleet-vehicles-status');
  if(statusEl)statusEl.innerHTML=_sectionStatusHtml(_fleetVehicles);
  if(!data||data.length===0){el.innerHTML='<div style="color:var(--ink4);font-size:12px;">'+t('app2.aucun_vehicule_ajoute')+'</div>';return;}
  // Fetch all vehicle docs for these vehicles
  var vehIds=data.map(function(v){return v.id;});
  var {data:allVehDocs}=await sb.from('vehicle_documents').select('*').in('vehicle_id',vehIds);
  var vehDocsMap={};
  (allVehDocs||[]).forEach(function(d){if(!vehDocsMap[d.vehicle_id])vehDocsMap[d.vehicle_id]=[];vehDocsMap[d.vehicle_id].push(d);});
  var classLabels={lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'};
  var vehDocLabels={carte_grise:'Carte grise',assurance:'Assurance',controle_technique:'CT',vignette_identification:'Vignette'};
  el.innerHTML=data.map(function(v){
    var safeId=v.id.replace(/'/g,'');
    var docs=vehDocsMap[v.id]||[];
    var docsHtml=docs.length>0
      ?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'+docs.map(_docBadge).join('')+'</div>'
      :'';
    var amenIcons={
      electric:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      hybrid:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17.01l.01-.011M12 17.01l.01-.011M17 17.01l.01-.011M7 12.01l.01-.011M12 12.01l.01-.011M17 12.01l.01-.011"/><path d="M2 5v14a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2z"/></svg>',
      wifi:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0114 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.94 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>',
      water:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>',
      snacks:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>'
    };
    var amenLabels={electric:'100% \u00e9lectrique',hybrid:'Hybride',wifi:'Wi-Fi',water:'Eau',snacks:'Snacks'};
    var vAmen=v.amenities||[];
    var amenHtml=vAmen.length>0
      ?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'+vAmen.map(function(a){
        return '<span style="font-size:10px;padding:2px 6px;background:var(--sand2);color:var(--ink2);border-radius:4px;display:inline-flex;align-items:center;gap:3px;">'+(amenIcons[a]||'')+' '+(amenLabels[a]||a)+'</span>';
      }).join('')+'</div>'
      :'';
    var vStatus=v.status||'pending';
    var vStatusBadge=vStatus==='validated'
      ?'<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--green-bg);color:var(--green);font-weight:600;margin-left:8px;">'+t('app2.valide')+'</span>'
      :vStatus==='rejected'
        ?'<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--red-bg);color:var(--red);font-weight:600;margin-left:8px;">'+t('app2.rejete')+'</span>'
        :'<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-weight:600;margin-left:8px;">'+t('app.en_attente')+'</span>';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--sand2);">'
      +'<div style="flex:1;min-width:0;"><div style="font-weight:500;font-size:13px;display:flex;align-items:center;">'+v.brand+' '+v.model+vStatusBadge+'</div>'
      +'<div style="font-size:11px;color:var(--ink4);">'+(v.color||'')+' \u00b7 '+(classLabels[v.vehicle_class]||v.vehicle_class)+(v.plate?' \u00b7 '+v.plate:'')+'</div>'
      +amenHtml+docsHtml+'</div>'
      +'<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">'
      +'<button style="background:none;border:none;color:var(--ink3);cursor:pointer;padding:2px;" title="'+t('app.modifier')+'" onclick="editVehicle(\''+safeId+'\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      +'<button style="background:none;border:none;color:var(--red);cursor:pointer;padding:2px;" title="'+t('app.supprimer')+'" onclick="deleteVehicle(\''+safeId+'\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>'
      +'</div></div>';
  }).join('');
}

// Seats rule per vehicle class:
// lowcost: default 3, editable (min 3) | business/luxe: 3 fixed | van: 7 fixed | bus: free
var _VEH_FIXED_SEATS={business:3, luxe:3, van:7};
window._applyVehSeatsRule=function(reset){
  var cls=document.getElementById('veh-class');
  var seats=document.getElementById('veh-seats');
  if(!cls||!seats)return;
  var c=cls.value;
  if(_VEH_FIXED_SEATS[c]){
    seats.value=_VEH_FIXED_SEATS[c];
    seats.readOnly=true; seats.min=_VEH_FIXED_SEATS[c];
    seats.style.opacity='0.6'; seats.style.cursor='not-allowed';
  } else {
    seats.readOnly=false; seats.style.opacity=''; seats.style.cursor='';
    if(c==='lowcost'){
      seats.min=3;
      if(reset || !(parseInt(seats.value,10)>=3)) seats.value=3;
    } else {
      seats.min=1;
      if(reset) seats.value='';
    }
  }
};

// ── Fleet documents: required files + validity date ──
var _VEH_DOCS=[{id:'veh-doc-cg',type:'carte_grise',label:"Certificat d'immatriculation"},{id:'veh-doc-assurance',type:'assurance',label:"Certificat d'assurance"},{id:'veh-doc-ct',type:'controle_technique',label:'Contrôle technique'},{id:'veh-doc-vignette',type:'vignette_identification',label:"Vignette d'identification"}];
var _DRV_DOCS=[{id:'drv-doc-permis',type:'permis_conduire',label:'Permis de conduire'},{id:'drv-doc-id',type:'carte_identite',label:"Carte d'identité"},{id:'drv-doc-capa',type:'certificat_capacite',label:'Certificat de capacité'}];
var _DOC_LABELS={carte_grise:'Carte grise',assurance:'Assurance',controle_technique:'CT',vignette_identification:'Vignette',permis_conduire:'Permis',carte_identite:"Carte d'identité",certificat_capacite:'Certificat de capacité',carte_vtc:'Carte VTC'};
var _VEH_MAX_AGE=7;
function _docToday(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _docFmt(iso){ if(!iso) return ''; var p=String(iso).slice(0,10).split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function _docFormReset(defs){
  defs.forEach(function(d){
    var fi=document.getElementById(d.id), ex=document.getElementById(d.id+'-exp');
    if(fi){ fi.value=''; fi.style.display=''; fi.disabled=false; var row=fi.closest('.doc-row'); if(row){ var t=row.querySelector('.doc-exists-tag'); if(t) t.remove(); } }
    if(ex){ ex.value=''; ex.disabled=false; ex.min=_docToday(); }
  });
}
function _docFormFill(defs, existing){
  _docFormReset(defs);
  defs.forEach(function(d){
    var doc=existing[d.type], fi=document.getElementById(d.id), ex=document.getElementById(d.id+'-exp');
    if(!doc||!fi) return;
    fi.style.display='none';
    var wrap=fi.closest('.doc-file-wrap')||fi.parentElement;
    var tag=document.createElement('div'); tag.className='doc-exists-tag';
    tag.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;';
    tag.innerHTML='<a href="'+doc.file_url+'" target="_blank" style="padding:2px 8px;background:var(--green-bg);color:var(--green);border-radius:4px;text-decoration:none;font-weight:600;">'+t('app.document_ajoute')+'</a>'
      +'<button type="button" style="background:none;border:none;color:var(--blue);font-weight:600;font-size:11.5px;cursor:pointer;padding:0;">'+t('app.remplacer')+'</button>';
    tag.querySelector('button').onclick=function(){ fi.style.display=''; fi.click(); tag.remove(); };
    wrap.appendChild(tag);
    if(ex) ex.value=doc.expires_at?String(doc.expires_at).slice(0,10):'';
  });
}
function _docFormValidate(defs, existing){
  var today=_docToday();
  for(var i=0;i<defs.length;i++){
    var d=defs[i], fi=document.getElementById(d.id), ex=document.getElementById(d.id+'-exp');
    var hasFile=fi&&fi.files&&fi.files.length>0, exp=ex?ex.value:'';
    if(!hasFile && !existing[d.type]) return 'Document obligatoire : '+d.label;
    if(!exp) return 'Date de validité obligatoire : '+d.label;
    if(exp<=today) return d.label+' : document expiré — ajoutez un document en cours de validité';
  }
  return null;
}
async function _docFormSave(defs, existing, table, fk, fkVal, folder){
  var errors=[];
  for(var i=0;i<defs.length;i++){
    var d=defs[i], fi=document.getElementById(d.id), ex=document.getElementById(d.id+'-exp');
    var file=fi&&fi.files&&fi.files[0], exp=ex&&ex.value?ex.value:null, old=existing[d.type];
    try{
      if(file){
        var url=await _uploadFleetFile(file, folder);
        var r;
        var _kind = table==='driver_documents' ? 'driver' : 'vehicle';
        r=await sb.rpc('api_doc_save',{ p_kind:_kind, p_owner:fkVal, p_doc: old ? old.id : null, p:{doc_type:d.type,doc_name:file.name,file_url:url,expires_at:exp} });
        if(r.error) throw r.error;
      } else if(old && String(old.expires_at||'').slice(0,10)!==(exp||'')){
        var u=await sb.rpc('api_doc_save',{ p_kind: table==='driver_documents' ? 'driver' : 'vehicle', p_owner:fkVal, p_doc:old.id, p:{expires_at:exp} });
        if(u.error) throw u.error;
      }
    }catch(e){ console.error('[docs] '+d.type,e); errors.push(d.label+' : '+(e.message||e)); }
  }
  return errors;
}
// Badge for lists (fleet & admin): label + validity, amber < 30 days, red when expired
function _docBadge(dc){
  var lbl=_DOC_LABELS[dc.doc_type]||dc.doc_type, bg='var(--blue-bg)', col='var(--blue)', extra='';
  if(dc.expires_at){
    var days=Math.floor((new Date(String(dc.expires_at).slice(0,10)+'T23:59:59')-new Date())/86400000);
    extra=' · '+(days<0?'expiré':'exp. '+_docFmt(dc.expires_at));
    if(days<0){ bg='var(--red-bg)'; col='var(--red)'; } else if(days<=30){ bg='var(--amber-bg)'; col='var(--amber)'; }
  }
  return '<a href="'+dc.file_url+'" target="_blank" style="font-size:10px;padding:2px 7px;background:'+bg+';color:'+col+';border-radius:4px;text-decoration:none;font-weight:500;white-space:nowrap;">'+lbl+extra+'</a>';
}
var _LICENSE_LABELS={bruxelles:'Licence bruxelloise',wallonie:'Licence wallonne',flandre:'Licence flamande'};

window.openVehicleModal=function(){
  window._editVehicleId=null;
  window._editVehicleDocsOnly=false;
  var titleEl=document.querySelector('#m-vehicle .modal-title');if(titleEl)titleEl.textContent='Ajouter un v\u00e9hicule';
  // Re-enable all fields
  ['veh-brand','veh-model','veh-year','veh-color','veh-plate','veh-class'].forEach(function(id){var e=document.getElementById(id);if(e)e.disabled=false;});
  ['electric','hybrid','wifi','water','snacks'].forEach(function(a){var cb=document.getElementById('veh-amen-'+a);if(cb)cb.disabled=false;});
  var notice=document.getElementById('veh-validated-notice');if(notice)notice.style.display='none';
  populateVehBrands();
  ['veh-year','veh-color','veh-plate'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  var brand=document.getElementById('veh-brand');if(brand)brand.value='';
  populateVehModels();
  var cls=document.getElementById('veh-class');if(cls)cls.value='lowcost';
  var seatsEl=document.getElementById('veh-seats');if(seatsEl){seatsEl.disabled=false;seatsEl.value='';}
  _applyVehSeatsRule(true);
  _docFormReset(_VEH_DOCS); window._vehExistingDocs={};
  var vErr=document.getElementById('veh-err'); if(vErr) vErr.classList.remove('show');
  ['electric','hybrid','wifi','water','snacks'].forEach(function(a){var cb=document.getElementById('veh-amen-'+a);if(cb)cb.checked=false;});
  openModal('m-vehicle');
};

window.saveVehicle=async function(){
  var errEl=document.getElementById('veh-err');
  var brand=(document.getElementById('veh-brand').value||'').trim();
  var model=(document.getElementById('veh-model').value||'').trim();
  var year=parseInt(document.getElementById('veh-year').value)||null;
  var color=(document.getElementById('veh-color').value||'').trim();
  var vclass=document.getElementById('veh-class').value;
  var plate=(document.getElementById('veh-plate').value||'').trim();
  if(!brand||!model){showError(errEl,t('app2.marque_et_modele_sont_requis'));return;}
  if(!window._editVehicleDocsOnly){
    if(!year){showError(errEl,t('app2.annee_du_vehicule_requise'));return;}
    if(new Date().getFullYear()-year>_VEH_MAX_AGE){showError(errEl,t('app2.selon_la_legislation_le_vehicule')+_VEH_MAX_AGE+' ans maximum ('+(new Date().getFullYear()-_VEH_MAX_AGE)+' ou plus r\u00e9cent).');return;}
  }
  var _vDocErr=_docFormValidate(_VEH_DOCS, window._vehExistingDocs||{});
  if(_vDocErr){showError(errEl,_vDocErr);return;}
  var seatsInp=document.getElementById('veh-seats');
  var seatsLocked=!!(seatsInp&&seatsInp.disabled); // validated vehicle: seats not editable, keep stored value
  var seats=parseInt(seatsInp?seatsInp.value:'',10);
  if(!seatsLocked){
    if(_VEH_FIXED_SEATS[vclass]) seats=_VEH_FIXED_SEATS[vclass];
    if(!(seats>0)){showError(errEl,t('app.nombre_de_places_assises_requis'));return;}
    if(vclass==='lowcost'&&seats<3){showError(errEl,t('app.economy_minimum_3_places_assises'));return;}
  }
  // Read amenities checkboxes
  var amenities=[];
  ['electric','hybrid','wifi','water','snacks'].forEach(function(a){
    var cb=document.getElementById('veh-amen-'+a);
    if(cb&&cb.checked)amenities.push(a);
  });
  try{
    var vehId=window._editVehicleId;
    if(vehId){
      var _vUpd={brand:brand,model:model,year:year,color:color||null,vehicle_class:vclass,plate:plate||null,amenities:amenities};
      if(!seatsLocked)_vUpd.seats=seats;
      var {error}=await sb.rpc('api_vehicle_save',{ p_id:vehId, p:_vUpd });
      if(error)throw error;
    } else {
      var {data:veh,error}=await sb.rpc('api_vehicle_save',{ p_id:null, p:{brand:brand,model:model,year:year,color:color||null,vehicle_class:vclass,plate:plate||null,amenities:amenities,seats:seats} });
      if(error)throw error;
      vehId=veh.id;
    }
    // Upload vehicle docs (+ validity dates)
    var docErrors=await _docFormSave(_VEH_DOCS, window._vehExistingDocs||{}, 'vehicle_documents', 'vehicle_id', vehId, 'vehicles/'+vehId);
    window._editVehicleId=null;
    closeModal('m-vehicle');
    await loadFleetVehicles();
    if(docErrors.length>0){showToast(t('app2.vehicule_sauve_erreur_docs')+docErrors.join(', '));}
    else{showToast(t('app2.vehicule_sauve'));}
  }catch(e){showError(errEl,e.message||'Erreur');}
};

window.editVehicle=async function(id, docsOnly){
  var v=_fleetVehicles.find(function(x){return x.id===id;});
  if(!v)return;
  var isValidated = docsOnly || v.status==='validated';
  populateVehBrands();
  var brandEl=document.getElementById('veh-brand');if(brandEl){brandEl.value=v.brand;brandEl.disabled=isValidated;}
  populateVehModels();
  var modelEl=document.getElementById('veh-model');if(modelEl){modelEl.value=v.model;modelEl.disabled=isValidated;}
  var setField=function(sid,val){var e=document.getElementById(sid);if(e){e.value=val||'';e.disabled=isValidated;}};
  setField('veh-year',v.year||'');setField('veh-color',v.color||'');setField('veh-plate',v.plate||'');
  var cls=document.getElementById('veh-class');if(cls){cls.value=v.vehicle_class||'lowcost';cls.disabled=isValidated;}
  var seatsEl=document.getElementById('veh-seats');if(seatsEl){seatsEl.value=v.seats||'';seatsEl.disabled=isValidated;}
  _applyVehSeatsRule(false);
  // Amenities
  var vAmen=v.amenities||[];
  ['electric','hybrid','wifi','water','snacks'].forEach(function(a){
    var cb=document.getElementById('veh-amen-'+a);
    if(cb){cb.checked=vAmen.indexOf(a)>=0;cb.disabled=isValidated;}
  });
  // Show validated notice
  var noticeEl=document.getElementById('veh-validated-notice');
  if(!noticeEl){
    var form=document.querySelector('#m-vehicle .modal-body');
    if(form){
      var n=document.createElement('div');n.id='veh-validated-notice';
      n.style.cssText='padding:8px 12px;background:var(--green-bg);border-radius:var(--r);font-size:12px;color:var(--green);font-weight:500;margin-bottom:12px;';
      n.textContent='✓ Véhicule validé — seuls les documents peuvent être modifiés.';
      form.prepend(n);
    }
  } else {
    noticeEl.style.display = isValidated ? 'block' : 'none';
  }
  // Docs
  var {data:existDocs}=await sb.from('vehicle_documents').select('*').eq('vehicle_id',id);
  var uploadedTypes={};
  (existDocs||[]).forEach(function(d){uploadedTypes[d.doc_type]=d;});
  window._vehExistingDocs=uploadedTypes;
  _docFormFill(_VEH_DOCS, uploadedTypes);
  var vErr=document.getElementById('veh-err'); if(vErr) vErr.classList.remove('show');
  window._editVehicleId=id;
  window._editVehicleDocsOnly=isValidated;
  var titleEl=document.querySelector('#m-vehicle .modal-title');
  if(titleEl)titleEl.textContent=isValidated?'Documents du v\u00e9hicule':'Modifier le v\u00e9hicule';
  openModal('m-vehicle');
};

window.deleteVehicle=function(id){
  _fleetConfirm('Supprimer ce v\u00e9hicule ?','Le v\u00e9hicule et ses documents seront d\u00e9finitivement supprim\u00e9s.',async function(){
    // Delete vehicle docs from storage + DB
    var {data:vDocs}=await sb.from('vehicle_documents').select('*').eq('vehicle_id',id);
    if(vDocs&&vDocs.length>0){
      var paths=vDocs.map(function(d){return _storagePathFromUrl(d.file_url);}).filter(Boolean);
      if(paths.length>0){try{await sb.storage.from('fleet-docs').remove(paths);}catch(e){}}
    }
    var _dv=await sb.rpc('api_vehicle_delete',{ p_id:id });
    if(_dv.error){ showToast(t('app.suppression_impossible')+_dv.error.message); return; }
    await loadFleetVehicles();showToast(t('app2.vehicule_supprime'));
  });
};

// ── Confirmed mission: fleet changes the vehicle and/or the driver, client is emailed ──
var _maRide=null, _maOffer=null;
window.openMissionAssignment=async function(rideId){
  if(!sb||!currentUser) return;
  var {data:r}=await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
  if(!r||r.driver_id!==currentUser.id){ showToast(t('app.mission_introuvable')); return; }
  var {data:of}=await sb.from('offers').select('*').eq('ride_id',rideId).eq('driver_id',currentUser.id).eq('status','accepted').maybeSingle();
  var res=await Promise.all([
    sb.from('fleet_vehicles').select('*').eq('fleet_id',currentUser.id).eq('active',true),
    sb.from('fleet_drivers').select('*').eq('fleet_id',currentUser.id).eq('active',true)
  ]);
  _maRide=r; _maOffer=of||null;
  var e=_billingEsc;
  var vehicles=(res[0].data||[]).filter(function(v){ return v.status==='validated' && _vehFitsRide(v, r.vehicle_type, r.passengers); });
  var drivers=(res[1].data||[]).filter(function(d){ return d.status==='validated'; });
  var curV=of?of.vehicle_id:null, curD=of?of.fleet_driver_id:null;
  var vOpts=vehicles.map(function(v){ return '<option value="'+v.id+'"'+(v.id===curV?' selected':'')+'>'+e(((v.brand||'')+' '+(v.model||'')).trim())+(v.plate?' — '+e(v.plate):'')+' ('+e(_DOC_CLASSES[v.vehicle_class]||v.vehicle_class||'')+')</option>'; }).join('');
  if(curV && !vehicles.some(function(v){return v.id===curV;})) vOpts='<option value="'+curV+'" selected>'+t('app.vehicule_actuel')+'</option>'+vOpts;
  var dOpts='<option value="">'+t('app.non_assigne')+'</option>'+drivers.map(function(d){ return '<option value="'+d.id+'"'+(d.id===curD?' selected':'')+'>'+e(((d.first_name||'')+' '+(d.last_name||'')).trim())+(d.phone?' — '+e(d.phone):'')+'</option>'; }).join('');
  if(curD && !drivers.some(function(d){return d.id===curD;})) dOpts+='<option value="'+curD+'" selected>'+t('app.chauffeur_actuel')+'</option>';
  document.getElementById('m-mission-assign')?.remove();
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-overlay open" id="m-mission-assign" style="z-index:950;" onclick="if(event.target===this)this.remove()"><div class="modal">'
    +'<div class="modal-hd"><span class="modal-title">'+t('app.modifier_vehicule_chauffeur')+'</span><button class="close-btn" onclick="document.getElementById(\'m-mission-assign\').remove()"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>'
    +'<div class="modal-body">'
      +'<div style="font-size:12.5px;color:var(--ink3);margin-bottom:14px;">'+t('app.mission')+' '+e(r.booking_code||r.id.slice(0,8))+' — '+_docIso(r.ride_date)+(r.ride_time?' à '+String(r.ride_time).slice(0,5):'')+t('app.le_client_sera_prevenu_par')+'</div>'
      +'<div class="input-group"><label>'+t('app.vehicule')+' <span style="color:var(--red)">*</span></label><select id="ma-vehicle">'+(vOpts||'<option value="">'+t('app.aucun_vehicule_valide_compatible')+'</option>')+'</select>'
        +'<div style="font-size:11px;color:var(--ink3);margin-top:4px;">'+t('app.vehicules_valides_compatibles_avec_la')+e(_DOC_CLASSES[r.vehicle_type]||r.vehicle_type||'—')+').</div></div>'
      +'<div class="input-group"><label>'+t('app.chauffeur')+'</label><select id="ma-driver">'+dOpts+'</select></div>'
      +'<div id="ma-err" class="auth-error"></div>'
    +'</div>'
    +'<div class="modal-ft"><button class="btn btn-secondary" onclick="document.getElementById(\'m-mission-assign\').remove()">'+t('app.annuler')+'</button>'
    +'<button class="btn btn-primary" id="ma-save" onclick="saveMissionAssignment()">'+t('app.enregistrer')+'</button></div>'
    +'</div></div>');
};

window.saveMissionAssignment=async function(){
  var r=_maRide; if(!r) return;
  var err=document.getElementById('ma-err'), btn=document.getElementById('ma-save');
  var vId=document.getElementById('ma-vehicle')?.value||'';
  var dId=document.getElementById('ma-driver')?.value||'';
  if(err) err.classList.remove('show');
  if(!vId){ showError(err,t('app.choisissez_un_vehicule')); return; }
  var oldV=_maOffer?_maOffer.vehicle_id:null, oldD=_maOffer?_maOffer.fleet_driver_id:null;
  var vChanged=vId!==(oldV||''), dChanged=(dId||null)!==(oldD||null);
  if(!vChanged && !dChanged){ document.getElementById('m-mission-assign')?.remove(); return; }
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement...'; }
  try{
    // Fonction serveur (vérifie la mission, le véhicule et le chauffeur de la flotte)
    var rpc=await sb.rpc('fleet_update_assignment',{ p_ride:r.id, p_vehicle:vId, p_driver:dId||null });
    if(rpc.error) throw new Error(rpc.error.message||'Modification refusée');
    // Email the client (or the driver who posted the subcontract)
    var veh=null, drv=null;
    try{
      veh=(await sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',vId).maybeSingle()).data;
      if(dId) drv=(await sb.from('fleet_drivers').select('first_name,last_name,phone').eq('id',dId).maybeSingle()).data;
    }catch(_e){}
    var chg=[]; if(vChanged) chg.push('véhicule'); if(dChanged) chg.push('chauffeur');
    var mail=window._mailRideData(r,{
      vehicle: veh?(((veh.brand||'')+' '+(veh.model||'')+' '+(veh.color||'')).trim()+(veh.plate?' ('+veh.plate+')':'')):'',
      driver: drv?((drv.first_name||'')+' '+(drv.last_name||'')).trim():'',
      driverPhone: drv&&drv.phone?drv.phone:'',
      changes: chg.join(' et ')
    });
    delete mail.price;
    // Email « véhicule / chauffeur modifié » : envoyé par la base (ride_driver_emails.sql)
    document.getElementById('m-mission-assign')?.remove();
    showToast(t('app.mission_mise_a_jour_le'));
    if(typeof loadMissions==='function') loadMissions();
    // Fiche de la course ouverte derrière : affiche tout de suite le nouveau véhicule / chauffeur
    if(_isOpen('m-ride-detail') && window._lastDetailRide && window._lastDetailRide.id===r.id){
      if(window._lastDetailAsg && window._lastDetailAsg.id===r.id) window._lastDetailAsg.sig='\u0000';
      _liveRefresh();
    }
  }catch(e){
    showError(err,t('app.erreur_2')+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent='Enregistrer'; }
  }
};

// ── Fleet Drivers ──
async function loadFleetDriversList(){
  var el=document.getElementById('fleet-drivers-list');if(!el)return;
  var {data,error}=await sb.from('fleet_drivers').select('*').eq('fleet_id',currentUser.id).eq('active',true).order('created_at',{ascending:false});
  _fleetDrivers=data||[];
  var statusEl=document.getElementById('fleet-drivers-status');
  if(statusEl)statusEl.innerHTML=_sectionStatusHtml(_fleetDrivers);
  if(!data||data.length===0){el.innerHTML='<div style="color:var(--ink4);font-size:12px;">'+t('app2.aucun_chauffeur_ajoute')+'</div>';return;}
  // Fetch all driver docs
  var drvIds=data.map(function(d){return d.id;});
  var {data:allDrvDocs}=await sb.from('driver_documents').select('*').in('driver_id',drvIds);
  var drvDocsMap={};
  (allDrvDocs||[]).forEach(function(d){if(!drvDocsMap[d.driver_id])drvDocsMap[d.driver_id]=[];drvDocsMap[d.driver_id].push(d);});
  var drvDocLabels={permis_conduire:'Permis',carte_vtc:'Carte VTC'};
  el.innerHTML=data.map(function(d){
    var safeId=d.id.replace(/'/g,'');
    var docs=drvDocsMap[d.id]||[];
    var docsHtml=docs.length>0
      ?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'+docs.map(_docBadge).join('')+'</div>'
      :'';
    var dStatus=d.status||'pending';
    var dStatusBadge=dStatus==='validated'
      ?'<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--green-bg);color:var(--green);font-weight:600;margin-left:8px;">'+t('app2.valide')+'</span>'
      :dStatus==='rejected'
        ?'<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--red-bg);color:var(--red);font-weight:600;margin-left:8px;">'+t('app2.rejete')+'</span>'
        :'<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-weight:600;margin-left:8px;">'+t('app.en_attente')+'</span>';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--sand2);">'
      +'<div style="flex:1;min-width:0;"><div style="font-weight:500;font-size:13px;display:flex;align-items:center;">'+d.first_name+' '+d.last_name+dStatusBadge+'</div>'
      +'<div style="font-size:11px;color:var(--ink4);">'+[d.phone||'',d.email||'',_LICENSE_LABELS[d.license_region]||''].filter(Boolean).join(' \u00b7 ')+'</div>'
      +docsHtml+'</div>'
      +'<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">'
      +'<button style="background:none;border:none;color:var(--ink3);cursor:pointer;padding:2px;" title="'+t('app.modifier')+'" onclick="editDriver(\''+safeId+'\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      +'<button style="background:none;border:none;color:var(--red);cursor:pointer;padding:2px;" title="'+t('app.supprimer')+'" onclick="deleteDriver(\''+safeId+'\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>'
      +'</div></div>';
  }).join('');
}

window.openDriverModal=function(){
  window._editDriverId=null;
  var titleEl=document.querySelector('#m-driver .modal-title');if(titleEl)titleEl.textContent='Ajouter un chauffeur';
  ['drv-fname','drv-lname','drv-phone','drv-email'].forEach(function(id){var e=document.getElementById(id);if(e){e.value='';e.disabled=false;e.style.opacity='1';}});
  var notice=document.getElementById('drv-validated-notice');if(notice)notice.style.display='none';
  _docFormReset(_DRV_DOCS); window._drvExistingDocs={};
  var lic=document.getElementById('drv-license'); if(lic) lic.value='';
  document.getElementById('drv-err').classList.remove('show');
  openModal('m-driver');
};

window.editDriver=async function(id){
  var d=_fleetDrivers.find(function(x){return x.id===id;});
  if(!d)return;
  window._editDriverId=id;
  var isValidated = d.status==='validated';
  var titleEl=document.querySelector('#m-driver .modal-title');if(titleEl)titleEl.textContent='Modifier le chauffeur';
  var set=function(sid,val,disabled){var e=document.getElementById(sid);if(e){e.value=val||'';e.disabled=!!disabled;e.style.opacity=disabled?'0.5':'1';}};
  set('drv-fname',d.first_name,isValidated);
  set('drv-lname',d.last_name,isValidated);
  set('drv-phone',d.phone||'',false);
  set('drv-email',d.email||'',false);
  // Show/hide validated notice
  var notice=document.getElementById('drv-validated-notice');
  if(notice) notice.style.display=isValidated?'block':'none';
  var lic=document.getElementById('drv-license'); if(lic) lic.value=d.license_region||'';
  // Load existing docs
  var {data:existDocs}=await sb.from('driver_documents').select('*').eq('driver_id',id);
  var uploadedTypes={};
  (existDocs||[]).forEach(function(dc){uploadedTypes[dc.doc_type]=dc;});
  window._drvExistingDocs=uploadedTypes;
  _docFormFill(_DRV_DOCS, uploadedTypes);
  document.getElementById('drv-err').classList.remove('show');
  openModal('m-driver');
};

window.saveDriver=async function(){
  var errEl=document.getElementById('drv-err');
  var fname=(document.getElementById('drv-fname').value||'').trim();
  var lname=(document.getElementById('drv-lname').value||'').trim();
  var phone=(document.getElementById('drv-phone').value||'').trim();
  var email=(document.getElementById('drv-email').value||'').trim();
  if(!fname||!lname){showError(errEl,t('app2.prenom_et_nom_sont_requis'));return;}
  var license=(document.getElementById('drv-license')||{}).value||'';
  if(!license){showError(errEl,t('app.indiquez_la_licence_du_chauffeur'));return;}
  var _dDocErr=_docFormValidate(_DRV_DOCS, window._drvExistingDocs||{});
  if(_dDocErr){showError(errEl,_dDocErr);return;}
  try{
    var drvId=window._editDriverId;
    if(drvId){
      var {error}=await sb.rpc('api_fleet_driver_save',{ p_id:drvId, p:{first_name:fname,last_name:lname,phone:phone||null,email:email||null,license_region:license} });
      if(error)throw error;
    } else {
      var {data:drv,error}=await sb.rpc('api_fleet_driver_save',{ p_id:null, p:{first_name:fname,last_name:lname,phone:phone||null,email:email||null,license_region:license} });
      if(error)throw error;
      drvId=drv.id;
    }
    var docErrors=await _docFormSave(_DRV_DOCS, window._drvExistingDocs||{}, 'driver_documents', 'driver_id', drvId, 'drivers/'+drvId);
    window._editDriverId=null;
    closeModal('m-driver');
    await loadFleetDriversList();
    if(docErrors.length>0){showToast(t('app2.chauffeur_sauve_erreur_docs')+docErrors.join(', '));}
    else{showToast(t('app2.chauffeur_sauve'));}
  }catch(e){showError(errEl,e.message||'Erreur');}
};

window.deleteDriver=function(id){
  _fleetConfirm('Supprimer ce chauffeur ?','Le chauffeur et ses documents seront d\u00e9finitivement supprim\u00e9s.',async function(){
    // Delete driver docs from storage + DB
    var {data:dDocs}=await sb.from('driver_documents').select('*').eq('driver_id',id);
    if(dDocs&&dDocs.length>0){
      var paths=dDocs.map(function(d){return _storagePathFromUrl(d.file_url);}).filter(Boolean);
      if(paths.length>0){try{await sb.storage.from('fleet-docs').remove(paths);}catch(e){}}
    }
    var _dd=await sb.rpc('api_fleet_driver_delete',{ p_id:id });
    if(_dd.error){ showToast(t('app.suppression_impossible')+_dd.error.message); return; }
    await loadFleetDriversList();showToast(t('app2.chauffeur_supprime'));
  });
};

// ── Vehicle selection in offer modal ──
// Map vehicle_class compatibility: client requests X -> fleet vehicles of same or higher service level can serve
// Service levels (by convention in this app): 1.lowcost < 2.business < 3.van < 4.luxe
// A higher-level vehicle (e.g. luxe) may accept lower-level ride requests (gamme en dessous)
var _classCompat={
  any:['lowcost','business','van','luxe','bus'],
  lowcost:['lowcost','business','van','luxe'],
  business:['business','van','luxe'],
  van:['van'],
  luxe:['luxe'],
  bus:['bus']
};
// Places d'un véhicule (défaut selon la gamme, identique à _veh_seats de ride_rules.sql)
function _vehSeats(v){ return v&&v.seats!=null?parseInt(v.seats,10):(v&&v.vehicle_class==='van'?7:v&&v.vehicle_class==='bus'?50:3); }
function _vehFitsRide(v, cls, pax){ var al=cls?(_classCompat[cls]||[cls]):null; return (!al||al.indexOf(v.vehicle_class)>=0) && _vehSeats(v)>=Math.max(1,parseInt(pax,10)||1); }

function populateOfferVehicles(requestedClass, pax){
  var sel=document.getElementById('offer-vehicle-select');
  var errDiv=document.getElementById('offer-vehicle-err');
  var wrap=document.getElementById('offer-vehicle-wrap');
  if(!sel||!wrap)return;
  wrap.style.display='block';
  sel.innerHTML='<option value="">'+t('app2.choisir_un_vehicule')+'</option>';
  var matching=_fleetVehicles.filter(function(v){return v.status==='validated' && _vehFitsRide(v, requestedClass, pax);});
  if(matching.length===0){
    var _np=parseInt(pax,10)||1;
    if(errDiv){errDiv.style.display='block';errDiv.textContent='Aucun v\u00e9hicule '+(requestedClass&&requestedClass!=='any'?'de gamme '+(_DOC_CLASSES[requestedClass]||requestedClass)+' ':'')+(_np>3?'avec au moins '+_np+' places ':'')+'dans votre flotte. Ajoutez-en un dans votre profil.';}
    return;
  }
  if(errDiv)errDiv.style.display='none';
  var classLabels={lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'};
  var amenShort={electric:'\u26a1',hybrid:'\u2600',wifi:'WiFi',water:'\ud83d\udca7',snacks:'\u2615'};
  matching.forEach(function(v){
    var opt=document.createElement('option');
    opt.value=v.id;
    var platePart = v.plate ? ' ('+v.plate+')' : '';
    opt.textContent=v.brand+' '+v.model+platePart;
    sel.appendChild(opt);
  });
  if(matching.length===1)sel.value=matching[0].id;
}

// Trajets d'une course mixte : logique partagée site / app iOS (core/notes.ts)
function parseMixedNotes(notes){ return BleenrCore.parseMixedNotes(notes); }

// Prominent status badge for the ride detail title bar
function _statusBadge(status, offerCount){
  var I=function(d){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'; };
  var m={
    waiting:{bg:'#FFF1CC',fg:'#7A4F00',bd:'#F0D27A',ic:I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),tx:t('waiting')},
    offers:{bg:'#E2EDFB',fg:'#1E4D7B',bd:'#B9D2F1',ic:I('<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>'),tx:(offerCount>0?offerCount+' ':'')+t('offers_pill')},
    pending_payment:{bg:'#E2EDFB',fg:'#1E4D7B',bd:'#B9D2F1',ic:I('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),tx:'Paiement en cours'},
    confirmed:{bg:'#1B5E3B',fg:'#FFFFFF',bd:'#1B5E3B',ic:I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),tx:t('confirmed')},
    active:{bg:'#27AE60',fg:'#FFFFFF',bd:'#27AE60',ic:'<span class="live-dot" style="background:#fff;"></span>',tx:t('active')},
    done:{bg:'#3F4A44',fg:'#FFFFFF',bd:'#3F4A44',ic:I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),tx:t('done')},
    cancelled:{bg:'#FDE7E4',fg:'#B3261E',bd:'#F5C2BC',ic:I('<path d="M6 6l12 12M18 6L6 18"/>'),tx:t('cancelled')},
    personal:{bg:'#EDE4FA',fg:'#5B3FA0',bd:'#D6C6F3',ic:I('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0114 0v1"/>'),tx:'Personnelle'}
  }[status];
  if(!m) return getStatusPill(status, offerCount);
  return '<span style="display:inline-flex;align-items:center;gap:6px;background:'+m.bg+';color:'+m.fg+';border:1px solid '+m.bd+';border-radius:999px;padding:6px 12px 6px 10px;font-size:12.5px;font-weight:700;letter-spacing:.01em;white-space:nowrap;">'+m.ic+m.tx+'</span>';
}
function _noShowPill(big){
  return '<span title="'+t('app2.le_client_ne_sest_pas')+'" style="display:inline-flex;align-items:center;background:#FDE7E4;color:#B3261E;border:1px solid #F5C2BC;border-radius:999px;padding:'+(big?'6px 11px':'2px 8px')+';font-size:'+(big?'12.5px':'10.5px')+';font-weight:700;white-space:nowrap;">'+t('app.no_show')+'</span>';
}
function getStatusPill(status, offerCount){
  var map = {
    waiting: '<span class="pill waiting"><span class="pill-dot"></span>'+t('waiting')+'</span>',
    offers:  '<span class="pill offers"><span class="pill-dot"></span>'+(offerCount>0?offerCount+' ':'')+t('offers_pill')+'</span>',
    pending_payment: '<span class="pill" style="background:#EAF1FB;color:#1E4D7B;"><span class="pill-dot" style="background:#1E4D7B;"></span>'+t('app.paiement_en_cours')+'</span>',
    confirmed:'<span class="pill confirmed">'+t('confirmed')+'</span>',
    active:  '<span class="pill active pulse">'+t('active')+'</span>',
    done:    '<span class="pill done">'+t('done')+'</span>',
    cancelled:'<span class="pill cancelled">'+t('cancelled')+'</span>',
  };
  return map[status] || '';
}

function renderRideItem(r){
  var offerCnt=r._offerCount!==undefined?r._offerCount:(r.offers&&r.offers[0]?parseInt(r.offers[0].count)||0:0);
  var statusPill=(r.no_show_at?_noShowPill()+' ':'')+(_chgPending(r)?_chgConfirmedPill(r):getStatusPill(r.status, offerCnt)+_chgPill(r));
  var typeLabel=tripTypeLabel(r.trip_type);
  var from=cleanAddr(r.from_address||'\u2014'),to=r.to_address||'\u2014';
  var isDisp=r.trip_type==='disposal',isMixed=r.trip_type==='mixed';
  var mixedSegs=isMixed?parseMixedNotes(r.notes||''):[];
  var routeHtml;
  if(isMixed&&mixedSegs.length){
    routeHtml='<div class="ride-card-mixed">';
    mixedSegs.forEach(function(s,i){
      var isSegD=s.type.toLowerCase().indexOf('disp')>=0;
      var isLast=i===mixedSegs.length-1;
      routeHtml+='<div class="mixed-seg-inline">'
        +'<span class="mixed-seg-lbl" title="'+s.from+'">'+s.from+'</span>'
        +'<div class="ride-card-dot from" style="margin:0 4px;"></div>'
        +(isSegD?'<span style="font-size:11px;color:var(--ink4);margin:0 3px;">'+(s.dur?s.dur+'h':'disp.')+'</span>':'<div class="ride-card-line"></div>')
        +'<div class="ride-card-dot to"></div>'
        +(!isLast?'<div style="width:10px;height:1.5px;background:var(--sand3);margin:0 4px;"></div>':'')
      +'</div>';
    });
    routeHtml+='</div>';
  } else if(isDisp){
    routeHtml='<div class="ride-card-route"><span class="ride-card-addr from-addr" title="'+from+'">'+from+'</span><div class="ride-card-dot from"></div><span style="font-size:10px;color:var(--ink4);margin:0 5px;">'+t('app.disp')+'</span><div class="ride-card-dot to"></div></div>';
  } else {
    routeHtml='<div class="ride-card-route"><span class="ride-card-addr from-addr" title="'+from+'">'+from+'</span><div class="ride-card-dot from"></div><div class="ride-card-line"></div><div class="ride-card-dot to"></div><span class="ride-card-addr to-addr" title="'+to+'">'+to+'</span></div>';
  }
  var safeR=JSON.stringify(r);
  // For client rides with offers: clicking opens offers directly
      var cardClick = 'openRideDetail(this)';
    var rDate=r.ride_date?new Date(r.ride_date+'T00:00:00'):null;
  var dayNum=rDate?rDate.getDate().toString().padStart(2,'0'):'--';
  var monStr=rDate?rDate.toLocaleDateString('fr-FR',{month:'short'}).toUpperCase().replace('.',''):'';
  var priceStr=r.final_price?parseFloat(r.final_price).toFixed(2)+' €':(offerCnt>0?'Voir offres':'---');
  var tLabel=r.status==='personal'?'Personnel':r.trip_type==='disposal'?'Disp.':r.trip_type==='mixed'?'Mixte':'A→B';
  var tColor=r.status==='personal'?'#6750A4':r.trip_type==='disposal'?'var(--amber)':r.trip_type==='mixed'?'var(--blue)':'var(--green)';
  var tBg=r.status==='personal'?'#E8DEF8':r.trip_type==='disposal'?'var(--amber-bg)':r.trip_type==='mixed'?'var(--blue-bg)':'var(--green-bg)';
  var isDisposal=r.trip_type==='disposal';var isCancelled=r.status==='cancelled';
  var destCol=isDisposal?'<div></div>':'<div><div class="ride-card-col-label">'+t('app.destination')+'</div><div class="ride-card-col-val">'+(r.to_address||'—')+'</div></div>';
  var priceCol=isCancelled
    ? (r.final_price?'<div style="text-align:right;"><div class="ride-card-col-label">'+t('app.prix')+'</div><div class="ride-card-col-val" style="font-weight:700;color:var(--red);">'+parseFloat(r.final_price).toFixed(2)+' €</div></div>':'<div></div>')
    : '<div style="text-align:right;"><div class="ride-card-col-label">'+t('app.prix')+'</div><div class="ride-card-col-val" style="font-weight:700;">'+priceStr+'</div></div>';
  // Subcontract badge
  var subBadge=r.is_subcontract?'<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--amber-bg);color:var(--amber);margin-left:2px;flex-shrink:0;" title="'+t('app.sous_traitee')+'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>':'';
  return '<div class="ride-card" onclick="'+cardClick+'" data-ride=\''+safeR.replace(/\'/g,'&#39;')+'\'>'
    +'<div class="ride-card-date-col"><div class="ride-card-date-month">'+monStr+'</div><div class="ride-card-date-day">'+dayNum+'</div></div>'
    +'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;background:'+tBg+';color:'+tColor+';padding:2px 7px;border-radius:20px;">'+tLabel+'</span>'+subBadge+'</div>'
    +'<div><div class="ride-card-col-label">'+t('app.origine')+'</div><div class="ride-card-col-val">'+(cleanAddr(r.from_address)||'—')+'</div></div>'
    +destCol
    +'<div><div class="ride-card-col-label">'+t('app.statut')+'</div>'+statusPill+'</div>'
    +priceCol
    +'<svg class="ride-card-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  +'</div>';
}


// ═══════════════════════════════════════════════════════════════
// ADMIN: Fleets & Clients pages
// ═══════════════════════════════════════════════════════════════

function _adminStatusBadge(status){
  if(status==='validated') return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:var(--green-bg);color:var(--green);font-size:10px;font-weight:600;">V\u00e9rifi\u00e9</span>';
  if(status==='rejected') return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:var(--red-bg);color:var(--red);font-size:10px;font-weight:600;">Rejet\u00e9</span>';
  return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-size:10px;font-weight:600;">En attente</span>';
}

function _adminActionBtns(table, id, status){
  var btns='';
  if(status!=='validated'){
    btns+='<button class="btn btn-primary btn-sm" style="font-size:11px;padding:4px 10px;" onclick="adminSetStatus(\''+table+'\',\''+id+'\',\'validated\')">Valider</button>';
  }
  if(status!=='rejected'){
    btns+='<button class="btn btn-sm" style="font-size:11px;padding:4px 10px;background:var(--red);color:#fff;border:none;border-radius:var(--r);cursor:pointer;" onclick="adminSetStatus(\''+table+'\',\''+id+'\',\'rejected\')">Rejeter</button>';
  }
  if(status==='validated'||status==='rejected'){
    btns+='<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;" onclick="adminSetStatus(\''+table+'\',\''+id+'\',\'pending\')">Remettre en attente</button>';
  }
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+btns+'</div>';
}

window.adminSetStatus=async function(table, id, newStatus){
  if(!sb) return;
  try{
    var {error}=await sb.rpc('api_admin_save',{ p_table:table, p_id:id, p_data:{status:newStatus} });
    if(error) throw error;
    showToast(newStatus==='validated'?'V\u00e9rifi\u00e9 !':newStatus==='rejected'?'Rejet\u00e9':'Statut mis \u00e0 jour');
    _refreshAdminFleetsBadge();
    // Reload the current detail if viewing a fleet, otherwise reload the list
    if(_adminFleetDetailId){
      await showFleetDetail(_adminFleetDetailId);
    } else {
      await loadAdminFleets();
    }
  }catch(e){showToast('Erreur: '+(e.message||e));}
};

