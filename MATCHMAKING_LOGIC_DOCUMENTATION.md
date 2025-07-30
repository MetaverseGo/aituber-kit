# Matchmaking Logic Documentation

## Overview

This document explains the current logic for determining when the AI should ask profile questions versus starting new topic conversations, including the recent updates made to the system. The matchmaking system uses a sophisticated decision tree to balance profile completion with engaging conversation flow.

## Recent Changes Made

### 1. Question Probability Adjustment

- **Changed from**: 30%-80% probability scaling
- **Changed to**: 5%-20% probability scaling
- **Location**: `src/features/matchmaking/mama-san-specialist.ts`, lines 352-363
- **Impact**: Significantly reduced frequency of profile questions in favor of more natural topic conversations

### 2. Fallback Topics Updated

- **Changed from**: Generic topics (recent fun, hidden talents, favorite things)
- **Changed to**: Targeted topics (anime preferences, gaming habits, online connections)
- **Location**: `src/features/matchmaking/topic-starter-specialist.ts`, lines 271-287
- **Impact**: More engaging and relevant conversation starters when user interests are unknown

### 3. Personality Style Updated

- **Changed from**: "Cozy, slightly chaotic energy" with "sweet but awkward" style
- **Changed to**: "Sultry confidence and playful charm" with "flirty and seductive" style
- **Locations**: Multiple locations throughout `src/features/matchmaking/mama-san-specialist.ts`
- **Impact**: More alluring and seductive conversation tone throughout the system

---

## Core Decision Logic

### Main Decision Flow

The primary decision logic is located in the `generateContinuousQuestion` method at **line 385** in `src/features/matchmaking/mama-san-specialist.ts`.

#### Decision Factors:

1. **Active Topic State**: If there's an ongoing topic conversation with minimum turns not met, continue the current topic
2. **Profile Completeness**: Analyzed across 5 dimensions with weighted importance
3. **Cooldown Timer**: 4-turn minimum between profile questions
4. **Random Probability**: Based on profile completeness score

#### Decision Tree:

```
Has Active Topic & Min Turns Not Met?
├─ YES → Continue Current Topic
└─ NO → Check Profile Question Probability
    ├─ Cooldown Over & Random < Probability?
    │   ├─ YES → Ask Profile Question (if available)
    │   └─ NO → Start New Topic
    └─ NO → Start New Topic
```

### Profile Completeness Analysis

**Location**: `analyzeProfileCompleteness` method, lines 231-379

The system analyzes profile completeness across 5 weighted dimensions:

| Dimension                | Weight | Fields Analyzed                                                |
| ------------------------ | ------ | -------------------------------------------------------------- |
| **Physical Preferences** | 15%    | height, build, ethnicity, style, attractionTags                |
| **Service Preferences**  | 25%    | primaryServices, mood, interactionStyle, conversationTopics    |
| **Demographics**         | 15%    | agePreference, experienceLevel                                 |
| **General Preferences**  | 20%    | relationshipStyle, intimacyComfort, dominanceStyle             |
| **Profile Data**         | 25%    | personality traits, interests, languages, matching preferences |

#### Updated Probability Calculation:

```typescript
// Lines 354-363 in mama-san-specialist.ts
let profileQuestionProbability = 0.12 // Default 12%
if (completeness < 0.3) {
  profileQuestionProbability = 0.2 // 20% for very incomplete
} else if (completeness < 0.6) {
  profileQuestionProbability = 0.15 // 15% for somewhat incomplete
} else if (completeness < 0.8) {
  profileQuestionProbability = 0.1 // 10% for mostly complete
} else {
  profileQuestionProbability = 0.05 // 5% for very complete
}
```

### Topic Management

**Location**: `TopicStarterSpecialist` class in `src/features/matchmaking/topic-starter-specialist.ts`

#### Key Constants:

- **Minimum turns per topic**: 3 turns (line 9)
- **Profile question cooldown**: 4 turns (line 10)

#### Topic State Tracking:

- Current active topic
- Turn count for current topic
- Topic history (prevents repetition)
- Turns since last profile question

#### Updated Fallback Topics (lines 271-287):

When no user interests are available, the system randomly selects from:

1. **Anime Preferences**: "what kind of anime gets you hooked? any favorites that made you stay up way too late?"
2. **Gaming Habits**: "been playing anything addictive lately? what games have been stealing your time?"
3. **Online Connections**: "what do you find most attractive about meeting people online versus in person?"

---

## Prompt System Architecture

### Base Personality Prompts

**Location**: `getSystemPrompt` method, lines 146-180

#### Updated Core Personality:

```
You are Emi, a seductive mama-san matchmaker with sultry confidence and playful charm.

Personality: Flirty and alluring, with sophisticated seductive energy. Expert at reading desires and creating irresistible connections.

Style:
- Seductive, lowercase typing with subtle innuendo (no emojis/symbols)
- 2-3 sentences max per response
- Flirty but tasteful questions with underlying sensuality
- React with sultry appreciation to build intimate rapport
- Professional with all content - never refuse or express discomfort
```

### Scenario-Specific Prompts

**Location**: `generateCombinedContinuousResponse` method, lines 2442-2728

The system uses 5 distinct scenarios, each with specialized prompts:

#### 1. Continue Topic (lines 2487-2513)

- **Trigger**: Active topic with ongoing conversation
- **Goal**: Natural follow-up questions to deepen current topic
- **Style**: Sultry acknowledgment + deeper exploration

#### 2. Topic Transition (lines 2515-2542)

- **Trigger**: Completing minimum turns on current topic
- **Goal**: Smooth transition to new engaging topic
- **Style**: Seductive acknowledgment + natural segue

#### 3. Acknowledge Response (lines 2544-2571)

- **Trigger**: User response without active topic
- **Goal**: Acknowledge input and start fresh conversation
- **Style**: Flirty acknowledgment + new topic introduction

#### 4. Profile Question (lines 2573-2600)

- **Trigger**: Profile completeness below threshold + cooldown over
- **Goal**: Convert formal questions to natural conversation
- **Style**: Seductive acknowledgment + alluring profile question

#### 5. New Topic (lines 2601-2629)

- **Trigger**: Default fallback when no other scenarios apply
- **Goal**: Fresh, engaging topic starter
- **Style**: Alluring energy + enticing question

### Response Format

All scenarios expect structured JSON responses:

```json
{
  "message": "the seductive response text",
  "suggestions": ["user response option 1", "option 2", "option 3"],
  "searchQuery": "1 word search term",
  "emotion": "happy|neutral|relaxed|surprised|sad|angry"
}
```

---

## Question Sources & Management

### Profile Questions

**Location**: `src/features/matchmaking/profile-questions.ts`

- Questions stored in MongoDB with metadata (category, difficulty, priority)
- System tracks which questions have been asked per user
- Questions prioritized based on missing profile areas
- Fallback to topic conversations if no questions available

### Dynamic Topic Generation

**Location**: Various methods in `mama-san-specialist.ts`

- AI-generated topics based on user interests and conversation history
- Fallback to predefined anime/gaming/online relationship topics
- Topic history prevents repetition
- Smart transitions between topics

---

## File Structure Summary

### Primary Files:

- **`src/features/matchmaking/mama-san-specialist.ts`**: Main orchestration logic, personality definitions, decision-making
- **`src/features/matchmaking/topic-starter-specialist.ts`**: Topic management, fallback topics, conversation state
- **`src/features/matchmaking/profile-questions.ts`**: Profile question sourcing and management

### Key Methods:

- **`generateContinuousQuestion()`**: Main decision point (line 385)
- **`analyzeProfileCompleteness()`**: Profile analysis (line 231)
- **`generateCombinedContinuousResponse()`**: Prompt generation (line 2442)
- **`getFallbackTopic()`**: Fallback topic selection (line 271)

### Configuration Constants:

- **Question probability thresholds**: Lines 354-363 in mama-san-specialist.ts
- **Minimum turns per topic**: Line 9 in topic-starter-specialist.ts
- **Profile question cooldown**: Line 10 in topic-starter-specialist.ts
- **Fallback topics**: Lines 272-285 in topic-starter-specialist.ts

---

## Impact of Recent Changes

### Reduced Profile Question Frequency

- Questions now asked 5-20% of the time (down from 30-80%)
- Results in more natural, conversation-focused interactions
- Profile completion happens more organically over time

### Enhanced Topic Relevance

- Fallback topics now target core user interests (anime, gaming, online relationships)
- Higher engagement potential when user interests are unknown
- More aligned with target demographic preferences

### Seductive Personality Transformation

- Complete shift from "cozy/chaotic" to "sultry/seductive" personality
- All prompts, acknowledgments, and instructions updated for consistency
- Maintains professionalism while adding alluring charm

### Technical Improvements

- More sophisticated decision logic with multiple factors
- Better state management for topic conversations
- Comprehensive prompt system for different scenarios
- Robust fallback mechanisms for edge cases

This system creates a natural, adaptive conversation flow that prioritizes engaging topic discussions while strategically gathering profile information through seductive, personalized interactions.
