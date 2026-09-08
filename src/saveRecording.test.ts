/**
 * Saving something out of a whole recording.
 *
 * The same shape as the clip's saving and for the same reason: one file asks
 * the reader to name it, several ask once for a folder. What is worth holding
 * here is the audio's name — it keeps the recording's own container, so the
 * file plays wherever the recording does and is handed over rather than
 * re-encoded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAudioFormat, saveRecording } from "./saveRecording";
import type { Recording } from "./types";

const exportAudio = vi.fn(async (_id: string, _path: string) => {});
const saveExport = vi.fn(async (_id: string, _format: string, path: string) => path);

vi.mock("./api", () => ({
  api: {
    exportAudio: (...a: Parameters<typeof exportAudio>) => exportAudio(...a),
    saveExport: (...a: Parameters<typeof saveExport>) => saveExport(...a),
  },
}));

const PAUL = {
  id: "r",
  title: "Paul Bartlett",
  path: "D:\nahravky\paul.m4a",
  segment_count: 964,
} as unknown as Recording;

/** A path in the chosen folder. The separator is built from its code point:
 *  a literal backslash in a test is one tool away from being read as an
 *  escape, and this one was, three times over. */
const SEPARATOR = String.fromCharCode(92);
const inVen = (name: string) => `D:/ven${SEPARATOR}${name}`;

const common = {
  recording: PAUL,
  /* What the dialog would open on for this recording: `.m4a` is a container
     the core writes, so the export stays a copy. */
  audio: defaultAudioFormat(PAUL.path),
  chooseFile: vi.fn(async () => null),
  chooseFolder: vi.fn(async () => null),
  onError: vi.fn(),
  onSaved: vi.fn(),
};

describe("saving a recording", () => {
  beforeEach(() => {
    exportAudio.mockClear();
    saveExport.mockClear();
  });

  it("asks for a file name when one thing is ticked", async () => {
    const chooseFile = vi.fn(async (name: string) => `D:/ven/${name}`);
    const onSaved = vi.fn();
    await saveRecording({ ...common, shapes: ["srt"], chooseFile, onSaved });

    expect(chooseFile).toHaveBeenCalledWith("Paul Bartlett.srt");
    expect(saveExport).toHaveBeenCalledWith("r", "srt", "D:/ven/Paul Bartlett.srt");
    expect(onSaved).toHaveBeenCalledWith(["D:/ven/Paul Bartlett.srt"]);
  });

  /** The audio still opens on the source's container, so an .m4a recording is
   *  handed over rather than re-encoded. It is a default now rather than the
   *  only outcome — see the block below. */
  it("offers the audio under the recording's own extension", async () => {
    const chooseFile = vi.fn(async (name: string) => `D:/ven/${name}`);
    await saveRecording({ ...common, shapes: ["audio"], chooseFile, onSaved: vi.fn() });
    expect(chooseFile).toHaveBeenCalledWith("Paul Bartlett.m4a");
    expect(exportAudio).toHaveBeenCalledWith("r", "D:/ven/Paul Bartlett.m4a");
  });

  it("asks for a folder once when several are ticked", async () => {
    const chooseFolder = vi.fn(async () => "D:/ven");
    const onSaved = vi.fn();
    await saveRecording({
      ...common,
      shapes: ["audio", "txt"],
      chooseFolder,
      onSaved,
    });

    expect(chooseFolder).toHaveBeenCalledTimes(1);
    expect(exportAudio).toHaveBeenCalledWith("r", inVen("Paul Bartlett.m4a"));
    expect(saveExport).toHaveBeenCalledWith("r", "txt", inVen("Paul Bartlett.txt"));
    expect(onSaved).toHaveBeenCalledWith([
      inVen("Paul Bartlett.m4a"),
      inVen("Paul Bartlett.txt"),
    ]);
  });

  /** A title is a person's name, not a file name. */
  it("takes the characters a file name cannot hold out of the title", async () => {
    const chooseFile = vi.fn(async (name: string) => name);
    await saveRecording({
      ...common,
      recording: { ...PAUL, title: "Q1: plán/rozpočet" } as Recording,
      shapes: ["txt"],
      chooseFile,
      onSaved: vi.fn(),
    });
    expect(chooseFile).toHaveBeenCalledWith("Q1- plán-rozpočet.txt");
  });

  it("writes nothing when the reader closes the dialog", async () => {
    const onSaved = vi.fn();
    await saveRecording({ ...common, shapes: ["txt"], onSaved });
    expect(saveExport).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

/**
 * Which container the audio is written in, over the fault of 8 September: the
 * name was built from the source's extension whatever it was, and the core can
 * write only three. A video therefore asked for `.mp4`, was refused, and the
 * message said to choose another — with nowhere to choose, the name being
 * settled in the system's own dialog. For every video in the archive the audio
 * row could not succeed.
 */
describe("the container the audio is written in", () => {
  const VIDEO = { ...PAUL, path: "D:\nahravky\stand-up.mp4" } as unknown as Recording;

  /** The reported case. Before this the answer was `mp4` and the export failed. */
  it("opens on MP3 for a source the core cannot write", () => {
    expect(defaultAudioFormat(VIDEO.path)).toBe("mp3");
    expect(defaultAudioFormat("D:\a\b.mkv")).toBe("mp3");
    expect(defaultAudioFormat("D:\a\b.webm")).toBe("mp3");
  });

  /** And keeps the source's own where it can, so the file is copied rather
   *  than re-encoded — what the row promised before there was a choice. */
  it("opens on the source's own container where the core can write it", () => {
    expect(defaultAudioFormat("D:\a\b.m4a")).toBe("m4a");
    expect(defaultAudioFormat("D:\a\b.mp3")).toBe("mp3");
    expect(defaultAudioFormat("D:\a\b.WAV")).toBe("wav");
  });

  it("names the video's audio with a container that can hold it", async () => {
    const chooseFile = vi.fn(async (name: string) => `D:/ven/${name}`);
    await saveRecording({
      ...common,
      recording: VIDEO,
      audio: defaultAudioFormat(VIDEO.path),
      shapes: ["audio"],
      chooseFile,
      onSaved: vi.fn(),
    });
    expect(chooseFile).toHaveBeenCalledWith("Paul Bartlett.mp3");
    expect(exportAudio).toHaveBeenCalledWith("r", "D:/ven/Paul Bartlett.mp3");
  });

  /** And what the buttons are for: a chosen container wins over the source's. */
  it("writes the container that was chosen, not the source's", async () => {
    const chooseFile = vi.fn(async (name: string) => `D:/ven/${name}`);
    await saveRecording({
      ...common,
      audio: "wav",
      shapes: ["audio"],
      chooseFile,
      onSaved: vi.fn(),
    });
    expect(chooseFile).toHaveBeenCalledWith("Paul Bartlett.wav");
  });

  /** The choice reaches the file even when it is one of several, where nobody
   *  is asked for a name at all. */
  it("reaches the name built into a folder", async () => {
    const chooseFolder = vi.fn(async () => "D:/ven");
    await saveRecording({
      ...common,
      audio: "wav",
      shapes: ["audio", "txt"],
      chooseFolder,
      onSaved: vi.fn(),
    });
    expect(exportAudio).toHaveBeenCalledWith("r", inVen("Paul Bartlett.wav"));
  });
});
