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

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <tr><td style="padding:26px 28px 0;"><div style="font-size:22px;font-weight:700;color:#1B5E3B;letter-spacing:-.02em;">Bleenr</div></td></tr>
        <tr><td style="padding:20px 28px 0;">
          <h1 style="margin:0 0 14px;font-size:18px;font-weight:700;color:#1A1A18;">${title}</h1>
          <div style="font-size:14px;line-height:1.6;color:#4A4A46;">${body}</div>
        </td></tr>
        <tr><td style="padding:26px 28px 28px;">
          <div style="border-top:1px solid #EDEBE6;padding-top:16px;font-size:12px;color:#8A8A84;line-height:1.5;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.<br>
            Cet e-mail vous est envoyé automatiquement par Bleenr.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function codeBox(code: string) {
  return `<div style="margin:18px 0;padding:16px;background:#F6F5F2;border-radius:10px;text-align:center;">
    <div style="font-size:32px;font-weight:700;letter-spacing:10px;color:#1B5E3B;font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(code)}</div>
  </div>`;
}

function verifyUrl(d: EmailData, hash: string, type: string) {
  const redirect = d.redirect_to || d.site_url || "";
  return `${SB_URL}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirect)}`;
}

function button(label: string, url: string) {
  return `<p style="margin:18px 0 4px;"><a href="${url}" style="display:inline-block;background:#1B5E3B;color:#FFFFFF;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">${label}</a></p>`;
}

// Contenu selon le type d'e-mail
function build(d: EmailData, code: string, hash: string, account: string, forwarded: boolean) {
  const t = d.email_action_type;
  const forFor = forwarded ? `<p style="margin:0 0 10px;font-size:12.5px;color:#8A8A84;">Code destiné au compte <b>${esc(account)}</b>.</p>` : "";
  if (t === "recovery") {
    return {
      subject: "Réinitialisation de votre mot de passe Bleenr",
      html: layout("Réinitialiser votre mot de passe", forFor +
        "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe." +
        button("Choisir un nouveau mot de passe", verifyUrl(d, hash, "recovery")) +
        (code ? `<p style="margin:16px 0 0;">Ou saisissez ce code :</p>${codeBox(code)}` : "")),
    };
  }
  if (t === "email_change") {
    return {
      subject: "Confirmez votre adresse e-mail Bleenr",
      html: layout("Confirmer le changement d'adresse", forFor +
        "Saisissez ce code pour confirmer votre nouvelle adresse e-mail :" + codeBox(code) +
        button("Confirmer l'adresse", verifyUrl(d, hash, "email_change"))),
    };
  }
  if (t === "invite") {
    return {
      subject: "Vous êtes invité sur Bleenr",
      html: layout("Bienvenue sur Bleenr", forFor + "Vous avez été invité à rejoindre Bleenr." +
        button("Accepter l'invitation", verifyUrl(d, hash, "invite"))),
    };
  }
  if (t === "reauthentication") {
    return {
      subject: "Votre code de confirmation Bleenr",
      html: layout("Code de confirmation", forFor + "Saisissez ce code pour confirmer l'opération :" + codeBox(code)),
    };
  }
  const signup = t === "signup";
  return {
    subject: signup ? `${code} — votre code d'inscription Bleenr` : `${code} — votre code de connexion Bleenr`,
    html: layout(signup ? "Confirmez votre inscription" : "Votre code de connexion",
      forFor + (signup ? "Saisissez ce code pour activer votre compte :" : "Saisissez ce code pour vous connecter :") +
      codeBox(code) + `<p style="margin:0;font-size:13px;color:#8A8A84;">Ce code est valable pendant une durée limitée.</p>`),
  };
}

async function send(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
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
