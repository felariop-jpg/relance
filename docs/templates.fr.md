# Modifier les modèles

*English version: [Editing templates](templates.md)*

Un modèle est le point de départ d'un type d'e-mail, par exemple les nouvelles de printemps ou les vœux de fin d'année. Relance en propose cinq. Vous pouvez changer leur formulation, leur calendrier, les supprimer, et en ajouter.

Les modèles se trouvent dans **Réglages → Modèles**. Cliquez sur **Modifier** à côté de l'un d'eux.

## Ce que contient un modèle

- **Quand il est à envoyer.** Soit « jamais automatiquement » (vous choisissez les contacts vous-même), soit un mois et un nombre minimum de jours depuis votre dernier contact avec la personne. Par exemple : août, au moins 60 jours.
- **Destiné aux.** Clients, prospects, pistes, ou tout le monde (ne cochez rien).
- **Une version en anglais et une version en français.** Chacune a un nom, un objet, le texte de l'e-mail, **à quoi sert cet e-mail** (son rôle, que vos autres modèles n'ont pas) et des **consignes pour l'IA**. Vous pouvez omettre une langue ; les contacts de cette langue reçoivent alors l'autre version.
- **Seulement pour les contacts qui ont au moins l'un de ces éléments** : « Lieu de rencontre », « Travail réalisé ensemble » ou « Resté en suspens » (facultatif). Un modèle qui a besoin d'un détail pour écrire ne peut pas servir pour les contacts qui ne l'ont pas, au lieu d'inventer quelque chose. « Suite à une rencontre » a besoin du lieu de rencontre ; « Reprendre contact » a besoin d'au moins l'un des trois.

## Les calendriers intégrés ne sont qu'un point de départ

Relance propose ces mois :

| Modèle | Mois | Pour | Seulement sans contact depuis |
|---|---|---|---|
| Nouvelles de printemps | avril | clients | 90 jours |
| Préparer la rentrée | août | clients et prospects | 60 jours |
| Vœux de fin d'année | novembre | tout le monde | (pas de minimum) |
| Reprendre contact | février | prospects | 180 jours |
| Suite à une rencontre | aucun | vous choisissez les contacts | |

Ils ont été choisis comme valeurs par défaut raisonnables ; ce ne sont pas des recommandations. Le moment où vos contacts préparent leur budget, leurs périodes d'absence et le moment où un message est bienvenu dépendent de votre domaine et de votre pays. **Choisissez vos propres mois :** ouvrez **Réglages → Modèles**, cliquez sur **Modifier** à côté de chaque modèle, et changez **Quand est-il à envoyer ?**

## Comment le texte est utilisé

- **Sans IA** (« Utiliser le texte du modèle tel quel »), le texte de l'e-mail est utilisé exactement tel que vous l'avez écrit, avec les emplacements remplis.
- **Avec l'IA**, le texte de l'e-mail **n'est pas du tout montré à l'IA**. L'IA écrit chaque e-mail avec ses propres mots, à partir du rôle du modèle, de vos consignes et des informations du contact. (Quand l'IA voyait un e-mail d'exemple, elle le reformulait dans chaque brouillon, et tous les destinataires recevaient presque la même ouverture.)

Donc : avec l'IA, ce sont le **rôle** et les **consignes** qui comptent. Sans l'IA, c'est le **texte de l'e-mail** que les gens reçoivent.

## Écrire de bonnes consignes

Décrivez **ce que** l'e-mail doit faire, pas **comment** le formuler. Si vous écrivez une phrase pour l'IA, elle l'utilisera pour tout le monde.

- **Objectif :** le résultat voulu, par exemple « la personne sait que je suis disponible pour ses projets de l'an prochain, et il lui est facile de dire pas maintenant ».
- **Doit contenir :** les éléments, par exemple « une question sur ce qu'elle vit en ce moment », « le lien de rendez-vous ».
- **Ne doit pas contenir :** ce qui relève d'un autre type d'e-mail, par exemple « aucune mention des projets passés », « aucune offre ».
- **Longueur**, si elle compte : « 60 à 110 mots ».

Les modèles intégrés suivent ce format.

Les règles communes s'appliquent toujours en plus de vos consignes : la langue du contact, moins de 150 mots, une ouverture construite à partir des informations de la personne, aucun fait inventé, aucune pression, et une invitation légère à la fin.

## Les emplacements

Les emplacements sont des mots entre doubles accolades, comme `{{firstName}}`. Relance les remplace par les vraies informations **sur votre ordinateur**, après que l'IA a rédigé le brouillon. C'est ainsi que votre signature et le nom de famille du contact apparaissent dans l'e-mail sans jamais être envoyés à l'IA.

| Emplacement | Devient |
|---|---|
| `{{firstName}}` | le prénom du contact |
| `{{lastName}}` | le nom de famille du contact |
| `{{company}}` | l'entreprise du contact |
| `{{email}}` | l'adresse e-mail du contact |
| `{{senderName}}` | votre nom (Réglages → Vos informations) |
| `{{signature}}` | votre signature, ou votre nom si la signature est vide |
| `{{calendlyLink}}` | votre lien de rendez-vous (Réglages → Vos informations) |

Les noms des emplacements restent en anglais, même dans les modèles en français.

### Comment ne pas les casser

- **Gardez les deux accolades de chaque côté :** `{{firstName}}`, pas `{firstName}` ni `{{firstName}`.
- **Gardez l'orthographe et les majuscules exactes :** `{{firstName}}`, pas `{{Firstname}}` ni `{{prénom}}`.
- **Utilisez les boutons** sous le texte (**Insérer un emplacement**) plutôt que de les taper. Cliquez à l'endroit voulu, puis sur le bouton.
- Si Relance ne reconnaît pas un emplacement, un avertissement jaune s'affiche sous le texte. Un emplacement inconnu apparaîtrait tel quel dans l'e-mail : corrigez-le avant d'enregistrer.
- **Informations vides :** si une ligne ne contient que des emplacements vides, toute la ligne est retirée. Par exemple, sans lien de rendez-vous, la ligne « Vous pouvez choisir un créneau ici : {{calendlyLink}} » disparaît.

## Revenir en arrière

- Si vous fermez l'éditeur sans enregistrer, un message en bas de l'écran propose **Annuler** pendant 10 secondes.
- Si vous supprimez un modèle, le même **Annuler** apparaît.
- Pour récupérer un modèle intégré que vous avez supprimé, cliquez sur **Restaurer les modèles intégrés**. Vos modifications des autres modèles sont conservées.
