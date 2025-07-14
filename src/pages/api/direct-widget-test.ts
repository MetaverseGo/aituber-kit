import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Direct Widget Emotion Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .controls { 
            position: fixed; 
            top: 10px; 
            left: 10px; 
            z-index: 10000; 
            background: rgba(0,0,0,0.8); 
            padding: 15px; 
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        .button { 
            margin: 5px; 
            padding: 8px 15px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 14px;
            color: white;
            font-weight: bold;
        }
        .angry { background-color: #ef4444; }
        .happy { background-color: #eab308; }
        .neutral { background-color: #6b7280; }
        .relaxed { background-color: #3b82f6; }
        .sad { background-color: #8b5cf6; }
        .surprised { background-color: #f97316; }
        .log { 
            position: fixed;
            bottom: 10px;
            left: 10px;
            right: 10px;
            height: 150px;
            background: rgba(0,0,0,0.8); 
            padding: 10px; 
            border-radius: 10px;
            font-family: monospace; 
            font-size: 12px;
            color: #00ff00;
            overflow-y: auto;
            white-space: pre-wrap;
            backdrop-filter: blur(10px);
        }
        #widget-frame {
            width: 100vw;
            height: 100vh;
            border: none;
        }
        h3 { color: white; margin: 0 0 10px 0; font-size: 14px; }
    </style>
</head>
<body>
    <div class="controls">
        <h3>🎭 Widget Emotion Test</h3>
        <button class="button angry" onclick="sendEmotion('angry')">Angry</button>
        <button class="button happy" onclick="sendEmotion('happy')">Happy</button>
        <button class="button neutral" onclick="sendEmotion('neutral')">Neutral</button>
        <button class="button relaxed" onclick="sendEmotion('relaxed')">Relaxed</button>
        <button class="button sad" onclick="sendEmotion('sad')">Sad</button>
        <button class="button surprised" onclick="sendEmotion('surprised')">Surprised</button>
    </div>
    
    <iframe id="widget-frame" src="/widget"></iframe>
    
    <div id="log" class="log">Loading widget...</div>
    
    <script>
        function sendEmotion(emotion) {
            const message = {
                type: 'WIDGET_EMOTION_UPDATE',
                data: {
                    emotion: emotion
                }
            };
            
            const widgetFrame = document.getElementById('widget-frame');
            if (widgetFrame && widgetFrame.contentWindow) {
                widgetFrame.contentWindow.postMessage(message, '*');
                log('✅ Sent to widget: ' + emotion);
            } else {
                log('❌ Widget frame not found');
            }
            
            log('📤 Message: ' + JSON.stringify(message, null, 2));
        }
        
        function log(text) {
            const logDiv = document.getElementById('log');
            const timestamp = new Date().toLocaleTimeString();
            logDiv.textContent += '[' + timestamp + '] ' + text + '\\n';
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        
        // Listen for messages from widget
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type) {
                log('📨 Widget: ' + event.data.type + ' - ' + JSON.stringify(event.data.data || {}, null, 2));
            }
        });
        
        // Wait for widget to load
        document.getElementById('widget-frame').onload = function() {
            log('🎭 Widget loaded! Click buttons to test emotions.');
        };
        
        log('🎭 Direct widget test page loaded.');
    </script>
</body>
</html>
  `

  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(html)
}
