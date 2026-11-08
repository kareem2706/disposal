// Mise en page commune de tous les e-mails Bleenr (send-mail, auth-email-hook, campaign).
// Tableaux + styles en ligne uniquement : compatible Gmail, Outlook, Apple Mail.
// Les valeurs passées ici doivent DÉJÀ être échappées par l'appelant.

const GREEN = "#1B5E3B";
const INK = "#16201B";
const INK2 = "#3F4743";
const INK3 = "#7C8580";
const LINE = "#ECEAE5";
const BG = "#F4F3EF";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SUPPORT = "info@bleenr.com";

export type Cta = { label: string; url: string };
export type MailOpts = {
  title: string;          // grand titre (« Votre demande est publiée. »)
  intro?: string;         // paragraphe(s) d'introduction
  card?: string;          // carte (trajet, code…)
  after?: string;         // contenu après la carte (encadrés, explications)
  cta?: Cta;              // bouton principal, pleine largeur
  note?: string;          // petite phrase sous le bouton
  footer?: string;        // mention légale sous le pied de page
  preheader?: string;     // aperçu dans la boîte de réception
};

export function mailLayout(o: MailOpts) {
  const btn = o.cta
    ? `<!--CTA--><tr><td style="padding:22px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="center" bgcolor="${GREEN}" style="border-radius:10px;">
            <a href="${o.cta.url}" style="display:block;padding:15px 20px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${o.cta.label}&nbsp;&nbsp;&rarr;</a>
          </td></tr></table>
      </td></tr><!--/CTA-->`
    : "";
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${o.title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};-webkit-font-smoothing:antialiased;">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${o.preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
  <tr><td align="center" style="padding:36px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #EAE8E2;">
      <tr><td style="padding:30px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:${FONT};font-size:26px;font-weight:700;letter-spacing:-.03em;color:${GREEN};">Bleenr</td>
          <td align="right" style="font-family:${FONT};font-size:12.5px;color:${INK3};">Chauffeurs privés</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:30px 32px 0;">
        <h1 style="margin:0;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-.02em;color:${INK};">${o.title}</h1>
        ${o.intro ? `<div style="margin-top:14px;font-family:${FONT};font-size:15.5px;line-height:1.6;color:${INK2};">${o.intro}</div>` : ""}
      </td></tr>
      ${o.card ? `<tr><td style="padding:22px 32px 0;">${o.card}</td></tr>` : ""}
      ${o.after ? `<tr><td style="padding:18px 32px 0;font-family:${FONT};font-size:14.5px;line-height:1.6;color:${INK2};">${o.after}</td></tr>` : ""}
      ${btn}
      ${o.note ? `<tr><td align="center" style="padding:14px 32px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${INK3};">${o.note}</td></tr>` : ""}
      <tr><td style="padding:26px 32px 26px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};"><tr>
          <td style="padding-top:18px;font-family:${FONT};font-size:12.5px;color:${INK3};"><b style="color:${GREEN};font-size:14px;letter-spacing:-.02em;">Bleenr</b>&nbsp;·&nbsp;Chauffeurs privés</td>
          <td align="right" style="padding-top:18px;font-family:${FONT};font-size:12.5px;color:${INK3};">Besoin d'aide ? <a href="mailto:${SUPPORT}" style="color:${GREEN};text-decoration:underline;">${SUPPORT}</a></td>
        </tr></table>
      </td></tr>
    </table>
    <div style="max-width:560px;margin:14px auto 0;font-family:${FONT};font-size:11.5px;line-height:1.5;color:#9AA19C;text-align:center;">
      ${o.footer ?? "Cet e-mail vous est envoyé automatiquement par Bleenr. Merci de ne pas y répondre directement."}
    </div>
  </td></tr>
</table>
</body></html>`;
}

// Carte encadrée (fond très clair, bord fin)
export function box(inner: string, opts: { tint?: string; border?: string } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${opts.tint ?? "#FBFBF9"};border:1px solid ${opts.border ?? LINE};border-radius:12px;">
    <tr><td style="padding:20px 22px;font-family:${FONT};">${inner}</td></tr></table>`;
}

const label = (t: string) =>
  `<div style="font-family:${FONT};font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${INK3};">${t}</div>`;

// « Nom du lieu » en gras + « rue, ville » en dessous (pays retiré)
function place(a: string) {
  const ps = String(a || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (ps.length > 1 && /^(belgique|belgium|belgi(ë|&euml;)|france|luxembourg|nederland|pays-bas|netherlands|deutschland|allemagne|germany|united kingdom|royaume-uni|suisse|schweiz|switzerland)$/i.test(ps[ps.length - 1])) ps.pop();
  const name = ps.shift() ?? "";
  return `<div style="font-family:${FONT};font-size:16px;font-weight:700;line-height:1.35;color:${INK};">${name}</div>`
    + (ps.length ? `<div style="font-family:${FONT};font-size:14px;line-height:1.45;color:${INK3};margin-top:2px;">${ps.join(", ")}</div>` : "");
}
const dot = (c: string) => `<div style="width:12px;height:12px;border-radius:12px;background:${c};font-size:0;line-height:0;margin-top:5px;">&nbsp;</div>`;

// Paires [libellé, valeur] sur 2 colonnes, séparées par un trait vertical
export function infoGrid(items: [string, string][]) {
  const it = items.filter(([, v]) => v);
  if (!it.length) return "";
  let rows = "";
  for (let i = 0; i < it.length; i += 2) {
    const cell = (p?: [string, string], left = true) => p
      ? `<td width="50%" valign="top" style="padding:${i ? "14px" : "0"} ${left ? "16px" : "0"} 0 ${left ? "0" : "22px"};${left && it[i + 1] ? `border-right:1px solid ${LINE};` : ""}">
          <div style="font-family:${FONT};font-size:13px;color:${INK3};">${p[0]}</div>
          <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${INK};margin-top:3px;">${p[1]}</div></td>`
      : `<td width="50%"></td>`;
    rows += `<tr>${cell(it[i])}${cell(it[i + 1], false)}</tr>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

// Carte « Votre trajet » : date · heure, départ → arrivée, puis infos (passager, référence…)
export function tripCard(d: Record<string, string>, opts: { title?: string; info?: [string, string][] } = {}) {
  const when = [d.date, d.time].filter(Boolean).join("&nbsp;&nbsp;·&nbsp;&nbsp;");
  const disposal = !d.to || /^(mise à disposition|mise &agrave; disposition|trajet mixte|course mixte)/i.test(d.to);
  const top = when ? `<div style="font-family:${FONT};font-size:13.5px;color:${INK3};margin-bottom:3px;">${when}</div>` : "";
  // Ligne pointillée continue d'un point à l'autre, sans rowspan (fiable dans tous les clients mail) :
  //   ligne 1 : point + 1re ligne de texte ; ligne 2 : trait pointillé (bord gauche) à côté du reste du bloc.
  const DOTS = "border-left:2px dotted #C9C6BE;";
  const nameOf = (a: string) => place(a).split("</div>")[0] + "</div>";
  const restOf = (a: string) => place(a).slice(nameOf(a).length);
  const head = (c: string, html: string) =>
    `<tr><td colspan="2" width="26" valign="top">${dot(c)}</td><td valign="top">${html}</td></tr>`;
  const body = (html: string, line: boolean, pad = 16) =>
    `<tr><td width="5" style="font-size:0;line-height:0;">&nbsp;</td><td width="21" style="${line ? DOTS : ""}font-size:0;line-height:0;">&nbsp;</td><td valign="top" style="padding-bottom:${pad}px;">${html}</td></tr>`;
  let route = "";
  if (d.from) {
    const end = !disposal ? d.to : (d.to || "");
    const first = when ? top.replace("margin-bottom:3px;", "") : nameOf(d.from);
    const rest = when ? `<div style="margin-top:3px;">${place(d.from)}</div>` : restOf(d.from);
    route = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">`;
    route += head(GREEN, first) + body(rest, !!end, end ? 18 : 0);
    if (end) {
      if (!disposal) route += head("#E0605A", nameOf(end)) + body(restOf(end), false, 0);
      else route += head("#E0A33A", `<div style="font-family:${FONT};font-size:15px;font-weight:700;line-height:1.35;color:${INK};">${end}</div>`);
    }
    route += `</table>`;
  } else if (when) route = `<div style="margin-top:10px;">${top}</div>`;
  const grid = infoGrid(opts.info ?? []);
  return box(label(opts.title ?? "Votre trajet") + route
    + (grid ? `<div style="border-top:1px solid ${LINE};margin-top:20px;padding-top:16px;">${grid}</div>` : ""));
}

// Encadré coloré (message, alerte…)
export function callout(title: string, text: string, tone: "info" | "warn" | "danger" | "neutral" = "neutral") {
  const t = { info: ["#EEF4FB", "#D6E4F5"], warn: ["#FFF7E8", "#F3E2BF"], danger: ["#FDEEEC", "#F3D2CD"], neutral: ["#F6F5F1", LINE] }[tone];
  return box((title ? label(title) + `<div style="height:8px;font-size:0;">&nbsp;</div>` : "")
    + `<div style="font-family:${FONT};font-size:14.5px;line-height:1.6;color:${INK2};white-space:pre-wrap;">${text}</div>`, { tint: t[0], border: t[1] });
}

// Liste numérotée (étapes)
export function steps(title: string, items: string[]) {
  return box(label(title) + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">`
    + items.map((s, i) => `<tr><td valign="top" style="padding:5px 12px 5px 0;"><div style="width:24px;height:24px;border-radius:24px;background:#E8F2EC;color:${GREEN};font-family:${FONT};font-size:12px;font-weight:700;text-align:center;line-height:24px;">${i + 1}</div></td>
        <td valign="top" style="padding:7px 0 5px;font-family:${FONT};font-size:14.5px;line-height:1.45;color:${INK2};">${s}</td></tr>`).join("")
    + `</table>`);
}

// Code à saisir (connexion, inscription…)
export function codeCard(code: string, caption = "") {
  return box(`<div style="text-align:center;">
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:12px;color:${GREEN};padding-left:12px;">${code}</div>
      ${caption ? `<div style="font-family:${FONT};font-size:13px;color:${INK3};margin-top:8px;">${caption}</div>` : ""}
    </div>`);
}

// Environnement de développement : secret MAIL_REDIRECT_ALL = une adresse → TOUS les e-mails lui sont envoyés,
// le destinataire réel est indiqué dans l'objet. Non défini (production) : rien ne change.
export function devRedirect(to: string, subject: string): { to: string; subject: string } {
  const all = (Deno.env.get("MAIL_REDIRECT_ALL") ?? "").trim();
  return all ? { to: all, subject: "[DEV → " + to + "] " + subject } : { to, subject };
}
