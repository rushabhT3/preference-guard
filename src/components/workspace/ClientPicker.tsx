"use client";

import { useId, useState } from "react";
import { ClientGroupList } from "./ClientGroupList";
import styles from "./ClientPicker.module.css";
import type { ClientGroup, ClientOption } from "./types";

export interface ClientPickerProps {
  groups: ClientGroup[];
  selectedId: string;
}

function matchesQuery(client: ClientOption, query: string): boolean {
  return `${client.name} ${client.meta}`.toLowerCase().includes(query);
}

export function ClientPicker({ groups, selectedId }: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      clients: group.clients.filter((client) =>
        matchesQuery(client, normalizedQuery),
      ),
    }))
    .filter((group) => group.clients.length > 0);

  return (
    <nav className={styles.picker} aria-label="Clients">
      <label htmlFor={inputId} className={styles.label}>
        Client
      </label>
      <input
        id={inputId}
        type="search"
        className={styles.search}
        placeholder="Search name or city"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.list}>
        {visibleGroups.map((group) => (
          <ClientGroupList
            key={group.matchmakerName}
            group={group}
            selectedId={selectedId}
          />
        ))}
        {visibleGroups.length === 0 && (
          <p className={styles.empty}>No client matches “{query.trim()}”.</p>
        )}
      </div>
    </nav>
  );
}
