# Editing templates

*Version française : [Modifier les modèles](templates.fr.md)*

A template is the starting point for one kind of email, for example the spring check-in or the holiday greeting. Relance comes with five. You can change their wording, their schedule, or delete them, and you can add your own.

Templates are in **Settings → Templates**. Click **Edit** next to one.

## What a template contains

- **When it is due.** Either "never on its own" (you choose the contacts yourself), or a month plus a minimum number of days since you last contacted the person. For example: August, at least 60 days.
- **Meant for.** Clients, prospects, leads, or everyone (leave all three unticked).
- **An English version and a French version.** Each has a name, a subject, the email text, and instructions for the AI. You can leave one language out; contacts in that language then get the other version.

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

- **Without AI** ("Use the template text as it is"), the text is used exactly as you wrote it, with the placeholders filled in.
- **With AI**, the text is a *reference* for the purpose and tone. The AI writes a new email for each person, following your **Instructions for the AI**.

So: when you use AI, the **instructions** matter most. When you don't, the **email text** is what people receive.

## Writing good instructions

Write them the way you would brief an assistant. Short, plain sentences work best.

- Say what the email is for: "A warm check-in in spring. Ask how their year is going."
- Say what to avoid: "No sales pitch. Don't mention our services."
- Say the length or tone if it matters: "Very short, three or four sentences."

The shared rules always apply on top of your instructions: the contact's language, under 150 words, no invented facts, no pressure, and a light invitation at the end.

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
