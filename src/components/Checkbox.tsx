import { useEffect, useRef, type InputHTMLAttributes } from 'react';

export function Checkbox({
  indeterminate = false,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={`h-4 w-4 cursor-pointer rounded border-stone-400 accent-accent-700 ${className}`}
      {...props}
    />
  );
}
