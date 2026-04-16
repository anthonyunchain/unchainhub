import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";

const TYPE_COLOR = {
  Reel: "bg-pink-100 text-pink-700",
  Story: "bg-amber-100 text-amber-700",
  Carousel: "bg-violet-100 text-violet-700",
  Post: "bg-blue-100 text-blue-700",
};

const STATUS_COLOR = {
  "Planifié": "bg-blue-50 text-blue-600",
  "En cours": "bg-amber-50 text-amber-600",
  "À tourner": "bg-indigo-50 text-indigo-600",
};

export default function ShootingsToOrganize() {
  const { data: editorial = [] } = useQuery({
    queryKey: ["editorial-organize"],
    queryFn: () => base44.entities.EditorialContent.list(),
  });
  const { data: contentLinks = [] } = useQuery({
    queryKey: ["shooting-content-organize"],
    queryFn: () => base44.entities.ShootingContent.list(),
  });

  const linkedIds = new Set(contentLinks.map(c => c.content_id));
  const unlinked = editorial
    .filter(e => e.status !== "Publié" && !linkedIds.has(e.id))
    .sort((a, b) => {
      // Sort by client, then by scheduled_date
      const clientCmp = (a.client_name || "").localeCompare(b.client_name || "");
      if (clientCmp !== 0) return clientCmp;
      if (a.scheduled_date && b.scheduled_date) return new Date(a.scheduled_date) - new Date(b.scheduled_date);
      if (a.scheduled_date) return -1;
      if (b.scheduled_date) return 1;
      return 0;
    });

  return (
    <div className="mx-auto px-4 md:px-6" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Link to="/Shootings" className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Shootings to organize</h1>
          <p className="text-xs text-slate-400 mt-0.5">{unlinked.length} content{unlinked.length !== 1 ? "s" : ""} not yet linked to a shooting</p>
        </div>
      </div>

      {unlinked.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Camera className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">All content is linked to a shooting!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Title</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {unlinked.map((e, i) => {
                const showClient = i === 0 || e.client_name !== unlinked[i - 1]?.client_name;
                return (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      {showClient ? (
                        <span className="text-sm font-semibold text-slate-800">{e.client_name || "—"}</span>
                      ) : (
                        <span className="text-sm text-slate-300">↳</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TYPE_COLOR[e.post_type] || "bg-slate-100 text-slate-500"}`}>
                        {e.post_type || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{e.title || "Untitled"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[e.status] || "bg-slate-100 text-slate-500"}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {e.scheduled_date ? format(parseISO(e.scheduled_date), "d MMM yyyy", { locale: enUS }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
