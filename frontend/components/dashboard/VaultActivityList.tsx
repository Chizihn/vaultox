import { useEffect, useState } from "react";
import { getYieldHistory, YieldHistoryPoint } from "@/services/vaults";
import { formatCurrency } from "@/utils/format";

export function VaultActivityList() {
  const [activity, setActivity] = useState<YieldHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      setLoading(true);
      try {
        const data = await getYieldHistory();
        setActivity(data);
      } catch {
        setActivity([]);
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
  }, []);

  if (loading) {
    return <div className="text-xs text-muted-vault">Loading activity...</div>;
  }

  if (!activity.length) {
    return <div className="text-xs text-muted-vault">No activity found.</div>;
  }

  return (
    <div className="space-y-2">
      <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault mb-2">
        Vault Activity
      </p>
      <ul className="space-y-1">
        {activity.map((entry, idx) => (
          <li
            key={idx}
            className="flex items-center justify-between border-b border-vault-border py-1"
          >
            <span className="font-body text-[11px] text-text-primary">
              {new Date(entry.date).toLocaleString()} — {entry.strategyName}
            </span>
            <span className="font-heading text-[11px] text-gold">
              {formatCurrency(entry.cumulativeYield, { compact: true })} (
              {entry.apy}% APY)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
