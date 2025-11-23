# Hotel Receptionist Automations (n8n)

This repository packages two production-ready n8n workflows that automate the core duties of a small hotel reception team without requiring any third-party APIs.

- **Hotel Front Desk Intake** – a sharable form that captures new reservations, normalises the payload, and automatically creates operational tasks in n8n Data Stores.
- **Hotel Daily Operations Digest** – a twice-daily scheduler that aggregates bookings and tasks from the Data Stores and produces a structured operations digest to keep staff aligned.

## Repository structure

```
workflows/
├── hotel_front_desk_intake.json     # Reservation intake + task generation workflow
└── hotel_daily_digest.json          # Scheduled digest + task monitoring workflow
```

## Prerequisites

These workflows are designed to run on a self-hosted n8n instance (v1.26.0 or later is recommended for the Data Store node improvements). No external services or paid connectors are required. Before importing the JSON files you should create three n8n Data Stores so that the workflows have a place to persist information:

1. `Bookings` – stores the canonical reservation records.
2. `Tasks` – tracks operational work generated per reservation (check-in, check-out, housekeeping).
3. `Digests` – archives the twice-daily dashboard payload for later review.

Copy each Data Store ID from the **Resources → Data Stores** screen. After import, replace the placeholder values in the node configuration (`BOOKINGS_DATASTORE_ID`, `TASKS_DATASTORE_ID`, and `DIGESTS_DATASTORE_ID`). You can either edit the nodes manually in the UI or set environment variables with those names so they resolve dynamically.

## Workflow walkthrough

### 1. Hotel Front Desk Intake

**Trigger:** `Form Trigger` node exposed at `/hotel-front-desk/new-reservation`. Share the generated public form link with staff to capture reservations without needing credentials.

**Key steps:**

1. **Prepare Booking Payload** (`Function` node)
   - Generates a unique booking ID, normalises arrival/departure dates, and calculates the default check-in/out/housekeeping timestamps.
   - Builds a trio of operational tasks aligned to each reservation.
2. **Booking Record** (`Set` node) → **Store Booking** (`Data Store` node)
   - Persists the reservation to the Bookings data store, retaining only the canonical fields used across the hotel.
3. **Split Task Items** (`Item Lists` node) → **Normalize Task Payload** (`Set` node) → **Store Task** (`Data Store` node)
   - Converts the generated tasks into individual records inside the Tasks data store for downstream automation.
4. **Reservation Summary** (`Set` node)
   - Provides a clean confirmation payload back to the form response so the receptionist sees the booking ID and scheduled actions immediately.

### 2. Hotel Daily Operations Digest

**Trigger:** `Cron` node that executes at 06:00 and 14:00 hotel time. Adjust the schedule to match your shift handovers.

**Key steps:**

1. **Fetch All Bookings / Aggregate Bookings**
   - Loads every reservation from the Bookings data store and wraps the results into a single item for downstream merging.
2. **Fetch All Tasks / Aggregate Tasks**
   - Mirrors the aggregation flow for the Tasks data store.
3. **Merge Datasets**
   - Aligns the aggregated booking and task arrays into a single payload.
4. **Build Digest** (`Function` node)
   - Calculates arrivals, departures, and stay-overs for the current day.
   - Flags outstanding operational tasks, including those due today and overdue.
   - Generates a digest ID and structured JSON sections for quick consumption.
5. **Save Digest** (`Data Store` node)
   - Archives each digest execution so you can review historical hotel activity or drive dashboards via n8n’s native data explorer.

The digest execution output is also accessible from the workflow’s past executions list, giving the receptionist an at-a-glance briefing every morning and afternoon without sending external notifications.

## Importing the workflows

1. Download the JSON files from the `workflows/` directory.
2. In n8n, open **Workflows → Import from File**, select the JSON, and confirm.
3. Update the Data Store node credentials as described above.
4. Activate each workflow. The intake form URL appears in the Form Trigger node once the workflow is active.

## Customisation ideas

- Add pricing logic in the `Prepare Booking Payload` node if you want to auto-calculate room rates.
- Introduce SMS or email notifications by appending communication nodes after `Reservation Summary` when you are ready to integrate with external providers.
- Extend the digest workflow with additional Cron runs (e.g. hourly) or connect it to n8n dashboards for wallboard displays.

With these two workflows running, your hotel reception staff can capture reservations, coordinate arrivals/departures, and monitor housekeeping commitments from a single, fully automated n8n setup—no third-party APIs required.

## Running locally on http://localhost:5678/

If you already have n8n running on your machine at `http://localhost:5678/`, use this checklist to stand up the workflows end-to-end:

1. **Create the data stores first** (Resources → Data Stores) and copy their IDs:
   - `Bookings`
   - `Tasks`
   - `Digests`
2. **Import the workflows** (Workflows → Import from File) using the JSON files in the `workflows/` folder.
3. **Wire the data stores** by opening each Data Store node and pasting the IDs from step 1 into the credentials fields (`BOOKINGS_DATASTORE_ID`, `TASKS_DATASTORE_ID`, `DIGESTS_DATASTORE_ID`).
4. **Activate the workflows.** The Form Trigger node in **Hotel Front Desk Intake** will display the public form link (e.g. `http://localhost:5678/form/hotel-front-desk/new-reservation`).
5. **Test a booking** via the form URL. Confirm the entries appear in **Data Stores → Bookings** and **Data Stores → Tasks**. The twice-daily digest will begin storing summaries in **Data Stores → Digests** once the Cron node runs.

Tip: if you prefer environment variables, set the three IDs in your n8n environment and reference them directly in the Data Store nodes to avoid hard-coding values in the workflow.
