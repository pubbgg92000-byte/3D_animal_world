/**
 * NotificationFeed — Floating event notifications.
 *
 * Positioned on the right side, below minimap.
 * Notifications slide in, auto-dismiss, and stack vertically.
 */
export default function NotificationFeed({ notifications = [], onDismiss }) {
  if (notifications.length === 0) return null;

  return (
    <div className="wt-notifications">
      {notifications.map((notif, index) => (
        <div
          key={notif.id}
          className="wt-notification"
          style={{
            animationDelay: `${index * 50}ms`,
            borderLeftColor: notif.color,
          }}
          onClick={() => onDismiss?.(notif.id)}
        >
          <span className="wt-notification__message">{notif.message}</span>
        </div>
      ))}
    </div>
  );
}
