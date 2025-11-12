# Quick Start Guide - Availability Checking

## What's New?

The workflow scanner now shows you which resources are already uploaded to Scaleway!

## Visual Guide

### 1. Summary Section
```
📊 Summary
┌─────────────────────┐  ┌─────────────────────┐
│ Custom Nodes        │  │ Total Models        │
│ 5                   │  │ 12                  │
│ 3 available ← NEW!  │  │ 8 available ← NEW!  │
└─────────────────────┘  └─────────────────────┘
```

### 2. Custom Nodes Section
```
📦 Custom Nodes                    Checking availability...

┌────────────────────────────────────────────────────────┐
│ comfyui-impact-pack                    v1.2.0  ✓ Available │
│ custom-nodes/comfyui-impact-pack/v1.2.0/  ← Path shown    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ controlnet-preprocessors           v2.0.1  ⚠ Missing    │
│ custom-nodes/controlnet-preprocessors/v2.0.1/          │
└────────────────────────────────────────────────────────┘
```

### 3. Models Section
```
🎨 Models by Category

▶ Checkpoints                      3/5 available ← NEW!  [5]
  ├─ flux1-dev.safetensors         ✓ Available
  │  models/checkpoints/flux1-dev.safetensors
  │
  ├─ sdxl-base.safetensors         ⚠ Missing
  │  models/models/checkpoints/sdxl-base.safetensors
  │
  └─ ...

▶ LoRAs                            2/3 available  [3]
```

## Status Badges

| Badge | Meaning | Color |
|-------|---------|-------|
| ✓ Available | Resource exists in Scaleway | Green |
| ⚠ Missing | Resource not found | Orange |
| Checking... | Currently verifying | Gray |

## Scaleway Paths

The scanner shows exact paths where resources should be located:

**Custom Nodes:**
```
custom-nodes/{NODE_NAME}/{VERSION}/
```

**Models:**
```
models/{MODEL_TYPE}/{filename}
```

Examples:
- `custom-nodes/comfyui-impact-pack/v1.2.0/`
- `models/checkpoints/flux1-dev.safetensors`
- `models/loras/flux-realism.safetensors`
- `models/vae/ae.safetensors`

## How It Works

1. **Upload workflow** → Scanner analyzes
2. **Auto-check** → Queries Scaleway S3
3. **Display status** → Shows availability badges
4. **View paths** → See exact Scaleway locations

## Benefits

✅ **See what's missing** before deployment
✅ **Verify paths** are correct
✅ **Plan uploads** efficiently
✅ **Debug issues** faster
✅ **Confidence** in workflow readiness

## No Configuration Needed

If Scaleway credentials are in `.env`, availability checking happens automatically!

If credentials are missing:
- Scanner still works
- Availability badges won't show
- Can still download scan results

## Use Cases

### Scenario 1: New Workflow
Upload workflow → See all resources are missing → Upload required resources

### Scenario 2: Existing Workflow
Upload workflow → Most resources available → Only upload missing ones

### Scenario 3: Debugging
Workflow not working → Check scanner → See missing model → Upload it

### Scenario 4: Validation
After bulk upload → Scan workflow → Verify all show "Available"

## Tips

💡 **Expand categories** to see individual model availability

💡 **Copy paths** directly from the UI for upload commands

💡 **Check summary** for quick overview before deployment

💡 **Re-scan** after uploading to verify resources appear

## Example Workflow

```bash
# 1. Scan your workflow
→ Drop workflow.json into scanner

# 2. Review availability
→ See: 3 models missing, 2 custom nodes missing

# 3. Upload missing resources
$ aws s3 cp model.safetensors s3://bucket/models/checkpoints/
$ aws s3 cp lora.safetensors s3://bucket/models/loras/

# 4. Re-scan to confirm
→ All resources now show ✓ Available

# 5. Deploy with confidence!
```

## Troubleshooting

**Q: All resources show "Missing" but they're uploaded**
A: Check paths match exactly: `models/{type}/{filename}`

**Q: Availability badges not showing**
A: Verify `.env` has correct Scaleway credentials

**Q: Some resources show available, others don't**
A: Expected! Only uploaded resources show as available

**Q: Custom nodes show missing**
A: Custom nodes need a `.marker` file in their version folder

## Next Steps

After scanning:
1. Upload missing resources to Scaleway
2. Use displayed paths to ensure correct location
3. Re-scan to verify availability
4. Deploy workflow with confidence!
