# Testing Guide

## Quick Test with Sample Workflow

1. Make sure the dev server is running:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 (or 3001) in your browser

3. Drag and drop the `sample-workflow.json` file onto the dropzone

4. Expected results:
   - **Custom Nodes**: 2 nodes
     - custom-controlnet-node (1.2.0)
     - upscaler-node (2.1.5)
   - **Models**:
     - Checkpoints: 1 (flux1-dev.safetensors)
     - VAE: 1 (ae.safetensors)
     - LoRAs: 1 (flux-realism-lora.safetensors)
     - ControlNet: 1 (control_v11p_sd15_canny.pth)
     - Upscale Models: 1 (RealESRGAN_x4plus.pth)

## Testing Upload to Scaleway

1. Make sure your `.env` file is configured with valid Scaleway credentials:
   ```env
   SCALEWAY_ACCESS_KEY_ID=your_key
   SCALEWAY_SECRET_ACCESS_KEY=your_secret
   SCALEWAY_BUCKET_NAME=your_bucket
   SCALEWAY_REGION=fr-par
   ```

2. After scanning a workflow, scroll to the "Upload to Scaleway" section

3. Enter an output name (e.g., "test-workflow")

4. Click "Upload to Scaleway"

5. Check your Scaleway bucket for:
   - `workflows/test-workflow/sample-workflow.json`
   - `workflows/test-workflow/wf-scan-result.json`

## Testing with Your Own Workflows

1. Export a workflow from ComfyUI as JSON:
   - In ComfyUI, click "Save" or "Export"
   - Save the workflow as a `.json` file

2. Drag and drop the file onto the scanner

3. Review all extracted dependencies

4. Optionally upload to Scaleway or download the scan result

## Common Issues

### Upload Fails

**Problem**: "Failed to upload to Scaleway"

**Solutions**:
- Check that `.env` credentials are correct
- Verify bucket exists in your Scaleway account
- Ensure bucket region matches SCALEWAY_REGION
- Check bucket permissions allow uploads

### Invalid JSON Error

**Problem**: "Failed to parse JSON file"

**Solutions**:
- Ensure file is valid JSON (not corrupted)
- Verify file is a ComfyUI workflow (has `nodes` array)
- Try opening file in a text editor to validate

### Port Already in Use

**Problem**: "Port 3000 is in use"

**Solutions**:
- Next.js will automatically use port 3001
- Or stop the process using port 3000
- Or manually specify port: `npm run dev -- -p 3002`

## Testing Checklist

- [ ] File upload via drag & drop works
- [ ] File upload via click works
- [ ] Invalid files show error messages
- [ ] Valid workflows display results
- [ ] All model categories are extracted
- [ ] Custom nodes show correct versions
- [ ] Download JSON button works
- [ ] Upload to Scaleway works (if configured)
- [ ] "Scan Another Workflow" button resets state
- [ ] Dark mode renders correctly
- [ ] Mobile responsive (try resizing browser)

## Sample Workflows to Test

You can find more ComfyUI workflows to test with:
- ComfyUI Examples: https://comfyanonymous.github.io/ComfyUI_examples/
- CivitAI workflows: https://civitai.com/
- Your own saved ComfyUI workflows

## API Testing

Test the upload API directly with curl:

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "outputName": "test",
    "scanResult": {"models": {}, "custom-nodes": []},
    "workflowData": {"nodes": []},
    "workflowFileName": "test.json"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Files uploaded successfully",
  "location": "s3://bucket/workflows/test/",
  "files": ["workflows/test/test.json", "workflows/test/wf-scan-result.json"]
}
```
