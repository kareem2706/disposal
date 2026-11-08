// ── Driver stats chart ──
var _dStatsYear=new Date().getFullYear(),_dStatsMonth=new Date().getMonth(),_dStatsMissions=[];
var _MNS=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
window.dStatsNav=function(dir){_dStatsMonth+=dir;if(_dStatsMonth>11){_dStatsMonth=0;_dStatsYear++;}if(_dStatsMonth<0){_dStatsMonth=11;_dStatsYear--;}renderDriverStatsChart(_dStatsMissions);};
function renderDriverStatsChart(missions){
  _dStatsMissions=missions||[];
  var lbl=document.getElementById('d-stats-month');var ch=document.getElementById('driver-stats-chart');
  if(lbl)lbl.textContent=_MNS[_dStatsMonth]+' '+_dStatsYear;
  if(!ch)return;

  // Build real calendar weeks (Mon-Sun) for the selected month
  var firstDay=new Date(_dStatsYear,_dStatsMonth,1);
  var lastDay=new Date(_dStatsYear,_dStatsMonth+1,0);
  var weeks=[];
  // Find the Monday of the week containing the 1st
  var d=new Date(firstDay);
  var dow=d.getDay();dow=dow===0?6:dow-1;
  d.setDate(d.getDate()-dow);
  while(d<=lastDay||weeks.length===0){
    var wStart=new Date(d);
    var wEnd=new Date(d);wEnd.setDate(wEnd.getDate()+6);
    weeks.push({start:new Date(wStart),end:new Date(wEnd),count:0});
    d.setDate(d.getDate()+7);
  }

  // Count only 'done' missions per week
  var maxC=0;
  missions.forEach(function(m){
    if(m.status!=='done'||!m.ride_date)return;
    var rd=new Date(m.ride_date+'T00:00:00');
    for(var wi=0;wi<weeks.length;wi++){
      if(rd>=weeks[wi].start&&rd<=weeks[wi].end){
        weeks[wi].count++;
        if(weeks[wi].count>maxC)maxC=weeks[wi].count;
        break;
      }
    }
  });

  var td=new Date();
  var pad=function(n){return n<10?'0'+n:''+n;};
  ch.innerHTML=weeks.map(function(w,i){
    var c=w.count;
    var h=maxC>0?Math.round((c/maxC)*52):8;
    var isT=td>=w.start&&td<=w.end;
    var bg=c===0?'var(--sand3)':c<5?'var(--green-bg2)':c<10?'var(--green-light)':'var(--green)';
    var tip=c===0?'Aucune course':c===1?'1 course':c+' courses';
    var wLabel=pad(w.start.getDate())+'/'+pad(w.start.getMonth()+1)+'-'+pad(w.end.getDate())+'/'+pad(w.end.getMonth()+1);
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;position:relative;" class="dstat-bar-wrap">'
      +'<div class="dstat-tooltip" style="display:none;position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:10;">'+tip+'</div>'
      +'<div style="background:'+bg+';border-radius:3px 3px 0 0;width:100%;height:'+h+'px;min-height:6px;"></div>'
      +'<div style="font-size:8px;color:'+(isT?'var(--green)':'var(--ink4)')+';white-space:nowrap;">'+(isT?'<b>':'')+ wLabel+(isT?'</b>':'')+'</div>'
      +'</div>';
  }).join('');
  ch.querySelectorAll('.dstat-bar-wrap').forEach(function(el){
    el.addEventListener('mouseenter',function(){var t=el.querySelector('.dstat-tooltip');if(t)t.style.display='block';});
    el.addEventListener('mouseleave',function(){var t=el.querySelector('.dstat-tooltip');if(t)t.style.display='none';});
  });
}
// ── Driver calendar ──
// ── Personal Mission ──
window.pmSetType=function(type){
  var green='var(--green)',greenBg='var(--green-bg)',amber='var(--amber)',amberBg='var(--amber-bg)',sand2='var(--sand2)',ink3='var(--ink3)';
  var abBtn=document.getElementById('pm-type-ab');
  var dispoBtn=document.getElementById('pm-type-dispo');
  var abFields=document.getElementById('pm-ab-fields');
  var dispoFields=document.getElementById('pm-dispo-fields');
  if(type==='ab'){
    if(abBtn){abBtn.style.border='none';abBtn.style.background=greenBg;abBtn.style.color=green;}
    if(dispoBtn){dispoBtn.style.border='none';dispoBtn.style.background=sand2;dispoBtn.style.color=ink3;}
    if(abFields)abFields.style.display='contents';
    if(dispoFields)dispoFields.style.display='none';
  }else{
    if(dispoBtn){dispoBtn.style.border='none';dispoBtn.style.background=amberBg;dispoBtn.style.color=amber;}
    if(abBtn){abBtn.style.border='none';abBtn.style.background=sand2;abBtn.style.color=ink3;}
    if(abFields)abFields.style.display='none';
    if(dispoFields)dispoFields.style.display='';
  }
  var typeInput=document.getElementById('pm-mission-type');
  if(typeInput)typeInput.value=type;
};

window.openPersonalMissionModal=function(editRide){
  var err=document.getElementById('pm-err');if(err){err.textContent='';err.classList.remove('show');}
  var editIdEl=document.getElementById('pm-edit-id');
  var titleEl=document.querySelector('#m-personal-mission .modal-title');
  var footerEl=document.getElementById('pm-footer');

  ['pm-label','pm-from','pm-to','pm-dispo-location','pm-notes','pm-vehicle','pm-plate'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  var dur=document.getElementById('pm-duration');if(dur)dur.value='2';
  var td=todayStr();
  var dt=document.getElementById('pm-date');if(dt){dt.value=td;dt.min=td;}
  var tm=document.getElementById('pm-time');if(tm)tm.value='08:00';

  if(editRide){
    if(editIdEl)editIdEl.value=editRide.id;
    if(titleEl)titleEl.textContent='Modifier la mission';
    var isD=editRide.trip_type==='disposal';
    pmSetType(isD?'dispo':'ab');
    var notesParts=(editRide.notes||'').split(' \u2014 ');
    var lbl=document.getElementById('pm-label');if(lbl)lbl.value=notesParts[0]||'';
    // Extract plate from notes
    var plateFromNotes='';
    var notesRest=notesParts.slice(1).filter(function(p){
      if(p.indexOf('Dur\u00e9e:')>=0)return false;
      var pm2=p.match(/^Plaque:(.+)$/);
      if(pm2){plateFromNotes=pm2[1];return false;}
      return true;
    }).join(' \u2014 ');
    var notesEl=document.getElementById('pm-notes');if(notesEl)notesEl.value=notesRest||'';
    if(isD){
      var loc=document.getElementById('pm-dispo-location');if(loc)loc.value=editRide.from_address||'';
      var durM=editRide.notes?editRide.notes.match(/Dur\u00e9e:(\d+)/):null;
      if(dur)dur.value=durM?durM[1]:'2';
    }else{
      var f=document.getElementById('pm-from');if(f)f.value=editRide.from_address||'';
      var t2=document.getElementById('pm-to');if(t2)t2.value=editRide.to_address||'';
    }
    if(dt)dt.value=editRide.ride_date||td;
    if(tm)tm.value=editRide.ride_time?editRide.ride_time.slice(0,5):'08:00';
    var veh=document.getElementById('pm-vehicle');if(veh)veh.value=editRide.vehicle_type||'';
    var pl=document.getElementById('pm-plate');if(pl)pl.value=plateFromNotes||'';
    if(footerEl)footerEl.innerHTML=
      '<button style="background:none;border:none;color:var(--red);font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;padding:0;margin-right:auto;" onclick="deletePersonalMission(\''+editRide.id+'\')"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'+t('app.supprimer')+'</button>'
      +'<button class="btn btn-secondary" onclick="closeModal(\'m-personal-mission\')">'+t('app.annuler')+'</button>'
      +'<button class="btn btn-green" id="btn-save-personal-mission" onclick="savePersonalMission(this)">'+t('app.enregistrer')+'</button>';
  }else{
    if(editIdEl)editIdEl.value='';
    if(titleEl)titleEl.textContent='Ajouter une mission personnelle';
    pmSetType('ab');
    if(footerEl)footerEl.innerHTML=
      '<button class="btn btn-secondary" onclick="closeModal(\'m-personal-mission\')">'+t('app.annuler')+'</button>'
      +'<button class="btn btn-green" id="btn-save-personal-mission" onclick="savePersonalMission(this)">'+t('app.enregistrer')+'</button>';
  }
  openModal('m-personal-mission');
  setTimeout(function(){if(typeof _attachGoogleAC==='function')_attachGoogleAC();},100);
};

window._editPersonalFromDetail=function(){
  // Find the button with data-ride and parse the ride
  var btn=document.querySelector('#pm-footer')?.previousElementSibling;
  // Use a simpler approach: store the ride in a global
  if(window._lastDetailRide)openPersonalMissionModal(window._lastDetailRide);
};

window.deletePersonalMission=function(id){
  _fleetConfirm('Supprimer cette mission ?','La mission personnelle sera d\u00e9finitivement supprim\u00e9e.',async function(){
    // Permanent delete (personal missions only)
    var res=await sb.rpc('api_personal_delete',{ p_id:id });
    if(res.error||!res.data){
      console.error('delete personal mission error:',res.error);
      showToast(t('app.suppression_impossible_2')+(res.error?' : '+res.error.message:' (droits insuffisants)'));
      return;
    }
    closeModal('m-personal-mission');
    showToast(t('app2.mission_supprimee'));
    _dCalCache={};_dCalRides=[];
    if(typeof loadDriverCalendar==='function'){
      try{await loadDriverCalendar(true);}catch(e){}
    }
    if(typeof loadMissions==='function'){
      try{await loadMissions();}catch(e){}
    }
    if(typeof loadDriverDashboard==='function'){
      try{await loadDriverDashboard();}catch(e){}
    }
  });
};

window.savePersonalMission=async function(btn){
  var missionType=document.getElementById('pm-mission-type')?.value||'ab';
  var label=document.getElementById('pm-label')?.value.trim();
  var date=document.getElementById('pm-date')?.value;
  var time=document.getElementById('pm-time')?.value;
  var notes=document.getElementById('pm-notes')?.value.trim();
  var vehicle=document.getElementById('pm-vehicle')?.value.trim()||null;
  var plate=document.getElementById('pm-plate')?.value.trim()||null;
  var editId=document.getElementById('pm-edit-id')?.value||null;
  var err=document.getElementById('pm-err');

  if(!label||!date||!time){
    if(err){err.textContent='Veuillez remplir les champs obligatoires.';err.classList.add('show');}
    return;
  }

  var from,to,tripType;
  if(missionType==='dispo'){
    tripType='disposal';
    from=document.getElementById('pm-dispo-location')?.value.trim()||null;
    to=null;
    var duration=document.getElementById('pm-duration')?.value||'';
    var durHours=parseInt(duration)||0;
    var noteParts=[label,durHours>0?('Dur\u00e9e:'+durHours+'h'):null];
    if(plate)noteParts.push('Plaque:'+plate);
    if(notes)noteParts.push(notes);
    notes=noteParts.filter(Boolean).join(' \u2014 ')||null;
  }else{
    tripType='ab';
    from=document.getElementById('pm-from')?.value.trim()||null;
    to=document.getElementById('pm-to')?.value.trim()||null;
    var noteParts2=[label];
    if(plate)noteParts2.push('Plaque:'+plate);
    if(notes)noteParts2.push(notes);
    notes=noteParts2.filter(Boolean).join(' \u2014 ')||null;
  }

  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){
    closeModal('m-personal-mission');
    showToast(t('app2.mission_personnelle_ajoutee'));
    return;
  }

  if(!sb||!currentUser){if(err){err.textContent='Non connect\u00e9';err.classList.add('show');}return;}
  if(btn)setLoading(btn,true,t('app.enregistrer'));

  var rideData={
    client_id:    currentUser.id,
    driver_id:    currentUser.id,
    trip_type:    tripType,
    from_address: from||null,
    to_address:   to||null,
    ride_date:    date,
    ride_time:    time,
    vehicle_type: vehicle,
    notes:        notes||null,
    status:       'personal'
  };

  try{
    var res;
    res=await sb.rpc('api_personal_save',{ p_id: editId||null, p: rideData });
    if(res.error)throw res.error;
    if(btn)setLoading(btn,false,t('app.enregistrer'));
    closeModal('m-personal-mission');
    showToast(editId?'Mission modifi\u00e9e':'Mission personnelle ajout\u00e9e');
    _dCalCache={};_dCalRides=[];
    try{await loadDriverCalendar(true);}catch(e){}
    if(typeof loadMissions==='function'){try{await loadMissions();}catch(e){}}
  }catch(e){
    if(err){err.textContent=e.message||'Erreur';err.classList.add('show');}
    if(btn)setLoading(btn,false,t('app.enregistrer'));
  }
};

// ── Rating functions ──
// ── Passenger info edit helpers ──
function _paxModalHtml(title, fields, saveType, rideId){
  return '<div id="m-pax-edit" class="glass-ov" onclick="if(event.target===this)this.remove();">'
    +'<div class="glass-sheet">'
      +'<div style="font-size:15px;font-weight:700;margin-bottom:16px;">'+title+'</div>'
      +fields
      +'<div style="display:flex;gap:8px;margin-top:16px;">'
        +'<button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById(\'m-pax-edit\').remove()">'+t('app.annuler')+'</button>'
        +'<button class="btn btn-primary" style="flex:1;" id="btn-pax-save" data-type="'+saveType+'" data-rid="'+rideId+'">'+t('app.enregistrer')+'</button>'
      +'</div>'
    +'</div>'
  +'</div>';
}

window.openDriverNoteEdit = function(rideId, currentNote){
  var existing = document.getElementById('m-pax-edit'); if(existing) existing.remove();
  var safeNote = (currentNote||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var _noteLbl = (window._lastDetailRide && window._lastDetailRide.is_subcontract) ? 'Note du sous-traitant' : 'Note au client';
  var fields = '<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">'+_noteLbl+'</label>'
    +'<textarea id="drv-note-edit" rows="3" style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;font-family:\'DM Sans\',sans-serif;resize:none;" placeholder="'+t('app2.ex_je_serai_en_avance')+'">'+safeNote+'</textarea></div>';
  document.body.insertAdjacentHTML('beforeend', _paxModalHtml(_noteLbl, fields, 'drv-note', rideId));
  setTimeout(function(){
    var btn = document.getElementById('btn-pax-save');
    if(btn) btn.addEventListener('click', function(){ saveDriverNote(this.dataset.rid); });
  }, 10);
};

window.saveDriverNote = async function(rideId){
  if(!sb) return;
  var btn = document.querySelector('#m-pax-edit .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement…'; }
  var note = (document.getElementById('drv-note-edit')?.value||'').trim();
  var {data:rd, error:fetchErr} = await sb.from('rides').select('notes').eq('id',rideId).maybeSingle();
  if(fetchErr){ showToast(t('app.erreur_3')+fetchErr.message); if(btn){btn.disabled=false;btn.textContent='Enregistrer';} return; }
  var _hadNote = /\|offer_note:/.test(rd?.notes||'');
  var {error} = await sb.rpc('api_ride_driver_note',{ p_ride:rideId, p_note:note });
  if(error){ console.error('saveDriverNote error:', error); showToast(t('app.erreur_3')+error.message); if(btn){btn.disabled=false;btn.textContent='Enregistrer';} return; }
  document.getElementById('m-pax-edit')?.remove();
  showToast(t('app.note_mise_a_jour'));
  // Reopen detail with updated data
  var {data:updated} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
  // Email the requester about the driver's note
  if(updated && updated.client_id && updated.client_id !== currentUser?.id){
    // Email « message du chauffeur » : envoyé par la base (ride_driver_emails.sql)
  }
  if(updated){ var tmp=document.createElement('div'); tmp.dataset.ride=JSON.stringify(updated).replace(/'/g,"&#39;"); openRideDetail(tmp); }
};

window.openPaxEdit = async function(rideId, currentName, currentPhone){
  var existing = document.getElementById('m-pax-edit'); if(existing) existing.remove();
  var isPro = currentProfile?.client_type === 'pro';
  var fields = '';

  if(isPro && sb){
    var {data:passList} = await sb.from('passengers').select('*').eq('client_id', currentUser.id).order('last_name',{ascending:true});
    if(passList && passList.length > 0){
      var opts = '<option value="">'+t('app.choisir_un_passager_2')+'</option>'
        + passList.map(function(p){
            var n = ((p.first_name||'')+' '+(p.last_name||'')).trim();
            var t = p.phone||'';
            return '<option value="'+n.replace(/"/g,'&quot;')+'||'+t.replace(/"/g,'&quot;')+'">'+n+(t?' · '+t:'')+'</option>';
          }).join('')
        +'<option value="__manual__">'+t('app.autre_passager')+'</option>';

      fields = '<div class="input-group" style="margin-bottom:10px;">'
        +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">'+t('app.choisir_un_passager')+'</label>'
        +'<select id="pax-select" style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:13px;background:#fff;font-family:\'DM Sans\',sans-serif;">'
        +opts+'</select></div>'
        +'<div id="pax-manual-fields" style="display:block;">';
    }
  }

  var safeN = (currentName||'').replace(/"/g,'&quot;');
  var safeT = (currentPhone||'').replace(/"/g,'&quot;');
  var nameVal = (currentName && currentName!=='—') ? ' value="'+safeN+'"' : '';
  var telVal  = currentPhone ? ' value="'+safeT+'"' : '';

  fields += '<div style="margin-bottom:10px;">'
    +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Nom &amp; Pr&eacute;nom</label>'
    +'<input id="pax-edit-name" type="text"'+nameVal+' style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;font-family:\'DM Sans\',sans-serif;" placeholder="'+t('app.marie_dupont')+'"></div>'
    +'<div>'
    +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">T&eacute;l&eacute;phone</label>'
    +'<input id="pax-edit-phone" type="tel"'+telVal+' style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;font-family:\'DM Sans\',sans-serif;" placeholder="+32 470 12 34 56"></div>'
    +(isPro ? '</div>' : '');

  document.body.insertAdjacentHTML('beforeend', _paxModalHtml('Informations passager', fields, 'pax', rideId));

  // Wire up dropdown after render
  setTimeout(function(){
    var sel = document.getElementById('pax-select');
    var manDiv = document.getElementById('pax-manual-fields');
    if(sel && manDiv){
      sel.addEventListener('change', function(){
        if(sel.value === '__manual__'){
          manDiv.style.display = 'block';
          var ni=document.getElementById('pax-edit-name'); if(ni) ni.value='';
          var ti=document.getElementById('pax-edit-phone'); if(ti) ti.value='';
        } else if(sel.value){
          manDiv.style.display = 'none';
          var parts = sel.value.split('||');
          var ni=document.getElementById('pax-edit-name'); if(ni) ni.value=parts[0]||'';
          var ti=document.getElementById('pax-edit-phone'); if(ti) ti.value=parts[1]||'';
        } else {
          manDiv.style.display = 'block';
        }
      });
    }
    var btn = document.getElementById('btn-pax-save');
    if(btn) btn.addEventListener('click', function(){ savePaxInfo(this.dataset.rid); });
  }, 10);
};

window.openNoteEdit = function(rideId, currentNote){
  var existing = document.getElementById('m-pax-edit'); if(existing) existing.remove();
  var safeNote = (currentNote||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var fields = '<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">'+t('app.note_au_chauffeur')+'</label>'
    +'<textarea id="pax-edit-note" rows="3" style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;font-family:\'DM Sans\',sans-serif;resize:none;" placeholder="'+t('app2.ex_merci_d_attendre_devant')+'">'+safeNote+'</textarea></div>';
  document.body.insertAdjacentHTML('beforeend', _paxModalHtml('Note au chauffeur', fields, 'note', rideId));
  setTimeout(function(){
    var btn = document.getElementById('btn-pax-save');
    if(btn) btn.addEventListener('click', function(){ saveNoteInfo(this.dataset.rid); });
  }, 10);
};

