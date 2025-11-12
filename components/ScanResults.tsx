'use client';

import { ScanResult, AvailabilityStatus } from '@/lib/types';
import { getCategoriesWithModels } from '@/lib/workflow-scanner';
import { useState, useEffect } from 'react';

interface ScanResultsProps {
    scanResult: ScanResult;
    fileName: string;
    onUpload?: (outputName: string, requiredModels: string[]) => void;
    isUploading?: boolean;
}

export default function ScanResults({ scanResult, fileName, onUpload, isUploading }: ScanResultsProps) {
    const [outputName, setOutputName] = useState('');
    const [availability, setAvailability] = useState<AvailabilityStatus | null>(null);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [requiredModels, setRequiredModels] = useState<Set<string>>(new Set());
    const categoriesWithModels = getCategoriesWithModels(scanResult.models);
    const totalModels = categoriesWithModels.reduce((sum, cat) => sum + cat.count, 0);

    // Initialize all models as required on mount
    useEffect(() => {
        const allModels = new Set<string>();
        Object.entries(scanResult.models).forEach(([category, models]) => {
            models.forEach((model: string) => {
                allModels.add(`${category}:${model}`);
            });
        });
        setRequiredModels(allModels);
    }, [scanResult]);

    // Check availability on mount
    useEffect(() => {
        checkAvailability();
    }, [scanResult]);

    const checkAvailability = async () => {
        setCheckingAvailability(true);
        try {
            const response = await fetch('/api/check-availability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ scanResult }),
            });

            if (response.ok) {
                const data = await response.json();
                setAvailability(data.availability);
            }
        } catch (error) {
            console.error('Failed to check availability:', error);
        } finally {
            setCheckingAvailability(false);
        }
    };

    const handleUpload = () => {
        if (onUpload && outputName.trim()) {
            // Convert from "category:model" format to just model names
            const modelNames = Array.from(requiredModels).map(path => path.split(':')[1]);
            onUpload(outputName.trim(), modelNames);
        }
    };

    const toggleRequiredModel = (modelPath: string) => {
        setRequiredModels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(modelPath)) {
                newSet.delete(modelPath);
            } else {
                newSet.add(modelPath);
            }
            return newSet;
        });
    };

    // Check if required models that are missing would prevent upload
    const getMissingRequiredModels = (): string[] => {
        if (!availability) return [];

        const missing: string[] = [];
        for (const modelPath of requiredModels) {
            // Parse modelPath: "category:model"
            const [category, model] = modelPath.split(':');
            if (availability.models[category]?.[model] === false) {
                missing.push(model);
            }
        }
        return missing;
    };

    const missingRequiredModels = getMissingRequiredModels();
    const canUpload = missingRequiredModels.length === 0;

    const getAvailabilityBadge = (isAvailable: boolean | undefined) => {
        if (isAvailable === undefined) {
            return (
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    Checking...
                </span>
            );
        }
        return isAvailable ? (
            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded flex items-center gap-1">
                ✓ Available
            </span>
        ) : (
            <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded flex items-center gap-1">
                ⚠ Missing
            </span>
        );
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Scan Results
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Workflow: <span className="font-mono">{fileName}</span>
                </p>
            </div>

            {/* Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    📊 Summary
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Custom Nodes</p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {scanResult['custom-nodes'].length}
                        </p>
                        {availability && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {Object.values(availability.customNodes).filter(Boolean).length} available
                            </p>
                        )}
                    </div>

                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Models</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {totalModels}
                        </p>
                        {availability && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {Object.values(availability.models).flatMap(cat => Object.values(cat)).filter(Boolean).length} available
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Nodes */}
            {scanResult['custom-nodes'].length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            📦 Custom Nodes
                        </h3>
                        {checkingAvailability && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Checking availability...
                            </span>
                        )}
                    </div>

                    <div className="space-y-2">
                        {scanResult['custom-nodes'].map((node, index) => {
                            const nodeKey = `${node.node}@${node.version}`;
                            const isAvailable = availability?.customNodes[nodeKey];

                            return (
                                <div
                                    key={index}
                                    className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
                                >
                                    <div className="flex-1">
                                        <span className="font-mono text-sm text-gray-900 dark:text-gray-100 block">
                                            {node.node}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                            custom-nodes/{node.node}/{node.version}/
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                            {node.version}
                                        </span>
                                        {getAvailabilityBadge(isAvailable)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Models by Category */}
            {categoriesWithModels.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            🎨 Models by Category
                        </h3>
                        {requiredModels.size > 0 && (
                            <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                                {requiredModels.size} required
                            </span>
                        )}
                    </div>

                    <div className="space-y-4">
                        {categoriesWithModels.map(({ category, count }) => {
                            // Map category label back to key
                            const categoryMap: { [label: string]: keyof typeof scanResult.models } = {
                                'Checkpoints': 'checkpoints',
                                'VAE': 'vae',
                                'LoRAs': 'loras',
                                'Upscale Models': 'upscale_models',
                                'ControlNet': 'controlnet',
                                'CLIP': 'clip',
                                'CLIP Vision': 'clip_vision',
                                'Text Encoders': 'text_encoders',
                                'Diffusion Models': 'diffusion_models',
                                'Embeddings': 'embedding',
                                'Style Models': 'style_models',
                                'Hypernetworks': 'hypernetworks',
                                'GLIGEN': 'gligen'
                            };

                            const categoryKey = categoryMap[category];
                            const models = scanResult.models[categoryKey];
                            const categoryAvailability = availability?.models[categoryKey];
                            const availableCount = categoryAvailability
                                ? Object.values(categoryAvailability).filter(Boolean).length
                                : 0;

                            return (
                                <details key={category} className="group" open>
                                    <summary className="cursor-pointer list-none">
                                        <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border-2 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="text-blue-600 dark:text-blue-400 group-open:rotate-90 transition-transform text-lg">
                                                    ▶
                                                </span>
                                                <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                                    {category}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {availability && (
                                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                                        {availableCount}/{count} available
                                                    </span>
                                                )}
                                                <span className="text-sm px-3 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full font-bold">
                                                    {count}
                                                </span>
                                            </div>
                                        </div>
                                    </summary>

                                    <div className="mt-2 ml-6 space-y-1">
                                        {models.map((model, idx) => {
                                            const modelAvailable = categoryAvailability?.[model];
                                            const modelTypeMap: { [key: string]: string } = {
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
                                            const modelType = modelTypeMap[categoryKey] || categoryKey;
                                            const modelPath = `${categoryKey}:${model}`;
                                            const isRequired = requiredModels.has(modelPath);

                                            return (
                                                <div
                                                    key={idx}
                                                    className="p-3 bg-white dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-700"
                                                >
                                                    <div className="flex items-start gap-3 mb-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={isRequired}
                                                            onChange={() => toggleRequiredModel(modelPath)}
                                                            className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer flex-shrink-0"
                                                            title="Mark as required"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <span className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                                                                    {model}
                                                                </span>
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    {isRequired && (
                                                                        <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded whitespace-nowrap">
                                                                            Required
                                                                        </span>
                                                                    )}
                                                                    {getAvailabilityBadge(modelAvailable)}
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                                                                models/{modelType}/{model}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Upload Section */}
            {onUpload && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        ☁️ Upload to Scaleway
                    </h3>

                    <div className="space-y-4">
                        {/* Validation Warning */}
                        {missingRequiredModels.length > 0 && (
                            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                                            Cannot upload: Required models are missing
                                        </p>
                                        <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                                            The following required models are not available in Scaleway:
                                        </p>
                                        <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                                            {missingRequiredModels.map((model, idx) => (
                                                <li key={idx} className="font-mono">{model}</li>
                                            ))}
                                        </ul>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                            Please upload these models to Scaleway before uploading the workflow scan result.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="output-name"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                                Output Name
                            </label>
                            <input
                                type="text"
                                id="output-name"
                                value={outputName}
                                onChange={(e) => setOutputName(e.target.value)}
                                placeholder="e.g., fluxok2"
                                disabled={isUploading}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Files will be uploaded to: workflows/{outputName || '<output-name>'}/
                            </p>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={!outputName.trim() || isUploading || !canUpload}
                            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                        >
                            {isUploading ? 'Uploading...' : 'Upload to Scaleway'}
                        </button>
                    </div>
                </div>
            )}

            {/* Download JSON */}
            <div className="flex gap-4">
                <button
                    onClick={() => {
                        // Build scan result with required_models
                        const modelNames = Array.from(requiredModels).map(path => path.split(':')[1]);
                        const resultWithRequired = {
                            ...scanResult,
                            required_models: modelNames
                        };

                        const blob = new Blob([JSON.stringify(resultWithRequired, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'wf-scan-result.json';
                        a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                >
                    📥 Download Scan Result JSON
                </button>
            </div>
        </div>
    );
}
