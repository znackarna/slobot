/**
 * Writing a recording out as files.
 *
 * **Its own module because the dialog beside it must export nothing but a
 * component.** React's fast refresh replaces a module in place only when every
 * export is a component; one that also exports a function forces a full page
 * reload instead — and a reload part-way through a change is how a window ends
 * up running half of one. That happened four times on the evening of
 * 2 September, and the log named this file as one of the two causes.
 */
import { api } from "./api";
import type { Recording, UserMessage } from "./types";

/** What may come out of a recording. Audio first: it is the one thing here
 *  that is not the transcript.
 *
 *  The language model's tidied version is deliberately not among them — it is
 *  saved from the AI tools, beside the thing that made it, and adding it here
 *  made a six-row list into eight for a document most recordings never have. */
export type SaveShape = "audio" | "txt" | "md" | "srt" | "vtt" | "json";

/** The containers the core can write. `folders.rs` names a codec for each and
 *  refuses everything else, so these three are the whole of what may be asked
 *  for. */
export const AUDIO_FORMATS = ["mp3", "m4a", "wav"] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

/** Which one the dialog opens on.
 *
 *  **The source's own, when the core can write it** — then the export is a copy
 *  rather than a re-encoding, which is what the row promised before there was
 *  anything to choose.
 *
 *  Anything else opens on MP3, and that is the repair. The name used to carry
 *  the source's extension whatever it was, so a video gave `nahravka.mp4`, the
 *  core refused a container it cannot write, and the message asked for a
 *  different one — with nowhere to say it, the name being chosen in the
 *  system's own dialog. For every video in the archive the audio row could not
 *  succeed. Met on 2026-09-08 on an `.mp4`. */
export function defaultAudioFormat(path: string): AudioFormat {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return (AUDIO_FORMATS as readonly string[]).includes(extension)
    ? (extension as AudioFormat)
    : "mp3";
}

/** The name a file gets when several are written at once and nobody is asked
 *  for one. The recording's title, minus the characters a file name cannot
 *  hold. */
function nameFor(recording: Recording, shape: SaveShape, audio: AudioFormat): string {
  const plain = (recording.title || "nahravka").replace(/[\\/:*?"<>|]/g, "-");
  // The tidied version is a second file beside the plain one, so its name has
  // to differ. `-upraveny` rather than a word from the dictionary: a file name
  // is not interface copy, and it goes onto a disk that may not speak Czech.
  if (shape !== "audio") return `${plain}.${shape}`;
  // The chosen container. Where it is the source's own the core copies the
  // file rather than re-encoding it.
  return `${plain}.${audio}`;
}

export async function saveRecording({
  recording,
  shapes,
  audio,
  chooseFile,
  chooseFolder,
  onError,
  onSaved,
}: {
  recording: Recording;
  shapes: SaveShape[];
  /** The container the audio is written in; ignored when audio is not ticked. */
  audio: AudioFormat;
  chooseFile: (name: string) => Promise<string | null>;
  chooseFolder: () => Promise<string | null>;
  onError: (message: UserMessage) => void;
  onSaved: (paths: string[]) => void;
}): Promise<void> {
  if (shapes.length === 0) return;
  const written: string[] = [];
  try {
    const names = shapes.map((shape) => nameFor(recording, shape, audio));

    let destinations: string[];
    if (shapes.length === 1) {
      const chosen = await chooseFile(names[0]);
      if (!chosen) return;
      destinations = [chosen];
    } else {
      const folder = await chooseFolder();
      if (!folder) return;
      destinations = names.map((name) => `${folder}\\${name}`);
    }

    for (const [index, shape] of shapes.entries()) {
      const path = destinations[index];
      if (shape === "audio") {
        await api.exportAudio(recording.id, path);
        written.push(path);
      } else {
        written.push(await api.saveExport(recording.id, shape, path));
      }
    }
    onSaved(written);
  } catch (error) {
    if (written.length > 0) onSaved(written);
    onError(error as UserMessage);
  }
}
