const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Define the schema inline for the seeding script
const ProfilingQuestionSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String },
  tags: [{ type: String }],
  difficulty: { type: String, enum: ['basic', 'intermediate', 'advanced'], default: 'basic' },
  priority: { type: Number, min: 1, max: 10, default: 5 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

const ProfilingQuestion = mongoose.model('ProfilingQuestion', ProfilingQuestionSchema)

const questions = [
  // Physical Preferences - Height
  {
    questionId: 'PHYS_HEIGHT_PREF',
    text: 'Do you have any preference when it comes to your match\'s height?',
    category: 'physicalPreferences',
    subcategory: 'height',
    tags: ['height', 'physical', 'appearance'],
    difficulty: 'basic',
    priority: 7
  },

  // Physical Preferences - Build
  {
    questionId: 'PHYS_BUILD_ATHLETIC',
    text: 'Do you find athletic people attractive?',
    category: 'physicalPreferences',
    subcategory: 'build',
    tags: ['athletic', 'build', 'physical', 'fitness'],
    difficulty: 'basic',
    priority: 6
  },

  // Physical Preferences - Ethnicity
  {
    questionId: 'PHYS_ACCENT_PREF',
    text: 'Which accent do you find sexiest?',
    category: 'physicalPreferences',
    subcategory: 'ethnicity',
    tags: ['accent', 'ethnicity', 'voice', 'attraction'],
    difficulty: 'basic',
    priority: 4
  },

  // Physical Preferences - Style (9 questions)
  {
    questionId: 'PHYS_STYLE_DRESSED_CASUAL',
    text: 'All dressed up or casual and comfy – what do you like seeing on your match?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['style', 'clothing', 'fashion', 'preference'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'PHYS_STYLE_SHOES',
    text: 'High heels or sneakers – what do you prefer on your match?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['shoes', 'style', 'footwear'],
    difficulty: 'basic',
    priority: 3
  },
  {
    questionId: 'PHYS_STYLE_OUTFIT',
    text: 'What\'s one outfit you love seeing on your match?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['outfit', 'clothing', 'style'],
    difficulty: 'basic',
    priority: 4
  },
  {
    questionId: 'PHYS_STYLE_NATURAL_GLAM',
    text: 'Do you prefer someone with a natural look or one who\'s all glammed up?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['natural', 'glamour', 'makeup', 'appearance'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'PHYS_STYLE_OUTSPOKEN',
    text: 'Do you find it attractive when someone is outspoken and opinionated?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['personality', 'outspoken', 'opinions'],
    difficulty: 'intermediate',
    priority: 5
  },
  {
    questionId: 'PHYS_STYLE_HAIR_LENGTH',
    text: 'Long hair or short hair – what do you prefer on your match?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['hair', 'length', 'appearance'],
    difficulty: 'basic',
    priority: 4
  },
  {
    questionId: 'PHYS_STYLE_HAIR_COLOR',
    text: 'Blondes, brunettes, or redheads – have a favorite?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['hair-color', 'blonde', 'brunette', 'redhead'],
    difficulty: 'basic',
    priority: 4
  },
  {
    questionId: 'PHYS_STYLE_PIERCINGS',
    text: 'Piercings on your match: yay or nay?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['piercings', 'body-modification'],
    difficulty: 'basic',
    priority: 3
  },
  {
    questionId: 'PHYS_STYLE_TATTOOS',
    text: 'Tattoos on your match: hot or not your thing?',
    category: 'physicalPreferences',
    subcategory: 'style',
    tags: ['tattoos', 'body-modification'],
    difficulty: 'basic',
    priority: 3
  },

  // Physical Preferences - Attraction Tags (37 questions)
  {
    questionId: 'PHYS_ATTR_TYPE',
    text: 'So, do you have a type?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['type', 'preference', 'attraction'],
    difficulty: 'basic',
    priority: 8
  },
  {
    questionId: 'PHYS_ATTR_LOOK_FOR',
    text: 'What kinds of things do you look for in your match?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['qualities', 'seeking', 'preferences'],
    difficulty: 'basic',
    priority: 8
  },
  {
    questionId: 'PHYS_ATTR_FIND_ATTRACTIVE',
    text: 'What do you find attractive in your match?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['attractive', 'qualities', 'appeal'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_CANT_RESIST',
    text: 'Is there a trait in someone you just can\'t resist?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['irresistible', 'trait', 'weakness'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_FIRST_NOTICE',
    text: 'What\'s the first thing you notice about someone?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['first-impression', 'notice', 'initial-attraction'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_WEAKNESS',
    text: 'Do you have a weakness for any particular kind of person?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['weakness', 'particular-type', 'preference'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_STAND_OUT',
    text: 'What makes someone really stand out to you?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['stand-out', 'memorable', 'unique'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_CATCHES_EYE',
    text: 'What\'s something that instantly catches your eye about someone?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['catches-eye', 'instant-attraction', 'visual'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_MUST_HAVE',
    text: 'What quality in someone is an absolute must-have for you?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['must-have', 'essential', 'requirement'],
    difficulty: 'intermediate',
    priority: 8
  },
  {
    questionId: 'PHYS_ATTR_THREE_WORDS',
    text: 'Describe your ideal person in three words.',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['ideal', 'description', 'three-words'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_FIRST_CRUSH',
    text: 'Who was your first crush, and what did you like about them?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['first-crush', 'past-attraction', 'qualities'],
    difficulty: 'intermediate',
    priority: 4
  },
  {
    questionId: 'PHYS_ATTR_CELEBRITY_CRUSH',
    text: 'Who was your celebrity crush when you were younger?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['celebrity-crush', 'past-attraction', 'type'],
    difficulty: 'basic',
    priority: 3
  },
  {
    questionId: 'PHYS_ATTR_PERSONALITY_LOOKS',
    text: 'Which matters more to you, personality or looks?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['personality-vs-looks', 'priorities', 'values'],
    difficulty: 'intermediate',
    priority: 8
  },
  {
    questionId: 'PHYS_ATTR_HUMOR',
    text: 'Is a sense of humor a must-have trait for you?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['humor', 'must-have', 'personality'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_PERSONALITY_TRAIT',
    text: 'What personality trait do you find most attractive?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['personality-trait', 'attractive', 'character'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_ADORABLE_QUIRK',
    text: 'What\'s the most adorable quirk someone could have, in your opinion?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['quirk', 'adorable', 'unique-trait'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'PHYS_ATTR_LITTLE_GESTURE',
    text: 'What little gesture from someone do you find incredibly attractive?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['gesture', 'little-things', 'attractive'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_SURPRISING',
    text: 'What\'s something you find attractive in someone that might surprise others?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['surprising', 'unusual-attraction', 'unique'],
    difficulty: 'intermediate',
    priority: 5
  },
  {
    questionId: 'PHYS_ATTR_CUTE_BOLD',
    text: 'Cute and sweet or bold and sassy — which vibe do you like more?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['cute-vs-bold', 'personality-style', 'vibe'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_FEMININE_SPORTY',
    text: 'Feminine girly type or sporty tomboy – which do you find more attractive?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['feminine-vs-sporty', 'style-preference', 'type'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'PHYS_ATTR_AMBITION',
    text: 'Do you find ambition attractive in someone?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['ambition', 'drive', 'success'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_INTELLIGENCE',
    text: 'Is intelligence a turn-on for you?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['intelligence', 'smart', 'turn-on'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_DEAL_MAKER',
    text: 'What\'s a big deal-maker for you in someone?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['deal-maker', 'positive-trait', 'attractive'],
    difficulty: 'intermediate',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_MELTS_HEART',
    text: 'What\'s something someone can do that just melts your heart?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['melts-heart', 'sweet', 'endearing'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_IRRESISTIBLE',
    text: 'What do you find absolutely irresistible in someone?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['irresistible', 'cannot-resist', 'attraction'],
    difficulty: 'intermediate',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_CONFIDENCE_KINDNESS',
    text: 'Confidence or kindness – which do you find sexier?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['confidence-vs-kindness', 'sexy', 'preference'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_EYES_SMILE',
    text: 'What\'s more captivating to you: someone\'s eyes or their smile?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['eyes-vs-smile', 'captivating', 'physical-feature'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'PHYS_ATTR_CANT_HELP_FALLING',
    text: 'What\'s one thing you can\'t help falling for every time?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['cant-help-falling', 'weakness', 'consistent-attraction'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_MAGIC_GENIE',
    text: 'If you had a magic genie to create your perfect match, what\'s one trait you\'d definitely ask for?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['perfect-match', 'ideal-trait', 'genie-wish'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_MOST_ATTRACTIVE_WHEN',
    text: 'Finish this sentence: Someone is most attractive when they ___.',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['most-attractive-when', 'completion', 'behavior'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_CATCH_ATTENTION',
    text: 'In your opinion, what\'s the best way for someone to catch your attention?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['catch-attention', 'best-way', 'approach'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_ADMIRE_QUALITIES',
    text: 'What qualities do you admire most in people you date?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['admire', 'dating-qualities', 'respect'],
    difficulty: 'intermediate',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_NOTICE_PERSONALITY',
    text: 'What\'s the first thing you notice about someone\'s personality?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['notice-personality', 'first-impression', 'character'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_WANT_TO_ASK_OUT',
    text: 'What would make you want to ask someone out?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['ask-out', 'motivation', 'attraction-trigger'],
    difficulty: 'intermediate',
    priority: 7
  },
  {
    questionId: 'PHYS_ATTR_USUAL_TYPE',
    text: 'Do you usually go for your usual type, or do you venture out of your comfort zone?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['usual-type', 'comfort-zone', 'variety'],
    difficulty: 'intermediate',
    priority: 5
  },
  {
    questionId: 'PHYS_ATTR_MOST_ATTRACTIVE_SO_FAR',
    text: 'What do you find most attractive about someone when you first meet them?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['most-attractive', 'first-meeting', 'initial-impression'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'PHYS_ATTR_UNEXPECTED_SEXY',
    text: 'What\'s something you find sexy that most people might not think of as sexy?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['unexpected-sexy', 'unique-attraction', 'unconventional'],
    difficulty: 'advanced',
    priority: 5
  },
  {
    questionId: 'PHYS_ATTR_CREATIVE_ARTISTIC',
    text: 'Are you attracted to creative, artistic people, or is that not really your thing?',
    category: 'physicalPreferences',
    subcategory: 'attractionTags',
    tags: ['creative', 'artistic', 'talent'],
    difficulty: 'basic',
    priority: 5
  },

  // Relationship Style - Type (11 questions)
  {
    questionId: 'REL_GIRLFRIEND_MATERIAL',
    text: 'What do you think makes someone dating material?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['dating-material', 'relationship-qualities', 'standards'],
    difficulty: 'intermediate',
    priority: 7
  },
  {
    questionId: 'REL_PERSONALITY_VS_LOOKS',
    text: 'Which matters more to you, personality or looks?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['personality-vs-looks', 'priorities', 'values'],
    difficulty: 'intermediate',
    priority: 8
  },
  {
    questionId: 'REL_SIMILAR_OPPOSITE',
    text: 'Do you usually go for someone similar to you or your opposite?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['similar-vs-opposite', 'compatibility', 'differences'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'REL_CHALLENGE_COMFORT',
    text: 'Would you rather be with someone who challenges you or someone who comforts you?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['challenge-vs-comfort', 'relationship-dynamic', 'growth'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'REL_INTELLECTUAL_CHEMISTRY',
    text: 'What turns you on more: an intellectual conversation or instant chemistry?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['intellectual-vs-chemistry', 'connection-type', 'attraction'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'REL_SUCCESS_VS_CARING',
    text: 'If you had to choose, a super successful partner or a super caring partner?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['success-vs-caring', 'partner-priorities', 'values'],
    difficulty: 'intermediate',
    priority: 7
  },
  {
    questionId: 'REL_VALUE_MOST',
    text: 'What do you value most in a partner?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['value-most', 'partner-qualities', 'priorities'],
    difficulty: 'basic',
    priority: 8
  },
  {
    questionId: 'REL_MARRIAGE_MATERIAL',
    text: 'What qualities make someone marriage material in your eyes?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['marriage-material', 'long-term', 'serious-relationship'],
    difficulty: 'advanced',
    priority: 6
  },
  {
    questionId: 'REL_FAMILY_APPROVAL',
    text: 'What would your family say is the type of person you\'d be happiest with?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['family-opinion', 'compatibility', 'happiness'],
    difficulty: 'intermediate',
    priority: 4
  },
  {
    questionId: 'REL_OPTIMISTIC_REALISTIC',
    text: 'Always optimistic or more realistic – what attitude do you prefer in a partner?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['optimistic-vs-realistic', 'attitude', 'outlook'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'REL_WAY_TO_HEART',
    text: 'What\'s the way to your heart?',
    category: 'relationshipStyle',
    subcategory: 'type',
    tags: ['way-to-heart', 'romance', 'connection'],
    difficulty: 'intermediate',
    priority: 7
  },

  // Intimacy Comfort (6 questions)
  {
    questionId: 'INT_MYSTERIOUS_OPEN',
    text: 'What\'s more attractive: someone who is mysterious or one who\'s an open book?',
    category: 'intimacyComfort',
    subcategory: 'openness',
    tags: ['mysterious-vs-open', 'personality-style', 'communication'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'INT_AFFECTIONATE_RESERVED',
    text: 'Do you prefer someone who\'s openly affectionate or someone more reserved?',
    category: 'intimacyComfort',
    subcategory: 'affection',
    tags: ['affectionate-vs-reserved', 'emotional-expression', 'style'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'INT_LOVE_LANGUAGE',
    text: 'What\'s your love language?',
    category: 'intimacyComfort',
    subcategory: 'expression',
    tags: ['love-language', 'expression', 'communication'],
    difficulty: 'basic',
    priority: 7
  },
  {
    questionId: 'INT_VULNERABILITY_CONFIDENCE',
    text: 'Do you find it attractive when someone shows a bit of vulnerability, or do you prefer confidence all the way?',
    category: 'intimacyComfort',
    subcategory: 'vulnerability',
    tags: ['vulnerability-vs-confidence', 'emotional-openness', 'strength'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'INT_PET_NAMES',
    text: 'Pet names in a relationship: adorable or cringey?',
    category: 'intimacyComfort',
    subcategory: 'expression',
    tags: ['pet-names', 'relationship-terms', 'cute'],
    difficulty: 'basic',
    priority: 4
  },
  {
    questionId: 'INT_JEALOUSY_CUTE',
    text: 'Be honest: if someone gets a tiny bit jealous, do you find it cute or not?',
    category: 'intimacyComfort',
    subcategory: 'jealousy',
    tags: ['jealousy', 'cute', 'possessiveness'],
    difficulty: 'intermediate',
    priority: 5
  },

  // Dominance Style (7 questions)
  {
    questionId: 'DOM_CONFIDENT_INTIMIDATE',
    text: 'Do confident people intimidate you or turn you on?',
    category: 'dominanceStyle',
    subcategory: 'confidence',
    tags: ['confidence', 'intimidation', 'attraction'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'DOM_FIRST_MOVE',
    text: 'Do you like it when someone makes the first move?',
    category: 'dominanceStyle',
    subcategory: 'initiative',
    tags: ['first-move', 'initiative', 'assertiveness'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'DOM_STRAIGHTFORWARD_CHASE',
    text: 'Do you prefer someone who\'s straightforward about liking you, or do you enjoy the chase?',
    category: 'dominanceStyle',
    subcategory: 'directness',
    tags: ['straightforward-vs-chase', 'pursuit', 'directness'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'DOM_SURPRISE_PLANS',
    text: 'Would you enjoy someone surprising you with plans, or do you prefer to be the planner?',
    category: 'dominanceStyle',
    subcategory: 'planning',
    tags: ['surprise-plans', 'planning', 'control'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'DOM_BEING_PAMPERED',
    text: 'Would you enjoy being pampered by a partner, or would that feel weird for you?',
    category: 'dominanceStyle',
    subcategory: 'care',
    tags: ['being-pampered', 'care', 'receiving'],
    difficulty: 'intermediate',
    priority: 5
  },
  {
    questionId: 'DOM_MORE_SUCCESSFUL',
    text: 'How would you feel about dating someone who\'s more successful than you?',
    category: 'dominanceStyle',
    subcategory: 'success',
    tags: ['partner-success', 'ego', 'status'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'DOM_CHIVALRY_INDEPENDENT',
    text: 'Would you prefer someone who appreciates old-school chivalry, or someone who\'s more modern and independent?',
    category: 'dominanceStyle',
    subcategory: 'independence',
    tags: ['chivalry-vs-independence', 'traditional-vs-modern', 'style'],
    difficulty: 'intermediate',
    priority: 5
  },

  // Demographics - Age Preference (1 question)
  {
    questionId: 'DEMO_AGE_PREFERENCE',
    text: 'Do you tend to date people older than you, younger than you, or does age not matter?',
    category: 'demographics',
    subcategory: 'agePreference',
    tags: ['age-preference', 'older-younger', 'demographics'],
    difficulty: 'basic',
    priority: 7
  },

  // Demographics - Experience Level (1 question)
  {
    questionId: 'DEMO_EXPERIENCE_LEVEL',
    text: 'Do you prefer someone a bit innocent or someone more worldly and experienced?',
    category: 'demographics',
    subcategory: 'experienceLevel',
    tags: ['innocent-vs-experienced', 'worldly', 'experience'],
    difficulty: 'intermediate',
    priority: 6
  },

  // Service Preferences - Primary Services (3 questions)
  {
    questionId: 'SERV_GYM_MOVIE',
    text: 'Would you rather have a gym buddy partner or a movie marathon partner?',
    category: 'servicePreferences',
    subcategory: 'primaryServices',
    tags: ['gym-vs-movies', 'activities', 'shared-interests'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'SERV_COOKING_EATING_OUT',
    text: 'Do you think cooking together is a fun date, or would you rather go out to eat?',
    category: 'servicePreferences',
    subcategory: 'primaryServices',
    tags: ['cooking-vs-eating-out', 'dates', 'activities'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'SERV_PERFECT_SURPRISE',
    text: 'What would be the perfect surprise someone could do for you?',
    category: 'servicePreferences',
    subcategory: 'primaryServices',
    tags: ['perfect-surprise', 'thoughtfulness', 'gestures'],
    difficulty: 'intermediate',
    priority: 6
  },

  // Service Preferences - Mood (9 questions)
  {
    questionId: 'SERV_EXTROVERTED_INTROVERTED',
    text: 'Do extroverted or introverted people attract you more?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['extroverted-vs-introverted', 'personality-type', 'energy'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'SERV_HOMEBODY_SOCIAL',
    text: 'Are you more into a homebody or a social butterfly?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['homebody-vs-social', 'lifestyle', 'social-energy'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'SERV_ADVENTUROUS_LAID_BACK',
    text: 'Adventurous or laid-back – which kind of person do you prefer?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['adventurous-vs-laid-back', 'energy-level', 'lifestyle'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'SERV_TEASING_SWEETNESS',
    text: 'Do you enjoy a bit of playful teasing, or do you prefer sincere sweetness?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['teasing-vs-sweetness', 'interaction-style', 'humor'],
    difficulty: 'intermediate',
    priority: 5
  },
  {
    questionId: 'SERV_CUTE_BOLD_MOOD',
    text: 'Cute and sweet or bold and sassy — which vibe do you like more?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['cute-vs-bold', 'personality-vibe', 'energy'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'SERV_PLAYFUL_SERIOUS',
    text: 'Do you vibe more with someone playful or someone serious?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['playful-vs-serious', 'personality', 'interaction'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'SERV_ORGANIZED_CHAOTIC',
    text: 'Super organized or a bit chaotic – what do you find more appealing?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['organized-vs-chaotic', 'personality-style', 'lifestyle'],
    difficulty: 'basic',
    priority: 4
  },
  {
    questionId: 'SERV_LIVELY_GENTLE',
    text: 'Would you rather spend time with someone lively and talkative, or someone gentle and soothing?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['lively-vs-gentle', 'energy-type', 'communication-style'],
    difficulty: 'basic',
    priority: 5
  },
  {
    questionId: 'SERV_OPTIMISTIC_REALISTIC_MOOD',
    text: 'Always optimistic or more realistic – what attitude do you prefer in a partner?',
    category: 'servicePreferences',
    subcategory: 'mood',
    tags: ['optimistic-vs-realistic', 'attitude', 'outlook'],
    difficulty: 'basic',
    priority: 5
  },

  // Service Preferences - Interaction Style (5 questions)
  {
    questionId: 'SERV_ROMANTIC_GESTURES',
    text: 'Romantic gestures from someone – love them or not so much?',
    category: 'servicePreferences',
    subcategory: 'interactionStyle',
    tags: ['romantic-gestures', 'romance', 'expressions'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'SERV_TALKS_LISTENER',
    text: 'Do you prefer someone who talks a lot or one who\'s more of a listener?',
    category: 'servicePreferences',
    subcategory: 'interactionStyle',
    tags: ['talker-vs-listener', 'communication-style', 'conversation'],
    difficulty: 'basic',
    priority: 6
  },
  {
    questionId: 'SERV_DATE_IMPRESSES',
    text: 'What\'s something someone could do on a date that really impresses you?',
    category: 'servicePreferences',
    subcategory: 'interactionStyle',
    tags: ['date-impressions', 'impressive-behavior', 'dating'],
    difficulty: 'intermediate',
    priority: 6
  },
  {
    questionId: 'SERV_HANG_WITH_FRIENDS',
    text: 'Is it attractive to you when someone can hang out easily with your friends?',
    category: 'servicePreferences',
    subcategory: 'interactionStyle',
    tags: ['friends-compatibility', 'social-integration', 'group-dynamics'],
    difficulty: 'intermediate',
    priority: 5
  },
  {
    questionId: 'SERV_WISH_MORE_OFTEN',
    text: 'What\'s something you wish people would do more often when dating?',
    category: 'servicePreferences',
    subcategory: 'interactionStyle',
    tags: ['dating-wishes', 'ideal-behavior', 'preferences'],
    difficulty: 'intermediate',
    priority: 6
  },

  // Service Preferences - Conversation Topics (2 questions)
  {
    questionId: 'SERV_SHARED_HOBBIES',
    text: 'Would you rather be with someone who shares your hobbies or someone with their own passions?',
    category: 'servicePreferences',
    subcategory: 'conversationTopics',
    tags: ['shared-vs-different-hobbies', 'interests', 'compatibility'],
    difficulty: 'intermediate',
    priority: 5
  },
  {
    questionId: 'SERV_NERDY_PASSION',
    text: 'If someone has a nerdy hobby or unique passion, do you find that attractive?',
    category: 'servicePreferences',
    subcategory: 'conversationTopics',
    tags: ['nerdy-hobbies', 'unique-passions', 'interests'],
    difficulty: 'basic',
    priority: 4
  }
]

async function seedQuestions() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aituber-kit'
    await mongoose.connect(mongoUri)
    console.log('Connected to MongoDB')

    // Clear existing questions (optional - comment out if you want to keep existing)
    // await ProfilingQuestion.deleteMany({})
    // console.log('Cleared existing profiling questions')

    // Insert questions, skip duplicates
    const insertPromises = questions.map(async (question) => {
      try {
        const existingQuestion = await ProfilingQuestion.findOne({ questionId: question.questionId })
        if (existingQuestion) {
          console.log(`Skipping duplicate question: ${question.questionId}`)
          return null
        }
        
        const newQuestion = new ProfilingQuestion(question)
        await newQuestion.save()
        console.log(`Inserted question: ${question.questionId}`)
        return newQuestion
      } catch (error) {
        console.error(`Error inserting question ${question.questionId}:`, error.message)
        return null
      }
    })

    const results = await Promise.all(insertPromises)
    const successCount = results.filter(r => r !== null).length
    
    console.log(`\nSeeding completed!`)
    console.log(`Total questions attempted: ${questions.length}`)
    console.log(`Successfully inserted: ${successCount}`)
    console.log(`Skipped/Failed: ${questions.length - successCount}`)

    // Display summary by category
    const categorySummary = {}
    questions.forEach(q => {
      categorySummary[q.category] = (categorySummary[q.category] || 0) + 1
    })
    
    console.log('\nQuestions by category:')
    Object.entries(categorySummary).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} questions`)
    })

  } catch (error) {
    console.error('Error seeding questions:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  }
}

// Run the seeding
if (require.main === module) {
  seedQuestions()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Seeding failed:', error)
      process.exit(1)
    })
}

module.exports = { seedQuestions } 