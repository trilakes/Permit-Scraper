# AI Chat Application

A modern, dark-themed chat interface with a Flask backend, featuring a sleek glassy design with neon accents.

## Features

- 🌙 **Dark Mode Design**: Beautiful dark theme with glass morphism effects
- ✨ **Neon Accents**: Vibrant neon colors (green, blue, pink) for visual appeal
- 💬 **Real-time Chat**: Instant messaging with typing indicators
- 📱 **Responsive**: Works perfectly on desktop and mobile devices
- 🎨 **Adaptive Text**: Proper paragraph handling and text formatting
- 🔄 **Session Management**: Chat history persistence during session
- ⚡ **Modern UI**: Smooth animations and transitions
- 🎯 **Accessibility**: Keyboard shortcuts and screen reader friendly
- **Permit Fetcher**: Upload, paste, or live-fetch PPRBD Single-Family permits with valuation data, optional homeowner-only filtering, and a 30/60 day range toggle

## Quick Start

### Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

### Installation

1. **Clone or download this project** to your desired location

2. **Navigate to the project directory**:
   ```bash
   cd foremanaiv2
   ```

3. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure your OpenAI credentials** (create a `.env` file or export environment variables):
   ```bash
   echo OPENAI_API_KEY=sk-your-key-here > .env
   echo OPENAI_MODEL=gpt-3.5-turbo >> .env  # optional, defaults to gpt-3.5-turbo
   ```
   > On Windows PowerShell use:
   > ```powershell
   > Set-Content .env "OPENAI_API_KEY=sk-your-key-here`nOPENAI_MODEL=gpt-3.5-turbo"
   > ```

5. **Run the application**:
   ```bash
   python app.py
   ```

6. **Open your browser** and go to:
   ```
   http://localhost:5000
   ```

## Project Structure

```
foremanaiv2/
├── app.py                 # Flask backend server
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
└── static/
    ├── css/
    │   └── styles.css    # Styles with dark theme & glass effects
    └── js/
        └── chat.js       # Chat functionality and interactions
```

## Features in Detail

### Backend (Flask)
- RESTful API endpoints for chat functionality
- Session management for chat history
- Error handling and validation
- CORS support for development
- Modular design for easy AI integration
- Built-in OpenAI integration via environment variables

### Frontend Features
- **Glass Morphism Design**: Modern frosted glass effects
- **Neon Color Scheme**: Eye-catching accent colors
- **Adaptive Textarea**: Auto-resizing input field
- **Typing Indicators**: Visual feedback during AI responses
- **Character Counter**: Real-time input validation
- **Message Timestamps**: Time display for all messages
- **Keyboard Shortcuts**: 
  - `Enter`: Send message
  - `Shift + Enter`: New line
  - `Ctrl/Cmd + K`: Focus input
  - `Escape`: Clear input
- **Mobile Responsive**: Optimized for all screen sizes

### Chat Interface
- **Message Bubbles**: Distinct styling for user vs AI messages
- **Avatars**: Icon-based user and AI avatars
- **Smooth Animations**: Slide-in effects for new messages
- **Auto-scroll**: Automatic scrolling to latest messages
- **Clear Chat**: Option to reset conversation
- **Error Handling**: User-friendly error messages

## Customization

### Changing Colors
Edit the CSS variables in `static/css/styles.css`:

```css
:root {
    --neon-primary: #00ff88;    /* Primary neon green */
    --neon-secondary: #0088ff;  /* Secondary neon blue */
    --neon-accent: #ff0088;     /* Accent neon pink */
    /* ... other variables */
}
```

### AI Integration
Set the following environment variables (or use `.env`) to enable OpenAI Chat Completions:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo  # optional override
WEB_SEARCH_ENABLED=false    # set to true to enable web search
```

#### Web Search Feature

To enable web search capabilities that allow the AI to access up-to-date information:

1. Update your `.env` file:
   ```env
   WEB_SEARCH_ENABLED=true
   OPENAI_MODEL=gpt-5
   ```

2. Use a model that supports web search:
   - `gpt-5` (recommended for Responses API with web search)
   - `o4-mini` (Responses API)
   - `gpt-4o-search-preview` (Chat Completions API)
   - `gpt-4o-mini-search-preview` (Chat Completions API)

3. Restart the server

When enabled, the AI can:
- Search the web for current information
- Include cited sources with clickable links
- Provide up-to-date answers about recent events
- Access real-time data like weather, sports scores, etc.

**Note:** Web search uses the OpenAI Responses API and may have different pricing than standard chat completions. See [OpenAI pricing](https://openai.com/pricing#built-in-tools) for details.

The backend automatically loads these values on startup. If the variables are missing, the app provides clear fallback responses so you can still demo the UI.

### Adding Features
- **File Upload**: Extend the attach button functionality
- **Voice Messages**: Add speech-to-text integration
- **Message Reactions**: Implement emoji reactions
- **Chat Export**: Add download chat history feature

## Development

### Running in Development Mode
The app runs in debug mode by default, which enables:
- Auto-reload on file changes
- Detailed error pages
- Debug toolbar (if installed)

### Production Deployment
For production, consider:
- Setting `debug=False` in `app.py`
- Using a production WSGI server (Gunicorn, uWSGI)
- Setting up environment variables for secrets
- Implementing proper logging
- Adding database storage for chat history

## Browser Support

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ Internet Explorer (limited support)

## Contributing

Feel free to customize and extend this application! Some ideas:
- Add more themes or color schemes
- Implement user authentication
- Add chat rooms or channels
- Integrate with different AI providers
- Add message search functionality

## License

This project is open source and available for modification and distribution.

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port in `app.py`:
   ```python
   app.run(debug=True, host='0.0.0.0', port=5001)
   ```

2. **Module not found**: Ensure all dependencies are installed:
   ```bash
   pip install -r requirements.txt
   ```

3. **Static files not loading**: Check that the `static` and `templates` directories exist and contain the files.

### Getting Help

If you encounter issues:
1. Check the browser developer console for JavaScript errors
2. Check the Flask server logs in the terminal
3. Ensure all files are in the correct directory structure
4. Verify Python and pip are properly installed

---

Enjoy your new AI chat application! 🚀
