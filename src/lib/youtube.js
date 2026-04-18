// Extract a YouTube video ID from any common URL shape.
// Supports:
//   https://www.youtube.com/watch?v=ID
//   https://youtu.be/ID
//   https://www.youtube.com/embed/ID
//   https://www.youtube.com/shorts/ID
//   https://www.youtube.com/live/ID
// Returns null for anything that doesn't look like a YouTube URL.
export function getYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host !== "youtube.com" && host !== "m.youtube.com") return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const parts = u.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live", "v"].includes(parts[0])) return parts[1] || null;
    return null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(url) {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function getYouTubeThumbnail(url, quality = "hqdefault") {
  const id = getYouTubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/${quality}.jpg` : null;
}
