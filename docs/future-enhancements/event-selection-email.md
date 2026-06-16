# Event Selection & Email (Squarespace)

| Field | Value |
|-------|-------|
| **ID** | FE-004 |
| **Status** | Specced |
| **Priority** | TBD (after Event Triage M1) |
| **Effort** | Medium |
| **Platforms** | Squarespace public widget + Supabase Edge Function |
| **Product area** | Events / public site |
| **Created** | 2026-06-15 (imported) |
| **Original source** | `~/.cursor/plans/event_selection_and_email_notification_for_squarespace_users_61698064.plan.md` |
| **Related** | [TODO.md](../../TODO.md) Event Management (print/email selections) |

---

## Summary

Let Squarespace visitors select events during a session (no account) and receive an email with selected event details. Uses `sessionStorage`, updates the hosted `event-list.js` widget, and a Supabase Edge Function (`send-event-email`) with Resend/SendGrid/etc.

---

## Implementation checklist

- [ ] Edge Function `supabase/functions/send-event-email/`
- [ ] HTML email template
- [ ] Selection UI + sessionStorage in event-list snippets
- [ ] Email request modal
- [ ] API call from client
- [ ] Email service configuration + rate limiting
- [ ] `docs/EVENT_SELECTION_EMAIL.md` (setup guide)
- [ ] Tests (single/multi select, errors, mobile)

---

## Promotion criteria

- [ ] Event Triage M1 shipped (D-008)
- [ ] Email provider chosen (Resend recommended in plan)
- [ ] PM confirms scope vs print-only item in TODO.md

---

# Event Selection and Email Notification Feature

## Overview

Allow Squarespace site visitors to select events they're interested in during their browsing session, then request an email with details of their selected events. This feature requires no account creation - users simply provide their email address when they have selected one or more events.

## Architecture

The implementation will use:

1. **Client-side selection tracking** - Store selected events in browser sessionStorage
2. **Supabase Edge Function** - Serverless function to handle email sending (secure, no API keys exposed)
3. **Email service** - Use Supabase's built-in email capabilities or integrate with a service like Resend/SendGrid

## Implementation Steps

### 1. Add TODO Item to Master List

**File**: `TODO.md`

Add new item under "Event Management" section:

```markdown
- [ ] Allow users to select events they're interested in during their session and send them an email with event details (no account required)
```

### 2. Create Supabase Edge Function for Email Sending

**File**: `supabase/functions/send-event-email/index.ts` (new file)

Create a Supabase Edge Function that:

- Accepts POST request with: `{ email: string, eventIds: number[] }`
- Validates email format
- Fetches event details from the `events` table for the provided IDs
- Generates HTML email with event details (name, date, time, location, description, website)
- Sends email using Supabase's email service or integrated email provider
- Returns success/error response

**Email template should include**:

- Greeting
- List of selected events with:
  - Event name
  - Date(s) and time(s)
  - Location
  - Description (if available)
  - Website link (if available)
  - Image (if available)
- Footer with unsubscribe/contact info

**Security considerations**:

- Rate limiting (prevent spam)
- Email validation
- Sanitize inputs
- Use environment variables for email service credentials

### 3. Update Event Widget UI - Add Selection Capability

**Files** (deploy via [EVENTS_PUBLISHING.md](../EVENTS_PUBLISHING.md)):

- `web/code-snippets/events/event-list.js`
- `web/public/code-snippets/events/event-list.js`

Add selection functionality:

1. **Selection UI**:
  - Add a checkbox or "Select" button to each event card/item
  - Visual indicator when event is selected (highlight, checkmark, etc.)
  - Show count of selected events somewhere visible
2. **Selection State Management**:
  - Store selected event IDs in `sessionStorage` (key: `ssa_selected_events`)
  - Persist selections across page navigation within session
  - Clear selections when user requests email (or keep for "add more" flow)
3. **Selection Button/Indicator**:
  - Add clickable element to each event
  - Toggle selection on click
  - Update visual state immediately
  - Update selection count display

### 4. Add Email Request Modal/Dialog

**Files**: Same as above

Create a modal dialog that appears when user wants to request email:

1. **Trigger**:
  - "Email My Selections" button (only visible when 1+ events selected)
  - Could be floating button or in header/footer area
  - Disabled state when no events selected
2. **Modal Content**:
  - Email input field
  - Validation (email format)
  - List of selected events (summary)
  - "Send Email" button
  - "Cancel" button
  - Loading state during send
  - Success message after send
  - Error handling
3. **Styling**:
  - Match Squarespace design aesthetic
  - Mobile-responsive
  - Accessible (keyboard navigation, ARIA labels)

### 5. Implement Email Request API Call

**Files**: Same as above

Add function to call Supabase Edge Function:

```javascript
async function sendEventEmail(email, eventIds) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-event-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ email, eventIds })
  });
  
  if (!response.ok) {
    throw new Error('Failed to send email');
  }
  
  return await response.json();
}
```

**Error handling**:

- Network errors
- Validation errors
- Rate limiting
- User-friendly error messages

### 6. Configure Supabase Edge Function

**Setup required**:

1. Deploy Edge Function to Supabase
2. Configure email service (Supabase email or third-party)
3. Set up environment variables for email credentials
4. Configure CORS if needed
5. Set up rate limiting

### 7. Email Template Design

**File**: `supabase/functions/send-event-email/email-template.html` (new file)

Create HTML email template:

- Responsive design (works on mobile)
- Branded styling
- Clear event information layout
- Links to event websites
- Unsubscribe/contact information
- Plain text fallback

### 8. Testing

Test scenarios:

- Select single event, request email
- Select multiple events, request email
- Invalid email format
- Network errors
- Rate limiting
- Email delivery
- Email content accuracy
- Mobile responsiveness
- Session persistence

### 9. Documentation

**File**: `docs/EVENT_SELECTION_EMAIL.md` (new file)

Document:

- How the feature works
- Edge Function setup instructions
- Email service configuration
- Troubleshooting guide
- User-facing documentation (if needed)

## Files to Create/Modify

### New Files

- `supabase/functions/send-event-email/index.ts` - Edge Function for sending emails
- `supabase/functions/send-event-email/email-template.html` - Email HTML template
- `docs/EVENT_SELECTION_EMAIL.md` - Documentation

### Modified Files

- `TODO.md` - Add new TODO item
- `web/code-snippets/events/event-list.js` - Add selection UI, email modal, and API call
- `web/public/code-snippets/events/event-list.js` - Same updates (sync before deploy)

## Implementation Notes

1. **Privacy**:
  - No account creation means no user data stored permanently
  - Email addresses only used for sending requested emails
  - Consider adding privacy notice in modal
2. **Rate Limiting**:
  - Prevent abuse (e.g., max 3 emails per email address per day)
  - Track in Edge Function or use Supabase rate limiting
3. **Email Service Options**:
  - Supabase built-in email (if available)
  - Resend (recommended - simple, good free tier)
  - SendGrid
  - AWS SES
  - Postmark
4. **User Experience**:
  - Clear visual feedback when events are selected
  - Easy to deselect events
  - Confirmation after email sent
  - Option to select more events after sending
5. **Accessibility**:
  - Keyboard navigation
  - Screen reader support
  - ARIA labels
  - Focus management
6. **Mobile Optimization**:
  - Touch-friendly selection controls
  - Responsive modal
  - Mobile-optimized email template

## Dependencies

- Supabase Edge Functions runtime
- Email service API key/credentials
- Event data from Supabase `events` table

## Future Enhancements

- Print functionality (as mentioned in original TODO)
- Calendar file (.ics) generation
- Share selected events via link
- Save selections for later (localStorage with expiration)

