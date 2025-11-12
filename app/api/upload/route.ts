import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { outputName, scanResult, workflowData, workflowFileName, requiredModels } = body;

        if (!outputName || !scanResult || !workflowData || !workflowFileName) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Add required_models to scan result before uploading
        const updatedScanResult = {
            ...scanResult,
            required_models: requiredModels || []
        };

        // Check if folder already exists
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: `workflows/${outputName}/`,
            MaxKeys: 1,
        });

        try {
            const listResponse = await s3Client.send(listCommand);
            if (listResponse.Contents && listResponse.Contents.length > 0) {
                return NextResponse.json(
                    { error: 'Workflow folder already exists in Scaleway. Use a different name or delete the existing folder first.' },
                    { status: 409 }
                );
            }
        } catch (listError) {
            console.error('Error checking folder existence:', listError);
        }

        // Upload workflow JSON
        const workflowKey = `workflows/${outputName}/${workflowFileName}`;
        const workflowCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: workflowKey,
            Body: JSON.stringify(workflowData, null, 2),
            ContentType: 'application/json',
        });

        await s3Client.send(workflowCommand);

        // Upload scan result JSON
        const scanResultKey = `workflows/${outputName}/wf-scan-result.json`;
        const scanResultCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: scanResultKey,
            Body: JSON.stringify(updatedScanResult, null, 2),
            ContentType: 'application/json',
        });

        await s3Client.send(scanResultCommand);

        return NextResponse.json({
            success: true,
            message: 'Files uploaded successfully',
            location: `s3://${BUCKET_NAME}/workflows/${outputName}/`,
            files: [workflowKey, scanResultKey],
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload to Scaleway', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
