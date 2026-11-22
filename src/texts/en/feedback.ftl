### "Report a problem or an idea" (src/engine/feedback.ts): a dialog that
### builds a report from what the player chooses to include; the game never
### sends it, the player opens a GitHub issue or copies the text.

feedback-button = Report a problem or an idea
feedback-title = Report a problem or an idea
feedback-intro = The game sends nothing by itself. Write your message, tick what may help us understand it, check the text below, then send it yourself.

## The kind of report (a group of choices)
feedback-kind-legend = What is it about?
feedback-kind-bug = A command that behaves wrongly
feedback-kind-text = A text or a hint that is unclear
feedback-kind-idea = An idea
feedback-kind-other = Something else

## The message
feedback-message-label = Your message
feedback-message-help = What happened, what you expected, or your idea. Don't write anything personal: the report may become public.

## What to include (each box shows exactly what it adds)
feedback-parts-legend = What to include
feedback-parts-help = Each box shows exactly what it adds to the report.
feedback-part-version = The game's version
feedback-part-language = The language
feedback-part-chapter = Where you are (story, chapter, machine, directory, events reached)
feedback-part-commands = Your last commands in this chapter and what they answered
feedback-part-browser = Your browser and screen size
feedback-part-settings = Your display settings
feedback-part-notebook = The commands in your notebook
feedback-commands-help = You can edit or delete lines below before sending. Passwords you typed are never included. Commands may give away the chapter's solution to whoever reads the issue.
feedback-commands-label = The commands that will be included
feedback-commands-none = No command typed in this chapter yet.
feedback-commands-exam = Not in exam mode: the commands of a test stay in the game.
feedback-never = Never included: your progress code, your save, your name, or anything you didn't tick.

## The preview and how to send it
feedback-preview = The exact text of the report
feedback-send = Send it yourself
feedback-github = Open a GitHub issue
feedback-github-help = A GitHub issue is public, and you need a GitHub account to create one. The link opens GitHub's form in a new tab, already filled in; nothing is sent until you submit it there.
feedback-new-tab = (opens in a new tab)
feedback-copy = Copy the text
feedback-copy-help = Or copy the text and paste it wherever you like.
feedback-copied = The text is copied.
feedback-copy-selected = The text is selected: press Ctrl+C (or ⌘+C) to copy it.
feedback-link-truncated =
    { $count ->
        [one] The report is too long for a link: the GitHub form gets it without the oldest line of commands. Copy the text and paste it into the issue to give everything.
       *[other] The report is too long for a link: the GitHub form gets it without the { $count } oldest lines of commands. Copy the text and paste it into the issue to give everything.
    }
feedback-link-message-cut = The report is too long for a link: the GitHub form gets your message cut short. Copy the text and paste it into the issue to give everything.
feedback-close = Close

## In the report itself (the headings; the labels under them stay in English)
feedback-heading-kind = Kind
feedback-heading-message = Message
feedback-heading-context = Context
feedback-heading-commands = Last commands
feedback-no-message = (no message)
feedback-redacted = [progress code removed]
feedback-output-cut =
    { $count ->
        [one] [… one more line]
       *[other] [… { $count } more lines]
    }
feedback-truncated =
    { $count ->
        [one] (The oldest line was left out to fit in the link.)
       *[other] (The { $count } oldest lines were left out to fit in the link.)
    }
feedback-message-cut = (The message was cut short to fit in the link.)
