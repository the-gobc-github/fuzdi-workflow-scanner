# Required Models Feature - Implementation Guide

## Overview
Added a checkbox system to mark models as "required" with upload validation. If any required models are missing in Scaleway, the workflow scan result cannot be uploaded.

## Features Implemented

### 1. **UI Checkboxes in Models Section**
- Each model now has a checkbox next to it
- Checked models are marked as "required"
- Visual indicators show which models are required

### 2. **Required Models Tracking**
- State managed with React Set for efficient lookup
- Model paths stored as `{category}:{model}` format
- Persisted in scan result JSON as `required_models` array

### 3. **Upload Validation**
- Client-side validation before upload
- Blocks upload if required models are missing in Scaleway
- Shows detailed error message listing missing required models

### 4. **Visual Feedback**
- Purple "Required" badge on checked models
- Count badge showing total required models
- Warning banner when upload is blocked
- Disabled upload button when validation fails

## User Interface Changes

### Models by Category Header
```
🎨 Models by Category          [3 required]
```

### Model Item with Checkbox
```
☑️ flux1-dev.safetensors    [Required] [✓ Available]
   models/checkpoints/flux1-dev.safetensors
```

### Upload Validation Warning
```
⚠️ Cannot upload: Required models are missing

The following required models are not available in Scaleway:
• sdxl-base.safetensors
• control_v11p_sd15_canny.pth

Please upload these models to Scaleway before uploading 
the workflow scan result.
```

## Technical Implementation

### Type Updates (`lib/types.ts`)
```typescript
export interface ScanResult {
    models: WorkflowModels;
    "custom-nodes": CustomNode[];
    required_models?: string[];  // NEW
}
```

### Component State (`components/ScanResults.tsx`)
```typescript
const [requiredModels, setRequiredModels] = useState<Set<string>>(new Set());

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
```

### Validation Logic
```typescript
const getMissingRequiredModels = (): string[] => {
    if (!availability) return [];
    
    const missing: string[] = [];
    for (const modelPath of requiredModels) {
        const [category, model] = modelPath.split(':');
        if (availability.models[category]?.[model] === false) {
            missing.push(model);
        }
    }
    return missing;
};

const missingRequiredModels = getMissingRequiredModels();
const canUpload = missingRequiredModels.length === 0;
```

### Upload Handler (`app/page.tsx`)
```typescript
const handleUpload = async (outputName: string, requiredModels: string[]) => {
    // ... upload logic with requiredModels
}
```

### API Update (`app/api/upload/route.ts`)
```typescript
const updatedScanResult = {
    ...scanResult,
    required_models: requiredModels || []
};

// Upload with required_models included
Body: JSON.stringify(updatedScanResult, null, 2)
```

## User Workflow

### 1. Scan Workflow
Upload workflow JSON → Scanner analyzes dependencies

### 2. Check Availability
Automatic check shows which models are available/missing in Scaleway

### 3. Mark Required Models
- Expand model categories
- Check boxes next to critical models
- "Required" badge appears

### 4. Validation Feedback
- If required models are missing: Red warning banner appears
- Upload button becomes disabled
- List of missing required models shown

### 5. Upload or Fix
**Option A: All required models available**
→ Upload button enabled
→ Click to upload workflow scan result

**Option B: Some required models missing**
→ Upload blocked
→ Must upload missing models to Scaleway first
→ Re-scan to verify availability
→ Then upload workflow

## Scan Result JSON Format

### Without Required Models
```json
{
  "models": {
    "checkpoints": ["flux1-dev.safetensors"],
    "loras": ["flux-realism.safetensors"]
  },
  "custom-nodes": []
}
```

### With Required Models
```json
{
  "models": {
    "checkpoints": ["flux1-dev.safetensors"],
    "loras": ["flux-realism.safetensors"]
  },
  "custom-nodes": [],
  "required_models": [
    "checkpoints:flux1-dev.safetensors",
    "loras:flux-realism.safetensors"
  ]
}
```

## Validation Rules

### Upload is ALLOWED when:
✅ No models marked as required
✅ All required models exist in Scaleway
✅ Required models list is empty

### Upload is BLOCKED when:
❌ One or more required models are missing from Scaleway
❌ Required model availability check failed

## Benefits

1. **Prevents Broken Workflows**: Ensures critical models are available before deployment
2. **Clear Feedback**: Users see exactly why upload is blocked
3. **Flexible**: Mark only critical models as required
4. **Documented**: Required models saved in scan result for reference
5. **Safe**: Cannot accidentally deploy incomplete workflows

## Usage Examples

### Example 1: Mark Critical Checkpoint
```
1. Scan workflow with 3 checkpoints
2. Check the main checkpoint: flux1-dev.safetensors
3. Leave optional checkpoints unchecked
4. If flux1-dev is missing → Upload blocked
5. If flux1-dev is available → Upload allowed
```

### Example 2: Multiple Required Models
```
1. Check main checkpoint
2. Check critical LoRA
3. Check required VAE
4. System validates all 3
5. Upload only if all 3 are available
```

### Example 3: No Required Models
```
1. Don't check any boxes
2. Upload always allowed
3. Scan result has empty required_models array
```

## Visual Indicators Reference

| Element | Appearance | Meaning |
|---------|-----------|---------|
| Checkbox (unchecked) | ☐ | Model is optional |
| Checkbox (checked) | ☑️ | Model is required |
| Purple badge | `Required` | Model marked as required |
| Required count | `3 required` | Total required models |
| Red warning | ⚠️ banner | Upload blocked |
| Disabled button | Gray button | Cannot upload |

## Error Messages

### Missing Required Models
```
⚠️ Cannot upload: Required models are missing

The following required models are not available in Scaleway:
• model1.safetensors
• model2.safetensors

Please upload these models to Scaleway before uploading 
the workflow scan result.
```

## Best Practices

1. **Mark Critical Models**: Only check models essential for workflow operation
2. **Verify Availability**: Check availability before marking as required
3. **Upload Missing**: Upload required models to Scaleway before workflow upload
4. **Re-scan**: After uploading models, re-scan to verify availability
5. **Document**: Required models are saved in scan result for team reference

## Testing Checklist

- [ ] Check a model → "Required" badge appears
- [ ] Check multiple models → Count shows correctly
- [ ] Required model is available → Upload enabled
- [ ] Required model is missing → Upload blocked
- [ ] Warning shows missing model names
- [ ] Uncheck model → Validation updates
- [ ] Upload includes required_models in JSON
- [ ] Downloaded scan result contains required_models array

## Future Enhancements

Possible improvements:
- [ ] Select all/none buttons per category
- [ ] Import required models from previous scan
- [ ] Bulk upload missing required models
- [ ] Required model templates/presets
- [ ] Export required models list separately
- [ ] Auto-mark models based on workflow analysis

## Troubleshooting

**Q: Upload button disabled but no warning shows**
A: No required models are missing. Check other requirements (output name filled).

**Q: Checked a model but upload still blocked**
A: Model must be available in Scaleway. Check availability badge.

**Q: How to undo required marking?**
A: Uncheck the checkbox. Model is no longer required.

**Q: Where are required models stored?**
A: In scan result JSON under `required_models` array.

**Q: Can I edit required models after upload?**
A: Yes, re-scan and check/uncheck, then upload again.

This feature ensures workflow deployments are safe and complete! 🎯
