import { Code2 } from "lucide-react";

// Логотип: градієнтний значок і назва
export default function Logo({ size = 38, light = false }) {
  return (
    <div className="logo">
      <span className="logo-mark" style={{ width: size, height: size }}>
        <Code2 size={size * 0.55} strokeWidth={2.4} />
      </span>
      <span className={`logo-text ${light ? "logo-text-light" : ""}`}>
        Code<b>Inspector</b>
      </span>
    </div>
  );
}
