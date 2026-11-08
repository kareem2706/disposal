// ── Mises à jour en direct (courses + offres) : la page, la fiche ouverte et la liste des offres
// se rafraîchissent seules, sans recharger la page. Les règles d'accès (RLS) filtrent ce que chacun reçoit.
var _liveCh=null, _liveT=null, _liveBusy=false;
function _subscribeLiveData(){
  if(!sb||!currentUser||localStorage.getItem(DEMO_MODE_KEY)==='1') return;
  try{ if(_liveCh) sb.removeChannel(_liveCh); }catch(e){}
  var isCli = currentRole==='client' && currentUser.email!==ADMIN_EMAIL;
  var soon=function(){ if(_liveT) clearTimeout(_liveT); _liveT=setTimeout(_liveRefresh, 700); };
  window._liveRefreshSoon=soon;
  _liveCh=sb.channel('live_'+currentUser.id)
    .on('postgres_changes', isCli ? {event:'*',schema:'public',table:'rides',filter:'client_id=eq.'+currentUser.id} : {event:'*',schema:'public',table:'rides'}, soon)
    .on('postgres_changes', {event:'*',schema:'public',table:'offers'}, soon)
    .subscribe();
}
// Ferme la fiche puis ouvre « Nouvelle demande » une fois le retour d'historique terminé
// (sinon le popstate de la fermeture refermait aussitôt le formulaire)
window._rdNewRide=function(){
  var done=false;
  var go=function(){ if(done) return; done=true; window.removeEventListener('popstate',go);
    setTimeout(function(){ var b=document.querySelector('#nav-cta-client .sidebar-cta'); if(b) b.click(); }, 80); };
  window.addEventListener('popstate',go);
  closeModal('m-ride-detail');
  setTimeout(go, 450);
};
// Note choisie directement depuis la fiche : ouvre l'évaluation avec les étoiles déjà cochées
window._rdRate=async function(el,score){
  await openRateModal(el.dataset.r, el.dataset.f, el.dataset.rd);
  if(score && document.getElementById('stars-display')) rateSet(score);
};
async function _asgSig(rideId){
  if(!sb||!rideId||localStorage.getItem(DEMO_MODE_KEY)==='1') return null;
  try{
    var o=(await sb.from('offers').select('vehicle_id,fleet_driver_id').eq('ride_id',rideId).eq('status','accepted').maybeSingle()).data;
    return o ? (o.vehicle_id||'')+'|'+(o.fleet_driver_id||'') : '';
  }catch(e){ return null; }
}
function _isOpen(id){ var m=document.getElementById(id); return !!(m&&m.classList.contains('open')); }
async function _liveRefresh(){
  if(_liveBusy||!sb||!currentUser) return;
  _liveBusy=true;
  try{
    // Une saisie est en cours (paiement, offre, formulaire…) : on ne touche à rien
    var busyForms=['m-payment','m-submit-offer','m-new-ride','m-subcontract','m-pax-edit','m-rate','m-mission-assign'];
    if(busyForms.some(_isOpen) || document.getElementById('m-pax-edit')) { _liveBusy=false; return; }
    // 1) Page affichée
    var pg=document.querySelector('.page.active');
    if(pg) await loadPageData(pg.id.replace(/^page-/,''));
    // 1b) Fiche d'un événement ouverte (au premier plan)
    if(_isOpen('m-event') && window._evOpenId && !_isOpen('m-ride-detail')) await openEventDetail(window._evOpenId, true);
    // 2) Liste des offres ouverte
    if(_isOpen('m-view-offers') && currentRideId && currentRole==='client'){ await openOffersModal(currentRideId); }
    // 3) Fiche de course ouverte (au premier plan)
    else if(_isOpen('m-ride-detail') && window._lastDetailRide){
      var old=window._lastDetailRide;
      var res=await sb.from('rides').select('*').eq('id',old.id).maybeSingle();
      if(res&&res.data){
        await _mergeRidePrivate(res.data);
        var f=res.data, changed=['status','notes','final_price','driver_id','payment_method','ride_date','ride_time','from_address','to_address','on_way_at','pickup_at','passengers','vehicle_type']
          .some(function(k){ return String(f[k]==null?'':f[k]) !== String(old[k]==null?'':old[k]); });
        // Véhicule ou chauffeur attribué modifié (offre retenue)
        var sg=await _asgSig(f.id), la=window._lastDetailAsg;
        if(sg!==null && la && la.id===f.id){ if(la.sig!==null && la.sig!==sg) changed=true; la.sig=sg; }
        if(changed && _isOpen('m-ride-detail') && window._lastDetailRide && window._lastDetailRide.id===f.id){
          var el=document.createElement('div'); el.dataset.ride=JSON.stringify(f).replace(/'/g,"&#39;");
          _openRideDetailImpl(el);
        }
      }
    }
  }catch(e){ console.warn('[live]', e); }
  _liveBusy=false;
}


window.showPaymentResult=function(type,title,msg){
  if(type!=='success'){ _payPopup({ tone:'error', title:title, msg:msg }); return; }
  var el=document.getElementById('m-payment-result');if(!el)return;
  document.getElementById('payment-result-icon').textContent=type==='success'?'✅':'❌';
  document.getElementById('payment-result-title').textContent=title;
  document.getElementById('payment-result-title').style.color=type==='success'?'var(--green)':'var(--red)';
  document.getElementById('payment-result-msg').textContent=msg;openModal('m-payment-result');
};

// Calendrier : un trajet mixte est découpé en ses trajets (chacun à sa date / heure) ;
// pastille bleue = trajet mixte, violette = événement
function _calExpand(rides){
  var out=[];
  (rides||[]).forEach(function(r){
    var segs=r.trip_type==='mixed'?parseMixedNotes(r.notes||''):[];
    if(!segs.length){ out.push(r); return; }
    segs.forEach(function(sg,i){ var isD=sg.type.toLowerCase().indexOf('disp')>=0;
      out.push(Object.assign({},r,{ ride_date:sg.date||r.ride_date, ride_time:sg.time||(i===0?r.ride_time:''), from_address:sg.from||r.from_address,
        to_address:isD?'':(sg.to||''), trip_type:isD?'disposal':'ab', vehicle_type:sg.veh||r.vehicle_type, _segN:i+1, _segTot:segs.length, _orig:r })); });
  });
  return out;
}
function _calKindDot(r){
  var c=_calKindColor(r);
  return c?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+c+';margin-right:4px;vertical-align:1px;flex-shrink:0;"></span>':'';
}
function _calKindColor(r){ return (r._segN||r.trip_type==='mixed'||r.event_kind==='mixed')?'#3B7DD8':(r.event_name&&r.event_kind!=='mixed')?'#8E6AD8'
  :(r.trip_type==='disposal'&&r.status!=='personal'&&r.status!=='done'&&r.status!=='cancelled')?'#E09A2B':''; }
function _buildCalCell(ds,isT,calRides,calView){
  var day=parseInt(ds.split('-')[2]);
  var rides=calRides.filter(function(r){return r.ride_date===ds;});
  var sc={waiting:'#F0D080',offers:'#90C4F8',confirmed:'#6FCF97',active:'#27AE60',done:'#E0E0E0',cancelled:'#FFAAAA',personal:'#D8C4F0'};
  var sl={waiting:'Attente',offers:'Offres',confirmed:'Confirmée',active:'Active',done:'Terminée',cancelled:'Annulée',personal:'Personnelle'};
  var tl=function(r){if(r.status==='personal'){var lbl=r.notes?r.notes.split(' — ')[0]:null;return lbl||r.from_address||'Mission';}return r._segN?'Trajet '+r._segN+'/'+r._segTot:r.trip_type==='disposal'?'Disp.':r.trip_type==='mixed'?'Mixte':'A→B';};
  var cellH=calView==='week'?'140px':'72px';
  var maxR=calView==='week'?rides.length:2;
  var p=[];
  p.push('<div style="min-height:'+cellH+';border-radius:8px;border:1px solid '+(isT?'transparent':'var(--sand3)')+';background:'+(isT?'var(--green-bg)':'#FCFCFC')+';padding:6px;">');
  p.push('<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">');
  p.push('<span style="font-size:12px;font-weight:'+(isT?'700':'500')+';color:'+(isT?'var(--green)':'var(--ink)')+';">'+day+'</span>');
  if(rides.length>2&&calView==='month')p.push('<span class="cal-mb" data-ds="'+ds+'" style="font-size:9px;color:var(--blue);cursor:pointer;font-weight:600;">+'+rides.length+' '+t('app.sem')+'</span>');
  p.push('</div>');
  rides.slice(0,maxR).forEach(function(r){var enc=encodeURIComponent(JSON.stringify(r));var timeStr=r.ride_time?r.ride_time.slice(0,5)+' ':'';p.push('<div class="cal-rp" data-enc="'+enc+'" style="background:'+(sc[r.status]||'#EEE')+';border-radius:4px;padding:2px 5px;font-size:9.5px;font-weight:600;color:#1A2E1A;margin-bottom:2px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_calKindDot(r)+timeStr+tl(r)+' \u2022 '+(sl[r.status]||r.status)+'</div>');});
  if(rides.length>2&&calView==='month')p.push('<div class="cal-mb" data-ds="'+ds+'" style="font-size:9px;color:var(--blue);cursor:pointer;">'+t('app.voir_tout')+'</div>');
  p.push('</div>');return p.join('');
}
// Portrait phone layout for the driver calendar: compact month (dots) + vertical week list
var _CAL_SC={waiting:'#F0D080',offers:'#90C4F8',confirmed:'#6FCF97',active:'#27AE60',done:'#E0E0E0',cancelled:'#FFAAAA',personal:'#D8C4F0'};
var _CAL_SL={waiting:'Attente',offers:'Offres',confirmed:'Confirmée',active:'Active',done:'Terminée',cancelled:'Annulée',personal:'Personnelle'};
function _renderCalGridMobile(grid,titleEl,calYear,calMonth,calView,calWS,calRides,viewFn,MN,DN,td){
  var pad=function(n){return String(n).padStart(2,'0');};
  var html='';
  if(calView==='week'){
    var ws=new Date(calWS),we=new Date(ws);we.setDate(we.getDate()+6);
    titleEl.textContent=ws.getDate()+' '+MN[ws.getMonth()].slice(0,3)+' – '+we.getDate()+' '+MN[we.getMonth()].slice(0,3)+' '+we.getFullYear();
    for(var di=0;di<7;di++){
      var dd=new Date(ws);dd.setDate(dd.getDate()+di);
      var ds=dd.getFullYear()+'-'+pad(dd.getMonth()+1)+'-'+pad(dd.getDate());
      var isT=td.toDateString()===dd.toDateString();
      var rides=calRides.filter(function(r){return r.ride_date===ds;}).sort(function(a,b){return (a.ride_time||'').localeCompare(b.ride_time||'');});
      html+='<div style="display:flex;gap:10px;padding:10px 4px;border-bottom:1px solid var(--sand2);">'
        +'<div style="width:42px;flex-shrink:0;text-align:center;color:'+(isT?'var(--green)':'var(--ink)')+';">'
          +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:'+(isT?'var(--green)':'var(--ink4)')+';">'+DN[di]+'</div>'
          +'<div style="font-size:18px;font-weight:700;">'+dd.getDate()+'</div>'
        +'</div><div style="flex:1;min-width:0;">';
      if(!rides.length) html+='<div style="font-size:12px;color:var(--ink4);padding-top:8px;">—</div>';
      rides.forEach(function(r){
        var enc=encodeURIComponent(JSON.stringify(r));
        var lbl=r.status==='personal'?((r.notes?r.notes.split(' — ')[0]:null)||'Mission'):(r._segN?'Trajet '+r._segN+'/'+r._segTot:r.trip_type==='disposal'?'Disposition':r.trip_type==='mixed'?'Mixte':'A → B');
        var rt=r.status==='personal'?(r.from_address||''):((r.from_address||'').split(',')[0]+(r.to_address?' → '+r.to_address.split(',')[0]:''));
        html+='<div class="cal-rp" data-enc="'+enc+'" style="background:'+(_CAL_SC[r.status]||'#EEE')+';border-radius:8px;padding:7px 10px;margin-bottom:5px;cursor:pointer;color:#1A2E1A;">'
          +'<div style="font-size:12.5px;font-weight:700;">'+_calKindDot(r)+(r.ride_time?r.ride_time.slice(0,5)+' · ':'')+lbl+' · '+(_CAL_SL[r.status]||r.status)+'</div>'
          +(rt?'<div style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+rt+'</div>':'')
        +'</div>';
      });
      html+='</div></div>';
    }
  }else{
    titleEl.textContent=MN[calMonth]+' '+calYear;
    var fd=new Date(calYear,calMonth,1).getDay();fd=fd===0?6:fd-1;
    var dim=new Date(calYear,calMonth+1,0).getDate();
    html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px;">';
    DN.forEach(function(d){html+='<div style="text-align:center;font-size:10px;font-weight:700;color:var(--ink4);text-transform:uppercase;padding:2px 0;">'+d.slice(0,1)+'</div>';});
    html+='</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">';
    for(var e=0;e<fd;e++)html+='<div></div>';
    for(var day=1;day<=dim;day++){
      var ds2=calYear+'-'+pad(calMonth+1)+'-'+pad(day);
      var isT2=td.getFullYear()===calYear&&td.getMonth()===calMonth&&td.getDate()===day;
      var rs=calRides.filter(function(r){return r.ride_date===ds2;});
      var dots=rs.slice(0,4).map(function(r){return '<span style="width:6px;height:6px;border-radius:50%;background:'+(r.status==='done'?'#BDBDBD':(_calKindColor(r)||_CAL_SC[r.status]||'#CCC'))+';display:inline-block;"></span>';}).join('');
      html+='<div class="cal-mb" data-ds="'+ds2+'" style="min-height:46px;border-radius:8px;border:1px solid '+(isT2?'transparent':'var(--sand3)')+';background:'+(isT2?'var(--green-bg)':'#FCFCFC')+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;">'
        +'<span style="font-size:13px;font-weight:'+(isT2?'700':'500')+';color:'+(isT2?'var(--green)':'var(--ink)')+';">'+day+'</span>'
        +'<span style="display:flex;gap:2px;height:6px;align-items:center;">'+dots+(rs.length>4?'<span style="font-size:9px;color:var(--ink3);">+</span>':'')+'</span>'
      +'</div>';
    }
    html+='</div><div style="font-size:11px;color:var(--ink4);text-align:center;margin-top:10px;">'+t('app.touchez_un_jour_pour_voir')+'</div>';
  }
  grid.innerHTML=html;
  grid.onclick=function(e){
    var rp=e.target.closest('.cal-rp');if(rp){try{var r=JSON.parse(decodeURIComponent(rp.dataset.enc));r=r._orig||r;var tmp=document.createElement('div');tmp.dataset.ride=JSON.stringify(r).replace(/'/g,"&#39;");openRideDetail(tmp);}catch(ex){}return;}
    var mb=e.target.closest('.cal-mb');if(mb&&viewFn){viewFn('week',mb.dataset.ds);}
  };
}
// Re-render the driver calendar when the phone rotates (portrait <-> landscape)
(function(){var _t,_w=_vw();window.addEventListener('resize',function(){clearTimeout(_t);_t=setTimeout(function(){var w=_vw();var ch=((w<=600)!==(_w<=600));_w=w;if(ch&&document.querySelector('#page-d-calendar.active')){_renderCalGrid('d-cal-grid','d-cal-title',_dCalY,_dCalM,_dCalView,_dCalWS,_dCalRides);}if(ch&&document.querySelector('#page-calendar.active')&&_calWS){_renderCalGrid('cal-grid','cal-title',_calY,_calM,_calView,_calWS,_calRides,calPrevMonth,calNextMonth,calSetView);}},200);});})();
function _renderCalGrid(gridId,titleId,calYear,calMonth,calView,calWS,calRides,prevFn,nextFn,setViewFn){
  var MN=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var DN=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  var td=new Date();
  calRides=_calExpand(calRides);
  var html='',grid=document.getElementById(gridId),titleEl=document.getElementById(titleId);
  if(!grid||!titleEl)return;
  var _viewFn=setViewFn||(gridId==='d-cal-grid'?window.dCalView:window.calSetView);
  if((gridId==='d-cal-grid'||gridId==='cal-grid')&&_vw()<=600){ _renderCalGridMobile(grid,titleEl,calYear,calMonth,calView,calWS,calRides,_viewFn,MN,DN,td); return; }
  if(calView==='week'){
    var ws=new Date(calWS),we=new Date(ws);we.setDate(we.getDate()+6);
    titleEl.textContent=ws.getDate()+' '+MN[ws.getMonth()].slice(0,3)+' – '+we.getDate()+' '+MN[we.getMonth()].slice(0,3)+' '+we.getFullYear();
    html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;">';
    for(var di=0;di<7;di++){var dd=new Date(ws);dd.setDate(dd.getDate()+di);html+='<div style="text-align:center;font-size:10px;font-weight:700;color:var(--ink4);text-transform:uppercase;padding:4px 0;">'+DN[di]+'</div>';}
    html+='</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
    for(var di=0;di<7;di++){var dd=new Date(ws);dd.setDate(dd.getDate()+di);var isT=td.toDateString()===dd.toDateString();var ds=dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0');html+=_buildCalCell(ds,isT,calRides,calView);}
    html+='</div>';
  }else{
    titleEl.textContent=MN[calMonth]+' '+calYear;
    var fd=new Date(calYear,calMonth,1).getDay();fd=fd===0?6:fd-1;
    var dim=new Date(calYear,calMonth+1,0).getDate();
    html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;">';
    DN.forEach(function(d){html+='<div style="text-align:center;font-size:10px;font-weight:700;color:var(--ink4);text-transform:uppercase;padding:4px 0;">'+d+'</div>';});
    html+='</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
    for(var e=0;e<fd;e++)html+='<div style="min-height:72px;"></div>';
    for(var day=1;day<=dim;day++){var ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');var isT=td.getFullYear()===calYear&&td.getMonth()===calMonth&&td.getDate()===day;html+=_buildCalCell(ds,isT,calRides,calView);}
    html+='</div>';
  }
  grid.innerHTML=html;
  grid.onclick=function(e){
    var mb=e.target.closest('.cal-mb');if(mb){_viewFn('week',mb.dataset.ds);return;}
    var rp=e.target.closest('.cal-rp');if(rp){try{var r=JSON.parse(decodeURIComponent(rp.dataset.enc));r=r._orig||r;var tmp=document.createElement('div');tmp.dataset.ride=JSON.stringify(r).replace(/'/g,"&#39;");openRideDetail(tmp);}catch(ex){}}
  };
}

// CLIENT CALENDAR
var _calY=new Date().getFullYear(),_calM=new Date().getMonth(),_calRides=[],_calView='month',_calWS=null,_calCache={},_calFilter='';
window.calPrevMonth=function(){if(_calView==='week'){var d=new Date(_calWS);d.setDate(d.getDate()-7);_calWS=d;}else{_calM--;if(_calM<0){_calM=11;_calY--;}}loadCalendar(true);};
window.calNextMonth=function(){if(_calView==='week'){var d=new Date(_calWS);d.setDate(d.getDate()+7);_calWS=d;}else{_calM++;if(_calM>11){_calM=0;_calY++;}}loadCalendar(true);};
window.calSetView=function(view,ds){if(!view)return;_calView=view;document.querySelectorAll('.cal-view-btn').forEach(function(b){b.classList.toggle('cal-view-active',b.dataset.view===view);});if(view==='week'){var d=new Date((ds||_ymdLocal())+'T00:00:00');var dow=d.getDay();dow=dow===0?6:dow-1;d.setDate(d.getDate()-dow);_calWS=d;_calM=d.getMonth();_calY=d.getFullYear();}loadCalendar(true);};
window.calSetFilter=function(status){
  _calFilter=status;
  var _calColors={
    '':    {bg:'var(--green)',   border:'var(--green)',   color:'#fff'},
    'confirmed': {bg:'var(--green-bg)', border:'var(--green)',   color:'var(--green)'},
    'done':      {bg:'var(--sand2)',    border:'var(--sand3)',   color:'var(--ink4)'},
    'waiting':   {bg:'var(--amber-bg)',  border:'var(--amber)',   color:'var(--amber)'},
    'cancelled': {bg:'var(--red-bg)',   border:'var(--red)',     color:'var(--red)'}
  };
  ['','confirmed','done','waiting','cancelled'].forEach(function(s){
    var btn=document.getElementById('cal-f-'+(s||'all'));
    if(!btn) return;
    var c=_calColors[s]||_calColors[''];
    var active=(_calFilter===s);
    btn.style.background = active ? c.border : c.bg;
    btn.style.color      = active ? '#fff' : c.color;
    btn.style.borderColor= c.border;
    btn.style.opacity    = active ? '1' : '0.55';
  });
  loadCalendar(false);
};
window.loadCalendar=async function(force){
  if(sb&&currentUser&&localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    var s,e;
    if(_calView==='week'&&_calWS){var we=new Date(_calWS);we.setDate(we.getDate()+6);s=_ymdLocal(_calWS);e=_ymdLocal(we);}
    else{var fd2=new Date(_calY,_calM,1).getDay();fd2=fd2===0?6:fd2-1;var sD=new Date(_calY,_calM,1-fd2);var eD=new Date(_calY,_calM+1,14);s=_ymdLocal(sD);e=_ymdLocal(eD);}
    var ck=s+'_'+e;
    if(force||!_calCache[ck]){var res=await sb.from('rides').select('*').eq('client_id',currentUser.id).gte('ride_date',s).lte('ride_date',e);await _mergeRidePrivate(res.data||[]);_calCache[ck]=res.data||[];}
    _calRides=_calFilter ? (_calCache[ck]||[]).filter(function(r){return r.status===_calFilter;}) : (_calCache[ck]||[]);
  }
  if(!_calWS){var d=new Date();var dow=d.getDay();dow=dow===0?6:dow-1;d.setDate(d.getDate()-dow);_calWS=d;}
  _renderCalGrid('cal-grid','cal-title',_calY,_calM,_calView,_calWS,_calRides,calPrevMonth,calNextMonth,calSetView);
};

// DRIVER CALENDAR
var _dCalY=new Date().getFullYear(),_dCalM=new Date().getMonth(),_dCalRides=[],_dCalView='month',_dCalWS=null,_dCalCache={},_dCalFilter='';
window.dCalPrev=function(){if(_dCalView==='week'){var d=new Date(_dCalWS);d.setDate(d.getDate()-7);_dCalWS=d;}else{_dCalM--;if(_dCalM<0){_dCalM=11;_dCalY--;}}loadDriverCalendar(true);};
window.dCalNext=function(){if(_dCalView==='week'){var d=new Date(_dCalWS);d.setDate(d.getDate()+7);_dCalWS=d;}else{_dCalM++;if(_dCalM>11){_dCalM=0;_dCalY++;}}loadDriverCalendar(true);};
window.dCalView=function(view,ds){if(!view)return;_dCalView=view;document.querySelectorAll('.d-cal-vbtn').forEach(function(b){b.classList.toggle('d-cal-vactive',b.dataset.view===view);});if(view==='week'){var d=new Date((ds||_ymdLocal())+'T00:00:00');var dow=d.getDay();dow=dow===0?6:dow-1;d.setDate(d.getDate()-dow);_dCalWS=d;_dCalM=d.getMonth();_dCalY=d.getFullYear();}loadDriverCalendar(true);};
window.dCalSetFilter=function(status){
  _dCalFilter=status;
  var _dCalColors={
    '':          {bg:'var(--green)',   border:'var(--green)',   color:'#fff'},
    'confirmed': {bg:'var(--green-bg)', border:'var(--green)',  color:'var(--green)'},
    'done':      {bg:'var(--sand2)',   border:'var(--sand3)',   color:'var(--ink4)'},
    'personal':  {bg:'#E8DEF8',        border:'#6750A4',        color:'#6750A4'},
    'cancelled': {bg:'var(--red-bg)',  border:'var(--red)',     color:'var(--red)'}
  };
  ['','confirmed','done','personal','cancelled'].forEach(function(s){
    var btn=document.getElementById('dcal-f-'+(s||'all'));
    if(!btn) return;
    var c=_dCalColors[s]||_dCalColors[''];
    var active=(_dCalFilter===s);
    btn.style.background = active ? c.border : c.bg;
    btn.style.color      = active ? '#fff' : c.color;
    btn.style.borderColor= c.border;
    btn.style.opacity    = active ? '1' : '0.55';
  });
  loadDriverCalendar(false);
};
window.loadDriverCalendar=async function(force){
  if(sb&&currentUser&&localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    var s,e;
    if(_dCalView==='week'&&_dCalWS){var we=new Date(_dCalWS);we.setDate(we.getDate()+6);s=_ymdLocal(_dCalWS);e=_ymdLocal(we);}
    else{var fd2=new Date(_dCalY,_dCalM,1).getDay();fd2=fd2===0?6:fd2-1;var sD=new Date(_dCalY,_dCalM,1-fd2);var eD=new Date(_dCalY,_dCalM+1,14);s=_ymdLocal(sD);e=_ymdLocal(eD);}
    var ck=s+'_'+e;
    if(force||!_dCalCache[ck]){var res=await sb.from('rides').select('*').eq('driver_id',currentUser.id).gte('ride_date',s).lte('ride_date',e);_dCalCache[ck]=res.data||[];}
    _dCalRides=_dCalFilter ? (_dCalCache[ck]||[]).filter(function(r){return r.status===_dCalFilter;}) : (_dCalCache[ck]||[]);
  }
  if(!_dCalWS){var d=new Date();var dow=d.getDay();dow=dow===0?6:dow-1;d.setDate(d.getDate()-dow);_dCalWS=d;}
  _renderCalGrid('d-cal-grid','d-cal-title',_dCalY,_dCalM,_dCalView,_dCalWS,_dCalRides);
};


