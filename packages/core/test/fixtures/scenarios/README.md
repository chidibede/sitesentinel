# Scenario Test Images

This directory contains test images for different hazard detection scenarios.

## Available Scenarios

1. **site.jpg** - US Navy construction site (Public Domain)
   - Workers on steel scaffolding
   - Tests: Fall protection, PPE compliance

2. **missing-hardhat.jpg** - Worker without head protection
   - Tests: OSHA 1926.100 head protection requirement

3. **blocked-exit.jpg** - Obstructed emergency exit
   - Tests: OSHA 1926.34 means of egress

4. **spill-leak.jpg** - Industrial leak/spill
   - Tests: Oil & Gas spill control requirements

## Usage

Run inspection with:
```bash
pnpm inspect packages/core/test/fixtures/scenarios/site.jpg construction
```

See SOURCES.md for license information and download instructions.
