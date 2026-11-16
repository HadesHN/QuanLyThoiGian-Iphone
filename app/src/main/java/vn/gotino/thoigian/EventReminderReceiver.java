package vn.gotino.thoigian;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;

public final class EventReminderReceiver extends BroadcastReceiver {
    static final String CHANNEL = "personal_events";
    static final String OPEN_EVENTS = "open_events";
    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    @Override
    public void onReceive(Context context, Intent intent) {
        refresh(context);
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL, "Nhắc sự kiện", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Sinh nhật, lịch gia đình và hạn giấy tờ");
            manager.createNotificationChannel(channel);
        }
    }

    static boolean canNotify(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
            return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        return true;
    }

    // Keep only the next system alarm. Recompute from saved events after edits, reboot or clock changes.
    static synchronized void refresh(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent signal = PendingIntent.getBroadcast(context, 71,
                new Intent(context, EventReminderReceiver.class).setAction("vn.gotino.thoigian.EVENT_REMINDER"),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        if (!canNotify(context)) {
            alarms.cancel(signal);
            return;
        }
        ensureChannel(context);
        SharedPreferences planner = context.getSharedPreferences("timeplanner_data", Context.MODE_PRIVATE);
        SharedPreferences state = context.getSharedPreferences("event_alarm_state", Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long since = Math.min(now, Math.max(now - DAY_MS, state.getLong("lastCheck", 0)));
        int year = Calendar.getInstance().get(Calendar.YEAR);

        JSONArray events;
        try {
            events = new JSONObject(planner.getString("planner_json", "{}")).optJSONArray("events");
        } catch (JSONException error) {
            alarms.cancel(signal);
            return;
        }

        long next = Long.MAX_VALUE;
        List<DueReminder> due = new ArrayList<>();
        for (int i = 0; events != null && i < events.length(); i++) {
            JSONObject event = events.optJSONObject(i);
            if (event == null || event.optBoolean("done") || event.optString("title").isEmpty()) continue;
            JSONArray offsets = event.optJSONArray("reminders");
            if (offsets == null || offsets.length() == 0) continue;

            String date = event.optString("date");
            String time = event.optString("time", "09:00");
            Calendar original = parseDate(date, time);
            if (original == null) continue;
            int originalYear = original.get(Calendar.YEAR);
            boolean yearly = "yearly".equals(event.optString("repeat"));
            int startYear = yearly ? Math.max(originalYear, year - 1) : originalYear;
            int endYear = yearly ? Math.min(9999, Math.max(startYear, year) + 8) : originalYear;
            long latest = 0;
            int latestDays = 0;
            for (int y = startYear; y <= endYear; y++) {
                Calendar occurrence = dateInYear(original, y);
                if (occurrence == null) continue;
                for (int j = 0; j < offsets.length(); j++) {
                    int days = offsets.optInt(j, -1);
                    if (days < 0 || days > 30) continue;
                    Calendar trigger = (Calendar) occurrence.clone();
                    trigger.add(Calendar.DATE, -days);
                    long at = trigger.getTimeInMillis();
                    if (at < event.optLong("reminderSince", 0)) continue;
                    if (at > now) next = Math.min(next, at);
                    else if (at > since && at > latest) {
                        latest = at;
                        latestDays = days;
                    }
                }
            }
            if (latest > 0) due.add(new DueReminder(event, latestDays));
        }

        if (next == Long.MAX_VALUE) alarms.cancel(signal);
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, signal);

        state.edit().putLong("lastCheck", now).apply();
        for (DueReminder reminder : due) notifyEvent(context, reminder.event, reminder.days);
    }

    private static Calendar parseDate(String date, String time) {
        if (!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || !time.matches("([01][0-9]|2[0-3]):[0-5][0-9]")) return null;
        GregorianCalendar value = new GregorianCalendar();
        value.clear();
        value.setLenient(false);
        value.set(Integer.parseInt(date.substring(0, 4)), Integer.parseInt(date.substring(5, 7)) - 1,
                Integer.parseInt(date.substring(8, 10)), 12, 0);
        try {
            value.getTimeInMillis();
        } catch (IllegalArgumentException error) {
            return null;
        }
        if (value.get(Calendar.YEAR) < 1900) return null;
        value.setLenient(true);
        value.set(Calendar.HOUR_OF_DAY, Integer.parseInt(time.substring(0, 2)));
        value.set(Calendar.MINUTE, Integer.parseInt(time.substring(3, 5)));
        return value;
    }

    private static Calendar dateInYear(Calendar original, int year) {
        Calendar date = (Calendar) original.clone();
        date.set(Calendar.YEAR, year);
        return date.get(Calendar.DAY_OF_MONTH) == original.get(Calendar.DAY_OF_MONTH)
                && date.get(Calendar.MONTH) == original.get(Calendar.MONTH) ? date : null;
    }

    private static void notifyEvent(Context context, JSONObject event, int days) {
        if (!canNotify(context)) return;
        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(OPEN_EVENTS, true);
        PendingIntent open = PendingIntent.getActivity(context, 72, launch,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String title = event.optString("title");
        String message = days == 0 ? "Đến giờ sự kiện" : "Còn " + days + " ngày đến sự kiện";
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title).setContentText(message).setContentIntent(open)
                .setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true);
        if (Build.VERSION.SDK_INT < 26) builder.setDefaults(Notification.DEFAULT_ALL);
        try {
            context.getSystemService(NotificationManager.class).notify(event.optString("id"), 1, builder.build());
        } catch (SecurityException ignored) {
            // The user may have revoked notifications while this alarm was being handled.
        }
    }

    private static final class DueReminder {
        final JSONObject event;
        final int days;

        DueReminder(JSONObject event, int days) {
            this.event = event;
            this.days = days;
        }
    }
}
