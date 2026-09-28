/**
 * Placeholders the model leaves when the data doesn't say what something is,
 * e.g. [TITLE OF THE BOOK] / [TITRE DU LIVRE]. A draft containing one needs the
 * user's input: it can't be approved or exported until it is filled in.
 */
const INPUT_PLACEHOLDER = /\[[^[\]\n]*\p{L}[^[\]\n]*\]/gu;

export function inputPlaceholders(text: string): string[] {
  return [...new Set(text.match(INPUT_PLACEHOLDER) ?? [])];
}

export function needsInput(draft: { subject: string; body: string }): boolean {
  return inputPlaceholders(`${draft.subject}\n${draft.body}`).length > 0;
}
