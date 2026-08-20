import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

type Listener = () => void;

let reducedMotion = false;
let nativeSubscription: { remove: () => void } | null = null;
let nativeEventVersion = 0;
let nativeSubscriptionGeneration = 0;
const listeners = new Set<Listener>();

function publish(nextValue: boolean) {
  if (reducedMotion === nextValue) return;
  reducedMotion = nextValue;
  listeners.forEach((listener) => listener());
}

function ensureNativeSubscription() {
  if (nativeSubscription) return;

  nativeSubscriptionGeneration += 1;
  const subscriptionGeneration = nativeSubscriptionGeneration;
  const initialProbeVersion = nativeEventVersion;
  void AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      if (nativeSubscriptionGeneration === subscriptionGeneration && nativeEventVersion === initialProbeVersion) {
        publish(enabled);
      }
    })
    .catch(() => undefined);
  nativeSubscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
    nativeEventVersion += 1;
    publish(enabled);
  });
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  ensureNativeSubscription();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      nativeSubscription?.remove();
      nativeSubscription = null;
      nativeSubscriptionGeneration += 1;
    }
  };
}

function getSnapshot() {
  return reducedMotion;
}

/** Preferência do sistema compartilhada e viva, sem um listener nativo por aba. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
