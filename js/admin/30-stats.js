// ── Admin › Statistiques : inscriptions, utilisateurs actifs (site / iOS / Android), courses ──
// Chiffres calculés par le serveur (fonction api_admin_stats, admin uniquement, supabase/admin_stats.sql).
var _stDays=30, _stData=null;
function _stEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function _stNum(n){ return Number(n||0).toLocaleString('fr-BE'); }
function _stDate(d,withTime){
  if(!d) return '—';
  var x=new Date(d); if(isNaN(x)) return '—';
  return x.toLocaleDateString('fr-BE',{day:'2-digit',month:'short'})+(withTime?' '+x.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'}):'');
}
function _stAgo(d){
  if(!d) return '—';
  var m=Math.round((Date.now()-new Date(d).getTime())/60000);
  if(m<2) return 'à l’instant'; if(m<60) return 'il y a '+m+' min';
  var h=Math.round(m/60); if(h<24) return 'il y a '+h+' h';
  var j=Math.round(h/24); return j<31?'il y a '+j+' j':_stDate(d);
}
var _ST_CSS='<style id="st-css">'
 +'.st-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;}'
 +'.st-seg{display:inline-flex;background:var(--sand);border-radius:999px;padding:3px;}'
 +'.st-seg button{border:none;background:none;padding:7px 14px;border-radius:999px;font:600 12.5px "DM Sans",sans-serif;color:var(--ink3);cursor:pointer;}'
 +'.st-seg button.on{background:var(--white,#fff);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08);}'
 +'.st-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px;}'
 +'.st-kpi{background:#fff;border:1px solid var(--sand3);border-radius:14px;padding:14px 16px;}'
 +'.st-kpi .l{font-size:11.5px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;}'
 +'.st-kpi .v{font:600 28px "DM Sans",sans-serif;color:var(--ink);margin-top:4px;line-height:1.1;}'
 +'.st-kpi .s{font-size:12px;color:var(--ink3);margin-top:4px;}'
 +'.st-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}'
 +'@media(max-width:900px){.st-grid{grid-template-columns:1fr;}}'
 +'.st-card{background:#fff;border:1px solid var(--sand3);border-radius:14px;padding:16px;min-width:0;}'
 +'.st-card h3{font:600 14px "DM Sans",sans-serif;margin:0 0 2px;color:var(--ink);}'
 +'.st-card .sub{font-size:12px;color:var(--ink3);margin-bottom:12px;}'
 +'.st-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--ink3);margin-top:8px;}'
 +'.st-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;}'
 +'.st-bars{width:100%;height:150px;display:block;}'
 +'.st-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:1px solid var(--sand2);font-size:13px;}'
 +'.st-row:first-child{border-top:none;}'
 +'.st-row b{font-weight:600;}'
 +'.st-meter{height:8px;border-radius:99px;background:var(--sand2);overflow:hidden;margin-top:4px;}'
 +'.st-meter span{display:block;height:100%;background:#1B5E3B;border-radius:99px;}'
 +'.st-tbl{width:100%;border-collapse:collapse;font-size:13px;}'
 +'.st-tbl th{text-align:left;font-size:11px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;border-bottom:1px solid var(--sand3);}'
 +'.st-tbl td{padding:8px;border-bottom:1px solid var(--sand2);vertical-align:middle;white-space:nowrap;}'
 +'.st-tag{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--sand);color:var(--ink2);margin-right:4px;}'
 +'.st-note{font-size:12px;color:var(--ink3);background:var(--sand);border-radius:10px;padding:10px 12px;margin-bottom:14px;}'
 +'</style>';

// Barres empilées (SVG), une colonne par jour
function _stBars(series, keys, colors){
  var n=series.length||1, W=600, H=150, pad=2, bw=(W/n);
  var max=1; series.forEach(function(p){ var s=0; keys.forEach(function(k){ s+=Number(p[k]||0); }); if(s>max) max=s; });
  var out='<svg class="st-bars" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img">';
  out+='<line x1="0" y1="'+(H-pad)+'" x2="'+W+'" y2="'+(H-pad)+'" stroke="#E6E4DD" stroke-width="1"/>';
  series.forEach(function(p,i){
    var y=H-pad, tot=0;
    keys.forEach(function(k,j){
      var v=Number(p[k]||0); if(!v) return; tot+=v;
      var h=(v/max)*(H-pad-14); y-=h;
      out+='<rect x="'+(i*bw+bw*0.15).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(bw*0.7).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+colors[j]+'"><title>'+_stDate(p.day)+' : '+v+'</title></rect>';
    });
  });
  out+='</svg>';
  // Dates (première, milieu, dernière) et maximum, en HTML pour ne pas être déformés par l'étirement du SVG
  var mid=series[Math.floor((n-1)/2)];
  return '<div style="position:relative;"><div style="position:absolute;top:0;left:2px;font-size:10.5px;color:#9AA29D;">max '+max+'</div>'+out
    +'<div style="display:flex;justify-content:space-between;font-size:10.5px;color:#9AA29D;margin-top:2px;"><span>'+(series[0]?_stDate(series[0].day):'')+'</span><span>'+(mid?_stDate(mid.day):'')+'</span><span>'+(series[n-1]?_stDate(series[n-1].day):'')+'</span></div></div>';
}
function _stLeg(items){ return '<div class="st-leg">'+items.map(function(x){ return '<span><i style="background:'+x[1]+'"></i>'+x[0]+'</span>'; }).join('')+'</div>'; }

async function loadAdminStats(){
  var el=document.getElementById('admin-stats-content'); if(!el||!sb) return;
  if(!document.getElementById('st-css')) document.head.insertAdjacentHTML('beforeend',_ST_CSS);
  el.innerHTML='<div class="page-loading"><div class="page-spinner"></div></div>';
  var r=await sb.rpc('api_admin_stats',{p_days:_stDays});
  if(r.error){
    el.innerHTML='<div class="st-note">Statistiques indisponibles'+(/api_admin_stats|function|schema cache/i.test(r.error.message||'')?' : exécutez supabase/admin_stats.sql dans Supabase.':' : '+_stEsc(r.error.message))+'</div>';
    return;
  }
  _stData=r.data||{}; _stRender();
}
window._stSetDays=function(d){ _stDays=d; loadAdminStats(); };

function _stRender(){
  var el=document.getElementById('admin-stats-content'); if(!el||!_stData) return;
  var s=_stData, u=s.users||{}, a=s.active||{}, rd=s.rides||{}, pf=a.platforms||{}, ser=s.series||[];
  var seg='<div class="st-seg">'+[[7,'7 jours'],[30,'30 jours'],[90,'90 jours'],[365,'12 mois']].map(function(x){
    return '<button class="'+(x[0]===_stDays?'on':'')+'" onclick="_stSetDays('+x[0]+')">'+x[1]+'</button>'; }).join('')+'</div>';
  var h='';
  h+='<div class="st-top">'+seg+'<button class="btn btn-secondary btn-sm" onclick="loadAdminStats()">Actualiser</button></div>';
  if(!a.tracked_since) h+='<div class="st-note">Le suivi des connexions par jour commence maintenant : les utilisateurs actifs et la répartition site / iOS / Android se rempliront au fil des prochaines ouvertures du site et des apps. En attendant, « Dernière connexion » donne une première idée.</div>';
  else if(new Date(a.tracked_since) > new Date(s.since)) h+='<div class="st-note">Utilisateurs actifs suivis depuis le '+_stDate(a.tracked_since)+'.</div>';

  var conv=rd.created? Math.round(100*(Number(rd.done||0)+Number(rd.confirmed||0))/Number(rd.created)) : 0;
  h+='<div class="st-kpis">'
   +'<div class="st-kpi"><div class="l">Utilisateurs</div><div class="v">'+_stNum(u.total)+'</div><div class="s">'+_stNum(u.clients)+' clients · '+_stNum(u.fleets)+' fleets</div></div>'
   +'<div class="st-kpi"><div class="l">Nouveaux inscrits</div><div class="v">'+_stNum(u.new)+'</div><div class="s">sur la période</div></div>'
   +'<div class="st-kpi"><div class="l">Actifs aujourd’hui</div><div class="v">'+_stNum(a.d1)+'</div><div class="s">'+_stNum(a.d7)+' sur 7 j · '+_stNum(a.d30)+' sur 30 j</div></div>'
   +'<div class="st-kpi"><div class="l">Dernière connexion</div><div class="v">'+_stNum(a.login7)+'</div><div class="s">dans les 7 j · '+_stNum(a.login30)+' dans les 30 j</div></div>'
   +'<div class="st-kpi"><div class="l">Demandes de course</div><div class="v">'+_stNum(rd.created)+'</div><div class="s">'+_stNum(rd.done)+' terminées · '+conv+' % confirmées</div></div>'
   +'</div>';

  h+='<div class="st-grid">'
   +'<div class="st-card"><h3>Utilisateurs actifs par jour</h3><div class="sub">Personnes qui ont ouvert le site ou une app</div>'
   +_stBars(ser,['active_web','active_ios','active_android'],['#0E1410','#7FA33A','#C8E862'])
   +_stLeg([['Site','#0E1410'],['iOS','#7FA33A'],['Android','#C8E862']])+'</div>'
   +'<div class="st-card"><h3>Inscriptions par jour</h3><div class="sub">Nouveaux comptes</div>'
   +_stBars(ser,['signup_clients','signup_fleets'],['#1B5E3B','#C8E862'])
   +_stLeg([['Clients','#1B5E3B'],['Fleets','#C8E862']])+'</div>'
   +'</div>';

  var tot=Number(pf.web||0)+Number(pf.ios||0)+Number(pf.android||0);
  function meter(lbl,v){ var p=tot?Math.round(100*v/tot):0; return '<div style="padding:6px 0;"><div class="st-row" style="border:none;padding:0;"><span>'+lbl+'</span><b>'+_stNum(v)+' <span style="color:var(--ink3);font-weight:500;">('+p+' %)</span></b></div><div class="st-meter"><span style="width:'+p+'%"></span></div></div>'; }
  h+='<div class="st-grid">'
   +'<div class="st-card"><h3>Demandes de course par jour</h3><div class="sub">Hors missions personnelles</div>'
   +_stBars(ser,['rides'],['#0E1410'])
   +'<div style="margin-top:10px;">'
   +'<div class="st-row"><span>En attente d’offres</span><b>'+_stNum(rd.waiting)+'</b></div>'
   +'<div class="st-row"><span>Confirmées / en cours</span><b>'+_stNum(rd.confirmed)+'</b></div>'
   +'<div class="st-row"><span>Terminées</span><b>'+_stNum(rd.done)+'</b></div>'
   +'<div class="st-row"><span>Annulées</span><b>'+_stNum(rd.cancelled)+'</b></div>'
   +'<div class="st-row"><span>Montant des courses terminées</span><b>'+Number(rd.revenue||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'})+'</b></div>'
   +'</div></div>'
   +'<div class="st-card"><h3>Support utilisé</h3><div class="sub">Utilisateurs actifs sur 30 jours</div>'
   +(tot? meter('Site web',Number(pf.web||0))+meter('App iOS',Number(pf.ios||0))+meter('App Android',Number(pf.android||0))
        : '<div style="font-size:13px;color:var(--ink3);">Pas encore de données.</div>')
   +'<div style="margin-top:14px;">'
   +'<div class="st-row"><span>Clients particuliers</span><b>'+_stNum(u.perso)+'</b></div>'
   +'<div class="st-row"><span>Clients pro</span><b>'+_stNum(u.pro)+'</b></div>'
   +'<div class="st-row"><span>Fleets</span><b>'+_stNum(u.fleets)+'</b></div>'
   +'</div></div>'
   +'</div>';

  var PL={web:'Site',ios:'iOS',android:'Android'};
  var rows=(s.recent||[]).map(function(x){
    var role=x.role==='driver'?'Fleet':(x.client_type==='pro'?'Client pro':'Client');
    var pls=(x.platforms||[]).map(function(p){ return '<span class="st-tag">'+(PL[p]||_stEsc(p))+'</span>'; }).join('')||'<span style="color:var(--ink4);">—</span>';
    return '<tr><td><div style="font-weight:600;">'+_stEsc(x.name)+'</div><div style="font-size:11.5px;color:var(--ink3);">'+_stEsc(x.email)+'</div></td>'
      +'<td>'+role+'</td><td>'+_stAgo(x.last_seen||x.last_sign_in_at)+'</td><td>'+pls+'</td><td style="color:var(--ink3);">'+_stDate(x.created_at)+'</td></tr>';
  }).join('');
  h+='<div class="st-card"><h3>Dernières connexions</h3><div class="sub">20 derniers utilisateurs connectés</div>'
   +'<div style="overflow-x:auto;"><table class="st-tbl"><thead><tr><th>Utilisateur</th><th>Type</th><th>Vu</th><th>Support (30 j)</th><th>Inscrit le</th></tr></thead><tbody>'
   +(rows||'<tr><td colspan="5" style="color:var(--ink3);">Aucune connexion.</td></tr>')+'</tbody></table></div></div>';
  el.innerHTML=h;
}
