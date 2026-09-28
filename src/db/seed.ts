import type { Template } from './schema';

/**
 * Default schedules are a starting point, not advice: April (clients), August
 * (clients and prospects), November (everyone), February (prospects).
 * Users set their own months in Settings → Templates.
 *
 * Built-in templates, one per family and language. Users can edit or delete
 * them; "Restore built-in templates" in Settings puts missing ones back.
 * `body` is a complete email used as it is when no AI is used; it is never
 * sent to the model (which would paraphrase it into every draft). The model
 * gets `purpose` and `instructions`: what the email must achieve and contain,
 * never wording to copy.
 */
export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'builtin-spring-checkin-en',
    family: 'spring-checkin',
    language: 'en',
    name: 'Spring check-in',
    subject: 'How is the year going, {{firstName}}?',
    body: `Hello {{firstName}},

Spring always feels like a good moment to look up from the day-to-day, so here is a simple question: how is the year going for you?

No agenda on my side. If something is on your mind that you would like to talk through, I am always glad to hear from you.

{{signature}}`,
    purpose: 'A personal check-in on how the person is doing now. It looks at the present and ahead; it does not revisit past work together beyond acknowledging that you know each other.',
    instructions: `Must achieve: the person feels you are genuinely interested in how they are doing now.
Must contain: an opening built from a specific, current detail in their notes; one open question about how things are going for them now; a light invitation to reply whenever they like.
Must not contain: past projects or services, beyond acknowledging that you know each other; any offer, plan or meeting request; the season as the opening.
Subject: short and about them, not about spring.
Length: 60 to 110 words.`,
    scheduleRule: { month: 4, minGapDays: 90 },
    appliesTo: ['client'],
    requiresAnyOf: [],
    isBuiltIn: true,
  },
  {
    id: 'builtin-spring-checkin-fr',
    family: 'spring-checkin',
    language: 'fr',
    name: 'Nouvelles de printemps',
    subject: 'Comment se passe votre année, {{firstName}} ?',
    body: `Bonjour {{firstName}},

Le printemps est toujours un bon moment pour lever la tête du quotidien, alors voici une question toute simple : comment se passe votre année ?

Rien de particulier de mon côté. Si quelque chose vous occupe l'esprit et que vous souhaitez en parler, j'aurai toujours plaisir à vous lire.

{{signature}}`,
    purpose: 'Prendre des nouvelles de la personne, là maintenant. Le message regarde le présent et l\'avenir ; il ne revient pas sur le travail passé, sauf pour reconnaître que vous vous connaissez.',
    instructions: `Objectif : que la personne sente un intérêt sincère pour ce qu'elle vit en ce moment.
Doit contenir : une ouverture construite à partir d'un détail précis et actuel de ses notes ; une seule question ouverte sur la façon dont les choses se passent pour elle aujourd'hui ; une invitation légère à répondre quand elle le souhaite.
Ne doit pas contenir : les projets ou services passés, au-delà du fait que vous vous connaissez ; aucune offre, projet ou demande de rendez-vous ; la saison comme ouverture.
Objet : court et centré sur la personne, pas sur le printemps.
Longueur : 60 à 110 mots. Vouvoiement.`,
    scheduleRule: { month: 4, minGapDays: 90 },
    appliesTo: ['client'],
    requiresAnyOf: [],
    isBuiltIn: true,
  },
  {
    id: 'builtin-planning-en',
    family: 'planning',
    language: 'en',
    name: 'Late-summer planning',
    subject: 'Looking ahead to next year',
    body: `Hello {{firstName}},

I hope you had a good summer. Many teams start shaping next year's plans around now, so it seemed a good moment to say hello.

If there is something you would like support with next year, I would be glad to hear about it, whenever suits you. And if the timing is not right, that is completely fine.

If it is easier, you can pick a time here: {{calendlyLink}}

{{signature}}`,
    purpose: 'Offer help with the coming year\'s plans, at the time organisations set budgets, tied to what you know of their situation.',
    instructions: `Must achieve: the person knows you are available to help with the coming year's plans, and it is easy for them to say "not now".
Must contain: an opening built from their specifics; a link between something in their notes or work history and the year ahead, only if the data supports one; a plain offer of help with next year's plans; an explicit "no problem if the timing isn't right"; the booking link placeholder {{calendlyLink}} on its own line before the sign-off.
Must not contain: prices, packages or budget amounts; urgency; a generic "this is the time of year when..." opening.
Subject: about their plans for the year ahead.
Length: 80 to 130 words.`,
    scheduleRule: { month: 8, minGapDays: 60 },
    appliesTo: ['client', 'prospect'],
    requiresAnyOf: [],
    isBuiltIn: true,
  },
  {
    id: 'builtin-planning-fr',
    family: 'planning',
    language: 'fr',
    name: 'Préparer la rentrée',
    subject: "En pensant à l'année prochaine",
    body: `Bonjour {{firstName}},

J'espère que vous avez passé un bel été. C'est souvent à cette période que les équipes commencent à préparer l'année suivante, alors c'est l'occasion de vous faire signe.

Si vous envisagez un accompagnement sur un sujet l'année prochaine, j'en discuterai volontiers, quand cela vous convient. Et si le moment n'est pas le bon, aucun souci.

Si c'est plus simple, vous pouvez choisir un créneau ici : {{calendlyLink}}

{{signature}}`,
    purpose: 'Proposer votre aide pour les projets de l\'année à venir, au moment où les organisations fixent leur budget, en lien avec ce que vous savez de leur situation.',
    instructions: `Objectif : que la personne sache que vous êtes disponible pour ses projets de l'année à venir, et qu'il lui soit facile de répondre « pas maintenant ».
Doit contenir : une ouverture construite à partir de ses informations ; un lien entre quelque chose de ses notes ou du travail réalisé et l'année à venir, seulement si les données le permettent ; une proposition d'aide simple pour les projets de l'an prochain ; un « aucun souci si le moment n'est pas le bon » explicite ; l'emplacement du lien de rendez-vous {{calendlyLink}} sur sa propre ligne avant la signature.
Ne doit pas contenir : prix, forfaits ou montants de budget ; urgence ; une ouverture générique du type « c'est la période où... ».
Objet : sur ses projets pour l'année à venir.
Longueur : 80 à 130 mots. Vouvoiement.`,
    scheduleRule: { month: 8, minGapDays: 60 },
    appliesTo: ['client', 'prospect'],
    requiresAnyOf: [],
    isBuiltIn: true,
  },
  {
    id: 'builtin-holiday-en',
    family: 'holiday',
    language: 'en',
    name: 'Holiday greeting',
    subject: 'Warm wishes for the holidays',
    body: `Hello {{firstName}},

As the year comes to a close, warm wishes to you and those close to you for the holidays, and all the best for the year ahead.

{{signature}}`,
    purpose: 'A seasonal greeting and nothing else: no work, services, plans or meetings.',
    instructions: `Must achieve: a warm seasonal greeting that feels written for this one person.
Must contain: one personal touch from their notes if it suits a greeting (a personal or family event, not work); good wishes for the holidays and the year ahead.
Must not contain: work, services, projects, plans, meetings, offers, or a question that needs an answer; a named holiday such as Christmas, unless the notes name it ("the holidays" or "the end of the year" instead); the phrase "as the year winds down".
Subject: a short greeting.
Length: 40 to 80 words.`,
    scheduleRule: { month: 11, minGapDays: 0 },
    appliesTo: [],
    requiresAnyOf: [],
    isBuiltIn: true,
  },
  {
    id: 'builtin-holiday-fr',
    family: 'holiday',
    language: 'fr',
    name: 'Vœux de fin d’année',
    subject: 'Belles fêtes de fin d’année',
    body: `Bonjour {{firstName}},

Alors que l'année se termine, je vous souhaite, à vous et à vos proches, de très belles fêtes, et le meilleur pour l'année qui vient.

{{signature}}`,
    purpose: 'Des vœux de saison, et rien d\'autre : ni travail, ni services, ni projets, ni rendez-vous.',
    instructions: `Objectif : des vœux chaleureux qui semblent écrits pour cette seule personne.
Doit contenir : une touche personnelle tirée de ses notes si elle convient à des vœux (un événement personnel ou familial, pas le travail) ; des vœux pour les fêtes et l'année à venir.
Ne doit pas contenir : travail, services, projets, rendez-vous, offres, ni question qui appelle une réponse ; une fête nommée comme Noël, sauf si les notes la nomment (plutôt « les fêtes » ou « la fin d'année ») ; la formule « alors que l'année se termine ».
Objet : des vœux courts.
Longueur : 40 à 80 mots. Vouvoiement.`,
    scheduleRule: { month: 11, minGapDays: 0 },
    appliesTo: [],
    requiresAnyOf: [],
    isBuiltIn: true,
  },
  {
    id: 'builtin-reengage-en',
    family: 'reengage',
    language: 'en',
    name: 'Re-engagement',
    subject: 'A quick hello',
    body: `Hello {{firstName}},

It has been a while since we last spoke, and you came to mind.

Priorities shift, I know. If the topic we discussed is still relevant, I would be happy to pick up the conversation whenever it suits you. And if not, I hope things are going well.

{{signature}}`,
    purpose: 'Reconnect with someone who went quiet: acknowledge the time since you last spoke and pick up the specific thing that was left unresolved (openThread, or the work history or where you met).',
    instructions: `Must achieve: reopen a conversation that stopped, on the specific topic that was left unresolved.
Must contain: an opening built from their specifics; a plain acknowledgement that some time has passed since you last spoke, without saying how long; the specific thing that was left open, taken from openThread first, otherwise from the work history or where you met; an easy way to reply and an equally easy way not to. If none of these says what was left open, write [WHAT WAS LEFT OPEN] instead of inventing a topic or project.
Must not contain: guilt, "just checking in" language, or a generic "it has been a while and I thought of you" opening.
Subject: about the topic that was left open.
Length: 70 to 120 words.`,
    scheduleRule: { month: 2, minGapDays: 180 },
    appliesTo: ['prospect'],
    requiresAnyOf: ['openThread', 'serviceHistory', 'whereMet'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-reengage-fr',
    family: 'reengage',
    language: 'fr',
    name: 'Reprendre contact',
    subject: 'Un petit bonjour',
    body: `Bonjour {{firstName}},

Cela fait un moment que nous n'avons pas échangé, et j'ai pensé à vous.

Les priorités évoluent, je le sais bien. Si le sujet dont nous avions parlé est toujours d'actualité, je reprendrais volontiers la conversation quand vous le souhaitez. Sinon, j'espère que tout va bien de votre côté.

{{signature}}`,
    purpose: 'Renouer avec une personne qui ne s\'est plus manifestée : reconnaître le temps écoulé depuis le dernier échange et reprendre le point précis resté en suspens (openThread, ou le travail réalisé ou le lieu de rencontre).',
    instructions: `Objectif : relancer une conversation interrompue, sur le point précis resté en suspens.
Doit contenir : une ouverture construite à partir de ses informations ; la reconnaissance simple qu'un peu de temps a passé depuis le dernier échange, sans dire combien ; le point précis resté en suspens, tiré d'abord de openThread, sinon du travail réalisé ou du lieu de rencontre ; une façon facile de répondre, et une façon tout aussi facile de ne pas répondre. Si rien de tout cela ne dit ce qui est resté en suspens, écrivez [CE QUI EST RESTÉ EN SUSPENS] au lieu d'inventer un sujet ou un projet.
Ne doit pas contenir : culpabilisation, formules du type « je me permets de revenir vers vous », ni une ouverture générique du type « cela fait un moment et j'ai pensé à vous ».
Objet : sur le sujet resté en suspens.
Longueur : 70 à 120 mots. Vouvoiement.`,
    scheduleRule: { month: 2, minGapDays: 180 },
    appliesTo: ['prospect'],
    requiresAnyOf: ['openThread', 'serviceHistory', 'whereMet'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-post-event-en',
    family: 'post-event',
    language: 'en',
    name: 'Post-event follow-up',
    subject: 'Good to meet you',
    body: `Hello {{firstName}},

It was a pleasure to meet you, and thank you for the conversation.

If you would like to continue it at some point, I would be glad to. In the meantime, all the best with your projects.

{{signature}}`,
    purpose: 'Follow up on meeting this person at a specific event or place (whereMet): refer to where you met and, if the notes say, what you talked about there.',
    instructions: `Must achieve: follow up on meeting this person at the place or event in whereMet, so that they remember you.
Must contain: where you met (from whereMet) in the first or second sentence; what you talked about there, only if the notes say so; anything you promised them there (for example a name or a resource), if the notes mention it; a light invitation to continue the conversation.
Must not contain: an event name, date or topic that is not in whereMet or the notes; a sales pitch.
Subject: about where you met.
Length: 60 to 110 words.`,
    scheduleRule: null,
    appliesTo: ['lead', 'prospect'],
    requiresAnyOf: ['whereMet'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-post-event-fr',
    family: 'post-event',
    language: 'fr',
    name: 'Suite à une rencontre',
    subject: 'Suite à notre rencontre',
    body: `Bonjour {{firstName}},

Ce fut un plaisir de vous rencontrer, et merci pour cet échange.

Si vous souhaitez le poursuivre à l'occasion, ce sera avec plaisir. D'ici là, je vous souhaite une belle réussite dans vos projets.

{{signature}}`,
    purpose: 'Faire suite à une rencontre lors d\'un événement ou dans un lieu précis (whereMet) : évoquer où vous vous êtes rencontrés et, si les notes le disent, ce dont vous avez parlé.',
    instructions: `Objectif : faire suite à la rencontre avec cette personne dans le lieu ou l'événement indiqué dans whereMet, pour qu'elle se souvienne de vous.
Doit contenir : le lieu de la rencontre (whereMet) dans la première ou la deuxième phrase ; le sujet dont vous avez parlé, seulement si les notes le disent ; ce que vous lui avez promis sur place (par exemple un nom ou une ressource), si les notes le mentionnent ; une invitation légère à poursuivre la conversation.
Ne doit pas contenir : un nom d'événement, une date ou un sujet absents de whereMet et des notes ; un argumentaire commercial.
Objet : sur le lieu de la rencontre.
Longueur : 60 à 110 mots. Vouvoiement.`,
    scheduleRule: null,
    appliesTo: ['lead', 'prospect'],
    requiresAnyOf: ['whereMet'],
    isBuiltIn: true,
  },
];

/** Purposes of the built-ins by id, for templates saved before purposes existed. */
export const BUILT_IN_PURPOSES: Record<string, string> = Object.fromEntries(
  BUILT_IN_TEMPLATES.map((t) => [t.id, t.purpose]),
);
