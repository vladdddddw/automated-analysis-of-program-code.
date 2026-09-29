import { Braces, FileText } from "lucide-react";
import { SEVERITIES } from "../../api/seed.js";
import { downloadFile, reportToHtml } from "../../utils/format.js";
import { useToast } from "../../context/ToastContext.jsx";
import Button from "../common/Button.jsx";

// Експорт звіту у JSON та HTML (генерується на клієнті; на бекенді це буде GET /api/analyses/{id}/export)
export default function ExportButtons({ analysis }) {
  const toast = useToast();
  const base = analysis.title.replace(/[^\p{L}\p{N}_-]+/gu, "_");

  const exportJson = () => {
    const data = { ...analysis, files: analysis.files.map(({ content, ...f }) => f) };
    downloadFile(`${base}.json`, JSON.stringify(data, null, 2), "application/json");
    toast.success("Звіт JSON збережено");
  };
  const exportHtml = () => {
    downloadFile(`${base}.html`, reportToHtml(analysis, SEVERITIES), "text/html");
    toast.success("Звіт HTML збережено");
  };

  return (
    <>
      <Button variant="secondary" onClick={exportJson}><Braces size={16} />JSON</Button>
      <Button variant="secondary" onClick={exportHtml}><FileText size={16} />HTML</Button>
    </>
  );
}
