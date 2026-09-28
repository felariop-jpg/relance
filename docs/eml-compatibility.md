# Checking the .eml export in Outlook

The "Email files for Outlook" export has been checked against the standards and in unit tests, but **not yet opened in Outlook on Windows**. This page is the test to run on a real Windows computer, and what to change if something fails.

The generator is `src/export/eml.ts` (`buildEml`, `encodeHeaderValue`, `formatAddress`). Tests are in `src/export/export.test.ts`.

## What each file contains

```
To: =?UTF-8?B?…?= <amelie.rousseau@example.com>     (name encoded only if it has accents)
Subject: =?UTF-8?B?…?=                              (encoded only if non-ASCII; split into ≤ 39-byte pieces)
X-Unsent: 1                                          (asks Outlook to open it as an unsent message)
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: base64

<the email text, UTF-8, CRLF line endings, base64 in 76-character lines>
```

There is deliberately **no `From:` and no `Date:`**: Outlook should fill in the sender from the account that opens it.

## Setting up the test

1. In Relance, open **Settings → Your details** and set a signature with an accent, for example `Sam Rivière` on the first line and `Rivière Conseil` on the second.
2. Load the sample contacts (or use your own).
3. Write drafts for at least: **Amélie Rousseau** (accents in the name, French text), **Marie-Hélène Faure** (hyphen and accents), and one contact **with no email address** (add one by hand).
4. In one draft, edit the subject to include accents and an apostrophe, for example `Nouvelles d'été, Amélie`.
5. Approve them and export as **Email files for Outlook**.
6. On Windows, **right-click the .zip file and choose "Extract All…"**. Don't open the emails from inside the .zip window (see "Opens read-only" below).

## The checklist

Record each result: which Outlook (classic Outlook for Windows, the *new* Outlook for Windows, Outlook on the web, Outlook for Mac) and its version (**File → Office Account → About Outlook**).

| # | Check | Pass looks like |
|---|---|---|
| 1 | **Opens as an editable draft** | Double-clicking the file opens a *new message* window with a **Send** button, not a read-only message with Reply/Forward. |
| 2 | **Recipient filled in** | The **To** field shows the contact's name and address. For the contact with no email, **To** is empty (expected). |
| 3 | **Subject filled in** | The subject matches the draft exactly, including accents and the apostrophe. |
| 4 | **Accents correct** | `é è ê à ç ô œ` and curly quotes show correctly in the name, subject and body, with no `Ã©` or `?`. |
| 5 | **Signature survives** | The body ends with your signature from Relance (`Sam Rivière / Rivière Conseil`). Outlook may *also* add its own default signature; note if you now have two. |
| 6 | **Line breaks kept** | Paragraphs are separated as in Relance; lines don't run together. |
| 7 | **Body editable** | You can click into the body, change a word, and send. |
| 8 | **Sends normally** | Send one to yourself; it arrives from your normal account with the right subject and text. |

## If something fails

### Opens as a received message (no Send button): X-Unsent missing or ignored

- **Check the header is there:** open the .eml in Notepad. `X-Unsent: 1` must appear in the header block, before the first empty line, spelled exactly like that.
- **Classic Outlook for Windows** honours `X-Unsent: 1`. The **new Outlook for Windows**, **Outlook on the web** and **Outlook for Mac** do not reliably honour it and open the file as a received message. That is a limit of those programs, not something the generator can switch on.
- **What to do:** in the message window, choose **Forward** (then remove "FW:" and the forward header) or, where offered, **Edit as new** / **Send again**. Or use the **Plain text files** export and paste into a new email.
- **Generator changes worth trying** (in `buildEml`), one at a time, retesting after each:
  1. Move `X-Unsent: 1` to be the **first** header line.
  2. Add `From: <you@yourdomain>` with the sender's own address. Some Outlook builds only offer compose mode when a sender is present. This needs a new "your email address" setting, so treat it as a last resort.
- A native Outlook `.msg` file would always open as a draft, but it is a binary format that needs a sizeable library. Out of scope unless the .eml route fails in classic Outlook too.

### Accents garbled

- **In the body** (`Ã©` instead of `é`): the body is base64 UTF-8 with `charset=UTF-8`. If Outlook ignores the charset, try `Content-Transfer-Encoding: quoted-printable` (encode the UTF-8 bytes as `=C3=A9`) in `buildEml`.
- **In the subject or name**: these use RFC 2047 "B" encoded words split into pieces of up to 39 bytes (`encodeHeaderValue`). If Outlook shows the raw `=?UTF-8?B?…?=`, try a single encoded word per header (raise the 39-byte limit) or the "Q" form (`=?UTF-8?Q?Nouvelles_d=27=C3=A9t=C3=A9?=`).
- In Notepad, check the file itself: headers must be plain ASCII, and every line must end with CRLF.

### Recipient missing or wrong

- The **To** line is only written when the contact has an email address. Check the contact in Relance.
- A name with a comma or other special characters is put in quotes (`"Martin, Anne" <…>`); a name with accents is encoded. If Outlook shows the encoded form, change `formatAddress` to put accented names in quotes without encoding (Outlook generally accepts raw UTF-8 in quoted names).

### Signature missing or doubled

- Relance's signature is ordinary text at the end of the body, so it cannot be lost on its own. If it is missing, check that **Settings → Your details → Signature** was set **before** the drafts were written (drafts are filled in when they are created).
- If Outlook adds its own signature as well, turn off its automatic signature for new messages, or clear Relance's signature so it falls back to your name.

### Opens read-only, or with a yellow "Protected View" bar

- Opening a file directly from inside a .zip window gives Outlook a temporary, read-only copy. **Extract the .zip first** (right-click → **Extract All…**), then open the extracted files.
- Files downloaded from the internet carry a "from the web" mark. If Windows still blocks them, right-click the .eml → **Properties** → tick **Unblock** → **OK**.

## Fallback: plain text files

The export window also offers **Plain text files**: one `.txt` per draft, named after the contact, with the address on the first line, the subject on the second, then the email. They are UTF-8 with a byte-order mark and Windows line endings, so accents show correctly in Notepad. Use them with any email program where the .eml files don't behave.

## Reporting back

Please record, for each Outlook version tested: the 8 results above, and for any failure a screenshot and the .eml file (use sample contacts only). Then update the table below.

| Outlook version | Result | Notes |
|---|---|---|
| Classic Outlook for Windows | not yet tested | |
| New Outlook for Windows | not yet tested | |
| Outlook on the web | not yet tested | |
| Outlook for Mac | not yet tested | |
