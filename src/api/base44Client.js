import { createClient } from '@supabase/supabase-js';

// ─── CONFIG ────────────────────────────────────────────────────────────────
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);


// ─── MAPPING : nom d'entité Base44 → nom de table Supabase ────────────────
const TABLE_MAP = {
  Client:             'clients',
  Prospect:           'prospects',
  ClientStats:        'client_stats',
  ContactLog:         'contact_logs',
  Template:           'templates',
  EditorialContent:   'editorial_content',
  Service:            'services',
  Contract:           'contracts',
  Invoice:            'invoices',
  Freelancer:         'freelancers',
  FreelancerPayment:  'freelancer_payments',
  FreelancerMeeting:  'freelancer_meetings',
  FreelancerTool:     'freelancer_tools',
  Project:            'projects',
  Task:               'tasks',
  AdminTask:          'admin_tasks',
  BoardMeeting:       'board_meetings',
  LegalDocument:      'legal_documents',
  Shareholder:        'shareholders',
  ShareholderSalary:  'shareholder_salaries',
  Subscription:       'subscriptions',
};


// ─── HELPER : convertir le tri Base44 ("-date" → { column, ascending }) ───
function parseSort(sortStr) {
  if (!sortStr) return null;
  const descending = sortStr.startsWith('-');
  const column = descending ? sortStr.slice(1) : sortStr;
  return { column, ascending: !descending };
}


// ─── ENTITY FACTORY ───────────────────────────────────────────────────────
// Reproduit exactement l'interface Base44 :
//   Entity.list(sortStr?)
//   Entity.filter({ field: value, ... })
//   Entity.create(data)
//   Entity.update(id, data)
//   Entity.delete(id)

function makeEntity(entityName) {
  const table = TABLE_MAP[entityName];
  if (!table) throw new Error(`[supabaseClient] Entity inconnue : ${entityName}`);

  return {
    // list(sortStr?) — ex: list("-date") ou list()
    async list(sortStr) {
      let query = supabase.from(table).select('*');
      if (sortStr) {
        const sort = parseSort(sortStr);
        query = query.order(sort.column, { ascending: sort.ascending });
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    // filter({ status: "Actif", ... })
    async filter(filters) {
      let query = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    // create(data)
    async create(data) {
      // Nettoyer les champs que Supabase gère lui-même
      const { id, created_at, updated_at, ...payload } = data;
      const { data: row, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    // update(id, data)
    async update(id, data) {
      const { id: _id, created_at, ...payload } = data;
      const { data: row, error } = await supabase
        .from(table)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    // delete(id)
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { id };
    },
  };
}


// ─── AUTH ─────────────────────────────────────────────────────────────────
// Reproduit base44.auth.me() et base44.auth.logout()

const auth = {
  // Retourne le même format que Base44 : { id, email, full_name, role }
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    return {
      id:        user.id,
      email:     user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      role:      profile?.role || 'user',
    };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = '/';
  },

  // Expose le client Supabase pour les usages avancés (ex: onAuthStateChange)
  client: supabase,
};


// ─── FUNCTIONS (remplacement des Base44 serverless functions) ─────────────
// Redirige vers les Supabase Edge Functions du même nom

const functions = {
  async invoke(name, payload = {}) {
    const { data, error } = await supabase.functions.invoke(name, {
      body: payload,
    });
    if (error) {
      // Extract real error message from the function response body
      try {
        const body = await error.context?.json?.();
        if (body?.error) throw new Error(body.error);
      } catch (inner) {
        if (inner.message && inner.message !== error.message) throw inner;
      }
      throw error;
    }
    // Base44 retournait { data: ... }, on reproduit le même shape
    return { data };
  },
};


// ─── STORAGE (remplacement de base44.integrations.Core.UploadFile) ─────────
// Usage identique : const { file_url } = await base44.integrations.Core.UploadFile({ file })

const integrations = {
  Core: {
    async UploadFile({ file, bucket = 'content' }) {
      const ext      = file.name.split('.').pop();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path     = `uploads/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};


// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────
// On exporte un objet "base44" pour que AUCUNE page ne soit modifiée

export const base44 = {
  auth,
  functions,
  integrations,
  entities: new Proxy({}, {
    get(_, entityName) {
      return makeEntity(entityName);
    },
  }),
};