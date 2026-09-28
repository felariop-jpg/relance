# Editing templates

*Version française : [Modifier les modèles](templates.fr.md)*

A template is the starting point for one kind of email, for example the spring check-in or the holiday greeting. Relance comes with five. You can change their wording, their schedule, or delete them, and you can add your own.

Templates are in **Settings → Templates**. Click **Edit** next to one.

## What a template contains

- **When it is due.** Either "never on its own" (you choose the contacts yourself), or a month plus a minimum number of days since you last contacted the person. For example: August, at least 60 days.
- **Meant for.** Clients, prospects, leads, or everyone (leave all three unticked).
- **An English version and a French version.** Each has a name, a subject, the email text, **what this email is for** (its one job, which your other templates don't do), and a **brief for the AI**. You can leave one language out; contacts in that language then get the other version.
- **Only for contacts that have at least one of** "Where you met", "Work done together" or "Left open" (optional). A template that needs a detail to write about can't be used for contacts who don't have it, instead of making something up. Post-event needs "Where you met"; re-engagement needs at least one of the three.

## The built-in schedules are only a starting point

Relance comes with these months:

| Template | Month | For | Only if not contacted for |
|---|---|---|---|
| Spring check-in | April | clients | 90 days |
| Late-summer planning | August | clients and prospects | 60 days |
| Holiday greeting | November | everyone | (no minimum) |
| Re-engagement | February | prospects | 180 days |
| Post-event follow-up | none | you choose the contacts | |

They were picked as a reasonable default and are not advice. When your contacts plan their budgets, when they are away, and when a message is welcome all depend on your field and your country. **Set your own months:** open **Settings → Templates**, click **Edit** next to each template, and change **When is it due?**

## How the email text is used

- **Without AI** ("Use the template text as it is"), the email text is used exactly as you wrote it, with the placeholders filled in.
- **With AI**, the email text is **not shown to the AI at all**. The AI writes each email in its own words from the template's purpose, your brief, and that contact's details. (When the AI was shown a sample email, it reworded it into every draft, and all recipients got near-identical openings.)

So: when you use AI, the **purpose** and the **brief** matter. When you don't, the **email text** is what people receive.

## Writing a good brief

Describe **what** the email must do, not **how** to word it. If you write a sentence for the AI to use, it will use it for everyone.

- **Must achieve:** the one result you want, for example "they know I'm available for next year's plans, and it's easy to say not now".
- **Must contain:** the pieces, for example "one question about how they are doing now", "the booking link".
- **Must not contain:** what belongs to another kind of email, for example "no mention of past projects", "no offers".
- **Length**, if it matters: "60 to 110 words".

The built-in templates show this format.

The shared rules always apply on top of your brief: the contact's language, under 150 words, an opening built from that person's own details, no invented facts, no pressure, and a light invitation at the end.

## Placeholders

Placeholders are words in double curly brackets, like `{{firstName}}`. Relance replaces them with real details **on your computer**, after the AI has written the draft. This is how your signature and the contact's surname end up in the email without ever being sent to the AI.

| Placeholder | Becomes |
|---|---|
| `{{firstName}}` | the contact's first name |
| `{{lastName}}` | the contact's surname |
| `{{company}}` | the contact's company |
| `{{email}}` | the contact's email address |
| `{{senderName}}` | your name (Settings → Your details) |
| `{{signature}}` | your signature, or your name if the signature is empty |
| `{{calendlyLink}}` | your booking link (Settings → Your details) |

### How not to break them

- **Keep both curly brackets on each side:** `{{firstName}}`, not `{firstName}` or `{{firstName}`.
- **Keep the exact spelling and capital letters:** `{{firstName}}`, not `{{Firstname}}` or `{{first name}}`.
- **Use the buttons** under the email text (**Insert a placeholder**) instead of typing them. Click where you want it, then click the button.
- If Relance doesn't recognise a placeholder, it shows a yellow warning under the text. An unknown placeholder would appear as it is in the email, so fix it before saving.
- **Empty details:** if a line contains only placeholders that are empty, the whole line is left out. For example, if you have no booking link, the line "You can pick a time here: {{calendlyLink}}" disappears.

## Undoing mistakes

- If you close the editor without saving, a message at the bottom of the screen offers **Undo** for 10 seconds.
- If you delete a template, the same **Undo** appears.
- To get back any built-in template you deleted, click **Restore built-in templates**. Your edits to the others are kept.
