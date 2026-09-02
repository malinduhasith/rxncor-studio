import { LoadingMessage } from "@/components/LoadingMessage";

export default function Loading() {
  return (
    <main className="rx-state-page route-loading" data-tone="dark">
      <div className="route-loading-panel rx-state-panel">
        <span>RXNCOR / Loading</span>
        <LoadingMessage as="h1" intervalMs={1_150} />
        <span className="route-loading-bar" />
      </div>
    </main>
  );
}
