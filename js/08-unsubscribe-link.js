// ── Partie commune (clients / fleets) — le reste est dans js/admin/08-campaigns.js (chargé seulement pour l’admin) ──
// Tri des listes de courses : la plus récente (date / heure de la course) en haut
function _byNewest(a,b){
  var ka=(a.ride_date||'')+' '+String(a.ride_time||'').slice(0,5)+' '+(a.created_at||'');
  var kb=(b.ride_date||'')+' '+String(b.ride_time||'').slice(0,5)+' '+(b.created_at||'');
  return kb.localeCompare(ka);
}

// Retour du lien « Se désinscrire » d'une campagne
(function(){
  try{
    var q=new URLSearchParams(location.search), u=q.get('unsubscribed');
    if(u===null) return;
    history.replaceState(null,'',location.pathname+location.hash);
    setTimeout(function(){
      if(typeof showToast==='function') showToast(u==='1'?'✅ Vous êtes désinscrit des offres et nouveautés Bleenr':'Lien de désinscription invalide ou expiré');
    }, 1200);
  }catch(e){}
})();
