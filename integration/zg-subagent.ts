import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piZgExtension from "../local/pi-zgrep/src/index.ts";

// Copy to ~/.pi/agent/extensions/zg-subagent.ts. The relative import then
// points at the installed local fork. Main Pi loads the package normally.
export default function zgSubagent(pi: ExtensionAPI) {
  if (Number(process.env.PI_SUBAGENT_DEPTH ?? "0") > 0) {
    return piZgExtension(pi);
  }
}
