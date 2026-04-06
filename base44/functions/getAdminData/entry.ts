import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [projects, freelancers, clients] = await Promise.all([
      base44.asServiceRole.entities.Project.list('-created_date', 200),
      base44.asServiceRole.entities.Freelancer.list('-created_date', 200),
      base44.asServiceRole.entities.Client.list('-created_date', 200),
    ]);

    return Response.json({
      projects,
      freelancers,
      clients,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});