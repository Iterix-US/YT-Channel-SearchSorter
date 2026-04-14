# YouTube Channel Search Sorter

A browser extension that adds sort and filter controls to YouTube channel search results.

YouTube's channel search pages (e.g. `@ChannelName/search?query=minecraft`) don't provide any way to sort results. This extension adds a toolbar with sorting and content-type filtering.

## Features

- **Sort by date** - Newest first, oldest first, or YouTube's default order
- **Content-type filtering** - Show videos first, playlists first, or mixed
- **Persistent preferences** - Your sort and filter choices are saved across sessions
- **Theme-aware** - Matches YouTube's dark and light themes
- **Lightweight** - No background processes, no external requests, no data collection

## Installation

### From source (Chrome / Opera / Edge)

1. Download or clone this repository
2. Open your browser's extension management page:
   - Chrome: `chrome://extensions`
   - Opera: `opera://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the extension folder

### From the Chrome Web Store

_Coming soon_

## Usage

1. Navigate to any YouTube channel
2. Click the **Search** tab (magnifying glass icon) and enter a search term
3. The sort toolbar appears above the results once they finish loading
4. Click any button to sort or filter - changes apply instantly

## How It Works

The extension runs a content script on YouTube pages. When it detects a channel search page (`/@channel/search`), it waits for YouTube to fully load all search results, then injects a toolbar and enables client-side sorting.

Sorting is done by reordering existing DOM elements. Dates are parsed from YouTube's relative timestamps (e.g. "11 months ago") into approximate absolute dates for comparison. Since YouTube only provides relative dates, items within the same relative period may not be perfectly ordered.

## Permissions

- **storage** - Saves your sort/filter preferences locally
- **Host permission** (`youtube.com`) - Required for the content script to run on YouTube

No data is collected, transmitted, or shared.

## Browser Compatibility

- Google Chrome 88+
- Opera 74+
- Microsoft Edge 88+
- Any Chromium-based browser supporting Manifest V3

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

## Author

Published by **Iterix**

This project was developed with the assistance of AI tools.
