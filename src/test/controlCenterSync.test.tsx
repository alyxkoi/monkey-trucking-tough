import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQaFixtureData } from "@/control-center/demo/qaFixtures";
import {
  CONTROL_CENTER_SYNC_INTERVAL_MS,
  ControlCenterProvider,
  isControlCenterSyncStale,
  useControlCenter,
} from "@/control-center/context";

const mocks = vi.hoisted(() => ({
  flushQueue: vi.fn(async () => 0),
  getPendingCount: vi.fn(() => 0),
  loadControlData: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "dashboard-user" } }),
}));

vi.mock("@/control-center/demo/DemoMode", () => ({
  useDemoMode: () => ({ enabled: false, data: null }),
}));

vi.mock("@/lib/admin/tickets", () => ({
  flushQueue: mocks.flushQueue,
  getPendingCount: mocks.getPendingCount,
}));

vi.mock("@/control-center/data", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/control-center/data")>(),
  loadControlData: mocks.loadControlData,
}));

function SyncProbe() {
  const { lastSyncAt, syncing } = useControlCenter();
  return (
    <output data-testid="sync-state" data-syncing={syncing}>
      {lastSyncAt}
    </output>
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("Control Center dashboard sync lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T18:00:00.000Z"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    mocks.flushQueue.mockClear();
    mocks.getPendingCount.mockClear();
    mocks.loadControlData.mockReset().mockResolvedValue(createQaFixtureData());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("refreshes immediately and every three minutes without advancing the timestamp after a failure", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const view = render(
      <QueryClientProvider client={client}>
        <ControlCenterProvider><SyncProbe /></ControlCenterProvider>
      </QueryClientProvider>,
    );

    await settle();
    expect(mocks.loadControlData).toHaveBeenCalledTimes(1);
    const initialSyncAt = Number(screen.getByTestId("sync-state").textContent);
    expect(initialSyncAt).toBe(Date.now());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTROL_CENTER_SYNC_INTERVAL_MS);
    });
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.loadControlData).toHaveBeenCalledTimes(2);
    expect(Number(screen.getByTestId("sync-state").textContent)).toBeGreaterThan(initialSyncAt);

    const successfulSyncAt = Number(screen.getByTestId("sync-state").textContent);
    mocks.loadControlData.mockRejectedValueOnce(new Error("network unavailable"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTROL_CENTER_SYNC_INTERVAL_MS);
    });
    await settle();
    expect(mocks.loadControlData).toHaveBeenCalledTimes(3);
    expect(Number(screen.getByTestId("sync-state").textContent)).toBe(successfulSyncAt);

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTROL_CENTER_SYNC_INTERVAL_MS);
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mocks.loadControlData).toHaveBeenCalledTimes(3);
  });

  it("refreshes a stale visible tab and reconnect without overlapping an active request", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    render(
      <QueryClientProvider client={client}>
        <ControlCenterProvider><SyncProbe /></ControlCenterProvider>
      </QueryClientProvider>,
    );
    await settle();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTROL_CENTER_SYNC_INTERVAL_MS);
    });
    expect(mocks.loadControlData).toHaveBeenCalledTimes(1);

    let finishRefresh: (value: ReturnType<typeof createQaFixtureData>) => void = () => undefined;
    mocks.loadControlData.mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(mocks.loadControlData).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(mocks.loadControlData).toHaveBeenCalledTimes(2);

    await act(async () => finishRefresh(createQaFixtureData()));
    await settle();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTROL_CENTER_SYNC_INTERVAL_MS);
    });
    window.dispatchEvent(new Event("online"));
    await settle();
    expect(mocks.loadControlData).toHaveBeenCalledTimes(3);
  });

  it("refreshes on reconnect when an offline ticket is pending even before the data is stale", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    render(
      <QueryClientProvider client={client}>
        <ControlCenterProvider><SyncProbe /></ControlCenterProvider>
      </QueryClientProvider>,
    );
    await settle();
    expect(mocks.loadControlData).toHaveBeenCalledTimes(1);

    mocks.getPendingCount.mockReturnValueOnce(1);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.loadControlData).toHaveBeenCalledTimes(2);
  });

  it("uses the successful refresh age as the staleness boundary", () => {
    expect(isControlCenterSyncStale(0, 1)).toBe(true);
    expect(isControlCenterSyncStale(1_000, 1_000 + CONTROL_CENTER_SYNC_INTERVAL_MS - 1)).toBe(false);
    expect(isControlCenterSyncStale(1_000, 1_000 + CONTROL_CENTER_SYNC_INTERVAL_MS)).toBe(true);
  });
});
