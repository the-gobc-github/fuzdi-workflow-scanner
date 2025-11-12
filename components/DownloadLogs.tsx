'use client';

import { useEffect, useRef, useState } from 'react';

interface DownloadLogsProps {
    workflowName: string;
    onComplete?: (success: boolean) => void;
}

interface LogEntry {
    type: 'log' | 'error' | 'success' | 'done';
    message?: string;
    exitCode?: number;
}

export default function DownloadLogs({ workflowName, onComplete }: DownloadLogsProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(true);
    const [exitCode, setExitCode] = useState<number | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const hasCompletedRef = useRef(false);

    useEffect(() => {
        // Start the download process
        const startDownload = async () => {
            try {
                // Use EventSource for Server-Sent Events
                const eventSource = new EventSource(
                    `/api/run-downloader?workflowName=${encodeURIComponent(workflowName)}`,
                );

                eventSourceRef.current = eventSource;

                eventSource.onmessage = (event) => {
                    try {
                        const data: LogEntry = JSON.parse(event.data);

                        if (data.type === 'done') {
                            if (!hasCompletedRef.current) {
                                hasCompletedRef.current = true;
                                setIsRunning(false);
                                setExitCode(data.exitCode ?? null);

                                // Close immediately to prevent reconnection
                                if (eventSourceRef.current) {
                                    eventSourceRef.current.close();
                                    eventSourceRef.current = null;
                                }

                                if (onComplete) {
                                    onComplete(data.exitCode === 0);
                                }
                            }
                        } else if (data.message) {
                            setLogs(prev => [...prev, data.message || '']);
                        }
                    } catch (err) {
                        console.error('Failed to parse log entry:', err);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error('EventSource error:', error);

                    // Check if we've already completed - if so, just close silently
                    if (hasCompletedRef.current) {
                        eventSource.close();
                        eventSourceRef.current = null;
                        return;
                    }

                    // Only log error if we haven't already completed and it's a real error
                    if (eventSourceRef.current && eventSource.readyState === EventSource.CLOSED) {
                        hasCompletedRef.current = true;
                        setLogs(prev => [...prev, '❌ Connection error occurred\n']);
                        setIsRunning(false);
                        eventSource.close();
                        eventSourceRef.current = null;
                        if (onComplete) {
                            onComplete(false);
                        }
                    }
                };
            } catch (error) {
                console.error('Failed to start download:', error);
                if (!hasCompletedRef.current) {
                    hasCompletedRef.current = true;
                    setLogs(prev => [...prev, `❌ Failed to start download: ${error}\n`]);
                    setIsRunning(false);
                    if (onComplete) {
                        onComplete(false);
                    }
                }
            }
        };

        startDownload();

        // Cleanup on unmount
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [workflowName, onComplete]);

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const getStatusColor = () => {
        if (isRunning) return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
        if (exitCode === 0) return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
    };

    const getStatusIcon = () => {
        if (isRunning) return '⏳';
        if (exitCode === 0) return '✅';
        return '❌';
    };

    const getStatusText = () => {
        if (isRunning) return 'Running...';
        if (exitCode === 0) return 'Completed Successfully';
        return `Failed (exit code: ${exitCode})`;
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-4">
            {/* Status Header */}
            <div className={`rounded-lg shadow-md p-4 border-2 ${getStatusColor()}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{getStatusIcon()}</span>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Resources Download
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Workflow: <span className="font-mono">{workflowName}</span>
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-sm font-medium ${isRunning
                            ? 'text-blue-700 dark:text-blue-300'
                            : exitCode === 0
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}>
                            {getStatusText()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Logs Display */}
            <div className="bg-gray-900 rounded-lg shadow-md p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-300">Console Output</h4>
                    {isRunning && (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                            <span className="text-xs text-gray-400">Processing...</span>
                        </div>
                    )}
                </div>

                <div
                    className="font-mono text-sm text-gray-100 bg-black rounded p-4 h-96 overflow-y-auto"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                    {logs.length === 0 ? (
                        <span className="text-gray-500">Waiting for output...</span>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index}>{log}</div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>

            {/* Action Buttons */}
            {!isRunning && (
                <div className="flex gap-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Start New Scan
                    </button>
                </div>
            )}
        </div>
    );
}
