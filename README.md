# Mambillah Hotels Virtual Receptionist (n8n)

This repository provides everything you need to deploy an n8n workflow that acts as a virtual receptionist for Mambillah Hotels. The workflow is fully open-source, uses only community/self-hosted APIs, and handles both phone calls and chat messages. It greets guests conversationally, answers questions, checks availability, creates reservations, shares menu details, and provides driving directions.

## Contents
- `README.md` (this file): Setup and usage guide.
- `mambillah-virtual-receptionist.json`: n8n workflow export you can import directly.

## 1) Prerequisites
- Docker + Docker Compose
- Git
- An SMTP account (for optional email confirmations)
- (Optional) Twilio phone number for call handling
- n8n credentials for HTTP Request nodes (created inside n8n UI)

## 2) Deploy supporting open-source services

### RoomReserve (hotel booking REST API)
1. Clone the upstream project:
   ```bash
   git clone https://github.com/daniel-szulc/hotel-booking-restAPI.git
   cd hotel-booking-restAPI
   ```
2. Start the stack (Spring Boot + MySQL):
   ```bash
   docker-compose up -d
   ```
3. By default, the API listens on `http://localhost:8080` when launched locally. In production, expose it on a reachable hostname (e.g., `https://roomreserve.example.com`) and open the port in your reverse proxy. The API exposes authentication plus endpoints for rooms, availability, reservations, and guests. Create an API user in the RoomReserve UI or via the `/api/auth/register` endpoint, then authenticate in n8n using the HTTP Request node's basic auth fields.

### Menu & drinks dataset
- Create or fork a simple GitHub repo containing a `menu.json` file (or use GitHub Gist raw URLs). Example file contents:
  ```json
  [
    { "item": "Tilapia fish pepper soup", "price": 3500 },
    { "item": "Goat meat", "price": 3200 },
    { "item": "Peppered turkey", "price": 3100 },
    { "item": "Chapman", "price": 1800 },
    { "item": "Fresh juice", "price": 1500 }
  ]
  ```
- Copy the **raw** URL (e.g., `https://raw.githubusercontent.com/<user>/<repo>/main/menu.json`) and paste it into the `MENU_JSON_URL` environment variable inside n8n.

### OpenStreetMap / Nominatim + OSRM (directions)
- Nominatim (geocoding): use the public endpoint `https://nominatim.openstreetmap.org/search?format=json&q=...`.
- OSRM routing: `https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false&steps=true`.
- Respect usage policies: send a descriptive `User-Agent`, throttle requests, and cache results when possible.

### (Optional) Open-source Speech-to-Text
- Self-host Vosk Server for STT (`https://github.com/alphacep/vosk-server`). Example quick start:
  ```bash
  docker run -d --name vosk -p 2700:2700 alphacep/kaldi-ru:latest
  # Replace image with an English model, e.g., alphacep/kaldi-en:latest
  ```
- Set `STT_HTTP_URL` to the server endpoint (e.g., `http://vosk:2700`) and ensure your trigger sends `RecordingUrl` audio links to the workflow.

## 3) Install n8n via Docker
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=changeme \
  n8nio/n8n:latest
```

Inside n8n, create credentials for:
- HTTP Request (RoomReserve auth, menu JSON fetch, Nominatim/OSRM with custom headers)
- SMTP (for confirmations)
- Twilio (if you use the Twilio Trigger node)
- SQLite/PostgreSQL (for audit logging)

## 4) Environment variables used in the workflow
Configure these in n8n (Settings → Environment Variables or via a Set node):

| Variable | Purpose |
| --- | --- |
| `ROOMRESERVE_BASE_URL` | Base URL of the RoomReserve API (e.g., `https://roomreserve.example.com`). |
| `ROOMRESERVE_USERNAME` / `ROOMRESERVE_PASSWORD` | Basic auth for RoomReserve endpoints. |
| `MENU_JSON_URL` | Raw GitHub URL of the `menu.json` file. |
| `STT_HTTP_URL` | Base URL of your Vosk STT server (optional if transcript already provided). |
| `HOTEL_ADDRESS` | `#6/10 Omodisu Street, off Isawo Road, Ajaguro, Agric Bus Stop, Ikorodu, Lagos`. |
| `RESERVATIONS_PHONE` | `+234 915 097 1789`. |
| `COMPLAINTS_PHONE` | `+234 705 274 2525`. |
| `RESERVATIONS_EMAIL` | `reservations@mambillahhotels.com`. |
| `CLUB_DAYS` | `Thursday–Saturday`. |
| `CLUB_HOURS` | `6 pm – 2 am`. |
| `GYM_HOURS` | `8 am – 12 pm daily`. |
| `AUDIT_DB_PATH` | Path to SQLite database file, e.g., `/home/node/.n8n/mambillah-audit.sqlite`. |

Room prices and features are stored inside the workflow Set node and can be edited after import.

## 5) Import the workflow
1. Start n8n on a public URL (for example behind a reverse proxy such as Traefik or Nginx) and open `https://n8n.yourdomain.com`.
2. Click **Import from File** and select `mambillah-virtual-receptionist.json` from this repo.
3. Open each HTTP Request node and point it at your credentials:
   - **RoomReserve** nodes: Basic Auth or header-based token.
   - **Menu fetch** node: No auth, but add a `User-Agent` header.
   - **Nominatim/OSRM** nodes: Add `User-Agent: mambillah-virtual-receptionist/1.0` and throttling.
4. Update the Webhook URL (if using the Webhook trigger) or Twilio callback URL (if using the Twilio Trigger) to match your public endpoint.

## 6) Workflow logic (high level)
- Triggered by either a **Webhook** or **Twilio Call Trigger**. All nodes used are standard, verified n8n nodes available as of 24-Nov-2025; no custom community code is required.
- If audio is present, it is sent to a Vosk STT HTTP endpoint; otherwise, incoming text is used directly.
- A **Code** node classifies intent: booking, availability, room info, menu, club, gym, or directions. Unknown intent leads to clarifying questions or escalation.
- Static hotel info (address, hours, contact numbers, room prices/features) is loaded via a **Set** node.
- Branches handle:
  - **Booking / Availability**: Calls RoomReserve `/api/rooms/available`, `/api/guest/create`, and `/api/reservation/createReservation`, then returns a confirmation with reservation ID.
  - **Room info**: Reads in-workflow data to answer price/amenity questions.
  - **Restaurant/Bar**: Fetches menu JSON from GitHub Raw, formats dishes/drinks with prices, and references Executive & Bush Bar highlights.
  - **Club**: Shares Club-M days/hours, mentions DJ/music/VIP sound-proofed space.
  - **Gym**: Shares daily 8 am–12 pm hours and open policy for guests and outsiders.
  - **Directions**: Geocodes caller and hotel addresses via Nominatim, then requests step-by-step directions from OSRM.
- A **SQLite** node logs each interaction for auditing (request text, intent, responses, API payloads).
- Error-handling **Function** nodes check HTTP status codes and return friendly messages.

## 7) Example webhook payloads / transcripts for testing
Use **Execute Workflow → Test** in n8n and inject one of the sample payloads into the Webhook node:

- Availability enquiry:
  ```json
  {
    "text": "Do you have any suites available from 25 Aug to 28 Aug?"
  }
  ```
- Booking flow:
  ```json
  {
    "text": "Book a Classic Deluxe for me from September 5th to 8th. My name is Ada, phone is 0803... and email is ada@example.com"
  }
  ```
- Menu question:
  ```json
  {
    "text": "What's on the Executive and Bush Bar menu tonight?"
  }
  ```
- Directions request:
  ```json
  {
    "text": "I'm at Ikeja City Mall. How do I drive to Mambillah Hotels?"
  }
  ```
- Club / Gym:
  ```json
  { "text": "When does the club open?" }
  { "text": "Is the gym open in the morning?" }
  ```

For Twilio voice tests, use Twilio's console to send a test call to the webhook URL exposed by n8n. Ensure the call recording URL is provided so the STT node can transcribe.

## 8) Notes on robustness
- Every HTTP Request node checks non-200 responses and funnels errors into a friendly response plus audit log.
- The intent classifier matches keywords and falls back to clarifying prompts when confidence is low.
- Responses include prices and amenities drawn from static data to avoid missing details.
- Follow-up confirmations can be emailed using the **Send Email** node (connect it to the booking branch after reservation creation).

## 9) Project structure
```
README.md
mambillah-virtual-receptionist.json
```

## 10) Next steps
- Wire your own SMTP or WhatsApp channel for confirmations.
- Extend menu.json with more dishes/drinks and re-run the workflow without code changes.
- Add rate-limiting or caching layers for Nominatim/OSRM if traffic is high.
