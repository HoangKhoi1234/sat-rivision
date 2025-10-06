import React, { useEffect, useRef, useState } from "react";
import { formatSatText, formatSatInline } from "@/lib/formatText";

interface AnnotatableTextProps {
  initialText: string;
  htmlValue?: string;
  onChange?: (html: string) => void;
  enabled?: boolean;
  color?: "green" | "yellow" | "red";
  mode?: "highlight" | "underline";
  className?: string;
  variant?: "passage" | "inline";
}

const colorClassMap: Record<NonNullable<AnnotatableTextProps["color"]>, string> = {
  green: "text-yellow-600",
  yellow: "text-yellow-600",
  red: "text-yellow-600",
};

const underlineClassMap: Record<NonNullable<AnnotatableTextProps["color"]>, string> = {
  green: "text-yellow-600",
  yellow: "text-yellow-600",
  red: "text-yellow-600",
};

function escapeHTML(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

export const AnnotatableText: React.FC<AnnotatableTextProps> = ({
  initialText,
  htmlValue,
  onChange,
  enabled = false,
  color = "yellow",
  mode = "underline",
  className,
  variant = "passage",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string>(htmlValue || (variant === "inline" ? formatSatInline(initialText) : formatSatText(initialText)));

  // Sync when question changes or external value changes
  useEffect(() => {
    if (htmlValue && htmlValue.length > 0) {
      setHtml(htmlValue);
    } else {
      setHtml(variant === "inline" ? formatSatInline(initialText) : formatSatText(initialText));
    }
  }, [initialText, htmlValue, variant]);

  const applyHighlight = () => {
    if (!enabled) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container) return;

    // Ensure selection is inside our container
    if (!container.contains(range.commonAncestorContainer)) return;

    try {
      const span = document.createElement("span");
      span.className = colorClassMap[color];
      range.surroundContents(span);

      // Update internal and external state
      const newHtml = container.innerHTML;
      setHtml(newHtml);
      onChange?.(newHtml);

      // Clear selection
      selection.removeAllRanges();
    } catch (e) {
      // If surroundContents fails (e.g., partial selection), fallback: wrap extracted contents
      try {
        const contents = range.extractContents();
        const span = document.createElement("span");
        span.className = colorClassMap[color];
        span.appendChild(contents);
        range.insertNode(span);
        const newHtml = containerRef.current?.innerHTML || "";
        setHtml(newHtml);
        onChange?.(newHtml);
        selection?.removeAllRanges();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseUp={applyHighlight}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default AnnotatableText;
