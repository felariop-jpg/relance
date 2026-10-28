# Privacy in Relance

*Version française : [PRIVACY.fr.md](PRIVACY.fr.md)*

Relance is built for people whose contact list is sensitive: clients going through difficult times, people who trusted you with personal news. This page explains, in plain words, where your information goes. The short version: **it stays on your computer, except for the few details the AI needs to write each draft, and you can check exactly what those were.**

## Where your information is stored

Everything you put into Relance is stored **inside your web browser, on your computer**: contacts, notes, drafts, templates, settings and your API key.

- There is **no Relance server**. Nobody who makes or hosts Relance can see your contacts. The website only delivers the app itself, the same for everyone.
- There is **no account**. Nothing is linked to your name or email address.
- Your information is **not synced** between computers or browsers. Relance in Chrome and Relance in Safari are two separate, empty lists.

One consequence: if the browser's stored data is cleared, your contacts are gone. That is why Relance offers **Settings → Backup**, a file you keep yourself.

## What leaves your computer

Relance connects to **one** service: the AI, Claude, run by the company Anthropic. It does this **only** when you ask for drafts, and each request contains only what is needed for one email. The one other time is if you choose to let the AI match the columns of a spreadsheet you import (see below), and then it gets no contact details at all.

**Sent to the AI for each draft** (unless you untick it in Settings → What the AI sees):

- the contact's **first name**
- their **company**
- their **country**
- the **language** of the email
- the **type** of contact (client, prospect or lead)
- **what you did together** (the "Work done together" field)
- your **notes** about them
- **where you met** them, if you filled it in (the post-event email is about that meeting)
- what was **left open** with them, if you filled it in (the re-engagement email is about that)

Also sent: for French drafts only, the grammatical gender you chose for French agreement (Settings → Your details; "neutral" by default); the template's purpose and wording, the example emails you pasted under "Your writing style" (if any), and any instruction you type when rewriting a draft.

**Never sent to the AI:**

- the contact's **surname**
- their **email address**
- their **phone number**
- the **date you last contacted** them
- **your own** name, signature and booking link
- anything you **unticked** in Settings

The AI writes the email with markers such as `{{signature}}` in it. Relance fills in your real signature, and the contact's surname if needed, **on your computer**, after the draft comes back.

### Matching spreadsheet columns (optional)

When you import a spreadsheet whose columns Relance doesn't recognise, it can ask the AI which column holds what. This is **optional**: nothing is sent unless you click **Match with AI**, and without an API key the button does nothing.

**Sent:** each column's **heading** (such as "Courriel" or "Société") and the **kind of values** in it, worked out on your computer: for example "email-like", "phone-like", "date", "country code" or "short text (avg 12 chars)". Also sent: the list of Relance's fields, with one line saying what each one is for.

**Never sent:** anything from the rows of your file. No names, email addresses, phone numbers, notes or Contact IDs. If the first row of your file looks like a contact rather than column headings, the headings are not sent either.

Before you click, **"What will be sent to the AI"** shows the exact request. The AI's answer only fills in the column choices: you check every column and click **Import** yourself.

The browser itself enforces this: Relance tells the browser that it may only connect to itself and to Anthropic, and the browser blocks anything else.

## How to check for yourself

Every draft has a section called **"What was sent to the AI"**. Open it to see the exact information that left your browser for that email. You can copy it, for example into a compliance document.

In demo mode (no API key), nothing is sent at all. The same section shows what *would* be sent.

## Choosing to send less

In **Settings → What the AI sees**, you can untick any of the fields above. Unticked fields are never sent.

If you untick **notes**, the AI has nothing personal to go on, and drafts will be polite but generic. Relance warns you about this, and marks such drafts with a yellow label.

## What Anthropic does with it

Requests go to Anthropic's API using **your own** API key, under **your own** agreement with Anthropic. Anthropic's commercial terms and privacy policy apply. At the time of writing, Anthropic states that it does not use API requests to train its models by default. Check Anthropic's current policies on its website if this matters to you.

## Your API key

Your key is stored in this browser only. It is sent to Anthropic with each request (that is how Anthropic knows the request is yours) and nowhere else. It is **not** included in backup files. See [Getting an API key](docs/api-key.md) for how to keep it safe.

## Deleted contacts

When you delete contacts, Relance keeps them for **30 days** under **Recently deleted** on the Contacts page, in case the deletion was a mistake (for example, made in another tab). After 30 days they are removed for good. To remove them sooner, open **Recently deleted** and choose **Remove all for good**.

## Using Relance in several tabs

If Relance is open in two tabs or windows of the same browser, both show the same contacts and stay in step. Relance shows a notice when this happens. Two *different* browsers or computers do not share anything: each has its own separate list.

## Removing everything

**Settings → Delete everything** removes all of Relance's information from this browser, including your API key. It cannot be undone, so download a backup first if you might want your contacts again.

## For technical readers

- Storage: IndexedDB, via Dexie, in the browser's origin for the site you use.
- The API payload is built by `redactForApi` in `src/ai/redact.ts` from an **allowlist**. A field added to contacts in the future is withheld unless a developer deliberately adds it to the list. Unit tests check that surname, email, phone, ids, dates and unknown fields never appear in the request.
- Column matching is built by `buildMappingRequest` in `src/ai/mapColumns.ts`, also from an allowlist: column number, heading and a value shape computed locally. Unit tests put sentinel values in every cell and check that none of them, nor any email address, name or phone number, appears in the request.
- The production build sets a Content-Security-Policy with `connect-src 'self' https://api.anthropic.com`.
- Relance contains no code that can send email, and a test fails if any is added.
