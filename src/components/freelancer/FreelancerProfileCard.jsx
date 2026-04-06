import { ExternalLink, Phone, Mail, FileCheck } from "lucide-react";

export default function FreelancerProfileCard({ freelancer, onClick }) {
  if (!freelancer) return null;

  return (
    <div
      onClick={() => onClick?.(freelancer)}
      className={`bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col gap-4 ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-200 transition-all" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {freelancer.avatar_url ? (
          <img src={freelancer.avatar_url} alt={freelancer.name} className="w-14 h-14 rounded-xl object-cover border border-slate-100 shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {freelancer.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-900">{freelancer.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              freelancer.status === "Actif" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
            }`}>
              {freelancer.status === "Actif" ? "Available" : "Unavailable"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{freelancer.role || <span className="text-slate-300">—</span>}</p>
          <p className="text-xs text-slate-400 mt-0.5">{freelancer.type}</p>
        </div>
      </div>

      {/* Contact — always shown */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={freelancer.email ? "" : "text-slate-300"}>{freelancer.email || "No email"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={freelancer.phone ? "" : "text-slate-300"}>{freelancer.phone || "No phone"}</span>
        </div>
      </div>

      {/* Bio — always shown */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Bio</p>
        {freelancer.notes ? (
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">{freelancer.notes}</p>
        ) : (
          <p className="text-sm text-slate-300 bg-slate-50 rounded-lg p-3">No bio</p>
        )}
      </div>

      {/* Skills — always shown */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Skills</p>
        {freelancer.specialties?.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {freelancer.specialties.map((s, i) => (
              <span key={i} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">{s}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-300">No skills listed</p>
        )}
      </div>

      {/* Contract — always shown */}
      <div className="pt-3 border-t border-slate-100">
        {freelancer.contract_url ? (
          <a
            href={freelancer.contract_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs text-[#2A69FF] hover:underline"
          >
            <FileCheck className="w-3.5 h-3.5" /> View contract
          </a>
        ) : (
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> No contract
          </span>
        )}
      </div>
    </div>
  );
}