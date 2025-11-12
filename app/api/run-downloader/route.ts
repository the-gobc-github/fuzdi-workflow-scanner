import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workflowName = searchParams.get('workflowName');

        if (!workflowName) {
            return new Response(
                JSON.stringify({ error: 'Missing workflowName' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // Create a readable stream for the response
        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                let isClosed = false;

                // Helper to safely enqueue
                const safeEnqueue = (data: Uint8Array) => {
                    if (!isClosed) {
                        try {
                            controller.enqueue(data);
                        } catch (err) {
                            console.error('Failed to enqueue data:', err);
                            isClosed = true;
                        }
                    }
                };

                // Path to the script
                const scriptPath = path.join(process.cwd(), 'wf-resources-downloader.sh');

                // Send initial log
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'log',
                    message: `🚀 Starting download process for workflow: ${workflowName}\n`
                })}\n\n`));

                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'log',
                    message: `📂 Script: ${scriptPath}\n`
                })}\n\n`));

                // Spawn the bash script
                const childProcess = spawn('bash', [scriptPath, workflowName], {
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        // Map SCALEWAY_* env vars to SCW_* that the script expects
                        SCW_ACCESS_KEY: process.env.SCALEWAY_ACCESS_KEY_ID,
                        SCW_SECRET_KEY: process.env.SCALEWAY_SECRET_ACCESS_KEY,
                        SCW_BUCKET_NAME: process.env.SCALEWAY_BUCKET_NAME,
                        SCW_REGION: process.env.SCALEWAY_REGION,
                    }
                });

                // Handle stdout
                childProcess.stdout.on('data', (data) => {
                    const message = data.toString();
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'log',
                        message
                    })}\n\n`));
                });

                // Handle stderr
                childProcess.stderr.on('data', (data) => {
                    const message = data.toString();
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'error',
                        message
                    })}\n\n`));
                });

                // Handle process completion
                childProcess.on('close', (code) => {
                    if (!isClosed) {
                        if (code === 0) {
                            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'success',
                                message: `✅ Download process completed successfully!\n`
                            })}\n\n`));
                        } else {
                            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'error',
                                message: `❌ Download process failed with exit code: ${code}\n`
                            })}\n\n`));
                        }

                        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'done',
                            exitCode: code
                        })}\n\n`));

                        // Mark as closed and close controller after a small delay to ensure message is sent
                        isClosed = true;
                        setTimeout(() => {
                            try {
                                controller.close();
                            } catch (e) {
                                // Already closed, ignore
                            }
                        }, 100);
                    }
                });

                // Handle errors
                childProcess.on('error', (error) => {
                    if (!isClosed) {
                        safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'error',
                            message: `Error spawning process: ${error.message}\n`
                        })}\n\n`));
                        isClosed = true;
                        setTimeout(() => {
                            try {
                                controller.close();
                            } catch (e) {
                                // Already closed, ignore
                            }
                        }, 100);
                    }
                });
            },
            cancel() {
                // Handle client disconnect
                console.log('Client disconnected from stream');
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Run downloader error:', error);
        return new Response(
            JSON.stringify({
                error: 'Failed to run downloader script',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
