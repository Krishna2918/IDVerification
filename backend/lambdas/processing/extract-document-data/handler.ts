import { TextractClient, AnalyzeIDCommand, AnalyzeIDCommandOutput } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const textractClient = new TextractClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET!;

interface ExtractInput {
  sessionId: string;
  documentFrontKey: string;
  documentBackKey?: string;
}

interface ExtractedField {
  value: string;
  confidence: number;
}

interface ExtractOutput {
  sessionId: string;
  extractedData: {
    documentType?: ExtractedField;
    documentNumber?: ExtractedField;
    firstName?: ExtractedField;
    lastName?: ExtractedField;
    fullName?: ExtractedField;
    dateOfBirth?: ExtractedField;
    expiryDate?: ExtractedField;
    issueDate?: ExtractedField;
    issuingCountry?: ExtractedField;
    issuingState?: ExtractedField;
    address?: ExtractedField;
  };
  averageConfidence: number;
  isExpired: boolean;
  missingRequiredFields: string[];
  qualityIssues: string[];
}

export const handler = async (event: ExtractInput): Promise<ExtractOutput> => {
  const { sessionId, documentFrontKey, documentBackKey } = event;

  console.log(`Extracting data for session: ${sessionId}`);

  try {
    // Analyze front of document
    const frontResult = await analyzeDocument(documentFrontKey);

    // Analyze back if provided
    let backResult: AnalyzeIDCommandOutput | null = null;
    if (documentBackKey) {
      backResult = await analyzeDocument(documentBackKey);
    }

    // Merge and process results
    const extractedData = processTextractResults(frontResult, backResult);

    // Calculate average confidence
    const confidences = Object.values(extractedData)
      .filter((field): field is ExtractedField => field !== undefined)
      .map(field => field.confidence);
    const averageConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    // Check for expiry
    const isExpired = checkExpiry(extractedData.expiryDate?.value);

    // Check for missing required fields
    const requiredFields = ['documentNumber', 'dateOfBirth', 'expiryDate'];
    const missingRequiredFields = requiredFields.filter(
      field => !extractedData[field as keyof typeof extractedData]?.value
    );

    // Identify quality issues
    const qualityIssues: string[] = [];
    if (averageConfidence < 70) {
      qualityIssues.push('Low overall OCR confidence - document may be blurry or have glare');
    }

    Object.entries(extractedData).forEach(([field, data]) => {
      if (data && data.confidence < 70) {
        qualityIssues.push(`Low confidence for ${field}: ${data.confidence.toFixed(1)}%`);
      }
    });

    return {
      sessionId,
      extractedData,
      averageConfidence,
      isExpired,
      missingRequiredFields,
      qualityIssues,
    };
  } catch (error) {
    console.error('Error extracting document data:', error);
    throw error;
  }
};

async function analyzeDocument(s3Key: string): Promise<AnalyzeIDCommandOutput> {
  const command = new AnalyzeIDCommand({
    DocumentPages: [
      {
        S3Object: {
          Bucket: BUCKET_NAME,
          Name: s3Key,
        },
      },
    ],
  });

  return textractClient.send(command);
}

function processTextractResults(
  frontResult: AnalyzeIDCommandOutput,
  backResult: AnalyzeIDCommandOutput | null
): ExtractOutput['extractedData'] {
  const extractedData: ExtractOutput['extractedData'] = {};

  // Process identity documents from front
  const identityDocuments = frontResult.IdentityDocuments || [];

  for (const doc of identityDocuments) {
    const fields = doc.IdentityDocumentFields || [];

    for (const field of fields) {
      const fieldType = field.Type?.Text;
      const value = field.ValueDetection?.Text;
      const confidence = field.ValueDetection?.Confidence || 0;

      if (!fieldType || !value) continue;

      const mappedField = mapFieldType(fieldType);
      if (mappedField) {
        extractedData[mappedField] = { value, confidence };
      }
    }
  }

  // Process back if available
  if (backResult) {
    const backDocuments = backResult.IdentityDocuments || [];
    for (const doc of backDocuments) {
      const fields = doc.IdentityDocumentFields || [];

      for (const field of fields) {
        const fieldType = field.Type?.Text;
        const value = field.ValueDetection?.Text;
        const confidence = field.ValueDetection?.Confidence || 0;

        if (!fieldType || !value) continue;

        const mappedField = mapFieldType(fieldType);
        // Only add if not already present from front with higher confidence
        if (mappedField && (!extractedData[mappedField] || extractedData[mappedField]!.confidence < confidence)) {
          extractedData[mappedField] = { value, confidence };
        }
      }
    }
  }

  return extractedData;
}

function mapFieldType(textractField: string): keyof ExtractOutput['extractedData'] | null {
  const mapping: Record<string, keyof ExtractOutput['extractedData']> = {
    'DOCUMENT_NUMBER': 'documentNumber',
    'ID_TYPE': 'documentType',
    'FIRST_NAME': 'firstName',
    'LAST_NAME': 'lastName',
    'DATE_OF_BIRTH': 'dateOfBirth',
    'EXPIRATION_DATE': 'expiryDate',
    'DATE_OF_ISSUE': 'issueDate',
    'COUNTRY': 'issuingCountry',
    'STATE_NAME': 'issuingState',
    'ADDRESS': 'address',
  };

  return mapping[textractField] || null;
}

function checkExpiry(expiryDateStr?: string): boolean {
  if (!expiryDateStr) return false;

  try {
    // Parse various date formats
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  } catch {
    return false;
  }
}
