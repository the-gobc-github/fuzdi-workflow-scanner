export interface CustomNode {
    node: string;
    version: string;
    available?: boolean;
}

export interface WorkflowModels {
    checkpoints: string[];
    vae: string[];
    loras: string[];
    upscale_models: string[];
    controlnet: string[];
    clip: string[];
    clip_vision: string[];
    text_encoders: string[];
    diffusion_models: string[];
    embedding: string[];
    style_models: string[];
    hypernetworks: string[];
    gligen: string[];
}

export interface ModelAvailability {
    [key: string]: boolean;
}

export interface ScanResult {
    models: WorkflowModels;
    "custom-nodes": CustomNode[];
    required_models?: string[];
}

export interface AvailabilityStatus {
    customNodes: { [key: string]: boolean };
    models: { [category: string]: { [model: string]: boolean } };
}

export interface WorkflowNode {
    type?: string;
    widgets_values?: any[];
    properties?: {
        cnr_id?: string;
        ver?: string;
        models?: Array<{
            directory?: string;
            name?: string;
        }>;
    };
}

export interface WorkflowJSON {
    nodes?: WorkflowNode[];
}
