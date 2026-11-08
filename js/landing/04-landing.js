// ── Page d'accueil : toujours chargée (landing.js), sans le code de l'application ──
// « Se connecter / Créer un compte » : charge l'application (app.js) puis ouvre l'écran de connexion.
// Quand app.js est chargé, il remplace cette fonction par la vraie (js/20-routing-notifications.js).
window.showLandingAuth = function(mode){
  var stub = window.showLandingAuth;
  _loadApp().then(function(){ if(window.showLandingAuth !== stub) window.showLandingAuth(mode); });
};

// Landing (Signature) — scroll story, services track, classes, reveals
document.getElementById('screen-landing') && (function(){
  var L = document.getElementById('screen-landing');
  var $ = function(id){ return document.getElementById(id); };
  var nav = $('ld-nav'), heroBg = $('ld-hero-bg');
  var story = $('ld-story'), clock = $('ld-clock');
  var chaps = [].slice.call(story.querySelectorAll('.ld-chap'));
  var frames = [].slice.call(story.querySelectorAll('.ld-frame'));
  var pars = frames.map(function(f){ return f.querySelector('.ld-par'); });
  var cards = [].slice.call(story.querySelectorAll('.ld-card'));
  var bars = [].slice.call(story.querySelectorAll('.ld-rail b'));
  var svc = $('ld-services'), track = $('ld-track'), count = $('ld-svc-count');
  var svcPars = [].slice.call(track.querySelectorAll('.ld-par'));
  var drvImg = $('ld-drv-img'), drvPar = $('ld-drv-par');
  var rvs = [].slice.call(L.querySelectorAll('.ld-rv'));
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = chaps.length, S = svcPars.length, cur = -1;

  function clamp(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
  function prog(el){ var r = el.getBoundingClientRect(), t = el.offsetHeight - innerHeight; return t > 0 ? clamp(-r.top / t) : 0; }

  // cities marquee
  function setCities(){
    var cities = t('ld.cities').split('|');
    var ch = cities.map(function(c){ return '<span class="ld-city">'+c+'</span>'; }).join('');
    $('ld-cities').innerHTML = ch + ch;
  }
  setCities();

  // classes tabs
  // classes : nom, modèles et description traduits (ld.cls<n>_*)
  var CLS = [ { c:'Economy', pax:3, bag:3 }, { c:'Business', pax:3, bag:3 }, { c:null, pax:3, bag:3 }, { c:'Van', pax:7, bag:7 }, { c:null, pax:50, bag:50 } ];
  var tabs = [].slice.call($('ld-cls-tabs').children), imgs = [].slice.call($('ld-cls-img').children), info = $('ld-cls-info');
  var curCls = 0;
  function setCls(k){
    curCls = k;
    var c = { c: CLS[k].c || t('ld.cls'+k+'_name'), m: t('ld.cls'+k+'_models'), d: t('ld.cls'+k+'_desc'), pax: CLS[k].pax, bag: CLS[k].bag };
    tabs.forEach(function(t,i){ t.classList.toggle('on', i===k); });
    imgs.forEach(function(t,i){ t.classList.toggle('on', i===k); });
    info.innerHTML = '<div class="ld-fade"><h3 class="ld-serif">'+c.c+'</h3><div class="models">'+c.m+'</div><div class="ld-cls-specs"><div><b>'+c.pax+'</b><span>'+t('ld.pax_max')+'</span></div><div><b>'+c.bag+'</b><span>'+t('ld.bags')+'</span></div></div></div><p class="ld-fade" style="animation-delay:.08s">'+c.d+'</p>';
  }
  tabs.forEach(function(t,i){ t.onclick = function(){ setCls(i); }; });
  setCls(0);
  // changement de langue : contenus construits en JS
  window._i18nRefresh = function(){
    setCities(); setCls(curCls);
    if(window._auSideSync) window._auSideSync();
    var _p = !!window._loginPwdMode;
    var _b = document.getElementById('btn-email-submit'); if(_b && !_b.disabled) _b.textContent = _p ? t('au.login_btn') : t('au.recevoir_un_code');
    var _l = document.getElementById('login-mode-link'); if(_l) _l.textContent = _p ? t('au.code_instead') : t('au.login_with_pwd');
    var _r = document.getElementById('btn-reg-submit'); if(_r && !_r.disabled) _r.textContent = t('au.recevoir_un_code');
  };

  // booking widget
  var mode = 'trajet';
  [].slice.call(L.querySelectorAll('[data-ld-mode]')).forEach(function(b, _, all){
    b.onclick = function(){
      mode = b.getAttribute('data-ld-mode');
      all.forEach(function(x){ x.classList.toggle('on', x===b); });
      $('ld-to-wrap').style.display = mode==='trajet' ? '' : 'none';
      $('ld-dur-wrap').style.display = mode==='heure' ? '' : 'none';
    };
  });
  // Chrome (gestionnaire de mots de passe) remplissait « Arrivée » avec l'e-mail enregistré :
  // les champs restent en lecture seule (jamais remplis par le navigateur) jusqu'à ce que l'utilisateur les touche
  ['ld-from','ld-to'].forEach(function(id){
    var el = $(id); if(!el) return;
    var clr = function(){ if(el.value.indexOf('@') > -1 && !el.dataset.typed) el.value = ''; };
    var unlock = function(){ if(el.hasAttribute('readonly')){ el.removeAttribute('readonly'); clr(); } };
    ['pointerdown','touchstart','focus','keydown'].forEach(function(ev){ el.addEventListener(ev, unlock); });
    el.addEventListener('input', function(e){ if(e.isTrusted && e.inputType) el.dataset.typed='1'; });
    [0, 300, 1200, 3000].forEach(function(ms){ setTimeout(clr, ms); });
  });
  var d = $('ld-date'); if(d && !d.value){ var _tm = new Date(Date.now()+864e5); d.value = _tm.toISOString().slice(0,10); }
  $('ld-book-go').onclick = function(){
    try{ sessionStorage.setItem('bleenr_landing_draft', JSON.stringify({ mode:mode, from:$('ld-from').value, to:$('ld-to').value, duration:$('ld-dur').value, date:$('ld-date').value, time:$('ld-time').value })); }catch(e){}
    _ldDemo({ mode:mode, from:$('ld-from').value, to:$('ld-to').value, dur:$('ld-dur').value, durTxt:$('ld-dur').selectedOptions[0] ? $('ld-dur').selectedOptions[0].textContent : '', date:$('ld-date').value, time:$('ld-time').value });
  };

  // Aperçu de l'application avec des données de test (aucune donnée n'est envoyée)
  function _ldDemo(f){
    var E = function(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    var P = {
      plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', grid:'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
      list:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h8M8 14h5"/>', cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
      doc:'<path d="M7 3h7l4 4v14H7z"/><path d="M10 11h5M10 15h5"/>', help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 3.5M12 17h.01"/>',
      out:'<path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/>', check:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 5-5"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      msg:'<path d="M5 5h14v11H9l-4 4z"/>', bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', clip:'<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 3h6v4H9z"/>',
      car:'<path d="M5 16V12l2-5h10l2 5v4z"/><circle cx="8.5" cy="13.5" r=".8"/><circle cx="15.5" cy="13.5" r=".8"/><path d="M5 16v2M19 16v2"/>', user:'<circle cx="12" cy="8" r="4"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
      pin:'<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>', ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', back:'<path d="M15 6l-6 6 6 6"/>', arr:'<path d="M5 12h14M13 6l6 6-6 6"/>',
      bolt:'<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', wifi:'<path d="M4 9a12 12 0 0 1 16 0M7 12.5a7 7 0 0 1 10 0M10 16a3 3 0 0 1 4 0"/>', drop:'<path d="M12 4s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z"/>', eur:'<path d="M17 6.5A6 6 0 0 0 7.5 9M17 17.5A6 6 0 0 1 7.5 15M5 10.5h8M5 13.5h8"/>',
      chev:'<path d="M9 6l6 6-6 6"/>', down:'<path d="M6 9l6 6 6-6"/>', dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', phone:'<path d="M6 4h4l2 5-2.5 1.5a11 11 0 0 0 4 4L15 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z"/>'
    };
    var I = function(n, st){ return '<svg viewBox="0 0 24 24"' + (st ? ' style="' + st + '"' : '') + '>' + P[n] + '</svg>'; };
    var heure = f.mode === 'heure';
    var _ok = function(v){ v = String(v || '').trim(); return v.indexOf('@') > -1 ? '' : v; }; // ignore l'e-mail inséré par le remplissage auto du navigateur
    var from = _ok(f.from) || 'Gare du Midi, 1060 Saint-Gilles, Belgique';
    var to = _ok(f.to) || "Pl. de l'Atomium 1, 1020 Bruxelles, Belgique";
    var short = function(a){ return String(a).split(',')[0].trim(); };
    var dt = f.date ? new Date(f.date + 'T12:00:00') : new Date(Date.now() + 864e5);
    var tm = E(f.time || '09:00');
    var dLong = dt.toLocaleDateString(_i18nLocale(), { weekday:'short', day:'numeric', month:'short' }).replace('.', '');
    dLong = dLong.charAt(0).toUpperCase() + dLong.slice(1);
    var dDay = dt.getDate(), dMon = dt.toLocaleDateString(_i18nLocale(), { month:'short' }).replace('.', '').toUpperCase().slice(0, 3);
    var dFr = ('0' + dDay).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2) + '/' + dt.getFullYear();
    var hrs = parseInt(f.dur, 10) || 3, durTxt = E(f.durTxt || t('ld.n_hours', { n:hrs }));
    var p1 = heure ? hrs * 59.9 : 68.9, p2 = heure ? hrs * 64.5 : 74.2;
    var eur = function(n){ return n.toLocaleString(_i18nLocale(), { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €'; };
    var code = 'BLAB-' + (1026000 + Math.floor(Math.random() * 900));
    var logo = (document.querySelector('.sidebar-logo img') || {}).src || '';
    var dest = heure ? t('dm.disposal') + ' · ' + durTxt : E(to);
    var trajet = heure ? E(short(from)) + ' · ' + durTxt : E(short(from)) + ' → ' + E(short(to));

    var side = '<div class="ldm-side"><div class="ldm-logo">' + (logo ? '<img src="' + logo + '" alt="Bleenr">' : '<b style="font-size:28px;color:#1B5E3B">Bleenr</b>') + '</div>'
      + '<div class="ldm-user"><div class="a">J</div><div><b>Julie</b><small>' + t('dm.client_badge') + '</small></div></div><div class="ldm-sep"></div>'
      + '<div class="ldm-new">' + I('plus') + '' + t('dm.new_request') + '</div>'
      + '<div class="ldm-nv on">' + I('grid') + '' + t('dm.dashboard') + '</div><div class="ldm-nv">' + I('list') + '' + t('dm.my_requests') + '</div><div class="ldm-nv">' + I('cal') + '' + t('dm.calendar') + '</div><div class="ldm-nv">' + I('doc') + '' + t('dm.invoices') + '</div>'
      + '<div class="ldm-help"><b>' + I('help') + '' + t('dm.help') + '</b>' + t('dm.help_q') + '<u>info@bleenr.com</u></div>'
      + '<div class="ldm-out">' + I('out') + '' + t('dm.logout') + '</div><div class="ldm-lang">' + [currentLang.toUpperCase()].concat(['FR','EN','ES'].filter(function(x){ return x !== currentLang.toUpperCase(); })).map(function(x){ return '<span>' + x + '</span>'; }).join('') + '</div></div>';
    var stat = function(ic, bg, col, k, v, hl){ return '<div class="ldm-stat' + (hl ? ' hl' : '') + '"><div class="i" style="background:' + bg + ';color:' + col + '">' + I(ic) + '</div><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; };
    var row = function(pill, prix){ return '<div class="ldm-row"><div class="d"><small>' + dMon + '</small><b>' + dDay + '</b></div><div class="ldm-tag">' + (heure ? t('dm.dispo_tag') : 'A→B') + '</div>'
      + '<div class="c"><small>' + t('dm.origin') + '</small><div>' + E(from) + '</div></div><div class="c"><small>' + t('dm.destination') + '</small><div>' + dest + '</div></div>'
      + '<div class="c"><small>' + t('dm.status') + '</small>' + pill + '</div><div class="c p"><small>' + t('dm.price') + '</small><div>' + prix + '</div></div><div style="color:#6B7A70">' + I('chev') + '</div></div>'; };
    var main = function(o){ return '<div class="ldm-main"><div class="ldm-ttl"><div class="ldm-ic">' + I('grid') + '</div><div><h3>' + t('dm.dashboard') + '</h3><p>' + t('dm.overview') + '</p></div></div>'
      + '<div class="ldm-bell">' + I('bell') + (o.bell ? '<em>' + o.bell + '</em>' : '') + '</div>'
      + '<div class="ldm-stats">' + stat('check', '#E3F1E8', '#1B5E3B', t('dm.st_done'), o.done) + stat('clock', '#FFF3DC', '#2B2B2B', t('dm.st_wait'), o.wait, o.hl === 'wait')
      + stat('msg', '#E8F0FB', '#2B2B2B', t('dm.st_offers'), o.offers, o.hl === 'offers') + stat('eur', '#FDE8E6', '#C0392B', t('dm.st_paid'), o.paid) + '</div>'
      + '<div class="ldm-rh"><b>' + I('clip') + '' + t('dm.recent') + '</b>' + (o.row ? '<span>' + t('dm.see_all') + '</span>' : '') + '</div>'
      + (o.row || '<div class="ldm-empty">' + t('dm.none') + '</div>') + '</div>'; };
    var drawer = function(head, body, foot){ return '<div class="ldm-drw"><div class="ldm-dh">' + head + '<div class="x">✕</div></div><div class="ldm-db">' + body + '</div>' + (foot || '') + '</div>'; };
    var offer = function(best, model, cls, stars, avis, price, opts, msg){ return '<div class="ldm-of' + (best ? ' best' : '') + '">' + (best ? '<div class="bp">' + t('dm.best_price') + '</div>' : '')
      + '<div class="ldm-oh"><div class="vi">' + I('car') + '</div><div><b>' + model + '</b><div class="m"><span class="cl">' + cls + '</span><span class="st">★ ' + stars + '</span>(' + avis + ')</div></div><div class="pr">' + eur(price) + '<small>' + t('dm.vat_incl') + '</small></div></div>'
      + '<div class="ldm-opts">' + opts.map(function(x){ return '<span>' + x + '</span>'; }).join('') + '</div>'
      + '<div class="ldm-msg">' + I('msg', 'width:16px;height:16px') + msg + '</div>'
      + '<div class="ft"><span>' + t('dm.vehicle_details') + '</span><span class="ch">' + t('dm.choose') + '</span></div></div>'; };

    var formBody = '<div class="ldm-lb" style="margin-top:0">' + t('dm.ride_type') + '</div><div class="ldm-types"><div' + (heure ? '' : ' class="on"') + '>A → B</div><div' + (heure ? ' class="on"' : '') + '>' + t('dm.disposition') + '</div><div>' + t('dm.mixed') + '</div></div>'
      + '<div class="ldm-lb">' + t('dm.from') + ' <i>*</i></div><div class="ldm-in">' + E(from) + '</div>'
      + (heure ? '<div class="ldm-lb">' + t('dm.duration') + ' <i>*</i></div><div class="ldm-in">' + durTxt + '</div>' : '<div class="ldm-lb">' + t('dm.to') + ' <i>*</i></div><div class="ldm-in">' + E(to) + '</div>')
      + '<div class="ldm-g2"><div><div class="ldm-lb">' + t('dm.date') + ' <i>*</i></div><div class="ldm-in">' + dFr + '</div></div><div><div class="ldm-lb">' + t('dm.time') + ' <i>*</i></div><div class="ldm-in">' + tm + '</div></div></div>'
      + '<div class="ldm-g2"><div><div class="ldm-lb">' + t('dm.passengers') + '</div><div class="ldm-in">1</div></div><div><div class="ldm-lb">' + t('dm.vehicle') + '</div><div class="ldm-in">Business</div></div></div>'
      + '<div class="ldm-lb">' + t('dm.instructions') + '</div><div class="ldm-in ph" style="height:62px">' + t('dm.instr_ph') + '</div>'
      + '<div class="ldm-pax"><small>' + t('dm.pax_info') + '</small><b>Julie Martin</b><span>0470 12 34 56</span></div>';
    var offersBody = '<div class="ldm-sum"><div class="ldm-chips"><span class="ldm-ch d">' + I('cal', 'width:15px;height:15px') + dLong + ' &nbsp;|&nbsp; ' + I('clock', 'width:15px;height:15px') + tm + '</span><span class="ldm-ch">' + I('user', 'width:15px;height:15px') + t('dm.one_pax') + '</span><span class="ldm-ch">' + I('car', 'width:15px;height:15px') + 'Business</span></div>'
      + '<div class="ldm-rt">' + I('pin', 'width:16px;height:16px') + E(short(from)) + (heure ? ' · ' + durTxt : ' <span style="color:#6B7A70">→</span> ' + E(short(to))) + '</div></div>'
      + '<div class="ldm-flt"><div class="t"><span>' + t('dm.f_all') + '</span><span>⚡ ' + t('dm.f_elec') + '</span><span>' + t('dm.f_hybrid') + '</span></div><div class="s">' + t('dm.sort_price') + '</div></div>'
      + offer(true, 'Mercedes-Benz Classe E', 'BUSINESS', '5,0', t('dm.reviews2'), p1, t('dm.opts1').split('|'), t('dm.msg1'))
      + offer(false, 'Mercedes-Benz Classe V', 'VAN', '5,0', t('dm.reviews1'), p2, t('dm.opts2').split('|'), t('dm.msg2'));
    var modal = '<div class="ldm-veil"><div class="ldm-mod"><div class="ldm-mh"><div class="ok">' + I('ok') + '</div><b>' + t('dm.paid_t') + '</b><p>' + t('dm.paid_s') + '</p></div><div class="ldm-mb">'
      + '<div class="ldm-li"><span>' + t('dm.booking') + '</span><code>' + code + '</code></div><div class="ldm-li"><span>' + t('dm.date_l') + '</span><b>' + dDay + ' ' + dMon.toLowerCase() + '. · ' + tm + '</b></div>'
      + '<div class="ldm-li"><span>' + t('dm.trip') + '</span><b>' + trajet + '</b></div><div class="ldm-li"><span>' + t('dm.amount_paid') + '</span><b>' + eur(p1) + ' ' + t('dm.vat_incl') + '</b></div>'
      + '<p>' + t('dm.mail_sent') + '</p><div class="ldm-mbt"><div>' + t('dm.my_requests') + '</div><div>' + t('dm.continue') + '</div></div></div></div></div>';

    var tripBody = '<div class="ldm-trip"><small>' + t('dm.confirmed_k') + '' + code + '</small><b>' + t('dm.bon_voyage') + '</b><p>' + dLong + ' ' + t('dm.at') + ' ' + tm + ' · ' + trajet + '</p></div>'
      + '<div class="ldm-vch"><div class="vi">' + I('doc') + '</div><div><b>' + t('dm.voucher_t') + '</b><span>' + t('dm.voucher_s') + '</span></div><div class="dl">' + I('dl') + '' + t('dm.download') + '</div></div>'
      + '<div class="ldm-blk"><div class="vi">' + I('user') + '</div><div><b>Thomas M.</b> · ' + t('dm.your_driver') + '<br><span>' + t('dm.driver_waits') + '</span></div><div style="margin-left:auto;color:#1B5E3B">' + I('phone') + '</div></div>'
      + '<div class="ldm-blk"><div class="vi">' + I('car') + '</div><div><b>Mercedes-Benz Classe E</b><span class="ldm-plate">1-ABC-234</span><br><span>' + t('dm.black') + ' · Business</span></div></div>'
      + '<div class="ldm-steps2"><div><b>' + t('dm.step1_t') + '</b>' + t('dm.step1_s') + '</div><div><b>' + t('dm.step2_t') + '</b>' + t('dm.step2_s') + '</div><div><b>' + t('dm.step3_t') + '</b>' + t('dm.step3_s') + '</div></div>';
    var base = { done:23, wait:0, offers:0, paid:eur(1489.3) };
    var mk = function(o){ var x = {}; for(var k in base) x[k] = base[k]; for(var k2 in o) x[k2] = o[k2]; return x; };
    var screens = [
      { t:t('dm.s1_t'), c:t('dm.s1_c'),
        h:'<div class="ldm">' + side + main(mk({})) + drawer(t('dm.new_request'), formBody, '<div class="ldm-df"><span class="ldm-b">' + t('dm.cancel') + '</span><span class="ldm-b g">' + t('dm.publish') + '</span></div>') + '</div>' },
      { t:t('dm.s2_t'), c:t('dm.s2_c'),
        h:'<div class="ldm">' + side + main(mk({ wait:1, bell:2, hl:'wait', row:row('<span class="ldm-pill w">● ' + t('dm.pill_wait') + '</span>', '---') })) + '</div>' },
      { t:t('dm.s3_t'), c:t('dm.s3_c'),
        h:'<div class="ldm">' + side + main(mk({ offers:2, bell:4, hl:'offers', row:row('<span class="ldm-pill b">● ' + t('dm.pill_offers') + '</span>', t('dm.see_offers')) })) + drawer(I('back') + code + ' · ' + t('dm.offers_received'), offersBody) + '</div>' },
      { t:t('dm.s4_t'), c:t('dm.s4_c'),
        h:'<div class="ldm"><div class="ldm-blur" style="display:flex">' + side + main(mk({ done:24, paid:eur(1558.2), row:row('<span class="ldm-pill g">● ' + t('dm.pill_confirmed') + '</span>', eur(p1)) })) + '</div>' + modal + '</div>' },
      { t:t('dm.s5_t'), c:t('dm.s5_c'),
        h:'<div class="ldm">' + side + main(mk({ done:24, paid:eur(1558.2), row:row('<span class="ldm-pill g">● ' + t('dm.pill_confirmed') + '</span>', eur(p1)) })) + drawer(I('back') + code + ' · ' + t('dm.pill_confirmed'), tripBody) + '</div>' }
    ];

    var old = document.getElementById('ld-demo'); if(old) old.remove();
    var o = document.createElement('div');
    o.id = 'ld-demo'; o.className = 'ldd'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.innerHTML = '<button class="ldd-x" aria-label="' + t('dm.close') + '">✕</button>'
      + '<div class="ldd-head"><div class="ld-eye">' + t('dm.ov_eye') + '</div><h2 class="ld-serif">' + t('dm.ov_title') + '</h2><p>' + t('dm.ov_lead') + '</p></div>'
      + '<div class="ldd-steps">' + screens.map(function(s, i){ return '<button class="ldd-st" data-i="' + i + '"><span>' + (i + 1) + '</span>' + s.t + '</button>'; }).join('') + '</div>'
      + '<div class="ldd-stage"><button class="ldd-nav p" aria-label="' + t('dm.prev') + '">‹</button><div class="ldd-win"><div class="ldd-bar"><i></i><i></i><i></i><b>bleenr.com</b></div><div class="ldd-vp"><div class="ldd-scale">'
      + screens.map(function(s){ return '<div class="ldd-scr">' + s.h + '</div>'; }).join('') + '</div></div></div><button class="ldd-nav n" aria-label="' + t('dm.next') + '">›</button></div>'
      + '<div class="ldd-cap"></div>'
      + '<div class="ldd-foot"><button class="ld-btn" id="ld-demo-go">' + t('dm.create_account') + '</button><p>' + t('dm.free_already') + ' <a id="ld-demo-login">' + t('dm.login') + '</a></p></div>';
    L.appendChild(o);

    var vp = o.querySelector('.ldd-vp'), sc = o.querySelector('.ldd-scale'), scr = o.querySelectorAll('.ldd-scr'), sts = o.querySelectorAll('.ldd-st'), cap = o.querySelector('.ldd-cap');
    var fit = function(){ var k = vp.clientWidth / 1280; sc.style.transform = 'scale(' + k + ')'; vp.style.height = Math.round(760 * k) + 'px'; };
    var cur = 0, timer = null;
    var show = function(i){ cur = (i + screens.length) % screens.length;
      [].forEach.call(scr, function(x, j){ x.classList.toggle('on', j === cur); });
      [].forEach.call(sts, function(x, j){ x.classList.toggle('on', j === cur); });
      cap.textContent = screens[cur].c; };
    var stop = function(){ if(timer){ clearInterval(timer); timer = null; } };
    [].forEach.call(sts, function(b){ b.onclick = function(){ stop(); show(+b.getAttribute('data-i')); }; });
    o.querySelector('.ldd-nav.p').onclick = function(){ stop(); show(cur - 1); };
    o.querySelector('.ldd-nav.n').onclick = function(){ stop(); show(cur + 1); };
    var tx = null; vp.addEventListener('touchstart', function(e){ tx = e.touches[0].clientX; }, { passive:true });
    vp.addEventListener('touchend', function(e){ if(tx == null) return; var d = e.changedTouches[0].clientX - tx; tx = null; if(Math.abs(d) > 40){ stop(); show(cur + (d < 0 ? 1 : -1)); } });
    fit(); show(0); window.addEventListener('resize', fit);
    timer = setInterval(function(){ show(cur + 1); }, 5000);

    var close = function(){ stop(); window.removeEventListener('resize', fit); o.classList.remove('in'); document.removeEventListener('keydown', esc); setTimeout(function(){ o.remove(); }, 350); };
    var esc = function(e){ if(e.key === 'Escape') close(); else if(e.key === 'ArrowRight'){ stop(); show(cur + 1); } else if(e.key === 'ArrowLeft'){ stop(); show(cur - 1); } };
    document.addEventListener('keydown', esc);
    o.querySelector('.ldd-x').onclick = close;
    $('ld-demo-go').onclick = function(){ close(); showLandingAuth('register'); };
    $('ld-demo-login').onclick = function(){ close(); showLandingAuth('login'); };
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ o.classList.add('in'); fit(); }); });
  }

  // in-page links
  [].slice.call(L.querySelectorAll('[data-ld-go]')).forEach(function(b){
    b.onclick = function(){ var t = $(b.getAttribute('data-ld-go')); if(t) L.scrollTo({ top: t.offsetTop - (t.id==='ld-services' ? 0 : 60), behavior:'smooth' }); };   // « Services » : section épinglée, elle a déjà sa marge sous la barre
  });

  function setChap(i){
    if(i === cur) return; cur = i;
    chaps.forEach(function(c,j){ c.classList.toggle('on', j===i); c.classList.toggle('past', j<i); });
    cards.forEach(function(c,j){ c.classList.toggle('on', j===i); });
    clock.textContent = chaps[i].getAttribute('data-t');
  }

  var ticking = false;
  function frame(){
    ticking = false;
    var top = L.scrollTop || window.scrollY || 0, vh = innerHeight;
    nav.classList.toggle('solid', top > vh * 0.7);
    rvs.forEach(function(el){ if(!el.classList.contains('in') && el.getBoundingClientRect().top < vh * 0.9) el.classList.add('in'); });
    if(reduced) return;
    if(top < vh * 1.2) heroBg.style.transform = 'translateY('+(top*0.3)+'px) scale('+(1+top*0.0002)+')';

    var sr = story.getBoundingClientRect();
    if(sr.bottom > 0 && sr.top < vh){
      var f = prog(story) * N;
      setChap(Math.min(N-1, Math.floor(f)));
      bars.forEach(function(b,i){ b.style.transform = 'scaleX('+clamp(f-i)+')'; });
      frames.forEach(function(fr,i){
        var rev = i===0 ? 1 : clamp((f - i + 0.35) / 0.35), loc = f - i;
        fr.style.clipPath = 'inset('+((1-rev)*100)+'% 0 0 0)';
        var q = clamp((loc + 0.4) / 1.4);
        pars[i].style.transform = 'translateY('+(2 - q*4)+'%) scale('+(1.04 - q*0.04)+')';
      });
    }

    var vr = svc.getBoundingClientRect();
    if(vr.bottom > 0 && vr.top < vh){
      var tp = clamp((prog(svc) - 0.05) / 0.9);
      var max = Math.max(0, track.scrollWidth - innerWidth + 80);
      track.style.transform = 'translateX('+(-tp*max)+'px)';
      var n = Math.min(S, Math.floor(tp*(S-1) + 1.5));
      count.textContent = ('0'+n).slice(-2) + ' / ' + ('0'+S).slice(-2);
      svcPars.forEach(function(p,i){ p.style.transform = 'translateX('+Math.max(-3.5, Math.min(3.5, (tp*(S-1)-i)*-3))+'%)'; });
    }

    var dr = drvImg.getBoundingClientRect();
    if(dr.bottom > 0 && dr.top < vh) drvPar.style.transform = 'translateY('+((dr.top + dr.height/2 - vh/2) * -0.12)+'px)';
  }
  function onScroll(){ if(!ticking){ ticking = true; requestAnimationFrame(frame); } }

  frames.forEach(function(fr,i){ fr.style.zIndex = i; var im = fr.querySelector('img'), ph = fr.querySelector('.ld-ph'); if(im && ph && im.complete && im.naturalWidth) ph.style.display = 'none'; });
  L.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll, { passive:true });
  setChap(0); frame();
  if(reduced) rvs.forEach(function(el){ el.classList.add('in'); });
})();
