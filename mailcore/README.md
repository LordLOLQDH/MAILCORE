## MAILCORE

Static webmail interface prototype hosted on GitHub Pages.

### Current status: 0.1.0
- Responsive inbox UI
- Inbox, starred, sent, drafts and trash navigation
- Search and sorting
- Compose form
- Local demo messages stored in browser localStorage
- Light/dark appearance toggle

### Important limitation
This is currently a **local-only prototype**. Messages created here are stored in the current browser and are not delivered to another user or external email providers. GitHub Pages is static hosting and does not provide SMTP, IMAP, mailboxes, or a backend. Real account registration, shared inboxes, and actual email delivery require a separate backend and a mail service. Never enter real passwords or sensitive messages into this prototype.

### Deploy
The project lives in the `mailcore/` directory of the `LordLOLQDH.github.io` repository. With GitHub Pages serving the repository root, it should be available at:

https://lordlolqdh.github.io/mailcore/
