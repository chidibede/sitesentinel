# SiteSentinel

**AI-Powered Safety Inspector for High-Risk Worksites**

SiteSentinel is an agentic safety monitoring system for construction sites, oil and gas facilities, and factories. Workers stream live video from Meta Ray-Ban glasses or phones; the system detects PPE violations and hazards in real-time using SAM 3.1 and Muse Spark, alerts via voice, assigns corrective actions, and verifies fixes through photo confirmation.

Built during the [Meta Global AI Developer Hackathon](https://ai.meta.com/events/), Oct 27 – Nov 4, 2026.

## Architecture

```
Worker Devices (Meta Ray-Ban / Phone)
          ↓
   [Video Stream via Meta Wearables Device Access Toolkit]
          ↓
      API Gateway + Lambda
          ↓
    ┌─────────────────┐
    │  Detection Loop │
    │  - SAM 3.1      │  ← Segment people/PPE/hazards
    │  - Muse Spark   │  ← Reason against safety manual
    │  - Rule Engine  │  ← Company-specific policies
    └─────────────────┘
          ↓
    ┌─────────────────┐
    │  Agent Actions  │
    │  - Voice Alert  │  ← Muse Voice Transcribe
    │  - Assign Fix   │
    │  - Verify Photo │
    │  - Close Issue  │
    └─────────────────┘
          ↓
      Dashboard
```

**Models:**
- **SAM 3.1** (Segment Anything Model): Detects and segments people, PPE, and hazards
- **Muse Spark** (Meta Model API): Agentic reasoning against safety manuals
- **Muse Voice Transcribe**: Spoken safety reports and alerts
- **Muse Spark Open** (Baseten): Offline/open-weights path for on-premise deployments

## Project Structure

```
sitesentinel/
├── packages/
│   └── core/              # Shared logic and model clients
│       ├── src/
│       │   └── models/    # Provider abstractions
│       │       ├── baseten.ts         # Muse Spark Open (Baseten)
│       │       ├── meta-model-api.ts  # SAM 3.1, Muse Spark, Voice
│       │       └── types.ts
│       ├── scripts/
│       │   └── smoke-test.ts          # Hazard detection smoke test
│       └── test/
│           ├── fixtures/              # Test images
│           └── baseten.test.ts
├── infra/                 # SST infrastructure
│   ├── api.ts            # Lambda handler
│   └── package.json
├── sst.config.ts         # SST v3 configuration
└── package.json          # Workspace root
```

## Setup

### Prerequisites
- Node.js 18+ and pnpm
- AWS account (for deployment, optional for Day 1)
- Baseten account for Muse Spark Open: https://baseten.co
- Meta Model API key (future): https://dev.meta.ai/

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Add your Baseten API key to .env
# BASETEN_API_KEY=your_key_here
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
```

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

- `BASETEN_API_KEY`: API key for Baseten (Muse Spark Open)
- `META_API_KEY`: Meta Model API key (SAM 3.1, Muse Spark, Voice Transcribe)

**Security Note:** This is a PUBLIC repository for the hackathon. Never commit API keys or secrets. All sensitive values must stay in `.env` (gitignored).

## Deployment (Coming Soon)

```bash
# Deploy to AWS (Day 2+)
pnpm deploy

# Set secrets
sst secret set BasetenApiKey <your-key>
sst secret set MetaApiKey <your-key>
```

## Roadmap

### Day 1 ✅ (Oct 27, 2026)
- [x] SST TypeScript monorepo scaffold
- [x] Model client abstraction (Baseten + Meta Model API)
- [x] Smoke test with Muse Spark Open
- [x] Unit tests with mocked responses
- [x] Build/typecheck/lint passing

### Day 2 (Next Steps)
- [ ] SAM 3.1 integration for PPE/hazard detection
- [ ] Rule engine for safety manual checks
- [ ] Alert system with severity scoring
- [ ] Video frame processing pipeline

### Future
- [ ] Meta Ray-Ban glasses integration
- [ ] Muse Voice Transcribe for spoken alerts
- [ ] Fix verification workflow
- [ ] Dashboard for alert management
- [ ] Company-specific safety manual upload
- [ ] Offline mode with Muse Spark Open on-premise

## Built During the Hackathon

**Event:** Meta Global AI Developer Hackathon  
**Build Window:** October 27 – November 4, 2026  
**Day 1:** October 27, 2026

All code in this repository was written during the hackathon build window. This is an open-source project built for demonstration and educational purposes.

## License

MIT (code written during hackathon)  
Test images: CC0 Public Domain / Pixabay Content License

---

**Note:** This project uses Meta's Model API and Baseten's hosted models. API keys and usage are subject to each platform's terms of service and pricing.
