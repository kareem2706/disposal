// Pages de référencement (services et villes), en français, anglais et espagnol.
// Générées par build.mjs avec seo/page.html : /<slug fr>/, /en/<slug en>/, /es/<slug es>/ (+ plan du site).
// Règles : un texte propre à chaque page (pas de copie d'une ville à l'autre), uniquement des faits vrais sur Bleenr.
// Le bouton « Recevoir des offres » ouvre la page d'accueil avec le formulaire prérempli (?from=…&to=…&mode=heure).

// Textes communs à toutes les pages
export const COMMON = {
  fr: {
    locale: 'fr_BE', home: '/', book: 'Recevoir des offres', how: 'Comment ça marche', nav_book: 'Réserver',
    how_t: 'Réserver en <em>trois étapes</em>.',
    steps: [
      ['Publiez votre trajet', 'Départ, arrivée ou durée, date, heure, nombre de passagers et gamme de véhicule. C’est gratuit et sans engagement.'],
      ['Recevez les offres', 'Des chauffeurs et des flottes vérifiés vous proposent un prix fixe, TVA comprise, avec le véhicule et les avis des autres clients.'],
      ['Choisissez et payez', 'Vous acceptez l’offre qui vous convient et payez par carte en ligne. Vous recevez votre voucher et la facture par e-mail.']
    ],
    why_t: 'Pourquoi <em>Bleenr</em> ?',
    why: [
      ['Prix fixe', 'Le prix accepté à la réservation est celui que vous payez, TVA comprise.'],
      ['Chauffeurs vérifiés', 'Licence, assurance et contrôle technique sont contrôlés pour chaque partenaire.'],
      ['Vous choisissez', 'Plusieurs offres, un comparatif clair : prix, véhicule, avis.'],
      ['Tout est transmis', 'Adresse, horaire, numéro de vol ou de train, instructions : votre chauffeur sait tout avant d’arriver.']
    ],
    faq_t: 'Questions <em>fréquentes</em>',
    more_t: 'Autres services et destinations',
    final_t: 'Votre chauffeur <em>vous attend.</em>', final_p: 'Publiez votre trajet, c’est gratuit et sans engagement.',
    crumb: 'Accueil', legal: ['Mentions légales', 'Conditions générales', 'Confidentialité'], tagline: 'Chauffeurs privés à Bruxelles et dans toute la Belgique.',
    lang_label: 'Langue'
  },
  en: {
    locale: 'en_GB', home: '/en/', book: 'Get offers', how: 'How it works', nav_book: 'Book',
    how_t: 'Book in <em>three steps</em>.',
    steps: [
      ['Post your trip', 'Pickup, drop-off or duration, date, time, number of passengers and vehicle class. It’s free and without commitment.'],
      ['Receive offers', 'Verified chauffeurs and fleets send you a fixed price, VAT included, with the vehicle and other customers’ reviews.'],
      ['Choose and pay', 'Accept the offer that suits you and pay by card online. Your voucher and invoice arrive by e-mail.']
    ],
    why_t: 'Why <em>Bleenr</em>?',
    why: [
      ['Fixed price', 'The price you accept when booking is what you pay, VAT included.'],
      ['Verified chauffeurs', 'Licence, insurance and roadworthiness are checked for every partner.'],
      ['You choose', 'Several offers, one clear comparison: price, vehicle, reviews.'],
      ['Everything is shared', 'Address, time, flight or train number, instructions: your chauffeur knows it all before arriving.']
    ],
    faq_t: 'Frequently asked <em>questions</em>',
    more_t: 'Other services and destinations',
    final_t: 'Your chauffeur <em>is waiting.</em>', final_p: 'Post your trip — free and without commitment.',
    crumb: 'Home', legal: ['Legal notice', 'Terms and conditions', 'Privacy'], tagline: 'Private chauffeurs in Brussels and throughout Belgium.',
    lang_label: 'Language'
  },
  es: {
    locale: 'es_ES', home: '/es/', book: 'Recibir ofertas', how: 'Cómo funciona', nav_book: 'Reservar',
    how_t: 'Reserve en <em>tres pasos</em>.',
    steps: [
      ['Publique su trayecto', 'Salida, llegada o duración, fecha, hora, número de pasajeros y gama de vehículo. Es gratuito y sin compromiso.'],
      ['Reciba ofertas', 'Chóferes y flotas verificados le proponen un precio fijo, IVA incluido, con el vehículo y las opiniones de otros clientes.'],
      ['Elija y pague', 'Acepte la oferta que le convenga y pague con tarjeta en línea. Recibirá su bono y la factura por correo electrónico.']
    ],
    why_t: '¿Por qué <em>Bleenr</em>?',
    why: [
      ['Precio fijo', 'El precio aceptado al reservar es el que paga, IVA incluido.'],
      ['Chóferes verificados', 'Licencia, seguro e inspección técnica se comprueban para cada socio.'],
      ['Usted elige', 'Varias ofertas, una comparación clara: precio, vehículo, opiniones.'],
      ['Todo se transmite', 'Dirección, hora, número de vuelo o de tren, instrucciones: su chófer lo sabe todo antes de llegar.']
    ],
    faq_t: 'Preguntas <em>frecuentes</em>',
    more_t: 'Otros servicios y destinos',
    final_t: 'Su chófer <em>le espera.</em>', final_p: 'Publique su trayecto, es gratuito y sin compromiso.',
    crumb: 'Inicio', legal: ['Aviso legal', 'Condiciones generales', 'Privacidad'], tagline: 'Chóferes privados en Bruselas y en toda Bélgica.',
    lang_label: 'Idioma'
  }
};

export const PAGES = [
  // ───────────── Aéroport de Bruxelles (Zaventem) ─────────────
  {
    id: 'bru', img: 'service-aeroport.webp', prefill: { from: 'Brussels Airport, Leopoldlaan, 1930 Zaventem' },
    slug: { fr: 'chauffeur-prive-aeroport-bruxelles', en: 'brussels-airport-chauffeur', es: 'chofer-aeropuerto-bruselas' },
    fr: {
      title: 'Chauffeur privé Brussels Airport (Zaventem) | Bleenr',
      desc: 'Transfert en chauffeur privé depuis ou vers Brussels Airport à Zaventem. Recevez les offres de chauffeurs vérifiés, prix fixe TVA comprise, payez en ligne.',
      short: 'Aéroport de Bruxelles', eye: 'Transfert aéroport · Zaventem',
      h1: 'Chauffeur privé pour Brussels Airport (Zaventem)',
      lead: 'Arrivée ou départ à l’aéroport de Bruxelles : publiez votre transfert, comparez les offres de chauffeurs vérifiés et réservez à prix fixe.',
      sections: [
        ['Votre transfert vers ou depuis Zaventem', ['Brussels Airport se trouve à Zaventem, à une quinzaine de kilomètres au nord-est du centre de Bruxelles. Un chauffeur privé vous évite de chercher un taxi à l’arrivée ou de laisser votre voiture au parking pendant le voyage.', 'Indiquez votre numéro de vol au moment de la demande : votre chauffeur le reçoit avec la réservation, ainsi que vos instructions (bagages, siège enfant, accès PMR…).']],
        ['Depuis Bruxelles et toute la Belgique', ['Le transfert peut partir de votre domicile, de votre hôtel ou de votre bureau, à Bruxelles comme à Anvers, Gand, Louvain, Liège ou ailleurs en Belgique. Vous recevez des offres de chauffeurs et de flottes qui assurent ce trajet, avec leur véhicule et leur prix.', 'Pour un groupe ou beaucoup de bagages, choisissez un van (jusqu’à 7 passagers) ou un minibus.']]
      ],
      faq: [
        ['Comment réserver un chauffeur pour Brussels Airport ?', 'Publiez votre trajet sur Bleenr avec l’adresse de départ, l’aéroport comme arrivée (ou l’inverse), la date, l’heure et la gamme de véhicule. Vous recevez les offres de chauffeurs vérifiés et choisissez celle qui vous convient.'],
        ['Puis-je indiquer mon numéro de vol ?', 'Oui. Le numéro de vol est transmis à votre chauffeur avec la réservation, comme vos autres instructions.'],
        ['Le prix est-il fixé à l’avance ?', 'Oui. Vous acceptez un prix fixe, TVA comprise, au moment de la réservation : c’est celui que vous payez.']
      ]
    },
    en: {
      title: 'Brussels Airport chauffeur (Zaventem) | Bleenr',
      desc: 'Private chauffeur transfer to or from Brussels Airport in Zaventem. Get offers from verified chauffeurs, fixed price with VAT included, pay online.',
      short: 'Brussels Airport', eye: 'Airport transfer · Zaventem',
      h1: 'Private chauffeur for Brussels Airport (Zaventem)',
      lead: 'Arriving at or leaving from Brussels Airport? Post your transfer, compare offers from verified chauffeurs and book at a fixed price.',
      sections: [
        ['Your transfer to or from Zaventem', ['Brussels Airport is in Zaventem, about fifteen kilometres north-east of central Brussels. A private chauffeur saves you queuing for a taxi on arrival or leaving your car in the car park while you travel.', 'Add your flight number when you post the request: your chauffeur receives it with the booking, along with your instructions (luggage, child seat, reduced mobility…).']],
        ['From Brussels and all over Belgium', ['The transfer can start from your home, hotel or office, in Brussels as well as Antwerp, Ghent, Leuven, Liège or elsewhere in Belgium. You receive offers from chauffeurs and fleets covering the trip, with their vehicle and price.', 'For a group or a lot of luggage, choose a van (up to 7 passengers) or a minibus.']]
      ],
      faq: [
        ['How do I book a chauffeur for Brussels Airport?', 'Post your trip on Bleenr with your pickup address, the airport as drop-off (or the other way round), date, time and vehicle class. You receive offers from verified chauffeurs and choose the one that suits you.'],
        ['Can I add my flight number?', 'Yes. Your flight number is passed on to your chauffeur with the booking, like your other instructions.'],
        ['Is the price fixed in advance?', 'Yes. You accept a fixed price, VAT included, when you book: that is what you pay.']
      ]
    },
    es: {
      title: 'Chófer privado Brussels Airport (Zaventem) | Bleenr',
      desc: 'Traslado con chófer privado desde o hacia Brussels Airport en Zaventem. Reciba ofertas de chóferes verificados, precio fijo con IVA incluido, pago en línea.',
      short: 'Aeropuerto de Bruselas', eye: 'Traslado al aeropuerto · Zaventem',
      h1: 'Chófer privado para Brussels Airport (Zaventem)',
      lead: '¿Llega o sale del aeropuerto de Bruselas? Publique su traslado, compare las ofertas de chóferes verificados y reserve a precio fijo.',
      sections: [
        ['Su traslado desde o hacia Zaventem', ['Brussels Airport está en Zaventem, a unos quince kilómetros al noreste del centro de Bruselas. Un chófer privado le evita buscar un taxi al llegar o dejar su coche en el aparcamiento durante el viaje.', 'Indique su número de vuelo al publicar la solicitud: su chófer lo recibe con la reserva, junto con sus instrucciones (equipaje, silla infantil, movilidad reducida…).']],
        ['Desde Bruselas y toda Bélgica', ['El traslado puede salir de su domicilio, hotel u oficina, en Bruselas, Amberes, Gante, Lovaina, Lieja o en cualquier lugar de Bélgica. Recibe ofertas de chóferes y flotas que cubren el trayecto, con su vehículo y su precio.', 'Para un grupo o mucho equipaje, elija una van (hasta 7 pasajeros) o un minibús.']]
      ],
      faq: [
        ['¿Cómo reservo un chófer para Brussels Airport?', 'Publique su trayecto en Bleenr con la dirección de salida, el aeropuerto como llegada (o al revés), la fecha, la hora y la gama de vehículo. Recibe ofertas de chóferes verificados y elige la que le convenga.'],
        ['¿Puedo indicar mi número de vuelo?', 'Sí. Su número de vuelo se transmite a su chófer con la reserva, como el resto de sus instrucciones.'],
        ['¿El precio se fija de antemano?', 'Sí. Acepta un precio fijo, IVA incluido, al reservar: es el que paga.']
      ]
    }
  },

  // ───────────── Aéroport de Charleroi ─────────────
  {
    id: 'crl', img: 'service-aeroport.webp', prefill: { from: 'Brussels South Charleroi Airport, Rue des Frères Wright 8, 6041 Charleroi' },
    slug: { fr: 'chauffeur-prive-aeroport-charleroi', en: 'charleroi-airport-chauffeur', es: 'chofer-aeropuerto-charleroi' },
    fr: {
      title: 'Chauffeur privé aéroport de Charleroi | Bleenr',
      desc: 'Transfert en chauffeur privé depuis ou vers l’aéroport de Charleroi (Brussels South). Offres de chauffeurs vérifiés, prix fixe TVA comprise.',
      short: 'Aéroport de Charleroi', eye: 'Transfert aéroport · Charleroi',
      h1: 'Chauffeur privé pour l’aéroport de Charleroi',
      lead: 'Un vol depuis Brussels South Charleroi ? Réservez votre transfert porte à porte avec un chauffeur vérifié, à prix fixe.',
      sections: [
        ['Un aéroport éloigné de Bruxelles', ['L’aéroport de Charleroi se trouve à Gosselies, à une cinquantaine de kilomètres au sud de Bruxelles. Les vols tôt le matin ou tard le soir rendent souvent les transports en commun peu pratiques : un chauffeur privé vous conduit directement à l’aérogare.', 'Précisez votre numéro de vol et vos bagages lors de la demande : votre chauffeur reçoit toutes ces informations avec la réservation.']],
        ['Depuis la Wallonie, Bruxelles ou la Flandre', ['Charleroi, Namur, Mons, Bruxelles, Louvain-la-Neuve… vous indiquez votre adresse de départ et recevez les offres de chauffeurs et de flottes qui assurent ce trajet. Vous comparez le prix, le véhicule et les avis avant de choisir.']]
      ],
      faq: [
        ['Comment aller à l’aéroport de Charleroi en chauffeur privé ?', 'Publiez votre trajet sur Bleenr avec votre adresse de départ et l’aéroport de Charleroi comme arrivée. Vous recevez les offres de chauffeurs vérifiés, choisissez et payez en ligne.'],
        ['Puis-je réserver pour un vol très tôt le matin ?', 'Oui. Indiquez l’heure de prise en charge souhaitée : les chauffeurs qui peuvent assurer ce créneau vous font une offre.'],
        ['Quels véhicules sont disponibles ?', 'Cinq gammes : Economy, Business, Première, Van jusqu’à 7 passagers, et Minibus et autocar pour les groupes de 8 à 50 passagers.']
      ]
    },
    en: {
      title: 'Charleroi Airport chauffeur | Bleenr',
      desc: 'Private chauffeur transfer to or from Charleroi Airport (Brussels South). Offers from verified chauffeurs, fixed price with VAT included.',
      short: 'Charleroi Airport', eye: 'Airport transfer · Charleroi',
      h1: 'Private chauffeur for Charleroi Airport',
      lead: 'Flying from Brussels South Charleroi? Book your door-to-door transfer with a verified chauffeur at a fixed price.',
      sections: [
        ['An airport far from Brussels', ['Charleroi Airport is in Gosselies, about fifty kilometres south of Brussels. Early-morning and late-evening flights often make public transport impractical: a private chauffeur takes you straight to the terminal.', 'Add your flight number and luggage when you post the request: your chauffeur receives all this information with the booking.']],
        ['From Wallonia, Brussels or Flanders', ['Charleroi, Namur, Mons, Brussels, Louvain-la-Neuve… enter your pickup address and receive offers from chauffeurs and fleets covering the trip. Compare price, vehicle and reviews before you choose.']]
      ],
      faq: [
        ['How do I get to Charleroi Airport with a private chauffeur?', 'Post your trip on Bleenr with your pickup address and Charleroi Airport as the drop-off. You receive offers from verified chauffeurs, choose one and pay online.'],
        ['Can I book for a very early flight?', 'Yes. Enter the pickup time you need: chauffeurs who can cover that slot send you an offer.'],
        ['Which vehicles are available?', 'Five classes: Economy, Business, First, Van for up to 7 passengers, and Minibus and coach for groups of 8 to 50 passengers.']
      ]
    },
    es: {
      title: 'Chófer privado aeropuerto de Charleroi | Bleenr',
      desc: 'Traslado con chófer privado desde o hacia el aeropuerto de Charleroi (Brussels South). Ofertas de chóferes verificados, precio fijo con IVA incluido.',
      short: 'Aeropuerto de Charleroi', eye: 'Traslado al aeropuerto · Charleroi',
      h1: 'Chófer privado para el aeropuerto de Charleroi',
      lead: '¿Vuela desde Brussels South Charleroi? Reserve su traslado puerta a puerta con un chófer verificado, a precio fijo.',
      sections: [
        ['Un aeropuerto lejos de Bruselas', ['El aeropuerto de Charleroi está en Gosselies, a unos cincuenta kilómetros al sur de Bruselas. Los vuelos muy temprano o muy tarde suelen complicar el transporte público: un chófer privado le lleva directamente a la terminal.', 'Indique su número de vuelo y su equipaje al publicar la solicitud: su chófer recibe toda esta información con la reserva.']],
        ['Desde Valonia, Bruselas o Flandes', ['Charleroi, Namur, Mons, Bruselas, Louvain-la-Neuve… indique su dirección de salida y reciba las ofertas de chóferes y flotas que cubren el trayecto. Compare precio, vehículo y opiniones antes de elegir.']]
      ],
      faq: [
        ['¿Cómo ir al aeropuerto de Charleroi con chófer privado?', 'Publique su trayecto en Bleenr con su dirección de salida y el aeropuerto de Charleroi como llegada. Recibe ofertas de chóferes verificados, elige y paga en línea.'],
        ['¿Puedo reservar para un vuelo muy temprano?', 'Sí. Indique la hora de recogida deseada: los chóferes que pueden cubrir esa franja le envían una oferta.'],
        ['¿Qué vehículos hay disponibles?', 'Cinco gamas: Economy, Business, Primera, Van hasta 7 pasajeros, y Minibús y autocar para grupos de 8 a 50 pasajeros.']
      ]
    }
  },

  // ───────────── Bruxelles ─────────────
  {
    id: 'bxl', img: 'service-ville.webp', prefill: { from: 'Bruxelles, Belgique' },
    slug: { fr: 'chauffeur-prive-bruxelles', en: 'private-chauffeur-brussels', es: 'chofer-privado-bruselas' },
    fr: {
      title: 'Chauffeur privé à Bruxelles | Bleenr',
      desc: 'Réservez un chauffeur privé à Bruxelles : rendez-vous d’affaires, gares, aéroports, soirées. Offres de chauffeurs vérifiés, prix fixe TVA comprise.',
      short: 'Bruxelles', eye: 'Chauffeur privé · Bruxelles',
      h1: 'Chauffeur privé à Bruxelles',
      lead: 'Rendez-vous d’affaires, gare du Midi, institutions européennes ou soirée : réservez un chauffeur vérifié à Bruxelles, au prix que vous acceptez.',
      sections: [
        ['Se déplacer dans Bruxelles sans contrainte', ['Entre les embouteillages, le stationnement et les rendez-vous qui s’enchaînent, un chauffeur privé vous laisse travailler ou vous reposer pendant le trajet. Vous indiquez l’adresse de départ et d’arrivée, l’heure et la gamme de véhicule souhaitée.', 'Pour une journée de rendez-vous, la mise à disposition à l’heure garde le même chauffeur avec vous aussi longtemps que nécessaire.']],
        ['Gares et aéroports', ['Gare du Midi, gare Centrale, gare du Nord, Brussels Airport ou l’aéroport de Charleroi : vous pouvez indiquer votre numéro de train ou de vol, qui est transmis à votre chauffeur avec la réservation.']]
      ],
      faq: [
        ['Comment réserver un chauffeur privé à Bruxelles ?', 'Publiez votre trajet sur Bleenr : départ, arrivée ou durée, date, heure et gamme de véhicule. Des chauffeurs et des flottes vérifiés vous envoient leurs offres, vous choisissez et payez en ligne.'],
        ['Puis-je réserver un chauffeur pour plusieurs heures ?', 'Oui, avec la mise à disposition : vous indiquez le lieu de prise en charge et la durée, le chauffeur reste avec vous pendant ce temps.'],
        ['Publier une demande est-il payant ?', 'Non. Publier une demande et recevoir des offres est gratuit et sans engagement.']
      ]
    },
    en: {
      title: 'Private chauffeur in Brussels | Bleenr',
      desc: 'Book a private chauffeur in Brussels: business meetings, stations, airports, evenings out. Offers from verified chauffeurs, fixed price with VAT included.',
      short: 'Brussels', eye: 'Private chauffeur · Brussels',
      h1: 'Private chauffeur in Brussels',
      lead: 'Business meeting, Brussels-Midi station, the European institutions or an evening out: book a verified chauffeur in Brussels at the price you accept.',
      sections: [
        ['Getting around Brussels with ease', ['Between traffic jams, parking and back-to-back meetings, a private chauffeur lets you work or rest during the ride. Enter your pickup and drop-off addresses, the time and the vehicle class you want.', 'For a day of meetings, hourly hire keeps the same chauffeur with you for as long as you need.']],
        ['Stations and airports', ['Brussels-Midi, Brussels-Central, Brussels-North, Brussels Airport or Charleroi Airport: you can add your train or flight number, which is passed on to your chauffeur with the booking.']]
      ],
      faq: [
        ['How do I book a private chauffeur in Brussels?', 'Post your trip on Bleenr: pickup, drop-off or duration, date, time and vehicle class. Verified chauffeurs and fleets send you their offers; you choose and pay online.'],
        ['Can I book a chauffeur for several hours?', 'Yes, with hourly hire: enter the pickup location and duration, and the chauffeur stays with you for that time.'],
        ['Is posting a request free?', 'Yes. Posting a request and receiving offers is free and without commitment.']
      ]
    },
    es: {
      title: 'Chófer privado en Bruselas | Bleenr',
      desc: 'Reserve un chófer privado en Bruselas: reuniones de negocios, estaciones, aeropuertos, veladas. Ofertas de chóferes verificados, precio fijo con IVA incluido.',
      short: 'Bruselas', eye: 'Chófer privado · Bruselas',
      h1: 'Chófer privado en Bruselas',
      lead: 'Reunión de negocios, estación de Bruselas-Midi, instituciones europeas o una velada: reserve un chófer verificado en Bruselas al precio que acepte.',
      sections: [
        ['Moverse por Bruselas sin complicaciones', ['Entre atascos, aparcamiento y reuniones seguidas, un chófer privado le permite trabajar o descansar durante el trayecto. Indique la dirección de salida y de llegada, la hora y la gama de vehículo deseada.', 'Para un día de reuniones, la disposición por horas mantiene al mismo chófer con usted el tiempo que necesite.']],
        ['Estaciones y aeropuertos', ['Bruselas-Midi, Bruselas-Central, Bruselas-Norte, Brussels Airport o el aeropuerto de Charleroi: puede indicar su número de tren o de vuelo, que se transmite a su chófer con la reserva.']]
      ],
      faq: [
        ['¿Cómo reservo un chófer privado en Bruselas?', 'Publique su trayecto en Bleenr: salida, llegada o duración, fecha, hora y gama de vehículo. Chóferes y flotas verificados le envían sus ofertas; usted elige y paga en línea.'],
        ['¿Puedo reservar un chófer para varias horas?', 'Sí, con la disposición por horas: indique el lugar de recogida y la duración, y el chófer se queda con usted durante ese tiempo.'],
        ['¿Publicar una solicitud tiene coste?', 'No. Publicar una solicitud y recibir ofertas es gratuito y sin compromiso.']
      ]
    }
  },

  // ───────────── Anvers ─────────────
  {
    id: 'anr', img: 'service-ville.webp', prefill: { from: 'Anvers, Belgique' },
    slug: { fr: 'chauffeur-prive-anvers', en: 'private-chauffeur-antwerp', es: 'chofer-privado-amberes' },
    fr: {
      title: 'Chauffeur privé à Anvers | Bleenr',
      desc: 'Chauffeur privé à Anvers : transferts vers Brussels Airport, gare d’Anvers-Central, port et rendez-vous d’affaires. Offres de chauffeurs vérifiés, prix fixe.',
      short: 'Anvers', eye: 'Chauffeur privé · Anvers',
      h1: 'Chauffeur privé à Anvers',
      lead: 'Depuis Anvers vers l’aéroport, un rendez-vous ou une autre ville de Belgique : comparez les offres de chauffeurs vérifiés et réservez à prix fixe.',
      sections: [
        ['Anvers, ville d’affaires et de port', ['Rendez-vous dans le quartier du port, visite au quartier du diamant ou arrivée à la gare d’Anvers-Central : un chauffeur privé vous conduit d’une adresse à l’autre sans chercher de place pour vous garer.', 'Pour une journée chargée, choisissez la mise à disposition : le même chauffeur reste avec vous pendant la durée choisie.']],
        ['Vers Brussels Airport et le reste du pays', ['Anvers est à une quarantaine de kilomètres de Brussels Airport. Indiquez votre numéro de vol avec la demande : il est transmis à votre chauffeur avec la réservation. Les trajets vers Bruxelles, Gand ou les Pays-Bas tout proches se réservent de la même façon.']]
      ],
      faq: [
        ['Comment réserver un chauffeur privé à Anvers ?', 'Publiez votre trajet sur Bleenr avec votre adresse à Anvers, la destination, la date et l’heure. Des chauffeurs et des flottes vérifiés vous envoient leurs offres.'],
        ['Puis-je réserver un transfert d’Anvers vers Brussels Airport ?', 'Oui. Indiquez l’aéroport comme arrivée et votre numéro de vol : votre chauffeur reçoit ces informations avec la réservation.'],
        ['Comment se passe le paiement ?', 'Par carte bancaire en ligne, sur une page de paiement sécurisée. Le reçu et la facture vous sont envoyés par e-mail.']
      ]
    },
    en: {
      title: 'Private chauffeur in Antwerp | Bleenr',
      desc: 'Private chauffeur in Antwerp: transfers to Brussels Airport, Antwerp-Central station, the port and business meetings. Offers from verified chauffeurs, fixed price.',
      short: 'Antwerp', eye: 'Private chauffeur · Antwerp',
      h1: 'Private chauffeur in Antwerp',
      lead: 'From Antwerp to the airport, a meeting or another Belgian city: compare offers from verified chauffeurs and book at a fixed price.',
      sections: [
        ['Antwerp, a city of business and port', ['A meeting in the port area, a visit to the diamond district or an arrival at Antwerp-Central station: a private chauffeur takes you from one address to the next without hunting for a parking space.', 'For a busy day, choose hourly hire: the same chauffeur stays with you for the duration you choose.']],
        ['To Brussels Airport and the rest of the country', ['Antwerp is about forty kilometres from Brussels Airport. Add your flight number to the request: it is passed on to your chauffeur with the booking. Trips to Brussels, Ghent or the nearby Netherlands are booked the same way.']]
      ],
      faq: [
        ['How do I book a private chauffeur in Antwerp?', 'Post your trip on Bleenr with your Antwerp address, the destination, date and time. Verified chauffeurs and fleets send you their offers.'],
        ['Can I book a transfer from Antwerp to Brussels Airport?', 'Yes. Enter the airport as drop-off and your flight number: your chauffeur receives this information with the booking.'],
        ['How does payment work?', 'By card online, on a secure payment page. Your receipt and invoice are sent by e-mail.']
      ]
    },
    es: {
      title: 'Chófer privado en Amberes | Bleenr',
      desc: 'Chófer privado en Amberes: traslados a Brussels Airport, estación de Amberes-Central, puerto y reuniones de negocios. Ofertas de chóferes verificados, precio fijo.',
      short: 'Amberes', eye: 'Chófer privado · Amberes',
      h1: 'Chófer privado en Amberes',
      lead: 'Desde Amberes al aeropuerto, a una reunión o a otra ciudad de Bélgica: compare las ofertas de chóferes verificados y reserve a precio fijo.',
      sections: [
        ['Amberes, ciudad de negocios y de puerto', ['Una reunión en la zona del puerto, una visita al barrio de los diamantes o una llegada a la estación de Amberes-Central: un chófer privado le lleva de una dirección a otra sin buscar aparcamiento.', 'Para un día cargado, elija la disposición por horas: el mismo chófer se queda con usted durante el tiempo elegido.']],
        ['Hacia Brussels Airport y el resto del país', ['Amberes está a unos cuarenta kilómetros de Brussels Airport. Indique su número de vuelo en la solicitud: se transmite a su chófer con la reserva. Los trayectos a Bruselas, Gante o los cercanos Países Bajos se reservan de la misma manera.']]
      ],
      faq: [
        ['¿Cómo reservo un chófer privado en Amberes?', 'Publique su trayecto en Bleenr con su dirección en Amberes, el destino, la fecha y la hora. Chóferes y flotas verificados le envían sus ofertas.'],
        ['¿Puedo reservar un traslado de Amberes a Brussels Airport?', 'Sí. Indique el aeropuerto como llegada y su número de vuelo: su chófer recibe esta información con la reserva.'],
        ['¿Cómo se paga?', 'Con tarjeta en línea, en una página de pago segura. El recibo y la factura se envían por correo electrónico.']
      ]
    }
  },

  // ───────────── Gand ─────────────
  {
    id: 'gnt', img: 'service-ville.webp', prefill: { from: 'Gand, Belgique' },
    slug: { fr: 'chauffeur-prive-gand', en: 'private-chauffeur-ghent', es: 'chofer-privado-gante' },
    fr: {
      title: 'Chauffeur privé à Gand | Bleenr',
      desc: 'Chauffeur privé à Gand : transferts vers les aéroports, gare de Gand-Saint-Pierre, rendez-vous et événements. Offres de chauffeurs vérifiés, prix fixe TVA comprise.',
      short: 'Gand', eye: 'Chauffeur privé · Gand',
      h1: 'Chauffeur privé à Gand',
      lead: 'Au départ de Gand ou pour vous y rendre : publiez votre trajet, recevez les offres de chauffeurs vérifiés et choisissez la vôtre.',
      sections: [
        ['Un centre historique où l’on circule peu', ['Le centre de Gand est en grande partie fermé à la circulation automobile. Votre chauffeur vous prend ou vous dépose à l’adresse accessible la plus proche que vous indiquez, à votre hôtel, à votre bureau ou à la gare de Gand-Saint-Pierre.', 'Ajoutez vos instructions dans la demande (point de rendez-vous précis, bagages, siège enfant) : elles sont transmises à votre chauffeur.']],
        ['Vers les aéroports et les autres villes', ['Brussels Airport, l’aéroport de Charleroi, Bruxelles, Bruges ou Anvers : les trajets au départ de Gand se réservent en quelques minutes. Pour un mariage ou un séminaire, un minibus peut transporter jusqu’à 50 invités en un seul véhicule.']]
      ],
      faq: [
        ['Comment réserver un chauffeur privé à Gand ?', 'Publiez votre trajet sur Bleenr avec votre adresse de départ, la destination, la date et l’heure. Vous recevez les offres de chauffeurs vérifiés et payez en ligne celle que vous choisissez.'],
        ['Le chauffeur peut-il venir me chercher dans le centre de Gand ?', 'Indiquez l’adresse et un point de rendez-vous précis dans vos instructions : le chauffeur vous attend à l’endroit accessible convenu.'],
        ['Les chauffeurs sont-ils vérifiés ?', 'Oui. Licence, assurance et contrôle technique sont contrôlés pour chaque chauffeur et chaque flotte partenaire.']
      ]
    },
    en: {
      title: 'Private chauffeur in Ghent | Bleenr',
      desc: 'Private chauffeur in Ghent: transfers to airports, Ghent-Sint-Pieters station, meetings and events. Offers from verified chauffeurs, fixed price with VAT included.',
      short: 'Ghent', eye: 'Private chauffeur · Ghent',
      h1: 'Private chauffeur in Ghent',
      lead: 'Leaving from Ghent or heading there: post your trip, receive offers from verified chauffeurs and choose yours.',
      sections: [
        ['A historic centre with little traffic', ['Much of Ghent’s centre is closed to cars. Your chauffeur picks you up or drops you off at the nearest accessible address you give, at your hotel, your office or Ghent-Sint-Pieters station.', 'Add your instructions to the request (exact meeting point, luggage, child seat): they are passed on to your chauffeur.']],
        ['To the airports and other cities', ['Brussels Airport, Charleroi Airport, Brussels, Bruges or Antwerp: trips from Ghent are booked in minutes. For a wedding or a seminar, a minibus or coach can carry up to 50 guests in a single vehicle.']]
      ],
      faq: [
        ['How do I book a private chauffeur in Ghent?', 'Post your trip on Bleenr with your pickup address, destination, date and time. You receive offers from verified chauffeurs and pay online for the one you choose.'],
        ['Can the chauffeur pick me up in Ghent city centre?', 'Give the address and an exact meeting point in your instructions: the chauffeur waits for you at the agreed accessible spot.'],
        ['Are the chauffeurs verified?', 'Yes. Licence, insurance and roadworthiness are checked for every partner chauffeur and fleet.']
      ]
    },
    es: {
      title: 'Chófer privado en Gante | Bleenr',
      desc: 'Chófer privado en Gante: traslados a los aeropuertos, estación de Gante-Sint-Pieters, reuniones y eventos. Ofertas de chóferes verificados, precio fijo con IVA incluido.',
      short: 'Gante', eye: 'Chófer privado · Gante',
      h1: 'Chófer privado en Gante',
      lead: 'Saliendo de Gante o con destino a la ciudad: publique su trayecto, reciba las ofertas de chóferes verificados y elija la suya.',
      sections: [
        ['Un centro histórico con poco tráfico', ['Gran parte del centro de Gante está cerrado a los coches. Su chófer le recoge o le deja en la dirección accesible más cercana que indique, en su hotel, su oficina o la estación de Gante-Sint-Pieters.', 'Añada sus instrucciones a la solicitud (punto de encuentro exacto, equipaje, silla infantil): se transmiten a su chófer.']],
        ['Hacia los aeropuertos y otras ciudades', ['Brussels Airport, el aeropuerto de Charleroi, Bruselas, Brujas o Amberes: los trayectos desde Gante se reservan en minutos. Para una boda o un seminario, un minibús o autocar puede llevar hasta 50 invitados en un solo vehículo.']]
      ],
      faq: [
        ['¿Cómo reservo un chófer privado en Gante?', 'Publique su trayecto en Bleenr con su dirección de salida, el destino, la fecha y la hora. Recibe ofertas de chóferes verificados y paga en línea la que elija.'],
        ['¿Puede el chófer recogerme en el centro de Gante?', 'Indique la dirección y un punto de encuentro exacto en sus instrucciones: el chófer le espera en el lugar accesible acordado.'],
        ['¿Los chóferes están verificados?', 'Sí. Licencia, seguro e inspección técnica se comprueban para cada chófer y flota asociada.']
      ]
    }
  },

  // ───────────── Liège ─────────────
  {
    id: 'lge', img: 'service-ville.webp', prefill: { from: 'Liège, Belgique' },
    slug: { fr: 'chauffeur-prive-liege', en: 'private-chauffeur-liege', es: 'chofer-privado-lieja' },
    fr: {
      title: 'Chauffeur privé à Liège | Bleenr',
      desc: 'Chauffeur privé à Liège : transferts vers Brussels Airport et Charleroi, gare de Liège-Guillemins, rendez-vous et événements. Chauffeurs vérifiés, prix fixe.',
      short: 'Liège', eye: 'Chauffeur privé · Liège',
      h1: 'Chauffeur privé à Liège',
      lead: 'De Liège vers un aéroport, une autre ville ou un événement : recevez les offres de chauffeurs vérifiés et réservez au prix que vous acceptez.',
      sections: [
        ['Liège et la gare des Guillemins', ['Arrivée en train à Liège-Guillemins, rendez-vous professionnel ou soirée en ville : indiquez votre numéro de train dans la demande, il est transmis à votre chauffeur avec la réservation.', 'La mise à disposition permet de garder un chauffeur avec vous pendant plusieurs heures, par exemple pour une série de visites ou un événement.']],
        ['Vers les aéroports et au-delà', ['Brussels Airport et l’aéroport de Charleroi sont à environ une heure de route de Liège. Un transfert en chauffeur privé, réservé à prix fixe, vous évite les correspondances avec vos bagages. Les trajets vers Bruxelles, Namur, l’Allemagne ou les Pays-Bas voisins se réservent de la même manière.']]
      ],
      faq: [
        ['Comment réserver un chauffeur privé à Liège ?', 'Publiez votre trajet sur Bleenr : adresse de départ, destination ou durée, date et heure. Des chauffeurs et des flottes vérifiés vous envoient leurs offres.'],
        ['Puis-je réserver un transfert de Liège vers Brussels Airport ?', 'Oui. Indiquez l’aéroport comme arrivée et votre numéro de vol : votre chauffeur reçoit ces informations avec la réservation.'],
        ['Le prix peut-il changer après la réservation ?', 'Non. Vous acceptez un prix fixe, TVA comprise. Seule une modification de la course peut entraîner un changement de prix si nécessaire, que vous acceptez ou refusez.']
      ]
    },
    en: {
      title: 'Private chauffeur in Liège | Bleenr',
      desc: 'Private chauffeur in Liège: transfers to Brussels Airport and Charleroi, Liège-Guillemins station, meetings and events. Verified chauffeurs, fixed price.',
      short: 'Liège', eye: 'Private chauffeur · Liège',
      h1: 'Private chauffeur in Liège',
      lead: 'From Liège to an airport, another city or an event: receive offers from verified chauffeurs and book at the price you accept.',
      sections: [
        ['Liège and Guillemins station', ['Arriving by train at Liège-Guillemins, a business meeting or an evening in town: add your train number to the request; it is passed on to your chauffeur with the booking.', 'Hourly hire keeps a chauffeur with you for several hours, for example for a series of visits or an event.']],
        ['To the airports and beyond', ['Brussels Airport and Charleroi Airport are about an hour’s drive from Liège. A private chauffeur transfer booked at a fixed price spares you changing trains with your luggage. Trips to Brussels, Namur or neighbouring Germany and the Netherlands are booked the same way.']]
      ],
      faq: [
        ['How do I book a private chauffeur in Liège?', 'Post your trip on Bleenr: pickup address, destination or duration, date and time. Verified chauffeurs and fleets send you their offers.'],
        ['Can I book a transfer from Liège to Brussels Airport?', 'Yes. Enter the airport as drop-off and your flight number: your chauffeur receives this information with the booking.'],
        ['Can the price change after booking?', 'No. You accept a fixed price, VAT included. Only a change to the ride can lead to a price change if necessary, which you accept or decline.']
      ]
    },
    es: {
      title: 'Chófer privado en Lieja | Bleenr',
      desc: 'Chófer privado en Lieja: traslados a Brussels Airport y Charleroi, estación de Lieja-Guillemins, reuniones y eventos. Chóferes verificados, precio fijo.',
      short: 'Lieja', eye: 'Chófer privado · Lieja',
      h1: 'Chófer privado en Lieja',
      lead: 'De Lieja a un aeropuerto, otra ciudad o un evento: reciba ofertas de chóferes verificados y reserve al precio que acepte.',
      sections: [
        ['Lieja y la estación de Guillemins', ['Llegada en tren a Lieja-Guillemins, una reunión de trabajo o una velada en la ciudad: indique su número de tren en la solicitud; se transmite a su chófer con la reserva.', 'La disposición por horas mantiene a un chófer con usted durante varias horas, por ejemplo para una serie de visitas o un evento.']],
        ['Hacia los aeropuertos y más allá', ['Brussels Airport y el aeropuerto de Charleroi están a una hora en coche de Lieja aproximadamente. Un traslado con chófer privado a precio fijo le evita transbordos con el equipaje. Los trayectos a Bruselas, Namur o las vecinas Alemania y Países Bajos se reservan de la misma manera.']]
      ],
      faq: [
        ['¿Cómo reservo un chófer privado en Lieja?', 'Publique su trayecto en Bleenr: dirección de salida, destino o duración, fecha y hora. Chóferes y flotas verificados le envían sus ofertas.'],
        ['¿Puedo reservar un traslado de Lieja a Brussels Airport?', 'Sí. Indique el aeropuerto como llegada y su número de vuelo: su chófer recibe esta información con la reserva.'],
        ['¿Puede cambiar el precio después de reservar?', 'No. Acepta un precio fijo, IVA incluido. Solo una modificación del trayecto puede conllevar un cambio de precio si es necesario, que usted acepta o rechaza.']
      ]
    }
  },

  // ───────────── Mise à disposition ─────────────
  {
    id: 'hour', img: 'service-heure.webp', prefill: { mode: 'heure' },
    slug: { fr: 'chauffeur-mise-a-disposition', en: 'hourly-chauffeur-hire', es: 'chofer-por-horas' },
    fr: {
      title: 'Chauffeur privé à l’heure, mise à disposition | Bleenr',
      desc: 'Mise à disposition d’un chauffeur privé à l’heure en Belgique : rendez-vous, visites, journées d’affaires. Offres de chauffeurs vérifiés, prix fixe TVA comprise.',
      short: 'Mise à disposition', eye: 'Chauffeur à l’heure',
      h1: 'Chauffeur privé à l’heure (mise à disposition)',
      lead: 'Un chauffeur et son véhicule à votre disposition pour la durée de votre choix : idéal pour une journée de rendez-vous, des visites ou une soirée.',
      sections: [
        ['Comment fonctionne la mise à disposition', ['Vous indiquez le lieu de prise en charge, la date, l’heure de début et la durée souhaitée. Le chauffeur reste avec vous pendant ce temps et vous conduit où vous le souhaitez, sans devoir réserver chaque trajet séparément.', 'Vous recevez les offres de chauffeurs et de flottes vérifiés, avec un prix fixe pour toute la durée, TVA comprise.']],
        ['Pour qui ?', ['Les journées d’affaires avec plusieurs rendez-vous, l’accueil de clients ou de partenaires, les visites touristiques, les soirées et les événements. Si votre programme combine des transferts simples et des heures de mise à disposition, le trajet mixte permet de tout réserver en une seule demande.']]
      ],
      faq: [
        ['Qu’est-ce qu’une mise à disposition ?', 'C’est la réservation d’un chauffeur et de son véhicule pour une durée donnée, à partir d’un lieu de prise en charge. Le chauffeur reste avec vous pendant ce temps.'],
        ['Le prix couvre-t-il toute la durée ?', 'Oui. Vous acceptez un prix fixe, TVA comprise, pour la durée réservée. Seule une modification de la course peut entraîner un changement de prix si nécessaire, que vous acceptez ou refusez.'],
        ['Puis-je combiner transferts et mise à disposition ?', 'Oui, avec le trajet mixte : vous enchaînez dans une même demande des transferts simples et des heures de mise à disposition.']
      ]
    },
    en: {
      title: 'Hourly chauffeur hire in Belgium | Bleenr',
      desc: 'Hire a private chauffeur by the hour in Belgium: meetings, sightseeing, business days. Offers from verified chauffeurs, fixed price with VAT included.',
      short: 'Hourly hire', eye: 'Chauffeur by the hour',
      h1: 'Hourly chauffeur hire',
      lead: 'A chauffeur and vehicle at your disposal for as long as you choose: ideal for a day of meetings, sightseeing or an evening out.',
      sections: [
        ['How hourly hire works', ['Enter the pickup location, date, start time and duration you need. The chauffeur stays with you during that time and drives you wherever you want, without booking each trip separately.', 'You receive offers from verified chauffeurs and fleets, with a fixed price for the whole duration, VAT included.']],
        ['Who is it for?', ['Business days with several meetings, welcoming clients or partners, sightseeing, evenings out and events. If your schedule combines simple transfers and hours of hire, a mixed trip lets you book everything in a single request.']]
      ],
      faq: [
        ['What is hourly hire?', 'It means booking a chauffeur and vehicle for a set duration from a pickup location. The chauffeur stays with you during that time.'],
        ['Does the price cover the whole duration?', 'Yes. You accept a fixed price, VAT included, for the booked duration. Only a change to the ride can lead to a price change if necessary, which you accept or decline.'],
        ['Can I combine transfers and hourly hire?', 'Yes, with a mixed trip: you chain simple transfers and hours of hire in a single request.']
      ]
    },
    es: {
      title: 'Chófer privado por horas en Bélgica | Bleenr',
      desc: 'Chófer privado a disposición por horas en Bélgica: reuniones, visitas, jornadas de negocios. Ofertas de chóferes verificados, precio fijo con IVA incluido.',
      short: 'Disposición por horas', eye: 'Chófer por horas',
      h1: 'Chófer privado por horas (disposición)',
      lead: 'Un chófer y su vehículo a su disposición el tiempo que elija: ideal para un día de reuniones, visitas o una velada.',
      sections: [
        ['Cómo funciona la disposición', ['Indique el lugar de recogida, la fecha, la hora de inicio y la duración deseada. El chófer se queda con usted durante ese tiempo y le lleva adonde quiera, sin reservar cada trayecto por separado.', 'Recibe ofertas de chóferes y flotas verificados, con un precio fijo para toda la duración, IVA incluido.']],
        ['¿Para quién?', ['Jornadas de negocios con varias reuniones, recepción de clientes o socios, visitas turísticas, veladas y eventos. Si su programa combina traslados simples y horas de disposición, el trayecto mixto le permite reservarlo todo en una sola solicitud.']]
      ],
      faq: [
        ['¿Qué es la disposición por horas?', 'Es la reserva de un chófer y su vehículo durante un tiempo determinado, desde un lugar de recogida. El chófer se queda con usted durante ese tiempo.'],
        ['¿El precio cubre toda la duración?', 'Sí. Acepta un precio fijo, IVA incluido, para la duración reservada. Solo una modificación del trayecto puede conllevar un cambio de precio si es necesario, que usted acepta o rechaza.'],
        ['¿Puedo combinar traslados y disposición?', 'Sí, con el trayecto mixto: encadena en una misma solicitud traslados simples y horas de disposición.']
      ]
    }
  },

  // ───────────── Événements ─────────────
  {
    id: 'event', img: 'service-evenement.webp', prefill: {},
    slug: { fr: 'chauffeur-evenement', en: 'event-chauffeur', es: 'chofer-eventos' },
    fr: {
      title: 'Chauffeurs pour événements, mariages et séminaires | Bleenr',
      desc: 'Transport de vos invités en Belgique : mariages, séminaires, congrès, soirées. Plusieurs véhicules, minibus et autocars jusqu’à 50 passagers, chauffeurs vérifiés.',
      short: 'Événements', eye: 'Mariages · séminaires · soirées',
      h1: 'Chauffeurs pour vos événements',
      lead: 'Mariage, séminaire, congrès ou soirée d’entreprise : organisez le transport de vos invités avec un ou plusieurs véhicules, réservés en une seule demande.',
      sections: [
        ['Plusieurs véhicules, une seule demande', ['La demande « Événement » est pensée pour les organisateurs qui ont besoin de plusieurs véhicules : navettes entre l’hôtel et le lieu de réception, accueil des invités à la gare ou à l’aéroport, retours en fin de soirée.', 'Vous suivez toutes les courses de l’événement au même endroit, avec les chauffeurs, les véhicules et les horaires.']],
        ['Du van à l’autocar', ['Selon le nombre d’invités, choisissez des berlines Business ou Première pour les mariés et les intervenants, des vans jusqu’à 7 passagers, ou des minibus et autocars pour les groupes de 8 à 50 passagers.']]
      ],
      faq: [
        ['Puis-je réserver plusieurs véhicules pour un même événement ?', 'Oui. La demande « Événement » regroupe toutes les courses de votre événement, avec autant de véhicules que nécessaire.'],
        ['Quels véhicules pour un groupe ?', 'Des vans jusqu’à 7 passagers, et des minibus et autocars pour les groupes de 8 à 50 passagers.'],
        ['Comment se passe le paiement ?', 'Par carte bancaire en ligne, sur une page de paiement sécurisée. Le reçu et la facture vous sont envoyés par e-mail.']
      ]
    },
    en: {
      title: 'Event chauffeurs: weddings, seminars, parties | Bleenr',
      desc: 'Transport for your guests in Belgium: weddings, seminars, conferences, parties. Several vehicles, minibuses and coaches for up to 50 passengers, verified chauffeurs.',
      short: 'Events', eye: 'Weddings · seminars · parties',
      h1: 'Chauffeurs for your events',
      lead: 'Wedding, seminar, conference or company party: organise transport for your guests with one or several vehicles, booked in a single request.',
      sections: [
        ['Several vehicles, one request', ['The “Event” request is designed for organisers who need several vehicles: shuttles between the hotel and the venue, welcoming guests at the station or airport, rides home at the end of the evening.', 'You follow all the event’s rides in one place, with the chauffeurs, vehicles and times.']],
        ['From vans to coaches', ['Depending on the number of guests, choose Business or First saloons for the couple and speakers, vans for up to 7 passengers, or minibuses and coaches for groups of 8 to 50 passengers.']]
      ],
      faq: [
        ['Can I book several vehicles for one event?', 'Yes. The “Event” request groups all your event’s rides, with as many vehicles as you need.'],
        ['Which vehicles for a group?', 'Vans for up to 7 passengers, and minibuses and coaches for groups of 8 to 50 passengers.'],
        ['How does payment work?', 'By card online, on a secure payment page. Your receipt and invoice are sent by e-mail.']
      ]
    },
    es: {
      title: 'Chóferes para eventos, bodas y seminarios | Bleenr',
      desc: 'Transporte para sus invitados en Bélgica: bodas, seminarios, congresos, fiestas. Varios vehículos, minibuses y autocares hasta 50 pasajeros, chóferes verificados.',
      short: 'Eventos', eye: 'Bodas · seminarios · fiestas',
      h1: 'Chóferes para sus eventos',
      lead: 'Boda, seminario, congreso o fiesta de empresa: organice el transporte de sus invitados con uno o varios vehículos, reservados en una sola solicitud.',
      sections: [
        ['Varios vehículos, una sola solicitud', ['La solicitud «Evento» está pensada para organizadores que necesitan varios vehículos: lanzaderas entre el hotel y el lugar de celebración, recepción de invitados en la estación o el aeropuerto, regresos al final de la velada.', 'Sigue todos los trayectos del evento en un mismo lugar, con los chóferes, los vehículos y los horarios.']],
        ['De la van al autocar', ['Según el número de invitados, elija berlinas Business o Primera para los novios y los ponentes, vans hasta 7 pasajeros, o minibuses y autocares para grupos de 8 a 50 pasajeros.']]
      ],
      faq: [
        ['¿Puedo reservar varios vehículos para un mismo evento?', 'Sí. La solicitud «Evento» agrupa todos los trayectos de su evento, con tantos vehículos como necesite.'],
        ['¿Qué vehículos para un grupo?', 'Vans hasta 7 pasajeros, y minibuses y autocares para grupos de 8 a 50 pasajeros.'],
        ['¿Cómo se paga?', 'Con tarjeta en línea, en una página de pago segura. El recibo y la factura se envían por correo electrónico.']
      ]
    }
  }
];
