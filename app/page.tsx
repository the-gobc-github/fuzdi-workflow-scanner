'use client';

import { useState } from 'react';
import FileDropzone from '@/components/FileDropzone';
import ScanResults from '@/components/ScanResults';
import DownloadLogs from '@/components/DownloadLogs';
import { scanWorkflow } from '@/lib/workflow-scanner';
import { ScanResult, WorkflowJSON } from '@/lib/types';

export default function Home() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [workflowData, setWorkflowData] = useState<WorkflowJSON | null>(null);
  const [workflowFileName, setWorkflowFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDownloadLogs, setShowDownloadLogs] = useState(false);
  const [uploadedWorkflowName, setUploadedWorkflowName] = useState<string>('');

  const handleFileProcessed = (data: WorkflowJSON, fileName: string) => {
    const result = scanWorkflow(data);
    setScanResult(result);
    setWorkflowData(data);
    setWorkflowFileName(fileName);
    setUploadStatus(null);
  };

  const handleUpload = async (outputName: string, requiredModels: string[]) => {
    if (!scanResult || !workflowData || !workflowFileName) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outputName,
          scanResult,
          workflowData,
          workflowFileName,
          requiredModels,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus({
          type: 'success',
          message: `Successfully uploaded to ${data.location}`,
        });
        // Trigger the download script
        setUploadedWorkflowName(outputName);
        setShowDownloadLogs(true);
      } else {
        setUploadStatus({
          type: 'error',
          message: data.error || 'Upload failed',
        });
      }
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setWorkflowData(null);
    setWorkflowFileName('');
    setUploadStatus(null);
    setShowDownloadLogs(false);
    setUploadedWorkflowName('');
  };

  const handleDownloadComplete = (success: boolean) => {
    if (success) {
      setUploadStatus({
        type: 'success',
        message: 'Resources downloaded and uploaded to Scaleway successfully!',
      });
    } else {
      setUploadStatus({
        type: 'error',
        message: 'Resource download process encountered errors. Check logs above.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            ComfyUI Workflow Scanner
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Analyze ComfyUI workflows and extract dependencies
          </p>
        </div>

        {/* Upload Status */}
        {uploadStatus && !showDownloadLogs && (
          <div className={`max-w-4xl mx-auto mb-6 p-4 rounded-lg ${uploadStatus.type === 'success'
            ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
            }`}>
            <p className={`text-sm ${uploadStatus.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
              }`}>
              {uploadStatus.message}
            </p>
          </div>
        )}

        {/* Main Content */}
        {showDownloadLogs ? (
          <DownloadLogs
            workflowName={uploadedWorkflowName}
            onComplete={handleDownloadComplete}
          />
        ) : !scanResult ? (
          <FileDropzone onFileProcessed={handleFileProcessed} />
        ) : (
          <>
            <ScanResults
              scanResult={scanResult}
              fileName={workflowFileName}
              onUpload={handleUpload}
              isUploading={isUploading}
            />

            <div className="max-w-4xl mx-auto mt-6">
              <button
                onClick={handleReset}
                className="w-full px-6 py-3 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                ← Scan Another Workflow
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center mt-16 text-sm text-gray-500 dark:text-gray-400">
          <p>Drop a ComfyUI workflow JSON file to analyze its dependencies</p>
        </div>
      </div>
    </div>
  );
}

