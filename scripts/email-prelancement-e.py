# Génère l'e-mail de prélancement fleets « E » (version 2 : centrée sur le chauffeur, plus courte,
# bouton en haut et en bas) en français et en anglais, à partir de la maquette D.
#   python3 scripts/email-prelancement-e.py
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

def cut(s, a, b):
    i = s.index(a); j = s.index(b, i); return s[:i], s[i:j], s[j:]

def check(lbl, txt):
    return ('<tr><td width="34" valign="top" style="width:22px;vertical-align:top;padding:0 12px 12px 0;"><div style="width:22px;height:22px;border-radius:22px;background:#D9F477;color:#111312;font:700 13px/22px ' + FONT + ';text-align:center;">&#10003;</div></td>\n'
            '              <td valign="top" style="vertical-align:top;padding:1px 0 12px;font-size:15px;line-height:22px;color:#3F4743;"><b style="color:#111312;">' + lbl + '</b>' + txt + '</td></tr>\n')

def feat(icon, title, text, pill=''):
    return ('          <tr><td class="feat" valign="top" style="padding:0 0 24px;">\n'
            '            <table role="presentation" cellpadding="0" cellspacing="0"><tr>\n'
            '              <td width="62" valign="top" style="width:48px;vertical-align:top;padding:2px 14px 0 0;"><img src="https://www.bleenr.com/assets/email/' + icon + '" width="48" height="48" alt="" style="display:block;border:0;"></td>\n'
            '              <td valign="top" style="vertical-align:top;"><div style="font-size:16px;font-weight:700;color:#111312;">' + title + '</div>\n'
            '                <div style="font-size:14px;line-height:21px;color:#5B615E;margin-top:4px;">' + text + '</div>' + pill + '</td>\n'
            '            </tr></table></td></tr>\n')

def pill(txt, bg, fg):
    return '\n                <div style="margin-top:10px;"><span style="display:inline-block;background:' + bg + ';color:' + fg + ';font-size:12.5px;font-weight:700;padding:7px 12px;border-radius:999px;">' + txt + '</span></div>'

def cta(url, label, pad):
    return ('    <tr><td class="px" align="center" style="padding:' + pad + ';">\n'
            '      <table role="presentation" cellpadding="0" cellspacing="0"><tr>\n'
            '        <td align="center" bgcolor="#111312" style="border-radius:999px;background:#111312;">\n'
            '          <a href="' + url + '" style="display:inline-block;padding:18px 44px;font:600 17px/1 ' + FONT + ';color:#FFFFFF;text-decoration:none;border-radius:999px;">' + label + '&nbsp;&nbsp;&rarr;</a>\n'
            '        </td></tr></table>\n'
            '    </td></tr>\n')

T = {
 'fr': dict(src='prelancement-fleets-D.html', out='prelancement-fleets-E.html', camp='prelancement_fleets_v2', url='https://www.bleenr.com/?inscription=fleet',
   subject='Des courses en plus pour votre activité de chauffeur', 
   pre='Inscription gratuite, sans abonnement : votre agenda et votre réseau de sous-traitance dès aujourd’hui, les demandes clients au lancement.',
   h1='Des courses en plus, sans prospecter.',
   sub='Bleenr met en relation les chauffeurs professionnels avec des clients particuliers et professionnels, et les chauffeurs entre eux. <b style="color:#111312;">Inscription gratuite, sans abonnement.</b>',
   box_t='Gratuit dès aujourd’hui', box='Gérez votre agenda et sous-traitez vos courses entre chauffeurs dès maintenant. Les demandes clients arrivent au lancement : inscrivez-vous dès aujourd\u2019hui pour que votre compte soit vérifié à temps.',
   cta='Créer mon compte gratuit', cta2='Créer mon compte',
   wtitle='Ce que vous y gagnez',
   f1=('Recevez des demandes de courses', 'Des clients particuliers et professionnels publient leurs trajets : vous faites votre offre, au prix que vous fixez.', '15&nbsp;% uniquement sur vos courses'),
   f2=('Sous-traitez entre chauffeurs', 'Confiez une course à un collègue quand vous êtes complet, ou prenez celles des autres.', 'Sans commission'),
   f3=('Soyez payé en toute sécurité', 'Paiement par Stripe Connect, versé sur votre compte entre 24&nbsp;h et 7&nbsp;jours après la course. Factures générées pour vous.', 'Stripe Connect'),
   app_t='Tout depuis votre téléphone.', app_i='L’application chauffeur arrive bientôt :',
   c1=('Offres et sous-traitances', ' en quelques secondes.'),
   c2=('Suivi en temps réel', ' : en chemin, passager à bord, mission terminée.'),
   c3=('Navigation', ' avec Waze, Google Maps ou Plans, et votre agenda au même endroit.'),
   veh='Pour toutes les classes de véhicules.'),
 'en': dict(src='prelancement-fleets-D-en.html', out='prelancement-fleets-E-en.html', camp='prelancement_fleets_v2_en', url='https://www.bleenr.com/en/?inscription=fleet',
   subject='More rides for your chauffeur business',
   pre='Free sign-up, no subscription: your schedule and subcontracting network today, client requests at launch.',
   h1='More rides, without prospecting.',
   sub='Bleenr connects professional drivers with private and business clients, and drivers with each other. <b style="color:#111312;">Free sign-up, no subscription.</b>',
   box_t='Free from today', box='Manage your schedule and subcontract rides between drivers right now. Client requests arrive at launch: sign up today so your account is verified in time.',
   cta='Create my free account', cta2='Create my account',
   wtitle='What you get',
   f1=('Receive ride requests', 'Private and business clients post their trips: you make your offer, at the price you set.', '15&nbsp;% only on rides you win'),
   f2=('Subcontract between drivers', 'Hand a ride to a colleague when you are fully booked, or take on theirs.', 'No commission'),
   f3=('Get paid securely', 'Payment through Stripe Connect, paid out to your account 24&nbsp;h to 7&nbsp;days after the ride. Invoices generated for you.', 'Stripe Connect'),
   app_t='Everything from your phone.', app_i='The driver app is coming soon:',
   c1=('Offers and subcontracts', ' in a few seconds.'),
   c2=('Real-time tracking', ': on the way, passenger on board, mission completed.'),
   c3=('Navigation', ' with Waze, Google Maps or Apple Maps, and your schedule in one place.'),
   veh='For every vehicle class.'),
}

for lang, t in T.items():
    s = (ROOT / 'emails' / t['src']).read_text()
    url = t['url'] + '&amp;utm_source=email&amp;utm_campaign=' + t['camp']
    # Commentaire d'en-tête
    s = re.sub(r'<!-- Maquette D.*?-->', '<!-- Maquette E (version 2, générée par scripts/email-prelancement-e.py) : titre centré sur le chauffeur, « gratuit dès aujourd’hui », bouton en haut et en bas, 3 avantages.\n     Objet conseillé : « ' + t['subject'] + ' » -->', s, count=1, flags=re.S)
    # Pré-en-tête
    s = re.sub(r'(<div style="display:none;max-height:0;overflow:hidden;opacity:0;">).*?(</div>)', lambda m: m.group(1) + t['pre'] + m.group(2), s, count=1)
    # Titre + intro
    s = re.sub(r'(<h1 class="h1"[^>]*>).*?(</h1>)', lambda m: m.group(1) + t['h1'] + m.group(2), s, count=1)
    s = re.sub(r'(<p style="margin:18px 0 0;font-size:16px;line-height:24px;color:#3F4743;">).*?(</p>)', lambda m: m.group(1) + t['sub'] + m.group(2), s, count=1)
    # Retire l'ancien encadré « Rejoignez » et l'ancien bouton (reconstruits plus bas)
    a, old_box, b = cut(s, '    <!-- Inscriptions ouvertes -->', '    <!-- Application mobile -->'); s = a + b
    a, old_btn, b = cut(s, '    <!-- Bouton -->', '    <!-- Signature de marque -->'); s = a + b
    # Encadré « Gratuit dès aujourd'hui » + bouton n° 1 juste après le titre
    box = ('    <!-- Gratuit dès aujourd’hui -->\n'
           '    <tr><td class="px" style="padding:22px 24px 0;">\n'
           '      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F9CF;border-radius:18px;"><tr>\n'
           '        <td width="62" valign="top" style="width:44px;vertical-align:top;padding:18px 0 18px 18px;"><img src="https://www.bleenr.com/assets/email/ic-users-l.png" width="44" height="44" alt="" style="display:block;border:0;"></td>\n'
           '        <td valign="top" style="vertical-align:top;padding:16px 20px 16px 16px;font-family:' + FONT + ';">\n'
           '          <div style="font-size:16px;line-height:22px;font-weight:700;color:#111312;">' + t['box_t'] + '</div>\n'
           '          <div style="font-size:14px;line-height:21px;color:#3F4743;margin-top:4px;">' + t['box'] + '</div>\n'
           '        </td></tr></table>\n'
           '    </td></tr>\n\n'
           '    <!-- Bouton (haut) -->\n' + cta(url, t['cta'], '24px 34px 0') + '\n')
    a, feats, b = cut(s, '    <!-- Avantages -->', '    <!-- Classes de véhicules -->')
    feats = ('    <!-- Avantages -->\n'
             '    <tr><td class="px" style="padding:40px 34px 0;font-family:' + FONT + ';">\n'
             '      <div style="font-size:24px;line-height:30px;font-weight:800;letter-spacing:-.02em;color:#111312;">' + t['wtitle'] + '</div>\n'
             '    </td></tr>\n'
             '    <tr><td class="px" style="padding:22px 34px 0;">\n'
             '      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:' + FONT + ';">\n'
             + feat('ic-layers-b.png', t['f1'][0], t['f1'][1], pill(t['f1'][2], '#E4F59E', '#111312'))
             + feat('ic-swap-b.png', t['f2'][0], t['f2'][1], pill(t['f2'][2], '#F2F2EE', '#111312'))
             + feat('ic-card-b.png', t['f3'][0], t['f3'][1], pill(t['f3'][2], '#EEEDFF', '#4F46E5'))
             + '      </table>\n'
             '    </td></tr>\n\n')
    s = a + box + feats + b
    s = s.replace('padding:34px 24px 0;">\n      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;border-radius:20px;"><tr><td style="padding:22px 18px 18px;', 'padding:14px 24px 0;">\n      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;border-radius:20px;"><tr><td style="padding:22px 18px 18px;', 1)
    # Application : titre, intro et 3 lignes au lieu de 5
    s = re.sub(r'(<div style="font-size:24px;line-height:30px;font-weight:800;letter-spacing:-.02em;color:#111312;margin-top:14px;">).*?(</div>)', lambda m: m.group(1) + t['app_t'] + m.group(2), s, count=1)
    s = re.sub(r'(<div style="font-size:15px;line-height:23px;color:#3F4743;margin-bottom:16px;">).*?(</div>)', lambda m: m.group(1) + t['app_i'] + m.group(2), s, count=1)
    i = s.index('<tr><td width="34" valign="top"'); j = s.index('        </table>\n        <div style="font-size:16px;font-weight:800;color:#111312;margin:14px 0 14px;">', i)
    s = s[:i] + check(*t['c1']) + '          ' + check(*t['c2']) + '          ' + check(*t['c3']) + s[j:]
    # Bouton n° 2 avant la signature
    s = s.replace('    <!-- Signature de marque -->', '    <!-- Bouton (bas) -->\n' + cta(url, t['cta2'], '36px 34px 0') + '\n    <!-- Signature de marque -->', 1)
    s = s.replace('https://www.bleenr.com/email/prelancement-en"', 'https://www.bleenr.com/email/prelancement-v2-en"')   # lien « Read in English »
    (ROOT / 'emails' / t['out']).write_text(s)
    print('écrit', t['out'])
