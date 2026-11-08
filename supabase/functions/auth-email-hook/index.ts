// Supabase Edge Function: auth-email-hook  (Auth → Hooks → « Send Email »)
// Envoie tous les e-mails d'authentification Bleenr (codes de connexion / inscription,
// réinitialisation du mot de passe, changement d'adresse…) via Resend, à la place du SMTP.
// Certaines adresses peuvent être redirigées vers une autre boîte (ex. compte admin → adresse perso)
// grâce au secret EMAIL_REDIRECTS : {"kb@bleenr.com":"autre@exemple.com"}.
//
// Secrets requis (Edge Functions → Secrets) :
//   SEND_EMAIL_HOOK_SECRET  secret généré par Supabase dans Auth → Hooks (format « v1,whsec_… »)
//   RESEND_API_KEY          clé Resend (déjà utilisée par send-email)
//   EMAIL_REDIRECTS         JSON des redirections (optionnel)
//   MAIL_FROM               expéditeur (optionnel, défaut « Bleenr <noreply@bleenr.com> »)
// Déployer SANS vérification JWT (c'est Supabase Auth qui appelle la fonction, signature vérifiée ci-dessous).

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { codeCard, devRedirect, mailLayout } from "../_shared/mail.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "Bleenr <noreply@bleenr.com>";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const HOOK_SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(/^v1,whsec_/, "");

function redirects(): Record<string, string> {
  try {
    const m = JSON.parse(Deno.env.get("EMAIL_REDIRECTS") ?? "{}");
    const out: Record<string, string> = {};
    for (const k of Object.keys(m)) out[k.trim().toLowerCase()] = String(m[k]).trim();
    return out;
  } catch (_) {
    return {};
  }
}

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const FOOT = "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail. Cet e-mail vous est envoyé automatiquement par Bleenr.";
function layout(title: string, intro: string, card = "", cta?: { label: string; url: string }, note = "") {
  return mailLayout({ title, intro, card, cta, note, footer: FOOT });
}

// Le lien ouvre le site, qui vérifie lui-même le jeton (verifyOtp) : si le serveur est indisponible,
// l'utilisateur voit un message clair au lieu d'une page d'erreur technique.
function verifyUrl(d: EmailData, hash: string, type: string) {
  const redirect = d.redirect_to || d.site_url || "";
  if (!/^https?:\/\//.test(redirect)) {
    return `${SB_URL}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirect)}`;
  }
  const [base, frag] = redirect.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}th=${encodeURIComponent(hash)}&tt=${encodeURIComponent(type)}${frag ? "#" + frag : ""}`;
}

// Contenu selon le type d'e-mail
function build(d: EmailData, code: string, hash: string, account: string, forwarded: boolean) {
  const t = d.email_action_type;
  const forFor = forwarded ? `<div style="font-size:13px;color:#7C8580;margin-bottom:8px;">Code destiné au compte <b>${esc(account)}</b>.</div>` : "";
  const limit = "Ce code est valable pendant une durée limitée.";
  if (t === "recovery") {
    return {
      subject: "Réinitialisation de votre mot de passe Bleenr",
      html: layout("Réinitialisez votre mot de passe.", forFor + "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe." + (code ? " Vous pouvez aussi saisir ce code :" : ""),
        code ? codeCard(esc(code), limit) : "", { label: "Choisir un nouveau mot de passe", url: verifyUrl(d, hash, "recovery") }),
    };
  }
  if (t === "email_change") {
    return {
      subject: "Confirmez votre adresse e-mail Bleenr",
      html: layout("Confirmez votre nouvelle adresse.", forFor + "Saisissez ce code pour confirmer votre nouvelle adresse e-mail :",
        codeCard(esc(code), limit), { label: "Confirmer l'adresse", url: verifyUrl(d, hash, "email_change") }),
    };
  }
  if (t === "invite") {
    return {
      subject: "Vous êtes invité sur Bleenr",
      html: layout("Bienvenue sur Bleenr.", forFor + "Vous avez été invité à rejoindre Bleenr, la plateforme de réservation de chauffeurs privés.",
        "", { label: "Accepter l'invitation", url: verifyUrl(d, hash, "invite") }),
    };
  }
  if (t === "reauthentication") {
    return {
      subject: "Votre code de confirmation Bleenr",
      html: layout("Votre code de confirmation.", forFor + "Saisissez ce code pour confirmer l'opération :", codeCard(esc(code), limit)),
    };
  }
  const signup = t === "signup";
  return {
    subject: signup ? `${code} — votre code d'inscription Bleenr` : `${code} — votre code de connexion Bleenr`,
    html: layout(signup ? "Confirmez votre inscription." : "Votre code de connexion.",
      forFor + (signup ? "Bienvenue ! Saisissez ce code pour activer votre compte :" : "Saisissez ce code pour vous connecter à Bleenr :"),
      codeCard(esc(code), limit)),
  };
}

async function send(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify((() => { const d = devRedirect(to, subject); return { from: FROM, to: [d.to], subject: d.subject, html }; })()),
  });
  if (!r.ok) throw new Error("Resend " + r.status + " : " + (await r.text()));
}

function fail(code: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: code, message } }), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "Method not allowed");
  if (!HOOK_SECRET) return fail(500, "SEND_EMAIL_HOOK_SECRET manquant");
  if (!RESEND_KEY) return fail(500, "RESEND_API_KEY manquant");

  const raw = await req.text();
  let payload: { user: { email: string; new_email?: string }; email_data: EmailData };
  try {
    payload = new Webhook(HOOK_SECRET).verify(raw, Object.fromEntries(req.headers)) as typeof payload;
  } catch (_) {
    return fail(401, "Signature invalide");
  }

  const { user, email_data: d } = payload;
  const map = redirects();
  const target = (addr: string) => map[String(addr || "").toLowerCase()] || addr;

  try {
    const jobs: { account: string; code: string; hash: string }[] = [];
    if (d.email_action_type === "email_change") {
      // Changement sécurisé : un code pour l'ancienne adresse, un pour la nouvelle
      if (d.token && user.email) jobs.push({ account: user.email, code: d.token, hash: d.token_hash_new || d.token_hash });
      if (d.token_new && user.new_email) jobs.push({ account: user.new_email, code: d.token_new, hash: d.token_hash });
      if (!jobs.length && user.new_email) jobs.push({ account: user.new_email, code: d.token, hash: d.token_hash });
    } else {
      jobs.push({ account: user.email, code: d.token, hash: d.token_hash });
    }
    for (const j of jobs) {
      const to = target(j.account);
      const m = build(d, j.code, j.hash, j.account, to.toLowerCase() !== j.account.toLowerCase());
      await send(to, m.subject, m.html);
    }
  } catch (e) {
    return fail(500, (e as Error).message);
  }

  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});
