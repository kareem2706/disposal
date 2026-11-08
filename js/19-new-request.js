// ── Nouvelle demande : étape 1 « type de trajet » puis étape 2 « création de la demande » ──
var _NR_STEPS=['Type','Demande','Attente d\u2019offres','Choix','Paiement'];
window._nrStepsHtml=function(cur){
  return _NR_STEPS.map(function(t,i){ var n=i+1, c=n<cur?'done':n===cur?'on':'';
    return '<div class="nr-st '+c+'"><i>'+(n<cur?'\u2713':n)+'</i><span>'+t+'</span></div>'; }).join('');
};
window._nrShow=function(step){
  var m=document.getElementById('m-new-ride'); if(!m) return;
  // Création comme modification : choix du type (étape 1) puis formulaire (étape 2)
  m.classList.add('nr-flow');
  m.classList.toggle('nr-pick', step==='choose');
  m.classList.toggle('nr-ai-on', step==='ai');
  if(step==='choose' && window._aiClear) _aiClear();
  if(step==='ai') setTimeout(function(){ var t=document.getElementById('ai-text'); if(t&&window.innerWidth>900) t.focus(); },120);
  var st=document.getElementById('nr-steps'); if(st) st.innerHTML=_nrStepsHtml(step==='choose'?1:2);
  if(step==='form') setTimeout(function(){ if(window._vehPaxSync) _vehPaxSync(); },0);
  var b=m.querySelector('.modal-body'); if(b) b.scrollTop=0;
};
window._nrPick=function(val){
  if(val==='ai'){ _nrShow('ai'); return; }
  if(!window._aiApplying && window._aiClear) _aiClear();
  if(val==='event'){ _evSetMode(true); _nrShow('form'); return; }
  _evSetMode(false);
  var el=document.querySelector('#nr-type-grp .trip-type[data-val="'+val+'"]');
  if(el) selTripType(el);
  if(val==='mixed' && !document.querySelector('#mixed-segments .mixed-segment')) addMixedSegment();   // un premier trajet prêt à remplir
  _nrShow('form');
  setTimeout(function(){ var f=document.getElementById(val==='disposal'?'disp-from':val==='ab'?'ride-from':''); if(f&&window.innerWidth>900) f.focus(); },120);
};
window._nrInit=function(){
  var m=document.getElementById('m-new-ride'); if(!m) return;
  var edit=!!(document.getElementById('ride-edit-id')||{}).value;
  _nrShow(edit?'form':'choose');
  m.classList.toggle('nr-editing', edit);
  if(window._aiFlag) _aiFlag();
  if(window._lugCapsLoad) _lugCapsLoad();
  m.classList.remove('nr-recap-on');
  if(!edit && !window._evAddPending){ try{ _evReset(); }catch(_e){} }
  window._evAddPending=false;   // nouvelle demande : formulaire Événement toujours vierge   // en modification, pas d'option « Événement »   // modification : on arrive sur le formulaire, « Changer de type » reste possible
  // Flèche retour : formulaire → choix du type ; choix du type → fermeture
  var back=m.querySelector('.modal-hd .rd-back');
  if(back) back.onclick=function(){
    // Modification : retour à la fiche de la demande (pas au choix du type)
    if(m.classList.contains('nr-editing')){ var _ei=document.getElementById('ride-edit-id'); if(_ei) _ei.value=''; window._editHiddenTags=''; window._editRidePax=null; m.classList.remove('nr-editing'); _rdBack('m-new-ride'); return; }
    if(m.classList.contains('nr-recap-on')) _nrRecapBack(); else if(m.classList.contains('ev-recap-on')) _evEditBack(); else if(window._evTarget && m.classList.contains('nr-event')) _rdBack('m-new-ride'); else if(window._aiFrom && !m.classList.contains('nr-ai-on') && !m.classList.contains('nr-pick')){ window._aiFrom=false; _nrShow('ai'); } else if(m.classList.contains('nr-flow') && !m.classList.contains('nr-pick')) _nrShow('choose'); else _rdBack('m-new-ride'); };
};
// ══ DEMANDE PAR IA : « Décrivez votre itinéraire » ══
// Visible uniquement si l'admin a activé billing_settings.ai_requests_enabled (contrôlé aussi côté serveur).
// Le texte est analysé par la fonction Edge ai-itinerary ; le résultat pré-remplit le formulaire habituel,
// champs à compléter en rouge. Le client vérifie puis publie comme d'habitude.
window._aiEnabled=false;
window._aiFlag=function(){
  var b=document.getElementById('nr-opt-ai'); if(b) b.style.display=window._aiEnabled?'':'none';
  if(!sb || currentRole!=='client') { if(b) b.style.display='none'; return; }
  sb.from('billing_settings').select('ai_requests_enabled').eq('id',1).maybeSingle().then(function(r){
    window._aiEnabled=!!(r&&r.data&&r.data.ai_requests_enabled===true);
    var e=document.getElementById('m-new-ride'), o=document.getElementById('nr-opt-ai');
    if(o) o.style.display=(window._aiEnabled && !(e&&e.classList.contains('nr-editing')))?'':'none';
  }).catch(function(){});
};
var _AI_EX=[
  'Demain à 9h, transfert de la gare du Midi vers Brussels Airport pour 2 personnes avec 3 valises. Business.',
  'Vendredi prochain de 14h à 18h, un chauffeur à disposition au départ de l’hôtel Amigo à Bruxelles pour des rendez-vous en ville. 1 personne.',
  'Séminaire le 12 décembre au Château de la Hulpe : 18 personnes à prendre à Brussels Airport à 8h30 (vol SN 2902), retour à l’aéroport à 17h.'
];
window._aiEx=function(i){ var t=document.getElementById('ai-text'); if(t){ t.value=_AI_EX[i]||''; t.focus(); } };
function _aiEsc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _aiStatus(msg, kind){
  var s=document.getElementById('ai-status'); if(!s) return;
  s.className='ai-status'+(kind==='err'?' err':'');
  s.innerHTML=kind==='load'?'<span class="ai-spin"></span>'+msg:msg;
}
window._aiClear=function(){
  window._aiFrom=false;
  var b=document.getElementById('ai-banner'); if(b){ b.style.display='none'; b.innerHTML=''; }
  document.querySelectorAll('#m-new-ride .ai-miss').forEach(function(x){ x.remove(); });
};
window._aiPrepare=async function(){
  var t=document.getElementById('ai-text'), go=document.getElementById('ai-go');
  var text=String(t&&t.value||'').trim();
  if(text.length<10){ _aiStatus('Décrivez votre trajet en quelques mots (lieux, date, heure).','err'); return; }
  if(!sb){ _aiStatus('Connexion indisponible.','err'); return; }
  if(go) go.disabled=true;
  _aiStatus('Analyse de votre texte…','load');
  try{
    var res=await sb.functions.invoke('ai-itinerary',{ body:{ text:text } });
    var data=res.data, err=res.error;
    if(err){
      var msg='';
      try{ if(err.context && err.context.json){ var j=await err.context.json(); msg=j&&j.error; } }catch(_e){}
      throw new Error(msg||'Le service IA est momentanément indisponible.');
    }
    if(!data || !data.draft) throw new Error((data&&data.error)||'Aucun trajet reconnu.');
    _aiStatus('');
    _aiApply(data.draft);
  }catch(e){
    _aiStatus(_aiEsc(e.message||String(e)),'err');
  }finally{ if(go) go.disabled=false; }
};

// ── Pré-remplissage ──
function _aiSet(el, v){ if(!el||v==null||v==='') return; el.value=v; try{ el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} }
function _aiPaxVal(n){ n=parseInt(n,10)||0; return n<1?'':(n>7?'8+':String(n)); }
// Marque un champ à compléter (rouge + petite explication sous le champ)
function _aiMiss(el, hint){
  if(!el) return;
  el.classList.add('fld-err');
  var g=el.closest('.input-group')||el.parentNode;
  if(g && !g.querySelector('.ai-miss')){
    var d=document.createElement('div'); d.className='ai-miss'; d._el=el; d.textContent='À compléter'+(hint?' — '+hint:'');
    g.appendChild(d);
    var off=function(){ if(String(el.value||'').trim()){ d.remove(); el.removeEventListener('input',off); el.removeEventListener('change',off); } };
    el.addEventListener('input',off); el.addEventListener('change',off);
  }
}
// Remplit un trajet. f = { from, to, date, time, dur, pax, veh, notes, tr(key) → champ vol/train, plan() → plan vol/train }
function _aiFillTrip(tr, f){
  var miss={}; (tr.missing||[]).forEach(function(k){ miss[k]=1; });
  _aiSet(f.from, tr.from);
  if(f.to) _aiSet(f.to, tr.to);
  if(f.date){ f.date.value=tr.date||''; }
  if(f.time){ f.time.value=tr.time||''; }
  if(f.dur && tr.duration_hours) f.dur.value=tr.duration_hours;
  if(f.pax && _aiPaxVal(tr.pax)) f.pax.value=_aiPaxVal(tr.pax);
  if(f.veh && tr.vehicle) f.veh.value=tr.vehicle;
  if(f.lugL && tr.luggage_large) f.lugL.value=tr.luggage_large;
  if(f.lugS && tr.luggage_small) f.lugS.value=tr.luggage_small;
  // Vol / train : rangé dans le bon champ (arrivée au départ / départ à l'arrivée) selon les lieux
  var extra=[];
  if(f.plan){
    var plan=f.plan()||[], used={pickup:false, dropoff:false};
    plan.forEach(function(x){
      var v=x.pickup?tr.pickup_number:tr.dropoff_number, inp=f.tr&&f.tr(x.key);
      if(v && inp){ inp.value=v; used[x.pickup?'pickup':'dropoff']=true; }
    });
    if(tr.pickup_number && !used.pickup) extra.push('Vol / train à l’arrivée : '+tr.pickup_number);
    if(tr.dropoff_number && !used.dropoff) extra.push('Vol / train au départ : '+tr.dropoff_number);
  }
  var notes=[tr.notes].concat(extra).filter(Boolean).join('\n');
  if(f.notes && notes) f.notes.value=notes;
  // Champs à compléter
  if(miss.from || !tr.from) _aiMiss(f.from);
  if(f.to && (miss.to || !tr.to)) _aiMiss(f.to);
  if(f.date && (miss.date || !tr.date)) _aiMiss(f.date, tr.date?'à confirmer':'non précisée');
  if(f.time && (miss.time || !tr.time)) _aiMiss(f.time, tr.time_hint?'« '+tr.time_hint+' »':'non précisée');
  if(f.dur && miss.duration) _aiMiss(f.dur, 'non précisée');
  if(f.pax && miss.pax) _aiMiss(f.pax, 'nombre non précisé');
}
window._aiApply=function(dr){
  var trips=(dr&&dr.trips)||[]; if(!trips.length) return;
  var kind=dr.kind;
  if(kind!=='event') kind=trips.length>1?'mixed':(trips[0].type==='disposal'?'disposal':'ab');
  // Formulaire vierge, puis type choisi
  var keepText=(document.getElementById('ai-text')||{}).value||'';
  var _cm=window.closeModal; window.closeModal=function(){};   // on remet le formulaire à zéro sans fermer la fenêtre
  try{ cancelRideModal(); }catch(e){} finally{ window.closeModal=_cm; }
  _nrInit();
  var tx=document.getElementById('ai-text'); if(tx) tx.value=keepText;
  window._aiApplying=true;
  try{ _nrPick(kind); } finally { window._aiApplying=false; }
  var g=function(id){ return document.getElementById(id); };
  if(kind==='ab'){
    var tr=trips[0];
    _aiSet(g('ride-from'), tr.from); _aiSet(g('ride-to'), tr.to);
    if(window._trRefresh) _trRefresh();
    _aiFillTrip(tr, { from:g('ride-from'), to:g('ride-to'), date:g('ride-date'), time:g('ride-time'), pax:g('ride-pax'), veh:g('ride-vehicle'), lugL:g('ride-lugL'), lugS:g('ride-lugS'), notes:g('ride-notes'),
      plan:function(){ return _trPairPlan(g('ride-from').value, g('ride-to').value); }, tr:function(k){ return g('ride-'+k); } });
  } else if(kind==='disposal'){
    var tr=trips[0];
    _aiSet(g('disp-from'), tr.from);
    if(window._trRefresh) _trRefresh();
    _aiFillTrip(tr, { from:g('disp-from'), date:g('disp-date'), time:g('disp-time'), dur:g('disp-duration'), pax:g('disp-pax'), veh:g('disp-vehicle'), lugL:g('disp-lugL'), lugS:g('disp-lugS'), notes:g('disp-notes'),
      plan:function(){ return _trPairPlan(g('disp-from').value, null); }, tr:function(k){ return k==='flight'||k==='train'?g('disp-'+k):null; } });
  } else if(kind==='mixed'){
    var cont=g('mixed-segments');
    while(cont.querySelectorAll('.mixed-segment').length<trips.length) addMixedSegment();
    var segs=[].slice.call(cont.querySelectorAll('.mixed-segment'));
    trips.forEach(function(tr,i){
      var sg=segs[i], n=sg.id.replace('seg-','');
      if(tr.type==='disposal'){ var ms=sg.querySelector('.mix-type'); if(ms){ ms.value='disposal'; var bt=sg.querySelectorAll('.seg-type-btn'); if(bt[1]) setSegType(bt[1], +n, 'disposal'); } }
      _aiSet(g('sf-'+n), tr.from); if(g('st-'+n)) _aiSet(g('st-'+n), tr.to);
      _segTr(n);
      _aiFillTrip(tr, { from:g('sf-'+n), to:g('st-'+n), date:g('sd8-'+n), time:g('sh-'+n), dur:g('sdur-'+n), pax:g('spax-'+n), veh:g('sveh-'+n), lugL:g('slgL-'+n), lugS:g('slgS-'+n), notes:g('snotes-'+n),
        plan:function(){ return _trPairPlan(g('sf-'+n).value, g('st-'+n)?g('st-'+n).value:null); }, tr:function(k){ return g(_SEG_TRK[k]+'-'+n); } });
    });
    if(dr.contact_name) g('mix-cname').value=dr.contact_name;
    if(dr.contact_phone) g('mix-cphone').value=dr.contact_phone;
  } else if(kind==='event'){
    var box=g('ev-vehicles'); if(box) box.innerHTML='';
    if(dr.event_name) g('ev-name').value=dr.event_name; else _aiMiss(g('ev-name'));
    if(dr.contact_name) g('ev-cname').value=dr.contact_name;
    if(dr.contact_phone) g('ev-cphone').value=dr.contact_phone;
    trips.forEach(function(tr){
      var cnt=tr.vehicles&&Object.keys(tr.vehicles).length?tr.vehicles:null, d={ type:tr.type==='disposal'?'disposal':'ab', from:tr.from, to:tr.to, date:tr.date, time:tr.time, dur:tr.duration_hours||'' };
      if(cnt){ d.vm='manual'; d.cnt=cnt; }
      else if(tr.pax){ d.vm='pax'; d.n=String(tr.pax); var sg=_evSuggest(tr.pax); d.cnt=sg[0]?sg[0].c:{business:1}; }
      else if(tr.vehicle){ d.cnt={}; d.cnt[tr.vehicle]=1; }
      d.lugL=tr.luggage_large||''; d.lugS=tr.luggage_small||'';
      var r=_evAdd(d); if(!r) return;
      r.querySelector('.ev-date').value=tr.date||'';
      _evTr(r);
      _aiFillTrip(tr, { from:r.querySelector('.ev-from'), to:d.type==='ab'?r.querySelector('.ev-to'):null, date:r.querySelector('.ev-date'), time:r.querySelector('.ev-time'), dur:d.type==='disposal'?r.querySelector('.ev-dur'):null,
        plan:function(){ return _trPairPlan(_evVal(r,'ev-from'), d.type==='disposal'?null:_evVal(r,'ev-to')); }, tr:function(k){ return r.querySelector('.ev-'+k); } });
    });
    _evRenumber();
  }
  // Bandeau
  var nMiss=document.querySelectorAll('#m-new-ride .modal-body .ai-miss').length, n=trips.length;
  var b=g('ai-banner');
  if(b){
    b.innerHTML='<b>✦ '+n+' trajet'+(n>1?'s':'')+' détecté'+(n>1?'s':'')+'.</b> '+(dr.summary?_aiEsc(dr.summary.replace(/[.\s]*$/,'.'))+' ':'')
      +(nMiss?t('app.verifiez_les_informations_les_champs')+' <em>'+t('app.rouge')+'</em> '+t('app.sont_a_completer'):'Vérifiez les informations avant de publier.');
    b.style.display='';
  }
  // La remise à zéro du formulaire efface les cadres rouges juste après (observateur) : on les remet ensuite
  setTimeout(function(){ document.querySelectorAll('#m-new-ride .ai-miss').forEach(function(d){ if(d._el && d.isConnected) d._el.classList.add('fld-err'); }); }, 60);
  if(window._vehPaxSync) _vehPaxSync();
  if(window._lugWarnAll) _lugWarnAll();
  window._aiFrom=true;
  var mb=document.querySelector('#m-new-ride .modal-body'); if(mb) mb.scrollTop=0;
};

// Même barre d'étapes sur la suite du parcours client : attente (3), offres (4), paiement (5)
window._nrStepsBar=function(modalId, step){
  var m=document.getElementById(modalId); if(!m) return;
  var box=m.querySelector('.modal'), hd=m.querySelector('.modal-hd'); if(!box||!hd) return;
  var bar=box.querySelector(':scope > .nr-steps.nr-bar');
  if(!step){ if(bar) bar.remove(); return; }
  if(!bar){ bar=document.createElement('div'); bar.className='nr-steps nr-bar'; hd.insertAdjacentElement('afterend', bar); }
  bar.innerHTML=_nrStepsHtml(step);
};
window._nrRideStep=function(r){
  if(!r || currentRole!=='client' || (currentUser&&currentUser.email===ADMIN_EMAIL) || r.is_subcontract) return null;
  return r.status==='waiting'?3 : r.status==='offers'?4 : r.status==='pending_payment'?5 : null;
};
(function(){ var o=window.openModal; window.openModal=function(id){ var r=o.apply(this,arguments);
  if(id==='m-new-ride') _nrInit();
  else if(id==='m-view-offers') _nrStepsBar(id, currentRole==='client'?4:null);
  else if(id==='m-payment') _nrStepsBar(id, currentRole==='client'?5:null);
  return r; }; })();
// ── Erreur dans un formulaire : les champs obligatoires (libellé avec *) restés vides sont encadrés en rouge ──
function _markMissing(scope){
  if(!scope) return;
  var first=null;
  scope.querySelectorAll('.input-group').forEach(function(g){
    var lab=g.querySelector('label'); if(!lab || !/\*/.test(lab.textContent||'')) return;
    if(g.offsetParent===null) return;                        // champ masqué
    g.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea').forEach(function(el){
      if(el.offsetParent===null||el.readOnly||el.disabled) return;
      var empty=!String(el.value||'').trim();
      el.classList.toggle('fld-err', empty);
      if(empty && !first) first=el;
    });
  });
  if(first){ try{ first.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){} }
}
document.addEventListener('input', function(e){ var t=e.target; if(t&&t.classList&&t.classList.contains('fld-err')&&String(t.value||'').trim()) t.classList.remove('fld-err'); }, true);
document.addEventListener('change', function(e){ var t=e.target; if(t&&t.classList&&t.classList.contains('fld-err')&&String(t.value||'').trim()) t.classList.remove('fld-err'); }, true);
(function(){
  var ob=new MutationObserver(function(ms){ ms.forEach(function(m){
    var el=m.target; if(!el.classList||!el.classList.contains('auth-error')) return;
    var shown=el.classList.contains('show')&&String(el.textContent||'').trim();
    var scope=el.closest('.modal')||el.closest('form')||el.closest('.auth-card')||el.parentElement;
    if(shown) _markMissing(scope);
    else if(scope) scope.querySelectorAll('.fld-err').forEach(function(x){ x.classList.remove('fld-err'); });
  }); });
  var go=function(){ ob.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class'],childList:false,characterData:false}); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
})();
// Formulaires affichés en version « plein écran » (panneau à droite sur ordinateur, page sur mobile)
var _RD_FORMS=['m-new-ride','m-submit-offer','m-subcontract','m-personal-mission','m-vehicle','m-driver','m-fleet-doc','m-passenger','m-mission-assign','m-admin-client','m-view-offers','m-payment'];
function _rdInitForms(){ _RD_FORMS.forEach(function(id){ var m=document.getElementById(id); if(m) m.classList.add('rd-panel','rd-form'); }); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_rdInitForms); else _rdInitForms();
function _rdEnsureBack(m){
  var hd=m.querySelector('.modal-hd'); if(!hd || hd.querySelector('.rd-back')) return;
  var b=document.createElement('button'); b.type='button'; b.className='rd-back'; b.setAttribute('aria-label','Retour');
  b.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  b.onclick=function(){ _rdBack(m.id); };
  hd.insertBefore(b, hd.firstChild);
}
