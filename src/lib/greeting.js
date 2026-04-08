const GREETINGS = {
  morning: [
    "Good morning, {name}",
    "Morning, {name}",
    "Good morning, {name}!",
    "Morning {name}",
    "Good morning, {name} ☀️",
  ],
  day: [
    "Good day, {name}",
    "Hello {name}",
    "Good day, {name}!",
    "Hi {name}",
    "Good day, {name} ☀️",
  ],
  afternoon: [
    "Good afternoon, {name}",
    "Hi {name}",
    "Good afternoon, {name}!",
    "Hello {name}",
    "Good afternoon, {name} 🌿",
  ],
  evening: [
    "Good evening, {name}",
    "Hi {name}",
    "Good evening, {name}!",
    "Hello {name}",
    "Good evening, {name} ✨",
  ],
  night: [
    "Good night, {name}",
    "Hi {name}",
    "Good night, {name}!",
    "Hello {name}",
    "Good night, {name} 🌙",
  ],
};

function getPeriod(hour) {
  if (hour >= 4 && hour < 9)   return "morning";
  if (hour >= 9 && hour < 13)  return "day";
  if (hour >= 13 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getGreeting(name) {
  const now = new Date();
  const hour = now.getHours();
  const period = getPeriod(hour);
  const list = GREETINGS[period];
  // Stable within the day: pick based on day-of-year so it doesn't change per reload
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const template = list[dayOfYear % list.length];
  return template.replace("{name}", name);
}
