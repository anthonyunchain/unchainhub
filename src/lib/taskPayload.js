// Keep only columns that exist on the tasks table and normalize values
// (empty strings → null for nullable columns, date-like fields, etc.).
export const toTaskPayload = (d) => ({
  title: d.title,
  description: d.description || null,
  status: d.status || "Non commencé",
  category: d.category || "Update",
  client_name: d.client_name || null,
  assigned_to: d.assigned_to || null,
  assigned_freelancer_id:
    d.assigned_freelancer_id && d.assigned_freelancer_id !== "_me" && d.assigned_freelancer_id !== "_none"
      ? d.assigned_freelancer_id
      : null,
  due_date: d.due_date || null,
  gcal_event_id: d.gcal_event_id || null,
  images: d.images || [],
  urls: (d.urls || []).filter(u => u.trim()),
});
