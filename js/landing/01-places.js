// ── Google Places — widget natif ──
var _gpInited = false;

window.initGooglePlaces=function(){
  if(_gpInited) return;
  _gpInited = true;
  _attachGoogleAC();
};
// If Google Maps already loaded before this script, run now
if(window.google&&window.google.maps&&window.google.maps.places){initGooglePlaces();}
// Register for late callback
window._gpReady=initGooglePlaces;

function _attachGoogleAC(){
  var ids = ['ld-from','ld-to','ride-from','ride-to','disp-from','sub-from','sub-to','sub-disp-from','pm-from','pm-to','pm-dispo-location'];
  var els = ids.map(function(id){ return document.getElementById(id); });
  // Trajets des sous-traitances mixtes (champs créés dynamiquement)
  [].push.apply(els, document.querySelectorAll('input[id^="sub-sf-"],input[id^="sub-st-"]'));
  els.forEach(function(el){
    if(el && !el._gp){
      el._gp = new google.maps.places.Autocomplete(el, {
        language: 'fr',
        fields: ['formatted_address','name','geometry','place_id'],
        componentRestrictions: { country: ['be','fr','lu','nl','de','gb','ch'] }
      });
      el._gp.addListener('place_changed', function(){
        var place = el._gp.getPlace();
        if(place){
          var name = place.name || '';
          var addr = place.formatted_address || '';
          if(name && addr && addr.toLowerCase().indexOf(name.toLowerCase()) === -1){
            el.value = name + ', ' + addr;
          } else if(addr){
            el.value = addr;
          } else if(name){
            el.value = name;
          }
        }
        _gpMark(el, place);
        if(window._trRefresh) window._trRefresh();
      });
    }
  });
}

// Called after mixed segments are added
window.attachGPToSeg = function(n){
  var sfEl = document.getElementById('sf-'+n);
  var stEl = document.getElementById('st-'+n);
  [sfEl, stEl].forEach(function(el){
    if(el && !el._gp && window.google && window.google.maps && window.google.maps.places){
      el._gp = new google.maps.places.Autocomplete(el, {
        language: 'fr',
        fields: ['formatted_address','name','place_id'],
        componentRestrictions: { country: ['be','fr','lu','nl','de','gb','ch'] }
      });
      el._gp.addListener('place_changed', function(){
        var place = el._gp.getPlace();
        if(place){
          var name = place.name || '';
          var addr = place.formatted_address || '';
          if(name && addr && addr.toLowerCase().indexOf(name.toLowerCase()) === -1){
            el.value = name + ', ' + addr;
          } else if(addr){
            el.value = addr;
          } else if(name){
            el.value = name;
          }
        }
        _gpMark(el, place);
        if(window._trRefresh) window._trRefresh();
      });
    }
  });
};

// Re-attach when modal opens (inputs may have been reset)
document.addEventListener('DOMContentLoaded', function(){
  var mNewRide = document.getElementById('m-new-ride');
  if(mNewRide){
    var obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(m.target.classList.contains('open') || m.target.classList.contains('modal-overlay')){
          if(window.google && window.google.maps && window.google.maps.places) _attachGoogleAC();
        }
      });
    });
    obs.observe(mNewRide, {attributes:true, attributeFilter:['class']});
  }
});

// ── Adresses choisies dans la liste Google (obligatoire pour publier une demande) ──
// Lieu choisi : data-gp = texte affiché, data-pid = identifiant Google (vérifié ensuite par le serveur).
// Texte tapé sans choisir dans la liste : refusé. Texte pré-rempli (modification, duplication, IA) : retrouvé chez Google.
function _gpMark(el, place){
  if(!el) return;
  if(place && place.place_id){ el.dataset.gp=el.value; el.dataset.pid=place.place_id; el.classList.remove('gp-bad'); }
}
window._gpMark=_gpMark;
document.addEventListener('input', function(e){
  var el=e.target; if(!el || !el._gp) return;
  if(el.value!==el.dataset.gp){ delete el.dataset.pid; delete el.dataset.gp; el.dataset.gpTyped=el.value; }
}, true);
// Identifiant Google du lieu d'un champ : '' si vide, null si l'adresse n'est pas reconnue
window._gpPid=function(el){
  return new Promise(function(res){
    if(!el) return res(null);
    var v=String(el.value||'').trim();
    if(!v) return res('');
    if(el.dataset.pid && el.dataset.gp===el.value) return res(el.dataset.pid);
    if(el.dataset.gpTyped===el.value) return res(null);   // tapé sans choisir dans la liste
    if(!(window.google && google.maps && google.maps.places)) return res(undefined);   // Google indisponible : le serveur tranchera
    try{
      var svc=new google.maps.places.PlacesService(document.createElement('div'));
      svc.findPlaceFromQuery({ query:v, fields:['place_id'], language:'fr' }, function(r, st){
        var pid=(st===google.maps.places.PlacesServiceStatus.OK && r && r[0] && r[0].place_id) || undefined;
        if(pid){ el.dataset.gp=el.value; el.dataset.pid=pid; }
        res(pid);   // non retrouvé : le serveur tranchera (adresse inchangée en modification = acceptée)
      });
    }catch(e){ res(undefined); }
  });
};
// Vérifie une liste de champs { el, label } : renvoie { ids:{...}, err:'message' }
window._gpCheckFields=async function(list){
  var ids={}, err='';
  for(var i=0;i<list.length;i++){
    var f=list[i]; if(!f.el) continue;
    var pid=await window._gpPid(f.el);
    if(pid===null){ f.el.classList.add('gp-bad'); if(!err){ err=(typeof t==='function' && t('gp.err_pick')!=='gp.err_pick' ? t('gp.err_pick') : 'Choisissez l’adresse dans la liste proposée par Google')+' : '+f.label+'.'; try{ f.el.focus(); }catch(e){} } }
    else if(pid){ ids[f.key]=pid; }
  }
  return { ids:ids, err:err };
};

// Stub for backward compat
window.acSearch = function(){};
window.acPick   = function(iid,lid,v){ var i=document.getElementById(iid); if(i) i.value=v; };


'use strict';
/* ═══════════════════════════════════════════════════════
   DISPOSAL — Full Supabase App
   All functions exposed on window for inline onclick handlers
═══════════════════════════════════════════════════════ */

