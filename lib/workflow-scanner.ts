import { WorkflowJSON, WorkflowNode, CustomNode, WorkflowModels, ScanResult } from './types';

/**
 * Extract models from specific node types using widget values
 */
function extractModels(workflow: WorkflowJSON, nodeType: string, widgetIndex: number): string[] {
    if (!workflow.nodes) return [];

    const models = workflow.nodes
        .filter((node: WorkflowNode) => node.type === nodeType)
        .map((node: WorkflowNode) => {
            const value = node.widgets_values?.[widgetIndex];
            return value && value !== '' ? String(value) : null;
        })
        .filter((value): value is string => value !== null);

    return Array.from(new Set(models)).sort();
}

/**
 * Extract models from properties.models array
 */
function extractModelsFromProperties(workflow: WorkflowJSON, nodeType: string, directory: string): string[] {
    if (!workflow.nodes) return [];

    const models: string[] = [];

    workflow.nodes
        .filter((node: WorkflowNode) => node.type === nodeType)
        .forEach((node: WorkflowNode) => {
            if (node.properties?.models) {
                node.properties.models
                    .filter(model => model.directory === directory && model.name)
                    .forEach(model => {
                        if (model.name) models.push(model.name);
                    });
            }
        });

    return Array.from(new Set(models)).sort();
}

/**
 * Merge multiple string arrays and remove duplicates
 */
function mergeArrays(...arrays: string[][]): string[] {
    const merged = arrays.flat().filter(item => item !== '');
    return Array.from(new Set(merged)).sort();
}

/**
 * Extract custom nodes with their versions
 */
function extractCustomNodes(workflow: WorkflowJSON): CustomNode[] {
    if (!workflow.nodes) return [];

    const customNodes = workflow.nodes
        .filter((node: WorkflowNode) =>
            node.properties?.cnr_id &&
            node.properties.cnr_id !== 'comfy-core'
        )
        .map((node: WorkflowNode) => ({
            node: node.properties!.cnr_id!,
            version: node.properties!.ver || 'latest'
        }));

    // Remove duplicates based on node name
    const uniqueNodes = Array.from(
        new Map(customNodes.map(item => [item.node, item])).values()
    );

    return uniqueNodes;
}

/**
 * Scan a ComfyUI workflow JSON file and extract all dependencies
 */
export function scanWorkflow(workflowData: WorkflowJSON): ScanResult {
    // Extract custom nodes
    const customNodes = extractCustomNodes(workflowData);

    // Extract VAE models
    const vaeFromWidgets = extractModels(workflowData, 'VAELoader', 0);
    const vaeFromProps = extractModelsFromProperties(workflowData, 'VAELoader', 'vae');
    const vae = mergeArrays(vaeFromWidgets, vaeFromProps);

    // Extract Checkpoints
    const checkpointSimple = extractModels(workflowData, 'CheckpointLoaderSimple', 0);
    const checkpointLoader = extractModels(workflowData, 'CheckpointLoader', 0);
    const loadCheckpoint = extractModels(workflowData, 'LoadCheckpoint', 0);
    const checkpoints = mergeArrays(checkpointSimple, checkpointLoader, loadCheckpoint);

    // Extract LoRAs
    const loraLoader = extractModels(workflowData, 'LoraLoader', 0);
    const loraModelOnly = extractModels(workflowData, 'LoraLoaderModelOnly', 0);
    const loras = mergeArrays(loraLoader, loraModelOnly);

    // Extract Upscale models
    const upscale_models = extractModels(workflowData, 'UpscaleModelLoader', 0);

    // Extract ControlNet models
    const controlnet = extractModels(workflowData, 'ControlNetLoader', 0);

    // Extract CLIP models
    const clipLoader = extractModels(workflowData, 'CLIPLoader', 0);
    const dualClipLoader = extractModels(workflowData, 'DualCLIPLoader', 0);
    const clip = mergeArrays(clipLoader, dualClipLoader);

    // Extract CLIP Vision models
    const clip_vision = extractModels(workflowData, 'CLIPVisionLoader', 0);

    // Extract Text Encoders
    const text_encoders = extractModelsFromProperties(workflowData, 'DualCLIPLoader', 'text_encoders');

    // Extract Diffusion models (UNet, GGUF, etc.)
    const unetLoader = extractModels(workflowData, 'UnetLoader', 0);
    const unetLoaderCaps = extractModels(workflowData, 'UNETLoader', 0);
    const ggufLoader = extractModels(workflowData, 'GGUFLoader', 0);
    const diffusionLoader = extractModels(workflowData, 'DiffusionModelLoader', 0);
    const diffusion_models = mergeArrays(unetLoader, unetLoaderCaps, ggufLoader, diffusionLoader);

    // Extract Embedding models
    const embedding = extractModels(workflowData, 'EmbeddingLoader', 0);

    // Extract Style models
    const style_models = extractModels(workflowData, 'StyleModelLoader', 0);

    // Extract Hypernetwork models
    const hypernetworks = extractModels(workflowData, 'HypernetworkLoader', 0);

    // Extract GLIGEN models
    const gligen = extractModels(workflowData, 'GLIGENLoader', 0);

    const models: WorkflowModels = {
        checkpoints,
        vae,
        loras,
        upscale_models,
        controlnet,
        clip,
        clip_vision,
        text_encoders,
        diffusion_models,
        embedding,
        style_models,
        hypernetworks,
        gligen
    };

    return {
        models,
        'custom-nodes': customNodes
    };
}

/**
 * Get count of models in a category
 */
export function getModelCount(models: string[]): number {
    return models.length;
}

/**
 * Get total count of all models
 */
export function getTotalModelCount(models: WorkflowModels): number {
    return Object.values(models).flat().length;
}

/**
 * Get categories with models
 */
export function getCategoriesWithModels(models: WorkflowModels): Array<{ category: string, count: number }> {
    const categories = [
        { key: 'checkpoints', label: 'Checkpoints' },
        { key: 'vae', label: 'VAE' },
        { key: 'loras', label: 'LoRAs' },
        { key: 'upscale_models', label: 'Upscale Models' },
        { key: 'controlnet', label: 'ControlNet' },
        { key: 'clip', label: 'CLIP' },
        { key: 'clip_vision', label: 'CLIP Vision' },
        { key: 'text_encoders', label: 'Text Encoders' },
        { key: 'diffusion_models', label: 'Diffusion Models' },
        { key: 'embedding', label: 'Embeddings' },
        { key: 'style_models', label: 'Style Models' },
        { key: 'hypernetworks', label: 'Hypernetworks' },
        { key: 'gligen', label: 'GLIGEN' }
    ];

    return categories
        .map(({ key, label }) => ({
            category: label,
            count: models[key as keyof WorkflowModels].length
        }))
        .filter(item => item.count > 0);
}
