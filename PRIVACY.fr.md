# Confidentialité dans Relance

*English version: [PRIVACY.md](PRIVACY.md)*

Relance est conçu pour des personnes dont la liste de contacts est sensible : des clients qui traversent des moments difficiles, des personnes qui vous ont confié des nouvelles personnelles. Cette page explique, simplement, où vont vos informations. En bref : **elles restent sur votre ordinateur, à l'exception des quelques détails dont l'IA a besoin pour écrire chaque brouillon, et vous pouvez vérifier exactement lesquels.**

## Où vos informations sont enregistrées

Tout ce que vous mettez dans Relance est enregistré **dans votre navigateur web, sur votre ordinateur** : contacts, notes, brouillons, modèles, réglages et clé API.

- Il n'y a **pas de serveur Relance**. Personne parmi ceux qui créent ou hébergent Relance ne peut voir vos contacts. Le site ne fait que livrer l'application, la même pour tout le monde.
- Il n'y a **pas de compte**. Rien n'est lié à votre nom ou à votre adresse e-mail.
- Vos informations **ne sont pas synchronisées** entre ordinateurs ou navigateurs. Relance dans Chrome et Relance dans Safari sont deux listes séparées.

Conséquence : si les données du navigateur sont effacées, vos contacts disparaissent. C'est pourquoi Relance propose **Réglages → Sauvegarde**, un fichier que vous conservez vous-même.

## Ce qui quitte votre ordinateur

Relance se connecte à **un seul** service : l'IA Claude, de l'entreprise Anthropic. Il le fait **uniquement** quand vous demandez des brouillons, et chaque demande ne contient que ce qui est nécessaire pour un e-mail. La seule autre occasion : si vous choisissez de laisser l'IA associer les colonnes d'un tableur que vous importez (voir plus bas), et elle ne reçoit alors aucune information sur vos contacts.

**Envoyé à l'IA pour chaque brouillon** (sauf si vous le décochez dans Réglages → Ce que voit l'IA) :

- le **prénom** du contact
- son **entreprise**
- son **pays**
- la **langue** de l'e-mail
- le **type** de contact (client, prospect ou piste)
- le **travail réalisé ensemble**
- vos **notes** sur la personne
- le **lieu de rencontre**, s'il est renseigné (l'e-mail « Suite à une rencontre » en parle)
- ce qui est **resté en suspens**, s'il est renseigné (l'e-mail « Reprendre contact » en parle)

Sont aussi envoyés : pour les brouillons en français uniquement, l'accord grammatical choisi pour vous (Réglages → Vos informations ; « neutre » par défaut) ; le but et le texte du modèle, les e-mails d'exemple collés dans « Votre style d'écriture » (s'il y en a), et la consigne que vous tapez quand vous réécrivez un brouillon.

**Jamais envoyé à l'IA :**

- le **nom de famille** du contact
- son **adresse e-mail**
- son **numéro de téléphone**
- la **date de votre dernier contact**
- **vos propres** nom, signature et lien de rendez-vous
- tout ce que vous avez **décoché** dans les Réglages

L'IA écrit l'e-mail avec des repères comme `{{signature}}`. Relance remplace ces repères par votre vraie signature, et par le nom de famille du contact si besoin, **sur votre ordinateur**, une fois le brouillon revenu.

### Associer les colonnes d'un tableur (facultatif)

Quand vous importez un tableur dont Relance ne reconnaît pas les colonnes, il peut demander à l'IA quelle colonne contient quoi. C'est **facultatif** : rien n'est envoyé tant que vous ne cliquez pas sur **Associer avec l'IA**, et sans clé API le bouton ne fait rien.

**Envoyé :** le **nom** de chaque colonne (par exemple « Courriel » ou « Société ») et le **genre de valeurs** qu'elle contient, déterminé sur votre ordinateur. La demande l'écrit en anglais : par exemple « email-like » (ressemble à un e-mail), « phone-like » (ressemble à un téléphone), « date », « country code » (code pays) ou « short text (avg 12 chars) » (texte court, 12 caractères en moyenne). Également envoyée : la liste des champs de Relance, avec une ligne qui explique à quoi sert chacun.

**Jamais envoyé :** rien qui vienne des lignes de votre fichier. Aucun nom, adresse e-mail, numéro de téléphone, note ni identifiant du contact. Si la première ligne de votre fichier ressemble à un contact plutôt qu'à des noms de colonnes, les noms de colonnes ne sont pas envoyés non plus.

Avant que vous cliquiez, **« Ce qui sera envoyé à l'IA »** montre la demande exacte. La réponse de l'IA remplit seulement les choix de colonnes : vous vérifiez chaque colonne et cliquez vous-même sur **Importer**.

C'est le navigateur lui-même qui garantit cela : Relance lui indique qu'il ne peut se connecter qu'à lui-même et à Anthropic, et le navigateur bloque tout le reste.

## Comment le vérifier vous-même

Chaque brouillon comporte une section **« Ce qui a été envoyé à l'IA »**. Ouvrez-la pour voir les informations exactes qui ont quitté votre navigateur pour cet e-mail. Vous pouvez les copier, par exemple dans un document de conformité.

En mode démo (sans clé API), rien n'est envoyé. La même section montre ce qui *serait* envoyé.

## Choisir d'envoyer moins

Dans **Réglages → Ce que voit l'IA**, vous pouvez décocher n'importe lequel des champs ci-dessus. Les champs décochés ne sont jamais envoyés.

Si vous décochez les **notes**, l'IA n'a rien de personnel sur quoi s'appuyer, et les brouillons seront polis mais génériques. Relance vous en avertit et signale ces brouillons par une étiquette jaune.

## Ce qu'Anthropic en fait

Les demandes sont envoyées à l'API d'Anthropic avec **votre propre** clé, dans le cadre de **votre propre** accord avec Anthropic. Les conditions commerciales et la politique de confidentialité d'Anthropic s'appliquent. Au moment de la rédaction, Anthropic indique ne pas utiliser par défaut les demandes faites via l'API pour entraîner ses modèles. Consultez les règles actuelles sur le site d'Anthropic si ce point est important pour vous.

## Votre clé API

Votre clé est enregistrée uniquement dans ce navigateur. Elle est envoyée à Anthropic avec chaque demande (c'est ainsi qu'Anthropic sait que la demande vient de vous), et nulle part ailleurs. Elle n'est **pas** incluse dans les fichiers de sauvegarde. Voir [Obtenir une clé API](docs/api-key.fr.md).

## Contacts supprimés

Quand vous supprimez des contacts, Relance les conserve **30 jours** dans **Supprimés récemment**, sur la page Contacts, au cas où la suppression serait une erreur (par exemple, faite dans un autre onglet). Au bout de 30 jours, ils sont effacés définitivement. Pour les effacer plus tôt, ouvrez **Supprimés récemment** et choisissez **Tout effacer définitivement**.

## Utiliser Relance dans plusieurs onglets

Si Relance est ouvert dans deux onglets ou fenêtres du même navigateur, les deux affichent les mêmes contacts et restent synchronisés. Relance affiche un avis dans ce cas. Deux navigateurs ou ordinateurs *différents* ne partagent rien : chacun a sa propre liste.

## Tout effacer

**Réglages → Tout supprimer** efface toutes les informations de Relance de ce navigateur, y compris votre clé API. C'est définitif : téléchargez d'abord une sauvegarde si vous pourriez avoir besoin de vos contacts.

## Pour les lecteurs techniques

- Stockage : IndexedDB, via Dexie, dans l'origine du navigateur pour le site utilisé.
- Le contenu envoyé à l'API est construit par `redactForApi` (`src/ai/redact.ts`) à partir d'une **liste autorisée**. Un champ ajouté plus tard aux contacts n'est pas envoyé, sauf si un développeur l'ajoute délibérément à la liste. Des tests vérifient que le nom de famille, l'e-mail, le téléphone, les identifiants, les dates et les champs inconnus n'apparaissent jamais dans la demande.
- L'association des colonnes est construite par `buildMappingRequest` (`src/ai/mapColumns.ts`), elle aussi à partir d'une liste autorisée : numéro de colonne, nom de colonne et forme des valeurs calculée localement. Des tests mettent des valeurs témoins dans chaque cellule et vérifient qu'aucune d'elles, ni aucune adresse e-mail, nom ou numéro de téléphone, n'apparaît dans la demande.
- La version publiée impose une Content-Security-Policy avec `connect-src 'self' https://api.anthropic.com`.
- Relance ne contient aucun code capable d'envoyer un e-mail, et un test échoue si quelqu'un en ajoute.
