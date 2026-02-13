const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatUKDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (parts) {
      const [, y, m, day] = parts;
      return `${day.padStart(2, "0")}-${MONTHS[parseInt(m) - 1]}-${y}`;
    }
    return dateStr;
  }
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${mon}-${year}`;
}
