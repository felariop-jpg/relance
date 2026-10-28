import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronIcon, CopyIcon } from '../../components/icons';

/** The request with the user message's JSON text expanded, purely for reading. */
export function readablePayload(payloadJson: string): string {
  try {
    const request = JSON.parse(payloadJson);
    for (const message of request.messages ?? []) {
      if (typeof message.content === 'string') {
        try {
          message.content = JSON.parse(message.content);
        } catch {
          // Plain text stays as it is.
        }
      }
    }
    // The contact data (in the message) first; the long, fixed instructions last.
    const { messages, model, max_tokens, tool_choice, system, tools, ...rest } = request;
    return JSON.stringify({ messages, model, max_tokens, tool_choice, ...rest, system, tools }, null, 2);
  } catch {
    return payloadJson;
  }
}

/**
 * "What was sent to the AI": the visible proof of the privacy model. Collapsed
 * by default; the exact JSON is stored on the draft so it survives reloads.
 */
export function PayloadPanel({
  payloadJson,
  demo,
  title,
  note,
}: {
  payloadJson: string;
  demo: boolean;
  /** Replace the draft wording, for other requests (such as column matching). */
  title?: string;
  note?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const readable = useMemo(() => readablePayload(payloadJson), [payloadJson]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payloadJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is still selectable in the panel.
    }
  }

  return (
    <details className="group rounded-lg border border-stone-200 bg-stone-50">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-stone-700 sm:min-h-9 [&::-webkit-details-marker]:hidden">
        <ChevronIcon className="transition-transform group-open:rotate-90" />
        {title ?? (demo ? t('review.payload.demoTitle') : t('review.payload.title'))}
      </summary>
      <div className="space-y-2 border-t border-stone-200 px-3 py-3">
        <p className="text-sm text-stone-700">{note ?? (demo ? t('review.payload.demoNote') : t('review.payload.note'))}</p>
        <p className="text-xs text-stone-500">{t('review.payload.readable')}</p>
        <div className="relative">
          <button
            type="button"
            onClick={copy}
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium hover:bg-stone-100"
          >
            <CopyIcon />
            {copied ? t('review.payload.copied') : t('review.payload.copy')}
          </button>
          <pre className="max-h-96 overflow-auto rounded-md bg-stone-900 p-3 pr-20 text-xs leading-relaxed whitespace-pre-wrap text-stone-100">
            {readable}
          </pre>
        </div>
      </div>
    </details>
  );
}
