import { useId, useState } from "react";

interface Props {
  text: string;
  label: string;
}

/** 标签旁小问号：悬停用 title，点击展开说明 */
export function HelpTip({ text, label }: Props) {
  const tipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="help-tip">
      <button
        type="button"
        className="help-tip-btn"
        title={text}
        aria-label={`${label}说明`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span id={tipId} className="help-tip-pop" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
