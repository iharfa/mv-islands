import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";

const DOCS: Record<string, string> = {
  "data-dictionary": "data-dictionary.md",
  "source-inventory": "source-inventory.md",
  "source-recon": "source-recon.md",
  scrapers: "scrapers.md",
};

export default async function DocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const file = DOCS[doc];
  if (!file) notFound();
  const full = path.join(process.cwd(), "docs", file);
  if (!fs.existsSync(full)) {
    return (
      <div className="mx-auto max-w-[900px] px-4 md:px-10 py-10 w-full">
        <EmptyState title="Document not yet generated" detail={`docs/${file} will be created with the next snapshot.`} />
      </div>
    );
  }
  const md = fs.readFileSync(full, "utf8");
  // Minimal markdown rendering (headings, code, lists) without extra deps.
  const html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/```([\s\S]*?)```/g, "<pre>$1</pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, "<br/><br/>");
  return (
    <div className="mx-auto max-w-[900px] px-4 md:px-10 py-10 w-full">
      <article
        className="card p-6 md:p-8 prose-sm [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-ocean [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ocean [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-4 [&_pre]:bg-sand [&_pre]:p-3 [&_pre]:rounded [&_pre]:text-xs [&_pre]:overflow-x-auto [&_code]:bg-sand [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-ocean [&_a]:underline text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
