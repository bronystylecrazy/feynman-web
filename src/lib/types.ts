export type RunStatus = 'complete' | 'error' | 'queued' | 'running' | 'stopped';
export interface ToolEvent {
  id: string;
  label: string;
  status: RunStatus;
  toolName?: string;
  input?: string;
  output?: string;
  details?: string;
  isError?: boolean;
}
export interface Message {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  createdAt: string;
  status: RunStatus;
  toolEvents: ToolEvent[];
}
export interface Session {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  status: RunStatus;
  config: {
    model?: string;
    delegation: boolean;
    autoReview: boolean;
    memory: boolean;
    specialist: string;
    compute: 'off' | 'local';
  };
  messages: Message[];
}
export interface Artifact {
  path: string;
  name: string;
  title: string;
  extension: string;
  category: string;
  contentType: string;
  sizeBytes: number;
  updatedAt: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
}
export interface Command {
  name: string;
  command: string;
  description?: string;
  source?: string;
}
export interface WorkbenchState {
  workspacePath?: string;
  workspaceName: string;
  version?: string;
  projects: Project[];
  artifacts: Artifact[];
  modelStatus?: {
    current?: string;
    availableModels: string[];
    guidance?: string[];
  };
  resources?: {
    id: string;
    resources: { name: string; command?: string; description?: string }[];
  }[];
}
export type StreamEvent =
  | { type: 'session'; session: Session }
  | { type: 'delta'; content: string }
  | { type: 'tool'; toolEvent: ToolEvent }
  | { type: 'done'; session: Session; state?: WorkbenchState }
  | {
      type: 'error';
      message: string;
      session?: Session;
      state?: WorkbenchState;
    };
export interface BridgeStatus {
  configured: boolean;
  backendOrigin?: string;
  customModelsEnabled: boolean;
}
export interface FilePreview {
  content: string;
  truncated: boolean;
  contentType: string;
}
