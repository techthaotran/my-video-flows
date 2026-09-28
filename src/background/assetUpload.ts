import type { FlowUploadedIds } from '@/shared/messaging';
import type { AssetNodeDataSchema } from '@/shared/schema';
import { strings } from '@/shared/strings';
import { blobToBase64 } from '@/shared/utils';
import { assetRepo } from '@/storage/repos/assetRepo';
import { workflowRepo } from '@/storage/repos/workflowRepo';
import type { z } from 'zod';

type AssetData = z.infer<typeof AssetNodeDataSchema>;

export type FlowImageUploader = (img: {
  name: string;
  mime: string;
  dataBase64: string;
}) => Promise<{ mediaId: string; projectId: string }>;

async function assetNodeData(workflowId: string, nodeId: string): Promise<AssetData | undefined> {
  const wf = await workflowRepo.get(workflowId);
  const node = wf?.nodes.find((n) => n.id === nodeId && n.type === 'asset');
  return node?.data as AssetData | undefined;
}

/**
 * Upload the local image of an Asset node to the open Flow project (`maseQ`) and store
 * `uploaded*` on the node. Flow assets (`flowMediaId`) are never uploaded.
 * The patch is skipped when the user picked another file meanwhile.
 */
export async function uploadAssetNodeToFlow(
  workflowId: string,
  nodeId: string,
  upload: FlowImageUploader,
): Promise<FlowUploadedIds> {
  const data = await assetNodeData(workflowId, nodeId);
  if (!data?.assetId || data.flowMediaId || data.missing) {
    throw new Error(strings.flowUploadNodeNotLocal);
  }
  const asset = await assetRepo.get(data.assetId);
  if (!asset || !asset.mime.startsWith('image/')) throw new Error(strings.flowUploadNodeNotLocal);

  const { mediaId, projectId } = await upload({
    name: asset.originalName,
    mime: asset.mime,
    dataBase64: await blobToBase64(asset.blob),
  });
  const ids: FlowUploadedIds = {
    uploadedMediaId: mediaId,
    uploadedProjectId: projectId,
    uploadedSha256: asset.sha256,
  };

  const current = await assetNodeData(workflowId, nodeId);
  if (current?.assetId === data.assetId) {
    await workflowRepo.patchNodeData(workflowId, nodeId, { ...ids });
  }
  return ids;
}
