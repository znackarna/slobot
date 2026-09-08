// @vitest-environment jsdom
/**
 * Where the application says something, over the report of 8 September.
 *
 * The bar carries `z-index: 70` so a message raised while a dialog is open is
 * not lost behind the scrim — the repair for messages that used to vanish, and
 * the reason the wizard stopped drawing a panel of its own. What it left was a
 * coloured strip floating on a blurred backdrop, painted over the dialog and
 * belonging to nothing on screen: *cele to pozadí je rozmazane, nad tim je
 * dialog a pak tam zacne viset ta lista*.
 *
 * So the bar goes where the front is. Still one bar, one component and one
 * rule — which is what these cases hold: it moves, it does not multiply, and it
 * comes back to the page when the dialog closes.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { I18nProvider } from "../i18n";
import { useDialog } from "../useDialog";
import { NoticeBar } from "./NoticeBar";
import type { Notices } from "./useNotices";

function notices(text = "Uloženo."): Notices {
  return {
    state: { notice: { kind: "info", text }, closing: false },
    actions: { info: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
  } as unknown as Notices;
}

/** A dialog the way every dialog in this application is one: through
 *  `useDialog`, which is where the front is registered. */
function Dialog({ open }: { open: boolean }) {
  const dialog = useDialog<HTMLDivElement>(undefined, open);
  const fallback = useRef<HTMLDivElement>(null);
  if (!open) return <div ref={fallback} />;
  return (
    <div className="dialog-overlay">
      <div ref={dialog} className="dialog" role="dialog" aria-modal="true">
        <h2>Jak chcete nahrávku uložit?</h2>
        <button>Zrušit</button>
      </div>
    </div>
  );
}

/** A dialog shaped like the language model's preview: a heading, a row of tabs,
 *  and the content under them. */
function DialogWithSlot() {
  const dialog = useDialog<HTMLDivElement>(undefined, true);
  return (
    <div ref={dialog} className="dialog" role="dialog" aria-modal="true">
      <h2>Vylepšený přepis</h2>
      <nav>
        <button>Přepis</button>
        <button>Shrnutí</button>
      </nav>
      <div className="dialog-notice-slot" />
      <p>All right, Petunia.</p>
    </div>
  );
}

function show(open: boolean) {
  return render(
    <I18nProvider>
      <Dialog open={open} />
      <NoticeBar notices={notices()} />
    </I18nProvider>
  );
}

afterEach(cleanup);

describe("where a message is said", () => {
  test("on the page when no dialog is open", () => {
    show(false);

    const bar = document.querySelector(".notice");
    expect(bar).not.toBeNull();
    expect(bar?.closest(".dialog")).toBeNull();
  });

  /** The reported case. */
  test("inside the dialog when one is open", () => {
    show(true);

    const bar = document.querySelector(".notice");
    expect(bar).not.toBeNull();
    expect(bar?.closest(".dialog")).not.toBeNull();
  });

  /** Above the heading, not below the footer — `createPortal` appends, which is
   *  why the host is put at the top by hand. */
  test("at the top of the dialog, before its heading", () => {
    show(true);

    const dialog = document.querySelector(".dialog")!;
    const bar = dialog.querySelector(".notice")!;
    const heading = dialog.querySelector("h2")!;
    expect(bar.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /** One bar, moved rather than copied: a second would be the two places the
   *  `z-index` was raised to be rid of. */
  test("is said once, never twice", () => {
    show(true);

    expect(document.querySelectorAll(".notice").length).toBe(1);
    expect(screen.getAllByText("Uloženo.").length).toBe(1);
  });

  /** A dialog with a header of its own says where it wants the bar, and the
   *  top of the box is above a heading and a row of tabs the reader needs to
   *  keep seeing. The default is the top; the slot overrides it. */
  test("goes where the dialog says, when it says", () => {
    render(
      <I18nProvider>
        <div className="dialog-overlay">
          <DialogWithSlot />
        </div>
        <NoticeBar notices={notices()} />
      </I18nProvider>
    );

    const dialog = document.querySelector(".dialog")!;
    const bar = dialog.querySelector(".notice")!;
    expect(bar.closest(".dialog-notice-slot")).not.toBeNull();
    // Under the tabs, not above the heading.
    const tabs = dialog.querySelector("nav")!;
    expect(tabs.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /** And it comes back to the page when the dialog goes. */
  test("returns to the page when the dialog closes", () => {
    const { rerender } = show(true);
    expect(document.querySelector(".notice")?.closest(".dialog")).not.toBeNull();

    rerender(
      <I18nProvider>
        <Dialog open={false} />
        <NoticeBar notices={notices()} />
      </I18nProvider>
    );

    const bar = document.querySelector(".notice");
    expect(bar).not.toBeNull();
    expect(bar?.closest(".dialog")).toBeNull();
  });
});
