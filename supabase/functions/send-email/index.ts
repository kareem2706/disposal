// Supabase Edge Function: send-email
// Sends transactional emails for Bleenr via Resend.
// Templates are rendered server-side so the frontend only sends a type + data.

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "Bleenr <noreply@bleenr.com>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://kareem2706.github.io/disposal";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Simple in-memory rate limit: max 30 sends per recipient per hour
const sentLog = new Map<string, number[]>();
function rateLimited(to: string) {
  const now = Date.now();
  const hourAgo = now - 3600_000;
  const hits = (sentLog.get(to) ?? []).filter((t) => t > hourAgo);
  if (hits.length >= 30) return true;
  hits.push(now);
  sentLog.set(to, hits);
  return false;
}

// The recipient must be a known Bleenr user — blocks use as an open relay
async function isKnownRecipient(email: string): Promise<boolean> {
  if (!SB_URL || !SB_SERVICE_KEY) return false;
  const res = await fetch(
    `${SB_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
    {
      headers: {
        apikey: SB_SERVICE_KEY,
        Authorization: `Bearer ${SB_SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ── Shared layout ────────────────────────────────────────────────
function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <tr><td style="padding:26px 28px 0;">
          <div style="font-size:22px;font-weight:700;color:#1B5E3B;letter-spacing:-.02em;">Bleenr</div>
        </td></tr>
        <tr><td style="padding:20px 28px 0;">
          <h1 style="margin:0 0 14px;font-size:18px;font-weight:700;color:#1A1A18;">${title}</h1>
          <div style="font-size:14px;line-height:1.6;color:#4A4A46;">${body}</div>
        </td></tr>
        ${cta ? `<tr><td style="padding:22px 28px 0;">
          <a href="${cta.url}" style="display:inline-block;background:#1B5E3B;color:#FFFFFF;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">${cta.label}</a>
        </td></tr>` : ""}
        <tr><td style="padding:26px 28px 28px;">
          <div style="border-top:1px solid #EDEBE6;padding-top:16px;font-size:12px;color:#8A8A84;line-height:1.5;">
            Cet email vous est envoyé automatiquement par Bleenr.<br>
            Merci de ne pas y répondre directement.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;font-size:13px;color:#8A8A84;width:130px;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#1A1A18;font-weight:600;">${value}</td>
  </tr>`;
}

function rideTable(d: Record<string, string>) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:#F6F5F2;border-radius:10px;padding:14px 16px;">
    ${d.code ? row("Référence", d.code) : ""}
    ${d.date ? row("Date", d.date + (d.time ? " · " + d.time : "")) : ""}
    ${d.from ? row("Départ", d.from) : ""}
    ${d.to ? row("Arrivée", d.to) : ""}
    ${d.vehicle ? row("Véhicule", d.vehicle) : ""}
    ${d.driver ? row("Chauffeur", d.driver) : ""}
    ${d.passenger ? row("Passager", d.passenger) : ""}
    ${d.price ? row("Montant TVAC", d.price) : ""}
  </table>`;
}

// ── Templates ────────────────────────────────────────────────────
type Payload = { type: string; to: string; data?: Record<string, string> };

function build({ type, data = {} }: Payload) {
  const url = `${APP_URL}/`;

  switch (type) {
    case "ride_created":
      return {
        subject: `Demande publiée — ${data.code ?? ""}`,
        html: layout(
          "Votre demande est publiée",
          `Bonjour ${data.clientName ?? ""},<br><br>Votre demande de course a bien été publiée. Les chauffeurs partenaires peuvent désormais vous envoyer leurs offres.${rideTable(data)}Vous recevrez un email dès qu'une offre sera disponible.`,
          { label: "Voir ma demande", url },
        ),
      };

    case "offer_received":
      return {
        subject: `Nouvelle offre reçue — ${data.code ?? ""}`,
        html: layout(
          "Vous avez reçu une offre",
          `Bonjour ${data.clientName ?? ""},<br><br>Un chauffeur vous a envoyé une offre pour votre course.${rideTable(data)}Connectez-vous pour la consulter et la confirmer.`,
          { label: "Consulter l'offre", url },
        ),
      };

    case "ride_confirmed_client":
      return {
        subject: `Course confirmée — ${data.code ?? ""}`,
        html: layout(
          "Votre course est confirmée",
          `Bonjour ${data.clientName ?? ""},<br><br>Votre paiement a bien été reçu et votre course est confirmée.${rideTable(data)}${data.driverPhone ? `Vous pouvez joindre votre chauffeur au <strong>${data.driverPhone}</strong>.` : ""}`,
          { label: "Voir les détails", url },
        ),
      };

    case "ride_confirmed_driver":
      return {
        subject: `Mission confirmée — ${data.code ?? ""}`,
        html: layout(
          "Votre mission est confirmée",
          `Bonjour ${data.driverName ?? ""},<br><br>Votre offre a été acceptée. La mission suivante vous est attribuée.${rideTable(data)}Pensez à télécharger votre ordre de mission depuis l'application.`,
          { label: "Voir ma mission", url },
        ),
      };

    case "ride_cancelled":
      return {
        subject: `Course annulée — ${data.code ?? ""}`,
        html: layout(
          "Course annulée",
          `Bonjour ${data.name ?? ""},<br><br>La course suivante a été annulée.${rideTable(data)}${data.refund === "yes"
            ? "Un remboursement intégral sera effectué sous 5 à 10 jours ouvrables."
            : "Conformément aux conditions générales, cette annulation intervenue à moins de 48 h du départ ne donne pas lieu à remboursement."}`,
        ),
      };

    case "ride_reminder":
      return {
        subject: `Rappel — votre course demain (${data.code ?? ""})`,
        html: layout(
          "Votre course a lieu demain",
          `Bonjour ${data.name ?? ""},<br><br>Petit rappel concernant votre course prévue demain.${rideTable(data)}`,
          { label: "Voir les détails", url },
        ),
      };

    case "new_marketplace_ride":
      return {
        subject: `Nouvelle course disponible — ${data.code ?? ""}`,
        html: layout(
          "Nouvelle course sur la marketplace",
          `Bonjour ${data.driverName ?? ""},<br><br>Une nouvelle course correspondant à votre profil vient d'être publiée.${rideTable(data)}Soyez réactif : les offres sont traitées par ordre d'arrivée.`,
          { label: "Faire une offre", url },
        ),
      };

    default:
      throw new Error(`Type d'email inconnu : ${type}`);
  }
}

// ── Handler ──────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Preflight must answer 200 with the CORS headers, before any other logic
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY non configurée");

    const payload = (await req.json()) as Payload;
    if (!payload?.to) throw new Error("Destinataire manquant");
    if (!payload?.type) throw new Error("Type d'email manquant");

    const to = String(payload.to).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      throw new Error("Adresse email invalide");
    }
    if (rateLimited(to)) {
      throw new Error("Trop d'envois pour ce destinataire, réessayez plus tard");
    }
    if (!(await isKnownRecipient(to))) {
      throw new Error("Destinataire inconnu");
    }
    payload.to = to;

    const { subject, html } = build(payload);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [payload.to],
        subject,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result?.message ?? "Échec de l'envoi");

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
