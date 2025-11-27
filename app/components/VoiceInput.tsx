"use client";

import { useState, useRef } from "react";

type VoiceInputProps = {
  onTranscript: (text: string) => void;
};

export function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "voice.webm");

        const res = await fetch("/api/stt", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.text) {
          onTranscript(data.text);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error", err);
      alert("Could not access microphone.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream
      .getTracks()
      .forEach((track) => track.stop());
    setIsRecording(false);
  }

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      className="rounded-full border px-3 py-1 text-xs"
    >
      {isRecording ? "Stop 🎙️" : "Speak 🎤"}
    </button>
  );
}
