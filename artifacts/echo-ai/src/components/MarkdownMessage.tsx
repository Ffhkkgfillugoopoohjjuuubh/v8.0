import ReactMarkdown from "react-markdown";
import { useApp } from "@/context/AppContext";

export default function MarkdownMessage({ content }: { content: string }) {
  const { settings } = useApp();
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      style={{ fontSize: settings.fontSize }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
