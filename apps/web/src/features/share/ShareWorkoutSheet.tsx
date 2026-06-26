"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useQuery } from "@tanstack/react-query";
import { ShareCard, SegmentedControl, type ShareCardTheme } from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { BottomSheet } from "@/components/BottomSheet";
import {
  buildShareCardData,
  type ShareSessionTree,
  type SharePrRow,
} from "./buildShareCardData";

/** One action chip in the share grid: a round glyph button with a label below. */
function ShareAction({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] py-3 text-[var(--text)] active:scale-95"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-xl">
        {glyph}
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

/**
 * Share-workout slide-up (reached from the post-workout summary and from the
 * recent-sessions list). Renders the share card, a theme switch, and the share
 * actions. The card node is rasterized on demand for image-based shares.
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

  const prs = useMemo(
    () => allPrs.filter((pr) => pr.sessionId === sessionId),
    [allPrs, sessionId],
  );
  const { cardData, shareText } = useMemo(
    () => buildShareCardData(session, prs, { display, unit }),
    [session, prs, display, unit],
  );

  const [theme, setTheme] = useState<ShareCardTheme>("accent");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  async function rasterize(): Promise<{ dataUrl: string; file: File } | null> {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
    const blob = await (await fetch(dataUrl)).blob();
    return { dataUrl, file: new File([blob], "rackd-workout.png", { type: "image/png" }) };
  }

  /** Native share with the rendered image; falls back to saving the PNG. */
  async function shareImage() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await rasterize();
      if (!out) return;
      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [out.file] })) {
        await nav.share({ files: [out.file], text: shareText, title: "Rackd workout" });
      } else {
        saveDataUrl(out.dataUrl);
        setMsg("Image saved");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setMsg("Couldn’t share — try saving the image.");
      }
    } finally {
      setBusy(false);
    }
  }

  function saveDataUrl(dataUrl: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "rackd-workout.png";
    a.click();
  }

  async function saveImage() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await rasterize();
      if (out) {
        saveDataUrl(out.dataUrl);
        setMsg("Image saved");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard?.writeText(shareText);
      setMsg("Summary copied");
    } catch {
      setMsg("Couldn’t copy");
    }
  }

  function openX() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Share workout">
      <div className="px-1 pt-2">
        <div className="mx-auto mb-4 w-full max-w-[300px]">
          <div ref={cardRef}>
            <ShareCard data={cardData} theme={theme} />
          </div>
        </div>

        <div className="mb-4 flex justify-center">
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

        <div className="grid grid-cols-3 gap-1">
          <ShareAction label="Stories" glyph="▣" onClick={shareImage} />
          <ShareAction label="Instagram" glyph="◎" onClick={shareImage} />
          <ShareAction label="X" glyph="𝕏" onClick={openX} />
          <ShareAction label="Save image" glyph="↓" onClick={saveImage} />
          <ShareAction label="Copy link" glyph="🔗" onClick={copyLink} />
          <ShareAction label="More" glyph="···" onClick={shareImage} />
        </div>
      </div>
    </BottomSheet>
  );
}
