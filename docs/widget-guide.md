# AI Tuber Widget Integration Guide

The AI Tuber Widget provides a lightweight, embeddable version of the AI tuber that can be easily integrated into any website.

## Quick Start

### Basic Embedding

```html
<iframe 
    src="http://localhost:3000/widget"
    width="400" 
    height="600"
    frameborder="0">
</iframe>
```

### Customized Widget

```html
<iframe 
    src="http://localhost:3000/widget?theme=dark&width=300px&height=500px&characterName=Assistant"
    width="300" 
    height="500"
    frameborder="0">
</iframe>
```

## Configuration Options

Configure the widget by adding URL parameters:

### Display Options
- `width` (string, default: "400px") - Widget width
- `height` (string, default: "600px") - Widget height  
- `theme` (string, default: "light") - Theme: "light", "dark", or "minimal"
- `showBackground` (boolean, default: true) - Show background image
- `showCharacter` (boolean, default: true) - Show 3D character

### UI Options
- `showInput` (boolean, default: true) - Show input form
- `showChatLog` (boolean, default: true) - Show chat history
- `showVoiceButton` (boolean, default: true) - Show voice input button
- `showSettingsButton` (boolean, default: false) - Show settings button

### Character Options
- `characterName` (string, default: "CHARACTER") - Character display name
- `characterModel` (string) - Path to VRM or Live2D model file
- `systemPrompt` (string) - AI personality prompt

### AI Service Options
- `apiKey` (string) - API key for AI service
- `aiService` (string) - AI service: "openai", "anthropic", "google", etc.
- `model` (string) - AI model name

### Advanced Options
- `postMessages` (boolean, default: false) - Enable parent-child communication
- `allowFullscreen` (boolean, default: false) - Show fullscreen button
- `autoFocus` (boolean, default: true) - Auto-focus input field

## Example Configurations

### Minimal Chat Widget
```html
<iframe 
    src="http://localhost:3000/widget?theme=minimal&showBackground=false&showCharacter=false&width=300px&height=200px"
    width="300" 
    height="200"
    frameborder="0">
</iframe>
```

### Full-Featured Dark Theme
```html
<iframe 
    src="http://localhost:3000/widget?theme=dark&characterName=AI Assistant&showChatLog=true&allowFullscreen=true"
    width="450" 
    height="650"
    frameborder="0">
</iframe>
```

### Character-Only Display
```html
<iframe 
    src="http://localhost:3000/widget?showInput=false&showChatLog=false&characterName=Demo&width=300px&height=400px"
    width="300" 
    height="400"
    frameborder="0">
</iframe>
```

## Parent-Child Communication

Enable interactive communication between the parent page and widget using PostMessage API.

### Enable Communication
```html
<iframe 
    id="ai-widget"
    src="http://localhost:3000/widget?postMessages=true"
    width="400" 
    height="500"
    frameborder="0">
</iframe>
```

### Send Messages to Widget

```javascript
// Send a chat message
document.getElementById('ai-widget').contentWindow.postMessage({
    type: 'SEND_MESSAGE',
    message: 'Hello from parent!'
}, '*');

// Clear chat history
document.getElementById('ai-widget').contentWindow.postMessage({
    type: 'CLEAR_CHAT'
}, '*');

// Update widget configuration
document.getElementById('ai-widget').contentWindow.postMessage({
    type: 'WIDGET_CONFIG',
    config: {
        theme: 'dark',
        characterName: 'New Name'
    }
}, '*');
```

### Listen for Widget Events

```javascript
window.addEventListener('message', function(event) {
    switch(event.data.type) {
        case 'WIDGET_READY':
            console.log('Widget is ready for interaction');
            break;
            
        case 'CHAT_UPDATE':
            console.log('Chat log updated:', event.data.chatLog);
            // Handle chat updates (save to database, etc.)
            break;
            
        case 'TOGGLE_FULLSCREEN':
            // Handle fullscreen toggle request
            toggleWidgetFullscreen();
            break;
    }
});
```

## API Integration

### Using Your Own API Keys

```html
<iframe 
    src="http://localhost:3000/widget?apiKey=YOUR_API_KEY&aiService=openai&model=gpt-4"
    width="400" 
    height="600"
    frameborder="0">
</iframe>
```

### Custom Character Setup

```html
<iframe 
    src="http://localhost:3000/widget?characterModel=/vrm/custom.vrm&characterName=Custom&systemPrompt=You are a helpful assistant"
    width="400" 
    height="600"
    frameborder="0">
</iframe>
```

## Responsive Design

### CSS for Responsive Widget

```css
.widget-container {
    width: 100%;
    max-width: 400px;
    height: 600px;
    border: none;
    border-radius: 8px;
    overflow: hidden;
}

@media (max-width: 768px) {
    .widget-container {
        height: 500px;
    }
}
```

### Dynamic Resizing

```javascript
function resizeWidget() {
    const widget = document.getElementById('ai-widget');
    const container = widget.parentElement;
    
    widget.width = container.clientWidth;
    widget.height = container.clientHeight;
    
    // Update widget configuration
    widget.contentWindow.postMessage({
        type: 'WIDGET_CONFIG',
        config: {
            width: container.clientWidth + 'px',
            height: container.clientHeight + 'px'
        }
    }, '*');
}

window.addEventListener('resize', resizeWidget);
```

## Security Considerations

### CORS and Origins

When deploying, ensure your domain is allowed in CORS settings.

### API Key Security

- Never expose API keys in client-side code
- Use environment variables or secure configuration
- Consider implementing a proxy API for better security

### Content Security Policy

Add appropriate CSP headers:

```html
<meta http-equiv="Content-Security-Policy" content="frame-src 'self' https://your-domain.com;">
```

## Advanced Customization

### Custom Themes via CSS

Override widget styles using CSS injection:

```javascript
// Send custom CSS to widget
document.getElementById('ai-widget').contentWindow.postMessage({
    type: 'WIDGET_CONFIG',
    config: {
        customCSS: `
            .widget-form { background: linear-gradient(45deg, #ff6b6b, #4ecdc4); }
            .chat-message { border-radius: 20px; }
        `
    }
}, '*');
```

### Event Callbacks

```javascript
const widgetCallbacks = {
    onReady: () => console.log('Widget ready'),
    onMessage: (msg) => console.log('New message:', msg),
    onError: (err) => console.error('Widget error:', err)
};

// Setup widget with callbacks
function setupWidget() {
    window.addEventListener('message', function(event) {
        switch(event.data.type) {
            case 'WIDGET_READY':
                widgetCallbacks.onReady();
                break;
            case 'CHAT_UPDATE':
                widgetCallbacks.onMessage(event.data.chatLog);
                break;
            case 'ERROR':
                widgetCallbacks.onError(event.data.error);
                break;
        }
    });
}
```

## Testing

View the example implementation at:
```
http://localhost:3000/embed-example.html
```

This provides interactive examples of all widget configurations and features.

## Production Deployment

### Environment Variables

Set the following for production:

```bash
NEXT_PUBLIC_WIDGET_DOMAIN=https://your-domain.com
NEXT_PUBLIC_DEFAULT_API_KEY=your-default-key
NEXT_PUBLIC_WIDGET_CORS_ORIGINS=https://example.com,https://another-site.com
```

### Performance Optimization

- Enable widget caching
- Minimize bundle size by removing unused features
- Use CDN for static assets
- Implement lazy loading for 3D models

## Troubleshooting

### Common Issues

1. **Widget not loading**: Check CORS settings and iframe permissions
2. **API not working**: Verify API keys and service configuration
3. **Character not displaying**: Check model file paths and formats
4. **PostMessage not working**: Ensure both domains allow iframe communication

### Debug Mode

Enable debug mode by adding `debug=true` to widget URL:

```html
<iframe src="http://localhost:3000/widget?debug=true" ...>
```

This will show console logs and error details in the widget. 