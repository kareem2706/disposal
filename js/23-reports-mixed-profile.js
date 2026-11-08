// ── Signaler un problème (client, après prise en charge) ──
window._rideOpenReport = async function(rideId){
  if(!sb||!currentUser) return null;
  try{
    var {data,error} = await sb.from('ride_reports').select('id,created_at,status').eq('ride_id',rideId).eq('client_id',currentUser.id).neq('status','resolved').order('created_at',{ascending:false}).limit(1);
    if(error) console.warn('_rideOpenReport', error);
    return (data&&data[0])||null;
  }catch(e){ return null; }
};
window._showRideReportPending = function(rep){
  var existing = document.getElementById('m-pax-edit'); if(existing) existing.remove();
  var when = rep&&rep.created_at ? new Date(rep.created_at).toLocaleString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  document.body.insertAdjacentHTML('beforeend',
    '<div id="m-pax-edit" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)this.remove();">'
    +'<div style="background:#EEF4FB;border-radius:16px 16px 0 0;padding:24px 22px 32px;width:100%;max-width:520px;box-shadow:0 -4px 24px rgba(0,0,0,.12);">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B26A00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><div style="font-size:15px;font-weight:700;">'+t('app.signalement_en_cours_de_traitement')+'</div></div>'
      +'<div style="font-size:13.5px;color:var(--ink2);line-height:1.55;">'+t('app.votre_signalement')+(when?' du '+when:'')+' '+t('app.a_bien_ete_transmis_et')+'</div>'
      +'<button class="btn btn-primary" style="width:100%;margin-top:18px;" onclick="document.getElementById(\'m-pax-edit\').remove()">'+t('app.jai_compris')+'</button>'
    +'</div></div>');
};
window.openRideProblem = async function(rideId){
  var existing = document.getElementById('m-pax-edit'); if(existing) existing.remove();
  var _open = await window._rideOpenReport(rideId);
  if(_open){ window._showRideReportPending(_open); return; }
  var fields = '<div style="font-size:13px;color:var(--ink3);margin-bottom:12px;line-height:1.5;">'+t('app.decrivez_le_probleme_rencontre_votre')+'</div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">'+t('app.votre_message')+'</label>'
    +'<textarea id="ride-problem-msg" rows="5" maxlength="2000" style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;font-family:\'DM Sans\',sans-serif;resize:none;" placeholder="'+t('app.ex_le_chauffeur_ne_suit')+'"></textarea></div>';
  document.body.insertAdjacentHTML('beforeend', _paxModalHtml('<span style="color:var(--red);">'+t('app.signaler_un_probleme')+'</span>', fields, 'problem', rideId));
  setTimeout(function(){
    var btn = document.getElementById('btn-pax-save');
    if(btn){
      btn.textContent='Envoyer';
      btn.style.background='var(--red)'; btn.style.borderColor='var(--red)';
      btn.addEventListener('click', function(){ sendRideProblem(this.dataset.rid); });
    }
    var ta=document.getElementById('ride-problem-msg'); if(ta) ta.focus();
  }, 10);
};

window.sendRideProblem = async function(rideId){
  if(!sb||!currentUser) return;
  var btn = document.getElementById('btn-pax-save');
  var msg = (document.getElementById('ride-problem-msg')?.value||'').trim();
  if(msg.length<5){ showToast(t('app.merci_de_decrire_le_probleme')); return; }
  if(btn){ btn.disabled=true; btn.textContent='Envoi…'; }
  var _open = await window._rideOpenReport(rideId);
  if(_open){ window._showRideReportPending(_open); return; }
  var {error} = await sb.rpc('api_report_ride',{ p_ride:rideId, p_message:msg });
  if(error && error.code==='23505'){ window._showRideReportPending(null); return; }
  if(error){
    console.error('sendRideProblem error:', error);
    showToast(t('app.erreur_2')+error.message);
    if(btn){ btn.disabled=false; btn.textContent='Envoyer'; }
    return;
  }
  // Email à la plateforme (best-effort)
  try{
    var {data:r} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
    var cName=((currentProfile&&currentProfile.first_name||'')+' '+(currentProfile&&currentProfile.last_name||'')).trim();
    var d = r ? window._mailRideData(r, {}) : {};
    window.sendMail('ride_problem', ADMIN_EMAIL, Object.assign({}, d, { clientName:cName, clientEmail:currentUser.email||'', clientPhone:(currentProfile&&currentProfile.phone)||'', message:msg }));
  }catch(e){ console.warn('ride_problem mail', e); }
  document.getElementById('m-pax-edit')?.remove();
  showToast(t('app.votre_signalement_a_ete_envoye'));
  var _pi=document.querySelector('#detail-ft .rd-prob-item');
  if(_pi){ var _d=document.createElement('div'); _d.className='ft-menu-item'; _d.style.cssText='cursor:default;color:#B26A00;'; _d.innerHTML='<svg style="color:#B26A00;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'+t('app.signalement_en_cours_de_traitement'); _d.onclick=function(ev){ev.stopPropagation();}; _pi.replaceWith(_d); }
};

window.savePaxInfo = async function(rideId){
  if(!sb) return;
  var btn = document.querySelector('#m-pax-edit .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement…'; }
  var name  = (document.getElementById('pax-edit-name')?.value||'').trim();
  var phone = (document.getElementById('pax-edit-phone')?.value||'').trim();
  // Le serveur met à jour le passager dans la note complète (y compris la partie privée)
  var {error} = await sb.rpc('api_ride_set_tags',{ p_ride:rideId, p_tags:{ pax:name, tel:phone } });
  if(error){ console.error('savePaxInfo error:', error); showToast(t('app.erreur_3')+error.message); if(btn){btn.disabled=false;btn.textContent='Enregistrer';} return; }
  _notifyRideUpdated(rideId, ['passager']);
  document.getElementById('m-pax-edit')?.remove();
  showToast(t('app.informations_mises_a_jour'));
  await loadClientDashboard();
  // Reopen detail with updated data
  var {data:updated} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
  if(updated){ var tmp=document.createElement('div'); tmp.dataset.ride=JSON.stringify(updated).replace(/'/g,"&#39;"); openRideDetail(tmp); }
};

window.saveNoteInfo = async function(rideId){
  if(!sb) return;
  var btn = document.querySelector('#m-pax-edit .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement…'; }
  var note = (document.getElementById('pax-edit-note')?.value||'').trim();
  var {error} = await sb.rpc('api_ride_set_tags',{ p_ride:rideId, p_tags:{ note_drv:note } });
  if(error){ console.error('saveNoteInfo error:', error); showToast(t('app.erreur_3')+error.message); if(btn){btn.disabled=false;btn.textContent='Enregistrer';} return; }
  _notifyRideUpdated(rideId, ['note au chauffeur'], note);
  document.getElementById('m-pax-edit')?.remove();
  showToast(t('app.note_mise_a_jour'));
  await loadClientDashboard();
  // Reopen detail with updated data
  var {data:updated2} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
  if(updated2){ var tmp2=document.createElement('div'); tmp2.dataset.ride=JSON.stringify(updated2).replace(/'/g,"&#39;"); openRideDetail(tmp2); }
};

window.openRateModal=async function(rideId,fromAddr,rideDataStr){
  var rd = {};
  try{ if(rideDataStr) rd = JSON.parse(rideDataStr.replace(/&#39;/g,"'")); }catch(e){}

  // Build ride info subtitle: from + type/destination
  var rideInfoHtml = '<div style="font-size:12px;color:var(--ink3);margin-bottom:16px;text-align:center;">'
    +'<div style="font-weight:500;color:var(--ink2);">'+(fromAddr||'—')+'</div>';
  if(rd.trip_type==='disposal'){
    var durMatch = (rd.notes||'').match(/Durée:([^\s|,]+)/);
    var durRaw = durMatch ? durMatch[1].replace(/h$/,'') : '';
    var durStr = durRaw ? durRaw+'h' : '';
    rideInfoHtml += '<div style="color:var(--ink2);">'+t('app.mise_a_disposition')+(durStr?' · '+durStr:'')+'</div>';
  } else if(rd.trip_type==='mixed'){
    rideInfoHtml += '<div style="color:var(--ink2);">'+t('app.course_mixte')+'</div>';
  } else if(rd.to_address){
    rideInfoHtml += '<div style="color:var(--ink2);">'+rd.to_address+'</div>';
  }
  rideInfoHtml += '</div>';

  // Check if already rated
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    var {data:existing} = await sb.from('ratings').select('score,comment').eq('ride_id',rideId).maybeSingle();
    if(existing){
      var stars = '';
      for(var i=1;i<=5;i++) stars+='<span style="font-size:28px;color:'+(i<=existing.score?'#F5B100':'#CCC')+';">&#9733;</span>';
      var commentHtml = existing.comment
        ? '<div style="margin-top:10px;padding:10px 12px;background:var(--sand2);border-radius:var(--r);font-size:13px;color:var(--ink2);text-align:left;">'+existing.comment+'</div>'
        : '';
      var bodyEl = document.querySelector('#m-rate .modal-body');
      if(bodyEl) bodyEl.innerHTML =
        '<div style="width:48px;height:48px;background:var(--green-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">'
          +'<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11h14M14 6l5 5-5 5" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        +'</div>'
        +'<div style="font-weight:600;font-size:15px;margin-bottom:4px;">'+t('app.course_evaluee')+'</div>'
        +rideInfoHtml
        +'<div style="margin-bottom:6px;letter-spacing:4px;">'+stars+'</div>'
        +'<div style="font-size:12px;color:var(--ink3);">'+t('app.vous_avez_attribue')+' <strong>'+existing.score+'/5</strong></div>'
        +commentHtml;
      var ftEl = document.querySelector('#m-rate .modal-ft');
      if(ftEl) ftEl.innerHTML = '<button class="btn btn-secondary btn-full" onclick="closeModal(\'m-rate\')">'+t('app.fermer')+'</button>';
      openModal('m-rate');
      return;
    }
  }
  // Fresh rating form
  var bodyEl = document.querySelector('#m-rate .modal-body');
  if(bodyEl) bodyEl.innerHTML =
    '<div style="width:48px;height:48px;background:var(--green-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">'
      +'<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11h14M14 6l5 5-5 5" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    +'</div>'
    +'<div style="font-weight:600;font-size:15px;margin-bottom:4px;">'+t('app.course_terminee')+'</div>'
    +rideInfoHtml
    +'<div style="font-size:12px;font-weight:500;margin-bottom:10px;">'+t('app.comment_etait_votre_experience')+'</div>'
    +'<div style="font-size:32px;letter-spacing:6px;cursor:pointer;margin-bottom:14px;user-select:none;" id="stars-display">'
      +'<span onclick="rateSet(1)" style="color:#CCC;">&#9733;</span>'
      +'<span onclick="rateSet(2)" style="color:#CCC;">&#9733;</span>'
      +'<span onclick="rateSet(3)" style="color:#CCC;">&#9733;</span>'
      +'<span onclick="rateSet(4)" style="color:#CCC;">&#9733;</span>'
      +'<span onclick="rateSet(5)" style="color:#CCC;">&#9733;</span>'
    +'</div>'
    +'<input type="hidden" id="rate-score" value="0">'
    +'<textarea id="rate-comment" rows="2" placeholder="'+t('app.un_commentaire_optionnel')+'"></textarea>'
    +'<div id="rate-ride-id" style="display:none;">'+rideId+'</div>';
  var ftEl = document.querySelector('#m-rate .modal-ft');
  if(ftEl) ftEl.innerHTML = '<button class="btn btn-primary btn-full" onclick="submitRating()">'+t('app2.envoyer_l_evaluation')+'</button>';
  openModal('m-rate');
};

window.rateSet=function(score){
  document.getElementById('rate-score').value=score;
  var el=document.getElementById('stars-display');
  if(!el)return;
  var spans=el.querySelectorAll('span');
  spans.forEach(function(s,i){
    s.style.color=i<score?'#F5B100':'#CCC';
  });
};

window.submitRating=async function(){
  var rideId=document.getElementById('rate-ride-id')?.textContent;
  var score=parseInt(document.getElementById('rate-score')?.value)||0;
  var comment=(document.getElementById('rate-comment')?.value||'').trim();
  if(!score||score<1){showToast(t('app.veuillez_selectionner_une_note'));return;}
  if(!rideId){showToast(t('app.erreur_course_introuvable'));return;}
  if(sb&&!localStorage.getItem(DEMO_MODE_KEY)){
    try{
      // Note enregistrée par le serveur (course terminée du client ; moyenne de la fleet recalculée par le serveur)
      var {error:rateErr}=await sb.rpc('api_rate_ride',{ p_ride:rideId, p_score:score, p_comment:comment||null });
      if(rateErr) throw rateErr;
    }catch(e){console.error('rating error:',e);showToast(t('app2.erreur_lors_de_l_evaluation')+(e.message||e));return;}
  }
  closeModal('m-rate');
  showToast(t('app.merci_pour_votre_evaluation'));
  // Rester sur la course évaluée : la fiche affiche « Évaluée » à la place du bouton
  try{
    var _dm=document.getElementById('m-ride-detail'), _lr=window._lastDetailRide;
    if(_dm && _dm.classList.contains('open') && _lr && String(_lr.id)===String(rideId)){
      var _up=Object.assign({}, _lr, {rated:true}); var _t=document.createElement('div');
      _t.dataset.ride=JSON.stringify(_up).replace(/'/g,"&#39;"); openRideDetail(_t);
    }
  }catch(e){}
  if(typeof loadClientDashboard==='function') await loadClientDashboard();
};

function showToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

// Set today's date as default and minimum for ride form
window.addEventListener('load', () => {
  var td = todayStr();
  ['ride-date','disp-date','sub-date','sub-disp-date'].forEach(function(id){
    var dt = document.getElementById(id);
    if(dt){ dt.value = td; dt.min = td; }
  });
});


var _segN=0;
window.addMixedSegment=function(){
  _segN++;var n=_segN;
  var cont=document.getElementById('mixed-segments');if(!cont)return;
  var d=document.createElement('div');d.className='mixed-segment';d.id='seg-'+n;
  var paxOpts='<option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8+</option>';
  var vehOpts='<option value="any" class="veh-any">'+t('app.peu_importe')+'</option><option value="lowcost" selected>Economy</option><option value="business">Business</option><option value="van">Van</option><option value="luxe">'+t('app.luxe')+'</option><option value="bus">Bus</option>';

  // A->B fields (same as panel-ab)
  var abFields=
    '<div class="input-group full"><label>D&eacute;part <span style="color:var(--red)">*</span></label><input id="sf-'+n+'" placeholder="'+t('app.gare_du_midi_bruxelles')+'" autocomplete="off"></div>'+
    '<div id="st-wrap-'+n+'" class="input-group full"><label>Arriv&eacute;e <span style="color:var(--red)">*</span></label><input id="st-'+n+'" placeholder="A&eacute;roport BRU" autocomplete="off"></div>'+
    _segTrHtml(n)+
    '<div class="input-group"><label>'+t('app.date')+' <span style="color:var(--red)">*</span></label><input type="date" id="sd8-'+n+'"></div>'+
    '<div class="input-group"><label>'+t('app.heure')+' <span style="color:var(--red)">*</span></label><input type="time" id="sh-'+n+'" value="08:00"></div>'+
    '<div class="input-group"><label>'+t('app.passagers')+'</label><select id="spax-'+n+'">'+paxOpts+'</select></div>'+
    '<div class="input-group"><label class="veh-lbl">V&eacute;hicule <button type="button" class="veh-info" onclick="openVehGuide()" title="'+t('app.voir_les_gammes')+'">i</button></label><select id="sveh-'+n+'">'+vehOpts+'</select></div>'+
    _lugBlock('slgL-'+n,'slgS-'+n,'sveh-'+n,'spax-'+n)+
    '<div class="input-group full"><label>'+t('app.instructions')+'</label><textarea id="snotes-'+n+'" rows="2" placeholder="Bagages, enfants, acc&egrave;s PMR&hellip;"></textarea></div>';

  // Disposition fields (same as panel-disposal)
  var dispFields=
    '<div class="input-group full"><label>'+t('app.lieu_de_prise_en_charge')+' <span style="color:var(--red)">*</span></label><input id="sf-'+n+'" placeholder="'+t('app.grand_place_bruxelles')+'" autocomplete="off"></div>'+
    _segTrHtml(n)+
    '<div class="input-group full"><label>Dur&eacute;e (heures)</label><input type="number" id="sdur-'+n+'" min="1" max="24" value="2" placeholder="2" inputmode="numeric" oninput="this.value=String(this.value).replace(/[^0-9]/g,\'\').slice(0,2)" onblur="if(this.value!==\'\')this.value=Math.max(1,Math.min(24,parseInt(this.value)||1))"></div>'+
    '<div class="input-group"><label>'+t('app.date')+' <span style="color:var(--red)">*</span></label><input type="date" id="sd8-'+n+'"></div>'+
    '<div class="input-group"><label>'+t('app.heure')+' <span style="color:var(--red)">*</span></label><input type="time" id="sh-'+n+'" value="08:00"></div>'+
    '<div class="input-group"><label>'+t('app.passagers')+'</label><select id="spax-'+n+'">'+paxOpts+'</select></div>'+
    '<div class="input-group"><label class="veh-lbl">V&eacute;hicule <button type="button" class="veh-info" onclick="openVehGuide()" title="'+t('app.voir_les_gammes')+'">i</button></label><select id="sveh-'+n+'">'+vehOpts+'</select></div>'+
    _lugBlock('slgL-'+n,'slgS-'+n,'sveh-'+n,'spax-'+n)+
    '<div class="input-group full"><label>'+t('app.instructions')+'</label><textarea id="snotes-'+n+'" rows="2" placeholder="It&eacute;n&eacute;raire, arr&ecirc;ts pr&eacute;vus&hellip;"></textarea></div>';

  d.innerHTML=
    '<div class="ev-vh"><span class="n">'+n+'</span><span class="mix-ttl">'+t('app.trajet')+' '+n+'</span><span class="tl"><button type="button" onclick="_mixDup('+n+')">'+t('app.dupliquer')+'</button><button type="button" class="mix-del" onclick="removeSegSafe('+n+')">'+t('app.supprimer')+'</button></span></div>'+
    '<div class="seg-type-btns" style="display:none;"><button class="seg-type-btn active" onclick="setSegType(this,'+n+',\'ab\')">A &rarr; B</button><button class="seg-type-btn" onclick="setSegType(this,'+n+',\'disposal\')">'+t('app.disposition')+'</button></div>'+
    '<div class="input-group" style="margin-bottom:12px;"><label>'+t('app.type_de_trajet')+'</label><select class="mix-type" onchange="var b=this.closest(\'.mixed-segment\').querySelectorAll(\'.seg-type-btn\');b[this.value===\'disposal\'?1:0].click();"><option value="ab">'+t('app.transfert_simple')+'</option><option value="disposal">'+t('app.mise_a_disposition')+'</option></select></div>'+
    '<div class="form-grid" id="seg-fields-'+n+'">'+abFields+'</div>'+
    '<div class="input-group mix-pp" style="margin-top:12px;'+(_mixPMVal()==='per'?'':'display:none;')+'"><label>'+t('app.contact_pour_ce_trajet')+'</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><input id="spn-'+n+'" maxlength="120" placeholder="Nom et prénom" value="'+String(window._newRidePaxName||'').replace(/"/g,'&quot;')+'"><input id="spt-'+n+'" maxlength="40" placeholder="Téléphone" inputmode="tel" value="'+String(window._newRidePaxTel||'').replace(/"/g,'&quot;')+'"></div></div>';

  cont.appendChild(d);
  _mixRenumber();
  // Store field templates on element for switching
  d._abFields=abFields;
  d._dispFields=dispFields;
  var dateEl=document.getElementById('sd8-'+n);
  if(dateEl){ dateEl.value=todayStr(); dateEl.min=todayStr(); }
  setTimeout(function(){
    if(window._vehPaxSync) _vehPaxSync();
    window.attachGPToSeg(n);
    if(currentProfile?.role==='client' && typeof _addPaxSelectorToSegment==='function') _addPaxSelectorToSegment(d, window._lastPassengerList||[]);
  }, 50);
};
window.setSegType=function(btn,n,t2){
  btn.closest('.seg-type-btns').querySelectorAll('.seg-type-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var isD=t2==='disposal';
  var seg=document.getElementById('seg-'+n);
  var _ms=seg&&seg.querySelector('.mix-type'); if(_ms) _ms.value=isD?'disposal':'ab';
  var fieldsEl=document.getElementById('seg-fields-'+n);
  if(seg&&fieldsEl){
    fieldsEl.innerHTML=isD?seg._dispFields:seg._abFields;
    var dateEl=document.getElementById('sd8-'+n);
    if(dateEl){ dateEl.value=todayStr(); dateEl.min=todayStr(); }
    setTimeout(function(){
      if(window._vehPaxSync) _vehPaxSync();
      window.attachGPToSeg(n);
      if(currentProfile?.role==='client' && typeof _addPaxSelectorToSegment==='function') _addPaxSelectorToSegment(document.getElementById('seg-'+n), window._lastPassengerList||[]);
    }, 50);
  }
};
window.removeSegSafe=function(n){
  var cont=document.getElementById('mixed-segments');
  if(!cont)return;
  if(cont.querySelectorAll('.mixed-segment').length<=1) return;
  var el=document.getElementById('seg-'+n);if(el)el.remove();
  _mixRenumber();
};
// Trajet mixte : numéro de vol / train par trajet (aéroport ou gare au départ / à l'arrivée)
// ids : sfl / str (1er vol / train), sfl2 / str2 (2e du même genre)
var _SEG_TRK={ flight:'sfl', train:'str', flight2:'sfl2', train2:'str2' };
function _segTrHtml(n){
  return '<div class="input-group full tr-pair" id="strp-'+n+'" style="display:none;">'+Object.keys(_SEG_TRK).map(function(k){ var id=_SEG_TRK[k];
    return '<div class="input-group" id="'+id+'-grp-'+n+'" style="display:none;"><label id="'+id+'-lbl-'+n+'"></label><input id="'+id+'-'+n+'" class="tr-input" placeholder="'+(k.indexOf('flight')===0?'Ex. SN 3123':'Ex. IC 1832')+'" autocomplete="off" maxlength="10"></div>'; }).join('')+'</div>';
}
window._segTr=function(n){
  if(!window._trKindOf) return;
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var hasTo=!!document.getElementById('st-'+n);
  _trPairApply(document.getElementById('strp-'+n), _trPairPlan(g('sf-'+n), hasTo?g('st-'+n):null), function(k){ return document.getElementById(_SEG_TRK[k]+'-grp-'+n); }, function(k){ return document.getElementById(_SEG_TRK[k]+'-lbl-'+n); });
};
['input','change','focusout'].forEach(function(evn){ document.addEventListener(evn, function(e){ var m=e.target&&e.target.id&&e.target.id.match(/^s[ft]-(\d+)$/); if(m) setTimeout(function(){ _segTr(m[1]); },0); }, true); });
// Trajet mixte : même chauffeur (une seule demande) ou peu importe (une demande par trajet)
function _mixDrvVal(){ var b=document.querySelector('#mix-drv-grp .ev-seg .on'); return b?b.getAttribute('data-d'):'same'; }
window._mixDrv=function(v){
  document.querySelectorAll('#mix-drv-grp .ev-seg button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-d')===v); });
  var h=document.getElementById('mix-drv-hint');
  if(h) h.textContent=v==='any'?'Chaque trajet peut être pris par un chauffeur différent. Vous suivez tout depuis une seule fiche.':'Le chauffeur retenu effectue tous les trajets.';
};
// Trajet mixte : un passager pour tous les trajets, ou un passager par trajet
function _mixPMVal(){ var b=document.querySelector('#mix-pm-grp .ev-seg .on'); return b?b.getAttribute('data-m'):'one'; }
window._mixPM=function(m){
  document.querySelectorAll('#mix-pm-grp .ev-seg button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-m')===m); });
  var c=document.getElementById('mix-pax-section'); if(c) c.style.display=m==='one'?'':'none';
  document.querySelectorAll('#mixed-segments .mix-pp').forEach(function(x){ x.style.display=m==='per'?'':'none'; });
  _mixFillPax();
};
// Champs vides d'un trajet : pré-remplis avec le passager principal
window._mixFillPax=function(){
  var cn=document.getElementById('mix-cname'), cp=document.getElementById('mix-cphone');
  if(cn&&!cn.value) cn.value=window._newRidePaxName||''; if(cp&&!cp.value) cp.value=window._newRidePaxTel||'';
  document.querySelectorAll('#mixed-segments .mixed-segment').forEach(function(sg){ var n=sg.id.replace('seg-','');
    var a=document.getElementById('spn-'+n), b=document.getElementById('spt-'+n);
    if(a&&!a.value) a.value=window._newRidePaxName||''; if(b&&!b.value) b.value=window._newRidePaxTel||''; });
};
// Trajet mixte : numérotation « Trajet 1, 2… » et duplication (même présentation que les événements)
window._mixRenumber=function(){
  var segs=[].slice.call(document.querySelectorAll('#mixed-segments .mixed-segment')), k=segs.length;
  segs.forEach(function(sg,i){ var a=sg.querySelector('.ev-vh .n'), t=sg.querySelector('.mix-ttl'), dl=sg.querySelector('.mix-del'); if(a) a.textContent=i+1; if(t) t.textContent='Trajet '+(i+1); if(dl) dl.style.display=k>1?'':'none'; });
  var c=document.getElementById('mix-count'); if(c) c.textContent='Trajets ('+k+')';
};
window._mixDup=function(n){
  var src=document.getElementById('seg-'+n); if(!src) return;
  var gv=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var isD=(src.querySelector('.mix-type')||{}).value==='disposal';
  var v={ pn:gv('spn-'+n), pt:gv('spt-'+n), fl:gv('sfl-'+n), tr:gv('str-'+n), fl2:gv('sfl2-'+n), tr2:gv('str2-'+n), f:gv('sf-'+n), t:gv('st-'+n), d:gv('sd8-'+n), h:gv('sh-'+n), dur:gv('sdur-'+n), pax:gv('spax-'+n), veh:gv('sveh-'+n), notes:gv('snotes-'+n), lgL:gv('slgL-'+n), lgS:gv('slgS-'+n) };
  addMixedSegment(); var m=_segN, nw=document.getElementById('seg-'+m);
  if(nw && src.nextSibling!==nw) src.parentNode.insertBefore(nw, src.nextSibling);
  if(isD){ var b=nw.querySelectorAll('.seg-type-btn'); setSegType(b[1], m, 'disposal'); }
  setTimeout(function(){
    var sv=function(id,x){ var e=document.getElementById(id); if(e&&x!=='') e.value=x; };
    sv('sf-'+m,v.f); if(!isD) sv('st-'+m,v.t); sv('sd8-'+m,v.d); sv('sh-'+m,v.h); if(isD) sv('sdur-'+m,v.dur); sv('spax-'+m,v.pax); sv('sveh-'+m,v.veh); sv('snotes-'+m,v.notes); sv('sfl-'+m,v.fl); sv('str-'+m,v.tr); sv('sfl2-'+m,v.fl2); sv('str2-'+m,v.tr2); sv('spn-'+m,v.pn); sv('spt-'+m,v.pt); sv('slgL-'+m,v.lgL); sv('slgS-'+m,v.lgS); _segTr(m);
    _mixRenumber();
  }, 90);
};

window.adjDur=function(d){var el=document.getElementById('disp-duration');if(el){var v=parseInt(el.value)||2;el.value=Math.max(1,Math.min(24,v+d));}};

var _segN=0;

window.removeSeg=function(n){var el=document.getElementById('seg-'+n);if(el)el.remove();};



function loadProfileForm(){
  if(!currentProfile)return;
  var role=currentProfile.role||currentUser?.user_metadata?.role||'client',ct=currentProfile.client_type||'perso';
  var isP=(role==='client'&&ct==='perso'),showC=(role==='driver'||(role==='client'&&ct==='pro'));
  var show=function(id,v){var el=document.getElementById(id);if(el)el.style.display=v;};
  show('pf-names-grid',isP?'grid':'none');show('pf-company-wrap',showC?'block':'none');show('pf-vat-wrap',showC?'block':'none');
  show('pf-addr-wrap','block');
  var fn=currentProfile.first_name||'',ln=currentProfile.last_name||'',co=currentProfile.company_name||currentProfile.first_name||'';
  var set=function(id,v){var el=document.getElementById(id);if(el)el.value=v;};
  set('pf-fname',fn);set('pf-lname',ln);set('pf-company',co);set('pf-phone',currentProfile.phone||'');set('pf-vat',currentProfile.vat_number||'');
  set('pf-street',currentProfile.address_street||'');set('pf-postal',currentProfile.address_postal||'');set('pf-city',currentProfile.address_city||'');
  var ctrySel=document.getElementById('pf-country');if(ctrySel&&currentProfile.address_country)ctrySel.value=currentProfile.address_country;
  var full=showC?(co||'\u2014'):((fn+' '+ln).trim()||'\u2014');
  var fd=document.getElementById('profile-fullname');if(fd)fd.textContent=full;
  var ed=document.getElementById('profile-email-disp');if(ed)ed.textContent=(currentUser&&(currentUser.email||currentProfile.phone))||'\u2014';
  var av=document.getElementById('profile-av');
  if(av){
    if(currentProfile.avatar_url)av.innerHTML='<img src="'+currentProfile.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    else av.textContent=((showC?co:fn)[0]||'?').toUpperCase();
  }
  // Show fleet sections for drivers
  var fleetSec=document.getElementById('pf-fleet-sections');
  if(fleetSec) fleetSec.style.display=(role==='driver'?'block':'none');
  if(role==='driver'){
    _pfSetupDriverTabs(_PF_TABS_DRIVER,'driver');
    set('pf-iban',_pfFmtIban(currentProfile.iban||''));set('pf-bic',currentProfile.bic||'');
    set('pf-bank-holder',currentProfile.bank_holder||co||'');
    // Coordonnées bancaires : table privée profile_bank (lisible par la fleet et l'admin uniquement)
    if(sb && currentUser) sb.from('profile_bank').select('iban,bic,bank_holder').eq('user_id',currentUser.id).maybeSingle().then(function(res){
      var b=res&&res.data; if(!b) return;
      Object.assign(currentProfile,{iban:b.iban,bic:b.bic,bank_holder:b.bank_holder});
      set('pf-iban',_pfFmtIban(b.iban||'')); set('pf-bic',b.bic||''); if(b.bank_holder) set('pf-bank-holder',b.bank_holder);
    },function(){});
  } else {
    var _pro=(role==='client'&&ct==='pro');
    _pfSetupDriverTabs(_pfTabsClient(_pro), _pro?'client-pro':'client-perso');
  }
  _ntRender(role!=='driver');
  set('pf-login-email',(currentUser&&currentUser.email)||'');
  if(role==='driver') loadFleetProfile();
  // Lock first/last name if driver is validated
  if(role==='driver'){
    var isVerified = currentProfile.fleet_verified==='validated';
    var fnEl=document.getElementById('pf-fname');
    var lnEl=document.getElementById('pf-lname');
    if(fnEl){fnEl.disabled=isVerified;fnEl.style.opacity=isVerified?'0.5':'1';fnEl.style.cursor=isVerified?'not-allowed':'text';}
    if(lnEl){lnEl.disabled=isVerified;lnEl.style.opacity=isVerified?'0.5':'1';lnEl.style.cursor=isVerified?'not-allowed':'text';}
    // Nom de société vérifié : grisé et non modifiable
    var coEl=document.getElementById('pf-company');
    if(coEl){coEl.disabled=isVerified;coEl.style.opacity=isVerified?'0.5':'1';coEl.style.cursor=isVerified?'not-allowed':'text';coEl.style.background=isVerified?'var(--sand2)':'';}
    // Show notice under the company name
    var coWrap=document.getElementById('pf-company-wrap');
    var verNotice=document.getElementById('pf-verified-notice');
    if(coWrap && isVerified && !verNotice){
      var n=document.createElement('div');n.id='pf-verified-notice';
      n.style.cssText='font-size:11px;color:var(--green);font-weight:500;margin-top:5px;';
      n.textContent='✓ Société vérifiée — le nom ne peut plus être modifié.';
      coWrap.appendChild(n);
    } else if(verNotice){ verNotice.style.display=isVerified?'block':'none'; }
  }
}

