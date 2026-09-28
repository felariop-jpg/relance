import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/**
 * A textarea that grows with its content, so long emails never need an inner
 * scrollbar. It never shrinks below its `rows`, and it measures again when it
 * becomes visible (inside a dialog or a tab it may first render with no size).
 */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoTextarea(props, forwarded) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwarded, () => ref.current!);

    const fit = () => {
      const el = ref.current;
      if (!el || el.offsetParent === null) return;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      const minimum = (props.rows ?? 2) * lineHeight + 18;
      el.style.height = 'auto';
      el.style.height = `${Math.max(minimum, el.scrollHeight + 2)}px`;
    };

    useLayoutEffect(fit, [props.value, props.rows]); // eslint-disable-line react-hooks/exhaustive-deps

    useLayoutEffect(() => {
      const el = ref.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      // Refit when the box gets a width (first shown, dialog opened, tab switched).
      let lastWidth = el.clientWidth;
      const observer = new ResizeObserver(() => {
        if (el.clientWidth !== lastWidth) {
          lastWidth = el.clientWidth;
          fit();
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return <textarea ref={ref} {...props} />;
  },
);
