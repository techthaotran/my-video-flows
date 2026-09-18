import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/utils';

interface EditableTextProps {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  rows?: number;
}

/** Ô chữ local state; commit khi blur nếu giá trị khác. */
export function EditableText({
  value,
  onCommit,
  multiline,
  disabled,
  className,
  placeholder,
  rows = 3,
}: EditableTextProps) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = () => {
    focused.current = false;
    if (draft !== value) onCommit(draft);
  };

  const shared = {
    value: draft,
    disabled,
    placeholder,
    className: cn(
      'w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm leading-relaxed outline-none transition-shadow focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60',
      className,
    ),
    onFocus: () => {
      focused.current = true;
    },
    onBlur: commit,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft(e.target.value);
    },
  };

  if (multiline) {
    return <textarea {...shared} rows={rows} />;
  }
  return <input type="text" {...shared} />;
}
