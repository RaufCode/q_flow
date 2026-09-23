# Q-Flow — How to Explore the App (for Testers & Team)

Welcome! This short guide helps **non-technical teammates** find their way around
**Q-Flow**, the queue management system, so you can try every screen, spot bugs,
and share suggestions.

---

## 1. How to open the app

The app connects to the **live backend**, so sign-in uses the accounts provisioned there.

1. Ask a developer to start the app, or if you have **Node.js** installed:
   - open a terminal inside the `frontend` folder and run `npm install` (only the first time)
   - then run `npm run dev`
   - open your browser at **http://localhost:3000**
2. Bookmark the pages below so you can jump straight to them.

---

## 2. Demo accounts (for testing)

The app now talks to the **live backend** (`https://qflowee-backend.vercel.app/api/v1`), so
use the accounts provisioned there:

| Screen you want | Employee ID | Password |
| -------------- | ----------- | -------- |
| **Admin dashboard** | `ADM-001` | `ftfr` |
| **Staff dashboard** | `111` | `123456789` |

Staff accounts are created from the **Staff** tab of the admin dashboard. Sign in
as admin, add a staff member, and use the credentials shown after creation.

---

## 3. The main screens

Use the login pages to sign in, then try each dashboard below.

| Page | Address | What it is |
| ---- | ------- | ---------- |
| **Sign in (real login)** | `http://localhost:3000/` | Where admins and staff actually sign in. |
| **Login demo page** | `http://localhost:3000/login` | A clean login form to check the inputs and messages (not connected to a server). |
| **Admin dashboard** | `http://localhost:3000/admin` | Everything an admin manages: overview, counters, staff, tickets and QR codes. |
| **Staff dashboard** | `http://localhost:3000/staff` | What a counter staff member sees: overview, queue and history. |
| **Choose a counter** | `http://localhost:3000/staff/counter` | Where staff pick which counter they are working at before starting. |
| **Customer ticket form** | `http://localhost:3000/ticket-registration` | The form a customer fills in after scanning the QR code (name and phone). |
| **Admin sign-up page** | `http://localhost:3000/admin/register` | Where a new admin account can be created. |

### Admin dashboard tabs (left menu)

- **Overview** – the daily numbers: tickets today, served, waiting, and activity.
- **Counters** – add or remove counters.
- **Staff** – see staff members and reset passwords.
- **Tickets** – the full queue list, create a priority ticket, change a ticket's status, search and page through tickets.
- **QR Codes** – generate and download the QR code customers scan to join the queue.

> 💡 **Refresh tip:** if you are on the **Tickets** tab and refresh the page, the
> app remembers and stays on **Tickets**. When you log in again fresh, it always
> opens on **Overview**.

### Staff dashboard tabs (left menu)

- **Overview** – your numbers and the next ticket to call.
- **Queue** – the waiting list sorted by position (oldest first). Use the **All / Waiting / Called** pills and the search box to narrow it down. The **Call Next** button pulls the next customer to your counter, and quick actions sit beside the ticket currently being called or served.
- **History** – tickets already finished (skipped, served, cancelled, auto-cancelled). Filter by status with the dropdown and search by name, ticket number or phone.

### Ticket actions by status

Every action button follows the ticket's current status, so you can only do what
makes sense at that point in the flow:

| Status | Available actions |
| ------ | ----------------- |
| **Called** | Start Service, Recall, Skip, Mark as No Show |
| **In service** | Complete Service |
| **Waiting** | (none—use **Call Next** on the Queue page) |
| **Served / Skipped / Cancelled** | none |

- **Start Service** – customer arrived; moves the ticket to *In service*.
- **Complete Service** – transaction finished; marks the ticket *Served*.
- **Recall** – re-sends the counter-call notification without changing the status.
- **Skip** – sends the customer to the back of the queue (auto-cancels after 3 skips).
- **Mark as No Show** – cancels the ticket immediately.

Destructive actions (**Skip** and **Mark as No Show**) ask for confirmation first.

### Choosing a counter (staff)

After signing in without an active shift, staff land on the **Select Your Counter** page:

- A list of **available counters & tellers** is shown (with online/offline status). Clicking one fills the **Counter ID** automatically.
- If a counter doesn't appear (e.g. it's being used by someone else, or its ID wasn't synced), type the **Counter ID** provided by the branch administrator into the box and press **Start Shift**.
- Once bound, you can copy the Counter ID, go to the dashboard, or end the shift.

---

## 4. What to look for when testing (bug checklist)

Good places to try to "break" the app:

**Login pages** (`/` and `/login`)
- Leave fields empty and press Sign In — clear messages should appear.
- Type just spaces in a field — it should be treated like an empty field.
- Toggle the 👁 show/hide password button.

**Admin dashboard**
- Click each tab in the left menu and refresh — you should stay on the same tab.
- Add a counter and check it appears in the Counters list.
- Create a **New Priority Ticket** and check the form validates the name/phone.
- Change a ticket's status from the dropdown in Tickets.
- Generate a QR code and download the image.

**Staff dashboard**
- Sign in, then pick a counter on the Counter page (or sign in with an active shift to land straight on the dashboard).
- Call the next ticket (the button shows who is next), serve, skip or recall.
- Use the Queue pills and search, then check the Queue shows *Position* first, oldest first.
- Check the History tab shows the tickets you finished and that the status dropdown filters them correctly.

**Customer ticket form** (`/ticket-registration`)
- Submit empty, or invalid phone numbers (e.g. `123`), and confirm the error messages.
- Submit a valid name + phone and confirm you are taken to the ticket status page.

---

## 5. How to report a bug or suggestion

When something looks wrong, send the team this info so we can fix it fast:

1. **Which screen** you were on (e.g. Admin → Tickets tab).
2. **What step** you did (e.g. "Created a priority ticket with name John").
3. **What you expected** vs **what happened instead**.
4. **Which browser** (Chrome, Safari, Edge…) and the **address bar URL** at the time.
5. A **screenshot** or screen recording if possible.

Your suggestion doesn't have to be technical — if something feels confusing,
hard to find, or could look better, that is exactly what we want to hear. 🎯