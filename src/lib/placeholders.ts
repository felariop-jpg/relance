import type { Contact, Settings } from '../db/schema';

export const PLACEHOLDERS = [
  'firstName',
  'lastName',
  'company',
  'email',
  'senderName',
  'signature',
  'calendlyLink',
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

const TOKEN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

export function placeholderValues(
  contact: Pick<Contact, 'firstName' | 'lastName' | 'company' | 'email'>,
  settings: Pick<Settings, 'senderName' | 'signature' | 'calendlyLink'>,
): Record<Placeholder, string> {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    company: contact.company,
    email: contact.email,
    senderName: settings.senderName,
    // No signature yet: the sender's name is the least surprising sign-off.
    signature: settings.signature.trim() || settings.senderName,
    calendlyLink: settings.calendlyLink,
  };
}

function isPlaceholder(name: string): name is Placeholder {
  return (PLACEHOLDERS as readonly string[]).includes(name);
}

/**
 * Replaces known {{placeholders}} with local values. Unknown ones are left
 * visible so the user notices them. A line whose placeholders are all empty
 * is dropped (e.g. the booking-link line when there is no link).
 */
export function fillPlaceholders(text: string, values: Record<Placeholder, string>): string {
  const lines = text.split('\n').flatMap((line) => {
    const names = [...line.matchAll(TOKEN)].map((m) => m[1]).filter(isPlaceholder);
    if (names.length > 0 && names.every((n) => !values[n].trim())) return [];
    const filled = line
      .replace(TOKEN, (match, name: string) => (isPlaceholder(name) ? values[name] : match))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +([,.])/g, '$1')
      .replace(/[ \t]+$/, '');
    return [filled];
  });
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function unknownPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]).filter((n) => !isPlaceholder(n)))];
}
