import { useEffect, useState } from "react";

// Refresh time-sensitive page content without rerendering the app shell/search.
export function useMinute() {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    const update = () => setMinute(Math.floor(Date.now() / 60000));
    const timer = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return minute;
}
