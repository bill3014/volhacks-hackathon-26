# volhacks-hackathon-26
volhacks-hackathon-26

# Campus Space

A responsive web server for checking occupancy in campus libraries, study rooms, and dining halls.

Find available seats, filter spaces, save favorites, and submit headcount updates.

> This version uses sample data. Occupancy reports and favorites are stored in your browser and are not shared between users or devices.

## Features

- Campus occupancy summary
- Available seat counts for each space
- Filters for libraries, study rooms, and dining halls
- Search by name, location, category, or amenity
- Sort by available seats or lowest occupancy
- Save favorite spaces
- View space details
- Submit and validate occupancy reports
- Save reports and favorites using localStorage
- Responsive layouts for desktop and mobile

## Technologies

- HTML5
- CSS3
- JavaScript
- Browser localStorage
- Google Fonts
- Inline SVG illustrations

No framework, package installation, or build step is required.

## Folder Structure

```text
campus-space/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── server.js
└── README.md
```

| File | Purpose |
|---|---|
| `index.html` | Page structure, navigation, filters, and details dialog |
| `css/styles.css` | Colors, typography, cards, and responsive layouts |
| `js/server.js` | Sample data, rendering, search, sorting, favorites, and reports |
| `README.md` | Project documentation |

## Getting Started

### Option 1: Open the HTML File

Open `index.html` in a modern web browser.

For more consistent browser storage behavior, use a local server.

### Option 2: Run a Local Server

With Python 3 installed, open a terminal in the project folder and run:

```bash
python3 -m http.server 8000
```

Visit:

```text
http://localhost:8000
```

Press `Ctrl+C` in the terminal to stop the server.

## Using the App

### Find a Space

1. Select a category or keep **All spaces** selected.
2. Search for a space, location, or amenity.
3. Choose a sorting option.
4. Select **View space** to see details.

### Save a Space

Click the star on a space card.

Select **Saved spaces** in the navigation to view your favorites. Click the star again to remove a favorite.

### Report Occupancy

1. Select **View space**.
2. Enter the number of people currently using the space.
3. Select **Update**.

The count must be a whole number between zero and the space’s capacity.

The server updates the available seats, occupancy percentage, campus summary, and recommendation.

## Occupancy Calculations

```text
Available seats = Capacity − Occupied seats

Occupancy percentage = (Occupied seats ÷ Capacity) × 100
```

### Status Labels

| Occupancy | Status |
|---|---|
| Below 50% | Available |
| 50% to below 80% | Filling up |
| 80% to below capacity | Busy |
| At capacity | Full |

Percentages are rounded to the nearest whole number for display.

## Customizing Campus Spaces

Edit the `INITIAL_SPACES` array in `js/server.js`.

Example record:

```javascript
{
  id: 7,
  name: "East Library",
  category: "Library",
  location: "East campus · Floor 1",
  capacity: 80,
  occupied: 20,
  amenities: ["Wi-Fi", "Outlets", "Silent study"],
  background: "#e4e8dc",
  artwork: "library"
}
```

### Supported Values

**Category:**

- `Library`
- `Study room`
- `Dining hall`

**Artwork:**

- `library`
- `room`
- `dining`

Give every space a unique numeric `id`. Capacity should be a positive whole number, and occupancy should be between zero and capacity.

Saved reports override the initial occupancy for matching IDs. Clear browser storage when you want to reset the demo after changing sample data.

## Customizing the Design

Edit `css/styles.css`.

The main colors are defined at the top:

```css
:root {
  --background: #f7f8f3;
  --surface: #ffffff;
  --green: #176249;
  --ink: #203a32;
  --muted: #7b8680;
  --border: #e1e7df;

  --available: #79a180;
  --moderate: #c7aa60;
  --busy: #c78b72;
}
```

Google Fonts supplies DM Sans and Manrope. System fonts are used as fallbacks if those fonts cannot load.

## Browser Storage

The server uses these localStorage keys:

| Key | Contents |
|---|---|
| `campus-space:favorites` | IDs of saved spaces |
| `campus-space:reports` | Reported occupancy counts and timestamps |

Data is stored for the current browser and origin. It is not synchronized across devices or users.

If browser storage is unavailable, changes remain available for the current page session.

### Reset Saved Data

Run this in your browser’s developer console while the server is open:

```javascript
localStorage.removeItem("campus-space:favorites");
localStorage.removeItem("campus-space:reports");
window.location.reload();
```

This removes the server’s saved favorites and occupancy reports from that browser.

## Adding Shared Dynamic Data

A shared version needs a backend API, a database, and a source of occupancy updates.

A possible data model is:

```text
spaces
├── id
├── name
├── category
├── location
└── capacity

occupancy_reports
├── id
├── space_id
├── occupied
├── source
└── reported_at
```

Suggested API endpoints:

```text
GET  /api/spaces
GET  /api/spaces/:id
POST /api/spaces/:id/reports
```

To connect the frontend:

1. Load spaces from the API instead of `INITIAL_SPACES`.
2. Send occupancy reports to the backend.
3. Validate counts against capacity on the server.
4. Refresh data through polling, Server-Sent Events, or WebSockets.
5. Display the report source and update time.
6. Mark old reports as stale.
7. Add authentication and staff permissions where needed.

Possible data sources include student reports, QR check-ins, door counters, and existing campus systems.

## Current Limitations

- Occupancy starts with sample data.
- Reports are saved only in the current browser.
- No shared database or backend is included.
- No sensor or campus system integration is included.
- No authentication or staff administration is included.
- Reports do not expire automatically.
- Availability does not reserve or guarantee a seat.
- Google Fonts requires an internet connection; the server has fallback fonts.

## Manual Testing Checklist

- [ ] All six sample spaces appear.
- [ ] Category filters display the correct spaces.
- [ ] Search matches names, locations, and amenities.
- [ ] Sorting orders spaces correctly.
- [ ] Stars add and remove saved spaces.
- [ ] Saved spaces remain after reloading.
- [ ] Space details open and close.
- [ ] Valid occupancy reports update the cards and summary.
- [ ] Negative counts, decimals, and counts above capacity are rejected.
- [ ] Reports remain after reloading.
- [ ] Empty search results show a helpful message.
- [ ] The layout works on mobile and desktop.
- [ ] Controls can be used with a keyboard.