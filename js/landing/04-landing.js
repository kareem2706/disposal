// ── Page d'accueil : toujours chargée (landing.js), sans le code de l'application ──
// « Se connecter / Créer un compte » : charge l'application (app.js) puis ouvre l'écran de connexion.
// Quand app.js est chargé, il remplace cette fonction par la vraie (js/20-routing-notifications.js).
window.showLandingAuth = function(mode){
  var stub = window.showLandingAuth;
  _loadApp().then(function(){ if(window.showLandingAuth !== stub) window.showLandingAuth(mode); });
};

// Landing (thème 11/2026) — hero 3D, carrousel des 5 étapes et véhicules (morphing 2D) pilotés par le défilement,
// effets liés au défilement (variables CSS --sp, --hp, --p, --e : voir css/04-landing.css)
document.getElementById('screen-landing') && (function(){
  var L = document.getElementById('screen-landing');
  var $ = function(id){ return document.getElementById(id); };
  var nav = $('ld-nav'), hero = $('ld-hero');
  var story = $('ld-story');
  var chaps = [].slice.call(story.querySelectorAll('.ld-chap'));
  var cfCards = [].slice.call(story.querySelectorAll('.ld-cf-card'));
  var cfBar = $('ld-cf-bar');
  var sps = [].slice.call(L.querySelectorAll('[data-sp]'));
  var rvs = [].slice.call(L.querySelectorAll('.ld-rv'));
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  var N = chaps.length, cur = -1;

  function clamp(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
  function viewH(){ return L.clientHeight || innerHeight; }
  function prog(el){ var r = el.getBoundingClientRect(), t = el.offsetHeight - viewH(); return t > 0 ? clamp(-r.top / t) : 0; }

  // cities marquee
  function setCities(){
    var cities = t('ld.cities').split('|');
    var ch = cities.map(function(c){ return '<span class="ld-city">'+c+'</span>'; }).join('');
    $('ld-cities').innerHTML = ch + ch;
  }
  setCities();

  // classes : véhicules en 2D (flat design) qui se transforment l'un en l'autre au défilement.
  // Chaque véhicule a la même structure (carrosserie 14 points, vitres 4 points, 5 montants, 3 roues, phares) :
  // le défilement interpole tous les nombres et les couleurs entre deux véhicules voisins.
  var CLS = [ { c:'Economy', pax:3, bag:3 }, { c:'Business', pax:3, bag:3 }, { c:null, pax:3, bag:3 }, { c:'Van', pax:7, bag:7 }, { c:null, pax:50, bag:50 } ];
  var FLEET = [
    { // Economy — compacte
      body:[[165,248],[150,232],[150,180],[160,158],[215,140],[300,92],[360,84],[430,84],[470,92],[540,140],[610,150],[645,168],[650,222],[635,248]],
      glass:[[232,142],[305,100],[462,100],[528,142]], pil:[395,395,395,395,395],
      w1:[250,36], w2:[545,36], w3:[250,0], head:[622,166,22,10], tail:[150,170,10,16], col:'#6FA884', dark:'#4E8463' },
    { // Business — berline
      body:[[118,248],[100,230],[102,170],[118,152],[215,146],[300,98],[360,88],[440,88],[480,96],[555,146],[650,156],[695,170],[700,222],[682,248]],
      glass:[[232,144],[305,104],[472,104],[540,144]], pil:[400,400,400,400,400],
      w1:[215,38], w2:[580,38], w3:[215,0], head:[668,164,26,10], tail:[100,160,12,16], col:'#1B5E3B', dark:'#123F28' },
    { // Première — grande berline
      body:[[98,248],[80,230],[82,166],[98,148],[205,142],[300,94],[370,84],[460,84],[500,92],[575,142],[668,152],[715,166],[720,222],[702,248]],
      glass:[[222,140],[305,100],[492,100],[560,140]], pil:[418,418,418,418,418],
      w1:[200,40], w2:[600,40], w3:[200,0], head:[688,160,26,10], tail:[80,156,12,16], col:'#1C2420', dark:'#0B100D' },
    { // Van
      body:[[105,248],[95,232],[95,150],[100,80],[115,62],[200,56],[330,56],[450,56],[520,60],[610,128],[670,146],[700,166],[705,222],[690,248]],
      glass:[[120,130],[122,74],[512,74],[590,130]], pil:[230,350,470,470,470],
      w1:[205,38], w2:[575,38], w3:[205,0], head:[676,156,24,10], tail:[95,118,10,30], col:'#8E9C93', dark:'#6B7A70' },
    { // Autocar
      body:[[34,248],[30,236],[30,90],[34,46],[50,36],[200,34],[400,34],[600,34],[740,36],[762,60],[768,120],[770,170],[770,226],[760,248]],
      glass:[[50,128],[50,52],[752,52],[762,128]], pil:[170,300,430,560,690],
      w1:[170,40], w2:[620,40], w3:[262,40], head:[750,196,18,12], tail:[30,178,8,30], col:'#D6F27A', dark:'#A9C455' }
  ];
  var clsSec = $('ld-classes'), clsInfo = $('ld-cls-info');
  var rail = [].slice.call($('ld-cls-rail').children);
  var fq = -1, curCls = -1;
  var F = {};
  ['body','rock','glass','beam','shadow','lane','head','tail','a1','a2','a3','w1','w2','w3'].forEach(function(k){ F[k] = $('lf-'+k); });
  var pils = [].slice.call($('lf-pil').children);
  function lerp(a, b, t){ return a + (b - a) * t; }
  function lerpA(a, b, t){ return a.map(function(v, i){ return Array.isArray(v) ? lerpA(v, b[i], t) : lerp(v, b[i], t); }); }
  function lerpC(a, b, t){
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    var r = Math.round(lerp(x>>16, y>>16, t)), g = Math.round(lerp(x>>8&255, y>>8&255, t)), bl = Math.round(lerp(x&255, y&255, t));
    return 'rgb('+r+','+g+','+bl+')';
  }
  function pathOf(pts){ return 'M' + pts.map(function(p){ return p[0].toFixed(1)+' '+p[1].toFixed(1); }).join('L') + 'Z'; }
  function setWheel(g, arch, w, col, ang){
    var cx = w[0], r = w[1], cy = 264 - r, c = g.children;
    g.style.display = r < 2 ? 'none' : ''; arch.style.display = r < 2 ? 'none' : '';
    arch.setAttribute('cx', cx); arch.setAttribute('cy', cy); arch.setAttribute('r', r + 7); arch.setAttribute('fill', col);
    c[0].setAttribute('cx', cx); c[0].setAttribute('cy', cy); c[0].setAttribute('r', r);
    c[1].setAttribute('cx', cx); c[1].setAttribute('cy', cy); c[1].setAttribute('r', r * .58);
    var rs = r * .4, per = 2 * Math.PI * rs / 5;
    c[2].setAttribute('cx', cx); c[2].setAttribute('cy', cy); c[2].setAttribute('r', rs);
    c[2].setAttribute('stroke-width', (r * .2).toFixed(1)); c[2].setAttribute('stroke-dasharray', (per * .45).toFixed(1)+' '+(per * .55).toFixed(1));
    c[2].setAttribute('transform', 'rotate('+ang.toFixed(1)+' '+cx.toFixed(1)+' '+cy.toFixed(1)+')');
    c[3].setAttribute('cx', cx); c[3].setAttribute('cy', cy); c[3].setAttribute('r', r * .16);
  }
  // q : 0 (Economy) → 4 (Autocar). Chaque véhicule reste un instant affiché avant de se transformer.
  function drawFleet(q){
    q = Math.max(0, Math.min(FLEET.length - 1, q));
    if(Math.abs(q - fq) < 0.0005) return; fq = q;
    var i = Math.min(FLEET.length - 2, Math.floor(q)), u = q - i;
    var t = Math.max(0, Math.min(1, (u - 0.28) / 0.44)); t = t * t * (3 - 2 * t);
    var A = FLEET[i], B = FLEET[i+1];
    var body = lerpA(A.body, B.body, t), glass = lerpA(A.glass, B.glass, t), pil = lerpA(A.pil, B.pil, t);
    var w1 = lerpA(A.w1, B.w1, t), w2 = lerpA(A.w2, B.w2, t), w3 = lerpA(A.w3, B.w3, t);
    var hd = lerpA(A.head, B.head, t), tl = lerpA(A.tail, B.tail, t);
    var col = lerpC(A.col, B.col, t), dark = lerpC(A.dark, B.dark, t);
    F.body.setAttribute('d', pathOf(body)); F.body.setAttribute('fill', col); F.body.setAttribute('stroke', col);
    F.glass.setAttribute('d', pathOf(glass));
    var gy0 = Math.min(glass[1][1], glass[2][1]) - 4, gy1 = Math.max(glass[0][1], glass[3][1]) + 4;
    pils.forEach(function(l, k){ l.setAttribute('x1', pil[k]); l.setAttribute('x2', pil[k]); l.setAttribute('y1', gy0); l.setAttribute('y2', gy1); l.setAttribute('stroke', col); });
    F.rock.setAttribute('x', w1[0]); F.rock.setAttribute('width', Math.max(0, w2[0] - w1[0])); F.rock.setAttribute('y', 232); F.rock.setAttribute('height', 10); F.rock.setAttribute('fill', dark);
    F.head.setAttribute('x', hd[0]); F.head.setAttribute('y', hd[1]); F.head.setAttribute('width', hd[2]); F.head.setAttribute('height', hd[3]);
    F.tail.setAttribute('x', tl[0]); F.tail.setAttribute('y', tl[1]); F.tail.setAttribute('width', tl[2]); F.tail.setAttribute('height', tl[3]);
    var bx = hd[0] + hd[2], by = hd[1] + hd[3] / 2;
    F.beam.setAttribute('d', 'M'+bx+' '+(by-3)+'L'+(bx+110)+' '+(by-22)+'L'+(bx+110)+' '+(by+30)+'L'+bx+' '+(by+3)+'Z');
    var x0 = body[1][0], x1 = body[12][0];
    F.shadow.setAttribute('cx', (x0 + x1) / 2); F.shadow.setAttribute('rx', (x1 - x0) / 2 + 10);
    var ang = q * 540;
    setWheel(F.w1, F.a1, w1, dark, ang); setWheel(F.w2, F.a2, w2, dark, ang); setWheel(F.w3, F.a3, w3, dark, ang);
    F.lane.setAttribute('stroke-dashoffset', (q * 320).toFixed(1));
    var k = Math.round(q);
    if(k !== curCls) showCls(k);
  }
  function clsName(k){ return CLS[k].c || t('ld.cls'+k+'_name'); }
  function fillRail(){ rail.forEach(function(b, k){ b.textContent = clsName(k); }); }
  function showCls(k){
    curCls = k;
    clsInfo.innerHTML = '<div class="in"><h3>'+clsName(k)+'</h3><div class="models">'+t('ld.cls'+k+'_models')+'</div>'
      + '<div class="specs"><span><b>'+CLS[k].pax+'</b>'+t('ld.pax_max')+'</span><span><b>'+CLS[k].bag+'</b>'+t('ld.bags')+'</span></div>'
      + '<p>'+t('ld.cls'+k+'_desc')+'</p><button type="button" class="ld-btn lime">'+t('ld.demander_classe')+'</button></div>';
    rail.forEach(function(b, j){ b.classList.toggle('on', j===k); b.setAttribute('aria-pressed', j===k ? 'true' : 'false'); });
  }
  clsInfo.addEventListener('click', function(e){ if(e.target.closest('.ld-btn')) showLandingAuth('register'); });
  // clic sur une classe : défilement jusqu'à ce véhicule (sans animation possible : affichage direct)
  var fleetAnim = 0;
  rail.forEach(function(b, k){ b.onclick = function(){
    var range = clsSec.offsetHeight - viewH();
    if(reduced || range <= 0){
      var from = fq < 0 ? 0 : fq, t0 = performance.now();
      cancelAnimationFrame(fleetAnim);
      var step = function(now){ var u = Math.min(1, (now - t0) / 700); drawFleet(from + (k - from) * u); if(u < 1) fleetAnim = requestAnimationFrame(step); };
      fleetAnim = requestAnimationFrame(step); return;
    }
    L.scrollTo({ top: clsSec.offsetTop + range * (k / (FLEET.length - 1)) * 0.94 + range * 0.03, behavior:'smooth' });
  }; });
  fillRail(); drawFleet(1);
  // changement de langue : contenus construits en JS
  window._i18nRefresh = function(){
    setCities(); fillRail(); var _k = curCls; curCls = -1; showCls(_k);
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

  // « Recevoir des offres » du hero : amène à la carte de réservation
  $('ld-hero-go').onclick = function(){
    var f = $('ld-from');
    try{ f.scrollIntoView({ behavior:'smooth', block:'center' }); }catch(e){}
    setTimeout(function(){ f.focus({ preventScroll:true }); }, 350);
  };

  // carte de réservation : inclinaison 3D qui suit la souris (au repos pendant la saisie)
  if(!reduced && canHover){
    var tiltEl = $('ld-book-tilt'), tRaf = 0;
    var tiltTo = function(rx, ry){ tiltEl.style.setProperty('--rx', rx.toFixed(2)+'deg'); tiltEl.style.setProperty('--ry', ry.toFixed(2)+'deg'); };
    hero.addEventListener('pointermove', function(e){
      if(tRaf) return;
      tRaf = requestAnimationFrame(function(){
        tRaf = 0;
        if(tiltEl.querySelector('input:focus,select:focus')){ tiltTo(0, 0); return; }
        var r = hero.getBoundingClientRect();
        tiltTo(-((e.clientY - r.top) / r.height - 0.5) * 10, ((e.clientX - r.left) / r.width - 0.5) * 14);
      });
    });
    hero.addEventListener('pointerleave', function(){ tiltTo(0, 0); });
    tiltEl.addEventListener('focusin', function(e){ if(/^(INPUT|SELECT)$/.test(e.target.tagName)) tiltTo(0, 0); });
  }

  // in-page links
  [].slice.call(L.querySelectorAll('[data-ld-go]')).forEach(function(b){
    b.onclick = function(){ var t = $(b.getAttribute('data-ld-go')); if(t) L.scrollTo({ top: t.offsetTop - (t.id==='ld-story' ? 0 : 60), behavior:'smooth' }); };   // les 5 étapes : section épinglée, plein écran
  });

  // les 5 étapes : carrousel 3D (la photo active au centre, les autres pivotent sur les côtés)
  function setChap(i){
    if(i === cur) return; cur = i;
    chaps.forEach(function(c,j){ c.classList.toggle('on', j===i); });
    cfCards.forEach(function(c,j){
      var o = j - i, a = Math.abs(o);
      c.style.transform = 'translateX(calc(-50% + '+(o*62)+'%)) translateZ('+(-a*260)+'px) rotateY('+(-o*32)+'deg)';
      c.style.opacity = a > 2 ? 0 : (a === 0 ? 1 : a === 1 ? 0.7 : 0.3);
      c.style.zIndex = 10 - a;
      c.tabIndex = a > 2 ? -1 : 0;
    });
    cfBar.style.transform = 'scaleX('+((i+1)/N)+')';
  }
  // clic sur une photo ou une flèche : on fait défiler la page jusqu'à l'étape (le défilement reste le seul pilote)
  function goChap(i){
    i = Math.max(0, Math.min(N-1, i));
    var range = story.offsetHeight - viewH();
    if(reduced || range <= 0){ setChap(i); return; }
    L.scrollTo({ top: story.offsetTop + range * ((i + 0.5) / N), behavior:'smooth' });
  }
  cfCards.forEach(function(c,j){ c.onclick = function(){ goChap(j); }; });
  $('ld-cf-prev').onclick = function(){ goChap(cur - 1); };
  $('ld-cf-next').onclick = function(){ goChap(cur + 1); };

  var ticking = false;
  function frame(){
    ticking = false;
    var top = L.scrollTop || 0, vh = viewH();
    nav.classList.toggle('solid', top > vh * 0.7);
    rvs.forEach(function(el){ if(!el.classList.contains('in') && el.getBoundingClientRect().top < vh * 0.9) el.classList.add('in'); });
    L.style.setProperty('--sp', clamp(top / Math.max(1, L.scrollHeight - vh)).toFixed(4));
    if(reduced) return;
    if(top < vh * 1.4) L.style.setProperty('--hp', clamp(top / (hero.offsetHeight || vh)).toFixed(3));
    // --p : traversée de l'écran (0 → 1) ; --e : entrée dans l'écran (0 → 1)
    sps.forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.bottom < -300 || r.top > vh + 300) return;
      el.style.setProperty('--p', clamp((vh - r.top) / (vh + r.height)).toFixed(3));
      el.style.setProperty('--e', clamp((vh - r.top) / (vh * 0.5)).toFixed(3));
    });
    var sr = story.getBoundingClientRect();
    if(sr.bottom > 0 && sr.top < vh) setChap(Math.min(N-1, Math.floor(prog(story) * N)));
    var cr = clsSec.getBoundingClientRect();
    if(cr.bottom > 0 && cr.top < vh) drawFleet(Math.max(0, Math.min(1, (prog(clsSec) - 0.03) / 0.94)) * (FLEET.length - 1));
  }
  function onScroll(){ if(!ticking){ ticking = true; requestAnimationFrame(frame); } }

  [].slice.call(L.querySelectorAll('.ld-img')).forEach(function(w){ var im = w.querySelector('img'), ph = w.querySelector('.ld-ph'); if(im && ph && im.complete && im.naturalWidth) ph.style.display = 'none'; });
  L.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll, { passive:true });
  setChap(0); frame();
  if(reduced) rvs.forEach(function(el){ el.classList.add('in'); });
})();
