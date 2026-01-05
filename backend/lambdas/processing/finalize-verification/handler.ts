import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { KMSClient, EncryptCommand } from '@aws-sdk/client-kms';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const KMS_KEY_ID = process.env.KMS_KEY_ID!;

interface FinalizeInput {
  sessionId: string;
  decision: 'PASS' | 'FAIL' | 'REVIEW';
  reason: string;
  scores: {
    similarity: number;
    ocrConfidence: number;
    livenessConfidence: number;
  };
  extractedData: {
    documentType?: { value: string; confidence: number };
    documentNumber?: { value: string; confidence: number };
    firstName?: { value: string; confidence: number };
    lastName?: { value: string; confidence: number };
    fullName?: { value: string; confidence: number };
    dateOfBirth?: { value: string; confidence: number };
    expiryDate?: { value: string; confidence: number };
    issuingCountry?: { value: string; confidence: number };
  };
  qualityIssues: string[];
}

interface FinalizeOutput {
  sessionId: string;
  decision: 'PASS' | 'FAIL' | 'REVIEW';
  reason: string;
  completedAt: string;
}

export const handler = async (event: FinalizeInput): Promise<FinalizeOutput> => {
  const { sessionId, decision, reason, scores, extractedData, qualityIssues } = event;

  console.log(`Finalizing verification for session: ${sessionId} with decision: ${decision}`);

  try {
    const completedAt = new Date().toISOString();

    // Encrypt PII before storing
    const encryptedPII = await encryptPII({
      documentNumber: extractedData.documentNumber?.value,
      firstName: extractedData.firstName?.value,
      lastName: extractedData.lastName?.value,
      fullName: extractedData.fullName?.value,
      dateOfBirth: extractedData.dateOfBirth?.value,
    });

    // Update session with final results
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: `
          SET #status = :status,
              decision = :decision,
              decisionReason = :reason,
              scores = :scores,
              extractedData = :extractedData,
              encryptedPII = :encryptedPII,
              qualityIssues = :qualityIssues,
              completedAt = :completedAt,
              updatedAt = :updatedAt
        `,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': decision === 'REVIEW' ? 'pending_review' : 'completed',
          ':decision': decision,
          ':reason': reason,
          ':scores': scores,
          ':extractedData': {
            documentType: extractedData.documentType?.value,
            expiryDate: extractedData.expiryDate?.value,
            issuingCountry: extractedData.issuingCountry?.value,
            // Non-PII fields stored in plain text
          },
          ':encryptedPII': encryptedPII,
          ':qualityIssues': qualityIssues,
          ':completedAt': completedAt,
          ':updatedAt': completedAt,
        },
      })
    );

    return {
      sessionId,
      decision,
      reason,
      completedAt,
    };
  } catch (error) {
    console.error('Error finalizing verification:', error);
    throw error;
  }
};

async function encryptPII(pii: Record<string, string | undefined>): Promise<string> {
  // Filter out undefined values
  const filteredPII: Record<string, string> = {};
  for (const [key, value] of Object.entries(pii)) {
    if (value !== undefined) {
      filteredPII[key] = value;
    }
  }

  const plaintext = JSON.stringify(filteredPII);

  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext),
    EncryptionContext: {
      purpose: 'pii-storage',
    },
  });

  const result = await kmsClient.send(command);

  if (!result.CiphertextBlob) {
    throw new Error('Failed to encrypt PII');
  }

  return Buffer.from(result.CiphertextBlob).toString('base64');
}
