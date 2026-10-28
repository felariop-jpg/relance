/** An API key shown with only its last four characters, e.g. "••••••••3f9a". */
export function maskApiKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  return '•'.repeat(8) + (k.length > 8 ? k.slice(-4) : '');
}
