import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ isFreelancer: false }, { status: 401 });
    }

    // Admins are never freelancers
    if (user.role === 'admin') {
      return Response.json({ isFreelancer: false, freelancerProfile: null });
    }

    // Use service role to search freelancer by email (bypasses RLS)
    const freelancers = await base44.asServiceRole.entities.Freelancer.filter({ email: user.email });
    const match = freelancers[0] || null;

    return Response.json({
      isFreelancer: !!match,
      freelancerProfile: match || null,
    });
  } catch (error) {
    return Response.json({ isFreelancer: false, error: error.message }, { status: 500 });
  }
});