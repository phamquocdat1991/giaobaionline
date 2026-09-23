"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  content?: string;
  className?: string;
}

type Token = {
  type: "text" | "math";
  value: string;
  display?: boolean;
};

function parseMathTokens(text: string): Token[] {
  if (!text) return [];

  const tokens: Token[] = [];
  // Matches:
  // 1. $$...$$ (display math)
  // 2. \[...\] (display math)
  // 3. $...$ (inline math)
  // 4. \(...\) (inline math)
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([\s\S]+?\\\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    if (raw.startsWith("$$") && raw.endsWith("$$")) {
      tokens.push({ type: "math", value: raw.slice(2, -2).trim(), display: true });
    } else if (raw.startsWith("\\[") && raw.endsWith("\\]")) {
      tokens.push({ type: "math", value: raw.slice(2, -2).trim(), display: true });
    } else if (raw.startsWith("$") && raw.endsWith("$")) {
      tokens.push({ type: "math", value: raw.slice(1, -1).trim(), display: false });
    } else if (raw.startsWith("\\(") && raw.endsWith("\\)")) {
      tokens.push({ type: "math", value: raw.slice(2, -2).trim(), display: false });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

export function MathText({ content = "", className = "" }: MathTextProps) {
  const renderedElements = useMemo(() => {
    if (!content) return null;
    const tokens = parseMathTokens(content);

    return tokens.map((token, index) => {
      if (token.type === "math") {
        try {
          const html = katex.renderToString(token.value, {
            displayMode: token.display,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className={token.display ? "katex-display-wrapper my-1 block" : "katex-inline-wrapper"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{token.value}</span>;
        }
      }

      // Render text with line breaks preserved
      const lines = token.value.split("\n");
      return (
        <React.Fragment key={index}>
          {lines.map((line, lineIdx) => (
            <React.Fragment key={lineIdx}>
              {line}
              {lineIdx < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    });
  }, [content]);

  return <span className={`math-rendered ${className}`}>{renderedElements}</span>;
}
