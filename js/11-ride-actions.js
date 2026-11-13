// ── Préférences de notifications du client (cloche + e-mail), appliquées par le serveur ──
var _NT_ITEMS=[
  {k:'ride_published', l:'Demande publiée',               d:'Votre demande est en ligne pour les chauffeurs'},
  {k:'offer_received', l:'Nouvelle offre reçue',          d:'Un chauffeur vous propose un prix'},
  {k:'offer_updated',  l:'Mise à jour des offres reçues', d:'Une offre est modifiée ou retirée'},
  {k:'ride_confirmed', l:'Course confirmée',              d:'Paiement reçu, votre chauffeur est réservé'},
  {k:'driver_message', l:'Message ou modification du chauffeur', d:'Note du chauffeur, changement de véhicule ou de chauffeur'},
  {k:'driver_on_way',  l:'Chauffeur en route',            d:'Votre chauffeur part vers le lieu de prise en charge'},
  {k:'ride_changes',   l:'Modification de ma course',     d:'Supplément demandé, chauffeur retiré ou modification acceptée'},
  {k:'marketing',      l:'Offres et nouveautés Bleenr',   d:'Nos actualités et promotions, de temps en temps', emailOnly:true}
];
// Chauffeur / fleet : notifications liées aux missions (mission_change_emails.sql)
var _NT_DRV=[
  {k:'mission_changed', l:'Mission modifiée par le client', d:'Modification à valider, supplément payé par le client'}
];
function _ntRender(isClient){
  var cli=document.getElementById('pf-notif-cli'), drv=document.getElementById('pf-notif-drv');
  if(cli) cli.style.display='block';
  if(drv) drv.style.display='none';
  var _items=isClient?_NT_ITEMS:_NT_DRV;
  var prefs=(currentProfile&&currentProfile.notif_prefs)||{};
  var sw=function(ch,it){
    var on=((prefs[ch]||{})[it.k])!==false;
    return '<span class="nt-sw"><input type="checkbox" role="switch" aria-label="'+it.l+(ch==='app'?' — application':' — e-mail')+'" data-ch="'+ch+'" data-k="'+it.k+'"'+(on?' checked':'')+' onchange="_ntToggle(this)"><span></span></span>';
  };
  var box=document.getElementById('nt-list');
  if(box) box.innerHTML=_items.map(function(it){
    return '<div class="nt-row"><div><div class="nt-lbl">'+it.l+'</div><div class="nt-desc">'+it.d+'</div></div>'+(it.emailOnly?'<span style="justify-self:center;color:var(--ink4);">—</span>':sw('app',it))+sw('email',it)+'</div>';
  }).join('');
  var ms=document.getElementById('nt-mail-sub');
  if(ms&&currentUser&&currentUser.email) ms.textContent='Dans l’application et par e-mail ('+currentUser.email+')';
}
window._ntToggle=async function(el){
  var ch=el.dataset.ch, k=el.dataset.k, on=el.checked;
  if(localStorage.getItem(DEMO_MODE_KEY)==='1'||!sb){ showToast(t('toast_saved')); return; }
  el.disabled=true;
  var patch={}; patch[ch]={}; patch[ch][k]=on;
  var res=await sb.rpc('api_profile_update',{ p:{ notif_prefs: patch } });
  el.disabled=false;
  if(res.error){
    el.checked=!on;
    showToast(t('app.erreur_2')+(/notif_prefs|column/i.test(res.error.message||'')?'exécutez client_notif_prefs.sql dans Supabase':res.error.message));
    return;
  }
  if(res.data&&res.data.notif_prefs&&currentProfile) currentProfile.notif_prefs=res.data.notif_prefs;
  showToast((on?'🔔 Activé':'🔕 Désactivé')+(ch==='app'?' dans l’application':' par e-mail'));
};

window.saveProfile = async function(){
  var gv=function(id){var e=document.getElementById(id);return e?e.value.trim():'';};
  var isValidatedDriver = (currentProfile?.role==='driver' || currentRole==='driver') && currentProfile?.fleet_verified==='validated';
  const updates = {
    first_name:      isValidatedDriver ? undefined : gv('pf-fname'),
    last_name:       isValidatedDriver ? undefined : gv('pf-lname'),
    company_name:    isValidatedDriver ? undefined : (gv('pf-company') || undefined),
    phone:           gv('pf-phone'),
    vat_number:      gv('pf-vat'),
    address_street:  gv('pf-street'),
    address_postal:  gv('pf-postal'),
    address_city:    gv('pf-city'),
    address_country: gv('pf-country'),
  };
  // Remove undefined keys
  Object.keys(updates).forEach(function(k){ if(updates[k]===undefined) delete updates[k]; });

  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    const { error } = await sb.rpc('api_profile_update', { p: updates });
    if(error){ showToast(t('app.erreur_3') + error.message); return; }
  }
  Object.assign(currentProfile, updates);
  // Update nav
  var displayName = (updates.company_name || ((updates.first_name||currentProfile.first_name||'')+' '+(updates.last_name||currentProfile.last_name||'')).trim() || '');
  var navNameEl = document.getElementById('nav-name');
  var navAvEl = document.getElementById('nav-avatar');
  if(navNameEl) navNameEl.textContent = displayName;
  if(navAvEl && !currentProfile.avatar_url) navAvEl.textContent = (displayName[0]||'?').toUpperCase();
  showToast(t('toast_saved'));
};


// ── RIDE ACTIONS ──────────────────────────────────────
// Carte du tableau de bord client → « Mes demandes » déjà filtrée
window._goRides = function(filter){
  document.querySelectorAll('#rides-filters .btn').forEach(function(b){
    var on=(b.getAttribute('onclick')||'').indexOf("filterRides('"+filter+"'")===0;
    b.className = on ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  });
  showPage('rides');
};
window.filterRides = function(filter, btn){
  document.querySelectorAll('#rides-filters .btn').forEach(b => b.className = 'btn btn-secondary btn-sm');
  btn.className = 'btn btn-primary btn-sm';
  loadRides(filter);
};

window.openRide = async function(rideId){
  if(currentRole === 'client'){
    await openOffersModal(rideId);
  }
  // driver can't click rides they didn't make offers on
};

async function openOffersModal(rideId){
  currentRideId = rideId;
  _currentPaymentRide = null;
  openModal('m-view-offers');
  document.getElementById('offers-list').innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';

  let offers = [];
  window._offersLoadErr = '';
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    // Fetch ride data for payment modal route info
    const { data: rideData, error: rideErr } = await sb.from('rides')
      .select('*')   // toutes les colonnes (bagages compris) : rappel de la demande
      .eq('id', rideId)
      .maybeSingle();
    if(rideErr){ console.error('offers modal ride error:', rideErr); window._offersLoadErr = 'Course : '+(rideErr.message||rideErr.code); }
    _currentPaymentRide = rideData || null;

    // Query offers by ride_id only - no status filter, no join
    const { data, error } = await sb.from('offers')
      .select('*')   // inclut outdated_at / outdated_reason (offre faite avant une modification de la demande)
      .eq('ride_id', rideId)
      .neq('status', 'rejected');
    if(error){ console.error('offers error:', error.message, error.code); window._offersLoadErr = (window._offersLoadErr?window._offersLoadErr+' · ':'')+'Offres : '+(error.message||error.code); }
    offers = data || [];

    // Fetch driver profiles separately
    if(offers.length > 0){
      const ids = [...new Set(offers.map(o => o.driver_id).filter(Boolean))];
      if(ids.length > 0){
        const { data: pData } = await sb.from('profiles')
          .select('id, first_name, last_name, company_name, rating, rating_count')
          .in('id', ids);
        if(pData){
          const pm = {};
          pData.forEach(p => { pm[p.id] = p; });
          offers.forEach(o => { o.profiles = pm[o.driver_id] || {}; });
        }
      }
      // Fetch vehicles for offers
      const vehIds = [...new Set(offers.map(o => o.vehicle_id).filter(Boolean))];
      if(vehIds.length > 0){
        const { data: vData } = await sb.from('fleet_vehicles')
          .select('id, brand, model, year, color, vehicle_class, amenities')
          .in('id', vehIds);
        if(vData){
          const vm = {};
          vData.forEach(v => { vm[v.id] = v; });
          offers.forEach(o => { o.vehicle = vm[o.vehicle_id] || null; });
        }
      }
    }
  } else {
    _currentPaymentRide = getDemoRides().find(function(r){ return r.id === rideId; }) || null;
    offers = getDemoOffers();
  }

  var _rr=_currentPaymentRide, _n=offers.length;
  var _code=_rr?(_rr.booking_code||''):'';
  document.getElementById('offers-modal-title').innerHTML = (_code?'<span class="rd-code">'+_code+'</span><span class="rd-sep"> · </span>':'')
    +'<span class="rd-sub">'+(_n?_n+' offre'+(_n>1?'s':'')+' reçue'+(_n>1?'s':''):'Offres reçues')+'</span>';

  _offersData=offers;
  _offersFilter='all';
  _offersSort='asc';

  // Rappel de la course
  var rideHtml='';
  if(_rr){
    var _sa=function(x){ return String(cleanAddr(x)||'').split(',')[0].trim(); };
    var _from=_sa(_rr.from_address), _to=_rr.trip_type==='disposal'?'Mise à disposition':_sa(_rr.to_address);
    rideHtml='<div class="ofs-ride">'+_rideMetaChips(_rr)+_routeBlockHtml(_rr,'ofs')+'</div>';
    setTimeout(function(){ _routeBlockDist(_rr,'ofs'); },0);
  }
  var filtersHtml=_n>1?('<div class="ofs-bar">'
    +'<div class="ofs-seg">'
      +'<button class="offers-filter-btn on" onclick="_offersSetFilter(\'all\',this)">'+t('app.toutes')+'</button>'
      +'<button class="offers-filter-btn" onclick="_offersSetFilter(\'electric\',this)">'+t('app2.electrique')+'</button>'
      +'<button class="offers-filter-btn" onclick="_offersSetFilter(\'hybrid\',this)">'+t('app.hybride')+'</button>'
    +'</div>'
    +'<button class="ofs-sort" onclick="_offersSetSort(null,this)">'+t('app2.prix')+'</button>'
  +'</div>'):'';

  document.getElementById('offers-list').innerHTML = rideHtml + (offers.length
    ? filtersHtml + '<div id="offers-cards">' + offers.sort(function(a,b){return (a.price||0)-(b.price||0);}).map(function(o){return renderOfferCard(o);}).join('') + '</div>'
    : '<div class="empty-state"><p class="empty-text">'+t('empty_offers')+'</p>'
      +(window._offersLoadErr?'<p style="margin-top:10px;font-size:12px;color:var(--red);word-break:break-word;">'+String(window._offersLoadErr).replace(/</g,'&lt;')+'</p>':'')+'</div>');
}
window.acceptOffer = async function(offerId, driverId, price){
  if(localStorage.getItem(DEMO_MODE_KEY) === '1'){
    closeModal('m-view-offers');
    showToast(t('toast_offer_acc'));
    return;
  }
  if(!sb) return;
  // La confirmation passe obligatoirement par le paiement (validé côté serveur)
  openPaymentModal(offerId, driverId, price);
};

// ── Km inclus (mise à disposition) ──
// Returns the disposal segments of a ride: [{idx, label}]
// disposal ride -> one entry (idx 0); mixed ride -> one entry per "Disposition" segment (idx = segment index)
function _offerKmSegments(r){
  if(!r) return [];
  if(r.trip_type==='disposal') return [{idx:0, label:''}];
  if(r.trip_type==='mixed'){
    var segs=parseMixedNotes(r.notes||'');
    var out=[];
    segs.forEach(function(s,i){
      if((s.type||'').toLowerCase().indexOf('disp')>=0){
        out.push({idx:i, label:'Trajet '+(i+1)+(s.from?' \u2014 '+String(cleanAddr(s.from)||'').split(',')[0].trim():'')});
      }
    });
    return out;
  }
  return [];
}

function _renderOfferKmFields(r, existing){
  var wrap=document.getElementById('offer-km-wrap');
  if(!wrap) return;
  var segs=_offerKmSegments(r);
  if(!segs.length){ wrap.innerHTML=''; wrap.style.display='none'; return; }
  var prev=(existing&&existing.km)||{};
  var dis=!!existing && !existing.outdated;
  wrap.innerHTML=segs.map(function(s){
    var val=(prev[String(s.idx)]!=null)?prev[String(s.idx)]:'';
    var lbl=s.label?'Kilom\u00e8tres inclus \u2014 '+s.label.replace(/</g,'&lt;'):'Kilom\u00e8tres inclus';
    return '<div class="input-group"><label>'+lbl+' <span style="color:var(--red)">*</span></label>'
      +'<input class="offer-km-inp" data-seg="'+s.idx+'" type="number" min="1" step="1" inputmode="numeric" placeholder="ex. 150" value="'+val+'"'
      +(dis?' disabled style="opacity:0.5;cursor:not-allowed;"':'')+'></div>';
  }).join('');
  wrap.style.display='block';
}

// Reads the km fields. Returns {ok:true, km:{idx:number}|null} or {ok:false}
function _readOfferKm(){
  var inps=document.querySelectorAll('#offer-km-wrap .offer-km-inp');
  if(!inps.length) return {ok:true, km:null};
  var km={}, ok=true;
  inps.forEach(function(i){
    var v=parseInt(i.value,10);
    if(!(v>0)){ ok=false; return; }
    km[i.dataset.seg]=v;
  });
  return ok?{ok:true, km:km}:{ok:false};
}

// Montant net pour la fleet : prix HTVA − commission Bleenr (taux du pays de la fleet, Admin → Facturation)
var _offerCommRate=null;
window._offerNetUpdate=function(){
  var box=document.getElementById('offer-net'), el=document.getElementById('offer-price'); if(!box||!el) return;
  var p=parseFloat(String(el.value).replace(',','.'));
  if(!(p>0) || _offerCommRate==null){ box.style.display='none'; return; }
  var _on=BleenrCore.offerNet(p,_offerCommRate), comm=_on.commission, net=_on.net;   // core/billing.ts
  var f=function(v){ return v.toFixed(2).replace('.',',')+' €'; };
  box.innerHTML=t('app.vous_recevrez')+' <b style="color:var(--green);font-size:15px;">'+f(net)+' HTVA</b>'
    +'<div style="font-size:12px;color:var(--ink3);">'+f(p)+' − commission Bleenr '+_pctTxt(_offerCommRate)+' % ('+f(comm)+')</div>';
  box.style.display='block';
};
// Offre existante : son véhicule reste présélectionné
function _offerPickVehicle(ex){
  var s=document.getElementById('offer-vehicle-select');
  if(s && ex && ex.vehicle && s.querySelector('option[value="'+ex.vehicle+'"]')) s.value=ex.vehicle;
}
// Retrait depuis le panneau de l'offre
window._offerWithdrawFromModal=async function(){
  if(!currentRideId) return;
  await _withdrawOffer(currentRideId);
  if(!(_myOffers&&_myOffers[currentRideId])) closeModal('m-submit-offer');
};
window.openOfferModal = function(rideId, summary, rideObj){
  if(!_stripeGate()) return;
  _offerCommRate=null;
  _commPct(currentProfile&&currentProfile.address_country).then(function(p){
    var n=document.getElementById('offer-comm-note'); if(n) n.textContent='Le prix inclut la commission de la plateforme ('+_pctTxt(p)+' %)';
    _offerCommRate=parseFloat(p)||0; _offerNetUpdate();
  });
  currentRideId = rideId;
  // En-tête : numéro de la course + « Soumettre une offre » (comme « Offres reçues »)
  var _ttl=document.querySelector('#m-submit-offer .modal-title'), _cd=rideObj&&rideObj.booking_code;
  if(_ttl) _ttl.innerHTML=_cd?'<span class="rd-hd2"><b class="rd-hd2-code">'+_rdEsc(_cd)+'</b><span class="rd-hd2-sub">'+t('app.soumettre_une_offre')+'</span></span>':'Soumettre une offre';
  var sumEl = document.getElementById('offer-ride-summary');
  sumEl.style.display = 'block';

  if(rideObj){
    // Use the same shared builder as the detail popup for identical rendering
    // Même présentation que l'écran des offres / la fiche : pastilles + trajet (liste des trajets pour un mixte)
    var _segs=rideObj.trip_type==='mixed'?parseMixedNotes(rideObj.notes||''):[];
    if(_segs.length){
      // Trajet mixte : chaque trajet présenté comme une course simple (pastilles + bloc départ / arrivée + distance)
      var _pr=_segs.map(function(sg){ var isD=(sg.type||'').toLowerCase().indexOf('disp')>=0;
        return { trip_type:isD?'disposal':'ab', ride_date:sg.date||rideObj.ride_date, ride_time:sg.time||'', passengers:parseInt(sg.pax,10)||sg.pax||'', vehicle_type:sg.veh||'', luggage_large:sg.lugL||0, luggage_small:sg.lugS||0,
          from_address:sg.from||'', to_address:isD?'':(sg.to||''), notes:(isD&&sg.dur?'Durée:'+sg.dur:'')+(sg.flight?'|flight:'+sg.flight:'')+(sg.train?'|train:'+sg.train:'') }; });
      sumEl.innerHTML=_pr.map(function(x,i){ return '<div class="off-trj"><div class="off-trj-hd"><span class="n">'+(i+1)+'</span>'+t('app.trajet')+' '+(i+1)+(x.trip_type==='disposal'?' · Mise à disposition':' · Transfert')+'</div><div class="ofs-ride">'+_rideMetaChips(x)+_routeBlockHtml(x,'off'+i)+'</div></div>'; }).join('');
      setTimeout(function(){ _pr.forEach(function(x,i){ _routeBlockDist(x,'off'+i); }); },0);
    } else {
      sumEl.innerHTML = '<div class="ofs-ride">'+_rideMetaChips(rideObj)+_routeBlockHtml(rideObj,'off')+'</div>';
      setTimeout(function(){ _routeBlockDist(rideObj,'off'); },0);
    }
  } else if(summary){
    sumEl.textContent = summary;
  } else {
    sumEl.style.display = 'none';
  }

  // Pre-fill if driver already submitted an offer
  var existing = _myOffers && currentRideId ? _myOffers[rideId] : null;
  var _outd = !!(existing && existing.outdated);
  var _ob=document.getElementById('offer-outd'); if(_ob) _ob.innerHTML=_outd?_outdBannerHtml(existing, true):'';
  var _ot=document.querySelector('#m-submit-offer .modal-title'); if(_ot) _ot.textContent=_outd?'Mettre à jour mon offre':'Soumettre une offre';
  if(_outd) existing = Object.assign({}, existing, { _edit:true });
  document.getElementById('offer-price').value = existing ? existing.price : '';
  document.getElementById('offer-msg').value   = existing ? (existing.msg||'') : '';
  _offerNetUpdate();
  document.getElementById('offer-err').classList.remove('show');
  // Disable price and message fields if offer already submitted (cannot be modified)
  var priceEl = document.getElementById('offer-price');
  var msgEl   = document.getElementById('offer-msg');
  // Offre en attente : modifiable et retirable tant que le client ne l'a pas acceptée (contrôlé par le serveur)
  var _lock = !!existing && !_outd && existing.status==='accepted';
  var _edit = !!existing && !_outd && !_lock;
  if(_edit && _ot) _ot.textContent='Modifier mon offre';
  var _sb=document.getElementById('btn-offer-submit'); if(_sb && !_outd) _sb.textContent=_edit?'Mettre à jour →':'Soumettre →';
  var _wd=document.getElementById('btn-offer-withdraw'); if(_wd) _wd.style.display=(existing && !_lock)?'':'none';
  if(priceEl){ priceEl.disabled = _lock; priceEl.style.opacity = _lock ? '0.5' : ''; priceEl.style.cursor = _lock ? 'not-allowed' : ''; }
  if(msgEl){   msgEl.disabled   = _lock; msgEl.style.opacity   = _lock ? '0.5' : ''; msgEl.style.cursor   = _lock ? 'not-allowed' : ''; }
  // Km inclus fields (disposal ride / disposal segments of a mixed ride)
  _renderOfferKmFields(rideObj, existing);
  // Hide submit button if offer already submitted (submitted offers cannot be modified)
  var offerBtnWrap = document.getElementById('offer-btn-wrap');
  if(offerBtnWrap){ offerBtnWrap.style.display = _lock ? 'none' : ''; }
  // Populate vehicle selector based on requested vehicle class
  var reqClass=(rideObj&&rideObj.vehicle_type)||'lowcost';
  if(isDriverRole()&&!_lock){
    // Always show vehicle selector for drivers
    var vwrap=document.getElementById('offer-vehicle-wrap');if(vwrap)vwrap.style.display='block';
    // Ensure vehicles are loaded
    if(_fleetVehicles.length===0&&sb&&currentUser){
      sb.from('fleet_vehicles').select('*').eq('fleet_id',currentUser.id).eq('active',true).then(function(res){
        _fleetVehicles=res.data||[];
        populateOfferVehicles(reqClass, rideObj&&rideObj.passengers);
        _offerPickVehicle(existing);
      });
    } else {
      populateOfferVehicles(reqClass, rideObj&&rideObj.passengers);
      _offerPickVehicle(existing);
    }
  } else {
    var vwrap=document.getElementById('offer-vehicle-wrap');if(vwrap)vwrap.style.display='none';
  }
  openModal('m-submit-offer');
  if(typeof resetOfferBtn==='function') resetOfferBtn();
};


function renderMkItem(r,isSub,isMine){
  isSub=isSub||false; isMine=isMine||false;
  var label=isMine?t('mk_sub_label'):(isSub?t('mk_sub_label'):t('mk_client_label'));
  var tagCls=isMine?'sub':(isSub?'sub':'client');
  var safeR=JSON.stringify(r).replace(/'/g,'&#39;');

  // Button / status
  var offerBtn='';
  if(isSub && !isMine){
    var subPrice = r.final_price ? parseFloat(r.final_price).toFixed(0)+'€' : '';
    offerBtn='<button class="btn btn-green" style="min-width:160px;justify-content:center;" onclick="event.stopPropagation();acceptSubcontract(this.dataset.rid)" data-rid="'+r.id+'">Accepter'+(subPrice?' '+subPrice:'')+'</button>';
  } else if(isMine && r.driver_id && (r.status==='confirmed'||r.status==='active') && (r.on_way_at||r.pickup_at||r.status==='active')){
    offerBtn='<button class="btn btn-green" style="min-width:120px;justify-content:center;" onclick="event.stopPropagation();openLiveTracking(\''+String(r.id).replace(/'/g,'')+'\')">'+t('app.suivre')+'</button>';
  } else if(!isSub && !isMine){
    var myOffer = _myOffers && _myOffers[r.id];
    if(myOffer){
      offerBtn='';
    } else {
      offerBtn='<button class="btn btn-green" style="min-width:160px;justify-content:center;" onclick="event.stopPropagation();_mkOffer(this)">'+t('btn_offer')+'</button>';
    }
  }

  // Title format
  var mkTitleText;
  if(r.trip_type==='disposal'){
    var dispDur='';
    if(r.notes){var dm=r.notes.match(/Dur\u00e9e:([^\s|,]+)/);if(dm)dispDur=dm[1]+'h';}
    mkTitleText=(cleanAddr(r.from_address)||'\u2014')+' \u2192 '+(dispDur||'Disposition');
  } else if(r.trip_type==='mixed'){
    mkTitleText=(cleanAddr(r.from_address)||'\u2014')+' \u2192 Course mixte';
  } else {
    mkTitleText=(cleanAddr(r.from_address)||'\u2014')+' \u2192 '+(r.to_address||'\u2014');
  }

  // 3. Offer text under date if offer submitted
  var myOff2 = _myOffers && _myOffers[r.id];
  var offerLine = myOff2 && myOff2.outdated
    ? '<div style="font-size:11.5px;color:var(--red);font-weight:600;margin-top:3px;">'+t('app.demande_modifiee_votre_offre_est')+'</div>'
    : myOff2
    ? '<div style="font-size:11.5px;color:#E8820C;font-weight:500;margin-top:3px;">'+t('app2.vous_avez_soumis_une_offre')+' '+parseFloat(myOff2.price).toFixed(0)+t('app2.pour_cette_course')+'</div>'
    : '';

    var rDate2=r.ride_date?new Date(r.ride_date+'T00:00:00'):null;
  var dayNum=rDate2?rDate2.getDate().toString().padStart(2,'0'):'--';
  var monStr=rDate2?rDate2.toLocaleDateString('fr-FR',{month:'short'}).toUpperCase().replace('.',''):'';
  var offerCnt2=r._offerCount||0;
  var statusPill=(r.no_show_at?_noShowPill()+' ':'')+(_chgPending(r)?_chgConfirmedPill(r):getStatusPill(r.status,offerCnt2)+_chgPill(r));
  var tLabel=r.status==='personal'?'Personnel':r.trip_type==='disposal'?'Disp.':r.trip_type==='mixed'?'Mixte':'A→B';
  var tColor=r.status==='personal'?'#6750A4':r.trip_type==='disposal'?'var(--amber)':r.trip_type==='mixed'?'var(--blue)':'var(--green)';
  var tBg=r.status==='personal'?'#E8DEF8':r.trip_type==='disposal'?'var(--amber-bg)':r.trip_type==='mixed'?'var(--blue-bg)':'var(--green-bg)';
  // Subcontract indicator for marketplace
  var mkSubBadge=(isSub||r.is_subcontract)?'<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--amber-bg);color:var(--amber);margin-left:2px;flex-shrink:0;" title="'+t('app.sous_traitee')+'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>':'';
  return '<div class="ride-card" onclick="openRideDetail(this)" data-ride=\''+safeR.replace(/\'/g,'&#39;')+'\'>'
    +'<div class="ride-card-date-col"><div class="ride-card-date-month">'+monStr+'</div><div class="ride-card-date-day">'+dayNum+'</div>'+(r.ride_time?'<div class="ride-card-date-time">'+String(r.ride_time).slice(0,5)+'</div>':'')+'</div>'
    +'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:'+tBg+';color:'+tColor+';padding:2px 7px;border-radius:20px;">'+tLabel+'</span>'+mkSubBadge+'</div>'
    +'<div><div class="ride-card-col-label">'+t('app.origine')+'</div><div class="ride-card-col-val">'+(cleanAddr(r.from_address)||'—')+'</div></div>'
    +'<div><div class="ride-card-col-label">'+t('app.destination')+'</div><div class="ride-card-col-val">'+(r.to_address||'—')+'</div></div>'
    +'<div>'+statusPill+'</div>'
    +'<div style="text-align:right;">'+offerBtn+'</div>'
    +'<svg class="ride-card-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  +'</div>';
}

window._mkOffer = function(btn){
  var card=btn.closest('.ride-card');
  if(!card) return;
  var r; try{ r=JSON.parse(card.dataset.ride.replace(/&#39;/g,"'")); }catch(e){ return; }
  openOfferModal(r.id, '', r);
};

window._offerSubmittedClick = function(btn){
  // Click on "Offre soumise" pill - open edit modal
  var card=btn.closest('.mk-item');
  if(!card) return;
  var r; try{ r=JSON.parse(card.dataset.ride.replace(/&#39;/g,"'")); }catch(e){ return; }
  // Open edit modal pre-filled
  currentRideId = r.id;
  openOfferModal(r.id, '', r);
};







