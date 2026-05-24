const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '../src/app/(app)/settings/household/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Add imports at the top
content = content.replace(
  `import { formatRelative } from "@/lib/format";`,
  `import { formatRelative } from "@/lib/format";
import { useActivityLogs, type ActivityLog } from "@/hooks/use-activity-logs";`
);

// 2. Fetch activity logs in HouseholdSettingsPage
content = content.replace(
  `  const { data: invites = [], isLoading: loadingInvites } = useInvites();`,
  `  const { data: invites = [], isLoading: loadingInvites } = useInvites();
  const { data: logs = [], isLoading: loadingLogs } = useActivityLogs();`
);

// 3. Define formatActivityLog helper outside the component
const helperText = `
function formatActivityLog(log: ActivityLog) {
  const actor = log.profiles?.display_name || log.profiles?.email || "Anggota Keluarga";
  const meta = log.metadata || {};
  
  if (log.entity_type === 'transactions') {
    const typeLabel = meta.type === 'income' ? 'pemasukan' : meta.type === 'transfer' ? 'transfer' : 'pengeluaran';
    const amountStr = meta.amount ? \`sebesar Rp \${Number(meta.amount).toLocaleString('id-ID')}\` : '';
    const noteStr = meta.note ? \` ("\${meta.note}")\` : '';
    
    if (log.action === 'create') {
      return \`\${actor} mencatat \${typeLabel} baru \${amountStr}\${noteStr}\`;
    }
    if (log.action === 'update') {
      return \`\${actor} memperbarui transaksi \${typeLabel} \${amountStr}\${noteStr}\`;
    }
    if (log.action === 'delete') {
      return \`\${actor} menghapus transaksi \${typeLabel} \${amountStr}\${noteStr}\`;
    }
  }
  
  if (log.entity_type === 'wallets') {
    const nameStr = meta.name ? \`"\${meta.name}"\` : 'Dompet';
    if (log.action === 'create') return \`\${actor} membuat dompet \${nameStr}\`;
    if (log.action === 'update') return \`\${actor} mengubah dompet \${nameStr}\`;
    if (log.action === 'archive') return \`\${actor} mengarsipkan dompet \${nameStr}\`;
    if (log.action === 'delete') return \`\${actor} menghapus dompet \${nameStr}\`;
  }
  
  if (log.entity_type === 'budgets') {
    if (log.action === 'create') return \`\${actor} menetapkan anggaran baru\`;
    if (log.action === 'update') return \`\${actor} memperbarui nominal anggaran\`;
    if (log.action === 'delete') return \`\${actor} menghapus anggaran\`;
  }
  
  return \`\${actor} melakukan aksi \${log.action} pada \${log.entity_type}\`;
}
`;

content = content + helperText;

// 4. Add the timeline component markup right before the Dialogs are declared
const timelineMarkup = `
      {/* Activity Logs Section */}
      <section className="space-y-3 pt-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Aktivitas Terbaru Keluarga
        </h2>
        {loadingLogs ? (
          <div className="h-24 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center bg-card rounded-2xl border border-dashed border-border/80">
            Belum ada aktivitas tercatat.
          </p>
        ) : (
          <div className="relative border-l border-muted pl-4 ml-2 space-y-4 py-2">
            {logs.map((log) => {
              const dateStr = formatRelative(log.created_at);
              const message = formatActivityLog(log);
              
              // Decide icon or dot color based on action
              let dotBg = "bg-muted";
              if (log.action === "create") dotBg = "bg-mint-strong";
              if (log.action === "update") dotBg = "bg-blue-500";
              if (log.action === "delete") dotBg = "bg-expense";
              if (log.action === "archive") dotBg = "bg-amber-500";

              return (
                <div key={log.id} className="relative group">
                  <span className={\`absolute -left-[21px] top-1.5 grid size-2.5 rounded-full ring-4 ring-background \${dotBg}\`} />
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-normal pr-1 break-words">
                      {message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dateStr}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
`;

// Insert before `{/* Create invite dialog */}`
content = content.replace(
  `      {/* Create invite dialog */}`,
  timelineMarkup + `\n      {/* Create invite dialog */}`
);

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Successfully updated settings/household/page.tsx!');
