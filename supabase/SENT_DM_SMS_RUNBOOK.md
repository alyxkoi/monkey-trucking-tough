# sent.DM SMS production runbook

Approved Monkey Trucking number: `+19453750877`

Provider configuration created on 2026-09-13:

- First-contact template `Monkey Trucking Update`
- Template ID `48d013e5-debe-4efa-864b-c90798242ab4`
- Template status at creation: `PENDING`
- Production webhook `Monkey Trucking Production SMS`
- Webhook subscribed to all ten `message.*` event types
- Protected STOP, START, and HELP auto-replies were already `APPROVED`

Production deployment completed on 2026-09-13:

- `SENT_DM_API_KEY`, `SENT_DM_WEBHOOK_SECRET`, and
  `SENT_DM_FIRST_CONTACT_TEMPLATE_ID` stored as Supabase secrets
- Migration `20260913090000_sent_dm_sms_transport.sql` applied once
- `send-sms`, `sent-dm-webhook`, and `ai-draft` deployed
- Unsigned webhook request rejected without a database write
- sent.DM signed `message.queued` test reached the production webhook successfully
- Existing counts preserved at deployment: 3 customers, 2 leads, 0 lead messages
- SMS and Calling remain `SETUP_REQUIRED`

The migration intentionally leaves SMS and Calling in `SETUP_REQUIRED`.
Neither status is changed automatically by a deploy or an API response.

## 1. Confirm the sent.DM sender

The current account exposes the approved number under Channels and does not
have a separate Sender Profile enabled. `SENT_DM_PROFILE_ID` is intentionally
unset. In the sent.DM dashboard confirm:

- The Monkey Trucking channel owns `+19453750877`.
- The SMS channel is Active and the number is capable of receiving inbound SMS.
- US messaging and billing are active.
- STOP, START, and HELP auto-replies are configured.
- The approved first-contact template contains a `message` parameter for the
  dashboard staff message.

Use the existing active organization API key unless sent.DM later enables a
separate Monkey Trucking Sender Profile. Never commit either value.

## 2. Configure Supabase secrets

Set these secrets on Supabase project `dugmcjpistrxxryaubkd`:

- `SENT_DM_API_KEY` (required)
- `SENT_DM_WEBHOOK_SECRET` (required, generated when the webhook is registered)
- `SENT_DM_FIRST_CONTACT_TEMPLATE_ID` (required for contacts who have not replied)
- `SENT_DM_PROFILE_ID` (only for an organization-scoped API key)

## 3. Apply and deploy

Apply migration `20260913090000_sent_dm_sms_transport.sql`, then deploy:

- `send-sms`
- `sent-dm-webhook`
- `ai-draft`

The sent.DM webhook URL is:

`https://dugmcjpistrxxryaubkd.supabase.co/functions/v1/sent-dm-webhook`

Subscribe it to the canonical `message` event, including received, queued,
routed, scheduled, sent, delivered, failed, filtered, and blocked statuses.
Copy the webhook signing secret to Supabase before enabling live deliveries.

Do not enter `TESTING` until the first-contact template status changes from
`PENDING` to `APPROVED`.

## 4. Enter testing state

After secrets and the webhook are deployed, set only SMS to `TESTING`:

```sql
update public.control_center_settings
set sms_status = 'TESTING', updated_at = now()
where id = 1;
```

The normal dashboard composer remains locked until the final READY decision.
Use an authenticated admin/staff function invocation for the controlled live
test. Do not test against a real customer record.

## 5. Required end-to-end evidence

Use controlled test customers and retain the sent.DM message IDs:

1. First-contact template is received from `+19453750877`.
2. Customer reply creates exactly one inbound conversation message.
3. A dashboard free-form reply is delivered and updates the same outbound row.
4. Replayed webhooks do not duplicate messages or activities.
5. An unknown inbound number creates a safe customer and lead.
6. STOP records an opt-out and blocks subsequent sends.
7. The provider's STOP confirmation is received without an AI duplicate.
8. START clears the opt-out and records the double opt-in timestamp.
9. HELP receives the configured provider response without an AI duplicate.
10. Failed, filtered, and blocked sends remain distinguishable in the database.
11. A staff reply enables human takeover before provider transmission.
12. Automation previews remain blocked without double opt-in.

Only after the evidence passes:

```sql
update public.control_center_settings
set sms_status = 'READY', updated_at = now()
where id = 1 and sms_status = 'TESTING';
```

## 6. Calling and automations

Calling remains `SETUP_REQUIRED`. sent.DM's published API documents messaging
channels, not voice or missed-call events. Obtain written confirmation of voice
support for this exact number before adding a call integration.

Live scheduled automations remain off until their sent.DM templates are approved
and the manual SMS test matrix above passes. Enable each rule separately, starting
with transactional reminders. Promotional reactivation must require
`sms_double_opt_in_at`, no current opt-out, and its own approved template.
