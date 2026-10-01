"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { asset } from "@/lib/asset";
import { isChunkError, NEW_VERSION_EVENT } from "@/lib/errors";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const CHECK_EVERY_MS = 5 * 60_000;

/**
 * Tells the team when the portal has been updated since this tab was opened,
 * so they reload before an old tab trips over missing files.
 */
export default function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const flag = () => setShow(true);
    const onError = (e: ErrorEvent) => isChunkError(e.error ?? e.message) && flag();
    const onRejection = (e: PromiseRejectionEvent) => isChunkError(e.reason) && flag();
    window.addEventListener(NEW_VERSION_EVENT, flag);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Published builds include version.json; compare it with the build this tab runs.
    let timer: ReturnType<typeof setInterval> | undefined;
    if (BUILD_ID) {
      const check = async () => {
        try {
          const res = await fetch(asset(`/version.json?t=${Date.now()}`), { cache: "no-store" });
          if (res.ok && (await res.json()).build !== BUILD_ID) flag();
        } catch {
          /* offline: try again later */
        }
      };
      timer = setInterval(check, CHECK_EVERY_MS);
      const onVisible = () => document.visibilityState === "visible" && check();
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener(NEW_VERSION_EVENT, flag);
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
      };
    }
    return () => {
      window.removeEventListener(NEW_VERSION_EVENT, flag);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!show) return null;
  return (
    <div className="update-banner no-print" role="status">
      <Icon name="sparkles" size={18} />
      <span>
        <strong>A new version of the portal is available.</strong> Your work is saved. Reload to get the latest version.
      </span>
      <button className="btn small accent" onClick={() => window.location.reload()}>
        <Icon name="refresh" size={14} />
        Reload
      </button>
      <button className="btn small ghost icon" title="Later" onClick={() => setShow(false)} style={{ color: "#fff" }}>
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
