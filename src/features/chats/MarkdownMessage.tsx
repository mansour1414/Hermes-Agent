import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/utils/cn";

/** Lightweight syntax highlighting for fenced code blocks. */
type Token = { text: string; className?: string };

function highlight(code: string): Token[][] {
  const keywords = [
    "const", "let", "var", "function", "return", "if", "else", "for", "while", "class",
    "import", "from", "export", "default", "async", "await", "try", "catch", "finally",
    "new", "type", "interface", "extends", "implements", "public", "private", "protected",
    "readonly", "def", "elif", "None", "True", "False", "print", "import", "self", "null",
  ];
  const lines = code.split("\n");
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
      return [{ text: line, className: "text-subtle italic" }];
    }
    const keywordMatch = trimmed.match(/^(\s*)([A-Za-z_$][\w$]*)/);
    if (keywordMatch && keywords.includes(keywordMatch[2])) {
      return [
        { text: keywordMatch[1] },
        { text: keywordMatch[2], className: "text-accent font-medium" },
        { text: line.slice(keywordMatch[0].length) },
      ];
    }
    return [{ text: line }];
  });
}

export function MarkdownMessage({ content, className }: { content: string; className?: string }) {
  const codeBlocks = useMemo(() => content.match(/```[\s\S]*?```/g) ?? [], [content]);

  return (
    <div className={cn("space-y-3 text-[0.875rem] leading-relaxed text-ink", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-[1.85]">{children}</p>,
          h1: ({ children }) => (
            <h1 className="text-base font-semibold text-ink">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[0.9375rem] font-semibold text-ink">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[0.875rem] font-semibold text-ink">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 ps-5 marker:text-subtle">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 ps-5 marker:text-subtle">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-[1.8]">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-accent underline underline-offset-4 hover:opacity-80"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          code: ({ children, className: codeClass }) => {
            const isBlock = codeClass?.includes("language-");
            if (!isBlock) {
              return (
                <code className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.8125rem] text-accent">
                  {children}
                </code>
              );
            }
            const raw = String(children).replace(/\n$/, "");
            const lines = highlight(raw);
            return (
              <pre className="cc-scroll overflow-x-auto rounded-xl border border-line bg-canvas-alt p-3.5 text-start font-mono text-[0.78rem] leading-relaxed">
                <code>
                  {lines.map((tokens, index) => (
                    <span key={index} className="block">
                      {tokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={token.className}>
                          {token.text}
                        </span>
                      ))}
                    </span>
                  ))}
                </code>
              </pre>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-s-2 border-accent bg-accent-soft/40 px-3.5 py-2 text-[0.8125rem] text-muted">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="cc-scroll overflow-x-auto">
              <table className="w-full border-collapse text-[0.8125rem]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-line bg-surface-2 px-2.5 py-1.5 text-start font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-line px-2.5 py-1.5">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {codeBlocks.length > 0 ? null : null}
    </div>
  );
}
