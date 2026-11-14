// ── Administration (chargé seulement pour l’admin, voir _withAdmin) — extrait de l’ancien js/25-admin.js ──
// ── Admin: Set fleet global verified status ──
window.adminSetFleetVerified=async function(fleetId, newStatus){
  if(!sb) return;
  try{
    var {error}=await sb.rpc('api_admin_save',{ p_table:'profiles', p_id:fleetId, p_data:{fleet_verified:newStatus} });
    if(error) throw error;
    showToast(newStatus==='validated'?'Fleet v\u00e9rifi\u00e9e !':'Statut mis \u00e0 jour');
    if(_adminFleetDetailId){
      await showFleetDetail(_adminFleetDetailId);
    } else {
      await loadAdminFleets();
    }
  }catch(e){showToast('Erreur: '+(e.message||e));}
};

// ── Admin: Fleets ──
var _adminFleetsData=[];
var _adminFleetsFilter='all';
var _adminFleetDetailId=null;

window.filterAdminFleets=function(filter,btn){
  _adminFleetsFilter=filter;
  document.querySelectorAll('#admin-fleets-filters .btn').forEach(function(b){b.className='btn btn-secondary btn-sm';});
  if(btn) btn.className='btn btn-primary btn-sm';
  renderAdminFleets();
};

function _computeFleetStatus(fleet, docs, vehicles, drivers){
  // The fleet status is the admin decision stored in profiles.fleet_verified
  // (same source as the fleet detail header and the new-request email alerts)
  return fleet.fleet_verified==='validated' ? 'validated' : 'pending';
}

// Number of fleets with something waiting for the admin (documents, vehicles, drivers pending)
async function _refreshAdminIssuesBadge(){
  var b=document.getElementById('badge-admin-issues'); if(!b||!sb) return;
  if(currentUser?.email!==ADMIN_EMAIL){ b.style.display='none'; return; }
  try{
    var r=await sb.from('ride_reports').select('id',{count:'exact',head:true}).eq('status','open');
    var n=r.count||0; b.textContent=n; b.style.display=n>0?'inline-block':'none';
  }catch(e){ b.style.display='none'; }
}
async function _refreshAdminFleetsBadge(){
  _refreshAdminIssuesBadge();
  var b=document.getElementById('badge-admin-fleets'); if(!b||!sb) return;
  if(currentUser?.email!==ADMIN_EMAIL){ b.style.display='none'; return; }
  // Keep it fresh while the admin stays on a page (every 60 s)
  if(!window._adminBadgeTimer) window._adminBadgeTimer=setInterval(_refreshAdminFleetsBadge, 60000);
  try{
    var r=await Promise.all([
      sb.from('fleet_documents').select('fleet_id').eq('status','pending'),
      sb.from('fleet_vehicles').select('fleet_id').eq('status','pending'),
      sb.from('fleet_drivers').select('fleet_id').eq('status','pending')
    ]);
    var ids={};
    r.forEach(function(x){ (x.data||[]).forEach(function(row){ if(row.fleet_id) ids[row.fleet_id]=1; }); });
    var n=Object.keys(ids).length;
    b.textContent=n; b.style.display=n>0?'inline-block':'none';
  }catch(e){ console.warn('admin fleets badge', e); }
}

async function loadAdminFleets(){
  var el=document.getElementById('admin-fleets-list');if(!el||!sb)return;
  _adminFleetDetailId=null;
  document.getElementById('admin-fleet-detail').style.display='none';
  el.style.display='block';
  try{
    // Get all fleet profiles (drivers)
    var {data:fleets,error}=await sb.from('profiles').select('*').eq('role','driver').order('created_at',{ascending:false});
    if(error) throw error;
    if(!fleets) fleets=[];
    // Get all fleet documents, vehicles, drivers for status computation
    var {data:allDocs}=await sb.from('fleet_documents').select('fleet_id,status');
    var {data:allVehicles}=await sb.from('fleet_vehicles').select('fleet_id,status');
    var {data:allDrivers}=await sb.from('fleet_drivers').select('fleet_id,status');
    // Group by fleet_id
    var docsMap={},vehMap={},drvMap={};
    (allDocs||[]).forEach(function(d){if(!docsMap[d.fleet_id])docsMap[d.fleet_id]=[];docsMap[d.fleet_id].push(d);});
    (allVehicles||[]).forEach(function(v){if(!vehMap[v.fleet_id])vehMap[v.fleet_id]=[];vehMap[v.fleet_id].push(v);});
    (allDrivers||[]).forEach(function(d){if(!drvMap[d.fleet_id])drvMap[d.fleet_id]=[];drvMap[d.fleet_id].push(d);});
    // Compute status for each fleet
    _adminFleetsData=fleets.map(function(f){
      var s=_computeFleetStatus(f,docsMap[f.id],vehMap[f.id],drvMap[f.id]);
      return Object.assign({},f,{_computed_status:s,_docs:docsMap[f.id]||[],_vehicles:vehMap[f.id]||[],_drivers:drvMap[f.id]||[]});
    });
    renderAdminFleets();
  }catch(e){el.innerHTML='<div class="card" style="padding:24px;color:var(--red);font-size:13px;">Erreur: '+(e.message||e)+'</div>';}
}

function renderAdminFleets(){
  var el=document.getElementById('admin-fleets-list');if(!el)return;
  var filtered=_adminFleetsData;
  if(_adminFleetsFilter==='pending') filtered=filtered.filter(function(f){return f._computed_status==='pending';});
  else if(_adminFleetsFilter==='validated') filtered=filtered.filter(function(f){return f._computed_status==='validated';});

  if(filtered.length===0){el.innerHTML='<div class="card" style="padding:24px;text-align:center;color:var(--ink4);font-size:13px;">Aucune fleet trouv\u00e9e</div>';return;}

  var statusLabel=function(s){
    if(s==='validated') return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:var(--green-bg);color:var(--green);font-size:10px;font-weight:600;">V\u00e9rifi\u00e9</span>';
    return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-size:10px;font-weight:600;">En cours de validation</span>';
  };

  el.innerHTML='<div class="card" style="overflow:hidden;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--sand2);text-align:left;">'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Nom / Soci\u00e9t\u00e9</th>'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Email</th>'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">T\u00e9l\u00e9phone</th>'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Documents</th>'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Statut</th>'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Actions</th>'
    +'</tr></thead><tbody>'
    +filtered.map(function(f){
      var name=f.company_name||((f.first_name||'')+' '+(f.last_name||'')).trim()||'\u2014';
      var totalDocs=f._docs.length+f._vehicles.length+f._drivers.length;
      var pendingDocs=f._docs.concat(f._vehicles,f._drivers).filter(function(d){return d.status==='pending';}).length;
      var docsInfo=totalDocs>0?(pendingDocs>0
        ?'<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-weight:700;"><span style="width:7px;height:7px;border-radius:50%;background:#C0392B;"></span>'+pendingDocs+' \u00e0 valider / '+totalDocs+'</span>'
        :totalDocs+' valid\u00e9(s)'):'Aucun';
      var clickable=f._computed_status==='pending'||totalDocs>0;
      return '<tr style="border-bottom:1px solid var(--sand2);'+(pendingDocs>0?'background:#FFFBF2;':'')+(clickable?'cursor:pointer;':'')
        +'" '+(clickable?'onclick="showFleetDetail(\''+f.id+'\')"':'')+'>'
        +'<td style="padding:10px 14px;font-weight:500;">'+name+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;color:var(--ink3);">'+(f.email||'\u2014')+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;">'+(f.phone||'\u2014')+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;">'+docsInfo+'</td>'
        +'<td style="padding:10px 14px;">'+statusLabel(f._computed_status)+'</td>'
        +'<td style="padding:10px 14px;"><button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;" onclick="event.stopPropagation();showFleetDetail(\''+f.id+'\')">Voir</button></td>'
        +'</tr>';
    }).join('')
    +'</tbody></table></div></div>';
}

// ── Admin: edit fleet identity data (profiles) ──
function _afEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function _adminFleetEditForm(f){
  var inp=function(id,label,val,ph,full){
    return '<div class="input-group'+(full?' full':'')+'"><label>'+label+'</label><input id="'+id+'" value="'+_afEsc(val)+'" placeholder="'+ph+'"></div>';
  };
  return '<div id="af-edit" style="display:none;border-top:1px solid var(--sand2);padding-top:16px;">'
    +'<div class="form-grid">'
      +inp('af-company','Nom de soci\u00e9t\u00e9',f.company_name,'Goodrivers SRL')
      +inp('af-vat','Num\u00e9ro de TVA',f.vat_number,'BE0123456789')
      +inp('af-fname','Pr\u00e9nom (contact)',f.first_name,'Jean')
      +inp('af-lname','Nom (contact)',f.last_name,'Dupont')
      +inp('af-phone','T\u00e9l\u00e9phone',f.phone,'+32 4xx xx xx xx')
      +'<div class="input-group"><label>Email</label><input value="'+_afEsc(f.email)+'" disabled style="opacity:.6;cursor:not-allowed;" title="L\u2019email de connexion ne peut pas \u00eatre modifi\u00e9 ici"></div>'
      +inp('af-street','Rue et num\u00e9ro',f.address_street,'Avenue Louise 54',true)
      +inp('af-postal','Code postal',f.address_postal,'1050')
      +inp('af-city','Ville',f.address_city,'Bruxelles')
      +'<div class="input-group"><label>Pays</label><select id="af-country" data-val="'+_afEsc(f.address_country)+'"></select></div>'
    +'</div>'
    +'<div id="af-err" class="auth-error" style="margin-bottom:10px;"></div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;">'
      +'<button class="btn btn-secondary btn-sm" onclick="adminToggleFleetEdit(false)">Annuler</button>'
      +'<button class="btn btn-primary btn-sm" id="af-save" onclick="adminSaveFleetIdentity()">Enregistrer</button>'
    +'</div></div>';
}
window.adminToggleFleetEdit=function(show){
  var el=document.getElementById('af-edit'); if(!el) return;
  var open = (show===undefined) ? el.style.display==='none' : !!show;
  el.style.display = open ? 'block' : 'none';
  if(open){
    // Same country list as the profile screen
    var sel=document.getElementById('af-country'), src=document.getElementById('pf-country');
    if(sel && !sel.options.length){
      sel.innerHTML='<option value="">\u2014</option>'+(src?src.innerHTML:'');
      var v=sel.dataset.val||'';
      if(v && !Array.prototype.some.call(sel.options,function(o){return o.value===v;})) sel.insertAdjacentHTML('beforeend','<option value="'+_afEsc(v)+'">'+_afEsc(v)+'</option>');
      sel.value=v;
    }
  }
};
window.adminSaveFleetIdentity=async function(){
  var id=_adminFleetDetailId; if(!id||!sb) return;
  var err=document.getElementById('af-err'), btn=document.getElementById('af-save');
  var g=function(k){return (document.getElementById(k)?.value||'').trim();};
  if(err) err.classList.remove('show');
  var upd={
    company_name:g('af-company')||null, vat_number:g('af-vat')||null,
    first_name:g('af-fname')||null, last_name:g('af-lname')||null, phone:g('af-phone')||null,
    address_street:g('af-street')||null, address_postal:g('af-postal')||null,
    address_city:g('af-city')||null, address_country:g('af-country')||null
  };
  if(!upd.company_name && !upd.first_name && !upd.last_name){ showError(err,'Indiquez au moins un nom de soci\u00e9t\u00e9 ou un contact'); return; }
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement...'; }
  try{
    var {error}=await sb.rpc('api_admin_save',{ p_table:'profiles', p_id:id, p_data:upd });
    if(error) throw error;
    showToast('\u2705 Donn\u00e9es de la fleet mises \u00e0 jour');
    await showFleetDetail(id);
  }catch(e){
    showError(err,'Erreur : '+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent='Enregistrer'; }
  }
};

window.showFleetDetail=async function(fleetId){
  if(!sb) return;
  _adminFleetDetailId=fleetId;
  document.getElementById('admin-fleets-list').style.display='none';
  document.getElementById('admin-fleets-filters').style.display='none';
  var detailEl=document.getElementById('admin-fleet-detail');
  detailEl.style.display='block';
  var contentEl=document.getElementById('admin-fleet-detail-content');
  contentEl.innerHTML='<div class="page-loading"><div class="page-spinner"></div></div>';
  try{
    // Get fleet profile
    var {data:fleet,error:fe}=await sb.from('profiles').select('*').eq('id',fleetId).single();
    if(fe) throw fe;
    // Get docs, vehicles, drivers
    var {data:docs}=await sb.from('fleet_documents').select('*').eq('fleet_id',fleetId).order('uploaded_at',{ascending:false});
    var {data:vehicles}=await sb.from('fleet_vehicles').select('*').eq('fleet_id',fleetId).order('created_at',{ascending:false});
    var {data:drivers}=await sb.from('fleet_drivers').select('*').eq('fleet_id',fleetId).order('created_at',{ascending:false});
    docs=docs||[];vehicles=vehicles||[];drivers=drivers||[];

    // Load vehicle documents
    var vehDocMap={};
    if(vehicles.length>0){
      var vIds=vehicles.map(function(v){return v.id;});
      var {data:vehDocs}=await sb.from('vehicle_documents').select('*').in('vehicle_id',vIds);
      (vehDocs||[]).forEach(function(d){if(!vehDocMap[d.vehicle_id])vehDocMap[d.vehicle_id]=[];vehDocMap[d.vehicle_id].push(d);});
    }
    // Load driver documents
    var drvDocMap={};
    if(drivers.length>0){
      var dIds=drivers.map(function(d){return d.id;});
      var {data:drvDocs}=await sb.from('driver_documents').select('*').in('driver_id',dIds);
      (drvDocs||[]).forEach(function(d){if(!drvDocMap[d.driver_id])drvDocMap[d.driver_id]=[];drvDocMap[d.driver_id].push(d);});
    }

    var name=fleet.company_name||((fleet.first_name||'')+' '+(fleet.last_name||'')).trim()||'\u2014';
    var allItems=[].concat(docs,vehicles,drivers);
    var globalStatus=fleet.fleet_verified||'pending';
    var globalStatusBadge=globalStatus==='validated'
      ?'<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:10px;background:var(--green-bg);color:var(--green);font-size:12px;font-weight:600;">V\u00e9rifi\u00e9</span>'
      :'<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-size:12px;font-weight:600;">Non v\u00e9rifi\u00e9</span>';

    var globalBtn='';
    if(globalStatus!=='validated'){
      globalBtn='<button class="btn btn-primary btn-sm" style="font-size:12px;padding:5px 14px;margin-left:12px;" onclick="adminSetFleetVerified(\''+fleetId+'\',\'validated\')">Marquer V\u00e9rifi\u00e9</button>';
    } else {
      globalBtn='<button class="btn btn-secondary btn-sm" style="font-size:12px;padding:5px 14px;margin-left:12px;" onclick="adminSetFleetVerified(\''+fleetId+'\',\'pending\')">Retirer la v\u00e9rification</button>';
    }

    var html='<div class="card" style="padding:22px;margin-bottom:16px;">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">'
      +'<div><div style="font-size:18px;font-weight:700;color:var(--ink);">'+name+'</div>'
      +'<div style="font-size:12px;color:var(--ink3);margin-top:2px;">'+(fleet.email||'\u2014')+' &middot; '+(fleet.phone||'\u2014')+'</div></div>'
      +'<div style="display:flex;align-items:center;">'+globalStatusBadge+globalBtn
        +'<button class="btn btn-secondary btn-sm" style="font-size:12px;padding:5px 14px;margin-left:8px;" onclick="adminToggleFleetEdit()">Modifier</button></div>'
      +'</div>'
      +_adminFleetEditForm(fleet)
      +'</div>';

    var docLabels={licence_lvc:'Licence LVC',assurance_rc:'Assurance RC Pro',kbis:'Extrait Kbis/BCE',statuts:'Statuts',autre:'Autre'};

    // Documents société
    html+='<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--ink);">Documents soci\u00e9t\u00e9 <span style="font-size:11px;color:var(--ink3);font-weight:400;">('+docs.length+')</span></div>';
    if(docs.length===0){
      html+='<div class="card" style="padding:18px;text-align:center;color:var(--ink4);font-size:13px;margin-bottom:16px;">Aucun document soumis</div>';
    } else {
      html+='<div class="card" style="overflow:hidden;margin-bottom:16px;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--sand2);text-align:left;">'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Type</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Fichier</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Statut</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Actions</th>'
        +'</tr></thead><tbody>'
        +docs.map(function(d){
          return '<tr style="border-bottom:1px solid var(--sand2);">'
            +'<td style="padding:10px 14px;"><span style="font-size:11px;padding:2px 8px;background:var(--blue-bg);color:var(--blue);border-radius:5px;font-weight:500;">'+(docLabels[d.doc_type]||d.doc_type)+'</span></td>'
            +'<td style="padding:10px 14px;"><a href="'+d.file_url+'" target="_blank" style="font-size:12px;color:var(--blue);text-decoration:none;">'+(d.doc_name||'Voir PDF')+'</a></td>'
            +'<td style="padding:10px 14px;">'+_adminStatusBadge(d.status)+'</td>'
            +'<td style="padding:10px 14px;">'+_adminActionBtns('fleet_documents',d.id,d.status)+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table></div></div>';
    }

    // Véhicules
    html+='<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--ink);">V\u00e9hicules <span style="font-size:11px;color:var(--ink3);font-weight:400;">('+vehicles.length+')</span></div>';
    if(vehicles.length===0){
      html+='<div class="card" style="padding:18px;text-align:center;color:var(--ink4);font-size:13px;margin-bottom:16px;">Aucun v\u00e9hicule soumis</div>';
    } else {
      html+='<div class="card" style="overflow:hidden;margin-bottom:16px;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--sand2);text-align:left;">'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">V\u00e9hicule</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Classe</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Plaque</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Statut</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Actions</th>'
        +'</tr></thead><tbody>'
        +vehicles.map(function(v){
          var vDocs=vehDocMap[v.id]||[];
          var vDocLabels={carte_grise:'Carte grise',assurance:'Assurance',controle_technique:'CT',vignette_identification:'Vignette'};
          var vDocsHtml=vDocs.length>0
            ?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'+vDocs.map(_docBadge).join('')+'</div>'
            :'';
          return '<tr style="border-bottom:1px solid var(--sand2);">'
            +'<td style="padding:10px 14px;font-weight:500;">'+(v.brand||'')+' '+(v.model||'')+' '+(v.year||'')+vDocsHtml+'</td>'
            +'<td style="padding:10px 14px;font-size:12px;">'+(v.vehicle_class||'\u2014')+'</td>'
            +'<td style="padding:10px 14px;font-size:12px;">'+(v.plate||'\u2014')+'</td>'
            +'<td style="padding:10px 14px;">'+_adminStatusBadge(v.status)+'</td>'
            +'<td style="padding:10px 14px;">'+_adminActionBtns('fleet_vehicles',v.id,v.status)+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table></div></div>';
    }

    // Chauffeurs
    html+='<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--ink);">Chauffeurs <span style="font-size:11px;color:var(--ink3);font-weight:400;">('+drivers.length+')</span></div>';
    if(drivers.length===0){
      html+='<div class="card" style="padding:18px;text-align:center;color:var(--ink4);font-size:13px;margin-bottom:16px;">Aucun chauffeur soumis</div>';
    } else {
      html+='<div class="card" style="overflow:hidden;margin-bottom:16px;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--sand2);text-align:left;">'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Nom</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">T\u00e9l\u00e9phone</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Email</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Statut</th>'
        +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Actions</th>'
        +'</tr></thead><tbody>'
        +drivers.map(function(d){
          var dDocs=drvDocMap[d.id]||[];
          var dDocLabels={permis_conduire:'Permis',carte_vtc:'Carte VTC'};
          var dDocsHtml=dDocs.length>0
            ?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'+dDocs.map(_docBadge).join('')+'</div>'
            :'';
          return '<tr style="border-bottom:1px solid var(--sand2);">'
            +'<td style="padding:10px 14px;font-weight:500;">'+(d.first_name||'')+' '+(d.last_name||'')+(d.license_region?'<div style="font-size:11px;color:var(--ink3);font-weight:400;">'+(_LICENSE_LABELS[d.license_region]||d.license_region)+'</div>':'')+dDocsHtml+'</td>'
            +'<td style="padding:10px 14px;font-size:12px;">'+(d.phone||'\u2014')+'</td>'
            +'<td style="padding:10px 14px;font-size:12px;">'+(d.email||'\u2014')+'</td>'
            +'<td style="padding:10px 14px;">'+_adminStatusBadge(d.status)+'</td>'
            +'<td style="padding:10px 14px;">'+_adminActionBtns('fleet_drivers',d.id,d.status)+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table></div></div>';
    }

    contentEl.innerHTML=html;
  }catch(e){contentEl.innerHTML='<div class="card" style="padding:24px;color:var(--red);font-size:13px;">Erreur: '+(e.message||e)+'</div>';}
};

window.hideFleetDetail=function(){
  _adminFleetDetailId=null;
  document.getElementById('admin-fleet-detail').style.display='none';
  document.getElementById('admin-fleets-list').style.display='block';
  document.getElementById('admin-fleets-filters').style.display='flex';
};

// ── Admin: Clients ──
var _adminClientsData=[];
var _adminClientTab='pro';

window.switchAdminClientTab=function(tab,btn){
  _adminClientTab=tab;
  document.querySelectorAll('.admin-client-tab').forEach(function(b){
    b.style.background='transparent';b.style.color='var(--ink3)';b.style.boxShadow='none';
  });
  if(btn){btn.style.background='var(--white)';btn.style.color='var(--ink)';btn.style.boxShadow='0 1px 4px rgba(14,14,12,.1)';}
  renderAdminClients();
};

// ── ADMIN: FACTURATION ───────────────────────────────
// Single row in billing_settings (id = 1)
var _BILLING_COUNTRIES=BleenrCore.BILLING_COUNTRIES;
function _billingCountryOpts(sel){
  return _BILLING_COUNTRIES.map(function(c){return '<option value="'+c[0]+'"'+(c[0]===sel?' selected':'')+'>'+c[1]+'</option>';}).join('');
}
// ── Per-country rows (VAT client→carrier, VAT carrier→Bleenr, commission, refund delay) ──
function _billingCountrySel(cls, country){ return '<select class="'+cls+'" style="flex:1;min-width:140px;">'+_billingCountryOpts(country||'BE')+'</select>'; }
function _billingNum(cls, val, ph, unit, extra){
  return '<div style="display:flex;align-items:center;gap:6px;width:150px;"><input class="'+cls+'" type="number" min="0" '+(unit==='%'?'max="100" step="0.01"':'step="1"')+' value="'+(val!=null?val:'')+'" placeholder="'+ph+'" style="width:90px;'+(extra||'')+'"><span style="font-size:13px;color:var(--ink3);">'+unit+'</span></div>';
}
function _billingVatRow(country, rate){
  return '<div class="billing-vat-row" style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">'
    +_billingCountrySel('billing-vat-country',country)+_billingNum('billing-vat-rate',rate,'6','%')+'</div>';
}
function _billingPlatVatRow(country, rate, rc){
  return '<div class="billing-pvat-row" style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">'
    +_billingCountrySel('billing-pvat-country',country)
    +'<div style="display:flex;align-items:center;gap:6px;width:150px;"><input class="billing-pvat-rate" type="number" min="0" max="100" step="0.01" value="'+(rc?0:(rate?rate:''))+'" placeholder="21" style="width:90px;'+(rc?'opacity:0.6;cursor:not-allowed;':'')+'"'+(rc?' readonly':'')+'><span style="font-size:13px;color:var(--ink3);">%</span></div>'
    +'<label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--ink);cursor:pointer;margin:0;white-space:nowrap;"><input type="checkbox" class="billing-pvat-rc"'+(rc?' checked':'')+' onchange="_billingApplyRowRc(this)" style="width:16px;height:16px;padding:0;margin:0;flex-shrink:0;cursor:pointer;"> Autoliquidation</label>'
    +'</div>';
}
// checked = 0 % locked ; unchecked = editable, a rate above 0 is required
window._billingApplyRowRc=function(cb){
  var inp=cb.closest('.billing-pvat-row').querySelector('.billing-pvat-rate'); if(!inp) return;
  if(cb.checked){ inp.value=0; inp.readOnly=true; inp.style.opacity='0.6'; inp.style.cursor='not-allowed'; }
  else { inp.readOnly=false; inp.style.opacity=''; inp.style.cursor=''; if(parseFloat(inp.value)===0) inp.value=''; inp.focus(); }
};
function _billingCommRow(country, rate){
  return '<div class="billing-comm-row" style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">'
    +_billingCountrySel('billing-comm-country',country)+_billingNum('billing-comm-rate',rate,'10','%')+'</div>';
}
function _billingRefundRow(country, hours){
  return '<div class="billing-refund-row" style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">'
    +_billingCountrySel('billing-refund-country',country)+_billingNum('billing-refund-hours',hours,'48','heures')+'</div>';
}
var _BILLING_ROW_BUILDERS={ vat:[_billingVatRow,'billing-vat'], pvat:[_billingPlatVatRow,'billing-pvat'], comm:[_billingCommRow,'billing-comm'], refund:[_billingRefundRow,'billing-refund'] };
window.addBillingRow=function(kind){
  var b=_BILLING_ROW_BUILDERS[kind]; var wrap=document.getElementById(b[1]+'-rows'); if(!wrap)return;
  var used=Array.prototype.map.call(wrap.querySelectorAll('.'+b[1]+'-country'),function(s){return s.value;});
  var next=_BILLING_COUNTRIES.find(function(c){return used.indexOf(c[0])<0;});
  wrap.insertAdjacentHTML('beforeend',b[0](next?next[0]:'BE',''));
};
window.addBillingVatRow=function(){ addBillingRow('vat'); };
window.addBillingRefundRow=function(){ addBillingRow('refund'); };

// Per-country platform settings, with fallback on the former single values (Belgium)
function _billingPlatVatList(s){ return BleenrCore.platformVatList(s); }   // core/billing.ts
function _billingCommList(s){ return BleenrCore.commissionList(s); }   // core/billing.ts

// Capacités en bagages par gamme (conseil affiché dans les formulaires de demande)
function _lugAdminCombo(l, sm){
  return '<span class="lca-c"><input type="number" min="0" max="50" class="lca-l" value="'+(parseInt(l,10)||0)+'"><small>valises</small><b>+</b><input type="number" min="0" max="50" class="lca-s" value="'+(parseInt(sm,10)||0)+'"><small>cabine</small><button type="button" title="Retirer" onclick="this.parentNode.remove()">×</button></span>';
}
function _lugAdminCard(caps){
  caps=Object.assign({}, _LUG_CAPS_DEF, (caps&&typeof caps==='object')?caps:{});
  return '<div class="card" style="padding:22px;margin-bottom:16px;">'
    +'<div style="font-size:15px;font-weight:700;margin-bottom:4px;">Capacité en bagages par gamme</div>'
    +'<div style="font-size:12px;color:var(--ink3);margin-bottom:14px;line-height:1.45;">Maximum habituel par véhicule. Ajoutez plusieurs combinaisons si besoin (ex. Business : 3 valises + 0 cabine, <i>ou</i> 2 valises + 2 cabine). Au-delà de toutes les combinaisons, le client voit un conseil (jamais un blocage). Aucune combinaison = pas de limite.</div>'
    +_LUG_CLS.map(function(x){ return '<div class="lca-row" data-k="'+x[0]+'"><div class="lca-n">'+x[1]+'</div><div class="lca-list">'+(caps[x[0]]||[]).map(function(c){ return _lugAdminCombo(c.l,c.s); }).join('')
      +'<button type="button" class="lca-add" onclick="this.insertAdjacentHTML(\'beforebegin\',_lugAdminCombo(0,0))">+ ou</button></div></div>'; }).join('')
    +'<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="_lugAdminSave(this)">Enregistrer les capacités</button>'
    +'</div>';
}
window._lugAdminSave=async function(btn){
  var caps={}, bad='';
  document.querySelectorAll('.lca-row').forEach(function(r){
    caps[r.getAttribute('data-k')]=[].map.call(r.querySelectorAll('.lca-c'), function(c){
      var l=parseInt(c.querySelector('.lca-l').value,10), sm=parseInt(c.querySelector('.lca-s').value,10);
      if(isNaN(l)||isNaN(sm)||l<0||sm<0||l>50||sm>50) bad='Nombres entre 0 et 50';
      return { l:l||0, s:sm||0 };
    }).filter(function(c){ return c.l||c.s; });   // 0 + 0 : combinaison vide ignorée
  });
  if(bad){ showToast(bad); return; }
  btn.disabled=true;
  try{
    var {error}=await sb.rpc('api_admin_save',{ p_table:'billing_settings', p_id:'1', p_data:{ luggage_caps:caps } });
    if(error) throw error;
    window._lugCaps=Object.assign({},_LUG_CAPS_DEF,caps);
    showToast('✅ Capacités en bagages enregistrées');
  }catch(e){ showToast('Erreur : '+(e.message||e)+(/luggage_caps|column/i.test(e.message||'')?' — exécutez supabase/luggage_caps.sql':'')); }
  finally{ btn.disabled=false; }
};
// Page Admin › Réglages : demande par IA + capacités en bagages
async function loadAdminSettings(){
  var el=document.getElementById('admin-settings-content'); if(!el||!sb) return;
  try{
    var {data:s,error}=await sb.from('billing_settings').select('*').eq('id',1).maybeSingle();
    if(error) throw error;
    s=s||{};
    el.innerHTML='<div class="card ai-adm" style="padding:18px 22px;margin-bottom:16px;">'
        +'<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;margin-bottom:4px;">Client génère sa demande par IA</div>'
        +'<div style="font-size:12px;color:var(--ink3);line-height:1.45;">Affiche aux clients l’option « Décrivez votre itinéraire » : le client écrit son besoin, l’IA pré-remplit le formulaire, le client vérifie puis publie.</div></div>'
        +'<label class="ai-sw"><input type="checkbox" id="bill-ai-sw"'+(s.ai_requests_enabled?' checked':'')+' onchange="_aiAdminToggle(this)"><i></i><span id="bill-ai-lbl">'+(s.ai_requests_enabled?'Oui':'Non')+'</span></label>'
      +'</div>'
      +_lugAdminCard(s.luggage_caps);
  }catch(e){
    el.innerHTML='<div class="card" style="padding:24px;color:var(--red);font-size:13px;">Erreur: '+_billingEsc(e.message||e)+'</div>';
  }
}
// Interrupteur « Client génère sa demande par IA » : enregistré tout de suite (côté serveur, admin uniquement)
window._aiAdminToggle=async function(cb){
  var on=!!cb.checked, l=document.getElementById('bill-ai-lbl');
  cb.disabled=true;
  try{
    var {error}=await sb.rpc('api_admin_save',{ p_table:'billing_settings', p_id:'1', p_data:{ ai_requests_enabled:on } });
    if(error) throw error;
    if(l) l.textContent=on?'Oui':'Non';
    showToast(on?'✅ Demande par IA activée pour les clients':'Demande par IA désactivée');
  }catch(e){
    cb.checked=!on; if(l) l.textContent=!on?'Oui':'Non';
    showToast('Erreur : '+(e.message||e)+(/ai_requests_enabled|column/i.test(e.message||'')?' — exécutez supabase/ai_requests.sql':''));
  }finally{ cb.disabled=false; }
};
async function loadAdminBilling(){
  var el=document.getElementById('admin-billing-content'); if(!el||!sb)return;
  try{
    var {data:s,error}=await sb.from('billing_settings').select('*').eq('id',1).maybeSingle();
    if(error) throw error;
    s=s||{};
    var rates=Array.isArray(s.vat_rates_client_carrier)&&s.vat_rates_client_carrier.length?s.vat_rates_client_carrier:[{country:'BE',rate:''}];
    var pvat=_billingPlatVatList(s), comm=_billingCommList(s);
    var refundRows=Array.isArray(s.refund_delays)&&s.refund_delays.length?s.refund_delays:[{country:'BE',hours:48}];
    var f=function(id,label,val,ph,req){
      return '<div class="input-group"><label>'+label+(req?' <span style="color:var(--red)">*</span>':'')+'</label><input id="'+id+'" value="'+_billingEsc(val)+'" placeholder="'+ph+'"></div>';
    };
    var card=function(title,desc,id,rowsHtml,kind){
      return '<div class="card" style="padding:22px;margin-bottom:16px;">'
        +'<div style="font-size:15px;font-weight:700;margin-bottom:4px;">'+title+'</div>'
        +'<div style="font-size:12px;color:var(--ink3);margin-bottom:16px;">'+desc+'</div>'
        +'<div id="'+id+'">'+rowsHtml+'</div>'
        +'<button type="button" class="btn btn-secondary btn-sm" onclick="addBillingRow(\''+kind+'\')" style="margin-top:4px;">+ Ajouter un pays</button>'
        +'</div>';
    };
    el.innerHTML=
      '<div class="card" style="padding:22px;margin-bottom:16px;">'
        +'<div style="font-size:15px;font-weight:700;margin-bottom:4px;">Données de facturation Bleenr</div>'
        +'<div style="font-size:12px;color:var(--ink3);margin-bottom:16px;">Coordonnées qui figureront sur les factures.</div>'
        +f('bill-company','Raison sociale',s.company_name,'Bleenr SRL',true)
        +'<div class="form-grid">'+f('bill-street','Rue et numéro',s.street,'Avenue Louise 54',true)+f('bill-box','Boîte',s.box,'b12',false)+'</div>'
        +'<div class="form-grid">'+f('bill-zip','Code postal',s.postal_code,'1050',true)+f('bill-city','Ville',s.city,'Bruxelles',true)+'</div>'
        +'<div class="form-grid"><div class="input-group"><label>Pays <span style="color:var(--red)">*</span></label><select id="bill-country">'+_billingCountryOpts(s.country||'BE')+'</select></div>'
        +f('bill-vat','Numéro de TVA',s.vat_number,'BE0123456789',true)+'</div>'
      +'</div>'
      +card('1. TVA client → transporteur','Taux appliqué sur la facture du transporteur (chauffeur) au client, selon le pays du transporteur.','billing-vat-rows',
            rates.map(function(r){return _billingVatRow(r.country,r.rate);}).join(''),'vat')
      +card('2. TVA transporteur → Bleenr','Taux appliqué sur la facture de commission de Bleenr au transporteur, selon le pays du transporteur. Cochez « Autoliquidation » pour appliquer 0 %.','billing-pvat-rows',
            pvat.map(function(r){return _billingPlatVatRow(r.country,r.rate,!!r.reverse_charge);}).join(''),'pvat')
      +card('3. Commission plateforme','Pourcentage prélevé par Bleenr sur le montant HTVA des courses, selon le pays du transporteur.','billing-comm-rows',
            comm.map(function(r){return _billingCommRow(r.country,r.rate);}).join(''),'comm')
      +card('4. Délai de remboursement','Selon le pays du départ : une demande confirmée qui commence dans plus de ce nombre d’heures peut être modifiée et son annulation est remboursable. En deçà, le client ne peut plus que modifier le passager et la note ; une annulation n’est plus remboursée.','billing-refund-rows',
            refundRows.map(function(r){return _billingRefundRow(r.country,r.hours);}).join(''),'refund')
      +'<div id="billing-err" class="auth-error" style="margin-bottom:10px;"></div>'
      +'<button class="btn btn-primary" id="billing-save-btn" onclick="saveAdminBilling()">Enregistrer</button>';
  }catch(e){
    el.innerHTML='<div class="card" style="padding:24px;color:var(--red);font-size:13px;">Erreur: '+_billingEsc(e.message||e)+'</div>';
  }
}

// Reads one per-country section. check(row, value) returns an error message or '' ; returns {list} or {err}
function _billingReadRows(prefix, label, read){
  var list=[], seen={}, err='';
  document.querySelectorAll('#'+prefix+'-rows .'+prefix+'-row').forEach(function(r){
    if(err) return;
    var c=r.querySelector('.'+prefix+'-country').value;
    if(seen[c]){ err=label+' : un pays est présent plusieurs fois'; return; }
    var item=read(r); if(typeof item==='string'){ err=label+' : '+item; return; }
    seen[c]=1; item.country=c; list.push(item);
  });
  if(!err && !list.length) err=label+' : ajoutez au moins un pays';
  return err?{err:err}:{list:list};
}

window.saveAdminBilling=async function(){
  var err=document.getElementById('billing-err');
  var btn=document.getElementById('billing-save-btn');
  var v=function(id){return (document.getElementById(id)?.value||'').trim();};
  if(err){err.textContent='';err.classList.remove('show');}
  var row={
    id:1,
    company_name:v('bill-company'), street:v('bill-street'), box:v('bill-box')||null,
    postal_code:v('bill-zip'), city:v('bill-city'), country:v('bill-country'),
    vat_number:v('bill-vat').replace(/[\s.]/g,'').toUpperCase()
  };
  var _missing=[];
  if(!row.company_name) _missing.push('raison sociale');
  if(!row.street) _missing.push('rue et numéro');
  if(!row.postal_code) _missing.push('code postal');
  if(!row.city) _missing.push('ville');
  if(!row.country) _missing.push('pays');
  if(!row.vat_number) _missing.push('numéro de TVA');
  if(_missing.length){ showError(err,'Données de facturation Bleenr incomplètes : '+_missing.join(', ')); return; }

  var pct=function(raw,allowZero){ var n=parseFloat(raw); return (raw===''||isNaN(n)||n<0||n>100||(!allowZero&&n===0))?null:n; };
  var a=_billingReadRows('billing-vat','TVA client → transporteur',function(r){
    var n=pct(r.querySelector('.billing-vat-rate').value,true); return n===null?'taux entre 0 et 100 requis':{rate:n}; });
  if(a.err){ showError(err,a.err); return; }
  var b=_billingReadRows('billing-pvat','TVA transporteur → Bleenr',function(r){
    var rc=r.querySelector('.billing-pvat-rc').checked;
    if(rc) return {rate:0, reverse_charge:true};
    var n=pct(r.querySelector('.billing-pvat-rate').value,false);
    return n===null?'indiquez un taux supérieur à 0 (ou cochez Autoliquidation)':{rate:n, reverse_charge:false}; });
  if(b.err){ showError(err,b.err); return; }
  var c=_billingReadRows('billing-comm','Commission plateforme',function(r){
    var n=pct(r.querySelector('.billing-comm-rate').value,true); return n===null?'pourcentage entre 0 et 100 requis':{rate:n}; });
  if(c.err){ showError(err,c.err); return; }
  var d=_billingReadRows('billing-refund','Délai de remboursement',function(r){
    var raw=r.querySelector('.billing-refund-hours').value, n=parseInt(raw,10);
    return (raw===''||isNaN(n)||n<0||String(n)!==String(raw).trim())?'nombre d’heures entier (0 ou plus) requis':{hours:n}; });
  if(d.err){ showError(err,d.err); return; }

  row.vat_rates_client_carrier=a.list;
  row.vat_rates_carrier_platform=b.list;
  row.commission_rates=c.list;
  row.refund_delays=d.list;
  // Former single values kept in sync (Belgium, else the first country) for older screens
  var pick=function(l){ return l.find(function(x){return x.country==='BE';})||l[0]; };
  row.vat_rate_carrier_platform=pick(b.list).rate;
  row.vat_reverse_charge_carrier_platform=!!pick(b.list).reverse_charge;
  row.platform_commission_rate=pick(c.list).rate;
  row.updated_at=new Date().toISOString();
  if(btn){btn.disabled=true;btn.textContent='Enregistrement...';}
  try{
    var {error}=await sb.rpc('api_admin_save',{ p_table:'billing_settings', p_id:String(row.id||1), p_data:row });
    if(error) throw error;
    _refundRules=d.list; // apply immediately in this session
    _docBillingP=null;   // invoices / reports reload the new settings
    showToast('✅ Données de facturation enregistrées');
  }catch(e){
    showError(err,'Erreur : '+(e.message||e));
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Enregistrer';}
  }
};

// ── Admin: edit client identity data ──
var _adminEditClientId=null;
window.adminEditClient=function(id){
  var c=(_adminClientsData||[]).find(function(x){return x.id===id;}); if(!c) return;
  _adminEditClientId=id;
  var isPro=c.client_type==='pro';
  var inp=function(fid,label,val,ph,full,req){
    return '<div class="input-group'+(full?' full':'')+'"><label>'+label+(req?' <span style="color:var(--red)">*</span>':'')+'</label><input id="'+fid+'" value="'+_afEsc(val)+'" placeholder="'+ph+'"></div>';
  };
  document.getElementById('mac-title').textContent='Modifier le client '+(isPro?'professionnel':'particulier');
  document.getElementById('mac-body').innerHTML=
    '<div class="form-grid">'
      +(isPro?inp('mac-company','Nom de soci\u00e9t\u00e9',c.company_name,'Acme SA',false,true)+inp('mac-vat','Num\u00e9ro de TVA',c.vat_number,'BE0123456789'):'')
      +inp('mac-fname',isPro?'Pr\u00e9nom (contact)':'Pr\u00e9nom',c.first_name,'Jean',false,!isPro)
      +inp('mac-lname',isPro?'Nom (contact)':'Nom',c.last_name,'Dupont')
      +inp('mac-phone','T\u00e9l\u00e9phone',c.phone,'+32 4xx xx xx xx')
      +'<div class="input-group"><label>Email</label><input value="'+_afEsc(c.email)+'" disabled style="opacity:.6;cursor:not-allowed;" title="L\u2019email de connexion ne peut pas \u00eatre modifi\u00e9 ici"></div>'
      +inp('mac-street','Rue et num\u00e9ro',c.address_street,'Avenue Louise 54',true)
      +inp('mac-postal','Code postal',c.address_postal,'1050')
      +inp('mac-city','Ville',c.address_city,'Bruxelles')
      +'<div class="input-group"><label>Pays</label><select id="mac-country"></select></div>'
    +'</div>'
    +'<div id="mac-err" class="auth-error"></div>';
  var sel=document.getElementById('mac-country'), src=document.getElementById('pf-country');
  sel.innerHTML='<option value="">\u2014</option>'+(src?src.innerHTML:'');
  var v=c.address_country||'';
  if(v && !Array.prototype.some.call(sel.options,function(o){return o.value===v;})) sel.insertAdjacentHTML('beforeend','<option value="'+_afEsc(v)+'">'+_afEsc(v)+'</option>');
  sel.value=v;
  var b=document.getElementById('mac-save'); if(b){ b.disabled=false; b.textContent='Enregistrer'; }
  openModal('m-admin-client');
};
window.adminSaveClient=async function(){
  var id=_adminEditClientId; if(!id||!sb) return;
  var c=(_adminClientsData||[]).find(function(x){return x.id===id;})||{};
  var isPro=c.client_type==='pro';
  var err=document.getElementById('mac-err'), btn=document.getElementById('mac-save');
  var g=function(k){return (document.getElementById(k)?.value||'').trim();};
  if(err) err.classList.remove('show');
  var upd={
    first_name:g('mac-fname')||null, last_name:g('mac-lname')||null, phone:g('mac-phone')||null,
    address_street:g('mac-street')||null, address_postal:g('mac-postal')||null,
    address_city:g('mac-city')||null, address_country:g('mac-country')||null
  };
  if(isPro){ upd.company_name=g('mac-company')||null; upd.vat_number=g('mac-vat')||null; }
  if(isPro && !upd.company_name){ showError(err,'Nom de soci\u00e9t\u00e9 requis'); return; }
  if(!isPro && !upd.first_name){ showError(err,'Pr\u00e9nom requis'); return; }
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement...'; }
  try{
    var {error}=await sb.rpc('api_admin_save',{ p_table:'profiles', p_id:id, p_data:upd });
    if(error) throw error;
    closeModal('m-admin-client');
    showToast('\u2705 Donn\u00e9es du client mises \u00e0 jour');
    await loadAdminClients();
  }catch(e){
    showError(err,'Erreur : '+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent='Enregistrer'; }
  }
};

// ── ADMIN: RAPPORTS ───────────────────────────────────
// Report "Paiements fleets": per fleet and per month
//   prestation invoice  : fleet -> Bleenr (self-billing), HTVA of the rides + VAT client->carrier (fleet country)
//   commission invoice  : Bleenr -> fleet, commission % of HTVA + VAT carrier->Bleenr (or reverse charge)
//   amount to pay fleet : prestation TVAC - commission TVAC
var _rptYear = new Date().getFullYear(), _rptMonth = new Date().getMonth()+1;
var _rptData = null, _rptSettings = null;
function _rptPeriod(){ return _rptYear+'-'+String(_rptMonth).padStart(2,'0'); }

// Fleet country (stored as full name, e.g. "Belgique") -> VAT rate from Facturation settings
function _rptVatForCountry(countryName){
  var rates = (_rptSettings && Array.isArray(_rptSettings.vat_rates_client_carrier)) ? _rptSettings.vat_rates_client_carrier : [];
  var code = null;
  if(countryName && typeof _BILLING_COUNTRIES!=='undefined'){
    var m = _BILLING_COUNTRIES.find(function(c){ return c[1].toLowerCase()===String(countryName).toLowerCase() || c[0]===countryName; });
    if(m) code = m[0];
  }
  var hit = rates.find(function(r){ return r.country===(code||'BE'); }) || rates.find(function(r){ return r.country==='BE'; });
  return hit ? parseFloat(hit.rate) : TVA_RATE*100;
}

async function loadAdminReports(){
  var el=document.getElementById('admin-reports-content'); if(!el||!sb) return;
  el.innerHTML='<div class="page-loading"><div class="page-spinner"></div></div>';
  try{
    var st=await sb.from('billing_settings').select('*').eq('id',1).maybeSingle();
    _rptSettings=st.data||null;
  }catch(e){ _rptSettings=null; }
  await _rptRender();
}

window._rptSet=function(y,m){ _rptYear=y; _rptMonth=m; _rptRender(); };
window._rptStep=function(d){ var m=_rptMonth+d, y=_rptYear; if(m<1){m=12;y--;} if(m>12){m=1;y++;} _rptSet(y,m); };

async function _rptRender(){
  var el=document.getElementById('admin-reports-content'); if(!el) return;
  var period=_rptPeriod();
  var from=period+'-01', to=period+'-'+String(new Date(_rptYear,_rptMonth,0).getDate()).padStart(2,'0');
  // Commission % and its VAT come from Admin -> Facturation
  var _cfgR = _invCfg(_rptSettings||{});

  var yOpts='', curY=new Date().getFullYear();
  for(var y=curY+1;y>=curY-3;y--) yOpts+='<option value="'+y+'"'+(y===_rptYear?' selected':'')+'>'+y+'</option>';
  var mOpts=_RPT_MONTHS.map(function(l,i){ return '<option value="'+(i+1)+'"'+(i+1===_rptMonth?' selected':'')+'>'+l+'</option>'; }).join('');
  var sel='font-size:13px;font-weight:600;border:1.5px solid var(--sand3);border-radius:6px;padding:4px 8px;background:var(--white);cursor:pointer;';
  var nb='background:none;border:1.5px solid var(--sand3);border-radius:6px;width:30px;height:30px;cursor:pointer;';

  var head='<div class="card rpt-head" style="padding:16px 20px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
    +'<div style="font-size:12px;color:var(--ink3);font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Rapport</div>'
    +'<select style="'+sel+'"><option>Paiements fleets &amp; factures (mensuel)</option></select>'
    +'<div class="rpt-nav" style="display:flex;align-items:center;gap:6px;margin-left:auto;">'
      +'<button style="'+nb+'" onclick="_rptStep(-1)">&lt;</button>'
      +'<select style="'+sel+'" onchange="_rptSet(_rptYear,parseInt(this.value))">'+mOpts+'</select>'
      +'<select style="'+sel+'" onchange="_rptSet(parseInt(this.value),_rptMonth)">'+yOpts+'</select>'
      +'<button style="'+nb+'" onclick="_rptStep(1)">&gt;</button>'
    +'</div></div>';
  el.innerHTML=head+'<div class="page-loading"><div class="page-spinner"></div></div>';

  try{
    var rr=await sb.from('rides').select('*').in('status',['done','confirmed']).not('driver_id','is',null).not('final_price','is',null)
      .gte('ride_date',from).lte('ride_date',to).order('ride_date',{ascending:true});
    if(rr.error) throw rr.error;
    var rides=(rr.data||[]).filter(function(r){ return !r.is_subcontract; }); // sous-traitances : hors facturation
    _rptRides=rides;
    var ids=[...new Set(rides.map(function(r){return r.driver_id;}).concat(rides.map(function(r){return r.client_id;})).filter(Boolean))];
    var people={};
    if(ids.length){
      var pr=await sb.from('profiles').select('id,email,role,client_type,company_name,first_name,last_name,vat_number,address_street,address_postal,address_city,address_country,phone').in('id',ids);
      (pr.data||[]).forEach(function(p){ people[p.id]=p; });
    }
    _rptPeople=people;
    var byFleet={};
    rides.forEach(function(r){ (byFleet[r.driver_id]=byFleet[r.driver_id]||[]).push(r); });
    _rptData=Object.keys(byFleet).map(function(fid){
      var f=people[fid]||{id:fid};
      var list=byFleet[fid];
      var htva=_rptR2(list.reduce(function(s,r){ return s+_rptRideHtva(r); },0));
      var pVat=_cfgR.vatFor(f.address_country);
      var commissionRate=_cfgR.commFor(f.address_country), rc=_cfgR.rcFor(f.address_country), commVat=_cfgR.cVatFor(f.address_country);
      var pVatAmt=_rptR3(htva*pVat/100);
      var pTvac=_rptR3(htva+pVatAmt);
      // Commission = admin % of the prestation HTVA, + VAT carrier -> Bleenr (0 % if reverse charge)
      var cHt=_rptR3(htva*commissionRate/100);
      var cVatAmt=_rptR3(cHt*commVat/100);
      var cTvac=_rptR3(cHt+cVatAmt);
      return { fleet:f, rides:list, htva:htva, pVat:pVat, pVatAmt:pVatAmt, pTvac:pTvac,
               commRate:commissionRate, cHt:cHt, cVat:commVat, cRc:rc, cVatAmt:cVatAmt, cTvac:cTvac,
               // Net paid to the fleet = prestation TVAC - commission TVAC
               net:_rptR3(pTvac-cTvac) };
    }).sort(function(a,b){ return _rptFleetName(a.fleet).localeCompare(_rptFleetName(b.fleet)); });
  }catch(e){
    el.innerHTML=head+'<div class="card" style="padding:24px;color:var(--red);font-size:13px;">Erreur : '+_billingEsc(e.message||e)+'</div>';
    return;
  }

  if(!_rptData.length){
    el.innerHTML=head+'<div class="card" style="padding:40px;text-align:center;color:var(--ink3);font-size:13px;">Aucune course réalisée en '+_RPT_MONTHS[_rptMonth-1]+' '+_rptYear+'</div>';
    return;
  }
  var tot=_rptData.reduce(function(t,d){ ['htva','pTvac','cHt','cTvac','net'].forEach(function(k){ t[k]=_rptR3((t[k]||0)+d[k]); }); t.n=(t.n||0)+d.rides.length; return t; },{});
  var th=function(l,r){ return '<th style="padding:10px 12px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);font-weight:600;text-align:'+(r?'right':'left')+';white-space:nowrap;">'+l+'</th>'; };
  var td=function(v,r,b){ return '<td style="padding:10px 12px;font-size:12.5px;text-align:'+(r?'right':'left')+';white-space:nowrap;'+(b?'font-weight:700;':'')+'">'+v+'</td>'; };
  var sub=function(t){ return '<div style="font-size:10.5px;color:var(--ink3);">'+t+'</div>'; };
  var rows=_rptData.map(function(d,i){
    return '<tr style="border-bottom:1px solid var(--sand2);">'
      +td('<div style="font-weight:600;">'+_billingEsc(_rptFleetName(d.fleet))+'</div><div style="font-size:11px;color:var(--ink3);">'+_billingEsc(d.fleet.email||'')+'</div>')
      +td(d.rides.length,true)
      +td(_rptMoney(d.htva),true)
      +td(_rptMoney(d.pTvac)+sub('TVA '+d.pVat+'%'),true)
      +td('−'+_rptMoney(d.cHt)+sub(d.commRate+'%'),true)
      +td('−'+_rptMoney(d.cTvac)+sub(d.cRc?'autoliquidation':'TVA '+d.cVat+'%'),true)
      +td(_rptMoney(d.net),true,true)
      +'<td style="padding:8px 12px;text-align:right;white-space:nowrap;">'
        +'<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;" onclick="rptInvoice('+i+',\'prestation\')">Facture prestation</button> '
        +'<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;" onclick="rptInvoice('+i+',\'commission\')">Facture commission</button>'
      +'</td></tr>';
  }).join('');
  el.innerHTML=head
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px;">'
      +[['Courses',tot.n],['Total HTVA',_rptMoney(tot.htva)],['Commissions HTVA',_rptMoney(tot.cHt)],['À payer aux fleets',_rptMoney(tot.net)]].map(function(k){
        return '<div class="card" style="padding:14px 16px;"><div style="font-size:11px;color:var(--ink3);margin-bottom:4px;">'+k[0]+'</div><div style="font-size:18px;font-weight:700;">'+k[1]+'</div></div>';
      }).join('')
    +'</div>'
    +'<div class="card" style="padding:0;overflow:hidden;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--sand2);">'
        +'<div style="font-size:14px;font-weight:700;">Paiements à effectuer — '+_RPT_MONTHS[_rptMonth-1]+' '+_rptYear+'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">'
          +'<button class="btn btn-secondary btn-sm" onclick="rptInvoiceAll(\'prestation\')">Toutes les factures de prestation</button>'
          +'<button class="btn btn-secondary btn-sm" onclick="rptInvoiceAll(\'commission\')">Commissions \u2014 toutes les fleets</button>'
          +'<button class="btn btn-secondary btn-sm" onclick="rptExportCsv()">Exporter CSV</button>'
        +'</div>'
      +'</div>'
      +'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
        +'<thead><tr style="background:var(--sand2);">'+th('Fleet')+th('Courses',1)+th('Prestation HTVA',1)+th('Prestation TVAC',1)+th('Commission HTVA',1)+th('Commission TVAC',1)+th('Net à payer',1)+th('Factures',1)+'</tr></thead>'
        +'<tbody>'+rows+'</tbody>'
        +'<tfoot><tr style="background:var(--sand2);">'+td('<b>Total</b>')+td(tot.n,true,true)+td(_rptMoney(tot.htva),true,true)+td(_rptMoney(tot.pTvac),true,true)+td('−'+_rptMoney(tot.cHt),true,true)+td('−'+_rptMoney(tot.cTvac),true,true)+td(_rptMoney(tot.net),true,true)+'<td></td></tr></tfoot>'
      +'</table></div>'
    +'</div>'
    +_rptClientsCard()
    +(!_rptSettings?'<div style="margin-top:10px;font-size:12px;color:var(--amber);">Paramètres de facturation non renseignés : valeurs par défaut utilisées (commission 10 %, TVA 6 % / 21 %). Complétez Admin → Facturation.</div>':'');
}

var _rptPeople={};
// Admin: one line per client with its prestation invoices (one per fleet)
function _rptClientsCard(){
  var by={};
  (_rptRides||[]).forEach(function(r){ if(!r.client_id) return; var c=by[r.client_id]=by[r.client_id]||{n:0,tvac:0,fleets:{}}; c.n++; c.tvac+=r.is_subcontract ? _rptRideHtva(r)*(1+_invCfg(_rptSettings||{}).vatFor((_rptPeople[r.driver_id]||{}).address_country)/100) : (parseFloat(r.final_price)||0); c.fleets[r.driver_id]=1; });
  var ids=Object.keys(by); if(!ids.length) return '';
  ids.sort(function(a,b){ return _rptFleetName(_rptPeople[a]).localeCompare(_rptFleetName(_rptPeople[b])); });
  var th=function(l,r){ return '<th style="padding:10px 12px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);font-weight:600;text-align:'+(r?'right':'left')+';white-space:nowrap;">'+l+'</th>'; };
  var td=function(v,r){ return '<td style="padding:10px 12px;font-size:12.5px;text-align:'+(r?'right':'left')+';white-space:nowrap;">'+v+'</td>'; };
  return '<div class="card" style="padding:0;overflow:hidden;margin-top:14px;">'
    +'<div style="padding:12px 16px;border-bottom:1px solid var(--sand2);font-size:14px;font-weight:700;">Factures par client — '+_RPT_MONTHS[_rptMonth-1]+' '+_rptYear+'</div>'
    +'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:var(--sand2);">'+th('Client')+th('Type')+th('Courses',1)+th('Fleets',1)+th('Total payé TVAC',1)+th('Factures',1)+'</tr></thead><tbody>'
    +ids.map(function(id){
      var p=_rptPeople[id]||{}, c=by[id];
      var type=p.role==='driver'?'Fleet (sous-traitance)':(p.client_type==='pro'?'Professionnel':'Particulier');
      return '<tr style="border-bottom:1px solid var(--sand2);">'
        +td('<div style="font-weight:600;">'+_billingEsc(_rptFleetName(p))+'</div><div style="font-size:11px;color:var(--ink3);">'+_billingEsc(p.email||'')+'</div>')
        +td(type)+td(c.n,1)+td(Object.keys(c.fleets).length,1)+td(_rptMoney(c.tvac),1)
        +'<td style="padding:8px 12px;text-align:right;"><button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;" onclick="rptInvoiceClient(\''+id+'\')">Factures de prestation</button></td></tr>';
    }).join('')
    +'</tbody></table></div></div>';
}
function _rptFleetName(f){ return (f && (f.company_name || ((f.first_name||'')+' '+(f.last_name||'')).trim() || f.email)) || '—'; }

window.rptExportCsv=function(){
  if(!_rptData||!_rptData.length) return;
  var n=function(v){ return _rptR2(v).toFixed(2).replace('.',','); };
  var lines=[['Fleet','Email','TVA fleet','Courses','Prestation HTVA','TVA prestation %','TVA prestation','Prestation TVAC','Commission %','Commission HTVA','TVA commission %','TVA commission','Commission TVAC','Net a payer'].join(';')];
  _rptData.forEach(function(d){
    lines.push(['"'+_rptFleetName(d.fleet).replace(/"/g,'""')+'"',d.fleet.email||'',d.fleet.vat_number||'',d.rides.length,n(d.htva),d.pVat,n(d.pVatAmt),n(d.pTvac),d.commRate,n(d.cHt),d.cRc?'autoliquidation':d.cVat,n(d.cVatAmt),n(d.cTvac),n(d.net)].join(';'));
  });
  var blob=new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='paiements-fleets-'+_rptPeriod()+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
};

// ── Admin: per fleet, per client, or all at once ──
var _rptRides=[];
window.rptInvoice=function(i, kind){
  var d=_rptData&&_rptData[i]; if(!d) return;
  _invOpen({ rides:d.rides, kind:kind, year:_rptYear, month:_rptMonth, settings:_rptSettings, people:_rptPeople,
    title:(kind==='prestation'?'Factures de prestation':'Facture de commission')+' — '+_rptFleetName(d.fleet)+' — '+_RPT_MONTHS[_rptMonth-1]+' '+_rptYear });
};
window.rptInvoiceClient=function(clientId){
  _invOpen({ rides:_rptRides.filter(function(r){return r.client_id===clientId;}), kind:'prestation', year:_rptYear, month:_rptMonth, settings:_rptSettings, people:_rptPeople,
    title:'Factures de prestation — '+_rptFleetName(_rptPeople[clientId])+' — '+_RPT_MONTHS[_rptMonth-1]+' '+_rptYear });
};
window.rptInvoiceAll=function(kind){
  _invOpen({ rides:_rptRides, kind:kind, year:_rptYear, month:_rptMonth, settings:_rptSettings, people:_rptPeople });
};

async function loadAdminClients(){
  var el=document.getElementById('admin-clients-list');if(!el||!sb)return;
  try{
    var {data,error}=await sb.from('profiles').select('*').eq('role','client').order('created_at',{ascending:false});
    if(error) throw error;
    _adminClientsData=data||[];
    var _nPro=_adminClientsData.filter(function(c){return c.client_type==='pro';}).length;
    var _cp=document.getElementById('acl-count-pro'); if(_cp) _cp.textContent='('+_nPro+')';
    var _cs=document.getElementById('acl-count-perso'); if(_cs) _cs.textContent='('+(_adminClientsData.length-_nPro)+')';
    renderAdminClients();
  }catch(e){el.innerHTML='<div class="card" style="padding:24px;color:var(--red);font-size:13px;">Erreur: '+(e.message||e)+'</div>';}
}

function renderAdminClients(){
  var el=document.getElementById('admin-clients-list');if(!el)return;
  var filtered=_adminClientsData.filter(function(c){
    return _adminClientTab==='pro'?(c.client_type==='pro'):(c.client_type!=='pro');
  });

  if(filtered.length===0){
    el.innerHTML='<div class="card" style="padding:24px;text-align:center;color:var(--ink4);font-size:13px;">Aucun client '+(_adminClientTab==='pro'?'professionnel':'particulier')+' trouv\u00e9</div>';
    return;
  }

  var isPro=_adminClientTab==='pro';

  el.innerHTML='<div class="card" style="overflow:hidden;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--sand2);text-align:left;">'
    +(isPro?'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Soci\u00e9t\u00e9</th>':'')
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">'+(isPro?'Contact':'Nom')+'</th>'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Email</th>'
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">T\u00e9l\u00e9phone</th>'
    +(isPro?'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">TVA</th>':'')
    +'<th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;">Inscription</th>'
    +'</tr></thead><tbody>'
    +filtered.map(function(c){
      var fullName=((c.first_name||'')+' '+(c.last_name||'')).trim()||'\u2014';
      var dateStr=c.created_at?new Date(c.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'\u2014';
      return '<tr style="border-bottom:1px solid var(--sand2);cursor:pointer;" onclick="adminEditClient(\''+c.id+'\')" title="Modifier les donn\u00e9es du client" onmouseover="this.style.background=\'var(--sand2)\'" onmouseout="this.style.background=\'\'">'
        +(isPro?'<td style="padding:10px 14px;font-weight:500;">'+(c.company_name||'\u2014')+'</td>':'')
        +'<td style="padding:10px 14px;'+(isPro?'font-size:12px;color:var(--ink3);':'font-weight:500;')+'">'+fullName+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;color:var(--ink3);">'+(c.email||'\u2014')+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;">'+(c.phone||'\u2014')+'</td>'
        +(isPro?'<td style="padding:10px 14px;font-size:12px;">'+(c.vat_number||'\u2014')+'</td>':'')
        +'<td style="padding:10px 14px;font-size:12px;color:var(--ink3);">'+dateStr+'</td>'
        +'</tr>';
    }).join('')
    +'</tbody></table></div></div>';
}



// ── Admin: Dashboard ──
var _adminDashPeriod = 'all';

window.setAdminPeriod = function(mode) {
  _adminDashPeriod = mode;
  var allBtn = document.getElementById('admin-period-all');
  var customBtn = document.getElementById('admin-period-custom');
  var datesEl = document.getElementById('admin-period-dates');
  if(allBtn && customBtn && datesEl) {
    if(mode === 'all') {
      allBtn.style.cssText = 'padding:6px 16px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:var(--white);color:var(--ink);box-shadow:0 1px 4px rgba(14,14,12,.1);';
      customBtn.style.cssText = 'padding:6px 16px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:var(--ink3);';
      datesEl.style.display = 'none';
    } else {
      customBtn.style.cssText = 'padding:6px 16px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:var(--white);color:var(--ink);box-shadow:0 1px 4px rgba(14,14,12,.1);';
      allBtn.style.cssText = 'padding:6px 16px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:var(--ink3);';
      datesEl.style.display = 'flex';
    }
  }
  refreshAdminDashboard();
};

// ── ADMIN: Courses ─────────────────────────────────────
var _arAllRides = [];
var _arProfiles = {}; // id -> {name}

window.arResetFilters = function(){
  var els = ['ar-filter-status','ar-filter-client','ar-filter-driver','ar-filter-from','ar-filter-to'];
  els.forEach(function(id){ var el=document.getElementById(id); if(el){ el.value=''; } });
  loadAdminRides();
};

window.arSwitchTab = function(tab){
  var ridesPanel  = document.getElementById('ar-panel-rides');
  var offersPanel = document.getElementById('ar-panel-offers');
  var ridesBtn    = document.getElementById('ar-tab-rides');
  var offersBtn   = document.getElementById('ar-tab-offers');
  var activeStyle   = 'padding:7px 20px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:var(--white);color:var(--ink);box-shadow:0 1px 4px rgba(14,14,12,.1);font-family:\'DM Sans\',sans-serif;';
  var inactiveStyle = 'padding:7px 20px;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:var(--ink3);font-family:\'DM Sans\',sans-serif;';
  if(tab === 'rides'){
    ridesPanel.style.display = 'block'; offersPanel.style.display = 'none';
    ridesBtn.style.cssText = activeStyle; offersBtn.style.cssText = inactiveStyle;
  } else {
    ridesPanel.style.display = 'none'; offersPanel.style.display = 'block';
    offersBtn.style.cssText = activeStyle; ridesBtn.style.cssText = inactiveStyle;
    loadAdminOffers();
  }
};

window.loadAdminOffers = async function(){
  var el = document.getElementById('admin-offers-list');
  if(!el || !sb) return;
  el.innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';
  try {
    // Fetch all offers with ride and driver info
    var { data: offers, error } = await sb.from('offers')
      .select('id,ride_id,driver_id,price,message,status,created_at,vehicle_id')
      .order('created_at',{ascending:false});
    if(error) throw error;

    // Fetch associated rides
    var rideIds = [...new Set((offers||[]).map(function(o){ return o.ride_id; }).filter(Boolean))];
    var ridesMap = {};
    if(rideIds.length > 0){
      var {data:rData} = await sb.from('rides').select('id,booking_code,from_address,to_address,trip_type,ride_date').in('id', rideIds);
      (rData||[]).forEach(function(r){ ridesMap[r.id] = r; });
    }

    // Fetch driver profiles
    var driverIds = [...new Set((offers||[]).map(function(o){ return o.driver_id; }).filter(Boolean))];
    var driversMap = {};
    if(driverIds.length > 0){
      var {data:dData} = await sb.from('profiles').select('id,first_name,last_name').in('id', driverIds);
      (dData||[]).forEach(function(p){ driversMap[p.id] = p; });
    }

    if(!offers || !offers.length){
      el.innerHTML = '<div class="empty-state"><p class="empty-text">Aucune offre trouvée</p></div>';
      return;
    }

    var statusLabel = {pending:'En attente',accepted:'Acceptée',rejected:'Rejetée'};
    var statusBg    = {pending:'var(--amber-bg)',accepted:'var(--green-bg)',rejected:'var(--red-bg)'};
    var statusColor = {pending:'var(--amber)',accepted:'var(--green)',rejected:'var(--red)'};

    var rows = offers.map(function(o){
      var ride = ridesMap[o.ride_id] || {};
      var driver = driversMap[o.driver_id] || {};
      var driverName = ((driver.first_name||'')+' '+(driver.last_name||'')).trim() || '—';
      var rideCode = ride.booking_code || o.ride_id?.slice(0,8) || '—';
      var rideRoute = ride.from_address ? ride.from_address.split(',')[0]+(ride.to_address?' → '+ride.to_address.split(',')[0]:'') : '—';
      var dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      var htva = parseFloat(o.price||0);
      var tvac = (htva*(1+TVA_RATE)).toFixed(2).replace('.',',');
      var sBg = statusBg[o.status]||'var(--sand2)', sCol = statusColor[o.status]||'var(--ink4)', sLbl = statusLabel[o.status]||o.status;
      var msgHtml = o.message ? '<div style="font-size:11px;color:var(--ink4);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">'+_rdEsc(o.message)+'</div>' : '';
      return '<tr style="border-bottom:1px solid var(--sand2);">'
        +'<td style="padding:10px 14px;font-size:12px;color:var(--ink3);white-space:nowrap;">'+dateStr+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;font-family:monospace;font-weight:600;color:var(--ink2);">'+rideCode+'</td>'
        +'<td style="padding:10px 14px;font-size:12px;color:var(--ink2);">'+rideRoute+'</td>'
        +'<td style="padding:10px 14px;font-size:13px;font-weight:500;">'+driverName+'</td>'
        +'<td style="padding:10px 14px;"><div style="font-size:13px;font-weight:600;">'+htva.toFixed(2).replace('.',',')+' € <span style="font-size:11px;font-weight:400;color:var(--ink3);">HTVA</span></div><div style="font-size:11px;color:var(--ink3);">'+tvac+' € TVAC</div>'+msgHtml+'</td>'
        +'<td style="padding:10px 14px;"><span style="font-size:11px;font-weight:600;background:'+sBg+';color:'+sCol+';padding:3px 9px;border-radius:20px;">'+sLbl+'</span></td>'
      +'</tr>';
    }).join('');

    el.innerHTML = '<div class="card" style="overflow:hidden;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px;">'
      +'<thead><tr style="background:var(--sand2);">'
        +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Date</th>'
        +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Code course</th>'
        +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Trajet</th>'
        +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Chauffeur</th>'
        +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Prix / Message</th>'
        +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Statut</th>'
      +'</tr></thead>'
      +'<tbody>'+rows+'</tbody>'
    +'</table></div></div>';
  } catch(e) {
    el.innerHTML = '<div class="page-loading" style="color:var(--red);">Erreur : '+e.message+'</div>';
  }
};


// ── ADMIN : SIGNALEMENTS ─────────────────────────────────────
var _aiFilter='open', _aiRides={};
window.filterAdminIssues=function(f,btn){
  _aiFilter=f;
  document.querySelectorAll('#admin-issues-filters button').forEach(function(b){ b.className='btn btn-sm '+(b===btn?'btn-primary':'btn-secondary'); });
  loadAdminIssues();
};
window.loadAdminIssues=async function(){
  var el=document.getElementById('admin-issues-list'); if(!el||!sb) return;
  el.innerHTML='<div class="page-loading"><div class="page-spinner"></div></div>';
  var e=function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  try{
    var q=sb.from('ride_reports').select('*').order('created_at',{ascending:false});
    if(_aiFilter!=='all') q=q.eq('status',_aiFilter);
    var {data:reps,error}=await q;
    if(error) throw error;
    reps=reps||[];
    _refreshAdminIssuesBadge();
    if(!reps.length){ el.innerHTML='<div class="empty-state"><p class="empty-text">'+(_aiFilter==='open'?'Aucun signalement ouvert':'Aucun signalement')+'</p></div>'; return; }

    var rideIds=[...new Set(reps.map(function(x){return x.ride_id;}))];
    var res=await Promise.all([
      sb.from('rides').select('*').in('id',rideIds),
      sb.from('offers').select('ride_id,driver_id,vehicle_id,fleet_driver_id').eq('status','accepted').in('ride_id',rideIds)
    ]);
    var rides={}; (res[0].data||[]).forEach(function(r){ rides[r.id]=r; }); _aiRides=rides;
    var offs={}; (res[1].data||[]).forEach(function(o){ offs[o.ride_id]=o; });
    var pIds=[], vIds=[], fdIds=[];
    reps.forEach(function(x){ pIds.push(x.client_id); var r=rides[x.ride_id], o=offs[x.ride_id];
      if(r&&r.client_id) pIds.push(r.client_id);
      var d=(r&&r.driver_id)||(o&&o.driver_id); if(d) pIds.push(d);
      if(o&&o.vehicle_id) vIds.push(o.vehicle_id); if(o&&o.fleet_driver_id) fdIds.push(o.fleet_driver_id); });
    var uniq=function(a){ return [...new Set(a.filter(Boolean))]; };
    pIds=uniq(pIds); vIds=uniq(vIds); fdIds=uniq(fdIds);
    var res2=await Promise.all([
      pIds.length?sb.from('profiles').select('id,first_name,last_name,company_name,client_type,role,email,phone').in('id',pIds):Promise.resolve({data:[]}),
      vIds.length?sb.from('fleet_vehicles').select('id,brand,model,color,plate').in('id',vIds):Promise.resolve({data:[]}),
      fdIds.length?sb.from('fleet_drivers').select('id,first_name,last_name,phone').in('id',fdIds):Promise.resolve({data:[]})
    ]);
    var profs={}; (res2[0].data||[]).forEach(function(p){ profs[p.id]=p; });
    var vehs={}; (res2[1].data||[]).forEach(function(v){ vehs[v.id]=v; });
    var fdrs={}; (res2[2].data||[]).forEach(function(d){ fdrs[d.id]=d; });

    var stLbl={waiting:'En attente',offers:'Offres reçues',pending_payment:'Paiement en cours',confirmed:'Confirmée',active:'En cours',done:'Terminée',cancelled:'Annulée'};
    var th=function(t,al){ return '<th style="padding:10px 12px;text-align:'+(al||'left')+';font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);white-space:nowrap;">'+t+'</th>'; };
    var sub=function(t){ return t?'<div style="font-size:11.5px;color:var(--ink3);margin-top:2px;white-space:nowrap;">'+t+'</div>':''; };
    var td='<td style="padding:10px 12px;vertical-align:top;">';

    var rows=reps.map(function(x){
      var r=rides[x.ride_id]||{}, o=offs[x.ride_id]||{};
      var cl=profs[r.client_id||x.client_id];
      var fleetId=r.driver_id||o.driver_id, fl=profs[fleetId];
      var fd=fdrs[o.fleet_driver_id], v=vehs[o.vehicle_id];
      var n=r.notes||'';
      var pax=((n.match(/\|pax:([^|]+)/)||[])[1]||'').trim(), paxT=((n.match(/\|tel:([^|]+)/)||[])[1]||'').trim();
      var created=new Date(x.created_at).toLocaleString('fr-BE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      var rDate=r.ride_date?new Date(r.ride_date+'T00:00:00').toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'})+(r.ride_time?' · '+String(r.ride_time).slice(0,5):''):'—';
      var trajet=r.trip_type==='disposal'?e((r.from_address||'').split(',')[0])+' (mise à dispo.)':e((r.from_address||'—').split(',')[0])+' → '+e((r.to_address||'—').split(',')[0]);
      var price=r.final_price?parseFloat(r.final_price).toFixed(2).replace('.',',')+' €':'';
      var open=x.status!=='resolved';
      var stBadge=open
        ?'<span style="font-size:11px;font-weight:700;background:var(--red-bg);color:var(--red);padding:3px 9px;border-radius:20px;white-space:nowrap;">Ouvert</span>'
        :'<span style="font-size:11px;font-weight:700;background:var(--green-bg);color:var(--green);padding:3px 9px;border-radius:20px;white-space:nowrap;">Traité</span>'+(x.resolved_at?sub(new Date(x.resolved_at).toLocaleDateString('fr-BE')):'');
      var act='<button class="btn btn-sm '+(open?'btn-primary':'btn-secondary')+'" style="white-space:nowrap;" onclick="setAdminIssueStatus(\''+x.id+'\',\''+(open?'resolved':'open')+'\',this)">'+(open?'Marquer traité':'Rouvrir')+'</button>';
      return '<tr style="border-bottom:1px solid var(--sand2);">'
        +td+'<div style="font-size:12.5px;white-space:nowrap;">'+created+'</div></td>'
        +td+'<a href="#" onclick="event.preventDefault();openAdminIssueRide(\''+x.ride_id+'\')" style="font-family:monospace;font-weight:700;font-size:12px;color:var(--green);white-space:nowrap;">'+e(r.booking_code||String(x.ride_id).slice(0,8))+'</a>'+sub(stLbl[r.status]||r.status||'')+'</td>'
        +td+'<div style="font-size:12.5px;white-space:nowrap;">'+rDate+'</div>'+sub(trajet)+(price?sub(price):'')+'</td>'
        +td+'<div style="font-weight:600;white-space:nowrap;">'+e(_arDisplayName(cl))+'</div>'+sub(e(cl&&cl.email))+sub(cl&&cl.phone?'<a href="tel:'+e(cl.phone)+'" style="color:var(--blue);">'+e(cl.phone)+'</a>':'')+(pax?sub('Passager : '+e(pax)+(paxT?' · '+e(paxT):'')):'')+'</td>'
        +td+'<div style="font-weight:600;white-space:nowrap;">'+(fl?e(_arDisplayName(fl)):'—')+'</div>'+sub(fl&&fl.phone?'<a href="tel:'+e(fl.phone)+'" style="color:var(--blue);">'+e(fl.phone)+'</a>':'')+'</td>'
        +td+'<div style="white-space:nowrap;">'+(fd?e(((fd.first_name||'')+' '+(fd.last_name||'')).trim()):'—')+'</div>'+sub(fd&&fd.phone?'<a href="tel:'+e(fd.phone)+'" style="color:var(--blue);">'+e(fd.phone)+'</a>':'')+'</td>'
        +td+'<div style="white-space:nowrap;">'+(v?e(((v.brand||'')+' '+(v.model||'')).trim()):'—')+'</div>'+sub(v?e([v.color,v.plate].filter(Boolean).join(' · ')):'')+'</td>'
        +td+'<div style="min-width:220px;max-width:360px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.45;">'+e(x.message)+'</div></td>'
        +td+stBadge+'</td>'
        +td+act+'</td>'
      +'</tr>';
    }).join('');

    el.innerHTML='<div class="card" style="overflow:hidden;"><div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:1200px;">'
      +'<thead><tr style="background:var(--sand2);">'+th('Signalé le')+th('Course')+th('Date / trajet')+th('Client')+th('Fleet')+th('Chauffeur')+th('Véhicule')+th('Message')+th('Statut')+th('')+'</tr></thead>'
      +'<tbody>'+rows+'</tbody></table></div></div>';
  }catch(err){
    el.innerHTML='<div class="page-loading" style="color:var(--red);">Erreur : '+e(err.message)+'</div>';
  }
};
window.openAdminIssueRide=function(rideId){
  var r=_aiRides[rideId]; if(!r) return;
  var tmp=document.createElement('div');
  tmp.dataset.ride=JSON.stringify(r);
  arOpenDetail(tmp);
};
window.setAdminIssueStatus=async function(id,status,btn){
  if(!sb) return;
  if(btn){ btn.disabled=true; btn.textContent='…'; }
  var res=await sb.rpc('api_admin_save',{ p_table:'ride_reports', p_id:id, p_data:{status:status,resolved_at:status==='resolved'?new Date().toISOString():null} });

  var _reset=function(){ if(btn){ btn.disabled=false; btn.textContent=status==='resolved'?'Marquer trait\u00e9':'Rouvrir'; } };
  if(res.error){ showToast('Erreur : '+res.error.message); _reset(); return; }
  // RLS : une mise à jour refusée ne renvoie pas d'erreur, juste 0 ligne
  if(!res.data||!res.data.length){ showToast('Mise \u00e0 jour refus\u00e9e : r\u00e8gle d\u2019acc\u00e8s admin manquante sur ride_reports'); _reset(); return; }
  showToast(status==='resolved'?'✅ Signalement marqué comme traité':'Signalement rouvert');
  loadAdminIssues();
};

window.loadAdminRides = async function(){
  var el = document.getElementById('admin-rides-list');
  if(!el || !sb) return;
  el.innerHTML = '<div class="page-loading"><div class="page-spinner"></div></div>';

  try {
    // Fetch all rides
    var q = sb.from('rides').select('*').order('ride_date',{ascending:false}).order('ride_time',{ascending:false});
    var statusVal = document.getElementById('ar-filter-status')?.value || '';
    var fromVal   = document.getElementById('ar-filter-from')?.value   || '';
    var toVal     = document.getElementById('ar-filter-to')?.value     || '';
    if(statusVal) q = q.eq('status', statusVal);
    if(fromVal)   q = q.gte('ride_date', fromVal);
    if(toVal)     q = q.lte('ride_date', toVal);

    var { data: rides, error } = await q;
    if(error) throw error;
    _arAllRides = rides || [];
    await _mergeRidePrivate(_arAllRides);

    // Confirmed / finished rides whose driver_id was not set: take the fleet from the accepted offer
    var _noDrv=_arAllRides.filter(function(r){ return !r.driver_id && ['confirmed','pending_payment','active','done'].indexOf(r.status)>=0; });
    if(_noDrv.length){
      var { data: accOf } = await sb.from('offers').select('ride_id,driver_id').eq('status','accepted').in('ride_id', _noDrv.map(function(r){ return r.id; }));
      var _accMap={}; (accOf||[]).forEach(function(o){ _accMap[o.ride_id]=o.driver_id; });
      _noDrv.forEach(function(r){ if(_accMap[r.id]) r.driver_id=_accMap[r.id]; });
    }

    // Collect all profile ids (clients + drivers)
    var profileIds = [];
    _arAllRides.forEach(function(r){
      if(r.client_id) profileIds.push(r.client_id);
      if(r.driver_id) profileIds.push(r.driver_id);
    });
    profileIds = [...new Set(profileIds)].filter(Boolean);

    if(profileIds.length > 0){
      var { data: pData } = await sb.from('profiles').select('id,first_name,last_name,company_name,client_type,role,email').in('id', profileIds);
      _arProfiles = {};
      (pData||[]).forEach(function(p){ _arProfiles[p.id] = p; });
    } else {
      _arProfiles = {};
    }

    // Populate client & driver dropdowns (once)
    _arPopulateDropdowns();

    // Fetch ratings for all rides
    var rideIds = _arAllRides.map(function(r){ return r.id; });
    var _arRatings = {}; // rideId -> {score, comment}
    if(rideIds.length > 0){
      var { data: ratData } = await sb.from('ratings').select('ride_id,score,comment').in('ride_id', rideIds);
      (ratData||[]).forEach(function(rt){ _arRatings[rt.ride_id] = rt; });
    }
    window._arRatings = _arRatings;

    // Apply client/driver filter (client-side after fetch)
    var clientVal = document.getElementById('ar-filter-client')?.value || '';
    var driverVal = document.getElementById('ar-filter-driver')?.value || '';
    var filtered = _arAllRides.filter(function(r){
      if(clientVal && r.client_id !== clientVal) return false;
      if(driverVal && r.driver_id !== driverVal) return false;
      return true;
    });

    _arRenderTable(filtered, el);
  } catch(e) {
    el.innerHTML = '<div class="page-loading" style="color:var(--red);">Erreur : '+e.message+'</div>';
  }
};

function _arPopulateDropdowns(){
  var clientSel = document.getElementById('ar-filter-client');
  var driverSel = document.getElementById('ar-filter-driver');
  if(!clientSel || !driverSel) return;
  var prevClient = clientSel.value, prevDriver = driverSel.value;

  var clients = {}, drivers = {};
  _arAllRides.forEach(function(r){
    if(r.client_id && _arProfiles[r.client_id]) clients[r.client_id] = _arProfiles[r.client_id];
    if(r.driver_id && _arProfiles[r.driver_id]) drivers[r.driver_id] = _arProfiles[r.driver_id];
  });

  clientSel.innerHTML = '<option value="">Tous les clients</option>'
    + Object.values(clients).map(function(p){
        var name = _arDisplayName(p);
        return '<option value="'+p.id+'"'+(prevClient===p.id?' selected':'')+'>'+name+'</option>';
      }).join('');

  driverSel.innerHTML = '<option value="">Toutes les fleets</option>'
    + Object.values(drivers).map(function(p){
        var name = _arDisplayName(p);
        return '<option value="'+p.id+'"'+(prevDriver===p.id?' selected':'')+'>'+name+'</option>';
      }).join('');
}

function _arDisplayName(p){
  if(!p) return '—';
  var person=((p.first_name||'')+' '+(p.last_name||'')).trim();
  if(p.role==='driver' || p.client_type==='pro') return p.company_name || person || p.email || '—';
  return person || p.company_name || p.email || '—';
}
function _arName(profileId){
  return _arDisplayName(_arProfiles[profileId]);
}

function _arRenderTable(rides, el){
  if(!rides.length){
    el.innerHTML = '<div class="empty-state"><p class="empty-text">Aucune course trouvée</p></div>';
    return;
  }

  var typeLabel = function(t){ return t==='disposal'?'Disposition':t==='mixed'?'Mixte':'A → B'; };
  var typeBg    = function(t){ return t==='disposal'?'var(--amber-bg)':t==='mixed'?'var(--blue-bg)':'var(--green-bg)'; };
  var typeColor = function(t){ return t==='disposal'?'var(--amber)':t==='mixed'?'var(--blue)':'var(--green)'; };

  var statusLabel = {
    waiting:'En attente', offers:'Offres reçues', pending_payment:'Paiement en cours',
    confirmed:'Confirmée', active:'En cours', done:'Terminée', cancelled:'Annulée'
  };
  var statusBg = {
    waiting:'var(--amber-bg)',   offers:'var(--blue-bg)',    pending_payment:'#EAF1FB',
    confirmed:'var(--green-bg)', active:'var(--green-bg)',   done:'var(--sand2)', cancelled:'var(--red-bg)'
  };
  var statusColor = {
    waiting:'var(--amber)',   offers:'var(--blue)',    pending_payment:'#1E4D7B',
    confirmed:'var(--green)', active:'var(--green)',   done:'var(--ink4)', cancelled:'var(--red)'
  };

  var rows = rides.map(function(r){
    var dateStr = r.ride_date ? new Date(r.ride_date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    var tBg=typeBg(r.trip_type), tCol=typeColor(r.trip_type), tLbl=typeLabel(r.trip_type);
    var sBg=statusBg[r.status]||'var(--sand2)', sCol=statusColor[r.status]||'var(--ink4)', sLbl=statusLabel[r.status]||r.status;
    var clientName = _arName(r.client_id);
    var driverName = r.driver_id ? _arName(r.driver_id) : '—';
    var price = r.final_price ? parseFloat(r.final_price).toFixed(2).replace('.',',')+' €' : '—';
    var code = r.booking_code || '—';
    var rating = window._arRatings && window._arRatings[r.id];
    var ratingHtml = rating
      ? '<span style="color:#F5B100;letter-spacing:1px;">'+('★').repeat(rating.score)+('☆').repeat(5-rating.score)+'</span><span style="font-size:11px;color:var(--ink3);margin-left:4px;">'+rating.score+'/5</span>'
      : '<span style="font-size:11px;color:var(--ink4);">—</span>';
    // Subcontract icon
    var subIcon = r.is_subcontract
      ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--amber-bg);color:var(--amber);margin-left:3px;flex-shrink:0;" title="Sous-traitée"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>'
      : '';
    var safeR = JSON.stringify(r).replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    var refundBadge = ((r.status==='cancelled' && r.final_price && r.payment_method && r.payment_method!=='refunded' && r.payment_method!=='non_refundable') || (r.status!=='cancelled' && _partialRefund(r)>0))
      ? '<span style="font-size:10px;font-weight:700;background:var(--red-bg);color:var(--red);padding:2px 7px;border-radius:20px;margin-left:4px;white-space:nowrap;">⚠ Remb.</span>'
      : '';

    return '<tr style="border-bottom:1px solid var(--sand2);cursor:pointer;transition:background .15s;" onclick="arOpenDetail(this)" data-ride=\''+safeR+'\' onmouseenter="this.style.background=\'var(--sand)\'" onmouseleave="this.style.background=\'\'">'
      +'<td style="padding:10px 14px;font-size:12.5px;color:var(--ink3);white-space:nowrap;">'+dateStr+'</td>'
      +'<td style="padding:10px 14px;"><div style="display:flex;align-items:center;gap:2px;"><span style="font-size:10px;font-weight:700;background:'+tBg+';color:'+tCol+';padding:2px 8px;border-radius:20px;white-space:nowrap;">'+tLbl+'</span>'+subIcon+'</div></td>'
      +'<td style="padding:10px 14px;font-size:12px;font-family:monospace;font-weight:600;color:var(--ink2);">'+code+'</td>'
      +'<td style="padding:10px 14px;font-size:13px;font-weight:500;">'+_rdEsc(clientName)+'</td>'
      +'<td style="padding:10px 14px;font-size:13px;">'+driverName+'</td>'
      +'<td style="padding:10px 14px;"><div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;"><span style="font-size:11px;font-weight:600;background:'+sBg+';color:'+sCol+';padding:3px 9px;border-radius:20px;white-space:nowrap;">'+sLbl+'</span>'+refundBadge+'</div></td>'
      +(function(){var pm=r.payment_method||''; var pmMap={'stripe':'💳 Stripe','bank_transfer':'🏦 Virement','non_refundable':'Non remb.','refunded':'✅ Remboursé','cash':'💵 Cash'};var pmLabel=pmMap[pm]||(pm||'—'); return '<td style="padding:10px 14px;font-size:12px;color:var(--ink3);white-space:nowrap;">'+pmLabel+'</td>'; })()
      +'<td style="padding:10px 14px;font-size:13px;font-weight:600;text-align:right;white-space:nowrap;">'+price+'</td>'
      +'<td style="padding:10px 14px;white-space:nowrap;">'+ratingHtml+'</td>'
    +'</tr>';
  }).join('');

  el.innerHTML = '<div class="card" style="overflow:hidden;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:760px;">'
    +'<thead><tr style="background:var(--sand2);">'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Date</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Type</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Code</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Client</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Fleet</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Statut</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Paiement</th>'
      +'<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Prix</th>'
      +'<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);">Note</th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody>'
  +'</table></div></div>';
}

window.arOpenDetail = async function(row){
  var r; try{ r=JSON.parse(row.dataset.ride.replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')); }catch(e){ return; }
  window._lastArRide=r;

  // Build detail body using shared helper
  var result = _buildRideDetailBody(r, {idPrefix:'ar-', showStatus:false});
  var body = result.html;

  // Extra info: client, driver, price, code
  var infoRows = '';
  if(r.booking_code) infoRows += '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--sand2);"><span style="font-size:12px;color:var(--ink3);">Code</span><span style="font-size:12px;font-weight:700;font-family:monospace;">'+r.booking_code+'</span></div>';
  var clientName = _arName(r.client_id);
  var driverName = r.driver_id ? _arName(r.driver_id) : '—';
  if(clientName!=='—') infoRows += '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--sand2);"><span style="font-size:12px;color:var(--ink3);">Client</span><span style="font-size:12px;font-weight:600;" id="ar-client-name-row">'+_rdEsc(clientName)+'</span></div>';
  infoRows += '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--sand2);"><span style="font-size:12px;color:var(--ink3);">Fleet</span><span style="font-size:12px;font-weight:600;" id="ar-driver-name-row">'+driverName+'</span></div>';
  if(r.payment_method){
    var pmMap={'stripe':'💳 Stripe','bank_transfer':'🏦 Virement bancaire','non_refundable':'Non remboursable','refunded':'✅ Remboursé','cash':'💵 Espèces'};
    var pmLabel = pmMap[r.payment_method]||r.payment_method;
    infoRows += '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--sand2);"><span style="font-size:12px;color:var(--ink3);">Paiement</span><span style="font-size:12px;font-weight:600;">'+pmLabel+'</span></div>';
  }

  if(r.final_price){
    var _pr = await _ridePrice(r);
    var tvac = _pr.tvac, htva = _pr.htva, tvaAmt = _pr.tva;
    var _cp = await _commPctForDriver(r.driver_id);
    var commission = parseFloat((htva * _cp / 100).toFixed(2));
    var driverNet = parseFloat((htva - commission).toFixed(2));
    var fmt = function(v){ return v.toFixed(2).replace('.',',')+' €'; };
    // Ordre : prix HTVA, commission, total (net chauffeur), TVA, total TVAC
    infoRows += '<div style="padding:7px 0;border-bottom:1px solid var(--sand2);">'
      +'<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:6px;">Détail du prix</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span style="color:var(--ink3);">Prix HTVA</span><span>'+fmt(htva)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span style="color:var(--ink3);">Commission plateforme ('+_pctTxt(_cp)+' %)</span><span style="color:var(--red);">− '+fmt(commission)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span style="color:var(--ink3);">Total</span><span style="color:var(--green);font-weight:600;">'+fmt(driverNet)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span style="color:var(--ink3);">TVA '+_pr.pct+'%</span><span>'+fmt(tvaAmt)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;padding:5px 0 2px;border-top:1px solid var(--sand3);margin-top:4px;"><span>Total TVAC</span><span>'+fmt(tvac)+'</span></div>'
    +'</div>';
  }

  var ratingData = window._arRatings && window._arRatings[r.id];
  if(ratingData){
    var stars = ('★').repeat(ratingData.score)+('☆').repeat(5-ratingData.score);
    var ratingHtml2 = '<span style="color:#F5B100;font-size:15px;letter-spacing:2px;">'+stars+'</span> <span style="font-size:12px;font-weight:600;color:var(--ink2);">'+ratingData.score+'/5</span>';
    if(ratingData.comment) ratingHtml2 += '<div style="font-size:12px;color:var(--ink3);font-style:italic;margin-top:3px;">«\u00a0'+ratingData.comment+'\u00a0»</div>';
    infoRows += '<div style="padding:7px 0;"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="font-size:12px;color:var(--ink3);">Évaluation client</span><div style="text-align:right;">'+ratingHtml2+'</div></div></div>';
  }

  body += '<div style="margin-top:14px;background:var(--sand2);border-radius:var(--r);padding:4px 12px;">'+infoRows+'</div>';

  // Offers section placeholder — appended LAST so it doesn't get overwritten
  if(r.status === 'offers' || r.status === 'waiting'){
    body += '<div>'
      +'<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:10px;">Offres reçues</div>'
      +'<div id="ar-offers-container"><div style="font-size:13px;color:var(--ink3);">Chargement…</div></div>'
    +'</div>';
  }

  // Footer
  var footerHtml = '<button class="btn btn-secondary" onclick="closeModal(\'m-ar-detail\')">Fermer</button>';
  if(r.status === 'pending_payment'){
    // Build bank transfer info block
    var tvacPend = r.final_price ? parseFloat(r.final_price).toFixed(2).replace('.',',')+' €' : '—';
    var bankRef = r.booking_code || 'BLEENR';
    body += '<div style="padding:14px 16px;background:#EAF1FB;border-radius:var(--r);border:1.5px solid #1E4D7B22;">'
      +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;color:#1E4D7B;">'
        +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg>'
        +'<span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Virement bancaire en attente</span>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:130px 1fr;gap:4px 12px;font-size:12.5px;line-height:1.9;">'
        +'<span style="color:var(--ink3);">Bénéficiaire</span><span style="font-weight:600;">DISPOSAL SRL</span>'
        +'<span style="color:var(--ink3);">IBAN</span><span style="font-weight:600;font-family:monospace;">BE68 5390 0754 7034</span>'
        +'<span style="color:var(--ink3);">BIC / SWIFT</span><span style="font-weight:600;font-family:monospace;">TRIOBEBB</span>'
        +'<span style="color:var(--ink3);">Communication</span><span style="font-weight:700;font-family:monospace;color:#1E4D7B;">'+bankRef+'</span>'
        +'<span style="color:var(--ink3);">Montant attendu</span><span style="font-weight:700;color:var(--green);">'+tvacPend+'</span>'
      +'</div>'
    +'</div>';
    footerHtml = '<button class="btn btn-secondary" onclick="closeModal(\'m-ar-detail\')">Fermer</button>'
      +'<button class="btn btn-green" onclick="adminConfirmPayment(\''+r.id+'\')" style="margin-left:8px;">✓ Confirmer le paiement</button>';
  } else if(r.status === 'cancelled' && r.final_price && r.payment_method && r.payment_method !== 'non_refundable'){
    var refundAmt = (parseFloat(r.final_price) + _partialRefund(r)).toFixed(2).replace('.',',');
    var isRefundBank   = r.payment_method === 'bank_transfer';
    var isRefundStripe = r.payment_method === 'stripe';
    var refundMethod   = isRefundBank ? 'Virement bancaire' : isRefundStripe ? 'Stripe' : r.payment_method;
    var refundNote     = isRefundStripe ? '<div style="font-size:11px;color:var(--ink3);margin-top:4px;">Remboursement intégral du montant payé (dans Stripe : Rembourser le paiement).</div>' : '';
    body += '<div style="padding:14px 16px;background:var(--red-bg);border-radius:var(--r);border:1.5px solid var(--red)22;">'
      +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;color:var(--red);">'
        +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'
        +'<span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Remboursement à effectuer</span>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:130px 1fr;gap:4px 12px;font-size:12.5px;line-height:1.9;">'
        +'<span style="color:var(--ink3);">Mode</span><span style="font-weight:600;">'+refundMethod+'</span>'
        +'<span style="color:var(--ink3);">Montant TVAC</span><span style="font-weight:700;color:var(--red);">'+refundAmt+' €</span>'
      +'</div>'
      +refundNote
    +'</div>';
    footerHtml = '<button class="btn btn-secondary" onclick="closeModal(\'m-ar-detail\')">Fermer</button>'
      +'<button class="btn btn-danger" onclick="adminMarkRefunded(\''+r.id+'\')" style="margin-left:8px;">✓ Remboursement effectué</button>';
  } else if(_partialRefund(r) > 0){
    // Prix revu à la baisse par le chauffeur après une modification du client : remboursement partiel
    var pAmt=_partialRefund(r).toFixed(2).replace('.',',');
    body += '<div style="padding:14px 16px;background:var(--red-bg);border-radius:var(--r);border:1.5px solid var(--red)22;">'
      +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;color:var(--red);"><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Remboursement partiel à effectuer</span></div>'
      +'<div style="display:grid;grid-template-columns:130px 1fr;gap:4px 12px;font-size:12.5px;line-height:1.9;">'
        +'<span style="color:var(--ink3);">Mode</span><span style="font-weight:600;">'+(r.payment_method==='bank_transfer'?'Virement bancaire':'Stripe')+'</span>'
        +'<span style="color:var(--ink3);">Montant TVAC</span><span style="font-weight:700;color:var(--red);">'+pAmt+' €</span>'
        +'<span style="color:var(--ink3);">Nouveau prix</span><span style="font-weight:600;">'+parseFloat(r.final_price||0).toFixed(2).replace('.',',')+' € TVAC</span>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--ink3);margin-top:4px;">Le chauffeur a revu son prix à la baisse après une modification du client (dans Stripe : remboursement partiel du paiement).</div>'
    +'</div>';
    footerHtml = '<button class="btn btn-secondary" onclick="closeModal(\'m-ar-detail\')">Fermer</button>'
      +'<button class="btn btn-danger" onclick="adminMarkPartialRefunded(\''+r.id+'\')" style="margin-left:8px;">✓ Remboursement partiel effectué</button>';
  }

  var subIcon2 = r.is_subcontract
    ? ' <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--amber-bg);color:var(--amber);vertical-align:middle;margin-left:4px;" title="Sous-traitée"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>'
    : '';
  var titleEl = document.getElementById('ar-detail-title');
  var bodyEl  = document.getElementById('ar-detail-body');
  var ftEl    = document.getElementById('ar-detail-ft');
  var subtitleMap = {disposal:'Mise à disposition', mixed:'Course mixte', ab:'Course A → B'};
  var subTitle = subtitleMap[r.trip_type]||'Course';
  if(titleEl) titleEl.innerHTML = (r.booking_code ? r.booking_code+' — '+subTitle : subTitle) + subIcon2 + ' '+getStatusPill(r.status,0);
  if(bodyEl)  bodyEl.innerHTML  = body;
  if(r.status==='active' || (r.status==='confirmed' && r.on_way_at)) footerHtml += '<button class="btn btn-green" style="margin-left:8px;" onclick="closeModal(\'m-ar-detail\');openLiveTracking(\''+String(r.id).replace(/'/g,'')+'\')">Suivre en direct</button>';
  if(ftEl)    ftEl.innerHTML    = footerHtml;

  // Fetch client phone for admin popup
  if(r.client_id && sb){
    sb.from('profiles').select('phone').eq('id',r.client_id).maybeSingle().then(function(res){
      if(!res.data || !res.data.phone) return;
      var nameEl = document.getElementById('ar-client-name-row');
      if(nameEl) nameEl.innerHTML = nameEl.textContent + ' <span style="font-weight:400;color:var(--ink3);margin-left:6px;">· <a href="tel:'+res.data.phone+'" style="color:var(--blue);text-decoration:none;">'+res.data.phone+'</a></span>';
    });
  }

  // Fetch driver phone + vehicle plate for admin popup
  if(r.driver_id && sb){
    sb.from('profiles').select('phone').eq('id',r.driver_id).maybeSingle().then(function(profRes){
      sb.from('offers').select('vehicle_id').eq('ride_id',r.id).eq('driver_id',r.driver_id).eq('status','accepted').maybeSingle().then(function(offerRes){
        var phone = profRes.data?.phone||'';
        var vehId = offerRes.data?.vehicle_id||'';
        if(!vehId){
          var driverEl = document.getElementById('ar-driver-name-row');
          if(driverEl && phone) driverEl.innerHTML = driverEl.textContent + ' <span style="font-weight:400;color:var(--ink3);margin-left:6px;">· <a href="tel:'+phone+'" style="color:var(--blue);text-decoration:none;">'+phone+'</a></span>';
          return;
        }
        sb.from('fleet_vehicles').select('plate').eq('id',vehId).maybeSingle().then(function(vehRes){
          var plate = vehRes.data?.plate||'';
          var driverEl = document.getElementById('ar-driver-name-row');
          if(!driverEl) return;
          var extra = '';
          if(phone) extra += ' · <a href="tel:'+phone+'" style="color:var(--blue);text-decoration:none;">'+phone+'</a>';
          if(plate) extra += ' · <span style="font-family:monospace;">'+plate+'</span>';
          if(extra) driverEl.innerHTML = driverEl.textContent + ' <span style="font-weight:400;color:var(--ink3);margin-left:6px;">'+extra+'</span>';
        });
      });
    });
  }

  openModal('m-ar-detail');
  _triggerDistanceMatrix(r, result, 'ar-');

  // Now fetch and inject offers (DOM is ready) — show for any status that could have offers
  if((r.status === 'offers' || r.status === 'waiting') && sb){
    try {
      // Fetch ALL offers for this ride (same query as client openOffersModal)
      var { data: offersData, error: ofErr } = await sb.from('offers')
        .select('id,ride_id,driver_id,price,message,status,vehicle_id,created_at')
        .eq('ride_id', r.id)
        .order('price',{ascending:true});
      if(ofErr) throw ofErr;

      var offerDriverIds = [...new Set((offersData||[]).map(function(o){ return o.driver_id; }).filter(Boolean))];
      var offerDriverMap = {};
      if(offerDriverIds.length > 0){
        var {data:dProfiles} = await sb.from('profiles').select('id,first_name,last_name,rating,rating_count').in('id', offerDriverIds);
        (dProfiles||[]).forEach(function(p){ offerDriverMap[p.id] = p; });
      }
      var vehIds = [...new Set((offersData||[]).map(function(o){ return o.vehicle_id; }).filter(Boolean))];
      var vehMap = {};
      if(vehIds.length > 0){
        var {data:vData} = await sb.from('fleet_vehicles').select('id,brand,model,vehicle_class').in('id', vehIds);
        (vData||[]).forEach(function(v){ vehMap[v.id] = v; });
      }

      var container = document.getElementById('ar-offers-container');
      if(!container) return;

      if(!offersData || !offersData.length){
        container.innerHTML = '<div style="font-size:13px;color:var(--ink4);font-style:italic;">Aucune offre enregistrée pour cette demande</div>';
        return;
      }

      // Filter out rejected offers for display
      var visibleOffers = offersData.filter(function(o){ return o.status !== 'rejected'; });
      if(!visibleOffers.length){
        container.innerHTML = '<div style="font-size:13px;color:var(--ink4);font-style:italic;">Toutes les offres ont été rejetées ('+offersData.length+')</div>';
        return;
      }

      var classLabels = {lowcost:'ECO',business:'BUSINESS',van:'VAN',luxe:'LUXE',bus:'BUS'};
      var classColors = {lowcost:'#6B8E23',business:'#1B5E3B',van:'#2E6B4A',luxe:'#8B0000',bus:'#B8860B'};

      container.innerHTML = visibleOffers.map(function(o){
        var dp = offerDriverMap[o.driver_id] || {};
        var dName = ((dp.first_name||'')+' '+(dp.last_name||'')).trim() || '—';
        var dRating = dp.rating ? dp.rating.toFixed(1)+' ★ ('+dp.rating_count+' avis)' : 'Pas encore noté';
        var htva = parseFloat(o.price||0);
        var tvacO = (htva*(1+TVA_RATE)).toFixed(2).replace('.',',');
        var veh = vehMap[o.vehicle_id];
        var vehLine = veh
          ? '<div style="margin-bottom:4px;">'
            +'<span style="font-size:9px;font-weight:700;background:'+(classColors[veh.vehicle_class]||'#888')+';color:#fff;padding:1px 6px;border-radius:4px;margin-right:5px;">'+(classLabels[veh.vehicle_class]||'').toUpperCase()+'</span>'
            +'<span style="font-size:12.5px;font-weight:600;">'+(veh.brand||'')+' '+(veh.model||'')+'</span>'
          +'</div>'
          : '';
        var statusBadge = o.status==='accepted'
          ? '<div style="margin-top:6px;"><span style="font-size:10px;font-weight:700;background:var(--green-bg);color:var(--green);padding:2px 8px;border-radius:20px;">✓ Acceptée</span></div>'
          : '';
        return '<div style="background:var(--white);border:1.5px solid var(--sand3);border-radius:var(--r);padding:12px 14px;margin-bottom:8px;">'
          +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
            +'<div style="flex:1;">'
              +'<div style="font-weight:600;font-size:13.5px;margin-bottom:2px;">'+dName+'</div>'
              +'<div style="font-size:11.5px;color:var(--amber);margin-bottom:6px;">'+dRating+'</div>'
              +vehLine
              +(o.message?'<div style="font-size:12px;color:var(--ink3);font-style:italic;">'+_rdEsc(o.message)+'</div>':'')
              +statusBadge
            +'</div>'
            +'<div style="text-align:right;flex-shrink:0;">'
              +'<div style="font-size:22px;font-weight:700;color:var(--ink);line-height:1;">'+tvacO+' €</div>'
              +'<div style="font-size:11px;color:var(--ink3);">'+htva.toFixed(2).replace('.',',')+' € HTVA</div>'
            +'</div>'
          +'</div>'
        +'</div>';
      }).join('');
    } catch(e){
      var c2 = document.getElementById('ar-offers-container');
      if(c2) c2.innerHTML = '<div style="font-size:13px;color:var(--red);">Erreur Supabase : '+e.message+'<br><small>Vérifier les politiques RLS sur la table <code>offers</code> pour le rôle admin.</small></div>';
      console.error('arOpenDetail offers error:', e);
    }
  }
};

window.adminMarkRefunded = async function(rideId){
  if(!sb) return;
  var btn = document.querySelector('#ar-detail-ft .btn-danger');
  if(btn){ btn.disabled=true; btn.textContent='Traitement…'; }
  try {
    // Mark ride as refunded by clearing final_price (or add a refunded flag if available)
    var { error } = await sb.rpc('api_admin_save',{ p_table:'rides', p_id:rideId, p_data:{payment_method:'refunded', refund_done_at:new Date().toISOString()} });
    if(error) throw error;
    closeModal('m-ar-detail');
    showToast('✅ Remboursement marqué comme effectué');
    await loadAdminRides();
    await refreshAdminDashboard();
  } catch(e) {
    showToast('Erreur : '+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent='✓ Remboursement effectué'; }
  }
};

// Remboursement partiel en attente (prix revu à la baisse) : montant TVAC
function _partialRefund(r){ return r && !r.refund_done_at ? (parseFloat(r.refund_due)||0) : 0; }
window.adminMarkPartialRefunded = async function(rideId){
  if(!sb) return;
  var btn = document.querySelector('#ar-detail-ft .btn-danger');
  if(btn){ btn.disabled=true; btn.textContent='Traitement…'; }
  try {
    var { error } = await sb.rpc('api_admin_save',{ p_table:'rides', p_id:rideId, p_data:{ refund_done_at:new Date().toISOString() } });
    if(error) throw error;
    closeModal('m-ar-detail');
    showToast('✅ Remboursement partiel marqué comme effectué');
    await loadAdminRides();
    await refreshAdminDashboard();
  } catch(e) {
    showToast('Erreur : '+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent='✓ Remboursement partiel effectué'; }
  }
};
window.adminConfirmPayment = async function(rideId){
  if(!sb) return;
  var btn = document.querySelector('#ar-detail-ft .btn-green');
  if(btn){ btn.disabled=true; btn.textContent='Confirmation…'; }
  try {
    var { error } = await sb.rpc('api_admin_save',{ p_table:'rides', p_id:rideId, p_data:{status:'confirmed'} });
    if(error) throw error;
    _notifyRideConfirmed(rideId);
    closeModal('m-ar-detail');
    showToast('✅ Paiement confirmé — course confirmée');
    await loadAdminRides();
  } catch(e) {
    showToast('Erreur : '+(e.message||e));
    if(btn){ btn.disabled=false; btn.textContent='✓ Confirmer le paiement'; }
  }
};

window.refreshAdminDashboard = async function() {
  if(!sb) return;
  try {
    var fromDate = null, toDate = null;
    if(_adminDashPeriod === 'custom') {
      fromDate = document.getElementById('admin-date-from')?.value || null;
      toDate   = document.getElementById('admin-date-to')?.value   || null;
    }

    // Query clients and fleets (all time for top stats)
    var [clientsRes, fleetsRes, ridesRes] = await Promise.all([
      sb.from('profiles').select('id', {count:'exact',head:true}).eq('role','client'),
      sb.from('profiles').select('id', {count:'exact',head:true}).eq('role','driver'),
      sb.from('rides').select('id,final_price,ride_date,status,is_subcontract,payment_method,refund_due,refund_done_at')
    ]);

    var totalClients = clientsRes.count || 0;
    var totalFleets  = fleetsRes.count  || 0;
    var allRides     = ridesRes.data    || [];

    // All-time totals for top stat cards
    // Courses réellement effectuées (statut « terminée »)
    // (hors sous-traitances : Bleenr ne prend pas de commission dessus)
    var totalRides = allRides.filter(function(r){ return r.status==='done' && !r.is_subcontract; }).length;
    // Revenue = money actually received and kept: confirmed / in progress / done rides,
    // plus cancelled rides that are not refundable. Bank transfers awaiting the admin's
    // confirmation (pending_payment) are NOT counted until the admin confirms them.
    var _isRevenue = function(r){
      if(r.is_subcontract || !r.final_price) return false;
      if(r.status==='confirmed' || r.status==='active' || r.status==='done') return true;
      return r.status==='cancelled' && r.payment_method==='non_refundable';
    };
    var totalCA    = allRides.filter(_isRevenue).reduce(function(s,r){ return s + parseFloat(r.final_price); }, 0);

    // Set top stat cards
    var set = function(id,val){ var el=document.getElementById(id); if(el) el.textContent=val; };
    set('admin-stat-clients', totalClients);
    set('admin-stat-fleets',  totalFleets);
    set('admin-stat-rides',   totalRides);
    // Bank transfers waiting for the admin's payment confirmation
    var _pendingPay = allRides.filter(function(r){ return r.status==='pending_payment'; }).length;
    var _ppEl = document.getElementById('admin-stat-rides-pending');
    if(_ppEl){
      _ppEl.textContent = _pendingPay+' course'+(_pendingPay>1?'s':'')+' en attente de confirmation de paiement';
      _ppEl.style.display = _pendingPay>0 ? 'block' : 'none';
    }
    // CA de Bleenr = commission plateforme (Admin › Facturation) sur le montant HTVA des courses
    var _cpTop = parseFloat(await _commPct('BE'))||0;
    var totalComm = Math.round(totalCA / (1 + TVA_RATE) * _cpTop) / 100;
    set('admin-stat-ca',      totalComm > 0 ? totalComm.toFixed(2).replace('.',',')+' €' : '0,00 €');
    set('admin-stat-ca-rate', '· '+_pctTxt(_cpTop)+' %');

    // Filtered rides for summary cards
    var filteredRides = allRides.filter(function(r) {
      if(!fromDate && !toDate) return true;
      var d = r.ride_date;
      if(!d) return false;
      if(fromDate && d < fromDate) return false;
      if(toDate   && d > toDate)   return false;
      return true;
    });

    var periodRides = filteredRides.filter(_isRevenue);
    var periodTvac   = periodRides.reduce(function(s,r){ return s + parseFloat(r.final_price); }, 0);
    var periodHtva   = parseFloat((periodTvac / (1 + TVA_RATE)).toFixed(2));
    var periodTva    = parseFloat((periodTvac - periodHtva).toFixed(2));
    var _cpA = parseFloat(await _commPct('BE'))||0;
    var periodProfit = parseFloat((periodHtva * _cpA / 100).toFixed(2));
    var periodDriver = parseFloat((periodHtva - periodProfit).toFixed(2));

    // Refundable = cancelled + paid + not subcontract + not yet refunded
    var refundRides = filteredRides.filter(function(r){ return r.status==='cancelled' && r.final_price && !r.is_subcontract && r.payment_method && r.payment_method!=='refunded' && r.payment_method!=='non_refundable'; });
    var refundBank   = refundRides.filter(function(r){ return r.payment_method==='bank_transfer'; }).reduce(function(s,r){ return s+parseFloat(r.final_price); },0);
    var refundStripe = refundRides.filter(function(r){ return r.payment_method==='stripe'; }).reduce(function(s,r){ return s+parseFloat(r.final_price); },0);
    // + remboursements partiels (prix revu à la baisse) encore à faire
    filteredRides.forEach(function(r){ var pr=_partialRefund(r); if(pr>0 && !(r.status==='cancelled' && r.payment_method==='refunded')){ if(r.payment_method==='bank_transfer') refundBank+=pr; else refundStripe+=pr; } });
    var refundTotal  = refundBank + refundStripe;

    var fmt = function(v){ return v > 0 ? v.toFixed(2).replace('.',',')+' €' : '0,00 €'; };

    // Update period labels
    var periodLbl = '';
    if(_adminDashPeriod === 'custom' && (fromDate || toDate)){
      periodLbl = (fromDate||'…')+' → '+(toDate||'…');
    }
    var lblEl = document.getElementById('admin-sum-period-label');
    if(lblEl) lblEl.textContent = periodLbl;
    var lblEl2 = document.getElementById('admin-sum-refund-period-label');
    if(lblEl2) lblEl2.textContent = periodLbl;

    set('admin-sum-htva',          fmt(periodHtva));
    set('admin-sum-tva',           fmt(periodTva));
    set('admin-sum-ca',            fmt(periodTvac));
    set('admin-sum-profit',        fmt(periodProfit));
    set('admin-sum-tva-lbl',       'TVA '+_pctTxt(Math.round(TVA_RATE*1000)/10)+' %');
    set('admin-sum-profit-lbl',    'Commission plateforme ('+_pctTxt(_cpA)+' %)');
    set('admin-sum-driver-lbl',    'Revenu chauffeurs ('+_pctTxt(Math.round((100-_cpA)*100)/100)+' %)');
    set('admin-sum-driver',        fmt(periodDriver));
    set('admin-sum-refund-bank',   refundBank   > 0 ? '− '+fmt(refundBank)   : '0,00 €');
    set('admin-sum-refund-stripe', refundStripe > 0 ? '− '+fmt(refundStripe) : '0,00 €');
    set('admin-sum-refund-total',  refundTotal  > 0 ? '− '+fmt(refundTotal)  : '0,00 €');
    set('admin-sum-fleets',  totalFleets);
  } catch(e) {
    console.error('loadAdminDashboard error', e);
  }
};

async function loadAdminDashboard() {
  _loadAdminLive();
  await refreshAdminDashboard();
}

window.showPage_passengers_hook = async function(){
  await loadPassengersList();
};
