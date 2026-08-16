import { Window } from "happy-dom";

const w = new Window();
try {
  const worker = new w.Worker("https://example.com/x.mjs", { type: "module" });
  console.log("worker created:", Boolean(worker));
  worker.addEventListener("error", (e) => console.log("worker error event", e?.message));
  worker.addEventListener("messageerror", (e) => console.log("messageerror", e?.message));
} catch (e) {
  console.log("worker constructor threw:", e.message);
}
