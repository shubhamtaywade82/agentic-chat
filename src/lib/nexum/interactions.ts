import type { InteractionResolution } from "./types";
import type { RequestExecutor } from "./sessions";

export class NexumInteractionsClient {
  constructor(private readonly executor: RequestExecutor) {}

  async resolve(
    runId: string,
    interactionId: string,
    resolution: InteractionResolution,
    signal?: AbortSignal,
  ): Promise<void> {
    const encodedRun = encodeURIComponent(runId);
    const encodedInteraction = encodeURIComponent(interactionId);
    await this.executor.request(
      `/runs/${encodedRun}/interactions/${encodedInteraction}/resolve`,
      {
        method: "POST",
        body: JSON.stringify(resolution),
        signal,
      },
    );
  }
}
