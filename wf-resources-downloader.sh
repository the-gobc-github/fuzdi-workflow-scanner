#!/bin/bash

# Workflow Resources Downloader Script
# Downloads custom nodes for a workflow using comfy-cli and uploads them to Scaleway
#
# Usage: ./wf-resources-downloader.sh <workflow_folder_name> [--overwrite] [--comfyui-version VERSION]
#
# This script:
# 1. Fetches latest stable ComfyUI version from GitHub (or uses --comfyui-version)
# 2. Downloads wf-scan-result.json from Scaleway workflows/{workflow_folder_name}/
# 3. For each custom node listed, installs it using comfy-cli in a persistent environment
# 4. Uploads the installed custom node to Scaleway custom-nodes/{node_name}/{version}/
# 5. Cleans up temporary files (keeps persistent ComfyUI installation for reuse)
# 6. Archives old versions if --overwrite is used

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse arguments
WORKFLOW_FOLDER=""
OVERWRITE=false
COMFYUI_VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --overwrite)
            OVERWRITE=true
            shift
            ;;
        --comfyui-version)
            COMFYUI_VERSION="$2"
            shift 2
            ;;
        *)
            if [ -z "$WORKFLOW_FOLDER" ]; then
                WORKFLOW_FOLDER="$1"
            else
                echo "❌ Unknown argument: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [ -z "$WORKFLOW_FOLDER" ]; then
    echo "❌ Usage: $0 <workflow_folder_name> [--overwrite] [--comfyui-version VERSION]"
    echo ""
    echo "Arguments:"
    echo "  workflow_folder_name    Name of the workflow folder in Scaleway (workflows/{name})"
    echo "  --overwrite             Overwrite existing custom nodes and create archives"
    echo "  --comfyui-version VER   Specify ComfyUI version (e.g., 0.3.68). If not provided,"
    echo "                          will fetch latest stable version from GitHub"
    echo ""
    echo "Example:"
    echo "  $0 flux-upscale"
    echo "  $0 flux-upscale --overwrite"
    echo "  $0 flux-upscale --comfyui-version 0.3.68"
    echo "  $0 flux-upscale"
    echo "  $0 flux-upscale --overwrite"
    exit 1
fi

# Load environment variables from .env
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Validate Scaleway credentials
if [ -z "$SCW_ACCESS_KEY" ] || [ -z "$SCW_SECRET_KEY" ] || [ -z "$SCW_BUCKET_NAME" ] || [ -z "$SCW_REGION" ]; then
    echo "❌ Scaleway credentials required (SCW_ACCESS_KEY, SCW_SECRET_KEY, SCW_BUCKET_NAME, SCW_REGION)"
    echo "   Please configure them in .env file"
    exit 1
fi

# Check required tools
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required. Install: brew install jq"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "❌ curl is required. Install: brew install curl"
    exit 1
fi

echo "🔍 Processing workflow: $WORKFLOW_FOLDER"
echo ""

# ============================================================================
# Step 1: Download wf-scan-result.json from Scaleway
# ============================================================================
echo "📥 Step 1: Downloading workflow scan result from Scaleway..."

TEMP_SCAN_RESULT=$(mktemp)
REMOTE_SCAN_PATH="workflows/${WORKFLOW_FOLDER}/wf-scan-result.json"

if ! bash "$SCRIPT_DIR/upload-to-scaleway.sh" 2>&1 | grep -q "download"; then
    # Create a download helper
    export AWS_ACCESS_KEY_ID="$SCW_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"
    export AWS_DEFAULT_REGION="$SCW_REGION"
    export AWS_ENDPOINT_URL="https://s3.$SCW_REGION.scw.cloud"
    
    if aws s3 cp "s3://$SCW_BUCKET_NAME/$REMOTE_SCAN_PATH" "$TEMP_SCAN_RESULT" --endpoint-url "$AWS_ENDPOINT_URL" 2>/dev/null; then
        echo "   ✅ Downloaded: wf-scan-result.json"
    else
        echo "   ❌ Failed to download wf-scan-result.json from Scaleway"
        echo "   Make sure the workflow has been scanned: ./wf-scanner.sh"
        rm -f "$TEMP_SCAN_RESULT"
        exit 1
    fi
fi

# Validate JSON
if ! jq empty "$TEMP_SCAN_RESULT" 2>/dev/null; then
    echo "   ❌ Invalid JSON in wf-scan-result.json"
    rm -f "$TEMP_SCAN_RESULT"
    exit 1
fi

# Extract custom nodes
CUSTOM_NODES_JSON=$(jq -r '.["custom-nodes"]' "$TEMP_SCAN_RESULT")
CUSTOM_NODES_COUNT=$(echo "$CUSTOM_NODES_JSON" | jq 'length')

echo "   Found $CUSTOM_NODES_COUNT custom node(s) to process"
echo ""

# Display custom nodes list if any
if [ "$CUSTOM_NODES_COUNT" -gt 0 ]; then
    echo "📋 Custom nodes to download:"
    echo "$CUSTOM_NODES_JSON" | jq -r '.[] | "   - \(.node) (\(.version))"'
    echo ""
else
    echo "ℹ️  No custom nodes to download"
    echo ""
fi

# ============================================================================
# Step 2: Determine ComfyUI version
# ============================================================================
echo "📦 Step 2: Determining ComfyUI version..."

# Determine ComfyUI version to use
if [ -z "$COMFYUI_VERSION" ]; then
    echo "   🔍 Fetching latest stable ComfyUI version from GitHub..."
    COMFYUI_VERSION=$(curl -s https://api.github.com/repos/comfyanonymous/ComfyUI/releases/latest | jq -r '.tag_name' | sed 's/^v//')
    
    if [ -z "$COMFYUI_VERSION" ] || [ "$COMFYUI_VERSION" = "null" ]; then
        echo "   ❌ Failed to fetch ComfyUI version from GitHub"
        echo ""
        echo "Please specify the version manually using --comfyui-version:"
        echo "  $0 $WORKFLOW_FOLDER --comfyui-version 0.3.68"
        exit 1
    fi
    echo "   📌 Latest stable ComfyUI version: $COMFYUI_VERSION"
else
    echo "   📌 Using specified ComfyUI version: $COMFYUI_VERSION"
fi
echo ""

# ============================================================================
# Step 3: Setup environment and process custom nodes (if any)
# ============================================================================

if [ "$CUSTOM_NODES_COUNT" -gt 0 ]; then
    echo "🔧 Step 3: Setting up environment for custom nodes..."
    
    # Create versioned persistent directory
    PERSISTENT_DIR="$SCRIPT_DIR/.comfy-downloader-comfyui-${COMFYUI_VERSION}"
    echo "   📂 Persistent directory: $PERSISTENT_DIR"
    
    # Cleanup function
    cleanup() {
        echo ""
        echo "🧹 Cleaning up..."
        
        # Remove temporary scan result only (keep persistent dir)
        rm -f "$TEMP_SCAN_RESULT"
        
        echo "   ✅ Cleanup completed"
    }
    
    # Register cleanup on exit
    trap cleanup EXIT
    
    # Check if python3 is available
    if ! command -v python3 &> /dev/null; then
        echo "❌ python3 is required. Please install Python 3"
        exit 1
    fi
    
    # Create persistent directory if it doesn't exist
    mkdir -p "$PERSISTENT_DIR"

# Create or reuse virtual environment
if [ ! -d "$PERSISTENT_DIR/venv" ]; then
    echo "   🐍 Creating Python virtual environment..."
    python3 -m venv "$PERSISTENT_DIR/venv"
    VENV_CREATED=true
else
    echo "   ✅ Reusing existing Python virtual environment"
    VENV_CREATED=false
fi

# Activate virtual environment
source "$PERSISTENT_DIR/venv/bin/activate"

# Install comfy-cli if needed
if [ "$VENV_CREATED" = true ] || ! command -v comfy &> /dev/null; then
    echo "   📦 Installing comfy-cli in virtual environment..."
    pip install comfy-cli --quiet
    echo "   ✅ comfy-cli installed"
else
    echo "   ✅ comfy-cli already available"
fi

# Install ComfyUI if not already installed (use the fetched version)
if [ ! -d "$PERSISTENT_DIR/ComfyUI" ]; then
    echo "   📦 Installing ComfyUI v$COMFYUI_VERSION (CPU-only, for node downloads)..."
    cd "$PERSISTENT_DIR"
    comfy --skip-prompt --workspace "$PERSISTENT_DIR/ComfyUI" install --version "$COMFYUI_VERSION" --cpu
    echo "   ✅ ComfyUI v$COMFYUI_VERSION installed"
else
    echo "   ✅ ComfyUI v$COMFYUI_VERSION already installed (reusing existing)"
fi

# Verify installation
if [ ! -d "$PERSISTENT_DIR/ComfyUI" ]; then
    echo "   ❌ Failed to install ComfyUI"
    echo "   Persistent directory: $PERSISTENT_DIR"
    exit 1
fi

# Save ComfyUI version to a file in the persistent directory
echo "$COMFYUI_VERSION" > "$PERSISTENT_DIR/.comfy_version"

echo "   ✅ Environment ready"
echo ""

# Set ComfyUI workspace
COMFY_WORKSPACE="$PERSISTENT_DIR/ComfyUI"

# ============================================================================
# Step 3: Download and upload each custom node
# ============================================================================
echo "🔌 Step 3: Processing custom nodes..."
echo ""

# Configure AWS CLI for uploads
export AWS_ACCESS_KEY_ID="$SCW_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"
export AWS_DEFAULT_REGION="$SCW_REGION"
export AWS_ENDPOINT_URL="https://s3.$SCW_REGION.scw.cloud"

PROCESSED=0
SKIPPED=0
FAILED=0

# Process each custom node
for i in $(seq 0 $((CUSTOM_NODES_COUNT - 1))); do
    NODE_NAME=$(echo "$CUSTOM_NODES_JSON" | jq -r ".[$i].node")
    NODE_VERSION=$(echo "$CUSTOM_NODES_JSON" | jq -r ".[$i].version")
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Processing: $NODE_NAME (version: $NODE_VERSION)"
    echo ""
    
    # Define remote path
    REMOTE_NODE_PATH="custom-nodes/${NODE_NAME}/${NODE_VERSION}"
    
    # Check if already exists in Scaleway
    if bash "$SCRIPT_DIR/check-scaleway-folder.sh" "$REMOTE_NODE_PATH" "$SCW_BUCKET_NAME" "$SCW_REGION" "$SCW_ACCESS_KEY" "$SCW_SECRET_KEY" 2>/dev/null | grep -q "."; then
        if [ "$OVERWRITE" = false ]; then
            echo "✅ Custom node already exists in Scaleway: $REMOTE_NODE_PATH"
            echo "   Use --overwrite to re-download and archive old version"
            echo ""
            SKIPPED=$((SKIPPED + 1))
            continue
        else
            echo "📦 Custom node exists in Scaleway, will archive before overwriting..."
            
            # Archive existing version with timestamp
            TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
            ARCHIVE_PATH="custom-nodes/${NODE_NAME}/${NODE_VERSION}.archive_${TIMESTAMP}"
            
            echo "   📥 Downloading existing files for archival..."
            TEMP_ARCHIVE=$(mktemp -d)
            
            aws s3 sync "s3://$SCW_BUCKET_NAME/$REMOTE_NODE_PATH/" "$TEMP_ARCHIVE/" \
                --endpoint-url "$AWS_ENDPOINT_URL" \
                --quiet 2>/dev/null || true
            
            if [ -n "$(ls -A "$TEMP_ARCHIVE" 2>/dev/null)" ]; then
                echo "   📤 Uploading to archive: $ARCHIVE_PATH"
                aws s3 sync "$TEMP_ARCHIVE/" "s3://$SCW_BUCKET_NAME/$ARCHIVE_PATH/" \
                    --endpoint-url "$AWS_ENDPOINT_URL" \
                    --quiet
                echo "   ✅ Archive created: $ARCHIVE_PATH"
            fi
            
            rm -rf "$TEMP_ARCHIVE"
            echo ""
        fi
    fi
    
    # Install custom node using comfy-cli
    echo "   🔧 Installing custom node: $NODE_NAME..."
    
    cd "$COMFY_WORKSPACE"
    INSTALL_OUTPUT=$(comfy node install "$NODE_NAME" 2>&1)
    INSTALL_EXIT_CODE=$?
    
    # Display the output for debugging
    echo "$INSTALL_OUTPUT"
    
    # Check if installation was successful
    if [ $INSTALL_EXIT_CODE -eq 0 ]; then
        echo "   ✅ Custom node installed successfully"
    else
        echo "   ⚠️  Installation failed with exit code: $INSTALL_EXIT_CODE"
        echo "$INSTALL_OUTPUT" | grep -iE "(error|failed|exception)" | head -3 | sed 's/^/      /'
        
        # Continue anyway as some nodes may report errors but still install
    fi
    
    # Find the installed node directory
    NODE_DIR=$(find "$COMFY_WORKSPACE/custom_nodes" -maxdepth 1 -type d -iname "*${NODE_NAME}*" | head -1)
    
    if [ -z "$NODE_DIR" ]; then
        echo "   ❌ Failed to find installed node directory"
        echo ""
        FAILED=$((FAILED + 1))
        continue
    fi
    
    echo "   📂 Found node at: $NODE_DIR"
    
    # Clone git submodules manually if .gitmodules exists
    # (comfy-cli removes .git so we can't use git submodule command)
    if [ -f "$NODE_DIR/.gitmodules" ]; then
        echo "   🔧 Cloning git submodules..."
        
        # Parse .gitmodules to extract submodule paths and URLs
        while IFS= read -r line; do
            if [[ "$line" =~ path[[:space:]]*=[[:space:]]*(.+) ]]; then
                SUBMODULE_PATH="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ url[[:space:]]*=[[:space:]]*(.+) ]]; then
                SUBMODULE_URL="${BASH_REMATCH[1]}"
                
                # Clone the submodule
                if [ -n "$SUBMODULE_PATH" ] && [ -n "$SUBMODULE_URL" ]; then
                    target_dir="$NODE_DIR/$SUBMODULE_PATH"
                    if [ ! -d "$target_dir" ] || [ -z "$(ls -A "$target_dir")" ]; then
                        echo "      📥 Cloning submodule: $SUBMODULE_PATH"
                        if git clone --depth 1 "$SUBMODULE_URL" "$target_dir" > /dev/null 2>&1; then
                            # Remove .git to keep it lightweight
                            rm -rf "$target_dir/.git"
                            echo "      ✅ Submodule cloned: $SUBMODULE_PATH"
                        else
                            echo "      ⚠️  Failed to clone submodule: $SUBMODULE_PATH"
                        fi
                    fi
                    SUBMODULE_PATH=""
                    SUBMODULE_URL=""
                fi
            fi
        done < "$NODE_DIR/.gitmodules"
        
        echo "   ✅ Git submodules processed"
    fi
    
    # Upload to Scaleway
    echo "   📤 Uploading to Scaleway: $REMOTE_NODE_PATH"
    
    # Upload directly from the node directory
    aws s3 sync "$NODE_DIR/" "s3://$SCW_BUCKET_NAME/$REMOTE_NODE_PATH/" \
        --endpoint-url "$AWS_ENDPOINT_URL" \
        --quiet
    
    # Get upload size
    NODE_SIZE=$(du -sh "$NODE_DIR" | cut -f1)
    echo "   ✅ Uploaded to Scaleway ($NODE_SIZE)"
    
    PROCESSED=$((PROCESSED + 1))
    
    echo ""
done

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total custom nodes: $CUSTOM_NODES_COUNT"
echo "  ✅ Processed: $PROCESSED"
echo "  ⏭️  Skipped: $SKIPPED"
echo "  ❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✅ All custom nodes processed successfully!"
else
    echo "⚠️  Some custom nodes failed to process"
fi

echo ""
echo "📍 Custom nodes uploaded to: s3://$SCW_BUCKET_NAME/custom-nodes/"
echo ""

fi  # End of custom nodes processing (Step 3)

# ============================================================================
# Step 4: Upload ComfyUI version to workflow
# ============================================================================
echo "📤 Step 4: Uploading ComfyUI version info to workflow..."
TEMP_VERSION_FILE=$(mktemp)
echo "$COMFYUI_VERSION" > "$TEMP_VERSION_FILE"

if bash "$SCRIPT_DIR/upload-to-scaleway.sh" \
    "$TEMP_VERSION_FILE" \
    "workflows/${WORKFLOW_FOLDER}/.comfy_version" \
    "$SCW_BUCKET_NAME" "$SCW_REGION" "$SCW_ACCESS_KEY" "$SCW_SECRET_KEY" 2>&1 | grep -q "Successfully uploaded"; then
    echo "   ✅ ComfyUI version saved: $COMFYUI_VERSION"
fi

rm -f "$TEMP_VERSION_FILE"
echo ""

# ============================================================================
# Step 5: Check required models availability in Scaleway
# ============================================================================
echo "🔍 Step 5: Checking required models in Scaleway bucket..."

# Extract models from wf-scan-result.json
MODELS_JSON=$(jq -r '.models' "$TEMP_SCAN_RESULT")

# Define model categories (matching ComfyUI structure)
MODEL_CATEGORIES=("checkpoints" "clip" "clip_vision" "controlnet" "diffusion_models" "embeddings" "loras" "text_encoders" "unet" "upscale_models" "vae" "vae_approx" "style_models")

TOTAL_MODELS=0
MISSING_MODELS=0
FOUND_MODELS=0

echo "📋 Required models by category:"
echo ""

for CATEGORY in "${MODEL_CATEGORIES[@]}"; do
    # Get models for this category
    CATEGORY_MODELS=$(echo "$MODELS_JSON" | jq -r ".[\"$CATEGORY\"] // [] | .[]" 2>/dev/null)
    
    if [ -z "$CATEGORY_MODELS" ]; then
        continue
    fi
    
    # Count models in this category
    CATEGORY_COUNT=$(echo "$CATEGORY_MODELS" | wc -l | tr -d ' ')
    
    if [ "$CATEGORY_COUNT" -gt 0 ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📁 Category: $CATEGORY ($CATEGORY_COUNT model(s))"
        echo ""
        
        # Check each model
        while IFS= read -r MODEL_NAME; do
            if [ -z "$MODEL_NAME" ]; then
                continue
            fi
            
            TOTAL_MODELS=$((TOTAL_MODELS + 1))
            
            # Check if model exists in Scaleway
            REMOTE_MODEL_PATH="models/${CATEGORY}/${MODEL_NAME}"
            
            # Try to check if file exists
            if aws s3 ls "s3://$SCW_BUCKET_NAME/$REMOTE_MODEL_PATH" --endpoint-url "$AWS_ENDPOINT_URL" 2>/dev/null | grep -q "$MODEL_NAME"; then
                echo "   ✅ $MODEL_NAME"
                FOUND_MODELS=$((FOUND_MODELS + 1))
            else
                echo "   ❌ $MODEL_NAME (MISSING)"
                MISSING_MODELS=$((MISSING_MODELS + 1))
            fi
        done <<< "$CATEGORY_MODELS"
        
        echo ""
    fi
done

# Summary of model availability
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Models Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total models required: $TOTAL_MODELS"
echo "  ✅ Available in bucket: $FOUND_MODELS"
echo "  ❌ Missing in bucket: $MISSING_MODELS"
echo ""

if [ $MISSING_MODELS -gt 0 ]; then
    echo "⚠️  Some models are missing in the Scaleway bucket!"
    echo ""
    echo "💡 Please upload the missing models to:"
    echo "   s3://$SCW_BUCKET_NAME/models/{category}/{model_name}"
    echo ""
    echo "   Example commands:"
    echo "   aws s3 cp flux1-dev.safetensors s3://$SCW_BUCKET_NAME/models/diffusion_models/ --endpoint-url $AWS_ENDPOINT_URL"
    echo ""
else
    echo "✅ All required models are available in the bucket!"
    echo ""
fi

# Cleanup temp files
rm -f "$TEMP_SCAN_RESULT"

echo "� Next steps:"
echo "   1. Upload missing models to Scaleway (if any)"
echo "   2. Use wf-resource-installer.sh to install resources for an instance"
