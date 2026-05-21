import { LoadingMessage } from "@/components/LoadingMessage";

export default function Loading() {
  return (
    <main className="shell section route-loading">
      <div className="route-loading-panel">
        <p className="eyebrow">Loading</p>
        <LoadingMessage as="h1" intervalMs={1_150} />
        <span className="route-loading-bar" />
      </div>
    </main>
  );
}
