// ── Refund / cancellation delay per country (Admin → Facturation) ──
var _refundRules=null, _refundRulesP=null;
var _COUNTRY_ALIASES={BE:['belgique','belgium','belgi\u00eb','belgien'],FR:['france','frankrijk'],NL:['pays-bas','netherlands','nederland'],LU:['luxembourg','luxemburg'],DE:['allemagne','germany','deutschland'],ES:['espagne','spain','espa\u00f1a'],IT:['italie','italy','italia'],PT:['portugal'],AT:['autriche','austria','\u00f6sterreich'],IE:['irlande','ireland'],DK:['danemark','denmark'],SE:['su\u00e8de','sweden'],FI:['finlande','finland'],PL:['pologne','poland','polska'],CZ:['tch\u00e9quie','czechia','czech republic'],GR:['gr\u00e8ce','greece'],CH:['suisse','switzerland','schweiz'],GB:['royaume-uni','united kingdom','uk'],MC:['monaco']};
function _loadRefundRules(force){
  if(!sb) return Promise.resolve();
  if(_refundRulesP && !force) return _refundRulesP;
  _refundRulesP=sb.from('billing_settings').select('refund_delays').eq('id',1).maybeSingle()
    .then(function(r){ _refundRules=(r.data&&Array.isArray(r.data.refund_delays))?r.data.refund_delays:[]; })
    .catch(function(){ _refundRules=[]; });
  return _refundRulesP;
}
// Country of the ride = last part of the departure address ("…, Bruxelles, Belgique")
function _rideCountryCode(r){
  var parts=String((r&&r.from_address)||'').split(',');
  var last=(parts[parts.length-1]||'').trim().toLowerCase();
  for(var k in _COUNTRY_ALIASES){ if(_COUNTRY_ALIASES[k].indexOf(last)>=0) return k; }
  return 'BE';
}
// Hours before departure under which a confirmed ride is no longer refundable / cancellable
function _refundDelayHours(r){
  var rules=_refundRules||[];
  var code=_rideCountryCode(r);
  var hit=rules.find(function(x){return x.country===code;})||rules.find(function(x){return x.country==='BE';});
  return hit&&!isNaN(parseInt(hit.hours,10)) ? parseInt(hit.hours,10) : 48;
}
function _minsUntilRide(r){
  if(!r||!r.ride_date) return Infinity;
  var d=new Date(r.ride_date+'T'+(r.ride_time||'00:00').slice(0,5)+':00');
  return isNaN(d.getTime()) ? Infinity : (d-new Date())/60000;
}
// Confirmed ride inside the delay → cannot be cancelled anymore
function _rideCancelLocked(r){
  return !!r && (r.status==='confirmed'||r.status==='pending_payment') && _minsUntilRide(r) < _refundDelayHours(r)*60;
}

window.deleteRide = async function(rideId){
  _pendingDeleteId=rideId;
  _pendingDeleteRide=null;
  var ride=null;
  if(sb&&localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    var r=await sb.from('rides').select('id,ride_date,ride_time,status,final_price,payment_method,from_address').eq('id',rideId).maybeSingle();
    ride=r.data;
    _pendingDeleteRide=ride;
  }
  await _loadRefundRules();
  var _delayH=_refundDelayHours(ride);

  var titleEl  = document.getElementById('confirm-delete-title');
  var msgEl    = document.getElementById('confirm-delete-msg');
  var warnEl   = document.getElementById('confirm-delete-warn');

  // Compute minutes until departure
  var minsUntil = Infinity;
  if(ride && ride.ride_date){
    var rideTime = (ride.ride_time||'00:00').slice(0,5); // ensure HH:MM only
    var dt = new Date(ride.ride_date+'T'+rideTime+':00');
    if(!isNaN(dt.getTime())){
      minsUntil = (dt - new Date()) / 60000;
    }
  }

  var isPaid    = ride && ride.final_price > 0;
  var isStripe  = ride && ride.payment_method === 'stripe';
  var isBank    = ride && (ride.payment_method === 'bank_transfer');
  var isConfirmed = ride && (ride.status === 'confirmed' || ride.status === 'pending_payment');

  if(titleEl) titleEl.textContent = 'Annuler la demande';

  var isConfirmed = ride && (ride.status === 'confirmed' || ride.status === 'pending_payment');

  if(!isConfirmed){
    // waiting / offers — simple confirmation, no refund logic
    if(msgEl) msgEl.textContent = 'Êtes-vous sûr(e) de vouloir annuler cette demande ?';
    if(warnEl) warnEl.style.display = 'none';
  } else if(minsUntil >= _delayH*60){
    // beyond the country delay — cancellation allowed, refund possible
    if(msgEl) msgEl.textContent = 'Êtes-vous sûr(e) de vouloir annuler votre demande ?';
    if(warnEl){
      if(isPaid){
        var refundMsg = '';
        if(isStripe || isBank){
          refundMsg = '💳 <strong>'+t('app.remboursement_integral')+'</strong> '+t('app.le_prix_paye_vous_sera');
        } else {
          refundMsg = 'ℹ️ Votre remboursement sera traité selon le mode de paiement utilisé.';
        }
        warnEl.style.display='block';
        warnEl.style.background='var(--blue-bg)';
        warnEl.style.borderColor='var(--blue)';
        warnEl.style.color='var(--blue)';
        warnEl.innerHTML=refundMsg;
      } else {
        warnEl.style.display='none';
      }
    }
  } else {
    // < 48h — non-refundable
    if(msgEl) msgEl.textContent = '';
    if(warnEl){
      warnEl.style.display='block';
      warnEl.style.background='var(--red-bg)';
      warnEl.style.borderColor='var(--red)';
      warnEl.style.color='var(--red)';
      warnEl.innerHTML='⚠️ <strong>'+t('app.attention')+'</strong> '+t('app2.l_annulation_de_votre_demande')+' '+_delayH+t('app.h_du_depart')+' <strong>'+t('app2.n_est_pas_remboursable')+'</strong>'+t('app.etes_vous_sur_e_de');
    }
  }

  closeModal('m-ride-detail');
  openModal('m-confirm-delete');
};

window.confirmDeleteRide = async function(){
  var rideId = _pendingDeleteId;
  if(!rideId){ closeModal('m-confirm-delete'); return; }
  var btn = document.getElementById('btn-confirm-delete');
  if(btn){ btn.disabled=true; btn.textContent='Suppression...'; }
  closeModal('m-confirm-delete');
  closeModal('m-ride-detail');

  // ── Optimistic UI: remove card immediately from DOM ──
  document.querySelectorAll('.ride-card').forEach(function(card){
    try{
      var d = JSON.parse(card.dataset.ride.replace(/&#39;/g,"'"));
      if(d && d.id === rideId) card.remove();
    }catch(e){}
  });

  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){
    showToast(t('app.demande_supprimee'));
    _pendingDeleteId = null;
    if(btn){ btn.disabled=false; btn.textContent='Oui, annuler'; }
    return;
  }

  if(!sb){ _pendingDeleteId=null; if(btn){ btn.disabled=false; btn.textContent='Oui, annuler'; } return; }

  try {
    var offRes=await sb.from('offers').select('driver_id').eq('ride_id',rideId);
    var dIds=offRes.data?offRes.data.map(function(o){return o.driver_id;}):[]; 
    // Determine if ride was refundable at cancellation time
    var rideForCancel=_pendingDeleteRide||null;
    var cancelUpdate={status:'cancelled'};
    if(rideForCancel && rideForCancel.final_price && rideForCancel.payment_method && rideForCancel.payment_method !== 'non_refundable'){
      var rideTime2=(rideForCancel.ride_time||'00:00').slice(0,5);
      var dtCancel=new Date(rideForCancel.ride_date+'T'+rideTime2+':00');
      var minsLeft=!isNaN(dtCancel.getTime())?(dtCancel-new Date())/60000:Infinity;
      if(minsLeft < _refundDelayHours(rideForCancel)*60){
        cancelUpdate.payment_method='non_refundable';
      }
      // beyond the delay = refundable, keep the original payment_method (bank_transfer/stripe)
    }
    var _cancelRefundable = (cancelUpdate.payment_method!=='non_refundable');
    var res=await sb.rpc('api_ride_cancel',{ p_ride:rideId });
    if(!res.error && res.data) _cancelRefundable = res.data.refundable !== false;   // calculé par le serveur
    if(!res.error) _notifyRideCancelled(rideId, _cancelRefundable, dIds);
    _pendingDeleteId = null;
    if(btn){ btn.disabled=false; btn.textContent='Oui, annuler'; }
    if(res.error){
      showToast(t('app.erreur_db') + res.error.message);
    } else {
      showToast(t('app.demande_annulee'));
      if(dIds.length>0){
        var _cr=rideForCancel||{}, _cc=_cr.booking_code||String(rideId).slice(0,8);
        var _cw=(_cr.ride_date?formatDate(_cr.ride_date):'')+(_cr.ride_time?' à '+String(_cr.ride_time).slice(0,5):'');
        // (notification « cloche » aux fleets envoyée par le serveur)
      }
    }
  } catch(e){
    _pendingDeleteId = null;
    if(btn){ btn.disabled=false; btn.textContent='Oui, annuler'; }
    showToast(t('app.erreur_4') + (e.message||'inconnue'));
  }

  // Reload lists in background to sync with DB
  setTimeout(async function(){
    await loadClientDashboard();
    var ridesPage = document.getElementById('page-rides');
    if(ridesPage && ridesPage.classList.contains('active')) await loadRides();
  }, 400);
};

window.editRide = async function(rideId){
  _rdPushUnder('m-ride-detail');
  var r = null;
  if(sb && localStorage.getItem(DEMO_MODE_KEY)!=='1'){
    var res = await sb.from('rides').select('*').eq('id',rideId).single();
    r = res.data;
    if(r) await _mergeRidePrivate(r);
  } else {
    r = getDemoRides().find(function(x){return x.id===rideId;});
  }
  if(!r){ showToast(t('app.demande_introuvable')); if(_rdStack.length) _rdBack(null); return; }
  // Modification d'une course : jamais le formulaire Événement (il pouvait rester ouvert d'une saisie précédente)
  try{ _evReset(); }catch(_e){}

  // Set edit mode
  var editIdEl = document.getElementById('ride-edit-id');
  if(editIdEl) editIdEl.value = rideId;
  var titleEl = document.getElementById('ride-modal-title');
  if(titleEl) titleEl.textContent = t('edit_ride_title');
  var submitBtn = document.getElementById('btn-submit-ride');
  if(submitBtn) submitBtn.innerHTML = t('btn_save')+' &rarr;';

  var tripType = r.trip_type || 'ab';
  // Technical tags stored in notes (passenger, driver notes) are not shown in "Instructions"
  var _nRaw = r.notes||'';
  window._editRidePax = { name:((_nRaw.match(/\|pax:([^|]*)/)||[])[1]||'').trim(), tel:((_nRaw.match(/\|tel:([^|]*)/)||[])[1]||'').trim() };
  window._editHiddenTags = (_nRaw.match(/\|(note_drv|offer_note|pemail|pref):[^|]*/g)||[]).join('');
  window._editTr = { flight:((_nRaw.match(/\|flight:([^|]*)/)||[])[1]||'').trim(), train:((_nRaw.match(/\|train:([^|]*)/)||[])[1]||'').trim(), flight2:((_nRaw.match(/\|flight2:([^|]*)/)||[])[1]||'').trim(), train2:((_nRaw.match(/\|train2:([^|]*)/)||[])[1]||'').trim() };
  r = Object.assign({}, r, { notes: _nRaw.replace(/\|(pax|tel|note_drv|offer_note|pemail|pref|flight2?|train2?):[^|]*/g,'').trim() });

  // Activate correct trip type tab
  document.querySelectorAll('.trip-type').forEach(function(b){
    b.classList.toggle('active', b.dataset.val === tripType);
  });
  ['panel-ab','panel-disposal','panel-mixed'].forEach(function(id){
    var p=document.getElementById(id); if(p) p.style.display='none';
  });
  var panel = document.getElementById(tripType==='ab'?'panel-ab':tripType==='disposal'?'panel-disposal':'panel-mixed');
  if(panel) panel.style.display = 'block';

  var sv = function(id,v){var e=document.getElementById(id);if(e&&v!=null)e.value=v;};

  if(tripType === 'ab'){
    sv('ride-from', r.from_address);
    sv('ride-to',   r.to_address);
    sv('ride-date', r.ride_date);
    sv('ride-time', r.ride_time ? r.ride_time.slice(0,5) : '');
    sv('ride-notes', r.notes||'');
    var paxEl=document.getElementById('ride-pax'); if(paxEl) paxEl.value=(r.passengers>=8?'8+':String(r.passengers||1));
    var vehEl=document.getElementById('ride-vehicle'); if(vehEl) vehEl.value=r.vehicle_type||'lowcost';
    _lugSet('ride-lugL', r.luggage_large); _lugSet('ride-lugS', r.luggage_small);
    sv('ride-flight', window._editTr.flight); sv('ride-train', window._editTr.train); sv('ride-flight2', window._editTr.flight2); sv('ride-train2', window._editTr.train2); setTimeout(window._trRefresh,0);

  } else if(tripType === 'disposal'){
    sv('disp-from', r.from_address);
    sv('disp-date', r.ride_date);
    sv('disp-time', r.ride_time ? r.ride_time.slice(0,5) : '');
    var durMatch=(r.notes||'').match(/Durée:(\d+)/);
    var durEl=document.getElementById('disp-duration'); if(durEl) durEl.value=durMatch?durMatch[1]:'2';
    var paxEl2=document.getElementById('disp-pax'); if(paxEl2) paxEl2.value=(r.passengers>=8?'8+':String(r.passengers||1)); setTimeout(function(){ if(window._vehPaxSync) _vehPaxSync(); },150);
    var vehEl2=document.getElementById('disp-vehicle'); if(vehEl2) vehEl2.value=r.vehicle_type||'lowcost';
    _lugSet('disp-lugL', r.luggage_large); _lugSet('disp-lugS', r.luggage_small);
    sv('disp-flight', window._editTr.flight); sv('disp-train', window._editTr.train); setTimeout(window._trRefresh,0);
    sv('disp-notes', (r.notes||'').replace(/Durée:\d+h?/g,'').trim());

  } else if(tripType === 'mixed'){
    // Clear existing segments
    var segCont = document.getElementById('mixed-segments');
    if(segCont) segCont.innerHTML='';
    _segN = 0;

    // Parse and recreate each segment
    var segs = parseMixedNotes(r.notes||'');
    _mixPM(segs.some(function(x){ return x.paxName||x.paxTel; })?'per':'one');
    if(!segs.length){
      // No parseable segments — just add one empty segment
      addMixedSegment();
    } else {
      segs.forEach(function(s){
        addMixedSegment();
        var n = _segN;
        var isD = s.type.toLowerCase().indexOf('disp') >= 0;

        // Set type button
        var seg = document.getElementById('seg-'+n);
        if(seg){
          var typeBtns = seg.querySelectorAll('.seg-type-btn');
          typeBtns.forEach(function(b){ b.classList.remove('active'); });
          var targetBtn = isD ? typeBtns[1] : typeBtns[0];
          if(targetBtn){
            targetBtn.classList.add('active');
            setSegType(targetBtn, n, isD?'disposal':'ab');
          }
        }

        // Fill fields after setSegType swapped the DOM
        setTimeout(function(sn, seg_s, seg_isD){
          var svn=function(id,v){var e=document.getElementById(id);if(e&&v)e.value=v;};
          svn('sd8-'+sn, seg_s.date);
          svn('sh-'+sn,  seg_s.time);
          svn('sf-'+sn,  seg_s.from);
          if(!seg_isD) svn('st-'+sn, seg_s.to);
          if(seg_isD)  svn('sdur-'+sn, seg_s.dur ? parseInt(seg_s.dur) : '');
          var pEl=document.getElementById('spax-'+sn); if(pEl&&seg_s.pax) pEl.value=seg_s.pax;
          var vEl=document.getElementById('sveh-'+sn); if(vEl&&seg_s.veh) vEl.value=seg_s.veh;
          var nEl=document.getElementById('snotes-'+sn); if(nEl&&seg_s.note) nEl.value=seg_s.note;
          _lugSet('slgL-'+sn, seg_s.lugL); _lugSet('slgS-'+sn, seg_s.lugS);
          svn('sfl-'+sn, seg_s.flight); svn('str-'+sn, seg_s.train); svn('sfl2-'+sn, seg_s.flight2); svn('str2-'+sn, seg_s.train2); svn('spn-'+sn, seg_s.paxName); svn('spt-'+sn, seg_s.paxTel); if(window._segTr) _segTr(sn);
          // Re-attach Google Places
          if(window.attachGPToSeg) attachGPToSeg(sn);
        }, 80, n, s, isD);
      });
    }
  }

  openModal('m-new-ride');
  // Init passenger selector for all clients
  if(currentProfile?.role==='client' || currentRole==='client') setTimeout(_initPaxSelector, 50);
};



// ══ BAGAGES : grandes valises / bagages cabine (sacs) ══
function _lugTxt(L, S, short){ return BleenrCore.luggageText(L, S, short); }   // core/format.ts
function _lugInput(id, cls){
  return '<div class="lug-st"><button type="button" tabindex="-1" aria-label="'+t('app.retirer')+'" onclick="_lugInc(this,-1)">−</button><input '+(id?'id="'+id+'" ':'')+'class="lug-in'+(cls?' '+cls:'')+'" type="number" min="0" max="20" value="0" inputmode="numeric"><button type="button" tabindex="-1" aria-label="'+t('app.ajouter_2')+'" onclick="_lugInc(this,1)">+</button></div>';
}
// Bloc « Grandes valises / Bagages cabine » + conseil (data-veh / data-pax : champs liés)
function _lugBlock(idL, idS, vehId, paxId, clsL, clsS){
  return '<div class="input-group"><label>'+t('app.grandes_valises')+'</label>'+_lugInput(idL, clsL)+'</div>'
    +'<div class="input-group"><label>'+t('app.bagages_cabine_sacs')+'</label>'+_lugInput(idS, clsS)+'</div>'
    +'<div class="lug-warn" style="display:none;"'+(vehId?' data-veh="'+vehId+'"':'')+(paxId?' data-pax="'+paxId+'"':'')+(idL?' data-l="'+idL+'"':'')+(idS?' data-s="'+idS+'"':'')+'></div>';
}
window._lugInc=function(btn,d){ var i=btn.parentNode.querySelector('input'); if(!i) return; i.value=Math.max(0,Math.min(20,(parseInt(i.value,10)||0)+d)); i.dispatchEvent(new Event('input',{bubbles:true})); };
// Conseil : trop de grandes valises pour la gamme choisie (pas de blocage)
// Capacités maximum par gamme (Admin › Facturation, billing_settings.luggage_caps) : combinaisons { l: valises, s: cabine }
var _LUG_CAPS_DEF={ lowcost:[{l:3,s:0},{l:2,s:2}], lowcost7:[{l:5,s:2}], business:[{l:3,s:0},{l:2,s:2}], luxe:[{l:3,s:0},{l:2,s:2}], van:[{l:7,s:7}], bus:[] };
var _LUG_CLS=[['lowcost','Economy'],['lowcost7','Economy 7 places'],['business','Business'],['luxe','Luxe'],['van','Van'],['bus','Bus']];
window._lugCaps=_LUG_CAPS_DEF; var _lugCapsT=0;
window._lugCapsLoad=function(){
  if(!sb||Date.now()-_lugCapsT<120000) return; _lugCapsT=Date.now();
  sb.from('billing_settings').select('luggage_caps').eq('id',1).maybeSingle().then(function(r){
    var c=r&&r.data&&r.data.luggage_caps; if(c&&typeof c==='object'){ window._lugCaps=Object.assign({},_LUG_CAPS_DEF,c); if(window._lugWarnAll) _lugWarnAll(); }
  }).catch(function(){});
};
function _lugCapKey(cls, pax){ return cls==='lowcost'&&(parseInt(pax,10)||1)>=4 ? 'lowcost7' : cls; }
// Les bagages tiennent-ils dans au moins une combinaison de la gamme ?
function _lugFits(key, L, S){
  var list=(window._lugCaps||{})[key];
  if(!Array.isArray(list)||!list.length) return true;
  return list.some(function(c){ return L<=(parseInt(c.l,10)||0) && S<=(parseInt(c.s,10)||0); });
}
function _lugCapTxt(key){
  var list=(window._lugCaps||{})[key]||[];
  return list.map(function(c){ var l=parseInt(c.l,10)||0, s2=parseInt(c.s,10)||0; return [l?l+' valise'+(l>1?'s':''):'', s2?s2+' bagage'+(s2>1?'s':'')+' cabine':''].filter(Boolean).join(' + ')||'aucun bagage'; }).join(', ou ');
}
function _lugWarnUpdate(w){
  if(!w) return;
  var g=function(id){ var e=id&&document.getElementById(id); return e?e.value:''; };
  var L=parseInt(g(w.getAttribute('data-l')),10)||0, S=parseInt(g(w.getAttribute('data-s')),10)||0, cls=g(w.getAttribute('data-veh')), pax=g(w.getAttribute('data-pax'));
  var key=_lugCapKey(cls,pax);
  if((L||S) && cls && cls!=='any' && !_lugFits(key,L,S)){
    var nm=({lowcost:'une Economy',lowcost7:'une Economy de 7 places',business:'une Business',luxe:'une Luxe',van:'un Van',bus:'un Bus'})[key]||'ce véhicule';
    var sug=['van','bus'].filter(function(k){ return k!==cls && _lugFits(k,L,S); })[0];
    w.innerHTML='⚠️ '+_lugTxt(L,S)+' : trop de bagages pour '+nm+' (max. '+_lugCapTxt(key)+'). Le coffre risque d’être trop petit.'+(sug?' '+t('app.un')+' <b>'+(sug==='van'?'Van':'Bus')+'</b> '+t('app.est_conseille'):'');
    w.style.display='';
  } else { w.style.display='none'; w.innerHTML=''; }
}
window._lugWarnAll=function(){ document.querySelectorAll('.lug-warn').forEach(_lugWarnUpdate); };
['input','change'].forEach(function(ev){ document.addEventListener(ev, function(e){ var t=e.target; if(!t||!t.closest) return;
  if(t.classList&&t.classList.contains('lug-in')){ var v=parseInt(t.value,10); if(t.value!=='' && (isNaN(v)||v<0||v>20)) t.value=Math.max(0,Math.min(20,v||0)); }
  var fg=t.closest('.form-grid'); if(fg) fg.querySelectorAll('.lug-warn').forEach(_lugWarnUpdate); }, true); });
// Formulaires fixes : bloc bagages inséré après le champ Véhicule
function _lugMount(){
  [['ride-vehicle','ride-lugL','ride-lugS','ride-pax'],['disp-vehicle','disp-lugL','disp-lugS','disp-pax'],
   ['sub-veh','sub-lugL','sub-lugS','sub-pax'],['sub-disp-veh','sub-disp-lugL','sub-disp-lugS','sub-disp-pax']].forEach(function(x){
    var v=document.getElementById(x[0]); if(!v||document.getElementById(x[1])) return;
    var g=v.closest('.input-group'); if(g) g.insertAdjacentHTML('afterend', _lugBlock(x[1],x[2],x[0],x[3]));
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_lugMount); else _lugMount();
function _lugVal(id){ var e=document.getElementById(id); return e?Math.max(0,Math.min(50,parseInt(e.value,10)||0)):0; }
function _lugSet(id, v){ var e=document.getElementById(id); if(e) e.value=parseInt(v,10)||0; }

// ══ RÈGLES D'UNE NOUVELLE DEMANDE (contrôlées aussi par le serveur : ride_rules.sql) ══
// 1. Au moins 1 h à l'avance
var _LEAD_MIN=60;
function _leadErr(date, time){
  if(!date) return '';
  var d=new Date(date+'T'+((time||'00:00').slice(0,5))+':00');
  if(isNaN(d.getTime())) return '';
  return d.getTime() < Date.now()+(_LEAD_MIN-1)*60000 ? 'La demande doit commencer au moins 1 heure à l’avance.' : '';
}
function _leadMark(dateId, timeId){
  // après l'affichage de l'erreur (qui recalcule les champs vides en rouge)
  setTimeout(function(){ [dateId,timeId].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.add('fld-err'); }); },40);
}
// 2. Gamme selon le nombre de passagers : 1–3 toutes ; 4–7 Peu importe, Economy, Van ; 8+ Peu importe, Bus
function _vehAllowedFor(pax){
  var n=parseInt(pax,10)||1;
  return n<=3 ? null : n<=7 ? ['any','lowcost','van'] : ['bus'];
}
function _vehPaxHint(pax){
  var n=parseInt(pax,10)||1;
  return n<=3 ? '' : n<=7 ? 'Pour '+n+' passagers : Economy de 7 places, Van, ou Peu importe (tout véhicule d’au moins '+n+' places).' : 'Pour 8 passagers ou plus : Bus uniquement.';
}
function _vehFilter(paxSel, vehSel){
  if(!paxSel||!vehSel) return;
  var al=_vehAllowedFor(paxSel.value), first=null;
  [].forEach.call(vehSel.options, function(o){ var ok=!al||al.indexOf(o.value)>=0; o.hidden=!ok; o.disabled=!ok; if(ok&&!first) first=o.value; });
  if(al && al.indexOf(vehSel.value)<0) vehSel.value=al.indexOf('lowcost')>=0?'lowcost':'bus';
  var g=vehSel.closest('.input-group'), h=g&&g.querySelector('.veh-pax-hint'), txt=_vehPaxHint(paxSel.value);
  if(g && txt){ if(!h){ h=document.createElement('div'); h.className='veh-pax-hint'; g.appendChild(h); } h.textContent=txt; }
  else if(h) h.remove();
}
window._vehPaxSync=function(){
  _vehFilter(document.getElementById('ride-pax'), document.getElementById('ride-vehicle'));
  _vehFilter(document.getElementById('disp-pax'), document.getElementById('disp-vehicle'));
  document.querySelectorAll('#mixed-segments .mixed-segment').forEach(function(sg){ var n=sg.id.replace('seg-','');
    _vehFilter(document.getElementById('spax-'+n), document.getElementById('sveh-'+n)); });
  ['sub-pax:sub-veh','sub-disp-pax:sub-disp-veh'].forEach(function(x){ var k=x.split(':'); _vehFilter(document.getElementById(k[0]), document.getElementById(k[1])); });
  document.querySelectorAll('#sub-mixed-segments .mixed-segment').forEach(function(sg){ var n=sg.id.replace('sub-seg-','');
    _vehFilter(document.getElementById('sub-spax-'+n), document.getElementById('sub-sveh-'+n)); });
};
document.addEventListener('change', function(e){ var id=e.target&&e.target.id||''; if(/^(ride-pax|disp-pax|spax-\d+|sub-pax|sub-disp-pax|sub-spax-\d+)$/.test(id)) _vehPaxSync(); }, true);
window.submitRide = async function(){
  var _mnr=document.getElementById('m-new-ride'); if(_mnr && _mnr.classList.contains('nr-event')) return submitEvent();
  var g = function(id){ var e=document.getElementById(id); return e?e.value.trim():''; };
  var editId = g('ride-edit-id');
  var tripType = (document.querySelector('.trip-types .trip-type.active')||{dataset:{}}).dataset.val || 'ab';
  var err = document.getElementById('ride-err');
  var btn = document.getElementById('btn-submit-ride');
  var from,to,date,time,pax,veh,notes;

  if(err){ err.textContent=''; err.classList.remove('show'); }

  if(tripType==='disposal'){
    from  = g('disp-from');
    to    = null;
    date  = g('disp-date');
    time  = g('disp-time');
    pax   = g('disp-pax');
    veh   = g('disp-vehicle');
    var lugL=_lugVal('disp-lugL'), lugS=_lugVal('disp-lugS');
    var dur = String(Math.max(1, Math.min(24, parseInt(g('disp-duration')) || 2)));
    notes = (g('disp-notes')||'') + (dur ? ' Dur\u00e9e:'+dur+'h' : '');
    if(!from||!date||!time){ if(err){ err.textContent=t('err_required'); err.classList.add('show'); } return; }
  } else if(tripType==='mixed'){
    window._mixPax0=null;
    var segs=[], _segErr='', _mixTr={}; var segEls=document.querySelectorAll('#mixed-segments .mixed-segment');
    segEls.forEach(function(seg, _si){
      var n=seg.id.replace('seg-','');
      var sf=g('sf-'+n)||'';
      var st=g('st-'+n)||'';
      var sd=g('sdur-'+n)||'';
      var sdate=g('sd8-'+n)||'';
      var stime=g('sh-'+n)||'';
      var spax=g('spax-'+n)||'';
      var sveh=g('sveh-'+n)||'';
      var snotes=(document.getElementById('snotes-'+n)||{}).value||'';
      var ab=seg.querySelector('.seg-type-btn.active');
      var isD=ab&&ab.textContent.toLowerCase().indexOf('disp')>=0;
      // Champs obligatoires de chaque trajet
      if(!_segErr){
        var _miss=!sf?(isD?'le lieu de prise en charge':'le départ'):(!isD&&!st)?'l’arrivée':!sdate?'la date':!stime?'l’heure':'';
        if(_miss) _segErr='Trajet '+(_si+1)+' : indiquez '+_miss+'.';
      }
      // Format: TYPE@HH:MM:from>to(dur)|d:DATE|p:PAX|v:VEH|n:NOTE
      var segStr=(isD?'Disposition':'A>B');
      if(stime) segStr+='@'+stime;
      segStr+=':'+sf;
      if(!isD&&st) segStr+='>'+st;
      if(isD&&sd) segStr+='('+sd+'h)';
      if(sdate) segStr+='|d:'+sdate;
      if(spax) segStr+='|p:'+spax;
      if(sveh) segStr+='|v:'+sveh;
      var _sl=_lugVal('slgL-'+n), _ss=_lugVal('slgS-'+n);
      if(_sl||_ss) segStr+='|lg:'+_sl+'/'+_ss;
      if(snotes.trim()) segStr+='|n:'+snotes.trim().replace(/\|/g,' ');
      // Numéros de vol / train (champs visibles uniquement)
      var _vis=function(id){ var e=document.getElementById(id); return e && e.style.display!=='none'; };
      [['sfl','fl','flight'],['str','tr','train'],['sfl2','fl2','flight'],['str2','tr2','train']].forEach(function(x){
        var v=_vis(x[0]+'-grp-'+n)?String(g(x[0]+'-'+n)||'').toUpperCase().replace(/\s+/g,' ').trim():'';
        if(!v) return;
        var okv=x[2]==='flight'?/^[A-Z0-9]{2,3} ?\d{1,4}[A-Z]?$/.test(v):/^[A-Z]{0,4} ?\d{1,5}$/.test(v);
        if(!okv && !_segErr) _segErr='Trajet '+(_si+1)+' : '+(x[2]==='flight'?'numéro de vol invalide (ex. SN 3123)':'numéro de train invalide (ex. IC 1832)');
        segStr+='|'+x[1]+':'+v; if(!_mixTr[x[2]]) _mixTr[x[2]]=v;
      });
      if(_mixPMVal()==='per'){
        var spn=String(g('spn-'+n)||'').replace(/\|/g,' ').trim(), spt=String(g('spt-'+n)||'').replace(/\|/g,' ').trim();
        if(spn) segStr+='|pn:'+spn; if(spt) segStr+='|pt:'+spt;
        if(_si===0){ window._mixPax0={ name:spn, tel:spt }; }
      }
      segs.push(segStr);
    });
    // Extract clean from address using the parser (handles @HH:MM correctly)
    var _parsedSegs = parseMixedNotes('Mixte: '+segs.join(' | '));
    from  = _parsedSegs.length ? cleanAddr(_parsedSegs[0].from||'Mixte') : 'Mixte';
    to    = '';
    // Use date/time from first segment
    var firstSegEl2 = document.querySelector('#mixed-segments .mixed-segment');
    var firstN2 = firstSegEl2 ? firstSegEl2.id.replace('seg-','') : null;
    date  = firstN2 ? (g('sd8-'+firstN2)||todayStr()) : todayStr();
    time  = firstN2 ? (g('sh-'+firstN2)||'00:00') : '00:00';
    pax   = firstN2 ? (g('spax-'+firstN2)||'1') : '1';
    // bagages de la demande = le maximum parmi les trajets
    var lugL=0, lugS=0; document.querySelectorAll('#mixed-segments .mixed-segment').forEach(function(sg){ var n3=sg.id.replace('seg-',''); lugL=Math.max(lugL,_lugVal('slgL-'+n3)); lugS=Math.max(lugS,_lugVal('slgS-'+n3)); });
    // passagers de la demande = le plus grand nombre parmi les trajets (places nécessaires)
    document.querySelectorAll('#mixed-segments .mixed-segment').forEach(function(sg){ var p2=parseInt(g('spax-'+sg.id.replace('seg-','')),10)||1; if(p2>(parseInt(pax,10)||1)) pax=String(p2); });
    veh   = firstN2 ? (g('sveh-'+firstN2)||null) : null;
    notes = 'Mixte: '+segs.join(' | ');
    if(_segErr){ if(err){ err.textContent=_segErr; err.classList.add('show'); err.style.display=''; } return; }
    window._mixTrLast=_mixTr;
    if(!segs.length||!segs[0]){ if(err){ err.textContent=t('err_required'); err.classList.add('show'); } return; }
  } else {
    from  = g('ride-from');
    to    = g('ride-to');
    date  = g('ride-date');
    time  = g('ride-time');
    pax   = g('ride-pax');
    veh   = g('ride-vehicle');
    var lugL=_lugVal('ride-lugL'), lugS=_lugVal('ride-lugS');
    notes = g('ride-notes');
    if(!from||!to||!date||!time){ if(err){ err.textContent=t('err_required'); err.classList.add('show'); } return; }
  }

  // Délai minimum (nouvelle demande ; en modification le serveur contrôle les changements de date / heure)
  if(!editId){
    var _le='';
    if(tripType==='mixed'){
      document.querySelectorAll('#mixed-segments .mixed-segment').forEach(function(sg,i){ if(_le) return; var n=sg.id.replace('seg-','');
        if(_leadErr(g('sd8-'+n), g('sh-'+n))){ _le='Trajet '+(i+1)+' : il doit commencer au moins 1 heure à l’avance.'; _leadMark('sd8-'+n,'sh-'+n); } });
    } else if(_leadErr(date,time)){ _le=_leadErr(date,time); if(tripType==='disposal') _leadMark('disp-date','disp-time'); else _leadMark('ride-date','ride-time'); }
    if(_le){ if(err){ err.textContent=_le; err.classList.add('show'); err.style.display=''; } return; }
  }
  // Gamme cohérente avec le nombre de passagers
  if(window._vehPaxSync) _vehPaxSync();
  // Numéro de vol / train (aéroport ou gare au départ ou à l'arrivée)
  var _tr = tripType==='mixed' ? (window._mixTrLast||{}) : (window._trCollect ? window._trCollect(tripType) : {});
  if(_tr.error){ if(err){ err.textContent=_tr.error; err.classList.add('show'); err.style.display=''; } return; }
  if(_tr.flight) notes = (notes||'') + '|flight:'+_tr.flight;
  if(_tr.train)  notes = (notes||'') + '|train:'+_tr.train;
  if(_tr.flight2) notes = (notes||'') + '|flight2:'+_tr.flight2;
  if(_tr.train2)  notes = (notes||'') + '|train2:'+_tr.train2;

  // DEMO MODE
  // Inject passenger info
  try{
    if(currentProfile?.role==='client' || currentRole==='client'){
      var paxName = (window._newRidePaxName||'').trim();
      var paxTel  = (window._newRidePaxTel||'').trim();
      // Trajet mixte, un passager par trajet : la course reprend celui du 1er trajet
      if(tripType==='mixed' && _mixPMVal()==='one'){ paxName=g('mix-cname'); paxTel=g('mix-cphone'); }
      else if(tripType==='mixed' && window._mixPax0 && (window._mixPax0.name||window._mixPax0.tel)){ paxName=window._mixPax0.name; paxTel=window._mixPax0.tel; }
      if(paxName) notes = (notes||'') + '|pax:'+paxName;
      if(paxTel)  notes = (notes||'') + '|tel:'+paxTel;
    }
    if(editId && window._editHiddenTags) notes = (notes||'') + window._editHiddenTags;
  }catch(_e){ console.warn('pax inject skipped', _e); }

  // Récapitulatif avant publication (nouvelle demande uniquement)
  if(!editId && _mnr && !_mnr.classList.contains('nr-recap-on')){
    _nrShowRecap({ type:tripType, from:from, to:to, date:date, time:time, pax:pax, veh:veh, notes:notes, lugL:lugL, lugS:lugS,
      dur:tripType==='disposal'?(g('disp-duration')||'2'):'', instr:tripType==='ab'?g('ride-notes'):tripType==='disposal'?g('disp-notes'):'', tr:_tr });
    return;
  }
  // Trajet mixte « peu importe le chauffeur » : une demande par trajet, regroupées
  if(!editId && tripType==='mixed' && _mixDrvVal()==='any'){
    return _mixSplitSubmit(parseMixedNotes(notes), (window._newRidePaxName||''), (window._newRidePaxTel||''), btn, err);
  }

  if(localStorage.getItem(DEMO_MODE_KEY)==='1'){
    closeModal('m-new-ride');
    cancelRideModal();
    showToast(t('toast_ride'));
    await loadClientDashboard();
    return;
  }

  if(btn) setLoading(btn, true, t('btn_publish')+' \u2192');

  var rideData = {
    client_id:    currentUser.id,
    trip_type:    tripType,
    from_address: from,
    to_address:   to||null,
    ride_date:    date,
    ride_time:    time,
    passengers:   parseInt(pax)||1,
    vehicle_type: veh||null,
    luggage_large: lugL||0,
    luggage_small: lugS||0,
    notes:        notes||null,
    status:       'waiting'
  };

  try {
    var result;
    if(editId){
      var _prevRide = null;
      try{ _prevRide = (await sb.from('rides').select('*').eq('id', editId).maybeSingle()).data; if(_prevRide) await _mergeRidePrivate(_prevRide); }catch(e){}
      // Une demande qui a déjà reçu des offres garde son statut « offers » (les offres restent visibles)
      if(_prevRide && _prevRide.status && _prevRide.status!=='waiting') delete rideData.status;
      result = await sb.rpc('api_ride_update', { p_ride: editId, p: rideData });
      if(!result.error && _prevRide){
        var _chg = [];
        if(_prevRide.ride_date !== rideData.ride_date) _chg.push('date');
        if(String(_prevRide.ride_time||'').slice(0,5) !== String(rideData.ride_time||'').slice(0,5)) _chg.push('heure');
        if((_prevRide.from_address||'') !== (rideData.from_address||'')) _chg.push('d\u00e9part');
        if((_prevRide.to_address||'') !== (rideData.to_address||'')) _chg.push('arriv\u00e9e');
        if((_prevRide.passengers||1) !== (rideData.passengers||1)) _chg.push('passagers');
        if((_prevRide.vehicle_type||'') !== (rideData.vehicle_type||'')) _chg.push('v\u00e9hicule');
        if((_prevRide.trip_type||'') !== (rideData.trip_type||'')) _chg.push('type de course');
        if((_prevRide.notes||'') !== (rideData.notes||'')) _chg.push('note / d\u00e9tails');
        // Mission confirmée : le serveur envoie déjà « Mission modifiée — à valider » au chauffeur (un seul e-mail)
        if(_chg.length && !(_prevRide.status==='confirmed' && _prevRide.driver_id)) _notifyRideUpdated(editId, _chg);
      }
    } else {
      // Création par le serveur (référence BLxx-MMAA### calculée par le serveur)
      result = await sb.rpc('api_ride_create', { p: rideData });
      if(result.data && result.data.id){
        rideData.booking_code = result.data.booking_code; // so the emails carry the request id
        rideData.id = result.data.id;
      }
    }
    if(result.error) throw result.error;

    if(btn) setLoading(btn, false, t('btn_publish')+' \u2192');

    // Notify the client that the request is live, and alert available drivers
    if(!editId && currentProfile?.email){
      window.sendMail('ride_created', currentProfile.email, Object.assign(
        window._mailRideData(rideData),
        { clientName: (currentProfile.first_name||'') }
      ));
    }
    if(!editId) _notifyMarketplaceDrivers(rideData);

    closeModal('m-new-ride');
    cancelRideModal();
    showToast(editId ? t('toast_ride_edit') : t('toast_ride'));
    await loadClientDashboard();
    var ridesPage=document.getElementById('page-rides');
    if(ridesPage&&ridesPage.classList.contains('active')&&typeof loadRides==='function')await loadRides();
    // Refresh client calendar
    _calCache={};
    if(typeof loadCalendar==='function'){try{await loadCalendar(true);}catch(e){}}
  } catch(e){
    console.error('submitRide error:', e);
    if(err){ err.textContent=e.message||'Erreur'; err.classList.add('show'); }
  } finally {
    if(btn){ setLoading(btn, false, t('btn_publish')+' \u2192'); btn.disabled=false; }
  }
};

