"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import GameCard from "@/components/GameCard";
import { gameKey } from "@/lib/utils";

interface SortableGameCardProps extends React.ComponentProps<typeof GameCard> {
  disabled?: boolean;
}

export default function SortableGameCard({ disabled, ...props }: SortableGameCardProps) {
  const key = gameKey(props.game);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: key,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10 opacity-50" : ""}
    >
      <GameCard
        {...props}
        dragHandleProps={disabled ? undefined : { ...attributes, ...listeners }}
      />
    </div>
  );
}
