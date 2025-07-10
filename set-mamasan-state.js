#!/usr/bin/env node

/**
 * MamaSan State Testing Script
 *
 * This script allows you to manually set your MamaSan state in the database for testing.
 *
 * Usage:
 *   node set-mamasan-state.js <uid> <preset>
 *   node set-mamasan-state.js <uid> custom <currentQuestion> <answers...>
 *
 * Examples:
 *   node set-mamasan-state.js user123 fresh              # Reset to beginning
 *   node set-mamasan-state.js user123 answered-first     # Answered question 0, on question 1
 *   node set-mamasan-state.js user123 answered-second    # Answered questions 0-1, on question 2
 *   node set-mamasan-state.js user123 almost-done        # Answered questions 0-2, on question 3
 *   node set-mamasan-state.js user123 complete           # All questions answered, in continuous mode
 *   node set-mamasan-state.js user123 custom 2 "selfies" "entertained"  # Custom state
 */

// Import required modules
const mongoose = require('mongoose')

// MongoDB connection function (copied from src/lib/mongodb.ts)
async function connectMongoDB() {
  if (mongoose.connection.readyState === 1) {
    console.log('MongoDB already connected')
    return
  }

  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      'mongodb://localhost:27017/aituber-kit'

    await mongoose.connect(mongoUri, {
      bufferCommands: false,
    })

    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    throw error
  }
}

// Define the MatchProfile schema (simplified version)
const MamaSanStateSchema = new mongoose.Schema({
  currentQuestion: { type: Number, default: 0 },
  answers: { type: [String], default: [] },
  isComplete: { type: Boolean, default: false },
})

const MatchProfileSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    role: { type: String, enum: ['host', 'guest'], required: true },
    status: { type: String, default: 'OFFLINE' },
    mamasanState: { type: MamaSanStateSchema, default: () => ({}) },
    stamina: { type: Number, default: 10 },
    intimacyLevel: { type: Number, default: 0 },
  },
  { strict: false }
) // Allow additional fields

const MatchProfile = mongoose.model('MatchProfile', MatchProfileSchema)

// Preset states for testing
const PRESETS = {
  fresh: {
    currentQuestion: 0,
    answers: [],
    isComplete: false,
    description: 'Fresh start - no questions answered',
  },
  'answered-first': {
    currentQuestion: 1,
    answers: ['looking to be entertaint'],
    isComplete: false,
    description: 'Answered first question, on question 1',
  },
  'answered-second': {
    currentQuestion: 2,
    answers: ['looking to be entertaint', 'entertained'],
    isComplete: false,
    description: 'Answered first two questions, on question 2',
  },
  'almost-done': {
    currentQuestion: 3,
    answers: [
      'looking to be entertaint',
      'entertained',
      'playful and personal',
    ],
    isComplete: false,
    description: 'Answered first three questions, on question 3',
  },
  complete: {
    currentQuestion: 4,
    answers: [
      'looking to be entertaint',
      'entertained',
      'playful and personal',
      'something intimate',
    ],
    isComplete: false, // Note: false because we keep session active for continuous mode
    description: 'All onboarding questions answered, in continuous mode',
  },
}

async function setMamaSanState(uid, newState) {
  try {
    await connectMongoDB()

    // Find or create the user profile
    let profile = await MatchProfile.findOne({ uid })

    if (!profile) {
      console.log(`⚠️  Profile not found for UID: ${uid}`)
      console.log('🔨 Creating new profile...')
      profile = await MatchProfile.create({
        uid,
        role: 'guest',
        status: 'OFFLINE',
        mamasanState: newState,
      })
      console.log('✅ New profile created')
    } else {
      // Update existing profile
      profile.mamasanState = newState
      await profile.save()
      console.log('✅ Existing profile updated')
    }

    console.log('📊 Current MamaSan State:')
    console.log('  Current Question:', profile.mamasanState.currentQuestion)
    console.log('  Answers:', profile.mamasanState.answers)
    console.log('  Is Complete:', profile.mamasanState.isComplete)
    console.log('  Total Answers:', profile.mamasanState.answers.length)

    await mongoose.disconnect()
    console.log('🎯 Database updated successfully!')
  } catch (error) {
    console.error('❌ Error updating database:', error)
    process.exit(1)
  }
}

function showUsage() {
  console.log('🧪 MamaSan State Testing Script')
  console.log('===============================')
  console.log('')
  console.log('Usage:')
  console.log('  node set-mamasan-state.js <uid> <preset>')
  console.log(
    '  node set-mamasan-state.js <uid> custom <currentQuestion> <answers...>'
  )
  console.log('')
  console.log('Available presets:')
  Object.entries(PRESETS).forEach(([name, preset]) => {
    console.log(`  ${name.padEnd(15)} - ${preset.description}`)
  })
  console.log('')
  console.log('Examples:')
  console.log('  node set-mamasan-state.js user123 fresh')
  console.log('  node set-mamasan-state.js user123 answered-first')
  console.log(
    '  node set-mamasan-state.js user123 custom 2 "selfies" "entertained"'
  )
}

// Main execution
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    showUsage()
    process.exit(1)
  }

  const uid = args[0]
  const command = args[1]

  if (command === 'custom') {
    if (args.length < 3) {
      console.error(
        '❌ Custom mode requires at least currentQuestion parameter'
      )
      console.log(
        'Usage: node set-mamasan-state.js <uid> custom <currentQuestion> <answers...>'
      )
      process.exit(1)
    }

    const currentQuestion = parseInt(args[2])
    const answers = args.slice(3)

    const customState = {
      currentQuestion,
      answers,
      isComplete: false,
    }

    console.log(`🔧 Setting custom state for ${uid}:`)
    console.log('  Current Question:', currentQuestion)
    console.log('  Answers:', answers)

    await setMamaSanState(uid, customState)
  } else if (PRESETS[command]) {
    const preset = PRESETS[command]
    console.log(`🎛️  Setting preset "${command}" for ${uid}:`)
    console.log(`  ${preset.description}`)

    await setMamaSanState(uid, {
      currentQuestion: preset.currentQuestion,
      answers: preset.answers,
      isComplete: preset.isComplete,
    })
  } else {
    console.error(`❌ Unknown preset: ${command}`)
    console.log('')
    showUsage()
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error)
  process.exit(1)
})

// Run the script
main().catch(console.error)
