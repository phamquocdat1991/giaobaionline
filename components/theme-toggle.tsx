"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <button type="button" className="theme-toggle-btn" aria-label="Đổi giao diện sáng/tối" disabled>
        <Sun size={17} />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
      aria-label="Đổi giao diện sáng/tối"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
