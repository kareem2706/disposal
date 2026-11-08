// ── CONFIG ────────────────────────────────────────────
// Adresse et clé publique Supabase de l'environnement (production ou développement) : site.json › envs, injectées par build.mjs
const SB_URL=BLEENR_ENV.supabaseUrl;
const SB_KEY=BLEENR_ENV.supabaseAnonKey;
const DEMO_MODE_KEY='disposal_demo';
const STRIPE_FEE_MULTIPLIER = 1.029; // 1 + 2.9% Stripe fee
const TVA_RATE = BleenrCore.TVA_RATE; // TVA rate applied to payments (core/billing.ts)
// rides.final_price : montant TVAC payé par le client, SAUF pour une sous-traitance où c'est le prix HTVA
// fixé par la flotte qui sous-traite (la TVA « client → transporteur » du pays du transporteur s'y ajoute).
function _rideHtva(r){ return BleenrCore.rideHtva(r); }   // core/billing.ts : prix ÷ 1,06 (sous-traitance : déjà HTVA)
const STRIPE_PK = 'pk_test_REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY'; // Replace with your Stripe publishable key
const MISSION_STATUSES = ['confirmed', 'active', 'done', 'pending_payment']; // Driver mission statuses to display
const ADMIN_EMAIL = 'kb@bleenr.com';

let sb=null,_entering=false;           // Supabase client
if(window._stripeResetEntering){ _entering=false; window._stripeResetEntering=false; }
let currentUser = null;  // auth.User
let currentProfile = null; // profiles row
let currentRole = 'client'; // active role: 'client' | 'driver'
function isDriverRole(){ return currentRole==='driver'||currentProfile?.role==='driver'; }
let currentRideId = null;  // for offer modal
let currentOfferId = null;    // for payment modal
let currentDriverId = null;   // for payment modal
let currentOfferAmount = 0;   // for payment modal
let _currentPaymentRide = null; // ride object for payment modal route info
var _myOffers = {};  // rideId -> {price, msg} for submitted offers
// Langue : choix enregistré, sinon langue du navigateur (fr / en / es), sinon français
let currentLang = (function(){
  var ok = ['fr','en','es'], l = null;
  try{ l = localStorage.getItem('disposal_lang'); }catch(e){}
  if(ok.indexOf(l) < 0){ var n = String((navigator.languages && navigator.languages[0]) || navigator.language || 'fr').slice(0,2).toLowerCase(); l = ok.indexOf(n) >= 0 ? n : 'fr'; }
  return l;
})();
var _selectedPaymentMethod = null; // for payment modal step 1
var _stripeInstance = null;        // Stripe.js instance
var _stripeCardElement = null;     // Stripe card element
var _stripePaymentMethodId = null; // created Stripe PaymentMethod ID

