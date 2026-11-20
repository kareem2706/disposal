// ── Partie commune (clients / fleets) — le reste est dans js/admin/25-admin.js (chargé seulement pour l’admin) ──
   // core/billing.ts
function _billingEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var _RPT_MONTHS = ['Janvier','F\u00e9vrier','Mars','Avril','Mai','Juin','Juillet','Ao\u00fbt','Septembre','Octobre','Novembre','D\u00e9cembre'];
// Amounts kept to the 1/1000 (e.g. 9,075 €), shown with 2 decimals, or 3 when needed
// Montants : toujours arrondis au centime (2 décimales), calculs comme affichage
function _rptR3(v){ return Math.round(((v||0)+Number.EPSILON)*100)/100; }
function _rptR2(v){ return Math.round(((v||0)+Number.EPSILON)*100)/100; }
function _rptMoney(v){
  var s=_rptR2(v).toFixed(2);
  return s.replace('.',',')+' €';
}

function _rptRideHtva(r){ return _rptR2(_rideHtva(r)); }

// Bleenr wordmark embedded so the printed invoice never depends on a relative URL
var _BLEENR_LOGO='data:image/png;base64,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';

// ══ Invoice engine shared by the client, fleet and admin spaces ══
//   prestation : the fleet invoices the client (one invoice per fleet + client + month)
//   commission : Bleenr invoices the fleet (one invoice per fleet + month)


// Identity of the parties. RPC invoice_parties lets a client read its fleets (and vice-versa) despite RLS.
async function _invPeople(ids){
  var map={}; ids=ids.filter(Boolean);
  if(!ids.length||!sb) return map;
  try{
    var r=await sb.rpc('invoice_parties',{ p_ids: ids });
    if(!r.error && Array.isArray(r.data)){ r.data.forEach(function(p){ map[p.id]=p; }); }
  }catch(e){}
  var missing=ids.filter(function(id){ return !map[id]; });
  if(missing.length){
    try{
      var q=await sb.from('profiles').select('id,email,role,client_type,company_name,first_name,last_name,vat_number,address_street,address_postal,address_city,address_country').in('id',missing);
      (q.data||[]).forEach(function(p){ map[p.id]=p; });
    }catch(e){}
  }
  return map;
}

// Numéro séquentiel ET montants : attribués par le serveur (fonction invoice_number) à partir des
// courses en base — le navigateur n'envoie plus aucun montant (rien ne peut être falsifié).
async function _invNumber(fleetId, kind, clientId, period){
  try{
    var r=await sb.rpc('invoice_number',{ p_fleet:fleetId, p_client:clientId||null, p_period:period, p_kind:kind });
    if(!r.error && r.data && r.data.number) return { number:r.data.number, srv:r.data };
  }catch(e){}
  // Numéro attribué uniquement par le serveur (fonction invoice_number)
  return { number:'PROVISOIRE', warn:'Numéro de facture non enregistré (fonction invoice_number indisponible) : document provisoire.' };
}

function _invPage(o){
  var e=_billingEsc;
  var rows=o.rows.map(function(r){
    return '<tr><td>'+r.desc+'</td><td class="c">1</td><td class="r">'+_rptMoney(r.unit)+'</td><td class="r">'+_rptMoney(r.unit)+'</td><td class="r">'+_rptMoney(r.vat)+'</td><td class="r b">'+_rptMoney(r.total)+'</td></tr>';
  }).join('');
  return '<div class="page">'
    +(o.warn?'<div class="warn np">'+o.warn+'</div>':'')
    +_docTop(o.title, o.number, ['Date : '+_docDate(), 'Période : '+o.periodRange])
    +'<div class="parties">'+_docParty('Acheteur',o.receiver,false)+_docParty('Vendeur',o.issuer,true)+'</div>'
    +'<table class="lines"><thead><tr><th>Description</th><th class="c">Qté</th><th class="r">Prix unitaire HTVA</th><th class="r">Sous-total</th><th class="r">'+o.vatHead+'</th><th class="r">Total</th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div class="sum"><table>'
      +'<tr><td>Sous-total HTVA</td><td class="r">'+_rptMoney(o.base)+'</td></tr>'
      +'<tr><td>'+o.vatHead+'</td><td class="r">'+_rptMoney(o.vatAmt)+'</td></tr>'
      +'<tr class="grand"><td>Montant total TVAC (EUR)</td><td class="r">'+_rptMoney(o.total)+'</td></tr>'
      +(o.vatNote?'<tr><td colspan="2" class="note">'+o.vatNote+'</td></tr>':'')
    +'</table></div>'
    +'<div class="box"><div class="boxt">'+o.boxTitle+'</div>'+o.boxBody+'</div>'
    +'<div class="foot">'+e(o.footer)+'</div>'
    +'</div>';
}

// o = { rides, kind:'prestation'|'commission', year, month, title, settings?, people? }
async function _invOpen(o){
  var win=window.open('','_blank');
  if(!win){ showToast('Autorisez les fenêtres pop-up pour générer les factures'); return; }
  win.document.write('<p style="font-family:sans-serif;padding:30px;">Génération des factures…</p>');
  try{
    var e=_billingEsc;
    // Mêmes courses que le serveur : terminée / confirmée, ou annulée et non remboursée ; hors sous-traitance
    var rides=(o.rides||[]).filter(function(r){ return r.driver_id && r.final_price && !r.is_subcontract
      && (r.status==='done' || r.status==='confirmed' || (r.status==='cancelled' && r.payment_method && r.payment_method!=='refunded')); });
    var s=o.settings||await _docBilling();
    var cfg=_invCfg(s);
    var people=Object.assign({}, o.people||{});
    var need=[...new Set(rides.map(function(r){return r.driver_id;}).concat(rides.map(function(r){return r.client_id;})))].filter(function(id){ return id && !people[id]; });
    if(need.length) Object.assign(people, await _invPeople(need));
    var p2=function(n){return String(n).padStart(2,'0');};
    var period=o.year+'-'+p2(o.month);
    var lastDay=p2(new Date(o.year,o.month,0).getDate());
    var periodRange='01-'+p2(o.month)+'-'+o.year+' — '+lastDay+'-'+p2(o.month)+'-'+o.year;
    var pLabel=_RPT_MONTHS[o.month-1]+' '+o.year;
    var bleenr=_docBleenrParty(s), footer=_docFooter(s);
    var fleetParty=function(id){ return _docProfileParty(people[id]||{company_name:'Transporteur'}, true); };
    var clientParty=function(id){ var p=people[id]||{first_name:'Client'}; return _docProfileParty(p, p.role==='driver'||p.client_type==='pro'); };
    var rideRow=function(r,vatPct){
      var h=_rptRideHtva(r), v=_rptR3(h*vatPct/100);
      var dur=r.trip_type==='disposal'?((r.notes||'').match(/Durée:(\d+)/)||[])[1]:'';
      return { unit:h, vat:v, total:_rptR3(h+v),
        desc:'<b>'+e(_DOC_TYPES[r.trip_type]||'Course')+(dur?' ('+dur+' h)':'')+'</b> — '+e(r.booking_code||String(r.id).slice(0,8))
          +(r.status==='cancelled'?' <span class="cx">(annulée, non remboursée)</span>':'')
          +'<div class="sub">'+_docIso(r.ride_date)+(r.ride_time?' · '+String(r.ride_time).slice(0,5):'')+' · '+e((r.from_address||'').split(',')[0])+(r.to_address?' → '+e((r.to_address||'').split(',')[0]):'')+'</div>' };
    };
    var pages=[];

    if(o.kind==='prestation'){
      var groups={};
      rides.forEach(function(r){ var k=r.driver_id+'|'+(r.client_id||''); (groups[k]=groups[k]||[]).push(r); });
      var keys=Object.keys(groups).sort();
      for(var i=0;i<keys.length;i++){
        var list=groups[keys[i]], fid=list[0].driver_id, cid=list[0].client_id||null;
        var vatPct=cfg.vatFor((people[fid]||{}).address_country);
        var rows=list.map(function(r){ return rideRow(r,vatPct); });
        var base=_rptR2(rows.reduce(function(a,x){return a+x.unit;},0)), vat=_rptR3(base*vatPct/100), total=_rptR3(base+vat);
        var num=await _invNumber(fid,'prestation',cid,period);
        // Totaux de la facture = montants enregistrés par le serveur
        if(num.srv && !o.partial){ base=Number(num.srv.htva); vatPct=Number(num.srv.vat_rate); vat=Number(num.srv.vat); total=Number(num.srv.tvac); }
        pages.push(_invPage({ title:'Facture de prestation', number:num.number, warn:num.warn, periodRange:periodRange,
          issuer:fleetParty(fid), receiver:clientParty(cid), rows:rows,
          vatHead:'TVA '+vatPct+' %', base:base, vatAmt:vat, total:total,
          boxTitle:'Réglé : '+_rptMoney(total),
          boxBody:'<div>Paiement effectué via la plateforme Bleenr — aucun montant supplémentaire n’est dû.</div>'
            +'<div class="muted">Prestation de transport réalisée par '+e(fleetParty(fid).name)+' via la plateforme Bleenr.</div>',
          footer:footer }));
      }
    } else {
      var byFleet={};
      rides.forEach(function(r){ (byFleet[r.driver_id]=byFleet[r.driver_id]||[]).push(r); });
      var fids=Object.keys(byFleet).sort(function(a,b){ return fleetParty(a).name.localeCompare(fleetParty(b).name); });
      for(var j=0;j<fids.length;j++){
        var fl=byFleet[fids[j]];
        var htva=_rptR2(fl.reduce(function(a,r){return a+_rptRideHtva(r);},0));
        var pv=cfg.vatFor((people[fids[j]]||{}).address_country);
        var pTvac=_rptR3(htva+_rptR3(htva*pv/100));
        var fc=(people[fids[j]]||{}).address_country;
        var cRate=cfg.commFor(fc), cVatR=cfg.cVatFor(fc), cRc=cfg.rcFor(fc);
        var cHt=_rptR3(htva*cRate/100), cVatAmt=_rptR3(cHt*cVatR/100), cTvac=_rptR3(cHt+cVatAmt);
        var numC=await _invNumber(fids[j],'commission',null,period);
        // Totaux de la facture = montants enregistrés par le serveur
        if(numC.srv){ htva=Number(numC.srv.base); cRate=Number(numC.srv.comm_rate); cHt=Number(numC.srv.htva); cVatR=Number(numC.srv.vat_rate);
          cVatAmt=Number(numC.srv.vat); cTvac=Number(numC.srv.tvac); cRc=!!numC.srv.rc; pTvac=_rptR3(htva+_rptR3(htva*pv/100)); }
        pages.push(_invPage({ title:'Facture de commission', number:numC.number, warn:numC.warn, periodRange:periodRange,
          issuer:bleenr, receiver:fleetParty(fids[j]),
          rows:[{ desc:'<b>Commission plateforme ('+cRate+' %)</b><div class="sub">'+fl.length+' course(s) — '+pLabel+' — base HTVA '+_rptMoney(htva)+'</div>', unit:cHt, vat:cVatAmt, total:cTvac }],
          vatHead:'TVA '+cVatR+' %', base:cHt, vatAmt:cVatAmt, total:cTvac, vatNote:cRc?'Autoliquidation de la TVA':'',
          boxTitle:'Retenu : '+_rptMoney(cTvac),
          boxBody:'<div>Montant déduit du versement de la période — aucun virement à effectuer.</div>'
            +'<div class="muted">Prestations TVAC '+_rptMoney(pTvac)+' − commission TVAC '+_rptMoney(cTvac)+' = <b>net versé '+_rptMoney(_rptR3(pTvac-cTvac))+'</b></div>',
          footer:footer }));
      }
    }
    if(!pages.length) pages.push('<div class="page"><div class="box"><div>Aucune course facturée pour '+pLabel+'.</div></div></div>');
    win.document.open(); win.document.write(_bleenrDocHtml(o.title||((o.kind==='prestation'?'Factures de prestation':'Factures de commission')+' — '+pLabel), pages.join(''))); win.document.close();
  }catch(err){
    console.error('invoices', err);
    win.document.open(); win.document.write('<p style="font-family:sans-serif;padding:30px;color:#C0392B;">Erreur : '+_billingEsc(err.message||err)+'</p>'); win.document.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// PASSENGERS (pro clients)
// ═══════════════════════════════════════════════════════════════
var _editPassengerId = null;

var _dInvSelMonth = new Date().getMonth() + 1;
var _dInvSelYear  = new Date().getFullYear();

window._dInvStep = function(dir){
  _dInvSelMonth += dir;
  if(_dInvSelMonth > 12){ _dInvSelMonth = 1; _dInvSelYear++; }
  if(_dInvSelMonth < 1){ _dInvSelMonth = 12; _dInvSelYear--; }
  window._renderDriverInvoiceMonth();
};
window._dInvSetMonth = function(m){ _dInvSelMonth = parseInt(m); window._renderDriverInvoiceMonth(); };
window._dInvSetYear  = function(y){ _dInvSelYear  = parseInt(y); window._renderDriverInvoiceMonth(); };

async function loadDriverInvoices(){
  if(!sb||!currentUser) return;
  var el = document.getElementById('d-invoices-list');
  if(!el) return;
  el.innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';
  await window._renderDriverInvoiceMonth();
}

window._renderDriverInvoiceMonth = async function(){
  if(!sb||!currentUser) return;
  var listEl = document.getElementById('d-invoices-list');
  if(!listEl) return;

  var monthLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var curY = new Date().getFullYear();
  var minYear = Math.min(curY-2, _dInvSelYear);
  var maxYear = Math.max(curY+1, _dInvSelYear);
  var yearOpts = '';
  for(var y=maxYear; y>=minYear; y--){
    yearOpts += '<option value="'+y+'"'+(_dInvSelYear===y?' selected':'')+'>'+y+'</option>';
  }
  var monthOpts = monthLabels.map(function(ml,i){
    return '<option value="'+(i+1)+'"'+(_dInvSelMonth===i+1?' selected':'')+'>'+ml+'</option>';
  }).join('');

  var btnStyle = 'background:none;border:1.5px solid var(--sand3);border-radius:6px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:inherit;';
  var selStyle = 'font-size:13px;font-weight:600;border:1.5px solid var(--sand3);border-radius:6px;padding:3px 6px;background:var(--white);cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--ink);';

  var m = _dInvSelMonth < 10 ? '0'+_dInvSelMonth : ''+_dInvSelMonth;
  var from = _dInvSelYear+'-'+m+'-01';
  var lastDay = new Date(_dInvSelYear, _dInvSelMonth, 0).getDate();
  var to = _dInvSelYear+'-'+m+'-'+(lastDay<10?'0'+lastDay:lastDay);
  // Onglet « Sous-traitance » : vue séparée (pas de facturation Bleenr)
  if(window._dInvTab==='sub'){
    var navOnly='<div class="card-hd dinv-hd" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">'
      +'<div class="dinv-nav" style="display:flex;align-items:center;gap:6px;">'
        +'<button onclick="_dInvStep(-1)" style="'+btnStyle+'">&lt;</button>'
        +'<select onchange="_dInvSetMonth(parseInt(this.value))" style="'+selStyle+'">'+monthOpts+'</select>'
        +'<select onchange="_dInvSetYear(parseInt(this.value))" style="'+selStyle+'">'+yearOpts+'</select>'
        +'<button onclick="_dInvStep(1)" style="'+btnStyle+'">&gt;</button>'
      +'</div></div>';
    return _renderDInvSub(listEl, navOnly, from, to);
  }

  var {data} = await sb.from('rides').select('*')
    .eq('driver_id',currentUser.id)
    .in('status',['done','confirmed','cancelled'])
    .not('final_price','is',null)
    .gte('ride_date',from).lte('ride_date',to)
    .order('ride_date',{ascending:true});
  var monthRides = (data||[]).filter(function(r){ return !r.is_subcontract && (r.status!=='cancelled' || (r.final_price && r.payment_method && r.payment_method!=='refunded')); }).sort(_byNewest); // sous-traitances : hors facturation ; annulée : seulement si payée et non remboursée
  window._dInvCurrentData = monthRides;

  var fmt = function(v){ return parseFloat(v).toFixed(2).replace('.',',')+' €'; };
  var tLbl = {ab:'A → B', disposal:'Disposition', mixed:'Mixte'};

  setTimeout(_dinvStripeBtn, 0);
  var header = '<div class="card-hd dinv-hd" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">'
    +'<div class="dinv-nav" style="display:flex;align-items:center;gap:6px;">'
      +'<button onclick="_dInvStep(-1)" style="'+btnStyle+'">&lt;</button>'
      +'<select onchange="_dInvSetMonth(parseInt(this.value))" style="'+selStyle+'">'+monthOpts+'</select>'
      +'<select onchange="_dInvSetYear(parseInt(this.value))" style="'+selStyle+'">'+yearOpts+'</select>'
      +'<button onclick="_dInvStep(1)" style="'+btnStyle+'">&gt;</button>'
    +'</div>'
    +'<div class="dinv-btns" style="display:flex;gap:6px;">'
      +(monthRides.length
        ? '<button class="btn btn-secondary btn-sm" style="display:flex;align-items:center;gap:5px;flex-shrink:0;" onclick="generateDriverInvoices(\'prestation\')">'+t('app.factures_prestation')+'</button>'
          +'<button class="btn btn-secondary btn-sm" style="flex-shrink:0;" onclick="generateDriverInvoices(\'commission\')">'+t('app.facture_commission')+'</button>'
        : '')
      // Espace Stripe (versements) : affiché si le fleet a un compte Stripe
      +'<button class="btn btn-green btn-sm dinv-stripe" style="flex-shrink:0;display:none;" onclick="stripeDashboard()">'+t('st.dashboard')+'</button>'
    +'</div>'
  +'</div>';

  if(!monthRides.length){
    listEl.innerHTML = '<div class="card" style="padding:0;">'+header
      +'<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px;">'+t('app.aucune_mission_ce_mois_ci')+'</div>'
    +'</div>';
    return;
  }

  // Amounts from Admin → Facturation: commission % (on HTVA), its VAT, and VAT client -> carrier (fleet country)
  var _s = await _docBilling();
  var _cfg = _invCfg(_s);
  var pVat = _cfg.vatFor(currentProfile?.address_country);
  var _fc = currentProfile?.address_country;
  var cRate = _cfg.commFor(_fc), cVat = _cfg.cVatFor(_fc), _rcD = _cfg.rcFor(_fc);
  var r2 = _rptR2;

  var totHt = 0, totComm = 0;
  var cell = function(v, extra){ return '<td style="padding:10px 12px;font-size:12.5px;text-align:right;white-space:nowrap;vertical-align:top;'+(extra||'')+'">'+v+'</td>'; };
  var rows = monthRides.map(function(r){
    var ht = r2(_rideHtva(r));
    var cm = r2(ht * cRate / 100);
    totHt += ht; totComm += cm;
    var code = r.booking_code || r.id.slice(0,8);
    var from2 = (r.from_address||'—').split(',')[0];
    var route = r.trip_type==='disposal' ? from2+' (Mise à disposition)' : from2+' → '+(r.to_address||'');
    var timeStr = r.ride_time ? r.ride_time.slice(0,5) : '';
    return '<tr style="border-bottom:1px solid var(--sand2);">'
      +'<td style="padding:10px 12px 10px 20px;font-size:11px;font-family:monospace;font-weight:600;color:var(--ink2);vertical-align:top;white-space:nowrap;">'+code+'</td>'
      +'<td style="padding:10px 12px;vertical-align:top;"><div style="font-size:12.5px;color:var(--ink3);">'+formatDate(r.ride_date||'')+(timeStr?' · '+timeStr:'')+'</div>'
        +'<div style="font-size:12.5px;color:var(--ink);">'+route+'</div></td>'
      +cell(fmt(ht),'font-weight:600;')+cell(fmt(cm),'font-weight:600;')+cell('','padding-right:20px;')
    +'</tr>';
  }).join('');
  totHt = r2(totHt); totComm = r2(totComm);
  var pVatAmt = r2(totHt * pVat / 100), pTvac = r2(totHt + pVatAmt);
  var cVatAmt = r2(totComm * cVat / 100), cTvac = r2(totComm + cVatAmt);
  var net = r2(pTvac - cTvac);

  var th = function(l, right){ return '<th style="padding:10px 12px;'+(right?'text-align:right;':'text-align:left;')+'font-size:11px;font-weight:700;color:var(--ink2);white-space:nowrap;">'+l+'</th>'; };
  var lbl = function(t){ return '<td colspan="2" style="padding:6px 12px 6px 20px;font-size:12.5px;color:var(--ink3);">'+t+'</td>'; };
  var sep = '<tr><td colspan="5" style="padding:0;border-top:1px solid var(--sand3);"></td></tr>';

  listEl.innerHTML = '<div class="card" style="padding:0;">'
    + header
    + '<div class="inv-tot" style="padding:14px 20px;border-bottom:1px solid var(--sand2);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">'
      +'<div><div style="font-size:11px;color:var(--ink3);margin-bottom:4px;">'+t('app.total_brut_htva')+'</div><div style="font-size:18px;font-weight:700;">'+fmt(totHt)+'</div></div>'
      +'<div><div style="font-size:11px;color:var(--ink3);margin-bottom:4px;white-space:nowrap;">'+t('app.commission_bleenr')+cRate+'%)</div><div style="font-size:18px;font-weight:700;color:var(--red);">−'+fmt(totComm)+'</div></div>'
      +'<div><div style="font-size:11px;color:var(--ink3);margin-bottom:4px;">'+t('app.ca_chauffeur')+'</div><div style="font-size:18px;font-weight:700;color:var(--green);">'+fmt(r2(totHt-totComm))+'</div></div>'
    +'</div>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr style="border-bottom:2px solid var(--sand3);">'
        +'<th style="padding:10px 12px 10px 20px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.code')+'</th>'
        +'<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.trajet')+'</th>'
        +th('Tarif HTVA',1)+th('Commission HTVA',1)+'<th style="padding:10px 20px 10px 12px;text-align:right;font-size:11px;font-weight:700;color:var(--ink2);white-space:nowrap;">'+t('app.a_payer')+'</th>'
      +'</tr></thead>'
      + '<tbody>'+rows+'</tbody>'
      + '<tfoot>'
        + sep
        + '<tr>'+lbl('Sous-total')+cell(fmt(totHt),'font-weight:600;')+cell('')+cell('','padding-right:20px;')+'</tr>'
        + '<tr>'+lbl('TVA ('+pVat+'%)')+cell(fmt(pVatAmt),'font-weight:600;')+cell('-')+cell('','padding-right:20px;')+'</tr>'
        + sep
        + '<tr>'+lbl('Sous-total')+cell('')+cell(fmt(totComm),'font-weight:600;')+cell('','padding-right:20px;')+'</tr>'
        + '<tr>'+lbl('TVA ('+(_rcD?'0% – autoliquidation':cVat+'%')+')')+cell('-')+cell(fmt(cVatAmt),'font-weight:600;')+cell('','padding-right:20px;')+'</tr>'
        + sep
        + '<tr><td colspan="2" style="padding:10px 12px 14px 20px;font-size:14px;font-weight:700;">'+t('app.total_a_payer')+'</td>'
          +cell(fmt(pTvac),'font-weight:700;font-size:13.5px;padding-bottom:14px;')+cell(fmt(cTvac),'font-weight:700;font-size:13.5px;padding-bottom:14px;')
          +cell(fmt(net),'font-weight:700;font-size:13.5px;color:var(--green);padding-right:20px;padding-bottom:14px;')+'</tr>'
      + '</tfoot>'
    + '</table></div>'
  +'</div>';
};

// ── Onglets Clients / Sous-traitance ──
window._dInvTab = 'client';
window._dInvTabSet = function(tab){
  window._dInvTab = tab;
  document.querySelectorAll('#dinv-tabs .mktab').forEach(function(b){ b.classList.toggle('active', b.dataset.t===tab); });
  var el=document.getElementById('d-invoices-list'); if(el) el.innerHTML='<div class="page-loading"><div class="page-spinner"></div></div>';
  window._renderDriverInvoiceMonth();
};

// Sous-traitance du mois : « Mes sous-traitances » (publiées : à payer au sous-traitant) et
// « Sous-traitances effectuées » (acceptées : à recevoir). Prix HTVA + TVA du pays (réglées entre fleets, hors Bleenr).
async function _renderDInvSub(listEl, header, from, to){
  var uid=currentUser.id;
  var q=function(col){ return sb.from('rides').select('*').eq(col,uid).eq('is_subcontract',true).in('status',['done','confirmed','active'])
    .not('final_price','is',null).gte('ride_date',from).lte('ride_date',to).order('ride_date',{ascending:true}); };
  var res=await Promise.all([q('client_id'), q('driver_id')]);
  var mine=(res[0].data||[]).filter(function(r){ return r.driver_id; }), done=res[1].data||[];
  // Société de l'autre fleet (fonction serveur réservée aux deux parties)
  var names={};
  await Promise.all(mine.concat(done).map(function(r){ return sb.rpc('ride_subcontract_parties',{p_ride:r.id}).then(function(x){ names[r.id]=x.data||{}; }).catch(function(){}); }));
  var _s=await _docBilling(), _cfg=_invCfg(_s), vat=_cfg.vatFor(currentProfile&&currentProfile.address_country), r2=_rptR2;
  var fmt=function(v){ return parseFloat(v).toFixed(2).replace('.',',')+' \u20ac'; };
  var esc=_billingEsc;
  var th=function(l,right,pad){ return '<th style="padding:10px 12px'+(pad?' 10px 20px':'')+';text-align:'+(right?'right':'left')+';font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);white-space:nowrap;">'+l+'</th>'; };
  // Un bloc par société (sous-traitant ou donneur d'ordre), avec ses totaux, puis le total du mois
  var section=function(title, sub, rows, who, total, color){
    if(!rows.length) return '<div style="padding:18px 20px;border-top:1px solid var(--sand2);"><div style="font-size:14px;font-weight:700;">'+title+'</div><div style="font-size:12.5px;color:var(--ink3);margin-top:4px;">'+t('app.aucune_mission_ce_mois_ci')+'</div></div>';
    var groups={}, order=[];
    rows.forEach(function(r){ var nm=(names[r.id]||{})[who]||'—'; if(!groups[nm]){ groups[nm]=[]; order.push(nm); } groups[nm].push(r); });
    order.sort(function(a,b){ return a.localeCompare(b,'fr'); });
    var pay=who==='taker_company', allHt=0;
    var tr=function(l,v,b,c){ return '<tr><td colspan="2" style="padding:5px 12px 5px 20px;font-size:'+(b?'13.5px;font-weight:700':'12.5px;color:var(--ink3)')+';">'+l+'</td><td style="padding:5px 20px 5px 12px;text-align:right;white-space:nowrap;font-size:'+(b?'13.5px;font-weight:700;color:'+(c||'var(--ink)'):'12.5px;font-weight:600')+';">'+v+'</td></tr>'; };
    var blocks=order.map(function(nm){
      var g=groups[nm], ht=0;
      var body=g.map(function(r){
        var h=r2(parseFloat(r.final_price)||0); ht+=h;
        var from2=(r.from_address||'—').split(',')[0];
        var route=r.trip_type==='disposal'?from2+' (Mise à disposition)':from2+' → '+String(r.to_address||'').split(',')[0];
        return '<tr style="border-bottom:1px solid var(--sand2);">'
          +'<td style="padding:10px 12px 10px 20px;font-size:11px;font-family:monospace;font-weight:600;color:var(--ink2);vertical-align:top;white-space:nowrap;">'+esc(r.booking_code||r.id.slice(0,8))+'</td>'
          +'<td style="padding:10px 12px;vertical-align:top;"><div style="font-size:12.5px;color:var(--ink3);">'+formatDate(r.ride_date||'')+(r.ride_time?' · '+r.ride_time.slice(0,5):'')+'</div><div style="font-size:12.5px;color:var(--ink);">'+esc(route)+'</div></td>'
          +'<td style="padding:10px 20px 10px 12px;font-size:12.5px;font-weight:600;text-align:right;white-space:nowrap;vertical-align:top;">'+fmt(h)+'</td></tr>';
      }).join('');
      ht=r2(ht); allHt+=ht; var tv=r2(ht*vat/100), tt=r2(ht+tv);
      return '<div style="margin:0 16px 14px;border:1px solid var(--sand2);border-radius:14px;overflow:hidden;">'
        +'<div style="padding:12px 16px;background:var(--sand,#F3F2EE);display:flex;align-items:center;justify-content:space-between;gap:10px;">'
          +'<div style="display:flex;align-items:center;gap:10px;min-width:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:var(--ink2);"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></svg>'
          +'<div style="min-width:0;"><div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(nm)+'</div><div style="font-size:11.5px;color:var(--ink3);">'+g.length+' course'+(g.length>1?'s':'')+'</div></div></div>'
          +'<div style="text-align:right;flex-shrink:0;"><div style="font-size:11px;color:var(--ink3);">'+(pay?'À payer':'À recevoir')+' TVAC</div><div style="font-size:16px;font-weight:700;color:'+color+';">'+fmt(tt)+'</div></div></div>'
        +'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid var(--sand3);">'+th(t('app.code'),0,1)+th(t('app.trajet'))+'<th style="padding:10px 20px 10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Prix HTVA</th></tr></thead>'
        +'<tbody>'+body+'</tbody><tfoot>'+tr('Total HTVA',fmt(ht))+tr('TVA ('+vat+'%)',fmt(tv))+tr('Total TVAC',fmt(tt),1,color)+'<tr><td colspan="3" style="height:6px;"></td></tr></tfoot></table></div></div>';
    }).join('');
    allHt=r2(allHt); var aTv=r2(allHt*vat/100), aTt=r2(allHt+aTv);
    return '<div style="border-top:1px solid var(--sand2);">'
      +'<div style="padding:16px 20px 12px;display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div><div style="font-size:14px;font-weight:700;">'+title+'</div><div style="font-size:12px;color:var(--ink3);margin-top:2px;">'+sub+'</div></div>'
        +'<div style="text-align:right;"><div style="font-size:11px;color:var(--ink3);">'+rows.length+' course'+(rows.length>1?'s':'')+' · '+order.length+' société'+(order.length>1?'s':'')+' · TVAC</div><div style="font-size:18px;font-weight:700;color:'+color+';">'+fmt(aTt)+'</div></div></div>'
      +blocks
      +(order.length>1?'<div style="margin:0 16px 16px;padding:10px 16px;border-radius:12px;background:var(--sand,#F3F2EE);display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;"><span>'+(pay?'Total à payer (TVAC)':'Total à recevoir (TVAC)')+'</span><span style="color:'+color+';">'+fmt(aTt)+'</span></div>':'')
      +'</div>';
  };
  listEl.innerHTML='<div class="card" style="padding:0;">'+header
    +section('Mes sous-traitances','Courses que vous avez confiées : à régler au sous-traitant',mine,'taker_company','var(--ink)')
    +section('Sous-traitances effectuées','Courses que vous avez réalisées : à facturer au donneur d\u2019ordre',done,'poster_company','var(--green)')
    +'<div style="padding:12px 20px 16px;font-size:11.5px;color:var(--ink3);border-top:1px solid var(--sand2);">Les sous-traitances se règlent directement entre fleets, hors Bleenr, sans commission. Montants HTVA + TVA du pays.</div>'
  +'</div>';
}

window.generateDriverInvoices = function(kind){
  // Fleet space: prestation invoices (fleet -> each client) or the commission invoice (Bleenr -> fleet)
  var people={}; if(currentProfile) people[currentUser.id]=Object.assign({email:currentUser.email},currentProfile);
  _invOpen({ rides:(window._dInvCurrentData||[]).filter(function(r){ return r.driver_id===currentUser.id; }), kind:kind,
    year:_dInvSelYear, month:_dInvSelMonth, people:people });
};

async function loadPassengersList(){
  if(!sb||!currentUser) return;
  var el = document.getElementById('passengers-list');
  if(!el) return;
  el.innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';
  var {data,error} = await sb.from('passengers').select('*').eq('client_id',currentUser.id).order('last_name',{ascending:true});
  if(error){ el.innerHTML='<div style="padding:24px;color:var(--red);">'+t('app.erreur')+' '+error.message+'</div>'; return; }
  if(!data||data.length===0){
    el.innerHTML='<div class="card" style="padding:40px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">👤</div><div style="font-size:14px;color:var(--ink3);">'+t('app.aucun_passager_enregistre')+'</div><button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="openPassengerModal()">'+t('app.ajouter_un_passager')+'</button></div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;justify-content:flex-start;margin-bottom:12px;">'
    +'<button class="btn btn-primary btn-sm" onclick="openPassengerModal()">'+t('app.ajouter')+'</button>'
    +'</div>'
    +'<style>@media (max-width:640px){.pax-tbl .pax-col-email{display:none;}.pax-tbl .pax-sub-email{display:block!important;}.pax-tbl th,.pax-tbl td{padding:10px 8px!important;}.pax-tbl td.pax-act{width:1%;}}</style>'
    +'<div class="card" style="overflow:hidden;">'
    +'<table class="pax-tbl" style="width:100%;border-collapse:collapse;font-size:13px;">'
    +'<thead><tr style="background:var(--sand2);">'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.nom')+'</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.telephone')+'</th>'
      +'<th class="pax-col-email" style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">'+t('app.email')+'</th>'
      +'<th style="padding:10px 14px;"></th>'
    +'</tr></thead><tbody>'
    +data.map(function(p){
      var name = ((p.first_name||'')+' '+(p.last_name||'')).trim();
      return '<tr style="border-bottom:1px solid var(--sand2);">'
        +'<td style="padding:10px 14px;font-weight:500;">'+name+(p.email?'<div class="pax-sub-email" style="display:none;font-weight:400;font-size:12px;color:var(--ink3);margin-top:2px;word-break:break-all;">'+p.email+'</div>':'')+'</td>'
        +'<td style="padding:10px 14px;color:var(--ink3);">'+(p.phone||'—')+'</td>'
        +'<td class="pax-col-email" style="padding:10px 14px;color:var(--ink3);">'+(p.email||'—')+'</td>'
        +'<td class="pax-act" style="padding:10px 14px;text-align:right;white-space:nowrap;">'
          +'<button onclick="editPassenger(\''+p.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--ink3);padding:4px;margin-right:4px;"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
          +'<button onclick="deletePassenger(\''+p.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--red);padding:4px;"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="3,4 13,4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M4 4l.7 8.5a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>'
        +'</td></tr>';
    }).join('')
    +'</tbody></table></div>';
}

window.openPassengerModal = function(){
  _editPassengerId = null;
  document.getElementById('passenger-modal-title').textContent = 'Ajouter un passager';
  ['pax-fname','pax-lname','pax-phone','pax-email'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('pax-err').classList.remove('show');
  openModal('m-passenger');
};

window.editPassenger = async function(id){
  if(!sb) return;
  var {data} = await sb.from('passengers').select('*').eq('id',id).maybeSingle();
  if(!data) return;
  _editPassengerId = id;
  document.getElementById('passenger-modal-title').textContent = 'Modifier le passager';
  var s = function(eid,v){var e=document.getElementById(eid);if(e)e.value=v||'';};
  s('pax-fname',data.first_name);s('pax-lname',data.last_name);s('pax-phone',data.phone);s('pax-email',data.email);
  document.getElementById('pax-err').classList.remove('show');
  openModal('m-passenger');
};

window.savePassenger = async function(){
  if(!sb) return;
  var fname = (document.getElementById('pax-fname')?.value||'').trim();
  var lname = (document.getElementById('pax-lname')?.value||'').trim();
  var phone = (document.getElementById('pax-phone')?.value||'').trim();
  var email = (document.getElementById('pax-email')?.value||'').trim();
  var errEl = document.getElementById('pax-err');
  if(!fname||!lname){ if(errEl){errEl.textContent='Prénom et nom requis';errEl.classList.add('show');} return; }
  var payload = {first_name:fname,last_name:lname,phone:phone||null,email:email||null,client_id:currentUser.id};
  var {error} = await sb.rpc('api_passenger_save',{ p_id:_editPassengerId||null, p:payload });
  if(error){ if(errEl){errEl.textContent=error.message;errEl.classList.add('show');} return; }
  closeModal('m-passenger');
  showToast(_editPassengerId ? '✅ Passager mis à jour' : '✅ Passager ajouté');
  await loadPassengersList();
};

window.deletePassenger = async function(id){
  if(!sb) return;
  _fleetConfirm('Supprimer ce passager ?','Cette action est irréversible.',async function(){
    await sb.rpc('api_passenger_delete',{ p_id:id });
    showToast(t('app.passager_supprime'));
    await loadPassengersList();
  });
};

// Bouton « Ouvrir mon espace Stripe » des factures : seulement si le fleet a un compte Stripe
var _dinvStripeOk=null;
async function _dinvStripeBtn(){
  if(currentRole!=='driver' || localStorage.getItem(DEMO_MODE_KEY)==='1') return;
  if(_dinvStripeOk===null){
    if(typeof _stripeState!=='undefined' && _stripeState) _dinvStripeOk=!!_stripeState.account_id;
    else { try{ var r=await sb.from('fleet_stripe').select('account_id').eq('driver_id',currentUser.id).maybeSingle(); _dinvStripeOk=!!(r.data&&r.data.account_id); }catch(e){ _dinvStripeOk=false; } }
  }
  document.querySelectorAll('.dinv-stripe').forEach(function(b){ b.style.display=_dinvStripeOk?'':'none'; });
}
