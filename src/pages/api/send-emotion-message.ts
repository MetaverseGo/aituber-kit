import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Return a test page with buttons to send emotion messages
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Emotion Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .button { 
            margin: 10px; 
            padding: 10px 20px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 16px;
            color: white;
        }
        .angry { background-color: #ef4444; }
        .happy { background-color: #eab308; }
        .neutral { background-color: #6b7280; }
        .relaxed { background-color: #3b82f6; }
        .sad { background-color: #8b5cf6; }
        .surprised { background-color: #f97316; }
        .log { 
            background: #f3f4f6; 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 5px; 
            font-family: monospace; 
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <h1>Widget Emotion Test</h1>
    <p>Click buttons to send WIDGET_EMOTION_UPDATE messages to the widget:</p>
    
    <button class="button angry" onclick="sendEmotion('angry')">Angry</button>
    <button class="button happy" onclick="sendEmotion('happy')">Happy</button>
    <button class="button neutral" onclick="sendEmotion('neutral')">Neutral</button>
    <button class="button relaxed" onclick="sendEmotion('relaxed')">Relaxed</button>
    <button class="button sad" onclick="sendEmotion('sad')">Sad</button>
    <button class="button surprised" onclick="sendEmotion('surprised')">Surprised</button>
    
    <div id="log" class="log">Logs will appear here...</div>
    
    <script>
        function sendEmotion(emotion) {
            const message = {
                type: 'WIDGET_EMOTION_UPDATE',
                data: {
                    emotion: emotion
                }
            };
            
            // If this page is loaded directly (not in iframe), send to current window
            if (window.location.pathname === '/api/send-emotion-message') {
                window.postMessage(message, '*');
                log('✅ Sent to current window: ' + emotion);
            }
            
            // Try to find widget iframe in parent document
            try {
                const widgetFrame = parent.document.querySelector('iframe[src*="widget"]');
                if (widgetFrame && widgetFrame.contentWindow) {
                    widgetFrame.contentWindow.postMessage(message, '*');
                    log('✅ Sent to widget iframe: ' + emotion);
                } else {
                    log('❌ No widget iframe found in parent');
                }
            } catch (e) {
                log('❌ Cannot access parent document: ' + e.message);
            }
            
            // Try to find widget iframe in current document
            try {
                const widgetFrame = document.querySelector('iframe[src*="widget"]');
                if (widgetFrame && widgetFrame.contentWindow) {
                    widgetFrame.contentWindow.postMessage(message, '*');
                    log('✅ Sent to widget iframe in current document: ' + emotion);
                } else {
                    log('❌ No widget iframe found in current document');
                }
            } catch (e) {
                log('❌ Error finding widget iframe: ' + e.message);
            }
            
            // Also try sending to all frames
            for (let i = 0; i < window.frames.length; i++) {
                try {
                    window.frames[i].postMessage(message, '*');
                    log('✅ Sent to frame ' + i + ': ' + emotion);
                } catch (e) {
                    log('❌ Error sending to frame ' + i + ': ' + e.message);
                }
            }
            
            log('📤 Message sent: ' + JSON.stringify(message, null, 2));
        }
        
        function log(text) {
            const logDiv = document.getElementById('log');
            const timestamp = new Date().toLocaleTimeString();
            logDiv.textContent += '[' + timestamp + '] ' + text + '\\n';
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        
        // Listen for any messages back
        window.addEventListener('message', (event) => {
            log('📨 Received message: ' + JSON.stringify(event.data, null, 2));
        });
        
        log('🎭 Emotion test page loaded. Click buttons to test emotions.');
    </script>
</body>
</html>
    `

    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(html)
  } else if (req.method === 'POST') {
    // Handle POST request to send emotion programmatically
    const { emotion } = req.body

    const validEmotions = [
      'angry',
      'happy',
      'neutral',
      'relaxed',
      'sad',
      'surprised',
    ]
    if (!emotion || !validEmotions.includes(emotion)) {
      return res.status(400).json({
        error: 'Invalid emotion',
        validEmotions,
      })
    }

    console.log('🎭 [Send Emotion Message] Emotion requested:', emotion)

    res.status(200).json({
      success: true,
      emotion,
      message: `Emotion message ready: ${emotion}`,
      instructions: [
        'This endpoint provides a test page to send WIDGET_EMOTION_UPDATE messages',
        'Visit GET /api/send-emotion-message to access the test page',
        'Or send POST requests with {"emotion": "happy"} to get message format',
      ],
    })
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
