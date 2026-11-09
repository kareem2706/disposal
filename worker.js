// Worker « bleenr » : sert le site statique (_site) et reçoit le retour de la connexion Google.
// Connexion Google « dans la même fenêtre » : Google renvoie le jeton d'identité en POST sur /auth/google.
// Le worker vérifie le jeton anti-CSRF (cookie g_csrf_token = champ g_csrf_token, mécanisme de Google)
// puis renvoie la page avec le jeton dans le # (jamais envoyé à un serveur, effacé aussitôt par la page).
// La vérification du jeton (signature Google, application, nonce) est faite par Supabase côté serveur.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/auth/google') {
      const back = (h) => new Response(null, { status: 303, headers: { Location: '/' + h, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
      if (req.method !== 'POST') return back('');
      let form;
      try { form = await req.formData(); } catch { return back('#error=google_form'); }
      const cred = String(form.get('credential') || '');
      const csrf = String(form.get('g_csrf_token') || '');
      const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)g_csrf_token=([^;]+)/);
      if (!cred || !csrf || !m || m[1] !== csrf) return back('#error=google_csrf');
      if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(cred)) return back('#error=google_token');
      return back('#gcred=' + cred);
    }
    return env.ASSETS.fetch(req);
  }
};
