// ── Sous-traitance : « Welcome sign » (17/11/2026) ──
// La fleet qui publie joint un fichier (logo de société, pancarte nominative…) ;
// le chauffeur qui accepte l'affiche en plein écran au client pour être identifié.
// Fichier privé (bucket « welcome-signs », dossier = fleet qui publie) ; rattaché à la course
// par le serveur (api_ride_welcome_sign) ; lisible seulement par la fleet qui publie,
// le chauffeur assigné et l'administrateur (supabase/welcome_sign.sql).
(function(){
  var MAX = 5 * 1024 * 1024;
  var TYPES = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'application/pdf':'pdf' };
  var picked = null;
  var IC_UP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>';
  var IC_PDF = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
  var IC_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var esc = function(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

  if (!document.getElementById('ws-css')) document.head.insertAdjacentHTML('beforeend', '<style id="ws-css">'
    + '.ws-drop{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px dashed var(--sand3,#D9D7D1);border-radius:var(--r,12px);background:#fff;cursor:pointer;}'
    + '.ws-drop:hover{border-color:var(--ink3);}'
    + '.ws-ic{width:42px;height:42px;border-radius:10px;background:#F3F2EE;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;color:var(--ink2);}'
    + '.ws-ic img{width:100%;height:100%;object-fit:contain;background:#fff;}'
    + '.ws-t{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--ink);}'
    + '.ws-t small{display:block;font-weight:400;font-size:11.5px;color:var(--ink3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.ws-rm{width:30px;height:30px;border-radius:8px;border:none;background:#F3F2EE;color:var(--ink2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}'
    + '.ws-card{margin-top:12px;padding:12px 14px;border:1px solid #E8E6E1;border-radius:var(--r,12px);background:#fff;}'
    + '.ws-card .ws-row{display:flex;align-items:center;gap:12px;}'
    + '.ws-show{margin-left:auto;flex-shrink:0;border:none;border-radius:999px;background:#D9F477;color:#0E1410;font:700 13px "DM Sans",sans-serif;padding:9px 14px;cursor:pointer;}'
    + '.ws-full{position:fixed;inset:0;z-index:100000;background:#fff;display:flex;align-items:center;justify-content:center;padding:24px;}'
    + '.ws-full img{max-width:100%;max-height:100%;object-fit:contain;}'
    + '.ws-full button{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;width:42px;height:42px;border-radius:50%;border:none;background:#F3F2EE;color:#0E1410;cursor:pointer;display:flex;align-items:center;justify-content:center;}'
    + '</style>');

  function render(){
    var box = document.getElementById('sub-ws-box'); if (!box) return;
    if (!picked) {
      box.innerHTML = '<label class="ws-drop" for="sub-ws-file"><span class="ws-ic">' + IC_UP + '</span>'
        + '<span class="ws-t">Ajouter un fichier<small>JPG, PNG ou PDF · 5 Mo max</small></span></label>';
      return;
    }
    var isImg = picked.type.indexOf('image/') === 0;
    box.innerHTML = '<div class="ws-drop" style="cursor:default;border-style:solid;"><span class="ws-ic">'
      + (isImg ? '<img id="sub-ws-prev" alt="">' : IC_PDF) + '</span>'
      + '<span class="ws-t">' + esc(picked.name) + '<small>' + Math.max(1, Math.round(picked.size / 1024)) + ' Ko</small></span>'
      + '<button type="button" class="ws-rm" aria-label="Retirer le fichier" onclick="_wsClear()">' + IC_X + '</button></div>';
    if (isImg) { var u = URL.createObjectURL(picked), im = document.getElementById('sub-ws-prev'); im.onload = function(){ URL.revokeObjectURL(u); }; im.src = u; }
  }

  window._wsPick = function(inp){
    var f = inp.files && inp.files[0]; inp.value = '';
    var err = document.getElementById('sub-err');
    if (!f) return;
    if (!TYPES[f.type]) { if (err) { err.textContent = 'Welcome sign : format accepté JPG, PNG, WEBP ou PDF'; err.classList.add('show'); } return; }
    if (f.size > MAX) { if (err) { err.textContent = 'Welcome sign : fichier trop lourd (5 Mo maximum)'; err.classList.add('show'); } return; }
    if (err) { err.textContent = ''; err.classList.remove('show'); }
    picked = f; render();
  };
  window._wsClear = function(){ picked = null; render(); };
  window._wsReset = function(){ picked = null; render(); };
  window._wsHasFile = function(){ return !!picked; };

  // Après la création de la sous-traitance : envoi du fichier puis rattachement par le serveur
  window._wsUpload = async function(rideId){
    if (!picked || !rideId || !sb || !currentUser) return true;
    var path = currentUser.id + '/' + rideId + '.' + TYPES[picked.type];
    try {
      var up = await sb.storage.from('welcome-signs').upload(path, picked, { upsert: true, contentType: picked.type });
      if (up.error) throw up.error;
      var rp = await sb.rpc('api_ride_welcome_sign', { p_ride: rideId, p_path: path });
      if (rp.error) throw rp.error;
      picked = null; render();
      return true;
    } catch (e) {
      console.warn('welcome sign upload:', e);
      return false;
    }
  };

  // Fiche course : bloc « Welcome sign » pour la fleet qui publie et le chauffeur assigné
  window._wsDetail = async function(r, gen){
    try {
      if (!r || !r.is_subcontract || !r.welcome_sign || !sb || !currentUser) return;
      if (r.driver_id !== currentUser.id && r.client_id !== currentUser.id) return;
      if (['cancelled', 'done', 'no_show'].indexOf(r.status) >= 0) return;
      var s = await sb.storage.from('welcome-signs').createSignedUrl(r.welcome_sign, 3600);
      if (window._detailGen !== gen || !s.data || !s.data.signedUrl) return;
      var body = document.getElementById('detail-body'); if (!body) return;
      var old = document.getElementById('rd-ws'); if (old) old.remove();
      var url = s.data.signedUrl, isPdf = /\.pdf$/i.test(r.welcome_sign);
      var mine = r.driver_id === currentUser.id;
      body.insertAdjacentHTML('beforeend', '<div class="ws-card" id="rd-ws"><div class="rd-cap" style="margin-bottom:8px;">Welcome sign</div>'
        + '<div class="ws-row"><span class="ws-ic">' + (isPdf ? IC_PDF : '<img alt="Welcome sign" src="' + esc(url) + '">') + '</span>'
        + '<span class="ws-t">' + (mine ? 'À présenter au client' : 'Fourni au sous-traitant') + '<small>' + (mine ? 'Pour être identifié à la prise en charge' : 'Affiché au client à la prise en charge') + '</small></span>'
        + '<button type="button" class="ws-show" data-u="' + esc(url) + '" data-pdf="' + (isPdf ? 1 : 0) + '" onclick="_wsFull(this)">Afficher</button></div></div>');
    } catch (e) { console.warn('welcome sign detail:', e); }
  };

  // Affichage plein écran (fond blanc) ; un PDF s'ouvre dans un nouvel onglet
  window._wsFull = function(btn){
    var u = btn.dataset.u;
    if (btn.dataset.pdf === '1') { window.open(u, '_blank', 'noopener'); return; }
    var d = document.createElement('div'); d.className = 'ws-full';
    d.innerHTML = '<img alt="Welcome sign" src="' + esc(u) + '"><button type="button" aria-label="Fermer">' + IC_X + '</button>';
    d.onclick = function(){ d.remove(); };
    document.body.appendChild(d);
    try { if (d.requestFullscreen) d.requestFullscreen().catch(function(){}); } catch (e) {}
  };

  document.addEventListener('DOMContentLoaded', render);
  render();
})();
