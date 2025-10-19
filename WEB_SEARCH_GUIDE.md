# Web Search Implementation Guide

## What's Been Added

Your chat application now supports OpenAI's web search feature, which allows the AI to:
- Search the internet for current information
- Provide answers with cited sources
- Access real-time data (weather, sports, news, etc.)
- Give up-to-date responses instead of being limited to training data

## Current Setup

By default, web search is **DISABLED** and the app uses the standard GPT-3.5-turbo model.

You can see the current status in the server startup banner:
```
==================================================
Flask Chat Server Starting...
OpenAI API Key: Configured
Model: gpt-3.5-turbo
Web Search: Disabled
Server will run on: http://127.0.0.1:5000
==================================================
```

## How to Enable Web Search

### Step 1: Update Your .env File

Open the `.env` file and change these settings:

```env
# Change the model to one that supports web search
OPENAI_MODEL=gpt-5

# Enable web search
WEB_SEARCH_ENABLED=true
```

### Step 2: Choose a Compatible Model

Web search works with these models:

**Responses API (Recommended):**
- `gpt-5` - Best for general use with web search
- `o4-mini` - Faster, more economical option
- `gpt-4.1` - Advanced reasoning with web search
- `o3-deep-research` - For in-depth research tasks

**Chat Completions API:**
- `gpt-4o-search-preview` - GPT-4o with web search
- `gpt-4o-mini-search-preview` - Smaller, faster variant

### Step 3: Restart the Server

After updating `.env`, restart the Flask server. You should see:

```
Web Search: Enabled
```

## Testing Web Search

Once enabled, try asking questions that require current information:

- "What are the latest news headlines today?"
- "What's the weather in London right now?"
- "Who won the game last night?"
- "What are the current stock prices for Apple?"

## How It Works

### Code Implementation

The implementation uses OpenAI's Responses API:

```python
response = openai_client.responses.create(
    model="gpt-5",
    tools=[{"type": "web_search"}],
    input=user_message
)
```

### Citation Handling

When web search is used, the AI includes:
1. **Inline citations** in the response text
2. **Source links** with URLs and titles
3. **Formatted references** at the end of responses

Example response format:
```
Based on recent reports, [topic information here].

**Sources:**
[Article Title](https://example.com/article)
[Another Source](https://example2.com/page)
```

## Pricing Considerations

Web search has different pricing than standard chat:
- **Tool call cost**: Each web search incurs a tool usage fee
- **Model pricing**: Varies by model (gpt-5, o4-mini, etc.)

See [OpenAI Pricing - Built-in Tools](https://openai.com/pricing#built-in-tools) for current rates.

## Advanced Features (Future Implementation)

The code is ready to support these features if needed:

### Domain Filtering
Limit searches to specific websites:
```python
tools=[{
    "type": "web_search",
    "filters": {
        "allowed_domains": [
            "wikipedia.org",
            "github.com",
            "stackoverflow.com"
        ]
    }
}]
```

### User Location
Provide location context for better results:
```python
tools=[{
    "type": "web_search",
    "user_location": {
        "type": "approximate",
        "country": "US",
        "city": "New York",
        "region": "NY"
    }
}]
```

### View All Sources
Get complete list of consulted URLs:
```python
include=["web_search_call.action.sources"]
```

## Troubleshooting

### "Model does not support web search"
- Make sure you're using a compatible model (gpt-5, o4-mini, etc.)
- Check that WEB_SEARCH_ENABLED=true in .env

### No citations appearing
- The Responses API handles citations differently than Chat Completions
- Make sure you're using the Responses API models

### API errors
- Verify your OpenAI API key has access to the selected model
- Check OpenAI service status if requests fail
- Review the server logs for detailed error messages

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-3.5-turbo` | Model to use |
| `WEB_SEARCH_ENABLED` | `false` | Enable/disable web search |

### Example .env for Web Search

```env
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-5
WEB_SEARCH_ENABLED=true
```

### Example .env for Standard Chat

```env
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-3.5-turbo
WEB_SEARCH_ENABLED=false
```

## Notes

- Web search requires internet connectivity
- Responses may take longer due to web searches
- Not all queries will trigger a web search (the model decides)
- Citations are displayed inline with markdown formatting

---

For more information, see the [OpenAI Web Search Documentation](https://platform.openai.com/docs/guides/web-search).
