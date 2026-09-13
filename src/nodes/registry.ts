import type { ComponentType } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ZodTypeAny } from 'zod';
import type { NodeType } from '@/shared/schema';
import {
  AssetNodeDataSchema,
  TextNodeDataSchema,
  PromptNodeDataSchema,
  GenerateImageNodeDataSchema,
  GenerateVideoNodeDataSchema,
  AutoDownloadNodeDataSchema,
  NoteNodeDataSchema,
  UnknownNodeDataSchema,
  defaultKindForLabel,
  type AssetLabel,
} from '@/shared/schema';
import { DEFAULT_PORTS, type PortSpec, assetOutputPorts } from '@/nodes/ports';
import { strings } from '@/shared/strings';
import type { NodeExecutor } from '@/engine/types';
import {
  Package,
  Type,
  Sparkles,
  ImagePlus,
  Clapperboard,
  Download,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

export interface NodeDefinition {
  type: NodeType;
  title: string;
  description: string;
  category: 'input' | 'llm' | 'generate' | 'output' | 'annotation';
  inputs: PortSpec[];
  outputs: PortSpec[];
  dataSchema: ZodTypeAny;
  defaultData: () => Record<string, unknown>;
  getPorts?: (data: Record<string, unknown>) => { inputs: PortSpec[]; outputs: PortSpec[] };
  Component?: ComponentType<NodeProps>;
  executor?: NodeExecutor;
  icon?: LucideIcon;
  showInToolbar?: boolean;
}

export const nodeDefinitions: NodeDefinition[] = [
  {
    type: 'asset',
    title: strings.nodeAsset,
    description: strings.nodeAssetDesc,
    category: 'input',
    inputs: [],
    outputs: DEFAULT_PORTS.asset.outputs,
    dataSchema: AssetNodeDataSchema,
    defaultData: () =>
      AssetNodeDataSchema.parse({
        assetLabel: 'Character',
        kind: defaultKindForLabel('Character'),
      }),
    getPorts: (data) => ({
      inputs: [],
      outputs: assetOutputPorts(data.kind as 'image' | 'video' | 'audio' | undefined),
    }),
    icon: Package,
    showInToolbar: true,
  },
  {
    type: 'text',
    title: strings.nodeText,
    description: strings.nodeTextDesc,
    category: 'input',
    inputs: [],
    outputs: DEFAULT_PORTS.text.outputs,
    dataSchema: TextNodeDataSchema,
    defaultData: () => TextNodeDataSchema.parse({ content: '' }),
    icon: Type,
    // Gộp vào Prompt (schema v3) — chỉ còn để hiển thị workflow chưa nâng cấp.
    showInToolbar: false,
  },
  {
    type: 'prompt',
    title: strings.nodePrompt,
    description: strings.nodePromptDesc,
    category: 'llm',
    inputs: DEFAULT_PORTS.prompt.inputs,
    outputs: DEFAULT_PORTS.prompt.outputs,
    dataSchema: PromptNodeDataSchema,
    defaultData: () => PromptNodeDataSchema.parse({}),
    icon: Sparkles,
    showInToolbar: true,
  },
  {
    type: 'generateImage',
    title: strings.nodeGenerateImage,
    description: strings.nodeGenerateImageDesc,
    category: 'generate',
    inputs: DEFAULT_PORTS.generateImage.inputs,
    outputs: DEFAULT_PORTS.generateImage.outputs,
    dataSchema: GenerateImageNodeDataSchema,
    defaultData: () => GenerateImageNodeDataSchema.parse({}),
    icon: ImagePlus,
    showInToolbar: true,
  },
  {
    type: 'generateVideo',
    title: strings.nodeGenerateVideo,
    description: strings.nodeGenerateVideoDesc,
    category: 'generate',
    inputs: DEFAULT_PORTS.generateVideo.inputs,
    outputs: DEFAULT_PORTS.generateVideo.outputs,
    dataSchema: GenerateVideoNodeDataSchema,
    defaultData: () => GenerateVideoNodeDataSchema.parse({}),
    icon: Clapperboard,
    showInToolbar: true,
  },
  {
    type: 'autoDownload',
    title: strings.nodeAutoDownload,
    description: strings.nodeAutoDownloadDesc,
    category: 'output',
    inputs: DEFAULT_PORTS.autoDownload.inputs,
    outputs: [],
    dataSchema: AutoDownloadNodeDataSchema,
    defaultData: () => AutoDownloadNodeDataSchema.parse({}),
    icon: Download,
    showInToolbar: true,
  },
  {
    type: 'note',
    title: strings.nodeNote,
    description: strings.nodeNoteDesc,
    category: 'annotation',
    inputs: [],
    outputs: [],
    dataSchema: NoteNodeDataSchema,
    defaultData: () => NoteNodeDataSchema.parse({ content: '' }),
    icon: StickyNote,
    showInToolbar: true,
  },
  {
    type: 'unknown',
    title: 'Unknown',
    description: 'Node không được hỗ trợ',
    category: 'annotation',
    inputs: [],
    outputs: [],
    dataSchema: UnknownNodeDataSchema,
    defaultData: () => UnknownNodeDataSchema.parse({ originalType: 'unknown' }),
    showInToolbar: false,
  },
];

export const nodeRegistry = new Map(nodeDefinitions.map((d) => [d.type, d]));

export function getNodeDef(type: NodeType): NodeDefinition {
  return nodeRegistry.get(type) ?? nodeRegistry.get('unknown')!;
}

export function getNodePorts(type: NodeType, data?: Record<string, unknown>) {
  const defn = getNodeDef(type);
  if (defn.getPorts && data) return defn.getPorts(data);
  return { inputs: defn.inputs, outputs: defn.outputs };
}

export function listPickerNodes() {
  return nodeDefinitions.filter((d) => d.type !== 'unknown' && d.type !== 'text');
}

export function listToolbarNodes() {
  return nodeDefinitions.filter((d) => d.showInToolbar);
}

export function suggestKindFromLabel(label: AssetLabel) {
  return defaultKindForLabel(label);
}
