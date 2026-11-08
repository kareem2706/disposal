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
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(el && !el._gp){
      el._gp = new google.maps.places.Autocomplete(el, {
        language: 'fr',
        fields: ['formatted_address','name','geometry'],
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
        fields: ['formatted_address','name'],
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

// Stub for backward compat
window.acSearch = function(){};
window.acPick   = function(iid,lid,v){ var i=document.getElementById(iid); if(i) i.value=v; };


'use strict';
/* ═══════════════════════════════════════════════════════
   DISPOSAL — Full Supabase App
   All functions exposed on window for inline onclick handlers
═══════════════════════════════════════════════════════ */

