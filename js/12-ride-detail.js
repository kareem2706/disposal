// ── Shared helper: builds identical ride detail HTML for both detail popup and offer modal ──
function _buildRideDetailBody(r, opts){
  opts = opts || {};
  var idPrefix = opts.idPrefix || '';
  var showStatus = opts.showStatus !== false;
  var isMixed=r.trip_type==='mixed', isDisp=r.trip_type==='disposal';
  var mixedSegs=isMixed?parseMixedNotes(r.notes||''):[];
  var from=cleanAddr(r.from_address||'\u2014'), to=r.to_address||'\u2014';
  var iconGreen='<svg width="14" height="18" viewBox="0 0 24 30" fill="#1B5E3B"><path d="M12 0C7.6 0 4 3.6 4 8c0 5.4 8 16 8 16s8-10.6 8-16c0-4.4-3.6-8-8-8zm0 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/></svg>';
  var iconRed='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
  function segRow(dot,label,addr,withLine){
    var ico=dot==='green'?iconGreen:iconRed;
    return '<div style="display:flex;gap:14px;"><div style="display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;"><div style="margin-top:3px;flex-shrink:0;">'+ico+'</div>'+(withLine?'<div style="width:2px;flex:1;background:var(--sand3);min-height:14px;margin-top:2px;"></div>':'')+'</div><div style="flex:1;min-width:0;'+(withLine?'padding-bottom:10px':'padding-bottom:2px')+';"><div class="detail-seg-label">'+label+'</div><div class="detail-seg-addr">'+(addr||'\u2014')+'</div></div></div>';
  }
  function segCard(s,idx,isLast,skipFrom){
    var isD=s.type.toLowerCase().indexOf('disp')>=0;
    var label=t('lbl_segment')+' '+(idx+1)+' \u2014 '+(isD?t('title_disp'):t('title_ab'));
    var mp=[];var dt=(s.date?formatDate(s.date):'')+( s.time?' '+s.time:'');
    if(dt.trim())mp.push(dt.trim());if(s.pax)mp.push(s.pax+' pax');if(s.veh)mp.push(s.veh);if(s.flight)mp.push('Vol '+s.flight);if(s.train)mp.push('Train '+s.train);if(s.flight2)mp.push('Vol '+s.flight2);if(s.train2)mp.push('Train '+s.train2);if(s.paxName)mp.push(s.paxName+(s.paxTel?' ('+s.paxTel+')':''));
    var metaHtml=mp.length?'<div style="font-size:12px;color:var(--ink3);margin-bottom:8px;">'+mp.join(' \u00b7 ')+'</div>':'';
    var noteHtml=s.note?'<div style="font-size:12px;color:var(--ink3);margin-top:6px;font-style:italic;"><span style="font-style:normal;">'+t('app.note_du_client')+' </span>'+s.note+'</div>':'';
    var rows='';
    if(isD){
      rows+=segRow('green',t('lbl_pickup'),s.from||'\u2014',true);
      if(s.dur) rows+='<div style="display:flex;gap:14px;padding:2px 0;"><div style="width:16px;flex-shrink:0;display:flex;justify-content:center;"><div class="detail-seg-vline" style="flex:1;"></div></div><div style="padding:3px 0;font-size:11.5px;color:var(--ink3);">'+t('app2.duree')+' '+s.dur+'</div></div>';

    } else {
      if(!skipFrom) rows+=segRow('green',t('lbl_depart'),s.from||'\u2014',true);
      rows+=segRow('red',t('lbl_arrivee'),s.to||'\u2014',false);
      rows+='<div id="'+idPrefix+'detail-route-info-'+idx+'" style="padding:4px 0 4px 30px;display:none;"><div style="font-size:11.5px;color:var(--ink2);font-weight:500;" id="'+idPrefix+'detail-route-info-text-'+idx+'"></div></div>';
    }
    var border=isLast?'':'border-bottom:1px solid var(--sand3);margin-bottom:12px;padding-bottom:12px;';
    return '<div style="'+border+'"><div style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">'+label+'</div>'+metaHtml+rows+noteHtml+'</div>';
  }
  var metaParts=[];
  if(r.ride_date) metaParts.push(formatDate(r.ride_date)+(r.ride_time?' '+r.ride_time.slice(0,5):''));
  if(r.passengers) metaParts.push(r.passengers+' pax');
  if(r.vehicle_type) metaParts.push(_DOC_CLASSES[r.vehicle_type]||r.vehicle_type);
  var metaLineHtml=metaParts.length?'<div style="display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--ink3);"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>'+metaParts.join(' &middot; ')+'</div>':'';
  var body='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'+_rideMetaChips(r)+(showStatus?getStatusPill(r.status,r._offerCount||0):'')+'</div>';
  if(isMixed&&mixedSegs.length){
    var mb='';
    mixedSegs.forEach(function(s,i){var sf=i>0&&mixedSegs[i-1].to&&s.from&&mixedSegs[i-1].to.trim()===s.from.trim();mb+=segCard(s,i,i===mixedSegs.length-1,sf);});
    body+='<div style="background:#F7F7F7;border-radius:12px;padding:12px 16px;">'+mb+'</div>';
  } else if(isDisp){
    var ddh='',dkh='';
    if(r.notes){var ddm=r.notes.match(/Dur\u00e9e:([^\s|,]+)/);if(ddm){var ddv=parseFloat(ddm[1])||0;ddh='<div style="display:flex;gap:14px;padding:2px 0;"><div style="width:16px;flex-shrink:0;display:flex;justify-content:center;"><div style="width:2px;flex:1;background:var(--sand3);"></div></div><div style="padding:3px 0;font-size:11.5px;color:var(--ink3);">'+ddm[1]+'</div></div>';}}
    body+='<div style="background:#F7F7F7;border-radius:12px;padding:12px 16px;">'+segRow('green',t('lbl_pickup'),from,true)+ddh+'</div>';
  } else {
    body+='<div style="background:#F7F7F7;border-radius:12px;padding:12px 16px;">'+segRow('green',t('lbl_depart'),from,true)+segRow('red',t('lbl_arrivee'),to,false)+'<div id="'+idPrefix+'detail-route-info" style="padding:4px 0 4px 30px;display:none;"><div style="font-size:11.5px;color:var(--ink2);font-weight:500;" id="'+idPrefix+'detail-route-info-text"></div></div>'+'</div>';
  }
  var rawNotes=r.notes||'';
  var cleanNotes=rawNotes.replace(/^Mixte:.*$/,'').replace(/Dur\u00e9e:[^\s|]+/g,'').replace(/\|pax:[^|]*/g,'').replace(/\|(tel|pemail|pref|flight2?|train2?):[^|]*/g,'').replace(/\|note_drv:[^|]*/g,'').replace(/\|offer_note:[^|]*/g,'').trim();
  if(cleanNotes && r.status!=='confirmed' && r.status!=='done' && r.status!=='active'){body+='<div style="margin-top:12px;"><div style="font-size:11px;font-weight:600;color:var(--ink);margin-bottom:5px;">'+t('lbl_comment')+'</div><div style="padding:12px;background:var(--sand2);border-radius:var(--r);font-size:12.5px;color:var(--ink2);font-style:italic;"><span style="font-style:normal;">'+t('app2.note_du_client')+' </span>'+_rdEsc(cleanNotes)+'</div></div>';}
  var noteDrvMatch = rawNotes.match(/\|note_drv:([^|]+)/);
  if(noteDrvMatch){body+='<div style="margin-top:12px;"><div style="font-size:11px;font-weight:600;color:var(--ink);margin-bottom:5px;">'+t('app.note_du_client_2')+'</div><div style="padding:12px;background:var(--blue-bg);border-radius:var(--r);font-size:12.5px;color:var(--ink2);font-style:italic;">'+noteDrvMatch[1].trim()+'</div></div>';}
  // Note: prix demandé for subcontract shown in footer only
  return {html:body, isMixed:isMixed, isDisp:isDisp, mixedSegs:mixedSegs};
}
function _triggerDistanceMatrix(r, result, idPrefix){
  idPrefix=idPrefix||'';
  if(!result.isDisp&&!result.isMixed&&r.from_address&&r.to_address&&typeof google!=='undefined'&&google.maps&&google.maps.DistanceMatrixService){
    (new google.maps.DistanceMatrixService()).getDistanceMatrix({origins:[r.from_address],destinations:[r.to_address],travelMode:google.maps.TravelMode.DRIVING,language:'fr'},function(res,st){
      var ie=document.getElementById(idPrefix+'detail-route-info'),te=document.getElementById(idPrefix+'detail-route-info-text');
      if(st==='OK'&&res.rows[0]&&res.rows[0].elements[0].status==='OK'){var el=res.rows[0].elements[0];if(ie&&te){te.textContent=el.distance.text+' \u00b7 environ '+el.duration.text;ie.style.display='block';}}
    });
  }
  if(result.isMixed&&result.mixedSegs.length&&typeof google!=='undefined'&&google.maps&&google.maps.DistanceMatrixService){
    result.mixedSegs.forEach(function(s,i){
      if(s.type.toLowerCase().indexOf('disp')<0&&s.from&&s.to){
        (function(seg,idx){(new google.maps.DistanceMatrixService()).getDistanceMatrix({origins:[seg.from],destinations:[seg.to],travelMode:google.maps.TravelMode.DRIVING,language:'fr'},function(res,st){
          var ie=document.getElementById(idPrefix+'detail-route-info-'+idx),te=document.getElementById(idPrefix+'detail-route-info-text-'+idx);
          if(st==='OK'&&res.rows[0]&&res.rows[0].elements[0].status==='OK'){var el=res.rows[0].elements[0];if(ie&&te){te.textContent=el.distance.text+' \u00b7 environ '+el.duration.text;ie.style.display='block';}}
        });})(s,i);
      }
    });
  }
}

window._detailGen=0;
window.openRideDetail=function(el){
  var r;
  try{ r=JSON.parse(el.dataset.ride.replace(/&#39;/g,"'")); }catch(e){return;}

  // Render immediately from cached card data — no perceived delay, single modal open
  _openRideDetailImpl(el);

  // Then silently refresh from Supabase, and only re-render if something actually changed
  if(sb && r.id && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    sb.from('rides').select('*').eq('id',r.id).maybeSingle().then(async function(res){
      if(!res || !res.data) return;
      await _mergeRidePrivate(res.data);   // note complète pour le client (rien pour une fleet non retenue)
      // Ignore if the user already closed the modal or opened another ride
      var stillOpen = document.getElementById('m-ride-detail');
      if(!stillOpen || !stillOpen.classList.contains('open')) return;
      if(!window._lastDetailRide || window._lastDetailRide.id !== r.id) return;
      var fresh = res.data;
      var changed = ['status','notes','final_price','driver_id','payment_method','ride_date','ride_time','from_address','to_address','change_state','supp_amount','luggage_large','luggage_small']
        .some(function(k){ return String(fresh[k]==null?'':fresh[k]) !== String(r[k]==null?'':r[k]); });
      if(!changed) return;
      var freshEl = document.createElement('div');
      freshEl.dataset.ride = JSON.stringify(fresh).replace(/'/g,"&#39;");
      _openRideDetailImpl(freshEl);
    }, function(){});
  }
};

// Ride key info (date/time, passengers, vehicle) shown as prominent chips at the top of a ride detail
function _rideMetaChips(r){
  if(r.trip_type==='mixed' && parseMixedNotes(r.notes||'').length) return '';
  var chips=[];
  var ico=function(d){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'; };
  if(r.ride_date){
    var d=new Date(r.ride_date+'T00:00:00');
    var day=d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');
    day=day.charAt(0).toUpperCase()+day.slice(1);
    chips.push('<span style="display:inline-flex;align-items:center;gap:7px;background:#FCFCFB;color:var(--ink);border:1px solid #F0EEE9;border-radius:9px;padding:5px 10px;font-size:13px;font-weight:400;white-space:nowrap;">'
      +ico('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>')+day
      +(r.ride_time?'<span style="opacity:.55;font-weight:400;">|</span>'+ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+r.ride_time.slice(0,5):'')+'</span>');
  }
  var soft='display:inline-flex;align-items:center;gap:6px;background:#FCFCFB;color:var(--ink);border:1px solid #F0EEE9;border-radius:9px;padding:5px 10px;font-size:13px;font-weight:400;white-space:nowrap;';
  if(r.passengers) chips.push('<span style="'+soft+'">'+ico('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0114 0v1"/>')+r.passengers+' passager'+(r.passengers>1?'s':'')+'</span>');
  if(r.vehicle_type){ var vl={lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'}[r.vehicle_type]||r.vehicle_type;
    chips.push('<span style="'+soft+'">'+ico('<path d="M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>')+vl+'</span>'); }
  // Événement : simple ligne de texte au-dessus des pastilles (pas une pastille)
  var _evLine=(r.event_name&&r.event_kind!=='mixed')?'<div class="rd-evline">'+_rdEsc(r.event_name)+'</div>':'';
  var _fl=_rdTag(r.notes,'flight'), _tr=_rdTag(r.notes,'train');
  var tsoft='display:inline-flex;align-items:center;gap:6px;background:#FCFCFB;color:var(--ink);border:1px solid #F0EEE9;border-radius:9px;padding:5px 10px;font-size:13px;font-weight:400;white-space:nowrap;';
  if(_fl) chips.push('<span style="'+tsoft+'">'+ico('<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>')+'Vol '+_rdEsc(_fl.toUpperCase())+'</span>');
  if(_tr) chips.push('<span style="'+tsoft+'">'+ico('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8.5 14h.01M15.5 14h.01M9 17l-2 4M15 17l2 4"/>')+'Train '+_rdEsc(_tr.toUpperCase())+'</span>');
  // Puis vol / train, puis les bagages
  var _lg=_lugTxt(r.luggage_large, r.luggage_small);
  if(_lg) chips.push('<span style="'+soft+'">'+ico('<rect x="6" y="7" width="12" height="13" rx="2"/><path d="M9 7V4h6v3M10 11v5M14 11v5"/>')+_lg+'</span>');
  if(!chips.length) return _evLine;
  // Une seule ligne : vol / train et bagages suivent les autres pastilles, retour à la ligne si la place manque
  return _evLine+'<div class="rmc-wrap v2"><div class="rmc-row">'+chips.join('')+'</div></div>';
}
function _openRideDetailImpl(el){
  var r;
  try{ r=JSON.parse(el.dataset.ride.replace(/&#39;/g,"'")); }catch(e){return;}
  window._lastDetailRide=r;
  try{ _nrStepsBar('m-ride-detail', _nrRideStep(r)); }catch(_e){}
  // Empreinte du véhicule / chauffeur attribués : la fiche se met à jour dès qu'ils changent
  if(!window._lastDetailAsg || window._lastDetailAsg.id!==r.id){
    window._lastDetailAsg={ id:r.id, sig:null };
    _asgSig(r.id).then(function(sg){ if(window._lastDetailAsg && window._lastDetailAsg.id===r.id) window._lastDetailAsg.sig=sg; });
  }
  var gen=++window._detailGen;
  var isClient=currentRole==='client';
  var isMixed=r.trip_type==='mixed',isDisp=r.trip_type==='disposal';
  var mixedSegs=isMixed?parseMixedNotes(r.notes||''):[];
  var from=cleanAddr(r.from_address||'—'),to=r.to_address||'—';

  // Title + subtitle
  var titleEl=document.getElementById('detail-title');
  var subTitle=isMixed?t('title_mixed'):isDisp?t('title_disp'):t('title_ab');
  // Prepend booking code to title if available
  var _subIc = r.is_subcontract
        ? ' <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--amber-bg);color:var(--amber);vertical-align:middle;margin-left:4px;" title="'+t('app.sous_traitee')+'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>'
        : '';
  // En-tête : code en gras, puis « Type · Ville → Ville »
  var _city=function(a){ var ps=String(a||'').split(',').map(function(x){return x.trim();}).filter(Boolean);
    for(var i=ps.length-1;i>=0;i--){ var m=ps[i].match(/^(?:[A-Z]{1,2}-?)?\d{4,5}\s+(.+)$/); if(m) return m[1]; }
    return ps.length>2?ps[ps.length-2]:(ps[0]||''); };
  var _tLbl=isMixed?'Course mixte':isDisp?'Mise \u00e0 disposition':'Course simple';
  var _durH=((r.notes||'').match(/Durée:([^\s|,]+)/)||[])[1]||'';
  var _route=isMixed?(mixedSegs.length?mixedSegs.length+' trajets':''):isDisp?[_city(r.from_address),_durH].filter(Boolean).join(' \u00b7 '):[_city(r.from_address),_city(r.to_address)].filter(Boolean).join(' \u2192 ');
  var _sub2=_rdEsc(_tLbl+(_route?' \u00b7 '+_route:''));
  // Trajet mixte : même en-tête que les événements (libellé, code, période · trajets · contact)
  if(isMixed&&mixedSegs.length){
    var _fdm=function(x,o){ return x?new Date(x+'T00:00:00').toLocaleDateString('fr-BE',o).replace(/\./g,''):''; };
    var _ds=mixedSegs.map(function(x){ return x.date||r.ride_date; }).filter(Boolean).sort();
    var _dd=_ds.length&&_ds[0]!==_ds[_ds.length-1]?_fdm(_ds[0],{weekday:'short',day:'numeric',month:'short'})+' \u2013 '+_fdm(_ds[_ds.length-1],{weekday:'short',day:'numeric',month:'short'}):_fdm(_ds[0],{weekday:'short',day:'numeric',month:'short'});
    _dd=_dd?_dd.charAt(0).toUpperCase()+_dd.slice(1):'';
    var _ct=_rdTag(r.notes,'pax'), _per=mixedSegs.some(function(x){ return x.paxName; });
    _sub2=_rdEsc([_dd, mixedSegs.length+' trajet'+(mixedSegs.length>1?'s':''), _per?'un contact par trajet':(_ct?'contact : '+_ct:'')].filter(Boolean).join(' \u00b7 '));
    if(titleEl){ titleEl.innerHTML='<span class="rd-hd2">'+(r.booking_code?'<b class="rd-hd2-code">'+_rdEsc(r.booking_code)+_subIc+'</b>':'')+'<span class="rd-hd2-sub">'+_sub2+'</span></span>'; }
  }
  var fullTitle = '<span class="rd-hd2">'+(r.booking_code?'<b class="rd-hd2-code">'+_rdEsc(r.booking_code)+_subIc+'</b>':'')+'<span class="rd-hd2-sub">'+_sub2+(r.booking_code?'':_subIc)+'</span></span>';
  if(titleEl && !(isMixed&&mixedSegs.length)) titleEl.innerHTML = fullTitle;

  // Header row: big title + status pill
  var metaParts=[];
  if(r.ride_date) metaParts.push(formatDate(r.ride_date)+(r.ride_time?' '+r.ride_time.slice(0,5):''));
  if(r.passengers) metaParts.push(r.passengers+' pax');
  if(r.vehicle_type) metaParts.push(_DOC_CLASSES[r.vehicle_type]||r.vehicle_type);
  var metaLine=metaParts.length?'<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;font-size:12px;color:var(--ink3);"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>'+metaParts.join(' &middot; ')+'</div>':'';
  var _stEl=document.getElementById('detail-status'); if(_stEl) _stEl.innerHTML=(r.no_show_at?_noShowPill(true)+' ':'')+(_chgPending(r)
      ?'<span style="display:inline-flex;align-items:center;gap:6px;background:#FFF1DC;color:#9A5B00;border:1px solid #F2D9AE;border-radius:999px;padding:6px 12px 6px 10px;font-size:12.5px;font-weight:700;white-space:nowrap;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'+_chgStatusLbl(r)+'</span>'
      :_statusBadge(r.status,r._offerCount||0));
  var body=(isMixed&&mixedSegs.length)?'':_rideMetaChips(r);

  
  // Helper: one segment row (dot + line/no-line + content)
    // Adresse : nom du lieu en gras, rue / ville en dessous (pays retiré)
    function _segAddr(a){
      if(!a||a==='—') return '—';
      var ps=String(a).split(',').map(function(x){return x.trim();}).filter(Boolean);
      if(ps.length>1 && /^(belgique|belgium|belgi\u00eb|france|luxembourg|nederland|pays-bas|netherlands|deutschland|allemagne|germany|united kingdom|royaume-uni|suisse|schweiz|switzerland)$/i.test(ps[ps.length-1])) ps.pop();
      if(ps.length<2) return '<b class="seg-nm">'+_rdEsc(ps[0]||a)+'</b>';
      return '<b class="seg-nm">'+_rdEsc(ps[0])+'</b><span class="seg-ad">'+_rdEsc(ps.slice(1).join(', '))+'</span>';
    }
    function segRow(dot, label, addr, time2, withLine){
    var iconGreen='<svg width="14" height="18" viewBox="0 0 24 30" fill="#1B5E3B"><path d="M12 0C7.6 0 4 3.6 4 8c0 5.4 8 16 8 16s8-10.6 8-16c0-4.4-3.6-8-8-8zm0 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/></svg>';
    var iconRed='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
    var ico=dot==='green'?iconGreen:iconRed;
    return '<div style="display:flex;gap:14px;">'      +'<div style="display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;">'        +'<div style="margin-top:3px;flex-shrink:0;">'+ico+'</div>'        +(withLine?'<div style="width:2px;flex:1;background:var(--sand3);min-height:14px;margin-top:2px;"></div>':'')      +'</div>'      +'<div style="flex:1;min-width:0;'+(withLine?'padding-bottom:10px':'padding-bottom:2px')+';">'        +'<div class="detail-seg-label">'+label+'</div>'        +'<div class="detail-seg-addr">'+_segAddr(addr)+'</div>'      +'</div>'    +'</div>';
  }

    // Route rows
  function segCard(s, idx, isLast, skipFrom){
    var isD=s.type.toLowerCase().indexOf('disp')>=0;
    var label=t('lbl_segment')+' '+(idx+1)+' — '+(isD?t('title_disp'):t('title_ab'));
    // Time on its own line right under label, then date/pax/veh as badges
    // Build meta line: "26 mars 11:30 · 2 pax · lowcost" (same format as A->B/disposal)
    var metaParts=[];
    var dateTime=(s.date?formatDate(s.date):'')+( s.time ? ' '+s.time : '');
    if(dateTime.trim()) metaParts.push(dateTime.trim());
    if(s.pax)  metaParts.push(s.pax+' pax');
    if(s.veh)  metaParts.push(s.veh);
    if(s.flight) metaParts.push('Vol '+s.flight);
    if(s.train)  metaParts.push('Train '+s.train);
    if(s.flight2) metaParts.push('Vol '+s.flight2);
    if(s.train2)  metaParts.push('Train '+s.train2);
    if(s.paxName) metaParts.push(s.paxName+(s.paxTel?' ('+s.paxTel+')':''));
    var metaHtml=metaParts.length?'<div style="font-size:12px;color:var(--ink3);margin-bottom:8px;">'+metaParts.join(' &middot; ')+'</div>':'';
    var timeHtml='';
    var noteHtml=s.note?'<div style="font-size:12px;color:var(--ink3);margin-top:6px;font-style:italic;"><span style="font-style:normal;">'+t('app.note_du_client')+' </span>'+s.note+'</div>':'';
    var rows='';
    if(isD){
      rows+=segRow('green',t('lbl_pickup'),s.from||'—','',true);
      if(s.dur) rows+='<div style="display:flex;gap:14px;padding:2px 0;"><div style="width:16px;flex-shrink:0;display:flex;justify-content:center;"><div class="detail-seg-vline" style="flex:1;"></div></div><div style="padding:3px 0;font-size:11.5px;color:var(--ink3);">'+t('app.duree_2')+' '+s.dur+'</div></div>';
      rows+='<div style="padding:2px 0 2px 30px;font-size:11.5px;color:var(--ink3);" id="rd-seg-km-'+(s.idx!=null?s.idx:idx)+'"></div>';
    } else {
      if(!skipFrom) rows+=segRow('green',t('lbl_depart'),s.from||'—','',true);
      rows+=segRow('red',t('lbl_arrivee'),s.to||'—','',false);
      rows+='<div id="detail-route-info-'+idx+'" style="padding:4px 0 4px 30px;display:none;">'
        +'<div style="font-size:11.5px;color:var(--ink2);font-weight:500;" id="detail-route-info-text-'+idx+'"></div>'
        +'</div>';
    }
    var border=isLast?'':'border-bottom:1px solid var(--sand3);margin-bottom:12px;padding-bottom:12px;';
    return '<div style="'+border+'">'
      +'<div style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">'+label+'</div>'
      +timeHtml+metaHtml+rows+noteHtml
      +'</div>';
  }

  if(isMixed&&mixedSegs.length){
    // Même présentation que la fiche d'un événement : une ligne par trajet, regroupées par jour
    var mixedBody='', _sh=function(a){ return String(cleanAddr(a)||'').split(',')[0].trim(); };
    var _clsN=function(v){ return ({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[v]||v||''; };
    var _dl=function(x){ if(!x) return ''; var t2=new Date(x+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long'}); return t2.charAt(0).toUpperCase()+t2.slice(1); };
    var _days=mixedSegs.map(function(x){ return x.date||r.ride_date||''; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
    var _last=null;
    mixedSegs.forEach(function(s,i){
      var isD=s.type.toLowerCase().indexOf('disp')>=0;
      mixedBody+=_tripCardHtml({ n:i+1, disp:isD, date:s.date||r.ride_date, time:s.time, from:s.from, to:s.to, dur:s.dur, veh:s.veh, pax:s.pax,
        lug:_lugTxt(s.lugL,s.lugS), fl:[s.flight,s.flight2], trn:[s.train,s.train2], contact:[s.paxName,s.paxTel].filter(Boolean).join(' \u00b7 '), note:s.note });
    });
    body+='<div class="mx-list">'+mixedBody+'</div>';
    _mxFillKm();
  } else if(isDisp){
    // Mise à disposition : lieu de prise en charge puis durée ; km inclus uniquement s'ils ont été proposés par le chauffeur
    var _dDur=((r.notes||'').match(/Durée:([^\s|,]+)/)||[])[1]||'';
    var _clkIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C77A10" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    var _routeInner=segRow('green',t('lbl_pickup'),from,'',true)
      +'<div style="display:flex;gap:14px;"><div style="width:16px;flex-shrink:0;display:flex;justify-content:center;padding-top:2px;">'+_clkIc+'</div>'
      +'<div style="flex:1;min-width:0;"><div class="detail-seg-label">'+t('app2.mise_a_disposition')+'</div><div class="detail-seg-addr"><span class="seg-ad" style="margin:0;color:var(--ink);font-size:14px;">'+(_dDur?_rdEsc(_dDur):'\u2014')+'<span id="rd-disp-km"></span></span></div></div></div>';
    body+='<div class="rd-route" style="background:#F7F7F7;border-radius:12px;padding:12px 16px;">'+_routeInner+'</div>';
  } else {
    var _routeInner2=segRow('green',t('lbl_depart'),from,'',true)+segRow('red',t('lbl_arrivee'),to,'',false)
      +'<div id="detail-route-info" class="rd-dist" style="display:none;">'
      +'<div style="font-size:11.5px;color:var(--ink2);font-weight:500;" id="detail-route-info-text"></div>'
      +'</div>';
    body+='<div class="rd-route" style="background:#F7F7F7;border-radius:12px;padding:12px 16px;">'+_routeInner2+'</div>';
  }

  var rawNotes=r.notes||'';
  var cleanNotes=rawNotes.replace(/^Mixte:.*$/,'').replace(/Durée:[^\s|]+/g,'').replace(/\|pax:[^|]*/g,'').replace(/\|(tel|pemail|pref|flight2?|train2?):[^|]*/g,'').replace(/\|note_drv:[^|]*/g,'').replace(/\|offer_note:[^|]*/g,'').trim();
  if(cleanNotes && r.status!=='confirmed' && r.status!=='done' && r.status!=='active'){
    body+='<div class="rd-instr"><div class="rd-cap" style="margin-bottom:4px;">'+(r.status==='personal'?'Note':'Instructions du client')+'</div>'
      +'<div style="font-size:14px;color:var(--ink);line-height:1.45;">'+_rdEsc(cleanNotes)+'</div></div>';
  }

  // Note: prix demandé for subcontract shown in footer only

  // Note: price for cancelled/done rides is shown in the footer (not body)

  // Vol / train : pastille à côté de la gamme (demande ouverte) ; bloc de suivi une fois la course attribuée
  if(r.status!=='waiting' && r.status!=='offers') body+=(window._trBlockHtml?window._trBlockHtml(r):'');
  var bodyEl=document.getElementById('detail-body');if(bodyEl)bodyEl.innerHTML=body;
  // Mission modifiée après confirmation : réponse du chauffeur / supplément / choix du client
  if(bodyEl && r.status==='confirmed' && r.change_state && window._chgBannerHtml) bodyEl.insertAdjacentHTML('afterbegin', _chgBannerHtml(r, isClient));
  // Prix revu à la baisse par le chauffeur : remboursement partiel en cours (client)
  if(bodyEl && isClient && r.status!=='cancelled' && parseFloat(r.refund_due)>0)
    bodyEl.insertAdjacentHTML('afterbegin','<div class="chg-ban b"><b class="chg-t">'+(r.refund_done_at?'Remboursement effectué':'Remboursement en cours')+' : '+_chgEur(parseFloat(r.refund_due))+'</b>'+t('app.votre_chauffeur_a_revu_son')+' <b>'+_chgEur(parseFloat(r.final_price)||0)+' TVAC</b>.</div>');
  // Demande modifiée après l'offre du chauffeur : ce qui a changé
  if(bodyEl && !isClient && (r.status==='waiting'||r.status==='offers') && window._myOffers && _myOffers[r.id] && _myOffers[r.id].outdated)
    bodyEl.insertAdjacentHTML('afterbegin', _outdBannerHtml(_myOffers[r.id]));
  // Km inclus : seulement la proposition du chauffeur (offre retenue, ou sa propre offre côté fleet)
  if(isDisp||isMixed){
    (async function(myGen){
      var km=null;
      try{
        if(currentRole!=='client' && window._myOffers && _myOffers[r.id]) km=_myOffers[r.id].km;
        else if(sb && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
          // Offre retenue ; sinon, s'il n'y a qu'une offre en attente, sa proposition
          var q=await sb.from('offers').select('included_km,status').eq('ride_id',r.id).in('status',['accepted','pending']);
          var ls=(q.data||[]).filter(function(o){ return o.included_km && Object.keys(o.included_km).length; });
          var acc=ls.filter(function(o){ return o.status==='accepted'; })[0];
          km=acc?acc.included_km:(ls.length===1&&(q.data||[]).length===1?ls[0].included_km:null);
        }
      }catch(_e){}
      if(window._detailGen!==myGen || !km) return;
      var d=document.getElementById('rd-disp-km'); if(d){ var tx=_kmText(km); if(tx) d.innerHTML=' \u00b7 '+tx+' <span style="color:var(--ink3);font-size:12.5px;">'+t('app.proposition_du_chauffeur')+'</span>'; }
      Object.keys(km).forEach(function(k){ var e=document.getElementById('rd-seg-km-'+k); if(e) e.textContent=_kmText(km,k)+' (proposition du chauffeur)'; });
    })(gen);
  }
  if(window._trStart) window._trStart(r, gen);

  // ── Google Distance Matrix for A→B (gen-protected) ──
  if(!isDisp&&!isMixed&&r.from_address&&r.to_address&&typeof _ltWhenMaps==='function'){
    (function(myGen){ _ltWhenMaps(function(){
      if(window._detailGen!==myGen||!google.maps.DistanceMatrixService) return;
      (new google.maps.DistanceMatrixService()).getDistanceMatrix({
        origins:[cleanAddr(r.from_address)],destinations:[cleanAddr(r.to_address)],
        travelMode:google.maps.TravelMode.DRIVING,language:'fr'
      },function(res,st){
        if(window._detailGen!==myGen)return;
        var infoEl=document.getElementById('detail-route-info');
        var textEl=document.getElementById('detail-route-info-text');
        if(st==='OK'&&res.rows[0]&&res.rows[0].elements[0].status==='OK'){
          var el=res.rows[0].elements[0];
          if(infoEl&&textEl){
            textEl.textContent=el.distance.text+' \u00b7 environ '+el.duration.text;
            infoEl.style.display='block';
          }
        }
      });
    }); })(gen);
  }

  // ── Google Distance Matrix for mixed A→B segments (gen-protected) ──
  if(isMixed&&mixedSegs.length&&typeof google!=='undefined'&&google.maps&&google.maps.DistanceMatrixService){
    mixedSegs.forEach(function(s,i){
      if(s.type.toLowerCase().indexOf('disp')<0&&s.from&&s.to){
        (function(seg,idx,myGen){
          (new google.maps.DistanceMatrixService()).getDistanceMatrix({
            origins:[seg.from],destinations:[seg.to],
            travelMode:google.maps.TravelMode.DRIVING,language:'fr'
          },function(res,st){
            if(window._detailGen!==myGen)return;
            var infoEl=document.getElementById('detail-route-info-'+idx);
            var textEl=document.getElementById('detail-route-info-text-'+idx);
            if(st==='OK'&&res.rows[0]&&res.rows[0].elements[0].status==='OK'){
              var el=res.rows[0].elements[0];
              if(infoEl&&textEl){
                textEl.textContent=el.distance.text+' \u00b7 environ '+el.duration.text;
                infoEl.style.display='block';
              }
            }
          });
        })(s,i,gen);
      }
    });
  }

  // Static map with the real road route; keeps the straight line if no routing service answers
  function _encPolyline(pts){
    var out='', pl=0, pg=0;
    var enc=function(v){ v=v<0?~(v<<1):(v<<1); var r=''; while(v>=0x20){ r+=String.fromCharCode((0x20|(v&0x1f))+63); v>>=5; } return r+String.fromCharCode(v+63); };
    pts.forEach(function(p){ var la=Math.round(p.lat*1e5), lg=Math.round(p.lng*1e5); out+=enc(la-pl)+enc(lg-pg); pl=la; pg=lg; });
    return out;
  }
  function _staticRouteMap(img, baseSrc, points){
    img.dataset.routeKey=baseSrc;
    var KEYR='AIzaSyDMWIsPQ6YWrRXFwzKypcbKhP4urk27g3Y';
    var cacheKey='rt:'+points.join('>');
    var apply=function(poly, how, meters, secs){
      if(!poly || img.dataset.routeKey!==baseSrc) return false;
      var routed=baseSrc+'&path='+encodeURIComponent('color:0x2E7A4FCC|weight:3|enc:'+poly);
      if(routed.length>=16000) return false;
      img.src=routed; console.log('[map] itinéraire routier affiché ('+how+')');
      try{ sessionStorage.setItem(cacheKey, JSON.stringify({p:poly,m:meters||0,s:secs||0})); }catch(e){}
      // Distance / durée à partir de l'itinéraire si la ligne n'est pas encore remplie
      if(meters){
        var te=document.getElementById('detail-route-info-text'), ie=document.getElementById('detail-route-info');
        if(te && ie && !te.textContent){ te.textContent=(meters/1000).toFixed(1).replace('.',',')+' km - +/- '+Math.max(1,Math.round((secs||0)/60))+' min'; ie.style.display='block'; }
      }
      return true;
    };
    // Itinéraire déjà calculé pendant cette session
    try{ var c=JSON.parse(sessionStorage.getItem(cacheKey)||'null'); if(c&&c.p){ apply(c.p,'cache',c.m,c.s); return; } }catch(e){}
    var simplify=function(pts){
      var step=Math.max(1,Math.ceil(pts.length/400)), simp=pts.filter(function(_,i){ return i%step===0; });
      if(simp[simp.length-1]!==pts[pts.length-1]) simp.push(pts[pts.length-1]);
      return _encPolyline(simp);
    };
    // 1) Routes API en direct (REST) — ne dépend pas du chargement de Google Maps JS
    var viaRest=function(){
      return fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{ method:'POST',
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':KEYR,'X-Goog-FieldMask':'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration'},
        body:JSON.stringify({ origin:{address:points[0]}, destination:{address:points[points.length-1]},
          intermediates:points.slice(1,-1).slice(0,23).map(function(p){ return {address:p}; }), travelMode:'DRIVE', languageCode:'fr' })
      }).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error((j&&j.error&&j.error.message)||('HTTP '+r.status)); return j; }); })
        .then(function(j){
          var rt=j&&j.routes&&j.routes[0]; if(!rt||!rt.polyline||!rt.polyline.encodedPolyline) throw new Error('aucun itinéraire');
          return apply(rt.polyline.encodedPolyline,'Routes API REST',rt.distanceMeters,parseInt(String(rt.duration||'0').replace('s',''))||0);
        }).catch(function(e){ console.warn('[map] Routes API (REST) indisponible :', e&&e.message||e); return false; });
    };
    // 2) Directions (Maps JS) — chargé explicitement via importLibrary
    var viaDirections=function(){
      return new Promise(function(resolve){
        _ltWhenMaps(async function(){
          try{
            var lib=google.maps.importLibrary?await google.maps.importLibrary('routes'):google.maps;
            var DS=(lib&&lib.DirectionsService)||google.maps.DirectionsService;
            if(!DS) throw new Error('DirectionsService absent');
            new DS().route({ origin:points[0], destination:points[points.length-1],
              waypoints:points.slice(1,-1).slice(0,23).map(function(p){ return {location:p, stopover:true}; }), travelMode:'DRIVING' },function(res,st){
              if(st!=='OK'||!res.routes||!res.routes[0]){ console.warn('[map] Directions indisponible :', st); resolve(false); return; }
              var rt=res.routes[0], poly=rt.overview_polyline; if(poly&&typeof poly!=='string') poly=poly.points||'';
              if(!poly && rt.overview_path) poly=simplify(rt.overview_path.map(function(ll){ return {lat:ll.lat(),lng:ll.lng()}; }));
              var m=0,sec=0; (rt.legs||[]).forEach(function(l){ m+=(l.distance&&l.distance.value)||0; sec+=(l.duration&&l.duration.value)||0; });
              resolve(apply(poly,'Directions',m,sec));
            });
          }catch(e){ console.warn('[map] Directions :', e&&e.message||e); resolve(false); }
        });
        setTimeout(function(){ resolve(false); },10000);
      });
    };
    // 3) Routes (Maps JS)
    var viaRoutesJs=function(){
      return new Promise(function(resolve){
        _ltWhenMaps(async function(){
          try{
            var lib=await google.maps.importLibrary('routes');
            if(!lib||!lib.Route||!lib.Route.computeRoutes) throw new Error('Route.computeRoutes indisponible');
            var res=await lib.Route.computeRoutes({ origin:points[0], destination:points[points.length-1],
              intermediates:points.slice(1,-1).slice(0,23).map(function(p){ return {location:p}; }), travelMode:'DRIVING', fields:['path','distanceMeters','durationMillis'] });
            var rt=res&&res.routes&&res.routes[0];
            if(!rt||!rt.path||!rt.path.length) throw new Error('aucun itinéraire');
            var pts=rt.path.map(function(ll){ return { lat:typeof ll.lat==='function'?ll.lat():ll.lat, lng:typeof ll.lng==='function'?ll.lng():ll.lng }; });
            resolve(apply(simplify(pts),'Routes JS',rt.distanceMeters,(rt.durationMillis||0)/1000));
          }catch(e){ console.warn('[map] Routes JS indisponible :', e&&e.message||e); resolve(false); }
        });
        setTimeout(function(){ resolve(false); },10000);
      });
    };
    (async function(){
      if(await viaRest()) return;
      if(img.dataset.routeKey!==baseSrc) return;
      if(await viaDirections()) return;
      if(img.dataset.routeKey!==baseSrc) return;
      if(await viaRoutesJs()) return;
      console.warn('[map] aucun service d’itinéraire n’a répondu : carte sans tracé');
    })();
  }

  // ── Google Static Maps — hidden for confirmed client rides ──
  (function(){
    var wrap=document.getElementById('detail-map-wrap');
    if(!wrap)return;
    // Hide map for confirmed rides (client and driver)
    if(r.status==='confirmed'||r.status==='active'||(isClient&&r.status==='done'&&sb&&localStorage.getItem(DEMO_MODE_KEY)!=='1')){
      wrap.style.display='none';
      var sp=document.getElementById('detail-map-spacer');if(sp)sp.style.height='0px';
    } else {
      var KEY='AIzaSyDMWIsPQ6YWrRXFwzKypcbKhP4urk27g3Y';
      var src='';
      if(isMixed&&mixedSegs&&mixedSegs.length>0){
        var pts=[];
        mixedSegs.forEach(function(s){if(s.from&&s.from!=='—')pts.push(s.from);if(s.to&&s.to!=='—'&&s.to!==s.from)pts.push(s.to);});
        if(pts.length>0){var mP=pts.map(function(p,i){var col=i===0?'0x4E8F69':(i===pts.length-1?'0xD8705F':'0xE5A15A');return 'markers=size:small%7Ccolor:'+col+'%7C'+encodeURIComponent(p);});src='https://maps.googleapis.com/maps/api/staticmap?size=520x165&scale=2&'+mP.join('&')+'&'+_MAP_STYLE+'&key='+KEY;}
      } else if(r.trip_type!=='disposal'&&r.to_address){
        var f=encodeURIComponent(cleanAddr(r.from_address)),t2=encodeURIComponent(cleanAddr(r.to_address));
        src='https://maps.googleapis.com/maps/api/staticmap?size=520x165&scale=2&markers=size:small%7Ccolor:0x4E8F69%7C'+f+'&markers=size:small%7Ccolor:0xD8705F%7C'+t2+'&'+_MAP_STYLE+'&key='+KEY;
      } else if(r.from_address){
        var f=encodeURIComponent(r.from_address);
        src='https://maps.googleapis.com/maps/api/staticmap?size=520x165&scale=2&zoom=14&center='+f+'&markers=size:small%7Ccolor:0x4E8F69%7C'+f+'&'+_MAP_STYLE+'&key='+KEY;
      }
      if(!src){wrap.style.display='none';var sp2=document.getElementById('detail-map-spacer');if(sp2)sp2.style.height='0px';return;}
      var img=document.getElementById('detail-map-img');
      if(img){
        img.style.visibility='visible';
        img.src=src; img._geoTok=null;
        wrap.style.display='block';
        var sp3=document.getElementById('detail-map-spacer');if(sp3)sp3.style.height='12px';
        // Replace the straight line by the real driving route (A -> B, via the mixed segments)
        var _routePts = (isMixed&&mixedSegs&&mixedSegs.length>0) ? pts.map(function(x){ return cleanAddr(x); }) : ((r.trip_type!=='disposal'&&r.to_address) ? [cleanAddr(r.from_address), cleanAddr(r.to_address)] : null);
        if(_routePts && _routePts.length>=2) _staticRouteMap(img, src, _routePts);
        // Adresse seule (mise à disposition) : Google ne trouve pas toujours un texte libre (« The hotel ») et renvoie
        // alors une image « Map error ». On localise d'abord l'adresse ; introuvable → pas de carte.
        else if(!_routePts && !isMixed && r.from_address && window.google && google.maps && google.maps.Geocoder){
          img.style.visibility='hidden';
          var _gTok={}; img._geoTok=_gTok;
          try{
            new google.maps.Geocoder().geocode({ address: r.from_address, region: 'be' }, function(res, st){
              if(img._geoTok!==_gTok) return;   // autre course ouverte entre-temps
              if(st==='OK' && res && res[0]){
                var ll=res[0].geometry.location, c=ll.lat().toFixed(6)+','+ll.lng().toFixed(6);
                img.src='https://maps.googleapis.com/maps/api/staticmap?size=520x165&scale=2&zoom=14&center='+c+'&markers=size:small%7Ccolor:0x4E8F69%7C'+c+'&'+_MAP_STYLE+'&key='+KEY;
                img.style.visibility='visible';
              } else {
                wrap.style.display='none'; var sp4=document.getElementById('detail-map-spacer'); if(sp4) sp4.style.height='0px';
              }
            });
          }catch(_e){ img.style.visibility='visible'; }
        }
      }
    }
  })();

  // ── Client contact info for driver (confirmed ride) — name only, no phone ──
  var _isSubPoster = !!(r.is_subcontract && currentUser && r.client_id===currentUser.id);
  var _isSubTaker  = !!(r.is_subcontract && currentUser && r.client_id!==currentUser.id);
  if(!isClient && ((r.status==='confirmed'||r.status==='active') || (_isSubPoster && (r.status==='waiting'||r.status==='offers'))) && r.client_id && sb && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    var _drvBody=document.getElementById('detail-body');
    if(_drvBody){
      _drvBody.insertAdjacentHTML('beforeend',
        '<div id="ph-drv-pax" class="rd-skel" style="height:82px;"></div>'
        +'<div id="ph-drv-note" class="rd-skel" style="height:150px;"></div>'
      );
    }
    (async function(){
      var bodyEl3=document.getElementById('detail-body');
      if(!bodyEl3) return;
      try {
        var driverIdForOffer = r.driver_id || (currentUser ? currentUser.id : null);
        var [cRes, offerRes2] = await Promise.all([
          sb.from('profiles').select('first_name,last_name').eq('id',r.client_id).maybeSingle(),
          driverIdForOffer ? sb.from('offers').select('message,vehicle_id,fleet_driver_id').eq('ride_id',r.id).eq('driver_id',driverIdForOffer).eq('status','accepted').maybeSingle() : Promise.resolve({data:null})
        ]);
        var cp = cRes.data;
        var offerForNote = offerRes2.data;
        // Véhicule et chauffeur assignés (offre acceptée)
        var _asgVeh=null, _asgDrv=null;
        if(offerForNote){
          try{
            var _ar=await Promise.all([
              offerForNote.vehicle_id ? sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',offerForNote.vehicle_id).maybeSingle() : Promise.resolve({data:null}),
              offerForNote.fleet_driver_id && !_isSubPoster ? sb.from('fleet_drivers').select('first_name,last_name,phone').eq('id',offerForNote.fleet_driver_id).maybeSingle() : Promise.resolve({data:null})
            ]);
            _asgVeh=_ar[0].data; _asgDrv=_ar[1].data;
            // Donneur d'ordre d'une sous-traitance : le chauffeur de l'autre flotte via la fonction serveur
            if(!_asgDrv && offerForNote.fleet_driver_id){ var _rp=await sb.rpc('ride_assigned_driver',{p_ride:r.id}); _asgDrv=(_rp.data&&_rp.data[0])||null; }
          }catch(_e){ console.warn('assignment fetch', _e); }
        }
        if(!cp){
          // Still show note card even without client profile
          cp = {first_name:'', last_name:''};
        }
        var notesRaw = r.notes||'';
        var paxMatch = notesRaw.match(/\|pax:([^|]+)/);
        var noteDrvMatch = notesRaw.match(/\|note_drv:([^|]+)/);
        var telMatch = notesRaw.match(/\|tel:([^|]+)/);
        var cName = paxMatch ? paxMatch[1].trim() : (_isSubPoster ? '—' : (((cp.first_name||'')+' '+(cp.last_name||'')).trim() || '—'));
        var noteDriver = noteDrvMatch ? noteDrvMatch[1].trim() : '';
        var cPhone = telMatch ? telMatch[1].trim() : (cp.phone||'');

        // Initialize offer_note from offer message if not set yet
        var existingOfferNote = notesRaw.match(/\|offer_note:([^|]+)/);
        // (le message de l'offre est recopié en note au client par le serveur à la confirmation)
        var offerNote = (notesRaw.match(/\|offer_note:([^|]+)/)||[])[1]||'';
        var drvNoteId = 'drv-note-card-'+r.id;

        var _editIco='<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/><path d="M10 4l2 2"/></svg>';
        var _pxRow=function(ic,main,extra){ return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;">'
          +'<span style="width:30px;height:30px;border-radius:9px;background:#fff;color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+ic+'</span>'
          +'<div style="flex:1;min-width:0;font-size:13px;">'+main+'</div>'+(extra||'')+'</div>'; };
        var _pxUsr='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>';
        var _pxMail='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
        var _pxRef='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><circle cx="7" cy="7" r="1.5"/></svg>';
        var _pxEmail=((notesRaw.match(/\|pemail:([^|]+)/)||[])[1]||'').trim();
        var _pxPref=((notesRaw.match(/\|pref:([^|]+)/)||[])[1]||'').trim();
        var contactBlock = '<div style="padding:12px 14px;background:#EEF4FB;border-radius:var(--r);">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);">'+t('app.informations_du_passager')+'</div>'
            +(_isSubPoster && !(r.status==='active'||r.status==='done'||r.pickup_at)?'<button class="sub-pax-btn" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--blue);font-weight:600;padding:0;display:flex;align-items:center;gap:4px;">'+_editIco+(paxMatch||telMatch?' Modifier':' Ajouter')+'</button>':'')
          +'</div>'
          +_pxRow(_pxUsr, '<b>'+_rdEsc(cName)+'</b>',
                  cPhone?'<a href="tel:'+_rdEsc(cPhone)+'" style="font-size:12.5px;color:var(--blue);text-decoration:none;white-space:nowrap;">'+_rdEsc(cPhone)+'</a>':'')
          +(_pxEmail?_pxRow(_pxMail, '<a href="mailto:'+_rdEsc(_pxEmail)+'" style="color:var(--blue);text-decoration:none;">'+_rdEsc(_pxEmail)+'</a>'):'')
          +(_pxPref?_pxRow(_pxRef, '<span style="color:var(--ink3);">'+t('app.ref')+' </span><b>'+_rdEsc(_pxPref)+'</b>'):'')
          +(noteDriver?'<div style="border-top:1px solid #d0e4f7;margin-top:6px;padding-top:10px;">'
              +'<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:6px;">'+t('app.message_du_client')+'</div>'
              +'<div style="font-size:12.5px;color:var(--ink2);font-style:italic;">'+_rdEsc(noteDriver)+'</div></div>':'')
          +'</div>';
        // Note au client card (editable by driver)
        var noteCard = '<div id="'+drvNoteId+'" style="padding:12px 14px;background:#EEF4FB;border-radius:var(--r);">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
            +'<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);">'+(r.is_subcontract?'Note du sous-traitant':'Note au client')+'</div>'
            +'<button class="drv-note-btn" data-rid="'+r.id+'" data-note="'+offerNote.replace(/"/g,'&quot;')+'" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--blue);font-weight:600;padding:0;display:flex;align-items:center;gap:4px;font-family:\'DM Sans\',sans-serif;">'
              +'<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/><path d="M10 4l2 2"/></svg>'
              +(offerNote ? ' Modifier' : ' Ajouter')
            +'</button>'
          +'</div>'
          +(offerNote
            ? '<div style="font-size:12.5px;color:var(--ink2);font-style:italic;">'+_rdEsc(offerNote)+'</div>'
            : '<div style="font-size:12px;color:var(--ink4);">'+t('app.aucune_note')+'</div>')
          +'</div>';
        var _phPax=document.getElementById('ph-drv-pax');
        var _phNote=document.getElementById('ph-drv-note');
        if(_phPax){ _phPax.outerHTML = contactBlock; } else { bodyEl3.insertAdjacentHTML('beforeend', contactBlock); }
        if(r.status==='active'||r.status==='done'||r.pickup_at||r.on_way_at){
          // Dès « En chemin » : la note ne peut plus être ajoutée ni modifiée (lecture seule si elle existe)
          noteCard = offerNote ? '<div id="'+drvNoteId+'" style="padding:12px 14px;background:#EEF4FB;border-radius:var(--r);"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:6px;">'+(r.is_subcontract?'Note du sous-traitant':'Note au client')+'</div><div style="font-size:12.5px;color:var(--ink2);font-style:italic;">'+_rdEsc(offerNote)+'</div></div>' : '';
        }
        if(_isSubPoster){
          // The posting fleet reads the subcontractor's note (written by the fleet who accepted); no note before acceptance
          noteCard = (r.status==='waiting'||r.status==='offers') ? ''
            : '<div id="'+drvNoteId+'" style="padding:12px 14px;background:#EEF4FB;border-radius:var(--r);"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:6px;">'+t('app.note_du_sous_traitant')+'</div>'
              +(offerNote?'<div style="font-size:12.5px;color:var(--ink2);font-style:italic;">'+_rdEsc(offerNote)+'</div>':'<div style="font-size:12px;color:var(--ink4);">'+t('app.aucune_note')+'</div>')+'</div>';
        }
        // Bloc « Véhicule et chauffeur » (+ note au client) une fois la mission attribuée
        if(r.status!=='waiting' && r.status!=='offers'){
          var _carIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 01-2-2v-3l2-5h14l2 5v3a2 2 0 01-2 2M5 17v2M19 17v2"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg>';
          var _usrIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>';
          var _locked=!!(r.on_way_at||r.pickup_at||r.status==='active'||r.status==='done');
          var _canAsg=!_isSubPoster && !_locked && r.driver_id===currentUser.id;
          var _vehTxt=_asgVeh ? [_asgVeh.brand,_asgVeh.model].filter(Boolean).join(' ')+(_asgVeh.color?' · '+_asgVeh.color:'') : '';
          var _drvTxt=_asgDrv ? ((_asgDrv.first_name||'')+' '+(_asgDrv.last_name||'')).trim() : '';
          var _row=function(ic,main,extra){ return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;">'
            +'<span style="width:30px;height:30px;border-radius:9px;background:#fff;color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+ic+'</span>'
            +'<div style="flex:1;min-width:0;font-size:13px;">'+main+'</div>'+(extra||'')+'</div>'; };
          var _none='<span style="color:var(--ink4);">'+t('app.non_assigne_2')+'</span>';
          var _noteHtml=(noteCard||'').replace(/^<div id="[^"]*" style="[^"]*">/,'').replace(/<\/div>$/,'');
          var asgBlock='<div id="'+drvNoteId+'" style="padding:12px 14px;background:#EEF4FB;border-radius:var(--r);">'
            +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
              +'<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);">'+(_isSubPoster?'Véhicule et chauffeur du sous-traitant':'Véhicule et chauffeur')+'</div>'
              +(_canAsg?'<button class="drv-asg-btn" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--blue);font-weight:600;padding:0;display:flex;align-items:center;gap:4px;font-family:\'DM Sans\',sans-serif;">'+_editIco+' '+t('app.modifier')+'</button>':'')
            +'</div>'
            +_row(_carIc, _vehTxt?'<b>'+_rdEsc(_vehTxt)+'</b>':_none,
                  _asgVeh&&_asgVeh.plate?'<span style="font-family:monospace;font-size:12px;font-weight:700;letter-spacing:.04em;background:#fff;border:1.5px solid #C0392B;border-radius:6px;padding:3px 8px;color:#C0392B;white-space:nowrap;">'+_rdEsc(_asgVeh.plate)+'</span>':'')
            +_row(_usrIc, _drvTxt?'<b>'+_rdEsc(_drvTxt)+'</b>':_none,
                  _asgDrv&&_asgDrv.phone?'<a href="tel:'+_rdEsc(_asgDrv.phone)+'" style="font-size:12.5px;color:var(--blue);text-decoration:none;white-space:nowrap;">'+_rdEsc(_asgDrv.phone)+'</a>':'')
            +(_noteHtml?'<div style="border-top:1px solid #d0e4f7;margin-top:6px;padding-top:10px;">'+_noteHtml+'</div>':'')
            +'</div>';
          noteCard=asgBlock;
        }
        if(_phNote){ _phNote.outerHTML = noteCard; } else if(noteCard){ bodyEl3.insertAdjacentHTML('beforeend', noteCard); }
        // Attach event via JS (safe for all characters including apostrophes)
        setTimeout(function(){
          var pbtn = bodyEl3.querySelector('.sub-pax-btn');
          if(pbtn) pbtn.addEventListener('click', function(){ openPaxEdit(r.id, paxMatch?paxMatch[1].trim():'', telMatch?telMatch[1].trim():''); });
          var abtn = bodyEl3.querySelector('.drv-asg-btn');
          if(abtn) abtn.addEventListener('click', function(){ openMissionAssignment(r.id); });
          var btn = bodyEl3.querySelector('.drv-note-btn');
          if(btn) btn.addEventListener('click', function(){
            openDriverNoteEdit(this.dataset.rid, this.dataset.note);
          });
        }, 10);
      } catch(e){
        console.warn('client contact fetch error:', e);
        ['ph-drv-pax','ph-drv-note'].forEach(function(pid){
          var el=document.getElementById(pid); if(el) el.remove();
        });
      }
    })();
  }

  // ── Course confirmée (client) : 2 blocs — ① véhicule / chauffeur + note du chauffeur + prix ; ② passager + note au chauffeur ──
  if(isClient && (r.status==='confirmed'||r.status==='active') && sb && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    var bodyElMain = document.getElementById('detail-body');
    if(bodyElMain){
      bodyElMain.insertAdjacentHTML('beforeend',
        '<div id="ph-fleet" class="rd-skel" style="height:190px;"></div>'
        +'<div id="ph-passenger" class="rd-skel" style="height:140px;"></div>'
      );
    }
    var _rideIdForPax = r.id;
    // « Bon voyage » : bandeau de confirmation + voucher en tête du détail
    if(bodyElMain){
      // Nom du passager (toujours) ; à défaut, le prénom du compte
      var _fn=_rdTag(r.notes,'pax')||((currentProfile&&currentProfile.first_name)||'').trim();
      var _rdD=r.ride_date?new Date(r.ride_date+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'}):'';
      _rdD=_rdD?(_rdD.charAt(0).toUpperCase()+_rdD.slice(1)).replace(/\./g,''):'';
      var _short=function(a){ return String(a||'').split(',')[0].trim(); };
      var _durM=(r.notes||'').match(/Durée:([^\s|,]+)/);
      var _trj=_short(cleanAddr(r.from_address||''))+(isMixed?'':isDisp?(_durM?' \u00b7 Mise \u00e0 disposition '+_durM[1]:''):(r.to_address?' \u2192 '+_short(r.to_address):''));
      var _heroT=r.status==='active'||r.pickup_at ? 'Bonne route'+(_fn?', '+_fn:'')+' !'
        : r.on_way_at ? 'Votre chauffeur est en route' : 'Bon voyage'+(_fn?', '+_fn:'')+' !';
      var _dlIc='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
      var _docIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>';
      bodyElMain.insertAdjacentHTML('afterbegin',
        '<div class="rdv-hero"><b>'+_rdEsc(_heroT)+'</b>'
          +'<p>'+_rdEsc([_rdD+(r.ride_time?' \u00e0 '+r.ride_time.slice(0,5):''), _trj].filter(Boolean).join(' \u00b7 '))+'</p></div>'
        +(r.change_state?'':'<div class="rdv-vch"><div class="vi">'+_docIc+'</div><div style="min-width:0"><div class="rdv-t">'+t('app.voucher_de_transport')+'</div><div class="rdv-s">'+t('app2.a_presenter_a_votre_chauffeur')+'</div></div>'
          +'<button class="rdv-dl" type="button" onclick="generateRideVoucher(\''+String(r.id).replace(/'/g,'')+'\')">'+_dlIc+'<span>'+t('app2.telecharger')+'</span></button></div>'));
      // Date, passagers et trajet sont dans le bandeau : on retire les pastilles et la carte du trajet (sauf course mixte)
      var _chipsEl=bodyElMain.querySelector('.rmc-wrap'); if(_chipsEl) _chipsEl.remove();
      if(!isMixed){ var _rtEl=bodyElMain.querySelector('.rd-route'); if(_rtEl) _rtEl.remove(); }
      // En-tête : uniquement le numéro de la course (pas de ligne événement / trajet mixte)
      var _evEl=bodyElMain.querySelector('.rd-evline'); if(_evEl) _evEl.remove();
    }
    (async function(myGen){
      try {
        var notesRaw = r.notes||'';
        var [fd, cpRes] = await Promise.all([
          _clientFleetData(r),
          currentUser ? sb.from('profiles').select('first_name,last_name,phone').eq('id',currentUser.id).maybeSingle() : Promise.resolve({data:null})
        ]);
        if(window._detailGen!==myGen) return;

        // ① Véhicule et chauffeur + note du chauffeur + prix
        var phFleet = document.getElementById('ph-fleet');
        if(phFleet){
          var offerNoteClient = (notesRaw.match(/\|offer_note:([^|]+)/)||[])[1]||'';
          var _v=fd.veh, _d=fd.drv;
          var _uIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
          var _cIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6a2 2 0 012-1.5h10A2 2 0 0119 7l2 6v4H3z"/><circle cx="7.5" cy="13.5" r=".8" fill="currentColor"/><circle cx="16.5" cy="13.5" r=".8" fill="currentColor"/></svg>';
          var _pIc='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h4l2 5-2.5 1.5a11 11 0 004 4L15 12l5 2v4a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2z"/></svg>';
          var _picked=r.status==='active'||!!r.pickup_at;
          var _drvSub=_picked?'Vous \u00eates \u00e0 bord' : r.on_way_at?'En route vers le point de d\u00e9part' : 'Il vous attend au point de d\u00e9part \u00e0 l\u2019heure pr\u00e9vue';
          var _vName=_v?((_v.brand||'')+' '+(_v.model||'')).trim():'';
          var _vSub=[_v&&_v.color||'', ({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[r.vehicle_type]||''].filter(Boolean).join(' \u00b7 ');
          var _first=_d&&_d.first?_d.first:'';
          var _ln=function(ic,main,sub,right){ return '<div class="rdv-ln"><div class="vi">'+ic+'</div><div><div class="rdv-t">'+main+'</div>'+(sub?'<div class="rdv-s">'+sub+'</div>':'')+'</div>'+(right||'')+'</div>'; };
          phFleet.outerHTML = '<div class="rdv-box">'
            +'<div class="rd-cap" style="margin-bottom:4px;">'+t('app2.vehicule_et_chauffeur')+'</div>'
            +_ln(_uIc,
                _first?_rdEsc(_first)+' <span style="font-weight:400;color:var(--ink3);">'+t('app2.votre_chauffeur')+'</span>':'Chauffeur bient\u00f4t attribu\u00e9',
                (_d&&_d.fleet?_rdEsc(_d.fleet)+' \u00b7 ':'')+(_first?_drvSub:'Le pr\u00e9nom de votre chauffeur s\u2019affichera ici'),
                _d&&_d.phone?'<a class="rdv-call" href="tel:'+_rdEsc(String(_d.phone).replace(/[^\d+]/g,''))+'" title="'+_rdEsc(_d.phone)+'">'+_pIc+'</a>':'')
            +_ln(_cIc, (_vName?_rdEsc(_vName):'V\u00e9hicule \u00e0 confirmer')+(_v&&_v.plate?'<span class="rdv-plate">'+_rdEsc(_v.plate)+'</span>':''), _vSub?_rdEsc(_vSub):'')
            +(offerNoteClient?'<div class="rdv-note"><div class="rd-cap">'+t('app.note')+' '+(_first?'de '+_rdEsc(_first):'du chauffeur')+'</div><div class="rd-note">'+_rdEsc(offerNoteClient.trim())+'</div></div>':'')
            +'</div>';
        }

        // ② Passager + note au chauffeur
        var phPax = document.getElementById('ph-passenger');
        if(phPax){
          var cp = cpRes.data || {};
          var paxMatch = notesRaw.match(/\|pax:([^|]+)/);
          var telMatch = notesRaw.match(/\|tel:([^|]+)/);
          var defName = ((cp.first_name||'')+' '+(cp.last_name||'')).trim() || '—';
          var dispName = paxMatch ? paxMatch[1].trim() : defName;
          var dispPhone = telMatch ? telMatch[1].trim() : (cp.phone||'');
          var noteMatch = notesRaw.match(/\|note_drv:([^|]+)/);
          var currentNote = noteMatch ? noteMatch[1].trim() : '';
          var pen = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/><path d="M10 4l2 2"/></svg>';
          var _paxIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
          // Même présentation que le bloc véhicule / chauffeur : icône + nom + téléphone sur une ligne
          phPax.outerHTML = '<div class="rd-card" id="pax-info-block">'
            + '<div class="rd-cap" style="margin-bottom:8px;">'+t('app.informations_du_passager')+'</div>'
            + '<div class="rd-line"><span class="rd-ic">'+_paxIc+'</span><div style="min-width:0;flex:1"><div class="rd-strong">'+_rdEsc(dispName)+'</div></div>'
              + (dispPhone ? '<a class="rd-call" href="tel:'+_rdEsc(dispPhone.replace(/[^\d+]/g,''))+'">'+_rdEsc(dispPhone)+'</a>' : '')
            + '</div>'
            + '<div class="rd-hr"></div>'
            + '<div class="rd-cap" style="margin-bottom:6px;">'+t('app.note_au_chauffeur')+'</div>'
            + (currentNote ? '<div class="rd-note">'+_rdEsc(currentNote)+'</div>' : '<div class="rd-muted">'+t('app.aucune_note')+'</div>')
            + '</div>';
          window._rdPax = { id:_rideIdForPax, name:dispName, phone:dispPhone, note:currentNote };
        }
      } catch(e){
        console.warn('confirmed client blocks error:', e);
        ['ph-fleet','ph-passenger'].forEach(function(pid){ var el=document.getElementById(pid); if(el) el.remove(); });
      }
    })(gen);
  }

  // ── Course terminée (client) : récapitulatif sous la carte — véhicule / chauffeur, prix payé HTVA et TVAC ──
  // Course annulée (client) : pas de sous-titre ; nom de l'événement / trajet mixte dans l'en-tête
  if(isClient && r.status==='cancelled'){
    try{
      var _hdC=document.querySelector('#detail-title .rd-hd2'), _subC=_hdC&&_hdC.querySelector('.rd-hd2-sub');
      if(_subC && !(isMixed&&mixedSegs.length)) _subC.remove();
      var _evC=document.querySelector('#detail-body .rd-evline');
      if(_evC) _evC.remove();   // en-tête : uniquement le numéro de la course
    }catch(_e){}
  }
  var _extra = document.getElementById('detail-extra');
  if(_extra){ _extra.innerHTML=''; _extra.style.display='none'; }
  if(isClient && r.status==='done' && sb && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    var bodyD=document.getElementById('detail-body');
    if(bodyD){
      var n0=r.notes||'', fn0=_rdTag(n0,'pax')||((currentProfile&&currentProfile.first_name)||'').trim();
      var paxN=_rdTag(n0,'pax')||((currentProfile&&currentProfile.first_name||'')+' '+(currentProfile&&currentProfile.last_name||'')).trim();
      var dD=r.ride_date?new Date(r.ride_date+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,''):'';
      dD=dD?dD.charAt(0).toUpperCase()+dD.slice(1):'';
      var sh=function(a){ return String(a||'').split(',')[0].trim(); };
      var durD=(n0.match(/Durée:([^\s|,]+)/)||[])[1]||'';
      var trjD=sh(cleanAddr(r.from_address||''))+(isMixed?'':isDisp?(durD?' · '+durD:''):(r.to_address?' → '+sh(r.to_address):''));
      var ic=function(d){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'; };
      var chip=function(i,t){ return t?'<span>'+ic(i)+_rdEsc(t)+'</span>':''; };
      var routeKeep = isMixed ? (bodyD.querySelector('.rd-route')||{}).outerHTML||'' : '';
      var plusIc='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
      var _doneK=(r.event_name&&r.event_kind!=='mixed')?'Événement terminé':(isMixed||r.event_kind==='mixed')?'Trajet mixte terminé':isDisp?'Mise à disposition terminée':'Transfert terminé';
      if(r.no_show_at) _doneK='Course clôturée · passager absent';
      try{ var _hs=document.querySelector('#detail-title .rd-hd2-sub'); if(_hs) _hs.remove(); }catch(_e){}
      bodyD.innerHTML =
        '<div class="rdv-hero"><small>'+_rdEsc(_doneK)+'</small>'
          +(r.no_show_at?'<b>'+t('app.nous_sommes_desoles')+(fn0?', '+_rdEsc(fn0):'')+'</b>'
            +'<p style="margin-top:8px;">'+t('app.votre_chauffeur_sest_presente_au')+'</p>'
            :'<b>'+t('app.merci_pour_votre_confiance')+(fn0?', '+_rdEsc(fn0):'')+' !</b>')
          +'<div class="rdv-chips" style="flex-wrap:wrap;">'+(dD?'<span>'+ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>')+_rdEsc(dD)
              +(r.ride_time?'<i class="rdv-sep"></i>'+ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+_rdEsc(r.ride_time.slice(0,5)):'')+'</span>':'')+chip('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',paxN)
            +'</div>'
          +(trjD?'<p>'+_rdEsc(trjD)+'</p>':'')+'</div>'
        +routeKeep
        +'<div id="ph-done" class="rd-skel" style="height:190px;"></div>'
        +'<button type="button" class="rdv-promo" onclick="_rdNewRide()">'
          +'<span class="rdv-promo-t"><small>'+t('app2.un_autre_deplacement_prevu')+'</small>'+t('app2.reservez_votre_prochain_trajet')+'</span>'
          +'<span class="rdv-promo-go"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>';
      (async function(myGen){
        try{
          var fd = await _clientFleetData(r);
          if(window._detailGen!==myGen) return;
          var ph=document.getElementById('ph-done'); if(!ph) return;
          var v=fd.veh, d=fd.drv, first=d&&d.first?d.first:'';
          var vName=v?((v.brand||'')+' '+(v.model||'')).trim():'';
          var vSub=[v&&v.color||'', ({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[r.vehicle_type]||''].filter(Boolean).join(' · ');
          var uIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
          var cIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6a2 2 0 012-1.5h10A2 2 0 0119 7l2 6v4H3z"/><circle cx="7.5" cy="13.5" r=".8" fill="currentColor"/><circle cx="16.5" cy="13.5" r=".8" fill="currentColor"/></svg>';
          var ln=function(i,m,sub){ return '<div class="rdv-ln"><div class="vi">'+i+'</div><div><div class="rdv-t">'+m+'</div>'+(sub?'<div class="rdv-s">'+sub+'</div>':'')+'</div></div>'; };
          var rdData=JSON.stringify({trip_type:r.trip_type,to_address:r.to_address,notes:r.notes}).replace(/'/g,'&#39;');
          ph.outerHTML='<div class="rdv-box"><div class="rd-cap" style="margin-bottom:4px;">'+t('app.votre_chauffeur_et_votre_vehicule')+'</div>'
            +ln(uIc,(first?_rdEsc(first):(d&&d.fleet?_rdEsc(d.fleet):'Votre chauffeur'))+(first&&d.fleet?' <span style="font-weight:400;color:var(--ink3);">· '+_rdEsc(d.fleet)+'</span>':''),'Votre chauffeur pour cette course')
            +ln(cIc,(vName?_rdEsc(vName):'Véhicule')+(v&&v.plate?'<span class="rdv-plate">'+_rdEsc(v.plate)+'</span>':''),vSub?_rdEsc(vSub):'')
            +(r.rated
              ? '<div class="rdv-rateln" id="rdv-rated"><span class="rdv-t" style="font-size:13px;">'+t('app.merci_pour_votre_avis')+'</span><span class="rdv-stars on"></span></div>'
              : '<div class="rdv-rateln"><span class="rdv-t" style="font-size:13px;">'+t('app2.comment_sest_passee_votre_course')+'</span>'
                +'<span class="rdv-stars" data-r="'+_rdEsc(r.id)+'" data-f="'+_rdEsc(from)+'" data-rd=\''+rdData+'\'>'
                +[5,4,3,2,1].map(function(k){ return '<span role="button" title="'+k+'/5" onclick="_rdRate(this.parentNode,'+k+')">\u2605</span>'; }).join('')+'</span></div>')
            +'</div>';
          if(r.rated){ try{ var rt=(await sb.from('ratings').select('score').eq('ride_id',r.id).maybeSingle()).data; var st=document.querySelector('#rdv-rated .rdv-stars');
            if(st&&rt&&rt.score){ var h=''; for(var k=5;k>=1;k--) h+='<span class="'+(k<=rt.score?'f':'')+'">\u2605</span>'; st.innerHTML=h; } }catch(_e){} }
        }catch(e){ console.warn('done client error:', e); var ph2=document.getElementById('ph-done'); if(ph2) ph2.remove(); }
      })(gen);
    }
  }

  // ── Course terminée (fleet) : rappel sous la carte — passager puis véhicule et chauffeur ──
  if(!isClient && r.status==='done' && _extra && sb && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    _extra.innerHTML = '<div class="rd-skel" style="height:230px;"></div>'; _extra.style.display='';
    (async function(myGen){
      try{
        var _poster = !!(r.is_subcontract && currentUser && r.client_id===currentUser.id);
        var [ofr, cpr] = await Promise.all([
          r.driver_id ? sb.from('offers').select('vehicle_id,fleet_driver_id').eq('ride_id',r.id).eq('driver_id',r.driver_id).eq('status','accepted').maybeSingle() : Promise.resolve({data:null}),
          r.client_id && !_poster ? sb.from('profiles').select('first_name,last_name,phone').eq('id',r.client_id).maybeSingle() : Promise.resolve({data:null})
        ]);
        var o=ofr.data||{}, cp=cpr.data||{};
        var [vh, fdr] = await Promise.all([
          o.vehicle_id ? sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',o.vehicle_id).maybeSingle() : Promise.resolve({data:null}),
          o.fleet_driver_id && !_poster ? sb.from('fleet_drivers').select('first_name,last_name,phone').eq('id',o.fleet_driver_id).maybeSingle() : Promise.resolve({data:null})
        ]);
        var dv=fdr.data;
        if(!dv && o.fleet_driver_id){ try{ var rp=await sb.rpc('ride_assigned_driver',{p_ride:r.id}); dv=(rp.data&&rp.data[0])||null; }catch(_e){} }
        if(window._detailGen!==myGen) return;
        var n=r.notes||'';
        _extra.innerHTML = '<div style="margin-bottom:20px;">'+_rdInfoBlocks({
          pax:{ name:_rdTag(n,'pax')||((cp.first_name||'')+' '+(cp.last_name||'')).trim(), phone:_rdTag(n,'tel')||cp.phone||'', email:_rdTag(n,'pemail'), ref:_rdTag(n,'pref'), note:_rdTag(n,'note_drv') },
          paxNoteLabel:'Message du client',
          veh:vh.data, drv: dv ? { name:((dv.first_name||'')+' '+(dv.last_name||'')).trim(), phone:dv.phone||'' } : null,
          vehTitle: _poster ? 'Véhicule et chauffeur du sous-traitant' : 'Véhicule et chauffeur',
          drvNoteLabel: r.is_subcontract ? 'Note du sous-traitant' : 'Note au client', drvNote:_rdTag(n,'offer_note')
        })+'</div>';
      }catch(e){ console.warn('done fleet summary error:', e); _extra.innerHTML=''; _extra.style.display='none'; }
    })(gen);
  }

  // Footer
  var rId=r.id;
  var ft='';
  // ── CLIENT FOOTER ────────────────────────────────────────────
  var trashBtn = '<button style="background:none;border:none;color:var(--red);font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;padding:0;margin-right:auto;" onclick="deleteRide(this.dataset.id)" data-id="'+rId+'">'
    +'<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    +t('app.annuler_la_demande')+'</button>';
  var closeBtn = '<button class="btn btn-close" onclick="closeModal(this.dataset.m)" data-m="m-ride-detail">'+t('app.fermer')+'</button>';

  if(isClient){
    if(r.status==='waiting'){
      ft=_clientRideMenu(rId,true,true)+'<div style="margin-right:auto;"></div>'+closeBtn;
    } else if(r.status==='offers'){
      ft=_clientRideMenu(rId,true,true)+'<div style="margin-right:auto;"></div>'+closeBtn
        +'<button class="btn btn-primary" onclick="_rdPushUnder(this.dataset.m);openRide(this.dataset.r)" data-m="m-ride-detail" data-r="'+rId+'">Voir les offres &#x2192;</button>';
    } else if(r.status==='pending_payment'){
      ft=closeBtn;
    } else if(r.status==='confirmed'||r.status==='active'){
      var pdfVoucherBtn = '<button onclick="generateRideVoucher(\''+rId+'\')" class="btn btn-secondary" style="display:flex;align-items:center;gap:5px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>'+t('app.voucher')+'</button>';
      // Passager et note au chauffeur : modifiables depuis le menu ⋮
      (function(){
        var n=r.notes||'', cpn=((currentProfile&&currentProfile.first_name||'')+' '+(currentProfile&&currentProfile.last_name||'')).trim();
        window._rdPax={ id:rId, name:((n.match(/\|pax:([^|]+)/)||[])[1]||cpn||'').trim(), phone:((n.match(/\|tel:([^|]+)/)||[])[1]||(currentProfile&&currentProfile.phone)||'').trim(), note:((n.match(/\|note_drv:([^|]+)/)||[])[1]||'').trim() };
      })();
      var _hasNote=!!window._rdPax.note;
      var _penIc='<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var _paxItems='<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');openPaxEdit(window._rdPax.id,window._rdPax.name,window._rdPax.phone)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'+t('app.modifier_les_informations_du_passager')+'</button>'
        +'<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');openNoteEdit(window._rdPax.id,window._rdPax.note)">'+_penIc+(_hasNote?'Modifier la note au chauffeur':'Ajouter une note au chauffeur')+'</button>';
      var _vItem=_paxItems+'<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');generateRideVoucher(\''+String(rId).replace(/'/g,'')+'\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>'+t('app.telecharger_le_voucher')+'</button>';
      if(r.status==='active'||r.pickup_at||r.on_way_at){
        // Course commencée (chauffeur en route, prise en charge…) : plus de modification passager / note, mais signalement possible
        var _vOnly=_vItem.slice(_paxItems.length);
        var _probItem='<button class="ft-menu-item rd-prob-item" style="color:var(--red);" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');openRideProblem(\''+String(rId).replace(/'/g,'')+'\')"><svg style="color:var(--red);" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'+t('app2.signaler_un_probleme')+'</button>';
        ft=_clientRideMenu(rId,false,false,_vOnly+_probItem)+'<div style="margin-right:auto;"></div>'+closeBtn;
      } else if(r.change_state){
        // Modification en attente de réponse du chauffeur (ou supplément / retrait) : seulement l'annulation
        ft=_clientRideMenu(rId,false,true,'')+'<div style="margin-right:auto;"></div>'+closeBtn;
      } else if(_rideCancelLocked(r)){
        // Moins de 48 h : passager, note, voucher ; annulation possible mais non remboursable
        ft=_clientRideMenu(rId,false,true,_vItem)+'<div style="margin-right:auto;font-size:12px;color:var(--ink3);">'+t('app2.modification_impossible_a_moins_de')+' '+_refundDelayHours(r)+' '+t('app2.h_du_depart')+'</div>'+closeBtn;
      } else {
        // Au-delà du délai : Modifier ma demande · Télécharger le voucher · Annuler ma demande
        var _canEd=r.status==='confirmed' && r.change_state!=='withdrawn';
        var _edItem=_canEd?'<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');editRide(\''+String(rId).replace(/'/g,'')+'\')"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'+t('app.modifier_ma_demande')+'</button>':'';
        ft=_clientRideMenu(rId,false,true,_edItem+(_canEd?_vItem.slice(_paxItems.length):_vItem))+'<div style="margin-right:auto;"></div>'+closeBtn;
      }
      if(r.on_way_at||r.status==='active') ft+='<button class="btn btn-green" onclick="closeModal(\'m-ride-detail\');openLiveTracking(\''+String(rId).replace(/'/g,'')+'\')">'+t('app.suivre_en_direct')+'</button>';
    } else if(r.status==='done'){
      var _probItemDone='<button class="ft-menu-item rd-prob-item" style="color:var(--red);" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');openRideProblem(\''+String(rId).replace(/'/g,'')+'\')"><svg style="color:var(--red);" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'+t('app2.signaler_un_probleme')+'</button>';
      var priceTagDone = _clientRideMenu(rId,false,false,_probItemDone)+'<div style="margin-right:auto;"></div>';
      if(sb && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
        ft=priceTagDone+closeBtn;   // évaluation : bouton dans le cadre « Votre chauffeur et votre véhicule »
      } else if(r.rated){
        ft=priceTagDone+'<div style="font-size:13px;color:var(--green);font-weight:500;">'+t('app2.evaluee')+'</div>'+closeBtn;
      } else {
        ft=priceTagDone+closeBtn+'<button class="btn btn-primary ft-rate" onclick="openRateModal(this.dataset.r,this.dataset.f,this.dataset.rd)" data-m="m-ride-detail" data-r="'+rId+'" data-f="'+from.replace(/"/g,"&quot;")+'" data-rd=\''+JSON.stringify({trip_type:r.trip_type,to_address:r.to_address,notes:r.notes}).replace(/'/g,'&#39;')+'\'>&#11088; Evaluer</button>';
      }
    } else if(r.status==='cancelled'){
      var cancelledPriceTag = '';
      if(r.final_price){
        var pm = r.payment_method||'';
        if(pm==='refunded'){
          cancelledPriceTag = '<div style="margin-right:auto;padding:6px 12px;background:#FDECEA;border-radius:var(--r);font-size:13px;font-weight:600;color:var(--red);">'+t('app2.montant_rembourse')+' '+parseFloat(r.final_price).toFixed(2).replace('.',',')+'\u00a0€</div>';
        } else if(pm==='non_refundable'||!pm){
          cancelledPriceTag = '<div style="margin-right:auto;padding:6px 12px;background:var(--red-bg);border-radius:var(--r);font-size:13px;font-weight:600;color:var(--red);">'+t('app2.montant_non_rembourse')+' '+parseFloat(r.final_price).toFixed(2).replace('.',',')+'\u00a0€</div>';
        } else {
          // bank_transfer or stripe — refundable
          cancelledPriceTag = '<div style="margin-right:auto;padding:6px 12px;background:#EAF1FB;border-radius:var(--r);font-size:13px;font-weight:600;color:#1E4D7B;">'+t('app2.montant_a_rembourser')+' '+parseFloat(r.final_price).toFixed(2).replace('.',',')+'\u00a0€</div>';
        }
      } else {
        cancelledPriceTag = '<div style="margin-right:auto;"></div>';
      }
      ft=cancelledPriceTag+closeBtn;
    }

  // ── DRIVER FOOTER ─────────────────────────────────────────────
  } else {
    var safeRd=JSON.stringify(r).replace(/'/g,'&#39;');
    var isOwnSub=(r.is_subcontract&&currentUser&&r.client_id===currentUser.id);
    var isExtSub=(r.is_subcontract&&currentUser&&r.client_id!==currentUser.id);
    var hasMyOffer=_myOffers&&_myOffers[rId];

    if(r.status==='personal'){
      // Personal mission: edit / delete from the ⋮ menu
      var _pid=String(rId).replace(/'/g,'');
      ft=_ftMenu(
        '<button class="ft-menu-item" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');closeModal(\'m-ride-detail\');_editPersonalFromDetail()"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>'+t('app.modifier_la_mission')+'</button>'
       +'<button class="ft-menu-item" style="color:var(--red);" onclick="this.closest(\'.ft-menu\').classList.remove(\'open\');closeModal(\'m-ride-detail\');deletePersonalMission(\''+_pid+'\')"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--red)" stroke-width="1.6" stroke-linecap="round"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4"/></svg>'+t('app.supprimer_la_mission')+'</button>'
      )+'<span style="flex:1;"></span>'+closeBtn;
    } else if(r.status==='waiting'){
      if(isOwnSub){
        ft='<button style="background:none;border:none;color:var(--red);font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;padding:0;margin-right:auto;" onclick="deleteRide(this.dataset.id)" data-id="'+rId+'"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'+t('app.annuler_la_sous_traitance')+'</button>'+closeBtn;
      } else if(isExtSub){
        var subPriceLbl=r.final_price?parseFloat(r.final_price).toFixed(0)+'\u20ac':'';
        var priceLeft=r.final_price?'<div style="margin-right:auto;font-size:13px;font-weight:600;color:var(--amber);">'+t('app2.prix_demande')+' '+parseFloat(r.final_price).toFixed(0)+' € HTVA</div>':'<div style="margin-right:auto;"></div>';
        ft=priceLeft+closeBtn+'<button class="btn btn-green" onclick="closeModal(\'m-ride-detail\');acceptSubcontract(\''+rId+'\')">'+t('app.accepter')+'</button>';
      } else if(hasMyOffer){
        ft=_offerActionsMenu(rId,safeRd)+'<div style="margin-right:auto;font-size:14px;color:var(--green);font-weight:600;">'+t('app2.vous_avez_soumis_une_offre')+' '+parseFloat(hasMyOffer.price).toFixed(0)+'\u20ac</div>'+closeBtn;
      } else {
        ft=closeBtn+'<button class="btn btn-green" style="min-width:160px;" onclick="_detailOffer(this)" data-rid="'+rId+'" data-ride=\''+safeRd+'\'>'+t('app.soumettre_une_offre')+'</button>';
      }
    } else if(r.status==='offers'){
      var isOwnSub2=(r.is_subcontract&&currentUser&&r.client_id===currentUser.id);
      var isExtSub2=(r.is_subcontract&&currentUser&&r.client_id!==currentUser.id);
      var hasMyOffer2=_myOffers&&_myOffers[rId];
      if(hasMyOffer2&&!isOwnSub2&&!isExtSub2){
        ft=_offerActionsMenu(rId,safeRd)+'<div style="margin-right:auto;font-size:14px;color:var(--green);font-weight:600;">'+t('app2.vous_avez_soumis_une_offre')+' '+parseFloat(hasMyOffer2.price).toFixed(0)+'\u20ac</div>'+closeBtn;
      } else if(isExtSub2){
        var subPriceLbl2=r.final_price?parseFloat(r.final_price).toFixed(0)+'\u20ac':'';
        var priceLeft2=r.final_price?'<div style="margin-right:auto;font-size:13px;font-weight:600;color:var(--amber);">'+t('app2.prix_demande')+' '+parseFloat(r.final_price).toFixed(0)+' € HTVA</div>':'<div style="margin-right:auto;"></div>';
        ft=priceLeft2+closeBtn+'<button class="btn btn-green" onclick="closeModal(\'m-ride-detail\');acceptSubcontract(\''+rId+'\')">'+t('app.accepter')+'</button>';
      } else if(isOwnSub2){
        ft='<button class="btn btn-danger btn-sm" onclick="deleteRide(this.dataset.id)" data-id="'+rId+'">'+t('app.annuler')+'</button>'+closeBtn;
      } else {
        ft=closeBtn+'<button class="btn btn-green" style="min-width:160px;" onclick="_detailOffer(this)" data-rid="'+rId+'" data-ride=\''+safeRd+'\'>'+t('app.soumettre_une_offre')+'</button>';
      }
    } else if(r.status==='confirmed'||r.status==='active'){
      var _endTime=_getRideEndTime(r);
      var _isOverdue=_endTime&&new Date()>_endTime;
      var _missionBtn='<button onclick="generateMissionPdf(\''+rId+'\')" style="background:none;border:1.5px solid var(--sand3);border-radius:var(--r);padding:5px 10px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--ink2);font-family:\'DM Sans\',sans-serif;margin-right:auto;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>'+t('app2.telecharger_mission')+'</button>';
      var _assignBtn=(currentUser&&r.driver_id===currentUser.id&&!_isOverdue)
        ?'<button class="btn btn-secondary btn-sm" style="margin-left:6px;" onclick="openMissionAssignment(\''+rId+'\')">'+t('app.modifier_vehicule_chauffeur')+'</button>':'';
      var _canAssign=!!_assignBtn;
      // Dès « En chemin » : plus de note au client (bloqué aussi par le serveur)
      var _canNote=!(r.on_way_at||r.pickup_at||r.status==='active');
      if(currentUser&&r.driver_id===currentUser.id){
        // Mission progress: En chemin -> Pick up terminé -> Mission terminée (timestamp stored at each step)
        if(r.on_way_at||r.pickup_at) _canAssign=false;
        // Modification du client pas encore traitée (ou chauffeur retiré) : ni « En chemin », ni actions
        if(r.change_state==='to_review'||r.change_state==='withdrawn') ft='<span style="flex:1;"></span>'+closeBtn;
        else ft=_rideActionsMenu(rId,_canAssign,_canNote)+_missionProgressHtml(r)+closeBtn+_missionStepBtn(r);
      } else if(_isOverdue){
        ft=_rideActionsMenu(rId,false,_canNote)+'<span style="flex:1;"></span>'+closeBtn+'<button class="btn btn-green" onclick="completeRide(\''+rId+'\')" style="margin-left:8px;">'+t('app.terminer_la_course')+'</button>';
      } else {
        ft=_rideActionsMenu(rId,_canAssign,_canNote)+'<span style="flex:1;"></span>'+closeBtn;
      }
      // Sous-traitance publiée par cette flotte : suivi en direct du sous-traitant
      if(isOwnSub && r.driver_id && r.driver_id!==currentUser.id && (r.on_way_at||r.pickup_at||r.status==='active')) ft+='<button class="btn btn-green" style="margin-left:8px;" onclick="closeModal(\'m-ride-detail\');openLiveTracking(\''+String(rId).replace(/'/g,'')+'\')">'+t('app.suivre_en_direct')+'</button>';
    } else {
      // For subcontract rides (done/cancelled etc.) — show price left
      var subDonePrice = (r.is_subcontract && r.final_price)
        ? '<div style="margin-right:auto;padding:6px 12px;background:var(--amber-bg);border-radius:var(--r);font-size:13px;font-weight:600;color:var(--amber);">'+t('app2.prix_demande')+' '+parseFloat(r.final_price).toFixed(0)+' € HTVA</div>'
        : '';
      ft=(subDonePrice||'')+closeBtn;
    }
  }
  var ftEl=document.getElementById('detail-ft');if(ftEl)ftEl.innerHTML=ft;
  // Signalement déjà ouvert : l'action est remplacée par un libellé non cliquable
  if(isClient && ftEl && ftEl.querySelector('.rd-prob-item')){
    (async function(rid){
      var rep = await window._rideOpenReport(rid);
      var it = ftEl.querySelector('.rd-prob-item');
      if(rep && it){
        var d=document.createElement('div');
        d.className='ft-menu-item';
        d.style.cssText='cursor:default;color:#B26A00;';
        d.innerHTML='<svg style="color:#B26A00;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'+t('app.signalement_en_cours_de_traitement');
        d.onclick=function(ev){ ev.stopPropagation(); };
        it.replaceWith(d);
      }
    })(rId);
  }
  var sp0=document.getElementById('detail-map-spacer');if(sp0)sp0.style.height='0px';
  openModal('m-ride-detail');
};



var _pendingDeleteId = null;
var _pendingDeleteRide = null;

