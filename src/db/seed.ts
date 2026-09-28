import type { Template } from './schema';

/**
 * Default schedules are a starting point, not advice: April (clients), August
 * (clients and prospects), November (everyone), February (prospects).
 * Users set their own months in Settings → Templates.
 *
 * Built-in templates, one per family and language. Users can edit or delete
 * them; "Restore built-in templates" in Settings puts missing ones back.
 * Bodies are complete emails on their own (used as-is when no AI is used);
 * `instructions` guide the model when it personalises.
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
    instructions:
      'A warm, personal spring check-in. Ask how their year is going. No pitch and no mention of services unless the notes make it natural. At most one question.',
    scheduleRule: { month: 4, minGapDays: 90 },
    appliesTo: ['client'],
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
    instructions:
      "Un message de printemps chaleureux et personnel. Demander comment se passe l'année. Aucune offre, aucune mention des services sauf si les notes le rendent naturel. Une question au maximum. Vouvoiement.",
    scheduleRule: { month: 4, minGapDays: 90 },
    appliesTo: ['client'],
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
    instructions:
      "Timed for when organisations plan next year's budget. Mention gently that you are available to help with next year's plans, tied to their situation where the notes allow. No pressure; make it easy to say not now.",
    scheduleRule: { month: 8, minGapDays: 60 },
    appliesTo: ['client', 'prospect'],
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
    instructions:
      "Envoyé au moment où les organisations préparent le budget de l'année suivante. Indiquer avec légèreté que vous êtes disponible pour les projets de l'an prochain, en lien avec leur situation si les notes le permettent. Aucune pression ; il doit être facile de répondre « pas maintenant ». Vouvoiement.",
    scheduleRule: { month: 8, minGapDays: 60 },
    appliesTo: ['client', 'prospect'],
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
    instructions:
      'A short holiday greeting. Do not mention services, work, offers or meetings at all. Warm and brief, under 80 words. A personal touch from the notes is welcome if it suits a greeting.',
    scheduleRule: { month: 11, minGapDays: 0 },
    appliesTo: [],
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
    instructions:
      "Des vœux de fin d'année courts. Ne mentionner ni les services, ni le travail, ni aucune offre ou rendez-vous. Chaleureux et bref, moins de 80 mots. Une touche personnelle tirée des notes est bienvenue si elle convient à des vœux. Vouvoiement.",
    scheduleRule: { month: 11, minGapDays: 0 },
    appliesTo: [],
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
    instructions:
      'For a prospect who showed interest once and then went quiet. Acknowledge that time has passed, without any guilt-tripping. Refer to what they were interested in only if the notes say what it was. Make it easy to reply, and just as easy not to.',
    scheduleRule: { month: 2, minGapDays: 180 },
    appliesTo: ['prospect'],
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
    instructions:
      "Pour un prospect qui s'était montré intéressé puis ne s'est plus manifesté. Reconnaître que du temps a passé, sans culpabiliser. Évoquer ce qui l'intéressait seulement si les notes le précisent. Il doit être facile de répondre, et tout aussi facile de ne pas répondre. Vouvoiement.",
    scheduleRule: { month: 2, minGapDays: 180 },
    appliesTo: ['prospect'],
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
    instructions:
      'For someone met recently at a conference or event. Name the event and what you talked about if the notes mention them; never guess an event name. Light and short.',
    scheduleRule: null,
    appliesTo: ['lead', 'prospect'],
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
    instructions:
      "Pour une personne rencontrée récemment lors d'une conférence ou d'un événement. Citer l'événement et le sujet abordé si les notes les mentionnent ; ne jamais deviner le nom d'un événement. Léger et court. Vouvoiement.",
    scheduleRule: null,
    appliesTo: ['lead', 'prospect'],
    isBuiltIn: true,
  },
];
