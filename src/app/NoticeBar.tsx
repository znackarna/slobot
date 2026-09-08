/**
 * The notice bar itself. Draws what `useNotices` holds and owns nothing.
 *
 * The ring empties over exactly the time the timer waits, so the number lives
 * with the timer and the stylesheet only draws it.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { useI18n } from "../i18n";
import { frontDialog, watchFrontDialog } from "../useDialog";
import CountdownRing from "../CountdownRing";
import { NOTICE_LIFE } from "./useNotices";
import type { Notices } from "./useNotices";

export function NoticeBar({ notices }: { notices: Notices }) {
  const { t } = useI18n();
  const { notice, closing } = notices.state;
  /* Which surface is in front. `useSyncExternalStore` rather than an effect:
     the answer must be read during the render that draws the bar, or a message
     raised in the same tick a dialog opens is drawn on the page first and
     jumps into the dialog afterwards. */
  const dialog = useSyncExternalStore(watchFrontDialog, frontDialog, () => null);
  /* A host of its own at the top of the dialog. `createPortal` appends, and the
     bar belongs above the heading rather than below the footer — and no dialog
     is asked to carry a slot for it, which is what keeps this one rule instead
     of seven. */
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!dialog) {
      setHost(null);
      return;
    }
    const slot = document.createElement("div");
    slot.className = "dialog-notice";
    dialog.prepend(slot);
    setHost(slot);
    return () => {
      slot.remove();
      setHost(null);
    };
  }, [dialog]);

  if (!notice) return null;

  const bar = (
    <div
      className={`notice ${notice.kind}${closing ? " leaving" : ""}`}
      role={notice.kind === "error" ? "alert" : "status"}
      style={{ "--notice-life": `${NOTICE_LIFE[notice.kind]}ms` } as CSSProperties}
    >
      {/* The ring empties over the seconds the bar has left, so it is visible
          that it will go on its own — and how soon. A bar that waits does not
          draw it: an emptying ring over a bar that is not leaving is a promise
          about the wrong thing. */}
      {!notice.action && <CountdownRing className="notice-countdown" size={16} />}
      <span>{notice.text}</span>
      {/* The way on before the way out, and the strong one of the two. Reading
          order is the order of the two answers: here is the thing, go to it, or
          not now. */}
      {notice.action && (
        <button
          className="notice-action"
          onClick={() => {
            notice.action?.run();
            notices.actions.dismiss();
          }}
        >
          {notice.action.label}
        </button>
      )}
      <button onClick={notices.actions.dismiss}>{t("common.close")}</button>
    </div>
  );

  /* Into the dialog when one is open, and as its first child so it sits at the
     top of the box the reader is already looking at. The stylesheet gives it
     the dialog's own corners and bleeds it to the edges; nothing else about the
     bar changes, because it is the same bar. */
  if (!dialog) return bar;
  // The host arrives one render after the dialog does. Drawing the bar on the
  // page in between would put it on the blurred backdrop for a frame, which is
  // the thing being repaired.
  return host ? createPortal(bar, host) : null;
}