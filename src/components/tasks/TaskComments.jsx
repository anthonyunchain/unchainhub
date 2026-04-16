import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Send, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

export default function TaskComments({ taskId }) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const qc = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      let image_url = null;
      if (imageFile) {
        setUploading(true);
        const res = await base44.integrations.Core.UploadFile({ file: imageFile });
        image_url = res.file_url;
        setUploading(false);
      }
      const { data } = await base44.functions.invoke("addTaskComment", {
        task_id: taskId,
        content: content.trim(),
        image_url,
      });
      return data;
    },
    onSuccess: () => {
      setContent("");
      setImageFile(null);
      setImagePreview(null);
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: () => setUploading(false),
  });

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const canSend = (content.trim() || imageFile) && !sendMut.isPending && !uploading;

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        Comments {comments.length > 0 && `(${comments.length})`}
      </p>

      {/* Comments list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              {/* Avatar */}
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                c.author_role === "admin" ? "bg-slate-700" : "bg-blue-500"
              }`}>
                {(c.author_name || "?")[0]?.toUpperCase()}
              </div>
              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-slate-700">{c.author_name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    c.author_role === "admin" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600"
                  }`}>
                    {c.author_role === "admin" ? "Admin" : "Freelancer"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(c.created_at), "d MMM, HH:mm", { locale: enUS })}
                  </span>
                </div>
                {c.content && (
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                )}
                {c.image_url && (
                  <a href={c.image_url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                    <img
                      src={c.image_url}
                      alt="Comment image"
                      className="max-w-[240px] max-h-[180px] rounded-lg border border-slate-200 object-cover hover:opacity-90 transition-opacity cursor-pointer"
                    />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">No comments yet</p>
      )}

      {/* Input area */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          className="border-0 focus-visible:ring-0 resize-none text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
              e.preventDefault();
              sendMut.mutate();
            }
          }}
        />
        {/* Image preview */}
        {imagePreview && (
          <div className="px-3 pb-2 relative inline-block">
            <img src={imagePreview} alt="Preview" className="max-w-[120px] max-h-[80px] rounded-md border border-slate-200 object-cover" />
            <button
              onClick={removeImage}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Attach image"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs bg-brand hover:bg-brand/90 text-brand-foreground"
            disabled={!canSend}
            onClick={() => sendMut.mutate()}
          >
            {sendMut.isPending || uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1" /> Send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
