// ── Numéro de vol / de train ─────────────────────────────────────
// Si le départ ou l'arrivée est un aéroport → champ « Numéro de vol » ; une gare → « Numéro de train ».
// Stockés dans rides.notes (tags |flight: et |train:). Le chauffeur confirmé (et le client) voient le statut
// en temps réel dans le détail de la course (Edge Function transport-status : AeroDataBox pour les vols, iRail pour les trains).
(function(){
  var RE_PLANE=/airport|aeroport|luchthaven|flughafen|aeropuerto|aeroporto|zaventem|\bbru\b|\bcrl\b/;
  var RE_TRAIN=/\bgare\b|\bstation\b|\bbahnhof\b|\bhauptbahnhof\b|stazione|estacion|\bhbf\b|centraal|\bmidi\b|\bzuid\b|eurostar|thalys|\btgv\b/;
  // Noms de rues qui contiennent « gare / station / midi » sans être une gare (Stationsplein, Rue de la Station, Bahnhofstraße…)
  var RE_STREET=/\b(rue|avenue|av|place|pl|boulevard|bd|chaussee|quai|square|allee|impasse|chemin|route|parvis|esplanade|street|st|road|rd|avenue)\.?\s+(de\s+la\s+|du\s+|des\s+|de\s+l['’]?\s*|de\s+|of\s+the\s+)?(gare|station|midi)\b|\b(gare|station)\s+(street|road|square|avenue)\b|\bstations?(plein|straat|laan|lei|weg|dreef|kaai|park|steeg)\b|\bbahnhof(s)?(str|strasse|platz|allee|weg)\b|\bapres-midi\b/g;
  var nrm=function(a){ return String(a||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(RE_STREET,' '); };
  window._trKindOf=function(a){ var s=nrm(a); return { plane:RE_PLANE.test(s), train:RE_TRAIN.test(s) }; };
  var val=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var vis=function(id){ var e=document.getElementById(id); return !!e && e.style.display!=='none'; };
  function setField(pfx, kind, show, pickup){
    var g=document.getElementById(pfx+'-'+kind+'-grp'); if(!g) return;
    g.style.display=show?'':'none';
    var l=document.getElementById(pfx+'-'+kind+'-lbl'), h=document.getElementById(pfx+'-'+kind+'-hint');
    if(kind==='flight'){
      if(l) l.textContent=pickup?'Numéro du vol d’arrivée':'Numéro du vol de départ';
      if(h) h.textContent=pickup?'Le chauffeur suivra l’heure d’atterrissage en temps réel.':'Le chauffeur verra l’heure de décollage et le terminal en temps réel.';
    } else {
      if(l) l.textContent=pickup?'Numéro du train d’arrivée':'Numéro du train de départ';
      if(h) h.textContent=pickup?'Le chauffeur suivra l’heure d’arrivée et le quai en temps réel.':'Le chauffeur verra l’heure de départ et le quai en temps réel.';
    }
  }
  // Prise en charge (départ) et dépose (arrivée) peuvent être toutes deux un aéroport / une gare :
  // deux champs côte à côte. Clés : flight / train (1er champ du genre), flight2 / train2 (2e du même genre).
  window._trPairPlan=function(fromAddr, toAddr){
    var kd=function(a){ var k=_trKindOf(a); return k.plane?'flight':k.train?'train':null; };
    var pk=kd(fromAddr), dk=toAddr==null?null:kd(toAddr), out=[];
    if(pk) out.push({ key:pk, kind:pk, pickup:true });
    if(dk) out.push({ key:dk===pk?dk+'2':dk, kind:dk, pickup:false });
    return out;
  };
  window._trPairLabel=function(kind,pickup){ return kind==='flight'?(pickup?'Numéro du vol d’arrivée':'Numéro du vol de départ'):(pickup?'Numéro du train d’arrivée':'Numéro du train de départ'); };
  // wrap : conteneur ; grp(key) → groupe du champ ; lbl(key) → libellé
  window._trPairApply=function(wrap, plan, grp, lbl){
    if(!wrap) return;
    ['flight','train','flight2','train2'].forEach(function(k){ var g=grp(k); if(g){ g.style.display='none'; g.style.order=''; } });
    plan.forEach(function(x,i){ var g=grp(x.key); if(!g) return; g.style.display=''; g.style.order=i; var l=lbl(x.key); if(l) l.textContent=_trPairLabel(x.kind,x.pickup); });
    wrap.style.display=plan.length?'':'none';
    wrap.classList.toggle('two', plan.length>1);
  };
  window._trRefresh=function(){
    var d=_trKindOf(val('disp-from'));
    var plan=_trPairPlan(val('ride-from'), val('ride-to'));
    _trPairApply(document.getElementById('ride-tr-pair'), plan, function(k){ return document.getElementById('ride-'+k+'-grp'); }, function(k){ return document.getElementById('ride-'+k+'-lbl'); });
    plan.forEach(function(x){ var h=document.getElementById('ride-'+x.key+'-hint'); if(h) h.textContent=x.kind==='flight'?(x.pickup?'Le chauffeur suivra l’heure d’atterrissage en temps réel.':'Le chauffeur verra l’heure de décollage et le terminal en temps réel.'):(x.pickup?'Le chauffeur suivra l’heure d’arrivée et le quai en temps réel.':'Le chauffeur verra l’heure de départ et le quai en temps réel.'); });
    setField('disp','flight', d.plane, true);
    setField('disp','train',  d.train, true);
  };
  document.addEventListener('input', function(e){
    var id=e.target&&e.target.id;
    if(id==='ride-from'||id==='ride-to'||id==='disp-from') _trRefresh();
    if(e.target&&e.target.classList&&e.target.classList.contains('tr-input')){ var p=e.target.selectionStart; e.target.value=e.target.value.toUpperCase().replace(/[|]/g,''); try{e.target.setSelectionRange(p,p);}catch(_){} }
  }, true);
  document.addEventListener('change', function(e){ var id=e.target&&e.target.id; if(id==='ride-from'||id==='ride-to'||id==='disp-from') _trRefresh(); }, true);

  // Numéros saisis (champs visibles seulement), validés
  window._trCollect=function(tripType){
    var pfx=tripType==='disposal'?'disp':tripType==='ab'?'ride':null; if(!pfx) return {};
    var out={};
    var fl=vis(pfx+'-flight-grp')?val(pfx+'-flight').toUpperCase().replace(/\s+/g,' ').trim():'';
    var tr=vis(pfx+'-train-grp')?val(pfx+'-train').toUpperCase().replace(/\s+/g,' ').trim():'';
    if(fl){ if(!/^[A-Z0-9]{2,3} ?\d{1,4}[A-Z]?$/.test(fl)) return {error:'Numéro de vol invalide (ex. SN 3123)'}; out.flight=fl; }
    if(tr){ if(!/^[A-Z]{0,4} ?\d{1,5}$/.test(tr)) return {error:'Numéro de train invalide (ex. IC 1832)'}; out.train=tr; }
    var fl2=vis(pfx+'-flight2-grp')?val(pfx+'-flight2').toUpperCase().replace(/\s+/g,' ').trim():'';
    var tr2=vis(pfx+'-train2-grp')?val(pfx+'-train2').toUpperCase().replace(/\s+/g,' ').trim():'';
    if(fl2){ if(!/^[A-Z0-9]{2,3} ?\d{1,4}[A-Z]?$/.test(fl2)) return {error:'Numéro du vol de départ invalide (ex. SN 3123)'}; out.flight2=fl2; }
    if(tr2){ if(!/^[A-Z]{0,4} ?\d{1,5}$/.test(tr2)) return {error:'Numéro du train de départ invalide (ex. IC 1832)'}; out.train2=tr2; }
    return out;
  };

  // ── Affichage du statut dans le détail ──
  var tag=function(n,k){ return ((String(n||'').match(new RegExp('\\|'+k+':([^|]*)'))||[])[1]||'').trim(); };
  var esc=function(x){ return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  var ICON={
    flight:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    train:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M12 3v8M8 21l2-4M16 21l-2-4"/><circle cx="8.5" cy="14" r=".6" fill="currentColor"/><circle cx="15.5" cy="14" r=".6" fill="currentColor"/></svg>'
  };
  function css(){
    if(document.getElementById('tr-css')) return;
    var st=document.createElement('style'); st.id='tr-css';
    st.textContent='.tr-hint{font-size:11.5px;color:#7A867A;margin-top:5px}'
      +'.tr-card{margin-top:12px;border:1px solid #E6EAE4;border-radius:14px;padding:12px 14px;background:#fff}'
      +'.tr-hd{display:flex;align-items:center;gap:10px}.tr-ic{width:34px;height:34px;border-radius:10px;background:#EAF4EE;color:#1B5E3B;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
      +'.tr-ttl{font-weight:700;font-size:14px;color:#1A2E1A}.tr-sub{font-size:12px;color:#7A867A;margin-top:1px}'
      +'.tr-pill{margin-left:auto;font-size:11.5px;font-weight:700;padding:4px 9px;border-radius:999px;white-space:nowrap}'
      +'.tr-ok{background:#DFF0E8;color:#1B5E3B}.tr-delayed{background:#FBF0D9;color:#92650A}.tr-cancelled{background:#F9E1DE;color:#C0392B}.tr-done{background:#EEF0EE;color:#4A564A}.tr-live{background:#E2ECF6;color:#1E4D7B}.tr-unknown{background:#EEF0EE;color:#4A564A}'
      +'.tr-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.tr-col{padding:9px 10px;border-radius:10px;background:#F7F7F7}.tr-col.focus{background:#EAF4EE;box-shadow:inset 0 0 0 1px #CFE6D8}'
      +'.tr-k{font-size:10.5px;font-weight:700;color:#7A867A;text-transform:uppercase;letter-spacing:.04em}.tr-place{font-size:12.5px;font-weight:600;color:#1A2E1A;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      +'.tr-time{font-size:19px;font-weight:700;color:#1A2E1A;margin-top:3px;letter-spacing:-.3px}.tr-time s{font-size:12.5px;font-weight:500;color:#9AA49A;margin-right:5px}.tr-time.late{color:#92650A}.tr-time.cx{color:#C0392B}'
      +'.tr-meta{font-size:11.5px;color:#4A564A;margin-top:3px}.tr-meta b.chg{color:#C0392B}.tr-foot{font-size:11px;color:#9AA49A;margin-top:8px}';
    document.head.appendChild(st);
  }
  var LIVE=['confirmed','pending_payment','active','waiting','offers'];
  // Qui voit le bloc : le client de la course et le chauffeur attribué (pas les autres chauffeurs de la marketplace)
  function canSee(r){
    var uid=currentUser&&currentUser.id;
    if(currentRole==='admin'||(currentProfile&&currentProfile.role==='admin')) return true;
    if(r.client_id&&r.client_id===uid) return true;
    return !!(r.driver_id&&r.driver_id===uid&&['confirmed','pending_payment','active','done'].indexOf(r.status)>=0);
  }
  window._trBlockHtml=function(r){
    if(r.trip_type==='mixed') return '';   // trajet mixte : vols / trains affichés dans chaque trajet
    var fl=tag(r.notes,'flight'), tr=tag(r.notes,'train'), fl2=tag(r.notes,'flight2'), tr2=tag(r.notes,'train2');
    if((!fl&&!tr&&!fl2&&!tr2)||!canSee(r)) return '';
    css();
    var live=LIVE.indexOf(r.status)>=0;
    var card=function(kind,num,slot){
      return '<div class="tr-card" id="tr-'+(slot||kind)+'"><div class="tr-hd"><span class="tr-ic">'+ICON[kind]+'</span><div style="min-width:0"><div class="tr-ttl">'+(kind==='flight'?'Vol ':'Train ')+esc(num)+'</div>'
        +'<div class="tr-sub">'+(live?'Chargement du statut…':'Renseigné par le client')+'</div></div></div></div>';
    };
    return '<div id="tr-wrap">'+(fl?card('flight',fl):'')+(tr?card('train',tr):'')+(fl2?card('flight',fl2,'flight2'):'')+(tr2?card('train',tr2,'train2'):'')+'</div>';
  };
  function point(p, label, focus, kind){
    p=p||{};
    var late=(p.delay||0)>=(kind==='flight'?10:1), changed=p.est&&p.sched&&p.est!==p.sched;
    var time=p.cancelled?'<div class="tr-time cx">'+t('app.supprime')+'</div>'
      :'<div class="tr-time'+(late?' late':'')+'">'+(changed?'<s>'+esc(p.sched)+'</s>'+esc(p.est):esc(p.est||p.sched||'—'))+'</div>';
    var meta=[];
    if(p.terminal) meta.push('Terminal '+esc(p.terminal));
    if(p.gate) meta.push('Porte '+esc(p.gate));
    if(p.belt) meta.push('Tapis '+esc(p.belt));
    if(p.platform) meta.push(p.platformChanged?'<b class="chg">'+t('app.quai')+' '+esc(p.platform)+' '+t('app.modifie')+'</b>':'Quai '+esc(p.platform));
    return '<div class="tr-col'+(focus?' focus':'')+'"><div class="tr-k">'+label+'</div><div class="tr-place">'+esc(p.place||'—')+(p.code?' <span style="color:#7A867A;font-weight:500">'+esc(p.code)+'</span>':'')+'</div>'
      +time+(meta.length?'<div class="tr-meta">'+meta.join(' · ')+'</div>':'')+'</div>';
  }
  function render(it){
    var el=document.getElementById('tr-'+(it.slot||it.kind)); if(!el) return;
    var head='<div class="tr-hd"><span class="tr-ic">'+ICON[it.kind]+'</span><div style="min-width:0"><div class="tr-ttl">'+esc((it.kind==='flight'?'Vol ':'Train ')+(it.ok&&it.label?it.label:it.number))+'</div>'
      +'<div class="tr-sub">'+esc(it.ok?[it.airline,(it.focus==='arr'?(it.kind==='flight'?'Atterrissage suivi':'Arrivée suivie'):(it.kind==='flight'?'Décollage suivi':'Départ suivi'))].filter(Boolean).join(' · '):(it.message||'Statut indisponible'))+'</div></div>'
      +(it.ok?'<span class="tr-pill tr-'+esc(it.state||'unknown')+'">'+esc(it.statusText||'')+'</span>':'')+'</div>';
    if(!it.ok){ el.innerHTML=head; return; }
    var upd=it.updatedAt?new Date(it.updatedAt):new Date();
    el.innerHTML=head+'<div class="tr-cols">'+point(it.dep,'Départ',it.focus==='dep',it.kind)+point(it.arr,'Arrivée',it.focus==='arr',it.kind)+'</div>'
      +'<div class="tr-foot">'+t('app.mis_a_jour_a')+' '+String(upd.getHours()).padStart(2,'0')+':'+String(upd.getMinutes()).padStart(2,'0')+' '+t('app.actualise_automatiquement')+'</div>';
  }
  window._trStart=function(r, gen){
    if(!document.getElementById('tr-wrap')||LIVE.indexOf(r.status)<0||typeof sb==='undefined'||!sb||!r.id) return;
    if(window._trTimer){ clearInterval(window._trTimer); window._trTimer=null; }
    var load=async function(){
      if(window._detailGen!==gen||!document.getElementById('tr-wrap')){ clearInterval(window._trTimer); window._trTimer=null; return; }
      try{
        var res=await sb.functions.invoke('transport-status',{body:{ride_id:r.id}});
        if(window._detailGen!==gen) return;
        if(res.error) throw res.error;
        ((res.data&&res.data.items)||[]).forEach(render);
      }catch(e){
        console.warn('[transport-status]', e);
        ['flight','train','flight2','train2'].forEach(function(k){ var el=document.querySelector('#tr-'+k+' .tr-sub'); if(el&&/Chargement/.test(el.textContent)) el.textContent='Statut momentanément indisponible'; });
      }
    };
    load();
    window._trTimer=setInterval(load, 60000);
  };
  if(document.readyState!=='loading') css(); else document.addEventListener('DOMContentLoaded', css);
})();

window.cancelRideModal = function(){
  closeModal('m-new-ride');
  try{ document.getElementById('m-new-ride').classList.remove('nr-recap-on'); }catch(_e){}
  try{ _evReset(); }catch(_e){}
  // Reset edit mode markers
  var editIdEl = document.getElementById('ride-edit-id');
  if(editIdEl) editIdEl.value = '';
  var titleEl = document.getElementById('ride-modal-title');
  if(titleEl) titleEl.textContent = t('new_ride_title');
  window._editHiddenTags=''; window._editRidePax=null;
  var btn = document.getElementById('btn-submit-ride');
  if(btn){ btn.disabled = false; btn.innerHTML = t('btn_publish')+' &rarr;'; }
  // Reset trip type to A→B
  document.querySelectorAll('.trip-type').forEach(function(b){
    b.classList.toggle('active', b.dataset.val==='ab');
  });
  ['panel-ab','panel-disposal','panel-mixed'].forEach(function(id){
    var p=document.getElementById(id);if(p)p.style.display=id==='panel-ab'?'block':'none';
  });
  // Clear all form fields
  ['ride-from','ride-to','ride-date','ride-time','ride-notes',
   'disp-from','disp-date','disp-time','disp-notes','ride-flight','ride-train','ride-flight2','ride-train2','disp-flight','disp-train'].forEach(function(id){
    var e=document.getElementById(id);if(e)e.value='';
  });
  var dd=document.getElementById('disp-duration');if(dd)dd.value='2';
  ['ride-lugL','ride-lugS','disp-lugL','disp-lugS'].forEach(function(id){ _lugSet(id,0); });
  document.querySelectorAll('#m-new-ride .lug-warn').forEach(function(w){ w.style.display='none'; });
  window._editTr=null; if(window._trRefresh) window._trRefresh();
  // Clear mixed segments
  var sc=document.getElementById('mixed-segments');if(sc)sc.innerHTML='';
  ['mix-cname','mix-cphone'].forEach(function(id){ var e=document.getElementById(id); if(e) e.value=''; });
  if(window._mixPM) _mixPM('one');
  if(window._mixDrv) _mixDrv('same');
  _segN=0;
  // Reset error
  var err=document.getElementById('ride-err');if(err){ err.classList.remove('show'); err.textContent=''; err.style.display=''; }
  document.querySelectorAll('#m-new-ride .fld-err').forEach(function(x){ x.classList.remove('fld-err'); });
  // Reset passenger sections
  ['ride-pax-section','disp-pax-section'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.innerHTML='';
  });
  // Init pax selector for clients (after DOM resets)
  if(currentProfile?.role==='client' || currentRole==='client'){
    setTimeout(_initPaxSelector, 80);
  }
};

// Initialize passenger selector for pro clients
window._rideSelectedPax = {};
async function _initPaxSelector(){
  if(!sb || !currentUser) return;
  var isPro = currentProfile?.client_type === 'pro';
  var ownName = (((currentProfile?.first_name||'')+' '+(currentProfile?.last_name||'')).trim()) || '';
  var ownTel  = currentProfile?.phone || '';

  // Pre-load passengers for pro
  var passList = [];
  if(isPro && sb){
    try{
      var res = await sb.from('passengers').select('*').eq('client_id',currentUser.id).order('last_name',{ascending:true});
      passList = res.data||[];
    }catch(e){}
  }
  window._newRidePassengers = passList;
  window._newRidePaxName = ownName;
  window._newRidePaxTel  = ownTel;
  var _eid = document.getElementById('ride-edit-id');
  if(_eid && _eid.value && window._editRidePax && (window._editRidePax.name||window._editRidePax.tel)){
    window._newRidePaxName = window._editRidePax.name;
    window._newRidePaxTel  = window._editRidePax.tel;
  }

  ['ride-pax-section','disp-pax-section'].forEach(function(sid){
    _renderNewRidePaxCard(sid);
  });
  if(window._mixFillPax) _mixFillPax();
}

function _renderNewRidePaxCard(sid, editing){
  var sec = document.getElementById(sid); if(!sec) return;
  var n = window._newRidePaxName||'';
  var t = window._newRidePaxTel||'';
  var esc = function(v){ return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); };
  var pencilSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
  var paxIc = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  if(!editing){
    // Même présentation que l'écran « course confirmée » (carte grise, icône + nom + téléphone)
    sec.innerHTML = '<div class="rd-card">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
        +'<div class="rd-cap">'+_T('app.informations_du_passager')+'</div>'
        +'<button id="'+sid+'-edit-btn" type="button" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--green);font-weight:600;padding:0;display:flex;align-items:center;gap:4px;font-family:\'DM Sans\',sans-serif;">'+pencilSvg+' '+_T('app.modifier')+'</button>'
      +'</div>'
      +'<div class="rd-line"><span class="rd-ic">'+paxIc+'</span><div style="min-width:0;flex:1"><div class="rd-strong"'+(n?'':' style="color:var(--ink3);font-weight:400;"')+'>'+esc(n||'Non renseigné')+'</div></div>'
        +(t?'<span class="rd-call" style="color:var(--ink2);">'+esc(t)+'</span>':'')
      +'</div>'
    +'</div>';
    document.getElementById(sid+'-edit-btn').addEventListener('click', function(){ _renderNewRidePaxCard(sid, true); });
    return;
  }
  // Modification directement dans la carte
  var isPro = currentProfile?.client_type === 'pro';
  var passList = window._newRidePassengers||[];
  var inp = 'width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;background:#fff;font-family:\'DM Sans\',sans-serif;';
  var lbl = 'font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:var(--ink2);';
  var sel = '';
  if(isPro && passList.length){
    sel = '<div style="margin-bottom:10px;"><label style="'+lbl+'">'+_T('app.choisir_un_passager')+'</label><select id="'+sid+'-pax-sel" style="'+inp+'">'
      +'<option value="">'+_T('app.choisir_un_passager_2')+'</option>'
      +passList.map(function(p){ var pn=((p.first_name||'')+' '+(p.last_name||'')).trim(), pt=p.phone||''; return '<option value="'+esc(pn)+'||'+esc(pt)+'">'+esc(pn)+(pt?' · '+esc(pt):'')+'</option>'; }).join('')
      +'</select></div>';
  }
  sec.innerHTML = '<div class="rd-card">'
    +'<div class="rd-cap" style="margin-bottom:10px;">'+_T('app.informations_du_passager')+'</div>'
    +sel
    +'<div style="margin-bottom:10px;"><label style="'+lbl+'">Nom &amp; Prénom</label><input id="'+sid+'-pax-name" type="text" value="'+esc(n)+'" placeholder="Marie Dupont" style="'+inp+'"></div>'
    +'<div><label style="'+lbl+'">'+_T('app.telephone')+'</label><input id="'+sid+'-pax-tel" type="tel" value="'+esc(t)+'" placeholder="+32 470 12 34 56" style="'+inp+'"></div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">'
      +'<button type="button" class="btn btn-secondary btn-sm" id="'+sid+'-pax-cancel">'+_T('app.annuler')+'</button>'
      +'<button type="button" class="btn btn-green btn-sm" id="'+sid+'-pax-ok">'+_T('app.enregistrer')+'</button>'
    +'</div>'
  +'</div>';
  var g = function(x){ return document.getElementById(sid+'-'+x); };
  if(g('pax-sel')) g('pax-sel').addEventListener('change', function(){ if(!this.value) return; var pts=this.value.split('||'); g('pax-name').value=pts[0]||''; g('pax-tel').value=pts[1]||''; });
  g('pax-cancel').addEventListener('click', function(){ _renderNewRidePaxCard(sid); });
  g('pax-ok').addEventListener('click', function(){
    window._newRidePaxName = (g('pax-name').value||'').trim();
    window._newRidePaxTel  = (g('pax-tel').value||'').trim();
    _renderNewRidePaxCard('ride-pax-section');
    _renderNewRidePaxCard('disp-pax-section');
    if(window._mixFillPax) _mixFillPax();
  });
  setTimeout(function(){ var x=g('pax-name'); if(x) x.focus(); }, 30);
}

function _openNewRidePaxEdit(sid){
  var existing = document.getElementById('m-pax-edit'); if(existing) existing.remove();
  var isPro = currentProfile?.client_type === 'pro';
  var passList = window._newRidePassengers||[];
  var fields = '';

  if(isPro && passList.length > 0){
    var opts = '<option value="">'+_T('app.choisir_un_passager_2')+'</option>'
      + passList.map(function(p){
          var n=((p.first_name||'')+' '+(p.last_name||'')).trim();
          var t=p.phone||'';
          return '<option value="'+n.replace(/"/g,'&quot;')+'||'+t.replace(/"/g,'&quot;')+'">'+n+(t?' · '+t:'')+'</option>';
        }).join('')
      +'<option value="__manual__">'+_T('app.autre_passager')+'</option>';
    fields += '<div class="input-group" style="margin-bottom:10px;">'
      +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">'+_T('app.choisir_un_passager')+'</label>'
      +'<select id="pax-edit-select" style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:13px;background:#fff;font-family:\'DM Sans\',sans-serif;">'
      +opts+'</select></div>'
      +'<div id="pax-edit-manual" style="display:none;">';
  }

  var n = window._newRidePaxName||'';
  var t = window._newRidePaxTel||'';
  fields += '<div style="margin-bottom:10px;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Nom &amp; Pr&eacute;nom</label>'
    +'<input id="pax-edit-name" type="text" value="'+n.replace(/"/g,'&quot;')+'" style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;font-family:\'DM Sans\',sans-serif;" placeholder="'+_T('app.marie_dupont')+'"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">T&eacute;l&eacute;phone</label>'
    +'<input id="pax-edit-phone" type="tel" value="'+t.replace(/"/g,'&quot;')+'" style="width:100%;padding:10px 12px;border:1.5px solid var(--sand3);border-radius:var(--r);font-size:14px;font-family:\'DM Sans\',sans-serif;" placeholder="+32 470 12 34 56"></div>'
    +(isPro && passList.length > 0 ? '</div>' : '');

  document.body.insertAdjacentHTML('beforeend', _paxModalHtml('Informations passager', fields, 'new-ride-pax', '__new__'));

  setTimeout(function(){
    var sel = document.getElementById('pax-edit-select');
    var manDiv = document.getElementById('pax-edit-manual');
    if(sel && manDiv){
      sel.addEventListener('change', function(){
        if(sel.value==='__manual__'){
          manDiv.style.display='block';
          document.getElementById('pax-edit-name').value='';
          document.getElementById('pax-edit-phone').value='';
        } else if(sel.value){
          manDiv.style.display='none';
          var pts=sel.value.split('||');
          document.getElementById('pax-edit-name').value=pts[0]||'';
          document.getElementById('pax-edit-phone').value=pts[1]||'';
        } else { manDiv.style.display='none'; }
      });
    }
    var btn = document.getElementById('btn-pax-save');
    if(btn) btn.addEventListener('click', function(){
      var newName = (document.getElementById('pax-edit-name')?.value||'').trim();
      var newTel  = (document.getElementById('pax-edit-phone')?.value||'').trim();
      // If dropdown selected (not manual), read from hidden fields
      var sel2 = document.getElementById('pax-edit-select');
      if(sel2 && sel2.value && sel2.value!=='__manual__'){
        var pts=sel2.value.split('||'); newName=pts[0]||newName; newTel=pts[1]||newTel;
      }
      window._newRidePaxName = newName;
      window._newRidePaxTel  = newTel;
      document.getElementById('m-pax-edit')?.remove();
      // Refresh both cards
      _renderNewRidePaxCard('ride-pax-section');
      _renderNewRidePaxCard('disp-pax-section');
      if(window._mixFillPax) _mixFillPax();
    });
  }, 10);
}



window.selTripType = function(el){
  el.closest('.trip-types').querySelectorAll('.trip-type').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  var v = el.dataset.val;
  ['panel-ab','panel-disposal','panel-mixed'].forEach(function(id){
    var p = document.getElementById(id);
    if(p) p.style.display = (id === 'panel-'+v) ? 'block' : 'none';
  });
};

window.selSubType = function(el){
  el.closest('.trip-types').querySelectorAll('.trip-type').forEach(function(b){b.classList.remove('active');});
  el.classList.add('active');
  var v = el.dataset.val;
  ['sub-panel-ab','sub-panel-disposal','sub-panel-mixed'].forEach(function(id){
    var p=document.getElementById(id); if(p) p.style.display='none';
  });
  var target = v==='ab'?'sub-panel-ab':v==='disposal'?'sub-panel-disposal':'sub-panel-mixed';
  var p=document.getElementById(target); if(p) p.style.display='block';
  if(v==='mixed' && !document.querySelector('#sub-mixed-segments .mixed-segment')) addSubSegment();   // un premier trajet prêt à remplir
};



window._editOffer = function(btn){
  var raw=btn.dataset.ride||'';
  var r=null; try{ r=JSON.parse(raw.replace(/&#39;/g,"'")); }catch(e){}
  var rId=btn.dataset.rid;
  if(!rId) return;
  _rdPushUnder('m-ride-detail');
  // Open offer modal — openOfferModal will pre-fill via _myOffers
  setTimeout(function(){ openOfferModal(rId, '', r); }, 150);
};

window._mkOfferFromDetail = function(){
  var r=window._lastDetailRide; if(!r) return;
  _rdPushUnder('m-ride-detail');
  setTimeout(function(){ openOfferModal(r.id, '', r); }, 150);
};
window._detailOffer = function(btn){
  var raw=btn.dataset.ride||'';
  var r=null; try{ r=JSON.parse(raw.replace(/&#39;/g,"'")); }catch(e){ r=null; }
  var rId=btn.dataset.rid;
  if(!r||!rId){ console.error('_detailOffer: missing data'); return; }
  _rdPushUnder('m-ride-detail');
  setTimeout(function(){ openOfferModal(rId, '', r); }, 200);
};

window.acceptSubcontract = async function(rideId){
  if(!sb||!currentUser){ showToast(t('app.non_connecte')); return; }   // sous-traitance : compte validé suffit (pas de Stripe)
  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){
    showToast(t('app.course_sous_traitee_acceptee'));
    return;
  }
  try {
    var res = await sb.rpc('accept_subcontract',{p_ride:rideId});
    if(res.error) throw res.error;
    if(!res.data) throw new Error('Cette course n\u2019est plus disponible');
    _notifyRideConfirmed(rideId, currentUser.id);
    showToast(t('app.course_acceptee'));
    if(typeof loadDriverDashboard==='function') await loadDriverDashboard();
    if(typeof loadMarketplace==='function') await loadMarketplace();
  } catch(e){
    var _se=_stripeErr(e);
    showToast(_se ? '⚠️ '+_se : t('app.erreur_2')+(e.message||e));
  }
};


window.updateSubPriceDisplay = function(val){
  var el = document.getElementById('sub-price-display');
  if(!el) return;
  el.textContent = (val && parseFloat(val) > 0) ? 'Prix proposé : '+parseFloat(val).toFixed(0)+' € HTVA' : 'Prix proposé : — € HTVA';
  el.style.display = 'block';
};

var _subSegN = 0;
window.addSubSegment = function(){
  _subSegN++;
  var n = _subSegN;
  var container = document.getElementById('sub-mixed-segments');
  if(!container) return;
  var div = document.createElement('div');
  div.className = 'mixed-segment';
  div.id = 'sub-seg-'+n;

  var paxOpts='<option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8+</option>';
  var vehOpts='<option value="lowcost">Economy</option><option value="business">Business</option><option value="van">Van</option><option value="luxe">'+t('app.luxe')+'</option><option value="bus">Bus</option>';
  var vehLbl='<label class="veh-lbl">'+t('app2.vehicule')+' <button type="button" class="veh-info" onclick="openVehGuide()" title="'+t('app.voir_les_gammes')+'">i</button></label>';

  var abFields=
    '<div class="input-group full"><label>'+t('app2.depart')+' <span style="color:var(--red)">*</span></label><input id="sub-sf-'+n+'" placeholder="'+t('app.gare_du_midi_bruxelles')+'" autocomplete="off"></div>'+
    '<div class="input-group full"><label>'+t('app2.arrivee')+' <span style="color:var(--red)">*</span></label><input id="sub-st-'+n+'" placeholder="'+t('app2.aeroport_bru')+'" autocomplete="off"></div>'+
    '<div class="input-group"><label>'+t('app.date')+' <span style="color:var(--red)">*</span></label><input type="date" id="sub-sd8-'+n+'"></div>'+
    '<div class="input-group"><label>'+t('app.heure')+' <span style="color:var(--red)">*</span></label><input type="time" id="sub-sh-'+n+'" value="08:00"></div>'+
    '<div class="input-group"><label>'+t('app.passagers')+'</label><select id="sub-spax-'+n+'">'+paxOpts+'</select></div>'+
    '<div class="input-group">'+vehLbl+'<select id="sub-sveh-'+n+'">'+vehOpts+'</select></div>'+
    _lugBlock('sub-slgL-'+n,'sub-slgS-'+n,'sub-sveh-'+n,'sub-spax-'+n)+
    '<div class="input-group full"><label>'+t('app.instructions')+'</label><textarea id="sub-snotes-'+n+'" rows="2" placeholder="'+t('app2.bagages_enfants_acces_pmr')+'"></textarea></div>';

  var dispFields=
    '<div class="input-group full"><label>'+t('app.lieu_de_prise_en_charge')+' <span style="color:var(--red)">*</span></label><input id="sub-sf-'+n+'" placeholder="'+t('app.grand_place_bruxelles')+'" autocomplete="off"></div>'+
    '<div class="input-group"><label>'+t('app.date')+' <span style="color:var(--red)">*</span></label><input type="date" id="sub-sd8-'+n+'"></div>'+
    '<div class="input-group"><label>'+t('app.heure')+' <span style="color:var(--red)">*</span></label><input type="time" id="sub-sh-'+n+'" value="08:00"></div>'+
    '<div class="input-group"><label>'+t('app2.duree_heures')+'</label><input type="number" id="sub-sdur-'+n+'" min="1" max="24" value="2" placeholder="2"></div>'+
    '<div class="input-group"><label>'+t('app.passagers')+'</label><select id="sub-spax-'+n+'">'+paxOpts+'</select></div>'+
    '<div class="input-group">'+vehLbl+'<select id="sub-sveh-'+n+'">'+vehOpts+'</select></div>'+
    _lugBlock('sub-slgL-'+n,'sub-slgS-'+n,'sub-sveh-'+n,'sub-spax-'+n)+
    '<div class="input-group full"><label>'+t('app.instructions')+'</label><textarea id="sub-snotes-'+n+'" rows="2" placeholder="'+t('app2.itineraire_arrets_prevus')+'"></textarea></div>';

  // Même présentation que les trajets mixtes du client : « Trajet n », Dupliquer / Supprimer, type en liste déroulante
  div.innerHTML=
    '<div class="ev-vh"><span class="n">'+n+'</span><span class="mix-ttl">'+t('app.trajet')+' '+n+'</span><span class="tl"><button type="button" onclick="_subSegDup('+n+')">'+t('app.dupliquer')+'</button><button type="button" class="mix-del" onclick="removeSubSegSafe('+n+')">'+t('app.supprimer')+'</button></span></div>'
    +'<div class="seg-type-btns" style="display:none;"><button class="seg-type-btn active" onclick="setSubSegType(this,'+n+',\'ab\')">A \u2192 B</button><button class="seg-type-btn" onclick="setSubSegType(this,'+n+',\'disposal\')">'+t('app.disposition')+'</button></div>'
    +'<div class="input-group" style="margin-bottom:12px;"><label>'+t('app.type_de_trajet')+'</label><select class="mix-type" onchange="var b=this.closest(\'.mixed-segment\').querySelectorAll(\'.seg-type-btn\');b[this.value===\'disposal\'?1:0].click();"><option value="ab">'+t('app.transfert_simple')+'</option><option value="disposal">'+t('app.mise_a_disposition')+'</option></select></div>'
    +'<div class="form-grid" id="sub-seg-fields-'+n+'">'+abFields+'</div>';

  container.appendChild(div);
  _subMixRenumber();
  div._abFields=abFields;
  div._dispFields=dispFields;
  var dateEl=document.getElementById('sub-sd8-'+n);
  if(dateEl){ dateEl.value=todayStr(); dateEl.min=todayStr(); }
  setTimeout(function(){ if(typeof _attachGoogleAC==='function')_attachGoogleAC(); },50);
};

window.setSubSegType=function(btn,n,t2){
  btn.closest('.seg-type-btns').querySelectorAll('.seg-type-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var seg=document.getElementById('sub-seg-'+n);
  var fieldsEl=document.getElementById('sub-seg-fields-'+n);
  var _ms=seg&&seg.querySelector('.mix-type'); if(_ms) _ms.value=t2==='disposal'?'disposal':'ab';
  if(seg&&fieldsEl){
    fieldsEl.innerHTML=t2==='disposal'?seg._dispFields:seg._abFields;
    setTimeout(function(){ if(window._vehPaxSync) _vehPaxSync(); },0);
    var dateEl=document.getElementById('sub-sd8-'+n);
    if(dateEl){ dateEl.value=todayStr(); dateEl.min=todayStr(); }
    setTimeout(function(){ if(typeof _attachGoogleAC==='function')_attachGoogleAC(); },50);
  }
};

window.removeSubSegSafe=function(n){
  var cont=document.getElementById('sub-mixed-segments');
  if(!cont)return;
  if(cont.querySelectorAll('.mixed-segment').length<=1){showToast(t('app2.il_faut_au_moins_un'));return;}
  var el=document.getElementById('sub-seg-'+n);if(el)el.remove();
  _subMixRenumber();
};
window._subMixRenumber=function(){
  var segs=[].slice.call(document.querySelectorAll('#sub-mixed-segments .mixed-segment')), k=segs.length;
  segs.forEach(function(sg,i){ var a=sg.querySelector('.ev-vh .n'), t=sg.querySelector('.mix-ttl'), dl=sg.querySelector('.mix-del'); if(a) a.textContent=i+1; if(t) t.textContent='Trajet '+(i+1); if(dl) dl.style.display=k>1?'':'none'; });
  var c=document.getElementById('sub-mix-count'); if(c) c.textContent='Trajets ('+k+')';
};
window._subSegDup=function(n){
  var src=document.getElementById('sub-seg-'+n); if(!src) return;
  var gv=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var isD=(src.querySelector('.mix-type')||{}).value==='disposal';
  var keys=['sf','st','sd8','sh','sdur','spax','sveh','snotes','slgL','slgS'], v={};
  keys.forEach(function(k){ v[k]=gv('sub-'+k+'-'+n); });
  addSubSegment(); var m=_subSegN, nw=document.getElementById('sub-seg-'+m);
  if(nw && src.nextSibling!==nw) src.parentNode.insertBefore(nw, src.nextSibling);
  if(isD){ var ms=nw.querySelector('.mix-type'); if(ms) ms.value='disposal'; setSubSegType(nw.querySelectorAll('.seg-type-btn')[1], m, 'disposal'); }
  keys.forEach(function(k){ var e=document.getElementById('sub-'+k+'-'+m); if(e&&v[k]!=='') e.value=v[k]; });
  if(window._vehPaxSync) _vehPaxSync();
  _subMixRenumber();
};

window.submitSubcontract = async function(){
  var g = function(id){ var e=document.getElementById(id); return e?e.value.trim():''; };
  var activeType = document.querySelector('#m-subcontract .trip-types:not(.aud) .trip-type.active');
  var tripType = activeType ? activeType.dataset.val : 'ab';
  var err = document.getElementById('sub-err');
  var btn = document.querySelector('#m-subcontract .btn-green');
  var from, to, date, time, pax, veh, notes, lugL=0, lugS=0;

  if(err){ err.textContent=''; err.classList.remove('show'); }

  if(tripType === 'disposal'){
    lugL=_lugVal('sub-disp-lugL'); lugS=_lugVal('sub-disp-lugS');
    from  = g('sub-disp-from');
    to    = null;
    date  = g('sub-disp-date');
    time  = g('sub-disp-time');
    pax   = g('sub-disp-pax');
    veh   = g('sub-disp-veh');
    var dur = g('sub-disp-dur') || '2';
    notes = (g('sub-disp-notes')||'') + (dur ? ' Dur\u00e9e:'+dur+'h' : '');
    if(!from||!date||!time){ if(err){ err.textContent=t('err_required'); err.classList.add('show'); } return; }
  } else if(tripType === 'mixed'){
    var segs = []; var segEls = document.querySelectorAll('#sub-mixed-segments .mixed-segment');
    segEls.forEach(function(seg){
      var n = seg.id.replace('sub-seg-','');
      var sf = g('sub-sf-'+n)||'';
      var st = g('sub-st-'+n)||'';
      var ab = seg.querySelector('.seg-type-btn.active');
      var isD = ab && ab.textContent.toLowerCase().indexOf('disp') >= 0;
      var sdt=g('sub-sd8-'+n)||'', shr=g('sub-sh-'+n)||'', spx=g('sub-spax-'+n)||'', svh=g('sub-sveh-'+n)||'', sdu=g('sub-sdur-'+n)||'';
      if(!sf || (!isD && !st) || !sdt || !shr) segs._miss=true;
      if(!segs._lead && _leadErr(sdt, shr)){ segs._lead='Trajet '+(segs.length+1)+' : il doit commencer au moins 1 heure à l’avance.'; _leadMark('sub-sd8-'+n,'sub-sh-'+n); }
      if(!segs._d){ segs._d=sdt; segs._t=shr; segs._p=spx; segs._v=svh; }
      if((parseInt(spx,10)||1)>(parseInt(segs._p,10)||1)) segs._p=spx;
      var _sl=_lugVal('sub-slgL-'+n), _ss=_lugVal('sub-slgS-'+n); lugL=Math.max(lugL,_sl); lugS=Math.max(lugS,_ss);
      segs.push((isD?'Disposition':'A>B')+(shr?'@'+shr:'')+':'+sf+(st&&!isD?'>'+st:'')+(isD&&sdu?'('+sdu+'h)':'')+(sdt?'|d:'+sdt:'')+(spx?'|p:'+spx:'')+(svh?'|v:'+svh:'')+((_sl||_ss)?'|lg:'+_sl+'/'+_ss:''));
    });
    if(segs._miss){ if(err){ err.textContent=t('err_required'); err.classList.add('show'); } return; }
    from  = segs.length ? segs[0].replace(/^[^:]+:/,'').split('>')[0].trim() : 'Mixte';
    to    = '';
    if(segs._lead){ if(err){ err.textContent=segs._lead; err.classList.add('show'); } return; }
    date  = segs._d||todayStr();
    time  = segs._t||'00:00';
    pax   = segs._p||'1';
    veh   = segs._v||null;
    notes = 'Mixte: '+segs.join(' | ');
    if(!segs.length){ if(err){ err.textContent=t('err_required'); err.classList.add('show'); } return; }
  } else {
    from  = g('sub-from');
    to    = g('sub-to');
    date  = g('sub-date');
    time  = g('sub-time');
    pax   = g('sub-pax');
    veh   = g('sub-veh');
    lugL=_lugVal('sub-lugL'); lugS=_lugVal('sub-lugS');
    notes = g('sub-notes');
    if(!from||!to||!date||!time){ if(err){ err.textContent=t('err_required'); err.classList.add('show'); } return; }
  }
  if(tripType!=='mixed' && _leadErr(date,time)){
    if(tripType==='disposal') _leadMark('sub-disp-date','sub-disp-time'); else _leadMark('sub-date','sub-time');
    if(err){ err.textContent=_leadErr(date,time); err.classList.add('show'); } return;
  }
  // Adresses : obligatoirement choisies dans la liste Google (le serveur vérifie ensuite le lieu auprès de Google)
  var _gf=[], _ge=function(id){ return document.getElementById(id); };
  if(tripType==='disposal') _gf=[{ el:_ge('sub-disp-from'), key:'from', label:t('gp.pickup') }];
  else if(tripType==='mixed'){
    document.querySelectorAll('#sub-mixed-segments .mixed-segment').forEach(function(sg,i){
      var n=sg.id.replace('sub-seg-',''), ab=sg.querySelector('.seg-type-btn.active'), isD=ab&&ab.textContent.toLowerCase().indexOf('disp')>=0;
      _gf.push({ el:_ge('sub-sf-'+n), key:'s'+i+'f', label:t('gp.trip')+' '+(i+1)+' – '+(isD?t('gp.pickup'):t('gp.from')) });
      if(!isD) _gf.push({ el:_ge('sub-st-'+n), key:'s'+i+'t', label:t('gp.trip')+' '+(i+1)+' – '+t('gp.to') });
    });
  } else _gf=[{ el:_ge('sub-from'), key:'from', label:t('gp.from') }, { el:_ge('sub-to'), key:'to', label:t('gp.to') }];
  var _gc=window._gpCheckFields ? await window._gpCheckFields(_gf) : { ids:{}, err:'' };
  if(_gc.err){ if(err){ err.textContent=_gc.err; err.classList.add('show'); } return; }
  var _pids=_gc.ids;
  if(window._vehPaxSync) _vehPaxSync();

  var priceVal = parseFloat(g('sub-price')) || null;
  // Diffusion : une sélection de chauffeurs (au moins un) ou tout le monde
  var _aud = _subAudMode(), _targets = _aud==='some' ? Object.keys(_subAud.sel) : null;
  if(_targets && !_targets.length){ if(err){ err.textContent=t('sub.aud_none'); err.classList.add('show'); } return; }
  // Final client details (shown only to the driver who accepts)
  var _clean=function(v){ return String(v||'').replace(/\|/g,'/').trim(); };
  var _cn=_clean(g('sub-cli-name')), _ct=_clean(g('sub-cli-tel')), _ce=_clean(g('sub-cli-email')), _cr=_clean(g('sub-cli-ref'));
  if(_ce && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(_ce)){ if(err){ err.textContent='E-mail du client invalide'; err.classList.add('show'); } return; }
  if(_cn) notes=(notes||'')+'|pax:'+_cn;
  if(_ct) notes=(notes||'')+'|tel:'+_ct;
  if(_ce) notes=(notes||'')+'|pemail:'+_ce;
  if(_cr) notes=(notes||'')+'|pref:'+_cr;

  // DEMO MODE
  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){
    closeModal('m-subcontract');
    showToast(t('toast_subcontract'));
    await loadDriverDashboard();
    return;
  }

  if(!sb||!currentUser){ if(err){ err.textContent='Non connect\u00e9'; err.classList.add('show'); } return; }

  if(btn) setLoading(btn, true, t('btn_publish')+' \u2192');

  var rideData = {
    client_id:     currentUser.id,
    trip_type:     tripType,
    from_address:  from,
    to_address:    to||null,
    from_place_id: tripType==='mixed' ? (_pids.s0f||null) : (_pids.from||null),
    to_place_id:   _pids.to||null,
    places:        tripType==='mixed' ? Object.keys(_pids).map(function(k){ return _pids[k]; }) : undefined,
    ride_date:     date,
    ride_time:     time,
    passengers:    parseInt(pax)||1,
    vehicle_type:  veh||null,
    luggage_large: lugL||0,
    luggage_small: lugS||0,
    notes:         notes||null,
    status:        'waiting',
    is_subcontract: true,
    final_price:   priceVal
  };

  try {
    // Création par le serveur (vérifie que la fleet est validée ; référence calculée par le serveur)
    var result = _targets
      ? await sb.rpc('api_subcontract_create', { p: rideData, p_targets: _targets })   // réservée aux chauffeurs choisis
      : await sb.rpc('api_ride_create', { p: rideData });
    if(result.error) throw result.error;
    if(result.data && result.data.id){
      rideData.booking_code = result.data.booking_code;
      rideData.id = result.data.id;
    }
    // Requester confirmation + alert to the other verified drivers
    if(currentProfile?.email){
      var _subMail = window._mailRideData(rideData, { clientName: currentProfile.first_name||'' });
      if(rideData.final_price) _subMail.price = parseFloat(rideData.final_price).toFixed(2).replace('.',',')+' \u20ac HTVA';
      window.sendMail('ride_created', currentProfile.email, _subMail);
    }
    _notifyMarketplaceDrivers(rideData);
    if(btn) setLoading(btn, false, t('btn_publish')+' \u2192');
    closeModal('m-subcontract');
    showToast(t('toast_subcontract'));
    await loadDriverDashboard();
    if(typeof loadMarketplace==='function')await loadMarketplace();
  } catch(e){
    console.error('submitRide error:', e);
    if(err){ err.textContent=e.message||'Erreur'; err.classList.add('show'); }
  } finally {
    if(btn){ setLoading(btn, false, t('btn_publish')+' \u2192'); btn.disabled=false; }
  }
};
function getDemoRides(){
  return [
    {id:'r1', from_address:'Bruxelles Centre', to_address:'Aéroport BRU', ride_date:todayStr(), ride_time:'18:30', trip_type:'ab', status:'waiting', created_at:new Date().toISOString()},
    {id:'r2', from_address:'Grand-Place', to_address:null, ride_date:tomorrowStr(), ride_time:'10:00', trip_type:'disposal', status:'offers', offers:[{count:3}], created_at:new Date().toISOString()},
    {id:'r3', from_address:'Gare du Midi', to_address:'Waterloo', ride_date:'2025-03-25', ride_time:'08:00', trip_type:'mixed', status:'confirmed', created_at:new Date().toISOString()},
    {id:'r4', from_address:'Aéroport BRU', to_address:'Hôtel Metropole', ride_date:'2025-03-22', ride_time:'14:00', trip_type:'ab', status:'done', final_price:95, created_at:new Date(Date.now()-86400000*3).toISOString()},
    {id:'r5', from_address:'Namur', to_address:'Bruxelles', ride_date:'2025-03-18', ride_time:'09:00', trip_type:'ab', status:'done', final_price:72, created_at:new Date(Date.now()-86400000*7).toISOString()},
    {id:'r6', from_address:'Liège', to_address:'Luxembourg', ride_date:'2025-03-15', ride_time:'07:15', trip_type:'ab', status:'cancelled', created_at:new Date(Date.now()-86400000*10).toISOString()},
  ];
}
function getDemoMissions(){
  return [
    {id:'m1', from_address:'Bruxelles', to_address:'Amsterdam', ride_date:todayStr(), ride_time:'15:00', trip_type:'ab', status:'confirmed', final_price:220, created_at:new Date().toISOString()},
    {id:'m2', from_address:'EU Quarter', to_address:null, ride_date:tomorrowStr(), ride_time:'09:00', trip_type:'disposal', status:'confirmed', final_price:180, created_at:new Date().toISOString()},
    {id:'m3', from_address:'Aéroport BRU', to_address:'Louvain', ride_date:'2025-03-22', ride_time:'11:00', trip_type:'ab', status:'done', final_price:85, created_at:new Date(Date.now()-86400000*3).toISOString()},
  ];
}
function getDemoMarketplace(){
  return [
    {id:'p1', from_address:'Bruxelles Centre', to_address:'Aéroport BRU', ride_date:todayStr(), ride_time:'16:30', trip_type:'ab', status:'waiting', created_at:new Date().toISOString()},
    {id:'p2', from_address:'Grand-Place', to_address:null, ride_date:tomorrowStr(), ride_time:'10:00', trip_type:'disposal', status:'waiting', created_at:new Date().toISOString()},
    {id:'p3', from_address:'Gare Midi', to_address:'Waterloo', ride_date:'2025-03-25', ride_time:'08:00', trip_type:'mixed', status:'waiting', created_at:new Date().toISOString()},
    {id:'p4', from_address:'Liège', to_address:'Luxembourg', ride_date:'2025-03-26', ride_time:'07:15', trip_type:'ab', status:'waiting', created_at:new Date().toISOString()},
  ];
}

var _offersData=[];
var _offersFilter='all'; // all, electric, hybrid
var _offersSort='asc'; // asc, desc

function renderOfferCard(o){
  var v = o.vehicle || null;
  var htva = parseFloat(o.price||0);
  var tvac = parseFloat((htva*(1+TVA_RATE)).toFixed(2));
  var priceDisplay = htva > 0 ? tvac.toFixed(2).replace('.',',')+' \u20ac' : '\u2014';
  var safeId = String(o.id).replace(/'/g,'');
  var safeDrv = String(o.driver_id||'').replace(/'/g,'');
  var safePrice = htva;

  var vehName = v ? ((v.brand||'')+' '+(v.model||'')).trim() : 'V\u00e9hicule non sp\u00e9cifi\u00e9';
  var classLabels={lowcost:'ECO',business:'BUSINESS',van:'VAN',luxe:'LUXE',bus:'BUS'};
  var classColors={lowcost:'#6B8E23',business:'#1B5E3B',van:'#2E6B4A',luxe:'#8B0000',bus:'#B8860B'};
  var vehClass = v ? (v.vehicle_class||'') : '';

  var amenLabels={electric:'100% \u00c9lectrique',hybrid:'Hybride',wifi:'Wi-Fi',water:'Eau incluse',snacks:'Snacks'};
  var amenIcons={
    electric:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    hybrid:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17l.01-.01M12 17l.01-.01M17 17l.01-.01M7 12l.01-.01M12 12l.01-.01M17 12l.01-.01"/><path d="M2 5v14a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2z"/></svg>',
    wifi:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0114 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.94 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>',
    water:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>',
    snacks:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>'
  };

  // Km inclus proposés par le chauffeur (mise à disposition / segments mise à disposition)
  var kmTags='';
  if(o.included_km && typeof o.included_km==='object'){
    var _kmSegs=_offerKmSegments(_currentPaymentRide);
    var _kmIcon='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19L8 5M20 19L16 5M12 6v2M12 11v2M12 16v2"/></svg>';
    var _kmLines=[];
    if(_kmSegs.length){
      _kmSegs.forEach(function(s){
        var v=o.included_km[String(s.idx)];
        if(v!=null) _kmLines.push((_kmSegs.length>1||s.label?'Segment '+(s.idx+1)+' : ':'')+v+' km inclus');
      });
    } else {
      Object.keys(o.included_km).forEach(function(k){ _kmLines.push(o.included_km[k]+' km inclus'); });
    }
    if(_kmLines.length){
      kmTags=_kmLines.map(function(l){ return '<span class="ofc-tag" style="font-weight:600;">'+_kmIcon+' '+l+'</span>'; }).join('');
    }
  }

  var _prices=(_offersData||[]).map(function(x){ return parseFloat(x.price||0); }).filter(function(x){ return x>0; });
  var isBest=_prices.length>1 && htva>0 && htva===Math.min.apply(null,_prices);
  var pr=o.profiles||{};
  var rating=(pr.rating_count>0 && pr.rating)?'<span class="ofc-star">\u2605 '+Number(pr.rating).toFixed(1).replace('.',',')+'</span><span>('+pr.rating_count+' '+t('app.avis')+'</span>':'';
  var clsHtml=vehClass?'<span class="ofc-cls" style="background:'+(classColors[vehClass]||'var(--ink3)')+';">'+(classLabels[vehClass]||vehClass.toUpperCase())+'</span>':'';
  var tags=(v&&v.amenities&&v.amenities.length?v.amenities.map(function(a){ return '<span class="ofc-tag">'+(amenIcons[a]||'')+' '+(amenLabels[a]||a)+'</span>'; }).join(''):'')+kmTags;
  var _lbl=function(l,val){ return '<div><span style="color:var(--ink4);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">'+l+'</span><div style="font-weight:500;color:var(--ink);">'+val+'</div></div>'; };
  // Détails du véhicule : équipements / km sur la 1re ligne, puis gamme · marque · modèle · année · couleur sur une ligne
  var details=v?((tags?'<div class="ofc-tags" style="margin:0 0 10px;">'+tags+'</div>':'')
    +'<div class="ofc-specs">'
      +(vehClass?_lbl('Gamme',classLabels[vehClass]||vehClass):'')
      +_lbl('Marque',v.brand||'—')+_lbl('Modèle',v.model||'—')
      +(v.year?_lbl('Année',v.year):'')+(v.color?_lbl('Couleur',v.color):'')
      +_lbl(t('veh.branding'),v.branded?'<span style="color:var(--amber);font-weight:600;">'+t('veh.branded_yes')+'</span>':t('veh.branded_no'))
    +'</div>'):'';
  if(details) tags='';

  return '<div class="offer-card ofc'+(isBest?' best':'')+'">'
    +(isBest?'<span class="ofc-best">'+t('app.meilleur_prix')+'</span>':'')
    +'<div class="ofc-top">'
      +'<div class="ofc-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg></div>'
      +'<div class="ofc-main"><div class="ofc-name">'+vehName+'</div>'
        +((clsHtml||rating)?'<div class="ofc-meta">'+clsHtml+rating+'</div>':'')
      +'</div>'
      +'<div class="ofc-price"><b>'+priceDisplay+'</b><small>TVAC</small></div>'
    +'</div>'
    +(tags?'<div class="ofc-tags">'+tags+'</div>':'')
    +(o.outdated_at?'<div class="ofc-msg" style="background:#FDF0EE;color:#A23A2E;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg><span>'+t('app.offre_faite_avant_votre_modification')+_rdEsc(String(o.outdated_reason||'').toLowerCase())+'). Elle ne peut pas être choisie tant que le chauffeur ne l’a pas mise à jour ; il a été prévenu.</span></div>':'')
    +(o.message?'<div class="ofc-msg"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span>'+_rdEsc(o.message)+'</span></div>':'')
    +(details?'<div id="od-detail-'+safeId+'" class="ofc-detail">'+details+'</div>':'')
    +'<div class="ofc-ft">'
      +(details?'<button class="ofc-more" onclick="_toggleOfferDetail(this)">'+t('app.details_du_vehicule')+'<svg id="od-arrow-'+safeId+'" width="12" height="12" viewBox="0 0 12 12" fill="none" style="transition:transform .2s;"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>':'')
      +(o.outdated_at?'<button class="btn btn-secondary ofc-pick" disabled title="'+t('app.le_chauffeur_doit_dabord_mettre')+'" style="opacity:.65;cursor:not-allowed;">'+t('app.en_attente_de_mise_a')+'</button>'
        :'<button class="btn btn-green ofc-pick" title="'+t('app.choisir_cette_offre')+'" data-oid="'+safeId+'" data-did="'+safeDrv+'" data-price="'+safePrice+'" onclick="_pickOffer(this)">'+t('app.choisir_2')+'</button>')
    +'</div>'
  +'</div>';
}

window._toggleOfferDetail = function(btn){
  var card = btn.closest('.offer-card');
  if(!card) return;
  // find detail div — it's the next sibling div inside the toggle container
  var detailDiv = card.querySelector('[id^="od-detail-"]');
  var arrowSvg = card.querySelector('[id^="od-arrow-"]');
  if(!detailDiv) return;
  var isOpen = getComputedStyle(detailDiv).display !== 'none';
  detailDiv.style.display = isOpen ? 'none' : 'block';
  if(arrowSvg) arrowSvg.style.transform = isOpen ? '' : 'rotate(180deg)';
  btn.style.color = isOpen ? 'var(--ink3)' : 'var(--ink)';
};

function _renderOffersFiltered(){
  var filtered=_offersData.slice();
  if(_offersFilter==='electric') filtered=filtered.filter(function(o){return o.vehicle&&o.vehicle.amenities&&o.vehicle.amenities.indexOf('electric')>=0;});
  if(_offersFilter==='hybrid') filtered=filtered.filter(function(o){return o.vehicle&&o.vehicle.amenities&&o.vehicle.amenities.indexOf('hybrid')>=0;});
  if(_offersSort==='asc') filtered.sort(function(a,b){return (a.price||0)-(b.price||0);});
  else filtered.sort(function(a,b){return (b.price||0)-(a.price||0);});
  var cardsEl=document.getElementById('offers-cards');
  if(!cardsEl)return;
  cardsEl.innerHTML=filtered.length
    ? filtered.map(function(o){return renderOfferCard(o);}).join('')
    : '<div class="empty-state"><p class="empty-text">'+t('app.aucune_offre_ne_correspond_au')+'</p></div>';
}

window._offersSetFilter=function(f,btn){
  _offersFilter=f;
  document.querySelectorAll('.offers-filter-btn').forEach(function(b){ b.classList.toggle('on', b===btn); });
  _renderOffersFiltered();
};
window._offersSetSort=function(dir,btn){
  _offersSort=dir||(_offersSort==='asc'?'desc':'asc');
  if(btn) btn.textContent='Prix '+(_offersSort==='asc'?'\u2191':'\u2193');
  _renderOffersFiltered();
};

window._pickOffer = function(btn){
  openPaymentModal(btn.dataset.oid, btn.dataset.did, parseFloat(btn.dataset.price));
};

window.openPaymentModal = function(offerId, driverId, amount){
  currentOfferId = offerId;
  currentDriverId = driverId;
  currentOfferAmount = amount;
  _selectedPaymentMethod = null;
  _stripePaymentMethodId = null;

  var _eur=function(n){ return n.toFixed(2).replace('.',',')+' €'; };
  document.getElementById('payment-amount').textContent = _eur(amount);
  var tva = amount * TVA_RATE;
  var totalTvac = amount + tva;
  document.getElementById('payment-tva').textContent = _eur(tva);
  document.getElementById('payment-total').textContent = _eur(totalTvac);
  // Crédit reporté d'une course annulée (mission_changes.sql) : déduit du montant à payer
  var _cr=parseFloat((_currentPaymentRide&&_currentPaymentRide.credit_amount)||0)||0, _pcEl=document.getElementById('payment-credit');
  window._payCredit=_cr;
  if(_pcEl){
    var _due=Math.max(0, Math.round((totalTvac-_cr)*100)/100), _back=Math.max(0, Math.round((_cr-totalTvac)*100)/100);
    _pcEl.innerHTML=_cr>0?'<div class="pay-line"><span>'+t('app.credit_course_precedente')+'</span><span style="color:var(--green);font-weight:600;">− '+_eur(Math.min(_cr,totalTvac))+'</span></div>'
      +'<div class="pay-line pay-total"><span>'+t('app.reste_a_payer')+'</span><span>'+_eur(_due)+'</span></div>'
      +(_back>0?'<div style="font-size:12px;color:var(--ink3);margin-top:6px;">'+t('app.votre_credit_depasse_le_prix')+' '+_eur(_back)+' '+t('app.vous_seront_rembourses')+'</div>':''):'';
  }
  var _tl=document.getElementById('payment-tva-label'); if(_tl) _tl.textContent='TVA '+String(+(TVA_RATE*100).toFixed(2)).replace('.',',')+' %';
  var _pr=_currentPaymentRide, _pc=_pr?(_pr.booking_code||''):'';
  document.getElementById('payment-modal-title').innerHTML=(_pc?'<span class="rd-code">'+_pc+'</span><span class="rd-sep"> · </span>':'')+'<span class="rd-sub">'+t('app.confirmation_et_paiement')+'</span>';
  // Offre choisie
  var _po=document.getElementById('payment-offer');
  if(_po){
    var _o=(_offersData||[]).find(function(x){ return String(x.id)===String(offerId); });
    if(_o){
      var _v=_o.vehicle||null, _vc=_v?(_v.vehicle_class||''):'';
      var _cl={lowcost:'ECO',business:'BUSINESS',van:'VAN',luxe:'LUXE',bus:'BUS'}, _cc={lowcost:'#6B8E23',business:'#1B5E3B',van:'#2E6B4A',luxe:'#8B0000',bus:'#B8860B'};
      var _p=_o.profiles||{};
      var _rt=(_p.rating_count>0&&_p.rating)?'<span class="ofc-star">\u2605 '+Number(_p.rating).toFixed(1).replace('.',',')+'</span><span>('+_p.rating_count+' '+t('app.avis')+'</span>':'';
      var _cls=_vc?'<span class="ofc-cls" style="background:'+(_cc[_vc]||'var(--ink3)')+';">'+(_cl[_vc]||_vc.toUpperCase())+'</span>':'';
      _po.innerHTML='<div class="ofc-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg></div>'
        +'<div style="flex:1;min-width:0;"><div class="pay-lbl">'+t('app.offre_choisie')+'</div><div class="ofc-name">'+(_v?((_v.brand||'')+' '+(_v.model||'')).trim():'Véhicule non spécifié')+'</div>'
        +((_cls||_rt)?'<div class="ofc-meta">'+_cls+_rt+'</div>':'')+'</div>';
      _po.style.display='';
    } else _po.style.display='none';
  }
  var withFees = (amount * STRIPE_FEE_MULTIPLIER).toFixed(2);
  var feePercent = ((STRIPE_FEE_MULTIPLIER - 1) * 100).toFixed(1);
  document.getElementById('stripe-fee-label').textContent = 'Des frais supplémentaires peuvent s\'appliquer';

  // Populate ride route info (same style as detail popup)
  var rideInfoEl = document.getElementById('payment-ride-info');
  if(rideInfoEl){
    var r = _currentPaymentRide;
    if(r){
      var isDisp = r.trip_type === 'disposal';
      var from = r.from_address || '\u2014';
      var to   = r.to_address   || '\u2014';
      var durStr = '';
      var kmInclus = '';
      if(isDisp && r.notes){
        var dm = r.notes.match(/Dur\u00e9e:([^\s|,\u2014]+)/);
        if(dm){ durStr = dm[1]; if(durStr.indexOf('h')<0)durStr+='h'; }
        var _pof=(_offersData||[]).find(function(x){ return String(x.id)===String(currentOfferId); });
        kmInclus=_kmText(_pof&&_pof.included_km);
      }
      var toLabel = isDisp ? '\u2014' : to;
      var iconGreen='<svg width="14" height="18" viewBox="0 0 24 30" fill="#1B5E3B"><path d="M12 0C7.6 0 4 3.6 4 8c0 5.4 8 16 8 16s8-10.6 8-16c0-4.4-3.6-8-8-8zm0 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/></svg>';
      var iconRed='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
      var html=_rideMetaChips(r)+'<div class="pay-route">';
      // Departure
      html+='<div style="display:flex;gap:14px;">'
        +'<div style="display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;">'
          +'<div style="margin-top:3px;flex-shrink:0;">'+iconGreen+'</div>'
          +'<div style="width:2px;flex:1;background:var(--sand3);min-height:10px;margin-top:2px;"></div>'
        +'</div>'
        +'<div style="flex:1;min-width:0;padding-bottom:6px;">'
          +'<div class="detail-seg-label">'+(isDisp?'LIEU DE PRISE EN CHARGE':'D\u00c9PART')+'</div>'
          +'<div class="detail-seg-addr">'+_addrNameHtml(from)+'</div>'
        +'</div>'
      +'</div>';
      // Duration line for disposal
      if(isDisp&&durStr){
        html+='<div style="display:flex;gap:14px;">'
          +'<div style="display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;">'
            +'<div style="margin-top:2px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C77A10" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>'
          +'</div>'
          +'<div style="flex:1;font-size:12px;color:var(--ink3);padding-bottom:6px;">'+durStr+'</div>'
        +'</div>';
      }
      // Arrival (course simple uniquement)
      if(!isDisp) html+='<div style="display:flex;gap:14px;">'
        +'<div style="display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;">'
          +'<div style="margin-top:3px;flex-shrink:0;">'+iconRed+'</div>'
        +'</div>'
        +'<div style="flex:1;min-width:0;padding-bottom:2px;">'
          +'<div class="detail-seg-label">'+(isDisp?'FIN DE MISSION':'ARRIV\u00c9E')+'</div>'
          +'<div class="detail-seg-addr">'+(isDisp?toLabel:_addrNameHtml(toLabel))+'</div>'
        +'</div>'
      +'</div>';
      // Km inclus for disposal
      if(isDisp&&kmInclus){
        html+='<div style="padding-left:30px;font-size:12.5px;color:var(--ink);margin-top:2px;">'+kmInclus+' <span style="color:var(--ink3);">'+t('app2.proposition_du_chauffeur')+'</span></div>';
      }
      // Distance row for A→B
      if(!isDisp){
        html+='<div id="payment-dist-row" class="rd-dist" style="display:none;font-size:12.5px;color:var(--ink3);">'
          +'<span id="payment-dist-text"></span></div>';
      }
      html+='</div>';
      if(r.trip_type==='mixed' && parseMixedNotes(r.notes||'').length) html=_mixListHtml(r);
      rideInfoEl.innerHTML=html;
      rideInfoEl.style.display = '';
      // Compute distance for A→B
      if(!isDisp && r.from_address && r.to_address && typeof google !== 'undefined' && google.maps && google.maps.DistanceMatrixService){
        (new google.maps.DistanceMatrixService()).getDistanceMatrix({
          origins: [r.from_address], destinations: [r.to_address],
          travelMode: google.maps.TravelMode.DRIVING, language: 'fr'
        }, function(res, st){
          var rowEl = document.getElementById('payment-dist-row');
          var textEl = document.getElementById('payment-dist-text');
          var e = res && res.rows && res.rows[0] && res.rows[0].elements && res.rows[0].elements[0];
          if(st === 'OK' && e && e.status === 'OK'){
            if(rowEl)rowEl.style.display='block';
            if(textEl)textEl.textContent=e.distance.text+' \u00b7 environ '+e.duration.text;
          }
        });
      }
    } else {
      rideInfoEl.style.display = 'none';
    }
  }

  // Reset to step 1
  _paymentShowStep(1);
  // Reset confirm label
  var confirmLabel = document.getElementById('payment-confirm-label');
  if(confirmLabel){ confirmLabel.textContent = 'Paiement sécurisé \u2022 Confirmation immédiate'; }
  // Reset method selection visuals
  var bankEl = document.getElementById('pm-bank');
  var stripeEl = document.getElementById('pm-stripe');
  if(bankEl){ bankEl.style.borderColor = 'var(--sand3)'; bankEl.style.background = 'var(--white)'; }
  if(stripeEl){ stripeEl.style.borderColor = 'var(--sand3)'; stripeEl.style.background = 'var(--white)'; }

  // Reset main action button
  // Card payment only (bank transfer disabled)
  _selectedPaymentMethod='stripe';
  var nextBtn=document.getElementById('payment-btn-next');
  if(nextBtn){
    var _payTvac=parseFloat((currentOfferAmount*(1+TVA_RATE)).toFixed(2));
    var _payDue=Math.max(0, Math.round((_payTvac-(window._payCredit||0))*100)/100);
    nextBtn.textContent=(window._payCredit>0&&_payDue===0)?'Confirmer avec mon crédit →':'Payer '+_payDue.toFixed(2).replace('.',',')+' € par carte';
    nextBtn.onclick=function(){ confirmStripeCheckout(_payTvac,_payTvac); };
  }

  // Clear errors
  ['payment-err','payment-err-bank','payment-err-stripe'].forEach(function(id){
    var el = document.getElementById(id); if(el){ el.classList.remove('show'); el.textContent = ''; }
  });

  // Les offres restent derrière : « retour » y ramène
  _rdPushUnder('m-view-offers');
  openModal('m-payment');
};

function _paymentShowStep(step){
  document.getElementById('payment-step-1').style.display    = step === 1 ? '' : 'none';
  document.getElementById('payment-step-bank').style.display   = step === 'bank' ? '' : 'none';
  document.getElementById('payment-step-stripe').style.display = step === 'stripe' ? '' : 'none';

  // Compact summary margin on bank step to save vertical space
  var summaryEl = document.getElementById('payment-summary');
  if(summaryEl) summaryEl.style.marginBottom = step === 'bank' ? '10px' : '20px';

  document.getElementById('payment-btn-next').style.display = step === 1 ? '' : 'none';
  var cancelBtn = document.getElementById('payment-btn-cancel');
  if(cancelBtn) cancelBtn.style.display = step === 'bank' ? 'none' : '';
  var backBtn = document.getElementById('payment-btn-back');
  if(backBtn) backBtn.style.display = step !== 1 ? '' : 'none';
  var confirmBankBtn = document.getElementById('payment-btn-confirm-bank');
  if(confirmBankBtn) confirmBankBtn.style.display = step === 'bank' ? '' : 'none';
  var confirmStripeBtn = document.getElementById('payment-btn-confirm-stripe');
  if(confirmStripeBtn) confirmStripeBtn.style.display = step === 'stripe' ? '' : 'none';

  if(step === 'stripe'){
    // Show TVAC (HTVA × 1.06) — Stripe fees handled separately by Stripe
    var totalTvac2 = (currentOfferAmount * (1 + TVA_RATE)).toFixed(2);
    if(confirmStripeBtn) confirmStripeBtn.textContent = 'Payer ' + totalTvac2 + ' € →';
    _mountStripeCard();
  }
  if(step === 'bank'){
    var bankRef = (_currentPaymentRide && _currentPaymentRide.booking_code) ? _currentPaymentRide.booking_code : 'BLEENR';
    document.getElementById('bank-ref').textContent = bankRef;
    var bankTvac = currentOfferAmount * (1 + TVA_RATE);
    document.getElementById('bank-amount').textContent = bankTvac.toFixed(2) + ' €';
    var confirmBankBtn2 = document.getElementById('payment-btn-confirm-bank');
    if(confirmBankBtn2) confirmBankBtn2.textContent = 'Paiement effectu\u00e9';
  }
}

function _isStripeReady(){
  return typeof Stripe !== 'undefined' && /^pk_(test|live)_/.test(STRIPE_PK) && !STRIPE_PK.includes('REPLACE_WITH');
}

function _mountStripeCard(){
  var container = document.getElementById('stripe-card-element');
  // Destroy old element if present
  if(_stripeCardElement){
    try{ _stripeCardElement.unmount(); }catch(e){ /* unmount may throw if already detached — safe to ignore */ }
    _stripeCardElement = null;
  }
  container.innerHTML = '';

  if(!_isStripeReady()){
    container.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--ink3);">'+t('app2.le_paiement_par_carte_n')+'</div>';
    return;
  }

  if(!_stripeInstance){ _stripeInstance = Stripe(STRIPE_PK); }
  var elements = _stripeInstance.elements();
  _stripeCardElement = elements.create('card', {
    style:{ base:{ fontFamily:'\'DM Sans\', sans-serif', fontSize:'14px', color:'#0E0E0C', '::placeholder':{ color:'#B0B0A6' } } }
  });
  _stripeCardElement.mount(container);
  _stripeCardElement.on('change', function(e){
    var errDiv = document.getElementById('stripe-card-errors');
    if(e.error){ errDiv.textContent = e.error.message; errDiv.style.display = 'block'; }
    else { errDiv.textContent = ''; errDiv.style.display = 'none'; }
  });
}

window.selectPaymentMethod = function(method){
  _selectedPaymentMethod = method;
  var bankEl   = document.getElementById('pm-bank');
  var stripeEl = document.getElementById('pm-stripe');
  if(bankEl){
    bankEl.style.borderColor = method === 'bank_transfer' ? 'var(--green)' : 'var(--sand3)';
    bankEl.style.background  = method === 'bank_transfer' ? 'var(--green-bg)' : 'var(--white)';
  }
  if(stripeEl){
    stripeEl.style.borderColor = method === 'stripe' ? 'var(--green)' : 'var(--sand3)';
    stripeEl.style.background  = method === 'stripe' ? 'var(--green-bg)' : 'var(--white)';
  }
  // Update the main button based on selection
  var nextBtn=document.getElementById('payment-btn-next');
  if(nextBtn){
    if(method==='stripe'){
      // Compute amount once here so button label and Stripe charge are identical
      var totalTvac=parseFloat((currentOfferAmount*(1+TVA_RATE)).toFixed(2));
      var _due2=Math.max(0, Math.round((totalTvac-(window._payCredit||0))*100)/100);
      var totalStripe=_due2.toFixed(2).replace('.',',');
      nextBtn.textContent=(window._payCredit>0&&_due2===0)?'Confirmer avec mon crédit \u2192':'Payer '+totalStripe+' \u20ac via Stripe \u2192';
      nextBtn.onclick=function(){confirmStripeCheckout(totalTvac,totalTvac);};
    } else {
      // Immediately show bank transfer details
      _paymentShowStep('bank');
    }
  }
};

// Appel d'une Edge Function avec la session de l'utilisateur connecté
// Jeton de session valide (rafraîchi s'il expire dans moins d'une minute)
async function _userToken(forceRefresh){
  try{
    var s=null;
    if(!forceRefresh){ var g=await sb.auth.getSession(); s=g&&g.data?g.data.session:null; }
    if(forceRefresh || !s || (s.expires_at && s.expires_at*1000 < Date.now()+60000)){
      var r=await sb.auth.refreshSession();
      if(r&&r.data&&r.data.session) s=r.data.session;
    }
    if(s&&s.access_token){ window._sbToken=s.access_token; return s.access_token; }
  }catch(e){ console.warn('[session]', e); }
  return window._sbToken||null;
}
async function _callEdge(name, body){
  var call=async function(tok){
    var resp=await fetch(SB_URL+'/functions/v1/'+name,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':SB_KEY},
      body:JSON.stringify(body||{})
    });
    var txt=await resp.text(), data; try{ data=JSON.parse(txt); }catch(e){ data={error:txt.slice(0,150)}; }
    if(!resp.ok && !data.error) data.error='Erreur serveur ('+resp.status+')';
    data._status=resp.status;
    return data;
  };
  var tok=await _userToken(false);
  if(!tok) return { error:'Votre session a expiré. Merci de vous reconnecter.' };
  var data=await call(tok);
  // Jeton refusé : on rafraîchit la session et on réessaie une fois
  if(data._status===401){
    var tok2=await _userToken(true);
    if(tok2 && tok2!==tok) data=await call(tok2);
  }
  return data;
}

window.confirmStripeCheckout=async function(amount,totalTvac){
  var btn=document.getElementById('payment-btn-next');
  var errEl=document.getElementById('payment-err');
  if(!sb||!currentRideId||!currentOfferId)return;
  if(btn)setLoading(btn,true,t('app.redirection_vers_stripe'));

  try{
    // Use the exact amount shown on the Payer button (computed in selectPaymentMethod)
    if(amount===undefined||totalTvac===undefined){
      totalTvac=parseFloat((currentOfferAmount*(1+TVA_RATE)).toFixed(2));
      amount=totalTvac;
    }
    localStorage.setItem('stripe_pending_tvac',totalTvac.toFixed(2));
    console.log('[stripe] HTVA:', currentOfferAmount, 'TVAC:', totalTvac, 'amount:', amount, 'ride:', currentRideId);
    // Le montant est recalculé par le serveur à partir de l'offre
    var result=await _callEdge('create-checkout',{rideId:currentRideId,offerId:currentOfferId,returnUrl:location.origin+location.pathname});
    if(result.error) throw new Error(result.error);
    if(result.confirmed){ await _creditConfirmed(currentRideId, result); return; }
    if(!result.url)throw new Error('Lien de paiement manquant');
    window.location.href=result.url;
  }catch(e){
    if(errEl){showError(errEl,e.message||'Erreur de redirection Stripe');}
    if(btn)setLoading(btn,false,t('app.payer_par_carte_bancaire'));
  }
};


// ══ MISSION MODIFIÉE APRÈS CONFIRMATION (mission_changes.sql) ══
function _chgEur(v){ return (Math.round((parseFloat(v)||0)*100)/100).toFixed(2).replace('.',',')+' €'; }
function _chgWhen(ts){ if(!ts) return ''; var d=new Date(ts); return d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'')+' à '+d.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'}); }
function _chgList(sum){ var it=String(sum||'').split(' · ').filter(Boolean); return it.length?'<ul class="chg-ul">'+it.map(function(x){
  var m=x.match(/^(Trajet \d+)( — | ajouté : | supprimé : )(.*)$/);
  if(m){
    if(m[2]===' — ') return '<li><b>'+_rdEsc(m[1])+'</b> — '+m[3].split(', ').map(function(y){ var q=y.split(' : '); return _rdEsc(q[0])+(q[1]?' : <b>'+_rdEsc(q.slice(1).join(' : '))+'</b>':''); }).join(' · ')+'</li>';
    return '<li><b>'+_rdEsc(m[1])+(m[2].indexOf('ajout')>=0?' ajouté':' supprimé')+'</b> : '+_rdEsc(m[3])+'</li>';
  }
  var p=x.split(' : '); return '<li>'+_rdEsc(p[0])+(p[1]?' : <b>'+_rdEsc(p.slice(1).join(' : '))+'</b>':'')+'</li>'; }).join('')+'</ul>':''; }
// Offre faite avant une modification de la demande : ce qui a changé (chauffeur)
window._outdBannerHtml=function(o, inModal){
  return '<div class="chg-ban r"><b class="chg-t"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="vertical-align:-2px;margin-right:6px;"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>'+_rdEsc(o.reason||'La demande a été modifiée')+'</b>'
    +(o.changes?_chgList(o.changes):'')
    +'<div class="chg-sm">'+(inModal?'Revoyez votre prix et vos kilomètres inclus, puis mettez votre offre à jour.':'Le client a modifié sa demande après votre offre. Elle ne peut pas être choisie tant que vous ne l’avez pas mise à jour.')+'</div>'
    +(inModal?'':'<div class="chg-act"><button type="button" class="btn btn-red-solid" onclick="_mkOfferFromDetail()">'+t('app.mettre_a_jour_mon_offre')+'</button></div>')
    +'</div>';
};
window._chgBannerHtml=function(r, isClient){
  var st=r.change_state, code=_rdEsc(r.booking_code||''), id=_rdEsc(r.id);
  var paid=parseFloat(r.final_price)||0, htva=Math.round(paid/(1+TVA_RATE)*100)/100;
  if(isClient){
    if(st==='to_review') return '<div class="chg-ban o"><b class="chg-t"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="vertical-align:-2px;margin-right:6px;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'+t('app.modification_envoyee_a_votre_chauffeur')+'</b>'+_chgList(r.change_summary)+'<div class="chg-sm">'+t('app.en_attente_de_sa_reponse')+'</div></div>';
    if(st==='supplement'){
      var sup=parseFloat(r.supp_amount)||0;
      return '<div class="chg-ban b"><b class="chg-t">'+t('app.votre_chauffeur_demande_un_supplement')+' '+_chgEur(sup)+'</b>'
        +'Suite à votre modification, le prix passe de '+_chgEur(paid)+' à <b>'+_chgEur(paid+sup)+' TVAC</b>.'
        +(r.supp_message?'<div class="chg-msg">« '+_rdEsc(r.supp_message)+' »</div>':'')
        +'<div class="chg-kv"><span>'+t('app.deja_paye')+'</span><span>'+_chgEur(paid)+'</span></div><div class="chg-kv"><span>'+t('app.supplement')+'</span><b>+ '+_chgEur(sup)+'</b></div><div class="chg-kv"><span>'+t('app.nouveau_total_2')+'</span><b>'+_chgEur(paid+sup)+' TVAC</b></div>'
        +(r.supp_deadline?'<div class="chg-sm">'+t('app.repondez_avant_le')+' <b>'+_chgWhen(r.supp_deadline)+'</b>'+t('app.sans_reponse_la_course_sera')+'</div>':'')
        +'<div class="chg-act"><button type="button" class="btn chg-no" onclick="_chgChoice(\''+id+'\',\'supplement\')">'+t('app.refuser')+'</button><button type="button" class="btn btn-green" onclick="_chgPaySupp(this,\''+id+'\')">Payer '+_chgEur(sup)+' →</button></div></div>';
    }
    if(st==='withdrawn') return '<div class="chg-ban r"><b class="chg-t">'+t('app.votre_chauffeur_sest_retire')+'</b>'+t('app.suite_a_votre_modification_il')
      +(r.supp_message?'<div class="chg-msg">« '+_rdEsc(r.supp_message)+' »</div>':'')
      +(r.supp_deadline?'<div class="chg-sm">'+t('app.choisissez_avant_le')+' <b>'+_chgWhen(r.supp_deadline)+'</b>'+t('app.sinon_la_course_sera_annulee')+'</div>':'')
      +'<div class="chg-act"><button type="button" class="btn btn-green" onclick="_chgChoice(\''+id+'\',\'withdrawn\')">'+t('app.choisir_la_suite')+'</button></div></div>';
    return '';
  }
  // Chauffeur
  if(st==='to_review') return '<div class="chg-ban o"><b class="chg-t">'+t('app.le_client_a_modifie_cette')+'</b>'+_chgList(r.change_summary)+'</div>'
    +'<div class="chg-box"><div class="chg-kv"><span>'+t('app.prix_paye_par_le_client')+'</span><b>'+_chgEur(paid)+' TVAC</b></div><div class="chg-kv"><span>'+t('app.soit_htva')+'</span><b>'+_chgEur(htva)+'</b></div>'
    +'<div class="chg-q">'+t('app.que_souhaitez_vous_faire')+'</div>'
    +'<label class="chg-opt"><input type="radio" name="chg-act" value="accept" onchange="_chgOpt(this)"><span><b>'+t('app.jaccepte_la_modification')+'</b><small>'+t('app.au_meme_prix_la_mission')+'</small></span></label>'
    +'<label class="chg-opt"><input type="radio" name="chg-act" value="supplement" onchange="_chgOpt(this)"><span style="flex:1;"><b>'+t('app.je_modifie_mon_offre')+'</b><small>'+t('app.prix_plus_eleve_le_client')+'</small>'
      +'<span class="chg-supp" style="display:none;"><span class="chg-lbl">'+t('app.nouveau_prix_total_htva')+'</span><input type="number" id="chg-price" min="1" step="1" inputmode="decimal" placeholder="'+Math.ceil(htva+10)+'" data-paid="'+paid+'" oninput="_chgPrev()">'
      +'<span class="chg-prev" id="chg-prev"></span><span class="chg-lbl">'+t('app.message_au_client_optionnel')+'</span><textarea id="chg-msg" rows="2" maxlength="500" placeholder="'+t('app.trajet_plus_long_attente_supplementaire')+'"></textarea></span></span></label>'
    +'<label class="chg-opt"><input type="radio" name="chg-act" value="withdraw" onchange="_chgOpt(this)"><span><b style="color:var(--red);">'+t('app.je_me_retire_de_la')+'</b><small>'+t('app.le_client_est_prevenu_et')+'</small></span></label>'
    +'<div id="chg-err" class="auth-error"></div>'
    +'<div class="chg-act"><button type="button" class="btn btn-green" onclick="_chgSend(this,\''+id+'\')">'+t('app.envoyer_ma_reponse')+'</button></div></div>';
  if(st==='supplement') return '<div class="chg-ban b"><b class="chg-t">'+t('app.supplement_demande')+' '+_chgEur(r.supp_amount)+'</b>'+t('app.en_attente_de_la_reponse')+(r.supp_deadline?' (au plus tard le '+_chgWhen(r.supp_deadline)+')':'')+t('app.sans_reponse_la_mission_sera')+'</div>';
  if(st==='withdrawn') return '<div class="chg-ban r"><b class="chg-t">'+t('app.vous_vous_etes_retire_de')+'</b>'+t('app.en_attente_de_la_decision')+'</div>';
  return '';
};
window._chgOpt=function(el){
  document.querySelectorAll('.chg-opt').forEach(function(o){ o.classList.toggle('on', o.contains(el)&&el.checked); });
  var sp=document.querySelector('.chg-supp'); if(sp) sp.style.display=el.value==='supplement'?'':'none';
  if(el.value==='supplement') setTimeout(function(){ var i=document.getElementById('chg-price'); if(i) i.focus(); },50);
};
window._chgPrev=function(){
  var i=document.getElementById('chg-price'), pv=document.getElementById('chg-prev'); if(!i||!pv) return;
  var p=parseFloat(String(i.value).replace(',','.')), paid=parseFloat(i.getAttribute('data-paid'))||0;
  if(!(p>0)){ pv.textContent=''; return; }
  var sup=Math.round((p*(1+TVA_RATE)-paid)*100)/100;
  pv.innerHTML=sup>=0.5?t('app.supplement_pour_le_client')+' <b>+ '+_chgEur(sup)+' TVAC</b> '+t('app.nouveau_total')+' '+_chgEur(paid+sup)+')'
    :sup<=-0.5?t('app.prix_revu_a_la_baisse')+' <b>'+_chgEur(-sup)+' TVAC</b> '+t('app.rembourses_au_client_nouveau_total')+' '+_chgEur(paid+sup)+')'
    :'<span style="color:var(--red);">'+t('app.prix_identique_au_prix_paye')+'</span>';
};
function _chgRefresh(){ try{ closeModal('m-ride-detail'); }catch(e){} var a=document.querySelector('.page.active'); if(a) showPage(a.id.replace('page-','')); }
window._chgSend=async function(btn, rideId){
  var sel=document.querySelector('input[name="chg-act"]:checked'), err=document.getElementById('chg-err');
  var fail=function(m){ if(err) showError(err,m); };
  if(!sel) return fail('Choisissez une réponse.');
  var price=null, msg=(document.getElementById('chg-msg')||{}).value||'';
  if(sel.value==='supplement'){ price=parseFloat(String((document.getElementById('chg-price')||{}).value||'').replace(',','.')); if(!(price>0)) return fail('Indiquez le nouveau prix total HTVA.'); }
  if(sel.value==='withdraw' && !confirm('Vous retirer de cette mission ? Le client sera prévenu.')) return;
  btn.disabled=true;
  try{
    var res=await sb.rpc('api_mission_reply',{ p_ride:rideId, p_action:sel.value, p_price:price, p_message:msg||null });
    if(res.error) throw res.error;
    showToast(sel.value==='accept'?'✅ Modification acceptée':sel.value==='supplement'?(res.data&&res.data.refund?'✅ Nouveau prix appliqué — le client sera remboursé':'✅ Nouveau prix envoyé au client'):'Vous vous êtes retiré de la mission');
    _chgRefresh();
  }catch(e){ fail(e.message||String(e)); btn.disabled=false; }
};
window._chgPaySupp=async function(btn, rideId){
  btn.disabled=true; var t0=btn.textContent; btn.textContent='Redirection vers Stripe…';
  try{
    var d=await _callEdge('create-checkout',{ rideId:rideId, kind:'supplement', returnUrl:location.origin+location.pathname });
    if(d.error) throw new Error(d.error);
    if(!d.url) throw new Error('Lien de paiement manquant');
    window.location.href=d.url;
  }catch(e){ showToast('⚠️ '+(e.message||e)); btn.disabled=false; btn.textContent=t0; }
};
// Refus du supplément / chauffeur retiré : annuler ou republier (remboursé ou en crédit)
window._chgChoice=function(rideId, why){
  var r=null; try{ r=(window._lastDetailRide&&window._lastDetailRide.id===rideId)?window._lastDetailRide:null; }catch(e){}
  var paid=r?parseFloat(r.final_price)||0:0;
  var old=document.getElementById('m-chg-choice'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend','<div class="modal-overlay" id="m-chg-choice"><div class="modal" style="max-width:460px;">'
    +'<div class="modal-hd"><span class="modal-title">'+(why==='withdrawn'?'Votre chauffeur s’est retiré':'Refuser le supplément')+'</span><button class="close-btn" onclick="closeModal(\'m-chg-choice\')"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>'
    +'<div class="modal-body" style="display:flex;flex-direction:column;gap:10px;">'
    +'<div style="font-size:13px;color:var(--ink3);">'+t('app.la_course_actuelle_sera_annulee')+'</div>'
    +'<label class="chg-opt"><input type="radio" name="chg-ch" value="cancel" onchange="_chgCh(this)"><span><b>'+t('app.annuler_definitivement')+'</b><small>'+t('app.remboursement_integral')+(paid?' de '+_chgEur(paid):'')+' '+t('app.sous_5_a_10_jours')+'</small></span></label>'
    +'<label class="chg-opt"><input type="radio" name="chg-ch" value="republish" onchange="_chgCh(this)"><span style="flex:1;"><b>'+t('app.remettre_ma_demande_sur_le')+'</b><small>Une nouvelle demande identique est publiée ; les chauffeurs (y compris l’actuel) peuvent refaire une offre.</small>'
      +'<span class="chg-sub" style="display:none;">'
      +'<label class="chg-opt sm"><input type="radio" name="chg-pay" value="republish_refund" checked><span><b>'+t('app.etre_rembourse_maintenant')+'</b><small>'+(paid?_chgEur(paid)+' remboursés ; ':'')+t('app.je_paierai_la_nouvelle_offre')+'</small></span></label>'
      +'<label class="chg-opt sm"><input type="radio" name="chg-pay" value="republish_credit"><span><b>'+t('app.garder')+' '+(paid?_chgEur(paid):'le montant payé')+' '+t('app.en_credit')+'</b><small>'+t('app.deduit_de_la_nouvelle_offre')+'</small></span></label>'
      +'</span></span></label>'
    +'<div id="chg-ch-err" class="auth-error"></div></div>'
    +'<div class="modal-ft"><button class="btn btn-secondary" onclick="closeModal(\'m-chg-choice\')">'+t('app.retour')+'</button><button class="btn btn-green" onclick="_chgDecline(this,\''+_rdEsc(rideId)+'\')">'+t('app.confirmer')+'</button></div>'
    +'</div></div>');
  openModal('m-chg-choice');
};
window._chgCh=function(el){
  document.querySelectorAll('#m-chg-choice > .modal > .modal-body > .chg-opt').forEach(function(o){ o.classList.toggle('on', o.contains(el)&&el.checked); });
  var sb2=document.querySelector('#m-chg-choice .chg-sub'); if(sb2) sb2.style.display=el.value==='republish'?'':'none';
};
window._chgDecline=async function(btn, rideId){
  var c=document.querySelector('input[name="chg-ch"]:checked'), err=document.getElementById('chg-ch-err');
  if(!c){ showError(err,t('app.choisissez_une_option')); return; }
  var choice=c.value==='cancel'?'cancel':((document.querySelector('input[name="chg-pay"]:checked')||{}).value||'republish_refund');
  btn.disabled=true;
  try{
    var res=await sb.rpc('api_change_decline',{ p_ride:rideId, p_choice:choice });
    if(res.error) throw res.error;
    closeModal('m-chg-choice');
    var d=res.data||{};
    showToast(choice==='cancel'?'Course annulée — vous serez remboursé intégralement':choice==='republish_credit'?'✅ Demande republiée ('+(d.booking_code||'')+') avec votre crédit de '+_chgEur(d.credit):'✅ Demande republiée ('+(d.booking_code||'')+') — vous serez remboursé');
    _chgRefresh();
  }catch(e){ showError(err, e.message||String(e)); btn.disabled=false; }
};
// Délais dépassés (supplément sans réponse…) : traités à l'ouverture des listes (et toutes les 10 min par le serveur)
// Client : modification envoyée au chauffeur → « Confirmée » en orange avec une petite horloge (en attente de sa réponse)
function _chgPending(r){ return !!r && r.status==='confirmed' && (r.change_state==='to_review'||r.change_state==='supplement'); }
// Libellé orange (avec horloge) : modification à valider → « Confirmée » ; supplément → « Supplément demandé / en attente »
function _chgStatusLbl(r){
  if(r && r.change_state==='supplement') return currentRole==='client'?'Supplément demandé':'Supplément en attente';
  return String(t('confirmed')).replace(/^\s*●\s*/,'');
}
function _chgConfirmedPill(r){
  var tip=r&&r.change_state==='supplement'?(currentRole==='client'?'Votre chauffeur demande un supplément — à payer ou refuser':'En attente de la réponse du client'):(currentRole==='client'?'Modification envoyée — en attente de la réponse du chauffeur':'Mission modifiée par le client — à valider');
  return '<span class="pill" title="'+tip+'" style="background:#FFF1DC;color:#9A5B00;display:inline-flex;align-items:center;gap:5px;">'
    +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'+_chgStatusLbl(r)+'</span>';
}
// Pastille dans les listes : mission modifiée en attente d'une réponse
function _chgPill(r){
  if(!r || r.status!=='confirmed' || !r.change_state) return '';
  var cl=currentRole==='client';
  if(cl && r.change_state==='to_review') return '';
  var m={ to_review:['o','À valider'], supplement:cl?['o','Supplément demandé']:['o','Supplément en attente'], withdrawn:cl?['r','Chauffeur retiré']:['r','Retiré'] }[r.change_state];
  return m?'<span class="chg-pill '+m[0]+'">'+m[1]+'</span>':'';
}
window._chgExpire=function(){ if(sb && currentUser && localStorage.getItem(DEMO_MODE_KEY)!=='1') sb.rpc('expire_mission_changes').then(function(){}).catch(function(){}); };
// Offre entièrement couverte par le crédit : confirmée par le serveur sans paiement
async function _creditConfirmed(rideId, res){
  closeModal('m-payment'); closeModal('m-view-offers');
  try{ _notifyRideConfirmed(rideId, null); }catch(e){}
  if(typeof loadClientDashboard==='function') await loadClientDashboard();
  showToast(t('app.course_confirmee_grace_a_votre')+(res.refund>0?' — '+Number(res.refund).toFixed(2).replace('.',',')+' € vous seront remboursés':''));
}
window.paymentNextStep = function(){
  var errEl = document.getElementById('payment-err');
  if(!_selectedPaymentMethod){
    if(errEl){ showError(errEl, t('app.veuillez_selectionner_un_mode_de')); } return;
  }
  if(errEl){ errEl.classList.remove('show'); errEl.textContent = ''; }
  var confirmLabel = document.getElementById('payment-confirm-label');
  if(confirmLabel){
    confirmLabel.textContent = _selectedPaymentMethod === 'stripe'
      ? 'Paiement sécurisé \u2022 Confirmation immédiate'
      : 'Paiement sécurisé \u2022 Confirmation immédiate*';
  }
  _paymentShowStep(_selectedPaymentMethod === 'bank_transfer' ? 'bank' : 'stripe');
};

window.paymentGoBack = function(){
  _paymentShowStep(1);
};

window.confirmPayment = async function(method){
  var errEl = document.getElementById(method === 'bank_transfer' ? 'payment-err-bank' : 'payment-err');
  if(errEl){ errEl.classList.remove('show'); errEl.textContent = ''; }
  // Confirmation sans paiement Stripe vérifié : désactivée (sécurité, voir confirm_ride_offer côté serveur)
  if(localStorage.getItem(DEMO_MODE_KEY) !== '1'){
    if(errEl) showError(errEl, t('app2.le_paiement_par_virement_nest'));
    return;
  }

  // Amount is always HTVA × (1 + TVA) = TVAC — no Stripe fee multiplier added to stored price
  var totalTvac = parseFloat((currentOfferAmount * (1 + TVA_RATE)).toFixed(2));
  var paymentStatus = method === 'stripe' ? 'confirmed' : 'pending_payment';

  if(localStorage.getItem(DEMO_MODE_KEY) === '1'){
    closeModal('m-payment');
    showToast(t('toast_offer_acc'));
    return;
  }

  // Paiement : uniquement par Stripe, confirmé par le serveur (verify-checkout / stripe-webhook)
};

window.confirmStripePayment=async function(){
  var errEl=document.getElementById('payment-err-stripe');if(errEl){errEl.classList.remove('show');errEl.textContent='';}
  var btn=document.getElementById('payment-btn-confirm-stripe');if(btn)setLoading(btn,true,t('app.redirection'));
  try{
    var totalTvac=parseFloat((currentOfferAmount*(1+TVA_RATE)).toFixed(2));
    localStorage.setItem('stripe_pending_tvac',totalTvac.toFixed(2));
    // Send amount_cents (integer) to avoid floating point issues
    // amount_cents = totalTvac * 100, already includes 6% TVA — Edge Function must NOT add any tax
    var amountCents = Math.round(totalTvac * 100);
    var d=await _callEdge('create-checkout',{rideId:currentRideId,offerId:currentOfferId,returnUrl:location.origin+location.pathname});
    if(d.error) throw new Error(d.error);
    if(d.confirmed){ await _creditConfirmed(currentRideId, d); return; }
    if(!d.url)throw new Error('URL manquante');window.location.href=d.url;
  }catch(e){if(btn)setLoading(btn,false,t('app.payer_par_carte_bancaire'));if(errEl)showError(errEl,e.message||'Erreur Stripe');}
};;

function getDemoOffers(){
  return [
    {id:'o1', driver_id:'d1', price:85, message:'BMW 7 Series, disponible 15 min avant', status:'pending', profiles:{first_name:'Thomas',last_name:'Bernard',rating:4.9,rating_count:124}},
    {id:'o2', driver_id:'d2', price:78, message:null, status:'pending', profiles:{first_name:'Luc',last_name:'Moreau',rating:4.7,rating_count:89}},
    {id:'o3', driver_id:'d3', price:92, message:'Audi A8, ponctuel garanti', status:'pending', profiles:{first_name:'Alex',last_name:'Nguyen',rating:4.8,rating_count:203}},
  ];
}



// ── Sous-traitance : diffusion à tous les chauffeurs ou à une sélection (subcontract_targets.sql) ──
var _subAud = { list: null, sel: {} };
function _subEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function _subAudMode(){ var a = document.querySelector('#m-subcontract .trip-types.aud .trip-type.active'); return a ? a.dataset.aud : 'all'; }
window._subAudReset = function(){
  _subAud.sel = {};
  var all = document.querySelector('#m-subcontract .trip-types.aud [data-aud="all"]'); if(all) selSubAud(all);
  var q = document.getElementById('sub-aud-q'); if(q) q.value = '';
};
window.selSubAud = async function(el){
  el.closest('.trip-types').querySelectorAll('.trip-type').forEach(function(b){ b.classList.toggle('active', b===el); });
  var box = document.getElementById('sub-aud-box'), some = el.dataset.aud === 'some';
  box.style.display = some ? '' : 'none';
  if(some && !_subAud.list){
    document.getElementById('sub-aud-items').innerHTML = '<div class="sub-aud-empty">'+t('sub.aud_loading')+'</div>';
    try{
      if(localStorage.getItem(DEMO_MODE_KEY)==='1' || !sb){
        _subAud.list = [{id:'d1',name:'Brussels Elite Cars',city:'Bruxelles'},{id:'d2',name:'Antwerp Limousines',city:'Anvers'},{id:'d3',name:'Liège VTC Services',city:'Liège'},{id:'d4',name:'Gent Chauffeurs',city:'Gand'}];
      } else {
        var r = await sb.rpc('api_fleet_directory');
        if(r.error) throw r.error;
        _subAud.list = r.data || [];
      }
    }catch(e){ console.warn('api_fleet_directory', e); _subAud.list = null; document.getElementById('sub-aud-items').innerHTML = '<div class="sub-aud-empty">'+t('sub.aud_error')+'</div>'; return; }
  }
  if(some) _subAudRender();
};
window._subAudRender = function(){
  var box = document.getElementById('sub-aud-items'); if(!box || !_subAud.list) return;
  var q = (document.getElementById('sub-aud-q').value || '').trim().toLowerCase();
  var rows = _subAud.list.filter(function(f){ return !q || (f.name+' '+(f.city||'')).toLowerCase().indexOf(q) > -1; });
  box.innerHTML = rows.length ? rows.map(function(f){
    return '<label class="sub-aud-row"><input type="checkbox" value="'+_subEsc(f.id)+'"'+(_subAud.sel[f.id]?' checked':'')+' onchange="_subAudPick(this)">'
      + '<span class="nm">'+_subEsc(f.name)+'</span>'+(f.city?'<span class="ct">'+_subEsc(f.city)+'</span>':'')+'</label>';
  }).join('') : '<div class="sub-aud-empty">'+t(_subAud.list.length ? 'sub.aud_nomatch' : 'sub.aud_nobody')+'</div>';
  _subAudCount();
};
window._subAudPick = function(cb){ if(cb.checked) _subAud.sel[cb.value] = 1; else delete _subAud.sel[cb.value]; _subAudCount(); };
window._subAudToggleAll = function(){
  var boxes = document.querySelectorAll('#sub-aud-items input[type=checkbox]');
  var allOn = boxes.length && [].every.call(boxes, function(b){ return b.checked; });
  boxes.forEach(function(b){ b.checked = !allOn; if(b.checked) _subAud.sel[b.value] = 1; else delete _subAud.sel[b.value]; });
  _subAudCount();
};
function _subAudCount(){
  var n = Object.keys(_subAud.sel).length;
  var c = document.getElementById('sub-aud-count'); if(c) c.textContent = t('sub.aud_count', { n: n });
  var boxes = document.querySelectorAll('#sub-aud-items input[type=checkbox]');
  var allOn = boxes.length && [].every.call(boxes, function(b){ return b.checked; });
  var tg = document.getElementById('sub-aud-toggle'); if(tg){ tg.textContent = t(allOn ? 'sub.aud_none_btn' : 'sub.aud_all_btn'); tg.style.display = boxes.length ? '' : 'none'; }
}
