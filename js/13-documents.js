// ── PDF generation helpers ──
function _buildPdfWindow(html){var win=window.open('','_blank');if(win){win.document.write(html);win.document.close();}}
function _pdfBase(title,bodyHtml){
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>'+title+'</title>'
    +'<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:"Helvetica Neue",Arial,sans-serif;color:#1A1A18;background:#fff;padding:36px;}h1{font-family:Georgia,serif;font-size:22px;letter-spacing:.1em;margin-bottom:24px;}table{width:100%;border-collapse:collapse;margin-bottom:4px;}td{padding:7px 12px;font-size:13px;border-bottom:1px solid #E8E8E8;}td:first-child{color:#777;width:38%;}td:last-child{font-weight:600;}.section{margin-bottom:22px;}.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:8px;border-bottom:2px solid #1A1A18;padding-bottom:4px;}.footer{margin-top:40px;font-size:10px;color:#999;text-align:center;border-top:1px solid #E8E8E8;padding-top:12px;}@media print{button{display:none!important;}}</style>'
    +'</head><body><h1>BLEENR</h1>'+bodyHtml
    +'<div style="text-align:center;margin-top:28px;"><button onclick="window.print()" style="padding:9px 24px;background:#1A1A18;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Imprimer / PDF</button></div>'
    +'<div class="footer">DISPOSAL SRL — bleenr.com</div></body></html>';
}

// ── Shared Bleenr document template (invoices, vouchers, mission orders) ──
var _BLEENR_DOC_CSS='*{box-sizing:border-box;margin:0;padding:0}'
  +'body{font-family:"Helvetica Neue",Arial,sans-serif;color:#1A1A18;background:#fff;padding:44px 48px;font-size:12.5px;line-height:1.5}'
  +'.page{max-width:820px;margin:0 auto}.page+.page{margin-top:60px;padding-top:44px;border-top:1px dashed #CCC}'
  +'.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:34px}'
  +'.logo{height:46px;width:auto}.meta{text-align:right;font-size:12px;color:#444}'
  +'.kind{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#1B5E3B;font-weight:700}'
  +'.num{font-size:21px;font-weight:800;color:#1A1A18;margin:2px 0 8px}'
  +'.parties{display:flex;justify-content:space-between;gap:40px;margin-bottom:22px}.party{flex:1}.party.r{text-align:right}'
  +'.lbl{font-size:12px;color:#666;margin-bottom:2px}.pname{font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:.01em}'
  +'.miss{color:#C0392B}'
  +'table.lines{width:100%;border-collapse:collapse;margin-top:8px}'
  +'table.lines th{background:#F2F7F4;color:#1B5E3B;font-size:11.5px;font-weight:700;padding:10px;border:1px solid #CFE0D6}'
  +'table.lines td{padding:10px;border:1px solid #E1E6E3;vertical-align:top}'
  +'table.kv{width:100%;border-collapse:collapse;margin-top:8px}'
  +'table.kv th{width:190px;background:#F2F7F4;color:#1B5E3B;font-size:11.5px;font-weight:700;padding:10px;border:1px solid #CFE0D6;text-align:left;vertical-align:top}'
  +'table.kv td{padding:10px;border:1px solid #E1E6E3;vertical-align:top}'
  +'.sect{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#1B5E3B;font-weight:700;margin:22px 0 4px}'
  +'.c{text-align:center}.r{text-align:right;white-space:nowrap}.b{font-weight:700}.sub{font-size:11px;color:#777;margin-top:2px}'
  +'.cx{color:#C0392B;font-style:italic}'
  +'.sum{display:flex;justify-content:flex-end;margin-top:22px}.sum table{width:340px;border-collapse:collapse}'
  +'.sum td{padding:4px 0}.sum .grand td{font-weight:800;font-size:14px;padding-top:8px;border-top:2px solid #1A1A18}'
  +'.sum .note{font-weight:700;text-align:right;padding-top:6px}'
  +'.box{margin-top:34px;border:1.5px solid #1A1A18;padding:18px 20px}'
  +'.boxt{color:#1FA34A;font-size:19px;font-weight:800;margin-bottom:8px}.box div{margin-bottom:4px}.muted{color:#666;font-size:11.5px}'
  +'.foot{margin-top:26px;text-align:center;font-size:10.5px;color:#999}'
  +'.warn{background:#FEF3DC;color:#92650A;padding:10px 12px;border-radius:6px;margin-bottom:16px}'
  +'@media print{body{padding:24px}.np{display:none}.page+.page{page-break-before:always;border:none;margin:0;padding:0}'
  +'table.lines th,table.kv th,.box{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

function _bleenrDocHtml(title, inner){
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>'+_billingEsc(title)+'</title><style>'+_BLEENR_DOC_CSS+'</style></head><body>'
    +inner
    +'<div class="np" style="text-align:center;margin-top:30px;"><button onclick="window.print()" style="padding:10px 26px;background:#1B5E3B;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Imprimer / PDF</button></div>'
    +'</body></html>';
}
function _docDate(d){ d=d||new Date(); var p=function(n){return String(n).padStart(2,'0');}; return p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+d.getFullYear(); }
function _docIso(iso){ var x=String(iso||'').split('-'); return x.length===3?x[2]+'-'+x[1]+'-'+x[0]:(iso||''); }
function _docParty(t,p,right){
  var e=_billingEsc;
  return '<div class="party'+(right?' r':'')+'"><div class="lbl">'+t+'</div><div class="pname">'+e(p.name)+'</div>'
    +[p.l1,p.l2,p.l3].filter(Boolean).map(function(x){return '<div>'+e(x)+'</div>';}).join('')
    +(p.extra||[]).map(function(x){return '<div>'+e(x)+'</div>';}).join('')
    +(p.vat?'<div>N° de TVA : '+e(p.vat)+'</div>':(p.business?'<div class="miss">N° de TVA : non renseigné</div>':''))+'</div>';
}
function _docTop(kind, number, metaLines){
  return '<div class="top"><img class="logo" src="'+_BLEENR_LOGO+'" alt="Bleenr">'
    +'<div class="meta"><div class="kind">'+kind+'</div><div class="num">N° '+_billingEsc(number)+'</div>'
    +metaLines.map(function(l){return '<div>'+l+'</div>';}).join('')+'</div></div>';
}
// Bleenr company data (Admin → Facturation), cached
var _docBillingP=null;
function _docBilling(){
  if(!_docBillingP){
    _docBillingP = sb ? sb.from('billing_settings').select('*').eq('id',1).maybeSingle().then(function(r){return r.data||{};}).catch(function(){return {};}) : Promise.resolve({});
  }
  return _docBillingP;
}
// HTVA / TVA / TVAC d'une course. Sous-traitance : HTVA = final_price + TVA du pays du transporteur (Admin → Facturation)
// ── Blocs client du détail d'une course (véhicule / chauffeur, prix) ──
function _rdEsc(x){ return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
// Nombre de courses créées depuis une date (toutes, pas seulement les siennes) → références BLxx
async function _ridesCountSince(since){
  try{ var r=await sb.rpc('rides_count_since',{p_since:since}); if(!r.error && r.data!=null) return Number(r.data)||0; }catch(e){}
  try{ var c=await sb.from('rides').select('id',{count:'exact',head:true}).gte('created_at',since); return c.count||0; }catch(e){ return 0; }
}
// Infos passager d'une demande pas encore confirmée (stockées à part, invisibles des fleets)
async function _mergeRidePrivate(rides){
  var list=(Array.isArray(rides)?rides:[rides]).filter(function(r){ return r && (r.status==='waiting'||r.status==='offers'); });
  if(!list.length||!sb||localStorage.getItem(DEMO_MODE_KEY)==='1') return rides;
  try{
    // Lisible uniquement par le client de la demande (et l'admin) : RLS sur ride_private
    var {data}=await sb.from('ride_private').select('ride_id,tokens,full_notes').in('ride_id',list.map(function(r){return r.id;}));
    var m={}; (data||[]).forEach(function(x){ m[x.ride_id]=x; });
    list.forEach(function(r){
      var x=m[r.id]; if(!x) return;
      if(x.full_notes!=null) r.notes=x.full_notes;
      else if(x.tokens && !/\|pax:/.test(r.notes||'')) r.notes=(r.notes||'')+x.tokens;
    });
  }catch(e){ console.warn('ride_private', e); }
  return rides;
}
async function _clientFleetData(r){
  var out={veh:null, drv:null, price:null};
  if(r.driver_id){
    var [ofr, dp] = await Promise.all([
      sb.from('offers').select('vehicle_id,fleet_driver_id').eq('ride_id',r.id).eq('driver_id',r.driver_id).eq('status','accepted').maybeSingle(),
      sb.from('profiles').select('first_name,last_name,phone,company_name').eq('id',r.driver_id).maybeSingle()
    ]);
    var o = ofr.data||{};
    var [vh, fdr] = await Promise.all([
      o.vehicle_id ? sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',o.vehicle_id).maybeSingle() : Promise.resolve({data:null}),
      o.fleet_driver_id ? sb.from('fleet_drivers').select('first_name,last_name,phone').eq('id',o.fleet_driver_id).maybeSingle() : Promise.resolve({data:null})
    ]);
    out.veh = vh.data;
    // Chauffeur attribué : via RPC (le client n'a pas accès à fleet_drivers)
    var ad = fdr.data;
    if(!ad && o.fleet_driver_id){
      try{ var rp = await sb.rpc('ride_assigned_driver',{p_ride:r.id}); if(rp.error) console.warn('ride_assigned_driver', rp.error); ad = (rp.data&&rp.data[0])||null; }catch(e){ console.warn('ride_assigned_driver', e); }
    }
    var fp = dp.data||{};
    var company = (fp.company_name||'').trim() || ((fp.first_name||'')+' '+(fp.last_name||'')).trim();
    var first = ad ? (ad.first_name||'').trim() : '';
    var phone = (ad&&ad.phone) || fp.phone || '';
    if(company||first||phone) out.drv = { name:[company,first].filter(Boolean).join(' \u2013 '), phone:phone, company:'Chauffeur', first:first, fleet:company };
  }
  if(r.final_price){ try{ out.price = await _ridePrice(r); }catch(e){} }
  return out;
}
// ── Blocs « Informations du passager » et « Véhicule et chauffeur » (même présentation fleet / client) ──
function _rdInfoBlocks(o){
  var row=function(ic,main,extra){ return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;">'
    +'<span style="width:30px;height:30px;border-radius:9px;background:#fff;color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+ic+'</span>'
    +'<div style="flex:1;min-width:0;font-size:13px;">'+main+'</div>'+(extra||'')+'</div>'; };
  var I={
    usr:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
    car:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 01-2-2v-3l2-5h14l2 5v3a2 2 0 01-2 2M5 17v2M19 17v2"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg>',
    mail:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    ref:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><circle cx="7" cy="7" r="1.5"/></svg>'
  };
  var box='padding:12px 14px;background:#EEF4FB;border-radius:var(--r);';
  var cap=function(t){ return '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:4px;">'+t+'</div>'; };
  var sub=function(t,txt){ return '<div style="border-top:1px solid #d0e4f7;margin-top:6px;padding-top:10px;">'+cap(t)
    +(txt?'<div style="font-size:12.5px;color:var(--ink2);font-style:italic;">'+_rdEsc(txt)+'</div>':'<div style="font-size:12px;color:var(--ink4);">Aucune note</div>')+'</div>'; };
  var tel=function(ph){ return ph?'<a href="tel:'+_rdEsc(String(ph).replace(/[^\d+]/g,''))+'" style="font-size:12.5px;color:var(--blue);text-decoration:none;white-space:nowrap;">'+_rdEsc(ph)+'</a>':''; };
  var none='<span style="color:var(--ink4);">Non renseigné</span>';
  var p=o.pax||{}, v=o.veh, d=o.drv;
  var h='<div style="'+box+'">'+cap('Informations du passager')
    +row(I.usr, p.name?'<b>'+_rdEsc(p.name)+'</b>':none, tel(p.phone))
    +(p.email?row(I.mail,'<a href="mailto:'+_rdEsc(p.email)+'" style="color:var(--blue);text-decoration:none;">'+_rdEsc(p.email)+'</a>'):'')
    +(p.ref?row(I.ref,'<span style="color:var(--ink3);">Réf. : </span><b>'+_rdEsc(p.ref)+'</b>'):'')
    +(o.paxNoteLabel?sub(o.paxNoteLabel, p.note):'')
    +'</div>';
  var vTxt=v?[((v.brand||'')+' '+(v.model||'')).trim(), v.color||''].filter(Boolean).join(' · '):'';
  h+='<div style="'+box+'margin-top:12px;">'+cap(o.vehTitle||'Véhicule et chauffeur')
    +row(I.car, vTxt?'<b>'+_rdEsc(vTxt)+'</b>':none,
         v&&v.plate?'<span style="font-family:monospace;font-size:12px;font-weight:700;letter-spacing:.04em;background:#fff;border:1.5px solid #C0392B;border-radius:6px;padding:3px 8px;color:#C0392B;white-space:nowrap;">'+_rdEsc(v.plate)+'</span>':'')
    +row(I.usr, d&&d.name?'<b>'+_rdEsc(d.name)+'</b>':none, d?tel(d.phone):'')
    +(o.drvNoteLabel?sub(o.drvNoteLabel, o.drvNote):'')
    +(o.priceHtml?'<div style="border-top:1px solid #d0e4f7;margin-top:6px;padding-top:10px;">'+o.priceHtml+'</div>':'')
    +'</div>';
  return h;
}
// Zone « Départ / Arrivée » (même rendu que la fiche et le paiement) + distance calculée par Google
// Pastille du type d'un trajet de trajet mixte (avant la gamme)
function _mxTypePill(isD, dur, from, to){
  var ic=function(d){ return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'; };
  if(isD) return '<span class="mx-tp d" title="Mise à disposition">'+ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+(dur?'<b>'+_rdEsc(String(dur).replace(/h$/,''))+' h</b>':'')+'</span>';
  var k=_mxKmCache[(from||'')+'>'+(to||'')];
  return '<span class="mx-tp" title="Transfert simple" data-from="'+_rdEsc(from||'')+'" data-to="'+_rdEsc(to||'')+'">'+ic('<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="6" r="2.6"/><path d="M8 16l8-8"/>')+'<b class="km">'+(k?k+' km':'')+'</b></span>';
}
// Km des transferts d'un trajet mixte (Google Distance Matrix, mis en cache)
var _mxKmCache={};
function _mxFillKm(){
  setTimeout(function(){
    if(typeof google==='undefined'||!google.maps||!google.maps.DistanceMatrixService) return;
    document.querySelectorAll('.mx-tp[data-from]').forEach(function(el){
      var f=el.getAttribute('data-from'), t=el.getAttribute('data-to'), key=f+'>'+t, b=el.querySelector('.km');
      if(!f||!t||!b||b.textContent) return;
      if(_mxKmCache[key]){ b.textContent=_mxKmCache[key]+' km'; return; }
      (new google.maps.DistanceMatrixService()).getDistanceMatrix({origins:[f],destinations:[t],travelMode:google.maps.TravelMode.DRIVING,language:'fr'},function(res,st){
        var e=res&&res.rows&&res.rows[0]&&res.rows[0].elements&&res.rows[0].elements[0];
        if(st==='OK'&&e&&e.status==='OK'){ var km=Math.round(e.distance.value/1000); _mxKmCache[key]=km;
          document.querySelectorAll('.mx-tp[data-from]').forEach(function(x){ if(x.getAttribute('data-from')+'>'+x.getAttribute('data-to')===key){ var bb=x.querySelector('.km'); if(bb) bb.textContent=km+' km'; } }); }
      });
    });
  }, 50);
}
// Trajet mixte : liste des trajets (même présentation que la fiche), réutilisée dans les offres et le paiement
// Carte d'un trajet (trajet mixte / événement) : même présentation que le récapitulatif
//   en-tête « N · Type » + date · heure, puis départ (pastille verte) et arrivée (rouge) ; mise à disposition : pastille orange
function _tripCardHtml(o){
  var esc=_rdEsc;
  var fd=function(x){ if(!x) return ''; var v=new Date(x+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).replace(/\./g,''); return v.charAt(0).toUpperCase()+v.slice(1); };
  var cls=({lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'})[o.veh]||o.veh||'';
  var dur=o.dur?String(o.dur).replace(/h$/,''):'';
  var dt=[fd(o.date), o.time?String(o.time).slice(0,5):''].filter(Boolean).join(' \u00b7 ');
  var kv=[];
  if(cls) kv.push('<span><b>'+esc(cls)+'</b></span>');
  if(o.pax) kv.push('<span><b>'+esc(o.pax)+'</b> passager'+(String(o.pax)==='1'?'':'s')+'</span>');
  if(o.disp && dur) kv.push('<span>Dur\u00e9e <b>'+esc(dur)+' h</b></span>');
  if(!o.disp && o.from && o.to){ var k=_mxKmCache[o.from+'>'+o.to]; kv.push('<span class="mx-tp" data-from="'+esc(o.from)+'" data-to="'+esc(o.to)+'"><b class="km">'+(k?k+' km':'')+'</b></span>'); }
  (o.fl||[]).filter(Boolean).forEach(function(x){ kv.push('<span>Vol <b>'+esc(String(x).toUpperCase())+'</b></span>'); });
  (o.trn||[]).filter(Boolean).forEach(function(x){ kv.push('<span>Train <b>'+esc(String(x).toUpperCase())+'</b></span>'); });
  if(o.lug) kv.push('<span><b>'+esc(o.lug)+'</b></span>');
  if(o.contact) kv.push('<span>Contact <b>'+esc(o.contact)+'</b></span>');
  if(o.code) kv.push('<span>'+esc(o.code)+'</span>');
  var rt=o.disp
    ? '<div><i style="background:#E09A2B"></i><span>'+esc(cleanAddr(o.from||'')||'\u2014')+'</span></div>'
    : '<div><i style="background:#4E8F69"></i><span>'+esc(cleanAddr(o.from||'')||'\u2014')+'</span></div>'+(o.to?'<div><i style="background:#D8705F"></i><span>'+esc(cleanAddr(o.to))+'</span></div>':'');
  return '<div class="evr-trip trip-card'+(o.attrs?' clk':'')+'"'+(o.attrs||'')+'>'
    +'<div class="evr-th">'+(o.n?'<span class="n">'+o.n+'</span>':'')+'<span>'+(o.disp?'Mise \u00e0 disposition':'Transfert simple')+'</span>'+(o.right?'<span class="tc-st">'+String(o.right).replace(/[\u25cf\u2022]\s*/,'')+'</span>':'')+'<span class="dt">'+esc(dt)+'</span></div>'
    +'<div class="evr-rt">'+rt+'</div>'
    +'<div class="evr-kv">'+kv.join('')+'</div>'
    +(o.note?'<div class="mx-note"><span>'+t('app.instructions_2')+' </span>'+esc(o.note)+'</div>':'')
    +'</div>';
}
function _mixListHtml(r, segsIn){
  var segs=segsIn||parseMixedNotes(r.notes||''); if(!segs.length) return '';
  var h='';
  segs.forEach(function(sg,i){
    var isD=sg.type.toLowerCase().indexOf('disp')>=0;
    h+=_tripCardHtml({ n:i+1, disp:isD, date:sg.date||r.ride_date, time:sg.time, from:sg.from, to:sg.to, dur:sg.dur, veh:sg.veh, pax:sg.pax,
      lug:_lugTxt(sg.lugL,sg.lugS), fl:[sg.flight,sg.flight2], trn:[sg.train,sg.train2] });
  });
  _mxFillKm();
  return '<div class="mx-list">'+h+'</div>';
}
function _routeBlockHtml(r, pfx){
  if(r.trip_type==='mixed'){ var _ml=_mixListHtml(r); if(_ml) return _ml; }
  var isDisp=r.trip_type==='disposal', isMixed=r.trip_type==='mixed';
  var dur=((r.notes||'').match(/Durée:([^\s|,]+)/)||[])[1]||'';
  var gIc='<svg width="14" height="18" viewBox="0 0 24 30" fill="#1B5E3B"><path d="M12 0C7.6 0 4 3.6 4 8c0 5.4 8 16 8 16s8-10.6 8-16c0-4.4-3.6-8-8-8zm0 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/></svg>';
  var rIc='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
  var row=function(ic,lab,val,line){ return '<div style="display:flex;gap:14px;"><div style="display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;"><div style="margin-top:3px;">'+ic+'</div>'
    +(line?'<div style="width:2px;flex:1;background:var(--sand3);min-height:10px;margin-top:2px;"></div>':'')+'</div>'
    +'<div style="flex:1;min-width:0;padding-bottom:'+(line?'8px':'2px')+';"><div class="detail-seg-label">'+lab+'</div><div class="detail-seg-addr">'+val+'</div></div></div>'; };
  var h='<div class="pay-route">'+row(gIc,isDisp?'LIEU DE PRISE EN CHARGE':'DÉPART',_addrNameHtml(cleanAddr(r.from_address||'—')),true);
  var cIc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C77A10" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  if(isDisp) h+=row(cIc,'MISE À DISPOSITION','<span class="seg-ad" style="margin:0;color:var(--ink);font-size:14px;">'+(dur?_rdEsc(dur):'—')+'</span>',false);
  else if(isMixed) h+=row(rIc,'COURSE MIXTE','<span class="seg-ad" style="margin:0">Plusieurs trajets</span>',false);
  else h+=row(rIc,'ARRIVÉE',_addrNameHtml(r.to_address||'—'),false)+'<div id="'+pfx+'-dist" class="rd-dist" style="display:none;font-size:12.5px;color:var(--ink3);"></div>';
  return h+'</div>';
}
function _routeBlockDist(r, pfx){
  if(r.trip_type==='disposal'||r.trip_type==='mixed'||!r.from_address||!r.to_address||typeof google==='undefined'||!google.maps||!google.maps.DistanceMatrixService) return;
  (new google.maps.DistanceMatrixService()).getDistanceMatrix({origins:[r.from_address],destinations:[r.to_address],travelMode:google.maps.TravelMode.DRIVING,language:'fr'},function(res,st){
    var e=res&&res.rows&&res.rows[0]&&res.rows[0].elements&&res.rows[0].elements[0], el=document.getElementById(pfx+'-dist');
    if(st==='OK'&&e&&e.status==='OK'&&el){ el.textContent=e.distance.text+' · environ '+e.duration.text; el.style.display='block'; }
  });
}
// Adresse affichée « Nom du lieu » en gras + rue / ville en dessous (pays retiré) — même rendu partout
// Carte statique allégée : sans commerces / monuments / transports, couleurs adoucies
var _MAP_STYLE=['feature:poi%7Cvisibility:off','feature:transit%7Cvisibility:off','feature:road%7Celement:labels.icon%7Cvisibility:off',
  'saturation:-75%7Clightness:18','feature:water%7Ccolor:0xdde8ee','feature:road.highway%7Celement:geometry%7Ccolor:0xe6e6e2']
  .map(function(x){ return 'style='+x; }).join('&');
// Km inclus proposés par le chauffeur (offre) : « 40 km inclus » (idx = segment d'une course mixte)
function _kmText(km, idx){
  if(!km||typeof km!=='object') return '';
  var v=idx!=null?km[String(idx)]:km[Object.keys(km)[0]];
  return (v!=null&&v!=='')?(v+' km inclus'):'';
}
function _addrNameHtml(a){
  if(!a||a==='\u2014'||a==='—') return '\u2014';
  var ps=String(a).split(',').map(function(x){return x.trim();}).filter(Boolean);
  if(ps.length>1 && /^(belgique|belgium|belgi\u00eb|france|luxembourg|nederland|pays-bas|netherlands|deutschland|allemagne|germany|united kingdom|royaume-uni|suisse|schweiz|switzerland)$/i.test(ps[ps.length-1])) ps.pop();
  if(ps.length<2) return '<b class="seg-nm">'+_rdEsc(ps[0]||a)+'</b>';
  return '<b class="seg-nm">'+_rdEsc(ps[0])+'</b><span class="seg-ad">'+_rdEsc(ps.slice(1).join(', '))+'</span>';
}
function _rdTag(n,t){ return BleenrCore.noteTag(n,t); }   // core/notes.ts
function _rdFleetHtml(fd, opt){
  opt=opt||{};
  var v=fd.veh, d=fd.drv;
  var vName = v ? [((v.brand||'')+' '+(v.model||'')).trim(), v.color||''].filter(Boolean).join(' ') : '';
  var carIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6a2 2 0 012-1.5h10A2 2 0 0119 7l2 6v4H3z"/><circle cx="7.5" cy="13.5" r=".8" fill="currentColor"/><circle cx="16.5" cy="13.5" r=".8" fill="currentColor"/></svg>';
  var userIc='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  var h='<div class="rd-cap" style="margin-bottom:8px;">'+(opt.title||'Véhicule et chauffeur')+'</div>';
  // Plaque à droite, sur la même ligne (comme le rappel des courses terminées)
  h+='<div class="rd-line"><span class="rd-ic">'+carIc+'</span><div style="min-width:0;flex:1"><div class="rd-strong">'+_rdEsc(vName||'Véhicule à confirmer')+'</div></div>'
    +(v&&v.plate?'<span style="margin-left:auto;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:.04em;background:#fff;border:1.5px solid #C0392B;border-radius:6px;padding:3px 8px;color:#C0392B;white-space:nowrap;">'+_rdEsc(v.plate)+'</span>':'')+'</div>';
  if(d&&(d.name||d.phone)){
    h+='<div class="rd-line"><span class="rd-ic">'+userIc+'</span><div style="min-width:0;flex:1"><div class="rd-strong">'+_rdEsc(d.name||'Chauffeur')+'</div>'+(d.company?'<div class="rd-muted">'+_rdEsc(d.company)+'</div>':'')+'</div>'
      +(d.phone&&!opt.noPhone?'<a class="rd-call" href="tel:'+_rdEsc(d.phone.replace(/[^\d+]/g,''))+'">'+_rdEsc(d.phone)+'</a>':'')+'</div>';
  }
  return h;
}
function _rdPriceHtml(p, totalLabel){
  var f=function(v){ return (Number(v)||0).toFixed(2).replace('.',',')+' €'; };
  return '<div class="rd-cap" style="margin-bottom:6px;">Prix</div>'
    +'<div class="rd-pr"><span>Prix HTVA</span><span>'+f(p.htva)+'</span></div>'
    +'<div class="rd-pr"><span>TVA '+p.pct+'%</span><span>'+f(p.tva)+'</span></div>'
    +'<div class="rd-pr rd-total"><span>'+totalLabel+'</span><span>'+f(p.tvac)+'</span></div>';
}
async function _ridePrice(r){
  var p=parseFloat(r&&r.final_price)||0;
  if(!r||!r.is_subcontract){ var h=_rptR2(p/(1+TVA_RATE)); return { htva:h, pct:Math.round(TVA_RATE*100), tva:_rptR2(p-h), tvac:p }; }
  var country=null;
  if(r.driver_id && currentUser && r.driver_id===currentUser.id) country=currentProfile&&currentProfile.address_country;
  else if(r.driver_id && sb){ try{ country=((await sb.from('profiles').select('address_country').eq('id',r.driver_id).maybeSingle()).data||{}).address_country; }catch(e){} }
  var pct=_invCfg(await _docBilling()).vatFor(country), tva=_rptR2(p*pct/100);
  return { htva:p, pct:pct, tva:tva, tvac:_rptR2(p+tva) };
}
// Commission plateforme (%) définie dans Admin → Facturation, selon le pays de la flotte
async function _commPct(country){ try{ return _invCfg(await _docBilling()).commFor(country); }catch(e){ return 10; } }
async function _commPctForDriver(driverId){
  var c=null;
  if(driverId && currentUser && driverId===currentUser.id) c=currentProfile&&currentProfile.address_country;
  else if(driverId && sb){ try{ c=((await sb.from('profiles').select('address_country').eq('id',driverId).maybeSingle()).data||{}).address_country; }catch(e){} }
  return _commPct(c);
}
function _pctTxt(v){ v=Math.round((parseFloat(v)||0)*100)/100; return String(v).replace('.',','); }
function _docBleenrParty(s){
  return { name:s.company_name||'Bleenr', l1:[s.street,s.box?'bte '+s.box:''].filter(Boolean).join(' '), l2:[s.postal_code,s.city].filter(Boolean).join(' '), l3:s.country||'', vat:s.vat_number||'', business:true };
}
function _docFooter(s){
  var b=_docBleenrParty(s);
  return [b.name,[b.l1,b.l2,b.l3].filter(Boolean).join(', '),b.vat?'TVA '+b.vat:''].filter(Boolean).join(' · ');
}
function _docProfileParty(p, isBiz){
  p=p||{};
  var name = isBiz ? (p.company_name || ((p.first_name||'')+' '+(p.last_name||'')).trim()) : (((p.first_name||'')+' '+(p.last_name||'')).trim() || p.company_name);
  return { name:name||p.email||'—', l1:p.address_street||'', l2:[p.address_postal,p.address_city].filter(Boolean).join(' '),
           l3:p.address_country||'', vat:isBiz?(p.vat_number||''):'', business:!!isBiz };
}
function _docOpen(html){
  var win=window.open('','_blank');
  if(!win){ showToast('Autorisez les fenêtres pop-up pour afficher le document'); return; }
  win.document.open(); win.document.write(html); win.document.close();
}
var _DOC_TYPES={ab:'Course A → B',disposal:'Mise à disposition',mixed:'Course mixte'};
var _DOC_CLASSES={lowcost:'Economy',business:'Business',van:'Van',luxe:'Luxe',bus:'Bus',any:'Toute gamme'};

// ── Page 2 du voucher / de l'ordre de mission : contrat de transport ──
// Transporteur (fleet) ↔ client, Bleenr intermédiaire de réservation ; rappel des obligations et des règles de l'application.
// (même texte que l'app chauffeur : bleenr-chauffeur/src/lib/contract.ts)
function _docContractPage(d){
  var e=_billingEsc;
  var party=function(t,p){ return '<div class="party"><div class="lbl">'+t+'</div><div class="pname">'+e(p.name||'—')+'</div>'
    +[p.l1,p.l2,p.l3].filter(Boolean).map(function(x){return '<div>'+e(x)+'</div>';}).join('')
    +(p.vat?'<div>N° de TVA : '+e(p.vat)+'</div>':'')+(p.contact?'<div>'+e(p.contact)+'</div>':'')+'</div>'; };
  var H=d.refundH||48;
  var art=function(n,t,body){ return '<div class="ct-a"><h3>Article '+n+' — '+t+'</h3>'+body+'</div>'; };
  var ul=function(items){ return '<ul>'+items.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul>'; };
  return '<div class="page ct">'
    +'<style>.ct .top{margin-bottom:14px}.ct .logo{height:34px}.ct .num{font-size:18px}.ct .sect{margin-top:4px}.ct .ct-a{margin-top:8px}.ct h3{font-size:11.5px;font-weight:800;color:#1B5E3B;margin-bottom:2px}.ct p,.ct li{font-size:10.3px;line-height:1.42}.ct ul{padding-left:15px;margin-top:1px}.ct li{margin:0}.ct .ct-parties{display:flex;gap:14px;margin:4px 0 6px}.ct .ct-parties .party{flex:1;border:1px solid #E1E6E3;border-radius:6px;padding:8px 10px;font-size:10.5px}.ct .pname{font-size:12px}.ct .ct-sign{display:flex;gap:18px;margin-top:14px}.ct .ct-sign div{flex:1;border-top:1px solid #1A1A18;padding-top:5px;font-size:10px;color:#555}.ct .foot{margin-top:12px}</style>'
    +_docTop('Contrat de transport', d.code, ['Annexe au '+(d.mode==='voucher'?'voucher':'l’ordre de mission'), 'Émis le : '+_docDate()])
    +'<div class="sect">Entre les parties</div>'
    +'<div class="ct-parties">'+party('Le transporteur',d.carrier)+party('Le client',d.client)+'</div>'
    +'<p>Avec l’intervention de <b>'+e(d.bleenr.name)+'</b>'+(d.bleenr.l1||d.bleenr.l2?' ('+e([d.bleenr.l1,d.bleenr.l2].filter(Boolean).join(', '))+')':'')+(d.bleenr.vat?', TVA '+e(d.bleenr.vat):'')+', exploitant de la plateforme Bleenr, en qualité d’<b>intermédiaire de réservation</b>.</p>'
    +art(1,'Objet','<p>Le transporteur s’engage à effectuer pour le client le transport de personnes décrit en page 1 (référence <b>'+e(d.code)+'</b>) : '
      +e(d.summary)+', au prix convenu lors de la réservation.</p>')
    +art(2,'Rôle de Bleenr','<p>Bleenr met en relation le client et des transporteurs professionnels, transmet la demande, l’offre et la réservation, et encaisse le paiement pour le compte du transporteur. '
      +'Bleenr n’est pas transporteur et n’est pas partie au contrat de transport : l’exécution du transport relève de la seule responsabilité du transporteur. Bleenr perçoit une commission auprès du transporteur ; elle n’est pas facturée en supplément au client.</p>')
    +art(3,'Formation du contrat et prix','<p>Le contrat est conclu lorsque le client accepte l’offre du transporteur et la paie sur la plateforme. Le prix est fixé avant le départ et ne peut être modifié que selon l’article 5. '
      +'Aucun paiement ne peut être demandé ni accepté en dehors de la plateforme.</p>')
    +art(4,'Obligations du transporteur',ul([
      'Disposer des autorisations, licences, assurances et documents exigés pour le transport rémunéré de personnes, pour lui-même, ses chauffeurs et ses véhicules.',
      'Fournir un véhicule de la gamme réservée, propre, en bon état, avec assez de places pour les passagers et les bagages annoncés, et un chauffeur qualifié.',
      'Être présent au lieu de prise en charge à l’heure prévue et suivre, le cas échéant, le vol ou le train indiqué.',
      'Tenir à jour les étapes de la mission dans l’application (« En chemin » au plus tôt 4 h avant le départ, prise en charge, fin de mission) et le véhicule / chauffeur attribués.',
      'Respecter le code de la route, la sécurité et la confidentialité des passagers.',
      'Répondre à toute modification du client dans les délais (accepter, modifier son offre ou se retirer).']))
    +art(5,'Modification de la réservation',ul([
      'Le client peut modifier sa réservation jusqu’à '+H+' h avant le départ ; ensuite, seuls le passager et la note au chauffeur restent modifiables, et plus du tout une fois la course commencée.',
      'Le transporteur accepte la modification au même prix, propose un nouveau prix ou se retire. Un prix plus élevé doit être accepté et payé par le client ; un prix plus bas est appliqué et la différence remboursée.',
      'Sans réponse du client avant l’échéance, ou si le transporteur se retire et que le client ne republie pas sa demande, la course est annulée et remboursée.']))
    +art(6,'Annulation et absence',ul([
      'Annulation par le client plus de '+H+' h avant le départ : remboursement intégral. À moins de '+H+' h : aucun remboursement. Aucune annulation n’est possible une fois le chauffeur en route.',
      'Client absent au lieu de prise en charge (« No Show ») : la course est clôturée et reste due.',
      'Si le transporteur ne peut assurer la course, il prévient sans délai le client et Bleenr ; le client est remboursé intégralement.']))
    +art(7,'Obligations du client',ul([
      'Fournir des informations exactes : adresses, date et heure, nombre de passagers, bagages, numéro de vol ou de train, coordonnées du passager.',
      'Être prêt au lieu et à l’heure de prise en charge, respecter le chauffeur, le véhicule et les règles de sécurité (ceinture, comportement).',
      'Assumer les dommages causés au véhicule par les passagers.']))
    +art(8,'Obligations de Bleenr',ul([
      'Transmettre fidèlement les demandes, offres, modifications et réservations entre les parties.',
      'Sécuriser le paiement, effectuer les remboursements prévus et reverser au transporteur le prix diminué de sa commission.',
      'Traiter les signalements (menu ⋮ › « Signaler un problème ») et protéger les données personnelles des parties.']))
    +art(9,'Réclamations et droit applicable','<p>Toute réclamation est adressée via l’application ou à Bleenr, qui la transmet à la partie concernée. Le contrat est soumis au droit belge.</p>')
    +'<div class="ct-sign"><div>Le transporteur — '+e(d.carrier.name||'')+'</div><div>Le client — '+e(d.client.name||'')+'</div></div>'
    +'<p class="muted" style="margin-top:6px;">Contrat accepté électroniquement par les parties via la plateforme Bleenr lors de la confirmation de la réservation. '+e(d.footer)+'</p>'
  +'</div>';
}

// Shared body of a ride voucher / mission order
async function _docRideDocument(rideId, mode){
  if(!sb) return;
  var e=_billingEsc;
  var {data:r} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
  if(!r) return;
  var s=await _docBilling();
  var {data:ofr} = await sb.from('offers').select('*').eq('ride_id',rideId).eq('status','accepted').maybeSingle();
  var veh=null; if(ofr&&ofr.vehicle_id){ var vr=await sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',ofr.vehicle_id).maybeSingle(); veh=vr.data; }
  var fdrv=null; if(ofr&&ofr.fleet_driver_id){ try{ fdrv=(await sb.from('fleet_drivers').select('first_name,last_name,phone').eq('id',ofr.fleet_driver_id).maybeSingle()).data; }catch(_e){} }
  // Client : fleet_drivers fermée par RLS → prénom + tél. via la fonction sécurisée
  if(!fdrv && ofr && ofr.fleet_driver_id){ try{ var _rp=await sb.rpc('ride_assigned_driver',{p_ride:rideId}); if(_rp.data&&_rp.data[0]) fdrv=_rp.data[0]; }catch(_e){} }
  var fdrvName=fdrv?((fdrv.first_name||'')+' '+(fdrv.last_name||'')).trim():'';
  var nR=r.notes||'';
  var paxN=(nR.match(/\|pax:([^|]+)/)||[])[1]||'', paxT=(nR.match(/\|tel:([^|]+)/)||[])[1]||'';
  var noteD=(nR.match(/\|note_drv:([^|]+)/)||[])[1]||'';
  var dur=(nR.match(/Durée:(\d+)/)||[])[1]||'';
  var cln=nR.replace(/\|pax:[^|]*/g,'').replace(/\|(tel|pemail|pref|flight2?|train2?):[^|]*/g,'').replace(/\|note_drv:[^|]*/g,'').replace(/\|offer_note:[^|]*/g,'').replace(/^Mixte:.*$/,'').replace(/Durée:[^\s|]+/g,'').trim();
  var code=r.booking_code||r.id.slice(0,8);
  var left, right, kind, boxTitle, boxBody;

  if(mode==='voucher'){
    // Client voucher: passenger on the left, driver & vehicle on the right
    var {data:dP} = r.driver_id ? await sb.from('profiles').select('first_name,last_name,company_name,phone').eq('id',r.driver_id).maybeSingle() : {data:null};
    var cName=paxN||(currentProfile?(((currentProfile.first_name||'')+' '+(currentProfile.last_name||'')).trim()||currentProfile.company_name):'');
    var cTel=paxT||(currentProfile&&currentProfile.phone?currentProfile.phone:'');
    kind='Voucher de transport';
    left={ name:cName||'Passager', extra:[cTel?'Tél. : '+cTel:'', (r.passengers||1)+' passager(s)'].filter(Boolean) };
    right={ name:dP?((dP.company_name||((dP.first_name||'')+' '+(dP.last_name||'')).trim())||'Chauffeur'):'Chauffeur à confirmer',
            extra:[fdrvName?'Chauffeur : '+fdrvName:'', veh?((veh.brand||'')+' '+(veh.model||'')+(veh.color?' — '+veh.color:'')).trim():'', veh&&veh.plate?'Plaque : '+veh.plate:'', (fdrv&&fdrv.phone)?'Tél. : '+fdrv.phone:(dP&&dP.phone?'Tél. : '+dP.phone:'')].filter(Boolean) };
    boxTitle='Réservation confirmée';
    boxBody='<div>Présentez ce voucher à votre chauffeur le jour du départ.</div>'
      +'<div class="muted">Référence à communiquer : <b>'+e(code)+'</b></div>';
  } else {
    // Driver mission order: client / passenger on the left, assigned vehicle on the right
    var {data:clientP} = await sb.from('profiles').select('first_name,last_name,company_name,phone').eq('id',r.client_id).maybeSingle();
    var pName=paxN||(clientP?(((clientP.first_name||'')+' '+(clientP.last_name||'')).trim()||clientP.company_name):'');
    var pTel=paxT||(clientP&&clientP.phone?clientP.phone:'');
    kind='Ordre de mission';
    left={ name:pName||'Passager', extra:[pTel?'Tél. : '+pTel:'', (r.passengers||1)+' passager(s)'].filter(Boolean) };
    right={ name:veh?((veh.brand||'')+' '+(veh.model||'')).trim():'Véhicule', extra:[veh&&veh.color?'Couleur : '+veh.color:'', veh&&veh.plate?'Plaque : '+veh.plate:'', fdrvName?'Chauffeur : '+fdrvName:''].filter(Boolean) };
    boxTitle='Mission confirmée';
    boxBody='<div>Prise en charge au point de départ à l’heure indiquée.</div>'
      +'<div class="muted">Référence de la mission : <b>'+e(code)+'</b></div>';
  }

  // Trip details
  var kv=[['Date et heure', _docIso(r.ride_date)+(r.ride_time?' à '+String(r.ride_time).slice(0,5):'')],
          ['Type', (_DOC_TYPES[r.trip_type]||r.trip_type||'—')+(r.trip_type==='disposal'&&dur?' — '+dur+' h':'')],
          ['Départ', r.from_address||'—']];
  if(r.to_address) kv.push(['Arrivée', r.to_address]);
  kv.push(['Gamme', _DOC_CLASSES[r.vehicle_type]||r.vehicle_type||'—']);
  var segHtml='';
  if(r.trip_type==='mixed' && typeof parseMixedNotes==='function'){
    var segs=parseMixedNotes(nR);
    if(segs.length){
      segHtml='<div class="sect">Segments</div><table class="lines"><thead><tr><th>#</th><th>Type</th><th>Date / heure</th><th>Trajet</th></tr></thead><tbody>'
        +segs.map(function(sg,i){
          var isD=(sg.type||'').toLowerCase().indexOf('disp')>=0;
          return '<tr><td class="c">'+(i+1)+'</td><td>'+(isD?'Mise à disposition'+(sg.dur?' ('+e(sg.dur)+')':''):'Course A → B')+'</td><td>'+e(_docIso(sg.date||r.ride_date))+(sg.time?' · '+e(sg.time):'')+'</td><td>'+e(sg.from)+(sg.to?' → '+e(sg.to):'')+(sg.note?'<div class="sub">'+e(sg.note)+'</div>':'')+'</td></tr>';
        }).join('')+'</tbody></table>';
    }
  }
  var notes=[];
  var noteO=((nR.match(/\|offer_note:([^|]+)/)||[])[1]||'').trim();
  if(mode==='voucher'){
    // Voucher : note du client (pour le chauffeur) et note du chauffeur (pour le client)
    var _nc=(noteD||cln||'').trim();
    if(_nc) notes.push(['Note du client', _nc]);
    if(noteO) notes.push(['Note du chauffeur', noteO]);
  } else {
    // Ordre de mission : mêmes notes que le voucher
    var _nm=(noteD||cln||'').trim();
    if(_nm) notes.push(['Note du client', _nm]);
    if(noteO) notes.push(['Note du chauffeur', noteO]);
  }

  var sum='';
  // aucun montant sur le voucher / l'ordre de mission

  var page='<div class="page">'
    +_docTop(kind, code, ['Émis le : '+_docDate(), 'Départ : '+_docIso(r.ride_date)+(r.ride_time?' · '+String(r.ride_time).slice(0,5):'')])
    +'<div class="parties">'+_docParty('Passager',left,false)+_docParty(mode==='voucher'?'Chauffeur & véhicule':'Véhicule assigné',right,true)+'</div>'
    +'<div class="sect">Détails du trajet</div>'
    +'<table class="kv">'+kv.map(function(x){return '<tr><th>'+x[0]+'</th><td>'+e(x[1])+'</td></tr>';}).join('')+'</table>'
    +segHtml
    +(notes.length?'<div class="sect">Notes</div><table class="kv">'+notes.map(function(x){return '<tr><th>'+x[0]+'</th><td>'+e(x[1])+'</td></tr>';}).join('')+'</table>':'')
    +sum
    +'<div class="box"><div class="boxt">'+boxTitle+'</div>'+boxBody+'</div>'
    +'<div class="foot">'+e(_docFooter(s))+'</div>'
    +'</div>';
  // Page 2 : contrat de transport (transporteur ↔ client, Bleenr intermédiaire)
  var ctPage='';
  try{
    var _cp=null, _fp=null;
    if(r.client_id){ try{ _cp=(await sb.from('profiles').select('*').eq('id',r.client_id).maybeSingle()).data; }catch(_e){} }
    if(r.driver_id){ try{ _fp=(await sb.from('profiles').select('*').eq('id',r.driver_id).maybeSingle()).data; }catch(_e){} }
    var _cl=_docProfileParty(_cp, !!(_cp && (_cp.client_type==='pro' || _cp.company_name)));
    var _ca=_docProfileParty(_fp, true);
    var _prc=r.final_price?await _ridePrice(r):null;
    var _lg=_lugTxt(r.luggage_large, r.luggage_small);
    var _sm=[(_DOC_TYPES[r.trip_type]||'Course')+(r.trip_type==='disposal'&&dur?' de '+dur+' h':''),
             'le '+_docIso(r.ride_date)+(r.ride_time?' à '+String(r.ride_time).slice(0,5):''),
             'au départ de '+(r.from_address||'—')+(r.to_address?' vers '+r.to_address:''),
             'gamme '+(_DOC_CLASSES[r.vehicle_type]||r.vehicle_type||'—'),
             (r.passengers||1)+' passager(s)'+(_lg?', '+_lg:'')].join(', ');
    try{ await _loadRefundRules(); }catch(_e){}
    ctPage=_docContractPage({ mode:mode, code:code, carrier:_ca, client:_cl, bleenr:_docBleenrParty(s), summary:_sm,
      priceTvac:_prc?_rptMoney(_prc.tvac):'—', priceHtva:_prc?_rptMoney(_prc.htva):'', tvaPct:_prc?_prc.pct:'', refundH:_refundDelayHours(r), footer:_docFooter(s) });
  }catch(_e){ console.warn('contrat', _e); }
  _docOpen(_bleenrDocHtml((mode==='voucher'?'Voucher':'Mission')+' — '+code, page+ctPage));
}

window.generateMissionPdf = function(rideId){ return _docRideDocument(rideId,'mission'); };
window.generateRideVoucher = function(rideId){ return _docRideDocument(rideId,'voucher'); };

// Promote base notes to |note_drv: when a ride is confirmed
