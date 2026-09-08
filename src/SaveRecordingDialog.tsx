/**
 * What to take away from a whole recording.
 *
 * The same question the clip dialog asks about a passage, so it wears the same
 * list: the audio for the podcast, the subtitles for the video and the text for
 * the quote come out of one recording at one moment, and a control that asks
 * for one of them at a time asks the reader to come back four times.
 *
 * It replaces `Uložit zvuk…`, which was the audio alone behind a menu item
 * that named it — one door for one format while the transcript's own formats
 * sat behind another. Asked for on 2026-09-02: *Uložit zvuk bych změnil na
 * Uložit jako*.
 */
import { useState } from "react";
import { useI18n } from "./i18n";
import type { TranslationKey } from "./i18n";
import { useDialog } from "./useDialog";
import { CheckBox } from "./CheckBox";
import InfoNote from "./InfoNote";
import type { Recording, UserMessage } from "./types";
import { AUDIO_FORMATS, defaultAudioFormat, saveRecording } from "./saveRecording";
import type { AudioFormat, SaveShape } from "./saveRecording";

/** The shapes, their words and the line under each — spelled out rather than
 *  built from the shape's name, so `i18n:check` can see the keys and catch a
 *  shape added later without a word of its own. */
const SHAPES = [
  ["audio", "save.shape.audio", "save.shapeNote.audio"],
  ["txt", "save.shape.txt", "save.shapeNote.txt"],
  ["md", "save.shape.md", "save.shapeNote.md"],
  ["srt", "save.shape.srt", "save.shapeNote.srt"],
  ["vtt", "save.shape.vtt", "save.shapeNote.vtt"],
  ["json", "save.shape.json", "save.shapeNote.json"],
] as const satisfies ReadonlyArray<readonly [SaveShape, TranslationKey, TranslationKey]>;

export function SaveRecordingDialog({
  recording,
  chooseFile,
  chooseFolder,
  onClose,
  onError,
  onSaved,
}: {
  /** The recording being saved, or null when the dialog is shut. */
  recording: Recording | null;
  chooseFile: (name: string) => Promise<string | null>;
  chooseFolder: () => Promise<string | null>;
  onClose: () => void;
  onError: (message: UserMessage) => void;
  onSaved: (paths: string[]) => void;
}) {
  const { t } = useI18n();
  const [ticked, setTicked] = useState<SaveShape[]>(["audio"]);
  /* Read from the recording rather than fixed, so a source the core can write
     opens on its own container and the export stays a copy. */
  const [audio, setAudio] = useState<AudioFormat>(() =>
    recording ? defaultAudioFormat(recording.path) : "mp3"
  );
  const [busy, setBusy] = useState(false);
  const dialog = useDialog<HTMLDivElement>(onClose, recording !== null);

  if (!recording) return null;

  /* Nothing to write but the audio until there is a transcript. The rows stay
     visible rather than disappearing: a reader who has not transcribed yet
     should be able to see what saving will offer once they have. */
  const noTranscript = recording.segment_count === 0;

  const toggle = (shape: SaveShape) =>
    setTicked((current) =>
      current.includes(shape) ? current.filter((s) => s !== shape) : [...current, shape]
    );

  /* The language model's tidied version is not here. It lives in the AI tools,
     beside the thing that made it, and putting it in this list as well made six
     rows into eight — for a document most recordings never have. His call, on
     2026-09-02: *nenecháme ho jen v nabídce AI nástrojů, ať ta nabídka není tak
     dlouhá?* */
  const rows = SHAPES;
  const offered = (shape: SaveShape) => !(noTranscript && shape !== "audio");
  const chosen = rows
    .map(([shape]) => shape)
    .filter((shape) => ticked.includes(shape) && offered(shape));

  const save = async () => {
    setBusy(true);
    await saveRecording({
      recording,
      shapes: chosen,
      audio,
      chooseFile,
      chooseFolder,
      onError,
      onSaved: (paths) => {
        onClose();
        onSaved(paths);
      },
    });
    setBusy(false);
  };

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        ref={dialog}
        className="dialog save-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="save-dialog-title">{t("save.title")}</h2>
        {/* The recording's name stood here and said nothing: the reader
            opened this from that very recording. The one thing they cannot see
            from the list is that the boxes are boxes — that all of it can come
            out at once — so the line says that instead. */}
        <InfoNote compact>{t("save.text")}</InfoNote>

        <ul className="about-panel save-choices">
          {rows.map(([shape, word, note]) => (
            <li key={shape}>
              <label className="save-choice">
                <input
                  type="checkbox"
                  className="check-box-input"
                  checked={ticked.includes(shape) && offered(shape)}
                  disabled={!offered(shape)}
                  onChange={() => toggle(shape)}
                />
                <CheckBox />
                <span className="save-choice-name">{t(word)}</span>
                <span className="save-choice-note">
                  {offered(shape) ? t(note) : t("save.needsTranscript")}
                </span>
                {/* **The container, on the row that writes it.** The name was
                    built from the source's extension and the core can write
                    only these three, so a video asked for `.mp4`, was refused,
                    and the message said to choose another — with nowhere to
                    choose. The buttons are the row's own, not a second
                    question: ticking the row is still the whole decision, and
                    this only says in what.

                    Inside the `<label>` and stopping the press, or clicking a
                    format would toggle the box the label is for. */}
                {shape === "audio" && (
                  <span className="save-formats">
                    {AUDIO_FORMATS.map((format) => (
                      <button
                        key={format}
                        type="button"
                        className={`save-format ${audio === format ? "chosen" : ""}`}
                        aria-pressed={audio === format}
                        onClick={(event) => {
                          event.preventDefault();
                          setAudio(format);
                        }}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>

        <div className="dialog-footer">
          <button className="button" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            className="button primary"
            onClick={() => void save()}
            disabled={busy || chosen.length === 0}
          >
            {busy ? t("save.saving") : t("save.button")}
          </button>
        </div>
      </div>
    </div>
  );
}
