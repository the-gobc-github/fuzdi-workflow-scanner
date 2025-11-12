import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const s3Client = new S3Client({
    region: process.env.SCALEWAY_REGION || 'fr-par',
    endpoint: `https://s3.${process.env.SCALEWAY_REGION || 'fr-par'}.scw.cloud`,
    credentials: {
        accessKeyId: process.env.SCALEWAY_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.SCALEWAY_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET_NAME = process.env.SCALEWAY_BUCKET_NAME || 'konama-storage';

// Map model category to Scaleway folder structure
const MODEL_TYPE_MAP: { [key: string]: string } = {
    checkpoints: 'checkpoints',
    vae: 'vae',
    loras: 'loras',
    upscale_models: 'upscale_models',
    controlnet: 'controlnet',
    clip: 'clip',
    clip_vision: 'clip_vision',
    text_encoders: 'text_encoders',
    diffusion_models: 'diffusion_models',
    embedding: 'embeddings',
    style_models: 'style_models',
    hypernetworks: 'hypernetworks',
    gligen: 'gligen',
};

async function checkFileExists(key: string): Promise<boolean> {
    try {
        const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        await s3Client.send(command);
        return true;
    } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        // For other errors, assume file doesn't exist
        console.error(`Error checking ${key}:`, error.message);
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { scanResult } = body;

        if (!scanResult) {
            return NextResponse.json(
                { error: 'Missing scan result' },
                { status: 400 }
            );
        }

        const availability: {
            customNodes: { [key: string]: boolean };
            models: { [category: string]: { [model: string]: boolean } };
        } = {
            customNodes: {},
            models: {},
        };

        // Check custom nodes availability
        const customNodeChecks = scanResult['custom-nodes'].map(
            async (node: { node: string; version: string }) => {
                const key = `custom-nodes/${node.node}/${node.version}/`;
                // Check if any file exists in this path by checking a marker file or common file
                // For now, we'll check if the folder "exists" by checking for an index or marker
                const markerKey = `custom-nodes/${node.node}/${node.version}/.marker`;
                const exists = await checkFileExists(markerKey);
                availability.customNodes[`${node.node}@${node.version}`] = exists;
            }
        );

        // Check models availability
        const modelChecks: Promise<void>[] = [];

        for (const [category, models] of Object.entries(scanResult.models)) {
            if (!Array.isArray(models) || models.length === 0) continue;

            const modelType = MODEL_TYPE_MAP[category] || category;
            availability.models[category] = {};

            for (const model of models) {
                if (!model) continue;

                modelChecks.push(
                    (async () => {
                        const key = `models/${modelType}/${model}`;
                        const exists = await checkFileExists(key);
                        availability.models[category][model] = exists;
                    })()
                );
            }
        }

        // Wait for all checks to complete
        await Promise.all([...customNodeChecks, ...modelChecks]);

        return NextResponse.json({
            success: true,
            availability,
        });
    } catch (error) {
        console.error('Availability check error:', error);
        return NextResponse.json(
            {
                error: 'Failed to check availability',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
