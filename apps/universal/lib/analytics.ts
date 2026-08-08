export type AnalyticsPayload = Record<string, string | undefined>;

export type AnalyticsEvent = AnalyticsPayload & {
  event: string;
};

declare global {
  interface Window {
    dataLayer?: AnalyticsEvent[];
  }
}

export function track(event: string, payload: AnalyticsPayload): void {
  if (typeof window !== "undefined") {
    window.dataLayer?.push({ event, ...payload });
  }
}
