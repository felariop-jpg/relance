# Modifier les modèles

*English version: [Editing templates](templates.md)*

Un modèle est le point de départ d'un type d'e-mail, par exemple les nouvelles de printemps ou les vœux de fin d'année. Relance en propose cinq. Vous pouvez changer leur formulation, leur calendrier, les supprimer, et en ajouter.

Les modèles se trouvent dans **Réglages → Modèles**. Cliquez sur **Modifier** à côté de l'un d'eux.

## Ce que contient un modèle

- **Quand il est à envoyer.** Soit « jamais automatiquement » (vous choisissez les contacts vous-même), soit un mois et un nombre minimum de jours depuis votre dernier contact avec la personne. Par exemple : septembre, au moins 60 jours.
- **Destiné aux.** Clients, prospects, pistes, ou tout le monde (ne cochez rien).
- **Une version en anglais et une version en français.** Chacune a un nom, un objet, le texte de l'e-mail et des consignes pour l'IA. Vous pouvez omettre une langue ; les contacts de cette langue reçoivent alors l'autre version.

## Comment le texte est utilisé

- **Sans IA** (« Utiliser le texte du modèle tel quel »), le texte est utilisé exactement tel que vous l'avez écrit, avec les emplacements remplis.
- **Avec l'IA**, le texte sert de *référence* pour le but et le ton. L'IA écrit un nouvel e-mail pour chaque personne, en suivant vos **Consignes pour l'IA**.

Donc : avec l'IA, ce sont les **consignes** qui comptent le plus. Sans l'IA, c'est le **texte de l'e-mail** que les gens reçoivent.

## Écrire de bonnes consignes

Écrivez-les comme si vous briefiez un assistant. Des phrases courtes et simples fonctionnent le mieux.

- Dites à quoi sert l'e-mail : « Un message chaleureux au printemps. Demander comment se passe l'année. »
- Dites ce qu'il faut éviter : « Aucune offre commerciale. Ne pas mentionner nos services. »
- Précisez la longueur ou le ton si c'est important : « Très court, trois ou quatre phrases. »

Les règles communes s'appliquent toujours en plus de vos consignes : la langue du contact, moins de 150 mots, aucun fait inventé, aucune pression, et une invitation légère à la fin.

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
