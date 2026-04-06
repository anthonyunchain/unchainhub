import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { recipient_id } = body;

    const notifications = await base44.asServiceRole.entities.Notification.filter(
      { recipient_id },
      '-created_date',
      50
    );

    return Response.json({ notifications });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});