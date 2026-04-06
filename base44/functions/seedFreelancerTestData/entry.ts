import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Create freelancer profile
    const freelancer = await base44.entities.Freelancer.create({
      name: user.full_name || user.email,
      email: user.email,
      type: 'Freelance',
      status: 'Actif',
      tags: ['Video editor'],
      notes: 'Test profile'
    });

    // Create 3 tasks
    const tasks = await base44.entities.Task.bulkCreate([
      {
        title: 'Edit Instagram Reel',
        status: 'En cours',
        priority: 'Haute',
        due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        assigned_freelancer_id: freelancer.id,
        client_name: 'Client Test'
      },
      {
        title: 'TikTok Video Editing',
        status: 'Non commencé',
        priority: 'Normale',
        due_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        assigned_freelancer_id: freelancer.id,
        client_name: 'Client Test'
      },
      {
        title: 'Final Video Delivery',
        status: 'En cours',
        priority: 'Urgente',
        due_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
        assigned_freelancer_id: freelancer.id,
        client_name: 'Client Test'
      }
    ]);

    // Create 2 editorial projects
    const projects = await base44.entities.EditorialContent.bulkCreate([
      {
        title: 'Product Launch Video',
        client_name: 'Client Test',
        scheduled_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
        status: 'Planifié',
        post_type: 'Reel',
        platform: 'Instagram',
        assigned_freelancer_id: freelancer.id,
        assigned_freelancer_name: user.full_name || user.email,
        editing_status: 'À faire'
      },
      {
        title: 'Behind the Scenes',
        client_name: 'Client Test',
        scheduled_date: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
        status: 'En cours',
        post_type: 'Reel',
        platform: 'TikTok',
        assigned_freelancer_id: freelancer.id,
        assigned_freelancer_name: user.full_name || user.email,
        editing_status: 'En cours de montage'
      }
    ]);

    // Create 1 meeting
    const meetings = await base44.entities.FreelancerMeeting.bulkCreate([
      {
        title: 'Project Kickoff',
        date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        time: '14:00',
        format: 'Remote',
        link: 'https://meet.google.com/test',
        freelancer_id: freelancer.id,
        freelancer_name: user.full_name || user.email,
        freelancer_email: user.email,
        status: 'À venir'
      }
    ]);

    return Response.json({ success: true, message: 'Test data created' });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});