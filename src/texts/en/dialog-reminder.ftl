### The daily reminder's dialog (src/engine/reminder.ts), loaded when it
### first opens (src/texts/plugin.mjs: dialog-*.ftl). Its button is in
### interface.ftl.

reminder-title = A daily reminder in your calendar
reminder-intro = Choose a time: the game makes a calendar file (.ics) with an event every day at that time, and an alert. Open the file with your calendar app, on your phone or your computer, to add it.
reminder-time = Time of the reminder
reminder-download = Download the calendar file
reminder-floating = The time stays the same wherever you are, and when the clocks change.
reminder-private = Nothing is sent anywhere: the file is made in your browser, and only your calendar app keeps it. To stop the reminders, delete the event from your calendar.
reminder-ready = File downloaded: open it to add the reminder to your calendar.
reminder-invalid = Choose a time, such as 18:30.
reminder-close = Close
# The downloaded file's name.
reminder-file = sysadmin-quests-reminder.ics
# The event in the player's calendar. { $url }: the game's address.
reminder-event-title = Sysadmin Quests: the incident of the day
reminder-event-description = A few minutes on call: today's incident is waiting for you. { $url }
reminder-event-alarm = Time for today's incident
