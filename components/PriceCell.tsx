export default function PriceCell({
  price,
  url,
  isBest,
  storeName,
  gameName,
}: {
  price: string;
  url: string | null;
  isBest: boolean;
  storeName?: string;
  gameName?: string;
}) {
  return (
    <span className="flex items-center gap-1 flex-wrap justify-end">
      <span
        className={`font-medium ${isBest ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {price}
      </span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline text-[10px]"
          aria-label={`View ${gameName ?? "game"} on ${storeName ?? "store"}`}
        >
          view ↗
        </a>
      )}
    </span>
  );
}
