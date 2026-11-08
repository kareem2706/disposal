// ════════════════════════════════════════════════════════════════
// Démarrage — landing.js est toujours chargé ; app.js (l'application) :
//   • tout de suite pour un utilisateur connecté, la démo, un retour de paiement ou de connexion
//     (balises écrites en fin de page, comme avant) ;
//   • à la demande pour un visiteur (clic sur « Se connecter », « Créer un compte », « Recevoir des offres »…),
//     téléchargé à l'avance quand le navigateur est inactif.
// ════════════════════════════════════════════════════════════════

// Code à lancer quand la page est prête — fonctionne aussi si app.js arrive après DOMContentLoaded / load
function _onReady(fn){ if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else setTimeout(fn, 0); }
function _onLoad(fn){ if(document.readyState === 'complete') setTimeout(fn, 0); else window.addEventListener('load', fn); }

function _loadScript(src){
  return new Promise(function(res, rej){
    var s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = function(){ res(); }; s.onerror = function(){ rej(new Error('Chargement impossible : ' + src)); };
    document.body.appendChild(s);
  });
}

// Dictionnaire d'une langue (i18n/xx.js), chargé si absent
var _i18nP = {};
function _i18nLoad(l){
  if(window.I18N && window.I18N[l]) return Promise.resolve();
  return _i18nP[l] || (_i18nP[l] = _loadScript('i18n/' + l + '.js?v=__V__').catch(function(e){ delete _i18nP[l]; throw e; }));
}

// L'application : SDK Supabase + app.js. Résolue quand l'initialisation (session) est terminée.
var _appP = null;
window._appReady = new Promise(function(res){ window._appReadyResolve = res; });
function _loadApp(){
  if(window._appLoaded) return window._appReady;
  if(!_appP){
    var ld = document.getElementById('app-loader'); if(ld) ld.style.display = 'flex';
    document.documentElement.classList.remove('boot-landing');
    _appP = Promise.all([
      _i18nLoad(typeof currentLang !== 'undefined' ? currentLang : 'fr').catch(function(){}),
      window.supabase ? null : _loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js').catch(function(){})
    ]).then(function(){ return _loadScript('app.js?v=__V__'); })
      .then(function(){ return window._appReady; })
      .catch(function(e){ _appP = null; if(ld) ld.style.display = 'none'; console.error(e); throw e; });
  }
  return _appP;
}

// Visiteur : application téléchargée (sans être exécutée) quand le navigateur est inactif
_onLoad(function(){
  if(!document.documentElement.classList.contains('boot-landing')) return;
  var go = function(){
    ['app.js?v=__V__', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'].forEach(function(h){
      var l = document.createElement('link'); l.rel = 'prefetch'; l.href = h; document.head.appendChild(l);
    });
  };
  if(window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2500);
});
