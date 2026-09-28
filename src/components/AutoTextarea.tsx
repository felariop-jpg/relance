import { forwardRef, useEffect, useImperativeHandle, useRef, type TextareaHTMLAttributes } from 'react';

/** A textarea that grows with its content, so long emails never need an inner scrollbar. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoTextarea(props, forwarded) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwarded, () => ref.current!);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    }, [props.value]);
    return <textarea ref={ref} {...props} />;
  },
);
