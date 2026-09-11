/** Versioned boundaries for a future GLM / compatible vision provider. */
export type TaskStatus = 'active' | 'paused' | 'done';
export type TimelineColor = 'blue' | 'violet' | 'teal' | 'amber' | 'rose';
export interface TimelineNode {
  id: string;
  title: string;
  note: string;
  at: string;
  image: string | null;
}
export interface WorkflowPlan {steps:Array<{id:string;title:string}>;current:number;}
export interface TimelineTask {
  workflow: WorkflowPlan | null;
  id: string;
  title: string;
  color: TimelineColor;
  status: TaskStatus;
  archived: boolean;
  nextStep: string;
  createdAt: string;
  updatedAt: string;
  nodes: TimelineNode[];
}
export interface Workspace {
  version: 1;
  tasks: TimelineTask[];
  settings: {side:'left'|'right';pinned:boolean;reducedMotion:boolean;displayId:number|null};
}
export interface VisionRequest {
  intent: 'create' | 'append';
  imageId: string;
  targetTaskId?: string;
  /** Only selected task or concise candidate summaries; never the full archive. */
  context: Array<{taskId:string;title:string;latestNodes:Array<{title:string;note:string}>}>;
}
export interface VisionProposal {
  taskId: string | null;
  taskTitle: string | null;
  nodeTitle: string;
  note: string;
  nextStep: string | null;
  status: TaskStatus | null;
  confidence: number;
  evidence: string[];
  requiresConfirmation: true;
}
export type VisionResponse =
  | {status:'unconfigured';proposal:null;message:string}
  | {status:'ready';proposal:VisionProposal;message:string}
  | {status:'error';proposal:null;message:string};
export interface VisionProvider {analyze(request:VisionRequest):Promise<VisionResponse>}
export type BridgeResult<T> = {ok:true;value:T}|{ok:false;error:string};
