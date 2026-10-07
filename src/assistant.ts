import type { AssistantConnection } from "./assistant-connection";
export type AssistantStep = {
  id: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
};
export type AssistantArtifact = {
  kind: "image" | "video" | "effect";
  label: string;
  url?: string;
  bundle?: unknown;
};
export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "running" | "done" | "stopped" | "error";
  steps: AssistantStep[];
  artifacts: AssistantArtifact[];
  context?: string;
  error?: string;
};
export type AssistantState = AssistantConnection & {
  messages: AssistantMessage[];
  active: string | null;
  stopping: boolean;
  configured: boolean;
  keyStorage: "session" | "secure" | "environment" | "none";
  editorConnected: boolean;
  confirmation: { id: string; description: string } | null;
};
export type AssistantSettings = AssistantConnection & {
  apiKey?: string;
  reuseKey?: boolean;
};
declare global {
  interface Window {
    kamikamiAssistant?: {
      saveSettings: (settings: AssistantSettings) => Promise<void>;
      clearSettings: () => Promise<void>;
    };
  }
}
