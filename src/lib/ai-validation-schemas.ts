import { SchemaDefinition } from './ai-validation'

// Common schema definitions for matchmaking AI specialists

/**
 * Schema for analyzing user responses to questions
 */
export const responseAnalysisSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    answered: {
      type: 'boolean',
      description: 'Whether the user meaningfully answered the question',
    },
    reason: {
      type: 'string',
      optional: true,
      description: 'Brief explanation if the answer was rejected',
    },
    profileUpdates: {
      type: 'object',
      optional: true,
      properties: {
        physicalPreferences: {
          type: 'object',
          optional: true,
          properties: {
            height: { type: 'string', optional: true },
            build: { type: 'string', optional: true },
            ethnicity: { type: 'string', optional: true },
            style: { type: 'string', optional: true },
            attractionTags: {
              type: 'array',
              optional: true,
              items: { type: 'string' },
            },
          },
        },
        personality: {
          type: 'object',
          optional: true,
          properties: {
            seekingTraits: {
              type: 'array',
              optional: true,
              items: { type: 'string' },
            },
            energyLevel: {
              type: 'string',
              optional: true,
              enum: ['high', 'medium', 'low'],
            },
            dominanceStyle: {
              type: 'string',
              optional: true,
              enum: ['dominant', 'submissive', 'switch', 'vanilla'],
            },
          },
        },
        interests: {
          type: 'object',
          optional: true,
          properties: {
            categories: {
              type: 'array',
              optional: true,
              items: { type: 'string' },
            },
            specificItems: {
              type: 'array',
              optional: true,
              items: { type: 'string' },
            },
          },
        },
        preferences: {
          type: 'object',
          optional: true,
          properties: {
            moodSeeking: {
              type: 'string',
              optional: true,
              enum: [
                'energetic',
                'calm',
                'flirty',
                'romantic',
                'playful',
                'professional',
              ],
            },
            conversationTopics: {
              type: 'array',
              optional: true,
              items: { type: 'string' },
            },
            serviceTypes: {
              type: 'array',
              optional: true,
              items: { type: 'string' },
            },
            interactionStyle: {
              type: 'string',
              optional: true,
              enum: [
                'casual',
                'intimate',
                'professional',
                'playful',
                'romantic',
              ],
            },
          },
        },
        demographics: {
          type: 'object',
          optional: true,
          properties: {
            agePreference: {
              type: 'string',
              optional: true,
            },
            experienceLevel: {
              type: 'string',
              optional: true,
              enum: ['beginner', 'intermediate', 'experienced', 'expert'],
            },
          },
        },
      },
    },
  },
}

/**
 * Schema for personality analysis results
 */
export const personalityAnalysisSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    personalityType: {
      type: 'string',
      description: 'The identified personality category',
    },
    confidence: {
      type: 'number',
      description: 'Confidence score between 0 and 1',
    },
    traits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number' },
          reasoning: { type: 'string', optional: true },
        },
      },
    },
    summary: {
      type: 'string',
      description: 'Brief personality summary',
    },
  },
}

/**
 * Schema for kokology question analysis
 */
export const kokologyAnalysisSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          trait: { type: 'string' },
          strength: { type: 'number' },
          evidence: { type: 'string' },
        },
      },
    },
    overallAssessment: {
      type: 'string',
      description: 'Overall personality assessment',
    },
    recommendations: {
      type: 'array',
      optional: true,
      items: { type: 'string' },
    },
  },
}

/**
 * Schema for match recommendations
 */
export const matchRecommendationSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hostId: { type: 'string' },
          matchScore: { type: 'number' },
          reasoning: { type: 'string' },
          highlights: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    searchQuery: {
      type: 'string',
      description: 'Generated search query for finding matches',
    },
    confidence: {
      type: 'number',
      description: 'Confidence in recommendations',
    },
  },
}

/**
 * Schema for conversation flow decisions
 */
export const conversationFlowSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    action: {
      type: 'string',
      enum: [
        'continue_questions',
        'ask_clarification',
        'provide_recommendations',
        'end_session',
      ],
    },
    nextQuestion: {
      type: 'string',
      optional: true,
      description: 'Next question to ask if continuing',
    },
    response: {
      type: 'string',
      description: 'Response to give to the user',
    },
    reasoning: {
      type: 'string',
      optional: true,
      description: 'Why this action was chosen',
    },
  },
}

/**
 * Schema for simple yes/no decisions with reasoning
 */
export const decisionSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    decision: {
      type: 'boolean',
      description: 'The decision made',
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the decision (0-1)',
    },
    reasoning: {
      type: 'string',
      description: 'Explanation for the decision',
    },
  },
}

/**
 * Schema for text classification tasks
 */
export const classificationSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    category: {
      type: 'string',
      description: 'The identified category',
    },
    subcategory: {
      type: 'string',
      optional: true,
      description: 'More specific subcategory if applicable',
    },
    confidence: {
      type: 'number',
      description: 'Confidence score (0-1)',
    },
    features: {
      type: 'array',
      optional: true,
      items: { type: 'string' },
      description: 'Key features that led to this classification',
    },
  },
}

/**
 * Schema for extracting structured data from free text
 */
export const extractionSchema: SchemaDefinition = {
  type: 'object',
  strict: true,
  properties: {
    extractedData: {
      type: 'object',
      description: 'The structured data extracted from the text',
    },
    confidence: {
      type: 'number',
      description: 'Overall confidence in the extraction',
    },
    ambiguities: {
      type: 'array',
      optional: true,
      items: { type: 'string' },
      description: 'Any ambiguous or uncertain parts',
    },
  },
}
