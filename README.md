# ComfyUI Workflow Scanner

A Next.js web application for analyzing ComfyUI workflow JSON files. Drop a workflow file, and the scanner will extract all dependencies including models, custom nodes, and their versions. Optionally upload the scan results to Scaleway S3 storage.

## Features

- 📤 **Drag & Drop Interface** - Simply drag and drop your ComfyUI workflow JSON file
- 🔍 **Comprehensive Scanning** - Extracts all model types:
  - Checkpoints
  - VAE models
  - LoRAs
  - Upscale models
  - ControlNet
  - CLIP and CLIP Vision
  - Text Encoders
  - Diffusion models (UNet, GGUF)
  - Embeddings
  - Style models
  - Hypernetworks
  - GLIGEN
- 📦 **Custom Nodes Detection** - Identifies custom nodes with version information
- ✅ **Availability Checking** - Automatically checks if models and custom nodes exist in Scaleway
  - Shows visual indicators (✓ Available / ⚠ Missing)
  - Displays paths: `custom-nodes/{NODE_NAME}/{VERSION}/` and `models/{MODEL_TYPE}/{model}`
  - Real-time availability counts in summary
- ☑️ **Required Models** - Mark critical models as required with checkboxes
  - Upload validation: Cannot upload if required models are missing
  - Visual feedback with warning messages
  - Required models saved in scan result JSON
- ☁️ **Scaleway Upload** - Optional upload of scan results to Scaleway S3
- 📥 **Download Results** - Export scan results as JSON
- 🌙 **Dark Mode Support** - Beautiful UI with dark mode

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fuzdi-workflow-scanner
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (optional, for Scaleway upload):

Create a `.env` file in the root directory:
```env
SCALEWAY_ACCESS_KEY_ID=your_access_key
SCALEWAY_SECRET_ACCESS_KEY=your_secret_key
SCALEWAY_BUCKET_NAME=your_bucket_name
SCALEWAY_REGION=fr-par
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Scanning a Workflow

1. Open the application in your browser
2. Drag and drop a ComfyUI workflow JSON file onto the dropzone
3. The scanner will analyze the file and display:
   - Custom nodes with versions and availability status
   - Models organized by category with availability indicators
   - Total counts and statistics
   - Scaleway paths for each resource

**Availability Status:**
- ✓ **Available**: Resource exists in Scaleway at the specified path
- ⚠ **Missing**: Resource not found in Scaleway

The app automatically checks:
- Custom nodes at: `custom-nodes/{NODE_NAME}/{VERSION}/`
- Models at: `models/{MODEL_TYPE}/{model_file}`

### Marking Required Models

1. Expand any model category (Checkpoints, LoRAs, etc.)
2. Check the box next to models that are critical for your workflow
3. Checked models will show a purple "Required" badge
4. The system validates these models before allowing upload

**Upload Validation:**
- If all required models are available → Upload enabled ✅
- If any required model is missing → Upload blocked ⚠️
  - Warning message shows which models are missing
  - Upload button is disabled
  - Must upload missing models to Scaleway first

### Uploading to Scaleway

1. After scanning a workflow, scroll to the "Upload to Scaleway" section
2. Enter an output name (e.g., "my-workflow")
3. Click "Upload to Scaleway"
4. Files will be uploaded to: `s3://your-bucket/workflows/<output-name>/`

The upload includes:
- Original workflow JSON file
- `wf-scan-result.json` (dependency manifest)

### Downloading Results

Click the "Download Scan Result JSON" button to save the scan results locally.

## Project Structure

```
fuzdi-workflow-scanner/
├── app/
│   ├── api/
│   │   └── upload/
│   │       └── route.ts          # Scaleway upload API endpoint
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main page with workflow
│   └── globals.css               # Global styles
├── components/
│   ├── FileDropzone.tsx          # File upload component
│   └── ScanResults.tsx           # Results display component
├── lib/
│   ├── types.ts                  # TypeScript types
│   └── workflow-scanner.ts       # Core scanning logic
├── .env                          # Environment variables
└── package.json
```

## How It Works

The scanner analyzes ComfyUI workflow JSON files by:

1. **Extracting Custom Nodes**: Identifies nodes with `cnr_id` property and their versions
2. **Finding Models**: Searches for various node types and extracts model references from:
   - Widget values (e.g., `widgets_values[0]`)
   - Properties arrays (e.g., `properties.models`)
3. **Categorizing**: Groups models by ComfyUI folder structure
4. **Validation**: Ensures the JSON is valid and contains required workflow structure

## Technologies

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **AWS SDK** - S3 client for Scaleway
- **React** - UI components

## API Routes

### POST /api/upload

Upload workflow and scan results to Scaleway S3.

**Request Body:**
```json
{
  "outputName": "workflow-name",
  "scanResult": { /* scan result object */ },
  "workflowData": { /* original workflow JSON */ },
  "workflowFileName": "workflow.json"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Files uploaded successfully",
  "location": "s3://bucket-name/workflows/workflow-name/",
  "files": ["workflows/workflow-name/workflow.json", "workflows/workflow-name/wf-scan-result.json"]
}
```

### POST /api/check-availability

Check if models and custom nodes exist in Scaleway S3.

**Request Body:**
```json
{
  "scanResult": { /* scan result object */ }
}
```

**Response:**
```json
{
  "success": true,
  "availability": {
    "customNodes": {
      "node-name@version": true,
      "another-node@1.0": false
    },
    "models": {
      "checkpoints": {
        "model-name.safetensors": true
      },
      "loras": {
        "lora-name.safetensors": false
      }
    }
  }
}
```

The API checks:
- Custom nodes at: `custom-nodes/{NODE_NAME}/{VERSION}/.marker`
- Models at: `models/{MODEL_TYPE}/{model}`

## Development

### Build for Production

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SCALEWAY_ACCESS_KEY_ID` | Scaleway S3 access key | No (for upload) |
| `SCALEWAY_SECRET_ACCESS_KEY` | Scaleway S3 secret key | No (for upload) |
| `SCALEWAY_BUCKET_NAME` | S3 bucket name | No (for upload) |
| `SCALEWAY_REGION` | S3 region (e.g., fr-par) | No (for upload) |

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
