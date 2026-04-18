import {
  ClipboardList, CheckCircle2, XCircle, Package, Trophy,
  RefreshCw, MessageCircle, Clock, CalendarCheck, DollarSign, Bell
} from "lucide-react";

export const NOTIFICATION_TYPE_ICONS = {
  project_assigned:        ClipboardList,
  project_accepted:        CheckCircle2,
  project_declined:        XCircle,
  project_delivered:       Package,
  project_completed:       Trophy,
  revision_requested:      RefreshCw,
  clarification_requested: MessageCircle,
  deadline_warning:        Clock,
  availability_reminder:   CalendarCheck,
  message:                 MessageCircle,
  invoice_paid:            DollarSign,
};

export const getNotificationIcon = (type) => NOTIFICATION_TYPE_ICONS[type] || Bell;
