// ── Email notifications (Supabase Edge Function "send-mail") ──
// Fire-and-forget: an email failure must never block a user action.
window.sendMail = function(type, to, data){
  if(!to || localStorage.getItem(DEMO_MODE_KEY)==='1') return Promise.resolve();
  // Same call pattern as create-checkout (plain fetch + explicit headers)
  return fetch('https://tuzfoqdxmxzjjhvlxsgb.supabase.co/functions/v1/send-mail',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+(window._sbToken||SB_KEY),'apikey':SB_KEY},
    body:JSON.stringify({ type: type, to: to, data: data || {} })
  }).then(function(resp){
    return resp.text().then(function(txt){
      var parsed; try{ parsed=JSON.parse(txt); }catch(e){ parsed={raw:txt}; }
      if(!resp.ok) console.warn('sendMail', type, resp.status, parsed);
      return parsed;
    });
  }).catch(function(e){ console.warn('sendMail', type, e); });
};

// Sends an email to users by profile id — the Edge Function resolves their address
// server-side (a client cannot read a driver's profile and vice versa because of RLS)
window.sendMailToUsers = function(type, userIds, data){
  if(localStorage.getItem(DEMO_MODE_KEY)==='1') return Promise.resolve();
  var ids = (Array.isArray(userIds)?userIds:[userIds]).filter(function(x,i,a){ return x && a.indexOf(x)===i; });
  if(!ids.length) return Promise.resolve();
  return fetch('https://tuzfoqdxmxzjjhvlxsgb.supabase.co/functions/v1/send-mail',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+(window._sbToken||SB_KEY),'apikey':SB_KEY},
    body:JSON.stringify({ type: type, to_user_ids: ids, data: data || {} })
  }).then(function(resp){
    return resp.text().then(function(txt){
      var parsed; try{ parsed=JSON.parse(txt); }catch(e){ parsed={raw:txt}; }
      if(!resp.ok || parsed.ok===false) console.warn('sendMailToUsers', type, resp.status, parsed);
      return parsed;
    });
  }).catch(function(e){ console.warn('sendMailToUsers', type, e); });
};

// Builds the data block shared by every ride email
window._mailRideData = function(r, extra){
  var tLbl = {ab:'A \u2192 B', disposal:'Mise \u00e0 disposition', mixed:'Course mixte'};
  var d = {
    code:  r.booking_code || (r.id ? String(r.id).slice(0,8) : ''),
    date:  r.ride_date ? formatDate(r.ride_date) : '',
    time:  r.ride_time ? String(r.ride_time).slice(0,5) : '',
    from:  r.from_address || '',
    to:    r.trip_type==='disposal' ? 'Mise \u00e0 disposition'+(((r.notes||'').match(/Durée:([^\s|,]+)/)||[])[1]?' \u00b7 '+(r.notes.match(/Durée:([^\s|,]+)/)[1]):'')
         : r.trip_type==='mixed' ? 'Trajet mixte'+((function(){ var n=parseMixedNotes(r.notes||'').length; return n>1?' \u00b7 '+n+' trajets':''; })())
         : (r.to_address || tLbl[r.trip_type] || ''),
    price: r.final_price ? (parseFloat(r.final_price).toFixed(2).replace('.',',')+' \u20ac') : ''
  };
  var pax = (r.notes||'').match(/\|pax:([^|]+)/);
  if(pax) d.passenger = pax[1].trim();
  var _lg = _lugTxt(r.luggage_large, r.luggage_small);
  if(_lg) d.luggage = _lg;
  if(r.is_subcontract) d.subcontract = 'yes';
  if(extra) Object.keys(extra).forEach(function(k){ if(extra[k]) d[k]=extra[k]; });
  return d;
};

// Resolves a user's email from their profile id
window._mailEmailFor = async function(userId){
  if(!sb || !userId) return null;
  try{
    var {data} = await sb.from('profiles').select('email,first_name,last_name,phone').eq('id',userId).maybeSingle();
    return data || null;
  }catch(e){ return null; }
};

// Sends the confirmation pair (client + driver) once a ride is confirmed
window._notifyRideConfirmed = async function(rideId, driverId){
  if(!sb || !rideId) return;
  try{
    var {data:r} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
    if(!r) return;
    var client = await window._mailEmailFor(r.client_id);
    var driver = await window._mailEmailFor(driverId || r.driver_id);
    var veh = '';
    try{
      var {data:off} = await sb.from('offers').select('vehicle_id').eq('ride_id',rideId).eq('status','accepted').maybeSingle();
      if(off && off.vehicle_id){
        var {data:v} = await sb.from('fleet_vehicles').select('brand,model,color,plate').eq('id',off.vehicle_id).maybeSingle();
        if(v) veh = ((v.brand||'')+' '+(v.model||'')+' '+(v.color||'')).trim() + (v.plate?' ('+v.plate+')':'');
      }
    }catch(e){}

    var drvName = driver ? ((driver.first_name||'')+' '+(driver.last_name||'')).trim() : '';
    var base = window._mailRideData(r, { vehicle: veh, driver: drvName });

    window.sendMailToUsers('ride_confirmed_client', r.client_id, Object.assign({}, base, {
      clientName: client ? (client.first_name||'') : '',
      driverPhone: driver ? (driver.phone||'') : ''
    }));
    window.sendMailToUsers('ride_confirmed_driver', driverId || r.driver_id, Object.assign({}, base, {
      driverName: driver ? (driver.first_name||'') : ''
    }));
  }catch(e){ console.warn('_notifyRideConfirmed', e); }
};

// Prévient (e-mail + notification dans l'application) les chauffeurs ayant envoyé une offre
// reason : 'client' (annulée par le client) ou 'expired' (délai dépassé, annulée par le système)
window._notifyOfferDriversCancelled = async function(ride, reason){
  if(!sb || !ride || !ride.id) return;
  try{
    var off = await sb.from('offers').select('driver_id').eq('ride_id', ride.id);
    var ids = (off.data||[]).map(function(o){ return o.driver_id; });
    if(ride.driver_id) ids.push(ride.driver_id);
    ids = ids.filter(function(id,i,a){ return id && id!==ride.client_id && a.indexOf(id)===i; });
    if(!ids.length) return;
    var code = ride.booking_code || String(ride.id).slice(0,8);
    var when = (ride.ride_date?formatDate(ride.ride_date):'') + (ride.ride_time?' à '+String(ride.ride_time).slice(0,5):'');
    var expired = reason==='expired';
    var title = expired ? 'Demande expirée' : 'Demande annulée';
    var body = 'La demande '+code+(when?' du '+when:'')+', sur laquelle vous aviez envoyé une offre, '
      + (expired ? 'a été annulée automatiquement : aucune offre n’a été acceptée avant l’heure de départ.' : 'a été annulée par le client.')
      + ' Votre offre n’est plus valable.';
    // (notification « cloche » envoyée par le serveur : api_ride_expire / api_ride_cancel)
    var base = Object.assign(window._mailRideData(ride), { audience:'driver', reason: expired?'expired':'client' });
    delete base.passenger;
    window.sendMailToUsers('ride_cancelled', ids, base);
  }catch(e){ console.warn('_notifyOfferDriversCancelled', e); }
};

// Sends the cancellation notice to the client (and driver if one was assigned)
window._notifyRideCancelled = async function(rideId, refundable, offerDriverIds){
  if(!sb || !rideId) return;
  try{
    var {data:r} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
    if(!r) return;
    var base = window._mailRideData(r);
    base.refund = refundable ? 'yes' : 'no';

    // Requester (client, or driver who posted a subcontract)
    window.sendMailToUsers('ride_cancelled', r.client_id, base);
    // Assigned driver + every driver who had sent an offer
    var drvIds = (offerDriverIds||[]).slice();
    if(r.driver_id) drvIds.push(r.driver_id);
    drvIds = drvIds.filter(function(id){ return id && id !== r.client_id; });
    if(drvIds.length){
      var dBase = Object.assign({}, base, { audience: 'driver', reason: 'client' });
      delete dBase.passenger;
      window.sendMailToUsers('ride_cancelled', drvIds, dBase);
    }
  }catch(e){ console.warn('_notifyRideCancelled', e); }
};

// Tells the client a driver just sent an offer
window._notifyOfferReceived = async function(rideId, price){
  if(!sb || !rideId) return;
  try{
    var {data:r} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
    if(!r) return;
    var base = window._mailRideData(r);
    if(price) base.price = (parseFloat(price)*1.06).toFixed(2).replace('.',',')+' \u20ac';
    window.sendMailToUsers('offer_received', r.client_id, base);
  }catch(e){ console.warn('_notifyOfferReceived', e); }
};

// Alerts verified fleet drivers that a new ride is on the marketplace.
// Recipients are resolved server-side (RLS prevents a client from reading driver profiles).
window._notifyMarketplaceDrivers = function(rideData){
  if(!rideData || localStorage.getItem(DEMO_MODE_KEY)==='1') return;
  var base = window._mailRideData(rideData);
  var isSub = !!rideData.is_subcontract;
  if(isSub && rideData.final_price){
    base.price = parseFloat(rideData.final_price).toFixed(2).replace('.',',')+' \u20ac HTVA'; // subcontract: fixed price shown
  } else {
    delete base.price;      // drivers must not see the client price
  }
  delete base.passenger;  // nor the passenger identity before accepting
  return fetch('https://tuzfoqdxmxzjjhvlxsgb.supabase.co/functions/v1/send-mail',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+(window._sbToken||SB_KEY),'apikey':SB_KEY},
    body:JSON.stringify({ type:'new_marketplace_ride', broadcast:'verified_drivers', ride_id: rideData.id, exclude_user_id: isSub ? rideData.client_id : undefined, data: base })
  }).then(function(resp){
    return resp.text().then(function(txt){
      var parsed; try{ parsed=JSON.parse(txt); }catch(e){ parsed={raw:txt}; }
      console.log('marketplace alert:', parsed);
      return parsed;
    });
  }).catch(function(e){ console.warn('_notifyMarketplaceDrivers', e); });
};

// Tells the drivers concerned (assigned driver + drivers with an offer) that the requester changed the ride
window._notifyRideUpdated = async function(rideId, changes, note){
  if(!sb || !rideId) return;
  try{
    var {data:r} = await sb.from('rides').select('*').eq('id',rideId).maybeSingle();
    if(!r || r.status==='cancelled' || r.status==='done') return;
    // Demande pas encore confirmée : la note et le passager sont privés (invisibles des fleets) →
    // pas d'e-mail pour eux ; les autres champs (date, heure, adresses…) sont signalés à toutes les fleets ayant fait une offre
    if(r.status==='waiting' || r.status==='offers'){
      changes = (changes||[]).filter(function(c){ return !/note|passager/i.test(c); });
      if(!changes.length) return;
      // Toutes les fleets vérifiées sont prévenues (la demande peut intéresser d'autres chauffeurs) ;
      // le contenu de l'e-mail est construit par le serveur à partir de la course
      if(localStorage.getItem(DEMO_MODE_KEY)==='1') return;
      fetch(SB_URL+'/functions/v1/send-mail',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+((await _userToken(false))||SB_KEY),'apikey':SB_KEY},
        body:JSON.stringify({ type:'ride_updated', broadcast:'verified_drivers', ride_id:r.id, exclude_user_id:r.client_id, data:{ changes: changes.join(', ') } })
      }).then(function(resp){ if(!resp.ok) resp.text().then(function(t){ console.warn('ride_updated broadcast', resp.status, t); }); })
        .catch(function(e){ console.warn('ride_updated broadcast', e); });
      return;
    }
    var ids = [];
    if(r.driver_id) ids.push(r.driver_id);
    try{
      var {data:offs} = await sb.from('offers').select('driver_id,status').eq('ride_id',rideId);
      (offs||[]).forEach(function(o){ if(o.status!=='rejected') ids.push(o.driver_id); });
    }catch(e){}
    ids = ids.filter(function(id){ return id && id !== r.client_id; });
    if(!ids.length) return;
    var base = window._mailRideData(r, { changes: (changes||[]).join(', '), note: note||'' });
    delete base.price;
    if(!r.driver_id) delete base.passenger;
    window.sendMailToUsers('ride_updated', ids, base);
  }catch(e){ console.warn('_notifyRideUpdated', e); }
};

async function _promoteNotesToDriver(rideId){
  if(!sb||!rideId) return;
  try{
    var {data:rd} = await sb.from('rides').select('notes').eq('id',rideId).maybeSingle();
    if(!rd) return;
    var notes = rd.notes||'';
    // Only promote if there's no note_drv yet
    if(notes.includes('|note_drv:')) return;
    // Extract clean base note (strip pax/tel/duration/mixte tags)
    var clean = notes
      .replace(/\|pax:[^|]*/g,'').replace(/\|(tel|pemail|pref|flight2?|train2?):[^|]*/g,'')
      .replace(/^Mixte:.*$/m,'').replace(/Dur\u00e9e:[^\s|]+/g,'').trim();
    if(!clean) return;
    // (fait par le serveur à la confirmation : déclencheur c_rides_confirm_notes)
  }catch(e){ console.warn('_promoteNotesToDriver error',e); }
}

