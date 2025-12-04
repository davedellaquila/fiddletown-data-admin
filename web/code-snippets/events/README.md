# Events Code Snippets

This directory contains code snippets for displaying events on Squarespace.

## Files

- **`event-list.html`** - The complete code to paste into Squarespace Code Injection
- **`event-list-dev.html`** - Local development preview (open in browser)
- **`event-list.js`** - Separated JavaScript for easier editing during development

## Development Workflow

### Option 1: Local Development (Recommended)

1. **Open the dev file** in your browser:
   ```bash
   open code-snippets/events/event-list-dev.html
   ```
   Or just double-click `event-list-dev.html` in Finder

2. **Edit the JavaScript**:
   - Make changes to `event-list.js`
   - Refresh the browser to see changes
   - Use browser DevTools (F12) to debug

3. **When ready to deploy**:
   - Copy the code from `event-list.html` 
   - Paste into Squarespace: Settings → Advanced → Code Injection → Footer

### Option 2: Direct Editing

1. Edit `event-list.html` directly
2. Copy the code between the comment markers
3. Paste into Squarespace Code Injection

## Tips

- The dev file uses the same JavaScript but loads it as a separate file for easier editing
- You can use browser DevTools to inspect and debug
- Changes to `event-list.js` are immediate (just refresh)
- The final `event-list.html` bundles everything into one file for Squarespace

## Structure

The code is organized into:
- **Widget initialization** - Sets up the widget and handles caching
- **Data fetching** - Fetches events and keywords from Supabase
- **Rendering** - List and grid layout renderers
- **Filtering** - Keyword and date range filtering
- **Event handlers** - Layout switching, filtering, hover previews
- **Styling** - Injected CSS styles

