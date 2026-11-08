// ── I18N ──────────────────────────────────────────────
const TX = {
  fr:{ dashboard:'Tableau de bord', rides:'Mes demandes', invoices:'Factures', profile:'Profil',
       'd-dashboard':'Tableau de bord', marketplace:'Marketplace', missions:'Mes missions',
       client:'Client', driver:'Fleet',
       waiting:'En attente', offers_pill:'offres', offer_submitted:'Offre soumise', confirmed:'● Confirmée',
       active:'● En cours', done:'Terminée', cancelled:'Annulée',
       toast_ride:'✅ Demande publiée !', toast_ride_edit:'✅ Demande modifiée !', toast_offer:'✅ Offre envoyée !',
       toast_offer_acc:'🎉 Chauffeur confirmé !', toast_saved:'✅ Sauvegardé',
       toast_rated:'⭐ Merci pour votre évaluation !', toast_subcontract:'✅ Mission publiée',
       toast_signout:'À bientôt !', toast_copy:'📋 Lien copié',
       toast_reset_sent:'📧 Un lien de réinitialisation a été envoyé à {email}', toast_pwd_updated:'✅ Mot de passe mis à jour avec succès',
       err_required:'Veuillez remplir les champs obligatoires',
       err_auth:'Email ou mot de passe incorrect',
       err_exists:'Un compte existe déjà avec cet email',
       mk_client_label:'Client', mk_sub_label:'Sous-traitance',
       empty_rides:'Aucune demande', empty_offers:'Aucune offre reçue',
       empty_marketplace:'Aucune demande disponible',
       total_month:'Total ce mois', rides_month:'Courses ce mois',
       pending_offers:'En attente d\'offres', fav_drivers:'Chauffeurs favoris',
       missions_month:'Missions ce mois', revenue:'Revenus HT', score:'Score', acceptance:'Taux acceptation',
       upcoming_missions:'Missions à venir',
       new_requests:'Nouvelles demandes', my_score:'Mon score',
       recent_rides:'Demandes récentes', see_all:'Voir tout →',
       btn_offer:'Soumettre une offre', btn_accept:'Accepter', btn_choose:'Choisir',
       invoice_vat:'TVA', download_pdf:'PDF ↓',
       auth_login:'Connexion', auth_register:'Inscription', auth_you_are:'Vous êtes', auth_client_desc:'Je réserve des courses', auth_fleet_desc:'Je propose mes services', auth_or:'ou', auth_email:'Email', auth_phone:'Téléphone', auth_continue_google:'Continuer avec Google', auth_continue_apple:'Continuer avec Apple', auth_continue_ms:'Continuer avec Microsoft', auth_email_label:'Adresse email', auth_pwd_label:'Mot de passe', auth_pwd2_label:'Confirmer le mot de passe', err_pwd_match:'Les mots de passe ne correspondent pas', err_pwd_short:'Mot de passe trop court (min. 6 caractères)', auth_pro_client:'Client professionnel', auth_fname:'Prénom', auth_lname:'Nom', auth_company:'Nom de société', auth_phone_label:'Numéro de téléphone', auth_create:'Créer le compte →', auth_continue:'Continuer →', auth_send_code:'Envoyer le code →', auth_signin:'S\'inscrire →', auth_tagline:'Plateforme de transport privé', auth_vat:'N° de TVA (optionnel)', auth_forgot_pwd:'Mot de passe oublié ?', auth_reset_title:'Réinitialiser le mot de passe', auth_reset_desc:'Entrez votre adresse email pour recevoir un lien de réinitialisation.', auth_new_pwd_title:'Nouveau mot de passe', auth_new_pwd_desc:'Choisissez un nouveau mot de passe pour votre compte.', auth_new_pwd_label:'Nouveau mot de passe', auth_new_pwd2_label:'Confirmer le mot de passe',
       active_ride:'Course en cours', eta:'Arrivée estimée',
       new_ride_title:'Nouvelle demande', edit_ride_title:'Modifier la demande',
       btn_publish:'Publier', btn_save:'Enregistrer',
       lbl_depart:'Départ', lbl_arrivee:'Arrivée', lbl_pickup:'Lieu de prise en charge',
       lbl_end_disp:'Fin de disposition', lbl_end_mission:'Fin de mission',
       lbl_return:'Retour au point de départ',
       lbl_segment:'Segment', lbl_close:'Fermer', lbl_delete:'Supprimer', lbl_edit:'Modifier',
       lbl_cancel:'Annuler', lbl_comment:'Instructions',
       title_ab:'Course A → B', title_disp:'Mise à disposition', title_mixed:'Course mixte',
  },
  en:{ dashboard:'Dashboard', rides:'My rides', invoices:'Invoices', profile:'Profile',
       'd-dashboard':'Dashboard', marketplace:'Marketplace', missions:'My missions',
       client:'Client', driver:'Fleet',
       waiting:'Pending', offers_pill:'offers', offer_submitted:'Offer submitted', confirmed:'● Confirmed',
       active:'● In progress', done:'Completed', cancelled:'Cancelled',
       toast_ride:'✅ Request published!', toast_ride_edit:'✅ Request updated!', toast_offer:'✅ Offer sent!',
       toast_offer_acc:'🎉 Driver confirmed!', toast_saved:'✅ Saved',
       toast_rated:'⭐ Thank you for your review!', toast_subcontract:'✅ Mission published',
       toast_signout:'Goodbye!', toast_copy:'📋 Link copied',
       toast_reset_sent:'📧 A reset link has been sent to {email}', toast_pwd_updated:'✅ Password updated successfully',
       err_required:'Please fill in required fields',
       err_auth:'Incorrect email or password',
       err_exists:'An account already exists with this email',
       mk_client_label:'Client', mk_sub_label:'Subcontracting',
       empty_rides:'No requests', empty_offers:'No offers received',
       empty_marketplace:'No requests available',
       total_month:'Total this month', rides_month:'Rides this month',
       pending_offers:'Awaiting offers', fav_drivers:'Favourite drivers',
       missions_month:'Missions this month', revenue:'Revenue', score:'Score', acceptance:'Acceptance rate',
       upcoming_missions:'Upcoming missions',
       new_requests:'New requests', my_score:'My score',
       recent_rides:'Recent requests', see_all:'See all →',
       btn_offer:'Submit offer', btn_accept:'Accept', btn_choose:'Choose',
       invoice_vat:'VAT', download_pdf:'PDF ↓',
       auth_login:'Log in', auth_register:'Sign up', auth_you_are:'You are', auth_client_desc:'I book rides', auth_fleet_desc:'I offer my services', auth_or:'or', auth_email:'Email', auth_phone:'Phone', auth_continue_google:'Continue with Google', auth_continue_apple:'Continue with Apple', auth_continue_ms:'Continue with Microsoft', auth_email_label:'Email address', auth_pwd_label:'Password', auth_pwd2_label:'Confirm password', err_pwd_match:'Passwords do not match', err_pwd_short:'Password too short (min. 6 characters)', auth_pro_client:'Business client', auth_fname:'First name', auth_lname:'Last name', auth_company:'Company name', auth_phone_label:'Phone number', auth_create:'Create account →', auth_continue:'Continue →', auth_send_code:'Send code →', auth_signin:'Sign up →', auth_tagline:'Private transport platform', auth_vat:'VAT number (optional)', auth_forgot_pwd:'Forgot password?', auth_reset_title:'Reset password', auth_reset_desc:'Enter your email address to receive a reset link.', auth_new_pwd_title:'New password', auth_new_pwd_desc:'Choose a new password for your account.', auth_new_pwd_label:'New password', auth_new_pwd2_label:'Confirm password',
       active_ride:'Ride in progress', eta:'Estimated arrival',
       new_ride_title:'New request', edit_ride_title:'Edit request',
       btn_publish:'Publish', btn_save:'Save',
       lbl_depart:'Departure', lbl_arrivee:'Arrival', lbl_pickup:'Pick-up location',
       lbl_end_disp:'End of disposition', lbl_end_mission:'End of mission',
       lbl_return:'Return to departure point',
       lbl_segment:'Segment', lbl_close:'Close', lbl_delete:'Delete', lbl_edit:'Edit',
       lbl_cancel:'Cancel', lbl_comment:'Instructions',
       title_ab:'A → B Ride', title_disp:'Disposition', title_mixed:'Mixed ride',
  },
  es:{ dashboard:'Panel', rides:'Mis trayectos', invoices:'Facturas', profile:'Perfil',
       'd-dashboard':'Panel', marketplace:'Marketplace', missions:'Mis misiones',
       client:'Cliente', driver:'Fleet',
       waiting:'En espera', offers_pill:'ofertas', offer_submitted:'Oferta enviada', confirmed:'● Confirmado',
       active:'● En curso', done:'Completado', cancelled:'Cancelado',
       toast_ride:'✅ ¡Solicitud publicada!', toast_ride_edit:'✅ ¡Solicitud modificada!', toast_offer:'✅ ¡Oferta enviada!',
       toast_offer_acc:'🎉 ¡Chófer confirmado!', toast_saved:'✅ Guardado',
       toast_rated:'⭐ ¡Gracias por tu valoración!', toast_subcontract:'✅ Misión publicada',
       toast_signout:'¡Hasta luego!', toast_copy:'📋 Enlace copiado',
       toast_reset_sent:'📧 Se ha enviado un enlace de restablecimiento a {email}', toast_pwd_updated:'✅ Contraseña actualizada con éxito',
       err_required:'Por favor rellena los campos obligatorios',
       err_auth:'Email o contraseña incorrectos',
       err_exists:'Ya existe una cuenta con este email',
       mk_client_label:'Cliente', mk_sub_label:'Subcontratación',
       empty_rides:'Sin solicitudes', empty_offers:'Sin ofertas recibidas',
       empty_marketplace:'Sin solicitudes disponibles',
       total_month:'Total este mes', rides_month:'Trayectos este mes',
       pending_offers:'Esperando ofertas', fav_drivers:'Chóferes favoritos',
       missions_month:'Misiones este mes', revenue:'Ingresos', score:'Puntuación', acceptance:'Tasa aceptación',
       upcoming_missions:'Misiones próximas',
       new_requests:'Nuevas solicitudes', my_score:'Mi puntuación',
       recent_rides:'Solicitudes recientes', see_all:'Ver todo →',
       btn_offer:'Enviar oferta', btn_accept:'Aceptar', btn_choose:'Elegir',
       invoice_vat:'IVA', download_pdf:'PDF ↓',
         auth_login:'Iniciar sesión', auth_register:'Registrarse', auth_you_are:'Eres', auth_client_desc:'Reservo trayectos', auth_fleet_desc:'Ofrezco mis servicios', auth_or:'o', auth_email:'Email', auth_phone:'Teléfono', auth_continue_google:'Continuar con Google', auth_continue_apple:'Continuar con Apple', auth_continue_ms:'Continuar con Microsoft', auth_email_label:'Dirección de email', auth_pwd_label:'Contraseña', auth_pwd2_label:'Confirmar contraseña', err_pwd_match:'Las contraseñas no coinciden', err_pwd_short:'Contraseña demasiado corta (mín. 6 caracteres)', auth_pro_client:'Cliente profesional', auth_fname:'Nombre', auth_lname:'Apellido', auth_company:'Nombre de empresa', auth_phone_label:'Número de teléfono', auth_create:'Crear cuenta →', auth_continue:'Continuar →', auth_send_code:'Enviar código →', auth_signin:'Registrarse →', auth_tagline:'Plataforma de transporte privado', auth_vat:'Número de IVA (opcional)', auth_forgot_pwd:'¿Contraseña olvidada?', auth_reset_title:'Restablecer contraseña', auth_reset_desc:'Introduzca su dirección de email para recibir un enlace de restablecimiento.', auth_new_pwd_title:'Nueva contraseña', auth_new_pwd_desc:'Elija una nueva contraseña para su cuenta.', auth_new_pwd_label:'Nueva contraseña', auth_new_pwd2_label:'Confirmar contraseña',
     active_ride:'Trayecto en curso', eta:'Llegada estimada',
  }
};
// t('cle', {param}) : fichiers i18n/<langue>.js d'abord, puis l'ancien dictionnaire TX, puis le français, sinon la clé
var I18N = window.I18N || {};
const t = function(k, p){
  var v = (I18N[currentLang] || {})[k];
  if(v == null) v = (TX[currentLang] || {})[k];
  if(v == null) v = (I18N.fr || {})[k];
  if(v == null) v = TX.fr[k];
  if(v == null) return k;
  if(p) v = String(v).replace(/\{(\w+)\}/g, function(m, n){ return p[n] != null ? p[n] : m; });
  return v;
};
// Alias de t() pour les fonctions qui ont une variable locale nommée « t »
function _T(k, p){ return t(k, p); }
// Locale pour les dates / montants
function _i18nLocale(){ return currentLang === 'en' ? 'en-GB' : currentLang === 'es' ? 'es-ES' : 'fr-BE'; }
// Applique les traductions aux textes marqués : data-i18n (texte), data-i18n-html (avec balises), data-i18n-ph (placeholder)
// Le texte d'origine (français) est mémorisé pour pouvoir revenir au français sans perte.
function applyI18n(root){
  root = root || document;
  var one = function(sel, attr, get, set){
    [].forEach.call(root.querySelectorAll(sel), function(el){
      var k = el.getAttribute(attr); if(!k) return;
      var o = '_i18nFr_' + attr; if(el[o] == null) el[o] = get(el);
      var v = (I18N[currentLang] || {})[k];
      if(v == null) v = (TX[currentLang] || {})[k];
      if(v == null) v = currentLang === 'fr' ? el[o] : ((I18N.fr || {})[k] != null ? I18N.fr[k] : (TX.fr[k] != null ? TX.fr[k] : el[o]));
      if(get(el) !== v) set(el, v);
    });
  };
  one('[data-i18n]', 'data-i18n', function(e){ return e.textContent; }, function(e, v){ e.textContent = v; });
  one('[data-i18n-html]', 'data-i18n-html', function(e){ return e.innerHTML; }, function(e, v){ e.innerHTML = v; });
  one('[data-i18n-ph]', 'data-i18n-ph', function(e){ return e.getAttribute('placeholder') || ''; }, function(e, v){ e.setAttribute('placeholder', v); });
  try{ document.documentElement.lang = currentLang; }catch(e){}
}

window.setLang = function(l, opt){
  if(['fr','en','es'].indexOf(l) < 0) l = 'fr';
  // Dictionnaire pas encore chargé (page d'accueil seule) : on le charge puis on applique
  if(!(window.I18N && window.I18N[l])){ _i18nLoad(l).then(function(){ setLang(l, opt); }, function(){}); return; }
  var changed = l !== currentLang;
  currentLang = l;
  try{ localStorage.setItem('disposal_lang', l); }catch(e){}
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.textContent.trim()===l.toUpperCase()));
  document.querySelectorAll('select.lang-sel').forEach(function(x){ x.value = l; });
  applyI18n(document);
  if(typeof window._i18nRefresh === 'function'){ try{ window._i18nRefresh(); }catch(e){} }
  // Langue enregistrée dans le profil (e-mails, documents…) — sauf si elle vient justement du profil
  if(changed && !(opt && opt.noSave) && sb && currentUser && currentProfile && currentProfile.lang !== l){
    currentProfile.lang = l;
    sb.rpc('api_profile_update', { p:{ lang:l } }).then(function(r){ if(r && r.error) console.warn('lang save', r.error); }, function(){});
  }
  // Reload current page content to refresh dynamic strings
  if(changed){
    var curPage = document.querySelector('#screen-app.active .page.active');
    if(curPage){
      var pageId = curPage.id.replace('page-','');
      if(typeof showPage === 'function') showPage(pageId);
    }
  }
};
// Profil chargé : sa langue prime ; s'il n'en a pas encore, on y enregistre la langue choisie sur la page
function _i18nSyncProfile(){
  if(!currentProfile) return;
  var pl = currentProfile.lang;
  if(['fr','en','es'].indexOf(pl) >= 0){ if(pl !== currentLang) setLang(pl, { noSave:true }); }
  else if('lang' in currentProfile && sb){ currentProfile.lang = currentLang; sb.rpc('api_profile_update', { p:{ lang:currentLang } }).then(function(){}, function(){}); }
}

