# ID Verification System

Bank-grade identity verification system built on AWS with real-time auto-decision and human review fallback.

## Architecture

- **Frontend**: React + TypeScript (deployed to CloudFront)
- **Backend**: AWS Lambda + API Gateway (serverless)
- **Region**: ca-central-1 (Canada Central)

## Core AWS Services

- Amazon Textract (ID OCR)
- AWS Rekognition Face Liveness
- AWS Rekognition CompareFaces
- AWS Step Functions (workflow orchestration)
- Amazon DynamoDB (data storage)
- Amazon S3 (encrypted document storage)
- Amazon Cognito (reviewer authentication)
- Amazon SQS (review queue)

## Decision Logic

| Check | PASS | REVIEW | FAIL |
|-------|------|--------|------|
| Face Similarity | >= 90% | 70-89% | < 70% |
| OCR Confidence | >= 85% | 70-84% | < 70% |
| Liveness | Pass | - | Fail |
| Document Expiry | Valid | - | Expired |

## Project Structure

```
IDVerification/
├── infrastructure/cdk/     # AWS CDK infrastructure
├── backend/
│   ├── shared/             # Shared types, utils, clients
│   ├── lambdas/            # Lambda functions
│   └── step-functions/     # State machine definitions
├── frontend/               # React application
└── tests/                  # Test suites
```

## Getting Started

### Prerequisites

- Node.js >= 18
- AWS CLI configured
- AWS CDK CLI installed

### Installation

```bash
npm install
```

### Deploy Infrastructure

```bash
cd infrastructure/cdk
npm run deploy:dev
```

### Run Frontend Locally

```bash
cd frontend
npm run dev
```

## Configuration

| Setting | Value |
|---------|-------|
| AWS Region | ca-central-1 |
| Max Attempts | 3 |
| Review SLA | 24 hours |
| Image Retention | 30 days |

## License

ISC
