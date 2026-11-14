// ── NAVIGATION ────────────────────────────────────────
window.showPage = function(pageId){
  if(document.querySelector('.modal-overlay.rd-panel.open')){ _rdHist=false; _rdHideAll(); try{ if(history.state&&history.state.rd) history.replaceState(null,'',location.pathname+location.search); }catch(e){} }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + pageId);
  if(!pg) return;
  pg.classList.add('active');

  const pageNames = { dashboard:t('dashboard'), rides:t('rides'), calendar:'Calendrier', 'd-calendar':'Calendrier', invoices:t('invoices'),
    profile:t('profile'), 'd-dashboard':t('d-dashboard'), marketplace:t('marketplace'), missions:t('missions'),
    'd-invoices':'Factures', 'passengers':'Passagers',
    'admin-fleets':'Fleets', 'admin-clients':'Clients', 'admin-dashboard':'Tableau de bord', 'admin-rides':'Courses', 'admin-billing':'Facturation', 'admin-reports':'Rapports', 'admin-stats':'Statistiques', 'admin-issues':'Signalements', 'admin-campaigns':'Campagnes e-mail', 'admin-settings':'Réglages' };
  var ptEl=document.getElementById('page-title');if(ptEl)ptEl.textContent=pageNames[pageId]||'';
  var piEl=document.getElementById('page-title-icon');if(piEl){var _srcIc=pg.querySelector('.pg-head-icon');piEl.innerHTML=_srcIc?_srcIc.innerHTML:'';piEl.classList.toggle('has-icon',!!_srcIc);}

  // Mark nav item active
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
  document.getElementById('sidebar').classList.remove('open');

  // Load page data
  loadPageData(pageId);
};

// ── PAGE DATA ─────────────────────────────────────────
// Code de l'administration (admin.js) : chargé seulement quand un admin ouvre une page d'admin
var _adminP=null;
function _withAdmin(fn){
  if(!_adminP) _adminP=new Promise(function(res,rej){
    if(window._adminLoaded) return res();
    var s=document.createElement('script'); s.src='admin.js?v=__V__';
    s.onload=function(){ res(); }; s.onerror=function(){ _adminP=null; rej(new Error('admin.js introuvable')); };
    document.head.appendChild(s);
  });
  return _adminP.then(fn);
}
async function loadPageData(pageId){
  _loadRefundRules();
  if(currentUser?.email===ADMIN_EMAIL) _withAdmin(function(){ _refreshAdminFleetsBadge(); });
  switch(pageId){
    case 'dashboard':     await loadClientDashboard(); break;
    case 'rides':         await loadRides(); break;
    case 'invoices':      await loadInvoices(); break;
    case 'd-dashboard':   await loadDriverDashboard(); break;
    case 'd-calendar':  if(typeof loadDriverCalendar==='function') await loadDriverCalendar(true); break;
    case 'marketplace':   await loadMarketplace(); break;
    case 'missions':      await loadMissions(); break;
    case 'calendar':    loadCalendar(); break;
    case 'd-calendar':  loadDriverCalendar(); break;
    case 'profile':       loadProfileForm(); break;
    case 'admin-fleets':   await _withAdmin(function(){ return loadAdminFleets(); }); break;
    case 'admin-clients':  await _withAdmin(function(){ return loadAdminClients(); }); break;
    case 'admin-dashboard': await _withAdmin(function(){ return loadAdminDashboard(); }); break;
    case 'passengers':    await loadPassengersList(); break;
    case 'd-invoices':    await loadDriverInvoices(); break;
    case 'admin-rides':    await _withAdmin(function(){ return loadAdminRides(); }); break;
    case 'admin-billing':  await _withAdmin(function(){ return loadAdminBilling(); }); break;
    case 'admin-reports':  await _withAdmin(function(){ return loadAdminReports(); }); break;
    case 'admin-stats':    await _withAdmin(function(){ return loadAdminStats(); }); break;
    case 'admin-issues':   await _withAdmin(function(){ return loadAdminIssues(); }); break;
    case 'admin-campaigns': await _withAdmin(function(){ return loadAdminCampaigns(); }); break;
    case 'admin-settings': await _withAdmin(function(){ return loadAdminSettings(); }); break;
  }
}

// CLIENT DASHBOARD
async function loadClientDashboard(){
  if(window._chgExpire) _chgExpire();
  if(!sb && localStorage.getItem(DEMO_MODE_KEY) !== '1') return;
  const uid = currentUser?.id;
  let rides = [];

  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    // Step 1: fetch rides
    const { data: rideData, error: rideErr } = await sb
      .from('rides').select('*')
      .eq('client_id', uid)
      .order('ride_date',{ascending:false})
      .order('ride_time',{ascending:false});
    if(rideErr){ console.error('rides error:', rideErr.message, rideErr.code); }
    rides = rideData || [];

    // Auto-cancel overdue pending rides (waiting/offers past start time)
    var pendingToCancel=rides.filter(function(r){return r.status==='waiting'||r.status==='offers';});
    if(pendingToCancel.length>0){
      await _autoCancelOverdueRides(pendingToCancel);
      // Re-fetch rides
      var rr=await sb.from('rides').select('*').eq('client_id', uid).order('ride_date',{ascending:false}).order('ride_time',{ascending:false});
      rides=rr.data||[];
    }

    // Auto-complete overdue confirmed rides
    var confirmedToComplete=rides.filter(function(r){return r.status==='confirmed';});
    if(confirmedToComplete.length>0){
      await _autoCompleteOverdueRides(confirmedToComplete);
      var rr2=await sb.from('rides').select('*').eq('client_id', uid).order('ride_date',{ascending:false}).order('ride_time',{ascending:false});
      rides=rr2.data||[];
    }

    await _mergeRidePrivate(rides);

    // Step 2: fetch offer counts and min price (separate query avoids RLS join issues)
    if(rides.length > 0){
      const ids = rides.map(r => r.id);
      const { data: ofData, error: ofErr } = await sb
        .from('offers').select('ride_id, price').eq('status','pending').in('ride_id', ids);
      if(!ofErr && ofData){
        const cnt = {};
        const minP = {};
        ofData.forEach(o => {
          cnt[o.ride_id] = (cnt[o.ride_id]||0)+1;
          if(o.price != null && (minP[o.ride_id] == null || o.price < minP[o.ride_id])) minP[o.ride_id] = o.price;
        });
        rides.forEach(r => { r._offerCount = cnt[r.id]||0; r._minOfferPrice = minP[r.id]||null; });
      }
    }
  } else {
    rides = getDemoRides();
    rides.forEach(r => { r._offerCount = r.offers?.[0]?.count||0; });
  }

  // Stats


    var _mkI=function(s,bg){return '<div class="stat-card-icon" style="background:'+bg+'">'+s+'</div>';};
  var _s1='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>';
  var _s2='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  var _s3='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
  var _s4='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 6.5A7 7 0 1018.5 17.5"/><path d="M4 10.5h10M4 13.5h10"/></svg>';
  var confirmed=rides.filter(function(r){return r.status==='confirmed'||r.status==='active'||r.status==='done'||r.status==='pending_payment';}).length;
  var pending=rides.filter(function(r){return r.status==='waiting';}).length;
  // Nombre total d'offres en attente sur les demandes ouvertes (pas le nombre de demandes)
  var withOffer=rides.filter(function(r){return r.status==='offers'||r.status==='waiting';}).reduce(function(n,r){return n+(r._offerCount||0);},0);
  // Une course payée est comptabilisée une fois pour toutes : confirmée, en chemin, en cours ou terminée
  var total=rides.filter(function(r){return (r.status==='confirmed'||r.status==='active'||r.status==='done')&&!r.is_subcontract;}).reduce(function(s,r){return s+(r.final_price?parseFloat(r.final_price):0);},0);
  // Cancelled non-refundable: client paid and won't get refund → include in total payé
  var paidCancelled=rides.filter(function(r){return r.status==='cancelled'&&r.final_price&&r.payment_method==='non_refundable';}).reduce(function(s,r){return s+parseFloat(r.final_price);},0);
  // Refunded: was charged but refunded → deduct from total payé
  var refunded=rides.filter(function(r){return r.status==='cancelled'&&r.payment_method==='refunded'&&r.final_price;}).reduce(function(s,r){return s+parseFloat(r.final_price);},0);
  // bank_transfer/stripe cancelled but NOT yet refunded (remboursement en attente) → don't count as paid yet, money not confirmed lost
  var totalNet = total + paidCancelled; // refunded already excluded (those rides have payment_method='refunded', not in done/confirmed)
  // Carte verte : courses confirmées à venir s'il y en a, sinon courses terminées
  var _nConf=rides.filter(function(r){return r.status==='confirmed';}).length;
  document.getElementById('client-stats').innerHTML=
    '<div class="stat-card sc sc-g" onclick="_goRides(\''+(_nConf>0?'confirmed':'done')+'\')" style="cursor:pointer;" title="'+(_nConf>0?'Voir mes courses confirmées':'Voir mes courses terminées')+'">'+_mkI('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6a2 2 0 012-1.5h10A2 2 0 0119 7l2 6v4H3z"/><circle cx="7.5" cy="13.5" r=".9"/><circle cx="16.5" cy="13.5" r=".9"/></svg>','none')+'<div class="stat-label">'+t('app.confirmees_terminees')+'</div><div class="stat-val">'+confirmed+'</div></div>'
    +'<div class="stat-card sc sc-o" onclick="_goRides(\'waiting\')" style="cursor:pointer;" title="'+t('app.voir_mes_demandes_en_attente')+'">'+_mkI(_s2,'none')+'<div class="stat-label">'+t('app.en_attente')+'</div><div class="stat-val">'+pending+'</div></div>'
    +'<div class="stat-card sc sc-b" onclick="_goRides(\'offers\')" style="cursor:pointer;" title="'+t('app.voir_mes_demandes_avec_offres')+'">'+_mkI(_s3,'none')+'<div class="stat-label">'+t('app.offres_recues')+'</div><div class="stat-val">'+withOffer+'</div></div>'
    +'<div class="stat-card sc sc-r" onclick="showPage(\'invoices\')" style="cursor:pointer;" title="'+t('app.voir_mes_factures')+'">'+_mkI('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6.5A6 6 0 007.5 9M17 17.5A6 6 0 017.5 15M5 10.5h8M5 13.5h8"/></svg>','none')+'<div class="stat-label">'+t('app2.total_paye')+'</div><div class="stat-val stat-money">'+(totalNet>0?totalNet.toFixed(2).replace('.',',')+' \u20ac':'0 \u20ac')+'</div></div>';

  // Pastille « Mes demandes » : courses confirmées pas encore terminées (diminue à chaque course terminée)
  try{ var _bc=rides.filter(function(r){ return r.status==='confirmed'||r.status==='active'; }).length, _bE=document.getElementById('badge-rides');
    if(_bE){ _bE.textContent=_bc>99?'99+':String(_bc); _bE.style.display=_bc?'':'none'; }
    var _fN=document.getElementById('rf-conf-n'); if(_fN) _fN.textContent=_bc?' ('+_bc+')':''; }catch(_e){}
  // Rides in progress (driver on the way or pick-up done) — same block as the driver dashboard
  var _inProgress = function(r){ return r.status==='active' || (r.status==='confirmed' && r.on_way_at); };
  _renderDriverActiveRides(rides.filter(_inProgress), 'active-ride-wrap', true);

  // Non-terminated rides sorted by ride_date asc for dashboard (oldest first), max 3 (rides in progress shown above)
  // Événements : une seule ligne par événement (tous ses véhicules), affichée tant qu'un véhicule reste à venir
  // Seules les demandes encore en cours (en attente d'offres, offres reçues, paiement à faire) ; les confirmées sont dans la carte « Confirmées »
  const _open = function(r){ return ['waiting','offers','pending_payment'].indexOf(r.status)>=0 && !_inProgress(r); };
  const recent = _groupEvents(rides.slice().sort(_byNewest)).filter(function(x){ return x._evt ? x.rides.some(_open) : _open(x); }).slice(0, 3);

  document.getElementById('recent-rides-list').innerHTML = recent.length
    ? recent.map(_renderListItem).join('')
    : '<div class="empty-state"><p class="empty-text">'+t('empty_rides')+'</p></div>';
}

// CLIENT RIDES
async function loadRides(filter){
  if(window._chgExpire) _chgExpire();
  // Sans filtre explicite (ouverture de la page, mise à jour en direct) : on garde le filtre sélectionné
  if(filter===undefined){ var _act=document.querySelector('#rides-filters .btn-primary'); var _fm=_act&&(_act.getAttribute('onclick')||'').match(/filterRides\('(\w+)'/); filter=_fm?_fm[1]:'all'; }
  const uid = currentUser?.id;
  let rides = [];

  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    var q = sb.from('rides').select('*').eq('client_id', uid)
      .order('ride_date',{ascending:false}).order('ride_time',{ascending:false});
    if(filter !== 'all') q = q.eq('status', filter);
    var res = await q;
    if(res.error) console.error('loadRides error:', res.error);
    rides = res.data || [];
    await _mergeRidePrivate(rides);
    // Fetch offer counts separately
    if(rides.length > 0){
      var ids = rides.map(function(r){ return r.id; });
      var oRes = await sb.from('offers').select('ride_id').eq('status','pending').in('ride_id', ids);
      if(!oRes.error && oRes.data){
        var cnt = {};
        oRes.data.forEach(function(o){ cnt[o.ride_id]=(cnt[o.ride_id]||0)+1; });
        rides.forEach(function(r){ r.offers=[{count:cnt[r.id]||0}]; });
      }
    }
  } else {
    rides = getDemoRides().filter(function(r){ return filter==='all'||r.status===filter; });
  }

  rides.sort(_byNewest); // most recent first
  // Map offer counts
  if(typeof rides[0] !== 'undefined') rides.forEach(function(r){ r._offerCount = r._offerCount!==undefined?r._offerCount:(r.offers&&r.offers[0]?parseInt(r.offers[0].count)||0:0); });
  document.getElementById('all-rides-list').innerHTML = rides.length
    ? _groupEvents(rides).map(_renderListItem).join('')
    : '<div class="empty-state"><p class="empty-text">'+t('empty_rides')+'</p></div>';
}

// INVOICES
var _invoiceAllRides = {};
var _invoiceMonthKeys = [];
var _invoiceCurrentIdx = 0;
var _invoiceSelMonth = new Date().getMonth() + 1; // 1-12
var _invoiceSelYear  = new Date().getFullYear();

async function loadInvoices(){
  var listEl = document.getElementById('invoices-list');
  listEl.innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';

  var rides = [];
  if(sb && !localStorage.getItem(DEMO_MODE_KEY)){
    const [doneRes, cancelledRes] = await Promise.all([
      sb.from('rides').select('id,booking_code,from_address,to_address,trip_type,ride_date,ride_time,final_price,status,notes,is_subcontract').eq('client_id', currentUser.id).eq('status','done').order('ride_date',{ascending:false}),
      sb.from('rides').select('id,booking_code,from_address,to_address,trip_type,ride_date,ride_time,final_price,status,notes,payment_method,is_subcontract').eq('client_id', currentUser.id).eq('status','cancelled').not('final_price','is',null).order('ride_date',{ascending:false})
    ]);
    rides = [...(doneRes.data||[]), ...((cancelledRes.data||[]).filter(r=>r.payment_method&&r.payment_method!=='refunded'))];
    rides = rides.filter(function(r){ return !r.is_subcontract; }); // sous-traitances : hors facturation
    rides.sort(_byNewest);
  } else {
    rides = getDemoRides().filter(r => r.status === 'done' || (r.status==='cancelled'&&r.final_price));
  }

  // Group by YYYY-MM
  var months = {};
  rides.forEach(function(r){
    var k = (r.ride_date||'').slice(0,7);
    if(!k) return;
    if(!months[k]) months[k] = [];
    months[k].push(r);
  });

  _invoiceAllRides = months;
  _invoiceMonthKeys = Object.keys(months).sort().reverse();

  // Default to most recent month with data, or current month
  if(_invoiceMonthKeys.length){
    var first = _invoiceMonthKeys[0].split('-');
    _invoiceSelYear  = parseInt(first[0]);
    _invoiceSelMonth = parseInt(first[1]);
  }

  _renderInvoiceMonth();
}

function _invoiceKey(){ return _invoiceSelYear+'-'+String(_invoiceSelMonth).padStart(2,'0'); }
// Sélection de courses à facturer (vide = tout le mois)
var _invSel = {}, _invSelKey = '';
window._invToggle = function(id, on){ if(on) _invSel[id]=1; else delete _invSel[id]; _invSelUi(); };
window._invToggleAll = function(on){ var k=_invoiceKey(); _invSel={}; if(on) (_invoiceAllRides[k]||[]).forEach(function(r){ _invSel[r.id]=1; }); document.querySelectorAll('#invoices-list .inv-ck').forEach(function(c){ c.checked=on; }); _invSelUi(); };
function _invSelUi(){
  var n=Object.keys(_invSel).length, all=(_invoiceAllRides[_invoiceKey()]||[]).length;
  var b=document.getElementById('inv-pdf-lbl'); if(b) b.textContent=n?'PDF ('+n+')':'PDF';
  var a=document.getElementById('inv-ck-all'); if(a){ a.checked=n>0&&n===all; a.indeterminate=n>0&&n<all; }
  var h=document.getElementById('inv-sel-hint'); if(h) h.textContent=n?n+' course'+(n>1?'s':'')+' sélectionnée'+(n>1?'s':'')+' — le PDF ne reprendra que celle'+(n>1?'s-ci':'-ci')+'.':'Cochez une ou plusieurs courses pour ne télécharger que celles-ci.';
}

function _renderInvoiceMonth(){
  var listEl = document.getElementById('invoices-list');
  if(!listEl) return;

  var key = _invoiceKey();
  var monthRides = _invoiceAllRides[key] || [];
  if(_invSelKey !== key){ _invSel = {}; _invSelKey = key; }
  var monthLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var monthShort  = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];

  // Year range: from earliest data or current-3 to current+1
  var dataMinYear = _invoiceMonthKeys.length ? parseInt(_invoiceMonthKeys[_invoiceMonthKeys.length-1].slice(0,4)) : new Date().getFullYear();
  var minYear = Math.min(dataMinYear, _invoiceSelYear, new Date().getFullYear() - 2);
  var maxYear = Math.max(new Date().getFullYear() + 1, _invoiceSelYear);
  var yearOpts = '';
  for(var y=maxYear; y>=minYear; y--){
    yearOpts += '<option value="'+y+'"'+(_invoiceSelYear===y?' selected':'')+'>'+y+'</option>';
  }
  var monthOpts = monthLabels.map(function(ml,i){
    return '<option value="'+(i+1)+'"'+(_invoiceSelMonth===i+1?' selected':'')+'>'+ml+'</option>';
  }).join('');

  var btnStyle = 'background:none;border:1.5px solid var(--sand3);border-radius:6px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:inherit;';
  var selStyle = 'font-size:13px;font-weight:600;border:1.5px solid var(--sand3);border-radius:6px;padding:3px 6px;background:var(--white);cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--ink);';

  var header = '<div class="card-hd" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">'
    +'<div style="display:flex;align-items:center;gap:6px;">'
      +'<button onclick="_invoiceStep(-1)" style="'+btnStyle+'">&lt;</button>'
      +'<select onchange="_invoiceSetMonth(parseInt(this.value))" style="'+selStyle+'">'+monthOpts+'</select>'
      +'<select onchange="_invoiceSetYear(parseInt(this.value))" style="'+selStyle+'">'+yearOpts+'</select>'
      +'<button onclick="_invoiceStep(1)" style="'+btnStyle+'">&gt;</button>'
    +'</div>'
    +(monthRides.length
      ? '<button class="btn btn-secondary btn-sm" style="display:flex;align-items:center;gap:5px;flex-shrink:0;" onclick="generateMonthInvoice(\''+key+'\', Object.keys(_invSel))">'
          +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg><span id="inv-pdf-lbl">PDF</span></button>'
      : '')
  +'</div>';

  if(!monthRides.length){
    listEl.innerHTML = '<div class="card" style="padding:0;">'+header
      +'<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px;">'+t('app.aucune_donnee')+'</div>'
    +'</div>';
    return;
  }

  var rows = monthRides.map(function(r){
    var htva = r.final_price ? parseFloat((parseFloat(r.final_price)/(1+TVA_RATE)).toFixed(2)) : 0;
    var code = r.booking_code || r.id.slice(0,8);
    var from = cleanAddr(r.from_address||'—');
    var to   = r.to_address||'—';
    // Build route label with disposal duration
    var dispDur = '';
    if(r.trip_type==='disposal'){
      var durMatch = (r.notes||'').match(/Durée:([^\s|,]+)/);
      var durRaw = durMatch ? durMatch[1].replace(/h$/,'') : '';
      dispDur = durRaw ? ' '+durRaw+'h' : '';
    }
    var route = r.trip_type==='disposal' ? from+' (Disp.'+dispDur+')' : from+' → '+to;
    // Date + time
    var timeStr = r.ride_time ? r.ride_time.slice(0,5) : '';
    var dateTimeStr = formatDate(r.ride_date||'')+(timeStr?' · '+timeStr:'');
    var statusBadge = r.status==='cancelled'
      ? '<span style="font-size:9px;font-weight:700;background:var(--red-bg);color:var(--red);padding:1px 6px;border-radius:20px;margin-left:6px;">'+t('app.annulee')+'</span>'
      : '';
    return '<label class="inv-row" style="display:grid;grid-template-columns:20px minmax(0,130px) 1fr auto;gap:6px 12px;align-items:start;padding:10px 0;border-bottom:1px solid var(--sand2);cursor:pointer;">'
      +'<input type="checkbox" class="inv-ck" style="width:17px;height:17px;margin:1px 0 0;accent-color:var(--green);cursor:pointer;"'+(_invSel[r.id]?' checked':'')+' onchange="_invToggle(\''+r.id+'\',this.checked)">'
      +'<div style="font-size:11px;font-family:monospace;font-weight:600;color:var(--ink2);padding-top:2px;word-break:break-all;">'+code+'</div>'
      +'<div>'
        +'<div style="font-size:12.5px;color:var(--ink3);margin-bottom:1px;">'+dateTimeStr+statusBadge+'</div>'
        +'<div style="font-size:12.5px;color:var(--ink);">'+route+'</div>'
      +'</div>'
      +'<div style="text-align:right;white-space:nowrap;">'
        +'<div style="font-size:13px;font-weight:600;">'+htva.toFixed(2).replace('.',',')+' €</div>'
        +'<div style="font-size:11px;color:var(--ink3);">TVA '+((r.final_price?parseFloat(r.final_price):0)-htva).toFixed(2).replace('.',',')+' €</div>'
      +'</div>'
    +'</label>';
  }).join('');

  var totalHtva = monthRides.reduce(function(s,r){ return s+(r.final_price?parseFloat((parseFloat(r.final_price)/(1+TVA_RATE)).toFixed(2)):0); },0);
  var totalTvac = monthRides.reduce(function(s,r){ return s+(r.final_price?parseFloat(r.final_price):0); },0);
  var totalTva  = totalTvac - totalHtva;
  var fmt = function(v){ return v.toFixed(2).replace('.',',')+' €'; };

  listEl.innerHTML = '<div class="card" style="padding:0;">'
    +header
    +'<div id="inv-sel-hint" style="padding:8px 20px 0;font-size:12px;color:var(--ink3);"></div>'
    +'<div style="display:grid;grid-template-columns:20px minmax(0,130px) 1fr auto;gap:4px 12px;align-items:center;padding:6px 20px;border-bottom:2px solid var(--sand3);">'
      +'<input type="checkbox" id="inv-ck-all" title="'+t('app.tout_selectionner')+'" style="width:17px;height:17px;margin:0;accent-color:var(--green);cursor:pointer;" onchange="_invToggleAll(this.checked)">'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.code')+'</div>'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.trajet')+'</div>'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);text-align:right;">'+t('app.prix_htva')+'</div>'
    +'</div>'
    +'<div style="padding:0 20px;">'+rows+'</div>'
    +'<div style="padding:8px 20px 14px;border-top:1px solid var(--sand2);margin-top:4px;">'
      +'<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink3);padding:3px 0;"><span>'+t('app.sous_total_htva')+'</span><span>'+fmt(totalHtva)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink3);padding:3px 0;"><span>TVA 6%</span><span>'+fmt(totalTva)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:7px 0 2px;border-top:1.5px solid var(--sand3);margin-top:4px;"><span>'+t('app.total_tvac')+'</span><span>'+fmt(totalTvac)+'</span></div>'
    +'</div>'
  +'</div>';
  _invSelUi();
}

window._invoiceSetMonth = function(m){ _invoiceSelMonth = m; _renderInvoiceMonth(); };
window._invoiceSetYear  = function(y){ _invoiceSelYear  = y; _renderInvoiceMonth(); };
window._invoiceStep = function(dir){
  // dir: -1 = one month into the past, +1 = one month into the future
  _invoiceSelMonth += dir;
  if(_invoiceSelMonth < 1){ _invoiceSelMonth = 12; _invoiceSelYear--; }
  if(_invoiceSelMonth > 12){ _invoiceSelMonth = 1;  _invoiceSelYear++; }
  _renderInvoiceMonth();
};

// Keep old nav functions as aliases
window._invoiceNav = function(dir){ window._invoiceStep(dir); };
window._invoiceGoTo = function(idx){ _invoiceCurrentIdx = parseInt(idx); _renderInvoiceMonth(); };

window.generateMonthInvoice = async function(monthKey, onlyIds){
  // Client space: one invoice per fleet (the fleet invoices the client)
  if(!sb || localStorage.getItem(DEMO_MODE_KEY)){ showToast(t('app.indisponible_en_mode_demo')); return; }
  var from=monthKey+'-01';
  var d=new Date(parseInt(monthKey.slice(0,4)), parseInt(monthKey.slice(5,7)), 0);
  var to=monthKey+'-'+String(d.getDate()).padStart(2,'0');
  var res=await Promise.all([
    sb.from('rides').select('*').eq('client_id', currentUser.id).eq('status','done').gte('ride_date',from).lte('ride_date',to).order('ride_date',{ascending:true}),
    sb.from('rides').select('*').eq('client_id', currentUser.id).eq('status','cancelled').not('final_price','is',null).gte('ride_date',from).lte('ride_date',to).order('ride_date',{ascending:true})
  ]);
  var rides=(res[0].data||[]).concat((res[1].data||[]).filter(function(r){ return r.payment_method && r.payment_method!=='refunded'; }));
  rides=rides.filter(function(r){ return !r.is_subcontract; }); // sous-traitances : hors facturation
  if(onlyIds && onlyIds.length) rides=rides.filter(function(r){ return onlyIds.indexOf(r.id)>=0; });   // courses cochées
  rides.sort(function(a,b){ return (a.ride_date||'').localeCompare(b.ride_date||''); });
  var people={}; if(currentProfile) people[currentUser.id]=Object.assign({email:currentUser.email},currentProfile);
  _invOpen({ rides:rides, kind:'prestation', year:parseInt(monthKey.slice(0,4)), month:parseInt(monthKey.slice(5,7)), people:people });
};

// DRIVER DASHBOARD
// ── Auto-complete overdue confirmed rides ──
function _getRideEndTime(r){
  if(!r.ride_date)return null;
  var timeStr=r.ride_time||'00:00';
  // Ensure time format is HH:MM or HH:MM:SS
  if(timeStr.length===5)timeStr+=':00';
  var start=new Date(r.ride_date+'T'+timeStr);
  if(isNaN(start))return null;
  var isMixed=r.trip_type==='mixed';
  var isDisp=r.trip_type==='disposal';
  if(isDisp){
    var dm=r.notes?r.notes.match(/Dur\u00e9e:([^\s|,]+)/):null;
    var hours=dm?parseFloat(dm[1]):2;
    return new Date(start.getTime()+hours*3600000);
  } else if(isMixed){
    var segs=parseMixedNotes(r.notes||'');
    if(segs.length===0)return new Date(start.getTime()+3600000);
    var lastSeg=segs[segs.length-1];
    var lastStart=lastSeg.date&&lastSeg.time?new Date(lastSeg.date+'T'+lastSeg.time+':00'):start;
    if(isNaN(lastStart))lastStart=start;
    var isD=lastSeg.type.toLowerCase().indexOf('disp')>=0;
    if(isD){
      var dur=parseFloat(lastSeg.dur)||2;
      return new Date(lastStart.getTime()+dur*3600000);
    } else {
      return new Date(lastStart.getTime()+1800000);
    }
  } else {
    return new Date(start.getTime()+1800000);
  }
}

async function _autoCompleteOverdueRides(confirmedRides){
  if(!sb||!confirmedRides||confirmedRides.length===0)return;
  var now=new Date();
  var updated=0;
  for(var i=0;i<confirmedRides.length;i++){
    var r=confirmedRides[i];
    var endTime=_getRideEndTime(r);
    // Fallback: if no end time calculable but ride_date is in the past, mark as done
    if(!endTime&&r.ride_date){
      var rideDay=new Date(r.ride_date+'T23:59:59');
      if(now>rideDay)endTime=rideDay;
    }
    if(endTime&&now>endTime){
      try{
        var res=await sb.rpc('api_ride_complete',{ p_ride:r.id });
        if(!res.error && res.data)updated++;
      }catch(e){console.error('auto-complete error:',e);}
    }
  }
  if(updated>0)console.log('[auto-complete]',updated,'ride(s) marked as done');
}

// Auto-cancel overdue rides still in waiting/offers (not confirmed/paid)
async function _autoCancelOverdueRides(pendingRides){
  if(!sb||!pendingRides||pendingRides.length===0)return;
  var now=new Date();
  var cancelled=0;
  for(var i=0;i<pendingRides.length;i++){
    var r=pendingRides[i];
    if(!r.ride_date)continue;
    var timeStr=r.ride_time||'00:00';
    if(timeStr.length===5)timeStr+=':00';
    var rideStart=new Date(r.ride_date+'T'+timeStr);
    if(isNaN(rideStart))continue;
    if(now>rideStart){
      try{
        var res=await sb.rpc('api_ride_expire',{ p_ride:r.id });
        if(!res.error && res.data){ cancelled++; _notifyOfferDriversCancelled(r,'expired'); }
      }catch(e){}
    }
  }
  if(cancelled>0)console.log('[auto-cancel]',cancelled,'overdue pending ride(s) cancelled');
}

// Returns true if the driver (with their fleet vehicles) can handle this ride's vehicle_type
function _driverCanHandleRide(r){
  // No active vehicle: the fleet cannot handle any request, Economy included
  if(!_fleetVehicles || _fleetVehicles.length === 0) return false;
  // Même règle que le serveur (ride_rules.sql) : gamme compatible (« Toute gamme » incluse) et assez de places
  return _fleetVehicles.some(function(v){ return v.status!=='rejected' && _vehFitsRide(v, r.vehicle_type, r.passengers); });
}

// Banner shown to a fleet that is not verified yet
async function _renderDriverVerifyBanner(){
  var el=document.getElementById('driver-verify-banner'); if(!el) return;
  if(!currentProfile || currentUser?.email===ADMIN_EMAIL || localStorage.getItem(DEMO_MODE_KEY)==='1'){ el.style.display='none'; return; }
  // Refresh the status: the admin may have validated the fleet during the session
  if(sb && currentUser?.id){
    try{
      var {data:fv}=await sb.from('profiles').select('fleet_verified').eq('id',currentUser.id).maybeSingle();
      if(fv) currentProfile.fleet_verified=fv.fleet_verified;
    }catch(e){}
  }
  // Compte Stripe (versements automatiques) : obligatoire pour faire une offre (stripe_connect.sql)
  await _loadFleetStripeOk();
  var html='';
  if(currentProfile.fleet_verified!=='validated')
    html+=_fleetBanner(t('app2.votre_compte_nest_pas_encore'), t('app2.pour_recevoir_des_demandes_vous'), t('app2.completer_mon_profil'), "showPage('profile')");
  if(_fleetStripeOk===false)
    html+=_fleetBanner(t('st.banner_title'), _fleetStripePending?t('st.banner_pending'):t('st.banner_text'), t(_fleetStripePending?'st.complete':'st.banner_btn'), "_goStripeProfile()");
  if(!html){ el.style.display='none'; el.innerHTML=''; return; }
  el.innerHTML=html;
  el.style.display='block';
}
function _fleetBanner(title, text, btnLabel, onclick){
  return '<div style="display:flex;align-items:flex-start;gap:14px;padding:16px 18px;margin-bottom:18px;border-radius:14px;background:var(--amber-bg);border:1px solid rgba(180,120,20,.25);">'
    +'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:4px;">'+title+'</div>'
      +'<div style="font-size:13px;color:var(--ink2);line-height:1.55;">'+text+'</div>'
    +'</div>'
    +'<button class="btn btn-primary btn-sm" style="flex-shrink:0;align-self:center;" onclick="'+onclick+'">'+btnLabel+'</button>'
    +'</div>';
}
// null = inconnu (table absente, démo, admin) : rien n'est bloqué côté site, le serveur reste juge
var _fleetStripeOk=null, _fleetStripePending=false;
async function _loadFleetStripeOk(){
  if(!sb || !currentUser?.id || currentRole!=='driver' || currentUser.email===ADMIN_EMAIL || localStorage.getItem(DEMO_MODE_KEY)==='1'){ _fleetStripeOk=null; return; }
  try{
    var r=await sb.from('fleet_stripe').select('payouts_enabled,details_submitted').eq('driver_id',currentUser.id).maybeSingle();
    if(r.error){ _fleetStripeOk=null; return; }
    _fleetStripeOk=!!(r.data&&r.data.payouts_enabled);
    _fleetStripePending=!!(r.data&&r.data.details_submitted&&!r.data.payouts_enabled);
  }catch(e){ _fleetStripeOk=null; }
}
window._goStripeProfile=function(){
  showPage('profile');
  setTimeout(function(){ if(typeof _pfShowTab==='function') _pfShowTab('company'); document.getElementById('pf-stripe-card')?.scrollIntoView({behavior:'smooth',block:'center'}); }, 300);
};
// Avant une offre / une sous-traitance : compte Stripe actif requis
function _stripeGate(){
  if(_fleetStripeOk!==false) return true;
  showToast('⚠️ '+t('st.required'));
  _goStripeProfile();
  return false;
}
// Message d'erreur du serveur « STRIPE_REQUIRED: … » → texte lisible + accès au profil
function _stripeErr(e){
  var m=String((e&&e.message)||e||'');
  if(m.indexOf('STRIPE_REQUIRED')<0) return null;
  _fleetStripeOk=false;
  setTimeout(_goStripeProfile, 1200);
  return t('st.required');
}

// Rides currently in progress (pick-up done) — shown apart from the other requests
