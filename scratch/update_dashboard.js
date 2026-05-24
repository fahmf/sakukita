const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, '../src/app/(app)/dashboard/page.tsx');
let content = fs.readFileSync(dashPath, 'utf8');

// 1. Add imports
content = content.replace(
  `import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";`,
  `import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { TransactionDetailDialog } from "@/components/transaction/transaction-detail-dialog";
import { useRouter } from "next/navigation";`
);

// 2. Add router and selectedTxForDetail state inside DashboardPage
content = content.replace(
  `  const deleteTx = useDeleteTransaction();
  const allowed = useCanEdit();`,
  `  const deleteTx = useDeleteTransaction();
  const allowed = useCanEdit();
  const router = useRouter();
  const [selectedTxForDetail, setSelectedTxForDetail] = React.useState<any>(null);`
);

// 3. Make transaction item left and right block clickable to show details
content = content.replace(
  `                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-white font-semibold"
                        style={{ backgroundColor: bgColor }}
                      >
                        {isTransfer ? (
                          <ArrowRightLeft className="size-4" />
                        ) : hasMappedIcon ? (
                          React.createElement(iconMap[tx.category!.icon || ""], { className: "size-4" })
                        ) : (
                          <span className="text-base select-none leading-none">{categoryIcon}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {isTransfer
                            ? \`Transfer ke \${tx.to_wallet?.name}\`
                            : tx.note || tx.category?.name || "Lain-lain"}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {tx.wallet?.name} · {formatRelative(tx.occurred_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                      <div className="text-right">
                        <p
                          className={\`font-bold text-sm tracking-tight \${
                            isIncome ? "text-income" : isExpense ? "text-expense" : "text-foreground"
                          }\`}
                        >
                          {isIncome ? "+" : isExpense ? "-" : ""}
                          {formatCurrency(tx.amount).replace("Rp", "").trim()}
                        </p>
                      </div>`,
  `                    <div 
                      onClick={() => setSelectedTxForDetail(tx)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none active:opacity-70 transition-opacity"
                    >
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-white font-semibold"
                        style={{ backgroundColor: bgColor }}
                      >
                        {isTransfer ? (
                          <ArrowRightLeft className="size-4" />
                        ) : hasMappedIcon ? (
                          React.createElement(iconMap[tx.category!.icon || ""], { className: "size-4" })
                        ) : (
                          <span className="text-base select-none leading-none">{categoryIcon}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {isTransfer
                            ? \`Transfer ke \${tx.to_wallet?.name}\`
                            : tx.note || tx.category?.name || "Lain-lain"}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {tx.wallet?.name} · {formatRelative(tx.occurred_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                      <div 
                        onClick={() => setSelectedTxForDetail(tx)}
                        className="text-right cursor-pointer select-none pr-1 active:opacity-70 transition-opacity"
                      >
                        <p
                          className={\`font-bold text-sm tracking-tight \${
                            isIncome ? "text-income" : isExpense ? "text-expense" : "text-foreground"
                          }\`}
                        >
                          {isIncome ? "+" : isExpense ? "-" : ""}
                          {formatCurrency(tx.amount).replace("Rp", "").trim()}
                        </p>
                      </div>`
);

// 4. Update the "Lihat Semua" button to route to /transactions
content = content.replace(
  `            {transactions.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAll(!showAll);
                  if (showAll) setSearchQuery("");
                }}
                className="w-full text-xs text-mint-strong hover:bg-mint-soft/50 py-2.5 mt-1 rounded-xl"
              >
                {showAll ? "Tampilkan Lebih Sedikit" : \`Lihat Semua (\${transactions.length} Transaksi)\`}
              </Button>
            )}`,
  `            {transactions.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/transactions")}
                className="w-full text-xs text-mint-strong hover:bg-mint-soft/50 py-2.5 mt-1 rounded-xl font-semibold"
              >
                Lihat Semua ({transactions.length} Transaksi)
              </Button>
            )}`
);

// 5. Render TransactionDetailDialog before closing div
content = content.replace(
  `      {/* Confirmation Dialog for Transaction Deletion */}`,
  `      {/* Transaction Detail Dialog */}
      <TransactionDetailDialog
        tx={selectedTxForDetail}
        open={selectedTxForDetail !== null}
        onOpenChange={(o) => !o && setSelectedTxForDetail(null)}
        onEdit={openEditTransaction}
        onDelete={setTxToDelete}
      />

      {/* Confirmation Dialog for Transaction Deletion */}`
);

fs.writeFileSync(dashPath, content, 'utf8');
console.log('Successfully updated dashboard/page.tsx!');
