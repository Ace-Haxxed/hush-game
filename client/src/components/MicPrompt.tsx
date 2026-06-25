import { useState } from "react";
import { startMic } from "../game/mic";
import "./MicPrompt.css";

interface MicPromptProps {
  /** Called once resolved — allowed=true only if the mic is actually live. */
  onResult: (allowed: boolean) => void;
}

/**
 * Full-screen mic permission gate shown before the game. Only rendered when the
 * browser supports getUserMedia; otherwise the parent skips it silently.
 */
export default function MicPrompt({ onResult }: MicPromptProps) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="micprompt" role="dialog" aria-modal="true">
      <h1 className="micprompt__title">She can hear you.</h1>
      <p className="micprompt__sub">
        Microphone access makes this experience significantly scarier.
      </p>
      <div className="micprompt__btns">
        <button
          type="button"
          className="micprompt__allow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await startMic();
            onResult(ok);
          }}
        >
          Allow Mic
        </button>
        <button
          type="button"
          className="micprompt__skip"
          disabled={busy}
          onClick={() => onResult(false)}
        >
          Play Without Mic
        </button>
      </div>
    </div>
  );
}
