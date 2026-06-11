import MapExplorer from "@/components/MapExplorer";

export const metadata = { title: "Map Explorer" };

export default function MapPage() {
  return (
    <div className="relative flex-1 min-h-[calc(100dvh-3.5rem)]">
      <MapExplorer />
    </div>
  );
}
