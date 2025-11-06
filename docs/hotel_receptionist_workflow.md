# Hotel Receptionist Automation Workflow

This document explains the structure of the **Hotel Reception Automation** workflow that runs entirely inside n8n and does not rely on third-party APIs. The automation supports the front desk team with booking intake, confirmations, housekeeping tasks, and daily briefings.

## Overview

The workflow bundle includes:

- `workflows/hotel_reception_automation.json` – the n8n workflow export.
- `data/rooms.json` – starter room inventory used the first time the workflow runs.
- `data/sample_reservations.json` – example booking record for reference when seeding data manually.
- `data/housekeeping_tasks.csv` – placeholder CSV if you decide to sync the housekeeping queue to a spreadsheet later.

### Core capabilities

1. **Booking intake form** – Uses the n8n Form Trigger node so that receptionists can submit a simple internal form without needing any external services.
2. **Automated availability check** – A Code node stores inventory and reservations using `workflowStaticData`. It assigns an available room, calculates stay length, and prevents conflicts.
3. **Instant confirmations** – On successful bookings the workflow drafts confirmation emails for the guest, reception inbox, and housekeeping.
4. **Conflict handling** – Guests receive a friendly decline message if no rooms are available or dates are invalid.
5. **Daily summary** – A Cron trigger compiles check-ins, check-outs, and next-day housekeeping preparation into a morning digest email.

## Importing the workflow

1. Open your n8n instance and navigate to **Workflows → Import from File**.
2. Select `workflows/hotel_reception_automation.json` from this repository.
3. After import, update the email nodes (`Send Confirmation Email`, `Notify Reception`, `Notify Housekeeping`, and `Send Daily Briefing`) with your SMTP credentials or switch them to another delivery method such as Slack or Microsoft Teams if preferred.
4. Activate the workflow when you are ready (all triggers remain inactive until you do).

## Form trigger configuration

- **Node**: `New Booking Form`
- **Usage**: n8n will generate a shareable link once the workflow is saved. Receptionists can bookmark the form to capture guest details directly at the desk or over the phone.
- **Fields captured**: guest name, email, phone number, room type, party size, stay dates, and optional notes.
- **Response**: the form displays the JSON returned by the `Respond to Guest (Success)` or `Respond to Guest (Failure)` nodes. You can customise these nodes to show cleaner HTML or redirect to a branded thank-you page.

## Availability logic

The `Check & Save Booking` Code node orchestrates room allocation.

- Inventory is initialised from the hard-coded fallback (matching `data/rooms.json`) the first time the workflow runs. Afterwards, all edits happen in `workflowStaticData`, persisting between executions.
- Reservations are stored in `workflowStaticData.reservations`. They include confirmation code, stay dates, contact details, and any notes.
- Each new booking checks for conflicting reservations on the requested room type. If everything is available, it assigns the first free room, calculates nights, total rate, and builds a housekeeping task scheduled for the check-out date.
- When no rooms are free, the workflow returns a decline payload without altering the stored data.

### Customising room inventory

To adjust available rooms without editing the Code node:

1. After importing, open the workflow in n8n.
2. Execute the workflow once with the **Manual Trigger** to initialise `workflowStaticData`.
3. Open the workflow menu → **Workflow settings → Static Data**. You can download the JSON, edit the room list, and upload it again. Future runs will honour the customised data.

## Email notifications

All email nodes use placeholder addresses (`frontdesk@example.com`, etc.). Replace them with valid inboxes and configure the SMTP options in each node:

- **Host** – Your SMTP server (e.g. `smtp.office365.com`).
- **Port** – Typically `587` for TLS.
- **User / Password** – Mailbox credentials or an app password.

If you prefer not to send emails, you can switch these nodes to other channels (for example Slack, Mattermost, or Microsoft Teams) by replacing the nodes while keeping the same connections.

## Daily briefing digest

- **Trigger**: `Daily Schedule` Cron node (defaults to 07:00 server time).
- **Computation**: `Build Daily Summary` Code node scans the stored reservations and prepares a plain-text digest of today's check-ins, check-outs, and tomorrow's turnovers.
- **Delivery**: `Send Daily Briefing` Email node sends the digest to the reception inbox.

You can add additional recipients (e.g. housekeeping manager) by duplicating the node or enabling CC/BCC in the node options.

## Extending the automation

- **Housekeeping queue export** – Connect the success branch to a `Spreadsheet File` node to append the `housekeepingTask` object into `data/housekeeping_tasks.csv` for offline tracking.
- **Payments** – Add a `Manual` or `Wait` node before confirmation if you need to capture deposits manually.
- **Upsell reminders** – Insert a `Delay` node after confirmation to send a follow-up email a few days before arrival.

## Testing tips

1. Use the **Execute Workflow** button with test data to ensure the form and booking logic behave as expected.
2. Inspect the `Execution Data` in n8n to verify the contents of `workflowStaticData` after each run.
3. Simulate conflicts by submitting overlapping dates for the same room type— the workflow should return a decline response.

With these assets in place, your front desk team gains a repeatable process that removes manual coordination and provides timely updates without relying on external APIs.
