import Link from "next/link";
import styles from "./ClientPicker.module.css";
import type { ClientGroup } from "./types";

export interface ClientGroupListProps {
  group: ClientGroup;
  selectedId: string;
}

export function ClientGroupList({ group, selectedId }: ClientGroupListProps) {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>
        {group.matchmakerName}
        <span>{group.clients.length}</span>
      </p>
      <ul className={styles.clients}>
        {group.clients.map((client) => (
          <li key={client.id}>
            <Link
              href={`/workspace?client=${client.id}`}
              scroll={false}
              className={styles.client}
              aria-current={client.id === selectedId ? "page" : undefined}
            >
              <span className={styles.name}>{client.name}</span>
              <span className={styles.meta}>{client.meta}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
