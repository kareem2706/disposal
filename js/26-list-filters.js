// ════════════════════════════════════════════════════════════════
// Filtres des listes (12/11/2026) — bouton « Filtres » à droite des onglets
//   • Fleet › Mes missions : Clients / Sous-traitances + période
//   • Fleet › Marketplace  : type de trajet + période (les onglets séparent déjà clients et sous-traitances)
//   • Client › Mes demandes : trajet simple / mise à disposition / mixte / événement + période
// Filtrage à l'affichage (les cartes déjà chargées sont masquées) : réappliqué après chaque rechargement des listes.
// ════════════════════════════════════════════════════════════════
(function(){
  var CFG = {
    missions:    { page:'page-missions',    bar:'#page-missions .mktabs',    lists:['ms-upcoming','ms-done','ms-cancelled'],
                   types:[['client','lf.clients'],['sub','lf.subs']] },
    marketplace: { page:'page-marketplace', bar:'#page-marketplace .mktabs', lists:['mk-client','mk-sub','mk-mine-list'],
                   types:[['ab','lf.ab'],['disposal','lf.disposal'],['mixed','lf.mixed']] },
    rides:       { page:'page-rides',       bar:'#rides-filters',            lists:['all-rides-list'],
                   types:[['ab','lf.ab'],['disposal','lf.disposal'],['mixed','lf.mixed'],['event','lf.event']] }
  };
  var PERIODS = [['all','lf.p_all'],['today','lf.p_today'],['week','lf.p_week'],['month','lf.p_month'],['next_month','lf.p_next_month'],['last_month','lf.p_last_month'],['custom','lf.p_custom']];
  var state = {};   // key → { type:'all', period:'all', from:'', to:'' }
  var st = function(k){ return state[k] || (state[k] = { type:'all', period:'all', from:'', to:'' }); };
  var esc = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var ymd = function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };

  // Bornes de la période (dates AAAA-MM-JJ incluses), null = pas de borne
  function range(s){
    var n = new Date(); n.setHours(0,0,0,0);
    if(s.period==='today') return [ymd(n), ymd(n)];
    if(s.period==='week'){ var m=new Date(n); m.setDate(n.getDate()-((n.getDay()+6)%7)); var e=new Date(m); e.setDate(m.getDate()+6); return [ymd(m), ymd(e)]; }
    if(s.period==='month') return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(new Date(n.getFullYear(), n.getMonth()+1, 0))];
    if(s.period==='next_month') return [ymd(new Date(n.getFullYear(), n.getMonth()+1, 1)), ymd(new Date(n.getFullYear(), n.getMonth()+2, 0))];
    if(s.period==='last_month') return [ymd(new Date(n.getFullYear(), n.getMonth()-1, 1)), ymd(new Date(n.getFullYear(), n.getMonth(), 0))];
    if(s.period==='custom') return [s.from||null, s.to||null];
    return [null, null];
  }
  function activeCount(s){ return (s.type!=='all'?1:0) + (s.period!=='all' && (s.period!=='custom' || s.from || s.to) ? 1 : 0); }

  // La carte passe-t-elle les filtres ?
  function match(key, card, s){
    var kind, d1, d2, r = null;
    if(card.classList.contains('ev-card')){
      kind = card.getAttribute('data-ev-kind') || 'event';
      d1 = card.getAttribute('data-ev-from') || ''; d2 = card.getAttribute('data-ev-to') || d1;
    } else {
      try{ r = JSON.parse(card.getAttribute('data-ride') || 'null'); }catch(e){ r = null; }
      if(!r) return true;
      d1 = d2 = String(r.ride_date || '').slice(0,10);
      kind = key==='missions' ? (r.is_subcontract ? 'sub' : 'client') : (r.trip_type==='disposal' ? 'disposal' : r.trip_type==='mixed' ? 'mixed' : 'ab');
    }
    if(s.type!=='all' && kind!==s.type) return false;
    var rg = range(s);
    if(rg[0] && (!d2 || d2 < rg[0])) return false;
    if(rg[1] && (!d1 || d1 > rg[1])) return false;
    return true;
  }

  function apply(key){
    var c = CFG[key], s = st(key), on = activeCount(s) > 0;
    c.lists.forEach(function(id){
      var box = document.getElementById(id); if(!box) return;
      var cards = box.querySelectorAll('.ride-card'), shown = 0;
      cards.forEach(function(card){ var ok = !on || match(key, card, s); card.style.display = ok ? '' : 'none'; if(ok) shown++; });
      var msg = box.querySelector(':scope > .lf-empty');
      if(on && cards.length && !shown){
        if(!msg){ msg = document.createElement('div'); msg.className = 'lf-empty empty-state'; box.appendChild(msg); }
        msg.innerHTML = '<p class="empty-text">'+esc(t('lf.no_result'))+' <button type="button" class="lf-link" onclick="_lfReset(\''+key+'\')">'+esc(t('lf.reset'))+'</button></p>';
      } else if(msg) msg.remove();
    });
    var btn = document.getElementById('lf-btn-'+key);
    if(btn){ var n = activeCount(s); btn.classList.toggle('on', n>0); btn.querySelector('.lf-n').textContent = n ? n : ''; }
  }

  function panelHtml(key){
    var c = CFG[key], s = st(key);
    var chip = function(grp, v, label, cur){ return '<button type="button" class="lf-chip'+(cur===v?' on':'')+'" onclick="_lfSet(\''+key+'\',\''+grp+'\',\''+v+'\')">'+esc(t(label))+'</button>'; };
    return '<div class="lf-sec"><div class="lf-lbl">'+esc(t('lf.type'))+'</div><div class="lf-chips">'
        + chip('type','all','lf.all',s.type) + c.types.map(function(x){ return chip('type',x[0],x[1],s.type); }).join('') + '</div></div>'
      + '<div class="lf-sec"><div class="lf-lbl">'+esc(t('lf.period'))+'</div><div class="lf-chips">'
        + PERIODS.map(function(x){ return chip('period',x[0],x[1],s.period); }).join('') + '</div>'
        + (s.period==='custom' ? '<div class="lf-dates"><label>'+esc(t('lf.from'))+'<input type="date" value="'+esc(s.from)+'" onchange="_lfDate(\''+key+'\',\'from\',this.value)"></label>'
            + '<label>'+esc(t('lf.to'))+'<input type="date" value="'+esc(s.to)+'" onchange="_lfDate(\''+key+'\',\'to\',this.value)"></label></div>' : '')
      + '</div>'
      + '<div class="lf-foot"><button type="button" class="lf-link" onclick="_lfReset(\''+key+'\')">'+esc(t('lf.reset'))+'</button>'
      + '<button type="button" class="lf-apply" onclick="_lfClose()">'+esc(t('lf.done'))+'</button></div>';
  }
  function renderPanel(key){ var p = document.getElementById('lf-pop-'+key); if(p) p.innerHTML = panelHtml(key); }

  window._lfSet = function(key, grp, v){ var s = st(key); s[grp] = v; renderPanel(key); apply(key); };
  window._lfDate = function(key, k, v){ st(key)[k] = v || ''; apply(key); };
  window._lfReset = function(key){ state[key] = null; renderPanel(key); apply(key); };
  window._lfClose = function(){ document.querySelectorAll('.lf-pop.open').forEach(function(p){ p.classList.remove('open'); }); };
  window._lfToggle = function(key, ev){
    if(ev) ev.stopPropagation();
    var p = document.getElementById('lf-pop-'+key), was = p && p.classList.contains('open');
    _lfClose();
    if(p && !was){ renderPanel(key); p.classList.add('open'); }
  };
  document.addEventListener('click', function(e){ if(!e.target.closest || !e.target.closest('.lf-wrap')) _lfClose(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') _lfClose(); });

  function mount(key){
    var c = CFG[key], bar = document.querySelector(c.bar);
    if(!bar || document.getElementById('lf-btn-'+key)) return;
    var wrap = document.createElement('div'); wrap.className = 'lf-wrap';
    wrap.innerHTML = '<button type="button" class="lf-btn" id="lf-btn-'+key+'" onclick="_lfToggle(\''+key+'\',event)" aria-haspopup="true">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>'
      + '<span>'+esc(t('lf.filters'))+'</span><span class="lf-n"></span></button>'
      + '<div class="lf-pop" id="lf-pop-'+key+'" role="dialog" onclick="event.stopPropagation()"></div>';
    if(key==='rides'){ wrap.style.marginLeft = 'auto'; bar.appendChild(wrap); }
    else {
      // Onglets + bouton sur une même ligne
      var row = document.createElement('div'); row.className = 'lf-row';
      bar.parentNode.insertBefore(row, bar); row.appendChild(bar); row.appendChild(wrap);
    }
    // Réappliquer après chaque rechargement d'une liste
    c.lists.forEach(function(id){
      var box = document.getElementById(id); if(!box) return;
      var busy = false;
      new MutationObserver(function(){ if(busy) return; busy = true; try{ apply(key); } finally { setTimeout(function(){ busy = false; }, 0); } })
        .observe(box, { childList:true });
    });
    apply(key);
  }
  _onReady(function(){ Object.keys(CFG).forEach(mount); });
})();
