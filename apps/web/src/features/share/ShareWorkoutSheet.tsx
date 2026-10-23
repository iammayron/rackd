"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useQuery } from "@tanstack/react-query";
import { ShareCard, SegmentedControl, type ShareCardTheme } from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { BottomSheet } from "@/components/BottomSheet";
import { buildShareCardData, type ShareSessionTree, type SharePrRow } from "./buildShareCardData";
import { deliverShareImage, shareCap } from "./native-share";

/** Copy the logo into the card so the Android WebView can rasterize it. */
async function inlineImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      if (!img.src || img.src.startsWith("data:")) return;
      try {
        const res = await fetch(img.src);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        if (dataUrl) img.src = dataUrl;
      } catch {
        // The rasterizer retries the original address.
      }
    }),
  );
}

/** iOS-style share glyph (tray + up arrow). */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** Download glyph (down arrow into a tray). */
function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 21h14" />
    </svg>
  );
}

/** One action chip: a round icon button with a label below. */
function ShareAction({
  label,
  icon,
  onClick,
  primary = false,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 py-2 text-[var(--text)] active:scale-95 disabled:opacity-60"
    >
      <span
        className={
          "flex h-14 w-14 items-center justify-center rounded-full " +
          (primary
            ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
            : "bg-[var(--surface-2)] text-[var(--text)]")
        }
      >
        {icon}
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

/**
 * Share-workout slide-up (post-workout summary + recent-sessions list). Shows the
 * share card, a theme switch, and two actions: Save image (download the PNG) and
 * Share — the native OS share sheet carrying the rendered image plus a caption,
 * which is the only web path that gets the image into Instagram/WhatsApp/etc.
 */
export function ShareWorkoutSheet({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { unit, display } = useUnit();

  const { data: session } = useQuery({
    queryKey: qk.session(sessionId),
    queryFn: () => api<ShareSessionTree>(`/api/sessions/${sessionId}`),
    enabled: open && Boolean(sessionId),
  });
  const { data: allPrs = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<SharePrRow[]>("/api/personal-records"),
    enabled: open,
  });

  const prs = useMemo(() => allPrs.filter((pr) => pr.sessionId === sessionId), [allPrs, sessionId]);
  const { cardData, shareText } = useMemo(() => {
    const appUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    return buildShareCardData(session, prs, { display, unit, appUrl });
  }, [session, prs, display, unit]);

  const [theme, setTheme] = useState<ShareCardTheme>("accent");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  async function rasterize(): Promise<{ dataUrl: string; file: File } | null> {
    const node = cardRef.current;
    if (!node) return null;
    await inlineImages(node);
    const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, skipFonts: true });
    const blob = await (await fetch(dataUrl)).blob();
    return { dataUrl, file: new File([blob], "rackd-workout.png", { type: "image/png" }) };
  }

  function saveDataUrl(dataUrl: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "rackd-workout.png";
    a.click();
  }

  /** Native share sheet with the rendered image + caption; falls back to saving. */
  async function share() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await rasterize();
      if (!out) {
        setMsg("Couldn’t make the image.");
        return;
      }
      if (await deliverShareImage(shareCap(), "share", out.dataUrl, shareText)) return;
      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [out.file] })) {
        await nav.share({ files: [out.file], text: shareText, title: "Rackd workout" });
      } else if (nav.share) {
        // No file support (e.g. desktop) — share the caption + link as text.
        await nav.share({ text: shareText, title: "Rackd workout" });
      } else {
        saveDataUrl(out.dataUrl);
        setMsg("Sharing not supported — image saved instead");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setMsg("Couldn’t share — try saving the image.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveImage() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await rasterize();
      if (!out) {
        setMsg("Couldn’t make the image.");
        return;
      }
      if (await deliverShareImage(shareCap(), "save", out.dataUrl, shareText)) {
        setMsg("Image saved");
        return;
      }
      saveDataUrl(out.dataUrl);
      setMsg("Image saved");
    } catch {
      setMsg("Couldn’t save the image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Share workout">
      <div className="px-1 pt-2">
        <div className="mx-auto mb-4 w-full max-w-[300px]">
          <div ref={cardRef}>
            <ShareCard data={cardData} theme={theme} />
          </div>
        </div>

        <div className="mb-5 flex justify-center">
          <SegmentedControl
            size="sm"
            value={theme}
            onChange={(v) => setTheme(v as ShareCardTheme)}
            options={[
              { value: "accent", label: "Coral" },
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
          />
        </div>

        {msg && <p className="mb-2 text-center text-sm text-[var(--text-muted)]">{msg}</p>}

        <div className="flex justify-center gap-10">
          <ShareAction
            label="Save image"
            icon={<DownloadIcon />}
            onClick={saveImage}
            disabled={busy}
          />
          <ShareAction label="Share" icon={<ShareIcon />} onClick={share} primary disabled={busy} />
        </div>
      </div>
    </BottomSheet>
  );
}
