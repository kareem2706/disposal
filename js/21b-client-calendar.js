// ════════════════════════════════════════════════════════════════
// Calendrier de l'espace client (thème client) — 15/11/2026
//  • navigation mois / semaine, filtres par statut avec compteurs ;
//  • grille sans bordures, pastilles colorées par statut, jour sélectionné ;
//  • sous la grille : les demandes du jour sélectionné (ouvre la fiche au clic).
// Les données viennent de loadCalendar() (js/21-realtime-calendar.js) : _calCache / _calRides.
// ════════════════════════════════════════════════════════════════
var _ccSel=null;
var _CC_GRP={ confirmed:['confirmed','active','done'], waiting:['waiting','offers','pending_payment'], cancelled:['cancelled'] };
var _CC_DOT={ confirmed:'#3DAA5C', active:'#3DAA5C', done:'#B9BDBA', waiting:'#E0A526', offers:'#E0A526', pending_payment:'#E0A526', cancelled:'#E05A4F' };
function _ccLang(){ return (typeof currentLang!=='undefined'&&currentLang)||'fr'; }
function _ccYmd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _ccCap(s){ return s?s.charAt(0).toUpperCase()+s.slice(1):s; }

window._ccSetFilter=function(g){ _calFilter=g; loadCalendar(false); };
window._ccPick=function(ds){ _ccSel=ds; if(typeof loadCalendar==='function') loadCalendar(false); };
window._ccOpen=function(el){
  try{ var r=JSON.parse(decodeURIComponent(el.dataset.enc)); r=r._orig||r; var tmp=document.createElement('div'); tmp.dataset.ride=JSON.stringify(r).replace(/'/g,'&#39;'); openRideDetail(tmp); }catch(e){}
};

function _renderClientCal(all){
  var box=document.getElementById('ccal'); if(!box) return;
  var lg=_ccLang(), td=new Date(), tds=_ccYmd(td);
  var rides=_calExpand(all||[]);
  var inGrp=function(r,g){ return !g || (_CC_GRP[g]||[g]).indexOf(r.status)>=0; };
  var shown=rides.filter(function(r){ return inGrp(r,_calFilter); });

  // Jours affichés
  var days=[], title;
  if(_calView==='week'){
    var ws=new Date(_calWS); for(var i=0;i<7;i++){ var d=new Date(ws); d.setDate(ws.getDate()+i); days.push(d); }
    var we=days[6];
    title=ws.getDate()+' '+ws.toLocaleDateString(lg,{month:'short'}).replace('.','')+' – '+we.getDate()+' '+we.toLocaleDateString(lg,{month:'short'}).replace('.','')+' '+we.getFullYear();
  } else {
    var dim=new Date(_calY,_calM+1,0).getDate(); for(var k=1;k<=dim;k++) days.push(new Date(_calY,_calM,k));
    title=_ccCap(new Date(_calY,_calM,1).toLocaleDateString(lg,{month:'long',year:'numeric'}));
  }
  var dsList=days.map(_ccYmd);
  if(!_ccSel || dsList.indexOf(_ccSel)<0) _ccSel = dsList.indexOf(tds)>=0 ? tds : dsList[0];

  // Compteurs (période affichée, tous statuts)
  var inRange=rides.filter(function(r){ return dsList.indexOf(r.ride_date)>=0; });
  var cnt=function(g){ return inRange.filter(function(r){ return inGrp(r,g); }).length; };
  var chip=function(g,lbl,col){ var on=(_calFilter||'')===g;
    return '<button type="button" class="cc-chip'+(on?' on':'')+'" onclick="_ccSetFilter(\''+g+'\')">'+(col?'<i style="background:'+col+'"></i>':'')+lbl+(g?'<b>'+cnt(g)+'</b>':'')+'</button>'; };

  var DN=[]; for(var j=0;j<7;j++){ DN.push(new Date(2024,0,1+j).toLocaleDateString(lg,{weekday:'narrow'}).toUpperCase()); }
  var lead=_calView==='week'?0:((new Date(_calY,_calM,1).getDay()+6)%7);
  var cells='';
  for(var e=0;e<lead;e++) cells+='<div></div>';
  days.forEach(function(d){
    var ds=_ccYmd(d), rs=shown.filter(function(r){ return r.ride_date===ds; });
    var dots=rs.slice(0,4).map(function(r){ return '<i style="background:'+(_CC_DOT[r.status]||'#C8CBC9')+'"></i>'; }).join('');
    cells+='<button type="button" class="cc-day'+(ds===_ccSel?' sel':'')+(ds===tds?' today':'')+'" onclick="_ccPick(\''+ds+'\')"><span>'+d.getDate()+'</span><em>'+dots+'</em></button>';
  });

  // Demandes du jour sélectionné
  var sel=new Date(_ccSel+'T00:00:00');
  var dayR=shown.filter(function(r){ return r.ride_date===_ccSel; }).sort(function(a,b){ return String(a.ride_time||'').localeCompare(String(b.ride_time||'')); });
  var dTitle=_ccCap(sel.toLocaleDateString(lg,{weekday:'short',day:'numeric',month:'short',year:'numeric'}));
  var nConf=dayR.filter(function(r){ return inGrp(r,'confirmed'); }).length;
  var sub=!dayR.length?t('cc.aucune'):(nConf===dayR.length?(dayR.length>1?t('cc.n_conf').replace('{n}',dayR.length):t('cc.une_conf')):(dayR.length>1?t('cc.n_dem').replace('{n}',dayR.length):t('cc.une_dem')));
  var list=dayR.map(function(r){
    var k=r.status==='personal'?'personal':(r.event_name&&r.event_kind!=='mixed')?'event':(r._segN||r.trip_type==='mixed')?'mixed':r.trip_type==='disposal'?'disposal':'ab';
    var lbl=t(k==='personal'?'ch.t_personal':k==='event'?'ch.t_event':k==='mixed'?'ch.t_mixed':k==='disposal'?'ch.t_disp':'ch.t_ab');
    var from=_chShortAddr(cleanAddr(r.from_address)), to=r.trip_type==='disposal'?'':_chShortAddr(cleanAddr(r.to_address));
    var route=_chEsc(from)+(to&&to!=='—'?' → '+_chEsc(to):'');
    var oc=r._offerCount||(r.offers&&r.offers[0]?parseInt(r.offers[0].count)||0:0);
    return '<button type="button" class="cc-ride" data-enc="'+encodeURIComponent(JSON.stringify(r))+'" onclick="_ccOpen(this)">'
      +'<span class="cc-ic">'+_chIc(k)+'</span>'
      +'<span class="cc-tx"><b>'+_chEsc(lbl)+'</b><span>'+route+(r.ride_time?' · '+String(r.ride_time).slice(0,5):'')+'</span>'+getStatusPill(r.status,oc)+'</span>'
      +'<svg class="ch-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>';
  }).join('');

  var arrow=function(dir,fn){ return '<button type="button" class="cc-nav" onclick="'+fn+'()" aria-label="'+dir+'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+(dir==='prev'?'M15 6l-6 6 6 6':'M9 6l6 6-6 6')+'"/></svg></button>'; };
  box.innerHTML=
    '<div class="cc-head">'+arrow('prev','calPrevMonth')+'<h2 class="cc-title">'+_chEsc(title)+'</h2>'+arrow('next','calNextMonth')+'</div>'
    +'<div class="cc-seg"><button type="button" class="'+(_calView!=='week'?'on':'')+'" onclick="_ccView(\'month\')">'+t('ap.mois')+'</button><button type="button" class="'+(_calView==='week'?'on':'')+'" onclick="_ccView(\'week\')">'+t('ap.semaine')+'</button></div>'
    +'<div class="cc-chips">'+chip('',t('ap.tout'))+chip('confirmed',t('cc.confirmees'),'#3DAA5C')+chip('waiting',t('ap.en_attente'),'#E0A526')+chip('cancelled',t('cc.annulees'),'#E05A4F')+'</div>'
    +'<div class="cc-card"><div class="cc-dn">'+DN.map(function(x){ return '<span>'+x+'</span>'; }).join('')+'</div><div class="cc-grid">'+cells+'</div></div>'
    +'<div class="cc-card cc-daybox"><div class="cc-dhead"><div><h3>'+_chEsc(dTitle)+'</h3><p>'+_chEsc(sub)+'</p></div></div>'+(list?'<div class="cc-list">'+list+'</div>':'')+'</div>';
}
window._ccView=function(v){ calSetView(v, _ccSel); };
