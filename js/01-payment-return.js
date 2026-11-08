// Pop-up de résultat de paiement (même présentation que « Paiement confirmé ») : tone = cancel | error
window._payPopup=function(o){
  o=o||{};
  var old=document.getElementById('pay-popup'); if(old) old.remove();
  var esc=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var err=o.tone==='error';
  var grad='linear-gradient(135deg,#A8322A 0%,#C8453A 100%)';   // annulé / échoué : rouge d'erreur
  var ic=err?'<path d="M12 7v6M12 16.5v.5"/>':'<path d="M7 7l10 10M17 7L7 17"/>';
  var ov=document.createElement('div'); ov.id='pay-popup';
  ov.style.cssText='position:fixed;inset:0;background:rgba(14,20,16,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML='<div style="background:#fff;border-radius:20px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:\'DM Sans\',sans-serif;">'
    +'<div style="background:'+grad+';padding:30px 24px 24px;text-align:center;color:#fff;">'
      +'<div style="width:62px;height:62px;border-radius:50%;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">'
        +'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'+ic+'</svg></div>'
      +'<div style="font-size:20px;font-weight:700;letter-spacing:-.2px;">'+esc(o.title||'')+'</div>'
      +(o.sub?'<div style="font-size:13.5px;opacity:.88;margin-top:5px;">'+esc(o.sub)+'</div>':'')
    +'</div>'
    +'<div style="padding:18px 24px 0;font-size:14px;color:#3F4A44;line-height:1.55;text-align:center;">'+esc(o.msg||'')+'</div>'
    +'<div style="padding:20px 24px 22px;display:flex;gap:10px;">'
      +'<button data-act="rides" style="flex:1;padding:12px;background:#fff;color:#1B5E3B;border:1.5px solid #CFE3D6;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Mes demandes</button>'
      +'<button data-act="close" style="flex:1;padding:12px;background:'+((o.tone==='error'||o.tone==='cancel')?'#A8322A':'#1B5E3B')+';color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">'+esc(o.ok||'Fermer')+'</button>'
    +'</div></div>';
  ov.addEventListener('click',function(e){
    var b=e.target.closest('button[data-act]'); if(!b) return;
    ov.remove(); if(b.dataset.act==='rides' && typeof showPage==='function') showPage('rides');
  });
  document.body.appendChild(ov);
};
(function(){
  var params=new URLSearchParams(window.location.search);
  var payStatus=params.get('payment'),pRide=params.get('ride'),pOffer=params.get('offer'),pSess=params.get('session_id'),pSupp=params.get('supp');
  if(!payStatus)return;
  window.history.replaceState({},'',window.location.pathname);
  window._stripePendingReturn = {status: payStatus, ride: pRide, offer: pOffer, session: pSess, supp: pSupp==='1'};
  window._stripeResetEntering = true;

  // For cancel/error: inject a self-contained overlay that shows immediately
  if(payStatus==='cancel' || payStatus==='error'){
    var msg = payStatus==='cancel'
      ? 'Vous avez annulé le paiement. Vous pouvez réessayer depuis vos demandes.'
      : 'Le paiement n\'a pas pu être traité. Vous pouvez réessayer.';
    var title = payStatus==='cancel' ? 'Paiement annulé' : 'Paiement échoué';

    window._showStripeCancel = function(){
      window._payPopup({ tone: payStatus==='cancel'?'cancel':'error', title: title,
        sub: payStatus==='cancel'?'Aucun montant n’a été débité.':'Aucun montant n’a été débité.', msg: msg });
      window._stripePendingReturn = null;
    };

    // Try immediately, then retry until body is ready
    var _try = function(){
      if(document.body){ window._showStripeCancel(); }
      else { setTimeout(_try, 100); }
    };
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(window._showStripeCancel, 500); });
    } else {
      setTimeout(_try, 500);
    }
  }
})();

