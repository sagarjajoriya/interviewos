"use client";

import ReactMarkdown from "react-markdown";

/**
 * Compact markdown renderer for chat bubbles and transcripts.
 * Safe by default (react-markdown never injects raw HTML) and styled to sit
 * tightly inside a message bubble rather than like a document.
 */
export default function Markdown({ children }) {
  return (
    <div className="md-body leading-relaxed text-[0.95rem]">
      <ReactMarkdown
        components={{
          p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
          ul: (props) => <ul className="my-2 ml-5 list-disc space-y-1" {...props} />,
          ol: (props) => <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />,
          li: (props) => <li className="leading-relaxed" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          a: ({ href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-2 underline underline-offset-2"
              {...props}
            />
          ),
          code: ({ className, ...props }) =>
            /language-/.test(className || "") ? (
              <code className={className} {...props} />
            ) : (
              <code
                className="rounded bg-surface-2 border border-border px-1 py-0.5 text-[0.85em] font-mono"
                {...props}
              />
            ),
          pre: (props) => (
            <pre
              className="my-2 overflow-x-auto rounded-lg bg-surface-2 border border-border p-3 text-[0.85em] font-mono"
              {...props}
            />
          ),
          h1: (props) => <p className="my-2 font-semibold" {...props} />,
          h2: (props) => <p className="my-2 font-semibold" {...props} />,
          h3: (props) => <p className="my-2 font-semibold" {...props} />,
          blockquote: (props) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted" {...props} />
          ),
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
