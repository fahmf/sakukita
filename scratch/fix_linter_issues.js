const fs = require('fs');
const path = require('path');

// 1. Fix src/app/(app)/savings/page.tsx
const savingsPath = path.join(__dirname, '../src/app/(app)/savings/page.tsx');
if (fs.existsSync(savingsPath)) {
  let content = fs.readFileSync(savingsPath, 'utf8');
  
  // Clean unused imports
  content = content.replace(
    `  ChevronRight,
  CheckCircle2,
  HelpCircle,
  Award,`,
    `  CheckCircle2,
  Award,`
  );
  content = content.replace(
    `  const { householdName } = useHousehold();`,
    `  const { householdName: _ } = useHousehold();`
  );
  
  // Fix types from any to SavingsGoal | null
  content = content.replace(
    `import type { SavingsGoal } from "@/lib/supabase/types";`,
    ''
  ); // remove if already imported or duplicate
  
  content = content.replace(
    `import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/use-goals";`,
    `import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/use-goals";
import type { SavingsGoal } from "@/lib/supabase/types";`
  );
  
  content = content.replace(
    `  const [editingGoal, setEditingGoal] = React.useState<any | null>(null);
  const [addFundsOpen, setAddFundsOpen] = React.useState(false);
  const [fundsTargetGoal, setFundsTargetGoal] = React.useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [goalToDelete, setGoalToDelete] = React.useState<any | null>(null);`,
    `  const [editingGoal, setEditingGoal] = React.useState<SavingsGoal | null>(null);
  const [addFundsOpen, setAddFundsOpen] = React.useState(false);
  const [fundsTargetGoal, setFundsTargetGoal] = React.useState<SavingsGoal | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [goalToDelete, setGoalToDelete] = React.useState<SavingsGoal | null>(null);`
  );
  
  // Fix open handlers type
  content = content.replaceAll(
    `handleOpenEdit = (goal: any)`,
    `handleOpenEdit = (goal: SavingsGoal)`
  );
  content = content.replaceAll(
    `handleOpenAddFunds = (goal: any)`,
    `handleOpenAddFunds = (goal: SavingsGoal)`
  );
  content = content.replaceAll(
    `handleOpenDelete = (goal: any)`,
    `handleOpenDelete = (goal: SavingsGoal)`
  );
  
  // Escape unescaped double quotes inside JSX
  content = content.replaceAll(
    `Tabung untuk "{fundsTargetGoal?.name}"`,
    `Tabung untuk &quot;{fundsTargetGoal?.name}&quot;`
  );
  content = content.replaceAll(
    `target tabungan "{goalToDelete?.name}"?`,
    `target tabungan &quot;{goalToDelete?.name}&quot;?`
  );
  
  fs.writeFileSync(savingsPath, content, 'utf8');
  console.log('Fixed savings/page.tsx linter errors!');
}

// 2. Fix src/app/(app)/transactions/page.tsx
const txPagePath = path.join(__dirname, '../src/app/(app)/transactions/page.tsx');
if (fs.existsSync(txPagePath)) {
  let content = fs.readFileSync(txPagePath, 'utf8');
  
  // Add missing imports
  content = content.replace(
    `import { Card } from "@/components/ui/card";`,
    `import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/shared/empty-state";
import type { TransactionWithDetails } from "@/hooks/use-transactions";`
  );
  
  // Clean unused imports
  content = content.replace(
    `  Search,
  Plus,
  Pencil,
  Trash2,`,
    `  Search,
  Pencil,
  Trash2,`
  );
  content = content.replace(
    `  FilterX,
  PlusCircle,`,
    `  FilterX,`
  );
  content = content.replace(
    `  const [selectedTxForDetail, setSelectedTxForDetail] = React.useState<any>(null);
  const [txToDelete, setTxToDelete] = React.useState<any>(null);`,
    `  const [selectedTxForDetail, setSelectedTxForDetail] = React.useState<TransactionWithDetails | null>(null);
  const [txToDelete, setTxToDelete] = React.useState<TransactionWithDetails | null>(null);`
  );
  
  fs.writeFileSync(txPagePath, content, 'utf8');
  console.log('Fixed transactions/page.tsx linter errors!');
}

// 3. Fix src/components/transaction/transaction-detail-dialog.tsx
const detailPath = path.join(__dirname, '../src/components/transaction/transaction-detail-dialog.tsx');
if (fs.existsSync(detailPath)) {
  let content = fs.readFileSync(detailPath, 'utf8');
  
  // Fix imports
  content = content.replace(
    `  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";`,
    `  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";`
  );
  
  content = content.replace(
    `  Calendar,
  Clock,
  User,
  Briefcase,
  FileText,
  ArrowRightLeft,
  Pencil,
  Trash2,
  Tag,`,
    `  Calendar,
  User,
  Briefcase,
  ArrowRightLeft,
  Pencil,
  Trash2,
  Tag,`
  );
  
  fs.writeFileSync(detailPath, content, 'utf8');
  console.log('Fixed transaction-detail-dialog.tsx linter errors!');
}

// 4. Fix src/components/transaction/quick-add-sheet.tsx purity & setState rules
const quickAddPath = path.join(__dirname, '../src/components/transaction/quick-add-sheet.tsx');
if (fs.existsSync(quickAddPath)) {
  let content = fs.readFileSync(quickAddPath, 'utf8');
  
  // Replace the isFutureDate useMemo with a requestAnimationFrame useEffect to ensure both render purity and non-cascading state updates
  content = content.replace(
    `  // State to track if the selected date is in the future (scheduled)
  const isFutureDate = React.useMemo(() => {
    if (!occurredAt) return false;
    return new Date(occurredAt).getTime() > Date.now();
  }, [occurredAt]);`,
    `  // State to track if the selected date is in the future (scheduled)
  const [isFutureDate, setIsFutureDate] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!occurredAt) {
      setIsFutureDate(false);
      return;
    }
    const checkFuture = () => {
      if (!active) return;
      setIsFutureDate(new Date(occurredAt).getTime() > Date.now());
    };
    const frame = requestAnimationFrame(checkFuture);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [occurredAt]);`
  );
  
  fs.writeFileSync(quickAddPath, content, 'utf8');
  console.log('Fixed quick-add-sheet.tsx purity & useEffect rules!');
}

// 5. Fix src/hooks/use-activity-logs.ts
const logsHookPath = path.join(__dirname, '../src/hooks/use-activity-logs.ts');
if (fs.existsSync(logsHookPath)) {
  let content = fs.readFileSync(logsHookPath, 'utf8');
  
  content = content.replace(
    `  metadata: any;`,
    `  metadata: Record<string, unknown> | null;`
  );
  
  fs.writeFileSync(logsHookPath, content, 'utf8');
  console.log('Fixed use-activity-logs.ts type error!');
}

// 6. Fix src/lib/db/sync.ts destructuring warnings
const syncFilePath = path.join(__dirname, '../src/lib/db/sync.ts');
if (fs.existsSync(syncFilePath)) {
  let content = fs.readFileSync(syncFilePath, 'utf8');
  
  // Let's replace 'const { syncStatus: _, ...payload } = entry.payload;' with pure deletion
  content = content.replaceAll(
    `          const { syncStatus: _, ...payload } = entry.payload;`,
    `          const payload = { ...entry.payload };
          delete (payload as any).syncStatus;`
  );
  
  fs.writeFileSync(syncFilePath, content, 'utf8');
  console.log('Fixed sync.ts unused variables warnings!');
}

console.log('All custom fixes completed!');
