// Builds unsent .eml drafts. There is deliberately no From/Date header and
// nothing here can send mail: the user opens the file and sends it themselves.

const CRLF = '\r\n';

function utf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/** RFC 2047 encoded words, split so no word exceeds the 75-character limit. */
export function encodeHeaderValue(value: string): string {
  if (PRINTABLE_ASCII.test(value)) return value;
  const words: string[] = [];
  let chunk = '';
  for (const char of value) {
    if (new TextEncoder().encode(chunk + char).length > 39) {
      words.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${utf8Base64(w)}?=`).join(`${CRLF} `);
}

function formatAddress(name: string, email: string): string {
  const cleanName = name.replace(/[\r\n"]/g, '').trim();
  if (!cleanName) return `<${email}>`;
  const display = PRINTABLE_ASCII.test(cleanName)
    ? /[(),.:;<>@[\]\\]/.test(cleanName)
      ? `"${cleanName}"`
      : cleanName
    : encodeHeaderValue(cleanName);
  return `${display} <${email}>`;
}

export interface EmlInput {
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
}

export function buildEml({ toName, toEmail, subject, body }: EmlInput): string {
  const headers: string[] = [];
  const email = toEmail.replace(/[\r\n<>]/g, '').trim();
  if (email) headers.push(`To: ${formatAddress(toName, email)}`);
  headers.push(`Subject: ${encodeHeaderValue(subject.replace(/[\r\n]+/g, ' '))}`);
  // Outlook opens messages with X-Unsent: 1 as editable drafts.
  headers.push('X-Unsent: 1');
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset=UTF-8');
  headers.push('Content-Transfer-Encoding: base64');
  const normalized = body.replace(/\r\n?/g, '\n').replace(/\n/g, CRLF);
  const encoded = utf8Base64(normalized).replace(/.{76}/g, `$&${CRLF}`);
  return headers.join(CRLF) + CRLF + CRLF + encoded + CRLF;
}

/** A safe, readable file name: "Anne Martin - Spring check-in.eml". */
export function emlFileName(parts: string[], taken: Set<string>): string {
  const base =
    parts
      .filter(Boolean)
      .join(' - ')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'draft';
  let name = `${base}.eml`;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n}).eml`;
  taken.add(name.toLowerCase());
  return name;
}
