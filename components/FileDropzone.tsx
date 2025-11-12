'use client';

import { useState, useCallback } from 'react';

interface FileDropzoneProps {
    onFileProcessed: (data: any, fileName: string) => void;
}

export default function FileDropzone({ onFileProcessed }: FileDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback((file: File) => {
        setError(null);

        // Validate file type
        if (!file.name.endsWith('.json')) {
            setError('Please upload a JSON file');
            return;
        }

        // Read and parse the file
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);

                // Basic validation for ComfyUI workflow structure
                if (!data.nodes || !Array.isArray(data.nodes)) {
                    setError('Invalid ComfyUI workflow format: missing nodes array');
                    return;
                }

                onFileProcessed(data, file.name);
            } catch (err) {
                setError('Failed to parse JSON file. Please ensure it\'s a valid ComfyUI workflow.');
            }
        };

        reader.onerror = () => {
            setError('Failed to read file');
        };

        reader.readAsText(file);
    }, [onFileProcessed]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
          relative border-2 border-dashed rounded-lg p-12
          transition-all duration-200 ease-in-out
          ${isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                    }
        `}
            >
                <input
                    type="file"
                    id="file-upload"
                    accept=".json"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="text-center">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                    >
                        <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>

                    <div className="mt-4">
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium"
                        >
                            Choose a file
                        </label>
                        <span className="text-gray-600 dark:text-gray-400"> or drag and drop</span>
                    </div>

                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        ComfyUI workflow JSON file
                    </p>
                </div>
            </div>

            {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}
        </div>
    );
}
