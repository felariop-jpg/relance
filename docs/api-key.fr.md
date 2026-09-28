# Obtenir une clé API

*English version: [Getting an API key](api-key.md)*

## Pourquoi Relance en a besoin

Relance rédige les brouillons avec Claude, une IA créée par l'entreprise Anthropic. Relance n'a ni serveur ni compte : il ne peut pas payer l'IA à votre place. Vous connectez donc votre propre compte Anthropic grâce à une **clé** : un long code qui commence par `sk-ant-`. Elle fonctionne comme un mot de passe qui permet à Relance de demander des brouillons à Claude, facturés sur votre compte.

Vous n'avez pas besoin de clé pour essayer Relance. Sans clé, il fonctionne en **mode démo** avec des brouillons d'exemple, et vous pouvez toujours écrire des e-mails à partir du texte des modèles, gratuitement.

## Vous pouvez d'abord faire le tour

Pas besoin de clé, ni de crédit, pour commencer. Sans clé, Relance fonctionne en **mode démo** : vous pouvez importer vos contacts, voir qui relancer et lire des brouillons d'exemple. Quand vous voudrez de vrais brouillons, revenez à ce guide. Anthropic vous permet aussi de créer un compte et de n'acheter du crédit que plus tard.

## Combien ça coûte

- Relance est gratuit.
- Anthropic facture chaque brouillon rédigé par l'IA : **moins d'un centime d'euro par e-mail** avec le modèle utilisé par Relance. 5 $ de crédit couvrent environ 500 e-mails.
- Anthropic facture en dollars américains. Relance affiche les coûts en euros avec un taux de change fixe : ce sont des estimations proches ; votre compte Anthropic indique le montant exact.
- Relance affiche une estimation avant chaque lot, le coût réel ensuite, et un total dans **Réglages → Coûts de l'IA**.

Les prix peuvent changer. Le site d'Anthropic indique les prix actuels.

## Obtenir une clé, étape par étape

Comptez environ cinq minutes. Il vous faut une adresse e-mail ou un compte Google. Le site d'Anthropic est en anglais : les noms des boutons sont donnés ici tels qu'ils apparaissent à l'écran.

1. Allez sur **platform.claude.com**. C'est le site d'Anthropic pour les personnes qui utilisent son IA dans d'autres outils. Cliquez sur **Continue with Google** (continuer avec Google), ou saisissez votre adresse e-mail et continuez. Si vous n'avez pas encore de compte, cela en crée un.

   ![La page de connexion d'Anthropic](screenshots/api-key-01.jpg)

2. Anthropic vous propose d'acheter du crédit (« usage credits »). Choisissez un montant, saisissez votre carte et cliquez sur **Buy credits** (acheter du crédit). 5 $ suffisent largement : à moins d'un centime d'euro par e-mail, cela dure longtemps. Si vous préférez d'abord faire le tour, cliquez sur **Skip for now** (plus tard) et ajoutez du crédit ensuite dans **Billing** (facturation). Relance ne peut pas rédiger de brouillons avec l'IA tant que votre compte n'a pas de crédit.

   ![L'achat de crédit, avec l'option Skip for now](screenshots/api-key-02.jpg)

3. Dans le menu de gauche, cliquez sur **API keys** (clés API, repère 1). Cliquez ensuite sur **Create key** (créer une clé, repère 2).

   ![La page des clés API](screenshots/api-key-03.jpg)

4. Une fenêtre peut proposer l'« identity federation » (fédération d'identité). Elle sert aux systèmes informatiques d'entreprise et ne concerne pas Relance. Cliquez sur **Continue with an API key** (continuer avec une clé API).

   ![La fenêtre de fédération d'identité](screenshots/api-key-04.jpg)

5. Dans **Name** (nom), tapez un nom que vous reconnaîtrez, par exemple « Relance ». Laissez les autres champs tels quels, sauf **Expires** (expiration) : regardez-le maintenant. Il est réglé sur **30 jours**.

   ![Création d'une clé : l'expiration est réglée sur 30 jours](screenshots/api-key-05.jpg)

6. Ouvrez **Expires** et choisissez **Never** (jamais). **C'est important.** Si vous gardez 30 jours, la clé cesse de fonctionner au bout d'un mois : les brouillons de Relance échouent soudain avec « Votre clé API n'a pas été acceptée », sans autre explication. Cliquez ensuite sur le bouton qui crée la clé.

   ![L'expiration réglée sur Never](screenshots/api-key-06.jpg)

7. Anthropic n'affiche votre nouvelle clé **qu'une seule fois**. Cliquez sur **Copy key** (copier la clé). Si vous fermez cette fenêtre sans l'avoir copiée, supprimez cette clé et créez-en une nouvelle.

   ![L'enregistrement de la clé API, avec le bouton Copy key](screenshots/api-key-07.jpg)

8. Revenez dans Relance et collez la clé :
   - **Si vous êtes sur l'écran d'accueil**, collez-la à l'étape 2, **Connecter l'IA**, puis cliquez sur **Suivant**.

     ![La case de la clé API sur l'écran d'accueil de Relance](screenshots/fr-welcome-api-key.jpg)

   - **Sinon**, cliquez sur **Réglages**, collez-la dans **Clé API Anthropic** sous **Connexion à l'IA**, puis cliquez sur **Vérifier la clé**. Le message « La clé fonctionne. » doit s'afficher.

     ![La clé API dans les Réglages de Relance](screenshots/fr-settings-api-key.jpg)

Le bandeau jaune « Mode démo » disparaît. Les brouillons sont désormais rédigés par l'IA.

## Protéger votre clé

- **Votre clé ne quitte votre navigateur que pour aller chez Anthropic.** Relance l'enregistre uniquement dans ce navigateur. Elle est envoyée à Anthropic avec chaque demande : c'est ainsi qu'Anthropic sait que la demande vient de vous. Elle n'est envoyée nulle part ailleurs, et elle n'est pas incluse dans les fichiers de sauvegarde de Relance.
- **Ne la partagez pas.** Toute personne qui a votre clé peut utiliser votre crédit.
- **Fixez une limite de dépenses.** Sur platform.claude.com, sous Billing ou Limits, vous pouvez plafonner les dépenses mensuelles.
- **Si vous pensez que quelqu'un d'autre a votre clé**, allez dans **API keys** sur platform.claude.com et supprimez-la, puis créez-en une nouvelle (avec **Expires : Never**) et collez-la dans Relance.
- **Sur un ordinateur partagé**, n'oubliez pas que toute personne qui peut ouvrir votre navigateur peut ouvrir Relance. Pour tout effacer de cet ordinateur, utilisez **Réglages → Tout supprimer**.

## Quelque chose ne fonctionne pas

| Ce que vous voyez | Que faire |
|---|---|
| « Cette clé n'a pas été acceptée » | Copiez à nouveau la clé. Elle est longue : vérifiez que vous l'avez copiée en entier, sans rien avant ni après. |
| Les brouillons échouent **soudain** avec « Votre clé API n'a pas été acceptée », alors que tout fonctionnait | La clé a probablement **expiré**. Sur platform.claude.com, ouvrez **API keys** et regardez sa date d'expiration. Créez une nouvelle clé avec **Expires : Never** et collez-la dans Relance, dans **Réglages → Connexion à l'IA**. |
| « Votre compte Anthropic n'a plus de crédit » | Ajoutez du crédit dans **Billing** sur platform.claude.com. |
| « Le service d'IA est surchargé » ou « reçoit trop de demandes » | Attendez quelques minutes, puis cliquez sur **Réessayer** sur le brouillon. Relance réessaie déjà plusieurs fois de lui-même. |
| « Impossible de joindre le service d'IA » | Vérifiez votre connexion internet, puis cliquez sur **Réessayer**. |
