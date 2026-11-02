# SiteSentinel

**AI-Powered Safety Inspector for High-Risk Worksites**

SiteSentinel is an agentic safety monitoring system for construction sites, oil and gas facilities, and factories. Workers stream live video from Meta Ray-Ban glasses or phones; the system detects PPE violations and hazards in real-time using SAM 3.1 and Muse Spark, alerts via voice, assigns corrective actions, and verifies fixes through photo confirmation.

Built during the [Meta Global AI Developer Hackathon](https://ai.meta.com/events/), Oct 27 – Nov 4, 2026.

## Architecture

```mermaid
graph TB
    subgraph "Worker Devices"
        A[Meta Ray-Ban Glasses]
        B[Mobile Phone Camera]
    end
    
    subgraph "Meta Wearables"
        C[Device Access Toolkit]
        D[Mock Device Kit]
    end
    
    subgraph "Frontend"
        E[Web App - Glasses View HUD]
        F[Web App - Dashboard]
    end
    
    subgraph "AWS Lambda API"
        G[POST /inspect]
        H[GET /issues]
        I[POST /issues/:id/verify]
        J[POST /reports/voice]
    end
    
    subgraph "Agent Loop"
        K1[1. Detect SAM 3.1]
        K2[2. Assess Risk 5x5 L×I]
        K3[3. Create Issue]
        K4[4. Assign Owner]
        K5[5. Notify Voice]
        K6[6. Verify Fix]
        K1 --> K2 --> K3 --> K4 --> K5 --> K6
    end
    
    subgraph "Meta AI Models"
        L[SAM 3.1 Segmentation]
        M[Muse Spark 1.3 Reasoning]
        N[Muse Voice Transcribe]
    end
    
    subgraph "Storage"
        O[DynamoDB Issues]
        P[S3 Images/Overlays]
    end
    
    A --> C --> G
    B --> E --> G
    D --> G
    
    G --> K1
    K1 --> L
    K1 --> M
    K2 --> M
    K3 --> O
    K5 --> N
    K6 --> L
    K6 --> M
    
    G --> P
    I --> P
    
    H --> F
    E --> I
    E --> J
    J --> N
    
    style K1 fill:#e3f2fd
    style K2 fill:#e3f2fd
    style K3 fill:#e3f2fd
    style K4 fill:#e3f2fd
    style K5 fill:#e3f2fd
    style K6 fill:#e3f2fd
    style L fill:#fff3e0
    style M fill:#fff3e0
    style N fill:#fff3e0
```

**Meta AI Tools Used:**
- **SAM 3.1** (Segment Anything Model): Detects and segments people, PPE, and hazards
- **Muse Spark 1.3** (Meta Model API): Agentic reasoning against safety manuals
- **Muse Voice Transcribe 1.0**: Spoken safety reports and alerts
- **Muse Spark Open** (via Baseten): Offline/open-weights path for on-premise deployments
- **Meta Wearables Device Access Toolkit**: Ray-Ban glasses camera stream integration

## Project Structure

```
sitesentinel/
├── packages/
│   ├── core/              # Shared logic and model clients
│   │   ├── src/
│   │   │   ├── agent/     # Agent loop workflow
│   │   │   │   ├── agent-loop.ts      # Multi-step agentic workflow
│   │   │   │   ├── issue-manager.ts   # Issue tracking & assignment
│   │   │   │   └── voice-services.ts  # Alert generation + TTS
│   │   │   ├── models/    # Provider abstractions
│   │   │   │   ├── baseten.ts         # Muse Spark Open (Baseten)
│   │   │   │   ├── meta-model-api.ts  # SAM 3.1, Muse Spark, Voice
│   │   │   │   └── risk-model.ts      # 5x5 risk matrix + controls
│   │   │   ├── pipeline/  # Hazard detection pipeline
│   │   │   │   ├── hazard-detection-v2.ts  # Risk-aware pipeline
│   │   │   │   └── overlay-renderer.ts     # Image annotation
│   │   │   ├── safety-rules/
│   │   │   │   └── rule-packs-v2.ts   # Risk engineering rules
│   │   │   └── storage/
│   │   │       ├── dynamodb-store.ts  # Issue persistence
│   │   │       └── s3-storage.ts      # Image/overlay storage
│   │   ├── scripts/
│   │   │   ├── agent-loop.ts  # pnpm loop CLI
│   │   │   ├── inspect.ts     # pnpm inspect CLI
│   │   │   └── smoke-test.ts  # Smoke test
│   │   └── test/          # 42 passing tests
│   │       ├── fixtures/
│   │       │   ├── api-responses/
│   │       │   └── scenarios/
│   │       ├── agent-loop.test.ts
│   │       ├── issue-manager.test.ts
│   │       ├── risk-model.test.ts
│   │       └── voice-services.test.ts
│   └── web/               # React + Vite frontend
│       ├── src/
│       │   ├── pages/
│       │   │   ├── GlassesView.tsx   # HUD camera interface
│       │   │   └── Dashboard.tsx     # Issue tracking dashboard
│       │   ├── api.ts     # API client
│       │   ├── types.ts   # TypeScript types
│       │   └── App.tsx    # Main app + routing
│       └── package.json
├── android/               # Kotlin glasses integration
│   ├── app/
│   │   └── src/main/java/com/meta/sitesentinel/
│   │       └── MainActivity.kt       # Wearables SDK integration
│   └── README.md          # Setup and Mock Device Kit guide
├── infra/                 # SST infrastructure
│   ├── api.ts            # Lambda with 4 endpoints
│   └── package.json
├── sst.config.ts         # SST v3 + DynamoDB + S3 + StaticSite
└── package.json          # Workspace root
```

## Setup

### Prerequisites
- Node.js 18+ and pnpm
- AWS account for deployment
- Baseten account for Muse Spark Open: https://baseten.co
- Meta Model API key: https://dev.meta.ai/

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Add your API keys to .env
# BASETEN_API_KEY=your_key_here
# META_API_KEY=your_key_here
```

### Development

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# Smoke test (requires BASETEN_API_KEY and test image)
pnpm smoke

# Run inspection (requires META_API_KEY or BASETEN_API_KEY)
pnpm inspect <image-path> [rule-pack]

# Run agent loop (requires META_API_KEY or BASETEN_API_KEY)
pnpm loop <before.jpg> <after.jpg> [--pack construction] [--zone site-main]

# Start web app locally
pnpm --filter @sitesentinel/web dev
# Visit http://localhost:3000
```

### Agent Loop CLI

The `pnpm loop` command runs the complete agentic workflow end-to-end:

```bash
# Full agent loop: detect → assess → assign → verify
export META_API_KEY="your-key"
pnpm loop before-site.jpg after-site.jpg --pack construction --zone roof-access

# Use Baseten fallback (Spark only, no SAM)
export BASETEN_API_KEY="your-key"
pnpm loop before.jpg after.jpg --provider baseten
```

**Agent Loop Steps:**
1. **Detect**: SAM 3.1 segments hazards in "before" image
2. **Assess Risk**: 5x5 Likelihood × Impact matrix, hierarchy of controls
3. **Create Issue**: Persist to DynamoDB with full audit trail
4. **Assign Owner**: Site roster matching by role/zone
5. **Notify**: Generate voice alert text
6. **Verify Fix**: Re-evaluate "after" image, close or reopen issue

**Output:**
- Console summary with resolved/unresolved counts
- Detailed audit trail for each issue (timestamps, actions, actors)
- Verification results with reasons

### Inspection CLI

The `pnpm inspect` command runs the full hazard detection pipeline:

```bash
# Construction site inspection
export META_API_KEY="your-key"
pnpm inspect packages/core/test/fixtures/scenarios/site.jpg construction

# Oil & gas facility inspection
pnpm inspect refinery.jpg oil-and-gas

# Use Baseten fallback (Spark only, no SAM)
export BASETEN_API_KEY="your-key"
PROVIDER=baseten pnpm inspect site.jpg construction
```

**Output:**
- Console report with findings, severity, and recommended fixes
- JSON results: `<image>-results.json`
- Annotated overlay: `<image>-overlay.png`

### Smoke Test Setup

1. Download a construction site image:
   - Visit https://pixabay.com/photos/construction-site-crane-1391538/
   - Download and save as `packages/core/test/fixtures/construction-site.jpg`
   - See `packages/core/test/fixtures/IMAGE_SOURCE.md` for alternatives

2. Set your Baseten API key:
   ```bash
   export BASETEN_API_KEY="your_key_here"
   ```

3. Run the test:
   ```bash
   pnpm smoke
   ```

The smoke test sends the image to Muse Spark Open and returns a structured JSON list of detected hazards with severity levels.

## Environment Variables

See `.env.example` for all required variables:

- `BASETEN_API_KEY`: API key for Baseten (Muse Spark Open fallback)
- `META_API_KEY`: Meta Model API key (SAM 3.1, Muse Spark 1.3, Voice Transcribe)
- `PROVIDER`: "meta" (default) or "baseten" for reasoning provider selection

**Security Note:** This is a PUBLIC repository for the hackathon. Never commit API keys or secrets. All sensitive values must stay in `.env` (gitignored).

## Deployment

```bash
# Deploy infrastructure to AWS
pnpm deploy

# Set secrets
sst secret set BasetenApiKey <your-key>
sst secret set MetaApiKey <your-key>

# Web app will be deployed to CloudFront
# API will be accessible via Lambda Function URL
```

The deploy command will output:
- `api`: Lambda function URL for the inspection API
- `web`: CloudFront URL for the web app
- `imagesBucket`: S3 bucket name for image/overlay storage

## Roadmap

### Day 1 ✅ (Oct 27, 2026)
- [x] SST TypeScript monorepo scaffold
- [x] Model client abstraction (Baseten + Meta Model API)
- [x] Smoke test with Muse Spark Open
- [x] Unit tests with mocked responses
- [x] Build/typecheck/lint passing

### Day 2 ✅ (Oct 28, 2026)
- [x] Corrected Meta Model API provider (SAM 3.1 + Muse Spark 1.3)
- [x] SAM output parser with real token format
- [x] Hazard detection pipeline
  - Image → SAM detects concepts → Muse analyzes → JSON findings
  - Parallel SAM calls for all safety concepts
  - Evidence merging and rule checking
- [x] Safety rule packs (Construction OSHA 1926, Oil & Gas)
- [x] Overlay renderer (draws labeled boxes with Sharp)
- [x] POST /inspect API endpoint
- [x] CLI: `pnpm inspect <image> [pack]`
- [x] Baseten fallback for Muse Spark reasoning
- [x] Test scenarios with openly licensed images

### Day 3 ✅ (Nov 2, 2026)
- [x] Risk engineering model (8 categories, 5x5 L×I matrix, risk bands)
- [x] Hierarchy of Controls (Eliminate > Substitute > Engineering > Admin > PPE)
- [x] Extended safety rule packs (11+ rules each: corrosion, leaks, fire, electrical, structural)
- [x] Agent loop workflow with 6 explicit steps:
  - Detect → Assess Risk → Create Issue → Assign → Notify → Verify Fix
- [x] Issue management (DynamoDB + in-memory store, full audit trail)
- [x] Site roster with role-based assignment by zone
- [x] Voice alert generation per issue
- [x] Fix verification: re-evaluates after-image with SAM+Spark, decides resolved/not resolved with reason
- [x] API routes: POST /inspect, GET /issues, POST /issues/{id}/verify, POST /reports/voice
- [x] CLI: `pnpm loop <before.jpg> <after.jpg>` runs complete loop end-to-end
- [x] Muse Voice Transcribe integration hook (POST /v1/asr/transcribe)
- [x] 42 unit tests passing (risk model, issue manager, voice, rule packs v2)
- [x] All typecheck and lint checks pass

### Day 4 ✅ (Nov 2, 2026)
- [x] Web app (Vite + React + TypeScript)
  - [x] Glasses View: Mobile HUD with camera, auto-capture, voice alerts, verify mode
  - [x] Dashboard: Issue list, 5x5 risk heatmap, site risk score, audit timelines
  - [x] Browser APIs: getUserMedia, speechSynthesis, MediaRecorder
- [x] S3 image storage with presigned URLs
- [x] CORS-enabled API
- [x] Android glasses integration skeleton
  - [x] Kotlin app with Wearables SDK structure
  - [x] Mock Device Kit setup guide
  - [x] Frame streaming to /inspect endpoint
- [x] Architecture diagram (Mermaid)
- [x] README updated with all Meta tools and hackathon details

### Future
- [ ] Production Meta Ray-Ban glasses integration
- [ ] Real-time video processing with frame buffering
- [ ] Multi-frame analysis and tracking
- [ ] Company-specific safety manual upload
- [ ] Advanced dashboard analytics

## API Endpoints

### POST /inspect
Creates issues from image inspection.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "rulePackId": "construction",
  "zone": "roof-access",
  "siteId": "demo-site",
  "provider": "meta",
  "returnOverlay": false
}
```

**Response:**
```json
{
  "issues": [
    {
      "id": "uuid",
      "title": "Fall Protection Required",
      "category": "Safety/PPE",
      "riskBand": "high",
      "riskScore": 12,
      "assignedTo": "Safety Supervisor",
      "status": "assigned",
      "voiceAlert": "HIGH priority alert. Safety or PPE hazard detected in roof-access. Fall Protection Required. Assigned to Safety Supervisor. Action required immediately."
    }
  ],
  "auditTrail": [...]
}
```

### GET /issues?siteId=...&status=...&zone=...
Lists all issues with optional filters.

### POST /issues/{id}/verify
Verifies fix with after-image.

**Request:**
```json
{
  "afterImage": "data:image/jpeg;base64,...",
  "provider": "meta"
}
```

**Response:**
```json
{
  "issueId": "uuid",
  "resolved": true,
  "reason": "The Safety/PPE hazard \"Fall Protection Required\" is no longer detected...",
  "auditTrail": [...]
}
```

### POST /reports/voice
Transcribes spoken worker report.

**Request:**
```json
{
  "audio": "base64-audio-data",
  "siteId": "demo-site",
  "zone": "warehouse"
}
```

## Built During the Hackathon

**Event:** Meta Global AI Developer Hackathon  
**Build Window:** October 27 – November 4, 2026  
**Submission Deadline:** November 5, 2026 03:00 WAT

**Daily Progress:**
- **Day 1** (Oct 27): Foundation scaffold, model clients, smoke test
- **Day 2** (Oct 28): Hazard detection pipeline, SAM 3.1 + Muse Spark integration
- **Day 3** (Nov 2): Agent loop workflow, risk engineering, DynamoDB persistence
- **Day 4** (Nov 2): Web app (HUD + Dashboard), S3 storage, Android skeleton

All code in this repository was written during the hackathon build window. This is an open-source project built for demonstration and educational purposes.

### Day 4 Highlights

- **Web Application**: Full-stack React + Vite deployment with SST StaticSite
  - **Glasses View (HUD)**: Mobile-first camera interface styled as Meta Ray-Ban POV with:
    - Live camera feed with `getUserMedia` (rear camera)
    - Auto-capture every 10 seconds or manual tap-to-inspect
    - Overlay bounding boxes on detected hazards
    - Browser `speechSynthesis` for spoken top-risk alerts
    - Push-to-talk voice report with `MediaRecorder` → transcription
    - Fix verification mode with before/after comparison
    - "Built for Meta Ray-Ban glasses" notice
  - **Dashboard**: Comprehensive issue tracking with:
    - Issues list with status, owner, risk band, and timestamps
    - 5×5 Likelihood × Impact risk heatmap
    - Site risk score (weighted average of all issues)
    - Risk distribution bar charts (very-high, high, medium, low)
    - Per-issue modal with audit trail timeline and before/after images
- **S3 Image Storage**: All images and overlays stored in S3 with public URLs
- **CORS-Enabled API**: Lambda endpoints support browser requests from web app
- **Android Glasses Integration**: Minimal Kotlin app skeleton with:
  - Meta Wearables Device Access Toolkit structure
  - Camera stream subscription hooks
  - HTTP client for `/inspect` API calls
  - Mock Device Kit setup guide for testing without physical glasses
- **Architecture Diagram**: Mermaid diagram showing full flow from glasses → API → agent loop → storage
- **Meta Tools Documentation**: Complete list of all Meta AI models and SDKs used

### Day 3 Highlights

- **Risk Engineering Framework**: 8 categories, 5x5 likelihood×impact matrix, hierarchy of controls recommendations
- **Extended Rule Packs**: 11+ risk engineering rules for construction and oil & gas (PPE, fire, electrical, structural, process/leak hazards)
- **Agent Loop Workflow**: 6-step autonomous workflow with full audit trail: detect → assess → create → assign → notify → verify
- **Issue Management**: DynamoDB persistence with in-memory fallback, site roster with role-based assignment
- **Voice Services**: Alert text generation per issue + Muse Voice Transcribe hook for spoken worker reports
- **Fix Verification**: Re-evaluates after-images with SAM+Spark, decides resolved/not resolved with reasoning
- **API Routes**: 4 endpoints (inspect, list issues, verify, voice reports)
- **CLI Agent Loop**: `pnpm loop` runs complete before/after workflow end-to-end
- **42 Unit Tests Passing**: Full coverage of risk model, issue management, voice, and agent loop components

### Day 2 Highlights

- **Real Meta Model API Integration**: Corrected provider implementations based on verified API responses
- **SAM 3.1 Parser**: Parses token-string format with boxes and masks (`<0f>objId<|box;...|><|mask;...|>`)
- **Detection Pipeline**: Parallel SAM calls → Evidence merging → Muse Spark analysis → Structured findings
- **Safety Rule Packs**: OSHA 1926 (Construction) and Oil & Gas industry standards
- **Visual Overlay**: Sharp-based renderer draws labeled boxes on images
- **CLI & API**: Both local CLI and Lambda endpoint for inspections
- **14 Unit Tests Passing**: Including real API response fixtures

## License

MIT (code written during hackathon)  
Test images: CC0 Public Domain / Pixabay Content License

---

**Note:** This project uses Meta's Model API and Baseten's hosted models. API keys and usage are subject to each platform's terms of service and pricing.
