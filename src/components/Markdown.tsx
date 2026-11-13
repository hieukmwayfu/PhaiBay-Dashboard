import type { ReactNode } from "react";

// Small markdown renderer for AI answers. Builds React elements only (never innerHTML), so model
// output cannot inject markup. Supports: headings, paragraphs, **bold**, *italic*, `code`,
// fenced code blocks, bullet / numbered lists, tables, horizontal rules.

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k} className="font-semibold text-fg">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-raised px-1 py-0.5 font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const numeric = (s: string) => /^[-+]?[\d.,]+\s*[%KMBk]?$/.test(s.replace(/[*`]/g, ""));

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }

    if (l.trim().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="code overflow-x-auto p-3">{body.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl <= 2 ? "mt-4 text-base font-bold" : "mt-3 text-sm font-semibold";
      blocks.push(<div key={k++} className={`${cls} text-fg first:mt-0`}>{inline(h[2], k)}</div>);
      i++;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(l)) { blocks.push(<hr key={k++} className="my-3 border-line" />); i++; continue; }

    if (isTableRow(l) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      const num = head.map((_, c) => rows.length > 0 && rows.every((r) => !r[c] || numeric(r[c])));
      blocks.push(
        <div key={k++} className="my-2 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <thead className="bg-raised/60">
              <tr>{head.map((c, j) => <th key={j} className={`whitespace-nowrap px-3 py-2 font-semibold ${num[j] ? "text-right" : "text-left"}`}>{inline(c, j)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-line/70">
                  {head.map((_, j) => <td key={j} className={`px-3 py-1.5 ${num[j] ? "text-right tabular" : ""}`}>{inline(r[j] ?? "", ri * 100 + j)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const li = /^\s*([-*•]|\d+[.)])\s+/;
    if (li.test(l)) {
      const ordered = /^\s*\d/.test(l);
      const items: { text: string; sub: boolean }[] = [];
      while (i < lines.length && li.test(lines[i])) {
        items.push({ text: lines[i].replace(li, ""), sub: /^\s{2,}/.test(lines[i]) });
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={k++} className={`my-1.5 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-dim`}>
          {items.map((it, j) => <li key={j} className={it.sub ? "ml-4" : ""}>{inline(it.text, j)}</li>)}
        </List>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !li.test(lines[i]) && !/^#{1,4}\s/.test(lines[i]) && !lines[i].trim().startsWith("```") && !isTableRow(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++} className="my-1.5 leading-relaxed">{inline(para.join(" "), k)}</p>);
  }
  return <div className="text-sm text-fg/90">{blocks}</div>;
}
