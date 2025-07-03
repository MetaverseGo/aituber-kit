import React from 'react'

export default function DebugEnv() {
  const nextPublicVars = {
    NEXT_PUBLIC_SELECT_VOICE: process.env.NEXT_PUBLIC_SELECT_VOICE,
    NEXT_PUBLIC_SELECT_AI_SERVICE: process.env.NEXT_PUBLIC_SELECT_AI_SERVICE,
    NEXT_PUBLIC_SELECT_AI_MODEL: process.env.NEXT_PUBLIC_SELECT_AI_MODEL,
    NEXT_PUBLIC_SELECT_LANGUAGE: process.env.NEXT_PUBLIC_SELECT_LANGUAGE,
    NEXT_PUBLIC_CHARACTER_NAME: process.env.NEXT_PUBLIC_CHARACTER_NAME,
    // Add other NEXT_PUBLIC vars you've set in Amplify Console
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Environment Variables Debug</h1>
      <h2>NEXT_PUBLIC_ Variables (available on client):</h2>
      <pre
        style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}
      >
        {JSON.stringify(nextPublicVars, null, 2)}
      </pre>

      <h2>All process.env keys starting with NEXT_PUBLIC_:</h2>
      <pre
        style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}
      >
        {Object.keys(process.env)
          .filter((key) => key.startsWith('NEXT_PUBLIC_'))
          .map((key) => `${key}: ${process.env[key]}`)
          .join('\n')}
      </pre>

      <p>
        <strong>Note:</strong> This page will be available at{' '}
        <code>/debug-env</code> after deployment.
      </p>
      <p>
        <strong>Remember:</strong> Remove this page before production deployment
        for security!
      </p>
    </div>
  )
}
