"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import GameCard from "@/components/GameCard";
import { gameKey } from "@/lib/utils";

export default function SortableGameCard(props: React.ComponentProps<typeof GameCard>) {
  const key = gameKey(props.game);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: key,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10 opacity-50" : ""}
    >
      <GameCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
