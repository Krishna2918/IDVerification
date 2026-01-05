import { RekognitionClient, CompareFacesCommand, CompareFacesCommandOutput } from '@aws-sdk/client-rekognition';

const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION });

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET!;

interface CompareInput {
  sessionId: string;
  documentFrontKey: string;
  livenessReferenceKey: string;
}

interface CompareOutput {
  sessionId: string;
  similarityScore: number;
  faceMatchFound: boolean;
  sourceConfidence: number;
  targetConfidence: number;
  qualityIssues: string[];
}

export const handler = async (event: CompareInput): Promise<CompareOutput> => {
  const { sessionId, documentFrontKey, livenessReferenceKey } = event;

  console.log(`Comparing faces for session: ${sessionId}`);

  try {
    // Call Rekognition CompareFaces
    const command = new CompareFacesCommand({
      SourceImage: {
        S3Object: {
          Bucket: BUCKET_NAME,
          Name: documentFrontKey,
        },
      },
      TargetImage: {
        S3Object: {
          Bucket: BUCKET_NAME,
          Name: livenessReferenceKey,
        },
      },
      SimilarityThreshold: 0, // Get all results, we'll apply thresholds in decision engine
      QualityFilter: 'AUTO',
    });

    const result: CompareFacesCommandOutput = await rekognitionClient.send(command);

    // Process results
    const faceMatches = result.FaceMatches || [];
    const unmatchedFaces = result.UnmatchedFaces || [];
    const sourceImageFace = result.SourceImageFace;

    // Find the best match
    let bestMatch = faceMatches.length > 0 ? faceMatches[0] : null;
    for (const match of faceMatches) {
      if ((match.Similarity || 0) > (bestMatch?.Similarity || 0)) {
        bestMatch = match;
      }
    }

    const similarityScore = bestMatch?.Similarity || 0;
    const faceMatchFound = faceMatches.length > 0;
    const sourceConfidence = sourceImageFace?.Confidence || 0;
    const targetConfidence = bestMatch?.Face?.Confidence || 0;

    // Identify quality issues
    const qualityIssues: string[] = [];

    if (!faceMatchFound && unmatchedFaces.length > 0) {
      qualityIssues.push('Face detected but no match found');
    }

    if (!faceMatchFound && unmatchedFaces.length === 0) {
      qualityIssues.push('No face detected in target image');
    }

    if (sourceConfidence < 90) {
      qualityIssues.push(`Low face detection confidence in ID: ${sourceConfidence.toFixed(1)}%`);
    }

    if (targetConfidence < 90) {
      qualityIssues.push(`Low face detection confidence in selfie: ${targetConfidence.toFixed(1)}%`);
    }

    // Check for face quality issues from source
    const sourceQuality = sourceImageFace?.Quality;
    if (sourceQuality) {
      if ((sourceQuality.Brightness || 0) < 30) {
        qualityIssues.push('ID photo is too dark');
      }
      if ((sourceQuality.Sharpness || 0) < 30) {
        qualityIssues.push('ID photo is blurry');
      }
    }

    return {
      sessionId,
      similarityScore,
      faceMatchFound,
      sourceConfidence,
      targetConfidence,
      qualityIssues,
    };
  } catch (error: any) {
    console.error('Error comparing faces:', error);

    // Handle specific Rekognition errors
    if (error.name === 'InvalidParameterException') {
      if (error.message.includes('no faces')) {
        return {
          sessionId,
          similarityScore: 0,
          faceMatchFound: false,
          sourceConfidence: 0,
          targetConfidence: 0,
          qualityIssues: ['No face detected in one or both images'],
        };
      }
    }

    throw error;
  }
};
