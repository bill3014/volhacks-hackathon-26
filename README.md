```markdown
# Vol Map

Vol Map is a campus occupancy explorer for the University of Tennessee, Knoxville. It helps students find places to study, eat, meet, and spend time by presenting building information through a searchable dashboard and an interactive 3D map.

The project combines shared occupancy reports with clearly labeled demonstration data to show how campus availability could be tracked and explored.

## What You Can Do

### Explore Campus Spaces

The main dashboard displays campus buildings as cards with information such as:

- Building name and location
- Capacity, when available
- Reported occupancy and available seats
- Crowd-level indicators
- Report age and data source

Students can search by building name, location, or amenity; filter by category; and sort by availability or crowd level. A Clear filters control restores the full list.

### Browse Residence Halls

The Residence halls filter provides access to a floor-by-floor study-room view. Each included hall has two demonstration study rooms per floor, with room capacity, occupancy, availability, and amenities.

These room layouts are illustrative. Floor counts come from the supplied map data where available, with missing counts labeled as estimates.

### Explore the 3D Map

The map displays campus building footprints in 3D using MapLibre GL. Users can search for buildings, select them for more information, and switch between tilted 3D and overhead views.

Buildings are colored by crowd level, making it easier to compare activity across campus.

### Simulate Occupancy Over Time

A time slider lets users explore simulated occupancy throughout a typical day in 15-minute increments. Playback animates those changes, updating building colors, estimated headcounts, the building list, and open information popups.

The simulation uses different patterns for different building types. For example, libraries become busier later in the day, while dining spaces peak around meal times.

The timeline is a demonstration, not recorded history or a prediction. It does not write changes to Supabase.

### Submit Occupancy Reports

Users can sign in through an emailed link and submit a headcount for a building. Supabase validates the submission, stores it in report history, and updates the building’s current occupancy.

Saved spaces let students quickly return to buildings they use frequently. Favorites are currently stored in the browser.

## How the Project Works

### Frontend

The interface is built with HTML, CSS, and JavaScript.

JavaScript loads building records from Supabase and renders the dashboard. It also handles searching, filtering, sorting, saved spaces, building details, and residence-hall study-room navigation.

The dashboard refreshes approximately every 30 seconds while the page is visible.

### Database and Authentication

Supabase provides the PostgreSQL database and email-link authentication.

The database stores:

- Building names, locations, map IDs, and footprints
- Capacities and explanations of demo estimates
- Occupancy reports and submission timestamps
- Residence-hall floor information and demonstration study rooms
- Building visibility settings

Row Level Security controls access to records. Visitors can browse building availability, while signed-in users submit reports through a database function that validates counts.

### Availability Calculations

When a building has both a capacity and a fresh occupancy report:

- Available seats are calculated by subtracting occupancy from capacity.
- Occupancy percentage is calculated by dividing occupancy by capacity.
- A status label indicates whether the building is available, filling up, busy, or full.

Unknown occupancy is kept separate from zero occupancy. Reports become stale after the configured freshness window, which defaults to 30 minutes.

Dashboard seat totals and crowd recommendations use fresh reports with known capacities. Buildings without enough information remain visible, but their availability is shown as unknown.

## Data and Demonstration Features

Vol Map uses building footprints and metadata from the supplied campus map dataset. Specific building names and street addresses are retained; vague landmark-based placeholders are hidden.

Where verified capacities are unavailable, the demo uses estimates based on building names, likely uses, footprint areas, and floor counts. These estimates are labeled and are not official occupancy limits.

Simulated counts help demonstrate the interface before live reporting or sensor integrations are available. They are identified separately from user-submitted reports.

The map simulation and dashboard reports are separate data flows. Moving the map’s time slider does not change the dashboard’s shared occupancy records.

## Current Scope

Vol Map is a working prototype rather than a live campus monitoring system. It does not currently include:

- Automatic occupancy sensors
- Verified capacities for every building
- Verified residence-hall study-room inventories
- Seat reservations or guaranteed availability
- Historical playback of actual campus occupancy

Future development could connect campus data feeds or sensors, verify building and room information, and use collected reports to support historical occupancy analysis.

## Project Goal

Vol Map aims to make campus spaces easier to discover and compare. By bringing location, occupancy, and availability into one interface, it helps students spend less time searching for a space and more time using it.
```