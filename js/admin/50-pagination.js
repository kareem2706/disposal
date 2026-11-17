// ── Admin : pagination de toutes les listes (17/11/2026) ──
// S'applique d'elle-même à chaque liste affichée dans une page d'admin (tableaux et cartes de courses),
// sans toucher au code qui les construit : dès qu'une liste est (re)dessinée, on la découpe en pages.
// Nombre d'entrées : 5, 10, 20, 30 ou tout (choix mémorisé sur ce navigateur).
(function(){
  var SIZES = [5, 10, 20, 30, 0];          // 0 = tout
  var K_SIZE = 'bleenr_adm_pg_size';
  var defSize = 10;
  try { var v = parseInt(localStorage.getItem(K_SIZE), 10); if (SIZES.indexOf(v) >= 0) defSize = v; } catch (e) {}
  var state = {};                           // clé de liste → { size, page }

  if (!document.getElementById('adm-pg-css')) document.head.insertAdjacentHTML('beforeend', '<style id="adm-pg-css">'
    + '.adm-pg{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 4px 2px;font:500 12.5px "DM Sans",sans-serif;color:var(--ink3);}'
    + '.adm-pg label{display:inline-flex;align-items:center;gap:8px;}'
    + '.adm-pg select{padding:5px 26px 5px 10px;border-radius:8px;border:1px solid var(--sand3);background:var(--white,#fff);font:600 12.5px "DM Sans",sans-serif;color:var(--ink);}'
    + '.adm-pg .n{display:inline-flex;align-items:center;gap:6px;}'
    + '.adm-pg button{width:32px;height:32px;border-radius:8px;border:1px solid var(--sand3);background:var(--white,#fff);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}'
    + '.adm-pg button:disabled{opacity:.35;cursor:default;}'
    + '</style>');

  // Éléments d'une liste : lignes du tableau (hors en-têtes) ou cartes
  function items(list){
    if (list.tagName === 'TBODY') return Array.prototype.filter.call(list.children, function(tr){ return tr.tagName === 'TR' && !tr.querySelector('th'); });
    return Array.prototype.slice.call(list.children);
  }
  // Clé stable : page d'admin + bloc qui contient la liste + rang de la liste
  function keyOf(list, page){
    var box = list.closest('[id]'); var id = box ? box.id : page.id;
    var same = page.querySelectorAll('#' + CSS.escape(id) + ' tbody, #' + CSS.escape(id) + ' .ar-cards');
    return page.id + '/' + id + '/' + Array.prototype.indexOf.call(same, list);
  }
  // Où mettre la barre : après la carte / le bloc qui entoure le tableau
  function anchorOf(list){
    if (list.tagName !== 'TBODY') return list;
    var t = list.closest('table'), c = t.closest('.card') || t.parentElement;
    return (c && c.contains(t) && c.querySelectorAll('table').length === 1) ? c : t;
  }

  function apply(list, page){
    var all = items(list), key = keyOf(list, page);
    var st = state[key] || (state[key] = { size: defSize, page: 0 });
    var anchor = anchorOf(list);
    var bar = anchor.nextElementSibling && anchor.nextElementSibling.classList.contains('adm-pg') && anchor.nextElementSibling._pgList === list ? anchor.nextElementSibling : null;
    if (all.length <= SIZES[0]) { all.forEach(function(r){ r.style.display = ''; }); if (bar) bar.remove(); return; }
    var pages = st.size ? Math.ceil(all.length / st.size) : 1;
    if (st.page >= pages) st.page = pages - 1;
    var a = st.size ? st.page * st.size : 0, b = st.size ? a + st.size : all.length;
    all.forEach(function(r, i){ r.style.display = (i >= a && i < b) ? '' : 'none'; });
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'adm-pg'; bar._pgList = list;
      anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    }
    bar.innerHTML = '<label>Afficher <select>' + SIZES.map(function(s){ return '<option value="' + s + '"' + (s === st.size ? ' selected' : '') + '>' + (s || 'Tout') + '</option>'; }).join('') + '</select></label>'
      + '<span class="n">' + (a + 1) + '–' + Math.min(b, all.length) + ' sur ' + all.length
      + ' <button type="button" data-d="-1" aria-label="Page précédente"' + (st.page <= 0 ? ' disabled' : '') + '><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>'
      + '<button type="button" data-d="1" aria-label="Page suivante"' + (st.page >= pages - 1 ? ' disabled' : '') + '><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></span>';
    // Liste masquée (ex. cartes sur ordinateur, tableau sur mobile) : sa barre aussi
    var tbl = list.tagName === 'TBODY' ? list.closest('table') : list;
    bar.style.display = (tbl && tbl.getClientRects().length) ? '' : 'none';
    bar.querySelector('select').onchange = function(){
      st.size = parseInt(this.value, 10) || 0; st.page = 0; defSize = st.size;
      try { localStorage.setItem(K_SIZE, String(st.size)); } catch (e) {}
      apply(list, page);
    };
    Array.prototype.forEach.call(bar.querySelectorAll('button[data-d]'), function(btn){
      btn.onclick = function(){ st.page += parseInt(btn.dataset.d, 10); apply(list, page); };
    });
  }

  function scan(page){
    // Barres dont la liste a été remplacée : retirées
    Array.prototype.forEach.call(page.querySelectorAll('.adm-pg'), function(bar){ if (!bar._pgList || !page.contains(bar._pgList)) bar.remove(); });
    Array.prototype.forEach.call(page.querySelectorAll('tbody, .ar-cards'), function(list){
      if (list.closest('.adm-pg-off')) return;
      apply(list, page);
    });
  }

  var timers = {};
  var rz; window.addEventListener('resize', function(){ clearTimeout(rz); rz = setTimeout(function(){
    Array.prototype.forEach.call(document.querySelectorAll('.adm-pg'), function(bar){
      var l = bar._pgList, t = l && (l.tagName === 'TBODY' ? l.closest('table') : l);
      bar.style.display = (t && t.getClientRects().length) ? '' : 'none';
    });
  }, 150); });
  function watch(page){
    if (page._pgWatch) return; page._pgWatch = true;
    new MutationObserver(function(muts){
      // Ignore les changements faits par la pagination elle-même
      if (muts.every(function(m){ return m.target.closest && m.target.closest('.adm-pg') || Array.prototype.every.call(m.addedNodes, function(n){ return n.classList && n.classList.contains('adm-pg'); }) && Array.prototype.every.call(m.removedNodes, function(n){ return n.classList && n.classList.contains('adm-pg'); }); })) return;
      clearTimeout(timers[page.id]); timers[page.id] = setTimeout(function(){ scan(page); }, 60);
    }).observe(page, { childList: true, subtree: true });
    scan(page);
  }
  // Paramètres et facturation : formulaires (pas des listes) — non paginés
  var SKIP = ['page-admin-settings', 'page-admin-billing'];
  Array.prototype.forEach.call(document.querySelectorAll('.page[id^="page-admin"]'), function(p){ if (SKIP.indexOf(p.id) < 0) watch(p); });
})();
